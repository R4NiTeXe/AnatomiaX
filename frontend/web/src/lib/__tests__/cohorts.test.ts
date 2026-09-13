import '@testing-library/jest-dom';
import { __resetAuthForTests, login } from '../auth';
import {
  archiveCohort,
  createCohort,
  getCohort,
  joinCohort,
  leaveCohort,
  listCohortMembers,
  listMyCohorts,
  regenerateInvite,
  removeCohortMember,
  updateCohort,
} from '../cohorts';

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

const SESSION = {
  user: { id: 't1', email: 't@x.test', name: 'Tea', role: 'TEACHER', createdAt: '2026-01-01' },
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
};

const VIEW = {
  id: 'c1',
  name: 'Bio 101',
  institutionLabel: 'Med School',
  archivedAt: null,
  createdAt: '2026-01-01',
  myRole: 'OWNER',
};

describe('cohorts client (8.20.4)', () => {
  beforeEach(() => {
    __resetAuthForTests();
    jest.restoreAllMocks();
    global.fetch = jest.fn((url: string) =>
      Promise.resolve(
        (url as string).endsWith('/api/v1/auth/login')
          ? jsonResponse(SESSION)
          : jsonResponse({ ok: true })
      )
    ) as unknown as typeof fetch;
  });

  async function authed() {
    await login('t@x.test', 'password123');
    (global.fetch as jest.Mock).mockClear();
  }

  function lastCall(): [string, RequestInit] {
    const calls = (global.fetch as jest.Mock).mock.calls as [string, RequestInit][];
    return calls[calls.length - 1];
  }

  it('lists my cohorts', async () => {
    await authed();
    (global.fetch as jest.Mock).mockImplementation(() => Promise.resolve(jsonResponse([VIEW])));
    await expect(listMyCohorts()).resolves.toEqual([VIEW]);
    const [url, init] = lastCall();
    expect(url).toBe('http://localhost:3000/api/v1/cohorts');
    expect(init.method).toBeUndefined();
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer access-1');
  });

  it('creates a cohort with name + institution', async () => {
    await authed();
    await createCohort({ name: 'Bio 101', institutionLabel: 'Med School' });
    const [url, init] = lastCall();
    expect(url).toBe('http://localhost:3000/api/v1/cohorts');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      name: 'Bio 101',
      institutionLabel: 'Med School',
    });
  });

  it('joins by invite code', async () => {
    await authed();
    await joinCohort('code-abc');
    const [url, init] = lastCall();
    expect(url).toBe('http://localhost:3000/api/v1/cohorts/join');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ inviteCode: 'code-abc' });
  });

  it('gets, updates, archives, and regenerates invites', async () => {
    await authed();
    await getCohort('c1');
    expect(lastCall()[0]).toBe('http://localhost:3000/api/v1/cohorts/c1');
    await updateCohort('c1', { name: 'Bio 102' });
    {
      const [url, init] = lastCall();
      expect(url).toBe('http://localhost:3000/api/v1/cohorts/c1');
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body as string)).toEqual({ name: 'Bio 102' });
    }
    await archiveCohort('c1');
    {
      const [url, init] = lastCall();
      expect(url).toBe('http://localhost:3000/api/v1/cohorts/c1/archive');
      expect(init.method).toBe('POST');
    }
    await regenerateInvite('c1');
    {
      const [url, init] = lastCall();
      expect(url).toBe('http://localhost:3000/api/v1/cohorts/c1/invite/regenerate');
      expect(init.method).toBe('POST');
    }
  });

  it('leaves, lists members, and removes members', async () => {
    await authed();
    await leaveCohort('c1');
    {
      const [url, init] = lastCall();
      expect(url).toBe('http://localhost:3000/api/v1/cohorts/c1/leave');
      expect(init.method).toBe('POST');
    }
    await listCohortMembers('c1');
    expect(lastCall()[0]).toBe('http://localhost:3000/api/v1/cohorts/c1/members');
    await removeCohortMember('c1', 'u9');
    {
      const [url, init] = lastCall();
      expect(url).toBe('http://localhost:3000/api/v1/cohorts/c1/members/u9');
      expect(init.method).toBe('DELETE');
    }
  });

  it('never touches web storage', async () => {
    const setSpy = jest.spyOn(Storage.prototype, 'setItem');
    await login('t@x.test', 'password123');
    await listMyCohorts();
    await createCohort({ name: 'x' });
    await joinCohort('code');
    expect(setSpy).not.toHaveBeenCalled();
    expect(window.sessionStorage.length).toBe(0);
  });
});
