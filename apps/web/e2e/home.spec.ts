import { expect, test, type Page } from '@playwright/test';
const external = !!process.env.E2E_BASE_URL;
const suffix = process.env.E2E_RUN_ID ?? Date.now() + '-' + Math.random().toString(16).slice(2, 8);
const password = process.env.E2E_PASSWORD ?? 'isolated-browser-password-2971';
async function register(page: Page, email: string, name: string) {
  await page.goto('/');
  await page.getByLabel('Your name', { exact: true }).fill(name);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).last().click();
  await expect(
    page.getByRole('heading', { name: 'Create your organization', exact: true })
  ).toBeVisible();
}
async function createOrganization(page: Page, name: string) {
  await page.getByLabel('Organization name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}
test('anonymous authentication protection and small-screen workspace', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'One team. A clearer way forward.' })
  ).toBeVisible();
  expect((await page.request.get('/api/organizations')).status()).toBe(401);
  expect((await page.request.get('/api/users')).status()).toBe(401);
  expect((await page.request.post('/api/auth/logout')).status()).toBe(403);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('two organizations: invitation, collaboration, scoped roles, removal and audit', async ({
  page,
  browser,
  baseURL
}, testInfo) => {
  test.skip(
    external && (!process.env.E2E_ALLOW_WRITES || !process.env.E2E_PASSWORD),
    'External writes require explicit controlled operator fixtures.'
  );
  test.setTimeout(480000);
  const aliceEmail = 'saas-alice-' + suffix + '@example.invalid',
    bobEmail = 'saas-bob-' + suffix + '@example.invalid';
  const alpha = 'Alpha ' + suffix,
    beta = 'Beta ' + suffix,
    project = 'Team delivery ' + suffix;
  await register(page, aliceEmail, 'Alice');
  await createOrganization(page, alpha);
  await page.getByLabel('Project title', { exact: true }).fill(project);
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await page
    .getByRole('button')
    .filter({ has: page.getByText(project, { exact: true }) })
    .click();
  const detail = page.getByRole('region', { name: 'Project details' });
  await detail.getByLabel('Description', { exact: true }).fill('Shared organization project');
  await detail.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByLabel('Task title', { exact: true }).fill('Ship together');
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(page.getByLabel('Task title Ship together', { exact: true })).toBeVisible();
  const orgs = (await (await page.request.get('/api/organizations')).json()).data;
  const orgA = orgs.find(
    (m: { organization: { name: string } }) => m.organization.name === alpha
  ).organizationId;
  const projectId = (
    await (await page.request.get('/api/organizations/' + orgA + '/projects')).json()
  ).data[0].id;
  const bobContext = await browser.newContext({ baseURL });
  try {
    const bob = await bobContext.newPage();
    await register(bob, bobEmail, 'Bob');
    await createOrganization(bob, beta);
    await bob.getByLabel('Project title', { exact: true }).fill('Beta private project');
    await bob.getByRole('button', { name: 'Create project', exact: true }).click();
    expect(
      (await bob.request.get('/api/organizations/' + orgA + '/projects/' + projectId)).status()
    ).toBe(404);
    await page.getByRole('button', { name: 'Members', exact: true }).click();
    await page.getByLabel('Invited email', { exact: true }).fill(bobEmail);
    await page.getByRole('button', { name: 'Create invitation', exact: true }).click();
    const link = await page.getByLabel('Invitation link', { exact: true }).inputValue();
    await bob.goto(link);
    await bob.getByRole('button', { name: 'Accept invitation', exact: true }).click();
    await expect(bob.getByRole('heading', { name: alpha, exact: true })).toBeVisible();
    await expect(bob.getByText('Beta private project', { exact: true })).toHaveCount(0);
    await bob
      .getByRole('button')
      .filter({ has: bob.getByText(project, { exact: true }) })
      .click();
    await bob.getByLabel('Task status Ship together', { exact: true }).selectOption('ACTIVE');
    const bobId = (await (await bob.request.get('/api/auth/me')).json()).data.id;
    await bob.getByLabel('Assignee Ship together', { exact: true }).selectOption(String(bobId));
    await bob.getByLabel('Due date Ship together', { exact: true }).fill('2026-12-01');
    await bob.getByRole('button', { name: 'Save task', exact: true }).click();
    await bob.getByLabel('Comment Ship together', { exact: true }).fill('Ready for team review');
    await bob.getByRole('button', { name: 'Add comment', exact: true }).click();
    await expect(bob.getByText('Ready for team review', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Projects', exact: true }).click();
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(page.getByText('Ready for team review', { exact: true })).toBeVisible();
    await page.reload();
    await page
      .getByRole('button')
      .filter({ has: page.getByText(project, { exact: true }) })
      .click();
    await expect(page.getByText('Ready for team review', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('workspace-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    await page.screenshot({ path: testInfo.outputPath('workspace-mobile.png'), fullPage: true });
    await page.getByRole('button', { name: 'Members', exact: true }).click();
    await page.getByLabel('Role ' + bobEmail, { exact: true }).selectOption('VIEWER');
    await expect(page.getByRole('status')).toContainText('Changes saved');
    await bob.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(bob.getByRole('button', { name: 'Create project', exact: true })).toHaveCount(0);
    expect(
      (
        await bob.request.post('/api/organizations/' + orgA + '/projects', {
          headers: { 'x-csrf-protection': '1', origin: baseURL! },
          data: { title: 'Viewer bypass' }
        })
      ).status()
    ).toBe(403);
    await bob
      .getByRole('combobox', { name: 'Organization', exact: true })
      .selectOption({ label: beta });
    await expect(bob.getByText('Beta private project', { exact: true })).toBeVisible();
    await expect(bob.getByText(project, { exact: true })).toHaveCount(0);
    page.once('dialog', (d) => d.accept());
    await page
      .locator('.saas-member')
      .filter({ hasText: bobEmail })
      .getByRole('button', { name: 'Remove', exact: true })
      .click();
    await expect(page.locator('.saas-member').filter({ hasText: bobEmail })).toHaveCount(0);
    expect((await bob.request.get('/api/auth/me')).status()).toBe(200);
    expect((await bob.request.get('/api/organizations/' + orgA + '/projects')).status()).toBe(404);
    await page.getByRole('button', { name: 'Audit log', exact: true }).click();
    await expect(
      page.locator('.saas-audit').getByText('Member removed', { exact: true })
    ).toBeVisible();
    await expect(
      page.locator('.saas-audit').getByText('Comment added', { exact: true })
    ).toBeVisible();
    await bob.getByRole('combobox', { name: 'Language', exact: true }).selectOption('zh-CN');
    await expect(bob.getByRole('button', { name: '项目', exact: true })).toBeVisible();
    await expect(bob.getByRole('button', { name: '创建项目', exact: true })).toBeVisible();
    await bob.getByRole('button', { name: '退出登录', exact: true }).click();
    await expect(bob.getByRole('button', { name: '退出登录', exact: true })).toHaveCount(0);
    expect((await bob.request.get('/api/auth/me')).status()).toBe(401);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
    await page.getByLabel('Email address').fill(aliceEmail);
    await page.getByLabel('Password', { exact: true }).fill('wrong-password-1234');
    await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'Email or password is incorrect.'
    );
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
    await expect(page.getByRole('heading', { name: alpha, exact: true })).toBeVisible();
  } finally {
    await bobContext.close();
  }
});
