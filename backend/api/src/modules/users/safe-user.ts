import type { User, UserRole } from '@prisma/client';

export interface SafeUser {
  id: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  createdAt: Date;
}

export function toSafeUser(
  user: Pick<User, 'id' | 'email' | 'name' | 'role' | 'createdAt'>
): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  };
}
