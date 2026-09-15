import { Injectable } from '@nestjs/common';

export interface HealthResponse {
  status: 'ok';
}

export interface DatabaseHealthResponse {
  status: 'ok' | 'degraded';
  database: 'connected' | 'disconnected';
}

@Injectable()
export class HealthService {
  check(): HealthResponse {
    return { status: 'ok' };
  }

  databaseStatus(connected: boolean): DatabaseHealthResponse {
    return connected
      ? { status: 'ok', database: 'connected' }
      : { status: 'degraded', database: 'disconnected' };
  }

  /**
   * 8.20.16 readiness semantics.
   * Liveness (`GET /health`, `GET /api/health`) never touches PostgreSQL.
   * Readiness (`GET /api/health/db`) reports the real DB state: 200 when
   * connected, 503 when unavailable. Payload never carries raw DB errors.
   */
  readinessHttpStatus(connected: boolean): number {
    return connected ? 200 : 503;
  }
}
