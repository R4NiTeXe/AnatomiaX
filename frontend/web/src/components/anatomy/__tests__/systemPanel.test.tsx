import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { AnatomyStateProvider, useAnatomyState } from '../AnatomyStateContext';
import AnatomySystemPanel from '../AnatomySystemPanel';

function Harness() {
  const { setSystemStatus, setSystemError } = useAnatomyState();
  return (
    <div>
      <AnatomySystemPanel onResetCamera={() => undefined} />
      <button
        data-testid="fail-skin"
        onClick={() => {
          setSystemStatus('skin', 'error');
          setSystemError('skin', 'GLB missing');
        }}
      >
        fail
      </button>
      <button data-testid="load-skin" onClick={() => setSystemStatus('skin', 'loading')}>
        load
      </button>
    </div>
  );
}

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <AnatomyStateProvider>
          <Harness />
        </AnatomyStateProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('AnatomySystemPanel', () => {
  it('toggles system visibility from the layer switch', () => {
    setup();
    const toggle = screen.getByTestId('toggle-skin');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('shows loading state while a system loads', () => {
    setup();
    fireEvent.click(screen.getByTestId('load-skin'));
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows the error with a working retry action', () => {
    setup();
    fireEvent.click(screen.getByTestId('fail-skin'));
    expect(screen.getByTestId('error-skin')).toHaveTextContent('GLB missing');
    // Retry resets the system to idle (clearing the error UI) and bumps attempts.
    fireEvent.click(screen.getByTestId('retry-skin'));
    expect(screen.queryByTestId('error-skin')).not.toBeInTheDocument();
  });

  it('opens the opacity controls and isolates a system', () => {
    setup();
    fireEvent.click(screen.getByTestId('opacity-toggle-skin'));
    fireEvent.click(screen.getByTestId('isolate-skin'));
    expect(screen.getByTestId('isolate-skin')).toHaveAttribute('aria-pressed', 'true');
  });
});
