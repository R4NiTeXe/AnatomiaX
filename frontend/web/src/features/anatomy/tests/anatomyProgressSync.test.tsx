import { screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { renderWithAppProviders as render } from '@/test-utils';
import { __resetAuthForTests } from '@/lib/auth';
import { AnatomyStateProvider, useAnatomyState } from '../components/AnatomyStateContext';
import AnatomyInformationPanel from '../components/AnatomyInformationPanel';
import AnatomyProgressSync, { parseStudiedKey } from '../components/AnatomyProgressSync';

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

describe('parseStudiedKey', () => {
  it('parses ontology-qualified keys with canonical names', () => {
    expect(parseStudiedKey('male:skin:UBERON:0002097')).toMatchObject({
      structureKey: 'male:skin:UBERON:0002097',
      bodyModel: 'male',
      systemKey: 'skin',
      ontologyId: 'UBERON:0002097',
      name: 'Skin',
    });
  });

  it('parses object-fallback keys', () => {
    expect(parseStudiedKey('female:nervous:object:Custom Region')).toMatchObject({
      bodyModel: 'female',
      systemKey: 'nervous',
      ontologyId: null,
      name: 'Custom Region',
    });
  });

  it('rejects malformed keys without throwing', () => {
    expect(parseStudiedKey('')).toBeNull();
    expect(parseStudiedKey('justonepart')).toBeNull();
    expect(parseStudiedKey('alien:skin:UBERON:0002097')).toBeNull();
    expect(parseStudiedKey('male::')).toBeNull();
    expect(parseStudiedKey('x'.repeat(300))).toBeNull();
  });
});

describe('AnatomyProgressSync', () => {
  const USER_A = {
    id: 'u-a',
    email: 'a@b.c',
    name: null,
    role: 'STUDENT',
    createdAt: '2026-01-01',
  };
  let currentUser = USER_A;
  let snapshotKeys: string[] = ['male:skin:UBERON:0002097', 'male:cardiovascular:UBERON:0002084'];

  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
    currentUser = USER_A;
    snapshotKeys = ['male:skin:UBERON:0002097', 'male:cardiovascular:UBERON:0002084'];
    global.fetch = jest.fn((url: string) => {
      const u = url as string;
      if (u.endsWith('/api/v1/auth/me')) return Promise.resolve(jsonResponse(currentUser));
      if (u.endsWith('/api/v1/progress/snapshot'))
        return Promise.resolve(
          jsonResponse({
            userId: currentUser.id,
            studiedKeys: snapshotKeys,
            bodyModel: 'male',
            updatedAt: null,
          })
        );
      if (u.endsWith('/api/v1/progress/quiz-attempts?limit=20'))
        return Promise.resolve(jsonResponse([]));
      if (u.endsWith('/api/v1/progress/snapshot/studied'))
        return Promise.resolve(
          jsonResponse({
            userId: currentUser.id,
            studiedKeys: [],
            bodyModel: null,
            updatedAt: null,
          })
        );
      return Promise.resolve(jsonResponse({}, 404));
    }) as unknown as typeof fetch;
  });

  function renderTree() {
    const SelectBrain = () => {
      const { selectStructure } = useAnatomyState();
      return (
        <button
          data-testid="select-brain"
          onClick={() =>
            selectStructure({
              structureKey: 'male:nervous:UBERON:0000955',
              name: 'Brain',
              objectName: 'VH_M_brain',
              systemKey: 'nervous',
              bodyModel: 'male',
              ontologyId: 'UBERON:0000955',
            } as never)
          }
        >
          select-brain
        </button>
      );
    };
    return render(
      <AnatomyStateProvider>
        <AnatomyProgressSync />
        <AnatomyInformationPanel />
        <SelectBrain />
      </AnatomyStateProvider>
    );
  }

  it('hydrates server keys into Recent without duplicates', async () => {
    renderTree();
    const items = await screen.findAllByTestId(/anatomy-recent-item-/, {}, { timeout: 4000 });
    const texts = items.map(el => el.textContent);
    expect(texts.some(t => t?.includes('Skin'))).toBe(true);
    expect(texts.some(t => t?.includes('Left ventricle'))).toBe(true);
  });

  it('logout clears hydrated history (no leak into anonymous state)', async () => {
    const AccountPanel = (await import('@/features/auth/components/AccountPanel')).default;
    const AnatomySessionPanel = (await import('../components/AnatomySessionPanel')).default;
    render(
      <AnatomyStateProvider>
        <AnatomyProgressSync />
        <AnatomyInformationPanel />
        <AnatomySessionPanel />
        <AccountPanel />
      </AnatomyStateProvider>
    );
    await screen.findAllByTestId(/anatomy-recent-item-/, {}, { timeout: 4000 });
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if ((url as string).endsWith('/api/v1/auth/logout'))
        return Promise.resolve(jsonResponse({ status: 'ok' }));
      return Promise.resolve(jsonResponse({}, 404));
    });
    fireEvent.click(screen.getByTestId('anatomy-account-logout'));
    await screen.findByTestId('anatomy-account-login', {}, { timeout: 4000 });
    expect(screen.queryAllByTestId(/anatomy-recent-item-/)).toHaveLength(0);
    expect(screen.getByTestId('anatomy-session-studied-empty')).toBeInTheDocument();
  });

  it('unmount inside the debounce window flushes pending marks (8.42)', async () => {
    const tree = renderTree();
    await screen.findAllByTestId(/anatomy-recent-item-/, {}, { timeout: 4000 });
    (global.fetch as jest.Mock).mockClear();
    // New selection starts the 1.5s debounce; unmount immediately after.
    fireEvent.click(screen.getByTestId('select-brain'));
    tree.unmount();
    await Promise.resolve();
    const patchCalls = (global.fetch as jest.Mock).mock.calls.filter(([url]: [string]) =>
      (url as string).endsWith('/api/v1/progress/snapshot/studied')
    );
    expect(patchCalls.length).toBe(1);
    expect(JSON.parse((patchCalls[0][1] as { body: string }).body).keys).toContain(
      'male:nervous:UBERON:0000955'
    );
  });
});
