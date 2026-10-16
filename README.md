# fullstack-toolkit

Monorepo 工程模板：**Next.js + Fastify + Turborepo + pnpm**，内置质量门禁、性能预算与 CI/CD。
新项目从这里开始，自动获得工程规范与交付保障——这也是"性能与工程化基建"作品集项目的骨架。

## 特性

- **单仓全栈**：`apps/web`（Next.js 15 App Router）+ `apps/api`（Fastify 5 + Zod），一个 `pnpm dev` 同时启动
- **共享包**：`@repo/ui`（组件库）、`@repo/db`（Prisma 数据层）、`@repo/types`（前后端 API 契约）、`@repo/config-*`（eslint/tsconfig/tailwind 统一配置）
- **质量门禁**：lint（含自定义 ESLint 规则）→ typecheck（strict）→ 单测（覆盖率阈值）→ 构建 → **包体积预算** → E2E，全绿才可合并
- **性能预算**：`pnpm size-check` 检查 JS chunk 总量，超预算 CI 直接失败
- **自定义 ESLint 规则示例**：`repo-custom/no-untagged-console`（日志必须带 `[tag]` 前缀）
- **CI/CD**：GitHub Actions 双 job（质量门禁 + 真实浏览器 E2E），Turborepo 缓存提速
- **文档**：4 篇架构决策记录（ADR）+ 性能报告模板

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | Next.js 15（App Router / RSC）、React 19、Tailwind CSS 3.4 |
| 后端 | Fastify 5、Zod、Prisma 6（SQLite 开发 / Postgres 生产） |
| 工程化 | Turborepo 2、pnpm workspace、ESLint 9（flat config）、Vitest、Playwright |
| 交付 | GitHub Actions、Docker（参考 Dockerfile + compose） |

## 快速开始

```bash
# 1. 安装依赖（postinstall 自动执行 prisma generate + db 构建）
pnpm install

# 2. 初始化数据库（SQLite，零外部依赖）
pnpm db:push
pnpm db:seed   # 可选：写入示例用户

# 3. 同时启动 web(3000) + api(3001)
pnpm dev
```

打开 http://localhost:3000 —— 首页的"服务状态"卡片会实时展示 api 健康检查结果。

## 常用命令

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 并行启动全部应用（turbo 调度） |
| `pnpm build` | 全量构建（含 prisma generate、next build、tsup） |
| `pnpm lint` / `pnpm typecheck` | 静态检查（只跑受影响包） |
| `pnpm test` | 单元测试 + 覆盖率阈值 |
| `pnpm e2e` | Playwright 端到端（自动拉起 web + api） |
| `pnpm analyze` | 生成 bundle 分析报告（`.next/analyze`） |
| `pnpm size-check` | 包体积预算检查（CI 强制） |
| `pnpm --filter @repo/db db:studio` | Prisma Studio 查看数据 |
| `pnpm format` / `pnpm format:check` | Prettier 格式化 / 检查 |

## 目录结构

```
fullstack-toolkit/
├── apps/
│   ├── web/                  # Next.js 15 前端（App Router + Tailwind）
│   │   ├── app/              #   页面路由
│   │   ├── components/       #   业务组件（api-status 等）
│   │   ├── lib/              #   纯函数工具（带单测）
│   │   ├── tests/            #   Vitest 单测
│   │   └── e2e/              #   Playwright E2E
│   └── api/                  # Fastify 5 后端
│       ├── src/routes/       #   health / users 路由
│       ├── src/lib/          #   校验工具（带单测）
│       └── test/             #   Vitest 单测（含覆盖率阈值）
├── packages/
│   ├── ui/                   # 共享组件库（源码导出，Next transpilePackages）
│   ├── db/                   # Prisma schema + client（构建产物导出）
│   ├── types/                # 前后端共享 API 契约
│   ├── config-eslint/        # 共享 ESLint 配置 + 自定义规则
│   ├── config-typescript/    # tsconfig 基座（base/nextjs/react/node）
│   └── config-tailwind/      # 设计 tokens 预设
├── scripts/
│   └── check-budget.mjs      # 包体积预算脚本
├── docker/                   # 参考 Dockerfile + compose
├── docs/
│   ├── adr/                  # 架构决策记录 ×4
│   └── perf-report-template.md  # 性能优化报告模板（核心交付物）
├── .github/workflows/ci.yml  # 质量门禁 + E2E 流水线
├── turbo.json                # Turborepo 任务编排与缓存
└── pnpm-workspace.yaml
```

## 质量门禁（六道关）

| 门禁 | 工具 | 阈值 |
|---|---|---|
| Lint | ESLint 9 + 自定义规则 `no-untagged-console` | 错误即失败 |
| 类型 | tsc --noEmit（strict） | 零错误 |
| 单测 | Vitest + v8 | lines/statements/functions ≥ 80% |
| 构建 | next build / tsup / prisma generate | 零失败 |
| 体积 | scripts/check-budget.mjs | JS chunk ≤ 300 KB（gzip 口径） |
| E2E | Playwright（真实 Chromium） | 全链路通过 |

门禁全部通过才允许合并（GitHub 分支保护 → Required status checks）。
**如何调预算**：`BUDGET_KB=250 pnpm size-check`；正式调整改 CI 步骤或脚本默认值。
预算口径为 gzip 后体积（与 Next.js 构建报告的 First Load JS 一致），统计 `.next/static/chunks`
全量（含非首屏路由 chunk），比真实首屏（当前约 104 KB）更严格。

## 自定义 ESLint 规则（工程规范固化的示范）

本模板自带一条真实可用的自定义规则 `repo-custom/no-untagged-console`：

```ts
console.log('[api] listening', { port }); // ✅ 通过
console.log('listening', { port });        // ❌ 报错：Console 调用必须以 [tag] 开头
```

规则实现见 [`packages/config-eslint/rules/no-untagged-console.mjs`](packages/config-eslint/rules/no-untagged-console.mjs)。
照此模式，你可以把团队约定（禁止深层相对导入、禁止特定 API 等）固化为机器检查。

## 性能与 CI 提速（作品集核心交付）

> 模板自带**测量工具与报告模板**，真实的前后对比数据需要你在实际项目上采集：
> 基线 → 逐项优化 → 记录每步收益 → 填入 [`docs/perf-report-template.md`](docs/perf-report-template.md)。

- **首屏优化 8 动作清单**与 **CI 提速手段**（pnpm 缓存 / 并行 job / Turbo 缓存 / Playwright shard / Docker 层缓存）见模板文档。
- 测量规范：production build + Lighthouse（LCP/CLS/INP 三指标）+ `pnpm analyze` 体积表，CI 耗时取 Actions job 统计。

## 新项目接入（把模板用于实际开发）

1. GitHub 设为 Template repository → 新项目点 "Use this template"
2. 全局替换包名（`@repo/web` 等），删除示例页面
3. 按需增加 `packages/`（如 `packages/ai`）
4. 日常循环：`pnpm dev` → 写代码 → `pnpm lint && pnpm test` → push → CI 门禁 → 合并 → 部署

## 架构决策记录

- [ADR 0001：pnpm workspace + Turborepo](docs/adr/0001-pnpm-turborepo.md)
- [ADR 0002：共享包导出策略](docs/adr/0002-shared-packages.md)
- [ADR 0003：质量门禁内容与阈值](docs/adr/0003-quality-gates.md)
- [ADR 0004：SQLite 开发 / Postgres 生产](docs/adr/0004-sqlite-dev-postgres-prod.md)

## 待办（Roadmap）

- [ ] 多阶段 Docker 构建 + pnpm deploy（镜像体积优化）
- [ ] Lighthouse CI 接入门禁（性能回归自动拦截）
- [ ] 认证与权限示例（Auth.js / SIWE）
- [ ] 新增 `packages/ai`（Python/FastAPI 服务示例，打通 AI 方向）
