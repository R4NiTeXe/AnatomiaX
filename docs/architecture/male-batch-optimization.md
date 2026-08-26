# Male Working Assets — Batch Meshopt Optimization (Step 8.7)

Batch compression of the remaining male anatomy working assets using the verified
Meshopt process from Step 8.5 (`nervous-optimization.md`). Compression only —
no geometry simplification, no decimation, no anatomy removal.

The nervous system was already optimized in Step 8.5 and was not touched.

## Results

| System          | Original (bytes) | Optimized (bytes) | Reduction | Meshes | Materials | Vertices | Triangles | Ontology | Status |
| --------------- | ---------------- | ----------------- | --------- | ------ | --------- | -------- | --------- | -------- | ------ |
| skin            | 5,931,736        | 668,896           | -88.7%    | 1      | 1         | 92,659   | 185,314   | 1/1      | PASS   |
| musculoskeletal | 23,302,204       | 4,329,744         | -81.4%    | 118    | 8         | 417,463  | 563,991   | 118/118  | PASS   |
| cardiovascular  | 22,131,856       | 3,752,528         | -83.0%    | 120    | 10        | 524,130  | 580,657   | 120/120  | PASS   |
| respiratory     | 12,889,416       | 2,434,080         | -81.1%    | 72     | 9         | 304,593  | 288,068   | 72/72    | PASS   |
| digestive       | 6,788,304        | 1,711,640         | -74.8%    | 62     | 8         | 219,648  | 229,371   | 62/62    | PASS   |
| urinary         | 4,688,684        | 1,230,820         | -73.7%    | 81     | 4         | 124,764  | 241,845   | 81/81    | PASS   |
| reproductive    | 4,179,132        | 959,984           | -77.0%    | 18     | 3         | 115,560  | 230,590   | 18/18    | PASS   |
| lymphatic       | 7,811,848        | 1,250,436         | -84.0%    | 14     | 7         | 137,630  | 274,265   | 14/14    | PASS   |

Total: 87,723,180 → 16,337,672 bytes (**-71,385,508 bytes, -81.4%**).

Ontology column: nodes carrying `extras.ontologyid` before/after — identical for every system.
All object names preserved (node name lists hash-identical), all material names preserved,
all mesh names preserved. Textures: 0→0, images: 0→0, animations: 0→0 for every system.

## Optimization method

- Tool: `@gltf-transform/cli` `meshopt` command (`EXT_meshopt_compression` + `KHR_mesh_quantization`)
- Tool version: 4.4.2 (CLI / core / functions aligned in Step 8.6)
- Exact command per asset: `npx gltf-transform meshopt <working>/<system>.glb <optimized>/<system>-meshopt.glb`
- Settings: CLI defaults only (same as the approved nervous test). No Draco, no `simplify`,
  no `weld`, no `prune`, no material or texture operations.
- Output directory: `3d-assets/male/working/optimized/` (git-ignored via `.gitignore`:
  `3d-assets/male/working/**/*.glb`)
- `asset.generator` of outputs: `glTF-Transform v4.4.2`
- `extensionsUsed` of outputs: `EXT_meshopt_compression`, `KHR_mesh_quantization` (nothing else added)

## Validation

Per asset, the optimized GLB was re-parsed and compared against the original:

### Geometry preservation

- Mesh count identical (e.g. skin 1→1, musculoskeletal 118→118, cardiovascular 120→120)
- Primitive count identical
- Vertex count identical (e.g. 524,130 cardiovascular vertices before and after)
- Triangle count identical (e.g. 563,991 musculoskeletal triangles before and after)
- No simplification, decimation, welding or pruning applied; positions are quantized
  (typically `POSITION:i16_norm`, `NORMAL:i8_norm`) which is lossy at ~14-bit precision
  by design of Meshopt, but removes no geometry

### Ontology preservation

- Every node with `extras.ontologyid` in the original exists in the output with the same
  extras (FMA / UBERON IDs, `label`, `anatomical_structure_of`, `representation_of`,
  `source_spatial_entity`); counts identical for all systems
- All node names, mesh names and material names preserved (hash-compared lists)

### Coordinate preservation

- Scene root `VH_M` transform unchanged in every file (JSON-level compare)
- World-space bounding box computed from accessor bounds with quantization-aware
  dequantization matches within ≤ 0.00008 model units (≈ 0.08 mm on a 1.83-unit-tall body),
  i.e. 14-bit quantization noise:

  | System          | Original dims (X,Y,Z)     | Optimized dims (X,Y,Z)    |
  | --------------- | ------------------------- | ------------------------- |
  | skin            | 1.04659, 1.82952, 0.31622 | 1.04667, 1.82952, 0.31624 |
  | musculoskeletal | 0.48159, 1.65898, 0.21663 | 0.48157, 1.65898, 0.21663 |
  | cardiovascular  | 0.23620, 0.87184, 0.18743 | 0.23620, 0.87184, 0.18743 |
  | respiratory     | 0.25942, 0.31458, 0.18971 | 0.25942, 0.31458, 0.18971 |
  | digestive       | 0.27632, 0.79140, 0.22856 | 0.27633, 0.79140, 0.22855 |
  | urinary         | 0.20637, 0.46544, 0.18035 | 0.20636, 0.46544, 0.18035 |
  | reproductive    | 0.11671, 0.17545, 0.12295 | 0.11670, 0.17545, 0.12296 |
  | lymphatic       | 0.16302, 0.26509, 0.15889 | 0.16302, 0.26509, 0.15888 |

- Y-up orientation and origin unchanged

### GLB validity

- All 9 files in `optimized/` (8 new + existing nervous) pass `npx gltf-transform validate`:
  no errors, no warnings
- Two info-level notices on every meshopt file (expected, same as nervous):
  `UNSUPPORTED_EXTENSION` (validator does not implement `EXT_meshopt_compression` deep
  validation) and `UNUSED_OBJECT /buffers/0` (standard meshopt buffer layout heuristic)

## Problems

No failures. One documented tool behavior (also present in the Step 8.5 nervous test):

- glTF-Transform v4 bakes the Meshopt dequantization transform into node TRS values.
  For most meshes this modifies the existing named node's translation/scale (name and
  extras untouched). For 6 musculoskeletal meshes (rectus femoris L/R, femur L/R,
  intercondylar fossa L/R) an intermediate unnamed child node carries the mesh plus the
  combined transform; the parent keeps its name and ontology extras. JSON node count is
  therefore slightly higher in some outputs (musculoskeletal 154→160, respiratory 98→101,
  digestive 81→84, urinary 108→109); all other systems unchanged. No anatomical structure
  was merged, renamed, removed or duplicated anatomically — world placement verified equal.

## Source integrity after batch

- Original HRA source SHA-256: `34C45C90AA4ACD36BE19EDF8B878A8E7137DB9E8CB90E8E6332C2ABD49D7CF9D` (unchanged)
- All 9 working GLBs byte-identical to pre-batch hashes
- `nervous-meshopt.glb` byte-identical (13,449,672 bytes)
