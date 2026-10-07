import { fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { renderWithAppProviders as render } from '@/test-utils';
import HumanPage from '../pages/HumanPage';

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

describe('HumanPage viewer layout (8.32)', () => {
  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve(jsonResponse({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, 401))
    ) as unknown as typeof fetch;
  });

  it('viewer section keeps a non-collapsing min height above the sidebar', () => {
    render(<HumanPage />, ['/human']);
    const section = screen.getByTestId('human-viewer-section');
    expect(section.className).toMatch(/min-h-\[55vh\]/);
    expect(section.className).toMatch(/lg:min-h-0/);
  });

  it('skin-tone control activates without a viewer remount', () => {
    render(<HumanPage />, ['/human']);
    const deep = screen.getByTestId('skin-tone-deep');
    expect(deep).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(deep);
    expect(deep).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('viewer-mock')).toBeInTheDocument();
    expect(screen.getByTestId('skin-tone-medium')).toHaveAttribute('aria-pressed', 'false');
  });

  it('body-model control remains keyboard operable', () => {
    render(<HumanPage />, ['/human']);
    const female = screen.getByTestId('body-model-female');
    female.focus();
    expect(document.activeElement).toBe(female);
    fireEvent.click(female);
    expect(female).toHaveAttribute('aria-pressed', 'true');
  });

  it('appearance groups body model and skin tone with readable status (8.33)', () => {
    render(<HumanPage />, ['/human']);
    const card = screen.getByTestId('appearance-selector');
    expect(card).toHaveAttribute('aria-label', 'Appearance');
    expect(card.contains(screen.getByTestId('body-model-male'))).toBe(true);
    expect(card.contains(screen.getByTestId('skin-tone-group'))).toBe(true);
    const status = screen.getByTestId('viewer-status');
    expect(status).toHaveTextContent(/male/i);
    expect(status).toHaveTextContent(/medium/i);
    fireEvent.click(screen.getByTestId('skin-tone-deep'));
    expect(screen.getByTestId('viewer-status')).toHaveTextContent(/deep/i);
  });

  it('model switch resets per-body state synchronously (8.45)', () => {
    render(<HumanPage />, ['/human']);
    fireEvent.click(screen.getByTestId('toggle-skin'));
    expect(screen.getByTestId('toggle-skin')).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByTestId('body-model-female'));
    expect(screen.getByTestId('body-model-female')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('toggle-skin')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('viewer-status')).toHaveTextContent(/female/i);
    fireEvent.click(screen.getByTestId('body-model-male'));
    expect(screen.getByTestId('body-model-male')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('toggle-skin')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('viewer-mock')).toBeInTheDocument();
  });
});
