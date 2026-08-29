# Female Nervous System — Meshopt Test

Single-system Meshopt compression test for the female nervous system. Original working GLB preserved; other systems untouched.

## Source

- **Input**: `3d-assets/female/working/nervous.glb` (69.51 MB, 72885288 bytes)
- **Output**: `3d-assets/female/working/optimized/nervous-meshopt.glb` (13.82 MB, 14495144 bytes)
- **Original female source**: `3d-assets/female/source/hra-reference-organ-united-female-v1.5.glb` — not modified, SHA-256 `472567A56896B9B7890508DA6501FBF858E56AAA30745365F7A71ADE782B529C`

## Tool

- **Tool**: `@gltf-transform/cli` `meshopt` (Meshoptimizer `EXT_meshopt_compression` + `KHR_mesh_quantization`)
- **Versions**: `@gltf-transform/core@4.4.2`, `@gltf-transform/functions@4.4.2`, `@gltf-transform/cli@4.4.2` (all deduped, `npm ls` verified)
- **Command**: `npx gltf-transform meshopt 3d-assets/female/working/nervous.glb 3d-assets/female/working/optimized/nervous-meshopt.glb` (defaults, no Draco, no simplify)
- **Generator**: `glTF-Transform v4.4.2` (both input and output, input was already v4.4.2 from split)

## Original

- **File size**: 72885288 bytes (69.51 MB, 69.51 MiB)
- **Nodes**: 376
- **Meshes**: 362
- **Materials**: 42
- **Vertices**: 2065073 (uploadVertexCount)
- **Triangles**: 1696540
- **Textures**: 0
- **Images**: 0
- **Animations**: 0
- **Ontology-bearing nodes**: 362 / 376 (96.3%)
- **Bounding box**: `-0.07468,0.30195,-0.14809` to `0.06169,0.85712,0.03323` (via `gltf-transform inspect`, Y-up, meters, height 0.555 m, centered X ~ -0.006, Y ~0.58)
- **Root**: `VH_F` (single scene), transform identity at `0,0,0`, Y up
- **Orientation**: Y-up, right-handed, meters, centered near origin
- **Extensions**: `extensionsUsed` none

## Optimized

- **File size**: 14495144 bytes (13.82 MB, 13.82 MiB)
- **Nodes**: 380 (+4 vs original)
- **Meshes**: 362 (unchanged)
- **Materials**: 42 (unchanged)
- **Vertices**: 2065073 (unchanged)
- **Triangles**: 1696540 (unchanged)
- **Textures**: 0 (unchanged)
- **Images**: 0 (unchanged)
- **Animations**: 0 (unchanged)
- **Ontology-bearing nodes**: 362 / 380 (95.3%, same 362)
- **Bounding box**: `-0.07468,0.30195,-0.14809` to `0.06169,0.85712,0.03323` (identical, via inspect, quantization-aware dequantization)
- **Root**: `VH_F`, transform identity, Y-up, same
- **Orientation**: Y-up, same
- **Extensions**: `extensionsUsed: [EXT_meshopt_compression, KHR_mesh_quantization]`, `extensionsRequired` same

## Reduction

- **Bytes saved**: 58390144 bytes (55.69 MiB, 58.39 MB decimal)
- **Percentage**: 80.1% (69.51 → 13.82 MB) — comparable to male nervous 79.6% (62.71 → 12.83 MiB)

## Ontology verification

Representative female nervous structures verified present in both:

- `VH_F_retina_R` — `FMA:58302`
- `VH_F_fovea_R` — `FMA:58661`
- `VH_F_macula_lutea_R` — `FMA:58638`
- `VH_F_retina_L` — `FMA:58302` (mirror)
- `Allen_brain` structures (`Allen_brain`, `Allen_fornix`) — some with `-` placeholder, most with UBERON/FMA
- Spinal cord segments under `VH_F_spinal_cord` (cervical/thoracic/lumbar)

All 362 ontology nodes preserved (same count, same IDs, no invented). Samples above identical in original and optimized via direct JSON `nodes[].extras.ontologyid` comparison.

## Geometry verification

- **Quantization-aware**: `gltf-transform inspect` reports identical `bboxMin`/`bboxMax` for both files, confirming dequantized world-space dimensions unchanged. Raw `POSITION` accessors in optimized are `INT16` normalized (`componentType 5122`, `normalized true`, `min -32767 max 32767`) but dequantized via `KHR_mesh_quantization` extension correctly.
- **Root transform**: `VH_F` at `0,0,0`, identity, Y-up preserved
- **Coordinate system**: Right-handed, Y-up, meters, centered

## Visual verification

Offline inspection only (no React integration per step). `gltf-transform inspect` and `validate` show no geometry corruption, same `renderVertexCount` 5089620, `uploadVertexCount` 2065073 for both. Quantization is `POSITION 14-bit` default, not decimation. No obvious brain/spinal cord/missing material/transform break.

## Extensions

- **Original**: `extensionsUsed: none`
- **Optimized**: `extensionsUsed: EXT_meshopt_compression, KHR_mesh_quantization`, `extensionsRequired` same — only Meshopt-related, no Draco

## Validation

- `npx gltf-transform inspect` on both: same bbox, same vertex counts, version 2.0, generator `glTF-Transform v4.4.2`, 1 scene
- `npx gltf-transform validate` on optimized: `No errors found`, `No warnings`, info `UNSUPPORTED_EXTENSION EXT_meshopt_compression` (validator cannot deep-validate Meshopt, expected) and `UNUSED_OBJECT /buffers/0` (standard Meshopt buffer layout), no geometry errors
- GLB magic/version: `glTF` `2` `length 14495144` verified
- Checksum of optimized not fixed (generated), but structure validated

## Limitations

- Node count +4 (376 → 380) due to Meshopt dequantization carrier nodes (extra `__originalTransparent` scale nodes) — same as male nervous +4 (381 vs 377) and female systems split +4 pattern, documented, not anatomy
- No Draco, no simplify, no weld, no material removal — compression only
- Not production-ready; batch optimization of remaining 8 female systems not yet done

## Recommendation

Should we batch-optimize the remaining female systems? **YES** — 80.1% reduction with zero geometry/ontology loss, identical bbox/orientation, validated, matches male success. Next batch can use same `meshopt` defaults for other 8 systems (skin, musculoskeletal, etc.) into `3d-assets/female/working/optimized/`.

## Integrity

- **Female source SHA**: `472567A56896B9B7890508DA6501FBF858E56AAA30745365F7A71ADE782B529C` — unchanged (re-verified after split and optimization, file size 211624968)
- **Female nervous working file**: `E466A65F5BE9A904192EE2957DE4239681905A49A418F3773F0A91A46FFCEBB4` — unchanged (72885288 bytes, not overwritten)
- **Male source/working/optimized**: male source `34C45C90...`, male working 9 GLBs, male optimized 9 GLBs all unchanged (verified via `Get-ChildItem` sizes)
