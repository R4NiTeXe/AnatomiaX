/**
 * @deprecated Import from './anatomySystems' / './anatomyTypes' directly.
 * Kept for backward compatibility — canonical definitions live in `anatomySystems.ts`.
 */
export type { AnatomySystemKey, AnatomySystemType, AnatomySystemAsset } from './anatomyTypes';
export type { AnatomySystemDefinition } from './anatomyTypes';

import { ANATOMY_SYSTEM_DEFINITIONS } from './anatomySystems';
import type { AnatomySystemKey, AnatomySystemAsset } from './anatomyTypes';

export const maleAnatomyAssets: readonly AnatomySystemAsset[] = ANATOMY_SYSTEM_DEFINITIONS.map(
  d => d.asset
);

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
  const found = ANATOMY_SYSTEM_DEFINITIONS.find(d => d.key === key);
  if (!found) throw new Error(`Unknown anatomy system: ${key}`);
  return found.asset;
}
