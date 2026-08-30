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

export interface AnatomySystemDefinition {
  key: AnatomySystemKey;
  label: string;
  asset: AnatomySystemAsset;
  available: boolean;
  displayOrder: number;
}

export type AnatomyBodyModelKey = 'male' | 'female';

export interface AnatomyBodyModelDefinition {
  key: AnatomyBodyModelKey;
  label: string;
  systems: Record<AnatomySystemKey, AnatomySystemAsset>;
  available: boolean;
}

/**
 * Canonical runtime representation of an anatomical structure derived from
 * the loaded GLB. `id` and `structureKey` are identical — the stable
 * identifier for highlight / AI mapping. Prefer ontology-derived keys.
 */
export interface AnatomyStructure {
  /** Stable key: `${systemKey}:${ontologyId}` or fallback `${systemKey}:object:${objectName}` — body-model-qualified when needed */
  id: string;
  structureKey: string;
  name: string;
  objectName: string;
  systemKey: AnatomySystemKey;
  /** Body model that owns this structure — defaults to male when omitted for backward compat */
  bodyModel: AnatomyBodyModelKey;
  ontologyId: string | null;
  /**
   * Fallback lineage: verified node/mesh names encountered while walking
   * up the scene graph (closest first). Preserved for debugging duplicate handling.
   */
  lineage: string[];
}

export interface AnatomySelection {
  structureKey: string;
  name: string;
  objectName: string;
  systemKey: AnatomySystemKey;
  bodyModel: AnatomyBodyModelKey;
  ontologyId: string | null;
}
