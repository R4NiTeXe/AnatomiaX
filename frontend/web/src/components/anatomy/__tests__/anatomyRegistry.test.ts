import * as THREE from 'three';
import {
  AnatomyStructureRegistry,
  createStructureKey,
  extractOntologyId,
  resolveObjectName,
  collectStructuresFromScene,
  findStructureByOntologyId,
  findStructuresBySystem,
  findStructuresByName,
} from '../anatomyRegistry';
import type { AnatomyStructure } from '../anatomyTypes';

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

describe('createStructureKey', () => {
  it('uses ontologyId when present', () => {
    expect(createStructureKey('nervous', 'UBERON:0000955', 'VH_M_brain')).toBe(
      'nervous:UBERON:0000955'
    );
  });

  it('falls back to object name when ontology missing', () => {
    expect(createStructureKey('skin', null, 'VH_M_skin')).toBe('skin:object:VH_M_skin');
    expect(createStructureKey('skin', '', 'VH_M_skin')).toBe('skin:object:VH_M_skin');
  });

  it('sanitizes fallback name', () => {
    expect(createStructureKey('skin', null, '  my object  ')).toBe('skin:object:my_object');
  });

  it('handles unnamed object', () => {
    expect(createStructureKey('nervous', null, '')).toBe('nervous:object:unnamed');
  });
});

describe('extractOntologyId', () => {
  it('finds ontologyId on object', () => {
    const mesh = meshWithUserData('VH_M_skin', 'UBERON:0002097');
    expect(extractOntologyId(mesh)).toBe('UBERON:0002097');
  });

  it('finds ontologyId case-insensitive', () => {
    const mesh = new THREE.Mesh();
    mesh.userData.ontologyid = 'FMA:123';
    expect(extractOntologyId(mesh)).toBe('FMA:123');
  });

  it('walks up parents', () => {
    const mesh = new THREE.Mesh();
    mesh.name = '';
    const parent = new THREE.Group();
    parent.name = 'VH_M_heart';
    parent.userData.ontologyId = 'UBERON:0000948';
    parent.add(mesh);
    expect(extractOntologyId(mesh)).toBe('UBERON:0000948');
  });

  it('returns null when missing', () => {
    const mesh = new THREE.Mesh();
    expect(extractOntologyId(mesh)).toBeNull();
  });

  it('reads nested extras', () => {
    const mesh = new THREE.Mesh();
    mesh.userData.extras = { ontologyid: 'UBERON:0000948' };
    expect(extractOntologyId(mesh)).toBe('UBERON:0000948');
  });
});

describe('resolveObjectName', () => {
  it('returns mesh name', () => {
    const mesh = new THREE.Mesh();
    mesh.name = 'VH_M_heart';
    expect(resolveObjectName(mesh)).toBe('VH_M_heart');
  });

  it('walks to parent when unnamed', () => {
    const mesh = new THREE.Mesh();
    const parent = new THREE.Group();
    parent.name = 'VH_M_heart';
    parent.add(mesh);
    expect(resolveObjectName(mesh)).toBe('VH_M_heart');
  });
});

describe('AnatomyStructureRegistry', () => {
  let registry: AnatomyStructureRegistry;

  beforeEach(() => {
    registry = new AnatomyStructureRegistry();
  });

  function makeStructure(
    overrides: Partial<AnatomyStructure> & { systemKey: AnatomyStructure['systemKey'] }
  ): AnatomyStructure {
    const ontologyId = overrides.ontologyId ?? null;
    const objectName = overrides.objectName ?? overrides.name ?? 'VH_M_test';
    const structureKey =
      overrides.structureKey ?? createStructureKey(overrides.systemKey, ontologyId, objectName);
    const base: AnatomyStructure = {
      id: structureKey,
      structureKey,
      name: overrides.name ?? objectName,
      objectName,
      systemKey: overrides.systemKey,
      ontologyId,
      lineage: overrides.lineage ?? [objectName],
    };
    return { ...base, ...overrides, id: structureKey, structureKey } as AnatomyStructure;
  }

  it('registers and finds by structure key', () => {
    const s = makeStructure({
      systemKey: 'nervous',
      name: 'VH_M_brain',
      objectName: 'VH_M_brain',
      ontologyId: 'UBERON:0000955',
    });
    registry.register(s);
    expect(registry.findByStructureKey(s.structureKey)).toEqual(s);
  });

  it('finds by ontologyId', () => {
    const s = makeStructure({
      systemKey: 'cardiovascular',
      name: 'VH_M_heart',
      objectName: 'VH_M_heart',
      ontologyId: 'UBERON:0000948',
    });
    registry.register(s);
    expect(findStructureByOntologyId(registry, 'UBERON:0000948')).toEqual(s);
    expect(registry.findStructureByOntologyId('UBERON:0000948')).toEqual(s);
  });

  it('finds by object name', () => {
    const s = makeStructure({
      systemKey: 'skin',
      name: 'VH_M_skin',
      objectName: 'VH_M_skin',
      ontologyId: 'UBERON:0002097',
    });
    registry.register(s);
    expect(registry.findStructureByObjectName('VH_M_skin')).toEqual(s);
  });

  it('finds by system', () => {
    const s1 = makeStructure({
      systemKey: 'nervous',
      name: 'A',
      ontologyId: 'UBERON:1',
      objectName: 'A',
    });
    const s2 = makeStructure({
      systemKey: 'nervous',
      name: 'B',
      ontologyId: 'UBERON:2',
      objectName: 'B',
    });
    registry.register(s1);
    registry.register(s2);
    expect(findStructuresBySystem(registry, 'nervous')).toHaveLength(2);
  });

  it('handles duplicates with same ontologyId as single entry', () => {
    const s1 = makeStructure({
      systemKey: 'nervous',
      name: 'VH_M_brain',
      objectName: 'VH_M_brain',
      ontologyId: 'UBERON:0000955',
    });
    const s2 = makeStructure({
      systemKey: 'nervous',
      name: 'VH_M_brain',
      objectName: 'VH_M_brain',
      ontologyId: 'UBERON:0000955',
    });
    registry.register(s1);
    registry.register(s2);
    expect(registry.size).toBe(1);
  });

  it('handles missing ontology', () => {
    const s = makeStructure({
      systemKey: 'nervous',
      name: 'Allen_brain',
      objectName: 'Allen_brain',
      ontologyId: null,
    });
    expect(s.structureKey).toBe('nervous:object:Allen_brain');
    registry.register(s);
    expect(registry.findStructureByObjectName('Allen_brain')).toEqual(s);
    expect(registry.findStructureByOntologyId('UBERON:0000955')).toBeUndefined();
  });

  it('removes structures when system unloaded', () => {
    const s1 = makeStructure({
      systemKey: 'cardiovascular',
      name: 'VH_M_heart',
      ontologyId: 'UBERON:0000948',
      objectName: 'VH_M_heart',
    });
    const s2 = makeStructure({
      systemKey: 'nervous',
      name: 'VH_M_brain',
      ontologyId: 'UBERON:0000955',
      objectName: 'VH_M_brain',
    });
    registry.register(s1);
    registry.register(s2);
    registry.unregisterSystem('cardiovascular');
    expect(registry.findStructureByObjectName('VH_M_heart')).toBeUndefined();
    expect(registry.findStructureByObjectName('VH_M_brain')).toBeDefined();
    expect(registry.getAllLoadedStructures()).toHaveLength(1);
  });

  it('registry add/remove cycle', () => {
    const s = makeStructure({
      systemKey: 'urinary',
      name: 'VH_M_kidney',
      ontologyId: 'UBERON:0002113',
      objectName: 'VH_M_kidney',
    });
    registry.register(s);
    expect(registry.size).toBe(1);
    registry.clear();
    expect(registry.size).toBe(0);
    expect(registry.getAllLoadedStructures()).toHaveLength(0);
  });

  it('findStructuresByName exact match', () => {
    const s = makeStructure({
      systemKey: 'respiratory',
      name: 'VH_M_lung',
      ontologyId: 'UBERON:0002048',
      objectName: 'VH_M_lung',
    });
    registry.register(s);
    expect(findStructuresByName(registry, 'VH_M_lung')).toHaveLength(1);
    expect(findStructuresByName(registry, 'missing')).toHaveLength(0);
  });
});

describe('collectStructuresFromScene', () => {
  it('collects from scene and dedupes by structureKey', () => {
    const scene = new THREE.Group();
    scene.name = 'Scene';
    const m1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    m1.name = 'VH_M_heart';
    m1.userData.ontologyId = 'UBERON:0000948';
    const m2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    m2.name = 'VH_M_heart';
    m2.userData.ontologyId = 'UBERON:0000948';
    scene.add(m1, m2);
    const result = collectStructuresFromScene(scene, 'cardiovascular');
    expect(result).toHaveLength(1);
    expect(result[0].structureKey).toBe('cardiovascular:UBERON:0000948');
  });

  it('uses fallback key when ontology missing', () => {
    const scene = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    m.name = 'Allen_brain';
    scene.add(m);
    const result = collectStructuresFromScene(scene, 'nervous');
    expect(result[0].structureKey).toBe('nervous:object:Allen_brain');
    expect(result[0].ontologyId).toBeNull();
  });
});

describe('selection conversion', () => {
  it('converts click to AnatomySelection via registry', () => {
    const registry = new AnatomyStructureRegistry();
    const scene = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    mesh.name = 'VH_M_skin';
    mesh.userData.ontologyId = 'UBERON:0002097';
    scene.add(mesh);
    registry.registerSystem('skin', scene);
    const found = registry.findStructureByObjectName('VH_M_skin');
    expect(found).toBeDefined();
    const selection = {
      structureKey: found!.structureKey,
      name: found!.name,
      objectName: found!.objectName,
      systemKey: found!.systemKey,
      ontologyId: found!.ontologyId,
    };
    expect(selection.structureKey).toBe('skin:UBERON:0002097');
    expect(selection.ontologyId).toBe('UBERON:0002097');
  });
});
