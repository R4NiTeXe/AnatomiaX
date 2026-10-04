import type { User, UserRole } from '@prisma/client';

export interface SafeUser {
  id: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  createdAt: Date;
}

/**
 * Strips credentials and internal fields before anything leaves the service
 * layer. Accepts the narrowed column selection so list queries can avoid
 * fetching `passwordHash` at all (defense in depth beyond this mapping).
 */
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
