# 3D Assets — Naming, Placement, and Loading

## Placement

```
3d-assets/
├── male/        → full-body male: male-body.glb
├── female/      → full-body female: female-body.glb
├── organs/      → single organs: heart.glb, lungs.glb, brain.glb
├── systems/     → systems: cardiovascular-system.glb, respiratory-system.glb
├── pathology/   → variants: heart-hypertrophy.glb, lung-pneumonia.glb
└── animations/  → clips: heart-beat.glb, breathing-cycle.glb
```

## Naming Convention

Examples:

- `male-body.glb`
- `female-body.glb`
- `heart.glb`
- `lungs.glb`
- `brain.glb`
- `cardiovascular-system.glb`
- `respiratory-system.glb`

Rules:

- lowercase only
- hyphen-separated (`-`), no spaces or underscores
- descriptive, specific names
- prefer `.glb` (binary GLTF, Draco/meshopt optional)
- version suffix when needed: `male-body-v2.glb`, `heart-v2.glb`
- no generic names like `model.glb` or `final.glb`

## Size and Optimization

- Optimize before commit: Draco, meshopt, texture compression, clean topology
- Keep individual GLB under the agreed budget (e.g., <5–10MB for bodies, <2MB for organs) — large assets will move to CDN/object storage later
- Do not commit source `.blend`/`.fbx`/`.obj` unless required for traceability; if needed, keep separate and large-file–ignored
- Prefer a single GLB per logical asset; avoid many small GLBs that increase draw calls

## Licensing and Source

- Every external asset must be recorded in `3d-assets/README.md` before adding:
  - Source, author, license, allowed use, attribution, notes
- Do not add random downloaded medical models
- Verify commercial/public use is allowed for AnatomiaX
- Keep attribution text with the asset

## Asset Definitions

Typed definitions live in `frontend/web/src/components/anatomy/anatomyAssets.ts`:

- `AnatomyAsset` with `key`, `label`, `path`, `type` (`body` | `organ` | `system` | `pathology` | `animation`)
- Placeholder entries for `male`/`female` are marked not yet available; `path` is set but file does not exist until asset is provided
- Code remains type-safe even when no GLB is present

## Lazy Loading

- No detailed anatomy asset is preloaded
- `male-body.glb`, `female-body.glb`, organs, systems, pathology are **not** loaded on the landing page
- A model is loaded only when the user selects it via `ModelSelector`
- Reusable `ModelLoader` uses `useGLTF` + `Suspense`; future assets reuse the same path

## Loading Flow

```
User selects model (ModelSelector)
    ↓
Asset definition (anatomyAssets.ts: key → path/type)
    ↓
Lazy load (React.lazy / dynamic import, Suspense)
    ↓
GLB/GLTF loader (useGLTF from @react-three/drei / three)
    ↓
Loading state (LoadingState.tsx, lightweight, no Lottie/Rive)
    ↓
3D model (AnatomyModel.tsx, <primitive> or scene)
    ↓
Error state if loading fails (model not found, invalid GLB, network failure)
```

## Runtime Requirements

- Detailed assets should not be loaded on landing page
- Only the required anatomy asset for the current view should be loaded
- Large assets will eventually use CDN/object storage; `anatomyAssets.ts` `path` will point to remote URL
- Prefer optimized GLB/GLTF; avoid uncompressed high-poly
- Use `Suspense` + error boundaries so a missing asset never crashes the app

## Approved candidate whole-body source

NIH Human Reference Atlas (HRA) is the current candidate source for the first male and female whole-body models, subject to final verification and integration testing.

- Male: `hra-reference-organ-united-male-v1.5.glb` — https://3d.nih.gov/entries/3DPX-021022 — PURL https://purl.humanatlas.io/ref-organ/united-male/v1.5 — CC-BY 4.0 — Downloaded 2026-08-24, kept outside Git (`3d-assets/male/source/*.glb` ignored), reproducible via `scripts/download-anatomy-assets/download.js`
- Female: `hra-reference-organ-united-female-v1.5.glb` — https://3d.nih.gov/entries/3DPX-020992 — PURL https://purl.humanatlas.io/ref-organ/united-female/v1.5 — CC-BY 4.0 — not yet downloaded

See `docs/architecture/hra-source.md` for full research and `3d-assets/SOURCES.md` for source records.

## First approved anatomy asset

- **Asset**: NIH/HRA male whole-body `hra-reference-organ-united-male-v1.5.glb` (Body, Male — Male-united set)
- **Original file location**: `3d-assets/male/source/hra-reference-organ-united-male-v1.5.glb` (preserved unmodified, 153596592 bytes, SHA-256 `34C45C90AA4ACD36BE19EDF8B878A8E7137DB9E8CB90E8E6332C2ABD49D7CF9D`, downloaded 2026-08-24 from `https://cdn.humanatlas.io/digital-objects/ref-organ/united-male/v1.5/assets/3d-vh-m-united.glb` and NIH `https://3d.nih.gov/entries/3DPX-021022`; kept outside Git via `.gitignore` `3d-assets/male/source/*.glb`, reproducible via `scripts/download-anatomy-assets/download.js`)
- **Source/license record**: `3d-assets/male/SOURCE.md` and `3d-assets/SOURCES.md` (male updated to Downloaded)
- **Inspection status**: Inspected — 849 meshes, 86 materials, 0 textures, 0 animations, 1035 nodes, 1 scene, 3863220 vertices, 4018087 triangles, bbox `-0.52364,-0.91462,-0.16059` to `0.52295,0.91489,0.15563` (approx 1.05×1.83×0.32, meters, height ~1.83), contains skin, organs (heart, lungs, liver, kidneys, brain, spleen, pancreas, intestine, bladder, prostate), bones, muscles, vessels, nerves (spinal cord segments). See `3d-assets/male/SOURCE.md` for full counts.
- **Optimization not yet performed**: Original preserved; heavy for first-load (146.48 MB) — will require splitting/optimization and CDN before React integration

## Future Extensions

- Systems and organs can be added as new `AnatomyAsset` entries without changing the loader
- Animations are separate clips referenced by `type: 'animation'`
- Versioning via filename suffix keeps cache and CDN invalidation simple
