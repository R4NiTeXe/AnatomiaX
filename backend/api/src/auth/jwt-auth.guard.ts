import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: import('../users/users.service').SafeUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers['authorization'];
    const token = Array.isArray(header) ? header[0] : header?.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }
    let payload: { sub?: string };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    // Deleted users lose access immediately, even with a valid token.
    const user = await this.users.safeById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    request.user = user;
    return true;
  }
}
