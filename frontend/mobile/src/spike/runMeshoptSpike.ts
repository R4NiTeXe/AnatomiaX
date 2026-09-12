/**
 * TEMPORARY SPIKE (8.19.29/30) — asset decode / scene stats / disposal helpers.
 * Uses three + three-stdlib only (no R3F/Drei/expo-three, no DOM, no GL),
 * plus the vendored pure-JS fallback for runtimes without WebAssembly.
 * The GL context + renderer stay in the screen; everything here runs headless
 * so it is unit-tested in Node. Delete with the rest of `spike/`.
 */
import * as THREE from 'three';
import { GLTFLoader, MeshoptDecoder } from 'three-stdlib';

export interface SpikeSceneStats {
  meshCount: number;
  geometryCount: number;
  triangleCount: number;
}

export interface DecodedSpikeAsset extends SpikeSceneStats {
  scene: THREE.Group;
  decodeMs: number;
}

function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export interface MeshoptDecoderStatus {
  /** True when the selected decoder can actually run here. */
  supported: boolean;
  /** Whether the runtime provides WebAssembly at all (Hermes does not). */
  hasWebAssembly: boolean;
  /** Which decoder was selected — the device datum for the report. */
  via: 'wasm' | 'pure-js' | 'none';
}

/**
 * Runs `fn` with the WebGL1 global hidden, then restores it (even on throw).
 *
 * SPIKE FINDING (device run 1): expo-gl's context is instanceof BOTH the
 * WebGLRenderingContext and WebGL2RenderingContext shims, so three r163+
 * throws "WebGL 1 is not supported" for any custom context (it only checks
 * the v1 side). Hiding the v1 global during renderer construction lets the
 * WebGL2 path through; three hardcodes capabilities.isWebGL2=true afterwards.
 */
export function withHiddenWebGL1Global<T>(fn: () => T): T {
  const host = globalThis as Record<string, unknown>;
  const real = host.WebGLRenderingContext;
  host.WebGLRenderingContext = undefined;
  try {
    return fn();
  } finally {
    host.WebGLRenderingContext = real;
  }
}

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

/**
 * The three-stdlib export is a FACTORY (not a ready instance): it embeds the
 * wasm binary and returns { ready, supported, decode* }. Without WebAssembly
 * (e.g. Hermes) it returns { supported: false } with no `ready` promise.
 *
 * 8.19.30 ordered selection: bundled WASM decoder first; when it reports
 * unsupported, the vendored pure-JS reference decoder (meshoptimizer, MIT —
 * upstream documents it as a drop-in replacement) is used instead.
 */
export async function getMeshoptDecoder(): Promise<
  MeshoptDecoderStatus & { decoder?: ReadyDecoder }
> {
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

function trianglesOf(geometry: THREE.BufferGeometry): number {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!position) return 0;
  const index = geometry.getIndex();
  return Math.floor((index ? index.count : position.count) / 3);
}

/** Counts renderable content without touching any GL context. */
export function summarizeSpikeScene(root: THREE.Object3D): SpikeSceneStats {
  let meshCount = 0;
  let triangleCount = 0;
  const geometries = new Set<THREE.BufferGeometry>();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if ((mesh as THREE.Mesh).isMesh !== true) return;
    meshCount += 1;
    const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
    if (geometry) {
      geometries.add(geometry);
      triangleCount += trianglesOf(geometry);
    }
  });
  return { meshCount, geometryCount: geometries.size, triangleCount };
}

export interface DecodedSpike {
  scene: THREE.Group;
  stats: SpikeSceneStats;
  decodeMs: number;
  /** Which decoder actually ran — the device datum for the report. */
  via: 'wasm' | 'pure-js';
}

/**
 * Decodes GLB bytes with Meshopt support explicitly configured.
 * Throws an explicit error when no decoder path works here instead of
 * surfacing the generic loader message.
 */
export async function decodeSpikeAsset(bytes: ArrayBuffer): Promise<DecodedSpike> {
  const { supported, hasWebAssembly, via, decoder } = await getMeshoptDecoder();
  if (!supported || !decoder) {
    throw new Error(
      `MeshoptDecoder unsupported on this runtime (WebAssembly: ${hasWebAssembly ? 'yes' : 'no'})`
    );
  }
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(decoder);
  const started = now();
  const gltf = await loader.parseAsync(bytes, '');
  const decodeMs = now() - started;
  const scene = new THREE.Group();
  scene.add(gltf.scene);
  return { scene, stats: summarizeSpikeScene(scene), decodeMs, via: via as 'wasm' | 'pure-js' };
}

export interface SpikeDisposal {
  geometriesDisposed: number;
  materialsDisposed: number;
}

/** Releases GPU-side resources; safe to call twice. */
export function disposeSpikeObject(root: THREE.Object3D): SpikeDisposal {
  let geometriesDisposed = 0;
  let materialsDisposed = 0;
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh !== true) return;
    const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
    if (geometry) geometries.add(geometry);
    const material = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) {
      for (const entry of material) if (entry) materials.add(entry);
    } else if (material) {
      materials.add(material);
    }
  });
  for (const geometry of geometries) {
    geometry.dispose();
    geometriesDisposed += 1;
  }
  for (const material of materials) {
    material.dispose();
    materialsDisposed += 1;
  }
  return { geometriesDisposed, materialsDisposed };
}

export interface FetchLike {
  (
    url: string,
    init?: unknown
  ): Promise<{
    ok: boolean;
    status: number;
    arrayBuffer?: () => Promise<ArrayBuffer>;
    blob?: () => Promise<unknown>;
  }>;
}

/**
 * Fetches GLB bytes over HTTP. Prefers arrayBuffer(); documents (via throw)
 * environments where neither arrayBuffer nor FileReader exist, which is
 * itself a spike finding.
 */
export async function fetchSpikeBytes(
  url: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike
): Promise<{ bytes: ArrayBuffer; byteLength: number; via: string; ms: number }> {
  const started = now();
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`asset HTTP ${response.status} for ${url}`);
  }
  if (typeof response.arrayBuffer === 'function') {
    const bytes = await response.arrayBuffer();
    return { bytes, byteLength: bytes.byteLength, via: 'arrayBuffer', ms: now() - started };
  }
  if (typeof response.blob === 'function' && typeof FileReader !== 'undefined') {
    const blob = (await response.blob()) as Blob;
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(new Error('blob FileReader failed'));
      reader.readAsArrayBuffer(blob);
    });
    return { bytes, byteLength: bytes.byteLength, via: 'blob+FileReader', ms: now() - started };
  }
  throw new Error('no arrayBuffer/blob+FileReader response path on this runtime');
}
