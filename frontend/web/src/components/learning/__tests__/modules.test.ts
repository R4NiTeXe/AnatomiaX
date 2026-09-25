import {
  buildLearningModules,
  findContinueTarget,
  getLearningModule,
  moduleProgress,
} from '../modules';

describe('learning modules (8.49)', () => {
  it('builds one deterministic module per anatomy system', () => {
    const modules = buildLearningModules();
    expect(modules).toHaveLength(9);
    expect(modules.map(m => m.key)).toEqual([
      'skin',
      'musculoskeletal',
      'nervous',
      'cardiovascular',
      'respiratory',
      'digestive',
      'urinary',
      'reproductive',
      'lymphatic',
    ]);
    const seen = new Set<string>();
    for (const module of modules) {
      expect(module.title.length).toBeGreaterThan(0);
      expect(module.totalStructures).toBe(module.structureKeys.length);
      const sorted = [...module.structureKeys].sort();
      expect(module.structureKeys).toEqual(sorted);
      for (const key of module.structureKeys) {
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
    expect(seen.size).toBe(53);
  });

  it('validates module lookup', () => {
    expect(getLearningModule('nervous')?.title).toBe('Nervous');
    expect(getLearningModule('nope')).toBeUndefined();
    expect(getLearningModule('')).toBeUndefined();
  });

  it('derives transparent progress math', () => {
    const nervous = getLearningModule('nervous') as NonNullable<
      ReturnType<typeof getLearningModule>
    >;
    expect(moduleProgress(nervous, [])).toEqual({
      studied: 0,
      total: nervous.totalStructures,
      percent: 0,
      status: 'not-started',
    });
    const one = moduleProgress(nervous, [nervous.structureKeys[0]]);
    expect(one).toMatchObject({ studied: 1, status: 'in-progress' });
    expect(one.percent).toBe(Math.round((1 / nervous.totalStructures) * 100));
    const all = moduleProgress(nervous, nervous.structureKeys);
    expect(all).toMatchObject({
      studied: nervous.totalStructures,
      percent: 100,
      status: 'complete',
    });
    // Unknown keys never inflate counts.
    expect(moduleProgress(nervous, ['bogus']).studied).toBe(0);
  });

  it('prefers unfinished module content over recency', () => {
    const modules = buildLearningModules();
    const nervous = getLearningModule('nervous') as NonNullable<
      ReturnType<typeof getLearningModule>
    >;
    // One nervous structure studied: continue stays inside nervous.
    const target = findContinueTarget(modules, [nervous.structureKeys[0]]);
    expect(target?.reason).toBe('unfinished-module');
    expect(target?.moduleKey).toBe('nervous');
    expect(target?.structureKey).toBe(nervous.structureKeys[1]);
  });

  it('falls back to recent, then next unstudied, then null', () => {
    const modules = buildLearningModules();
    // Fully studied nervous: most recent valid key wins (revisit).
    const nervous = getLearningModule('nervous') as NonNullable<
      ReturnType<typeof getLearningModule>
    >;
    const recent = findContinueTarget(modules, [...nervous.structureKeys].reverse());
    expect(recent?.reason).toBe('recent');
    // Nothing studied: first record of the first module.
    const fresh = findContinueTarget(modules, []);
    expect(fresh?.reason).toBe('next-unstudied');
    expect(fresh?.structureKey).toBe(modules[0].structureKeys[0]);
    expect(findContinueTarget([], [])).toBeNull();
  });
});
