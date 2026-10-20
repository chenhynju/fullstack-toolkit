// Requires the private migration-owner URL, never the application URL.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../packages/db/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
if (!process.env.MIGRATION_DATABASE_URL) throw new Error('Private MIGRATION_DATABASE_URL required');
const packet = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (packet.version !== 1 || !packet.tables) throw new Error('Unsupported migration packet');
const db = new PrismaClient({ datasourceUrl: process.env.MIGRATION_DATABASE_URL });
const date = (value) => {
  let input = value;
  if (typeof input === 'string' && /^\d{13}$/.test(input)) input = Number(input);
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(input))
    input = input.replace(' ', 'T') + 'Z';
  const parsed = new Date(input);
  if (!Number.isFinite(parsed.getTime()))
    throw new Error('Invalid legacy timestamp; migration aborted');
  return parsed;
};
const organizationId = (id) =>
  'legacy-' +
  createHash('sha256')
    .update('toolkit-user-' + id)
    .digest('hex')
    .slice(0, 32);
try {
  const result = await db.$transaction(
    async (tx) => {
      if (
        (await tx.user.count()) ||
        (await tx.organization.count()) ||
        (await tx.project.count()) ||
        (await tx.session.count())
      )
        throw new Error('Import requires an empty target database; no reset is performed');
      const { User: users, Session: sessions, Project: projects } = packet.tables;
      for (const u of users) {
        await tx.user.create({
          data: {
            id: u.id,
            email: u.email,
            name: u.name,
            createdAt: date(u.createdAt),
            passwordHash: u.passwordHash,
            role: u.role
          }
        });
        const id = organizationId(u.id);
        await tx.organization.create({
          data: {
            id,
            name: (u.name || u.email.split('@')[0]) + "'s workspace",
            createdAt: date(u.createdAt)
          }
        });
        await tx.membership.create({
          data: { organizationId: id, userId: u.id, role: 'OWNER', createdAt: date(u.createdAt) }
        });
      }
      for (const s of sessions)
        await tx.session.create({
          data: { id: s.id, tokenHash: s.tokenHash, userId: s.userId, expiresAt: date(s.expiresAt) }
        });
      for (const p of projects)
        await tx.project.create({
          data: {
            id: p.id,
            organizationId: organizationId(p.ownerId),
            ownerId: p.ownerId,
            title: p.title,
            description: p.description,
            status: p.status,
            createdAt: date(p.createdAt),
            updatedAt: date(p.updatedAt)
          }
        });
      await tx.$queryRaw`SELECT setval(pg_get_serial_sequence('"User"','id'), GREATEST(COALESCE((SELECT MAX(id) FROM "User"),0),1), EXISTS(SELECT 1 FROM "User"))`;
      const actual = {
        users: await tx.user.count(),
        sessions: await tx.session.count(),
        projects: await tx.project.count(),
        organizations: await tx.organization.count(),
        memberships: await tx.membership.count()
      };
      if (
        actual.users !== users.length ||
        actual.sessions !== sessions.length ||
        actual.projects !== projects.length ||
        actual.organizations !== users.length ||
        actual.memberships !== users.length
      )
        throw new Error('Migration count reconciliation failed');
      const migratedUsers = await tx.user.findMany();
      if (
        migratedUsers.some((u) => {
          const old = users.find((o) => o.id === u.id);
          return (
            old.passwordHash !== u.passwordHash ||
            old.email !== u.email ||
            date(old.createdAt).getTime() !== u.createdAt.getTime()
          );
        })
      )
        throw new Error('Identity reconciliation failed');
      const migratedSessions = await tx.session.findMany();
      if (
        migratedSessions.some((s) => {
          const old = sessions.find((o) => o.id === s.id);
          return (
            old.tokenHash !== s.tokenHash ||
            old.userId !== s.userId ||
            date(old.expiresAt).getTime() !== s.expiresAt.getTime()
          );
        })
      )
        throw new Error('Session reconciliation failed');
      const migratedProjects = await tx.project.findMany();
      if (
        migratedProjects.some((p) => {
          const old = projects.find((o) => o.id === p.id);
          return (
            p.organizationId !== organizationId(old.ownerId) ||
            p.ownerId !== old.ownerId ||
            p.title !== old.title ||
            p.description !== old.description ||
            p.status !== old.status ||
            p.updatedAt.getTime() !== date(old.updatedAt).getTime()
          );
        })
      )
        throw new Error('Project reconciliation failed');
      return actual;
    },
    { timeout: 120000, maxWait: 15000 }
  );
  console.log(
    JSON.stringify({
      status: 'PASS',
      sourceSHA256: packet.sourceSHA256,
      reconciled: result,
      passwordHashesPreserved: true,
      sessionTokenHashesPreserved: true,
      projectOwnershipPreserved: true
    })
  );
} finally {
  await db.$disconnect();
}
