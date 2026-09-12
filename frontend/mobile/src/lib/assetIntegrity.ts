import * as Crypto from 'expo-crypto';

/**
 * 8.19.34 client-side SHA-256 integrity for anatomy downloads.
 * Native hashing via expo-crypto (works on Hermes — no WebCrypto needed).
 * The default hasher is injectable so unit tests run without native modules.
 */

export type ByteHasher = (bytes: Uint8Array) => Promise<string>;

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
  return bytesToHex(new Uint8Array(digest));
}

/** True when the bytes hash to the manifest digest (hex, case-insensitive). */
export async function verifyAssetBytes(
  bytes: Uint8Array,
  expectedSha256: string,
  hasher: ByteHasher = sha256Hex
): Promise<boolean> {
  if (!expectedSha256 || !/^[0-9a-fA-F]{64}$/.test(expectedSha256)) return false;
  const actual = await hasher(bytes);
  return actual.toLowerCase() === expectedSha256.toLowerCase();
}
