import type { AnatomySystemKey } from '@anatomiax/shared-types';
import { getAnatomyInformationSeed } from '@anatomiax/anatomy-core';
import {
  ANATOMY_SYSTEM_DEFINITIONS,
  getAnatomySystem,
} from '@/components/anatomy/anatomyAssetConfig';

/**
 * Static study-module registry (STEP 8.49).
 * One module per anatomy system — the only grouping the verified data
 * supports (systems are the canonical catalog; no invented groupings).
 * All progress/continue math derives transparently from studied keys.
 */
export interface LearningModule {
  key: AnatomySystemKey;
  title: string;
  /** Verified record keys, deterministic structureKey order (explorer convention). */
  structureKeys: string[];
  totalStructures: number;
}

export type ModuleStatus = 'not-started' | 'in-progress' | 'complete';

export interface ModuleProgress {
  studied: number;
  total: number;
  percent: number;
  status: ModuleStatus;
}

export type ContinueReason = 'unfinished-module' | 'recent' | 'next-unstudied';

export interface ContinueTarget {
  structureKey: string;
  moduleKey: AnatomySystemKey | null;
  reason: ContinueReason;
}

let cachedModules: readonly LearningModule[] | null = null;

export function buildLearningModules(): readonly LearningModule[] {
  if (!cachedModules) {
    const bySystem = new Map<string, string[]>();
    for (const record of getAnatomyInformationSeed()) {
      const list = bySystem.get(record.systemKey) ?? [];
      list.push(record.structureKey);
      bySystem.set(record.systemKey, list);
    }
    cachedModules = ANATOMY_SYSTEM_DEFINITIONS.map(definition => {
      const keys = [...new Set(bySystem.get(definition.key) ?? [])].sort();
      return {
        key: definition.key,
        title: getAnatomySystem(definition.key as never).label,
        structureKeys: keys,
        totalStructures: keys.length,
      };
    });
  }
  return cachedModules;
}

export function getLearningModule(key: string): LearningModule | undefined {
  return buildLearningModules().find(module => module.key === key);
}

export function moduleProgress(
  module: LearningModule,
  studiedKeys: readonly string[]
): ModuleProgress {
  const studiedSet = new Set(studiedKeys);
  const studied = module.structureKeys.filter(key => studiedSet.has(key)).length;
  const total = module.totalStructures;
  const percent = total > 0 ? Math.round((studied / total) * 100) : 0;
  const status: ModuleStatus =
    total === 0 || studied === 0 ? 'not-started' : studied >= total ? 'complete' : 'in-progress';
  return { studied, total, percent, status };
}

/**
 * Curriculum Continue priority (STEP 8.49):
 * 1. first unstudied structure of the most-progressed unfinished module
 * 2. most recent valid studied key (revisit)
 * 3. first unstudied record overall
 * Returns null only when no target exists at all.
 */
export function findContinueTarget(
  modules: readonly LearningModule[],
  studiedKeys: readonly string[]
): ContinueTarget | null {
  const studied = new Set(studiedKeys.filter(key => key.length > 0));
  let best: LearningModule | null = null;
  let bestPercent = -1;
  for (const module of modules) {
    const progress = moduleProgress(module, studiedKeys);
    if (progress.status === 'in-progress' && progress.percent > bestPercent) {
      best = module;
      bestPercent = progress.percent;
    }
  }
  if (best) {
    const next = best.structureKeys.find(key => !studied.has(key));
    if (next) return { structureKey: next, moduleKey: best.key, reason: 'unfinished-module' };
  }
  const recent = studiedKeys.find(key => key.length > 0);
  if (recent) {
    const moduleKey = modules.find(module => module.structureKeys.includes(recent))?.key ?? null;
    return { structureKey: recent, moduleKey, reason: 'recent' };
  }
  for (const module of modules) {
    const next = module.structureKeys.find(key => !studied.has(key));
    if (next) return { structureKey: next, moduleKey: module.key, reason: 'next-unstudied' };
  }
  return null;
}
