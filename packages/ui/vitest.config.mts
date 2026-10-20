import { defineConfig } from 'vitest/config';
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/button.tsx', 'src/card.tsx', 'src/cn.ts'],
      thresholds: { lines: 70, statements: 70, functions: 70, branches: 70 }
    }
  }
});
