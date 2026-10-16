// 种子数据：pnpm db:seed
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 注意：SQLite 的 createMany 不支持 skipDuplicates（Prisma 类型层面即为 never），
  // 这里用 findUnique + create 保证幂等（可重复执行）
  const sampleUsers = [
    { email: 'alice@example.com', name: 'Alice' },
    { email: 'bob@example.com', name: 'Bob' }
  ];

  let count = 0;
  for (const user of sampleUsers) {
    const existing = await prisma.user.findUnique({ where: { email: user.email } });
    if (!existing) {
      await prisma.user.create({ data: user });
      count += 1;
    }
  }
  console.log('[db] seeded', { count });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err: unknown) => {
    console.error('[db] seed failed', err);
    await prisma.$disconnect();
    process.exit(1);
  });
