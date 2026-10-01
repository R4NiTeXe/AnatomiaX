/**
 * Populates the gitignored local dev GLB subset consumed by the web E2E suite.
 *
 * Playwright serves the Vite dev server, which serves `public/` statically:
 * a missing `/models-dev/*.glb` falls through to the SPA `index.html`
 * fallback, and the model loader fails with "Unexpected token '<' ... is not
 * valid JSON". Fresh clones (and CI runners) lack these files, so the
 * human-model-switch suite fails without this step.
 *
 * Reproduces the documented 13-file dev subset (see
 * docs/architecture/asset-hosting.md): all 9 male systems unprefixed + 4
 * female systems with the `female-` prefix. Idempotent — safe to re-run.
 *
 * Usage: node scripts/populate-dev-assets.js
 * Exit codes: 0 populated/verified, 1 source files missing.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MALE_SRC = path.join(ROOT, '3d-assets', 'male', 'working', 'optimized');
const FEMALE_SRC = path.join(ROOT, '3d-assets', 'female', 'working', 'optimized');
const DEST = path.join(ROOT, 'frontend', 'web', 'public', 'models-dev');

// Representative subset (mirrors every developer's local layout).
const MALE_FILES = [
  'cardiovascular-meshopt.glb',
  'digestive-meshopt.glb',
  'lymphatic-meshopt.glb',
  'musculoskeletal-meshopt.glb',
  'nervous-meshopt.glb',
  'reproductive-meshopt.glb',
  'respiratory-meshopt.glb',
  'skin-meshopt.glb',
  'urinary-meshopt.glb',
];
const FEMALE_FILES = [
  'cardiovascular-meshopt.glb',
  'nervous-meshopt.glb',
  'reproductive-meshopt.glb',
  'skin-meshopt.glb',
];

function main() {
  const missing = [];
  for (const f of MALE_FILES) {
    if (!fs.existsSync(path.join(MALE_SRC, f))) missing.push(`male/${f}`);
  }
  for (const f of FEMALE_FILES) {
    if (!fs.existsSync(path.join(FEMALE_SRC, f))) missing.push(`female/${f}`);
  }
  if (missing.length > 0) {
    console.error(`[populate-dev-assets] FAIL: missing sources:\n  ${missing.join('\n  ')}`);
    process.exit(1);
  }
  fs.mkdirSync(DEST, { recursive: true });
  let copied = 0;
  for (const f of MALE_FILES) {
    fs.copyFileSync(path.join(MALE_SRC, f), path.join(DEST, f));
    copied += 1;
  }
  for (const f of FEMALE_FILES) {
    fs.copyFileSync(path.join(FEMALE_SRC, f), path.join(DEST, `female-${f}`));
    copied += 1;
  }
  console.log(`[populate-dev-assets] PASS — ${copied} files in frontend/web/public/models-dev/`);
}

main();
