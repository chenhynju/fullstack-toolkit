# ADR 0002：共享包的导出策略（源码导出 vs 构建产物）

- 状态：已接受
- 日期：2026-02

## 背景

Monorepo 中共享包（ui/types/db）被多个应用消费，需要决定消费方拿到的是
源码还是构建产物。

## 决策

- `@repo/ui`、`@repo/types`：导出 **TypeScript 源码**（`exports: "./src/index.ts(x)"`）。
  消费方（web）通过 `transpilePackages` 让 Next.js 转译；api 仅类型级使用 `@repo/types`。
- `@repo/db`：**构建为 JS + d.ts 后导出**（`exports: { types, default }` → dist）。
  原因：api 生产环境以 Node 直接运行 tsup 产物，源码 .ts 无法被 Node 解析；
  且 Prisma Client 生成物（node_modules/.prisma）必须留在 db 包内解析。

## 后果

- 优点：ui/types 改动即时生效，无需构建步骤；db 边界清晰、运行时可解析。
- 代价：db 修改后需 `pnpm --filter @repo/db build` 才对 api 生效（root postinstall 已自动执行）；
  生产镜像依赖完整 node_modules 布局（后续可用 pnpm deploy + 多阶段构建优化，见性能报告模板）。
