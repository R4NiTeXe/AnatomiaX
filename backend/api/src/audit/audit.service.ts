import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Privileged-action ledger writer. Domain vocabulary (action/targetType) is
 * owned by callers; this service owns the safety contract:
 * - actor identity snapshotted (id + role survive account deletion — no FK),
 * - metadata is scrubbed for authentication material before persistence,
 * - auxiliary-write failures never break the primary mutation (warn-logged).
 */
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
      // The mutation already succeeded — an audit write failure must not
      // turn it into a 500. Server-side warn keeps the gap diagnosable.
      this.logger.warn(
        `Audit record failed (${action}): ${err instanceof Error ? err.message : 'unknown error'}`
      );
    }
  }
}
