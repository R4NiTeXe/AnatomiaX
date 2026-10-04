/**
 * Module boundary gate (Phase 5 architecture migration).
 * Enforces the allowed dependency edges between backend/api/src areas by
 * statically analyzing VALUE imports (type-only imports are erased at
 * runtime and cannot form cycles, so they are exempt by design).
 * Test files (*.spec.ts) are exempt — tests may wire anything.
 *
 * Allowed value-import edges (source -> targets):
 * - common/**, config/**, database(prisma/**): infrastructure only —
 *   must not import from modules/** or each other (except config<-common
 *   types? no: nothing outside their own area).
 * - modules/auth: users, common, config, database.
 * - modules/users: common, config, database (leaf domain).
 * - modules/cohorts: auth, users, common, config, database.
 * - modules/progress: auth, users, common, config, database.
 * - modules/quizzes: auth, users, cohorts, audit, common, config, database.
 * - modules/notifications: auth, users, common, config, database.
 * - modules/health: common, config, database, plus modules/auth SOLELY for
 *   the shared ThrottlerModule instance (re-importing it would fork
 *   rate-limit storage and change behavior — see health.module.ts).
 * - modules/audit: common, config, database.
 * - modules/admins: auth, users, audit, common, config, database.
 * - app.module.ts / main.ts: anything (composition roots).
 *
 * Usage: node scripts/check-module-boundaries.js
 * Exit codes: 0 boundaries hold, 1 violation.
 */

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'backend', 'api', 'src');

const RULES = {
  common: ['common', 'config'],
  config: ['config'],
  database: ['database'],
  'modules/auth': ['modules/users', 'common', 'config', 'database'],
  'modules/users': ['common', 'config', 'database'],
  'modules/cohorts': ['modules/auth', 'modules/users', 'common', 'config', 'database'],
  'modules/progress': ['modules/auth', 'modules/users', 'common', 'config', 'database'],
  'modules/quizzes': [
    'modules/auth',
    'modules/users',
    'modules/cohorts',
    'modules/audit',
    'common',
    'config',
    'database',
  ],
  'modules/notifications': ['modules/auth', 'modules/users', 'common', 'config', 'database'],
  'modules/health': ['modules/auth', 'common', 'config', 'database'],
  'modules/audit': ['common', 'config', 'database'],
  'modules/admins': [
    'modules/auth',
    'modules/users',
    'modules/audit',
    'common',
    'config',
    'database',
  ],
};

function areaOf(relPath) {
  const parts = relPath.split(path.sep);
  if (parts[0] === 'modules' && parts[1]) return `modules/${parts[1]}`;
  if (parts[0] === 'common') return 'common';
  if (parts[0] === 'config') return 'config';
  if (parts[0] === 'prisma') return 'database';
  return null; // app.module.ts, main.ts: composition roots, unrestricted.
}

function targetArea(fromFile, importPath) {
  if (!importPath.startsWith('.')) return null; // packages only.
  const resolved = path.normalize(path.join(path.dirname(fromFile), importPath));
  const rel = path.relative(SRC, resolved);
  if (rel.startsWith('..')) return null;
  const parts = rel.split(path.sep);
  if (parts[0] === 'modules' && parts[1]) return `modules/${parts[1]}`;
  if (parts[0] === 'common') return 'common';
  if (parts[0] === 'config') return 'config';
  if (parts[0] === 'prisma') return 'database';
  return null;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walk(full, out);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      out.push(full);
    }
  }
  return out;
}

function main() {
  const violations = [];
  for (const file of walk(SRC)) {
    const rel = path.relative(SRC, file);
    const source = areaOf(rel);
    if (!source) continue;
    const allowed = RULES[source] ?? [];
    const content = fs.readFileSync(file, 'utf8');
    const re = /import\s+(?!type\b)([^;]*?)\s+from\s+['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(content)) !== null) {
      const target = targetArea(file, m[2]);
      if (!target || target === source) continue;
      const ok = allowed.some(a => target === a || target.startsWith(`${a}/`));
      if (!ok) violations.push(`${rel} -> ${target} (${m[2]})`);
    }
  }
  if (violations.length > 0) {
    console.log(`[module-boundaries] FAIL: ${violations.length} violation(s):`);
    for (const v of violations.slice(0, 20)) console.log(`[module-boundaries] FAIL: ${v}`);
    process.exit(1);
  }
  console.log('[module-boundaries] PASS — all value-import edges within allowed rules.');
}

main();
