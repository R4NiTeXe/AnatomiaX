// STEP 8.20.9.1: isolate heavy 3D import that pushes the test over the
// default 5s timeout under parallel worker contention. Mocking the viewer
// keeps the DOM assertions (header/nav) intact while making the HumanPage
// import cheap — no three/R3F parse inside the 5s window. Global
// ResizeObserver/canvas polyfills live in src/test-setup.ts (setupFiles).
jest.mock('@/components/anatomy/AnatomyViewer', () => ({
  __esModule: true,
  default: () => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'mock-anatomy-viewer' }, 'viewer');
  },
}));

import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import * as fs from 'fs';
import * as path from 'path';
import { __resetAuthForTests } from '@/lib/auth';
import { AuthProvider } from '@/components/auth/AuthProvider';
import App from '@/App';
import HumanPage from '../HumanPage';

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    headers: { get: () => 'application/json' },
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response;
}

const USER = {
  id: 'u-1',
  email: 'a@x.test',
  name: 'Ada',
  role: 'STUDENT',
  createdAt: '2026-01-01',
};

describe('8.20.6.1 reliability/a11y', () => {
  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
    global.fetch = jest.fn((url: string) => {
      const u = url as string;
      if (u.endsWith('/api/v1/auth/me')) return Promise.resolve(jsonResponse(USER));
      if (u.endsWith('/api/v1/auth/refresh'))
        return Promise.resolve(jsonResponse({ user: USER, accessToken: 'a', refreshToken: 'r' }));
      if (u.includes('/api/v1/progress/'))
        return Promise.resolve(
          jsonResponse({ userId: 'u-1', studiedKeys: [], bodyModel: null, updatedAt: null })
        );
      return Promise.resolve(jsonResponse({}, 404));
    }) as unknown as typeof fetch;
  });

  it('has skip-to-content link targeting main-content', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/learn']}>
            <App />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    const skip = await screen.findByText('Skip to content', {}, { timeout: 4000 });
    expect(skip).toBeInTheDocument();
    expect(skip).toHaveAttribute('href', '#main-content');
    expect(skip.className).toContain('sr-only');
    // main has id and is focusable
    // LearnPage main appears after navigation
    const mains = await screen.findAllByRole('main', {}, { timeout: 4000 });
    expect(mains.some(m => m.id === 'main-content')).toBe(true);
    expect(mains.find(m => m.id === 'main-content')).toHaveAttribute('tabIndex', '-1');
  });

  it('respects prefers-reduced-motion via global CSS', () => {
    const cssPath = path.join(__dirname, '../../index.css');
    // fallback to known location if __dirname differs in jest
    const altPath =
      'C:\\Users\\ranit\\Desktop\\WebDev\\Coding\\Bankend\\AnatomiaX\\frontend\\web\\src\\index.css';
    let content = '';
    try {
      content = fs.readFileSync(cssPath, 'utf8');
    } catch {
      content = fs.readFileSync(altPath, 'utf8');
    }
    expect(content).toContain('@media (prefers-reduced-motion: reduce)');
    expect(content).toContain('animation-duration: 0.01ms');
    expect(content).toContain('transition-duration: 0.01ms');
  });

  it('progress queries are user-isolated and do not refetch on window focus', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let snapshotCalls = 0;
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      const u = url as string;
      if (u.endsWith('/api/v1/auth/me')) return Promise.resolve(jsonResponse(USER));
      if (u.includes('/api/v1/progress/snapshot')) {
        snapshotCalls += 1;
        return Promise.resolve(
          jsonResponse({ userId: 'u-1', studiedKeys: [], bodyModel: null, updatedAt: null })
        );
      }
      if (u.includes('/api/v1/progress/quiz-attempts')) return Promise.resolve(jsonResponse([]));
      return Promise.resolve(jsonResponse({}, 404));
    });
    const { default: LearnPage } = await import('../LearnPage');
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/learn']}>
            <LearnPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    await screen.findByTestId('learn-title', {}, { timeout: 4000 });
    // wait for initial fetches
    await screen.findByTestId('progress-summary-quizzes', {}, { timeout: 4000 });
    const before = snapshotCalls;
    // dispatch window focus — should NOT trigger refetch due to refetchOnWindowFocus: false
    fireEvent(window, new Event('focus'));
    fireEvent(window, new Event('visibilitychange'));
    // give query time
    await new Promise(r => setTimeout(r, 100));
    expect(snapshotCalls).toBe(before);
    // ensure isolation: different user would have different key
    expect(client.getQueryData(['progress', 'snapshot', 'u-1'])).toBeDefined();
    expect(client.getQueryData(['progress', 'snapshot', 'u-2'])).toBeUndefined();
  });

  it('/human still renders without global boundary interfering', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/human']}>
            <HumanPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    // header present, viewer not redesigned (viewer is mocked — DOM assertion preserved)
    expect(await screen.findByText('Human anatomy', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByTestId('human-nav')).toBeInTheDocument();
    expect(screen.getByTestId('mock-anatomy-viewer')).toBeInTheDocument();
  });
});
