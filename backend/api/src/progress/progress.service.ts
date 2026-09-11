import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { SafeUser } from '../users/users.service';
import type { MergeStudiedDto } from './dto/merge-studied.dto';
import type { SubmitQuizAttemptDto } from './dto/submit-quiz-attempt.dto';

/** Stored studied-key ceiling: newest-first, hard cap against unbounded growth. */
export const MAX_STUDIED_KEYS = 500;

const DEFAULT_ATTEMPT_LIMIT = 20;

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  /** Completed attempts are write-once: no update/delete path exists by design. */
  async submitAttempt(user: SafeUser, dto: SubmitQuizAttemptDto) {
    if (dto.score > dto.total) {
      throw new BadRequestException('Score cannot exceed total');
    }
    if (dto.answers.length !== dto.total) {
      throw new BadRequestException('Answers must cover every question');
    }
    let startedAt: Date | null = null;
    if (dto.startedAt !== undefined) {
      startedAt = new Date(dto.startedAt);
      if (Number.isNaN(startedAt.getTime())) {
        throw new BadRequestException('Invalid startedAt timestamp');
      }
    }
    // Plain objects only: DTO class instances are not valid Prisma Json input.
    const answers = dto.answers.map(a => ({
      structureKey: a.structureKey ?? null,
      canonicalName: a.canonicalName ?? null,
      selected: a.selected,
      correct: a.correct,
    }));
    return this.prisma.quizAttempt.create({
      data: {
        userId: user.id,
        bodyModel: dto.bodyModel,
        score: dto.score,
        total: dto.total,
        answers,
        startedAt,
      },
    });
  }

  async listAttempts(user: SafeUser, limit?: number) {
    const take = Math.min(Math.max(limit ?? DEFAULT_ATTEMPT_LIMIT, 1), 100);
    return this.prisma.quizAttempt.findMany({
      where: { userId: user.id },
      orderBy: { completedAt: 'desc' },
      take,
    });
  }

  async getSnapshot(user: SafeUser) {
    const snapshot = await this.prisma.progressSnapshot.findUnique({
      where: { userId: user.id },
    });
    return (
      snapshot ?? {
        userId: user.id,
        studiedKeys: [] as string[],
        bodyModel: null as string | null,
        updatedAt: null as Date | null,
      }
    );
  }

  /**
   * Additive merge: new keys first (newest-first order), deduplicated,
   * capped at MAX_STUDIED_KEYS. Never destructive, server timestamp wins.
   */
  async mergeStudied(user: SafeUser, dto: MergeStudiedDto) {
    const incoming = [...new Set(dto.keys.map(k => k.trim()).filter(k => k.length > 0))];
    const existing = await this.prisma.progressSnapshot.findUnique({
      where: { userId: user.id },
    });
    const merged = [...new Set([...incoming, ...(existing?.studiedKeys ?? [])])].slice(
      0,
      MAX_STUDIED_KEYS
    );
    return this.prisma.progressSnapshot.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        studiedKeys: merged,
        bodyModel: dto.bodyModel ?? existing?.bodyModel ?? null,
      },
      update: {
        studiedKeys: merged,
        ...(dto.bodyModel !== undefined ? { bodyModel: dto.bodyModel } : {}),
      },
    });
  }
}
