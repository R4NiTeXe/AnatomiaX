/**
 * Central typed anatomy asset URL resolver (STEP 8.54).
 *
 * ONE place that turns (bodyModel, system) into a fetchable GLB URL:
 *   resolveAnatomyAssetUrl('female', 'nervous')
 *     → local: /models-dev/female-nervous-meshopt.glb
 *     → CDN:   https://assets.example/anatomy/female/nervous-meshopt.glb
 *
 * - Local mode: base unset/empty → `/models-dev/` (existing Vite `public/` files,
 *   no cloud account, no config).
 * - CDN mode: `VITE_ANATOMY_ASSET_BASE_URL` (or explicit `base`) → provider-neutral
 *   `<base>/<bodyModel>/<file>` (S3, R2, GCS, nginx — the frontend never knows).
 * - Versioning lives in the base URL (e.g. `…/anatomy/v1/`): old clients keep
 *   loading old bytes, a new deploy points at a new prefix. No per-render
 *   query-string cache-busting; the manifest SHA-256 stays available via
 *   `versionedUrl` for immutable deployments.
 * - Malformed remote bases throw clearly instead of silently building a bad URL.
 *
 * No component may construct GLB URLs manually — use this resolver so loader
 * cache keys, retry clearing, and tests share one contract.
 */
import type { AnatomyBodyModelKey, AnatomySystemKey } from '@anatomiax/shared-types';
import {
  ASSET_MANIFEST,
  buildAssetUrl,
  findManifestEntry,
  getVersionedAssetUrl,
} from './assetManifest';

/** Local-dev asset origin (Vite serves `frontend/web/public/`). */
export const LOCAL_ASSET_BASE = '/models-dev/';

/**
 * Reads the frontend-safe asset base without static `import.meta` syntax
 * (ts-jest CJS cannot parse it; the previous `Function()` indirection never
 * executed in any browser — functions built by the Function constructor have
 * no `import.meta` binding, so CDN mode could never activate).
 *
 * Uses the repository's `process.env.VITE_*` convention instead: Vite's
 * `define` statically replaces the literal `process.env.VITE_...` chain at
 * bundle time, while Jest/Node read the real process.env and fall back to
 * local mode when unset. The literal must stay exact — optional chaining
 * (`process.env?.X`) or a cast breaks Vite's match and CDN mode silently
 * never activates. Public build-time value — never a secret.
 */
declare const process: { env: Record<string, string | undefined> };

export function readConfiguredAssetBase(): string | undefined {
  try {
    // No `typeof process` early-return: in the browser bundle Vite has
    // already replaced the literal below with the build-time string, and a
    // guard would prevent ever reaching it. Runtimes without `process` (or
    // any define mishap) throw here and fall back to local mode via catch.
    return process.env.VITE_ANATOMY_ASSET_BASE_URL ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Typed, normalized asset base. Empty/undefined → local mode. Throws a clear
 * error for malformed remote bases (wrong scheme, insecure non-localhost
 * http) instead of producing an invalid URL downstream.
 */
export function resolveAssetBase(base?: string | null): string {
  const raw = (base ?? readConfiguredAssetBase() ?? '').trim() || LOCAL_ASSET_BASE;
  const normalized = raw.endsWith('/') ? raw : `${raw}/`;
  const isRelative = normalized.startsWith('/');
  const isHttp = /^https?:\/\//i.test(normalized);
  if (!isRelative && !isHttp) {
    throw new Error(
      `Invalid anatomy asset base ${JSON.stringify(raw)}: expected a path starting with '/' or an http(s) URL.`
    );
  }
  if (
    /^http:\/\//i.test(normalized) &&
    !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(normalized)
  ) {
    throw new Error(
      `Insecure anatomy asset base ${JSON.stringify(raw)}: production delivery must be https:// (http is allowed only for localhost development).`
    );
  }
  return normalized;
}

export interface ResolvedAnatomyAsset {
  bodyModel: AnatomyBodyModelKey;
  system: AnatomySystemKey;
  /** Canonical fetch URL (stable — safe as loader cache key). */
  url: string;
  /** Immutable variant (`?v=<shortHash>`) for long-edge-TTL deployments. */
  versionedUrl: string;
  bytes: number;
  sha256: string;
}

/** Full typed resolution for one manifest asset. Throws on unknown assets. */
export function resolveAnatomyAsset(
  bodyModel: AnatomyBodyModelKey,
  system: AnatomySystemKey,
  base?: string | null
): ResolvedAnatomyAsset {
  const entry = findManifestEntry(bodyModel, system);
  if (!entry) {
    throw new Error(`Unknown anatomy asset: ${bodyModel}/${system} (no manifest entry)`);
  }
  const resolvedBase = resolveAssetBase(base);
  return {
    bodyModel,
    system,
    url: buildAssetUrl(resolvedBase, bodyModel, entry.file),
    versionedUrl: getVersionedAssetUrl(resolvedBase, entry),
    bytes: entry.bytes,
    sha256: entry.sha256,
  };
}

/** Canonical fetch URL for one asset — the single loader contract. */
export function resolveAnatomyAssetUrl(
  bodyModel: AnatomyBodyModelKey,
  system: AnatomySystemKey,
  base?: string | null
): string {
  return resolveAnatomyAsset(bodyModel, system, base).url;
}

/** Every manifest asset resolves (manifest order) — validation entry point. */
export function resolveAllAnatomyAssetUrls(base?: string | null): string[] {
  const resolvedBase = resolveAssetBase(base);
  return ASSET_MANIFEST.map(entry => buildAssetUrl(resolvedBase, entry.bodyModel, entry.file));
}
