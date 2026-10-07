import {
  getAnatomyInformationByStructureKey,
  getAnatomyInformationSeed,
} from '@anatomiax/anatomy-core';

export interface DocumentedCoverage {
  studied: number;
  total: number;
  percent: number;
}

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
