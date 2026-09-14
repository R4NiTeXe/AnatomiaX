import type { AssetManifestEntry } from './assetManifest';

/**
 * Web-side integrity helper for anatomy GLBs — no dependencies.
 * Uses Web Crypto (crypto.subtle) in browsers and Node's crypto in scripts.
 * Not used by the viewer at runtime (would add fetch+hash overhead); provided
 * for production readiness checks and optional post-fetch verification.
 * Manifest SHA-256 is the source of truth; ETag/Cache-Control are HTTP-level.
 */

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256HexBrowser(buffer: ArrayBuffer): Promise<string> {
  const subtle = (globalThis as unknown as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
  if (!subtle) throw new Error('SubtleCrypto unavailable');
  const digest = await subtle.digest('SHA-256', buffer);
  return bytesToHex(new Uint8Array(digest));
}

/**
 * SHA-256 hex of an ArrayBuffer — browser only (SubtleCrypto).
 * For Node/production-readiness scripts, use Node's `crypto.createHash`.
 */
export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  return sha256HexBrowser(buffer);
}

/**
 * Verifies a buffer against the expected lowercase hex SHA-256.
 */
export async function verifyAssetBuffer(
  buffer: ArrayBuffer,
  expectedSha256: string
): Promise<boolean> {
  const actual = await sha256Hex(buffer);
  return actual.toLowerCase() === expectedSha256.toLowerCase();
}

/**
 * Verifies a manifest entry's URL via fetch + hash.
 * Prefer HEAD/ETag for prod checks; this does a full GET+hash only when needed.
 * Returns { ok, status, sha256, verified } — never throws for network errors.
 */
export async function verifyAssetUrl(
  url: string,
  entry: AssetManifestEntry,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<{ ok: boolean; status: number; sha256?: string; verified: boolean; error?: string }> {
  try {
    const res = await fetchImpl(url, { method: 'GET' });
    if (!res.ok)
      return { ok: false, status: res.status, verified: false, error: `HTTP ${res.status}` };
    const buf = await res.arrayBuffer();
    if (buf.byteLength !== entry.bytes) {
      return {
        ok: true,
        status: res.status,
        verified: false,
        error: `bytes ${buf.byteLength} != ${entry.bytes}`,
      };
    }
    const sha = await sha256Hex(buf);
    return {
      ok: true,
      status: res.status,
      sha256: sha,
      verified: sha.toLowerCase() === entry.sha256.toLowerCase(),
    };
  } catch (e) {
    return { ok: false, status: 0, verified: false, error: (e as Error).message };
  }
}
