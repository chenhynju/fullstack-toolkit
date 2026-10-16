# 性能优化报告模板（作品集核心交付物）

> 用法：完成一轮优化后，把测量数据填入下表，并保留前后截图（存到 `docs/perf/`）。
> 面试官只信数字——每个结论必须有可复现的测量方法与数据支撑。

## 0. 测量规范（数字可信的前提）

- 用 **production build**（`pnpm build` 后 `pnpm --filter @repo/web start`）测量，禁用 dev 模式。
- 首屏用 Lighthouse（或 Lighthouse CI）跑 3 次取中位数，注明测试条件：
  移动端模拟 + 4G 节流（Lighthouse 默认）。
- 报告三个 Web Vitals：**LCP / CLS / INP**，不要只写"首屏时间"。
- 包体积用 `pnpm --filter @repo/web analyze`（bundle-analyzer）导出 Top10 依赖表。
- CI 耗时用 GitHub Actions 每个 job 的耗时截图对比。

## 1. 首屏性能基线

| 指标 | 优化前 | 目标 | 优化后 | 备注 |
|---|---|---|---|---|
| LCP | ___s | < 2.5s | ___s | |
| CLS | ___ | < 0.1 | ___ | |
| INP | ___ms | < 200ms | ___ms | |
| JS 总体积（gzip） | ___KB | — | ___KB | bundle-analyzer |

## 2. 优化动作清单（每步记录收益）

| # | 动作 | 手段 | 实测收益 |
|---|---|---|---|
| 1 | 依赖瘦身 | moment→dayjs、lodash→lodash-es、砍整包重型库 | |
| 2 | 路由级代码分割 | dynamic import 懒加载非首屏路由 | |
| 3 | 组件库自研化 | 整包 UI 库 → 自研 @repo/ui | |
| 4 | 服务端组件优先 | 数据获取放 RSC，客户端只留交互 | |
| 5 | 图片优化 | next/image + WebP/AVIF + lazy | |
| 6 | 字体优化 | next/font 自托管 | |
| 7 | 三方脚本延迟 | next/script lazyOnload | |
| 8 | 缓存与 CDN | 静态资源 immutable 缓存 + CDN | |

## 3. CI 提速记录

| 环节 | 手段 | 优化前 | 优化后 |
|---|---|---|---|
| 依赖安装 | setup-node `cache: pnpm` | | |
| 检查/测试 | lint/typecheck/test 拆并行 job | | |
| 构建 | Turborepo 缓存（.turbo + actions/cache） | | |
| E2E | Playwright shard + 浏览器缓存 | | |
| Docker | 多阶段构建、依赖层与源码层分离 | | |

## 4. 结论段落（README 引用）

> 通过 X/Y/Z 三个动作，LCP 从 ___s 降至 ___s（-__%），CI 从 ___min 降至 ___min（-__%）。
> 完整数据与截图见 `docs/perf/`。
