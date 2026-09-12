import { devAssetFilename } from '@anatomiax/anatomy-core';
import type { AssetManifestEntry } from '@anatomiax/anatomy-core';

/**
 * 8.19.34 mobile asset-base configuration. No secrets: the base URL is a
 * plain HTTPS origin (dev server today, any ordinary static host later).
 * Production layout convention: `<base>/<bodyModel>/<file>`.
 */

const DEFAULT_DEV_BASE_URL = 'http://10.0.2.2:5173/models-dev';

function getRawBaseUrl(): string | undefined {
  if (typeof process !== 'undefined') {
    const fromProcess = (process.env as Record<string, string | undefined>)
      .EXPO_PUBLIC_ANATOMY_ASSET_BASE_URL;
    if (fromProcess) return fromProcess;
  }
  return undefined;
}

export function getAnatomyAssetBaseUrl(): string {
  const raw = getRawBaseUrl() ?? DEFAULT_DEV_BASE_URL;
  return raw.replace(/\/+$/, '');
}

type ManifestIdentity = Pick<AssetManifestEntry, 'bodyModel' | 'file'>;

/**
 * Local-dev flat layout — the same files the web dev server serves today
 * (`male` unprefixed, `female-`-prefixed, no body directories).
 */
export function resolveDevAssetUrl(entry: ManifestIdentity): string {
  return `${getAnatomyAssetBaseUrl()}/${devAssetFilename(entry.bodyModel, entry.file)}`;
}

/** Recommended production layout on any static host. */
export function resolveHostedAssetUrl(baseUrl: string, entry: ManifestIdentity): string {
  return `${baseUrl.replace(/\/+$/, '')}/${entry.bodyModel}/${entry.file}`;
}

/** Unique flat filename for the on-device cache (no collisions across bodies). */
export function cacheFileName(entry: ManifestIdentity): string {
  return devAssetFilename(entry.bodyModel, entry.file);
}
