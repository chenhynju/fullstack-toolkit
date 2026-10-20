import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@repo/db';
import { z } from 'zod';
import { requireUser, tokenHash } from '../lib/auth';
import { AppError } from '../lib/errors';
import {
  actorTransaction,
  audit,
  managers,
  notFound,
  roles,
  tenantTransaction
} from '../lib/tenant';
import type { AppConfig } from '../lib/config';

const nameInput = z.object({ name: z.string().trim().min(1).max(100) }).strict();
const invitationInput = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    role: z.enum(['ADMIN', 'MEMBER', 'VIEWER'])
  })
  .strict();
function memberId(params: unknown) {
  return z.object({ userId: z.coerce.number().int().positive() }).parse(params).userId;
}
export function organizationRoutes(app: FastifyInstance, db: PrismaClient, config: AppConfig) {
  app.get('/api/organizations', async (req) => ({
    data: await actorTransaction(db, requireUser(req).id, (tx) =>
      tx.membership.findMany({
        where: { userId: requireUser(req).id },
        include: { organization: true },
        orderBy: { createdAt: 'asc' }
      })
    )
  }));
  app.post('/api/organizations', async (req, reply) => {
    const input = nameInput.parse(req.body);
    const id = randomUUID();
    const data = await actorTransaction(db, requireUser(req).id, async (tx) => {
      await tx.$executeRaw`SELECT workspace_create(${id}, ${input.name})`;
      await tx.$queryRaw`SELECT set_config('app.tenant', ${id}, true)`;
      await audit(tx, req, id, 'organization.created', id, { name: input.name });
      return tx.organization.findUniqueOrThrow({ where: { id } });
    });
    return reply.code(201).send({ data });
  });
  app.patch('/api/organizations/:organizationId', async (req) => ({
    data: await tenantTransaction(db, req, managers, async (tx, _role, organizationId) => {
      const input = nameInput.parse(req.body);
      const before = await tx.organization.findUniqueOrThrow({ where: { id: organizationId } });
      const after = await tx.organization.update({ where: { id: organizationId }, data: input });
      await audit(tx, req, organizationId, 'organization.updated', organizationId, {
        before: { name: before.name },
        after: input
      });
      return after;
    })
  }));
  app.get('/api/organizations/:organizationId/members', async (req) => ({
    data: await tenantTransaction(db, req, roles, (tx, _role, organizationId) =>
      tx.membership.findMany({
        where: { organizationId },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' }
      })
    )
  }));
  app.patch('/api/organizations/:organizationId/members/:userId', async (req) => ({
    data: await tenantTransaction(db, req, managers, async (tx, role, organizationId) => {
      const userId = memberId(req.params);
      const input = z
        .object({ role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']) })
        .strict()
        .parse(req.body);
      const where = { organizationId_userId: { organizationId, userId } };
      const before = await tx.membership.findUnique({ where });
      notFound(before);
      if (
        before.role === 'OWNER' ||
        (role === 'ADMIN' && (before.role === 'ADMIN' || input.role === 'ADMIN'))
      )
        throw new AppError(
          403,
          'FORBIDDEN',
          'Only the owner can manage administrators. Ownership requires an explicit transfer.'
        );
      const after = await tx.membership.update({ where, data: input });
      await audit(tx, req, organizationId, 'member.role_changed', String(userId), {
        before: { role: before.role },
        after: input
      });
      return after;
    })
  }));
  app.delete('/api/organizations/:organizationId/members/:userId', async (req, reply) => {
    await tenantTransaction(db, req, managers, async (tx, role, organizationId) => {
      const userId = memberId(req.params);
      const where = { organizationId_userId: { organizationId, userId } };
      const member = await tx.membership.findUnique({ where });
      notFound(member);
      if (member.role === 'OWNER' || (role === 'ADMIN' && member.role === 'ADMIN'))
        throw new AppError(
          403,
          'FORBIDDEN',
          'Only the owner can manage administrators. Ownership requires an explicit transfer.'
        );
      await tx.task.updateMany({
        where: { organizationId, assigneeId: userId },
        data: { assigneeId: null }
      });
      await tx.membership.delete({ where });
      await audit(tx, req, organizationId, 'member.removed', String(userId), {
        previousRole: member.role
      });
    });
    return reply.code(204).send();
  });
  app.post('/api/organizations/:organizationId/transfer', async (req) => ({
    data: await tenantTransaction(db, req, ['OWNER'], async (tx, _role, organizationId) => {
      const { userId } = z.object({ userId: z.number().int().positive() }).strict().parse(req.body);
      const actorId = requireUser(req).id;
      if (actorId === userId)
        throw new AppError(400, 'INVALID_INPUT', 'Select another active member.');
      const target = await tx.membership.findUnique({
        where: { organizationId_userId: { organizationId, userId } }
      });
      notFound(target);
      await tx.membership.update({
        where: { organizationId_userId: { organizationId, userId: actorId } },
        data: { role: 'ADMIN' }
      });
      await tx.membership.update({
        where: { organizationId_userId: { organizationId, userId } },
        data: { role: 'OWNER' }
      });
      await audit(tx, req, organizationId, 'organization.owner_transferred', String(userId), {
        previousOwnerId: actorId,
        newOwnerId: userId
      });
      return { ownerId: userId };
    })
  }));
  app.get('/api/organizations/:organizationId/invitations', async (req) => ({
    data: await tenantTransaction(db, req, managers, (tx, _role, organizationId) =>
      tx.invitation.findMany({
        where: { organizationId },
        select: {
          id: true,
          email: true,
          role: true,
          expiresAt: true,
          acceptedAt: true,
          revokedAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      })
    )
  }));
  app.post('/api/organizations/:organizationId/invitations', async (req, reply) => {
    const data = await tenantTransaction(db, req, managers, async (tx, role, organizationId) => {
      const input = invitationInput.parse(req.body);
      if (input.role === 'ADMIN' && role !== 'OWNER')
        throw new AppError(403, 'FORBIDDEN', 'Only the owner can invite administrators.');
      const existing = await tx.membership.findFirst({
        where: { organizationId, user: { email: input.email } }
      });
      if (existing) throw new AppError(409, 'CONFLICT', 'This account is already a member.');
      const token = randomBytes(32).toString('hex');
      const invitation = await tx.invitation.create({
        data: {
          ...input,
          organizationId,
          tokenHash: tokenHash(token),
          expiresAt: new Date(Date.now() + 48 * 3600 * 1000)
        }
      });
      await audit(tx, req, organizationId, 'invitation.created', invitation.id, {
        email: input.email,
        role: input.role
      });
      return {
        id: invitation.id,
        email: input.email,
        role: input.role,
        expiresAt: invitation.expiresAt,
        link: config.APP_ORIGIN + '/#invite=' + token
      };
    });
    return reply.code(201).send({ data });
  });
  app.delete('/api/organizations/:organizationId/invitations/:invitationId', async (req, reply) => {
    await tenantTransaction(db, req, managers, async (tx, _role, organizationId) => {
      const { invitationId } = z.object({ invitationId: z.string().max(64) }).parse(req.params);
      const result = await tx.invitation.updateMany({
        where: { id: invitationId, organizationId, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() }
      });
      notFound(result.count);
      await audit(tx, req, organizationId, 'invitation.revoked', invitationId);
    });
    return reply.code(204).send();
  });
  app.post('/api/invitations/accept', async (req) => ({
    data: await actorTransaction(db, requireUser(req).id, async (tx) => {
      const { token } = z
        .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
        .strict()
        .parse(req.body);
      const result = await tx.$queryRaw<
        { id: string | null }[]
      >`SELECT workspace_accept(${tokenHash(token)}) AS id`;
      const organizationId = result[0]?.id;
      if (!organizationId)
        throw new AppError(
          400,
          'INVALID_INVITATION',
          'Invitation is invalid, expired, already used, or belongs to another account.'
        );
      await tx.$queryRaw`SELECT set_config('app.tenant', ${organizationId}, true)`;
      await audit(tx, req, organizationId, 'invitation.accepted', String(requireUser(req).id));
      return { organizationId };
    })
  }));
  app.get('/api/organizations/:organizationId/audit', async (req) => ({
    data: await tenantTransaction(db, req, managers, (tx, _role, organizationId) =>
      tx.auditLog.findMany({
        where: { organizationId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 100
      })
    )
  }));
}
