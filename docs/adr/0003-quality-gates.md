# ADR 0003：质量门禁的内容与阈值

- 状态：已接受
- 日期：2026-02

## 背景

CI 只是执行器，门禁的"内容"才是工程标准。需要明确：合并代码前必须通过什么。

## 决策（六道门禁，全绿才可合并）

| 门禁 | 工具 | 阈值/规则 |
|---|---|---|
| Lint | ESLint 9 平坦配置 + 自定义规则 | 错误即失败；含 `repo-custom/no-untagged-console` |
| 类型检查 | tsc --noEmit（strict） | 零错误 |
| 单元测试 | Vitest + v8 覆盖率 | lines/statements/functions ≥ 80%，branches ≥ 50% |
| 构建 | next build / tsup / prisma generate | 零失败 |
| 包体积预算 | scripts/check-budget.mjs | JS chunk 合计 ≤ 400 KB（可配 BUDGET_KB） |
| E2E | Playwright（真实浏览器） | 首页 → API 全链路通过 |

配合 GitHub 分支保护（Required status checks），任一门禁失败即无法合并。

## 后果

- 优点：把"约定"固化为"机器检查"，不依赖人的自觉。
- 代价：初期配置成本；阈值需随项目成长调整（过高阻碍迭代、过低失去意义）。
