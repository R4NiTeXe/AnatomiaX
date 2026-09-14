import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppErrorBoundary from '../AppErrorBoundary';
import { ApiError } from '@/lib/api';

function Bomb({ requestId }: { requestId?: string }): JSX.Element {
  throw new ApiError('Boom', {
    url: 'http://localhost:3000/api/v1/progress/snapshot',
    status: 500,
    requestId,
  });
}

describe('AppErrorBoundary (8.20.6.1)', () => {
  const originalError = console.error;
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
    global.console.error = originalError;
  });

  it('shows graceful fallback with Reload/Home, no stack, and logs requestId', async () => {
    render(
      <AppErrorBoundary>
        <Bomb requestId="req-abc-123" />
      </AppErrorBoundary>
    );
    expect(
      await screen.findByTestId('app-error-fallback', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.getByTestId('app-error-request-id')).toHaveTextContent('req-abc-123');
    expect(screen.getByTestId('app-error-reload')).toBeInTheDocument();
    expect(screen.getByTestId('app-error-home')).toHaveAttribute('href', '/');
    // no stack trace in DOM
    expect(screen.queryByText(/at Bomb/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Error: Boom/)).not.toBeInTheDocument();
    // logs requestId
    const calls = (console.error as jest.Mock).mock.calls.map(
      args => String(args[0]) + args.slice(1).join(' ')
    );
    expect(calls.some(c => c.includes('req-abc-123'))).toBe(true);
  });

  it('does not show requestId when absent and still offers actions', async () => {
    function PlainBomb(): JSX.Element {
      throw new Error('plain');
    }
    render(
      <AppErrorBoundary>
        <PlainBomb />
      </AppErrorBoundary>
    );
    expect(
      await screen.findByTestId('app-error-fallback', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.queryByTestId('app-error-request-id')).not.toBeInTheDocument();
    expect(screen.getByTestId('app-error-reload')).toBeInTheDocument();
  });

  it('reload button triggers window reload', async () => {
    const reloadMock = jest.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
      configurable: true,
    });
    render(
      <AppErrorBoundary>
        <Bomb />
      </AppErrorBoundary>
    );
    await screen.findByTestId('app-error-fallback', {}, { timeout: 4000 });
    fireEvent.click(screen.getByTestId('app-error-reload'));
    expect(reloadMock).toHaveBeenCalled();
  });
});
