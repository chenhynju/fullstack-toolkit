import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { fixture, mutationHeaders } from './helpers';

describe('Redis shared rate limits and startup failure', () => {
  it('shares login counters between two API instances without an in-memory fallback', async () => {
    const ctx = await fixture();
    const second = await buildApp({ db: ctx.db, env: ctx.env, logger: false });
    try {
      for (let i = 0; i < 7; i++)
        expect(
          (
            await ctx.app.inject({
              method: 'POST',
              url: '/api/auth/login',
              headers: mutationHeaders,
              payload: {}
            })
          ).statusCode
        ).toBe(400);
      const responses = [];
      for (let i = 0; i < 7; i++)
        responses.push(
          (
            await second.inject({
              method: 'POST',
              url: '/api/auth/login',
              headers: mutationHeaders,
              payload: {}
            })
          ).statusCode
        );
      expect(responses).toContain(429);
    } finally {
      await second.close();
      await ctx.close();
    }
  });
  it('rejects unavailable Redis at startup and closes its retrying connection', async () => {
    const ctx = await fixture();
    try {
      await expect(
        buildApp({
          db: ctx.db,
          env: { ...ctx.env, REDIS_URL: 'redis://127.0.0.1:9' },
          logger: false
        })
      ).rejects.toThrow('Redis unavailable at startup');
    } finally {
      await ctx.close();
    }
  });
});
