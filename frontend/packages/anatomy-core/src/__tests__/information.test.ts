import {
  getAnatomyInformation,
  getAnatomyInformationByOntologyId,
  getAnatomyInformationByStructureKey,
  getAnatomyInformationKeys,
  getAnatomyInformationSeed,
  getRelatedAnatomyInformation,
} from '../anatomyInformation';

describe('anatomy information repository', () => {
  it('looks up records by body-qualified key', () => {
    expect(getAnatomyInformationByStructureKey('male:skin:UBERON:0002097')).toMatchObject({
      canonicalName: 'Skin',
      bodyModel: 'male',
    });
    expect(getAnatomyInformationByStructureKey('nope')).toBeUndefined();
    expect(getAnatomyInformationByStructureKey(null)).toBeUndefined();
  });

  it('resolves ontology ids per body and refuses ambiguous lookups', () => {
    expect(getAnatomyInformationByOntologyId('UBERON:0002097', 'female')).toMatchObject({
      structureKey: 'female:skin:UBERON:0002097',
    });
    // Ambiguous across bodies without a bodyModel -> undefined (no collision).
    expect(getAnatomyInformationByOntologyId('UBERON:0002097')).toBeUndefined();
    expect(getAnatomyInformationByOntologyId('missing')).toBeUndefined();
  });

  it('returns related records in declared order, same body only', () => {
    const related = getRelatedAnatomyInformation('male:cardiovascular:UBERON:0002084');
    expect(related.map(r => r.info.structureKey)).toEqual([
      'male:cardiovascular:UBERON:0000948',
      'male:cardiovascular:UBERON:0002080',
      'male:cardiovascular:UBERON:0001496',
    ]);
    expect(related[0]?.relation).toBe('part_of');
    for (const r of related) expect(r.info.bodyModel).toBe('male');
    expect(getRelatedAnatomyInformation('male:urinary:UBERON:0002113')).toEqual([]);
    expect(getRelatedAnatomyInformation(null)).toEqual([]);
  });

  it('keeps a stable, non-empty seed with unique keys', () => {
    const seed = getAnatomyInformationSeed();
    expect(seed.length).toBeGreaterThan(0);
    expect(getAnatomyInformationKeys()).toHaveLength(seed.length);
    expect(
      getAnatomyInformation({ structureKey: 'female:nervous:UBERON:0000955' } as never)
    ).toMatchObject({ canonicalName: 'Brain' });
    expect(getAnatomyInformation(null)).toBeUndefined();
  });
});
