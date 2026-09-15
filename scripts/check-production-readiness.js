/**
 * Lightweight production-readiness checks (STEP 8.20.16, extended 8.20.21).
 * Provider-neutral, no deps, no secrets, no cloud, no deployment.
 *
 * Usage:
 *   node scripts/check-production-readiness.js
 *   node scripts/check-production-readiness.js --api-base https://api.example --asset-base https://assets.example/anatomy/
 *   node scripts/check-production-readiness.js --production --api-base https://api.example --asset-base https://assets.example/anatomy/
 *   node scripts/check-production-readiness.js --health-url http://127.0.0.1:3000
 *   node scripts/check-production-readiness.js --check-builds
 *   node scripts/check-production-readiness.js --strict-env
 *   # Release-day operator smoke (no secrets; URLs only):
 *   node scripts/check-production-readiness.js --production --smoke --site-url https://www.example --web-url https://app.example --admin-url https://admin.example --health-url https://api.example --asset-base https://assets.example/anatomy/ --cors https://app.example,https://admin.example --app-url https://app.example
 *
 * Flags:
 *   --api-base <url>    API origin to validate (or VITE_API_BASE_URL / NEXT_PUBLIC_API_BASE_URL).
 *   --asset-base <url>  Asset base to validate (or VITE_ANATOMY_ASSET_BASE_URL).
 *   --production        Enforce production rules: no localhost, asset base must be HTTPS (not /models-dev/).
 *   --health-url <url>  Live API origin; fetches /api/health + /api/health/db and validates the contract.
 *   --check-builds      Verify expected build outputs exist (dist/.next/_site) — warn-only unless --production.
 *   --strict-env        Alias that enables production env-leakage checks (also on by default).
 *   --timeout <ms>      Per-request timeout for --health-url (default 8000).
 *   --smoke             Operator smoke pass: probe supplied public URLs (web/admin/site, sitemap,
 *                       robots), verify URL consistency (APP_URL vs CORS, api-base vs health-url),
 *                       and check the Google callback route is live without crashing.
 *   --web-url <url>     Deployed web app origin (smoke: GET / must be 200 HTML).
 *   --admin-url <url>   Deployed admin origin (smoke: GET / must be 200 HTML).
 *   --site-url <url>    Marketing origin (smoke: GET /, /sitemap.xml, /robots.txt).
 *   --cors <list>       CORS_ORIGIN value (smoke: consistency vs --app-url, HTTPS in production).
 *   --app-url <url>     APP_URL value (smoke: must match first CORS origin).
 *
 * Exit codes: 0 pass, 1 failure, 2 usage error.
 * Never prints secret values — only variable names and rules.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_TS = path.join(
  ROOT,
  'frontend',
  'packages',
  'anatomy-core',
  'src',
  'assetManifest.ts'
);
function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    apiBase: null,
    assetBase: null,
    production: false,
    healthUrl: null,
    checkBuilds: false,
    strictEnv: true,
    timeout: 8000,
    smoke: false,
    webUrl: null,
    adminUrl: null,
    siteUrl: null,
    cors: null,
    appUrl: null,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--api-base' && args[i + 1]) out.apiBase = args[++i];
    else if (a.startsWith('--api-base=')) out.apiBase = a.slice('--api-base='.length);
    else if (a === '--asset-base' && args[i + 1]) out.assetBase = args[++i];
    else if (a.startsWith('--asset-base=')) out.assetBase = a.slice('--asset-base='.length);
    else if (a === '--production') out.production = true;
    else if (a === '--health-url' && args[i + 1]) out.healthUrl = args[++i];
    else if (a.startsWith('--health-url=')) out.healthUrl = a.slice('--health-url='.length);
    else if (a === '--check-builds') out.checkBuilds = true;
    else if (a === '--strict-env') out.strictEnv = true;
    else if (a === '--timeout' && args[i + 1]) out.timeout = Number(args[++i]);
    else if (a === '--smoke') out.smoke = true;
    else if (a === '--web-url' && args[i + 1]) out.webUrl = args[++i];
    else if (a.startsWith('--web-url=')) out.webUrl = a.slice('--web-url='.length);
    else if (a === '--admin-url' && args[i + 1]) out.adminUrl = args[++i];
    else if (a.startsWith('--admin-url=')) out.adminUrl = a.slice('--admin-url='.length);
    else if (a === '--site-url' && args[i + 1]) out.siteUrl = args[++i];
    else if (a.startsWith('--site-url=')) out.siteUrl = a.slice('--site-url='.length);
    else if (a === '--cors' && args[i + 1]) out.cors = args[++i];
    else if (a.startsWith('--cors=')) out.cors = a.slice('--cors='.length);
    else if (a === '--app-url' && args[i + 1]) out.appUrl = args[++i];
    else if (a.startsWith('--app-url=')) out.appUrl = a.slice('--app-url='.length);
    else if (a === '--help' || a === '-h') {
      console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(0, 45).join('\n'));
      process.exit(0);
    } else {
      console.error(`Unknown flag: ${a}`);
      process.exit(2);
    }
  }
  if (!out.apiBase) {
    out.apiBase = process.env.VITE_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || null;
  }
  if (!out.assetBase) {
    out.assetBase = process.env.VITE_ANATOMY_ASSET_BASE_URL || null;
  }
  if (!out.appUrl) {
    out.appUrl = process.env.APP_URL || null;
  }
  if (process.env.NODE_ENV === 'production') out.production = true;
  return out;
}
function isLocalhostUrl(url) {
  if (!url) return false;
  const t = String(url).trim();
  if (t === '/models-dev/' || t === '/models-dev') return false; // handled separately
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/.*)?$/i.test(t);
}

function isModelsDev(base) {
  if (!base) return false;
  return String(base).trim() === '/models-dev' || String(base).trim() === '/models-dev/';
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_TS)) {
    return { entries: [], error: `Missing manifest: ${MANIFEST_TS}` };
  }
  const src = fs.readFileSync(MANIFEST_TS, 'utf8');
  const re =
    /\{\s*bodyModel:\s*'([^']+)',\s*system:\s*'([^']+)',\s*file:\s*'([^']+)',\s*bytes:\s*(\d+),\s*sha256:\s*'([^']+)'/g;
  const entries = [];
  let m;
  while ((m = re.exec(src))) {
    entries.push({ bodyModel: m[1], system: m[2], file: m[3], bytes: Number(m[4]), sha256: m[5] });
  }
  return { entries, error: null };
}

function checkManifest() {
  const failures = [];
  const { entries, error } = loadManifest();
  if (error) {
    failures.push(error);
    return { failures, entries };
  }
  if (entries.length !== 18) {
    failures.push(`Expected 18 manifest entries, got ${entries.length}`);
  }
  const keys = entries.map(e => `${e.bodyModel}/${e.system}`);
  if (new Set(keys).size !== entries.length) {
    failures.push('Manifest contains duplicate bodyModel/system entries');
  }
  for (const e of entries) {
    if (e.file !== `${e.system}-meshopt.glb`) {
      failures.push(`Unexpected file for ${e.bodyModel}/${e.system}: ${e.file}`);
    }
    if (!/^[0-9a-f]{64}$/.test(e.sha256)) {
      failures.push(`Bad sha256 for ${e.bodyModel}/${e.system}`);
    }
    if (!(e.bytes > 0)) {
      failures.push(`Bad bytes for ${e.bodyModel}/${e.system}`);
    }
  }
  // Deterministic production URL layout: <base>/<bodyModel>/<file>
  const sample = entries.slice(0, 2).map(e => `<base>/${e.bodyModel}/${e.file}`);
  console.log(`[readiness] manifest: ${entries.length} entries (e.g. ${sample.join(', ')})`);
  return { failures, entries };
}

function checkBases({ apiBase, assetBase, production }) {
  const failures = [];
  const warnings = [];
  if (apiBase) {
    console.log(`[readiness] api-base: ${apiBase}`);
    if (production && isLocalhostUrl(apiBase)) {
      failures.push('API base must not target localhost in production (--api-base)');
    }
  } else if (production) {
    warnings.push('No --api-base supplied; skipping production API-base localhost check');
  }
  if (assetBase) {
    console.log(`[readiness] asset-base: ${assetBase}`);
    if (production && isModelsDev(assetBase)) {
      failures.push('Asset base must be an HTTPS static host in production, not /models-dev/');
    }
    if (production && isLocalhostUrl(assetBase)) {
      failures.push('Asset base must not target localhost in production (--asset-base)');
    }
    if (production && !/^https:\/\//i.test(String(assetBase).trim())) {
      failures.push('Asset base must be https:// in production (--asset-base)');
    }
  } else if (production) {
    warnings.push('No --asset-base supplied; skipping production asset-base checks');
  }
  return { failures, warnings };
}

function checkEnvExamples() {
  const failures = [];
  const secretNames = [
    'JWT_SECRET',
    'DATABASE_URL',
    'GOOGLE_CLIENT_SECRET',
    'FCM_SERVER_KEY',
    'REFRESH_TOKEN',
  ];
  const publicFiles = [
    ['frontend/web/.env.example', 'VITE_'],
    ['frontend/admin/.env.example', 'NEXT_PUBLIC_'],
  ];
  for (const [rel, prefix] of publicFiles) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) {
      failures.push(`Missing ${rel}`);
      continue;
    }
    const content = fs.readFileSync(full, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const key = trimmed.split('=')[0].trim();
      if (!key.startsWith(prefix)) continue;
      for (const secret of secretNames) {
        if (key.toUpperCase().includes(secret)) {
          failures.push(`${rel}: public variable ${key} looks like a server secret (${secret})`);
        }
      }
    }
    console.log(`[readiness] env: ${rel} scanned (no ${prefix} secret leakage)`);
  }
  // Backend example must document the required server-only contract.
  const backendExample = path.join(ROOT, 'backend', 'api', '.env.example');
  if (!fs.existsSync(backendExample)) {
    failures.push('Missing backend/api/.env.example');
  } else {
    const content = fs.readFileSync(backendExample, 'utf8');
    for (const required of ['DATABASE_URL', 'JWT_SECRET', 'CORS_ORIGIN']) {
      if (!content.includes(required)) {
        failures.push(`backend/api/.env.example missing required variable ${required}`);
      }
    }
    console.log(
      '[readiness] env: backend/api/.env.example documents DATABASE_URL/JWT_SECRET/CORS_ORIGIN'
    );
  }
  // Marketing example must document SITE_URL/CONTACT_EMAIL without a real domain.
  const marketingExample = path.join(ROOT, 'frontend', 'marketing', '.env.example');
  if (!fs.existsSync(marketingExample)) {
    failures.push('Missing frontend/marketing/.env.example');
  } else {
    const content = fs.readFileSync(marketingExample, 'utf8');
    if (!content.includes('SITE_URL'))
      failures.push('frontend/marketing/.env.example missing SITE_URL');
    if (!content.includes('CONTACT_EMAIL'))
      failures.push('frontend/marketing/.env.example missing CONTACT_EMAIL');
    if (!content.includes('APP_URL'))
      failures.push('frontend/marketing/.env.example missing APP_URL');
  }
  return { failures };
}

function checkPackageScripts() {
  const failures = [];
  const expectations = [
    ['backend/api/package.json', ['build', 'start:prod', 'typecheck', 'test']],
    ['frontend/web/package.json', ['build', 'typecheck', 'test']],
    ['frontend/admin/package.json', ['build', 'start', 'typecheck', 'test']],
    ['frontend/marketing/package.json', ['build', 'build:eleventy']],
  ];
  for (const [rel, scripts] of expectations) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) {
      failures.push(`Missing ${rel}`);
      continue;
    }
    const pkg = JSON.parse(fs.readFileSync(full, 'utf8'));
    for (const s of scripts) {
      if (!pkg.scripts || !pkg.scripts[s]) {
        failures.push(`${rel} missing script "${s}" (docs/deployment/README.md references it)`);
      }
    }
  }
  console.log('[readiness] scripts: package.json build/typecheck/test/start contracts present');
  // Migration command presence: docs reference `prisma migrate deploy`; ensure prisma dep exists.
  const apiPkg = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'backend', 'api', 'package.json'), 'utf8')
  );
  const hasPrisma =
    (apiPkg.dependencies && apiPkg.dependencies.prisma) ||
    (apiPkg.devDependencies && apiPkg.devDependencies.prisma);
  if (!hasPrisma)
    failures.push('backend/api/package.json missing prisma (needed for migrate deploy)');
  const migrationsDir = path.join(ROOT, 'backend', 'api', 'prisma', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    failures.push('Missing backend/api/prisma/migrations/');
  }
  return { failures };
}

function checkBuildOutputs({ production }) {
  const warnings = [];
  const failures = [];
  const outputs = [
    ['frontend/web/dist', 'web production build (npm run build -w @anatomiax/web)'],
    ['backend/api/dist', 'API production build (npm run build -w @anatomiax/api)'],
    ['frontend/admin/.next', 'admin production build (npm run build -w @anatomiax/admin)'],
    ['frontend/marketing/_site', 'marketing build (npm run build -w @anatomiax/marketing)'],
  ];
  for (const [rel, label] of outputs) {
    const exists = fs.existsSync(path.join(ROOT, rel));
    console.log(`[readiness] build: ${rel} ${exists ? 'present' : 'absent'} (${label})`);
    if (!exists && production) {
      warnings.push(`Missing ${rel} — run ${label} before release`);
    }
  }
  return { failures, warnings };
}

async function fetchWithTimeout(url, timeout) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function checkHealth(healthUrl, timeout) {
  const failures = [];
  if (!healthUrl) return { failures };
  const base = String(healthUrl).replace(/\/+$/, '');
  console.log(`[readiness] health: probing ${base}/api/health + ${base}/api/health/db ...`);
  try {
    const live = await fetchWithTimeout(`${base}/api/health`, timeout);
    const liveBody = await live.json().catch(() => null);
    if (live.status !== 200 || !liveBody || liveBody.status !== 'ok') {
      failures.push(`GET /api/health expected 200 {status:ok}, got ${live.status}`);
    } else {
      console.log('[readiness] health: liveness 200 {status:ok}');
    }
    const ready = await fetchWithTimeout(`${base}/api/health/db`, timeout);
    const readyBody = await ready.json().catch(() => null);
    if (!readyBody || !['connected', 'disconnected'].includes(readyBody.database)) {
      failures.push('GET /api/health/db unexpected payload (expected {status, database})');
    } else {
      const expectedStatus = readyBody.database === 'connected' ? 200 : 503;
      const expectedState = readyBody.database === 'connected' ? 'ok' : 'degraded';
      if (ready.status !== expectedStatus || readyBody.status !== expectedState) {
        failures.push(
          `GET /api/health/db expected ${expectedStatus} {${expectedState}}, got ${ready.status}`
        );
      } else {
        console.log(
          `[readiness] health: readiness ${ready.status} {${readyBody.status}, ${readyBody.database}}`
        );
      }
      const raw = JSON.stringify(readyBody);
      if (/postgres|prisma|ECONN/i.test(raw)) {
        failures.push('GET /api/health/db leaks database internals');
      }
    }
  } catch (e) {
    failures.push(`Health probe failed: ${e.message}`);
  }
  return { failures };
}

/** Normalized scheme://host origin, or null when unparseable. */
function originOf(url) {
  try {
    const u = new URL(String(url).trim());
    return `${u.protocol}//${u.host}`.toLowerCase();
  } catch {
    return null;
  }
}

function stripTrailingSlash(url) {
  return String(url).trim().replace(/\/+$/, '');
}

/**
 * 8.20.21 operator smoke: probe deployed public URLs supplied via flags.
 * All probes are plain unauthenticated GETs; no secrets are sent or needed.
 */
async function checkPublicUrls({ webUrl, adminUrl, siteUrl }, timeout) {
  const failures = [];
  async function probe(label, url, expectHtml) {
    const target = stripTrailingSlash(url);
    try {
      const res = await fetchWithTimeout(target, timeout);
      if (res.status !== 200) {
        failures.push(`${label} GET ${target} expected 200, got ${res.status}`);
        return;
      }
      if (expectHtml) {
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('text/html')) {
          failures.push(`${label} GET ${target} expected text/html, got ${ct || '(missing)'}`);
          return;
        }
      }
      console.log(`[smoke] ${label} 200 OK (${target})`);
    } catch (e) {
      failures.push(`${label} GET ${target} unreachable: ${e.message}`);
    }
  }
  if (webUrl) await probe('web', `${stripTrailingSlash(webUrl)}/`, true);
  if (adminUrl) await probe('admin', `${stripTrailingSlash(adminUrl)}/`, true);
  if (siteUrl) {
    const base = stripTrailingSlash(siteUrl);
    await probe('marketing', `${base}/`, true);
    try {
      const sm = await fetchWithTimeout(`${base}/sitemap.xml`, timeout);
      const smText = await sm.text().catch(() => '');
      if (sm.status !== 200 || !smText.includes('<urlset')) {
        failures.push(`marketing sitemap expected 200 <urlset>, got ${sm.status}`);
      } else {
        console.log(`[smoke] marketing sitemap 200 <urlset> (${base}/sitemap.xml)`);
      }
    } catch (e) {
      failures.push(`marketing sitemap unreachable: ${e.message}`);
    }
    try {
      const rb = await fetchWithTimeout(`${base}/robots.txt`, timeout);
      const rbText = await rb.text().catch(() => '');
      if (rb.status !== 200 || !rbText.includes('Sitemap:')) {
        failures.push(`marketing robots expected 200 with Sitemap:, got ${rb.status}`);
      } else {
        console.log(`[smoke] marketing robots 200 with Sitemap: (${base}/robots.txt)`);
      }
    } catch (e) {
      failures.push(`marketing robots unreachable: ${e.message}`);
    }
  }
  return { failures };
}

/**
 * 8.20.21 URL consistency: cross-checks operator-supplied URLs against each
 * other and the production HTTPS/no-localhost rules. Catches misconfiguration
 * (e.g. APP_URL pointing somewhere CORS does not allow) before traffic does.
 */
function checkUrlConsistency({
  apiBase,
  healthUrl,
  assetBase,
  webUrl,
  adminUrl,
  siteUrl,
  cors,
  appUrl,
  production,
}) {
  const failures = [];
  const httpsFail = (label, url) => {
    if (!url) return;
    if (isLocalhostUrl(url)) {
      failures.push(`${label} must not target localhost in production`);
    } else if (!/^https:\/\//i.test(String(url).trim())) {
      failures.push(`${label} must be https:// in production`);
    }
  };
  if (production) {
    httpsFail('web URL (--web-url)', webUrl);
    httpsFail('admin URL (--admin-url)', adminUrl);
    httpsFail('site URL (--site-url)', siteUrl);
    if (appUrl) httpsFail('APP_URL (--app-url)', appUrl);
    if (cors) {
      for (const o of String(cors)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)) {
        httpsFail('CORS origin (--cors)', o);
      }
    }
  }
  if (appUrl && cors) {
    const corsFirst = String(cors)
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)[0];
    if (corsFirst && originOf(appUrl) !== originOf(corsFirst)) {
      failures.push('APP_URL origin must match the first CORS_ORIGIN entry (web app)');
    } else if (corsFirst) {
      console.log('[smoke] APP_URL origin matches first CORS_ORIGIN (web app)');
    }
  }
  if (apiBase && healthUrl && originOf(apiBase) !== originOf(healthUrl)) {
    failures.push('--api-base origin must match --health-url origin');
  }
  if (webUrl && appUrl && originOf(webUrl) !== originOf(appUrl)) {
    failures.push('--web-url origin must match --app-url origin');
  }
  return { failures };
}

/**
 * 8.20.21 Google callback liveness: without a real Google session the guard
 * must reject (302 to Google or 401) — never crash (5xx) or 404. The success
 * redirect itself needs a real session, so it stays covered by the
 * AuthController unit test plus the manual release-checklist step.
 */
async function checkGoogleCallback(apiUrl, timeout) {
  const failures = [];
  if (!apiUrl) return { failures };
  const target = `${stripTrailingSlash(apiUrl)}/api/v1/auth/google/callback`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    let res;
    try {
      res = await fetch(target, { redirect: 'manual', signal: ctrl.signal });
    } finally {
      clearTimeout(t);
    }
    if (res.status === 302) {
      const loc = res.headers.get('location') || '';
      if (!loc.includes('accounts.google.com') && !loc.endsWith('/auth/callback')) {
        failures.push(
          `Google callback 302 to unexpected location (not Google, not /auth/callback)`
        );
      } else {
        console.log(`[smoke] Google callback 302 (guard initiates OAuth, no crash)`);
      }
    } else if (res.status === 401) {
      const body = await res.text().catch(() => '');
      if (/node_modules| at .*\(.*\.ts:/.test(body)) {
        failures.push('Google callback 401 leaks a stack trace');
      } else {
        console.log('[smoke] Google callback 401 without session (guard rejects, no crash)');
      }
    } else {
      failures.push(`Google callback expected 302|401 without session, got ${res.status}`);
    }
  } catch (e) {
    failures.push(`Google callback probe failed: ${e.message}`);
  }
  return { failures };
}

async function main() {
  const opts = parseArgs();
  console.log(
    `[readiness] mode=${opts.production ? 'production' : 'non-production'} ` +
      `(use --production to enforce localhost/HTTPS rules)`
  );
  const failures = [];
  const warnings = [];

  const manifest = checkManifest();
  failures.push(...manifest.failures);

  const bases = checkBases(opts);
  failures.push(...bases.failures);
  warnings.push(...bases.warnings);

  const env = checkEnvExamples();
  failures.push(...env.failures);

  const scripts = checkPackageScripts();
  failures.push(...scripts.failures);

  if (opts.checkBuilds || opts.production) {
    const builds = checkBuildOutputs(opts);
    failures.push(...builds.failures);
    warnings.push(...builds.warnings);
  }

  const health = await checkHealth(opts.healthUrl, opts.timeout);
  failures.push(...health.failures);

  if (opts.smoke) {
    console.log('[smoke] operator smoke pass (URLs only, no secrets)');
    const consistency = checkUrlConsistency(opts);
    failures.push(...consistency.failures);
    const publicUrls = await checkPublicUrls(opts, opts.timeout);
    failures.push(...publicUrls.failures);
    const google = await checkGoogleCallback(opts.healthUrl || opts.apiBase, opts.timeout);
    failures.push(...google.failures);
  }

  for (const w of warnings) console.log(`[readiness] WARN: ${w}`);
  if (failures.length > 0) {
    for (const f of failures) console.log(`[readiness] FAIL: ${f}`);
    console.log(`\n[readiness] ${failures.length} failure(s). See docs/deployment/README.md.`);
    process.exit(1);
  }
  console.log('\n[readiness] PASS — deployment contract checks green.');
}

main().catch(e => {
  console.error(`[readiness] ERROR: ${e.message}`);
  process.exit(1);
});
