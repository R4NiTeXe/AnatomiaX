# Anatomy Search Architecture

## Purpose

Provides a deterministic, loaded-only search index over `AnatomyStructure` objects currently registered in `AnatomyStructureRegistry`. Used as the foundation for organ search, system filtering, and future AI-driven structure highlighting. No medical information is invented; search only returns structures that have been loaded from verified GLB assets.

## Source of Truth

`AnatomyStructureRegistry` is the single source of truth. The search index does not duplicate full structure records; it references the registry's `Map<string, AnatomyStructure>` and `getAllLoadedStructures()` to build a transient scored list per query. No second copy of anatomy data is maintained.

## Loaded-Only Behavior

Search operates only on `registry.getAllLoadedStructures()`. If a system has never been loaded (e.g., `cardiovascular` not yet requested), its structures are absent from the index and will not be returned. This keeps startup cheap (initial `skin` only → 1 structure) and ensures search does not trigger GLB downloads. Documented in `searchStructures` JSDoc.

## Result Type

`AnatomySearchResult` (in `anatomyTypes.ts`) reuses fields from `AnatomyStructure` without duplicating the full record:

- `structureKey: string` — body-model-qualified stable key (`male:skin:UBERON:0002097`)
- `bodyModel: AnatomyBodyModelKey`
- `systemKey: AnatomySystemKey`
- `name: string` — verified `objectName`/`name`
- `objectName: string`
- `ontologyId: string | null`

Existing `AnatomyStructure` is used where a full record is needed; `AnatomySearchResult` is a lightweight projection for UI and AI.

## Normalization

`normalizeQuery(query: string): string` is deterministic:

- `toLowerCase()`
- `trim()`
- Collapse repeated whitespace: `/\s+/g` → single space
- Remove punctuation except `:` `-` `_` (keeps `UBERON:0002097`, `aorta-arch`): `/[^\w:\-\s]/g` → `''`

Example: `"  Heart!  "` → `"heart"`, `"UBERON:0002097"` → `"uberon:0002097"`. Empty or whitespace-only → `''` and returns `[]`.

## Ranking

Deterministic, no fuzzy/AI. Lower score = better match. For each candidate, the best score among these checks is taken:

1. `exact` `structureKey` / `name` / `objectName` / `ontologyId` / `systemKey` / `bodyModel` / `systemLabel` (`score 0`)
2. `startsWith` (`score 1`)
3. `includes` substring (`score 2`)
4. Multi-word in-order (`score 3`) and all-words any-order (`score 4`)

Candidates are sorted by `score` ascending, then `structureKey` lexicographically for determinism. Duplicates by `structureKey` are removed (keeps best score).

## Body-Model Filtering

`searchStructures(registry, query, { bodyModel })` where `bodyModel` is `'male' | 'female' | 'all'` (default `'all'`). Implemented as pre-filter on `s.bodyModel` before scoring. Example: `query: "heart", bodyModel: 'female'` returns only female cardiovascular structures when loaded. Same ontology (e.g., `UBERON:0002097` in both) yields two separate results: `male:skin:UBERON:0002097` and `female:skin:UBERON:0002097`.

## System Filtering

`systemKey: 'skin' | ... | 'lymphatic' | 'all'` (default `'all'`) pre-filters on `s.systemKey`. Example: `query: "heart", systemKey: 'cardiovascular'` returns only cardiovascular matches. Kept independent of UI so core search remains reusable.

## Duplicate Handling

`AnatomyStructureRegistry` deduplicates by `structureKey` on `register` (same ontologyId across multiple meshes → one entry). Search additionally deduplicates by `structureKey` via `Set<string>` (keeps best score). No duplicate `structureKey` appears in results, matching registry semantics.

## Ontology Behavior

Search checks `ontologyId` field (normalized) like any other field. Exact `UBERON:0002097` or partial `uberon` matches. No synonyms are invented; only the verified `extras.ontologyid` from the GLB is searchable. `null` ontology is ignored for ontology matching but the structure is still searchable by name.

## Future Camera-Focus Integration

`AnatomySearchResult` contains `structureKey` which is directly usable with `registry.findByStructureKey` to retrieve the full `AnatomyStructure` and its `lineage`, then with `AnatomyViewer`'s `Bounds` API (`api.getBox()`, `controls.target`) to frame the structure. Search does not itself move the camera; a future `focusStructure(structureKey)` helper will consume the result.

## Future AI Integration

An AI result that points at anatomy should be shaped as `AnatomySearchResult` or `AnatomySelection` (`structureKey`, `bodyModel`, `systemKey`, `ontologyId`). Example AI JSON:

```json
{
  "bodyModel": "female",
  "structureKey": "female:reproductive:UBERON:0000002",
  "systemKey": "reproductive",
  "ontologyId": "UBERON:0000002"
}
```

Resolver: `registry.findByStructureKey(target.structureKey)` or `findStructuresByOntologyId(target.ontologyId)` filtered by `bodyModel`. No AI, Gemini, or RAG is implemented in this step.

## Non-Goals

- No synonyms or medical descriptions are invented.
- No external search library is used.
- No GLB is loaded for search.
- No visible search UI, modal, or filter UI is added in this step.
