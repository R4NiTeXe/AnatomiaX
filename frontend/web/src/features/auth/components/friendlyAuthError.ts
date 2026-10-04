import { ApiError } from '@/lib/api';

export interface FriendlyAuthError {
  message: string;
  requestId?: string;
  details?: string[];
  status?: number;
}

export interface FriendlyErrorOverrides {
  override401?: string;
  override403?: string;
  override404?: string;
  override409?: string;
}

function statusMessage(status: number | undefined, overrides?: FriendlyErrorOverrides): string {
  switch (status) {
    case 400:
      return 'Please check the highlighted fields.';
    case 401:
      return overrides?.override401 ?? 'Authentication failed. Please sign in again.';
    case 403:
      return overrides?.override403 ?? 'You do not have permission to do that.';
    case 404:
      return overrides?.override404 ?? 'Account not found. Please check the details and try again.';
    case 409:
      return overrides?.override409 ?? 'An account with this email already exists.';
    case 429:
      return 'Too many attempts. Please wait a minute and retry.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

/**
 * Maps the canonical ApiError contract to user-facing copy while preserving
 * requestId/details for support/debugging. Never throws.
 */
export function friendlyAuthError(
  error: unknown,
  opts?: FriendlyErrorOverrides
): FriendlyAuthError {
  if (error instanceof ApiError) {
    const base = error.message?.trim();
    const mapped = statusMessage(error.status, opts);
    // Prefer the server message for validation errors (it carries specifics),
    // otherwise use the friendly mapping so auth failures stay generic.
    const message =
      error.status === 400 && base && base !== 'Validation failed'
        ? base
        : error.code === 'VALIDATION_ERROR' && error.details?.length
          ? `Validation failed: ${error.details[0]}`
          : error.status === 400 && error.details?.length
            ? `Validation failed: ${error.details[0]}`
            : mapped;
    const out: FriendlyAuthError = { message };
    if (error.status !== undefined) out.status = error.status;
    if (error.requestId !== undefined) out.requestId = error.requestId;
    if (error.details !== undefined) out.details = error.details;
    return out;
  }
  if (error instanceof Error && /fetch|network|offline|Failed to fetch/i.test(error.message)) {
    return { message: 'Network error. Check your connection and try again.' };
  }
  return { message: 'Something went wrong. Please try again.' };
}

export function friendlyAuthMessage(error: unknown, opts?: FriendlyErrorOverrides): string {
  return friendlyAuthError(error, opts).message;
}

/** Cohort-flavoured mapping that preserves status/requestId/details. */
export function friendlyCohortError(error: unknown): FriendlyAuthError {
  return friendlyAuthError(error, {
    override403: 'Only the cohort owner (or an admin) can do that.',
    override404: 'Cohort not found. Check the link or invite code and try again.',
    override409: 'You are already a member of this cohort.',
  });
}
