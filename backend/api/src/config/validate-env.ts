import type { ConfigService } from '@nestjs/config';

/**
 * 8.19.23 production configuration validation.
 * Fails fast in production when critical secrets/config are missing or unsafe.
 * Non-production environments keep permissive dev defaults (existing behavior).
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
  }

  const corsOrigin = config.get<string>('CORS_ORIGIN');
  if (!corsOrigin) {
    failures.push('CORS_ORIGIN is required in production');
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

  const googleId = config.get<string>('GOOGLE_CLIENT_ID');
  const googleSecret = config.get<string>('GOOGLE_CLIENT_SECRET');
  if ((googleId && !googleSecret) || (!googleId && googleSecret)) {
    failures.push('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together in production');
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
