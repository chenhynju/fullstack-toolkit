import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fixture, mutationHeaders } from './helpers';
import { hashPassword } from '../src/lib/password';
import { tokenHash } from '../src/lib/auth';

describe('real SQLite to PostgreSQL migration rehearsal', () => {
  it('preserves identities, password hashes, session digests, project IDs and ownership; refuses a second import', async () => {
    const ctx = await fixture(),
      directory = mkdtempSync(join(tmpdir(), 'toolkit-migration-'));
    try {
      const password = 'migration-test-password-20261021',
        hash = await hashPassword(password),
        token = 'ab'.repeat(32);
      const database = join(directory, 'legacy.db'),
        packet = join(directory, 'packet.json');
      const input = join(directory, 'source.json');
      writeFileSync(input, JSON.stringify({ hash, digest: tokenHash(token) }));
      const python = process.platform === 'win32' ? 'python' : 'python3';
      execFileSync(python, [
        '-c',
        `import sqlite3,json,sys,pathlib
db=sqlite3.connect(sys.argv[1]);data=json.loads(pathlib.Path(sys.argv[2]).read_text());root=pathlib.Path(sys.argv[3])
for migration in sorted(root.iterdir()):
 if migration.is_dir():db.executescript((migration/'migration.sql').read_text(encoding='utf-8'))
db.execute('INSERT INTO "User"(id,email,name,"createdAt","passwordHash",role) VALUES(?,?,?,?,?,?)',(37,'legacy@example.com','Legacy account','2023-11-14 22:13:20',data['hash'],'ADMIN'))
db.execute('INSERT INTO "Session"(id,"tokenHash","userId","expiresAt") VALUES(?,?,?,?)',('legacy-session',data['digest'],37,2000000000000))
db.execute('INSERT INTO "Project"(id,title,description,status,"ownerId","createdAt","updatedAt") VALUES(?,?,?,?,?,?,?)',('legacy-project','Preserved project','Original description','ACTIVE',37,1700000000000,1700000001000))
db.commit();db.close()`,
        database,
        input,
        resolve('../../packages/db/prisma/legacy-sqlite/migrations')
      ]);
      const exported = execFileSync(
        python,
        [resolve('../../scripts/export-sqlite.py'), database, packet],
        { encoding: 'utf-8' }
      );
      expect(JSON.parse(exported).exported).toEqual({ User: 1, Session: 1, Project: 1 });
      const env = { ...process.env, MIGRATION_DATABASE_URL: ctx.adminUrl };
      const imported = execFileSync(
        process.execPath,
        [resolve('../../scripts/import-sqlite.mjs'), packet],
        { env, encoding: 'utf-8', timeout: 120000 }
      );
      expect(JSON.parse(imported).status).toBe('PASS');
      const user = await ctx.admin.user.findUniqueOrThrow({ where: { id: 37 } });
      expect(user.passwordHash).toBe(hash);
      expect(user.role).toBe('ADMIN');
      expect(user.createdAt.toISOString()).toBe('2023-11-14T22:13:20.000Z');
      const oldSession = await ctx.app.inject({
        url: '/api/auth/me',
        headers: { cookie: 'toolkit_session=' + token }
      });
      expect(oldSession.statusCode).toBe(200);
      const login = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: mutationHeaders,
        payload: { email: 'legacy@example.com', password }
      });
      expect(login.statusCode).toBe(200);
      const organization = (await ctx.admin.organization.findMany())[0]!;
      const project = await ctx.app.inject({
        url: '/api/organizations/' + organization.id + '/projects/legacy-project',
        headers: { cookie: 'toolkit_session=' + token }
      });
      expect(project.statusCode).toBe(200);
      expect(project.json().data).toMatchObject({
        id: 'legacy-project',
        ownerId: 37,
        organizationId: organization.id,
        title: 'Preserved project',
        description: 'Original description',
        status: 'ACTIVE'
      });
      expect(() =>
        execFileSync(process.execPath, [resolve('../../scripts/import-sqlite.mjs'), packet], {
          env,
          stdio: 'pipe',
          timeout: 120000
        })
      ).toThrow();
      expect(await ctx.admin.project.count()).toBe(1);
      const packetText = readFileSync(packet, 'utf-8');
      expect(packetText).not.toContain(password);
    } finally {
      await ctx.close();
      rmSync(directory, { recursive: true, force: true });
    }
  }, 180000);
});
