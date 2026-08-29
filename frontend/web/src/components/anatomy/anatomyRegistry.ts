import * as THREE from 'three';
import type { AnatomyStructure, AnatomySystemKey } from './anatomyTypes';

/**
 * Stable key for a structure.
 * - Preferred: `${systemKey}:${ontologyId}` when a verified ontologyId exists.
 * - Fallback: `${systemKey}:object:${sanitizedObjectName}` when ontology is absent.
 *
 * Sanitization: trim and replace whitespace runs with single underscore,
 * keep original casing (HRA names are already stable like `VH_M_heart`).
 * This fallback is documented and never invents medical identifiers.
 */
export function createStructureKey(
  systemKey: AnatomySystemKey,
  ontologyId: string | null,
  objectName: string
): string {
  if (ontologyId) {
    const normalized = ontologyId.trim();
    if (normalized) return `${systemKey}:${normalized}`;
  }
  const fallback = objectName.trim().replace(/\s+/g, '_') || 'unnamed';
  return `${systemKey}:object:${fallback}`;
}

function readOntologyCandidate(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  // Direct fields — handle case variations seen in HRA extras.
  const candidates = [
    record['ontologyId'],
    record['ontologyid'],
    record['OntologyId'],
    record['OntologyID'],
    record['representation_of'],
    record['representationOf'],
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) {
      // For IRIs like http://purl.org/sig/ont/fma/fma123 -> keep as-is for lookup helper,
      // but prefer prefixed form when both exist. Trim only here; caller normalizes.
      return c.trim();
    }
  }
  // Nested extras container (some loaders nest original extras under `extras`).
  if (record['extras'] && typeof record['extras'] === 'object') {
    return readOntologyCandidate(record['extras']);
  }
  return null;
}

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
 */
export function collectStructuresFromScene(
  scene: THREE.Object3D,
  systemKey: AnatomySystemKey
): AnatomyStructure[] {
  const byKey = new Map<string, AnatomyStructure>();

  scene.traverse(obj => {
    const mesh = obj as THREE.Mesh;
    if (!(mesh as unknown as { isMesh?: boolean }).isMesh || !mesh.geometry) return;

    const objectName = resolveObjectName(mesh);
    const ontologyId = extractOntologyId(mesh);
    const structureKey = createStructureKey(systemKey, ontologyId, objectName);
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
      ontologyId,
      lineage,
    };
    byKey.set(structureKey, structure);
  });

  return [...byKey.values()];
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class AnatomyStructureRegistry {
  private byKey = new Map<string, AnatomyStructure>();
  private byOntology = new Map<string, Set<string>>();
  private byObjectName = new Map<string, Set<string>>();
  private bySystem = new Map<AnatomySystemKey, Set<string>>();

  register(structure: AnatomyStructure): void {
    if (this.byKey.has(structure.structureKey)) return;
    this.byKey.set(structure.structureKey, structure);

    if (structure.ontologyId) {
      const key = structure.ontologyId;
      let set = this.byOntology.get(key);
      if (!set) {
        set = new Set();
        this.byOntology.set(key, set);
      }
      set.add(structure.structureKey);
    }

    {
      let set = this.byObjectName.get(structure.objectName);
      if (!set) {
        set = new Set();
        this.byObjectName.set(structure.objectName, set);
      }
      set.add(structure.structureKey);
    }

    {
      let set = this.bySystem.get(structure.systemKey);
      if (!set) {
        set = new Set();
        this.bySystem.set(structure.systemKey, set);
      }
      set.add(structure.structureKey);
    }
  }

  registerSystem(systemKey: AnatomySystemKey, scene: THREE.Object3D): AnatomyStructure[] {
    const structures = collectStructuresFromScene(scene, systemKey);
    for (const s of structures) this.register(s);
    return structures;
  }

  unregisterSystem(systemKey: AnatomySystemKey): void {
    const keys = this.bySystem.get(systemKey);
    if (!keys) return;
    for (const k of [...keys]) {
      const s = this.byKey.get(k);
      if (!s) continue;
      this.byKey.delete(k);
      if (s.ontologyId) {
        const set = this.byOntology.get(s.ontologyId);
        if (set) {
          set.delete(k);
          if (set.size === 0) this.byOntology.delete(s.ontologyId);
        }
      }
      {
        const set = this.byObjectName.get(s.objectName);
        if (set) {
          set.delete(k);
          if (set.size === 0) this.byObjectName.delete(s.objectName);
        }
      }
    }
    this.bySystem.delete(systemKey);
  }

  clear(): void {
    this.byKey.clear();
    this.byOntology.clear();
    this.byObjectName.clear();
    this.bySystem.clear();
  }

  findByStructureKey(key: string): AnatomyStructure | undefined {
    return this.byKey.get(key);
  }

  /** Exact ontologyId match (case-sensitive, as stored from GLB). */
  findStructureByOntologyId(ontologyId: string): AnatomyStructure | undefined {
    const keys = this.byOntology.get(ontologyId);
    if (!keys || keys.size === 0) return undefined;
    const first = keys.values().next().value as string;
    return this.byKey.get(first);
  }

  findStructuresByOntologyId(ontologyId: string): AnatomyStructure[] {
    const keys = this.byOntology.get(ontologyId);
    if (!keys) return [];
    return [...keys].map(k => this.byKey.get(k) as AnatomyStructure);
  }

  findStructureByObjectName(objectName: string): AnatomyStructure | undefined {
    const keys = this.byObjectName.get(objectName);
    if (!keys || keys.size === 0) return undefined;
    const first = keys.values().next().value as string;
    return this.byKey.get(first);
  }

  findStructuresByObjectName(objectName: string): AnatomyStructure[] {
    const keys = this.byObjectName.get(objectName);
    if (!keys) return [];
    return [...keys].map(k => this.byKey.get(k) as AnatomyStructure);
  }

  /** Exact name match — wrapper for object-name lookup; kept for future search. */
  findStructuresByName(name: string): AnatomyStructure[] {
    return this.findStructuresByObjectName(name);
  }

  findStructuresBySystem(systemKey: AnatomySystemKey): AnatomyStructure[] {
    const keys = this.bySystem.get(systemKey);
    if (!keys) return [];
    return [...keys].map(k => this.byKey.get(k) as AnatomyStructure);
  }

  getAllLoadedStructures(): AnatomyStructure[] {
    return [...this.byKey.values()];
  }

  get size(): number {
    return this.byKey.size;
  }
}

/** Default singleton for convenience; the React provider owns its own instance. */
export const globalAnatomyRegistry = new AnatomyStructureRegistry();

// ---------------------------------------------------------------------------
// Search helpers (future)
// ---------------------------------------------------------------------------

export function findStructureByOntologyId(
  registry: AnatomyStructureRegistry,
  ontologyId: string
): AnatomyStructure | undefined {
  return registry.findStructureByOntologyId(ontologyId);
}

export function findStructuresBySystem(
  registry: AnatomyStructureRegistry,
  systemKey: AnatomySystemKey
): AnatomyStructure[] {
  return registry.findStructuresBySystem(systemKey);
}

export function findStructuresByName(
  registry: AnatomyStructureRegistry,
  name: string
): AnatomyStructure[] {
  return registry.findStructuresByName(name);
}
