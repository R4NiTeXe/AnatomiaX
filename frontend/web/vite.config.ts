import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    // Build-time diagnostic + fail-fast guard: a production bundle without an
    // API origin would throw at runtime in getApiBaseUrl(), so fail the build
    // instead of shipping a broken app. Log presence only — never the value.
    const envDir = fileURLToPath(new URL('.', import.meta.url));
    const apiBaseUrlPresent = Boolean(loadEnv(mode, envDir, 'VITE_').VITE_API_BASE_URL);
    console.log('[build] VITE_API_BASE_URL present:', apiBaseUrlPresent);
    if (mode === 'production' && !apiBaseUrlPresent) {
      throw new Error('VITE_API_BASE_URL is missing from the production build environment.');
    }
    // Anatomy asset base guard (Vercel deployments only): the bundle resolves
    // GLBs from VITE_ANATOMY_ASSET_BASE_URL, falling back to the gitignored
    // local /models-dev/ subset when unset. Those dev files can never exist
    // in a Vercel deployment, so a Vercel build without a real HTTPS static
    // host bakes in URLs that serve index.html (SPA fallback) instead of
    // binary — the viewer then fails with "Unexpected token '<'". Fail the
    // build instead of shipping a model-less app. Scoped to Vercel so local
    // and CI builds keep working without the variable. Log presence only.
    const assetBase = process.env.VITE_ANATOMY_ASSET_BASE_URL ?? '';
    const assetBasePresent = /^https:\/\//i.test(assetBase.trim());
    console.log('[build] VITE_ANATOMY_ASSET_BASE_URL present:', assetBasePresent);
    if (process.env.VERCEL && !assetBasePresent) {
      throw new Error(
        'VITE_ANATOMY_ASSET_BASE_URL must be set to the HTTPS static asset host base ' +
          '(e.g. https://<host>/anatomy/) for Vercel builds — unset or /models-dev/ values bake in ' +
          'dev-only GLB paths that resolve to index.html in deployment. ' +
          'See docs/architecture/asset-hosting.md.'
      );
    }
  }
  return {
    plugins: [react()],
    define: {
      // 8.61: the anatomy asset base must be defined for the client — the
      // resolver reads this literal chain (Vite replaces it at bundle time).
      // Unset/empty falls back to local /models-dev/ at runtime.
      'process.env.VITE_ANATOMY_ASSET_BASE_URL': JSON.stringify(
        process.env.VITE_ANATOMY_ASSET_BASE_URL ?? ''
      ),
      'process.env.NODE_ENV': JSON.stringify(
        mode === 'production' ? 'production' : (process.env.NODE_ENV ?? 'development')
      ),
      // VITE_API_BASE_URL is intentionally not defined here: standard Vite
      // import.meta.env.VITE_API_BASE_URL picks it up automatically from the
      // build environment (VITE_-prefixed process.env vars + .env files).
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // STEP 8.20.9: split stable vendor groups for better caching.
          // Route-level lazy loading is preserved (App.tsx lazy routes).
          // three-core + three-r3f stay lazy via /human chunk; react/query/ui
          // vendors are shared. No chunk-limit warning suppression.
          // STEP 8.23: motion vendor chunk — keeps the Motion foundation out
          // of the index entry so the entry budget holds.
          manualChunks(id: string): string | undefined {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/three/') || id.includes('three-stdlib') || id.includes('meshopt')) {
              return 'three-core';
            }
            if (id.includes('@react-three')) {
              return 'three-r3f';
            }
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/react-router') ||
              id.includes('/scheduler/') ||
              id.includes('/remix-run/')
            ) {
              return 'react-vendor';
            }
            if (id.includes('@tanstack')) {
              return 'query-vendor';
            }
            if (id.includes('/motion/') || id.includes('motion-dom')) {
              return 'motion-vendor';
            }
            if (
              id.includes('@radix-ui') ||
              id.includes('class-variance-authority') ||
              id.includes('/clsx/') ||
              id.includes('tailwind-merge') ||
              id.includes('lucide-react')
            ) {
              return 'ui-vendor';
            }
            return undefined;
          },
        },
      },
    },
    server: {
      port: 5173,
    },
    preview: {
      port: 4173,
    },
  };
});
