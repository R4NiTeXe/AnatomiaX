import { Body, Controller, Delete, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { SafeUser } from '../users/users.service';
import { AuthService, AuthSession } from './auth.service';
import { webAppOrigin } from './web-app-url';
import { CurrentUser } from './current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ConfirmPasswordResetDto } from './dto/confirm-reset.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RequestPasswordResetDto } from './dto/request-reset.dto';
import { GoogleAuthGuard } from './google-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OriginCheckGuard } from './origin-check.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const REFRESH_COOKIE = 'refresh_token';

interface CookieResponse {
  cookie(name: string, value: string, options: Record<string, unknown>): void;
  clearCookie(name: string, options: Record<string, unknown>): void;
}

interface RedirectResponse extends CookieResponse {
  redirect(url: string): void;
}

interface AuthRequest {
  cookies?: Record<string, string | undefined>;
  headers: Record<string, string | string[] | undefined>;
  user?: SafeUser;
}

function sessionBody(session: AuthSession) {
  return {
    user: session.user,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
  };
}

/**
 * 8.20.20: the web app origin for completing the full-page Google OAuth flow
 * (shared helper — first CORS_ORIGIN entry, operator allow-list only).
 */
function webAppCallbackUrl(config: ConfigService): string {
  return `${webAppOrigin(config)}/auth/callback`;
}

@Controller('v1/auth')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService
  ) {}

  private cookieOptions(): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
    path: string;
    maxAge: number;
  } {
    const isProduction = process.env.NODE_ENV === 'production';
    const secure = isProduction ? true : this.config.get<string>('COOKIE_SECURE') === 'true';
    // Production is always cross-site (Vercel frontend ↔ Render API, ports
    // differ so even localhost dev is same-site but prod never is): a Lax
    // default stores the cookie on the OAuth 302 yet the browser never sends
    // it on cross-site fetch — /refresh 401s forever and the Google callback
    // reports "No Google session found". SameSite=None (with forced Secure)
    // is the correct attribute for this architecture; the CSRF residual is
    // covered by OriginCheckGuard on the cookie-credentialed routes
    // (ADR-001). Explicit COOKIE_SAMESITE still wins for operator intent;
    // non-production default stays lax.
    const sameSite = (this.config.get<string>('COOKIE_SAMESITE') ??
      (isProduction ? 'none' : 'lax')) as 'lax' | 'strict' | 'none';
    const days = Number(this.config.get<string>('REFRESH_TTL_DAYS') ?? '30') || 30;
    return { httpOnly: true, secure, sameSite, path: '/api/v1/auth', maxAge: days * 86400000 };
  }

  /**
   * Clears the session cookie with attributes mirroring issuance (minus
   * maxAge): a clearing response must match the cookie or edge browsers
   * keep a live session cookie behind after logout.
   */
  private clearSession(res: CookieResponse): void {
    const { path, sameSite, secure } = this.cookieOptions();
    res.clearCookie(REFRESH_COOKIE, { path, sameSite, secure });
  }

  private writeSession(res: CookieResponse, session: AuthSession) {
    res.cookie(REFRESH_COOKIE, session.refreshToken, this.cookieOptions());
    return sessionBody(session);
  }

  private presentedToken(req: AuthRequest, body?: RefreshDto): string | undefined {
    // Prefer the cookie: the browser jar always holds the latest rotated
    // value, while a JSON body token can be stale (e.g. a second tab that
    // has not refreshed since another tab rotated). A stale body token
    // would trip reuse detection and revoke the whole family — killing live
    // sessions. Body-only callers (mobile, tests) fall through unchanged.
    return req.cookies?.[REFRESH_COOKIE] ?? body?.refreshToken;
  }

  @Post('register')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: CookieResponse) {
    return this.writeSession(res, await this.auth.register(dto.email, dto.password, dto.name));
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: CookieResponse) {
    return this.writeSession(res, await this.auth.login(dto.email, dto.password));
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin(): void {
    // Handled by the Google guard (redirects to Google).
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: AuthRequest, @Res() res: RedirectResponse): Promise<void> {
    // Guard guarantees req.user; verified through Google's identity response.
    const user = req.user as SafeUser;
    const session = await this.auth.issueSessionForUser(user.id);
    // 8.20.20: full-page OAuth flow left the SPA, so 302 back to the web app
    // (which picks the session up from the httpOnly cookie via /auth/callback)
    // instead of stranding the user on raw session JSON with tokens rendered
    // in the page. Cookie is set on the same redirect response.
    res.cookie(REFRESH_COOKIE, session.refreshToken, this.cookieOptions());
    res.redirect(webAppCallbackUrl(this.config));
  }

  @Post('refresh')
  @HttpCode(200)
  // Cookie-CSRF: the refresh credential travels in a cross-site cookie.
  @UseGuards(OriginCheckGuard)
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: CookieResponse
  ) {
    const rawAgent = req.headers['user-agent'];
    const deviceLabel = (Array.isArray(rawAgent) ? rawAgent[0] : rawAgent)?.slice(0, 120);
    const session = await this.auth.refresh(this.presentedToken(req, dto), deviceLabel);
    return this.writeSession(res, session);
  }

  @Post('logout')
  @HttpCode(200)
  // Cookie-CSRF: logout revokes the cookie-presented token.
  @UseGuards(OriginCheckGuard)
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: CookieResponse
  ) {
    await this.auth.logout(this.presentedToken(req, dto));
    this.clearSession(res);
    return { status: 'ok' as const };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: SafeUser): SafeUser {
    return user;
  }

  @Post('password/change')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async changePassword(
    @CurrentUser() user: SafeUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: CookieResponse
  ) {
    await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
    // All sessions revoked: drop the refresh cookie so the client re-authenticates.
    this.clearSession(res);
    return { status: 'ok' as const };
  }

  @Post('password-reset/request')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    // Generic response always: no enumeration, never exposes the token.
    await this.auth.requestPasswordReset(dto.email);
    return { status: 'ok' as const };
  }

  @Post('password-reset/confirm')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async confirmPasswordReset(
    @Body() dto: ConfirmPasswordResetDto,
    @Res({ passthrough: true }) res: CookieResponse
  ) {
    await this.auth.confirmPasswordReset(dto.email, dto.token, dto.newPassword);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    return { status: 'ok' as const };
  }

  @Get('account/export')
  @UseGuards(JwtAuthGuard)
  accountExport(@CurrentUser() user: SafeUser) {
    return this.auth.exportUserData(user.id);
  }

  @Delete('account')
  @UseGuards(JwtAuthGuard)
  async deleteAccount(
    @CurrentUser() user: SafeUser,
    @Res({ passthrough: true }) res: CookieResponse
  ) {
    await this.auth.deleteAccount(user.id);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    return { status: 'ok' as const };
  }
}
