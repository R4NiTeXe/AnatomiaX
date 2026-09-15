import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { webAppOrigin } from './web-app-url';

export interface SmtpResetConfig {
  /** True only when SMTP_HOST is set — otherwise the safe stub applies. */
  configured: boolean;
  host: string;
  port: number;
  user?: string;
  pass?: string;
  from: string;
  secure: boolean;
}

/**
 * 8.20.22 pure SMTP configuration resolution (no I/O, no secrets in output).
 * Rules mirror validate-env.ts so boot validation and runtime agree:
 * - no SMTP_HOST → unconfigured (existing safe stub behavior everywhere);
 * - SMTP_HOST set → SMTP_FROM required; SMTP_USER/SMTP_PASSWORD must be set
 *   together (both absent = unauthenticated relay-friendly hosts only);
 * - SMTP_PORT defaults to 587, must be 1–65535 when set;
 * - SMTP_SECURE must be true/false when set (default false; STARTTLS upgrade
 *   on 587 is nodemailer's default with secure:false).
 */
export function resolveSmtpConfig(values: Record<string, string | undefined>): {
  config: SmtpResetConfig;
  failures: string[];
} {
  const failures: string[] = [];
  const host = (values.SMTP_HOST ?? '').trim();
  if (!host) {
    return {
      config: { configured: false, host: '', port: 587, from: '', secure: false },
      failures,
    };
  }
  const from = (values.SMTP_FROM ?? '').trim();
  if (!from) {
    failures.push('SMTP_FROM is required when SMTP_HOST is set');
  }
  const user = (values.SMTP_USER ?? '').trim() || undefined;
  const pass = (values.SMTP_PASSWORD ?? '').trim() || undefined;
  if ((user && !pass) || (!user && pass)) {
    failures.push('SMTP_USER and SMTP_PASSWORD must be set together');
  }
  let port = 587;
  const portRaw = (values.SMTP_PORT ?? '').trim();
  if (portRaw) {
    const parsed = Number(portRaw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      failures.push('SMTP_PORT must be an integer between 1 and 65535');
    } else {
      port = parsed;
    }
  }
  let secure = false;
  const secureRaw = (values.SMTP_SECURE ?? '').toLowerCase().trim();
  if (secureRaw) {
    if (!['true', 'false'].includes(secureRaw)) {
      failures.push('SMTP_SECURE must be true or false');
    } else {
      secure = secureRaw === 'true';
    }
  }
  return { config: { configured: true, host, port, user, pass, from, secure }, failures };
}

/**
 * 8.19.23 abstraction, 8.20.22 provider-neutral SMTP delivery.
 *
 * - No SMTP_HOST → the original safe stub (logs the request, never the token;
 *   resolves). Development/test work without any mail infrastructure.
 * - SMTP_HOST set → concise reset email via plain SMTP (any provider or local
 *   relay — no vendor SDK, no paid service required). The reset link reuses
 *   the existing web flow: <web-origin>/reset-password?email=…&token=….
 * - dispatch() NEVER throws and NEVER logs tokens, reset URLs, or SMTP
 *   secrets: AuthService always resolves reset requests (no account-enumeration
 *   oracle), so a mail outage must be indistinguishable from success.
 * - Single-use/expiry/session-revocation semantics live in AuthService and are
 *   unchanged by the transport used here.
 */
@Injectable()
export class PasswordResetDelivery {
  private readonly logger = new Logger(PasswordResetDelivery.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  private smtp(): { config: SmtpResetConfig; failures: string[] } {
    return resolveSmtpConfig({
      SMTP_HOST: this.config.get<string>('SMTP_HOST'),
      SMTP_PORT: this.config.get<string>('SMTP_PORT'),
      SMTP_USER: this.config.get<string>('SMTP_USER'),
      SMTP_PASSWORD: this.config.get<string>('SMTP_PASSWORD'),
      SMTP_FROM: this.config.get<string>('SMTP_FROM'),
      SMTP_SECURE: this.config.get<string>('SMTP_SECURE'),
    });
  }

  private resetUrl(email: string, token: string): string {
    return (
      `${webAppOrigin(this.config)}/reset-password` +
      `?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`
    );
  }

  private mailer(cfg: SmtpResetConfig): Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined,
      });
    }
    return this.transporter;
  }

  async dispatch(email: string, token: string): Promise<void> {
    const { config: cfg, failures } = this.smtp();
    if (!cfg.configured) {
      if (process.env.NODE_ENV === 'production') {
        this.logger.log(`Password reset requested for ${email} (delivery stubbed)`);
        return;
      }
      // Development/test visibility without API exposure. Token stays out of responses.
      this.logger.debug(`Password reset stub for ${email}: token length ${token.length}`);
      return;
    }
    if (failures.length > 0) {
      // Partial SMTP config must fail clearly (validate-env also rejects it at
      // boot in production) — but still resolve so reset requests never become
      // an account-enumeration oracle. Token/URL never logged.
      this.logger.error(`Password reset not sent: ${failures.join('; ')}`);
      return;
    }
    const ttl = Number(this.config.get<string>('PASSWORD_RESET_TTL_MINUTES') ?? '60') || 60;
    try {
      await this.mailer(cfg).sendMail({
        from: cfg.from,
        to: email,
        subject: 'Reset your AnatomiaX password',
        text:
          `You requested a password reset for your AnatomiaX account.\n\n` +
          `Reset your password here (expires in ${ttl} minutes, single use):\n` +
          `${this.resetUrl(email, token)}\n\n` +
          `If you did not request this, you can safely ignore this email.`,
      });
      this.logger.log(`Password reset email sent for ${email}`);
    } catch (err) {
      // Mail outage must look identical to success (anti-enumeration).
      this.logger.warn(
        `Password reset delivery failed for ${email}: ${err instanceof Error ? err.message : 'unknown error'}`
      );
    }
  }
}
