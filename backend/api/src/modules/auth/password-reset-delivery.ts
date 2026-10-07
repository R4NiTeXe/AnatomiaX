import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { webAppOrigin } from './web-app-url';

export interface SmtpResetConfig {
  configured: boolean;
  host: string;
  port: number;
  user?: string;
  pass?: string;
  from: string;
  secure: boolean;
}

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
  if (host.includes('brevo') && (!user || !pass)) {
    failures.push('SMTP_USER and SMTP_PASSWORD are required for Brevo SMTP');
  } else if ((user && !pass) || (!user && pass)) {
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
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
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
      this.logger.debug(`Password reset stub for ${email}: token length ${token.length}`);
      return;
    }
    if (failures.length > 0) {
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
      this.logger.warn(
        `Password reset delivery failed for ${email}: ${err instanceof Error ? err.message : 'unknown error'}`
      );
    }
  }
}
