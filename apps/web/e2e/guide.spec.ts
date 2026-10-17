import { expect, test } from '@playwright/test';
test('homepage explains the real developer workflow in both languages and on mobile', async ({
  page
}) => {
  await page.goto('/#guide');
  const guide = page.locator('#guide');
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(navigation.getByRole('link', { name: 'Projects', exact: true })).toHaveAttribute(
    'href',
    '#account'
  );
  await navigation.getByRole('link', { name: 'Projects', exact: true }).click();
  await expect(page.locator('#account')).toBeInViewport();
  await navigation.getByRole('link', { name: 'Getting started', exact: false }).click();
  await expect(
    guide.getByRole('heading', { name: 'From a template to your own live product' })
  ).toBeVisible();
  await expect(guide.locator('.usage-steps > li')).toHaveCount(6);
  await expect(guide).toContainText('they do not generate code, run CI or deploy a website');
  await expect(guide).toContainText('gh repo create YOUR_ACCOUNT/my-product');
  await expect(guide).toContainText('pnpm install --frozen-lockfile');
  await expect(guide).toContainText('pnpm e2e');
  await expect(guide).toContainText('gh pr create --base main --fill');
  await expect(guide).toContainText('docker compose --project-name my-product');
  await expect(
    guide.getByRole('link', { name: 'Open the GitHub template', exact: false })
  ).toHaveAttribute('href', 'https://github.com/chenhynju/fullstack-toolkit');
  await guide.locator('.usage-index a').nth(4).click();
  await expect(page).toHaveURL(/#usage-step-5$/);
  await expect(guide.locator('#usage-step-5')).toBeInViewport();
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('zh-CN');
  await expect(
    guide.getByRole('heading', { name: '从工程模板，到你自己的线上项目' })
  ).toBeVisible();
  await expect(guide).toContainText('只保存卡片状态');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#guide');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(guide.locator('pre').first()).toBeVisible();
  await guide.getByRole('link', { name: '完整操作手册', exact: true }).click();
  await expect(page).toHaveURL(/\/manual$/);
});
