/**
 * Jest substitute for env.ts (wired in jest.config.cjs moduleNameMapper).
 *
 * The real module reads static `import.meta.env` syntax that ts-jest's
 * CommonJS output cannot parse; this shim reads process.env at call time so
 * tests can set and restore VITE_API_BASE_URL around each assertion.
 */
export function readViteApiBaseUrl(): string | undefined {
  return process.env.VITE_API_BASE_URL;
}
