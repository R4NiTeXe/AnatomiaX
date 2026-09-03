/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public base URL for anatomy GLB assets (no secrets). */
  readonly VITE_ANATOMY_ASSET_BASE_URL?: string;
  /** Base URL for backend API (no secrets). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
