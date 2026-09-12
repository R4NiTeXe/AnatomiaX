import { findManifestEntry } from '@anatomiax/anatomy-core';
import { fetchVerifiedAsset, type AssetFetch, type AssetFiles } from '../assetCache';

// Native FS is never touched here: every test injects in-memory fakes.
jest.mock('expo-file-system', () => ({
  File: class {},
  Paths: { cache: 'mock-cache' },
}));

// expo-crypto is native-only; hashing is always injected, so a stub suffices.
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digest: async () => new ArrayBuffer(32),
}));

const skin = findManifestEntry('male', 'skin');
if (!skin) throw new Error('manifest test fixture missing');

const GOOD_BYTES = new Uint8Array(skin.bytes).map((_, i) => i % 251);
const CORRUPT_BYTES = new Uint8Array(skin.bytes).map((_, i) => (i * 7 + 1) % 251);

function makeFiles(initial: Record<string, Uint8Array> = {}) {
  const store = new Map<string, Uint8Array>(Object.entries(initial));
  const calls = { read: 0, removed: [] as string[], written: [] as string[] };
  const files: AssetFiles = {
    readCache: jest.fn(async (name: string) => {
      calls.read += 1;
      const hit = store.get(name);
      return hit ? new Uint8Array(hit) : null;
    }),
    removeCache: jest.fn((name: string) => {
      calls.removed.push(name);
      store.delete(name);
    }),
    writeCache: jest.fn((name: string, bytes: Uint8Array) => {
      calls.written.push(name);
      store.set(name, new Uint8Array(bytes));
    }),
  };
  return { files, calls, store };
}

const okFetch = (bytes: Uint8Array): AssetFetch =>
  jest.fn(async () => ({
    ok: true,
    status: 200,
    arrayBuffer: async () => bytes.buffer as ArrayBuffer,
  })) as unknown as AssetFetch;

// Accepts exactly the good fixture, rejects everything else.
const stubHasher = async (bytes: Uint8Array): Promise<string> =>
  bytes.byteLength === GOOD_BYTES.byteLength && bytes.every((v, i) => v === GOOD_BYTES[i])
    ? skin.sha256
    : 'f'.repeat(64);

describe('mobile verified asset cache (8.19.34)', () => {
  beforeEach(() => {
    delete (process.env as Record<string, string | undefined>).EXPO_PUBLIC_ANATOMY_ASSET_BASE_URL;
  });

  it('serves a verified cache hit without fetching', async () => {
    const { files } = makeFiles({ 'skin-meshopt.glb': GOOD_BYTES });
    const fetchImpl = okFetch(GOOD_BYTES);
    const out = await fetchVerifiedAsset(skin, { files, fetchImpl, hasher: stubHasher });
    expect(out).toEqual(GOOD_BYTES);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('purges corrupt cache entries and re-downloads', async () => {
    const { files, calls } = makeFiles({ 'skin-meshopt.glb': CORRUPT_BYTES });
    const out = await fetchVerifiedAsset(skin, {
      files,
      fetchImpl: okFetch(GOOD_BYTES),
      hasher: stubHasher,
    });
    expect(out).toEqual(GOOD_BYTES);
    expect(calls.removed).toEqual(['skin-meshopt.glb']);
    expect(calls.written).toEqual(['skin-meshopt.glb']);
  });

  it('rejects mismatched downloads without caching anything', async () => {
    const { files, calls } = makeFiles();
    await expect(
      fetchVerifiedAsset(skin, { files, fetchImpl: okFetch(CORRUPT_BYTES), hasher: stubHasher })
    ).rejects.toThrow('integrity check failed');
    expect(calls.written).toEqual([]);
  });

  it('rejects size mismatches and HTTP failures', async () => {
    const { files } = makeFiles();
    await expect(
      fetchVerifiedAsset(skin, {
        files,
        fetchImpl: okFetch(new Uint8Array([1, 2, 3])),
        hasher: stubHasher,
      })
    ).rejects.toThrow('size mismatch');
    const failing: AssetFetch = jest.fn(async () => ({
      ok: false,
      status: 404,
      arrayBuffer: async () => new ArrayBuffer(0),
    })) as unknown as AssetFetch;
    await expect(
      fetchVerifiedAsset(skin, { files, fetchImpl: failing, hasher: stubHasher })
    ).rejects.toThrow('HTTP 404');
  });
});
