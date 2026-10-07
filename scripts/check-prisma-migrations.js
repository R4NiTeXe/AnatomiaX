
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const API_DIR = path.join(ROOT, 'backend', 'api');
const SCHEMA = path.join(API_DIR, 'prisma', 'schema.prisma');
const MIGRATIONS_DIR = path.join(API_DIR, 'prisma', 'migrations');
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
