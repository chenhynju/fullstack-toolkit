import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextEntryFiles, viteEntryFiles } from '../entry-assets.mjs';
test('Next entry budget includes layout/shared chunks without unrelated routes', () => {
  const files = nextEntryFiles({
    pages: {
      '/layout': ['runtime.js', 'layout.js'],
      '/page': ['runtime.js', 'entry.js'],
      '/other/page': ['other.js']
    }
  });
  assert.deepEqual([...new Set(files)], ['runtime.js', 'layout.js', 'entry.js']);
  assert.throws(() => nextEntryFiles({ pages: { '/page': [] } }));
});
test('Vite entry budget follows shared static imports, handles cycles and excludes lazy imports', () => {
  const files = viteEntryFiles({
    'index.html': { file: 'entry.js', imports: ['shared'], dynamicImports: ['lazy'] },
    shared: { file: 'shared.js', imports: ['index.html'] },
    lazy: { file: 'lazy.js' }
  });
  assert.deepEqual(files, ['entry.js', 'shared.js']);
  assert.throws(() => viteEntryFiles({ 'index.html': { file: 'entry.js', imports: ['missing'] } }));
});
