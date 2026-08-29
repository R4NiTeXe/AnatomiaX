# Anatomy Mapping Layer

Foundation for identifying selected 3D structures by stable anatomy identifiers.

## Purpose

Bridge between the rendered GLB and every future feature that needs to point at
anatomy (AI results, search, organ explorer, simulations):

```
AI result ──► { systemKey, ontologyId, structureKey } ──► 3D structure(s)
                ▲
                │  AnatomyStructureRegistry (runtime, per-system)
                │
GLB load ──────┘  extras.ontologyid → AnatomyStructure
```

No medical content, no friendly names, and no AI are implemented in this step.
All identifiers are verified model data or a documented fallback.

## Types — `anatomyTypes.ts`

- `AnatomySystemKey` — `skin | musculoskeletal | nervous | cardiovascular | respiratory | digestive | urinary | reproductive | lymphatic`
- `AnatomyStructure` — `{ id, structureKey, name, objectName, systemKey, ontologyId, lineage }`
- `AnatomySelection` — `{ structureKey, name, objectName, systemKey, ontologyId }`

`id` and `structureKey` are identical; strict TypeScript throughout, no `any`.

## System metadata — `anatomySystems.ts`

Single source of truth: `ANATOMY_SYSTEM_DEFINITIONS` (9 male systems) with
`key, label, asset, available, displayOrder`.  
`anatomyAssetConfig.ts` re-exports from this module for backward compatibility.

## Structure key

`createStructureKey(systemKey, ontologyId, objectName)`

- When a verified `ontologyId` exists: `${systemKey}:${ontologyId}` — e.g. `skin:UBERON:0002097`
- Fallback (no ontology): `${systemKey}:object:${sanitizedObjectName}` — whitespace → `_`, empty → `unnamed`

Fallback is documented and never invents medical identifiers. Multiple meshes
sharing an ontologyId collapse to one key.

## Ontology reading — `anatomyRegistry.ts`

At system load the scene is traversed; each `THREE.Mesh` yields a structure:

- `objectName` — nearest named ancestor (GLB node name)
- `ontologyId` — `extractOntologyId(mesh)` walks up parents checking
  `userData.ontologyId`, `ontologyid`, nested `extras.ontologyid`, and
  `representation_of` (all case variants, trimmed; returns first match or `null`)

Values come directly from `extras.ontologyid` baked into the optimized GLBs.
No list is hard-coded; generation is per-loaded system only.

Verified examples from actual optimized assets:

| system                | objectName                                | ontologyId       | label                              |
| --------------------- | ----------------------------------------- | ---------------- | ---------------------------------- |
| skin                  | `VH_M_skin`                               | `UBERON:0002097` | skin of body                       |
| nervous               | `VH_M_C1_segment_of_cervical_spinal_cord` | `UBERON:0006469` | C1 segment of cervical spinal cord |
| nervous               | `Allen_fornix_L`                          | `UBERON:0000052` | fornix of brain                    |
| cardiovascular        | `VH_M_papillary_muscle_of_heart_anterior` | `FMA:7264`       | Anterior papillary muscle          |
| respiratory           | `VH_M_hilum_L`                            | `UBERON:0004887` | left lung hilus                    |
| digestive             | `VH_M_bare_area_of_liver`                 | `UBERON:0001149` | bare area of liver                 |
| urinary               | `VH_M_kidney_capsule_L`                   | `UBERON:0002015` | kidney capsule                     |
| nervous (no ontology) | `Allen_brain`                             | —                | —                                  |

Parent grouping nodes such as `VH_M_heart` or `VH_M_liver` carry no ontology
themselves; their children do.

Counts (optimized): skin 1/3, musculoskeletal 118/160, nervous 363/381,
cardiovascular 120/175, respiratory 72/101, digestive 62/84, urinary 81/109,
reproductive 18/28, lymphatic 14/19 nodes with ontology.

## Registry — `AnatomyStructureRegistry`

Client-side only, no database, efficient Maps:

- `register` / `registerSystem(systemKey, scene)` — traverses via `collectStructuresFromScene`
- `unregisterSystem(systemKey)` / `clear`
- `findByStructureKey`, `findStructureByOntologyId`, `findStructuresByOntologyId`,
  `findStructureByObjectName`, `findStructuresByObjectName`, `findStructuresByName`,
  `findStructuresBySystem`, `getAllLoadedStructures`

Duplicate handling: same `structureKey` → single entry (documented, not merged
as distinct). Shared-material meshes and multi-mesh concepts remain one logical
structure; highlight applies to all meshes matching that key/ontologyId.

Missing ontology: structure is still registered under fallback key and remains
findable by object name and system (ontology lookup returns `undefined`).

Unloading: `AnatomyViewer` hides a system → its `AnatomyGltf` unmounts → context
calls `unregisterSystemStructures`; registry entry and `selectedStructure` (if
belonging to that system) are cleared. Drei's GLTF cache is retained.

## Selection

Before: `{ name, systemKey }` (object name only).

After: `{ structureKey, name, objectName, systemKey, ontologyId }`

On click the handler derives `objectName` + `ontologyId`, builds the key, looks
up the canonical `AnatomyStructure` in the registry, and stores that. Highlight
now matches on `structureKey` (or shared `ontologyId` for multi-mesh concepts)
and restores correctly on change/clear.

## Panel

`AnatomySystemPanel` shows for the current selection:

- name
- system label
- ontology line — prefixed ID when present, otherwise `Ontology ID not available`
- no diagnosis or invented description

Highlight remains emissive (`#2dd4bf`); visual design unchanged.

## Search helpers (future)

Exported for later search UI / AI bridge; no visible search box yet:

- `findStructureByOntologyId(registry, id)`
- `findStructuresBySystem(registry, systemKey)`
- `findStructuresByName(registry, name)` (exact object name)

## AI bridge (future)

The intended data shape for an AI result to drive the viewer is already
supported:

```ts
type AiAnatomyTarget = {
  systemKey: AnatomySystemKey;
  ontologyId: string | null;
  structureKey: string;
};
```

Resolver: `registry.findByStructureKey(target.structureKey)` or
`registry.findStructureByOntologyId(target.ontologyId)` → highlight / focus.

No AI, Gemini, or RAG is implemented in this step.

## Performance

Only loaded systems are traversed. Initial `skin` only → registry contains `1`
structure. Each additional system is registered lazily on toggle; `skin` + all
nine systems → 770+ structures. No pre-parsing of all GLBs at startup.

## Tests

`frontend/web/src/components/anatomy/__tests__/anatomyRegistry.test.ts` — Jest,
23 cases covering key creation, ontology extraction (including case/nested
variants), name resolution, registry lookups, duplicate handling, missing
ontology, add/remove, scene collection, and selection conversion.

## References

- HRA source extras: `extras.ontologyid` / `extras.representation_of` / `extras.label`
- Optimized assets staged under `frontend/web/public/models-dev/` (git-ignored)
  via `VITE_ANATOMY_ASSET_BASE_URL`; no GLB committed
