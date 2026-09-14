import { Component, Suspense, useEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useAnatomyState } from './AnatomyStateContext';
import type { AnatomySystemAsset } from './anatomyTypes';
import { createStructureKey, extractOntologyId } from './anatomyRegistry';

const HIGHLIGHT_EMISSIVE = new THREE.Color('#2dd4bf');
const HIGHLIGHT_INTENSITY = 0.6;
const HOVER_EMISSIVE = new THREE.Color('#5eead4');
const HOVER_INTENSITY = 0.35;
const COMPARE_EMISSIVE = new THREE.Color('#a78bfa');
const COMPARE_INTENSITY = 0.55;

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
    const cloned = Array.isArray(shared)
      ? shared.map(m => m.clone())
      : (shared as THREE.Material).clone();
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

interface CachedMeshKey {
  key: string;
  ontologyId: string | null;
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  const list = Array.isArray(material) ? material : [material];
  for (const m of list) {
    try {
      m.dispose?.();
    } catch {
      // ignore dispose errors — restore still proceeds
    }
  }
}

// STEP 8.20.9: O(1) restore + highlight-clone disposal. Previously each
// highlight pass did scene.traverse + linear entries.find per mesh (O(n^2)
// on large systems) and discarded highlight clones without dispose.
// Behavior preserved: same emissive/opacity, same matching.
function restoreMeshToBase(mesh: THREE.Mesh, entryMap: Map<THREE.Mesh, MeshMaterialEntry>): void {
  const entry = entryMap.get(mesh);
  if (!entry) return;
  const current = mesh.material;
  if (current === entry.base) return;
  const baseList = Array.isArray(entry.base) ? entry.base : [entry.base];
  const currentList = Array.isArray(current) ? current : [current];
  // Dispose only highlight clones (materials not part of base).
  const toDispose = currentList.filter(m => !baseList.includes(m as THREE.Material));
  if (toDispose.length > 0) {
    disposeMaterial(toDispose as THREE.Material[]);
  }
  mesh.material = entry.base;
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

function applyHighlight(
  mesh: THREE.Mesh,
  type: 'selected' | 'hover' | 'compare' = 'selected'
): void {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const highlighted = materials.map(material => {
    const clone = material.clone();
    const std = clone as THREE.MeshStandardMaterial;
    if (std.emissive) {
      if (type === 'hover') {
        std.emissive = HOVER_EMISSIVE.clone();
        std.emissiveIntensity = HOVER_INTENSITY;
      } else if (type === 'compare') {
        std.emissive = COMPARE_EMISSIVE.clone();
        std.emissiveIntensity = COMPARE_INTENSITY;
      } else {
        std.emissive = HIGHLIGHT_EMISSIVE.clone();
        std.emissiveIntensity = HIGHLIGHT_INTENSITY;
      }
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
    hoveredStructure,
    setHoveredStructure,
    compareStructure,
    setCompareStructure,
    setSystemStatus,
    registerSystemStructures,
    registerSystemScene,
    unregisterSystemScene,
    registry,
    selectedBodyModel,
  } = useAnatomyState();
  const entriesRef = useRef<MeshMaterialEntry[]>([]);
  const entryMapRef = useRef<Map<THREE.Mesh, MeshMaterialEntry>>(new Map());
  const keyCacheRef = useRef<Map<THREE.Mesh, CachedMeshKey>>(new Map());
  const highlightedRef = useRef<THREE.Mesh[]>([]);
  const hoveredRef = useRef<THREE.Mesh[]>([]);
  const compareRef = useRef<THREE.Mesh[]>([]);

  useEffect(() => {
    const entries = cloneSceneMaterials(scene);
    entriesRef.current = entries;
    // STEP 8.20.9: build O(1) lookup + per-mesh key cache once per mount.
    // Highlight passes previously re-traversed the full scene and recomputed
    // names/ontology/keys on every selection/hover/compare change.
    const entryMap = new Map<THREE.Mesh, MeshMaterialEntry>();
    const keyCache = new Map<THREE.Mesh, CachedMeshKey>();
    for (const entry of entries) {
      entryMap.set(entry.mesh, entry);
      const objectName = resolveStructureName(entry.mesh);
      const ontologyId = extractOntologyId(entry.mesh);
      keyCache.set(entry.mesh, {
        key: createStructureKey(asset.key, ontologyId, objectName, selectedBodyModel),
        ontologyId,
      });
    }
    entryMapRef.current = entryMap;
    keyCacheRef.current = keyCache;
    applySystemOpacity(entriesRef.current, systemOpacity[asset.key] ?? 1);
    registerSystemStructures(asset.key, scene);
    registerSystemScene(asset.key, scene);
    // Also register with body-model-qualified key for future female coexistence
    // (registry now stores bodyModel in structureKey, default male)
    setSystemStatus(asset.key, 'loaded');
    return () => {
      unregisterSystemScene(asset.key);
    };
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
      restoreMeshToBase(mesh, entryMapRef.current);
    }
    highlightedRef.current = [];

    if (
      selectedStructure &&
      selectedStructure.systemKey === asset.key &&
      selectedStructure.bodyModel === selectedBodyModel
    ) {
      const targets: THREE.Mesh[] = [];
      // STEP 8.20.9: iterate cached mesh entries (meshes only) with
      // precomputed keys — same matching as previous scene.traverse.
      for (const { mesh } of entriesRef.current) {
        const cached = keyCacheRef.current.get(mesh);
        const key =
          cached?.key ??
          createStructureKey(
            asset.key,
            extractOntologyId(mesh),
            resolveStructureName(mesh),
            selectedBodyModel
          );
        const ontologyId = cached?.ontologyId ?? extractOntologyId(mesh);
        if (key === selectedStructure.structureKey) {
          targets.push(mesh);
        } else if (
          selectedStructure.ontologyId &&
          ontologyId === selectedStructure.ontologyId &&
          selectedStructure.bodyModel === selectedBodyModel
        ) {
          // Multiple meshes sharing the same ontologyId — highlight all.
          targets.push(mesh);
        }
      }
      for (const mesh of targets) {
        applyHighlight(mesh, 'selected');
        highlightedRef.current.push(mesh);
      }
    }

    return () => {
      for (const mesh of highlightedRef.current) {
        restoreMeshToBase(mesh, entryMapRef.current);
      }
      highlightedRef.current = [];
    };
  }, [scene, asset.key, selectedStructure, selectedBodyModel]);

  useEffect(() => {
    // Hover preview — temporary, distinct from selection
    for (const mesh of hoveredRef.current) {
      // Don't restore if mesh is currently selected (selected highlight takes precedence)
      const isSelected = highlightedRef.current.includes(mesh);
      if (!isSelected) {
        restoreMeshToBase(mesh, entryMapRef.current);
      }
    }
    hoveredRef.current = [];

    if (
      hoveredStructure &&
      hoveredStructure.systemKey === asset.key &&
      hoveredStructure.bodyModel === selectedBodyModel &&
      // Don't hover the already selected structure
      hoveredStructure.structureKey !== selectedStructure?.structureKey
    ) {
      const targets: THREE.Mesh[] = [];
      for (const { mesh } of entriesRef.current) {
        const cached = keyCacheRef.current.get(mesh);
        const key =
          cached?.key ??
          createStructureKey(
            asset.key,
            extractOntologyId(mesh),
            resolveStructureName(mesh),
            selectedBodyModel
          );
        const ontologyId = cached?.ontologyId ?? extractOntologyId(mesh);
        if (key === hoveredStructure.structureKey) {
          targets.push(mesh);
        } else if (hoveredStructure.ontologyId && ontologyId === hoveredStructure.ontologyId) {
          targets.push(mesh);
        }
      }
      for (const mesh of targets) {
        // Skip if already highlighted as selected
        if (highlightedRef.current.includes(mesh)) continue;
        applyHighlight(mesh, 'hover');
        hoveredRef.current.push(mesh);
      }
    }

    return () => {
      for (const mesh of hoveredRef.current) {
        const isSelected = highlightedRef.current.includes(mesh);
        if (!isSelected) {
          restoreMeshToBase(mesh, entryMapRef.current);
        }
      }
      hoveredRef.current = [];
    };
  }, [scene, asset.key, hoveredStructure, selectedStructure, selectedBodyModel]);

  useEffect(() => {
    // Compare highlight — distinct from selected and hover
    for (const mesh of compareRef.current) {
      const isSelected = highlightedRef.current.includes(mesh);
      const isHovered = hoveredRef.current.includes(mesh);
      if (!isSelected && !isHovered) {
        restoreMeshToBase(mesh, entryMapRef.current);
      }
    }
    compareRef.current = [];

    if (
      compareStructure &&
      compareStructure.systemKey === asset.key &&
      compareStructure.bodyModel === selectedBodyModel &&
      compareStructure.structureKey !== selectedStructure?.structureKey
    ) {
      const targets: THREE.Mesh[] = [];
      for (const { mesh } of entriesRef.current) {
        const cached = keyCacheRef.current.get(mesh);
        const key =
          cached?.key ??
          createStructureKey(
            asset.key,
            extractOntologyId(mesh),
            resolveStructureName(mesh),
            selectedBodyModel
          );
        const ontologyId = cached?.ontologyId ?? extractOntologyId(mesh);
        if (key === compareStructure.structureKey) {
          targets.push(mesh);
        } else if (compareStructure.ontologyId && ontologyId === compareStructure.ontologyId) {
          targets.push(mesh);
        }
      }
      for (const mesh of targets) {
        if (highlightedRef.current.includes(mesh) || hoveredRef.current.includes(mesh)) continue;
        applyHighlight(mesh, 'compare');
        compareRef.current.push(mesh);
      }
    }

    return () => {
      for (const mesh of compareRef.current) {
        const isSelected = highlightedRef.current.includes(mesh);
        const isHovered = hoveredRef.current.includes(mesh);
        if (!isSelected && !isHovered) {
          restoreMeshToBase(mesh, entryMapRef.current);
        }
      }
      compareRef.current = [];
    };
  }, [scene, asset.key, compareStructure, selectedStructure, hoveredStructure, selectedBodyModel]);

  const handleClick = (event: ThreeEvent<MouseEvent>): void => {
    event.stopPropagation();
    const objectName = resolveStructureName(event.object);
    const ontologyId = extractOntologyId(event.object);
    const structureKey = createStructureKey(asset.key, ontologyId, objectName, selectedBodyModel);
    const registered = registry.findByStructureKey(structureKey);
    const selection = {
      structureKey: registered?.structureKey ?? structureKey,
      name: registered?.name ?? objectName,
      objectName,
      systemKey: asset.key,
      bodyModel: selectedBodyModel,
      ontologyId: registered?.ontologyId ?? ontologyId,
    } as const;
    if ((event as unknown as { shiftKey?: boolean }).shiftKey) {
      setCompareStructure(selection as never);
      return;
    }
    selectStructure(selection as never);
  };

  const handlePointerOver = (event: ThreeEvent<PointerEvent>): void => {
    event.stopPropagation();
    // Don't hover on touch devices - pointerType will be touch
    if ((event as unknown as { pointerType?: string }).pointerType === 'touch') return;
    const objectName = resolveStructureName(event.object);
    const ontologyId = extractOntologyId(event.object);
    const structureKey = createStructureKey(asset.key, ontologyId, objectName, selectedBodyModel);
    const registered = registry.findByStructureKey(structureKey);
    // Don't hover the already selected structure
    if (registered?.structureKey === selectedStructure?.structureKey) return;
    if (structureKey === selectedStructure?.structureKey) return;
    setHoveredStructure({
      structureKey: registered?.structureKey ?? structureKey,
      name: registered?.name ?? objectName,
      objectName,
      systemKey: asset.key,
      bodyModel: selectedBodyModel,
      ontologyId: registered?.ontologyId ?? ontologyId,
    });
  };

  const handlePointerOut = (event: ThreeEvent<PointerEvent>): void => {
    event.stopPropagation();
    setHoveredStructure(null);
  };

  return (
    <primitive
      object={scene}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onPointerMissed={() => setHoveredStructure(null)}
    />
  );
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
