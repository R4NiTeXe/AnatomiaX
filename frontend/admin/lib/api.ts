function getRawBaseUrl(): string | undefined {
  if (typeof process !== 'undefined') {
    const fromProcess = (process.env as Record<string, string | undefined>)
      .NEXT_PUBLIC_API_BASE_URL;
    if (fromProcess) return fromProcess;
    const vite = (process.env as Record<string, string | undefined>).VITE_API_BASE_URL;
    if (vite) return vite;
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
      (this as unknown as { cause: unknown }).cause = opts.cause;
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
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      credentials: 'include',
    });
  } catch (cause) {
    throw new ApiError(`Failed to fetch ${url}`, { url, cause });
  }

  if (!response.ok) {
    let detail = '';
    try {
      detail = await response.text();
    } catch {}
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
