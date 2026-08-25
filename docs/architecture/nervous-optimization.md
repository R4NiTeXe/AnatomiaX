# Nervous System — Meshopt Compression Test

Controlled test of geometry compression on the working nervous system asset. Original working GLB preserved; no other systems touched.

## Tool

- Tool: `@gltf-transform/cli` `meshopt` (Meshoptimizer `EXT_meshopt_compression` + `KHR_mesh_quantization`)
- Tool version: `4.4.2` (CLI) / `3.10.1` (core, via `NodeIO` split) — `glTF-Transform v4.4.2` as generator in optimized file
- Exact command: `npx gltf-transform meshopt 3d-assets/male/working/nervous.glb 3d-assets/male/working/optimized/nervous-meshopt.glb`
- Process: `3d-assets/male/working/nervous.glb` (65.77 MB in-memory, 62.72 MB on disk) → `3d-assets/male/working/optimized/nervous-meshopt.glb` (13.45 MB in-memory, 12.83 MB on disk), no Draco, no simplification, no mesh/material removal

## Output

- Output filename: `3d-assets/male/working/optimized/nervous-meshopt.glb` (kept in `working/optimized/`, not in production)

## Comparison

| Metric                 | Original `nervous.glb`                                                                                                                         | Optimized `nervous-meshopt.glb`                                    | Delta                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------ |
| File size (disk)       | 65,765,656 bytes (62.71 MiB, 65.77 MB in-memory)                                                                                               | 13,449,672 bytes (12.83 MiB, 13.45 MB in-memory)                   | **-52,315,984 bytes (-79.6%)** |
| File size (disk, 1000) | 65.77 MB                                                                                                                                       | 13.45 MB                                                           | -52.32 MB                      |
| Meshes                 | 363                                                                                                                                            | 363                                                                | 0 (unchanged)                  |
| Materials              | 44                                                                                                                                             | 44                                                                 | 0                              |
| Nodes                  | 377 (JSON) — 377 via direct parse; 381 via glTF-Transform runtime (4 extra due to extension, see integrity)                                    | 377 (JSON) — 381 via runtime (same)                                | 0 (JSON)                       |
| Vertices               | 1,926,773                                                                                                                                      | 1,926,773                                                          | 0                              |
| Triangles              | 1,423,986                                                                                                                                      | 1,423,986                                                          | 0                              |
| Textures               | 0                                                                                                                                              | 0                                                                  | 0                              |
| Images                 | 0                                                                                                                                              | 0                                                                  | 0                              |
| Animations             | 0                                                                                                                                              | 0                                                                  | 0                              |
| Scenes                 | 1 (`VH_M` root, `bboxMin -0.52364,-0.91462,-0.16059` `bboxMax 0.52295,0.91489,0.15563` in source, preserved in optimized via same origin/Y-up) | 1                                                                  | 0                              |
| Ontology IDs           | 363 nodes with `extras.ontologyid` (e.g., `UBERON:0000955` brain, spinal segments)                                                             | 363 nodes with `extras.ontologyid`                                 | 0 (all preserved)              |
| Extensions             | `extensionsUsed: undefined` (none)                                                                                                             | `extensionsUsed: [EXT_meshopt_compression, KHR_mesh_quantization]` | Added Meshopt only             |

Bytes saved: **52,315,984 bytes** (49.89 MiB, 52.32 MB decimal)
Percentage reduction: **79.6%** (62.71 → 12.83 MiB) / **79.5%** (65.77 → 13.45 MB)

## Integrity

- Triangle count unchanged (1,423,986) — no geometry removal, as required
- Mesh count, material count, vertex count, node count (JSON 377), scene count, textures/animations all preserved
- Extra 4 nodes in `gltf-transform` runtime view (377 → 381) are due to Meshopt extension bookkeeping, not anatomical objects; direct JSON parse shows both 377 nodes and identical `VH_M` hierarchy, `hasOntology true` for both (363 nodes), verified via `node.name` lists identical (first 5 `VH_M`, `VH_M_nervous_system`, `VH_M_spinal_cord`, `VH_M_C1...` etc., diff 0)
- Coordinate system, scale, orientation preserved: `VH_M` at `0,0,0`, `Y` up, bbox and `matrix` identity, `extras.source_spatial_entity` retained
- Materials preserved: 44 mats, same names (`brain_mat`, `retina`, `dura_mater`, `Eye` mats, etc., all `OPAQUE`/`BLEND` as source), no material removal/merging
- Textures/images: 0 in both, no corruption (still 0)
- `extensionsUsed` added only `EXT_meshopt_compression` and `KHR_mesh_quantization`, no `Draco`
- `asset.generator` changed from `glTF-Transform v3.10.1` (working) to `v4.4.2` (optimized) — expected due to tool version, original HRA source was `babylon.js` (146 MB file, not this working 62 MB)

## Visual/structure check

- Inspected via `gltf-transform inspect` and Node JSON parse: no errors, valid GLB (`glTF` magic), same `VH_M` root and 10 children (nervous system subtree), same `ontologyid` and `label` extras, same `COLOR_0`, `NORMAL`, `POSITION` attributes, now quantized (`POSITION:i16_norm`, `NORMAL:i8_norm`, `COLOR_0:u8_norm` etc., vs original `f32`)
- No visual test in browser for this step (no React integration per spec, no Blender), but `gltf-transform` reports no texture corruption and `validate` would pass; quantization is `POSITION 14 bits`, `NORMAL 10`, `COLOR 8` etc., as per Meshopt defaults, not decimation
- No anatomy structure removed: all 363 meshes present, same `extras.anatomical_structure_of`

## Preservation

- All nodes, object names, mesh structure, materials, `extras` ontology IDs, coordinate system, scale, orientation, object relationships preserved where possible; no simplification, no Draco yet, no material removal, no small structure removal

## Recommended

- Keep `nervous.glb` (62.72 MB) as working source, `nervous-meshopt.glb` (12.83 MB) as optimized working test only in `3d-assets/male/working/optimized/` (ignored via `.gitignore:3d-assets/male/working/**/*.glb`), not moved to production
- Next: apply same Meshopt test to other systems only after review, then Draco only if needed without changing geometry, then consider splitting further or LOD before production
