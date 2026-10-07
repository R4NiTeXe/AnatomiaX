import type { AnatomyStructure } from '@anatomiax/shared-types';
import {
  AnatomyStructureRegistry,
  createStructureKey,
  createStructureKeyForBody,
  findStructureByOntologyId,
  findStructuresByName,
  findStructuresBySystem,
  normalizeQuery,
  readOntologyCandidate,
  searchStructures,
} from '../structureRegistry';

function fakeStructure(overrides: Partial<AnatomyStructure> = {}): AnatomyStructure {
  return {
    id: 'male:skin:UBERON:0002097',
    structureKey: 'male:skin:UBERON:0002097',
    name: 'Skin',
    objectName: 'VH_M_skin',
    systemKey: 'skin',
    bodyModel: 'male',
    ontologyId: 'UBERON:0002097',
    lineage: ['VH_M_skin'],
    ...overrides,
  };
}

describe('structure keys', () => {
  it('prefers ontology ids and falls back to sanitized object names', () => {
    expect(createStructureKey('skin', 'UBERON:0002097', 'VH_M_skin', 'male')).toBe(
      'male:skin:UBERON:0002097'
    );
    expect(createStructureKey('nervous', null, 'My Region 1', 'female')).toBe(
      'female:nervous:object:My_Region_1'
    );
    expect(createStructureKey('nervous', '   ', '', 'male')).toBe('male:nervous:object:unnamed');
    expect(createStructureKeyForBody('female', 'skin', 'UBERON:0002097', 'x')).toBe(
      'female:skin:UBERON:0002097'
    );
  });

  it('reads ontology candidates case-insensitively, including nested extras', () => {
    expect(readOntologyCandidate({ OntologyID: 'UBERON:1' })).toBe('UBERON:1');
    expect(readOntologyCandidate({ extras: { representation_of: 'UBERON:2' } })).toBe('UBERON:2');
    expect(readOntologyCandidate({})).toBeNull();
    expect(readOntologyCandidate(null)).toBeNull();
  });

  it('normalizes queries deterministically', () => {
    expect(normalizeQuery('  Hilum   OF lung!! ')).toBe('hilum of lung');
    expect(normalizeQuery('')).toBe('');
  });
});

describe('AnatomyStructureRegistry', () => {
  it('registers, finds, unregisters, and clears', () => {
    const registry = new AnatomyStructureRegistry();
    registry.register(fakeStructure());
    expect(registry.size).toBe(1);
    expect(registry.findByStructureKey('male:skin:UBERON:0002097')?.name).toBe('Skin');
    expect(registry.findStructureByOntologyId('UBERON:0002097')?.structureKey).toBe(
      'male:skin:UBERON:0002097'
    );
    expect(registry.findStructuresBySystem('skin')).toHaveLength(1);
    registry.register(fakeStructure());
    expect(registry.size).toBe(1);
    registry.unregisterSystem('skin');
    expect(registry.size).toBe(0);
    registry.register(fakeStructure());
    registry.clear();
    expect(registry.size).toBe(0);
  });

  it('ranks exact matches first and enriches via canonical names', () => {
    const registry = new AnatomyStructureRegistry();
    registry.register(
      fakeStructure({
        id: 'male:respiratory:UBERON:0004887',
        structureKey: 'male:respiratory:UBERON:0004887',
        name: 'Hilum',
        objectName: 'VH_M_hilum_L',
        systemKey: 'respiratory',
        ontologyId: 'UBERON:0004887',
        lineage: [],
      })
    );
    registry.register(fakeStructure());
    const hits = searchStructures(registry, 'lung', { bodyModel: 'male' });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.structureKey).toBe('male:respiratory:UBERON:0004887');
    expect(searchStructures(registry, '', { bodyModel: 'male' })).toEqual([]);
    expect(searchStructures(registry, 'skin', { bodyModel: 'female' })).toEqual([]);
  });

  it('looks structures up through the module-level wrappers', () => {
    const registry = new AnatomyStructureRegistry();
    registry.register(fakeStructure());
    expect(findStructureByOntologyId(registry, 'UBERON:0002097')?.name).toBe('Skin');
    expect(findStructureByOntologyId(registry, 'UBERON:nope')).toBeUndefined();
    expect(findStructuresBySystem(registry, 'skin')).toHaveLength(1);
    expect(findStructuresBySystem(registry, 'nervous')).toEqual([]);
    expect(findStructuresByName(registry, 'VH_M_skin')).toHaveLength(1);
    expect(findStructuresByName(registry, 'nope')).toEqual([]);
  });

  it('finds by object name with miss paths', () => {
    const registry = new AnatomyStructureRegistry();
    registry.register(fakeStructure());
    expect(registry.findStructureByObjectName('VH_M_skin')?.name).toBe('Skin');
    expect(registry.findStructureByObjectName('missing')).toBeUndefined();
    expect(registry.findStructuresByObjectName('VH_M_skin')).toHaveLength(1);
    expect(registry.findStructuresByObjectName('missing')).toEqual([]);
    expect(registry.findStructuresByOntologyId('UBERON:nope')).toEqual([]);
  });

  it('exercises every match tier through crafted entries', () => {
    const entryFor = (name: string, tag: string) =>
      fakeStructure({
        id: `male:skin:object:${tag}`,
        structureKey: `male:skin:object:${tag}`,
        name,
        objectName: `VH_M_${tag}`,
        ontologyId: null,
      });
    const withEntry = (name: string, tag: string) => {
      const registry = new AnatomyStructureRegistry();
      registry.register(entryFor(name, tag));
      return registry;
    };
    expect(searchStructures(withEntry('alpha', 'q0'), 'alpha', { bodyModel: 'male' })).toHaveLength(
      1
    );
    expect(searchStructures(withEntry('alpha', 'q1'), 'alph', { bodyModel: 'male' })).toHaveLength(
      1
    );
    expect(searchStructures(withEntry('alpha', 'q2'), 'lpha', { bodyModel: 'male' })).toHaveLength(
      1
    );
    expect(
      searchStructures(withEntry('alpha beta gamma', 'q3'), 'alpha gamma', { bodyModel: 'male' })
    ).toHaveLength(1);
    expect(
      searchStructures(withEntry('alpha beta gamma', 'q4'), 'gamma alpha', { bodyModel: 'male' })
    ).toHaveLength(1);
    expect(searchStructures(withEntry('alpha', 'q5'), 'zzzqqq', { bodyModel: 'male' })).toEqual([]);
  });

  it('breaks specificity ties deterministically', () => {
    const registry = new AnatomyStructureRegistry();
    const entryFor = (name: string, tag: string) =>
      fakeStructure({
        id: `male:skin:object:${tag}`,
        structureKey: `male:skin:object:${tag}`,
        name,
        objectName: `VH_M_${tag}`,
        ontologyId: null,
      });
    registry.register(entryFor('abd', 't2'));
    registry.register(entryFor('abc', 't1'));
    const hits = searchStructures(registry, 'ab', { bodyModel: 'male' });
    expect(hits.map(h => h.name)).toEqual(['abc', 'abd']);
  });

  it('misses cleanly on unknown ontology ids', () => {
    const registry = new AnatomyStructureRegistry();
    expect(registry.findStructuresByOntologyId('UBERON:nope')).toEqual([]);
  });

  it('registers batches idempotently and unregisters unknown systems safely', () => {
    const registry = new AnatomyStructureRegistry();
    const added = registry.registerStructures([fakeStructure(), fakeStructure()]);
    expect(added).toHaveLength(1);
    expect(registry.size).toBe(1);
    expect(() => registry.unregisterSystem('nervous')).not.toThrow();
    registry.unregisterSystem('skin');
    expect(registry.size).toBe(0);
    expect(registry.findStructuresBySystem('skin')).toEqual([]);
  });
});
