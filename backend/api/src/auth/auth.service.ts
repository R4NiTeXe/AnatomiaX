import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SafeUser, UsersService, toSafeUser } from '../users/users.service';

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

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessTtl: string;
  private readonly refreshTtlDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService
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
