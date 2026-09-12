import * as fs from 'fs';
import * as path from 'path';
import { decodeModel, getMeshoptDecoder } from '../meshoptLoader';

// Resolves only where the gitignored dev asset exists; skips cleanly elsewhere.
const DEV_ASSET = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'frontend',
  'web',
  'public',
  'models-dev',
  'skin-meshopt.glb'
);

describe('production Meshopt loader (8.19.35)', () => {
  it('selects a working decoder on this runtime', async () => {
    const status = await getMeshoptDecoder();
    expect(status.supported).toBe(true);
    expect(['wasm', 'pure-js']).toContain(status.via);
  });

  it('falls back to pure-JS with WebAssembly hidden (Hermes simulation)', async () => {
    const host = globalThis as Record<string, unknown>;
    const realWasm = host.WebAssembly;
    try {
      host.WebAssembly = undefined;
      jest.resetModules();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fresh = require('../meshoptLoader') as typeof import('../meshoptLoader');
      const status = await fresh.getMeshoptDecoder();
      expect(status.hasWebAssembly).toBe(false);
      expect(status.supported).toBe(true);
      expect(status.via).toBe('pure-js');
    } finally {
      host.WebAssembly = realWasm;
      jest.resetModules();
    }
  });

  it('rejects undecodable bytes with an explicit error', async () => {
    await expect(decodeModel(new Uint8Array([1, 2, 3, 4]).buffer)).rejects.toThrow();
  });

  (fs.existsSync(DEV_ASSET) ? it : it.skip)(
    'decodes the real skin asset through the production path',
    async () => {
      const bytes = new Uint8Array(fs.readFileSync(DEV_ASSET)).buffer;
      const decoded = await decodeModel(bytes);
      expect(decoded.meshCount).toBe(1);
      expect(decoded.triangleCount).toBe(185314);
      expect(Number.isFinite(decoded.decodeMs)).toBe(true);
    },
    60000
  );
});
