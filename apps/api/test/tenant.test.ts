import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fixture, mutationHeaders } from './helpers';
import { actorTransaction } from '../src/lib/tenant';

describe('two real organizations, permissions, RLS and atomic audit', () => {
  let ctx: Awaited<ReturnType<typeof fixture>>;
  let alice: string, bob: string, carol: string;
  let aliceId: number, bobId: number;
  let orgA: string, orgB: string, project: string, task: string;
  const password = 'tenant-test-password-20261021';
  const call = (
    cookie: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    payload?: Record<string, unknown>
  ) =>
    ctx.app.inject({
      method,
      url,
      headers: { ...mutationHeaders, cookie },
      ...(payload === undefined ? {} : { payload })
    });
  const base = () => '/api/organizations/' + orgA;
  beforeAll(async () => {
    ctx = await fixture();
    const register = async (email: string) => {
      const r = await call('', 'POST', '/api/auth/register', {
        email,
        name: email.split('@')[0],
        password
      });
      expect(r.statusCode).toBe(201);
      return {
        cookie: String(r.headers['set-cookie']).split(';')[0]!,
        id: r.json().data.id as number
      };
    };
    const a = await register('tenant-alice@example.com');
    alice = a.cookie;
    aliceId = a.id;
    const b = await register('tenant-bob@example.com');
    bob = b.cookie;
    bobId = b.id;
    carol = (await register('tenant-carol@example.com')).cookie;
    const aOrg = await call(alice, 'POST', '/api/organizations', { name: 'Alpha' });
    expect(aOrg.statusCode).toBe(201);
    orgA = aOrg.json().data.id;
    const bOrg = await call(bob, 'POST', '/api/organizations', { name: 'Beta' });
    expect(bOrg.statusCode).toBe(201);
    orgB = bOrg.json().data.id;
  }, 90000);
  afterAll(async () => {
    await ctx?.close();
  });
  it('uses a nonprivileged non-owner role and forced RLS on all tenant tables', async () => {
    const r = await ctx.db.$queryRaw<
      { rolsuper: boolean; rolbypassrls: boolean }[]
    >`SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user`;
    expect(r[0]).toEqual({ rolsuper: false, rolbypassrls: false });
    const tables = await ctx.db.$queryRaw<
      { relname: string; relforcerowsecurity: boolean; owner: boolean }[]
    >`SELECT relname,relforcerowsecurity,pg_get_userbyid(relowner)=current_user AS owner FROM pg_class WHERE relname IN ('Organization','Membership','Project','Task','Comment','Invitation','AuditLog')`;
    expect(tables).toHaveLength(7);
    expect(tables.every((t) => t.relforcerowsecurity && !t.owner)).toBe(true);
    const { buildApp } = await import('../src/app');
    await expect(buildApp({ db: ctx.admin, env: ctx.env, logger: false })).rejects.toThrow(
      'must not own tenant tables or bypass RLS'
    );
    await ctx.admin.$executeRawUnsafe('ALTER TABLE "Project" NO FORCE ROW LEVEL SECURITY');
    try {
      await expect(buildApp({ db: ctx.db, env: ctx.env, logger: false })).rejects.toThrow(
        'forced RLS must be installed'
      );
    } finally {
      await ctx.admin.$executeRawUnsafe('ALTER TABLE "Project" FORCE ROW LEVEL SECURITY');
    }
  });
  it('creates a project; global ADMIN and forged org header cannot cross tenants', async () => {
    const r = await call(alice, 'POST', base() + '/projects', { title: 'Alpha delivery' });
    expect(r.statusCode).toBe(201);
    project = r.json().data.id;
    await ctx.admin.user.update({ where: { id: bobId }, data: { role: 'ADMIN' } });
    for (const path of ['/members', '/projects', '/audit', '/invitations'])
      expect((await call(bob, 'GET', base() + path)).statusCode).toBe(404);
    for (const method of ['GET', 'PATCH', 'DELETE'] as const)
      expect(
        (
          await call(
            bob,
            method,
            base() + '/projects/' + project,
            method === 'PATCH' ? { title: 'Stolen' } : undefined
          )
        ).statusCode
      ).toBe(404);
    const forged = await ctx.app.inject({
      url: base() + '/projects',
      headers: { cookie: bob, 'x-organization-id': orgB }
    });
    expect(forged.statusCode).toBe(404);
    expect((await call(bob, 'GET', '/api/users')).statusCode).toBe(403);
  });
  it('binds invitations to identity, enforces single use and gives Bob a separate role in Alpha', async () => {
    const invite = await call(alice, 'POST', base() + '/invitations', {
      email: 'tenant-bob@example.com',
      role: 'MEMBER'
    });
    expect(invite.statusCode).toBe(201);
    const token = invite.json().data.link.split('#invite=')[1];
    expect((await call(carol, 'POST', '/api/invitations/accept', { token })).statusCode).toBe(400);
    expect((await call(bob, 'POST', '/api/invitations/accept', { token })).statusCode).toBe(200);
    expect((await call(bob, 'POST', '/api/invitations/accept', { token })).statusCode).toBe(400);
    const list = (await call(bob, 'GET', '/api/organizations')).json().data;
    expect(list.map((m: { role: string }) => m.role).sort()).toEqual(['MEMBER', 'OWNER']);
    expect(
      (await call(bob, 'POST', base() + '/invitations', { email: 'x@example.com', role: 'ADMIN' }))
        .statusCode
    ).toBe(403);
  });
  it('allows collaboration, enforces composite project/member relations and records comments', async () => {
    const r = await call(bob, 'POST', base() + '/projects/' + project + '/tasks', {
      title: 'Shared task',
      assigneeId: bobId,
      dueAt: '2026-12-01T12:00:00Z'
    });
    expect(r.statusCode).toBe(201);
    task = r.json().data.id;
    expect(
      (
        await call(bob, 'POST', base() + '/tasks/' + task + '/comments', {
          body: 'Ready for review'
        })
      ).statusCode
    ).toBe(201);
    expect(
      (await call(alice, 'GET', base() + '/projects/' + project + '/tasks')).json().data[0]
        .comments[0].body
    ).toBe('Ready for review');
    expect(
      (
        await call(bob, 'PATCH', '/api/organizations/' + orgB + '/tasks/' + task, {
          title: 'Foreign task'
        })
      ).statusCode
    ).toBe(404);
    const foreignUser = await ctx.admin.user.findUniqueOrThrow({
      where: { email: 'tenant-carol@example.com' }
    });
    expect(
      (await call(alice, 'PATCH', base() + '/tasks/' + task, { assigneeId: foreignUser.id }))
        .statusCode
    ).toBe(404);
  });
  it('supports settings, task updates, scoped invitations and audited deletes', async () => {
    expect((await call(alice, 'PATCH', base(), { name: 'Alpha team' })).statusCode).toBe(200);
    expect((await call(alice, 'GET', base() + '/members')).json().data).toHaveLength(2);
    const invitations = await call(alice, 'GET', base() + '/invitations');
    expect(invitations.statusCode).toBe(200);
    expect(invitations.body).not.toContain('tokenHash');
    expect(
      (
        await call(bob, 'PATCH', base() + '/tasks/' + task, {
          title: 'Shared task updated',
          status: 'ACTIVE',
          assigneeId: null,
          dueAt: null
        })
      ).statusCode
    ).toBe(200);
    const comments = (await call(alice, 'GET', base() + '/projects/' + project + '/tasks')).json()
      .data[0].comments;
    expect((await call(bob, 'DELETE', base() + '/comments/' + comments[0].id)).statusCode).toBe(
      204
    );
    const disposable = (
      await call(alice, 'POST', base() + '/projects/' + project + '/tasks', {
        title: 'Disposable task'
      })
    ).json().data.id;
    expect((await call(alice, 'DELETE', base() + '/tasks/' + disposable)).statusCode).toBe(204);
    const extra = (
      await call(alice, 'POST', base() + '/projects', { title: 'Disposable project' })
    ).json().data.id;
    expect((await call(alice, 'DELETE', base() + '/projects/' + extra)).statusCode).toBe(204);
  });
  it('gives organization administrators scoped powers without owner or administrator escalation', async () => {
    expect(
      (await call(alice, 'PATCH', base() + '/members/' + bobId, { role: 'ADMIN' })).statusCode
    ).toBe(200);
    expect((await call(bob, 'GET', base() + '/members')).statusCode).toBe(200);
    expect((await call(bob, 'GET', base() + '/audit')).statusCode).toBe(200);
    expect((await call(bob, 'PATCH', base(), { name: 'Alpha administration' })).statusCode).toBe(
      200
    );
    expect(
      (
        await call(bob, 'POST', base() + '/invitations', {
          email: 'tenant-carol@example.com',
          role: 'ADMIN'
        })
      ).statusCode
    ).toBe(403);
    expect(
      (await call(bob, 'PATCH', base() + '/members/' + aliceId, { role: 'VIEWER' })).statusCode
    ).toBe(403);
    expect((await call(bob, 'DELETE', base() + '/members/' + aliceId)).statusCode).toBe(403);
    expect(
      (await call(bob, 'PATCH', base() + '/members/' + bobId, { role: 'MEMBER' })).statusCode
    ).toBe(403);
    expect((await call(bob, 'POST', base() + '/transfer', { userId: aliceId })).statusCode).toBe(
      403
    );
    expect(
      (await call(alice, 'PATCH', base() + '/members/' + bobId, { role: 'MEMBER' })).statusCode
    ).toBe(200);
  }, 120000);
  it('applies role downgrade immediately to an existing session', async () => {
    expect(
      (await call(alice, 'PATCH', base() + '/members/' + bobId, { role: 'VIEWER' })).statusCode
    ).toBe(200);
    for (const [path, payload] of [
      ['/projects', { title: 'Denied' }],
      ['/tasks/' + task + '/comments', { body: 'Denied' }]
    ] as const)
      expect((await call(bob, 'POST', base() + path, payload)).statusCode).toBe(403);
    expect((await call(bob, 'GET', base() + '/projects')).statusCode).toBe(200);
    expect((await call(bob, 'GET', base() + '/audit')).statusCode).toBe(403);
    expect(
      (
        await call(bob, 'POST', '/api/organizations/' + orgB + '/projects', {
          title: 'Still owner in Beta'
        })
      ).statusCode
    ).toBe(201);
  });
  it('RLS denies no-context access, foreign context and write attempts by a viewer; pool contexts reset', async () => {
    await expect(
      ctx.admin.task.create({
        data: { organizationId: orgB, projectId: project, title: 'Foreign parent' }
      })
    ).rejects.toThrow();
    expect(await ctx.db.project.findMany()).toEqual([]);
    for (let i = 0; i < 4; i++) {
      await actorTransaction(ctx.db, i % 2 === 0 ? aliceId : bobId, async (tx) => {
        await tx.$queryRaw`SELECT set_config('app.tenant',${i % 2 === 0 ? orgA : orgB},true)`;
        const records = await tx.project.findMany();
        expect(records.every((p) => p.organizationId === (i % 2 === 0 ? orgA : orgB))).toBe(true);
      });
      expect(await ctx.db.project.findMany()).toEqual([]);
    }
    await expect(
      actorTransaction(ctx.db, bobId, async (tx) => {
        await tx.$queryRaw`SELECT set_config('app.tenant',${orgA},true)`;
        await tx.project.create({
          data: { organizationId: orgA, title: 'Viewer bypass', ownerId: bobId }
        });
      })
    ).rejects.toThrow();
    await actorTransaction(ctx.db, aliceId, async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.tenant',${orgB},true)`;
      expect(await tx.project.findMany()).toEqual([]);
      expect(await tx.auditLog.findMany()).toEqual([]);
    });
  });
  it('rolls back business/audit together and refuses audit modification', async () => {
    const before = await ctx.admin.auditLog.count();
    await expect(
      actorTransaction(ctx.db, aliceId, async (tx) => {
        await tx.$queryRaw`SELECT set_config('app.tenant',${orgA},true)`;
        await tx.project.create({
          data: { organizationId: orgA, title: 'Must rollback', ownerId: aliceId }
        });
        await tx.auditLog.create({
          data: {
            organizationId: orgA,
            actorId: aliceId,
            action: 'rollback.probe',
            objectId: 'probe',
            requestId: 'probe'
          }
        });
        throw new Error('rollback');
      })
    ).rejects.toThrow('rollback');
    expect(await ctx.admin.project.count({ where: { title: 'Must rollback' } })).toBe(0);
    expect(await ctx.admin.auditLog.count()).toBe(before);
    await expect(ctx.db.auditLog.deleteMany()).rejects.toThrow();
    const log = (await call(alice, 'GET', base() + '/audit')).json().data;
    expect(log.some((x: { action: string }) => x.action === 'member.role_changed')).toBe(true);
    expect(JSON.stringify(log)).not.toContain('tokenHash');
    expect(JSON.stringify(log)).not.toContain(password);
  });
  it('rejects expired/revoked invitations and prevents loss of owner', async () => {
    for (const expired of [true, false]) {
      const invite = await call(alice, 'POST', base() + '/invitations', {
        email: 'tenant-carol@example.com',
        role: 'VIEWER'
      });
      const id = invite.json().data.id,
        token = invite.json().data.link.split('#invite=')[1];
      if (expired)
        await ctx.admin.invitation.update({ where: { id }, data: { expiresAt: new Date(0) } });
      else
        expect((await call(alice, 'DELETE', base() + '/invitations/' + id)).statusCode).toBe(204);
      expect((await call(carol, 'POST', '/api/invitations/accept', { token })).statusCode).toBe(
        400
      );
    }
    expect((await call(alice, 'DELETE', base() + '/members/' + aliceId)).statusCode).toBe(403);
    expect(
      (await call(alice, 'PATCH', base() + '/members/' + aliceId, { role: 'VIEWER' })).statusCode
    ).toBe(403);
    await expect(
      ctx.admin.membership.delete({
        where: { organizationId_userId: { organizationId: orgA, userId: aliceId } }
      })
    ).rejects.toThrow();
  });
  it('removes a member, clears assignments, rejects old session and safely transfers ownership', async () => {
    expect(
      (await call(alice, 'PATCH', base() + '/tasks/' + task, { assigneeId: bobId })).statusCode
    ).toBe(200);
    expect((await ctx.admin.task.findUniqueOrThrow({ where: { id: task } })).assigneeId).toBe(
      bobId
    );
    expect((await call(alice, 'DELETE', base() + '/members/' + bobId)).statusCode).toBe(204);
    expect((await call(bob, 'GET', base() + '/projects')).statusCode).toBe(404);
    expect((await ctx.admin.task.findUniqueOrThrow({ where: { id: task } })).assigneeId).toBeNull();
    const invite = await call(alice, 'POST', base() + '/invitations', {
      email: 'tenant-bob@example.com',
      role: 'MEMBER'
    });
    expect(
      (
        await call(bob, 'POST', '/api/invitations/accept', {
          token: invite.json().data.link.split('#invite=')[1]
        })
      ).statusCode
    ).toBe(200);
    expect((await call(alice, 'POST', base() + '/transfer', { userId: bobId })).statusCode).toBe(
      200
    );
    expect(
      (await ctx.admin.membership.findMany({ where: { organizationId: orgA, role: 'OWNER' } })).map(
        (m) => m.userId
      )
    ).toEqual([bobId]);
    expect((await call(alice, 'POST', base() + '/transfer', { userId: aliceId })).statusCode).toBe(
      403
    );
  });
});
