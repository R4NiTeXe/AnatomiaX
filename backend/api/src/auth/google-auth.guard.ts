import {
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { randomBytes, timingSafeEqual } from 'crypto';
import { isObservable, lastValueFrom } from 'rxjs';

export const OAUTH_STATE_COOKIE = 'oauth_state';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const OAUTH_COOKIE_PATH = '/api/v1/auth';

function firstQueryParam(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

function safeEqual(presented: string, expected: string): boolean {
  const a = Buffer.from(presented, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

interface OAuthHttpRequest {
  query?: Record<string, unknown>;
  cookies?: Record<string, string | undefined>;
  oauthState?: string;
}

interface OAuthHttpResponse {
  cookie(name: string, value: string, options: Record<string, unknown>): void;
  clearCookie(name: string, options: Record<string, unknown>): void;
}

/**
 * Google OAuth with login-CSRF protection (8.58), using only the existing
 * cookie mechanism — no session store, no new infrastructure.
 *
 * - Initial leg (`GET /google`, no `code`): mints a one-time nonce, binds it
 *   to a short-lived httpOnly cookie, and asks passport-oauth2 to echo it as
 *   the `state` authorization parameter (Google returns it to the callback).
 * - Callback leg (`code` present): the cookie is cleared and the echoed
 *   `state` is compared in constant time BEFORE any code exchange. Missing
 *   or mismatched state fails closed with a generic 401.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private readonly config: ConfigService) {
    super();
  }

  private cookieFlags(): Record<string, unknown> {
    const secure =
      process.env.NODE_ENV === 'production'
        ? true
        : this.config.get<string>('COOKIE_SECURE') === 'true';
    return {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: OAUTH_COOKIE_PATH,
      maxAge: OAUTH_STATE_TTL_MS,
    };
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Google login is optional: without both credentials the strategy is not
    // registered (see AuthModule), so fail closed here with a clean 404
    // instead of letting passport throw an unknown-strategy 500.
    const clientID = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    if (!clientID || !clientSecret) {
      throw new NotFoundException('Google login is not configured');
    }
    const http = context.switchToHttp();
    const req = http.getRequest<OAuthHttpRequest>();
    const res = http.getResponse<OAuthHttpResponse>();
    const code = firstQueryParam(req.query?.code);
    if (!code) {
      const nonce = randomBytes(16).toString('base64url');
      try {
        res.cookie(OAUTH_STATE_COOKIE, nonce, this.cookieFlags());
      } catch {
        throw new UnauthorizedException('OAuth initialization failed');
      }
      req.oauthState = nonce;
    } else {
      const presented = firstQueryParam(req.query?.state);
      const expected = req.cookies?.[OAUTH_STATE_COOKIE];
      try {
        res.clearCookie(OAUTH_STATE_COOKIE, { path: OAUTH_COOKIE_PATH });
      } catch {
        // Cookie clearing must never bypass verification below.
      }
      if (!presented || !expected || !safeEqual(presented, expected)) {
        throw new UnauthorizedException('Invalid OAuth state');
      }
    }
    const activated = await super.canActivate(context);
    const resolved = isObservable(activated) ? await lastValueFrom(activated) : activated;
    return resolved !== false;
  }

  getAuthenticateOptions(context: ExecutionContext): Record<string, unknown> {
    const req = context.switchToHttp().getRequest<OAuthHttpRequest>();
    return req.oauthState ? { state: req.oauthState } : {};
  }
}
