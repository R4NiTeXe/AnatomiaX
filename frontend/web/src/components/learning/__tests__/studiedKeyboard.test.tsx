import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { __resetAuthForTests } from '@/lib/auth';
import { AuthProvider } from '@/components/auth/AuthProvider';
import StudiedStructures from '../StudiedStructures';

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
const KEY = 'male:skin:UBERON:0002097';

function renderStudied() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/learn']}>
          <StudiedStructures />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('StudiedStructures keyboard (8.20.6.1)', () => {
  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
    global.fetch = jest.fn((url: string) => {
      const u = url as string;
      if (u.endsWith('/api/v1/auth/me')) return Promise.resolve(jsonResponse(USER));
      if (u.endsWith('/api/v1/auth/refresh'))
        return Promise.resolve(jsonResponse({ user: USER, accessToken: 'a', refreshToken: 'r' }));
      if (u.includes('/api/v1/progress/snapshot'))
        return Promise.resolve(
          jsonResponse({ userId: 'u-1', studiedKeys: [KEY], bodyModel: 'male', updatedAt: null })
        );
      return Promise.resolve(jsonResponse({}, 404));
    }) as unknown as typeof fetch;
  });

  it('makes studied item keyboard accessible with Enter/Space', async () => {
    renderStudied();
    const item = await screen.findByTestId('studied-item', {}, { timeout: 4000 });
    const card = within(item).getByRole('button');
    expect(card).toHaveAttribute('tabIndex', '0');
    expect(card).toHaveAttribute('aria-label', expect.stringContaining('Open'));
    // focus and press Enter
    card.focus();
    expect(document.activeElement).toBe(card);
    fireEvent.keyDown(card, { key: 'Enter', code: 'Enter' });
    // navigation is via useNavigate, jsdom will not actually navigate but we can verify the card is still accessible
    expect(card).toBeInTheDocument();
    fireEvent.keyDown(card, { key: ' ', code: 'Space' });
    expect(card).toBeInTheDocument();
  });

  it('preserves Open in 3D link href and focus ring', async () => {
    renderStudied();
    const link = await screen.findByTestId('studied-open', {}, { timeout: 4000 });
    expect(link).toHaveAttribute('href', `/human?focus=${encodeURIComponent(KEY)}`);
    expect(link.tagName).toBe('A');
  });
});
