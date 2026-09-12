import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { ASSET_MANIFEST, devAssetFilename, findManifestEntry } from '../assetManifest';

const SYSTEMS = [
  'skin',
  'musculoskeletal',
  'nervous',
  'cardiovascular',
  'respiratory',
  'digestive',
  'urinary',
  'reproductive',
  'lymphatic',
] as const;

describe('asset manifest', () => {
  it('covers every production body system exactly once', () => {
    expect(ASSET_MANIFEST).toHaveLength(18);
    const keys = ASSET_MANIFEST.map(e => `${e.bodyModel}/${e.system}`);
    expect(new Set(keys).size).toBe(18);
    for (const bodyModel of ['male', 'female'] as const) {
      for (const system of SYSTEMS) {
        expect(findManifestEntry(bodyModel, system)).toBeDefined();
      }
    }
    expect(findManifestEntry('male', 'bogus' as never)).toBeUndefined();
  });

  it('holds well-formed production identities', () => {
    for (const entry of ASSET_MANIFEST) {
      expect(entry.file).toBe(`${entry.system}-meshopt.glb`);
      expect(entry.bytes).toBeGreaterThan(0);
      expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('maps the local-dev flat layout without touching production names', () => {
    expect(devAssetFilename('male', 'skin-meshopt.glb')).toBe('skin-meshopt.glb');
    expect(devAssetFilename('female', 'skin-meshopt.glb')).toBe('female-skin-meshopt.glb');
    expect(devAssetFilename('female', 'nervous-meshopt.glb')).toBe('female-nervous-meshopt.glb');
  });
});

// Recomputes size + SHA-256 of every optimized GLB and compares to the
// committed manifest. Skips cleanly where the gitignored asset dirs are absent.
const OPTIMIZED_ROOT = path.join(__dirname, '..', '..', '..', '..', '..', '3d-assets');

describe('asset manifest file verification', () => {
  const missing = ['male', 'female'].filter(
    body => !fs.existsSync(path.join(OPTIMIZED_ROOT, body, 'working', 'optimized'))
  );

  if (missing.length > 0) {
    it.skip(`optimized asset dirs absent (${missing.join(', ')})`, () => undefined);
    return;
  }

  it('matches actual file bytes and hashes', () => {
    for (const entry of ASSET_MANIFEST) {
      const filePath = path.join(
        OPTIMIZED_ROOT,
        entry.bodyModel,
        'working',
        'optimized',
        entry.file
      );
      expect(fs.existsSync(filePath)).toBe(true);
      const data = fs.readFileSync(filePath);
      expect(data.byteLength).toBe(entry.bytes);
      expect(crypto.createHash('sha256').update(data).digest('hex')).toBe(entry.sha256);
    }
  }, 120000);
});
