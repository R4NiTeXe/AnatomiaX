// Canonical serializable types — single source in @anatomiax/shared-types.
// This file re-exports for backward compatibility so existing `from './anatomyTypes'` imports keep working.
export type {
  AnatomySystemKey,
  AnatomySystemType,
  AnatomyBodyModelKey,
  AnatomyStructure,
  AnatomySelection,
  SelectedStructure,
  AnatomySearchResult,
  AnatomySearchOptions,
} from '@anatomiax/shared-types';

import type {
  AnatomyBodyModelKey,
  AnatomySystemKey,
  AnatomySystemType,
} from '@anatomiax/shared-types';

// Frontend-specific asset definitions (paths/availability) — not shared with backend.
export interface AnatomySystemAsset {
  key: AnatomySystemKey;
  label: string;
  type: AnatomySystemType;
  path: string;
  available: boolean;
}

export interface AnatomySystemDefinition {
  key: AnatomySystemKey;
  label: string;
  asset: AnatomySystemAsset;
  available: boolean;
  displayOrder: number;
}

export interface AnatomyBodyModelDefinition {
  key: AnatomyBodyModelKey;
  label: string;
  systems: Record<AnatomySystemKey, AnatomySystemAsset>;
  available: boolean;
}
