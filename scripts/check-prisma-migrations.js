/**
 * DB-less Prisma migration safety gate (STEP 8.20.22).
 * Provider-neutral, no deps, no database, no mutation.
 *
 * What it checks (actual repository paths):
 *   1. `prisma validate` — schema syntax/datasource parse. Needs DATABASE_URL
 *      present for `env()` parsing only, so a dummy value is exported for the
 *      child process; validate never connects to any database.
 *   2. Structural checks — migrations/ holds migration_lock.toml plus at least
 *      one versioned directory, each containing a non-empty migration.sql.
 *   3. Schema contract — datasource provider is postgresql, client generator
 *      present, url comes from env("DATABASE_URL") (never a literal).
 *
 * What it deliberately does NOT do (per release policy):
 *   migrate deploy/status/reset, db push/pull, generate migrations, or touch
 *   any database. True schema-vs-migration drift detection needs a shadow
 *   database (`migrate diff --from-migrations` requires --shadow-database-url
 *   on Prisma 6), which CI does not provision — drift stays a reviewer duty
 *   at migration-authoring time (see docs/deployment/README.md §12).
 *
 * Usage:
 *   node scripts/check-prisma-migrations.js
 *
 * Exit codes: 0 pass, 1 failure.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const API_DIR = path.join(ROOT, 'backend', 'api');
const SCHEMA = path.join(API_DIR, 'prisma', 'schema.prisma');
const MIGRATIONS_DIR = path.join(API_DIR, 'prisma', 'migrations');
// Parse-only placeholder. validate/builds the schema AST without connecting;
// never used as a real connection string by this script.
const DUMMY_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/anatomiax';

function fail(message, failures) {
  failures.push(message);
  console.log(`[prisma-gate] FAIL: ${message}`);
}

function main() {
  const failures = [];

  if (!fs.existsSync(SCHEMA)) {
    fail(`Missing schema: ${SCHEMA}`, failures);
  } else {
    try {
      // shell:true so the npx shim resolves on Windows runners (CI is Linux;
      // the command itself has no spaces, only the cwd option does).
      execFileSync('npx prisma validate --schema prisma/schema.prisma', {
        cwd: API_DIR,
        shell: true,
        stdio: 'pipe',
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || DUMMY_DATABASE_URL },
      });
      console.log('[prisma-gate] prisma validate: schema is valid');
    } catch (e) {
      const detail = (
        (e.stdout || e.stderr || Buffer.from('')).toString().split('\n')[0] || ''
      ).trim();
      fail(`prisma validate failed${detail ? ` ${detail}` : ''}`, failures);
    }

    const src = fs.readFileSync(SCHEMA, 'utf8');
    if (!/provider\s*=\s*"postgresql"/.test(src)) {
      fail('schema datasource provider must be "postgresql"', failures);
    }
    if (!/url\s*=\s*env\("DATABASE_URL"\)/.test(src)) {
      fail('schema datasource url must come from env("DATABASE_URL"), never a literal', failures);
    }
    if (!/generator\s+client\s*\{[^}]*provider\s*=\s*"prisma-client-js"/s.test(src)) {
      fail('schema must declare the prisma-client-js generator', failures);
    }
  }

  const lock = path.join(MIGRATIONS_DIR, 'migration_lock.toml');
  if (!fs.existsSync(lock)) {
    fail(`Missing ${path.relative(ROOT, lock)}`, failures);
  }
  let dirs = [];
  try {
    dirs = fs
      .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .sort();
  } catch {
    fail(`Cannot read ${path.relative(ROOT, MIGRATIONS_DIR)}/`, failures);
  }
  if (dirs.length === 0) {
    fail('prisma/migrations/ contains no versioned migration directories', failures);
  }
  for (const dir of dirs) {
    const sql = path.join(MIGRATIONS_DIR, dir, 'migration.sql');
    if (!fs.existsSync(sql)) {
      fail(`Migration ${dir}/ is missing migration.sql`, failures);
    } else if (fs.statSync(sql).size === 0) {
      fail(`Migration ${dir}/migration.sql is empty`, failures);
    }
  }
  if (failures.length === 0) {
    console.log(
      `[prisma-gate] ${dirs.length} migration(s) structurally sound (${dirs.join(', ')})`
    );
  }

  if (failures.length > 0) {
    console.log(
      `\n[prisma-gate] ${failures.length} failure(s). See docs/deployment/README.md §12.`
    );
    process.exit(1);
  }
  console.log('\n[prisma-gate] PASS — migration safety gate green (no database touched).');
}

main();
