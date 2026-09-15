import { test, expect } from '@playwright/test';

test.describe('responsive navigation', () => {
  test('mobile menu opens and navigates', async ({ page }) => {
    // Pixel 5 is mobile viewport via project
    await page.route('**/api/v1/auth/me', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthorized' }),
        headers: { 'x-request-id': 'r1' },
      })
    );
    await page.goto('/');
    // check no horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2);

    // mobile menu button should be visible on mobile
    const menuButton = page.getByLabel('Open navigation');
    if (await menuButton.isVisible()) {
      await menuButton.click();
      // 8.20.17: assert the real web nav links (Home/Anatomy/Progress) — the
      // previous /Medical Learning/ expectation was stale marketing copy that
      // never existed in the web SiteNav, so the menu could open correctly
      // yet the assertion always failed on mobile viewports.
      await expect(page.getByRole('dialog').getByTestId('nav-anatomy')).toBeVisible();
      await expect(page.getByRole('dialog').getByTestId('nav-home')).toBeVisible();
      await page.keyboard.press('Escape');
    } else {
      // desktop fallback — nav should be visible
      await expect(page.getByTestId('site-nav')).toBeVisible();
    }
  });
});
