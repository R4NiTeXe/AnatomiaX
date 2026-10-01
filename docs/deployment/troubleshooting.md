# Production Troubleshooting (Auth Cookies, Build Env, Security Gates)

Field guide from the Vercel → Render production incidents. Symptoms first,
cheapest check first.

## 1. Silent refresh returns 401 on every reload (no `Cookie` sent)

The refresh cookie is never stored. Check in order:

1. **DevTools → Application → Cookies → `https://anatomiax-api.onrender.com`.**
   Is `refresh_token` there after login? If absent, the browser rejected the
   `Set-Cookie` — read on.
2. **Inspect the login response `Set-Cookie`.** Production needs all three:
   `Secure`, `SameSite=None`, `Path=/api/v1/auth`. Missing `Secure` with
   `SameSite=None` = browser rejects. Render env must have
   `COOKIE_SAMESITE=none` (and `COOKIE_SECURE=true`, forced in prod).
3. **Confirm the live env, not the code.** `validateProductionEnv` enforces
   the pairing at boot, but only for the values actually on Render. The
   classic failure is correct code + stale dashboard values + no redeploy.
4. **`Sec-Fetch-Site: cross-site` + `Content-Length: 0` + no `Cookie:` on
   the refresh POST is the signature** — the request left the browser
   without credentials because no cookie was stored (not a CORS failure;
   CORS failures have no response body, this one returns 401 JSON).

## 2. Refresh worked, then broke after a frontend redeploy

`VITE_API_BASE_URL` is baked at build time. If Vercel's env was changed
(or the value gained a `/api/v1` suffix — it must be the **origin only**,
`https://anatomiax-api.onrender.com`), the bundle points at the wrong host
and the cookie domain no longer matches. The build fails fast when the var
is missing (`VITE_API_BASE_URL is missing from the production build
environment`); a wrong-but-present value is silent — verify with the
presence log and a bundle grep for `localhost:3000` (must be 0).

Local dev: `frontend/web/.env` must be `http://localhost:3000`, never the
production URL.

## 3. Refresh/logout returns 403 (not 401)

That is the `OriginCheckGuard` (ADR-001), not CORS. A 403 on
`POST /api/v1/auth/refresh|logout` with a forged or unlisted `Origin`
means the cookie-CSRF check fired. Legitimate browser traffic from the
Vercel app is listed via `CORS_ORIGIN`; non-browser clients send no
`Origin`/`Referer` and pass through. If real users hit 403, the
allow-list on Render is wrong — it fails closed by design.

## 4. Google login hangs, then 408

`withOAuthTimeout` bounds the provider round-trip (default 15s,
`OAUTH_TIMEOUT_MS`). A 408 `OAuth provider timed out` means Google stalled
— retryable, nothing to fix locally. Persistent 408s: check outbound
egress from Render, not the app.

## 5. Reset-request tests flake on `delivered` assertions

Delivery is fire-and-forget (ADR-002). Any test asserting on delivery side
effects must flush one macrotask (`await new Promise(r =>
setImmediate(r))`) after the HTTP response before asserting.

## 6. CI red on `security-grep.js`

The scan fails closed on secret-shaped literals (`AKIA…`, `sk-ant-…`,
`ghu_…`, `npm_…`, `xox[baprsdoe]-…`, `GOCSPX-…`,
`-----BEGIN … PRIVATE KEY-----`, DB URLs with real credentials). There is
exactly one documented file exclusion: DB-URL fixtures inside vendored
`skills/**` playbooks (third-party docs we never edit; recorded in
`skills/README.md`) — key-shape patterns still scan them, and nothing else
is excluded, not even `*.spec.*`, mocks, or docs. A line is skipped only
for structural placeholders (`...`, `xxx`, `<PLACEHOLDER>`, `YOUR_*`,
`change-me`); generic words like "example" or "test" on the same line do
NOT suppress a finding. So write fixtures with structural markers (e.g.
`sk-proj-...`, `postgres://USER:PASSWORD@HOST/db`), never
realistic-looking secrets — and run `node scripts/security-grep.js`
locally first. Fix a finding by removing the literal, never by weakening
the pattern.
