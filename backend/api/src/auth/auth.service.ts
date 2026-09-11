import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SafeUser, UsersService, toSafeUser } from '../users/users.service';
import { PasswordResetDelivery } from './password-reset-delivery';

export interface AuthSession {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
}

export interface GoogleProfile {
  id: string;
  displayName?: string;
  emails?: Array<{ value: string; verified?: boolean }>;
}

const GENERIC_CREDENTIALS_ERROR = 'Invalid credentials';
const GENERIC_RESET_ERROR = 'Invalid or expired reset token';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface AccountExport {
  account: {
    id: string;
    email: string | null;
    name: string | null;
    role: string;
    createdAt: Date;
    updatedAt: Date;
  };
  cohortsCreated: Array<{
    id: string;
    name: string;
    institutionLabel: string | null;
    archivedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  memberships: Array<{
    cohortId: string;
    role: string;
    joinedAt: Date;
    cohort: { id: string; name: string; institutionLabel: string | null } | null;
  }>;
  quizAttempts: Array<{
    id: string;
    bodyModel: string;
    score: number;
    total: number;
    answers: unknown;
    startedAt: Date | null;
    completedAt: Date;
  }>;
  progressSnapshot: {
    userId: string;
    studiedKeys: string[];
    bodyModel: string | null;
    updatedAt: Date | null;
  } | null;
  exportedAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessTtl: string;
  private readonly refreshTtlDays: number;
  private readonly resetTtlMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly resetDelivery: PasswordResetDelivery
  ) {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is required in production');
    }
    if (!secret) {
      this.logger.warn('JWT_SECRET is not set — using an insecure development secret');
    }
    this.accessTtl = this.config.get<string>('JWT_ACCESS_TTL') ?? '15m';
    this.refreshTtlDays = Number(this.config.get<string>('REFRESH_TTL_DAYS') ?? '30') || 30;
    this.resetTtlMinutes =
      Number(this.config.get<string>('PASSWORD_RESET_TTL_MINUTES') ?? '60') || 60;
  }

  async register(email: string, password: string, name?: string): Promise<AuthSession> {
    const existing = await this.users.findLiveByEmail(email);
    if (existing) {
      // Truthful duplicate error (minor enumeration trade-off, required for usable signup).
      throw new ConflictException('Email already registered');
    }
    const user = await this.users.create({
      email,
      passwordHash: await argon2.hash(password),
      name,
      role: 'STUDENT',
    });
    return this.issueSession(user);
  }

  async login(email: string, password: string): Promise<AuthSession> {
    const user = await this.users.findLiveByEmail(email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException(GENERIC_CREDENTIALS_ERROR);
    }
    let valid = false;
    try {
      valid = await argon2.verify(user.passwordHash, password);
    } catch {
      valid = false;
    }
    if (!valid) {
      throw new UnauthorizedException(GENERIC_CREDENTIALS_ERROR);
    }
    return this.issueSession(user);
  }

  /** Issues a fresh session for an already-authenticated (live) user id. */
  async issueSessionForUser(userId: string): Promise<AuthSession> {
    const user = await this.users.findLiveById(userId);
    if (!user) {
      throw new UnauthorizedException(GENERIC_CREDENTIALS_ERROR);
    }
    return this.issueSession(user);
  }

  async refresh(presentedToken: string | undefined, deviceLabel?: string): Promise<AuthSession> {
    if (!presentedToken) {
      throw new UnauthorizedException(GENERIC_CREDENTIALS_ERROR);
    }
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(presentedToken) },
      include: { user: true },
    });
    const expired = !!record && record.expiresAt.getTime() <= Date.now();
    if (!record || record.revokedAt !== null || expired || record.user.deletedAt !== null) {
      if (record) {
        // Possible theft/reuse: invalidate the whole token family.
        await this.prisma.refreshToken.updateMany({
          where: { userId: record.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      throw new UnauthorizedException(GENERIC_CREDENTIALS_ERROR);
    }
    const rotated = await this.prisma.$transaction(async tx => {
      await tx.refreshToken.update({
        where: { id: record.id },
        data: { revokedAt: new Date() },
      });
      return this.createRefreshToken(tx, record.userId, deviceLabel);
    });
    const accessToken = await this.signAccessToken(record.user);
    return { user: toSafeUser(record.user), accessToken, refreshToken: rotated.token };
  }

  async logout(presentedToken: string | undefined): Promise<void> {
    if (!presentedToken) return;
    await this.prisma.refreshToken
      .update({
        where: { tokenHash: hashToken(presentedToken) },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }

  async me(userId: string): Promise<SafeUser> {
    const user = await this.users.safeById(userId);
    if (!user) {
      throw new UnauthorizedException(GENERIC_CREDENTIALS_ERROR);
    }
    return user;
  }

  /**
   * 8.19.23 change-password: authenticated, verifies current password when the
   * account has one (OAuth-only accounts may set an initial password),
   * stores Argon2id hash, revokes the full refresh-token family.
   */
  async changePassword(
    userId: string,
    currentPassword: string | undefined,
    newPassword: string
  ): Promise<void> {
    const user = await this.users.findLiveById(userId);
    if (!user) {
      throw new UnauthorizedException(GENERIC_CREDENTIALS_ERROR);
    }
    if (user.passwordHash) {
      if (!currentPassword) {
        throw new UnauthorizedException(GENERIC_CREDENTIALS_ERROR);
      }
      let valid = false;
      try {
        valid = await argon2.verify(user.passwordHash, currentPassword);
      } catch {
        valid = false;
      }
      if (!valid) {
        throw new UnauthorizedException(GENERIC_CREDENTIALS_ERROR);
      }
    }
    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.$transaction(async tx => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      // Password change invalidates pending resets issued before the change.
      await tx.passwordResetToken.deleteMany({ where: { userId } });
    });
  }

  /**
   * 8.19.23 reset request: always resolves (no enumeration oracle). Creates a
   * single-use, expiring, hashed-at-rest token only for live email accounts
   * and hands the raw value to the delivery stub (never an API response).
   */
  async requestPasswordReset(email: string): Promise<void> {
    const normalized = email.toLowerCase();
    const user = await this.users.findLiveByEmail(normalized);
    if (!user || !user.email) return;
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.resetTtlMinutes * 60 * 1000);
    await this.prisma.passwordResetToken
      .deleteMany({ where: { userId: user.id, usedAt: null } })
      .catch(() => undefined);
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt },
    });
    await this.resetDelivery.dispatch(normalized, token);
  }

  /**
   * 8.19.23 reset confirm: email+token must match the same live account.
   * Single-use (usedAt), expiring, revoked after use; all sessions revoked.
   */
  async confirmPasswordReset(email: string, token: string, newPassword: string): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    const now = Date.now();
    const emailMatches =
      !!record && (record.user.email ?? '').toLowerCase() === email.toLowerCase();
    const usable =
      !!record &&
      emailMatches &&
      record.usedAt === null &&
      record.expiresAt.getTime() > now &&
      record.user.deletedAt === null;
    if (!usable || !record) {
      throw new UnauthorizedException(GENERIC_RESET_ERROR);
    }
    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.$transaction(async tx => {
      await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
      await tx.passwordResetToken.deleteMany({
        where: { userId: record.userId, usedAt: null },
      });
      await tx.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  /**
   * 8.19.23 export: only the caller's own account/cohort/progress data.
   * Never includes passwordHash, refresh-token hashes, OAuth/Google tokens.
   */
  async exportUserData(userId: string): Promise<AccountExport> {
    const user = await this.users.findLiveById(userId);
    if (!user) {
      throw new UnauthorizedException(GENERIC_CREDENTIALS_ERROR);
    }
    const [cohortsCreated, memberships, quizAttempts, progressSnapshot] = await Promise.all([
      this.prisma.cohort.findMany({ where: { createdById: userId } }),
      this.prisma.cohortMember.findMany({
        where: { userId },
        include: { cohort: true },
        orderBy: { joinedAt: 'asc' },
      }),
      this.prisma.quizAttempt.findMany({
        where: { userId },
        orderBy: { completedAt: 'desc' },
      }),
      this.prisma.progressSnapshot.findUnique({ where: { userId } }),
    ]);
    return {
      account: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      cohortsCreated: cohortsCreated.map(c => ({
        id: c.id,
        name: c.name,
        institutionLabel: c.institutionLabel,
        archivedAt: c.archivedAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      memberships: memberships.map(m => ({
        cohortId: m.cohortId,
        role: m.role,
        joinedAt: m.joinedAt,
        cohort: m.cohort
          ? {
              id: (m.cohort as { id: string }).id,
              name: (m.cohort as { name: string }).name,
              institutionLabel: (m.cohort as { institutionLabel: string | null }).institutionLabel,
            }
          : null,
      })),
      quizAttempts: quizAttempts.map(a => ({
        id: a.id,
        bodyModel: a.bodyModel,
        score: a.score,
        total: a.total,
        answers: a.answers,
        startedAt: a.startedAt ?? null,
        completedAt: a.completedAt,
      })),
      progressSnapshot: progressSnapshot
        ? {
            userId: progressSnapshot.userId,
            studiedKeys: progressSnapshot.studiedKeys,
            bodyModel: progressSnapshot.bodyModel,
            updatedAt: progressSnapshot.updatedAt,
          }
        : null,
      exportedAt: new Date(),
    };
  }

  /**
   * 8.19.23 deletion: authenticated hard delete. Prisma relations define the
   * purge policy — Cascade purges oauth/refresh/resets/memberships/attempts/
   * snapshot/push; cohortsCreated uses SetNull so cohorts survive. Sessions
   * are revoked first so in-flight refresh fails even before cascade.
   */
  async deleteAccount(userId: string): Promise<void> {
    const user = await this.users.findLiveById(userId);
    if (!user) {
      throw new UnauthorizedException(GENERIC_CREDENTIALS_ERROR);
    }
    await this.prisma.$transaction(async tx => {
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.passwordResetToken.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });
  }

  /**
   * Validates a Google identity response. Google access/refresh tokens are
   * received by the strategy but intentionally never persisted.
   */
  async validateGoogleUser(profile: GoogleProfile): Promise<SafeUser> {
    const emailEntry = profile.emails?.[0];
    if (!profile.id || !emailEntry?.value || emailEntry.verified !== true) {
      throw new UnauthorizedException('Google account could not be verified');
    }
    const email = emailEntry.value.toLowerCase();
    const linked = await this.users.findLiveByOAuth('google', profile.id);
    if (linked) return toSafeUser(linked);
    const byEmail = await this.users.findLiveByEmail(email);
    if (byEmail) {
      await this.users.linkOAuthAccount(byEmail.id, 'google', profile.id);
      return toSafeUser(byEmail);
    }
    const created = await this.users.create({
      email,
      name: profile.displayName ?? null,
      role: 'STUDENT',
    });
    await this.users.linkOAuthAccount(created.id, 'google', profile.id);
    return toSafeUser(created);
  }

  private async issueSession(user: User): Promise<AuthSession> {
    const created = await this.createRefreshToken(this.prisma, user.id);
    const accessToken = await this.signAccessToken(user);
    return { user: toSafeUser(user), accessToken, refreshToken: created.token };
  }

  private signAccessToken(user: User): Promise<string> {
    return this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: this.accessTtl as `${number}${'s' | 'm' | 'h' | 'd'}` }
    );
  }

  private async createRefreshToken(
    db: Pick<PrismaService, 'refreshToken'>,
    userId: string,
    deviceLabel?: string
  ): Promise<{ token: string }> {
    const token = randomBytes(32).toString('base64url');
    await db.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        deviceLabel: deviceLabel ?? null,
        expiresAt: new Date(Date.now() + this.refreshTtlDays * 24 * 60 * 60 * 1000),
      },
    });
    return { token };
  }
}
