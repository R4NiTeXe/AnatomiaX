# Source — Body, Female

Asset: Body, Female — Female-united set
File: hra-reference-organ-united-female-v1.5.glb
Original filename: hra-reference-organ-united-female-v1.5.glb (CDN origin `3d-vh-f-united.glb`)
Official NIH URL: https://3d.nih.gov/entries/3DPX-020992
HRA PURL: https://purl.humanatlas.io/ref-organ/united-female/v1.5
Collection: Human Reference Atlas 3D Reference Object Library (https://3d.nih.gov/collections/hra)
License: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
Attribution: Human Reference Atlas (HRA) — Body, Female united v1.5 via NIH 3D 3DPX-020992 and PURL https://purl.humanatlas.io/ref-organ/united-female/v1.5 — CC-BY 4.0; Visible Human Female (Spitzer and Whitlock 2002 doi:10.1002/(SICI)1097-0185(199804)253:2<49::AID-AR8>3.0.CO;2-9). Follow NIH 3D “How to cite” on entry page.
Version: HRA v1.5 — NIH entry v1.01 (Created 2024-03-06, Published 2025-08-05) — generator `babylon.js glTF exporter for Autodesk MAYA 2023.2 v20220923.2`, glTF 2.0
Downloaded: 2026-08-29
Download URL: https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.5/assets/3d-vh-f-united.glb (official HRA CDN; NIH download https://3d.nih.gov/entries/download/20992/1.01)
File size: 211624968 bytes (201.82 MiB, 211.62 MB)
SHA-256: 472567A56896B9B7890508DA6501FBF858E56AAA30745365F7A71ADE782B529C
Format: GLB (binary glTF 2.0), 1 buffer, 1 scene
Source: Visible Human Female, National Library of Medicine (59yo white female, 171.2 cm, obese)

Notes: Preserved original file unmodified at `3d-assets/female/source/hra-reference-organ-united-female-v1.5.glb`. Binary is kept outside Git and ignored via `.gitignore` (`3d-assets/female/source/*.glb`), reproducible at any time from the official source via `scripts/download-anatomy-assets/download-female.js` with SHA-256 verification. Not yet optimized, not yet integrated into React viewer. Contains 888 meshes, 92 materials, 0 textures, 0 animations, 1073 nodes, 2785 accessors. See inspection below.

Inspection (2026-08-29, via @gltf-transform/cli v4.4.2 and Node.js glTF JSON parsing; Blender not installed and not used):

- Blender version: Not installed — inspection via gltf-transform, not Blender
- Object count: 1073 nodes
- Mesh count: 888 meshes
- Material count: 92 materials
- Texture count: 0
- Image count: 0
- Animation count: 0
- Accessor count: 2785
- Vertex count: 5,474,814
- Triangle count: 5,557,599
- Ontology-bearing nodes: 888 / 1073 (82.8%)
- Dimensions: 0.97 × 1.67 × 0.46 m (X × Y × Z)
- Height: ~1.666 m (Y axis)
- Bounding box: min (-0.48956, -0.79476, -0.22262), max (0.47788, 0.87159, 0.23267)
- Orientation: Y-up, centered near origin
- Coordinate system: Right-handed, Y-up, meters
- Root node: VH_F
- Origin: Centered near (0,0,0)
- Scale: 1 unit = 1 meter
- Orientation: Y-up
- Coordinate system: Right-handed, Y-up, meters

Important findings: Single scene VH_F with bbox -0.48956,-0.79476,-0.22262 to 0.47788,0.87159,0.23267 (~0.97×1.67×0.46 m, height 1.67 m, centered near origin, Y up), 5,474,814 vertices, 5,557,599 triangles, vertex colors COLOR_0 present, no textures/images, 92 materials (5 BLEND: cornea×2, lens, conjunctiva, skin translucency; 87 OPAQUE), 888 meshes, 1073 nodes, 2785 accessors. Contains skin (VH_F_skin UBERON:0002097), fat, breast structures, bone/muscle, cardiovascular (heart, artery, vein), nervous (brain, spinal cord), respiratory (lung), digestive (liver), urinary (kidney), female reproductive (ovary, uterus, cervix, vagina, fallopian, broad ligament, round ligament, suspensory ligament), lymphatic. All high-value structures FOUND. See docs/architecture/female-anatomy-map.md for full map.

Ontology: 888/1073 nodes (82.8%) carry verified ontology IDs (extras.ontologyid). Verified IDs include UBERON/FMA for skin, breast, heart, lung, liver, kidney, uterus, ovary, cervix, vagina, fallopian tube, broad ligament, round ligament, suspensory ligament, blood vessels, nerves, lymphatic. Female-specific structures with ontology: cervix (UBERON:0000002), vagina (UBERON:0000996), fallopian tubes (FMA:18493/18494), ovary suspensory ligaments (FMA:19823/19824), cervix (UBERON:0000002), broad/round/suspensory ligaments (FMA IDs), breast/nipple/areola (UBERON/FMA), ovarian suspensory ligaments (FMA:19823/19824), round/broad ligaments (FMA IDs), uterine/ovarian vessels (FMA IDs).

Separation quality: Skin/GOOD, Musculoskeletal/GOOD, Nervous/GOOD, Cardiovascular/GOOD, Respiratory/GOOD, Digestive/PARTIAL (liver detailed, GI tract less so), Urinary/GOOD, Reproductive/GOOD, Lymphatic/PARTIAL.

Performance: 5.5M vertices, 5.5M triangles, 888 meshes, 92 materials. Recommended lazy-load order: skin → musculoskeletal → nervous → cardiovascular → respiratory → digestive → urinary → reproductive → lymphatic.

See docs/architecture/female-anatomy-map.md for full map.

## Split inspection (2026-08-29)

- **Tool**: `scripts/split-female.js` via glTF-Transform 4.4.2 (`NodeIO` + `prune`) — no optimization
- **Outputs**: 9 working GLBs in `3d-assets/female/working/` — `skin.glb` (17 meshes, 1245604 verts, UBERON:0002097), `musculoskeletal.glb` (107 meshes, 467440 verts), `nervous.glb` (362 meshes, 2065073 verts), `cardiovascular.glb` (124 meshes, 474817 verts), `respiratory.glb` (70 meshes, 606811 verts), `digestive.glb` (61 meshes, 173006 verts), `urinary.glb` (87 meshes, 131966 verts), `reproductive.glb` (46 meshes, 178284 verts, female-specific ovary/uterus/cervix/vagina/fallopian/broad ligament preserved), `lymphatic.glb` (14 meshes, 131813 verts, minimal by source)
- **Preservation**: All 888 meshes, 5474814 verts, 5557599 tris preserved (output sum equals source); materials, node names, `extras.ontologyid` (888 nodes), transforms, Y-up/meters, `VH_F` root, bbox subsets, no invented anatomy
- **Limitations**: Lymphatic minimal (14 meshes) per source; breast stays in `skin.glb` per HRA hierarchy (not in reproductive); endocrine distributed (placenta/ovary in reproductive, pituitary/thyroid remain under nervous/urinary); working files unoptimized and stay ignored via `.gitignore` `3d-assets/female/working/*.glb`, documented in `3d-assets/female/working/README.md`

## Batch optimization (2026-08-29)

- **Tool**: `gltf-transform meshopt` 4.4.2 (`EXT_meshopt_compression` + `KHR_mesh_quantization`, defaults, no Draco/simplify)
- **Inputs**: 8 remaining working GLBs (`skin`, `musculoskeletal`, `cardiovascular`, `respiratory`, `digestive`, `urinary`, `reproductive`, `lymphatic`) plus existing `nervous-meshopt.glb` (69.51 → 13.82 MB, 80.1%) reused as baseline — not regenerated
- **Outputs**: 8 new `*-meshopt.glb` in `3d-assets/female/working/optimized/` — skin 48.03 → 7.56 MB (84.3%), musculoskeletal 17.28 → 3.55 MB (79.5%), cardiovascular 18.72 → 3.22 MB (82.8%), respiratory 26.05 → 4.45 MB (82.9%), digestive 5.24 → 1.34 MB (74.4%), urinary 4.58 → 1.23 MB (73.2%), reproductive 7.76 → 1.49 MB (80.8%), lymphatic 4.56 → 1.14 MB (75.0%)
- **Batch total (8)**: 138643712 → 25139964 bytes (81.9%); **Total 9**: 211529000 → 39635108 bytes (81.3%, saved 171893892 bytes); all meshes/materials/verts/tris/ontology/bbox/orientation preserved (nodes +1 to +8 for dequant carriers as documented), validated via `gltf-transform inspect`/`validate` (No errors, info `UNSUPPORTED_EXTENSION EXT_meshopt_compression` expected)
- **Female-specific**: `reproductive-meshopt.glb` retains ovary/uterus/cervix/vagina/fallopian/broad ligament/placenta; `skin-meshopt.glb` retains breast/areola/nipple hierarchy — verified via `nodes[].extras.ontologyid`
- **Preservation**: All 888 meshes, 5474814 verts, 5557599 tris preserved (sum equals source); no invented anatomy; `VH_F` root, Y-up, meters unchanged
