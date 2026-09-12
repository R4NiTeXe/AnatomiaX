import { File, Paths } from 'expo-file-system';
import type { AssetManifestEntry } from '@anatomiax/anatomy-core';
import { cacheFileName, resolveDevAssetUrl } from './assetBase';
import { verifyAssetBytes, type ByteHasher } from './assetIntegrity';

/**
 * 8.19.34 verified on-device asset cache. Assets stay OUTSIDE the app binary:
 * download → verify SHA-256 against the canonical manifest → cache, otherwise
 * reject and purge so a corrupt file can never be rendered or linger.
 */

export interface AssetFiles {
  readCache(name: string): Promise<Uint8Array | null>;
  removeCache(name: string): void;
  writeCache(name: string, bytes: Uint8Array): void;
}

export interface AssetFetch {
  (url: string): Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;
}

function cacheFile(name: string): File {
  return new File(Paths.cache, name);
}

export const expoAssetFiles: AssetFiles = {
  async readCache(name: string): Promise<Uint8Array | null> {
    const file = cacheFile(name);
    if (!file.exists) return null;
    return file.bytes();
  },
  removeCache(name: string): void {
    try {
      cacheFile(name).delete();
    } catch {
      // Purge is best-effort; a missing file deletes to nothing.
    }
  },
  writeCache(name: string, bytes: Uint8Array): void {
    cacheFile(name).write(bytes);
  },
};

const defaultFetch: AssetFetch = (url: string) =>
  fetch(url) as unknown as Promise<{
    ok: boolean;
    status: number;
    arrayBuffer(): Promise<ArrayBuffer>;
  }>;

/**
 * Returns verified asset bytes, using the cache when its content matches the
 * manifest. Stale/corrupt cache entries are purged and re-downloaded;
 * mismatched downloads are rejected WITHOUT caching. Throws on any failure.
 */
export async function fetchVerifiedAsset(
  entry: Pick<AssetManifestEntry, 'bodyModel' | 'file' | 'bytes' | 'sha256'>,
  options?: {
    files?: AssetFiles;
    fetchImpl?: AssetFetch;
    hasher?: ByteHasher;
  }
): Promise<Uint8Array> {
  const files = options?.files ?? expoAssetFiles;
  const fetchImpl = options?.fetchImpl ?? defaultFetch;
  const name = cacheFileName(entry);

  const cached = await files.readCache(name).catch(() => null);
  if (cached && cached.byteLength === entry.bytes) {
    if (await verifyAssetBytes(cached, entry.sha256, options?.hasher)) return cached;
    files.removeCache(name);
  } else if (cached) {
    files.removeCache(name);
  }

  const url = resolveDevAssetUrl(entry);
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Asset download failed (HTTP ${response.status}) for ${name}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength !== entry.bytes) {
    throw new Error(`Asset size mismatch for ${name}; rejected without caching`);
  }
  if (!(await verifyAssetBytes(bytes, entry.sha256, options?.hasher))) {
    throw new Error(`Asset integrity check failed for ${name}; rejected without caching`);
  }
  files.writeCache(name, bytes);
  return bytes;
}
