import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:3000'
  },
  webServer: [
    {
      command: 'pnpm dev',
      cwd: '../api',
      url: 'http://127.0.0.1:3001/api/health',
      reuseExistingServer: true,
      timeout: 120_000
    },
    {
      command: 'pnpm dev',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: true,
      timeout: 120_000
    }
  ]
});
