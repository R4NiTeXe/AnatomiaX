import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { __resetAuthForTests } from '@/lib/auth';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { AnatomyStateProvider, useAnatomyState } from '../AnatomyStateContext';
import HumanDeepLink from '../HumanDeepLink';

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

function Probe() {
  const { selectedStructure, selectedBodyModel, visibleSystems } = useAnatomyState();
  return (
    <div>
      <div data-testid="deep-model">{selectedBodyModel}</div>
      <div data-testid="deep-selection">{selectedStructure?.structureKey ?? 'none'}</div>
      <div data-testid="deep-visible">{JSON.stringify(visibleSystems)}</div>
    </div>
  );
}

function renderDeepLink(initialEntries: string[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <AnatomyStateProvider>
            <HumanDeepLink />
            <Probe />
          </AnatomyStateProvider>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('HumanDeepLink (/human regression guard)', () => {
  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
    global.fetch = jest.fn(() => Promise.resolve(jsonResponse({}, 404))) as unknown as typeof fetch;
  });

  it('selects a valid focus key without changing the body model', async () => {
    renderDeepLink(['/human?focus=male%3Askin%3AUBERON%3A0002097']);
    expect(
      await screen.findByText('male:skin:UBERON:0002097', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.getByTestId('deep-model')).toHaveTextContent('male');
  });

  it('switches body model first for cross-model keys, then selects', async () => {
    renderDeepLink(['/human?focus=female%3Askin%3AUBERON%3A0002097']);
    expect(
      await screen.findByText('female:skin:UBERON:0002097', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.getByTestId('deep-model')).toHaveTextContent('female');
  });

  it('ignores invalid focus keys', async () => {
    renderDeepLink(['/human?focus=not-a-key']);
    // Settles back to no selection without crashing.
    await screen.findByTestId('deep-selection');
    expect(screen.getByTestId('deep-selection')).toHaveTextContent('none');
    expect(screen.getByTestId('deep-model')).toHaveTextContent('male');
  });

  it('leaves state untouched without a focus param', async () => {
    renderDeepLink(['/human']);
    await screen.findByTestId('deep-selection');
    expect(screen.getByTestId('deep-selection')).toHaveTextContent('none');
  });

  it('reveals a hidden target system so the landing selects visibly (8.39)', async () => {
    // Cardiovascular starts hidden — previously the deep link silently cleared.
    renderDeepLink(['/human?focus=male%3Acardiovascular%3AUBERON%3A0002084']);
    expect(
      await screen.findByText('male:cardiovascular:UBERON:0002084', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.getByTestId('deep-visible').textContent).toContain('"cardiovascular":true');
  });
});
