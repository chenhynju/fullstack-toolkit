import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health';
import { userRoutes } from './routes/users';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true });
  app.register(healthRoutes);
  app.register(userRoutes);

  return app;
}
