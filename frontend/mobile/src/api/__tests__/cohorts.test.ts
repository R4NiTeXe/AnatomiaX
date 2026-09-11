import {
  archiveCohort,
  canCreateCohort,
  canManageCohort,
  createCohort,
  getCohort,
  joinCohort,
  leaveCohort,
  listCohortMembers,
  listMyCohorts,
  regenerateInvite,
  removeCohortMember,
  updateCohort,
  type CohortView,
} from '../cohorts';

jest.mock('../../lib/secureStore', () => ({
  saveSession: jest.fn(async () => undefined),
  loadAccessToken: jest.fn(async () => 'access-T'),
  loadSession: jest.fn(async () => ({ accessToken: 'access-T', refreshToken: 'refresh-T' })),
  clearSession: jest.fn(async () => undefined),
}));

function okJson(body: unknown, status = 200) {
  return {
    ok: true,
    status,
    statusText: 'OK',
    headers: { get: () => 'application/json' },
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function emptyBody(status = 201) {
  return {
    ok: true,
    status,
    statusText: 'Created',
    headers: { get: () => '' },
    text: jest.fn().mockResolvedValue(''),
  } as unknown as Response;
}

const view: CohortView = {
  id: 'cohort-1',
  name: 'Biology 101',
  institutionLabel: null,
  archivedAt: null,
  createdAt: '2026-01-01',
  myRole: 'STUDENT',
};

describe('mobile cohorts api (8.19.27)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
    global.fetch = originalFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('lists my cohorts with a Bearer token', async () => {
    global.fetch = jest.fn().mockResolvedValue(okJson([view]));
    await expect(listMyCohorts()).resolves.toEqual([view]);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/api/v1/cohorts');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer access-T');
  });

  it('creates with name + institution label', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(okJson({ ...view, myRole: 'OWNER', inviteCode: 'code-1' }));
    await createCohort({ name: 'Chem 101', institutionLabel: 'Riverside' });
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      name: 'Chem 101',
      institutionLabel: 'Riverside',
    });
  });

  it('joins by invite code', async () => {
    global.fetch = jest.fn().mockResolvedValue(okJson(view, 201));
    await joinCohort('invite-abc');
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url.endsWith('/api/v1/cohorts/join')).toBe(true);
    expect(JSON.parse(init.body as string)).toEqual({ inviteCode: 'invite-abc' });
  });

  it('reads, updates, archives, and regenerates invite by id', async () => {
    global.fetch = jest.fn().mockResolvedValue(okJson(view));
    await getCohort('cohort-1');
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('/api/v1/cohorts/cohort-1');

    (global.fetch as jest.Mock).mockResolvedValue(okJson({ ...view, name: 'New' }));
    await updateCohort('cohort-1', { name: 'New' });
    const [, patchInit] = (global.fetch as jest.Mock).mock.calls[1] as [string, RequestInit];
    expect(patchInit.method).toBe('PATCH');

    (global.fetch as jest.Mock).mockResolvedValue(okJson({ ...view, archivedAt: '2026-02-02' }));
    await expect(archiveCohort('cohort-1')).resolves.toMatchObject({ archivedAt: '2026-02-02' });

    (global.fetch as jest.Mock).mockResolvedValue(okJson({ ...view, inviteCode: 'code-2' }));
    await expect(regenerateInvite('cohort-1')).resolves.toMatchObject({ inviteCode: 'code-2' });
  });

  it('leaves and removes members through empty-body endpoints', async () => {
    global.fetch = jest.fn().mockResolvedValue(emptyBody());
    await expect(leaveCohort('cohort-1')).resolves.toBeUndefined();
    const [leaveUrl, leaveInit] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(leaveUrl.endsWith('/api/v1/cohorts/cohort-1/leave')).toBe(true);
    expect(leaveInit.method).toBe('POST');

    (global.fetch as jest.Mock).mockResolvedValue({ ...emptyBody(200), status: 200 });
    await expect(removeCohortMember('cohort-1', 'user-9')).resolves.toBeUndefined();
    const [delUrl, delInit] = (global.fetch as jest.Mock).mock.calls[1] as [string, RequestInit];
    expect(delUrl.endsWith('/api/v1/cohorts/cohort-1/members/user-9')).toBe(true);
    expect(delInit.method).toBe('DELETE');
  });

  it('lists members', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(okJson([{ userId: 'u1', name: 'Stu', role: 'STUDENT', joinedAt: 'x' }]));
    await expect(listCohortMembers('cohort-1')).resolves.toHaveLength(1);
  });

  it('gates creation UI to teacher/admin only', () => {
    expect(canCreateCohort('STUDENT')).toBe(false);
    expect(canCreateCohort('TEACHER')).toBe(true);
    expect(canCreateCohort('ADMIN')).toBe(true);
    expect(canCreateCohort(null)).toBe(false);
    expect(canCreateCohort(undefined)).toBe(false);
  });

  it('gates management UI to owners and admins only', () => {
    expect(canManageCohort({ ...view, myRole: 'OWNER' }, 'TEACHER')).toBe(true);
    expect(canManageCohort({ ...view, myRole: 'STUDENT' }, 'ADMIN')).toBe(true);
    expect(canManageCohort({ ...view, myRole: 'STUDENT' }, 'STUDENT')).toBe(false);
    expect(canManageCohort({ ...view, myRole: 'TEACHER' }, 'TEACHER')).toBe(false);
    expect(canManageCohort(null, 'ADMIN')).toBe(false);
  });
});
