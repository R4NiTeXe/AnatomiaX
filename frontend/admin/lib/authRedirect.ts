/** Returns a safe in-app destination for post-auth redirects. */
export function safeAuthDestination(from: unknown, fallback = '/human'): string {
  if (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')) {
    if (from === '/login' || from === '/register') return fallback;
    return from;
  }
  return fallback;
}
