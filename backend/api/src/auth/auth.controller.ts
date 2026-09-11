import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { SafeUser } from '../users/users.service';
import { AuthService, AuthSession } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { RefreshDto } from './dto/refresh.dto';
import { GoogleAuthGuard } from './google-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const REFRESH_COOKIE = 'refresh_token';

interface CookieResponse {
  cookie(name: string, value: string, options: Record<string, unknown>): void;
  clearCookie(name: string, options: Record<string, unknown>): void;
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

@Controller('v1/auth')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService
  ) {}

  private cookieOptions(): Record<string, unknown> {
    const secure =
      process.env.NODE_ENV === 'production'
        ? true
        : this.config.get<string>('COOKIE_SECURE') === 'true';
    const sameSite = this.config.get<string>('COOKIE_SAMESITE') ?? 'lax';
    const days = Number(this.config.get<string>('REFRESH_TTL_DAYS') ?? '30') || 30;
    return { httpOnly: true, secure, sameSite, path: '/api/v1/auth', maxAge: days * 86400000 };
  }

  private writeSession(res: CookieResponse, session: AuthSession) {
    res.cookie(REFRESH_COOKIE, session.refreshToken, this.cookieOptions());
    return sessionBody(session);
  }

  private presentedToken(req: AuthRequest, body?: RefreshDto): string | undefined {
    return body?.refreshToken ?? req.cookies?.[REFRESH_COOKIE];
  }

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: CookieResponse) {
    return this.writeSession(res, await this.auth.register(dto.email, dto.password, dto.name));
  }

  @Post('login')
  @HttpCode(200)
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
  async googleCallback(@Req() req: AuthRequest, @Res({ passthrough: true }) res: CookieResponse) {
    // Guard guarantees req.user; verified through Google's identity response.
    const user = req.user as SafeUser;
    return this.writeSession(res, await this.auth.issueSessionForUser(user.id));
  }

  @Post('refresh')
  @HttpCode(200)
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
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: CookieResponse
  ) {
    await this.auth.logout(this.presentedToken(req, dto));
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    return { status: 'ok' as const };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: SafeUser): SafeUser {
    return user;
  }
}
