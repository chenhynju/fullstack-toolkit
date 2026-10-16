import { Button, Card } from '@repo/ui';
import { ApiStatus } from '@/components/api-status';

const features = [
  'Next.js 15（App Router / RSC）',
  'Fastify 5 + Zod 校验',
  'Turborepo + pnpm workspace',
  '共享包：ui / db / types / config-*',
  '质量门禁：lint / typecheck / test / e2e / 包体积预算',
  'GitHub Actions CI + Docker'
];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm font-medium text-brand">fullstack-toolkit · Monorepo 工程模板</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">
        从 0 到 1 的工程化基建，
        <br />
        一个仓库搞定前后端。
      </h1>
      <p className="mt-4 text-lg leading-8 text-slate-600">
        TypeScript Monorepo 模板：内置共享包、质量门禁、性能预算与 CI/CD。
        新项目从这里开始，自动获得工程规范与交付保障。
      </p>
      <div className="mt-8 flex gap-3">
        <Button variant="primary">pnpm dev 启动</Button>
        <Button variant="secondary">查看 README</Button>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="text-base font-semibold">内置能力</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {features.map((item) => (
              <li key={item}>· {item}</li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="text-base font-semibold">服务状态</h2>
          <div className="mt-3">
            <ApiStatus />
          </div>
        </Card>
      </div>
    </main>
  );
}
