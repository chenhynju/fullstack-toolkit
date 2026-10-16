import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['node_modules/**', 'dist/**', '.next/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['lib/**'],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 50
      }
    }
  }
});
