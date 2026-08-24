#!/usr/bin/env node
/**
 * Download NIH/HRA male whole-body GLB from official source.
 * - Uses only the official HRA CDN URL (no mirrors)
 * - Preserves original filename
 * - Creates destination directory if needed
 * - Verifies SHA-256 after download
 * - Skips download if existing file already matches checksum
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const OFFICIAL_URL =
  'https://cdn.humanatlas.io/digital-objects/ref-organ/united-male/v1.5/assets/3d-vh-m-united.glb';
const DEST = path.join(
  __dirname,
  '..',
  '..',
  '3d-assets',
  'male',
  'source',
  'hra-reference-organ-united-male-v1.5.glb'
);
const EXPECTED_SHA256 =
  '34C45C90AA4ACD36BE19EDF8B878A8E7137DB9E8CB90E8E6332C2ABD49D7CF9D'.toLowerCase();

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
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', err => {
        fs.unlink(DEST, () => reject(err));
      });
  });

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
  console.log(`Original filename preserved: hra-reference-organ-united-male-v1.5.glb`);
}

download().catch(err => {
  console.error('Fail:', err.message);
  process.exit(1);
});
