import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService, GoogleProfile } from './auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService
  ) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID') ?? 'unconfigured',
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET') ?? 'unconfigured',
      callbackURL: config.get<string>('GOOGLE_CALLBACK_URL') ?? '/api/v1/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: GoogleProfile,
    done: VerifyCallback
  ): Promise<void> {
    try {
      const user = await this.authService.validateGoogleUser(profile);
      done(null, user);
    } catch (err) {
      done(err as Error, false);
    }
  }
}
