import { Injectable, Logger } from '@nestjs/common';

/**
 * 8.19.23 development-safe delivery stub.
 *
 * No email/SMS provider exists yet (per step rules). The raw reset token is
 * NEVER returned in API responses; it is handed here so a future provider
 * can deliver it out-of-band. The default implementation only logs that a
 * request occurred (never the token in production) and resolves.
 *
 * Tests override this provider with an in-memory fake to capture the token
 * without touching HTTP responses.
 */
@Injectable()
export class PasswordResetDelivery {
  private readonly logger = new Logger(PasswordResetDelivery.name);

  async dispatch(email: string, token: string): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      this.logger.log(`Password reset requested for ${email} (delivery stubbed)`);
      return;
    }
    // Development/test visibility without API exposure. Token stays out of responses.
    this.logger.debug(`Password reset stub for ${email}: token length ${token.length}`);
  }
}
