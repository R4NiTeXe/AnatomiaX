import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { renderWithAppProviders as render } from '@/test-utils';
import App from '@/App';

// Canonical alias redirects: /anatomy is the /human viewer and /progress is
// the /learn page (matching nav labels). Guessed/bookmarked URLs must land
// on the real pages, not the 404 screen.
jest.mock('@/features/anatomy/components/AnatomyViewer', () => ({
  __esModule: true,
  default: () => <div data-testid="viewer-mock" />,
}));

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

describe('canonical route aliases', () => {
  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve(jsonResponse({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, 401))
    ) as unknown as typeof fetch;
  });

  it('/anatomy redirects to the /human viewer', async () => {
    render(<App />, ['/anatomy']);
    expect(await screen.findByTestId('human-nav', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByTestId('not-found-title')).not.toBeInTheDocument();
  });

  it('/progress redirects to the /learn page', async () => {
    render(<App />, ['/progress']);
    expect(await screen.findByTestId('learn-title', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByTestId('not-found-title')).not.toBeInTheDocument();
  });

  it('unknown paths still render the 404 page', async () => {
    render(<App />, ['/no-such-page']);
    expect(await screen.findByTestId('not-found-title', {}, { timeout: 4000 })).toBeInTheDocument();
  });
});
