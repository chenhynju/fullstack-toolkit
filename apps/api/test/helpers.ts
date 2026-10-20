import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { PrismaClient } from '@repo/db';
import { buildApp } from '../src/app';
export const mutationHeaders = { 'x-csrf-protection': '1', origin: 'http://localhost:3000' };
export async function fixture(production = false) {
  const base = process.env.TEST_ADMIN_DATABASE_URL;
  if (!base || !process.env.TEST_APP_PASSWORD || !process.env.REDIS_URL)
    throw new Error(
      'Isolated PostgreSQL admin URL, application password and Redis are required for integration tests.'
    );
  const name = 'toolkit_test_' + randomUUID().replaceAll('-', '');
  const connection = new Client({ connectionString: base });
  await connection.connect();
  await connection.query('CREATE DATABASE "' + name + '"');
  const adminUrl = new URL(base);
  adminUrl.pathname = '/' + name;
  const setup = new Client({ connectionString: adminUrl.toString() });
  await setup.connect();
  try {
    const directory = resolve('../../packages/db/prisma/migrations');
    for (const entry of readdirSync(directory, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name)))
      await setup.query(readFileSync(resolve(directory, entry.name, 'migration.sql'), 'utf8'));
  } finally {
    await setup.end();
  }
  const url = new URL(adminUrl);
  url.username = 'toolkit_app';
  url.password = process.env.TEST_APP_PASSWORD;
  url.searchParams.set('connection_limit', '3');
  const db = new PrismaClient({ datasourceUrl: url.toString() });
  const admin = new PrismaClient({ datasourceUrl: adminUrl.toString() });
  const env = {
    NODE_ENV: production ? 'production' : 'test',
    DATABASE_URL: url.toString(),
    REDIS_URL: process.env.REDIS_URL,
    RATE_LIMIT_NAMESPACE: name,
    APP_ORIGIN: production ? 'https://toolkit.example.com' : 'http://localhost:3000'
  };
  const app = await buildApp({ db, logger: false, env });
  await app.ready();
  return {
    app,
    db,
    admin,
    url: url.toString(),
    adminUrl: adminUrl.toString(),
    env,
    async close() {
      await app.close();
      await db.$disconnect();
      await admin.$disconnect();
      await connection.query('DROP DATABASE "' + name + '" WITH (FORCE)');
      await connection.end();
    }
  };
}
