export type AnatomyAssetType = 'body' | 'organ' | 'system' | 'pathology' | 'animation';

export interface AnatomyAsset {
  key: string;
  label: string;
  path: string;
  type: AnatomyAssetType;
  available: boolean;
}

export type AnatomyModelKey = 'male' | 'female';

export const anatomyAssets: Record<AnatomyModelKey, AnatomyAsset> = {
  male: {
    key: 'male',
    label: 'Male',
    path: '/models/male-body.glb',
    type: 'body',
    available: false,
  },
  female: {
    key: 'female',
    label: 'Female',
    path: '/models/female-body.glb',
    type: 'body',
    available: false,
  },
};

export const anatomyAssetList: AnatomyAsset[] = Object.values(anatomyAssets);

export function getAnatomyAsset(key: AnatomyModelKey): AnatomyAsset | undefined {
  return anatomyAssets[key];
}
