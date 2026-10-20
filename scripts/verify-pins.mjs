import { readdirSync, readFileSync } from 'node:fs';
const paths = [
  '.',
  ...['apps', 'packages'].flatMap((parent) =>
    readdirSync(parent, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => parent + '/' + entry.name)
  )
];
let count = 0;
for (const path of paths) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(path + '/package.json', 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') continue;
    throw error;
  }
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const [name, version] of Object.entries(manifest[section] ?? {})) {
      if (/^(workspace:|file:|link:)/.test(version)) continue;
      if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version))
        throw new Error(
          path + ': ' + name + ' must use an exact installed version, got ' + version
        );
      count++;
    }
  }
}
console.log(
  '[pins] PASS',
  count,
  'exact direct dependency declarations; peer compatibility ranges are intentionally not installation pins.'
);
