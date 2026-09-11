import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { SafeUser } from '../users/users.service';

export const CurrentUser = createParamDecorator(
  (key: keyof SafeUser | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest<{ user?: SafeUser }>().user;
    if (!user) return undefined;
    return key ? user[key] : user;
  }
);
