import * as THREE from 'three';
import {
  AnatomyStructureRegistry,
  createStructureKey,
  readOntologyCandidate,
} from '@anatomiax/anatomy-core';
import type {
  AnatomyBodyModelKey,
  AnatomySelection,
  AnatomyStructure,
  AnatomySystemKey,
} from '@anatomiax/shared-types';

/**
 * Mobile scene → registry bridge (8.19.35). Mirrors the web collection rules
 * (nearest name, nearest ontology, dedupe by key, lineage) over plain three
 * objects so tap selection resolves to canonical anatomy-core identity.
 * No GL context needed — fully unit-testable.
 */

interface NamedNode {
  name?: unknown;
  type?: unknown;
  userData?: unknown;
  parent?: NamedNode | null;
}

function nearestName(node: NamedNode | null, fallbackType: string): string {
  let current: NamedNode | null | undefined = node;
  while (current) {
    if (typeof current.name === 'string' && current.name) return current.name;
    current = current.parent;
  }
  return fallbackType;
}

function nearestOntologyId(node: NamedNode | null): string | null {
  let current: NamedNode | null | undefined = node;
  while (current) {
    const found = readOntologyCandidate(current.userData);
    if (found) return found;
    current = current.parent;
  }
  return null;
}

/** Collects deduplicated structure records from a loaded system scene. */
export function collectSceneRecords(
  scene: THREE.Object3D,
  systemKey: AnatomySystemKey,
  bodyModel: AnatomyBodyModelKey
): AnatomyStructure[] {
  const byKey = new Map<string, AnatomyStructure>();
  scene.traverse(obj => {
    const mesh = obj as THREE.Mesh;
    if (!(mesh as unknown as { isMesh?: boolean }).isMesh || !mesh.geometry) return;
    const objectName = nearestName(mesh as unknown as NamedNode, mesh.type);
    const ontologyId = nearestOntologyId(mesh as unknown as NamedNode);
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

/**
 * Maps a tapped mesh to an AnatomySelection via the registry.
 * Returns null for empty taps and unmapped meshes (caller deselects safely).
 */
export function resolveTapSelection(
  object: THREE.Object3D | null,
  registry: AnatomyStructureRegistry,
  systemKey: AnatomySystemKey,
  bodyModel: AnatomyBodyModelKey
): AnatomySelection | null {
  if (!object) return null;
  const node = object as unknown as NamedNode;
  const objectName = nearestName(node, (object as THREE.Object3D).type);
  const ontologyId = nearestOntologyId(node);
  const structureKey = createStructureKey(systemKey, ontologyId, objectName, bodyModel);
  const record = registry.findByStructureKey(structureKey);
  if (!record) return null;
  return {
    structureKey: record.structureKey,
    name: record.name,
    objectName: record.objectName,
    systemKey: record.systemKey,
    bodyModel: record.bodyModel,
    ontologyId: record.ontologyId,
  };
}
