import * as THREE from 'three';
import { AnatomyStructureRegistry } from '@anatomiax/anatomy-core';
import type { AssetManifestEntry } from '@anatomiax/anatomy-core';
import type { AnatomyStructure } from '@anatomiax/shared-types';
import { disposeObject } from './dispose';
import { MAX_STAGE_BYTES } from './supportedScope';

/**
 * Staged load orchestration (8.19.36). Owns the resident-system policy:
 * exactly one system resident, previous resources disposed BEFORE the next
 * load, oversized/off-scope assets rejected before any download, stale
 * generations abandoned without touching state, failures leaving no partial
 * scene/registry residue. Three scene attach/detach stays with the component;
 * everything else is here and unit-tested.
 */

export type StageLoadErrorCode =
  'UNSUPPORTED_MODEL' | 'OVERSIZED_ASSET' | 'FETCH_FAILED' | 'DECODE_FAILED' | 'STALE';

export class StageLoadError extends Error {
  code: StageLoadErrorCode;

  constructor(code: StageLoadErrorCode, message: string) {
    super(message);
    this.name = 'StageLoadError';
    this.code = code;
  }
}

export interface StageManagerDeps {
  fetchAsset(entry: AssetManifestEntry): Promise<{ bytes: Uint8Array; downloadMs: number }>;
  decodeAsset(bytes: ArrayBuffer): Promise<{
    scene: THREE.Group;
    meshCount: number;
    triangleCount: number;
    decodeMs: number;
  }>;
  collectRecords(
    scene: THREE.Group,
    system: AssetManifestEntry['system'],
    bodyModel: AssetManifestEntry['bodyModel']
  ): AnatomyStructure[];
  registry: AnatomyStructureRegistry;
  now(): number;
}

export interface StageSceneOps {
  attach(root: THREE.Group): void;
  detach(root: THREE.Group): void;
}

export interface StageLoadTimings {
  downloadMs: number;
  decodeMs: number;
}

export interface ResidentSystem {
  entry: AssetManifestEntry;
  root: THREE.Group;
}

export class StageSystemManager {
  private generation = 0;
  private current: ResidentSystem | null = null;

  constructor(private readonly deps: StageManagerDeps) {}

  get resident(): ResidentSystem | null {
    return this.current;
  }

  /** Registry owned by the manager (single source for selection resolution). */
  get registry(): AnatomyStructureRegistry {
    return this.deps.registry;
  }

  /**
   * Drops the resident system (if any) and invalidates in-flight loads, so a
   * system switch during loading can never resurrect a stale scene.
   */
  unload(ops: StageSceneOps): void {
    this.generation += 1;
    if (this.current) {
      ops.detach(this.current.root);
      disposeObject(this.current.root);
      this.current = null;
    }
    this.deps.registry.clear();
  }

  /**
   * Loads exactly one system: guards → dispose previous → fetch → decode →
   * register → attach. Throws StageLoadError on every failure path; stale
   * loads throw STALE after leaving no residue.
   */
  async load(entry: AssetManifestEntry, ops: StageSceneOps): Promise<StageLoadTimings> {
    if (entry.bodyModel !== 'male') {
      throw new StageLoadError(
        'UNSUPPORTED_MODEL',
        `Model '${entry.bodyModel}' is not supported in this preview.`
      );
    }
    if (entry.bytes > MAX_STAGE_BYTES) {
      throw new StageLoadError(
        'OVERSIZED_ASSET',
        `System '${entry.system}' exceeds the ${(MAX_STAGE_BYTES / 1024 / 1024).toFixed(0)}MB mobile limit and stays deferred.`
      );
    }
    const generation = (this.generation += 1);
    const stale = (): boolean => generation !== this.generation;

    if (this.current) {
      ops.detach(this.current.root);
      disposeObject(this.current.root);
      this.current = null;
    }
    this.deps.registry.clear();

    let fetched: { bytes: Uint8Array; downloadMs: number };
    try {
      fetched = await this.deps.fetchAsset(entry);
    } catch (error) {
      throw new StageLoadError(
        'FETCH_FAILED',
        error instanceof Error ? error.message : 'Asset download failed.'
      );
    }
    if (stale()) throw new StageLoadError('STALE', 'Superseded by a newer load.');

    let decoded: {
      scene: THREE.Group;
      meshCount: number;
      triangleCount: number;
      decodeMs: number;
    };
    try {
      decoded = await this.deps.decodeAsset(fetched.bytes.buffer as ArrayBuffer);
    } catch (error) {
      throw new StageLoadError(
        'DECODE_FAILED',
        error instanceof Error ? error.message : 'Asset decode failed.'
      );
    }
    if (stale()) throw new StageLoadError('STALE', 'Superseded by a newer load.');

    for (const record of this.deps.collectRecords(decoded.scene, entry.system, entry.bodyModel)) {
      this.deps.registry.register(record);
    }
    ops.attach(decoded.scene);
    this.current = { entry, root: decoded.scene };
    return { downloadMs: fetched.downloadMs, decodeMs: decoded.decodeMs };
  }
}
