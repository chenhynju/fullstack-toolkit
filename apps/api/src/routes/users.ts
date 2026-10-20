import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@repo/db';
import { requireUser } from '../lib/auth';
import { AppError } from '../lib/errors';
export function userRoutes(app: FastifyInstance, db: PrismaClient) {
  app.get('/api/users', async (req) => {
    requireUser(req);
    void db;
    throw new AppError(403, 'FORBIDDEN', 'Select an organization and use its member directory.');
  });
}
