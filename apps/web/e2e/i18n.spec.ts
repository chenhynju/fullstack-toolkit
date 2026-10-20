import { expect, test } from '@playwright/test';
test('English is the server default; Chinese preference survives reload and help navigation', async ({
  browser,
  baseURL
}) => {
  const context = await browser.newContext({ baseURL, locale: 'zh-CN' });
  try {
    const page = await context.newPage();
    const initial = await page.goto('/');
    expect(await initial!.text()).toContain('lang="en"');
    await expect(
      page.getByRole('heading', { name: 'One team. A clearer way forward.', exact: true })
    ).toBeVisible();
    await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('zh-CN');
    await expect(
      page.getByRole('heading', { name: '让团队协作，清晰向前。', exact: true })
    ).toBeVisible();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    await page.getByRole('link', { name: '帮助', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: '团队工作空间操作手册', exact: true })
    ).toBeVisible();
    await context.addCookies([{ name: 'toolkit_locale', value: 'unsupported', url: baseURL! }]);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  } finally {
    await context.close();
  }
});
