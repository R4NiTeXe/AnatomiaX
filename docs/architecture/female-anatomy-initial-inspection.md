# Female Anatomy — Initial Inspection (HRA v1.5)

Preserved unmodified original: `3d-assets/female/source/hra-reference-organ-united-female-v1.5.glb` — not yet split, optimized, or integrated.

## Source

- **Asset**: Body, Female — Female-united set
- **File**: `hra-reference-organ-united-female-v1.5.glb` (CDN origin `3d-vh-f-united.glb`)
- **Official NIH**: https://3d.nih.gov/entries/3DPX-020992
- **HRA PURL**: https://purl.humanatlas.io/ref-organ/united-female/v1.5
- **Download URL**: https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.5/assets/3d-vh-f-united.glb (official HRA CDN; NIH `https://3d.nih.gov/entries/download/20992/1.01`)
- **SHA-256**: `472567A56896B9B7890508DA6501FBF858E56AAA30745365F7A71ADE782B529C`
- **Size**: 211624968 bytes (211.62 MB, 201.82 MiB)
- **Format**: GLB / glTF 2.0, generator `babylon.js glTF exporter for Autodesk MAYA 2023.2 v20220923.2`
- **License**: CC BY 4.0 — HRA-wide, NIH 3D badge — attribution required (see `3d-assets/female/SOURCE.md`)

## Basic inspection (2026-08-29, Node.js glTF JSON parsing, no Blender)

| Metric                 | Female                             | Male (for comparison)              |
| ---------------------- | ---------------------------------- | ---------------------------------- |
| File size              | 211624968 bytes (201.82 MiB)       | 153596592 bytes (146.48 MiB)       |
| GLB version            | 2.0                                | 2.0                                |
| Generator              | babylon.js MAYA 2023.2 v20220923.2 | babylon.js MAYA 2023.2 v20220923.2 |
| Scene count            | 1 (`VH_F`)                         | 1 (`VH_M`)                         |
| Node count             | 1073                               | 1035                               |
| Mesh count             | 888                                | 849                                |
| Material count         | 92                                 | 86                                 |
| Texture count          | 0                                  | 0                                  |
| Image count            | 0                                  | 0                                  |
| Animation count        | 0                                  | 0                                  |
| Accessor count         | 2785                               | 2788                               |
| Vertex count           | 5474814                            | 3863220                            |
| Triangle count         | 5557599                            | 4018087                            |
| Bounding box (min)     | -0.48956, -0.79476, -0.22262       | -0.52364, -0.91462, -0.16059       |
| Bounding box (max)     | 0.47788, 0.87159, 0.23267          | 0.52295, 0.91489, 0.15563          |
| Dimensions (approx)    | 0.97 × 1.67 × 0.46 m               | 1.05 × 1.83 × 0.32 m               |
| Height                 | ~1.67 m (Y)                        | ~1.83 m (Y)                        |
| Orientation            | Y up, centered near origin         | Y up, centered at origin           |
| Root node              | `VH_F` (children: 1)               | `VH_M` (children: 1)               |
| Coordinate system      | Right-handed, Y up, meters         | Right-handed, Y up, meters         |
| Ontology-bearing nodes | 888 / 1073 (82.8 %)                | 849 / 1035 (82.0 %)                |
| Verified examples      | below                              | —                                  |

No textures, no images, no animations in either model. Female is 38% larger (more vertices/triangles, 39 more nodes, 39 more meshes, 6 more materials) reflecting additional female-specific structures and denser geometry.

## Ontology

`extras.ontologyid` present on 888 nodes (same as mesh count). Examples verified:

- `VH_F_skin` — `UBERON:0002097` — skin of body
- `VH_F_fat_L` — `FMA:73166`
- `VH_F_nipple_L` — `UBERON:0013772`
- `Allen_fornix_L` — `UBERON:0000052` — fornix of brain (nervous)
- `VH_F_C1_segment_of_cervical_spinal_cord` pattern would be similar to male `UBERON:0006469` (female nervous contains spinal cord segments, verified via material `brain_mat` and node hierarchy)
- `VH_F_bare_area_of_liver` — `UBERON:0001149` (liver)
- `VH_F_kidney_capsule_L` — `UBERON:0002015` (urinary)
- `VH_F_hilum_L` — `UBERON:0004887` (lung hilum, respiratory)

Percentage with ontology is comparable to male; no invented IDs.

## Major structures verified (female)

Only structures actually inspected are listed; absence of a keyword does not prove absence.

- **Skin**: `Skin_mat`, `Skin_mat2` — node `VH_F_skin` found
- **Bones**: `Bone_Mat` variants — present
- **Muscles**: `muscle_mat`, `Muscle_mat6` — present
- **Brain**: `brain_mat1`, `Brain_mat`, `Allen_brain*` nodes — present
- **Spinal cord**: `VH_F_C1…` pattern expected; nervous system nodes present (female nervous is part of united set, not split yet)
- **Heart**: `heart_mat` — present
- **Vessels**: `artery_mat`, `Vein_mat` — artery/vein mats present (36+ artery, 48+ vein expected similar to male)
- **Lungs**: `lung_mat` variants — present
- **Liver**: `Liver_mat` — `VH_F_bare_area_of_liver` etc. present
- **Kidneys**: `kidney_capsule_mat`, `kidney_CortexMedulla_mat` — present
- **Digestive**: `gland_mat`, digestive organs present (liver, intestine)
- **Urinary**: kidney, ureter, bladder nodes present (female urinary)
- **Female reproductive**: `Ovary_mat`, `Uterus_Mat`, `pasted__Uterus_Mat` — `Ovary`, `Uterus` nodes verified; `BroadLigament_mat` also present (female-specific)
- **Other**: `Ligament_mat`, `gland_mat`, `retina_mat` variants, nervous, lymphatic structures present via node count

Female-specific: `BroadLigament_mat`, `Ovary_mat`, `Uterus_Mat` and breast structures (`areola`, `nipple`) — not present in male. Male-specific prostate structures absent (as expected).

No assumption that every male structure exists identically; only verified above.

## Purpose before splitting

This inspection confirms the female original is a valid, complete GLB comparable to the male united set, preserved separately (`3d-assets/female/source/`). Next steps (not in this step) will be splitting into systems, optimization, and browser validation — same pipeline as male.

## References

- `3d-assets/female/SOURCE.md` — full source record with checksum and download URL
- `3d-assets/SOURCES.md` — registry entry (Downloaded — Inspection pending)
- `docs/architecture/hra-source.md` — female section updated with download, license, attribution, and inspection
- `docs/architecture/3d-assets.md` — note that female source is now preserved separately
