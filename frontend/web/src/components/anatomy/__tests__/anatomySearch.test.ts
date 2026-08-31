// @ts-nocheck
import * as THREE from 'three';
import { AnatomyStructureRegistry, collectStructuresFromScene } from '../anatomyRegistry';
import { normalizeQuery, searchStructures } from '../anatomyRegistry';

function meshWithUserData(
  name: string,
  ontologyId: string | null,
  parentName?: string
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  mesh.name = name;
  if (ontologyId) mesh.userData.ontologyId = ontologyId;
  if (parentName) {
    const parent = new THREE.Group();
    parent.name = parentName;
    parent.add(mesh);
    return mesh;
  }
  return mesh;
}

function createTestScenes() {
  const maleScene = new THREE.Group();
  maleScene.name = 'VH_M';

  const maleSkin = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  maleSkin.name = 'VH_M_skin';
  maleSkin.userData.ontologyId = 'UBERON:0002097';
  maleScene.add(maleSkin);

  const maleHeart = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  maleHeart.name = 'VH_M_heart';
  maleHeart.userData.ontologyId = 'UBERON:0000948';
  maleScene.add(maleHeart);

  const maleBrain = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  maleBrain.name = 'VH_M_brain';
  maleBrain.userData.ontologyId = 'UBERON:0000955';
  maleScene.add(maleBrain);

  const femaleScene = new THREE.Group();
  femaleScene.name = 'VH_F';

  const femaleSkin = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  femaleSkin.name = 'VH_F_skin';
  femaleSkin.userData.ontologyId = 'UBERON:0002097';
  femaleScene.add(femaleSkin);

  const femaleOvary = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  femaleOvary.name = 'VH_F_ovary';
  femaleOvary.userData.ontologyId = 'UBERON:0000996';
  femaleScene.add(femaleOvary);

  const femaleUterus = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  femaleUterus.name = 'VH_F_uterus';
  femaleUterus.userData.ontologyId = 'UBERON:0000002';
  femaleScene.add(femaleUterus);

  const femaleCervix = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  femaleCervix.name = 'VH_F_cervix';
  femaleCervix.userData.ontologyId = 'UBERON:0000002';
  femaleScene.add(femaleCervix);

  const femaleVagina = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  femaleVagina.name = 'VH_F_vagina';
  femaleVagina.userData.ontologyId = 'UBERON:0000996';
  femaleScene.add(femaleVagina);

  const femaleFallopian = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  femaleFallopian.name = 'VH_F_fallopian_tube';
  femaleFallopian.userData.ontologyId = 'FMA:18493';
  femaleScene.add(femaleFallopian);

  return { maleScene, femaleScene };
}

describe('normalizeQuery', () => {
  it('lowercases', () => {
    expect(normalizeQuery('HEART')).toBe('heart');
  });

  it('trims whitespace', () => {
    expect(normalizeQuery('  heart  ')).toBe('heart');
  });

  it('collapses whitespace', () => {
    expect(normalizeQuery('  heart   valve  ')).toBe('heart valve');
  });

  it('removes punctuation', () => {
    expect(normalizeQuery('heart!')).toBe('heart');
    expect(normalizeQuery('aorta-arch')).toBe('aorta-arch');
    expect(normalizeQuery('UBERON:0002097')).toBe('uberon:0002097');
  });

  it('handles empty', () => {
    expect(normalizeQuery('')).toBe('');
    expect(normalizeQuery('   ')).toBe('');
  });
});

describe('Anatomy Search', () => {
  function createTestRegistry() {
    const registry = new AnatomyStructureRegistry();
    const { maleScene, femaleScene } = createTestScenes();

    const maleSkin = collectStructuresFromScene(maleScene, 'skin', 'male');
    maleSkin.forEach(s => registry.register(s));

    const maleHeart = collectStructuresFromScene(maleScene, 'cardiovascular', 'male');
    maleHeart.forEach(s => registry.register(s));

    const maleBrain = collectStructuresFromScene(maleScene, 'nervous', 'male');
    maleBrain.forEach(s => registry.register(s));

    const femaleSkin = collectStructuresFromScene(femaleScene, 'skin', 'female');
    femaleSkin.forEach(s => registry.register(s));

    const femaleOvary = collectStructuresFromScene(femaleScene, 'reproductive', 'female');
    femaleOvary.forEach(s => registry.register(s));

    return registry;
  }

  it('empty query returns empty array', () => {
    const registry = new AnatomyStructureRegistry();
    const results = searchStructures(registry, '', { bodyModel: 'male', systemKey: 'all' });
    expect(results).toEqual([]);
  });

  it('whitespace-only query returns empty', () => {
    const registry = new AnatomyStructureRegistry();
    const results = searchStructures(registry, '   ', { bodyModel: 'male', systemKey: 'all' });
    expect(results).toEqual([]);
  });

  it('exact name match', () => {
    const registry = createTestRegistry();
    const results = searchStructures(registry, 'VH_M_skin', {
      bodyModel: 'male',
      systemKey: 'all',
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].objectName).toBe('VH_M_skin');
  });

  it('partial name match', () => {
    const registry = createTestRegistry();
    const results = searchStructures(registry, 'skin', { bodyModel: 'male', systemKey: 'all' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.objectName.includes('skin'))).toBe(true);
  });

  it('object name match', () => {
    const registry = createTestRegistry();
    const results = searchStructures(registry, 'heart', { bodyModel: 'male', systemKey: 'all' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.objectName.includes('heart'))).toBe(true);
  });

  it('ontology ID match', () => {
    const registry = createTestRegistry();
    const results = searchStructures(registry, 'UBERON:0002097', {
      bodyModel: 'male',
      systemKey: 'all',
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.ontologyId === 'UBERON:0002097')).toBe(true);
  });

  it('system filter', () => {
    const registry = createTestRegistry();
    const results = searchStructures(registry, 'skin', { bodyModel: 'male', systemKey: 'skin' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(r => r.systemKey === 'skin')).toBe(true);
  });

  it('body model filter', () => {
    const registry = createTestRegistry();
    const maleResults = searchStructures(registry, 'skin', { bodyModel: 'male', systemKey: 'all' });
    expect(maleResults.every(r => r.bodyModel === 'male')).toBe(true);
    const femaleResults = searchStructures(registry, 'skin', {
      bodyModel: 'female',
      systemKey: 'all',
    });
    expect(femaleResults.every(r => r.bodyModel === 'female')).toBe(true);
  });

  it('male/female same ontology remain separate', () => {
    const registry = createTestRegistry();
    const results = searchStructures(registry, 'UBERON:0002097', {
      bodyModel: 'all',
      systemKey: 'all',
    });
    expect(results.length).toBeGreaterThanOrEqual(2);
    const bodyModels = [...new Set(results.map(r => r.bodyModel))].sort();
    expect(bodyModels).toEqual(expect.arrayContaining(['female', 'male']));
  });

  it('duplicate result prevention', () => {
    const registry = new AnatomyStructureRegistry();
    const { maleScene } = createTestScenes();
    const maleSkin = collectStructuresFromScene(maleScene, 'skin', 'male');
    maleSkin.forEach(s => registry.register(s));
    maleSkin.forEach(s => registry.register(s));
    const results = searchStructures(registry, 'skin', { bodyModel: 'male', systemKey: 'all' });
    const skinResults = results.filter(r => r.objectName === 'VH_M_skin');
    expect(skinResults.length).toBe(1);
  });

  it('deterministic ranking', () => {
    const registry = createTestRegistry();
    const results1 = searchStructures(registry, 'skin', { bodyModel: 'all', systemKey: 'all' });
    const results2 = searchStructures(registry, 'skin', { bodyModel: 'all', systemKey: 'all' });
    expect(results1.map(r => r.structureKey)).toEqual(results2.map(r => r.structureKey));
  });

  it('case-insensitive search', () => {
    const registry = createTestRegistry();
    const results1 = searchStructures(registry, 'SKIN', { bodyModel: 'male', systemKey: 'all' });
    const results2 = searchStructures(registry, 'skin', { bodyModel: 'male', systemKey: 'all' });
    expect(results1.length).toBe(results2.length);
  });

  it('whitespace normalization', () => {
    const registry = createTestRegistry();
    const results1 = searchStructures(registry, '  skin  ', {
      bodyModel: 'male',
      systemKey: 'all',
    });
    const results2 = searchStructures(registry, 'skin', { bodyModel: 'male', systemKey: 'all' });
    expect(results1.length).toBe(results2.length);
  });

  it('loaded structures only', () => {
    const registry = new AnatomyStructureRegistry();
    // Only load skin system
    const skinScene = new THREE.Group();
    const skinMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    skinMesh.name = 'VH_M_skin';
    skinMesh.userData.ontologyId = 'UBERON:0002097';
    skinScene.add(skinMesh);
    const skinStructs = collectStructuresFromScene(skinScene, 'skin', 'male');
    skinStructs.forEach(s => registry.register(s));
    // Don't load any other system
    const results = searchStructures(registry, 'skin', { bodyModel: 'all', systemKey: 'all' });
    expect(results.length).toBe(1);
    expect(results[0].bodyModel).toBe('male');
  });

  it('result limit', () => {
    const registry = createTestRegistry();
    const results = searchStructures(registry, 'VH', {
      bodyModel: 'all',
      systemKey: 'all',
      limit: 2,
    });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  describe('ranking improvements (8.15.3)', () => {
    it('heart ranking prefers actual heart over papillary muscle', () => {
      const registry = new AnatomyStructureRegistry();
      const scene = new THREE.Group();
      const heart = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
      heart.name = 'VH_M_heart';
      heart.userData.ontologyId = 'UBERON:0000948';
      scene.add(heart);
      const papillary = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
      papillary.name = 'VH_M_papillary_muscle_of_heart_posterior';
      papillary.userData.ontologyId = 'FMA:7261';
      scene.add(papillary);
      const structs = collectStructuresFromScene(scene, 'cardiovascular', 'male');
      structs.forEach(s => registry.register(s));
      const results = searchStructures(registry, 'heart', { bodyModel: 'male', systemKey: 'all' });
      expect(results.length).toBeGreaterThanOrEqual(2);
      // Heart (shorter, exact canonical) should be first
      expect(results[0].objectName).toBe('VH_M_heart');
    });

    it('ovary ranking prefers actual ovary over ligament', () => {
      const registry = new AnatomyStructureRegistry();
      const scene = new THREE.Group();
      const ovary = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
      ovary.name = 'VH_F_ovary';
      ovary.userData.ontologyId = 'UBERON:0000992';
      scene.add(ovary);
      const ligament = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
      ligament.name = 'VH_F_suspensory_ligament_of_ovary_R';
      ligament.userData.ontologyId = 'FMA:19823';
      scene.add(ligament);
      const structs = collectStructuresFromScene(scene, 'reproductive', 'female');
      structs.forEach(s => registry.register(s));
      const results = searchStructures(registry, 'ovary', {
        bodyModel: 'female',
        systemKey: 'all',
      });
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results[0].objectName).toBe('VH_F_ovary');
    });

    it('exact canonical name beats substructure substring', () => {
      const registry = new AnatomyStructureRegistry();
      const scene = new THREE.Group();
      const exact = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
      exact.name = 'Heart';
      exact.userData.ontologyId = 'UBERON:0000948';
      scene.add(exact);
      const sub = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
      sub.name = 'Papillary_muscle_of_heart_posterior';
      sub.userData.ontologyId = 'FMA:7261';
      scene.add(sub);
      const structs = collectStructuresFromScene(scene, 'cardiovascular', 'male');
      structs.forEach(s => registry.register(s));
      const results = searchStructures(registry, 'Heart', { bodyModel: 'male', systemKey: 'all' });
      expect(results[0].objectName).toBe('Heart');
    });

    it('actual ontology-linked information lookup for new high-value', () => {
      const registry = new AnatomyStructureRegistry();
      const scene = new THREE.Group();
      const rightVentricle = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
      rightVentricle.name = 'VH_M_heart_right_ventricle';
      rightVentricle.userData.ontologyId = 'UBERON:0002080';
      scene.add(rightVentricle);
      const structs = collectStructuresFromScene(scene, 'cardiovascular', 'male');
      structs.forEach(s => registry.register(s));
      const results = searchStructures(registry, 'UBERON:0002080', {
        bodyModel: 'male',
        systemKey: 'all',
      });
      expect(results[0].ontologyId).toBe('UBERON:0002080');
      // Verify information lookup would work (structureKey matches seed)
      expect(results[0].structureKey).toBe('male:cardiovascular:UBERON:0002080');
    });

    it('unavailable fallback still works', () => {
      const registry = new AnatomyStructureRegistry();
      const results = searchStructures(registry, 'nonexistent_xyz', {
        bodyModel: 'all',
        systemKey: 'all',
      });
      expect(results).toEqual([]);
    });
  });
});
