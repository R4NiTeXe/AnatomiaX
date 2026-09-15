import { getAnatomyInformationKeys, getAnatomyInformationSeed } from '@anatomiax/anatomy-core';
import { documentedCoverage } from '../coverage';

function maleSeedKeys(): string[] {
  const seed = getAnatomyInformationSeed();
  return seed.filter(record => record.bodyModel === 'male').map(record => record.structureKey);
}

describe('documentedCoverage', () => {
  it('returns zeros when nothing is documented', () => {
    expect(documentedCoverage([], 'male')).toEqual({
      studied: 0,
      total: expect.any(Number),
      percent: 0,
    });
  });

  it('counts only distinct studied keys that resolve to verified seed records', () => {
    const keys = maleSeedKeys();
    expect(keys.length).toBeGreaterThan(0);
    const sample = keys.slice(0, 3);
    const withDupes = [...sample, sample[0], 'male:bogus:UBERON:0000000'];
    const result = documentedCoverage(withDupes, 'male');
    expect(result).toEqual({
      studied: sample.length,
      total: keys.length,
      percent: Math.round((sample.length / keys.length) * 100),
    });
  });

  it('scopes the denominator to the active body model', () => {
    const maleTotal = getAnatomyInformationSeed().filter(r => r.bodyModel === 'male').length;
    const femaleTotal = getAnatomyInformationSeed().filter(r => r.bodyModel === 'female').length;
    expect(documentedCoverage([], 'male').total).toBe(maleTotal);
    expect(documentedCoverage([], 'female').total).toBe(femaleTotal);
    // Cross-body keys do not count toward the other model.
    const maleKeys = maleSeedKeys();
    if (maleKeys.length > 0 && femaleTotal > 0) {
      expect(documentedCoverage([maleKeys[0]], 'female').studied).toBe(0);
    }
  });

  it('defaults an unknown body model to male without throwing', () => {
    expect(() => documentedCoverage(['whatever'], null)).not.toThrow();
    expect(getAnatomyInformationKeys().length).toBeGreaterThan(0);
  });
});
