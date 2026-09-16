import { test, expect } from '@playwright/test';

const STUDENT = {
  id: 's1',
  email: 's@x.test',
  name: 'Sam',
  role: 'STUDENT',
  createdAt: '2026-01-01',
};
const TEACHER = {
  id: 't1',
  email: 't@x.test',
  name: 'Ada',
  role: 'TEACHER',
  createdAt: '2026-01-01',
};

async function mockAuth(
  page: import('@playwright/test').Page,
  user: Record<string, unknown> | null
) {
  if (user) {
    await page.route('**/api/v1/auth/me', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(user),
        headers: { 'x-request-id': 'req-e2e-1' },
      })
    );
  } else {
    await page.route('**/api/v1/auth/me', route =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'UNAUTHORIZED',
          message: 'Unauthorized',
          requestId: 'req-e2e-1',
        }),
        headers: { 'x-request-id': 'req-e2e-1' },
      })
    );
  }
  await page.route('**/api/v1/auth/refresh', route =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unauthorized' }),
    })
  );
}

test.describe('public home', () => {
  test('renders home and navigates', async ({ page }) => {
    await mockAuth(page, null);
    await page.goto('/');
    await expect(page.getByTestId('home-title')).toBeVisible();
    await expect(page.getByTestId('home-title')).toContainText(/Learn human anatomy/i);
    await expect(page.getByTestId('site-nav')).toBeVisible();
    await expect(page.getByTestId('home-cta-explore')).toBeVisible();
    // no horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });
});

test.describe('login', () => {
  test('renders and validates', async ({ page }) => {
    await mockAuth(page, null);
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByTestId('login-email')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByTestId('login-password')).toBeVisible();
    // native required validation — try submit empty
    await page.getByTestId('login-submit').click();
    // browser will block submit, still on login
    await expect(page).toHaveURL(/\/login/);
    // fill and submit with mocked success
    await page.route('**/api/v1/auth/login', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: STUDENT, accessToken: 'a', refreshToken: 'r' }),
      })
    );
    await page.getByTestId('login-email').fill('s@x.test');
    await page.getByTestId('login-password').fill('password123');
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL(/\/human/);
  });
});

test.describe('authenticated route protection', () => {
  test('redirects anonymous from /account to /login', async ({ page }) => {
    await mockAuth(page, null);
    await page.goto('/account');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('student can access /learn', async ({ page }) => {
    await mockAuth(page, STUDENT);
    await page.route('**/api/v1/progress/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );
    await page.goto('/learn');
    await expect(page.getByTestId('learn-title')).toBeVisible();
  });

  test('teacher can access cohorts', async ({ page }) => {
    await mockAuth(page, TEACHER);
    await page.route('**/api/v1/cohorts', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );
    await page.goto('/cohorts');
    await expect(page.getByTestId('cohorts-title')).toBeVisible();
  });
});

test.describe('deep-link', () => {
  test('/human?focus= opens viewer without crash', async ({ page }) => {
    await mockAuth(page, STUDENT);
    await page.goto('/human?focus=male:skin:UBERON:0002097');
    await expect(page.getByText('Human anatomy')).toBeVisible();
    await expect(page.getByTestId('human-nav')).toBeVisible();
  });
});

test.describe('admin route protection (via web admin API mock)', () => {
  test('student cannot access admin overview (403)', async ({ page }) => {
    await mockAuth(page, STUDENT);
    await page.route('**/api/v1/cohorts/**', async route => {
      const url = route.request().url();
      // console.log('cohort route', url);
      if (url.includes('/progress')) {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Insufficient permissions', requestId: 'req-admin-1' }),
          headers: { 'x-request-id': 'req-admin-1' },
        });
      } else if (url.includes('/c1')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'c1',
            name: 'Bio 101',
            institutionLabel: null,
            archivedAt: null,
            createdAt: new Date().toISOString(),
            myRole: 'STUDENT',
          }),
        });
      } else {
        await route.continue();
      }
    });
    await page.goto('/cohorts/c1/dashboard');
    await expect(page.getByTestId('dashboard-denied')).toBeVisible({ timeout: 10_000 });
  });
});
