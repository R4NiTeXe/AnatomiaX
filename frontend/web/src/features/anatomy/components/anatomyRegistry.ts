import * as THREE from 'three';
import {
  AnatomyStructureRegistry as CoreAnatomyStructureRegistry,
  createStructureKey,
  findStructureByOntologyId,
  findStructuresByName,
  findStructuresBySystem,
  normalizeQuery,
  readOntologyCandidate,
  searchStructures,
} from '@anatomiax/anatomy-core';
import type { AnatomyBodyModelKey, AnatomyStructure, AnatomySystemKey } from './anatomyTypes';

export {
  createStructureKey,
  findStructureByOntologyId,
  findStructuresByName,
  findStructuresBySystem,
  normalizeQuery,
  readOntologyCandidate,
  searchStructures,
};

export class AnatomyStructureRegistry extends CoreAnatomyStructureRegistry {
  registerSystem(
    systemKey: AnatomySystemKey,
    scene: THREE.Object3D,
    bodyModel: AnatomyBodyModelKey = 'male'
  ): AnatomyStructure[] {
    const structures = collectStructuresFromScene(scene, systemKey, bodyModel);
    for (const s of structures) this.register(s);
    return structures;
  }

  registerSystemForBody(
    bodyModel: AnatomyBodyModelKey,
    systemKey: AnatomySystemKey,
    scene: THREE.Object3D
  ): AnatomyStructure[] {
    return this.registerSystem(systemKey, scene, bodyModel);
  }
}

export const globalAnatomyRegistry = new AnatomyStructureRegistry();

export function extractOntologyId(object: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    const found = readOntologyCandidate(current.userData);
    if (found) {
      return found;
    }
    current = current.parent;
  }
  return null;
}

export function resolveObjectName(object: THREE.Object3D): string {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current.name) return current.name;
    current = current.parent;
  }
  return object.type;
}

export function collectStructuresFromScene(
  scene: THREE.Object3D,
  systemKey: AnatomySystemKey,
  bodyModel: AnatomyBodyModelKey = 'male'
): AnatomyStructure[] {
  const byKey = new Map<string, AnatomyStructure>();

  scene.traverse(obj => {
    const mesh = obj as THREE.Mesh;
    if (!(mesh as unknown as { isMesh?: boolean }).isMesh || !mesh.geometry) return;

    const objectName = resolveObjectName(mesh);
    const ontologyId = extractOntologyId(mesh);
    const structureKey = createStructureKey(systemKey, ontologyId, objectName, bodyModel);
    if (byKey.has(structureKey)) return;

    const lineage: string[] = [];
    let cur: THREE.Object3D | null = mesh;
    while (cur) {
      if (cur.name) lineage.push(cur.name);
      cur = cur.parent;
    }

    const structure: AnatomyStructure = {
      id: structureKey,
      structureKey,
      name: objectName,
      objectName,
      systemKey,
      bodyModel,
      ontologyId,
      lineage,
    };
    byKey.set(structureKey, structure);
  });

  return [...byKey.values()];
}
