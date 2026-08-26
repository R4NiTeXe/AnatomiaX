export type AnatomySystemKey =
  | 'skin'
  | 'musculoskeletal'
  | 'nervous'
  | 'cardiovascular'
  | 'respiratory'
  | 'digestive'
  | 'urinary'
  | 'reproductive'
  | 'lymphatic';

export type AnatomySystemType = 'body' | 'system';

export interface AnatomySystemAsset {
  key: AnatomySystemKey;
  label: string;
  type: AnatomySystemType;
  path: string;
  available: boolean;
}

/**
 * Public, non-secret asset location. Override per environment with
 * VITE_ANATOMY_ASSET_BASE_URL (local dev default serves the temporary,
 * git-ignored copies from frontend/web/public/models-dev/). In production
 * this will point at object storage / CDN URLs instead.
 */
const ASSET_BASE_URL: string = import.meta.env.VITE_ANATOMY_ASSET_BASE_URL ?? '/models-dev/';

function asset(
  key: AnatomySystemKey,
  label: string,
  file: string,
  available: boolean
): AnatomySystemAsset {
  return {
    key,
    label,
    type: key === 'skin' ? 'body' : 'system',
    path: `${ASSET_BASE_URL}${file}`,
    available,
  };
}

/**
 * Male anatomy assets (NIH/HRA reference organ set, Meshopt-optimized).
 * `available` is only true when the actual local development file has been
 * staged into the configured asset directory (verified in Step 8.9:
 * all nine optimized GLBs exist under /models-dev/).
 */
export const maleAnatomyAssets: readonly AnatomySystemAsset[] = [
  asset('skin', 'Skin', 'skin-meshopt.glb', true),
  asset('musculoskeletal', 'Musculoskeletal', 'musculoskeletal-meshopt.glb', true),
  asset('nervous', 'Nervous', 'nervous-meshopt.glb', true),
  asset('cardiovascular', 'Cardiovascular', 'cardiovascular-meshopt.glb', true),
  asset('respiratory', 'Respiratory', 'respiratory-meshopt.glb', true),
  asset('digestive', 'Digestive', 'digestive-meshopt.glb', true),
  asset('urinary', 'Urinary', 'urinary-meshopt.glb', true),
  asset('reproductive', 'Reproductive', 'reproductive-meshopt.glb', true),
  asset('lymphatic', 'Lymphatic', 'lymphatic-meshopt.glb', true),
];

export const initialVisibleSystems: Record<AnatomySystemKey, boolean> = {
  skin: true,
  musculoskeletal: false,
  nervous: false,
  cardiovascular: false,
  respiratory: false,
  digestive: false,
  urinary: false,
  reproductive: false,
  lymphatic: false,
};

export function getAnatomySystem(key: AnatomySystemKey): AnatomySystemAsset {
  return maleAnatomyAssets.find(a => a.key === key) as AnatomySystemAsset;
}
