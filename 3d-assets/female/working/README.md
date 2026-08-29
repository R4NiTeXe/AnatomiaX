# Female Working Assets

This directory contains **generated** working GLBs split from the preserved
source `3d-assets/female/source/hra-reference-organ-united-female-v1.5.glb`.

- **Source** is preserved unmodified at `3d-assets/female/source/` and kept
  outside Git (ignored via `.gitignore` `3d-assets/female/source/*.glb`).
  It is reproducible at any time from the official HRA CDN via
  `scripts/download-anatomy-assets/download-female.js` with SHA-256
  `472567A56896B9B7890508DA6501FBF858E56AAA30745365F7A71ADE782B529C`.
- **These working files** are produced by `scripts/split-female.js` using
  glTF-Transform 4.4.2. They preserve mesh data, materials, node names,
  `extras.ontologyid`, transforms, and coordinate system (Y up, meters).
  No optimization, compression, simplification, or decimation is applied here.
- **Optimization** (Meshopt/Draco, lazy-loading) comes **later** and will be
  stored separately (e.g., `working/optimized/` or CDN). Do not commit these
  working files to Git — they are large and reproducible.
- **Production assets** are not these files; final production GLBs will be
  optimized and versioned separately.

Regeneration:

```bash
node scripts/split-female.js
```

See `docs/architecture/female-asset-split.md` for split results and
`3d-assets/female/SOURCE.md` for source record.
