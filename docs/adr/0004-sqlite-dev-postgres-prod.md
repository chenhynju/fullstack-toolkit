# ADR 0004：开发用 SQLite、生产用 Postgres

- 状态：已接受
- 日期：2026-02

## 背景

模板需要"零外部依赖"即可跑通（克隆 → 安装 → dev），但生产环境应使用成熟的关系库。

## 决策

- 开发/演示：SQLite，`datasource.url` 硬编码为 `file:./dev.db`
  （相对 schema 路径解析，`prisma db push` 与运行时客户端指向同一文件，避免环境变量配置成本）。
- 生产：将 datasource 切换为 Postgres + `env("DATABASE_URL")`，
  docker-compose 中追加 postgres 服务即可。

## 后果

- 优点：新成员 30 秒跑通全栈；无端口冲突、无服务依赖。
- 代价：SQLite 无行级并发写能力，仅适合开发与演示；上线前必须迁移并重测。
