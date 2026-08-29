import type { AnatomySystemAsset, AnatomySystemDefinition, AnatomySystemKey } from './anatomyTypes';

const ASSET_BASE_URL: string = (() => {
  try {
    // Vite provides import.meta.env at build/dev; Jest (CJS) does not support import.meta syntax.
    // Use indirection to avoid static parse error in ts-jest CJS transform.
    const metaEnv = Function('try{return import.meta?.env}catch(e){return undefined}')() as
      Record<string, string | undefined> | undefined;
    return metaEnv?.VITE_ANATOMY_ASSET_BASE_URL ?? '/models-dev/';
  } catch {
    return '/models-dev/';
  }
})();

function defineSystem(
  key: AnatomySystemKey,
  label: string,
  file: string,
  displayOrder: number
): AnatomySystemDefinition {
  const asset: AnatomySystemAsset = {
    key,
    label,
    type: key === 'skin' ? 'body' : 'system',
    path: `${ASSET_BASE_URL}${file}`,
    available: true,
  };
  return { key, label, asset, available: true, displayOrder };
}

/**
 * Canonical system metadata — single source of truth.
 * `asset.available` mirrors `available` for consumers that only inspect the asset.
 * All nine male systems are Meshopt-optimized and staged under /models-dev/ for local dev.
 */
export const ANATOMY_SYSTEM_DEFINITIONS: readonly AnatomySystemDefinition[] = [
  defineSystem('skin', 'Skin', 'skin-meshopt.glb', 0),
  defineSystem('musculoskeletal', 'Musculoskeletal', 'musculoskeletal-meshopt.glb', 1),
  defineSystem('nervous', 'Nervous', 'nervous-meshopt.glb', 2),
  defineSystem('cardiovascular', 'Cardiovascular', 'cardiovascular-meshopt.glb', 3),
  defineSystem('respiratory', 'Respiratory', 'respiratory-meshopt.glb', 4),
  defineSystem('digestive', 'Digestive', 'digestive-meshopt.glb', 5),
  defineSystem('urinary', 'Urinary', 'urinary-meshopt.glb', 6),
  defineSystem('reproductive', 'Reproductive', 'reproductive-meshopt.glb', 7),
  defineSystem('lymphatic', 'Lymphatic', 'lymphatic-meshopt.glb', 8),
];

export const ANATOMY_SYSTEMS_BY_KEY: Readonly<Record<AnatomySystemKey, AnatomySystemDefinition>> =
  Object.fromEntries(ANATOMY_SYSTEM_DEFINITIONS.map(d => [d.key, d])) as Record<
    AnatomySystemKey,
    AnatomySystemDefinition
  >;

export function getAnatomySystemDefinition(key: AnatomySystemKey): AnatomySystemDefinition {
  return ANATOMY_SYSTEMS_BY_KEY[key];
}

export function getAnatomySystemAsset(key: AnatomySystemKey): AnatomySystemAsset {
  return ANATOMY_SYSTEMS_BY_KEY[key].asset;
}
