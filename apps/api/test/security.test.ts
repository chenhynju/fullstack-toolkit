import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/lib/password';
import { readConfig } from '../src/lib/config';
describe('password hashing', () => {
  it('salts hashes and verifies only the correct password', async () => {
    const a = await hashPassword('correct-password-1234');
    const b = await hashPassword('correct-password-1234');
    expect(a).not.toBe(b);
    expect(await verifyPassword('correct-password-1234', a)).toBe(true);
    expect(await verifyPassword('wrong-password-1234', a)).toBe(false);
    for (const invalid of ['bad', 'scrypt$salt$nope', 'other$salt$' + 'a'.repeat(128)])
      expect(await verifyPassword('x', invalid)).toBe(false);
  });
});
describe('fail-closed configuration', () => {
  it('requires database config and valid bounded ports', () => {
    for (const env of [
      {},
      {
        REDIS_URL: 'redis://localhost:6379',
        DATABASE_URL: 'postgresql://toolkit_app:test@localhost/test',
        PORT: '0'
      },
      {
        REDIS_URL: 'redis://localhost:6379',
        DATABASE_URL: 'postgresql://toolkit_app:test@localhost/test',
        PORT: '70000'
      },
      { REDIS_URL: 'redis://localhost:6379', DATABASE_URL: 'postgres://wrong' },
      {
        REDIS_URL: 'redis://localhost:6379',
        DATABASE_URL: 'postgresql://toolkit_app:test@localhost/test',
        NODE_ENV: 'oops'
      }
    ])
      expect(() => readConfig(env)).toThrow();
  });
  it('requires an exact HTTPS production origin', () => {
    for (const APP_ORIGIN of [
      undefined,
      'http://example.com',
      'https://example.com/path',
      'https://user:secret@example.com'
    ])
      expect(() =>
        readConfig({
          REDIS_URL: 'redis://localhost:6379',
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://toolkit_app:test@localhost/test',
          APP_ORIGIN
        })
      ).toThrow();
    expect(
      readConfig({
        REDIS_URL: 'redis://localhost:6379',
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://toolkit_app:test@localhost/test',
        APP_ORIGIN: 'https://example.com'
      }).APP_ORIGIN
    ).toBe('https://example.com');
    expect(
      readConfig({
        REDIS_URL: 'redis://localhost:6379',
        DATABASE_URL: 'postgresql://toolkit_app:test@localhost/test'
      }).PORT
    ).toBe(3001);
  });
});
