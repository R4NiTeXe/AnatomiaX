import { ConfigService } from '@nestjs/config';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

import * as nodemailer from 'nodemailer';
import { PasswordResetDelivery, resolveSmtpConfig } from './password-reset-delivery';

const configFor = (values: Record<string, string | undefined>) =>
  ({
    get: (key: string) => values[key],
  }) as unknown as ConfigService;

const TOKEN = 'raw-reset-token-value-0123456789';
const EMAIL = 'student@example.com';

function deliveryFor(values: Record<string, string | undefined>): PasswordResetDelivery {
  const delivery = new PasswordResetDelivery(configFor(values));
  for (const method of ['log', 'warn', 'error', 'debug'] as const) {
    jest.spyOn((delivery as unknown as { logger: Record<string, jest.Mock> }).logger, method);
  }
  return delivery;
}

function loggedText(delivery: PasswordResetDelivery): string {
  const logger = (delivery as unknown as { logger: Record<string, jest.Mock> }).logger;
  return (['log', 'warn', 'error', 'debug'] as const)
    .flatMap(m => logger[m].mock.calls.map(args => args.join(' ')))
    .join('\n');
}

describe('resolveSmtpConfig (8.20.22)', () => {
  it('stays unconfigured without SMTP_HOST', () => {
    const { config, failures } = resolveSmtpConfig({});
    expect(config.configured).toBe(false);
    expect(failures).toEqual([]);
  });

  it('requires SMTP_FROM and paired credentials when SMTP_HOST is set', () => {
    expect(resolveSmtpConfig({ SMTP_HOST: 'mail.example.com' }).failures).toEqual([
      'SMTP_FROM is required when SMTP_HOST is set',
    ]);
    const userOnly = resolveSmtpConfig({
      SMTP_HOST: 'mail.example.com',
      SMTP_FROM: 'noreply@example.com',
      SMTP_USER: 'u',
    });
    expect(userOnly.failures).toEqual(['SMTP_USER and SMTP_PASSWORD must be set together']);
    const passOnly = resolveSmtpConfig({
      SMTP_HOST: 'mail.example.com',
      SMTP_FROM: 'noreply@example.com',
      SMTP_PASSWORD: 'p',
    });
    expect(passOnly.failures).toEqual(['SMTP_USER and SMTP_PASSWORD must be set together']);
  });

  it('validates PORT bounds and SECURE enum, keeps nodemailer-friendly defaults', () => {
    const bad = resolveSmtpConfig({
      SMTP_HOST: 'h',
      SMTP_FROM: 'f@x.test',
      SMTP_PORT: '99999',
      SMTP_SECURE: 'maybe',
    });
    expect(bad.failures).toEqual([
      'SMTP_PORT must be an integer between 1 and 65535',
      'SMTP_SECURE must be true or false',
    ]);
    const minimal = resolveSmtpConfig({ SMTP_HOST: 'h', SMTP_FROM: 'f@x.test' });
    expect(minimal.failures).toEqual([]);
    expect(minimal.config).toMatchObject({ configured: true, port: 587, secure: false });
    const full = resolveSmtpConfig({
      SMTP_HOST: 'h',
      SMTP_FROM: 'f@x.test',
      SMTP_PORT: '465',
      SMTP_SECURE: 'true',
      SMTP_USER: 'u',
      SMTP_PASSWORD: 'p',
    });
    expect(full.failures).toEqual([]);
    expect(full.config).toMatchObject({
      configured: true,
      port: 465,
      secure: true,
      user: 'u',
      pass: 'p',
    });
  });

  it('never includes secret values in failure messages', () => {
    const { failures } = resolveSmtpConfig({
      SMTP_HOST: 'h',
      SMTP_FROM: 'f@x.test',
      SMTP_USER: 'super-secret-user',
    });
    expect(failures.join(';')).not.toContain('super-secret-user');
  });
});

describe('PasswordResetDelivery (8.20.22)', () => {
  const OLD_ENV = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail: jest.fn() });
  });

  afterEach(() => {
    process.env.NODE_ENV = OLD_ENV;
  });

  it('stub path resolves without touching SMTP when unconfigured', async () => {
    process.env.NODE_ENV = 'test';
    const delivery = deliveryFor({});
    await expect(delivery.dispatch(EMAIL, TOKEN)).resolves.toBeUndefined();
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it('sends a concise reset email with the existing web flow link', async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'm1' });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
    const delivery = deliveryFor({
      SMTP_HOST: 'mail.example.com',
      SMTP_FROM: 'AnatomiaX <noreply@example.com>',
      CORS_ORIGIN: 'https://app.example.com/, https://admin.example.com',
      PASSWORD_RESET_TTL_MINUTES: '60',
    });

    await expect(delivery.dispatch(EMAIL, TOKEN)).resolves.toBeUndefined();

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'mail.example.com', port: 587, secure: false })
    );
    expect(sendMail).toHaveBeenCalledTimes(1);
    const mail = sendMail.mock.calls[0][0] as Record<string, string>;
    expect(mail.from).toBe('AnatomiaX <noreply@example.com>');
    expect(mail.to).toBe(EMAIL);
    expect(mail.subject).toMatch(/reset/i);
    expect(mail.subject).toMatch(/password/i);
    // Existing ResetPasswordPage contract: /reset-password?email=…&token=….
    expect(mail.text).toContain(
      `https://app.example.com/reset-password?email=${encodeURIComponent(EMAIL)}&token=${encodeURIComponent(TOKEN)}`
    );
    // No token material in logs.
    expect(loggedText(delivery)).not.toContain(TOKEN);
  });

  it('resolves identically when SMTP sending fails (no enumeration oracle)', async () => {
    const sendMail = jest.fn().mockRejectedValue(new Error('relay down'));
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
    const delivery = deliveryFor({
      SMTP_HOST: 'mail.example.com',
      SMTP_FROM: 'noreply@example.com',
    });

    await expect(delivery.dispatch(EMAIL, TOKEN)).resolves.toBeUndefined();
    // Failure is visible in server logs only, without token material.
    expect(loggedText(delivery)).not.toContain(TOKEN);
  });

  it('refuses partial SMTP config loudly but still resolves', async () => {
    const delivery = deliveryFor({ SMTP_HOST: 'mail.example.com' });
    await expect(delivery.dispatch(EMAIL, TOKEN)).resolves.toBeUndefined();
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(loggedText(delivery)).toMatch('SMTP_FROM');
    expect(loggedText(delivery)).not.toContain(TOKEN);
  });
});
