import { Component, Suspense, useEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useAnatomyState } from './AnatomyStateContext';
import type { AnatomySystemAsset } from './anatomyTypes';
import { createStructureKey, extractOntologyId } from './anatomyRegistry';

const HIGHLIGHT_EMISSIVE = new THREE.Color('#2dd4bf');
const HIGHLIGHT_INTENSITY = 0.6;

/**
 * Resolves a user-facing structure name from a clicked object by walking up
 * the scene graph to the nearest named ancestor. GLB node names are the only
 * verified identifiers at this stage — no medical labels are invented here.
 */
export function resolveStructureName(object: THREE.Object3D): string {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current.name) return current.name;
    current = current.parent;
  }
  return object.type;
}

interface MeshMaterialEntry {
  mesh: THREE.Mesh;
  /** Per-mesh clone created on mount — the "normal" material for this mesh. */
  base: THREE.Material | THREE.Material[];
}

function cloneSceneMaterials(scene: THREE.Object3D): MeshMaterialEntry[] {
  const entries: MeshMaterialEntry[] = [];
  scene.traverse(obj => {
    const mesh = obj as THREE.Mesh;
    if (!(mesh as unknown as { isMesh?: boolean }).isMesh || !mesh.geometry) return;
    const shared = mesh.material;
    // Clone so opacity/highlight never mutate materials shared across meshes.
    const cloned = Array.isArray(shared) ? shared.map(m => m.clone()) : shared.clone();
    // Preserve original transparency/depthWrite for soft-transparency restore.
    const clonedList = Array.isArray(cloned) ? cloned : [cloned];
    const sharedList = Array.isArray(shared) ? shared : [shared];
    clonedList.forEach((c, i) => {
      const orig = sharedList[i] as THREE.MeshStandardMaterial;
      (c as unknown as Record<string, unknown>).__originalTransparent = orig.transparent;
      (c as unknown as Record<string, unknown>).__originalDepthWrite = orig.depthWrite;
    });
    mesh.material = cloned;
    entries.push({ mesh, base: cloned });
  });
  return entries;
}

function applySystemOpacity(entries: MeshMaterialEntry[], opacity: number): void {
  for (const { mesh } of entries) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      const std = material as THREE.MeshStandardMaterial & {
        __originalTransparent?: boolean;
        __originalDepthWrite?: boolean;
      };
      const originalTransparent = (std as unknown as Record<string, unknown>)
        .__originalTransparent as boolean | undefined;
      const originalDepthWrite = (std as unknown as Record<string, unknown>)
        .__originalDepthWrite as boolean | undefined;
      std.opacity = opacity;
      if (opacity >= 0.999) {
        std.transparent = originalTransparent ?? false;
        std.depthWrite = originalDepthWrite ?? true;
      } else if (opacity <= 0.001) {
        // Fully transparent — keep transparent true but allow depth sorting to avoid artifacts.
        std.transparent = true;
        std.depthWrite = false;
      } else {
        std.transparent = true;
        std.depthWrite = false;
      }
      std.needsUpdate = false;
    }
  }
}

function applyHighlight(mesh: THREE.Mesh): void {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const highlighted = materials.map(material => {
    const clone = material.clone();
    const std = clone as THREE.MeshStandardMaterial;
    if (std.emissive) {
      std.emissive = HIGHLIGHT_EMISSIVE.clone();
      std.emissiveIntensity = HIGHLIGHT_INTENSITY;
    }
    return clone;
  });
  mesh.material = Array.isArray(mesh.material) ? highlighted : highlighted[0];
}

type AnatomyGltfProps = {
  asset: AnatomySystemAsset;
};

function AnatomyGltf({ asset }: AnatomyGltfProps): JSX.Element {
  const { scene } = useGLTF(asset.path, false, true);
  const {
    systemOpacity,
    selectedStructure,
    selectStructure,
    setSystemStatus,
    registerSystemStructures,
    registry,
  } = useAnatomyState();
  const entriesRef = useRef<MeshMaterialEntry[]>([]);
  const highlightedRef = useRef<THREE.Mesh[]>([]);

  useEffect(() => {
    entriesRef.current = cloneSceneMaterials(scene);
    applySystemOpacity(entriesRef.current, systemOpacity[asset.key] ?? 1);
    registerSystemStructures(asset.key, scene);
    setSystemStatus(asset.key, 'loaded');
    // Keep registry cached on hide — do not unregister here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, asset.key]);

  useEffect(() => {
    applySystemOpacity(entriesRef.current, systemOpacity[asset.key] ?? 1);
    // Also update any currently highlighted meshes in this system.
    for (const mesh of highlightedRef.current) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial;
        const op = systemOpacity[asset.key] ?? 1;
        std.opacity = op;
        std.transparent = op < 0.999;
        std.depthWrite = op >= 0.999;
      }
    }
  }, [asset.key, systemOpacity]);

  useEffect(() => {
    // Restore any previously highlighted meshes in this system.
    for (const mesh of highlightedRef.current) {
      const entry = entriesRef.current.find(e => e.mesh === mesh);
      if (entry) mesh.material = entry.base;
    }
    highlightedRef.current = [];

    if (selectedStructure && selectedStructure.systemKey === asset.key) {
      const targets: THREE.Mesh[] = [];
      scene.traverse(obj => {
        const mesh = obj as THREE.Mesh;
        if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return;
        const objectName = resolveStructureName(mesh);
        const ontologyId = extractOntologyId(mesh);
        const key = createStructureKey(asset.key, ontologyId, objectName);
        if (key === selectedStructure.structureKey) {
          targets.push(mesh);
        } else if (selectedStructure.ontologyId && ontologyId === selectedStructure.ontologyId) {
          // Multiple meshes sharing the same ontologyId — highlight all.
          targets.push(mesh);
        }
      });
      for (const mesh of targets) {
        applyHighlight(mesh);
        highlightedRef.current.push(mesh);
      }
    }

    return () => {
      for (const mesh of highlightedRef.current) {
        const entry = entriesRef.current.find(e => e.mesh === mesh);
        if (entry) mesh.material = entry.base;
      }
      highlightedRef.current = [];
    };
  }, [scene, asset.key, selectedStructure]);

  const handleClick = (event: ThreeEvent<MouseEvent>): void => {
    event.stopPropagation();
    const objectName = resolveStructureName(event.object);
    const ontologyId = extractOntologyId(event.object);
    const structureKey = createStructureKey(asset.key, ontologyId, objectName);
    const registered = registry.findByStructureKey(structureKey);
    // Prefer canonical registry values when available; otherwise use derived ones.
    selectStructure({
      structureKey: registered?.structureKey ?? structureKey,
      name: registered?.name ?? objectName,
      objectName,
      systemKey: asset.key,
      ontologyId: registered?.ontologyId ?? ontologyId,
    });
  };

  return <primitive object={scene} onClick={handleClick} />;
}

class AnatomySystemErrorBoundary extends Component<
  { children: ReactNode; onError: (message: string) => void },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; onError: (message: string) => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error.message || 'Failed to load anatomy system.');
  }

  render(): ReactNode {
    return this.state.hasError ? null : this.props.children;
  }
}

type AnatomySystemSlotProps = {
  asset: AnatomySystemAsset;
};

/**
 * Mounts one anatomy system: marks it loading, loads lazily via useGLTF
 * (Meshopt decoder), and isolates failures so one broken GLB cannot crash
 * the rest of the viewer.
 */
export default function AnatomySystemSlot({ asset }: AnatomySystemSlotProps): JSX.Element {
  const { setSystemStatus, setSystemError } = useAnatomyState();

  return (
    <AnatomySystemErrorBoundary
      key={asset.key}
      onError={message => {
        setSystemError(asset.key, message);
        setSystemStatus(asset.key, 'error');
      }}
    >
      <Suspense fallback={null}>
        <AnatomyGltf asset={asset} />
      </Suspense>
    </AnatomySystemErrorBoundary>
  );
}
