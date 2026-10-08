async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node scripts/verify-model-url.js <model-url>');
    process.exitCode = 2;
    return;
  }
  let res;
  try {
    res = await fetch(url, { redirect: 'manual' });
  } catch (err) {
    console.error(
      `[verify-model-url] FAIL: fetch failed: ${err instanceof Error ? err.message : err}`
    );
    process.exitCode = 2;
    return;
  }
  const failures = [];
  if (res.status !== 200) failures.push(`status ${res.status} (expected 200)`);
  const contentType = res.headers.get('content-type') ?? '';
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024) failures.push(`body ${buf.length} bytes (expected > 1024)`);
  if (buf.includes('<!doctype'))
    failures.push('body contains <!doctype html> (SPA fallback, not a model)');
  const magic = buf.subarray(0, 4).toString('utf8');
  if (magic !== 'glTF') failures.push(`magic ${JSON.stringify(magic)} (expected "glTF")`);
  if (!/^model\//i.test(contentType)) {
    console.log(
      `[verify-model-url] WARN: Content-Type is ${JSON.stringify(contentType)} (prefer model/gltf-binary)`
    );
  }
  if (failures.length > 0) {
    console.error(`[verify-model-url] FAIL ${url}`);
    for (const f of failures) console.error(`[verify-model-url] FAIL: ${f}`);
    process.exitCode = 1;
    return;
  }
  console.log(`[verify-model-url] PASS ${url} (${buf.length} bytes, GLB magic ok)`);
}

void main();
