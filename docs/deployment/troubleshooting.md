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

## 2b. Google callback lands on `/auth/callback` but "No Google session found"

The backend minted the session (the 302 to `/auth/callback` only happens
after `res.cookie` on the same response) and the SPA did attempt the
cookie refresh — so a 401/401 pair on `/refresh` + `/me` means the cookie
never went on the wire. Distinguish in order:

1. **Jar check:** DevTools → Application → Cookies →
   `https://anatomiax-api.onrender.com` right after the callback. Cookie
   **present** → it stores but isn't sent: confirm the response set
   `SameSite=None; Secure` (Lax is withheld on cross-site fetch by
   design). Cookie **absent** → rejected at set time or third-party
   cookies blocked (step 3).
2. **Env check (Render):** `NODE_ENV=production` must be set (the
   production defaults key off it). `COOKIE_SAMESITE` should be unset
   (code defaults to `none` in production) or `none`; explicit `lax` /
   `strict` now fails boot loudly instead of breaking silently. Redeploy
   after any change — env edits alone do nothing until redeploy.
3. **Browser check:** `chrome://settings/cookies` — if "Block third-party
   cookies" is on (default in Incognito), `SameSite=None` cannot help;
   retest in a normal profile. Persistent blocking across profiles means
   the durable fix is a same-site API domain, not code (ADR-006).
4. **Do not "fix" by downgrading:** no CORS wildcard, no credentials
   changes, no token-in-URL fallback — the cookie must travel cross-site
   for refresh to function, and CSRF is covered by `OriginCheckGuard`.

## 2c-i. Anatomy models fail with "Unexpected token '<'" (HTML instead of GLB)

Signature: `Could not load /models-dev/*.glb`, and fetching the URL returns
200 + `text/html` + `<!doctype html>` (the SPA shell) instead of binary.
Differential: run `node scripts/verify-model-url.js <model-url>` — it
asserts status/body/magic and distinguishes this from decode errors.

Root causes, in order: (1) the deployed bundle resolves the dev-only
`/models-dev/` base because `VITE_ANATOMY_ASSET_BASE_URL` is unset on
Vercel — production requires the external HTTPS static host base
(`<base>/<bodyModel>/<file>`, see `docs/architecture/asset-hosting.md`);
(2) even with dev paths, the files are gitignored and can never exist in
a Vercel deployment, so the SPA rewrite serves `index.html`. Vercel
builds now fail fast without a real base (see build log
`VITE_ANATOMY_ASSET_BASE_URL present: false`). Runbook: provision a
static host → upload the 18 `3d-assets/<model>/working/optimized/*.glb`
with `model/gltf-binary` + immutable caching + CORS → set the Vercel env
var → redeploy → accept with `verify-model-url.js` per URL. Committing
binaries to git is rejected (66 MB, contradicts the external-host
architecture). Note: `/models-dev/*` URLs can never serve GLBs from a
deployment by design — verify the CDN URLs, not the dev paths.

## 2c. Browser reports missing `Access-Control-Allow-Origin` (CORS)

Distinguish four causes before touching code — all four look identical in
the console:

1. **Stale evidence:** the console text persists across redeploys. Hard-refresh
   and re-check Network → the preflight `OPTIONS` → Response Headers. A
   present `Access-Control-Allow-Origin: https://anatomiax.vercel.app` means
   CORS is healthy _now_ and the error is old.
2. **Variable-name mismatch:** the code reads `CORS_ORIGIN` with a
   `CORS_ORIGINS` (plural) alias — any _third_ spelling is silently ignored
   and the allow-list falls back to localhost. Boot logs the normalized
   list (`CORS allow-list (N): …`); compare it against the browser's
   `Origin` request header, character for character (quotes, case, and
   trailing slashes are normalized away, subdomains are not).
3. **Cold-start proxy errors masquerading as CORS:** while Render's free
   instance wakes, the proxy answers 502s with no CORS headers — the
   browser blames CORS. Signature: `GET /api/health` also fails, then
   works after retry. Not a CORS bug; wait out the wake window.
4. **Wrong deployment tested:** preview deployments (`*-*.vercel.app`)
   are not the exact allow-listed origin and correctly get no headers.

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
