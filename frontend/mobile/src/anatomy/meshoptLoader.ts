import * as THREE from 'three';
import { GLTFLoader, MeshoptDecoder } from 'three-stdlib';

/**
 * Production Meshopt loading (8.19.35): ordered WASM → pure-JS decoder
 * selection, proven by the 8.19.29/30 spike. No R3F/Drei, no DOM, no GL here —
 * decoding only, so this module is fully unit-testable in Node.
 */

export type DecoderVia = 'wasm' | 'pure-js';

interface ReadyDecoder {
  ready: Promise<unknown>;
  supported: boolean;
  decodeGltfBuffer: (
    target: Uint8Array,
    count: number,
    size: number,
    source: Uint8Array,
    mode: number,
    filter?: number
  ) => void;
}

export interface DecoderSelection {
  supported: boolean;
  hasWebAssembly: boolean;
  via: 'wasm' | 'pure-js' | 'none';
  decoder?: ReadyDecoder;
}

/**
 * Selects a working Meshopt decoder for this runtime. Prefers the bundled
 * WASM decoder; falls back to the vendored pure-JS reference decoder
 * (meshoptimizer, MIT) where WebAssembly is unavailable (Hermes).
 */
export async function getMeshoptDecoder(): Promise<DecoderSelection> {
  const wasmHost = (globalThis as Record<string, unknown>).WebAssembly;
  const hasWebAssembly = typeof wasmHost === 'object' && wasmHost !== null;
  const produced = (MeshoptDecoder as unknown as () => Partial<ReadyDecoder>)();
  if (produced && produced.supported === true && typeof produced.ready?.then === 'function') {
    await produced.ready;
    return { supported: true, hasWebAssembly, via: 'wasm', decoder: produced as ReadyDecoder };
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fallback = require('../vendor/meshoptDecoderReference.js') as {
    MeshoptDecoder?: Partial<ReadyDecoder>;
  };
  const candidate = fallback.MeshoptDecoder;
  if (candidate && candidate.supported === true && typeof candidate.ready?.then === 'function') {
    await candidate.ready;
    return {
      supported: true,
      hasWebAssembly,
      via: 'pure-js',
      decoder: candidate as ReadyDecoder,
    };
  }
  return { supported: false, hasWebAssembly, via: 'none' };
}

export interface DecodedModel {
  scene: THREE.Group;
  meshCount: number;
  geometryCount: number;
  triangleCount: number;
  decodeMs: number;
  via: DecoderVia;
}

function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/** Decodes GLB bytes into a detached scene group. Throws on undecodable input. */
export async function decodeModel(bytes: ArrayBuffer): Promise<DecodedModel> {
  const { supported, hasWebAssembly, via, decoder } = await getMeshoptDecoder();
  if (!supported || !decoder) {
    throw new Error(
      `Meshopt decoding unavailable on this runtime (WebAssembly: ${hasWebAssembly ? 'yes' : 'no'})`
    );
  }
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(decoder);
  const started = now();
  const gltf = await loader.parseAsync(bytes, '');
  const scene = new THREE.Group();
  scene.add(gltf.scene);
  let meshCount = 0;
  let triangleCount = 0;
  const geometries = new Set<THREE.BufferGeometry>();
  scene.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh !== true) return;
    meshCount += 1;
    const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
    if (!geometry) return;
    geometries.add(geometry);
    const position = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!position) return;
    const index = geometry.getIndex();
    triangleCount += Math.floor((index ? index.count : position.count) / 3);
  });
  return {
    scene,
    meshCount,
    geometryCount: geometries.size,
    triangleCount,
    decodeMs: now() - started,
    via: via as DecoderVia,
  };
}
