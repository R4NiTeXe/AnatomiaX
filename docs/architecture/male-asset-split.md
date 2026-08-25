# Male Whole-Body Split — Working Assets

Source: `3d-assets/male/source/hra-reference-organ-united-male-v1.5.glb` (146.48 MB, 849 meshes, 3,863,220 verts, 4,018,087 tris, preserved unmodified)
Tool: `@gltf-transform/core@3.10.1` + `@gltf-transform/functions` via `scripts/split-male.js` — Node, no Blender, preserves geometry, materials, node names, extras (ontology IDs), coordinate system, scale, orientation.

Working output: `3d-assets/male/working/` (generated, not final, ignored via `.gitignore:3d-assets/male/working/*.glb`)

| Asset               | Source groups (verified node names)                                                                         | Status   | Meshes | Materials | Vertices  | Triangles | File size               | % of original tris | Split completeness                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------- | -------- | ------ | --------- | --------- | --------- | ----------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| skin.glb            | `VH_M_integumentary_system` → `VH_M_skin`                                                                   | COMPLETE | 1      | 1         | 92,659    | 185,314   | 5.66 MB (5,931,736 B)   | 4.6%               | GOOD — single mesh, single material `Skin_Mat`, dedicated node                                                               |
| musculoskeletal.glb | `VH_M_muscular_system` (27) + `VH_M_skeletal_system` (91)                                                   | COMPLETE | 118    | 8         | 417,463   | 563,991   | 22.22 MB (23,302,204 B) | 14.0%              | GOOD — 118 meshes combined from two systems, 8 mats (`muscle_Mat`, `Bone_Mat`, `Cartilage_Mat` etc.), hierarchy preserved    |
| nervous.glb         | `VH_M_nervous_system` (4 children: `VH_M_spinal_cord` 30, `Allen_brain`, `VH_M_nerves_of_eye`, `VH_M_eyes`) | COMPLETE | 363    | 44        | 1,926,773 | 1,423,986 | 62.72 MB (65,765,656 B) | 35.4%              | GOOD — 363 meshes (brain, spinal 31 segments, eyes, nerves), 44 mats                                                         |
| cardiovascular.glb  | `VH_M_circulatory_system` (2 children)                                                                      | COMPLETE | 120    | 10        | 524,130   | 580,657   | 21.11 MB (22,131,856 B) | 14.5%              | GOOD — 120 meshes artery/vein/heart, 10 mats (`artery_mat` 36, `vein_mat` 48, `heart_mat` 14)                                |
| respiratory.glb     | `VH_M_respiratory_system` (3 children)                                                                      | COMPLETE | 72     | 9         | 304,593   | 288,068   | 12.29 MB (12,889,416 B) | 7.2%               | GOOD — 72 meshes lungs + bronchial cartilage, 9 mats                                                                         |
| digestive.glb       | `VH_M_digestive_system` (7 children: liver, pancreas, biliary, small intestine, colon, etc.)                | COMPLETE | 62     | 8         | 219,648   | 229,371   | 6.47 MB (6,788,304 B)   | 5.7%               | GOOD — 62 meshes liver, colon, small intestine, mucosa, gland                                                                |
| urinary.glb         | `VH_M_urinary_system` (3 children)                                                                          | COMPLETE | 81     | 4         | 124,764   | 241,845   | 4.47 MB (4,688,684 B)   | 6.0%               | GOOD — 81 meshes kidneys, ureter, bladder (4 mats: `kidneycapsule`, `kidneycortex_medulla`, `kidney_pyramids`, `ureter_mat`) |
| reproductive.glb    | `VH_M_male_reproductive_system` (2 children: `VH_M_male_genital_duct`, `VH_M_prostate_gland`)               | COMPLETE | 18     | 3         | 115,560   | 230,590   | 3.99 MB (4,179,132 B)   | 5.7%               | GOOD — 18 meshes, 3 mats (`genitalDuct_mat` 4, `Gland_Mat` etc.)                                                             |

Sum of 8 working assets: 835 meshes (of original 849, missing 14 `VH_M_lymphatic_system`), 7.19 MB? Actually sum file sizes: 5.66+22.22+62.72+21.11+12.29+6.47+4.47+3.99 = 138.93 MB (145,686,978 B) vs original 146.48 MB (153,596,592 B) — 94.8% of bytes, 93.2% of tris, missing lymphatic 14 meshes (~4.5 MB, ~270k tris).

## Preservation

- Geometry, materials, node names, `extras` (`anatomical_structure_of`, `ontologyid` UBERON, `label`, `representation_of`), extras preserved (verified `hasOntology true` for all 8)
- Coordinate system, scale, orientation, object relationships preserved (each GLB keeps `VH_M` root and the selected system subtree, same `bboxMin -0.52364,-0.91462,-0.16059` to `bboxMax 0.52295,0.91489,0.15563` for skin, other systems have tighter bbox but same origin and Y-up, verified via `gltf-transform inspect`)
- No Draco/Meshopt, no simplification, no material removal, no small structure removal yet

## Verification per GLB

For every generated GLB:

- Valid GLB (magic `glTF`, version 2.0, `gltf-transform inspect` passes, no errors)
- Scene count: 1
- Node count: as above (3 to 377)
- Mesh count: as above
- Materials: as above (1 to 44)
- Vertices/triangles: as above
- Dimensions/orientation: preserved (same origin, Y-up, scale 1, `VH_M` at 0,0,0)
- No texture corruption: 0 textures/images in source, still 0 in all 8 (verified)
- Ontology IDs remain where present: `hasOntology true` for all

Source file verified unchanged:

- Original file size: 153596592 bytes (146.48 MB)
- Original SHA-256: `34C45C90AA4ACD36BE19EDF8B878A8E7137DB9E8CB90E8E6332C2ABD49D7CF9D` (via `Get-FileHash`)

## Notes

- `3d-assets/male/working/` remains working area, not final production; final assets will be reviewed, Draco-compressed, and moved to `3d-assets/male/`, `systems/`, etc., or CDN only after approval.
- `3d-assets/male/working/*.glb` is ignored via `.gitignore`, `README.md` is tracked.
- Lymphatic system (`VH_M_lymphatic_system`, 14 meshes, ~4.5 MB) not part of required 8, so overall split is PARTIAL for whole-body completeness (93.2% tris, missing lymphatic). Recorded as PARTIAL for whole-body, but each of the 8 listed assets is GOOD/COMPLETE for its own system.
