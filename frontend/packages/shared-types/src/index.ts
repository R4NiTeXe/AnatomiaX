// AnatomiaX — Canonical shared domain types (frontend + backend)
// No runtime dependencies. Serializable only. No Three.js, React, registry logic.

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

export type AnatomyBodyModelKey = 'male' | 'female';

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

/** Legacy alias — prefer AnatomySelection */
export type SelectedStructure = AnatomySelection;

export interface AnatomySearchResult {
  structureKey: string;
  bodyModel: AnatomyBodyModelKey;
  systemKey: AnatomySystemKey;
  name: string;
  objectName: string;
  ontologyId: string | null;
}

export interface AnatomySearchOptions {
  bodyModel?: AnatomyBodyModelKey | 'all';
  systemKey?: AnatomySystemKey | 'all';
  limit?: number;
}

// ---------------------------------------------------------------------------
// Information model — deterministic source of truth, no AI generation
// ---------------------------------------------------------------------------

export type AnatomyInformationSourceCategory =
  'Human Reference Atlas' | 'NIH' | 'FMA' | 'Uberon' | 'authoritative anatomy reference';

export interface AnatomyInformationProvenance {
  /** Human-readable source name, e.g., "Human Reference Atlas" or "NIH MedlinePlus" */
  source: AnatomyInformationSourceCategory | string;
  /** URL to the verified source record */
  sourceUrl: string;
  /** ISO date YYYY-MM-DD of last verification */
  lastVerified: string;
  /** Short license/attribution string, e.g., "CC BY 4.0" or "Public domain" */
  license?: string;
}

/**
 * Verified anatomy information linked to the existing identity:
 * `bodyModel + structureKey (+ ontologyId when available)`.
 * `structureKey` is the primary key and already bodyModel-qualified
 * (`${bodyModel}:${systemKey}:${ontologyId}`), so male/female with the same
 * ontology never collide.
 */
export interface AnatomyInformation extends AnatomyInformationProvenance {
  /** Primary key — bodyModel-qualified, e.g., "male:skin:UBERON:0002097" */
  structureKey: string;
  bodyModel: AnatomyBodyModelKey;
  systemKey: AnatomySystemKey;
  /** Verified ontologyId when available (preserved from `AnatomyStructure`) */
  ontologyId: string | null;
  /** Canonical human-readable name for display */
  canonicalName: string;
  /** Concise factual summary (not long copyrighted text) */
  description: string;
  /** Brief function summary */
  function: string;
  /**
   * Explicitly verified outgoing relationships to other records.
   * Same-bodyModel targets only; validated by tests (target exists, no self-links, no duplicates).
   */
  relatedStructures?: readonly AnatomyRelatedStructure[];
}

export type AnatomyRelationKind = 'part_of' | 'related_to';

export interface AnatomyRelatedStructure {
  /** Target primary key — bodyModel-qualified, must exist in the same bodyModel */
  structureKey: string;
  relation: AnatomyRelationKind;
}

// ---------------------------------------------------------------------------
// Quiz — serializable DTO, no React state, no functions
// ---------------------------------------------------------------------------

export interface AnatomyQuizQuestion {
  id: string;
  canonicalName: string;
  bodyModel: AnatomyBodyModelKey;
  systemKey: AnatomySystemKey;
  ontologyId: string | null;
  structureKey: string;
  question: string;
  choices: string[];
  correctIndex: number;
}
