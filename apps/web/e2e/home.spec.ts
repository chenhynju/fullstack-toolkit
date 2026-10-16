import { expect, test } from '@playwright/test';

test('首页渲染且 API 状态为 ok', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /从 0 到 1 的工程化基建/ })).toBeVisible();
  await expect(page.getByTestId('api-status')).toContainText('ok', { timeout: 15_000 });
});
