import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:3300', trace: 'retain-on-failure' },
  webServer: { command: 'pnpm preview', url: 'http://127.0.0.1:3300', reuseExistingServer: false }
});
