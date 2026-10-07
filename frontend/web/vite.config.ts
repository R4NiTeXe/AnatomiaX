import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const envDir = fileURLToPath(new URL('.', import.meta.url));
    const apiBaseUrlPresent = Boolean(loadEnv(mode, envDir, 'VITE_').VITE_API_BASE_URL);
    console.log('[build] VITE_API_BASE_URL present:', apiBaseUrlPresent);
    if (mode === 'production' && !apiBaseUrlPresent) {
      throw new Error('VITE_API_BASE_URL is missing from the production build environment.');
    }
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
      'process.env.VITE_ANATOMY_ASSET_BASE_URL': JSON.stringify(
        process.env.VITE_ANATOMY_ASSET_BASE_URL ?? ''
      ),
      'process.env.NODE_ENV': JSON.stringify(
        mode === 'production' ? 'production' : (process.env.NODE_ENV ?? 'development')
      ),
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      rollupOptions: {
        output: {
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
