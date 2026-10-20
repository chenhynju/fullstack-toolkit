import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@repo/db';
import { z } from 'zod';
import { requireUser } from '../lib/auth';
import { AppError } from '../lib/errors';
import { audit, notFound, roles, tenantTransaction, writers } from '../lib/tenant';
const projectFields = {
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000),
  status: z.enum(['PLANNED', 'ACTIVE', 'DONE'])
};
const projectCreate = z
  .object({
    title: projectFields.title,
    description: projectFields.description.default(''),
    status: projectFields.status.default('PLANNED')
  })
  .strict();
const projectUpdate = z
  .object(projectFields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0);
const taskFields = {
  title: z.string().trim().min(1).max(160),
  status: z.enum(['TODO', 'ACTIVE', 'DONE']),
  assigneeId: z.number().int().positive().nullable(),
  dueAt: z.string().datetime({ offset: true }).nullable()
};
const taskCreate = z
  .object({
    title: taskFields.title,
    status: taskFields.status.default('TODO'),
    assigneeId: taskFields.assigneeId.optional(),
    dueAt: taskFields.dueAt.optional()
  })
  .strict();
const taskUpdate = z
  .object(taskFields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0);
const params = (value: unknown) =>
  z
    .object({
      projectId: z.string().min(1).max(64).optional(),
      taskId: z.string().min(1).max(64).optional(),
      commentId: z.string().min(1).max(64).optional()
    })
    .parse(value);
export function projectRoutes(app: FastifyInstance, db: PrismaClient) {
  const base = '/api/organizations/:organizationId';
  app.get(base + '/projects', async (req) => ({
    data: await tenantTransaction(db, req, roles, (tx, _role, organizationId) =>
      tx.project.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 100 })
    )
  }));
  app.post(base + '/projects', async (req, reply) => {
    const data = await tenantTransaction(db, req, writers, async (tx, _role, organizationId) => {
      const input = projectCreate.parse(req.body);
      const project = await tx.project.create({
        data: { ...input, organizationId, ownerId: requireUser(req).id }
      });
      await audit(tx, req, organizationId, 'project.created', project.id, input);
      return project;
    });
    return reply.code(201).send({ data });
  });
  app.get(base + '/projects/:projectId', async (req) => ({
    data: await tenantTransaction(db, req, roles, async (tx, _role, organizationId) => {
      const project = await tx.project.findFirst({
        where: { id: params(req.params).projectId!, organizationId }
      });
      notFound(project);
      return project;
    })
  }));
  app.patch(base + '/projects/:projectId', async (req) => ({
    data: await tenantTransaction(db, req, writers, async (tx, _role, organizationId) => {
      const id = params(req.params).projectId!;
      const input = projectUpdate.parse(req.body);
      const before = await tx.project.findFirst({ where: { id, organizationId } });
      notFound(before);
      const after = await tx.project.update({ where: { id }, data: input });
      await audit(tx, req, organizationId, 'project.updated', id, {
        before: { title: before.title, description: before.description, status: before.status },
        after: input
      });
      return after;
    })
  }));
  app.delete(base + '/projects/:projectId', async (req, reply) => {
    await tenantTransaction(db, req, writers, async (tx, _role, organizationId) => {
      const id = params(req.params).projectId!;
      const project = await tx.project.findFirst({ where: { id, organizationId } });
      notFound(project);
      await tx.project.delete({ where: { id } });
      await audit(tx, req, organizationId, 'project.deleted', id, { title: project.title });
    });
    return reply.code(204).send();
  });
  app.get(base + '/projects/:projectId/tasks', async (req) => ({
    data: await tenantTransaction(db, req, roles, async (tx, _role, organizationId) => {
      const projectId = params(req.params).projectId!;
      notFound(await tx.project.findFirst({ where: { id: projectId, organizationId } }));
      return tx.task.findMany({
        where: { organizationId, projectId },
        orderBy: { createdAt: 'asc' },
        include: {
          comments: {
            orderBy: { createdAt: 'asc' },
            include: { author: { select: { id: true, name: true } } }
          }
        },
        take: 200
      });
    })
  }));
  app.post(base + '/projects/:projectId/tasks', async (req, reply) => {
    const data = await tenantTransaction(db, req, writers, async (tx, _role, organizationId) => {
      const projectId = params(req.params).projectId!;
      notFound(await tx.project.findFirst({ where: { id: projectId, organizationId } }));
      const input = taskCreate.parse(req.body);
      if (input.assigneeId)
        notFound(
          await tx.membership.findUnique({
            where: { organizationId_userId: { organizationId, userId: input.assigneeId } }
          }),
          'Assignee must be an active member.'
        );
      const task = await tx.task.create({
        data: {
          ...input,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
          organizationId,
          projectId
        }
      });
      await audit(tx, req, organizationId, 'task.created', task.id, {
        title: task.title,
        projectId
      });
      return task;
    });
    return reply.code(201).send({ data });
  });
  app.patch(base + '/tasks/:taskId', async (req) => ({
    data: await tenantTransaction(db, req, writers, async (tx, _role, organizationId) => {
      const id = params(req.params).taskId!;
      const input = taskUpdate.parse(req.body);
      const before = await tx.task.findFirst({ where: { id, organizationId } });
      notFound(before);
      if (input.assigneeId)
        notFound(
          await tx.membership.findUnique({
            where: { organizationId_userId: { organizationId, userId: input.assigneeId } }
          }),
          'Assignee must be an active member.'
        );
      const data = {
        ...input,
        ...(input.dueAt !== undefined ? { dueAt: input.dueAt ? new Date(input.dueAt) : null } : {})
      };
      const task = await tx.task.update({ where: { id }, data });
      await audit(tx, req, organizationId, 'task.updated', id, {
        before: {
          title: before.title,
          status: before.status,
          assigneeId: before.assigneeId,
          dueAt: before.dueAt?.toISOString() ?? null
        },
        after: input
      });
      return task;
    })
  }));
  app.delete(base + '/tasks/:taskId', async (req, reply) => {
    await tenantTransaction(db, req, writers, async (tx, _role, organizationId) => {
      const id = params(req.params).taskId!;
      notFound(await tx.task.findFirst({ where: { id, organizationId } }));
      await tx.task.delete({ where: { id } });
      await audit(tx, req, organizationId, 'task.deleted', id);
    });
    return reply.code(204).send();
  });
  app.post(base + '/tasks/:taskId/comments', async (req, reply) => {
    const data = await tenantTransaction(db, req, writers, async (tx, _role, organizationId) => {
      const taskId = params(req.params).taskId!;
      notFound(await tx.task.findFirst({ where: { id: taskId, organizationId } }));
      const { body } = z
        .object({ body: z.string().trim().min(1).max(4000) })
        .strict()
        .parse(req.body);
      const comment = await tx.comment.create({
        data: { body, taskId, organizationId, authorId: requireUser(req).id }
      });
      await audit(tx, req, organizationId, 'comment.created', comment.id, { taskId });
      return comment;
    });
    return reply.code(201).send({ data });
  });
  app.delete(base + '/comments/:commentId', async (req, reply) => {
    await tenantTransaction(db, req, writers, async (tx, role, organizationId) => {
      const id = params(req.params).commentId!;
      const comment = await tx.comment.findFirst({ where: { id, organizationId } });
      notFound(comment);
      if (role === 'MEMBER' && comment.authorId !== requireUser(req).id)
        throw new AppError(403, 'FORBIDDEN', 'You can only delete your own comments.');
      await tx.comment.delete({ where: { id } });
      await audit(tx, req, organizationId, 'comment.deleted', id, { taskId: comment.taskId });
    });
    return reply.code(204).send();
  });
}
