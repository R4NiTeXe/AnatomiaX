import * as nodeCrypto from 'crypto';
import { sha256Hex, verifyAssetBytes } from '../assetIntegrity';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digest: async (_algorithm: string, data: Uint8Array) => {
    const hash = nodeCrypto.createHash('sha256');
    hash.update(data);
    return hash.digest().buffer as ArrayBuffer;
  },
}));

const NIST_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

describe('mobile asset integrity (8.19.34)', () => {
  it('hashes the NIST SHA-256 vector through the native digest path', async () => {
    const bytes = new TextEncoder().encode('abc');
    await expect(sha256Hex(bytes)).resolves.toBe(NIST_ABC);
  });

  it('accepts matching digests case-insensitively and rejects the rest', async () => {
    const bytes = new TextEncoder().encode('abc');
    await expect(verifyAssetBytes(bytes, NIST_ABC)).resolves.toBe(true);
    await expect(verifyAssetBytes(bytes, NIST_ABC.toUpperCase())).resolves.toBe(true);
    await expect(verifyAssetBytes(bytes, '0'.repeat(64))).resolves.toBe(false);
    await expect(verifyAssetBytes(bytes, 'not-a-hash')).resolves.toBe(false);
    await expect(verifyAssetBytes(bytes, '')).resolves.toBe(false);
  });
});
