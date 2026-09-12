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

// Pure registry/search/keying logic lives in @anatomiax/anatomy-core (single
// source). Re-exported here so existing imports keep working.
export {
  createStructureKey,
  findStructureByOntologyId,
  findStructuresByName,
  findStructuresBySystem,
  normalizeQuery,
  readOntologyCandidate,
  searchStructures,
};

/**
 * Web registry: the pure core registry plus Three.js scene loading.
 * GLB traversal stays platform-specific per 8.19.33 scope; mobile will supply
 * its own walker and register plain records via the inherited register().
 */
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

/** Default singleton for convenience; the React provider owns its own instance. */
export const globalAnatomyRegistry = new AnatomyStructureRegistry();

/**
 * Walks up the scene graph from `object` looking for a verified ontologyId.
 * Returns the first non-empty value encountered (closest to the clicked mesh)
 * or null when none is present. Handles case-insensitive keys and nested extras.
 */
export function extractOntologyId(object: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    const found = readOntologyCandidate(current.userData);
    if (found) {
      // If the found value is an IRI, keep it; callers compare exact strings.
      // Prefer prefixed IDs (contain ':') but accept either — no invention.
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

/**
 * Collects AnatomyStructure entries from a loaded GLB scene. Must only be
 * called for systems that are actually loaded (keeps startup cheap).
 * Deduplicates by structureKey — multiple meshes sharing the same ontologyId
 * collapse to one entry (documented, not pretended as distinct structures).
 * Body model prefix ensures male/female do not collide.
 */
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
