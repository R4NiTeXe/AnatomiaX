/**
 * Production performance budget check (STEP 8.20.17).
 * Provider-neutral, no deps, no cloud, no deployment.
 * Reads the actual build outputs and reports raw sizes with sensible
 * warning budgets. Warnings never fail the release gate; only egregious
 * regressions (missing outputs or >2x budget) fail.
 *
 * Usage:
 *   node scripts/check-performance-budget.js
 *   node scripts/check-performance-budget.js --strict   # warnings become failures
 *   node scripts/check-performance-budget.js --json     # machine-readable summary
 *
 * Budgets (raw JS, measured 8.20.17 post `npm audit fix`):
 *   web three-core (lazy /human)   warn > 950 kB
 *   web react-vendor                warn > 200 kB
 *   web three-r3f (lazy /human)     warn > 170 kB
 *   web HumanPage (lazy route)      warn > 100 kB
 *   web index entry                 warn > 30 kB
 *   web motion-vendor (shared)      warn > 160 kB (added 8.23; Motion foundation)
 *   web total JS                    warn > 1700 kB
 *   Rationale: 8.20.9 manual chunking keeps three-core/three-r3f/HumanPage
 *   lazy behind /human; initial entry stays ~300 kB raw (~100 kB gzip).
 *   Do not tighten aggressively or break the /human frameloop to chase bytes.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WEB_DIST = path.join(ROOT, 'frontend', 'web', 'dist', 'assets');

const BUDGETS = [
  { match: /^three-core-.*\.js$/, label: 'web three-core (lazy /human)', warnKb: 950 },
  { match: /^react-vendor-.*\.js$/, label: 'web react-vendor', warnKb: 200 },
  { match: /^three-r3f-.*\.js$/, label: 'web three-r3f (lazy /human)', warnKb: 170 },
  { match: /^HumanPage-.*\.js$/, label: 'web HumanPage (lazy route)', warnKb: 100 },
  { match: /^index-.*\.js$/, label: 'web index entry', warnKb: 30 },
  { match: /^motion-vendor-.*\.js$/, label: 'web motion-vendor (shared)', warnKb: 160 },
];

const TOTAL_WARN_KB = 1700;

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
  const totalBytes = files.reduce((s, f) => s + f.bytes, 0);
  const largest = files[0];
  const indexEntry = files.find(f => /^index-.*\.js$/.test(f.file));
  const threeCore = files.find(f => /^three-core-.*\.js$/.test(f.file));

  const warnings = [];
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
    if (kb > b.warnKb * 2) {
      console.log(`[perf-budget] FAIL: ${b.label} exceeds 2x budget.`);
      process.exit(1);
    }
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
      ` | index entry: ${indexEntry ? `${indexEntry.file} ${(indexEntry.bytes / 1024).toFixed(1)} kB` : 'n/a'}` +
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
