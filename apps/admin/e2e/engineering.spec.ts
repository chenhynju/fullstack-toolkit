import { expect, test } from '@playwright/test';
test('shared UI and utility accept a release label', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Small apps. Strong delivery.' })).toBeVisible();
  await page.getByLabel('Release label').fill(' RC-42 ');
  await page.getByRole('button', { name: 'Check label' }).click();
  await expect(page.getByRole('status')).toHaveText('Ready: rc-42');
});
test('unsafe paths are rejected on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByLabel('Release label').fill('../secret');
  await page.getByRole('button', { name: 'Check label' }).click();
  await expect(page.getByRole('status')).toContainText('Invalid label');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
