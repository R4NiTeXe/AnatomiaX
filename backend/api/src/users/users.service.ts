import { Injectable } from '@nestjs/common';
import type { User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SafeUser, toSafeUser } from './safe-user';

export { SafeUser, toSafeUser };

export interface CreateUserInput {
  email?: string | null;
  passwordHash?: string | null;
  name?: string | null;
  role?: UserRole;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Live (non-deleted) users only — deleted accounts are invisible to auth. */
  async findLiveById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null } });
  }

  async findLiveByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });
  }

  async findLiveByOAuth(provider: string, providerSub: string): Promise<User | null> {
    const account = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerSub: { provider, providerSub } },
      include: { user: true },
    });
    if (!account || account.user.deletedAt !== null) return null;
    return account.user;
  }

  async create(input: CreateUserInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: input.email ? input.email.toLowerCase() : null,
        passwordHash: input.passwordHash ?? null,
        name: input.name ?? null,
        role: input.role ?? 'STUDENT',
      },
    });
  }

  async linkOAuthAccount(userId: string, provider: string, providerSub: string): Promise<void> {
    await this.prisma.oAuthAccount.create({ data: { userId, provider, providerSub } });
  }

  async safeById(id: string): Promise<SafeUser | null> {
    const user = await this.findLiveById(id);
    return user ? toSafeUser(user) : null;
  }
}
