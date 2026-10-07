import { test, expect } from '@playwright/test';

test.describe('responsive navigation', () => {
  test('mobile menu opens and navigates', async ({ page }) => {
    await page.route('**/api/v1/auth/me', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthorized' }),
        headers: { 'x-request-id': 'r1' },
      })
    );
    await page.goto('/');
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2);

    const menuButton = page.getByLabel('Open navigation');
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await expect(page.getByRole('dialog').getByTestId('nav-anatomy')).toBeVisible();
      await expect(page.getByRole('dialog').getByTestId('nav-home')).toBeVisible();
      await page.keyboard.press('Escape');
    } else {
      await expect(page.getByTestId('site-nav')).toBeVisible();
    }
  });
});
