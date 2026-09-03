/**
 * Minimal frontend API client — native fetch only, no third-party HTTP library.
 * Reads VITE_API_BASE_URL, normalizes trailing slash, handles JSON + typed errors.
 */

// ---------------------------------------------------------------------------
// Base URL
// ---------------------------------------------------------------------------

function getRawBaseUrl(): string | undefined {
  if (typeof process !== 'undefined') {
    const fromProcess = (process.env as Record<string, string | undefined>).VITE_API_BASE_URL;
    if (fromProcess) return fromProcess;
  }
  return undefined;
}

export function getApiBaseUrl(): string {
  const raw = getRawBaseUrl() ?? 'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

// ---------------------------------------------------------------------------
// Typed error
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  status?: number;
  url: string;

  constructor(message: string, opts: { status?: number; url: string; cause?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.url = opts.url;
    if (opts.cause !== undefined) {
      // @ts-expect-error cause is ES2022
      this.cause = opts.cause;
    }
  }
}

// ---------------------------------------------------------------------------
// Generic request helper
// ---------------------------------------------------------------------------

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = buildApiUrl(path);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
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
      // ignore
    }
    const suffix = detail ? ` — ${detail.slice(0, 200)}` : '';
    throw new ApiError(
      `Request failed ${response.status} ${response.statusText} for ${url}${suffix}`,
      {
        status: response.status,
        url,
      }
    );
  }

  // 204 No Content
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

  // Fallback: try JSON, otherwise text
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

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export interface HealthResponse {
  status: 'ok';
}

export function getHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>('/api/health');
}
