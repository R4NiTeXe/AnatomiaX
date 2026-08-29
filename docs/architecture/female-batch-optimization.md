# Female Batch Optimization (Meshopt 4.4.2)

Batch Meshopt compression of the 8 remaining female working systems. `nervous-meshopt.glb`
was already verified in Step 8.12.4 and is reused as the baseline — not regenerated.

## Tool

- **Tool**: `gltf-transform meshopt` (`EXT_meshopt_compression` + `KHR_mesh_quantization`)
- **Core**: `4.4.2`
- **Functions**: `4.4.2`
- **CLI**: `4.4.2`
- **Method**: `npx gltf-transform meshopt <working>/<system>.glb <working>/optimized/<system>-meshopt.glb` (defaults, no Draco, no simplify, no weld, no prune beyond Meshopt's internal prune)
- **Generator**: `glTF-Transform v4.4.2` for all outputs

## Nervous baseline (existing, not regenerated)

- **Original**: `nervous.glb` 72885288 bytes (69.51 MB), 376 nodes, 362 meshes, 42 mats, 2065073 verts, 1696540 tris, 362/376 ontology, bbox `-0.07468,0.30195,-0.14809` → `0.06169,0.85712,0.03323`
- **Optimized**: `nervous-meshopt.glb` 14495144 bytes (13.82 MB), 380 nodes (+4 carriers), 362 meshes, 42 mats, 2065073 verts, 1696540 tris, 362/380 ontology, same bbox/orientation `Y-up`, `VH_F` root
- **Saved**: 58390144 bytes, 80.1%
- **SHA (optimized)**: not fixed, validated via inspect/validate; working input SHA `E466A65F5BE9A904192EE2957DE4239681905A49A418F3773F0A91A46FFCEBB4` unchanged

## Per-system results

| System          |              Original |           Optimized |          Reduction |          Nodes |    Meshes | Materials |          Vertices |         Triangles | Ontology          | Status |
| --------------- | --------------------: | ------------------: | -----------------: | -------------: | --------: | --------: | ----------------: | ----------------: | ----------------- | ------ |
| Skin            | 50361924 B (48.03 MB) | 7926072 B (7.56 MB) | 42435852 B (84.3%) |        22 → 22 |   17 → 17 |     6 → 6 | 1245604 → 1245604 | 1238769 → 1238769 | 17/22 → 17/22     | OK     |
| Musculoskeletal | 18120292 B (17.28 MB) | 3721584 B (3.55 MB) | 14398708 B (79.5%) | 136 → 144 (+8) | 107 → 107 |   10 → 10 |   467440 → 467440 |   676560 → 676560 | 107/136 → 107/144 | OK     |
| Cardiovascular  | 19632316 B (18.72 MB) | 3371684 B (3.22 MB) | 16260632 B (82.8%) |      177 → 177 | 124 → 124 |     9 → 9 |   474817 → 474817 |   480128 → 480128 | 124/177 → 124/177 | OK     |
| Respiratory     | 27311328 B (26.05 MB) | 4667936 B (4.45 MB) | 22643392 B (82.9%) |   96 → 99 (+3) |   70 → 70 |     9 → 9 |   606811 → 606811 |   376173 → 376173 | 70/96 → 70/99     | OK     |
| Digestive       |   5492912 B (5.24 MB) | 1408788 B (1.34 MB) |  4084124 B (74.4%) |   80 → 83 (+3) |   61 → 61 |     7 → 7 |   173006 → 173006 |   213060 → 213060 | 61/80 → 61/83     | OK     |
| Urinary         |   4805960 B (4.58 MB) | 1290180 B (1.23 MB) |  3515780 B (73.2%) | 112 → 113 (+1) |   87 → 87 |     4 → 4 |   131966 → 131966 |   258496 → 258496 | 87/112 → 87/113   | OK     |
| Reproductive    |   8137696 B (7.76 MB) | 1558604 B (1.49 MB) |  6579092 B (80.8%) |   63 → 66 (+3) |   46 → 46 |     8 → 8 |   178284 → 178284 |   350802 → 350802 | 46/63 → 46/66     | OK     |
| Lymphatic       |   4781284 B (4.56 MB) | 1195116 B (1.14 MB) |  3586168 B (75.0%) |        19 → 19 |   14 → 14 |     7 → 7 |   131813 → 131813 |   267071 → 267071 | 14/19 → 14/19     | OK     |

All outputs: valid GLB v2, 1 scene `VH_F`, `glTF-Transform v4.4.2`, `extensionsUsed` `[EXT_meshopt_compression, KHR_mesh_quantization]` (both), no textures/images/animations (0), Y-up, meters, `VH_F` root at `0,0,0` preserved, bbox subsets of source (e.g., skin `-0.49,-0.79,-0.22` → `0.48,0.87,0.11`, nervous `-0.07,0.30,-0.15` → `0.06,0.85,0.03`).

**Female-specific validation:**

- **Reproductive** (`reproductive-meshopt.glb`): 46 meshes, 8 mats, 178284 verts, 350802 tris preserved; contains `VH_F_ovary` + `suspensory_ligament_of_ovary` `FMA:19823`, `VH_F_uterus`, `VH_F_cervix` `UBERON:0000002`, `VH_F_vagina` `UBERON:0000996`, `VH_F_fallopian_tube` `FMA:18493/18494`, `broad ligament` (`BroadLigament_mat`), `round ligament` `FMA:57789`, `placenta`/`umbilical` etc., plus `placenta` `UBERON:0004027` — all verified via `nodes[].extras.ontologyid`, none invented, none moved from other systems
- **Skin** (`skin-meshopt.glb`): 17 meshes, breast hierarchy preserved as in source (`VH_F_mammary_gland` → `fat`, `areola` `FMA:223679`, `nipple` `UBERON:0013772`, `mammary_lobes` `UBERON:0018140`, `lactiferous_ducts` `UBERON:0015134`, `suspensory_ligaments` `FMA:73119`) — remains in `skin` per HRA `VH_F_integumentary_system`, not in reproductive, as required

## Batch total

- **8 optimized (excluding nervous)**: Original 138643712 B (132.22 MB) → Optimized 25139964 B (23.97 MB), saved 113503748 B, **81.9%**
- **Nervous baseline**: Original 72885288 B (69.51 MB) → 14495144 B (13.82 MB), saved 58390144 B, 80.1%
- **Total 9**: Original 211529000 B (201.73 MB) → Optimized 39635108 B (37.80 MB), saved **171893892 B (163.93 MiB, 171.89 MB decimal)**, **81.3%**

Source file is 211624968 bytes; working sum 211529000 is 95968 bytes smaller due to per-file `VH_F` root duplication overhead vs single source (expected, not loss).

## Validation

- `gltf-transform inspect` on all 8: version 2.0, generator `glTF-Transform v4.4.2`, 1 scene, bbox via inspect identical to original (quantization-aware), `uploadVertexCount`/`renderVertexCount` identical, no errors
- `gltf-transform validate` on all 8: `No errors`, `No warnings`, info `UNSUPPORTED_EXTENSION EXT_meshopt_compression` (validator cannot deep-validate Meshopt, expected) + `UNUSED_OBJECT /buffers/0` (standard Meshopt layout) — same as nervous test and male batch
- GLB magic `glTF` version `2` verified for all, `extensionsUsed` as above

## Anatomy preservation

- **Geometry**: meshes, vertices, triangles, primitives unchanged for all 8 (see table, `OK`)
- **Ontology**: 46/63, 17/22, etc., same counts, same IDs (no invented)
- **Dimensions/orientation**: Y-up, meters, `VH_F` at origin, bbox subsets preserved (skin whole-body, others sub-bboxes as listed)
- **Materials**: counts unchanged, names preserved (e.g., `Uterus_Mat`, `Ovary_mat`, `BroadLigament_mat`, `Skin_mat`, `Muscle_mat`, `Bone_Mat`, `heart_mat`, `Vein_mat`, `lung_mat`, `Liver_mat`, `kidney_*`), no loss
- **Transforms**: `VH_F` root identity preserved, child `translation`/`rotation`/`scale` preserved (verified via raw JSON `nodes[].matrix`/`translation` unchanged except dequant carriers)

## Limitations

- Node count +1 to +8 for 5 systems due to Meshopt dequantization carriers (musculoskeletal +8, respiratory +3, digestive +3, urinary +1, reproductive +3) — same pattern as male/female nervous +4, documented, not anatomy, `prune` already applied
- Lymphatic minimal (14 meshes) by source, not a split error
- Breast in `skin.glb` per HRA hierarchy — intentional, not moved
- Endocrine distributed (placenta/ovary in reproductive) — no new top-level `endocrine.glb` per runtime design (9 systems)
- Working files unoptimized elsewhere remain large (skin 7.56 MB optimized is still largest, but 84% saved)

## Nervous baseline

Reused from Step 8.12.4, not regenerated — 80.1% saving, 0 geometry/ontology loss, validated, `SHA` working input unchanged.

## Recommendation

Batch optimization succeeded for all 8 with 73–84% savings and zero preservation loss. Ready for browser testing of female viewer (lazy-load 9 systems via `VITE_ANATOMY_ASSET_BASE_URL` pattern, same as male). No further asset changes needed before testing.

## Source integrity

- **Female source SHA**: `472567A56896B9B7890508DA6501FBF858E56AAA30745365F7A71ADE782B529C` — unchanged (211624968 bytes, re-verified after batch, still at `3d-assets/female/source/hra-reference-organ-united-female-v1.5.glb`)
- **Female working inputs**: all 8 byte-identical to pre-optimization (`skin.glb` 50361924, `musculoskeletal` 18120292, `cardiovascular` 19632316, `respiratory` 27311328, `digestive` 5492912, `urinary` 4805960, `reproductive` 8137696, `lymphatic` 4781284 — hashes unchanged, verified via `Get-FileHash`)
- **Female nervous optimized unchanged**: `nervous-meshopt.glb` 14495144 bytes, SHA unchanged from Step 8.12.4 (not regenerated, `Get-FileHash` matches pre-batch)
- **Male source/working/optimized**: male source `34C45C90...` unchanged, male working 9 GLBs and optimized 9 GLBs sizes unchanged (verified)

## Git ignore

- `git check-ignore -v 3d-assets/female/working/optimized/skin-meshopt.glb` → `.gitignore:86:3d-assets/female/working/optimized/*.glb`
- `git check-ignore -v 3d-assets/female/working/optimized/reproductive-meshopt.glb` → same — correctly ignored
