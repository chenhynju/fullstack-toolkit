// Isolated development/CI only. Production roles are provisioned privately by the operator.
import { createRequire } from 'node:module';
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const { Client } = require('pg');
const connectionString = process.env.TEST_ADMIN_DATABASE_URL;
const password = process.env.TEST_APP_PASSWORD;
if (!connectionString || !password || process.env.NODE_ENV === 'production')
  throw new Error('Explicit isolated database credentials required');
const client = new Client({ connectionString });
try {
  await client.connect();
  const role = await client.query("SELECT 1 FROM pg_roles WHERE rolname='toolkit_app'");
  if (!role.rowCount)
    await client.query(
      'CREATE ROLE toolkit_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD ' +
        client.escapeLiteral(password)
    );
  console.log('Nonprivileged development application role ready');
} finally {
  await client.end();
}
