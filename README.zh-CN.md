# Toolkit 企业工作空间

在原 fullstack-toolkit 上演进的多租户企业项目管理应用，保留 Monorepo、认证、安全、双语与工程配置，新增组织、成员、角色、邀请、协作项目、任务、评论和只读审计。

线上地址：https://toolkit.purelamp.uk · [操作帮助](https://toolkit.purelamp.uk/help)。2026-10-21 版本已完成原有数据迁移、公网双组织协作和四服务重启验收；精确结果与限制见验证记录。

一名用户可以属于多个组织且角色不同。组织数据通过服务端成员校验、事务上下文、PostgreSQL 强制 RLS 和复合外键隔离。旧的全站 ADMIN 不授予企业访问权。Redis 目前承担共享限流，不缓存成员权限。

## 开始使用

本地启动步骤见 [English README](README.md) 和[开发部署手册](docs/saas-operations.md)。请使用 PostgreSQL，不能沿用旧版 SQLite 连接字符串。迁移使用数据库所有者连接，API 使用单独的非特权应用账号，二者不能混用。

界面默认英语，支持中文。登录后创建组织，在成员页创建绑定邮箱、48 小时有效、一次性的邀请链接，私下发送给同事；协作项目和任务，分配负责人、设置截止日期、添加评论。所有者、管理员、成员、只读成员权限不同；移除成员后旧会话失去该组织权限。

- [用户操作手册](docs/saas-user-manual.md)，线上帮助入口 `/help`
- [设计与验收清单](docs/saas-design.md)
- [开发、复用、迁移、部署与回滚](docs/saas-operations.md)
- [实际测试与上线状态](docs/saas-verification.md)

旧 SQLite 数据需备份、演练和核对后迁移，不清库重来。保留旧数据卷和精确镜像，不能把代码回滚等同于数据库回滚。历史工程性能报告不代表新版 SaaS 的性能结果。当前不包含 CRM、计费、SSO、MFA 或外部邮件投递。
