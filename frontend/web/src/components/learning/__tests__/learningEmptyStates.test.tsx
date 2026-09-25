import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { __resetAuthForTests } from '@/lib/auth';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { AnatomyStateProvider, useAnatomyState } from '../../anatomy/AnatomyStateContext';
import AnatomyInformationPanel from '../../anatomy/AnatomyInformationPanel';
import StudiedStructures from '../StudiedStructures';
import { QuizHistoryList, QuizRecent } from '../QuizAttempts';

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

function renderEmpty() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/learn']}>
          <AnatomyStateProvider>
            <StudiedStructures />
            <QuizRecent />
            <QuizHistoryList />
          </AnatomyStateProvider>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('learning empty states (8.47)', () => {
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
          jsonResponse({ userId: 'u-1', studiedKeys: [], bodyModel: null, updatedAt: null })
        );
      if (u.includes('/api/v1/progress/quiz-attempts')) return Promise.resolve(jsonResponse([]));
      return Promise.resolve(jsonResponse({}, 404));
    }) as unknown as typeof fetch;
  });

  it('empty states link into the 3D viewer', async () => {
    renderEmpty();
    const studied = await screen.findByTestId('studied-empty', {}, { timeout: 4000 });
    const studiedLink = studied.querySelector('a');
    expect(studiedLink).not.toBeNull();
    expect(studiedLink).toHaveAttribute('href', '/human');
    studiedLink!.focus();
    expect(document.activeElement).toBe(studiedLink);

    const quiz = await screen.findByTestId('quiz-empty', {}, { timeout: 4000 });
    expect(quiz.querySelector('a')).toHaveAttribute('href', '/human');

    const history = await screen.findByTestId('history-empty', {}, { timeout: 4000 });
    expect(history.querySelector('a')).toHaveAttribute('href', '/human');
  });
});

describe('information hierarchy (8.47)', () => {
  it('exposes content sections as headings', () => {
    const SelectLV = () => {
      const { selectStructure, toggleSystem } = useAnatomyState();
      return (
        <>
          <button data-testid="show-cardio" onClick={() => toggleSystem('cardiovascular')}>
            show
          </button>
          <button
            data-testid="select-lv"
            onClick={() =>
              selectStructure({
                structureKey: 'male:cardiovascular:UBERON:0002084',
                name: 'Left ventricle',
                objectName: 'VH_M_left_ventricle',
                systemKey: 'cardiovascular',
                bodyModel: 'male',
                ontologyId: 'UBERON:0002084',
              } as never)
            }
          >
            lv
          </button>
        </>
      );
    };
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/human']}>
            <AnatomyStateProvider>
              <AnatomyInformationPanel />
              <SelectLV />
            </AnatomyStateProvider>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
    fireEvent.click(screen.getByTestId('show-cardio'));
    fireEvent.click(screen.getByTestId('select-lv'));
    expect(screen.getByRole('heading', { name: 'Function' }).tagName).toBe('H4');
    expect(screen.getByRole('heading', { name: 'Source' }).tagName).toBe('H4');
    expect(screen.getByRole('heading', { name: 'Part of' }).tagName).toBe('H4');
  });
});
