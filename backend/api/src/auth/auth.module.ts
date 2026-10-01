import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './google.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OriginCheckGuard } from './origin-check.guard';
import { PasswordResetDelivery } from './password-reset-delivery';
import { RolesGuard } from './roles.guard';

/**
 * Google login is optional: the strategy is registered only when both
 * GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are present, so the API still
 * boots normally without Google credentials. Nothing injects GoogleStrategy
 * directly (routes go through AuthGuard('google')), so an unregistered
 * strategy only affects the Google routes themselves.
 */
function googleStrategyProvider(): Provider {
  return {
    provide: GoogleStrategy,
    inject: [ConfigService, AuthService],
    useFactory: (config: ConfigService, authService: AuthService) => {
      const clientID = config.get<string>('GOOGLE_CLIENT_ID');
      const clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET');
      if (!clientID || !clientSecret) return null;
      return new GoogleStrategy(config, authService);
    },
  };
}

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret && process.env.NODE_ENV === 'production') {
          throw new Error('JWT_SECRET is required in production');
        }
        return { secret: secret ?? 'dev-only-insecure-secret' };
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordResetDelivery,
    googleStrategyProvider(),
    JwtAuthGuard,
    RolesGuard,
    OriginCheckGuard,
  ],
  // JwtModule re-exported so feature modules using JwtAuthGuard resolve JwtService.
  // ThrottlerModule re-exported so feature modules can guard their
  // controllers with ThrottlerGuard against the shared storage/options.
  exports: [AuthService, JwtAuthGuard, RolesGuard, JwtModule, ThrottlerModule],
})
export class AuthModule {}
