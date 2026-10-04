import {
  getAnatomyInformationByStructureKey,
  getAnatomyInformationSeed,
} from '@anatomiax/anatomy-core';

export interface DocumentedCoverage {
  /** Distinct studied keys that resolve to verified seed records. */
  studied: number;
  /** Verified seed records for the body model. */
  total: number;
  /** Whole percent, 0 when there is nothing documented. */
  percent: number;
}

/**
 * Coverage of studied keys against the verified anatomy information seed.
 * Only keys that resolve to a real seed record for the active body model
 * count — unknown/custom keys never inflate the number, and the denominator
 * is the documented set, labeled as such wherever it is rendered.
 */
export function documentedCoverage(
  studiedKeys: readonly string[],
  bodyModel: string | null | undefined
): DocumentedCoverage {
  const body = bodyModel === 'female' ? 'female' : 'male';
  const seed = getAnatomyInformationSeed();
  const total = seed.filter(record => record.bodyModel === body).length;
  const seen = new Set<string>();
  for (const key of studiedKeys) {
    const info = getAnatomyInformationByStructureKey(key);
    if (info && info.bodyModel === body) seen.add(key);
  }
  const studied = seen.size;
  const percent = total > 0 ? Math.round((studied / total) * 100) : 0;
  return { studied, total, percent };
}
