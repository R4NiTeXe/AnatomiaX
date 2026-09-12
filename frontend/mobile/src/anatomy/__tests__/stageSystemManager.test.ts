import * as THREE from 'three';
import { AnatomyStructureRegistry, findManifestEntry } from '@anatomiax/anatomy-core';
import type { AnatomyStructure } from '@anatomiax/shared-types';
import {
  StageSystemManager,
  type StageManagerDeps,
  type StageSceneOps,
} from '../stageSystemManager';

const skin = findManifestEntry('male', 'skin');
const nervous = findManifestEntry('male', 'nervous');
const femaleSkin = findManifestEntry('female', 'skin');
if (!skin || !nervous || !femaleSkin) throw new Error('manifest test fixtures missing');

function fakeRoot(): THREE.Group {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
  return group;
}

function makeManager(overrides: Partial<StageManagerDeps> = {}) {
  const registry = new AnatomyStructureRegistry();
  const deps: StageManagerDeps = {
    fetchAsset: jest.fn(async () => ({ bytes: new Uint8Array([1, 2, 3]), downloadMs: 10 })),
    decodeAsset: jest.fn(async () => ({
      scene: fakeRoot(),
      meshCount: 1,
      triangleCount: 12,
      decodeMs: 5,
    })),
    collectRecords: jest.fn((): AnatomyStructure[] => [
      {
        id: 'male:skin:object:T',
        structureKey: 'male:skin:object:T',
        name: 'T',
        objectName: 'T',
        systemKey: 'skin',
        bodyModel: 'male',
        ontologyId: null,
        lineage: [],
      },
    ]),
    registry,
    now: () => Date.now(),
    ...overrides,
  };
  const seen = { attached: [] as THREE.Group[], detached: [] as THREE.Group[] };
  const ops: StageSceneOps = {
    attach: jest.fn((root: THREE.Group) => {
      seen.attached.push(root);
    }),
    detach: jest.fn((root: THREE.Group) => {
      seen.detached.push(root);
    }),
  };
  return { manager: new StageSystemManager(deps), deps, ops, seen, registry };
}

describe('stage system manager (8.19.36)', () => {
  it('loads a supported system and records timings', async () => {
    const { manager, ops, seen, registry } = makeManager();
    const timings = await manager.load(skin, ops);
    expect(timings).toMatchObject({ downloadMs: 10, decodeMs: 5 });
    expect(manager.resident?.entry).toBe(skin);
    expect(seen.attached).toHaveLength(1);
    expect(seen.detached).toHaveLength(0);
    expect(registry.size).toBe(1);
  });

  it('rejects oversized assets before any download', async () => {
    const { manager, deps, ops } = makeManager();
    await expect(manager.load(nervous, ops)).rejects.toMatchObject({
      name: 'StageLoadError',
      code: 'OVERSIZED_ASSET',
    });
    expect(deps.fetchAsset).not.toHaveBeenCalled();
    expect(manager.resident).toBeNull();
  });

  it('rejects non-male models explicitly', async () => {
    const { manager, deps, ops } = makeManager();
    await expect(manager.load(femaleSkin, ops)).rejects.toMatchObject({
      code: 'UNSUPPORTED_MODEL',
    });
    expect(deps.fetchAsset).not.toHaveBeenCalled();
    expect(manager.resident).toBeNull();
  });

  it('disposes the previous system before loading the next', async () => {
    const { manager, ops, seen } = makeManager();
    await manager.load(skin, ops);
    const firstRoot = manager.resident?.root;
    expect(firstRoot).toBeDefined();
    await manager.load({ ...skin }, ops);
    expect(seen.detached).toEqual([firstRoot]);
    expect(seen.attached).toHaveLength(2);
    expect(manager.resident?.root).not.toBe(firstRoot);
  });

  it('abandons stale loads without resurrecting state', async () => {
    let releaseFirst!: (value: { bytes: Uint8Array; downloadMs: number }) => void;
    const gate = new Promise<{ bytes: Uint8Array; downloadMs: number }>(resolve => {
      releaseFirst = resolve;
    });
    const { manager, ops, seen, registry } = makeManager({
      fetchAsset: jest
        .fn()
        .mockImplementationOnce(() => gate)
        .mockImplementation(async () => ({ bytes: new Uint8Array([9]), downloadMs: 1 })),
    });
    const stale = manager.load(skin, ops);
    const current = manager.load({ ...skin }, ops);
    releaseFirst({ bytes: new Uint8Array([1]), downloadMs: 1 });
    await expect(stale).rejects.toMatchObject({ code: 'STALE' });
    await expect(current).resolves.toMatchObject({ downloadMs: 1 });
    // Only the current load registered and attached.
    expect(registry.size).toBe(1);
    expect(seen.attached).toHaveLength(1);
    expect(manager.resident).not.toBeNull();
  });

  it('leaves no partial state when decode fails', async () => {
    const { manager, ops, seen, registry } = makeManager({
      decodeAsset: jest.fn(async () => {
        throw new Error('bad bytes');
      }),
    });
    await expect(manager.load(skin, ops)).rejects.toMatchObject({ code: 'DECODE_FAILED' });
    expect(registry.size).toBe(0);
    expect(seen.attached).toHaveLength(0);
    expect(manager.resident).toBeNull();
  });

  it('wraps fetch failures and unloads cleanly', async () => {
    const good = makeManager();
    await good.manager.load(skin, good.ops);
    const root = good.manager.resident?.root;
    expect(root).toBeDefined();
    good.manager.unload(good.ops);
    expect(good.manager.resident).toBeNull();
    expect(good.registry.size).toBe(0);
    expect(good.seen.detached).toEqual([root]);

    const failing = makeManager({
      fetchAsset: jest.fn(async () => {
        throw new Error('offline');
      }),
    });
    await expect(failing.manager.load(skin, failing.ops)).rejects.toMatchObject({
      code: 'FETCH_FAILED',
    });
    expect(failing.manager.resident).toBeNull();
    expect(failing.seen.attached).toHaveLength(0);
  });

  it('registers exactly the collected records', async () => {
    const { manager, ops, registry } = makeManager();
    const seen: string[] = [];
    const original = registry.register.bind(registry);
    registry.register = (structure: AnatomyStructure) => {
      seen.push(structure.structureKey);
      return original(structure);
    };
    await manager.load(skin, ops);
    expect(seen).toEqual(['male:skin:object:T']);
  });
});
