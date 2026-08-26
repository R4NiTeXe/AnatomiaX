import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { Bounds, OrbitControls, useBounds, useGLTF } from '@react-three/drei';

export interface OptimizedModelInfo {
  url: string;
  meshes: number;
  materials: number;
  vertices: number;
  triangles: number;
  size: [number, number, number];
}

type OptimizedGltfProps = {
  url: string;
  onLoaded?: (info: OptimizedModelInfo) => void;
};

/**
 * Renders an optimized GLB (EXT_meshopt_compression / KHR_mesh_quantization).
 *
 * Decoder setup (verified against drei's implementation):
 * - `useDraco = false` -> DRACOLoader is never initialized, no CDN involved
 * - `useMeshopt = true` -> loader.setMeshoptDecoder(MeshoptDecoder) using the
 *   decoder bundled locally in three-stdlib (no network dependency)
 *
 * The model itself is rendered unmodified; fitting is handled by <Bounds>.
 */
function OptimizedGltf({ url, onLoaded }: OptimizedGltfProps): JSX.Element {
  const { scene } = useGLTF(url, false, true);

  useEffect(() => {
    let meshCount = 0;
    let vertices = 0;
    let triangles = 0;
    const materials = new Set<string>();
    scene.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      meshCount++;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach(m => materials.add(m.uuid));
      const pos = mesh.geometry.getAttribute('POSITION') ?? mesh.geometry.getAttribute('position');
      if (pos) vertices += pos.count;
      if (mesh.geometry.index) triangles += mesh.geometry.index.count / 3;
      else if (pos) triangles += pos.count / 3;
    });
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    onLoaded?.({
      url,
      meshes: meshCount,
      materials: materials.size,
      vertices,
      triangles: Math.round(triangles),
      size: [size.x, size.y, size.z],
    });
  }, [scene, url, onLoaded]);

  return <primitive object={scene} />;
}

type FitControllerProps = {
  resetSignal: number;
};

/** Re-runs fit-to-view whenever resetSignal increments. */
function FitController({ resetSignal }: FitControllerProps): null {
  const api = useBounds();
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    api.refresh().fit();
  }, [resetSignal]);
  return null;
}

type StageErrorBoundaryProps = {
  children: ReactNode;
  onError: (message: string) => void;
};

class StageErrorBoundary extends Component<StageErrorBoundaryProps, { hasError: boolean }> {
  constructor(props: StageErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(`GLB failed to load or decode: ${error.message}`);
  }

  render(): ReactNode {
    return this.state.hasError ? null : this.props.children;
  }
}

type OptimizedModelStageProps = {
  url: string | null;
  onLoaded?: (info: OptimizedModelInfo) => void;
  onError?: (message: string) => void;
  resetSignal?: number;
};

export default function OptimizedModelStage({
  url,
  onLoaded,
  onError,
  resetSignal = 0,
}: OptimizedModelStageProps): JSX.Element {
  const handleError = onError ?? (() => undefined);
  const handleLoaded = useMemo(() => onLoaded ?? (() => undefined), [onLoaded]);

  useEffect(() => {
    handleError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return (
    <>
      {url && (
        <Bounds fit clip observe margin={1.15}>
          <FitController resetSignal={resetSignal} />
          <StageErrorBoundary key={url} onError={handleError}>
            <Suspense fallback={null}>
              <OptimizedGltf url={url} onLoaded={handleLoaded} />
            </Suspense>
          </StageErrorBoundary>
        </Bounds>
      )}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan
        enableZoom
        enableRotate
      />
    </>
  );
}
