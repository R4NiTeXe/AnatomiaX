import { sha256Hex, verifyAssetBuffer, verifyAssetUrl } from '../assetIntegrity';
import type { AssetManifestEntry } from '../assetManifest';

function bytesOf(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

function entryFor(buf: ArrayBuffer, sha256: string): AssetManifestEntry {
  return {
    bodyModel: 'male',
    system: 'skin',
    file: 'skin-meshopt.glb',
    bytes: buf.byteLength,
    sha256,
  } as AssetManifestEntry;
}

describe('assetIntegrity', () => {
  it('throws a clear error without SubtleCrypto', async () => {
    const cryptoHolder = globalThis as unknown as { crypto?: unknown };
    const realCrypto = cryptoHolder.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      await expect(sha256Hex(bytesOf('x'))).rejects.toThrow('SubtleCrypto unavailable');
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: realCrypto, configurable: true });
    }
  });

  it('hashes buffers with SHA-256 (empty + known vector)', async () => {
    expect(await sha256Hex(bytesOf(''))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
    expect(await sha256Hex(bytesOf('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  it('verifies buffers case-insensitively', async () => {
    const buf = bytesOf('glb-bytes');
    const sha = await sha256Hex(buf);
    expect(await verifyAssetBuffer(buf, sha)).toBe(true);
    expect(await verifyAssetBuffer(buf, sha.toUpperCase())).toBe(true);
    expect(await verifyAssetBuffer(buf, '0'.repeat(64))).toBe(false);
  });

  it('verifies URLs with matching bytes and hash', async () => {
    const buf = bytesOf('glb-bytes');
    const sha = await sha256Hex(buf);
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => buf,
    });
    const out = await verifyAssetUrl(
      'https://cdn.example/a/male/skin-meshopt.glb',
      entryFor(buf, sha),
      fetchImpl as unknown as typeof fetch
    );
    expect(out).toMatchObject({ ok: true, status: 200, verified: true, sha256: sha });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://cdn.example/a/male/skin-meshopt.glb',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('reports HTTP failures without throwing', async () => {
    const buf = bytesOf('x');
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 404 });
    const out = await verifyAssetUrl(
      'https://cdn.example/a/missing.glb',
      entryFor(buf, '0'.repeat(64)),
      fetchImpl as unknown as typeof fetch
    );
    expect(out).toMatchObject({ ok: false, status: 404, verified: false });
  });

  it('reports byte mismatches and hash mismatches separately', async () => {
    const buf = bytesOf('glb-bytes');
    const okFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => buf,
    });
    const shortEntry = { ...entryFor(buf, await sha256Hex(buf)), bytes: 1 };
    const short = await verifyAssetUrl(
      'https://cdn.example/a/male/skin-meshopt.glb',
      shortEntry,
      okFetch as unknown as typeof fetch
    );
    expect(short.verified).toBe(false);
    expect(short.error).toMatch(/bytes/);
    const wrongHash = await verifyAssetUrl(
      'https://cdn.example/a/male/skin-meshopt.glb',
      entryFor(buf, 'f'.repeat(64)),
      okFetch as unknown as typeof fetch
    );
    expect(wrongHash).toMatchObject({ ok: true, verified: false });
    expect(wrongHash.sha256).toBe(await sha256Hex(buf));
  });

  it('never throws for network errors', async () => {
    const buf = bytesOf('x');
    const failing = jest.fn().mockRejectedValue(new Error('offline'));
    const out = await verifyAssetUrl(
      'https://cdn.example/a/male/skin-meshopt.glb',
      entryFor(buf, '0'.repeat(64)),
      failing as unknown as typeof fetch
    );
    expect(out).toMatchObject({ ok: false, status: 0, verified: false, error: 'offline' });
  });
});
