import { getHealth } from './api';

/**
 * Development-only health check — logs to console, no UI.
 * Never throws; safe to call unconditionally in DEV.
 */
export async function logHealthInDev(): Promise<void> {
  try {
    const res = await getHealth();
    console.log('[AnatomiaX] health:', res);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[AnatomiaX] health check failed:', message);
  }
}

// Auto-run only in development, no effect in production build.
// Uses process.env.NODE_ENV (defined via vite.config) for Jest/Vite compatibility.
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
  // fire-and-forget, do not block app bootstrap
  void logHealthInDev();
}
