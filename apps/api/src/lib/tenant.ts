import type { FastifyRequest } from 'fastify';
import type { Prisma, PrismaClient } from '@repo/db';
import { requireUser } from './auth';
import { AppError } from './errors';

export type Tx = Prisma.TransactionClient;
export const roles = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] as const;
export type Role = (typeof roles)[number];
export const writers: readonly Role[] = ['OWNER', 'ADMIN', 'MEMBER'];
export const managers: readonly Role[] = ['OWNER', 'ADMIN'];

export function actorTransaction<T>(
  db: PrismaClient,
  actorId: number,
  work: (tx: Tx) => Promise<T>
) {
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.actor', ${String(actorId)}, true), set_config('app.tenant', '', true)`;
      return work(tx);
    },
    { maxWait: 15000, timeout: 30000 }
  );
}

export function tenantTransaction<T>(
  db: PrismaClient,
  req: FastifyRequest,
  allowed: readonly Role[],
  work: (tx: Tx, role: Role, organizationId: string) => Promise<T>
) {
  const user = requireUser(req);
  const organizationId = (req.params as { organizationId?: string }).organizationId;
  if (!organizationId || organizationId.length > 64)
    throw new AppError(404, 'NOT_FOUND', 'Organization not found.');
  return actorTransaction(db, user.id, async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.tenant', ${organizationId}, true)`;
    const organizations = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "Organization" WHERE id = ${organizationId}`;
    if (!organizations.length) throw new AppError(404, 'NOT_FOUND', 'Organization not found.');
    await tx.$queryRaw`SELECT set_config('lock_timeout', '5s', true)`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${organizationId}, 21021))`;
    const membership = await tx.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } }
    });
    if (!membership || !allowed.includes(membership.role as Role))
      throw new AppError(403, 'FORBIDDEN', 'Your organization role does not permit this action.');
    return work(tx, membership.role as Role, organizationId);
  });
}

export async function audit(
  tx: Tx,
  req: FastifyRequest,
  organizationId: string,
  action: string,
  objectId: string,
  details: Prisma.InputJsonValue = {}
) {
  await tx.auditLog.create({
    data: {
      organizationId,
      actorId: requireUser(req).id,
      action,
      objectId,
      requestId: req.id,
      details
    }
  });
}

export function notFound(value: unknown, message = 'Resource not found.'): asserts value {
  if (!value) throw new AppError(404, 'NOT_FOUND', message);
}
