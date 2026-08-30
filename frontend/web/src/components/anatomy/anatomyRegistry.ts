import * as THREE from 'three';
import type { AnatomyBodyModelKey, AnatomyStructure, AnatomySystemKey } from './anatomyTypes';

/**
 * Stable key for a structure.
 * - Preferred: `${bodyModel}:${systemKey}:${ontologyId}` when a verified ontologyId exists.
 * - Fallback: `${bodyModel}:${systemKey}:object:${sanitizedObjectName}` when ontology is absent.
 *
 * Body model prefix ensures male and female structures with the same ontology do not collide,
 * while keeping ontologyId globally searchable via `byOntology`.
 * Sanitization: trim and replace whitespace runs with single underscore,
 * keep original casing (HRA names are already stable like `VH_M_heart`).
 */
export function createStructureKey(
  systemKey: AnatomySystemKey,
  ontologyId: string | null,
  objectName: string,
  bodyModel: AnatomyBodyModelKey = 'male'
): string {
  if (ontologyId) {
    const normalized = ontologyId.trim();
    if (normalized) return `${bodyModel}:${systemKey}:${normalized}`;
  }
  const fallback = objectName.trim().replace(/\s+/g, '_') || 'unnamed';
  return `${bodyModel}:${systemKey}:object:${fallback}`;
}

/** Legacy overload — bodyModel defaults to male for backward compat */
export function createStructureKeyForBody(
  bodyModel: AnatomyBodyModelKey,
  systemKey: AnatomySystemKey,
  ontologyId: string | null,
  objectName: string
): string {
  return createStructureKey(systemKey, ontologyId, objectName, bodyModel);
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

// ---------------------------------------------------------------------------
// Search index — loaded-only, deterministic, no duplication
// ---------------------------------------------------------------------------

export function normalizeQuery(query: string): string {
  if (!query) return '';
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w:\-\s]/g, '');
}

function getMatchScore(query: string, target: string): number | null {
  if (!target) return null;
  const nq = normalizeQuery(query);
  const nt = normalizeQuery(target);
  if (!nq || !nt) return null;
  if (nq === nt) return 0;
  if (nt.startsWith(nq)) return 1;
  if (nt.includes(nq)) return 2;
  const words = nq.split(' ').filter(w => w.length > 0);
  if (words.length > 1) {
    let last = -1;
    let allInOrder = true;
    for (const w of words) {
      const idx = nt.indexOf(w, last + 1);
      if (idx === -1) {
        allInOrder = false;
        break;
      }
      last = idx;
    }
    if (allInOrder) return 3;
    if (words.every(w => nt.includes(w))) return 4;
  }
  return null;
}

function getSystemLabel(systemKey: string): string {
  const labels: Record<string, string> = {
    skin: 'skin',
    musculoskeletal: 'musculoskeletal',
    nervous: 'nervous',
    cardiovascular: 'cardiovascular',
    respiratory: 'respiratory',
    digestive: 'digestive',
    urinary: 'urinary',
    reproductive: 'reproductive',
    lymphatic: 'lymphatic',
  };
  return labels[systemKey] || systemKey;
}

export function searchStructures(
  registry: AnatomyStructureRegistry,
  query: string,
  options: import('./anatomyTypes').AnatomySearchOptions = {}
): import('./anatomyTypes').AnatomySearchResult[] {
  const nq = normalizeQuery(query);
  if (!nq) return [];
  const { bodyModel = 'all', systemKey = 'all', limit = 50 } = options;
  const candidates = registry.getAllLoadedStructures().filter(s => {
    if (bodyModel !== 'all' && s.bodyModel !== bodyModel) return false;
    if (systemKey !== 'all' && s.systemKey !== systemKey) return false;
    return true;
  });
  const scored: { result: import('./anatomyTypes').AnatomySearchResult; score: number }[] = [];
  for (const s of candidates) {
    let best: number | null = null;
    const consider = (score: number | null) => {
      if (score !== null && (best === null || score < best)) best = score;
    };
    consider(getMatchScore(nq, s.structureKey));
    consider(getMatchScore(nq, s.name));
    consider(getMatchScore(nq, s.objectName));
    if (s.ontologyId) consider(getMatchScore(nq, s.ontologyId));
    consider(getMatchScore(nq, s.systemKey));
    consider(getMatchScore(nq, s.bodyModel));
    consider(getMatchScore(nq, getSystemLabel(s.systemKey)));
    if (best !== null) {
      scored.push({
        result: {
          structureKey: s.structureKey,
          bodyModel: s.bodyModel,
          systemKey: s.systemKey,
          name: s.name,
          objectName: s.objectName,
          ontologyId: s.ontologyId,
        },
        score: best,
      });
    }
  }
  scored.sort((a, b) =>
    a.score !== b.score
      ? a.score - b.score
      : a.result.structureKey.localeCompare(b.result.structureKey)
  );
  const seen = new Set<string>();
  const out: import('./anatomyTypes').AnatomySearchResult[] = [];
  for (const { result } of scored) {
    if (!seen.has(result.structureKey)) {
      seen.add(result.structureKey);
      out.push(result);
      if (out.length >= limit) break;
    }
  }
  return out;
}
