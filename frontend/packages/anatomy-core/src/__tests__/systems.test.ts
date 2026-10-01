import { getAnatomySystem } from '../anatomyAssetConfig';
import { getAnatomyAsset } from '../anatomyAssets';
import {
  ANATOMY_BODY_MODELS,
  ANATOMY_SYSTEM_DEFINITIONS,
  getAnatomySystemAsset,
  getAnatomySystemAssetForBody,
  getAnatomySystemDefinition,
  getAnatomySystemDefinitionForBody,
  getBodyModelDefinition,
} from '../anatomySystems';

describe('anatomy systems catalog', () => {
  it('defines nine male systems with meshopt asset paths', () => {
    expect(ANATOMY_SYSTEM_DEFINITIONS).toHaveLength(9);
    expect(ANATOMY_SYSTEM_DEFINITIONS.map(d => d.key)).toContain('lymphatic');
    for (const d of ANATOMY_SYSTEM_DEFINITIONS) {
      expect(d.asset.path).toContain('-meshopt.glb');
      expect(d.available).toBe(true);
    }
  });

  it('defines both body models with per-body assets', () => {
    expect(Object.keys(ANATOMY_BODY_MODELS)).toEqual(['male', 'female']);
    expect(getBodyModelDefinition('female').systems.skin.path).toContain('female-skin-meshopt.glb');
    expect(getAnatomySystemDefinitionForBody('male', 'nervous').asset.path).toContain(
      'nervous-meshopt.glb'
    );
    expect(getAnatomySystemAssetForBody('female', 'nervous').path).toContain(
      'female-nervous-meshopt.glb'
    );
  });

  it('looks definitions and assets up by key', () => {
    expect(getAnatomySystemDefinition('skin').key).toBe('skin');
    expect(getAnatomySystemAsset('nervous').key).toBe('nervous');
    expect(() => getAnatomySystem('bogus' as never)).toThrow(/Unknown anatomy system/);
  });

  it('reads the configured asset base at module load', () => {
    process.env.VITE_ANATOMY_ASSET_BASE_URL = 'https://cdn.example/a/';
    try {
      let base: string | undefined;
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- isolateModules needs synchronous require for module reload; import cannot do this
        base = require('../anatomySystems').ASSET_BASE_URL as string;
      });
      expect(base).toBe('https://cdn.example/a/');
    } finally {
      delete process.env.VITE_ANATOMY_ASSET_BASE_URL;
    }
  });

  it.each([[''], ['   ']])('falls back to local mode for blank base %p', blank => {
    process.env.VITE_ANATOMY_ASSET_BASE_URL = blank;
    try {
      let base: string | undefined;
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- isolateModules needs synchronous require for module reload; import cannot do this
        base = require('../anatomySystems').ASSET_BASE_URL as string;
      });
      expect(base).toBe('/models-dev/');
    } finally {
      delete process.env.VITE_ANATOMY_ASSET_BASE_URL;
    }
  });

  it('preserves the exact legacy dev URLs from the manifest', () => {
    expect(getBodyModelDefinition('male').systems.skin.path).toBe('/models-dev/skin-meshopt.glb');
    expect(getBodyModelDefinition('female').systems.skin.path).toBe(
      '/models-dev/female-skin-meshopt.glb'
    );
    expect(getAnatomySystemAssetForBody('female', 'lymphatic').path).toBe(
      '/models-dev/female-lymphatic-meshopt.glb'
    );
  });

  it('throws on unknown systems and keeps the legacy placeholder map', () => {
    expect(() => getAnatomySystem('bogus' as never)).toThrow('Unknown anatomy system');
    expect(getAnatomyAsset('male')?.available).toBe(false);
  });
});
