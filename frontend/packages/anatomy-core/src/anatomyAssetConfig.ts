/**
 * @deprecated Import from '@anatomiax/anatomy-core' directly.
 * Kept for backward compatibility — canonical definitions live in `anatomySystems.ts`.
 */
import { ANATOMY_SYSTEM_DEFINITIONS } from './anatomySystems';
import type { AnatomySystemAsset } from './anatomySystems';
import type { AnatomySystemKey } from '@anatomiax/shared-types';

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
