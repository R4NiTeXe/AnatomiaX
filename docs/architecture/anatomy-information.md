# Anatomy Information — Verified Source Architecture (STEP 8.14.1)

## Purpose

Provide a deterministic, source-backed information layer for anatomical structures that is linked to the existing viewer identity (`bodyModel + structureKey + ontologyId`) without building the visible panel yet and without introducing AI/RAG, medical advice, or GLB/network side effects.

The information layer is the **source of truth** for future UI and future `verified information + RAG + AI explanation` composition. AI must never be implemented in this step and must not fabricate content.

## Identity Model

- **Primary key:** `structureKey` — already bodyModel-qualified in the registry (`${bodyModel}:${systemKey}:${ontologyId}` or fallback `${bodyModel}:${systemKey}:object:${objectName}`).
- **Linkage fields:** `bodyModel: 'male' | 'female'`, `systemKey: AnatomySystemKey`, `ontologyId: string | null`.
- **Preservation:** `ontologyId` is preserved when available (e.g., `UBERON:0002097`), but does not override the bodyModel-qualified key.

This mirrors `AnatomyStructure` / `AnatomySelection` in `frontend/web/src/components/anatomy/anatomyTypes.ts` and `anatomyRegistry.ts:14-26` without duplicating the mesh/lineage data.

**Example — same ontology, distinct records:**

```
male:skin:UBERON:0002097   → male skin
female:skin:UBERON:0002097 → female skin
```

They share `ontologyId` but have distinct `structureKey` and `bodyModel`, so they never overwrite each other in `byStructureKey` or `byOntology`.

## Data Model

`frontend/web/src/components/anatomy/anatomyInformation.ts`

```ts
interface AnatomyInformation extends AnatomyInformationProvenance {
  structureKey: string; // PK, bodyModel-qualified
  bodyModel: AnatomyBodyModelKey;
  systemKey: AnatomySystemKey;
  ontologyId: string | null;
  canonicalName: string; // display name
  description: string; // concise factual summary
  function: string; // brief function summary
}

interface AnatomyInformationProvenance {
  source: AnatomyInformationSourceCategory | string; // e.g., "Human Reference Atlas", "NIH"
  sourceUrl: string; // verified URL
  lastVerified: string; // YYYY-MM-DD
  license?: string; // e.g., "CC BY 4.0 (HRA)", "Public domain (NIH)"
}
```

Only fields justified by the architecture are included. `description`/`function` are concise paraphrases, not long copyrighted excerpts.

**Source categories:** `Human Reference Atlas`, `NIH`, `FMA`, `Uberon`, `authoritative anatomy reference` — see `AnatomyInformationSourceCategory`.

No duplication of `AnatomyStructure` beyond the four identity fields plus the three display/provenance fields.

## Source / Provenance Rules

- **Trusted sources only:** Human Reference Atlas (`https://humanatlas.io/asct-b-reporter`), NIH MedlinePlus (`https://medlineplus.gov/ency/...`), FMA/Uberon, or other licensed authoritative anatomy references.
- **No scraping:** no random websites.
- **No AI generation:** do not generate descriptions with AI; no medical advice/diagnosis.
- **No invention:** if no verified content exists, store no record — callers receive `undefined`.
- **Attribution:** every record retains `source`, `sourceUrl`, `lastVerified`, `license` when applicable.
- **Concise:** prefer factual summaries over copied long text.

Seed verification date for this step: `2026-01-15`.

## Unavailable-Data Behavior

If no verified record exists for a `structureKey`/`ontologyId`, all lookup functions return `undefined` (not `null` with fabricated text). Future UI must render:

> **Information unavailable** — verified content not yet available for this structure.

This is intentional to prevent hallucination. The repository never synthesizes content.

```ts
getAnatomyInformation(selection) // → AnatomyInformation | undefined
getAnatomyInformationByStructureKey(key) // → undefined if missing
getAnatomyInformationByOntologyId(ontologyId, bodyModel?) // → undefined if missing or ambiguous
```

## Male/Female Separation

- Storage: `Map<string, AnatomyInformation>` keyed by `structureKey`.
- Index: `Map<string, AnatomyInformation[]>` by `ontologyId` for ontology lookup.
- Same ontology (e.g., `UBERON:0002097`) has two entries when shared; `getAnatomyInformationByOntologyId('UBERON:0002097')` without `bodyModel` returns `undefined` to avoid cross-body collision. With `bodyModel` it returns the body-specific record.
- Direct `structureKey` lookup is always unambiguous.

This guarantees `male:skin:UBERON:0002097` and `female:skin:UBERON:0002097` never overwrite.

## Future UI Usage

Future visible information panel (not built in 8.14.1) will:

- Accept `AnatomySelection | null` from `useAnatomyState`.
- Call `getAnatomyInformation(selection)`.
- If `undefined`, show "information unavailable".
- If defined, render `canonicalName`, `description`, `function`, and provenance (`source`, `sourceUrl`, `lastVerified`, `license`) with link attribution.

No GLB loading, no registry mutation, no network fetch in this layer.

## Future AI / RAG Boundary

Architecture is compatible with:

```
verified information (this layer, deterministic)
+ RAG retrieval (future, source-grounded)
+ AI explanation (future, must cite verified information)
```

Deterministic layer remains the source of truth. AI must not be implemented now and, when added, must be constrained to cite `AnatomyInformation` provenance and must not invent missing records.

## Seed Dataset (8.14.1)

Small local seed, 13 records for 8 concepts (shared structures duplicated per bodyModel):

- **Skin** — `male:skin:UBERON:0002097`, `female:skin:UBERON:0002097` — NIH MedlinePlus `https://medlineplus.gov/ency/article/002363.htm`
- **Heart** — `male:cardiovascular:UBERON:0000948`, `female:cardiovascular:UBERON:0000948` — NIH `https://medlineplus.gov/ency/article/002280.htm`
- **Brain** — `male:nervous:UBERON:0000955`, `female:nervous:UBERON:0000955` — NIH `https://medlineplus.gov/ency/article/002344.htm`
- **Liver** — `male:digestive:UBERON:0002107`, `female:digestive:UBERON:0002107` — NIH `https://medlineplus.gov/ency/article/000242.htm`
- **Kidney** — `male:urinary:UBERON:0002113`, `female:urinary:UBERON:0002113` — NIH `https://medlineplus.gov/ency/article/002266.htm`
- **Ovary** — `female:reproductive:UBERON:0000992` — HRA `https://humanatlas.io/asct-b-reporter` (female-only)
- **Uterus** — `female:reproductive:UBERON:0000995` — HRA (female-only)
- **Cervix** — `female:reproductive:UBERON:0000002` — HRA (female-only, matches HRA asset ontology for this step)

Only these verified entries are stored; entire anatomy library is not populated now.

## Data Access

```ts
import { getAnatomyInformation } from '@/components/anatomy/anatomyInformation';

const info = getAnatomyInformation(selection); // selection: AnatomySelection | null
if (!info) {
  /* render "information unavailable" */
}
```

- Accepts existing `AnatomySelection`.
- Returns `AnatomyInformation | undefined`.
- Never loads GLBs, never mutates registry, no network.
- Local structured source is acceptable for this step.

Helper APIs for tests/tools:

- `getAnatomyInformationByStructureKey(key)`
- `getAnatomyInformationByOntologyId(ontologyId, bodyModel?)`
- `getAnatomyInformationSeed()` (readonly)
- `getAnatomyInformationKeys()`

## Tests

`frontend/web/src/components/anatomy/__tests__/anatomyInformation.test.ts` covers:

1. lookup by structureKey
2. male/female same ontology remain separate
3. lookup by ontology when unambiguous vs ambiguous
4. unavailable returns undefined
5. provenance preserved
6. selection → information lookup
7. no registry mutation
8. no GLB loading (source inspection)

Pure, no network, no THREE.

## Non-Goals for 8.14.1

- No visible panel
- No AI/RAG
- No medical advice/diagnosis
- No GLB/asset modification
- No search/camera/navigator/layer behavior change
- No new dependencies

## Files

- `frontend/web/src/components/anatomy/anatomyInformation.ts` — model + repository + lookup API
- `frontend/web/src/components/anatomy/__tests__/anatomyInformation.test.ts` — 9 tests
- `docs/architecture/anatomy-information.md` — this document
