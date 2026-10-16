// 包体积预算检查：统计 Next.js 构建产物的 JS chunk 总大小，超出预算即失败（用于 CI 质量门禁）
// 口径：gzip 后体积（与 Next.js 构建报告的 "First Load JS" 及用户实际下载量一致）
// 注意：此处统计 .next/static/chunks 全量（含非首屏路由 chunk），比首屏口径（约 104 KB）更严格
// 用法：node scripts/check-budget.mjs，预算可通过环境变量 BUDGET_KB 覆盖（默认 300 KB gzip）
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, resolve } from 'node:path';

const chunksDir = resolve('apps/web/.next/static/chunks');
const budgetKB = Number(process.env.BUDGET_KB ?? 300);

let files = [];
try {
  files = readdirSync(chunksDir).filter((f) => f.endsWith('.js'));
} catch {
  console.error('[budget] 未找到构建产物（apps/web/.next）——请先运行 pnpm build');
  process.exit(1);
}

let rawTotal = 0;
let gzipTotal = 0;
for (const file of files) {
  const buf = readFileSync(join(chunksDir, file));
  rawTotal += buf.length;
  gzipTotal += gzipSync(buf).length;
}

const rawKB = Math.round(rawTotal / 1024);
const gzipKB = Math.round(gzipTotal / 1024);
console.log(
  `[budget] ${files.length} 个 JS chunk：原始 ${rawKB} KB / gzip ${gzipKB} KB（预算 ${budgetKB} KB gzip）`
);

if (gzipKB > budgetKB) {
  console.error(
    '[budget] 超出预算：请做路由级代码分割或精简依赖（pnpm --filter @repo/web analyze 定位大包）'
  );
  process.exit(1);
}

console.log('[budget] 通过');
