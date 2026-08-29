#!/usr/bin/env node
/**
 * Download NIH/HRA female whole-body GLB from official source.
 * - Uses only the official HRA CDN URL (no mirrors)
 * - Preserves original filename
 * - Creates destination directory if needed
 * - Verifies SHA-256 after download
 * - Skips download if existing file already matches checksum
 * - Fails on checksum mismatch
 * - Never silently accepts HTML
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const OFFICIAL_URL =
  'https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.5/assets/3d-vh-f-united.glb';
const DEST = path.join(
  __dirname,
  '..',
  '..',
  '3d-assets',
  'female',
  'source',
  'hra-reference-organ-united-female-v1.5.glb'
);
const EXPECTED_SHA256 =
  '472567A56896B9B7890508DA6501FBF858E56AAA30745365F7A71ADE782B529C'.toLowerCase();

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', d => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function download() {
  if (fs.existsSync(DEST)) {
    console.log(`Found existing file at ${DEST}`);
    const existingHash = await sha256File(DEST);
    console.log(`Existing SHA-256: ${existingHash}`);
    if (existingHash.toLowerCase() === EXPECTED_SHA256) {
      console.log('Checksum matches — skipping download.');
      console.log('Success: local GLB is already valid.');
      return;
    }
    console.log('Checksum does NOT match — re-downloading...');
    fs.unlinkSync(DEST);
  }

  fs.mkdirSync(path.dirname(DEST), { recursive: true });
  console.log(`Downloading from official source:\n  ${OFFICIAL_URL}`);
  console.log(`Saving to:\n  ${DEST}`);

  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(DEST);
    https
      .get(OFFICIAL_URL, res => {
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: ${res.statusCode} ${res.statusMessage}`));
          return;
        }
        const ct = (res.headers['content-type'] || '').toLowerCase();
        if (ct.includes('text/html')) {
          reject(new Error(`Download failed: server returned HTML (content-type ${ct}), not GLB`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', err => {
        fs.unlink(DEST, () => reject(err));
      });
  });

  // Quick magic check before hash
  const header = Buffer.alloc(4);
  const fd = fs.openSync(DEST, 'r');
  fs.readSync(fd, header, 0, 4, 0);
  fs.closeSync(fd);
  if (header.toString('ascii') !== 'glTF') {
    fs.unlinkSync(DEST);
    console.error('ERROR: Downloaded file is not a GLB (magic != glTF) — removed.');
    process.exit(1);
  }

  const actualHash = await sha256File(DEST);
  console.log(`Downloaded SHA-256: ${actualHash}`);
  console.log(`Expected  SHA-256: ${EXPECTED_SHA256}`);

  if (actualHash.toLowerCase() !== EXPECTED_SHA256) {
    fs.unlinkSync(DEST);
    console.error(
      'ERROR: Checksum mismatch — file removed. Download may be corrupted or source changed.'
    );
    console.error('Fail: checksum verification failed.');
    process.exit(1);
  }

  const stat = fs.statSync(DEST);
  console.log(`Success: downloaded ${stat.size} bytes and verified checksum.`);
  console.log(`Original filename preserved: hra-reference-organ-united-female-v1.5.glb`);
}

download().catch(err => {
  console.error('Fail:', err.message);
  process.exit(1);
});
