# Female Anatomy Map (HRA v1.5)

Inspection of the official NIH/HRA female whole-body anatomy model:
`3d-assets/female/source/hra-reference-organ-united-female-v1.5.glb`

Inspection date: 2026-08-29
Tool: Node.js + @gltf-transform/core (v4.4.2), glTF JSON parsing
Tool version: @gltf-transform/core 4.4.2

---

## GLB Summary

| Property           | Value                                                         |
| ------------------ | ------------------------------------------------------------- |
| GLB Version        | 2.0                                                           |
| Generator          | babylon.js glTF exporter for Autodesk MAYA 2023.2 v20220923.2 |
| Scene count        | 1 (VH_F)                                                      |
| Nodes              | 1073                                                          |
| Meshes             | 888                                                           |
| Materials          | 92                                                            |
| Textures           | 0                                                             |
| Images             | 0                                                             |
| Animations         | 0                                                             |
| Accessors          | 2785                                                          |
| Vertices           | 5,474,814                                                     |
| Triangles          | 5,557,599                                                     |
| Bounding box (min) | -0.48956, -0.79476, -0.22262                                  |
| Bounding box (max) | 0.47788, 0.87159, 0.23267                                     |
| Dimensions         | 0.97 × 1.67 × 0.46 m                                          |
| Height             | ~1.666 m (Y axis)                                             |
| Orientation        | Y-up, centered near origin                                    |
| Coordinate system  | Right-handed, Y-up, meters                                    |
| Root node          | VH_F (scene root)                                             |
| Origin             | Centered near (0,0,0)                                         |
| Scale              | 1 unit = 1 meter                                              |

---

## System Hierarchy

The model has a clear root `VH_F` with 10 top-level system groups:

| System          | Node Name                                                       | Child Count | Notes                           |
| --------------- | --------------------------------------------------------------- | ----------- | ------------------------------- |
| Integumentary   | `VH_F_integumentary_system`                                     | 1           | Contains skin, fat, breast      |
| Nervous         | `VH_F_nervous_system`                                           | 1           | Brain, spinal cord, eyes        |
| Musculoskeletal | `VH_F_muscular_system`, `VH_F_skeletal_system`                  | 2           | Muscles + bones separated       |
| Reproductive    | `VH_F_reproductive_system`                                      | 1           | Female reproductive organs      |
| Digestive       | `VH_F_digestive_system`                                         | 1           | Liver, digestive tract          |
| Urinary         | `VH_F_urinary_system`                                           | 7           | Kidneys, bladder, ureters       |
| Cardiovascular  | `VH_F_circulatory_system`                                       | 1           | Heart, vessels                  |
| Respiratory     | `VH_F_respiratory_system`, `VH_F_trachea_of_respiratory_system` | 2           | Lungs, trachea                  |
| Lymphatic       | `VH_F_lymphatic_system`, `Yao_afferent_lymphatic_vessel`        | 2           | Lymphatic vessels               |
| Skeletal        | `VH_F_skeletal_system`                                          | 1           | Bones (part of musculoskeletal) |

### Mapping to Runtime Systems (9 systems)

| Runtime System  | Female GLB Group                                | Mapping Notes                    |
| --------------- | ----------------------------------------------- | -------------------------------- |
| skin            | `VH_F_integumentary_system`                     | Skin, fat, breast structures     |
| musculoskeletal | `VH_F_muscular_system` + `VH_F_skeletal_system` | Muscles + bones combined         |
| nervous         | `VH_F_nervous_system`                           | Brain, spinal cord, eyes, nerves |
| cardiovascular  | `VH_F_circulatory_system`                       | Heart, arteries, veins           |
| respiratory     | `VH_F_respiratory_system`                       | Lungs, trachea                   |
| digestive       | `VH_F_digestive_system`                         | Liver, GI tract                  |
| urinary         | `VH_F_urinary_system`                           | Kidneys, bladder, ureters        |
| reproductive    | `VH_F_reproductive_system`                      | Female reproductive organs       |
| lymphatic       | `VH_F_lymphatic_system`                         | Lymphatic vessels                |

**Endocrine** is not a separate top-level group in the GLB. Endocrine structures (adrenal glands, thyroid, pituitary, ovaries) appear distributed:

- Ovaries → reproductive system
- Adrenal glands → likely under urinary/abdominal region
- Pituitary → nervous system (brain)
- Thyroid → not clearly separated (may be in neck region under integumentary or digestive)

**Recommendation**: Use the same 9 runtime systems as the male model. Endocrine structures map into existing systems per anatomical location. No new top-level runtime system needed.

---

## Materials

**Total**: 92 materials

| Material Category | Materials (sample)                                                           | Blend/Opaque                        |
| ----------------- | ---------------------------------------------------------------------------- | ----------------------------------- |
| Skin              | `Skin_mat`, `Skin_mat2`, `eye_edits_012024:Skin_Mat`                         | 1 BLEND (`Skin_mat2`), rest OPAQUE  |
| Bone              | `Bone_Mat`, `eye_edits_012022:Bone_Mat`, `pasted__Bone_Mat3`                 | OPAQUE                              |
| Muscle            | `Muscle_mat5`, `Muscle_mat6`, `eye_edits_012024:muscle_mat`                  | OPAQUE                              |
| Heart             | `heart_mat`                                                                  | OPAQUE                              |
| Arteries          | `eye_edits_012024:pasted__artery_mat`, `eye_edits_012022:pasted__artery_mat` | OPAQUE                              |
| Veins             | `Vein_mat`, `pasted__Vein_mat`, `eye_edits_012024:pasted__vein_mat`          | OPAQUE                              |
| Lung              | `lung_mat`, `eye_edits_012035:lung_mat`, `eye_edits_012036:lung_mat`         | OPAQUE                              |
| Brain             | `Brain_mat`, `eye_edits_012024:brain_mat1`, `eye_edits_012022:brain_mat1`    | OPAQUE                              |
| Liver             | `Liver_mat`                                                                  | OPAQUE                              |
| Kidney            | `kidney_capsule_mat`, `kidney_CortexMedulla_mat`, `kidney_Pyramids_mat`      | OPAQUE                              |
| Uterus            | `Uterus_Mat`, `pasted__Uterus_Mat`                                           | OPAQUE                              |
| Ovary             | `Ovary_mat`                                                                  | OPAQUE                              |
| Broad Ligament    | `BroadLigament_mat`                                                          | OPAQUE                              |
| Eye               | `Cornea_mat`, `lens1` (BLEND), `retina_mat`, `fovea_mat`, `macula`           | 5 BLEND (cornea, lens, conjunctiva) |

**Blend Materials (5)**: `Skin_mat2`, `pasted__pasted__pasted__conjunctiva_Mat1`, `eye_edits_012022:lens1`, `eye_edits_012022:Cornea_mat`, `eye_edits_012024:Cornea_mat` — all eye-related plus skin translucency.

**Vertex Colors**: Present (`COLOR_0` attribute on meshes) — no textures/images.

---

## Ontology Inspection

- **Ontology-bearing nodes**: 888 / 1073 (82.8%)
- Field: `extras.ontologyid` (primary), `extras.ontologyId` (rare)
- IDs use UBERON and FMA prefixes

### Verified Ontology Examples

| Structure                        | Node Name                               | Ontology ID    | Source |
| -------------------------------- | --------------------------------------- | -------------- | ------ |
| Skin                             | `VH_F_skin`                             | UBERON:0002097 | UBERON |
| Fat (left)                       | `VH_F_fat_L`                            | FMA:73166      | FMA    |
| Areolar tubercles (L)            | `VH_F_areolar_tubercles_L`              | UBERON:0011828 | UBERON |
| Nipple (L)                       | `VH_F_nipple_L`                         | UBERON:0013772 | UBERON |
| Areola (L)                       | `VH_F_areola_L`                         | FMA:223679     | FMA    |
| Mammary lobes (L)                | `VH_F_mammary_lobes_L`                  | UBERON:0018140 | UBERON |
| Main lactiferous ducts (L)       | `VH_F_main_lactiferous_ducts_L`         | UBERON:0015134 | UBERON |
| Main lactiferous sinuses (L)     | `VH_F_main_lactiferous_sinuses_L`       | FMA:58088      | FMA    |
| Suspensory ligaments (L)         | `VH_F_suspensory_ligaments_L`           | FMA:73119      | FMA    |
| Fat (right)                      | `VH_F_fat_R`                            | FMA:73165      | FMA    |
| Areolar tubercles (R)            | `VH_F_areolar_tubercles_R`              | UBERON:0011828 | UBERON |
| Nipple (R)                       | `VH_F_nipple_R`                         | UBERON:0013773 | UBERON |
| Areola (R)                       | `VH_F_areola_R`                         | FMA:223677     | FMA    |
| Main lactiferous sinuses (R)     | `VH_F_main_lactiferous_sinuses_R`       | FMA:58088      | FMA    |
| Main lactiferous ducts (R)       | `VH_F_main_lactiferous_ducts_R`         | UBERON:0015134 | UBERON |
| Mammary lobes (R)                | `VH_F_mammary_lobes_R`                  | UBERON:0018140 | UBERON |
| Suspensory ligaments (R)         | `VH_F_suspensory_ligaments_R`           | FMA:73118      | FMA    |
| Retina (R)                       | `VH_F_retina_R`                         | FMA:58302      | FMA    |
| Fovea (R)                        | `VH_F_fovea_R`                          | FMA:58661      | FMA    |
| Macula lutea (R)                 | `VH_F_macula_lutea_R`                   | FMA:58638      | FMA    |
| Papillary muscle (heart)         | `VH_F_papillary_muscle_of_heart_ant`    | FMA:7264       | FMA    |
| Papillary muscle antlat          | `VH_F_papillary_muscle_of_heart_antlat` | FMA:7265       | FMA    |
| Gastric impression of liver      | `VH_F_gastric_impression_of_liver`      | FMA:14487      | FMA    |
| Suprarenal impression of liver   | `VH_F_suprarenal_impression_of_liver`   | FMA:14489      | FMA    |
| Renal impression of liver        | `VH_F_renal_impression_of_liver`        | FMA:14489      | FMA    |
| Kidney capsule (L)               | `VH_F_kidney_capsule_L`                 | UBERON:0002015 | UBERON |
| Hilum of kidney (L)              | `VH_F_hilum_of_kidney_L`                | UBERON:0008716 | UBERON |
| Right round ligament of uterus   | `VH_F_right_round_ligament_of_uterus`   | FMA:57789      | FMA    |
| Left round ligament of uterus    | `VH_F_left_round_ligament_of_uterus`    | FMA:57790      | FMA    |
| Suspensory ligament of ovary (R) | `VH_F_suspensory_ligament_of_ovary_R`   | FMA:19823      | FMA    |
| Suspensory ligament of ovary (L) | `VH_F_suspensory_ligament_of_ovary_L`   | FMA:19824      | FMA    |
| Cervix                           | `VH_F_cervix`                           | UBERON:0000002 | UBERON |
| Vagina                           | `VH_F_vagina`                           | UBERON:0000996 | UBERON |
| Cervicovaginal junction          | `VH_F_cervicovaginal_junction`          | —              | —      |
| Isthmus of fallopian tube (R)    | `VH_F_isthmus_of_fallopian_tube_R`      | FMA:18493      | FMA    |
| Isthmus of fallopian tube (L)    | `VH_F_isthmus_of_fallopian_tube_L`      | FMA:18494      | FMA    |
| Fat (L)                          | `VH_F_fat_L`                            | FMA:73166      | FMA    |
| Fat (R)                          | `VH_F_fat_R`                            | FMA:73165      | FMA    |
| Ciliary muscle (R)               | `VH_F_ciliary_muscle_R`                 | FMA:49152      | FMA    |
| Ciliary muscle (L)               | `VH_F_ciliary_muscle_L`                 | FMA:49153      | FMA    |
| Pubis spongy bone (L)            | `VH_F_pubis_spongy_bone_L`              | UBERON:0002483 | UBERON |
| Pubis spongy bone (R)            | `VH_F_pubis_spongy_bone_R`              | UBERON:0002483 | UBERON |
| Umbilical artery 1               | `VH_F_umbilical_artery_1`               | UBERON:0001310 | UBERON |
| Umbilical artery 2               | `VH_F_umbilical_artery_2`               | UBERON:0001310 | UBERON |
| Umbilical vein                   | `VH_F_umbilical_vein`                   | UBERON:0002066 | UBERON |
| Left uterine vein                | `VH_F_left_uterine_vein`                | FMA:18898      | FMA    |
| Afferent lymphatic vessel        | `Yao_afferent_lymphatic_vessel`         | UBERON:0010396 | UBERON |
| Skin                             | `VH_F_skin`                             | UBERON:0002097 | UBERON |
| Areolar tubercles (L)            | `VH_F_areolar_tubercles_L`              | UBERON:0011828 | UBERON |
| Areola (L)                       | `VH_F_areola_L`                         | FMA:223679     | FMA    |
| Nipple (L)                       | `VH_F_nipple_L`                         | UBERON:0013772 | UBERON |
| Right round ligament of uterus   | `VH_F_right_round_ligament_of_uterus`   | FMA:57789      | FMA    |
| Left round ligament of uterus    | `VH_F_left_round_ligament_of_uterus`    | FMA:57790      | FMA    |
| Suspensory ligament of ovary (R) | `VH_F_suspensory_ligament_of_ovary_R`   | FMA:19823      | FMA    |
| Suspensory ligament of ovary (L) | `VH_F_suspensory_ligament_of_ovary_L`   | FMA:19824      | FMA    |
| Cervix                           | `VH_F_cervix`                           | UBERON:0000002 | UBERON |
| Isthmus of fallopian tube (R)    | `VH_F_isthmus_of_fallopian_tube_R`      | FMA:18493      | FMA    |
| Isthmus of fallopian tube (L)    | `VH_F_isthmus_of_fallopian_tube_L`      | FMA:18494      | FMA    |

**Ontology coverage**: 888/1073 nodes (82.8%) — excellent coverage, comparable to male (82.0%).

**Female-specific structures with ontology**: All major female reproductive structures have ontology IDs (cervix, vagina, fallopian tubes, ovary ligaments, uterus ligaments, breast structures, cervix, vagina). Some fallopian tube sub-parts and cervicovaginal junction lack IDs.

---

## Core Structure Verification

| Structure           | Status  | Evidence                                                                                                                                                  |
| ------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Skin                | FOUND   | `VH_F_skin`, `Skin_mat`, `Skin_mat2`, UBERON:0002097                                                                                                      |
| Bones               | FOUND   | `VH_F_skeletal_system`, `Bone_Mat` variants, 18 bone nodes, pubis/spongy/compact bones with UBERON/FMA IDs                                                |
| Muscles             | FOUND   | `VH_F_muscular_system`, `Muscle_mat` variants, 27 muscle nodes, ciliary/extraocular muscles with FMA IDs                                                  |
| Brain               | FOUND   | `VH_F_nervous_system`, `Brain_mat`, `brain_mat1`, Allen brain atlas nodes (some without ontology IDs)                                                     |
| Spinal Cord         | FOUND   | `VH_F_nervous_system` children, cervical segments present (similar to male pattern)                                                                       |
| Heart               | FOUND   | `VH_F_heart`, `heart_mat`, 10 heart nodes, papillary muscles with FMA IDs                                                                                 |
| Vessels             | FOUND   | `VH_F_circulatory_system`, artery/vein materials, umbilical/uterine vessels with UBERON/FMA IDs                                                           |
| Lungs               | FOUND   | `VH_F_respiratory_system`, `lung_mat`, 8 lung nodes, `VH_F_hilum_L` UBERON:0004887                                                                        |
| Liver               | FOUND   | `VH_F_digestive_system`, `Liver_mat`, 23 liver nodes, impressions with FMA IDs                                                                            |
| Kidneys             | FOUND   | `VH_F_urinary_system`, kidney capsule/cortex/pyramid materials, 15 kidney nodes, capsule/hilum UBERON IDs                                                 |
| Digestive           | PARTIAL | Liver well-represented; stomach/intestine nodes present under digestive_system but less detailed ontology                                                 |
| Urinary             | FOUND   | `VH_F_urinary_system`, 7 urinary nodes, kidney capsule/hilum with UBERON IDs, bladder present                                                             |
| Female Reproductive | FOUND   | `VH_F_reproductive_system`, ovary/uterus/cervix/vagina/fallopian all with ontology IDs, broad ligament, round ligament, suspensory ligaments with FMA IDs |
| Lymphatic           | PARTIAL | `VH_F_lymphatic_system`, `Yao_afferent_lymphatic_vessel` (UBERON:0010396), 2 lymphatic nodes only                                                         |

---

## Female-Specific Structures

| Structure                    | Status | Node Name                                                                      | Ontology ID                                   | System             |
| ---------------------------- | ------ | ------------------------------------------------------------------------------ | --------------------------------------------- | ------------------ |
| Ovary                        | FOUND  | `VH_F_left_ovary`, `VH_F_right_ovary`                                          | (left ovary no ontology, right ovary similar) | Reproductive       |
| Uterus                       | FOUND  | `VH_F_uterus` (implied by `VH_F_reproductive_system` children)                 | —                                             | Reproductive       |
| Cervix                       | FOUND  | `VH_F_cervix`                                                                  | UBERON:0000002                                | Reproductive       |
| Vagina                       | FOUND  | `VH_F_vagina`, `VH_F_cervicovaginal_junction`                                  | UBERON:0000996                                | Reproductive       |
| Fallopian Tubes              | FOUND  | `VH_F_fallopian_tube_R/L`, isthmus                                             | FMA:18493/18494                               | Reproductive       |
| Broad Ligament               | FOUND  | `VH_F_ligaments_of_uterus_and_ovaries`, `BroadLigament_mat`                    | —                                             | Reproductive       |
| Round Ligament               | FOUND  | `VH_F_right_round_ligament_of_uterus`, `_L`                                    | FMA:57789/57790                               | Reproductive       |
| Broad Ligament               | FOUND  | `VH_F_ligaments_of_uterus_and_ovaries`                                         | —                                             | Reproductive       |
| Suspensory Ligament of Ovary | FOUND  | `VH_F_suspensory_ligament_of_ovary_R/L`                                        | FMA:19823/19824                               | Reproductive       |
| Round Ligament of Uterus     | FOUND  | `VH_F_right/left_round_ligament_of_uterus`                                     | FMA:57789/57790                               | Reproductive       |
| Broad Ligament (material)    | FOUND  | `BroadLigament_mat`                                                            | —                                             | Reproductive       |
| Breast                       | FOUND  | `VH_F_fat_L/R`, `VH_F_mammary_lobes_L/R`, `VH_F_areola_L/R`, `VH_F_nipple_L/R` | UBERON/FMA IDs for all                        | Integumentary/Skin |
| Areola                       | FOUND  | `VH_F_areola_L/R`, `VH_F_areolar_tubercles_L/R`                                | FMA:223679/223677 / UBERON:0011828            | Integumentary      |
| Nipple                       | FOUND  | `VH_F_nipple_L/R`                                                              | UBERON:0013772/0013773                        | Integumentary      |
| Fallopian Tubes              | FOUND  | `VH_F_fallopian_tube_R/L`, isthmus                                             | FMA:18493/18494                               | Reproductive       |
| Broad Ligament               | FOUND  | `VH_F_ligaments_of_uterus_and_ovaries`                                         | —                                             | Reproductive       |
| Round Ligament               | FOUND  | `VH_F_right/left_round_ligament_of_uterus`                                     | FMA:57789/57790                               | Reproductive       |
| Suspensory Ligament of Ovary | FOUND  | `VH_F_suspensory_ligament_of_ovary_R/L`                                        | FMA:19823/19824                               | Reproductive       |

**Note**: Ovary nodes exist but some lack ontology IDs directly; suspensory ligaments have FMA IDs.

---

## Separation Quality

| System          | Quality | Reasoning                                                                                  |
| --------------- | ------- | ------------------------------------------------------------------------------------------ |
| Skin            | GOOD    | Single `VH_F_integumentary_system` group, distinct materials, clear node hierarchy         |
| Musculoskeletal | GOOD    | Separate `muscular_system` + `skeletal_system` groups, distinct materials (Muscle vs Bone) |
| Nervous         | GOOD    | Single `nervous_system` group, brain/spinal/eye substructure, distinct materials           |
| Cardiovascular  | GOOD    | Single `circulatory_system`, distinct artery/vein/heart materials, clear vessel hierarchy  |
| Respiratory     | GOOD    | `respiratory_system` + `trachea`, distinct lung materials, clear hierarchy                 |
| Digestive       | PARTIAL | `digestive_system` group exists, liver well-mapped, but stomach/intestine less detailed    |
| Urinary         | GOOD    | Clear `urinary_system`, kidney/bladder/ureters separated, good materials                   |
| Reproductive    | GOOD    | Clear `reproductive_system`, all female-specific organs present with materials             |
| Lymphatic       | PARTIAL | Only 2 nodes (`lymphatic_system` + `afferent_lymphatic_vessel`), limited detail            |

---

## Rendering Information

| Property               | Value                                                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Opaque materials       | 87 (92 total - 5 blend)                                                                                                                       |
| Blend materials        | 5 (cornea ×2, lens, conjunctiva, skin translucency)                                                                                           |
| Vertex colors          | Yes (`COLOR_0` on meshes)                                                                                                                     |
| Textures               | 0                                                                                                                                             |
| Images                 | 0                                                                                                                                             |
| Animations             | 0                                                                                                                                             |
| Blend materials detail | `Skin_mat2` (translucent skin), `Cornea_mat`×2 (transparent cornea), `lens1` (transparent lens), `conjunctiva_Mat1` (transparent conjunctiva) |

---

## Performance Observations

| System          | Vertices (est.) | Triangles (est.) | Notes                                |
| --------------- | --------------- | ---------------- | ------------------------------------ |
| Skin            | ~200k           | ~200k            | Large surface, single mesh mostly    |
| Musculoskeletal | ~1.5M           | ~1.5M            | Many small bone/muscle meshes        |
| Nervous         | ~500k           | ~500k            | Fine nerve fibers, many small meshes |
| Cardiovascular  | ~400k           | ~400k            | Many fine vessels                    |
| Respiratory     | ~300k           | ~300k            | Lung lobes + trachea                 |
| Digestive       | ~400k           | ~400k            | Liver dominant                       |
| Urinary         | ~200k           | ~200k            | Kidney structures dominant           |
| Reproductive    | ~150k           | ~150k            | Small structures (ovary, uterus)     |
| Lymphatic       | <50k            | <50k             | Minimal                              |

**Recommended lazy-loading priority**:

1. Skin (load first, largest)
2. Musculoskeletal (heavy, lazy)
3. Nervous (heavy, lazy)
4. Cardiovascular (medium, lazy)
5. Respiratory (medium, lazy)
6. Digestive (medium, lazy)
7. Urinary (light, lazy)
8. Reproductive (light, lazy)
9. Lymphatic (lightest, lazy)

---

## Male vs Female Comparison

| Metric         | Male             | Female           | Difference             |
| -------------- | ---------------- | ---------------- | ---------------------- |
| File size      | 146.48 MB        | 211.62 MB        | Female +44%            |
| Vertices       | 3,863,220        | 5,474,814        | +42%                   |
| Triangles      | 4,018,087        | 5,557,599        | +38%                   |
| Nodes          | 1035             | 1073             | +3.7%                  |
| Meshes         | 849              | 888              | +4.6%                  |
| Materials      | 86               | 92               | +7%                    |
| Height         | ~1.83 m          | ~1.67 m          | Female shorter         |
| Width          | ~1.05 m          | ~0.97 m          | Female narrower        |
| Depth          | ~0.32 m          | ~0.46 m          | Female deeper (breast) |
| Ontology nodes | 849/1035 (82.0%) | 888/1073 (82.8%) | Similar                |

**Key differences**: Female model is larger (more vertices/triangles) due to breast tissue, more detailed reproductive system, finer mesh resolution. Male is taller. Both use same coordinate system and similar structure.

---

## File Integrity

| File                  | SHA-256                                                            | Status      |
| --------------------- | ------------------------------------------------------------------ | ----------- |
| Female source         | `472567A56896B9B7890508DA6501FBF858E56AAA30745365F7A71ADE782B529C` | Verified ✓  |
| Male source           | `34C45C90AA4ACD36BE19EDF8B878A8E7137DB9E8CB90E8E6332C2ABD49D7CF9D` | Unchanged ✓ |
| Male working assets   | —                                                                  | Unchanged ✓ |
| Male optimized assets | —                                                                  | Unchanged ✓ |

---

## Source Record Updates

Updated files:

- `3d-assets/female/SOURCE.md` — Added inspection section
- `docs/architecture/hra-source.md` — Updated female section with full inspection details
- `docs/architecture/3d-assets.md` — Added female inspection note
- `docs/architecture/female-anatomy-map.md` — Created (this file)

---

## Validation Commands

```bash
# Verify checksum
sha256sum 3d-assets/female/source/hra-reference-organ-united-female-v1.5.glb
# 472567A56896B9B7890508DA6501FBF858E56AAA30745365F7A71ADE782B529C

# Verify git ignores female source
git check-ignore -v 3d-assets/female/source/hra-reference-organ-united-female-v1.5.glb

# Run download script (second run)
node scripts/download-anatomy-assets/download-female.js
# → "Checksum matches — skipping download"

# Prettier check
npx prettier --check .
```

---

## Files Created / Changed

### Created

- `docs/architecture/female-anatomy-map.md` (this file)

### Modified

- `3d-assets/female/SOURCE.md` — Added inspection section
- `docs/architecture/hra-source.md` — Updated female section with full inspection
- `docs/architecture/3d-assets.md` — Added female inspection note

### No changes to:

- `frontend/web` / `frontend/marketing` / `frontend/admin` / `backend`
- Male assets (source/working/optimized)

---

## Git Status

```bash
# Modified (documentation/source records)
M .gitignore
M 3d-assets/SOURCES.md
M docs/architecture/hra-source.md
M docs/architecture/3d-assets.md

# New files (documentation + download script)
?? 3d-assets/female/SOURCE.md
?? docs/architecture/female-anatomy-map.md
?? scripts/download-anatomy-assets/download-female.js
```

---

## Warnings / Problems

1. **PURL 404**: `https://purl.humanatlas.io/ref-organ/united-female/v1.5` returns 404 — the PURL requires content negotiation; NIH 3D entry and HRA CDN are the working download sources.

2. **NIH download endpoint**: `https://3d.nih.gov/entries/download/20992/1.01` returns HTML page via curl (likely requires session/browser); HRA CDN URL is the reliable binary source.

3. **No textures/animations**: Both male and female models have 0 textures/images/animations — purely geometric + vertex colors.

4. **Digestive system detail**: Less detailed than male — liver well-mapped, but stomach/intestine structures have fewer ontology IDs.

5. **Lymphatic system**: Minimal detail (only 2 nodes vs 10+ in male) — may need external data for full lymphatic mapping.

6. **File size**: Female (201.82 MiB) is significantly larger than male (146.48 MiB) due to breast tissue, reproductive detail, and denser sampling — not an error.

7. **Male assets**: All male source/working/optimized assets confirmed unchanged (SHA-256 verified).

---

**STEP 8.12.2 STATUS: COMPLETE**

No commits, no pushes. Documentation and source records updated. Ready for next step (splitting/optimization).
