import type { AssetManifestEntry } from './assetManifest';

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

export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  return sha256HexBrowser(buffer);
}

export async function verifyAssetBuffer(
  buffer: ArrayBuffer,
  expectedSha256: string
): Promise<boolean> {
  const actual = await sha256Hex(buffer);
  return actual.toLowerCase() === expectedSha256.toLowerCase();
}

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
