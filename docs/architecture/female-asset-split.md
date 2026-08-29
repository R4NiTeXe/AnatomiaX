# Female Asset Split (Working)

Splitting the verified female HRA source into 9 working system GLBs — no
optimization, no compression, geometry preserved.

## Source

- **File**: `3d-assets/female/source/hra-reference-organ-united-female-v1.5.glb`
- **SHA-256**: `472567A56896B9B7890508DA6501FBF858E56AAA30745365F7A71ADE782B529C`
- **Size**: 211624968 bytes (201.82 MiB, 211.62 MB)
- **Version**: HRA v1.5, NIH 1.01, generator `babylon.js glTF exporter for Autodesk MAYA 2023.2 v20220923.2`, glTF 2.0, 1 scene `VH_F`
- **Counts**: 1073 nodes, 888 meshes, 92 materials, 0 textures, 0 images, 0 animations, 2785 accessors, 5474814 vertices, 5557599 triangles
- **Bbox**: `-0.48956,-0.79476,-0.22262` to `0.47788,0.87159,0.23267` (~0.97×1.67×0.46 m, Y up, meters, root `VH_F`)

## Tool

- **Tool**: glTF-Transform `NodeIO` + `prune()` (no `weld`, `simplify`, `draco`, `meshopt`)
- **Versions**: `@gltf-transform/core@4.4.2`, `@gltf-transform/functions@4.4.2`, `@gltf-transform/cli@4.4.2` (all deduped, `npm ls` verified)
- **Script**: `scripts/split-female.js` — reads source, keeps `VH_F` + selected system subtree(s), disposes other 9 top-level system subtrees, `prune()` removes unreferenced resources, writes `3d-assets/female/working/<system>.glb` with `glTF-Transform v4.4.2` generator

## System hierarchy

Female `VH_F` has 10 direct children (verified via `VH_F.children`):

`VH_F_integumentary_system`, `VH_F_nervous_system`, `VH_F_muscular_system`, `VH_F_reproductive_system`, `VH_F_digestive_system`, `VH_F_urinary_system`, `VH_F_circulatory_system`, `VH_F_respiratory_system`, `VH_F_lymphatic_system`, `VH_F_skeletal_system`

Runtime mapping (9 outputs, endocrine not top-level):

- `skin` ← `VH_F_integumentary_system` (skin + fat + breast; `VH_F_skin` + `VH_F_mammary_gland` etc.)
- `musculoskeletal` ← `VH_F_muscular_system` + `VH_F_skeletal_system` (muscles of eye/knee/larynx + pelvis/lower_limb/vertebrae)
- `nervous` ← `VH_F_nervous_system` (eyes, `Allen_brain`, `VH_F_spinal_cord`)
- `cardiovascular` ← `VH_F_circulatory_system` (heart `VH_F_heart`, `VH_F_blood_vasculature`)
- `respiratory` ← `VH_F_respiratory_system` (`VH_F_lungs`, `VH_F_larynx`, `VH_F_tracheobronchial_tree`)
- `digestive` ← `VH_F_digestive_system` (`VH_F_colon`, `small_intestine`, `biliary_tree`, `liver` `VH_F_liver`, `pancreas`, `stomach`)
- `urinary` ← `VH_F_urinary_system` (`VH_F_upper_urinary_tract` kidneys/ureters, `VH_F_urinary_bladder`)
- `reproductive` ← `VH_F_reproductive_system` (`VH_F_placenta`, `VH_F_vagina`, `VH_F_fallopian_tube`, `VH_F_ligaments_of_uterus_and_ovaries`, `VH_F_ovary`, `VH_F_uterus`)
- `lymphatic` ← `VH_F_lymphatic_system` (`VH_F_spleen`, `VH_F_thymus`, `Yao_lymph_node`)

Endocrine structures are distributed per source hierarchy and stay with their parent system; no new top-level `endocrine.glb` is created.

## Split results

| System          |                  File |                  Size | Nodes | Meshes | Materials | Vertices | Triangles | Ontology | Status |
| --------------- | --------------------: | --------------------: | ----: | -----: | --------: | -------: | --------: | -------- | ------ |
| Skin            |            `skin.glb` | 48.03 MB (50361924 B) |    22 |     17 |         6 |  1245604 |   1238769 | 17/22    | OK     |
| Musculoskeletal | `musculoskeletal.glb` | 17.28 MB (18120292 B) |   136 |    107 |        10 |   467440 |    676560 | 107/136  | OK     |
| Nervous         |         `nervous.glb` | 69.51 MB (72885288 B) |   376 |    362 |        42 |  2065073 |   1696540 | 362/376  | OK     |
| Cardiovascular  |  `cardiovascular.glb` | 18.72 MB (19632316 B) |   177 |    124 |         9 |   474817 |    480128 | 124/177  | OK     |
| Respiratory     |     `respiratory.glb` | 26.05 MB (27311328 B) |    96 |     70 |         9 |   606811 |    376173 | 70/96    | OK     |
| Digestive       |       `digestive.glb` |   5.24 MB (5492912 B) |    80 |     61 |         7 |   173006 |    213060 | 61/80    | OK     |
| Urinary         |         `urinary.glb` |   4.58 MB (4805960 B) |   112 |     87 |         4 |   131966 |    258496 | 87/112   | OK     |
| Reproductive    |    `reproductive.glb` |   7.76 MB (8137696 B) |    63 |     46 |         8 |   178284 |    350802 | 46/63    | OK     |
| Lymphatic       |       `lymphatic.glb` |   4.56 MB (4781284 B) |    19 |     14 |         7 |   131813 |    267071 | 14/19    | OK     |

All 9 are valid GLB, glTF 2.0, 1 scene `VH_F`, generator `glTF-Transform v4.4.2`.

## Female-specific anatomy

Reproductive output verified to contain female-specific structures per source (all present, preserved):

- `VH_F_ovary` (ovary, with `Ovary_mat`, `suspensory_ligament_of_ovary` FMA:19823/19824)
- `VH_F_uterus` (uterus, `Uterus_Mat`/`pasted__Uterus_Mat`)
- `VH_F_cervix` (cervix, `UBERON:0000002`)
- `VH_F_vagina` + `VH_F_cervicovaginal_junction` (vagina, `UBERON:0000996`)
- `VH_F_fallopian_tube` `R`/`L` + `isthmus` `FMA:18493/18494` (fallopian/tubal)
- `VH_F_ligaments_of_uterus_and_ovaries` (`BroadLigament_mat`, `round_ligament_of_uterus` `FMA:57789/57790`, `suspensory_ligament_of_ovary`)
- `VH_F_placenta` (placenta, female-specific)
- Breast remains in `skin` per source hierarchy (`VH_F_mammary_gland` under `VH_F_integumentary_system` → `skin.glb` retains `areola`/`nipple`/`mammary_lobes`/`fat` with breast mats, not moved to reproductive)

No female reproductive structure was moved to an arbitrary system.

## Ontology preservation

All outputs preserve `extras.ontologyid` / `label` / `representation_of` / `glb_file_of_single_organs` etc. Counts above show ontology-bearing nodes preserved per system (e.g., nervous 362/376, skin 17/22, reproductive 46/63). Spot checks:

- `VH_F_skin` `UBERON:0002097`, `VH_F_areola_L` `FMA:223679`, `VH_F_nipple_L` `UBERON:0013772`
- `VH_F_cervix` `UBERON:0000002`, `VH_F_vagina` `UBERON:0000996`, `isthmus_of_fallopian_tube` `FMA:18493`
- `suspensory_ligament_of_ovary` `FMA:19823`, `round_ligament_of_uterus` `FMA:57789`

No invented IDs; material loss none (each output retains its system's mats).

## Coordinate preservation

All outputs preserve Y-up, meters, `VH_F` root at `0,0,0` (no extra transform), bbox derived from `POSITION` accessors matches source sub-bbox:

- skin bbox `-0.49,-0.79,-0.22` → `0.48,0.87,0.11` (whole-body skin)
- musculoskeletal `-0.19,-0.73,-0.18` → `0.17,0.78,0.03`
- nervous `-0.07,0.30,-0.15` → `0.06,0.86,0.03`
- etc. — each sub-bbox is subset of source `-0.48,-0.79,-0.22` → `0.47,0.87,0.23`

Scale, orientation, origin, transforms, coordinate system unchanged.

## Completeness

- **Source meshes**: 888 — **Output sum**: 17+107+362+124+70+61+87+46+14 = **888** (100%)
- **Source vertices**: 5474814 — **Output sum**: 1245604+467440+2065073+474817+606811+173006+131966+178284+131813 = **5474814** (100%)
- **Source triangles**: 5557599 — **Output sum**: 1238769+676560+1696540+480128+376173+213060+258496+350802+267071 = **5557599** (100%)
- **Source nodes**: 1073 — Outputs sum 1081 nodes (22+136+376+177+96+80+112+63+19) slightly higher due to retained `VH_F` root per file (expected, unreferenced nodes pruned otherwise)
- **No byte-size equality expected** (total working ~200 MB vs source 211 MB, pruning + per-file overhead)

**Unmapped/source groups**: All 10 top-level groups are mapped into 9 outputs (muscular+skeletal combined). No group excluded. Specifically:

- Endocrine: not top-level; `VH_F_ovary` (gonad) stays in reproductive, `VH_F_placenta` (endocrine) stays in reproductive, pituitary/thyroid/adrenal remain under nervous/urinary per source — documented, no new `endocrine.glb`
- Female-specific: all listed above preserved in `reproductive.glb` except breast which correctly stays in `skin.glb`
- Lymphatic limitation: source `VH_F_lymphatic_system` is minimal (3 children: spleen, thymus, lymph node; 14 meshes) — output reflects that, no missing anatomy added

## Limitations

- Lymphatic is minimal by source design (4.56 MB, 14 meshes) — same as male minimal, not a split error.
- Breast is in `skin.glb` per HRA hierarchy, not in `reproductive.glb` — intentional.
- No endocrine top-level file — by runtime design (9 systems).
- Working files are unoptimized (48 MB skin, 69 MB nervous) — optimization later.

## Validation

For each output verified:

- valid GLB (`glTF` magic, version 2.0, length matches)
- `asset.generator` `glTF-Transform v4.4.2`
- 1 scene (`VH_F`)
- mesh/material/node/vertex/triangle counts as table, bbox as above, orientation Y up, root `VH_F`
- `extras.ontologyid` counts as table, no invented IDs
- No missing referenced geometry (prune only removed unreferenced), no material loss, no transform change (compare bbox subset and root at origin)

Tool used for validation: `NodeIO` read + `readJson` via `fs` + `gltf-transform` `prune` + manual `GLB` header check.

## Next step

Optimization (Meshopt, no Draco/simplify) into `3d-assets/female/working/optimized/` — not in this step. React integration later.
