/**
 * Single parser for the `CORS_ORIGIN` allow-list, shared by the CORS setup
 * (`main.ts`) and the cookie-CSRF `OriginCheckGuard`.
 *
 * Normalization (lowercase + strip trailing slashes) must stay identical in
 * both consumers: browsers send lowercase origins without trailing slashes,
 * so an operator entry like `https://App.Example.com/` matches in CORS and
 * in the guard alike instead of disagreeing.
 */
export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(entry => entry.trim().toLowerCase().replace(/\/+$/, ''))
    .filter(Boolean);
}
