import { ASSET_MANIFEST } from '@anatomiax/anatomy-core';
import type { AnatomySystemKey } from '@anatomiax/shared-types';

/**
 * Initial production scope (8.19.35): male model only, one resident system at
 * a time, assets at or under 5MB, starting with skin. Female model, search,
 * compare, quiz 3D review, and labels are explicitly deferred.
 */
export const MAX_STAGE_BYTES = 5 * 1024 * 1024;

export interface SupportedStageSystem {
  system: AnatomySystemKey;
  file: string;
  bytes: number;
}

export const SUPPORTED_STAGE_SYSTEMS: readonly SupportedStageSystem[] = ASSET_MANIFEST.filter(
  entry => entry.bodyModel === 'male' && entry.bytes <= MAX_STAGE_BYTES
).map(entry => ({ system: entry.system, file: entry.file, bytes: entry.bytes }));

export const DEFAULT_STAGE_SYSTEM: AnatomySystemKey = 'skin';

export function isStageSupported(bodyModel: string, system: string): boolean {
  return bodyModel === 'male' && SUPPORTED_STAGE_SYSTEMS.some(entry => entry.system === system);
}
