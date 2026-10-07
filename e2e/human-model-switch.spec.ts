import { test, expect } from '@playwright/test';

test.describe.serial('human model switching', () => {
  test.setTimeout(240000);
  const STUDENT = {
    id: 's1',
    email: 's@x.test',
    name: 'Sam',
    role: 'STUDENT',
    createdAt: '2026-01-01',
  };

  async function mockAPIs(page: import('@playwright/test').Page) {
    await page.route('**/api/v1/auth/me', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STUDENT) })
    );
    await page.route('**/api/v1/auth/refresh', route =>
      route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
    );
    await page.route('**/api/v1/progress/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );
  }

  async function gotoHumanReady(page: import('@playwright/test').Page) {
    await mockAPIs(page);
    await page.goto('/human');
    await expect(page.getByTestId('human-nav')).toBeVisible({ timeout: 60000 });
    await expect(page.getByTestId('skin-tone-group')).toBeVisible({ timeout: 60000 });
    await expect(page.getByTestId('loading-anatomy')).toBeHidden({ timeout: 120000 });
    await page.waitForTimeout(1500);
  }

  test('male female male loads every time without duplicate fetches', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    const glbs: string[] = [];
    page.on('request', r => {
      if (r.url().endsWith('.glb')) glbs.push(r.url().split('/').pop() as string);
    });
    await gotoHumanReady(page);
    await page.getByTestId('body-model-female').click();
    await expect(page.getByTestId('loading-anatomy')).toBeHidden({ timeout: 120000 });
    await page.getByTestId('body-model-male').click();
    await expect(page.getByTestId('loading-anatomy')).toBeHidden({ timeout: 120000 });
    await page.waitForTimeout(1000);
    const dupes = glbs.filter((g, i) => glbs.indexOf(g) !== i);
    expect(dupes).toEqual([]);
    expect(await page.locator('section canvas').count()).toBe(1);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('rapid switching resolves to the latest model', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await gotoHumanReady(page);
    await page.getByTestId('body-model-female').click();
    await page.waitForTimeout(400);
    await page.getByTestId('body-model-male').click();
    await expect(page.getByTestId('loading-anatomy')).toBeHidden({ timeout: 120000 });
    await expect(page.getByTestId('body-model-male')).toHaveAttribute('aria-pressed', 'true');
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('failed load errors honestly and retry recovers', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await mockAPIs(page);
    let failFemale = true;
    await page.route('**/female-skin-meshopt.glb', route => {
      if (failFemale) return route.fulfill({ status: 404, body: 'missing' });
      return route.continue();
    });
    await page.goto('/human');
    await expect(page.getByTestId('human-nav')).toBeVisible({ timeout: 60000 });
    await expect(page.getByTestId('loading-anatomy')).toBeHidden({ timeout: 120000 });
    await page.getByTestId('body-model-female').click();
    await expect(page.getByTestId('error-skin')).toBeVisible({ timeout: 60000 });
    await expect(page.getByTestId('loading-anatomy')).toBeHidden({ timeout: 30000 });
    failFemale = false;
    await page.getByTestId('retry-skin').click();
    await expect(page.getByTestId('loading-anatomy')).toBeHidden({ timeout: 120000 });
    await expect(page.getByTestId('error-skin')).toBeHidden({ timeout: 15000 });
    await ctx.close();
  });

  test('unmount navigation and return has no stuck loading', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await gotoHumanReady(page);
    await page.getByTestId('human-nav').getByRole('link', { name: 'Progress' }).click();
    await expect(page.getByTestId('learn-title')).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId('human-nav')).toBeVisible({ timeout: 60000 });
    await expect(page.getByTestId('loading-anatomy')).toBeHidden({ timeout: 120000 });
    expect(await page.locator('section canvas').count()).toBe(1);
    await ctx.close();
  });

  test('mobile touch switch has no overflow', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await ctx.newPage();
    await gotoHumanReady(page);
    await page.getByTestId('body-model-female').scrollIntoViewIfNeeded();
    await page.getByTestId('body-model-female').tap();
    await expect(page.getByTestId('loading-anatomy')).toBeHidden({ timeout: 120000 });
    await expect(page.getByTestId('body-model-female')).toHaveAttribute('aria-pressed', 'true');
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
    await ctx.close();
  });

  test('reduced motion switch works immediately', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await gotoHumanReady(page);
    await page.getByTestId('body-model-female').click();
    await expect(page.getByTestId('loading-anatomy')).toBeHidden({ timeout: 120000 });
    await expect(page.getByTestId('body-model-female')).toHaveAttribute('aria-pressed', 'true');
    await ctx.close();
  });
});
