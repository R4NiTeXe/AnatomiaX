import { BadRequestException } from '@nestjs/common';
import { MAX_STUDIED_KEYS, ProgressService } from './progress.service';

const USER = { id: 'user-1', role: 'STUDENT' };

const attemptDto = (overrides: Record<string, unknown> = {}) => ({
  bodyModel: 'male',
  score: 3,
  total: 5,
  answers: Array.from({ length: 5 }, (_, i) => ({ selected: i % 4, correct: 0 })),
  ...overrides,
});

describe('ProgressService', () => {
  let service: ProgressService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  beforeEach(() => {
    prisma = {
      quizAttempt: { create: jest.fn(), findMany: jest.fn() },
      progressSnapshot: { findUnique: jest.fn(), upsert: jest.fn() },
    };
    service = new ProgressService(prisma as never);
  });

  describe('submitAttempt', () => {
    it('persists the attempt scoped to the caller with plain-JSON answers', async () => {
      prisma.quizAttempt.create.mockResolvedValue({ id: 'a-1' });
      await service.submitAttempt(USER as never, attemptDto() as never);
      expect(prisma.quizAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          bodyModel: 'male',
          score: 3,
          total: 5,
          startedAt: null,
        }),
      });
      const answers = prisma.quizAttempt.create.mock.calls[0][0].data.answers as unknown[];
      expect(answers).toHaveLength(5);
      expect(Object.getPrototypeOf(answers[0])).toBe(Object.prototype);
    });

    it('parses an optional startedAt timestamp', async () => {
      prisma.quizAttempt.create.mockResolvedValue({ id: 'a-1' });
      await service.submitAttempt(
        USER as never,
        attemptDto({ startedAt: '2026-09-01T10:00:00.000Z' }) as never
      );
      expect(prisma.quizAttempt.create.mock.calls[0][0].data.startedAt).toEqual(
        new Date('2026-09-01T10:00:00.000Z')
      );
    });

    it('rejects score above total, length mismatches, and bad timestamps', async () => {
      await expect(
        service.submitAttempt(USER as never, attemptDto({ score: 6 }) as never)
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.submitAttempt(
          USER as never,
          attemptDto({ answers: [{ selected: 0, correct: 0 }] }) as never
        )
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.submitAttempt(USER as never, attemptDto({ startedAt: 'not-a-date' }) as never)
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.quizAttempt.create).not.toHaveBeenCalled();
    });
  });

  describe('listAttempts', () => {
    it('scopes to the caller and clamps limits', async () => {
      prisma.quizAttempt.findMany.mockResolvedValue([]);
      await service.listAttempts(USER as never);
      expect(prisma.quizAttempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' }, take: 20 })
      );
      await service.listAttempts(USER as never, 999);
      expect(prisma.quizAttempt.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ take: 100 })
      );
      await service.listAttempts(USER as never, 0);
      expect(prisma.quizAttempt.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ take: 1 })
      );
    });
  });

  describe('snapshot', () => {
    it('returns an empty default when none exists', async () => {
      prisma.progressSnapshot.findUnique.mockResolvedValue(null);
      await expect(service.getSnapshot(USER as never)).resolves.toEqual({
        userId: 'user-1',
        studiedKeys: [],
        bodyModel: null,
        updatedAt: null,
      });
    });

    it('creates on first merge', async () => {
      prisma.progressSnapshot.findUnique.mockResolvedValue(null);
      prisma.progressSnapshot.upsert.mockImplementation(async ({ create }: never) => create);
      const out = await service.mergeStudied(USER as never, { keys: ['a', 'b'] } as never);
      expect(out).toMatchObject({ userId: 'user-1', studiedKeys: ['a', 'b'] });
    });

    it('merges newest-first with deduplication', async () => {
      prisma.progressSnapshot.findUnique.mockResolvedValue({
        studiedKeys: ['b', 'c'],
        bodyModel: 'male',
      });
      prisma.progressSnapshot.upsert.mockImplementation(async ({ update }: never) => update);
      const out = (await service.mergeStudied(
        USER as never,
        { keys: ['c', 'a', 'a', '  '] } as never
      )) as {
        studiedKeys: string[];
      };
      expect(out.studiedKeys).toEqual(['c', 'a', 'b']);
    });

    it('keeps the stored body model unless the client sends one', async () => {
      prisma.progressSnapshot.findUnique.mockResolvedValue({
        studiedKeys: [],
        bodyModel: 'female',
      });
      prisma.progressSnapshot.upsert.mockImplementation(async ({ update }: never) => update);
      const kept = (await service.mergeStudied(USER as never, { keys: ['x'] } as never)) as Record<
        string,
        unknown
      >;
      expect(kept).not.toHaveProperty('bodyModel');
      const changed = (await service.mergeStudied(
        USER as never,
        {
          keys: ['x'],
          bodyModel: 'male',
        } as never
      )) as Record<string, unknown>;
      expect(changed.bodyModel).toBe('male');
    });

    it('enforces the maximum size', async () => {
      prisma.progressSnapshot.findUnique.mockResolvedValue(null);
      prisma.progressSnapshot.upsert.mockImplementation(async ({ create }: never) => create);
      const keys = Array.from({ length: MAX_STUDIED_KEYS + 50 }, (_, i) => `k-${i}`);
      const out = (await service.mergeStudied(USER as never, { keys } as never)) as {
        studiedKeys: string[];
      };
      expect(out.studiedKeys).toHaveLength(MAX_STUDIED_KEYS);
      expect(out.studiedKeys[0]).toBe('k-0');
    });
  });
});
