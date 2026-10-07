import type { AnatomyBodyModelKey, AnatomySystemKey } from '@anatomiax/shared-types';
import {
  ASSET_MANIFEST,
  buildAssetUrl,
  findManifestEntry,
  getVersionedAssetUrl,
} from './assetManifest';

export const LOCAL_ASSET_BASE = '/models-dev/';

declare const process: { env: Record<string, string | undefined> };

export function readConfiguredAssetBase(): string | undefined {
  try {
    return process.env.VITE_ANATOMY_ASSET_BASE_URL ?? undefined;
  } catch {
    return undefined;
  }
}

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
  url: string;
  versionedUrl: string;
  bytes: number;
  sha256: string;
}

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

export function resolveAnatomyAssetUrl(
  bodyModel: AnatomyBodyModelKey,
  system: AnatomySystemKey,
  base?: string | null
): string {
  return resolveAnatomyAsset(bodyModel, system, base).url;
}

export function resolveAllAnatomyAssetUrls(base?: string | null): string[] {
  const resolvedBase = resolveAssetBase(base);
  return ASSET_MANIFEST.map(entry => buildAssetUrl(resolvedBase, entry.bodyModel, entry.file));
}
