const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const FORBIDDEN_TRACKED = [/\.env(\..+)?$/, /\.pem$/, /\.key$/, /\.p12$/, /\.pfx$/];
const FORBIDDEN_TRACKED_ALLOW = [/\.env\.example$/];

const VENDORED_DOC_PATHS = [/^skills\//];

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
  { name: 'PGP private key', re: new RegExp('-----BEGIN PGP ' + 'PRIVATE KEY BLOCK-----') },
];

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
      const db = line.match(/(?:postgres(?:ql)?|mongodb(?:\+srv)?|mysql|redis):\/\/([^/\s@]+)@/i);
      if (db) {
        if (VENDORED_DOC_PATHS.some(re => re.test(rel))) continue;
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
