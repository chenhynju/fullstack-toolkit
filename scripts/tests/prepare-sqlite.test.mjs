import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
test(
  'Windows SQLite preparation preserves existing data and only creates an empty missing file',
  { skip: process.platform !== 'win32' },
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'toolkit-sqlite-'));
    const path = join(directory, 'fresh.db');
    const run = () =>
      spawnSync(process.execPath, [resolve('scripts/prepare-sqlite.mjs')], {
        env: { ...process.env, DATABASE_URL: 'file:' + path.replaceAll('\\', '/') },
        encoding: 'utf8'
      });
    assert.equal(run().status, 0);
    assert.equal(readFileSync(path).length, 0);
    writeFileSync(path, 'existing database bytes');
    assert.equal(run().status, 0);
    assert.equal(readFileSync(path, 'utf8'), 'existing database bytes');
  }
);
