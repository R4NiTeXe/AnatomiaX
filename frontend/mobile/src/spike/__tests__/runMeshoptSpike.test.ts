import * as fs from 'fs';
import * as path from 'path';
import * as THREE from 'three';
import {
  decodeSpikeAsset,
  disposeSpikeObject,
  fetchSpikeBytes,
  summarizeSpikeScene,
  withHiddenWebGL1Global,
} from '../runMeshoptSpike';

function boxMesh(material?: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material ?? new THREE.MeshBasicMaterial());
}

describe('spike scene helpers (8.19.29)', () => {
  it('counts meshes, dedupes geometries, and sums triangles', () => {
    const group = new THREE.Group();
    const shared = new THREE.BoxGeometry(1, 1, 1);
    group.add(new THREE.Mesh(shared, new THREE.MeshBasicMaterial()));
    group.add(new THREE.Mesh(shared, new THREE.MeshBasicMaterial()));
    group.add(boxMesh());
    // BoxGeometry = 12 triangles each.
    expect(summarizeSpikeScene(group)).toEqual({
      meshCount: 3,
      geometryCount: 2,
      triangleCount: 36,
    });
  });

  it('ignores non-mesh objects', () => {
    const group = new THREE.Group();
    group.add(new THREE.AmbientLight(0xffffff, 1));
    group.add(new THREE.Group());
    expect(summarizeSpikeScene(group)).toEqual({
      meshCount: 0,
      geometryCount: 0,
      triangleCount: 0,
    });
  });

  it('disposes geometries and materials (array-aware) and is idempotent', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const materialA = new THREE.MeshBasicMaterial();
    const materialB = new THREE.MeshBasicMaterial();
    const disposeGeometry = jest.spyOn(geometry, 'dispose');
    const disposeA = jest.spyOn(materialA, 'dispose');
    const disposeB = jest.spyOn(materialB, 'dispose');
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geometry, [materialA, materialB]));

    expect(disposeSpikeObject(group)).toEqual({ geometriesDisposed: 1, materialsDisposed: 2 });
    expect(disposeGeometry).toHaveBeenCalledTimes(1);
    expect(disposeA).toHaveBeenCalledTimes(1);
    expect(disposeB).toHaveBeenCalledTimes(1);
    expect(() => disposeSpikeObject(group)).not.toThrow();
  });

  it('fetches bytes via arrayBuffer and rejects HTTP failures', async () => {
    const bytes = new Uint8Array([0x67, 0x6c, 0x54, 0x46]).buffer;
    const ok = await fetchSpikeBytes('http://x/skin.glb', (async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => bytes,
    })) as never);
    expect(ok.byteLength).toBe(4);
    expect(ok.via).toBe('arrayBuffer');

    await expect(
      fetchSpikeBytes('http://x/missing.glb', (async () => ({ ok: false, status: 404 })) as never)
    ).rejects.toThrow('asset HTTP 404');
  });

  it('reports runtimes without a usable response body path', async () => {
    await expect(
      fetchSpikeBytes('http://x/skin.glb', (async () => ({ ok: true, status: 200 })) as never)
    ).rejects.toThrow('no arrayBuffer');
  });
});

// Runs only where the gitignored dev asset exists (proves real Meshopt decode
// on this machine; the device run proves GL + render). Skips cleanly elsewhere.
const DEV_ASSET = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'web',
  'public',
  'models-dev',
  'skin-meshopt.glb'
);

(fs.existsSync(DEV_ASSET) ? describe : describe.skip)('real Meshopt asset decode (8.19.29)', () => {
  it('decodes skin-meshopt.glb to a non-empty scene', async () => {
    const bytes = new Uint8Array(fs.readFileSync(DEV_ASSET)).buffer;
    expect(bytes.byteLength).toBeGreaterThan(0);
    const decoded = await decodeSpikeAsset(bytes);
    expect(decoded.stats.meshCount).toBeGreaterThan(0);
    expect(decoded.stats.triangleCount).toBeGreaterThan(0);
    expect(Number.isFinite(decoded.decodeMs)).toBe(true);
    const disposed = disposeSpikeObject(decoded.scene);
    expect(disposed.geometriesDisposed).toBeGreaterThan(0);
  }, 60000);

  it('selects the pure-JS fallback with WebAssembly hidden and matches WASM output (8.19.30)', async () => {
    const bytes = new Uint8Array(fs.readFileSync(DEV_ASSET)).buffer;
    const wasmRun = await decodeSpikeAsset(bytes);
    expect(wasmRun.via).toBe('wasm');

    const host = globalThis as Record<string, unknown>;
    const realWasm = host.WebAssembly;
    try {
      // Simulate Hermes (no WebAssembly from the start). The three-stdlib
      // factory memoizes per module instance, so a fresh registry is needed
      // for a faithful simulation.
      host.WebAssembly = undefined;
      jest.resetModules();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fresh = require('../runMeshoptSpike') as typeof import('../runMeshoptSpike');
      const status = await fresh.getMeshoptDecoder();
      expect(status.hasWebAssembly).toBe(false);
      expect(status.supported).toBe(true);
      expect(status.via).toBe('pure-js');

      const fallbackRun = await fresh.decodeSpikeAsset(bytes);
      expect(fallbackRun.via).toBe('pure-js');
      expect(fallbackRun.stats).toEqual(wasmRun.stats);
      expect(fallbackRun.stats.meshCount).toBeGreaterThan(0);
    } finally {
      host.WebAssembly = realWasm;
      jest.resetModules();
    }
  }, 120000);
});

describe('WebGL1 guard shim (8.19.31)', () => {
  // Mirrors three r163+ WebGLRenderer guard semantics:
  // `typeof WebGLRenderingContext !== 'undefined' && context instanceof WebGLRenderingContext`
  const threeStyleGuard = (context: unknown): boolean => {
    const v1 = (globalThis as Record<string, unknown>).WebGLRenderingContext;
    return typeof v1 !== 'undefined' && context instanceof (v1 as new () => object);
  };

  it('reproduces the device FATAL with dual-shim contexts and skips it while hidden', () => {
    const host = globalThis as Record<string, unknown>;
    const realV1 = host.WebGLRenderingContext;
    // expo-gl style: one context object instanceof both the v1 and v2 shims.
    class FakeV1 {}
    class FakeGLContext extends FakeV1 {}
    try {
      host.WebGLRenderingContext = FakeV1;
      const context = new FakeGLContext();
      expect(threeStyleGuard(context)).toBe(true);

      let seenDuringHide: string | undefined;
      withHiddenWebGL1Global(() => {
        seenDuringHide = typeof (globalThis as Record<string, unknown>).WebGLRenderingContext;
        expect(threeStyleGuard(context)).toBe(false);
      });
      expect(seenDuringHide).toBe('undefined');
      expect(host.WebGLRenderingContext).toBe(FakeV1);
    } finally {
      host.WebGLRenderingContext = realV1;
    }
  });

  it('restores the global even when construction throws', () => {
    const host = globalThis as Record<string, unknown>;
    const realV1 = host.WebGLRenderingContext;
    expect(() =>
      withHiddenWebGL1Global(() => {
        throw new Error('renderer boom');
      })
    ).toThrow('renderer boom');
    expect(host.WebGLRenderingContext).toBe(realV1);
  });
});
