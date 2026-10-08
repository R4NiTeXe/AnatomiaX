const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MALE_SRC = path.join(ROOT, '3d-assets', 'male', 'working', 'optimized');
const FEMALE_SRC = path.join(ROOT, '3d-assets', 'female', 'working', 'optimized');
const DEST = path.join(ROOT, 'frontend', 'web', 'public', 'models-dev');

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

function syntheticGlb() {
  const positions = [0, 0, 0, 1, 0, 0, 0, 1, 0];
  const normals = [0, 0, 1, 0, 0, 1, 0, 0, 1];
  const bin = Buffer.alloc(72);
  positions.forEach((v, i) => bin.writeFloatLE(v, i * 4));
  normals.forEach((v, i) => bin.writeFloatLE(v, 36 + i * 4));
  const json = Buffer.from(
    JSON.stringify({
      asset: { version: '2.0', generator: 'AnatomiaX-E2E-fixture' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0, name: 'fixture' }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 } }] }],
      accessors: [
        {
          bufferView: 0,
          componentType: 5126,
          count: 3,
          type: 'VEC3',
          max: [1, 1, 0],
          min: [0, 0, 0],
        },
        { bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' },
      ],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
        { buffer: 0, byteOffset: 36, byteLength: 36, target: 34962 },
      ],
      buffers: [{ byteLength: 72 }],
    })
  );
  const jsonPadded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
  json.copy(jsonPadded);
  const total = 12 + 8 + jsonPadded.length + 8 + bin.length;
  const out = Buffer.alloc(total);
  let o = 0;
  out.writeUInt32LE(0x46546c67, o);
  o += 4;
  out.writeUInt32LE(2, o);
  o += 4;
  out.writeUInt32LE(total, o);
  o += 4;
  out.writeUInt32LE(jsonPadded.length, o);
  o += 4;
  out.writeUInt32LE(0x4e4f534a, o);
  o += 4;
  jsonPadded.copy(out, o);
  o += jsonPadded.length;
  out.writeUInt32LE(bin.length, o);
  o += 4;
  out.writeUInt32LE(0x004e4942, o);
  o += 4;
  bin.copy(out, o);
  return out;
}

function destNames() {
  return [...MALE_FILES, ...FEMALE_FILES.map(f => `female-${f}`)];
}

function main() {
  const missing = [];
  for (const f of MALE_FILES) {
    if (!fs.existsSync(path.join(MALE_SRC, f))) missing.push(`male/${f}`);
  }
  for (const f of FEMALE_FILES) {
    if (!fs.existsSync(path.join(FEMALE_SRC, f))) missing.push(`female/${f}`);
  }
  const total = MALE_FILES.length + FEMALE_FILES.length;
  fs.mkdirSync(DEST, { recursive: true });
  if (missing.length === 0) {
    for (const f of MALE_FILES) fs.copyFileSync(path.join(MALE_SRC, f), path.join(DEST, f));
    for (const f of FEMALE_FILES) {
      fs.copyFileSync(path.join(FEMALE_SRC, f), path.join(DEST, `female-${f}`));
    }
    console.log(
      `[populate-dev-assets] PASS (real) — ${total} files in frontend/web/public/models-dev/`
    );
    return;
  }
  if (missing.length < total) {
    console.error(
      `[populate-dev-assets] FAIL: partial source set (broken pipeline, not a fresh clone) — refusing to mix real and synthetic meshes:\n  ${missing.join('\n  ')}`
    );
    process.exit(1);
  }
  const fixture = syntheticGlb();
  for (const name of destNames()) fs.writeFileSync(path.join(DEST, name), fixture);
  console.log(
    `[populate-dev-assets] PASS (synthetic) — ${total} fixture GLBs in frontend/web/public/models-dev/ (no pipeline sources; viewer state-machine coverage only)`
  );
}

main();
