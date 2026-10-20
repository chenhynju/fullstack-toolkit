import { expect, test } from '@playwright/test';
test('actual team manual replaces homepage engineering marketing and is bilingual', async ({
  page
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Help', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Team workspace manual', exact: true })
  ).toBeVisible();
  await expect(page.locator('.saas-panel')).toHaveCount(6);
  await expect(page.locator('main')).toContainText('48 hours');
  await expect(page.locator('main')).toContainText('Viewers can only read');
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('zh-CN');
  await expect(
    page.getByRole('heading', { name: '团队工作空间操作手册', exact: true })
  ).toBeVisible();
  await expect(page.locator('main')).toContainText('旧登录会话');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: '返回工作空间', exact: false }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
});
