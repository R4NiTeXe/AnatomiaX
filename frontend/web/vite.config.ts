import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    'process.env.VITE_API_BASE_URL': JSON.stringify(
      process.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
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
        // STEP 8.20.9: split stable vendor groups for better caching.
        // Route-level lazy loading is preserved (App.tsx lazy routes).
        // three-core + three-r3f stay lazy via /human chunk; react/query/ui
        // vendors are shared. No chunk-limit warning suppression.
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
}));
