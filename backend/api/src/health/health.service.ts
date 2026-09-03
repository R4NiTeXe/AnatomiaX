import { Injectable } from '@nestjs/common';

export interface HealthResponse {
  status: 'ok';
}

@Injectable()
export class HealthService {
  check(): HealthResponse {
    return { status: 'ok' };
  }
}
