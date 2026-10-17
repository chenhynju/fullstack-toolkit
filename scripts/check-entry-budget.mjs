import { resolve } from 'node:path';
import { assetBytes, nextEntryFiles, viteEntryFiles, readJson } from './entry-assets.mjs';
try {
  const web = resolve('apps/web/.next'),
    admin = resolve('apps/admin/dist');
  const inputs = [
    [
      'web /',
      web,
      nextEntryFiles(readJson(resolve(web, 'app-build-manifest.json'))),
      Number(process.env.WEB_ENTRY_KB ?? 160)
    ],
    [
      'admin /',
      admin,
      viteEntryFiles(readJson(resolve(admin, '.vite/manifest.json'))),
      Number(process.env.ADMIN_ENTRY_KB ?? 100)
    ]
  ];
  const results = inputs.map(([app, directory, files, limitKB]) => {
    if (!Number.isFinite(limitKB) || limitKB <= 0)
      throw new Error('Budget must be positive and finite');
    const bytes = assetBytes(directory, files);
    if (bytes.gzip > limitKB * 1024)
      throw new Error(app + ' exceeds gzip entry budget: ' + bytes.gzip + ' bytes');
    return { app, ...bytes, limitKB };
  });
  console.log('[entry-budget]', JSON.stringify(results));
  console.log(
    '[entry-budget] PASS: unique modern entry JS plus static imports; excludes lazy imports, inline HTML/RSC, CSS and legacy polyfills. Not LCP or transferred bytes.'
  );
} catch (error) {
  console.error('[entry-budget]', error.message);
  process.exitCode = 1;
}
