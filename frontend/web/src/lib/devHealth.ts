import { getHealth } from './api';

export async function logHealthInDev(): Promise<void> {
  try {
    const res = await getHealth();
    console.log('[AnatomiaX] health:', res);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[AnatomiaX] health check failed:', message);
  }
}

if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
  void logHealthInDev();
}
