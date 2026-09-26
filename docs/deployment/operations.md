# Production Operations (8.58)

Companion to `README.md` (setup, release sequence, rollback) and
`release-verification.md` (gates, smoke matrix). Staging/production only —
no local-dev changes, no new infrastructure.

## PostgreSQL backup policy (recommended, provider-agnostic)

- Frequency: daily automated logical backup (`pg_dump --format=custom`),
  plus a backup immediately before any migration deploy.
- Retention: 30 daily copies, 12 monthly copies (adjust to storage budget;
  never below 7 daily).
- RPO target: ≤24h (≤ migration window with pre-migration backup).
- RTO target: ≤1h for data restore + API restart + health verification.
- Do not claim backups exist until the operator confirms scheduled,
  restorable copies. Verify restores — untested backups are not backups.

## Restore procedure (concise, non-destructive by default)

1. Stop API traffic (keep the process up for reads only if the platform
   allows; otherwise stop the API).
2. Restore to a SEPARATE database first (`pg_restore -d anatomiax_restore`),
   never over the live database on the first attempt.
3. Point a staging API at the restored copy (`DATABASE_URL`) and verify:
   `GET /api/health/db` → connected, login works, cohort list loads.
4. Run `npx prisma migrate status` against the restored copy; apply only
   committed migrations (`migrate deploy`) — never `db push`/`migrate reset`.
5. Swap `DATABASE_URL` to the restored database, restart the API, re-verify
   health + smoke checklist (`README.md` §15).

## Process model (decision)

Systemd service (or the platform's native process supervision: OCI VM
service unit, container restart policy) running `node dist/main` directly.
No PM2, no Kubernetes, no workers: the API is a single stateless Node
process (sessions live in PostgreSQL), shutdown hooks drain traffic, and
horizontal scaling is not required by the current workload. Rationale:
fewest moving parts for the final build; revisit only with measured load.

## Static frontend serving (decision)

Prebuilt outputs (`web/dist`, admin `.next/standalone`-style `next start`,
marketing `_site`) behind the existing reverse proxy / static host. No
dedicated Nginx config is shipped: any static host + TLS terminator works.
If Nginx fronts traffic, its only responsibilities are TLS, static caching
headers for immutable assets, and proxying `/api/*` to the NestJS port.

## Incident runbooks

1. **API unavailable** — check process (`systemctl status`), then
   `GET /health` (process) vs `GET /api/health/db` (database). Boot failure
   with `Invalid production configuration` → fix the named env var (never
   echo values), restart. 5xx spike → correlate `x-request-id` in server
   logs; 5xx bodies are generic by design.
2. **Database unavailable** — readiness reports 503 while liveness stays 200
   (by design). Check `DATABASE_URL`, network/security-list rules, Postgres
   process, disk space. Restore from backup only per the procedure above.
3. **Frontend unavailable** — verify static host deployment + DNS/TLS;
   confirm the build used production `VITE_API_BASE_URL` (devtools network:
   API calls must not target localhost). Rebuild + redeploy static output.
4. **3D assets unavailable** — run
   `node scripts/check-anatomy-assets.js --base <https-assets>/`; check base
   URL, host CORS/Content-Type/range headers per `asset-hosting.md`. Viewer
   shows honest per-system errors with retry; no app-wide outage expected.
5. **Authentication failures** — mass 401s: check `JWT_SECRET` rotation state
   (rotation invalidates sessions; users re-login — expected). Google
   failures: verify ID+secret pair and HTTPS callback (see failure table in
   `README.md` §19). Reset-mail failures: check SMTP config; requests still
   resolve generically (no enumeration change).

## Manual staging checks (before production traffic)

HTTPS on all three origins; Secure httpOnly cookies set over HTTPS;
CORS allow-list equals deployed origins (preflight from web+admin);
Google OAuth end-to-end (approve + deny paths); SMTP reset mail received
and single-use enforced; CDN GLB delivery (headers, ranges, cache);
browser-cache second visit; real mobile device + throttled connection;
/api/health + /api/health/db responses; API-down and DB-down behavior
(503 readiness, generic errors, no leaks).
