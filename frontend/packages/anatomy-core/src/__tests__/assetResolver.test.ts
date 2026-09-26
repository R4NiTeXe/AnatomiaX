import {
  LOCAL_ASSET_BASE,
  resolveAllAnatomyAssetUrls,
  resolveAnatomyAsset,
  resolveAnatomyAssetUrl,
  resolveAssetBase,
} from '../assetResolver';
import { ASSET_MANIFEST } from '../assetManifest';
import { getAnatomySystemAssetForBody } from '../anatomySystems';

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

describe('asset resolver (8.54)', () => {
  it('defaults to local mode with no configuration', () => {
    expect(LOCAL_ASSET_BASE).toBe('/models-dev/');
    expect(resolveAssetBase(undefined)).toBe('/models-dev/');
    expect(resolveAssetBase(null)).toBe('/models-dev/');
    expect(resolveAssetBase('   ')).toBe('/models-dev/');
    expect(resolveAnatomyAssetUrl('male', 'skin')).toBe('/models-dev/skin-meshopt.glb');
    expect(resolveAnatomyAssetUrl('female', 'nervous')).toBe(
      '/models-dev/female-nervous-meshopt.glb'
    );
  });

  it('normalizes CDN bases (trailing slash, no double slashes)', () => {
    expect(resolveAssetBase('https://assets.example/anatomy')).toBe(
      'https://assets.example/anatomy/'
    );
    expect(resolveAssetBase('https://assets.example/anatomy/')).toBe(
      'https://assets.example/anatomy/'
    );
    const url = resolveAnatomyAssetUrl('male', 'skin', 'https://assets.example/anatomy');
    expect(url).toBe('https://assets.example/anatomy/male/skin-meshopt.glb');
    expect(url).not.toContain('anatomy//');
  });

  it('supports versioned base prefixes for immutable deployments', () => {
    expect(
      resolveAnatomyAssetUrl('female', 'nervous', 'https://cdn.example/static/anatomy/v1/')
    ).toBe('https://cdn.example/static/anatomy/v1/female/nervous-meshopt.glb');
  });

  it('allows localhost http for development tooling', () => {
    expect(resolveAnatomyAssetUrl('male', 'skin', 'http://localhost:8080/assets')).toBe(
      'http://localhost:8080/assets/male/skin-meshopt.glb'
    );
  });

  it('fails clearly on malformed or insecure bases', () => {
    expect(() => resolveAssetBase('notaurl')).toThrow(/expected a path/i);
    expect(() => resolveAssetBase('ftp://files.example/a')).toThrow(/expected a path/i);
    expect(() => resolveAssetBase('http://example.com/assets')).toThrow(/must be https/i);
    expect(() => resolveAnatomyAssetUrl('male', 'skin', 'notaurl')).toThrow();
  });

  it('resolves every current model key to a valid unique URL', () => {
    const urls = new Set<string>();
    for (const bodyModel of ['male', 'female'] as const) {
      for (const system of SYSTEMS) {
        const url = resolveAnatomyAssetUrl(bodyModel, system);
        expect(url).toMatch(/\.glb$/);
        expect(() => new URL(url, 'http://local.test')).not.toThrow();
        urls.add(url);
      }
    }
    expect(urls.size).toBe(18);
    expect(resolveAllAnatomyAssetUrls()).toHaveLength(18);
  });

  it('resolves every key under a CDN base without the dev prefix', () => {
    const base = 'https://assets.example/anatomy/';
    for (const entry of ASSET_MANIFEST) {
      const url = resolveAnatomyAssetUrl(entry.bodyModel, entry.system, base);
      expect(url).toBe(`${base}${entry.bodyModel}/${entry.file}`);
    }
  });

  it('rejects unknown assets loudly', () => {
    expect(() => resolveAnatomyAssetUrl('male', 'bogus' as never)).toThrow(/no manifest entry/);
  });

  it('exposes manifest integrity metadata with the resolution', () => {
    const resolved = resolveAnatomyAsset('female', 'nervous', 'https://assets.example/a/');
    expect(resolved.bytes).toBeGreaterThan(0);
    expect(resolved.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(resolved.versionedUrl).toMatch(
      new RegExp(
        `^https://assets\\.example/a/female/nervous-meshopt\\.glb\\?v=${resolved.sha256.slice(0, 8)}$`
      )
    );
  });

  it('matches the baked loader paths (manifest → resolver → loader contract)', () => {
    for (const bodyModel of ['male', 'female'] as const) {
      for (const system of SYSTEMS) {
        expect(resolveAnatomyAssetUrl(bodyModel, system)).toBe(
          getAnatomySystemAssetForBody(bodyModel, system).path
        );
      }
    }
  });
});
