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

// Frontend asset definitions moved to @anatomiax/anatomy-core (single source,
// reusable by mobile). Re-exported here so existing imports keep working.
export type {
  AnatomySystemAsset,
  AnatomySystemDefinition,
  AnatomyBodyModelDefinition,
} from '@anatomiax/anatomy-core';
