import { getAnatomySystem } from '../anatomyAssetConfig';
import { getAnatomyAsset } from '../anatomyAssets';
import {
  ANATOMY_BODY_MODELS,
  ANATOMY_SYSTEM_DEFINITIONS,
  getAnatomySystemAssetForBody,
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

  it('throws on unknown systems and keeps the legacy placeholder map', () => {
    expect(() => getAnatomySystem('bogus' as never)).toThrow('Unknown anatomy system');
    expect(getAnatomyAsset('male')?.available).toBe(false);
  });
});
