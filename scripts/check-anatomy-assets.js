
const fs = require('fs');
const path = require('path');
const nodeCrypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_TS = path.join(
  ROOT,
  'frontend',
  'packages',
  'anatomy-core',
  'src',
  'assetManifest.ts'
);
const PUBLIC_DEV = path.join(ROOT, 'frontend', 'web', 'public', 'models-dev');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { base: null, verify: false, origin: null, timeout: 10000 };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--base' && args[i + 1]) out.base = args[++i];
    else if (a.startsWith('--base=')) out.base = a.slice('--base='.length);
    else if (a === '--verify') out.verify = true;
    else if (a === '--origin' && args[i + 1]) out.origin = args[++i];
    else if (a.startsWith('--origin=')) out.origin = a.slice('--origin='.length);
    else if (a === '--timeout' && args[i + 1]) out.timeout = Number(args[++i]);
    else if (a === '--help' || a === '-h') {
      console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(0, 20).join('\n'));
      process.exit(0);
    }
  }
  if (!out.base) {
    try {
      const envPath = path.join(ROOT, 'frontend', 'web', '.env');
      if (fs.existsSync(envPath)) {
        const env = fs.readFileSync(envPath, 'utf8');
        const m = env.match(/VITE_ANATOMY_ASSET_BASE_URL\s*=\s*(.+)/);
        if (m) out.base = m[1].trim().replace(/^["']|["']$/g, '');
      }
    } catch {
    }
    if (!out.base) out.base = process.env.VITE_ANATOMY_ASSET_BASE_URL || '/models-dev/';
  }
  return out;
}

function normalizeBase(base) {
  const raw = String(base).trim();
  if (!raw) return '/models-dev/';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

function devAssetFilename(bodyModel, file) {
  return bodyModel === 'female' ? `female-${file}` : file;
}

function buildAssetUrl(base, bodyModel, file) {
  const normalized = normalizeBase(base);
  if (normalized === '/models-dev/') return `${normalized}${devAssetFilename(bodyModel, file)}`;
  return `${normalized}${bodyModel}/${file}`;
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_TS)) {
    console.error(`Missing manifest: ${MANIFEST_TS}`);
    process.exit(2);
  }
  const src = fs.readFileSync(MANIFEST_TS, 'utf8');
  const entries = [];
  const re =
    /\{\s*bodyModel:\s*'([^']+)',\s*system:\s*'([^']+)',\s*file:\s*'([^']+)',\s*bytes:\s*(\d+),\s*sha256:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(src))) {
    entries.push({ bodyModel: m[1], system: m[2], file: m[3], bytes: Number(m[4]), sha256: m[5] });
  }
  if (entries.length !== 18) {
    console.error(`Expected 18 manifest entries, got ${entries.length}`);
    process.exit(2);
  }
  return entries;
}

async function fetchWithTimeout(url, opts, timeout) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function checkLocalDev(entries, base) {
  console.log(
    `[check-anatomy-assets] base=${JSON.stringify(base)} (local dev) — checking ${PUBLIC_DEV}/`
  );
  let missing = 0;
  let ok = 0;
  for (const e of entries) {
    const url = buildAssetUrl(base, e.bodyModel, e.file);
    const localFile = url.replace(/^\/models-dev\//, '');
    const full = path.join(PUBLIC_DEV, localFile);
    const exists = fs.existsSync(full);
    if (!exists) {
      console.log(
        `  MISSING (dev subset, expected on fresh clone): ${url} -> ${full}  [${e.bodyModel}/${e.system} ${e.bytes}B ${e.sha256.slice(0, 8)}]`
      );
      missing++;
    } else {
      const stat = fs.statSync(full);
      if (stat.size !== e.bytes) {
        console.log(`  SIZE MISMATCH: ${url} local ${stat.size} != manifest ${e.bytes}`);
        missing++;
      } else {
        const data = fs.readFileSync(full);
        const sha = nodeCrypto.createHash('sha256').update(data).digest('hex');
        const verified = sha === e.sha256;
        console.log(
          `  ${verified ? 'OK' : 'HASH MISMATCH'}: ${url} ${stat.size}B ${sha.slice(0, 8)} ${verified ? '' : `!= ${e.sha256.slice(0, 8)}`}`
        );
        if (!verified) missing++;
        else ok++;
      }
    }
  }
  console.log(
    `\n[check-anatomy-assets] local dev: ${ok} verified, ${missing} missing/mismatch (dev subset is typically 13/18 without copied GLBs).`
  );
  console.log(
    `  To populate dev: cp 3d-assets/male/working/optimized/*.glb ${PUBLIC_DEV}/ && for f in 3d-assets/female/working/optimized/*.glb; do cp "$f" "${PUBLIC_DEV}/female-$(basename "$f")"; done`
  );
  return missing === 0 ? 0 : 0;
}

async function checkHttp(entries, base, verify, origin, timeout) {
  console.log(
    `[check-anatomy-assets] base=${JSON.stringify(base)} — checking 18 production URLs via ${verify ? 'GET+hash' : 'HEAD'}...`
  );
  let failures = 0;
  let warnings = 0;
  for (const e of entries) {
    const url = buildAssetUrl(base, e.bodyModel, e.file);
    const headers = {};
    if (origin) headers.Origin = origin;
    const method = verify ? 'GET' : 'HEAD';
    if (verify) headers.Range = undefined;
    else if (!verify) {
    }
    try {
      let res = await fetchWithTimeout(url, { method, headers }, timeout);
      if (!res.ok && method === 'HEAD' && (res.status === 403 || res.status === 405)) {
        res = await fetchWithTimeout(url, { method: 'GET', headers }, timeout);
      }
      if (!res.ok) {
        console.log(
          `  FAIL ${e.bodyModel}/${e.system}: ${url} -> HTTP ${res.status} ${res.statusText}`
        );
        failures++;
        continue;
      }
      const ct = res.headers.get('content-type') || '';
      const cl = res.headers.get('content-length');
      const etag = res.headers.get('etag') || '';
      const cc = res.headers.get('cache-control') || '';
      const ar = res.headers.get('accept-ranges') || '';
      const acao = res.headers.get('access-control-allow-origin') || '';
      const ctOk = ct.includes('model/gltf-binary');
      const clOk = cl ? Number(cl) === e.bytes : true;
      const etagOk = !!etag;
      const ccOk = cc.includes('max-age=') || cc.includes('immutable');
      const arOk = ar === 'bytes' || ar === 'bytes, bytes' || !!ar;
      const corsOk = !origin || !!acao;

      const status = ctOk && clOk && etagOk ? 'OK' : 'WARN';
      if (status === 'WARN') warnings++;

      console.log(`  ${ctOk && clOk && etagOk ? 'OK' : 'WARN'} ${e.bodyModel}/${e.system}: ${url}`);
      console.log(
        `    Content-Type: ${ct || '(missing)'} ${ctOk ? '' : '(expected model/gltf-binary)'}`
      );
      console.log(
        `    Content-Length: ${cl || '(missing)'} ${clOk ? '' : `(expected ${e.bytes})`}`
      );
      console.log(
        `    ETag: ${etag || '(missing)'}${etagOk ? '' : ' (expected strong validator)'}`
      );
      console.log(
        `    Cache-Control: ${cc || '(missing)'}${ccOk ? '' : ' (expected max-age/immutable)'}`
      );
      console.log(`    Accept-Ranges: ${ar || '(missing)'}${arOk ? '' : ' (expected bytes)'}`);
      if (origin)
        console.log(
          `    Access-Control-Allow-Origin: ${acao || '(missing)'} ${corsOk ? '' : '(expected)'}`
        );
      if (!ctOk || !clOk) failures++;

      if (verify) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength !== e.bytes) {
          console.log(`    VERIFY FAIL: bytes ${buf.byteLength} != ${e.bytes}`);
          failures++;
        } else {
          const sha = nodeCrypto.createHash('sha256').update(buf).digest('hex');
          const ok = sha === e.sha256;
          console.log(
            `    SHA-256: ${sha.slice(0, 8)} ${ok ? 'verified' : `MISMATCH (expected ${e.sha256.slice(0, 8)})`}`
          );
          if (!ok) failures++;
        }
      } else if (verify === false) {
      }
    } catch (err) {
      console.log(`  ERROR ${e.bodyModel}/${e.system}: ${url} -> ${err.message}`);
      failures++;
    }
  }
  console.log(
    `\n[check-anatomy-assets] http: ${failures} failure(s), ${warnings} warning(s) among 18.`
  );
  if (failures > 0) {
    console.log(
      `  Fix hosting per docs/architecture/asset-hosting.md (Content-Type, CORS, ETag, etc.).`
    );
    console.log(`  For dev subset, use --base /models-dev/ instead.`);
  }
  return failures === 0 ? 0 : 1;
}

async function main() {
  const { base, verify, origin, timeout } = parseArgs();
  const entries = loadManifest();
  console.log(`[check-anatomy-assets] 18 manifest entries (bytes+sha256) loaded.`);
  if (normalizeBase(base) !== '/models-dev/') {
    console.log(`[check-anatomy-assets] production layout: <base>/<bodyModel>/<file>`);
    for (const e of entries) {
      console.log(
        `  ${buildAssetUrl(base, e.bodyModel, e.file)}  (${e.bytes}B ${e.sha256.slice(0, 8)})`
      );
    }
  } else {
    console.log(`[check-anatomy-assets] dev layout: /models-dev/ flat with female- prefix`);
  }

  const isDev = normalizeBase(base) === '/models-dev/';
  const code = isDev
    ? await checkLocalDev(entries, base)
    : await checkHttp(entries, base, verify, origin, timeout);
  process.exit(code);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
