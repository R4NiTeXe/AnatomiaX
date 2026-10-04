import {
  ExecutionContext,
  Injectable,
  NotFoundException,
  RequestTimeoutException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { randomBytes, timingSafeEqual } from 'crypto';
import { isObservable, lastValueFrom } from 'rxjs';

export const OAUTH_STATE_COOKIE = 'oauth_state';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const OAUTH_COOKIE_PATH = '/api/v1/auth';
export const OAUTH_ROUND_TRIP_TIMEOUT_MS_DEFAULT = 15_000;
/** Upper bound: an exchange slower than this is dead — never unbounded. */
export const OAUTH_ROUND_TRIP_TIMEOUT_MS_MAX = 120_000;

/**
 * Optional `OAUTH_TIMEOUT_MS` tuning with a safe default. Garbage values
 * fall back instead of failing, and values above the max are clamped:
 * boot validation already rejects both in production, and runtime must
 * stay total (and bounded).
 */
export function oauthTimeoutMs(config: ConfigService): number {
  const raw = (config.get<string>('OAUTH_TIMEOUT_MS') ?? '').trim();
  if (!raw) return OAUTH_ROUND_TRIP_TIMEOUT_MS_DEFAULT;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return OAUTH_ROUND_TRIP_TIMEOUT_MS_DEFAULT;
  }
  return Math.min(parsed, OAUTH_ROUND_TRIP_TIMEOUT_MS_MAX);
}

/**
 * Bounds an OAuth round-trip (code exchange + profile fetch, which
 * passport-oauth2 performs with no built-in timeout). The work error wins
 * when it settles first — real provider/auth failures are never masked.
 * Late work rejection is absorbed so a timed-out exchange cannot surface as
 * an unhandled rejection after the 408 has been sent.
 */
export async function withOAuthTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  void work.catch(() => undefined);
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new RequestTimeoutException('OAuth provider timed out')),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

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
    // The token exchange + profile fetch hang unbounded when the provider
    // stalls — bound the whole passport round-trip (both legs; the redirect
    // leg resolves instantly so the timeout never bites there).
    const pending = (async () => {
      const activated = await super.canActivate(context);
      return isObservable(activated) ? lastValueFrom(activated) : activated;
    })();
    const resolved = await withOAuthTimeout(pending, oauthTimeoutMs(this.config));
    return resolved !== false;
  }

  getAuthenticateOptions(context: ExecutionContext): Record<string, unknown> {
    const req = context.switchToHttp().getRequest<OAuthHttpRequest>();
    return req.oauthState ? { state: req.oauthState } : {};
  }
}
