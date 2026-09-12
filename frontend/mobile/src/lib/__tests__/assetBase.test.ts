import { ASSET_MANIFEST, findManifestEntry } from '@anatomiax/anatomy-core';
import {
  cacheFileName,
  getAnatomyAssetBaseUrl,
  resolveDevAssetUrl,
  resolveHostedAssetUrl,
} from '../assetBase';

describe('mobile asset base (8.19.34)', () => {
  const originalEnv = process.env.EXPO_PUBLIC_ANATOMY_ASSET_BASE_URL;

  afterEach(() => {
    if (originalEnv === undefined)
      delete (process.env as Record<string, string | undefined>).EXPO_PUBLIC_ANATOMY_ASSET_BASE_URL;
    else process.env.EXPO_PUBLIC_ANATOMY_ASSET_BASE_URL = originalEnv;
  });

  it('defaults to the dev server loopback and trims slashes', () => {
    delete (process.env as Record<string, string | undefined>).EXPO_PUBLIC_ANATOMY_ASSET_BASE_URL;
    expect(getAnatomyAssetBaseUrl()).toBe('http://10.0.2.2:5173/models-dev');
    process.env.EXPO_PUBLIC_ANATOMY_ASSET_BASE_URL = 'https://cdn.example.com/a///';
    expect(getAnatomyAssetBaseUrl()).toBe('https://cdn.example.com/a');
  });

  it('resolves the same dev identities web serves today', () => {
    delete (process.env as Record<string, string | undefined>).EXPO_PUBLIC_ANATOMY_ASSET_BASE_URL;
    expect(resolveDevAssetUrl({ bodyModel: 'male', file: 'skin-meshopt.glb' })).toBe(
      'http://10.0.2.2:5173/models-dev/skin-meshopt.glb'
    );
    expect(resolveDevAssetUrl({ bodyModel: 'female', file: 'skin-meshopt.glb' })).toBe(
      'http://10.0.2.2:5173/models-dev/female-skin-meshopt.glb'
    );
  });

  it('resolves production layout per body directory on any host', () => {
    expect(
      resolveHostedAssetUrl('https://cdn.example.com/anatomy/', {
        bodyModel: 'female',
        file: 'nervous-meshopt.glb',
      })
    ).toBe('https://cdn.example.com/anatomy/female/nervous-meshopt.glb');
  });

  it('derives unique cache names for all 18 canonical entries', () => {
    const names = ASSET_MANIFEST.map(cacheFileName);
    expect(new Set(names).size).toBe(18);
    expect(findManifestEntry('male', 'skin')).toBeDefined();
  });
});
