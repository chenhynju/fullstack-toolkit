import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@repo/db';
import type { ApiResponse, User } from '@repo/types';

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional()
});

function toUser(u: { id: number; email: string; name: string | null; createdAt: Date }): User {
  return { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt.toISOString() };
}

export const userRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/users', async (): Promise<ApiResponse<User[]>> => {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    return { data: users.map(toUser) };
  });

  app.post('/api/users', async (req, reply) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const user = await prisma.user.create({ data: parsed.data });
    return reply.code(201).send({ data: toUser(user) });
  });
};
