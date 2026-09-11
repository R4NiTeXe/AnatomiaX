import type { User, UserRole } from '@prisma/client';

export interface SafeUser {
  id: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  createdAt: Date;
}

/** Strips credentials and internal fields before anything leaves the service layer. */
export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  };
}
