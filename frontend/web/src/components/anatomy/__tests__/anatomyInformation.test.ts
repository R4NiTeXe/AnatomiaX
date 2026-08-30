// @ts-nocheck
import { AnatomyStructureRegistry } from '../anatomyRegistry';
import type { AnatomySelection } from '../anatomyTypes';
import {
  getAnatomyInformation,
  getAnatomyInformationByOntologyId,
  getAnatomyInformationByStructureKey,
  getAnatomyInformationKeys,
  getAnatomyInformationSeed,
} from '../anatomyInformation';

describe('anatomyInformation — verified source architecture', () => {
  it('lookup by structureKey returns correct record', () => {
    const info = getAnatomyInformationByStructureKey('male:skin:UBERON:0002097');
    expect(info).toBeDefined();
    expect(info?.canonicalName).toBe('Skin');
    expect(info?.structureKey).toBe('male:skin:UBERON:0002097');
    expect(info?.ontologyId).toBe('UBERON:0002097');
  });

  it('male/female same ontology remain separate (never overwrite)', () => {
    const male = getAnatomyInformationByStructureKey('male:skin:UBERON:0002097');
    const female = getAnatomyInformationByStructureKey('female:skin:UBERON:0002097');
    expect(male).toBeDefined();
    expect(female).toBeDefined();
    expect(male?.structureKey).not.toBe(female?.structureKey);
    expect(male?.bodyModel).toBe('male');
    expect(female?.bodyModel).toBe('female');
    // Different objects, same ontology but distinct
    expect(male?.ontologyId).toBe(female?.ontologyId);
    expect(male).not.toBe(female);
    // Heart also separate
    const maleHeart = getAnatomyInformationByStructureKey('male:cardiovascular:UBERON:0000948');
    const femaleHeart = getAnatomyInformationByStructureKey('female:cardiovascular:UBERON:0000948');
    expect(maleHeart?.bodyModel).toBe('male');
    expect(femaleHeart?.bodyModel).toBe('female');
    expect(maleHeart?.structureKey).not.toBe(femaleHeart?.structureKey);
  });

  it('lookup by ontology when unambiguous returns record, ambiguous without bodyModel returns undefined', () => {
    // Ovary only exists for female in seed — unambiguous
    const ovary = getAnatomyInformationByOntologyId('UBERON:0000992');
    expect(ovary).toBeDefined();
    expect(ovary?.canonicalName).toBe('Ovary');
    expect(ovary?.bodyModel).toBe('female');

    // Skin exists in both male and female — ambiguous without bodyModel
    const ambiguous = getAnatomyInformationByOntologyId('UBERON:0002097');
    expect(ambiguous).toBeUndefined();

    // With bodyModel disambiguation returns correct
    const maleSkin = getAnatomyInformationByOntologyId('UBERON:0002097', 'male');
    const femaleSkin = getAnatomyInformationByOntologyId('UBERON:0002097', 'female');
    expect(maleSkin?.bodyModel).toBe('male');
    expect(femaleSkin?.bodyModel).toBe('female');
  });

  it('unavailable structure returns undefined', () => {
    const missing = getAnatomyInformationByStructureKey('male:lymphatic:UBERON:9999999');
    expect(missing).toBeUndefined();
    const missing2 = getAnatomyInformation({
      structureKey: 'female:reproductive:UBERON:9999999',
      bodyModel: 'female',
      systemKey: 'reproductive',
      ontologyId: 'UBERON:9999999',
      name: 'Unknown',
      objectName: 'Unknown',
    } as AnatomySelection);
    expect(missing2).toBeUndefined();
    const nullSelection = getAnatomyInformation(null as unknown as AnatomySelection);
    expect(nullSelection).toBeUndefined();
    const emptyKey = getAnatomyInformationByStructureKey('');
    expect(emptyKey).toBeUndefined();
  });

  it('provenance is preserved (source, sourceUrl, lastVerified, license)', () => {
    const info = getAnatomyInformationByStructureKey('male:cardiovascular:UBERON:0000948');
    expect(info?.source).toBeDefined();
    expect(info?.sourceUrl).toMatch(/^https:\/\//);
    expect(info?.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Spot-check a few
    const skin = getAnatomyInformationByStructureKey('female:skin:UBERON:0002097');
    expect(skin?.source).toBe('NIH');
    expect(skin?.sourceUrl).toBe('https://medlineplus.gov/ency/article/002363.htm');
    expect(skin?.license).toBe('Public domain (NIH)');
    const ovary = getAnatomyInformationByStructureKey('female:reproductive:UBERON:0000992');
    expect(ovary?.source).toBe('Human Reference Atlas');
    expect(ovary?.sourceUrl).toBe('https://humanatlas.io/asct-b-reporter');
    expect(ovary?.license).toBe('CC BY 4.0 (HRA)');
    // Verify all seed entries have provenance
    for (const entry of getAnatomyInformationSeed()) {
      expect(entry.source).toBeDefined();
      expect(entry.sourceUrl).toBeDefined();
      expect(entry.lastVerified).toBeDefined();
    }
  });

  it('selection → information lookup via getAnatomyInformation', () => {
    const selection: AnatomySelection = {
      structureKey: 'female:reproductive:UBERON:0000995',
      name: 'VH_F_uterus',
      objectName: 'VH_F_uterus',
      systemKey: 'reproductive',
      bodyModel: 'female',
      ontologyId: 'UBERON:0000995',
    };
    const info = getAnatomyInformation(selection);
    expect(info).toBeDefined();
    expect(info?.canonicalName).toBe('Uterus');
    expect(info?.systemKey).toBe('reproductive');
    expect(info?.bodyModel).toBe('female');

    // Male counterpart for shared structure
    const maleSelection: AnatomySelection = {
      structureKey: 'male:nervous:UBERON:0000955',
      name: 'VH_M_brain',
      objectName: 'VH_M_brain',
      systemKey: 'nervous',
      bodyModel: 'male',
      ontologyId: 'UBERON:0000955',
    };
    const maleInfo = getAnatomyInformation(maleSelection);
    expect(maleInfo?.canonicalName).toBe('Brain');

    // Female heart via selection
    const femaleHeartSel: AnatomySelection = {
      structureKey: 'female:cardiovascular:UBERON:0000948',
      name: 'VH_F_heart',
      objectName: 'VH_F_heart',
      systemKey: 'cardiovascular',
      bodyModel: 'female',
      ontologyId: 'UBERON:0000948',
    };
    expect(getAnatomyInformation(femaleHeartSel)?.canonicalName).toBe('Heart');
  });

  it('no registry mutation', () => {
    const registry = new AnatomyStructureRegistry();
    const beforeSize = registry.size;
    const sel: AnatomySelection = {
      structureKey: 'male:skin:UBERON:0002097',
      name: 'VH_M_skin',
      objectName: 'VH_M_skin',
      systemKey: 'skin',
      bodyModel: 'male',
      ontologyId: 'UBERON:0002097',
    };
    getAnatomyInformation(sel);
    getAnatomyInformationByStructureKey('female:skin:UBERON:0002097');
    getAnatomyInformationByOntologyId('UBERON:0002097', 'male');
    expect(registry.size).toBe(beforeSize);
    expect(registry.size).toBe(0);
    // Also ensure seed keys untouched
    const keysBefore = getAnatomyInformationKeys().length;
    getAnatomyInformation(sel);
    expect(getAnatomyInformationKeys().length).toBe(keysBefore);
  });

  it('no GLB loading', () => {
    // Verify that the module does not import or trigger GLB loading
    // — it only uses the local seed Map, no THREE, no useGLTF, no fetch
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../anatomyInformation.ts'), 'utf8');
    expect(src).not.toMatch(/useGLTF/);
    expect(src).not.toMatch(/\.glb/);
    expect(src).not.toMatch(/fetch\(/);
    expect(src).not.toMatch(/THREE\./);
    expect(src).not.toMatch(/AnatomyStructureRegistry/);
    // Also ensure lookup does not trigger network
    const sel: AnatomySelection = {
      structureKey: 'male:digestive:UBERON:0002107',
      name: 'VH_M_liver',
      objectName: 'VH_M_liver',
      systemKey: 'digestive',
      bodyModel: 'male',
      ontologyId: 'UBERON:0002107',
    };
    const before = getAnatomyInformationKeys().length;
    const info = getAnatomyInformation(sel);
    expect(info?.canonicalName).toBe('Liver');
    expect(getAnatomyInformationKeys().length).toBe(before);
  });

  it('seed covers 8 distinct structures with male/female separation', () => {
    const seed = getAnatomyInformationSeed();
    // 8 concepts: skin, heart, brain, liver, kidney, ovary, uterus, cervix
    // Shared ones have male+female, female-only have 1 each => 5 shared*2 + 3 =13
    expect(seed.length).toBe(13);
    const canonicalNames = new Set(seed.map(s => s.canonicalName));
    expect(canonicalNames.has('Skin')).toBe(true);
    expect(canonicalNames.has('Heart')).toBe(true);
    expect(canonicalNames.has('Brain')).toBe(true);
    expect(canonicalNames.has('Liver')).toBe(true);
    expect(canonicalNames.has('Kidney')).toBe(true);
    expect(canonicalNames.has('Ovary')).toBe(true);
    expect(canonicalNames.has('Uterus')).toBe(true);
    expect(canonicalNames.has('Cervix')).toBe(true);
    // Verify no duplicate structureKey
    const keys = seed.map(s => s.structureKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
