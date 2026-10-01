import * as api from '../index';

describe('anatomy-core public surface', () => {
  it('re-exports the resolver, manifest, systems, registry, and integrity helpers', () => {
    for (const name of [
      'resolveAnatomyAssetUrl',
      'resolveAssetBase',
      'LOCAL_ASSET_BASE',
      'ASSET_MANIFEST',
      'buildAssetUrl',
      'verifyAssetBuffer',
      'verifyAssetUrl',
      'sha256Hex',
      'computeFocusDistance',
      'getAnatomySystemAssetForBody',
    ] as const) {
      expect((api as Record<string, unknown>)[name]).toBeDefined();
    }
  });
});
