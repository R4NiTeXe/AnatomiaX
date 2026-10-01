/**
 * Secret-scan gate (verification-loop Phase 5, security-review skill).
 * Scans git-tracked files for high-confidence secret material and fails
 * closed (exit 1) on any hit. Illustrative placeholders are allowlisted by
 * content, not by file, so real leaks are caught even inside docs.
 *
 * What it checks:
 *   1. No .env / .env.local / private-key files are tracked by git.
 *   2. No cloud/API key formats (AWS, OpenAI live/project, Anthropic,
 *      GitHub incl. newer prefixes, npm, Google, Slack, Google OAuth
 *      client secrets, PEM/PGP private keys).
 *   3. No database connection strings with real (non-local, non-placeholder)
 *      credentials.
 *
 * Usage: node scripts/security-grep.js
 * Exit codes: 0 pass, 1 failure.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const FORBIDDEN_TRACKED = [/\.env(\..+)?$/, /\.pem$/, /\.key$/, /\.p12$/, /\.pfx$/];
const FORBIDDEN_TRACKED_ALLOW = [/\.env\.example$/];

const SECRET_PATTERNS = [
  { name: 'AWS access key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'AWS temp key', re: /\bASIA[0-9A-Z]{16}\b/ },
  { name: 'OpenAI live key', re: /\bsk-live-[A-Za-z0-9_-]{10,}/ },
  { name: 'OpenAI project key', re: /\bsk-proj-[A-Za-z0-9_-]{10,}/ },
  { name: 'Anthropic key', re: /\bsk-ant-[A-Za-z0-9-]{10,}/ },
  {
    name: 'GitHub token',
    re: /\b(ghp_|gho_|ghu_|ghs_|ghr_|github_pat_)[A-Za-z0-9_]{10,}/,
  },
  { name: 'npm token', re: /\bnpm_[A-Za-z0-9]{10,}/ },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'Slack token', re: /\bxox[baprsdoe]-[A-Za-z0-9-]+\b/ },
  { name: 'Google OAuth client secret', re: /\bGOCSPX-[A-Za-z0-9_-]+\b/ },
  { name: 'PEM private key', re: /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/ },
  { name: 'PGP private key', re: /-----BEGIN PGP PRIVATE KEY BLOCK-----/ },
];

// Structural placeholders that must never fail the gate. Matched against
// the full offending line. Deliberately narrow: generic words (example,
// test, sample, fake, real-looking fixtures) do NOT skip a line — a real
// secret next to the word "example" still fails. Write fixtures with `...`,
// `xxx`, `<PLACEHOLDER>`, `YOUR_*`, or `change-me` markers.
const PLACEHOLDER_ALLOW = /xxx|\.\.\.|<[A-Za-z_]+>|YOUR_[A-Z_]+|change-me|abcdef|1234567890/;

function listTracked() {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT });
  return out.toString('utf8').split('\0').filter(Boolean);
}

function main() {
  const failures = [];
  const files = listTracked();

  for (const rel of files) {
    if (FORBIDDEN_TRACKED_ALLOW.some(re => re.test(rel))) continue;
    if (FORBIDDEN_TRACKED.some(re => re.test(rel))) {
      failures.push(`tracked forbidden file: ${rel}`);
    }
  }

  for (const rel of files) {
    // Skip known-binary and generated bulk files (hashes, not secrets).
    if (/\.(glb|png|jpg|jpeg|webp|avif|svg|ico|woff2?|ttf|eot|mp4|webm|pdf|zip)$/i.test(rel)) {
      continue;
    }
    const full = path.join(ROOT, rel);
    let content;
    try {
      content = fs.readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      for (const { name, re } of SECRET_PATTERNS) {
        if (!re.test(line)) continue;
        if (PLACEHOLDER_ALLOW.test(line)) continue;
        failures.push(`${name} shape in ${rel}:${i + 1}`);
      }
      // Database URLs with real credentials (localhost/example/test dummies allowed).
      const db = line.match(/(?:postgres(?:ql)?|mongodb(?:\+srv)?|mysql|redis):\/\/([^/\s@]+)@/i);
      if (db) {
        // Template conventions (USER:PASSWORD@HOST, <placeholders>) are
        // documentation, not credentials — matched case-sensitively so real
        // lowercase secrets can never hide behind them.
        if (/USER|PASSWORD|HOST|<[^>]+>/.test(line)) continue;
        const creds = db[1].toLowerCase();
        const host = (line.split('@')[1] || '').toLowerCase();
        const dummy =
          /localhost|127\.0\.0\.1|example\.|postgres:postgres|test|changeme|placeholder|dummy|sentinel|fake|sample/.test(
            `${creds}@${host}`
          );
        if (!dummy) failures.push(`database credentials in ${rel}:${i + 1}`);
      }
    }
  }

  if (failures.length > 0) {
    console.log(`[security-grep] FAIL: ${failures.length} finding(s):`);
    for (const f of failures.slice(0, 20)) console.log(`[security-grep] FAIL: ${f}`);
    process.exit(1);
  }
  console.log(`[security-grep] PASS — scanned ${files.length} tracked files, no secrets found.`);
}

main();
