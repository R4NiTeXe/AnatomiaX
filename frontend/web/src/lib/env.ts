/**
 * Standard Vite environment access for the API origin.
 *
 * `import.meta.env.VITE_API_BASE_URL` is populated by `vite build`/`vite dev`
 * from the build environment (VITE_-prefixed process.env vars and .env files)
 * and statically replaced in the bundle — no manual `process.env` define needed.
 *
 * Kept in its own module because ts-jest emits CommonJS and cannot parse static
 * `import.meta` syntax: Jest substitutes env.jest.ts (jest.config.cjs
 * moduleNameMapper), which reads process.env at call time instead.
 */
export function readViteApiBaseUrl(): string | undefined {
  return import.meta.env.VITE_API_BASE_URL;
}
