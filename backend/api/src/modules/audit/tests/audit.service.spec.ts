import { AuditService, sanitizeAuditMetadata } from '../audit.service';

function makePrisma() {
  return {
    auditLog: { create: jest.fn(async ({ data }: never) => ({ id: 'a1', ...(data as object) })) },
  };
}

describe('sanitizeAuditMetadata', () => {
  it('redacts authentication material by key name, keeps the rest', () => {
    expect(
      sanitizeAuditMetadata({
        from: 'STUDENT',
        to: 'TEACHER',
        password: 'hunter2',
        refreshToken: 'rt',
        smtp_password: 'x',
        note: 'promotion',
      })
    ).toEqual({
      from: 'STUDENT',
      to: 'TEACHER',
      password: '[redacted]',
      refreshToken: '[redacted]',
      smtp_password: '[redacted]',
      note: 'promotion',
    });
  });

  it('passes through undefined', () => {
    expect(sanitizeAuditMetadata(undefined)).toBeUndefined();
  });
});

describe('AuditService.record', () => {
  it('persists actor/action/target with sanitized metadata', async () => {
    const prisma = makePrisma();
    const service = new AuditService(prisma as never);
    await service.record({ id: 'admin-1', role: 'ADMIN' }, 'user.role.changed', 'user', 'u-9', {
      from: 'STUDENT',
      to: 'TEACHER',
      password: 'must-not-persist',
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        actorRole: 'ADMIN',
        action: 'user.role.changed',
        targetType: 'user',
        targetId: 'u-9',
        metadata: { from: 'STUDENT', to: 'TEACHER', password: '[redacted]' },
      },
    });
  });

  it('never breaks the caller when the audit write fails', async () => {
    const prisma = { auditLog: { create: jest.fn().mockRejectedValueOnce(new Error('db down')) } };
    const service = new AuditService(prisma as never);
    await expect(
      service.record({ id: 'a', role: 'ADMIN' }, 'quiz.deleted', 'quiz', 'q-1')
    ).resolves.toBeUndefined();
  });
});
