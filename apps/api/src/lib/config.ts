import { z } from 'zod';
export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const schema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    HOST: z
      .enum(['127.0.0.1', '0.0.0.0'])
      .default(env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),
    APP_ORIGIN: z.string().url().default('http://localhost:3000'),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().url(),
    RATE_LIMIT_NAMESPACE: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,64}$/)
      .default('toolkit-saas'),
    TRUST_PROXY: z.string().optional()
  });
  const parsed = schema.safeParse(env);
  if (!parsed.success)
    throw new Error('Invalid environment: check NODE_ENV, PORT, APP_ORIGIN and DATABASE_URL');
  const config = parsed.data;
  const url = new URL(config.APP_ORIGIN);
  if (url.origin !== config.APP_ORIGIN || url.username || url.password)
    throw new Error('APP_ORIGIN must be an exact origin without credentials or path');
  if (config.NODE_ENV === 'production' && (url.protocol !== 'https:' || !env.APP_ORIGIN))
    throw new Error('Production requires an explicit HTTPS APP_ORIGIN');
  if (!/^postgres(ql)?:\/\//.test(config.DATABASE_URL))
    throw new Error('DATABASE_URL must be a PostgreSQL application-role URL');
  const database = new URL(config.DATABASE_URL);
  if (!database.hostname || !database.username || database.pathname.length < 2)
    throw new Error('DATABASE_URL requires host, application user and database name');
  if (!/^rediss?:\/\//.test(config.REDIS_URL))
    throw new Error('REDIS_URL must use redis or rediss');
  return config;
}
export type AppConfig = ReturnType<typeof readConfig>;
