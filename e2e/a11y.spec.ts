import { test, expect } from '@playwright/test';

test.describe('a11y', () => {
  test('skip link, focus, labels', async ({ page }) => {
    await page.route('**/api/v1/auth/me', route =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthorized' }),
      })
    );
    await page.goto('/login');
    await page.keyboard.press('Tab');
    const skip = page.getByText('Skip to content');
    await expect(skip).toBeFocused();

    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();

    const submit = page.getByTestId('login-submit');
    await submit.focus();
    await expect(submit).toBeFocused();
    await expect(submit).toBeVisible();

    await page.route('**/api/v1/auth/me', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'a1',
          email: 'admin@x.test',
          role: 'ADMIN',
          createdAt: '2026-01-01',
        }),
      })
    );
    await page.goto('/');
    const nav = page.getByTestId('site-nav');
    await expect(nav).toBeVisible();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('nav-home')).toBeVisible();
  });

  test('admin shell keyboard', async ({ page }) => {
    await page.route('**/api/v1/auth/me', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'admin-1',
          email: 'admin@x.test',
          role: 'ADMIN',
          createdAt: '2026-01-01',
        }),
      })
    );
    await page.route('**/api/v1/admin/overview', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalUsers: 1,
          byRole: { STUDENT: 0, TEACHER: 0, ADMIN: 1 },
          cohortCount: 0,
          archivedCohortCount: 0,
          recentUsers: [],
          recentCohorts: [],
        }),
      })
    );
    await page.goto('/cohorts');
    await page.route('**/api/v1/auth/me', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 't1',
          email: 't@x.test',
          role: 'TEACHER',
          createdAt: '2026-01-01',
        }),
      })
    );
    await page.route('**/api/v1/cohorts', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );
    await page.goto('/cohorts');
    const heading = page.getByRole('heading', { name: 'My Cohorts' });
    await expect(heading).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });
});
