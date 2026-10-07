
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WEB_DIST = path.join(ROOT, 'frontend', 'web', 'dist', 'assets');
const WEB_INDEX_HTML = path.join(ROOT, 'frontend', 'web', 'dist', 'index.html');

const BUDGETS = [
  { match: /^three-core-.*\.js$/, label: 'web three-core (lazy /human)', warnKb: 950 },
  { match: /^react-vendor-.*\.js$/, label: 'web react-vendor', warnKb: 200 },
  { match: /^three-r3f-.*\.js$/, label: 'web three-r3f (lazy /human)', warnKb: 170 },
  { match: /^HumanPage-.*\.js$/, label: 'web HumanPage (lazy route)', warnKb: 100 },
  { match: /^motion-vendor-.*\.js$/, label: 'web motion-vendor (shared)', warnKb: 160 },
];

const LAZY_RUNTIME_WARN_KB = 250;

const TOTAL_WARN_KB = 2200;

function resolveEntryFile() {
  let html;
  try {
    html = fs.readFileSync(WEB_INDEX_HTML, 'utf8');
  } catch {
    return null;
  }
  const match = /<script[^>]+src="([^"]+\.js)"/.exec(html);
  return match ? path.basename(match[1]) : null;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { strict: false, json: false };
  for (const a of args) {
    if (a === '--strict') out.strict = true;
    else if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') {
      console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(0, 22).join('\n'));
      process.exit(0);
    } else {
      console.error(`Unknown flag: ${a}`);
      process.exit(2);
    }
  }
  return out;
}

function listJs(dir) {
  if (!fs.existsSync(dir)) return null;
  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.js'))
    .map(f => {
      const full = path.join(dir, f);
      const stat = fs.statSync(full);
      return { file: f, bytes: stat.size };
    })
    .sort((a, b) => b.bytes - a.bytes);
}

function main() {
  const opts = parseArgs();
  const files = listJs(WEB_DIST);
  if (!files) {
    console.log(
      `[perf-budget] FAIL: missing ${WEB_DIST} — run npm run build -w @anatomiax/web first.`
    );
    process.exit(1);
  }
  if (files.length === 0) {
    console.log(`[perf-budget] FAIL: no .js assets in ${WEB_DIST} — rebuild the web app.`);
    process.exit(1);
  }
  const totalBytes = files.reduce((s, f) => s + f.bytes, 0);
  const largest = files[0];
  const threeCore = files.find(f => /^three-core-.*\.js$/.test(f.file));

  const warnings = [];
  const failOver2x = (label, kb, warnKb) => {
    if (kb > warnKb * 2) {
      console.log(`[perf-budget] FAIL: ${label} exceeds 2x budget.`);
      process.exit(1);
    }
  };
  for (const b of BUDGETS) {
    const hit = files.find(f => b.match.test(f.file));
    if (!hit) {
      warnings.push(`Missing chunk matching ${b.match} (${b.label})`);
      continue;
    }
    const kb = hit.bytes / 1024;
    const status = kb > b.warnKb ? 'WARN' : 'OK';
    console.log(
      `[perf-budget] ${status} ${b.label}: ${hit.file} ${kb.toFixed(1)} kB (budget ${b.warnKb} kB)`
    );
    if (kb > b.warnKb) warnings.push(`${b.label} ${kb.toFixed(1)} kB exceeds ${b.warnKb} kB`);
    failOver2x(b.label, kb, b.warnKb);
  }

  const entryName = resolveEntryFile();
  if (!entryName) {
    console.log('[perf-budget] FAIL: cannot resolve entry from dist/index.html.');
    process.exit(1);
  }
  const entry = files.find(f => f.file === entryName);
  if (!entry) {
    warnings.push(`Missing entry chunk ${entryName} (web index entry)`);
  } else {
    const kb = entry.bytes / 1024;
    const status = kb > 30 ? 'WARN' : 'OK';
    console.log(
      `[perf-budget] ${status} web index entry: ${entry.file} ${kb.toFixed(1)} kB (budget 30 kB)`
    );
    if (kb > 30) warnings.push(`web index entry ${kb.toFixed(1)} kB exceeds 30 kB`);
    failOver2x('web index entry', kb, 30);
  }

  for (const f of files.filter(f => /^index-.*\.js$/.test(f.file) && f.file !== entryName)) {
    const kb = f.bytes / 1024;
    const status = kb > LAZY_RUNTIME_WARN_KB ? 'WARN' : 'OK';
    console.log(
      `[perf-budget] ${status} web lazy runtime chunk: ${f.file} ${kb.toFixed(1)} kB (budget ${LAZY_RUNTIME_WARN_KB} kB)`
    );
    if (kb > LAZY_RUNTIME_WARN_KB)
      warnings.push(
        `web lazy runtime chunk ${f.file} ${kb.toFixed(1)} kB exceeds ${LAZY_RUNTIME_WARN_KB} kB`
      );
    failOver2x(`web lazy runtime chunk ${f.file}`, kb, LAZY_RUNTIME_WARN_KB);
  }
  const totalKb = totalBytes / 1024;
  const totalStatus = totalKb > TOTAL_WARN_KB ? 'WARN' : 'OK';
  console.log(
    `[perf-budget] ${totalStatus} web total JS: ${files.length} files, ${totalKb.toFixed(1)} kB (budget ${TOTAL_WARN_KB} kB)`
  );
  if (totalKb > TOTAL_WARN_KB)
    warnings.push(`total JS ${totalKb.toFixed(1)} kB exceeds ${TOTAL_WARN_KB} kB`);
  if (totalKb > TOTAL_WARN_KB * 2) {
    console.log('[perf-budget] FAIL: total JS exceeds 2x budget.');
    process.exit(1);
  }
  console.log(
    `[perf-budget] largest chunk: ${largest.file} ${(largest.bytes / 1024).toFixed(1)} kB` +
      ` | index entry: ${entry ? `${entry.file} ${(entry.bytes / 1024).toFixed(1)} kB` : 'n/a'}` +
      ` | 3D core: ${threeCore ? `${threeCore.file} ${(threeCore.bytes / 1024).toFixed(1)} kB (lazy)` : 'n/a'}`
  );

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          files: files.map(f => ({ file: f.file, kb: +(f.bytes / 1024).toFixed(1) })),
          totalKb: +totalKb.toFixed(1),
          warnings,
        },
        null,
        2
      )
    );
  }
  if (warnings.length > 0) {
    for (const w of warnings) console.log(`[perf-budget] WARN: ${w}`);
    if (opts.strict) {
      console.log(
        `\n[perf-budget] ${warnings.length} budget warning(s) treated as failure (--strict).`
      );
      process.exit(1);
    }
    console.log('\n[perf-budget] PASS with warnings (informational; gate stays green).');
    return;
  }
  console.log('\n[perf-budget] PASS — all chunks within budget.');
}

main();
