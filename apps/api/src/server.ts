import { buildApp } from './app';

const app = buildApp();
const port = Number(process.env.PORT ?? 3001);

app
  .listen({ port, host: '0.0.0.0' })
  .then(() => {
    console.log('[api] listening', { port });
  })
  .catch((err: unknown) => {
    console.error('[api] failed to start', err);
    process.exit(1);
  });
