import * as THREE from 'three';
import { AnatomyStructureRegistry } from '@anatomiax/anatomy-core';
import { collectSceneRecords, resolveTapSelection } from '../sceneRegistry';

function meshNode(name: string, ontologyId?: string): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  mesh.name = name;
  if (ontologyId) mesh.userData = { ontologyId };
  return mesh;
}

describe('stage scene registry (8.19.35)', () => {
  it('collects deduplicated records with lineage', () => {
    const scene = new THREE.Group();
    scene.name = 'VH_M';
    const system = new THREE.Group();
    system.name = 'nervous';
    const a = meshNode('VH_M_brain', 'UBERON:0000955');
    const duplicate = meshNode('VH_M_brain_alias', 'UBERON:0000955');
    system.add(a, duplicate);
    scene.add(system);

    const records = collectSceneRecords(scene, 'nervous', 'male');
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      structureKey: 'male:nervous:UBERON:0000955',
      name: 'VH_M_brain',
      objectName: 'VH_M_brain',
      lineage: ['VH_M_brain', 'nervous', 'VH_M'],
    });
  });

  it('falls back to object names and skips non-meshes', () => {
    const scene = new THREE.Group();
    scene.add(meshNode('VH_M_custom_region'));
    scene.add(new THREE.Group());
    const records = collectSceneRecords(scene, 'skin', 'male');
    expect(records).toHaveLength(1);
    expect(records[0]?.structureKey).toBe('male:skin:object:VH_M_custom_region');
  });

  it('resolves taps to registry identity and nulls everything else', () => {
    const registry = new AnatomyStructureRegistry();
    const scene = new THREE.Group();
    const hit = meshNode('VH_M_heart', 'UBERON:0000948');
    scene.add(hit);
    for (const record of collectSceneRecords(scene, 'cardiovascular', 'male')) {
      registry.register(record);
    }
    expect(resolveTapSelection(hit, registry, 'cardiovascular', 'male')).toMatchObject({
      structureKey: 'male:cardiovascular:UBERON:0000948',
      name: 'VH_M_heart',
    });
    // Mapped key in another system does not resolve here.
    expect(resolveTapSelection(hit, registry, 'nervous', 'male')).toBeNull();
    // Unregistered mesh resolves to null (safe deselect, never throws).
    const stranger = meshNode('VH_M_unknown_xyz');
    expect(resolveTapSelection(stranger, registry, 'cardiovascular', 'male')).toBeNull();
    expect(resolveTapSelection(null, registry, 'cardiovascular', 'male')).toBeNull();
  });
});
