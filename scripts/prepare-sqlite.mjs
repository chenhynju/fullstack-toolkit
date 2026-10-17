import { closeSync, openSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// Some Windows schema-engine builds reject a missing SQLite file before migrations.
// Create only an absent file; never apply SQL, truncate data, or replace a database.
const database = process.env.DATABASE_URL;
if (process.platform === 'win32' && database?.startsWith('file:') && database !== 'file::memory:') {
  if (database.includes('?'))
    throw new Error('Use an explicit SQLite file without URL query parameters on Windows.');
  const path = database.startsWith('file:///')
    ? fileURLToPath(database)
    : resolve(fileURLToPath(new URL('../packages/db/prisma/', import.meta.url)), database.slice(5));
  try {
    closeSync(openSync(path, 'wx'));
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}
