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

  it('seed covers 8 distinct structures with male/female separation (8.14.1 baseline)', () => {
    const seed = getAnatomyInformationSeed();
    // 8.14.1 baseline: 8 concepts => 13 records (5 shared*2 +3)
    // 8.14.3 expanded: 16 concepts => 26 records
    // 8.14.5 expanded: 22 concepts => 38 records
    // 8.15.3 expanded: 24 concepts => 45 records (added ovary FMA, body of uterus, left ventricle, kidney capsule) — verify baseline still present
    expect(seed.length).toBe(45);
    const canonicalNames = new Set(seed.map(s => s.canonicalName));
    // Baseline must still be present
    for (const name of ['Skin', 'Heart', 'Brain', 'Liver', 'Kidney', 'Ovary', 'Uterus', 'Cervix']) {
      expect(canonicalNames.has(name)).toBe(true);
    }
    // Expanded must include new canonicals
    for (const name of [
      'Spinal cord',
      'Lung',
      'Stomach',
      'Urinary bladder',
      'Femur',
      'Testis',
      'Prostate',
      'Fallopian tube',
      'Ascending aorta',
      'Gallbladder',
      'Right ventricle',
      'Hilum of lung',
      'Hilum of spleen',
      'Body of uterus',
      'Left ventricle',
    ]) {
      expect(canonicalNames.has(name)).toBe(true);
    }
    // Verify no duplicate structureKey
    const keys = seed.map(s => s.structureKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('existing 13 records unchanged (8.14.1 seed preserved)', () => {
    // Spot-check that original 13 still return exact same values
    const skinMale = getAnatomyInformationByStructureKey('male:skin:UBERON:0002097');
    expect(skinMale?.canonicalName).toBe('Skin');
    expect(skinMale?.sourceUrl).toBe('https://medlineplus.gov/ency/article/002363.htm');
    const uterus = getAnatomyInformationByStructureKey('female:reproductive:UBERON:0000995');
    expect(uterus?.canonicalName).toBe('Uterus');
  });

  it('lookup several newly added records', () => {
    const lungMale = getAnatomyInformationByStructureKey('male:respiratory:UBERON:0002048');
    expect(lungMale?.canonicalName).toBe('Lung');
    expect(lungMale?.systemKey).toBe('respiratory');
    const spinalFemale = getAnatomyInformationByStructureKey('female:nervous:UBERON:0002240');
    expect(spinalFemale?.canonicalName).toBe('Spinal cord');
    const stomach = getAnatomyInformationByStructureKey('female:digestive:UBERON:0000945');
    expect(stomach?.canonicalName).toBe('Stomach');
    const bladder = getAnatomyInformationByStructureKey('male:urinary:UBERON:0001255');
    expect(bladder?.canonicalName).toBe('Urinary bladder');
    const femur = getAnatomyInformationByStructureKey('female:musculoskeletal:UBERON:0000981');
    expect(femur?.canonicalName).toBe('Femur');
    const testis = getAnatomyInformationByStructureKey('male:reproductive:UBERON:0000473');
    expect(testis?.canonicalName).toBe('Testis');
    const prostate = getAnatomyInformationByStructureKey('male:reproductive:UBERON:0002367');
    expect(prostate?.canonicalName).toBe('Prostate');
    const fallopian = getAnatomyInformationByStructureKey('female:reproductive:UBERON:0003889');
    expect(fallopian?.canonicalName).toBe('Fallopian tube');
  });

  it('new male/female same ontology does not collide (e.g., lung, spinal cord)', () => {
    const maleLung = getAnatomyInformationByStructureKey('male:respiratory:UBERON:0002048');
    const femaleLung = getAnatomyInformationByStructureKey('female:respiratory:UBERON:0002048');
    expect(maleLung?.bodyModel).toBe('male');
    expect(femaleLung?.bodyModel).toBe('female');
    expect(maleLung?.structureKey).not.toBe(femaleLung?.structureKey);
    // Ontology ambiguous without bodyModel
    expect(getAnatomyInformationByOntologyId('UBERON:0002048')).toBeUndefined();
    expect(getAnatomyInformationByOntologyId('UBERON:0002048', 'male')?.structureKey).toBe(
      'male:respiratory:UBERON:0002048'
    );
  });

  it('new records provenance preserved', () => {
    const lung = getAnatomyInformationByStructureKey('male:respiratory:UBERON:0002048');
    expect(lung?.source).toBe('NIH');
    expect(lung?.sourceUrl).toMatch(/^https:\/\//);
    expect(lung?.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const testis = getAnatomyInformationByStructureKey('male:reproductive:UBERON:0000473');
    expect(testis?.source).toBe('Human Reference Atlas');
    expect(testis?.license).toBe('CC BY 4.0 (HRA)');
  });

  it('high-value present structures verified (8.14.5)', () => {
    // Verified present via dump-male.txt
    const aortaMale = getAnatomyInformationByStructureKey('male:cardiovascular:UBERON:0001496');
    expect(aortaMale?.canonicalName).toBe('Ascending aorta');
    expect(aortaMale?.systemKey).toBe('cardiovascular');
    const aortaFemale = getAnatomyInformationByStructureKey('female:cardiovascular:UBERON:0001496');
    expect(aortaFemale?.bodyModel).toBe('female');
    const gallbladder = getAnatomyInformationByStructureKey('male:digestive:UBERON:0002110');
    expect(gallbladder?.canonicalName).toBe('Gallbladder');
    const ventricle = getAnatomyInformationByStructureKey('female:cardiovascular:UBERON:0002080');
    expect(ventricle?.canonicalName).toBe('Right ventricle');
    const hilumLung = getAnatomyInformationByStructureKey('male:respiratory:UBERON:0004887');
    expect(hilumLung?.canonicalName).toBe('Hilum of lung');
    const hilumSpleen = getAnatomyInformationByStructureKey('female:lymphatic:UBERON:0001248');
    expect(hilumSpleen?.canonicalName).toBe('Hilum of spleen');
    const femurFMA = getAnatomyInformationByStructureKey('male:musculoskeletal:FMA:24474');
    expect(femurFMA?.canonicalName).toBe('Femur');
    expect(femurFMA?.ontologyId).toBe('FMA:24474');
    // Male/female separate for present structures
    expect(getAnatomyInformationByOntologyId('UBERON:0001496')).toBeUndefined();
    expect(getAnatomyInformationByOntologyId('UBERON:0001496', 'male')?.structureKey).toBe(
      'male:cardiovascular:UBERON:0001496'
    );
  });

  it('actual high-value loaded structures for 8.15.3 (ovary FMA, uterus body, left ventricle)', () => {
    const ovaryRight = getAnatomyInformationByStructureKey('female:reproductive:FMA:7213');
    expect(ovaryRight?.canonicalName).toBe('Ovary');
    expect(ovaryRight?.ontologyId).toBe('FMA:7213');
    const ovaryLeft = getAnatomyInformationByStructureKey('female:reproductive:FMA:7214');
    expect(ovaryLeft?.canonicalName).toBe('Ovary');
    const bodyUterus = getAnatomyInformationByStructureKey('female:reproductive:UBERON:0009853');
    expect(bodyUterus?.canonicalName).toBe('Body of uterus');
    const leftVentricleMale = getAnatomyInformationByStructureKey(
      'male:cardiovascular:UBERON:0002084'
    );
    expect(leftVentricleMale?.canonicalName).toBe('Left ventricle');
    const leftVentricleFemale = getAnatomyInformationByStructureKey(
      'female:cardiovascular:UBERON:0002084'
    );
    expect(leftVentricleFemale?.canonicalName).toBe('Left ventricle');
    // Verify male/female separation not needed for ovary (female-only)
    expect(getAnatomyInformationByOntologyId('FMA:7213')).toBeDefined();
    expect(getAnatomyInformationByOntologyId('FMA:7213')?.bodyModel).toBe('female');
  });
});
