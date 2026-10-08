import { Body, Controller, Delete, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { SafeUser } from '../users/users.service';
import { AuthService, AuthSession } from './auth.service';
import { webAppOrigin } from './web-app-url';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
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
    const sameSite = (this.config.get<string>('COOKIE_SAMESITE') ??
      (isProduction ? 'none' : 'lax')) as 'lax' | 'strict' | 'none';
    const days = Number(this.config.get<string>('REFRESH_TTL_DAYS') ?? '30') || 30;
    return { httpOnly: true, secure, sameSite, path: '/api/v1/auth', maxAge: days * 86400000 };
  }

  private clearSession(res: CookieResponse): void {
    const { path, sameSite, secure } = this.cookieOptions();
    res.clearCookie(REFRESH_COOKIE, { path, sameSite, secure });
  }

  private writeSession(res: CookieResponse, session: AuthSession) {
    res.cookie(REFRESH_COOKIE, session.refreshToken, this.cookieOptions());
    return sessionBody(session);
  }

  private presentedToken(req: AuthRequest, body?: RefreshDto): string | undefined {
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
    return this.writeSession(res, await this.auth.login(dto.email, dto.password, dto.role));
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin(): void {}

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: AuthRequest, @Res() res: RedirectResponse): Promise<void> {
    const user = req.user as SafeUser;
    const session = await this.auth.issueSessionForUser(user.id);
    res.cookie(REFRESH_COOKIE, session.refreshToken, this.cookieOptions());
    res.redirect(webAppCallbackUrl(this.config));
  }

  @Post('refresh')
  @HttpCode(200)
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
    this.clearSession(res);
    return { status: 'ok' as const };
  }

  @Post('password-reset/request')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
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
    this.clearSession(res);
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
    this.clearSession(res);
    return { status: 'ok' as const };
  }
}
