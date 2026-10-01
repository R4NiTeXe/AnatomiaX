import type { ConfigService } from '@nestjs/config';
import { resolveAllowedOrigins } from './cors-origins';

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

  // Same shared resolver as runtime CORS setup, guard, and redirect target:
  // CORS_ORIGIN plus the CORS_ORIGINS plural alias, quote-stripped and
  // normalized, so validation judges the values actually enforced.
  const origins = resolveAllowedOrigins(config);
  if (origins.length === 0) {
    failures.push('CORS_ORIGIN (or CORS_ORIGINS) is required in production');
  } else {
    if (origins.some(o => o === '*' || o.includes('*'))) {
      failures.push('CORS_ORIGIN must not contain a wildcard in production');
    }
    const localhostPattern = /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/.*)?$/i;
    if (origins.some(o => localhostPattern.test(o))) {
      failures.push('CORS_ORIGIN must not target localhost in production');
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

  const sameSiteRaw = config.get<string>('COOKIE_SAMESITE');
  const sameSite = (sameSiteRaw ?? 'lax').toLowerCase();
  if (!['lax', 'strict', 'none'].includes(sameSite)) {
    failures.push('COOKIE_SAMESITE must be one of lax|strict|none in production');
  }
  // Production is always cross-site (Vercel frontend ↔ Render API), so an
  // explicit lax/strict silently breaks refresh: the cookie stores on the
  // OAuth 302 but the browser never sends it on cross-site fetch (/refresh
  // 401s forever). Unset defaults to none in code; an explicit non-none
  // value fails fast here instead of failing silently in browsers.
  if (sameSiteRaw && sameSite !== 'none') {
    failures.push('COOKIE_SAMESITE must be none in production (cross-site frontend/API)');
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

  // Firebase Admin SDK / FCM HTTP v1: push notifications stay optional
  // (sender stubs without credentials), but partial credentials fail fast in production.
  const firebaseProject = (config.get<string>('FIREBASE_PROJECT_ID') ?? '').trim();
  const firebaseEmail = (config.get<string>('FIREBASE_CLIENT_EMAIL') ?? '').trim();
  const firebaseKey = (config.get<string>('FIREBASE_PRIVATE_KEY') ?? '').trim();
  const firebaseServiceAccount = (config.get<string>('FIREBASE_SERVICE_ACCOUNT') ?? '').trim();
  const googleAppCreds = (config.get<string>('GOOGLE_APPLICATION_CREDENTIALS') ?? '').trim();

  const hasDirectCreds = Boolean(firebaseProject || firebaseEmail || firebaseKey);
  const hasFileOrJsonCreds = Boolean(firebaseServiceAccount || googleAppCreds);

  if (hasDirectCreds && !hasFileOrJsonCreds) {
    if (!firebaseProject) {
      failures.push(
        'FIREBASE_PROJECT_ID is required when Firebase credentials are configured in production'
      );
    }
    if (!firebaseEmail) {
      failures.push(
        'FIREBASE_CLIENT_EMAIL is required when Firebase credentials are configured in production'
      );
    }
    if (!firebaseKey) {
      failures.push(
        'FIREBASE_PRIVATE_KEY is required when Firebase credentials are configured in production'
      );
    }
  }

  // Brevo SMTP email delivery: optional (stub applies without SMTP_HOST),
  // but a partial configuration must fail clearly rather than silently never
  // delivering. Rules mirror PasswordResetDelivery.resolveSmtpConfig.
  const smtpHost = (config.get<string>('SMTP_HOST') ?? '').trim();
  const smtpFrom = (config.get<string>('SMTP_FROM') ?? '').trim();
  const smtpUser = (config.get<string>('SMTP_USER') ?? '').trim();
  const smtpPass = (config.get<string>('SMTP_PASSWORD') ?? '').trim();
  const smtpAny = smtpHost || smtpFrom || smtpUser || smtpPass;
  if (smtpAny && !smtpHost) {
    failures.push('SMTP_HOST is required when SMTP_* email delivery is configured in production');
  }
  if (smtpHost) {
    if (!smtpFrom) {
      failures.push('SMTP_FROM is required when SMTP_HOST is set in production');
    }
    if (smtpHost.includes('brevo') && (!smtpUser || !smtpPass)) {
      failures.push('SMTP_USER and SMTP_PASSWORD are required for Brevo SMTP in production');
    } else if ((smtpUser && !smtpPass) || (!smtpUser && smtpPass)) {
      failures.push('SMTP_USER and SMTP_PASSWORD must be set together in production');
    }
    const smtpPortRaw = (config.get<string>('SMTP_PORT') ?? '').trim();
    if (smtpPortRaw) {
      const smtpPort = Number(smtpPortRaw);
      if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
        failures.push('SMTP_PORT must be an integer between 1 and 65535 in production');
      }
    }
    const smtpSecureRaw = (config.get<string>('SMTP_SECURE') ?? '').toLowerCase().trim();
    if (smtpSecureRaw && !['true', 'false'].includes(smtpSecureRaw)) {
      failures.push('SMTP_SECURE must be true or false in production');
    }
  }

  // OAuth round-trip bound: optional tuning (GoogleAuthGuard defaults to
  // 15s, clamps at 120s), but a set value must be a positive integer of
  // milliseconds within the cap — an unbounded value would silently neuter
  // the round-trip DoS bound via misconfiguration.
  const oauthTimeoutRaw = (config.get<string>('OAUTH_TIMEOUT_MS') ?? '').trim();
  if (oauthTimeoutRaw) {
    const oauthTimeout = Number(oauthTimeoutRaw);
    if (!Number.isInteger(oauthTimeout) || oauthTimeout <= 0 || oauthTimeout > 120_000) {
      failures.push(
        'OAUTH_TIMEOUT_MS must be a positive integer of milliseconds (max 120000) in production'
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(`Invalid production configuration: ${failures.join('; ')}`);
  }
}
