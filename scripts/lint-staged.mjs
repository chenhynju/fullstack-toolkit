import { existsSync } from 'node:fs';
import { dirname, resolve, parse, relative } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const groups = new Map();
for (const input of process.argv.slice(2)) {
  const file = resolve(input);
  if (!/\.(ts|tsx|js|mjs|mts)$/.test(file)) continue;
  const local = relative(process.cwd(), file).replaceAll('\\', '/');
  if (!local.startsWith('apps/') && !local.startsWith('packages/')) continue;
  let directory = dirname(file);
  while (
    !existsSync(resolve(directory, 'eslint.config.mjs')) &&
    directory !== parse(directory).root
  )
    directory = dirname(directory);
  if (!existsSync(resolve(directory, 'eslint.config.mjs')))
    throw new Error('No package ESLint configuration for ' + file);
  const files = groups.get(directory) ?? [];
  files.push(file);
  groups.set(directory, files);
}
for (const [cwd, files] of groups) {
  const require = createRequire(resolve(cwd, 'package.json'));
  execFileSync(
    process.execPath,
    [
      resolve(dirname(require.resolve('eslint/package.json')), 'bin/eslint.js'),
      '--fix',
      '--max-warnings',
      '0',
      ...files
    ],
    { cwd, stdio: 'inherit' }
  );
}
