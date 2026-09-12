import type { AnatomyStructure } from '@anatomiax/shared-types';
import {
  AnatomyStructureRegistry,
  createStructureKey,
  createStructureKeyForBody,
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
});
