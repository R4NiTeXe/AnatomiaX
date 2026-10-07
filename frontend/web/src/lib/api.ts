
import { readViteApiBaseUrl } from '@/lib/env';

export function getApiBaseUrl(): string {
  const raw = readViteApiBaseUrl();
  if (raw) return raw.replace(/\/+$/, '');
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'VITE_API_BASE_URL is not set. Set it to the API origin (e.g. https://api.example.com) and rebuild.'
    );
  }
  return 'http://localhost:3000';
}

export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  let dedupedBase = base;
  for (const prefix of ['/api/v1', '/api']) {
    if (normalizedPath.startsWith(`${prefix}/`) && dedupedBase.endsWith(prefix)) {
      dedupedBase = dedupedBase.slice(0, -prefix.length);
      break;
    }
  }
  return `${dedupedBase}${normalizedPath}`;
}

export interface ApiErrorBody {
  code?: string;
  message?: string;
  details?: string[];
  requestId?: string;
}

export class ApiError extends Error {
  status?: number;
  url: string;
  code?: string;
  requestId?: string;
  details?: string[];

  constructor(
    message: string,
    opts: {
      status?: number;
      url: string;
      code?: string;
      requestId?: string;
      details?: string[];
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.url = opts.url;
    if (opts.code !== undefined) this.code = opts.code;
    if (opts.requestId !== undefined) this.requestId = opts.requestId;
    if (opts.details !== undefined) this.details = opts.details;
    if (opts.cause !== undefined) {
      // @ts-expect-error cause is ES2022
      this.cause = opts.cause;
    }
  }
}

function parseErrorBody(raw: string): ApiErrorBody | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const body: ApiErrorBody = {};
    if (typeof parsed.code === 'string') body.code = parsed.code;
    if (typeof parsed.message === 'string') body.message = parsed.message;
    if (Array.isArray(parsed.details) && parsed.details.every(d => typeof d === 'string')) {
      body.details = parsed.details as string[];
    }
    if (typeof parsed.requestId === 'string') body.requestId = parsed.requestId;
    return body.code !== undefined || body.message !== undefined ? body : null;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = buildApiUrl(path);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch (cause) {
    throw new ApiError(`Failed to fetch ${url}`, {
      url,
      cause,
    });
  }

  if (!response.ok) {
    let detail = '';
    try {
      detail = await response.text();
    } catch {
    }
    const contract = parseErrorBody(detail);
    const headerRequestId = response.headers?.get?.('x-request-id') ?? undefined;
    const requestId = contract?.requestId ?? headerRequestId ?? undefined;
    if (contract?.message) {
      throw new ApiError(contract.message, {
        status: response.status,
        url,
        code: contract.code,
        requestId,
        details: contract.details,
      });
    }
    const suffix = detail ? ` — ${detail.slice(0, 200)}` : '';
    throw new ApiError(
      `Request failed ${response.status} ${response.statusText} for ${url}${suffix}`,
      {
        status: response.status,
        url,
        requestId,
      }
    );
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return (await response.json()) as T;
    } catch (cause) {
      throw new ApiError(`Invalid JSON response from ${url}`, {
        status: response.status,
        url,
        cause,
      });
    }
  }

  try {
    const text = await response.text();
    if (!text) return undefined as unknown as T;
    return JSON.parse(text) as T;
  } catch (cause) {
    throw new ApiError(`Invalid JSON response from ${url}`, {
      status: response.status,
      url,
      cause,
    });
  }
}

export interface HealthResponse {
  status: 'ok';
}

export function getHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>('/api/health');
}
