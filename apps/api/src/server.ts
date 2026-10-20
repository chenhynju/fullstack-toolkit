import { buildApp } from './app';
import { prisma } from '@repo/db';
import { readConfig } from './lib/config';
const app = await buildApp();
app.addHook('onClose', async () => {
  await prisma.$disconnect();
});
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}
app.listen({ port: readConfig().PORT, host: readConfig().HOST }).catch((err: unknown) => {
  console.error('[api] failed to start', err instanceof Error ? err.name : 'unknown');
  process.exit(1);
});
