import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const AUDIT_ACTIONS = [
  'quiz.created',
  'quiz.updated',
  'quiz.question.added',
  'quiz.question.updated',
  'quiz.question.deleted',
  'quiz.published',
  'quiz.archived',
  'quiz.deleted',
  'user.role.changed',
  'user.deactivated',
  'user.restored',
  'user.deleted',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditActor {
  id: string;
  role: string;
}

const SENSITIVE_KEY = /password|passwd|token|secret|private.?key|api.?key|authorization|cookie/i;

export function sanitizeAuditMetadata(
  metadata: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    out[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : value;
  }
  return out;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(
    actor: AuditActor,
    action: string,
    targetType: string,
    targetId?: string | null,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action,
          targetType,
          targetId: targetId ?? null,
          metadata: (sanitizeAuditMetadata(metadata) ?? undefined) as
            Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Audit record failed (${action}): ${err instanceof Error ? err.message : 'unknown error'}`
      );
    }
  }
}
