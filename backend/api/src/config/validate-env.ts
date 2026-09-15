import type { ConfigService } from '@nestjs/config';

/**
 * 8.19.23 production configuration validation (extended 8.20.16).
 * Fails fast in production when critical secrets/config are missing or unsafe.
 * Non-production environments keep permissive dev defaults (existing behavior).
 *
 * Environment model: development → test → staging → production share one
 * validation architecture. Only NODE_ENV=production enforces the strict
 * contract; staging should set NODE_ENV=production with staging values so the
 * same checks apply before real production traffic.
 *
 * No secret values are ever included in error messages or logs — failures
 * name the variable and the violated rule only.
 */
export function validateProductionEnv(config: ConfigService): void {
  if (process.env.NODE_ENV !== 'production') return;

  const failures: string[] = [];

  const jwtSecret = config.get<string>('JWT_SECRET');
  if (!jwtSecret || jwtSecret.length < 32 || jwtSecret === 'change-me-to-a-long-random-secret') {
    failures.push('JWT_SECRET must be set to a long random value (>=32 chars) in production');
  }

  const databaseUrl = config.get<string>('DATABASE_URL');
  if (!databaseUrl) {
    failures.push('DATABASE_URL is required in production');
  } else if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
    failures.push('DATABASE_URL must be a postgresql:// connection string in production');
  }

  const corsOrigin = config.get<string>('CORS_ORIGIN');
  if (!corsOrigin) {
    failures.push('CORS_ORIGIN is required in production');
  } else {
    const origins = corsOrigin
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);
    if (origins.length === 0) {
      failures.push('CORS_ORIGIN is required in production');
    } else {
      if (origins.some(o => o === '*' || o.includes('*'))) {
        failures.push('CORS_ORIGIN must not contain a wildcard in production');
      }
      const localhostPattern = /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/.*)?$/i;
      if (origins.some(o => localhostPattern.test(o))) {
        failures.push('CORS_ORIGIN must not target localhost in production');
      }
    }
  }

  const refreshDaysRaw = config.get<string>('REFRESH_TTL_DAYS') ?? '30';
  const refreshDays = Number(refreshDaysRaw);
  if (!Number.isFinite(refreshDays) || refreshDays <= 0 || refreshDays > 90) {
    failures.push('REFRESH_TTL_DAYS must be a number between 1 and 90 in production');
  }

  const resetMinutesRaw = config.get<string>('PASSWORD_RESET_TTL_MINUTES') ?? '60';
  const resetMinutes = Number(resetMinutesRaw);
  if (!Number.isFinite(resetMinutes) || resetMinutes <= 0 || resetMinutes > 24 * 60) {
    failures.push('PASSWORD_RESET_TTL_MINUTES must be a number between 1 and 1440 in production');
  }

  const sameSite = (config.get<string>('COOKIE_SAMESITE') ?? 'lax').toLowerCase();
  if (!['lax', 'strict', 'none'].includes(sameSite)) {
    failures.push('COOKIE_SAMESITE must be one of lax|strict|none in production');
  }

  // 8.20.16: SameSite=None requires Secure cookies (browser-enforced). The API
  // forces Secure in production, but an explicit COOKIE_SECURE=false alongside
  // SameSite=None signals a misconfiguration — fail fast instead of issuing
  // cookies browsers will reject.
  const cookieSecureRaw = (config.get<string>('COOKIE_SECURE') ?? '').toLowerCase().trim();
  if (cookieSecureRaw && !['true', 'false'].includes(cookieSecureRaw)) {
    failures.push('COOKIE_SECURE must be true or false in production');
  }
  if (sameSite === 'none' && cookieSecureRaw === 'false') {
    failures.push('COOKIE_SECURE must be true when COOKIE_SAMESITE=none in production');
  }

  const portRaw = (config.get<string>('PORT') ?? process.env.PORT ?? '').trim();
  if (portRaw) {
    const port = Number(portRaw);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      failures.push('PORT must be an integer between 1 and 65535 in production');
    }
  }

  const hostRaw = (config.get<string>('HOST') ?? process.env.HOST ?? '').trim();
  if (hostRaw && /\s/.test(hostRaw)) {
    failures.push('HOST must not contain whitespace in production');
  }

  const googleId = config.get<string>('GOOGLE_CLIENT_ID');
  const googleSecret = config.get<string>('GOOGLE_CLIENT_SECRET');
  if ((googleId && !googleSecret) || (!googleId && googleSecret)) {
    failures.push('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together in production');
  }
  // 8.20.16: when Google OAuth is enabled, the callback must be an explicit
  // non-localhost URL so the production OAuth flow cannot silently point at dev.
  if (googleId && googleSecret) {
    const callback = (config.get<string>('GOOGLE_CALLBACK_URL') ?? '').trim();
    if (callback) {
      const localhostCallback =
        /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/.*)?$/i.test(callback);
      if (localhostCallback) {
        failures.push('GOOGLE_CALLBACK_URL must not target localhost in production');
      }
    }
  }

  // 8.19.24: FCM stays optional (sender stubs without it), but a project id
  // without a server key is always a misconfiguration.
  const fcmKey = config.get<string>('FCM_SERVER_KEY');
  const fcmProject = config.get<string>('FIREBASE_PROJECT_ID');
  if (!fcmKey && fcmProject) {
    failures.push('FCM_SERVER_KEY is required when FIREBASE_PROJECT_ID is set in production');
  }

  if (failures.length > 0) {
    throw new Error(`Invalid production configuration: ${failures.join('; ')}`);
  }
}
