# /human Loading Performance Contract (8.55)

Measured locally (Vite dev, software WebGL): shell ~2.0s < ready ~2.5s cold;
warm return ~29ms vs ~1885ms cold. Repeat measurement after viewer changes.

1. GLBs are external assets (`public/models-dev/` locally, CDN base in prod).
   They never enter JS bundles (perf budget enforces).
2. The API does not serve public GLBs. Model load/switch issues zero NestJS
   requests and requires zero DB lookups (probes assert this).
3. The resolver owns asset URLs (`assetResolver.ts`). Loader cache keys are
   the resolved strings; no component builds URLs manually.
4. `useGLTF` cache handles loaded-model reuse. No second global cache; no
   aggressive prefetch (audited decision in `asset-hosting.md`).
5. UI stays useful before GLB readiness: shell/controls render immediately,
   viewer geometry is stable (`min-h-[55vh]`, 8.32 fix), loading copy names
   the known model ("Preparing male/female anatomy…") — never percentages.
6. Retry recovers without page refresh: panel clears the exact resolver cache
   key, `retrySystem` remounts via `attempts`, error boundary resets with it.
7. Viewer lifecycle must not leak: slot keys bind body model + attempts so
   rapid switches always resolve to the last selection; navigation
   away/back keeps exactly one canvas. Deep-link applies focus once and never
   yanks back a manual model switch.
8. Accessibility: `role="status"` on loading overlay and per-system errors
   (announced once); spinner is `motion-safe` only.
