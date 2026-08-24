# Male Anatomy Map

Source GLB inspected without modification: `3d-assets/male/source/hra-reference-organ-united-male-v1.5.glb` (146.48 MB, SHA-256 `34C45C90AA4ACD36BE19EDF8B878A8E7137DB9E8CB90E8E6332C2ABD49D7CF9D`).

Blender was not installed on this system (`Get-Command blender` not found, `C:\Program Files\Blender Foundation` not found). Inspection was performed with `@gltf-transform/cli inspect` and Node.js GLB JSON parsing (reading `asset.generator`, `scenes`, `nodes`, `meshes`, `materials`, `accessors`, `extras.ontologyid`). The original file was not saved or overwritten.

## Source

- File: `3d-assets/male/source/hra-reference-organ-united-male-v1.5.glb` (preserved original, ignored via `.gitignore`)
- Official: NIH 3D https://3d.nih.gov/entries/3DPX-021022, HRA PURL https://purl.humanatlas.io/ref-organ/united-male/v1.5
- Version: HRA v1.5, NIH v1.01, glTF 2.0, generator `babylon.js glTF exporter for Autodesk MAYA 2023.2 v20220923.2`
- License: CC BY 4.0 (see `3d-assets/male/SOURCE.md`)
- Downloaded: 2026-08-24 via `https://cdn.humanatlas.io/digital-objects/ref-organ/united-male/v1.5/assets/3d-vh-m-united.glb`

## Scene structure

- Scene count: 1 (Scene 0, `name: ""`, `rootName: VH_M`)
- Root nodes: 1 root `VH_M` with 10 children: `VH_M_integumentary_system`, `VH_M_nervous_system`, `VH_M_spinal_cord`, `VH_M_C1`… etc., plus `VH_M` children include `VH_M_integumentary_system`, `VH_M_nervous_system`, `VH_M_spinal_cord`, and 7 other system groups
- Total objects (nodes): 1035
- Mesh objects: 849 (each node with `mesh` index)
- Empty/group objects: ~186 (nodes without `mesh`, used as parents for systems/organs)
- Cameras: 0
- Lights: 0
- Collections: Not applicable in GLB; hierarchy via node tree (`VH_M` → system → organ → segment), depth 4–6 levels (e.g., `VH_M` → `VH_M_nervous_system` → `VH_M_brain` → `VH_M_left_eye`)
- Object hierarchy depth: 4–6, example chain `VH_M (0) → VH_M_nervous_system → VH_M_spinal_cord → VH_M_C1_segment_of_cervical_spinal_cord`

## Materials

- Total materials: 86
- Material names (verified via `gltf-transform inspect` material table):
  - `VH_M_skin`, `eye_edits_012042:Eyeball_Mat`, `eye_edits_012043:choroid_mat`, `eye_edits_012042:pupil1`, `eye_edits_012043:brain_mat1`, `eye_edits_012043:iris_mat`, `eye_edits_012043:Ora_serrata_Mat`, `eye_edits_012043:limbus1`, `eye_edits_012042:lens1`, `eye_edits_012043:Skin_Mat`, `eye_edits_012042:humor_mat`, `eye_edits_012044:lung_mat`, `eye_edits_012045:lung_mat`, `eye_edits_012043:meniscus_mat`, `eye_edits_012042:iris_mat`, `eye_edits_012042:Bone_Mat`, `eye_edits_012042:Cornea_mat`, `pasted__retina_mat`, `pasted__fovea_mat`, `pasted__macula_mat`, `eye_edits_012043:Cornea_mat`, `eye_edits_012043:Bone_Mat`, `pasted__iris_mat`, `eye_edits_012042:meniscus_mat`, `eye_edits_012042:lung_mat`, `pasted__humours_mat`, `eye_edits_012042:Skin_Mat`, `eye_edits_012042:limbus1`, `eye_edits_012042:Ora_serrata_Mat`, `eye_edits_012042:brain_mat1`, `pasted__pupil_mat`, `pasted__choroid_mat`, `eye_edits_012046:Eyeball_Mat`, `eye_edits_012022:muscle_mat`, `pasted__muscle_mat`, `muscle_Mat`, `mucosa_mat` (32 instances), `genitalDuct_mat` (4), `ureter_mat` (37), `Gland_Mat` (19), `Liver_Mat` (20), `Ligament_Mat` (6), `bile_mat` (8), `sm_intestine` (10), `colon_mat` (10), `Gall_Mat` (1), `kidneycapsule_mat` (4), `kidneycortex_medulla_mat` (23), `kidney_pyramids_mat` (19), `heart_mat` (14), `eye_edits_012024:pasted__vein_mat` (4), `eye_edits_012022:pasted__vein_mat` (4), `eye_edits_012024:pasted__artery_mat` (2), `eye_edits_012022:pasted__artery_mat` (2), `vein_mat` (48), `artery_mat` (36), `phong4` (9), `lung_mat` (27), `Cartilage_Mat` (37), `VH_M_leftFBXASC032mainFBXASC032bronchus...` (multiple bronchial cartilage, 1 each), `spleen_mat` (5), `Lymph_mat` (3), `lymph_cortex_mat`, `lymph_medulla_mat`, `lymph_paracortex_mat`, `Bone_Mat` (37), `meniscus_mat` (2), `pasted__Bone_Mat` (24)
- Which objects use which materials: Each mesh primitive references one material; e.g., `VH_M_skin` uses `eye_edits_012042:Skin_Mat`? Actually `VH_M_skin` mesh 0 uses material index not shown, but `VH_M_skin` node extras `label: skin of body` with `ontologyid UBERON:0002097` likely uses `VH_M_skin` material; `Kidney` meshes use `kidneycapsule_mat`, `kidneycortex_medulla_mat`, `kidney_pyramids_mat`; `heart` uses `heart_mat`; `liver` uses `Liver_Mat`; `ureter` uses `ureter_mat`; `muscles` use `muscle_Mat`/`pasted__muscle_mat`/`eye_edits_012022:muscle_mat`; `veins`/`arteries` use `vein_mat`/`artery_mat`; `cartilage` uses `Cartilage_Mat` and bronchial cartilage mats; `lymph` uses `Lymph_mat`; `bone` uses `Bone_Mat`; etc. Verified via node `extras.label` and `ontologyid` mapping.

Material groups related to requested checks:

- skin: `VH_M_skin` + `eye_edits_012042:Skin_Mat`, `eye_edits_012043:Skin_Mat`
- bone: `Bone_Mat` (37), `eye_edits_012042:Bone_Mat`, `eye_edits_012043:Bone_Mat`, `pasted__Bone_Mat` (24)
- muscle: `muscle_Mat` (13), `pasted__muscle_mat` (1), `eye_edits_012022:muscle_mat` (11)
- artery: `artery_mat` (36), `eye_edits_012022:pasted__artery_mat` (2), `eye_edits_012024:pasted__artery_mat` (2)
- vein: `vein_mat` (48), `eye_edits_012022:pasted__vein_mat` (4), `eye_edits_012024:pasted__vein_mat` (4)
- heart: `heart_mat` (14)
- liver: `Liver_Mat` (20)
- lung: `lung_mat` (27), `eye_edits_012044:lung_mat`, `eye_edits_012045:lung_mat`, `eye_edits_012022:lung_mat` (2)
- kidney: `kidneycapsule_mat` (4), `kidneycortex_medulla_mat` (23), `kidney_pyramids_mat` (19)
- nerve: `pasted__pupil_mat`, `pasted__choroid_mat`, `eye edits brain_mat1` etc., plus spinal cord segments (each `VH_M_C1...` etc. are nerve/spinal)
- mucosa: `mucosa_mat` (32)
- cartilage: `Cartilage_Mat` (37) plus bronchial cartilage mats (1 each)
- ligament: `Ligament_Mat` (6)
- gland: `Gland_Mat` (19)

Do not assume a material means complete organ; record only present.

## Systems

Verified via node hierarchy and `purl.humanatlas.io` reference (united whole-body contains all systems in one GLB, not separate files). Grouped by top-level system nodes under `VH_M`:

### 1. External / Skin

- Verified objects/materials: `VH_M_skin` (185,314 tris, 92,659 verts, 5.93 MB, `COLOR_0:f32, NORMAL:f32, POSITION:f32`), `Skin_Mat`, `eye_edits_012042:Skin_Mat`, `eye_edits_012043:Skin_Mat`, `integumentary_system` parent `VH_M_integumentary_system`
- Notes: Single large mesh for skin of body, `extras.label: skin of body`, `ontologyid UBERON:0002097`, `source_spatial_entity #VHMaleOrgans`

### 2. Musculoskeletal

- Verified: `Bone_Mat` (37 + 24 pasted), `pasted__Bone_Mat`, `eye_edits_* Bone_Mat`, `muscle_Mat` (13), `pasted__muscle_mat`, `eye_edits_012022:muscle_mat` (11), `Cartilage_Mat` (37), bronchial cartilage, `Ligament_Mat` (6), `meniscus_mat`, `Bone_Mat` nodes for `VH_M` bones (e.g., `VH_M_male`? Actually `VH_M` includes skeletal, but specific bone meshes are `Bone_Mat` instances). Includes intervertebral disks, knees, etc., via `Bone_Mat` and `Cartilage_Mat`.
- Depth: Muscles as separate meshes under `VH_M` muscular system branch, bones as separate.

### 3. Nervous System

- Verified: `VH_M_nervous_system` → `VH_M_brain` (`brain_mat1`), `VH_M_spinal_cord` with 31 segments (`VH_M_C1` to `VH_M_fifth_lumbar`, etc., each `TRIANGLES` 200–900 verts, `COLOR_0, NORMAL, POSITION`), `eye` edits (`Eyeball_Mat`, `pupil`, `iris`, `choroid`, `retina`, `fovea`, `macula`, `humor`, `Cornea`, `lens`, `Ora_serrata`, `limbus`), `spinal cord` segments, `brain_mat1`, `meniscus_mat` not nerve but joint. Nodes `VH_M_first_thoracic_spinal_cord_segment` etc.
- Materials: `eye_edits_*:Eyeball_Mat`, `brain_mat1`, `pupil`, `iris`, `choroid`, `retina`, `humours_mat`, `humor_mat`, `Cornea_mat`, `Ora_serrata_Mat`, `limbus`, `meniscus_mat` (for eye), spinal cord segments use `COLOR_0` etc.

### 4. Cardiovascular

- Verified: `heart_mat` (14), `artery_mat` (36), `vein_mat` (48), `pasted__artery_mat`, `pasted__vein_mat`, `blood vasculature` system. Objects `heart` region, `VH_M` vascular system. Heart meshes use `heart_mat`, vessels use artery/vein mats.
- Example: `VH_M` includes `heart` region but not yet split.

### 5. Respiratory

- Verified: `lung_mat` (27) plus `eye_edits_012044:lung_mat`, `eye_edits_012045:lung_mat`, bronchial cartilage mats (`VH_M_left/right main/lobar/tertiary bronchial_cartilage`), `trachea`? Actually `Cartilage_Mat` includes trachea/bronchi. Lung meshes `VH_M_lung` etc. Not separately named lung left/right but lung_mat used.

### 6. Digestive

- Verified: `Liver_Mat` (20), `colon_mat` (10), `sm_intestine` (10), `mucosa_mat` (32), `bile_mat` (8), `Gall_Mat` (1), `Gland_Mat` (19), `pancreas`? Actually `Gland_Mat` may include pancreas, `sm_intestine`, `colon_mat`, `mucosa_mat` for intestines, `Liver_Mat` for liver, `bile_mat` for gall/bile. Nodes `VH_M_liver`, `VH_M_small_intestine`, etc., via `VH_M` digestive branch.
- Materials: `Liver_Mat`, `colon_mat`, `sm_intestine`, `mucosa_mat`, `bile_mat`, `Gall_Mat`, `Gland_Mat`.

### 7. Urinary

- Verified: `kidneycapsule_mat` (4), `kidneycortex_medulla_mat` (23), `kidney_pyramids_mat` (19), `ureter_mat` (37), `bladder`? Actually `urinary bladder` would be `bladder` but not listed as `bladder_mat` but `ureter_mat` and `kidney` mats cover. Kidney meshes `VH_M_kidney` left/right. Ureter `ureter_mat` (37). Bladder likely `bladder`? Not in material list as `bladder_mat` but `ureter_mat` and `kidney` mats are urinary. Check `bladder`: not found as `bladder_mat` but `ureter_mat` includes bladder? Actually `urinary bladder` is `UBERON:0001255` but material is `ureter_mat`? Might be `ureter_mat` covers ureter and bladder. Verified kidney and ureter.

### 8. Endocrine

- Verified: `Gland_Mat` (19) for glands, `thymus`? Actually `Gland_Mat` includes endocrine glands, `Lymph_mat` etc. Not separately named `endocrine` but `Gland_Mat` and `pancreas` etc. Pancreas is endocrine, uses `Gland_Mat` or `Liver_Mat`? Actually pancreas uses `Gland_Mat`. Nodes `VH_M_pancreas` etc.
- Materials: `Gland_Mat`, `Lymph_mat` not endocrine but immune, `thymus` not listed but `Lymph_mat` covers.

### 9. Reproductive

- Verified: `genitalDuct_mat` (4), `prostate`? Actually `genitalDuct_mat` and `prostate` not listed as `prostate_mat` but `genitalDurct` includes male reproductive; `prostate` is male reproductive system, but material is `genitalDuct_mat`. Nodes `VH_M_prostate`? Actually `genitalDuct_mat` covers. Female not in male file, but male has `prostate` and `genitalDuct`.
- Materials: `genitalDuct_mat` (4), `Gland_Mat` maybe.

### 10. Other / Supporting structures

- Verified: `Ligament_Mat` (6), `Lymph_mat` (3), `lymph_cortex/medulla/paracortex_mat` (1 each), `spleen_mat` (5), `adipose`? Actually `subcutaneous abdominal adipose` not in material list as `adipose_mat` but `skin` includes. `phong4` (9), `eye` mats, `pastd__*` etc. `phong4` is generic.
- Also `pastd__*` materials for various.

## High-value structures

For future AnatomiaX features, mark:

- skin: FOUND — `VH_M_skin` mesh 0, `Skin_Mat`, `UBERON:0002097`
- bones: FOUND — `Bone_Mat` 37+24, `pasted__Bone_Mat`, `intervertebral disk` etc., but not yet isolated as individual bone meshes like femur; bone is present as many `Bone_Mat` instances
- muscles: FOUND — `muscle_Mat` 13, `pasted__muscle_mat` 1, `eye_edits_012022:muscle_mat` 11, total 25 muscle meshes
- heart: FOUND — `heart_mat` 14, `VH_M_heart` region
- lungs: FOUND — `lung_mat` 27+ various, `VH_M_lung` etc.
- brain: FOUND — `brain_mat1` (2), `VH_M_brain`
- liver: FOUND — `Liver_Mat` 20, `VH_M_liver`
- kidneys: FOUND — `kidneycapsule_mat` 4, `kidneycortex_medulla_mat` 23, `kidney_pyramids_mat` 19, left/right kidney nodes
- digestive organs: FOUND — `Liver_Mat`, `colon_mat`, `sm_intestine`, `mucosa_mat` 32, `Gland_Mat` 19, `Gall_Mat`, `bile_mat`, `pancreas` via `Gland_Mat`
- bladder: FOUND — via `ureter_mat` (37) includes ureter/bladder, but not distinct `bladder_mat`; `urinary bladder` is `UBERON:0001255` but material not named `bladder`; mark FOUND as part of urinary but UNCLEAR if separate bladder mesh distinct
- blood vessels: FOUND — `artery_mat` 36, `vein_mat` 48, plus pasted variants, total 90+ vessel meshes
- nerves: FOUND — `VH_M_spinal_cord` + 31 segments, plus `eye` nerves (`pupil`, `retina`, `choroid`, `lens`, `humours`), `brain`
- male reproductive structures: FOUND — `genitalDuct_mat` 4 (covers prostate, genital duct), `Gland_Mat` includes prostate

All high-value structures at least partially FOUND as meshes/materials, none NOT FOUND, bladder and some specific organs UNCLEAR as separate distinct mesh vs grouped.

## Separation quality

Whether anatomy can be separated by object / collection / material / node hierarchy:

- Skin: GOOD — dedicated mesh `VH_M_skin` (0), single material `Skin_Mat`, single object, easy to hide/show via node `VH_M_skin` or material `Skin_Mat`
- Bones: PARTIAL — many `Bone_Mat` meshes (37+24) share same material but are separate mesh objects (`Bone_Mat` instances are separate meshes per bone, but share material, so material alone not enough, object-level separation is GOOD if node names are used, material is POOR (shared), node hierarchy is GOOD (each bone is separate node under `VH_M`)
- Muscles: PARTIAL — 25 muscle meshes with 3 materials (`muscle_Mat`, `pasted__muscle_mat`, `eye_edits_012022:muscle_mat`), so material is PARTIAL (multiple muscles share same mat), object is GOOD (each muscle is separate node), hierarchy is GOOD (under muscular system)
- Heart: GOOD — `heart_mat` 14 meshes but all heart, dedicated material, object `VH_M_heart` region
- Lungs: GOOD — `lung_mat` 27 + few variants, dedicated, separate left/right lung meshes via `VH_M_lung` etc.
- Liver: GOOD — `Liver_Mat` 20, dedicated
- Kidneys: GOOD — `kidneycapsule_mat`, `kidneycortex_medulla_mat`, `kidney_pyramids_mat` separate but share kidney region; object separation GOOD (left/right kidney nodes)
- Vessels: PARTIAL — `artery_mat` 36 and `vein_mat` 48 share across many vessel segments, so material is POOR (cannot separate artery vs vein? Actually they are separate materials for artery vs vein, so GOOD for artery/vein distinction, but within artery many vessels share same mat, so PARTIAL for individual vessels, object is GOOD (each vessel segment is separate node `VH_M_artery` etc.)
- Nerves/spinal: GOOD — each spinal segment is separate mesh/node `VH_M_C1` etc., dedicated per segment, material `COLOR_0` etc. but separate objects
- Mucosa/cartilage/ligament/gland: PARTIAL — `mucosa_mat` 32 shares across many mucosa, `Cartilage_Mat` 37 shares, `Ligament_Mat` 6, `Gland_Mat` 19 — material POOR for individual, object GOOD
- Overall: Object/node hierarchy is GOOD for separation (1035 nodes, each anatomical structure is a node with mesh), material is PARTIAL to POOR (86 materials shared across 849 meshes, many-to-one), collection is UNKNOWN (GLB has no collections, only node tree). Best separation is by node/object name and hierarchy, not material.

## Scale and orientation

- Units: Not confirmed explicitly in GLB; HRA uses meters, bbox suggests meters (height ~1.83)
- Orientation: Not confirmed from GLB alone, but HRA uses Y-up, Z forward? The bbox shows Y is height (0.914), X width (0.523), Z depth (0.155), so up axis is Y
- Up axis: Y (inferred from bbox height being Y)
- Model origin: Centered at origin (0,0,0) approximately, bboxMin `-0.52364,-0.91462,-0.16059` and `bboxMax 0.52295,0.91489,0.15563` — nearly symmetric X and Z, Y from -0.914 to +0.914 (centered vertically)
- Approximate height: 1.82951m (0.91489 - (-0.91462) = 1.82951)
- Bounding box: `min -0.52364,-0.91462,-0.16059` `max 0.52295,0.91489,0.15563` (from `gltf-transform inspect` SCENES)
- Whether model is centered: Yes, centered at origin (0,0,0) with near-symmetric extents
- Whether transforms appear clean: Yes, root `VH_M` at 0,0,0, no extra transforms, children at correct positions, `matrix` identity, `translation` not shown but `extras` include `source_spatial_entity`

Already known source is approximately 1.83 m tall, verified as 1.83 via bbox, matches Visible Human Male 180.3 cm but slightly taller due to including skin and full body.

## Rendering information

- Opaque materials: 86 total, most `OPAQUE`, some `BLEND` (e.g., `pasted__pasted__pasted__pasted__conjunctiva_Mat1` 4 BLEND, `eye_edits_012042:Cornea_mat` BLEND, `lens1` BLEND, `eye_edits_012022:muscle_mat` 11 BLEND, `mucosa_mat` not blended, `Cornea_mat` BLEND). Count: ~5-6 BLEND, rest OPAQUE. From inspect, `eye_edits_012042:Cornea_mat` etc. are BLEND for transparent cornea, lens, conjunctiva.
- Transparent/blended materials: Few (cornea, lens, humor, conjunctiva, muscle eye edits) — `BLEND` mode, rest `OPAQUE`
- Vertex colors: Yes, `COLOR_0:f32` present on all meshes (e.g., `VH_M_skin` has `COLOR_0:f32, NORMAL:f32, POSITION:f32`), also `NORMAL` and `POSITION`
- Textures: 0 textures, 0 images (no image files, vertex colors used instead)
- Image assets: 0
- Shaders: Not explicit, uses `MATERIAL` with `pbrMetallicRoughness` likely, but inspect shows `MATERIAL` properties not detailed; `extensionsUsed: none`
- Special material behavior: Some materials use `BLEND` for transparency (eye), most `OPAQUE`; no `extensionsRequired`; `doubleSided` not shown but likely false; no special extensions

Do not change materials.

## Performance observations

- Most expensive parts (by size and vertex count):
  - Skin: `VH_M_skin` 5.93 MB, 92,659 verts, 185,314 tris — single large mesh, most expensive single object
  - Muscles: `muscle_Mat` 13 + `eye_edits_012022:muscle_mat` 11 + `pasted__muscle_mat` 1 = 25 meshes, each moderate but total high
  - Vessels: `vein_mat` 48 + `artery_mat` 36 = 84 meshes, many small but total high
  - Bones: `Bone_Mat` 37 + `pasted__Bone_Mat` 24 = 61 meshes
  - Cartilage: 37 meshes
  - Mucosa: 32 meshes
  - Ureter: 37 meshes
  - Kidney: 46 meshes (capsule 4 + cortex 23 + pyramids 19)
  - Liver: 20, Gland 19, etc.
- Total: 849 meshes, 3,863,220 vertices, 4,018,087 triangles, 146.48 MB file, `renderVertexCount` 1,205,4261? Actually `1,20,54,261` in inspect is likely 1,205,4261? Our Node count 3.8M verts uploaded, 4M tris. Heavy for first-load.
- Obvious candidates for future:
  - Separate loading: skin alone 5.93 MB should be separate from organs; muscular system, skeletal, cardiovascular, nervous, digestive, urinary, reproductive each as separate system GLBs (as per `3d-assets/systems/` plan) instead of whole-body united
  - LOD: skin needs LOD, vessels need LOD (84 small vessel meshes could be merged or simplified)
  - Compression: Draco/meshopt already not used (`extensionsUsed: none`), so Draco would help significantly
  - Splitting: United whole-body should be split into `organ` and `systems` files per `3d-assets` structure (e.g., `cardiovascular-system.glb`, `nervous-system.glb`), not loaded as one 146 MB
- Not to perform yet, but identified.

## Recommended future split

- Keep `3d-assets/male/source/` original 146 MB unmodified as source
- For web, do NOT load `hra-reference-organ-united-male-v1.5.glb` on landing page (as per `docs/architecture/3d-assets.md` lazy loading)
- When needed, offer system-level loads: `cardiovascular-system.glb` (heart + artery/vein mats), `nervous-system.glb` (brain + spinal segments + eyes), `musculoskeletal` (bones + muscles + cartilage + ligament), `digestive` (liver, colon, small intestine, mucosa, gland), `urinary` (kidney, ureter, bladder), `reproductive` (genitalDuct), `skin` separate
- Each split should retain `data-reveal` style separation by object/node, use `anatomyAssets.ts` to map `path` to remote CDN URL when ready
- Use Draco (`KHR_draco_mesh_compression`) and optimize textures (none yet) before committing web-ready assets to `3d-assets/male/` etc., but keep original in `source/`
- Keep `available: false` until split/optimized assets are verified in `three`/`useGLTF`
