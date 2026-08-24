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

- Male: `hra-reference-organ-united-male-v1.5.glb` — https://3d.nih.gov/entries/3DPX-021022 — PURL https://purl.humanatlas.io/ref-organ/united-male/v1.5 — CC-BY 4.0 — not yet downloaded
- Female: `hra-reference-organ-united-female-v1.5.glb` — https://3d.nih.gov/entries/3DPX-020992 — PURL https://purl.humanatlas.io/ref-organ/united-female/v1.5 — CC-BY 4.0 — not yet downloaded

See `docs/architecture/hra-source.md` for full research and `3d-assets/SOURCES.md` for source records.

## Future Extensions

- Systems and organs can be added as new `AnatomyAsset` entries without changing the loader
- Animations are separate clips referenced by `type: 'animation'`
- Versioning via filename suffix keeps cache and CDN invalidation simple
