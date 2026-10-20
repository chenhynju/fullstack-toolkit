import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { ZodError } from 'zod';
import { prisma, type PrismaClient } from '@repo/db';
import { readConfig } from './lib/config';
import { AppError } from './lib/errors';
import { SESSION_COOKIE, tokenHash } from './lib/auth';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { projectRoutes } from './routes/projects';
import { organizationRoutes } from './routes/organizations';
export async function buildApp(
  options: { db?: PrismaClient; env?: NodeJS.ProcessEnv; logger?: boolean } = {}
) {
  const config = readConfig(options.env);
  const db = options.db ?? prisma;
  const privilege = await db.$queryRaw<
    { unsafe: boolean }[]
  >`SELECT (rolsuper OR rolbypassrls OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('Organization','Membership','Project','Task','Comment','Invitation','AuditLog') AND c.relowner=r.oid)) AS unsafe FROM pg_roles r WHERE rolname=current_user`;
  if (!privilege[0] || privilege[0].unsafe)
    throw new Error('API database role must not own tenant tables or bypass RLS');
  const redis = new Redis(config.REDIS_URL, {
    commandTimeout: 5000,
    connectTimeout: 10000,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1
  });
  redis.on('error', () => {});
  try {
    await redis.connect();
  } catch {
    redis.disconnect();
    throw new Error('Redis unavailable at startup');
  }
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            redact: [
              'req.headers.cookie',
              'req.headers.authorization',
              'res.headers.set-cookie',
              'password',
              'passwordHash',
              'token'
            ]
          },
    requestIdHeader: false,
    genReqId: () => randomUUID(),
    bodyLimit: 16 * 1024,
    trustProxy: config.TRUST_PROXY ? config.TRUST_PROXY.split(',') : false
  });
  await app.register(cookie);
  await app.register(helmet);
  app.addHook('onClose', async () => {
    await redis.quit().catch(() => redis.disconnect());
  });
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    redis,
    nameSpace: config.RATE_LIMIT_NAMESPACE + ':rate:'
  });
  app.decorateRequest('currentUser', null);
  app.addHook('onRequest', async (req, reply) => {
    reply.header('X-Request-Id', req.id).header('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.origin;
      if (
        req.headers['x-csrf-protection'] !== '1' ||
        (origin && origin !== config.APP_ORIGIN) ||
        (config.NODE_ENV === 'production' && !origin)
      )
        throw new AppError(403, 'CSRF_REJECTED', 'Request origin could not be verified.');
    }
    const token = req.cookies[SESSION_COOKIE];
    if (token && /^[a-f0-9]{64}$/.test(token)) {
      const session = await db.session.findUnique({
        where: { tokenHash: tokenHash(token) },
        include: { user: true }
      });
      if (session && session.expiresAt > new Date()) req.currentUser = session.user;
    }
  });
  app.setErrorHandler((error, req, reply) => {
    const candidate = error as { statusCode?: number; code?: string } | null;
    let status = 500,
      code = 'INTERNAL_ERROR',
      message = 'Something went wrong. Please try again.';
    if (error instanceof AppError) {
      status = error.statusCode;
      code = error.code;
      message = error.message;
    } else if (error instanceof ZodError) {
      status = 400;
      code = 'INVALID_INPUT';
      message = 'Provide valid input for this action.';
    } else if (candidate?.code === 'P2002') {
      status = 409;
      code = 'CONFLICT';
      message = 'This record already exists.';
    } else if (
      candidate?.statusCode &&
      candidate?.statusCode >= 400 &&
      candidate?.statusCode < 500
    ) {
      status = candidate.statusCode!;
      code = status === 429 ? 'RATE_LIMITED' : 'INVALID_REQUEST';
      message =
        status === 429
          ? 'Too many requests. Please try again later.'
          : 'The request could not be accepted.';
    }
    if (status >= 500)
      req.log.error(
        { errorCode: candidate?.code ?? 'UNKNOWN', requestId: req.id },
        'Request failed'
      );
    return reply.code(status).send({ error: { code, message, requestId: req.id } });
  });
  app.setNotFoundHandler((req, reply) =>
    reply
      .code(404)
      .send({ error: { code: 'NOT_FOUND', message: 'Route not found.', requestId: req.id } })
  );
  app.get('/api/health', async () => ({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }));
  app.get('/api/ready', async () => {
    await db.$queryRaw`SELECT 1`;
    await redis.ping();
    return { status: 'ok', database: 'connected', redis: 'connected' };
  });
  authRoutes(app, db, config);
  userRoutes(app, db);
  projectRoutes(app, db);
  organizationRoutes(app, db, config);
  return app;
}
