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
}
