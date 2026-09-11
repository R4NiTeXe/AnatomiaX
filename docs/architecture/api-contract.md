# API Contract (8.19.25)

Canonical namespace: `/api/v1/*` (global `api` prefix + `v1/` controller
paths). Health stays compatible: `GET /api/health` → `{ status: 'ok' }`,
`GET /api/health/db` → `{ status, database }`, plus the non-prefixed
`GET /health` convenience route. No other unversioned routes exist.

## Success responses

Unchanged. A `RequestIdInterceptor` (`APP_INTERCEPTOR`) adds an
`x-request-id` header to every response but never touches bodies.

## Error responses (non-health routes)

`ApiExceptionFilter` (`APP_FILTER`) normalizes every thrown value into:

```json
{ "code": "UNAUTHORIZED", "message": "Invalid credentials", "requestId": "…" }
```

- `code`: `VALIDATION_ERROR` (400, with `details: string[]`) |
  `BAD_REQUEST` (400) | `UNAUTHORIZED` (401) | `FORBIDDEN` (403) |
  `NOT_FOUND` (404, incl. hidden resources and unknown routes) |
  `CONFLICT` (409) | `RATE_LIMITED` (429, throttler prefix stripped) |
  `INTERNAL_ERROR` (5xx, always the generic message).
- HTTP statuses are preserved; only the body shape is standardized.
- Never emitted: stacks, Prisma/SQL internals, tokens, hashes, secrets.
  Unexpected exceptions and 5xx `HttpException`s resolve to
  `Internal server error`; originals stay in server logs only.
- Prisma-shaped errors map safely: `P2002` → 409 `Resource already exists`,
  `P2025` → 404 `Resource not found`, other codes → generic 500.

## Correlation

`requestId` (uuid) is generated per request, echoed as `x-request-id`, and
included in every structured server log line
(`[id] METHOD url -> status CODE`; stacks logged server-side for 5xx only).
No external logging service.

## Frontend

`ApiError` carries `code`, `requestId`, and `details?`, and `apiRequest`
prefers the contract `message` when the body parses, falling back to the
legacy `Request failed …` format otherwise. Status-based branching
(401 refresh, friendly form errors) is unchanged.
