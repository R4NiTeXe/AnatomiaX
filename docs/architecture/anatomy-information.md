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
- **Concise:** prefer factual summaries over copied long text (paraphrased, not long copyrighted excerpts).

Seed verification date for this step: `2026-01-15` (both 8.14.1 and 8.14.3).

### Source Policy (8.14.3)

- **Authoritative only:** HRA for reproductive structures (CC BY 4.0), NIH MedlinePlus for systemic organs (Public domain). No blogs/forums, no AI-generated medical content, no invented facts.
- **Paraphrased concise:** descriptions/functions are short factual paraphrases, not verbatim long copyrighted passages.
- **Preserved provenance:** each record stores `source`, `sourceUrl`, `lastVerified`, `license` for future UI attribution.
- **Attribution/License notes:** HRA records `CC BY 4.0 (HRA)` with link to `https://humanatlas.io/asct-b-reporter`; NIH records `Public domain (NIH)` with direct MedlinePlus article/image URL. No license is invented.

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

## Seed Dataset (8.14.1 — initial, 13 records)

Small local seed, 13 records for 8 concepts (shared structures duplicated per bodyModel):

- **Skin** — `male:skin:UBERON:0002097`, `female:skin:UBERON:0002097` — NIH MedlinePlus `https://medlineplus.gov/ency/article/002363.htm`
- **Heart** — `male:cardiovascular:UBERON:0000948`, `female:cardiovascular:UBERON:0000948` — NIH `https://medlineplus.gov/ency/article/002280.htm`
- **Brain** — `male:nervous:UBERON:0000955`, `female:nervous:UBERON:0000955` — NIH `https://medlineplus.gov/ency/article/002344.htm`
- **Liver** — `male:digestive:UBERON:0002107`, `female:digestive:UBERON:0002107` — NIH `https://medlineplus.gov/ency/article/000242.htm`
- **Kidney** — `male:urinary:UBERON:0002113`, `female:urinary:UBERON:0002113` — NIH `https://medlineplus.gov/ency/article/002266.htm`
- **Ovary** — `female:reproductive:UBERON:0000992` — HRA `https://humanatlas.io/asct-b-reporter` (female-only)
- **Uterus** — `female:reproductive:UBERON:0000995` — HRA (female-only)
- **Cervix** — `female:reproductive:UBERON:0000002` — HRA (female-only, matches HRA asset ontology for this step)

Only these verified entries were stored in 8.14.1.

## Expanded Dataset (8.14.3 — 26 records)

Reuse of the existing model/repository; no architecture change. Added 13 verified records for commonly used structures present in the 9 GLB systems:

- **Spinal cord** — `male:nervous:UBERON:0002240`, `female:nervous:UBERON:0002240` — NIH `https://medlineplus.gov/ency/article/002249.htm` (nervous)
- **Lung** — `male:respiratory:UBERON:0002048`, `female:respiratory:UBERON:0002048` — NIH `https://medlineplus.gov/ency/article/002309.htm` (respiratory)
- **Stomach** — `male:digestive:UBERON:0000945`, `female:digestive:UBERON:0000945` — NIH `https://medlineplus.gov/ency/article/003121.htm` (digestive)
- **Urinary bladder** — `male:urinary:UBERON:0001255`, `female:urinary:UBERON:0001255` — NIH `https://medlineplus.gov/ency/article/003246.htm` (urinary)
- **Femur** — `male:musculoskeletal:UBERON:0000981`, `female:musculoskeletal:UBERON:0000981` — NIH `https://medlineplus.gov/ency/imagepages/19089.htm` (musculoskeletal, longest bone)
- **Testis** — `male:reproductive:UBERON:0000473` — HRA `https://humanatlas.io/asct-b-reporter` (male-only)
- **Prostate** — `male:reproductive:UBERON:0002367` — NIH `https://medlineplus.gov/ency/article/002276.htm` (male-only)
- **Fallopian tube** — `female:reproductive:UBERON:0003889` — HRA `https://humanatlas.io/asct-b-reporter` (female-only)

Total: 13 (8.14.1) + 13 (8.14.3) = **26 records** for 16 distinct canonical concepts. No record was created merely because a node name exists — each has authoritative source.

### Coverage by System

- **Nervous:** brain + spinal cord
- **Respiratory:** lung
- **Digestive:** liver + stomach
- **Urinary:** kidney + bladder
- **Cardiovascular:** heart
- **Musculoskeletal:** femur (representative long bone)
- **Reproductive:** ovary/uterus/cervix/fallopian (female), testis/prostate (male)
- **Skin:** skin

### Structures Intentionally Not Documented Yet (8.14.3)

- Most musculoskeletal muscles/bones beyond femur, lymphatic vessels/nodes, detailed vascular branches, and fine subdivisions (e.g., individual vertebrae, bronchial segments). These remain `Information unavailable` until authoritative concise summaries are verified. Intentional to avoid fabrication and to keep dataset extendable.

## Expanded Dataset (8.14.5 — 38 records, high-value verified present)

Inspection of current 26 records vs. actual HRA GLB metadata (`dump-male.txt` 485 structures, `getAllLoadedStructures()` via `window.__ANATOMIA_REGISTRY`) showed whole-organ UBERONs (e.g., `UBERON:0000948` heart, `UBERON:0000955` brain, `UBERON:0002048` lung) are **not** present as meshes — the assets contain substructures (ventricles `UBERON:0002080`, bronchopulmonary segments `FMA:7374`, femur `FMA:24474`, etc.). To keep `Information unavailable` correct and to prioritize high-value **actually present** structures, 8.14.5 adds 12 records with **exact GLB ontology IDs verified present**:

- **Ascending aorta** — `male:cardiovascular:UBERON:0001496`, `female:cardiovascular:UBERON:0001496` — NIH `https://medlineplus.gov/ency/imagepages/19264.htm` — verified `VH_M_ascending_aorta` (cardiovascular)
- **Gallbladder** — `male:digestive:UBERON:0002110`, `female:digestive:UBERON:0002110` — NIH `https://medlineplus.gov/ency/article/000273.htm` — verified `VH_M_gallbladder` (digestive)
- **Right ventricle** — `male:cardiovascular:UBERON:0002080`, `female:cardiovascular:UBERON:0002080` — NIH `https://medlineplus.gov/ency/imagepages/19612.htm` — verified `VH_M_heart_right_ventricle` (cardiovascular)
- **Hilum of lung** — `male:respiratory:UBERON:0004887`, `female:respiratory:UBERON:0004887` — NIH `https://medlineplus.gov/ency/imagepages/19380.htm` — verified `VH_M_hilum_L` (respiratory)
- **Hilum of spleen** — `male:lymphatic:UBERON:0001248`, `female:lymphatic:UBERON:0001248` — NIH `https://medlineplus.gov/ency/imagepages/19075.htm` — verified `VH_M_hilum_of_spleen` (lymphatic)
- **Femur (FMA)** — `male:musculoskeletal:FMA:24474`, `female:musculoskeletal:FMA:24474` — NIH `https://medlineplus.gov/ency/imagepages/19089.htm` — verified `VH_M_femur_R_1` `FMA:24474` (musculoskeletal, longest bone; corrects earlier `UBERON:0000981` which is not present as mesh)

Total: 26 (8.14.3) + 12 (8.14.5) = **38 records** for 22 distinct canonical concepts. No record added merely because a node name looked important — each verified present via `dump-male.txt` and authoritative source, with `source` `sourceUrl` `lastVerified` `2026-01-15` `license`.

### Coverage by System (8.14.5)

- **Nervous:** brain + spinal cord (whole concepts) + spinal segments remain `Information unavailable` until individually verified
- **Respiratory:** lung (whole) + hilum of lung (present)
- **Digestive:** liver + stomach + gallbladder (present)
- **Urinary:** kidney + bladder (whole) + trigone/hilum remain `Information unavailable` except bladder whole
- **Cardiovascular:** heart (whole) + ascending aorta (present) + right ventricle (present)
- **Musculoskeletal:** femur UBERON (whole) + femur FMA (present) — both retained, distinct `structureKey`
- **Reproductive:** ovary/uterus/cervix/fallopian (female), testis/prostate (male)
- **Lymphatic:** hilum of spleen (present) — key lymphatic where authoritative data exists
- **Skin:** skin

### Structures Intentionally Not Documented Yet (8.14.5)

- Most musculoskeletal muscles/bones beyond femur (e.g., `FMA:32860` condyle, `FMA:49057` extraocular), lymphatic vessels/nodes beyond hilum, detailed vascular branches beyond aorta, bronchopulmonary segments beyond hilum, and fine subdivisions (vertebrae, spinal segments `UBERON:0006469`). These remain `Information unavailable` until authoritative concise summaries are verified. Intentional to avoid fabrication and to keep dataset extendable. No invented information/ontology IDs.

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
