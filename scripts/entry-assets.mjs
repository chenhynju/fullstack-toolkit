import { readFileSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { gzipSync } from 'node:zlib';

export function assetBytes(root, files) {
  let raw = 0,
    gzip = 0;
  for (const name of new Set(files.filter((file) => file.endsWith('.js')))) {
    const file = resolve(root, name);
    const rel = relative(resolve(root), file);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Asset escapes build directory');
    const content = readFileSync(file);
    raw += content.length;
    gzip += gzipSync(content).length;
  }
  if (!raw) throw new Error('No entry JavaScript assets found');
  return { raw, gzip };
}
export function nextEntryFiles(manifest, route = '/page') {
  if (!Array.isArray(manifest.pages?.[route]) || !Array.isArray(manifest.pages?.['/layout']))
    throw new Error('Next entry/layout missing from app manifest');
  return [...manifest.pages['/layout'], ...manifest.pages[route]];
}
export function viteEntryFiles(manifest, entry = 'index.html') {
  const seen = new Set(),
    files = [];
  function visit(key) {
    if (seen.has(key)) return;
    seen.add(key);
    const chunk = manifest[key];
    if (!chunk?.file) throw new Error('Vite static import missing from manifest: ' + key);
    files.push(chunk.file);
    for (const dependency of chunk.imports ?? []) visit(dependency);
  }
  visit(entry);
  return files;
}
export function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}
