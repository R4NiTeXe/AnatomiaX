import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { ActivityIndicator, Button, PanResponder, StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three';
import {
  AnatomyStructureRegistry,
  findManifestEntry,
  getAnatomyInformation,
} from '@anatomiax/anatomy-core';
import type { AnatomySelection, AnatomySystemKey } from '@anatomiax/shared-types';
import { fetchVerifiedAsset } from '../lib/assetCache';
import { decodeModel } from './meshoptLoader';
import { disposeObject } from './dispose';
import { createStageRenderer } from './glContext';
import { collectSceneRecords, resolveTapSelection } from './sceneRegistry';
import { frameSelection } from './stageFraming';
import { DEFAULT_STAGE_SYSTEM, SUPPORTED_STAGE_SYSTEMS } from './supportedScope';

export type StageStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unsupported';

export interface StageTimings {
  downloadMs: number;
  decodeMs: number;
  firstVisibleMs: number;
}

interface MobileAnatomyStageProps {
  onSelectionChange?: (selection: AnatomySelection | null) => void;
}

interface Highlight {
  mesh: THREE.Mesh;
  original: THREE.Material | THREE.Material[];
}

/**
 * Production mobile anatomy stage (8.19.35): expo-gl + plain Three.js,
 * one resident male system (<=5MB), demand rendering, tap-to-select with
 * anatomy-core identity, core-math focus, native info UI.
 * No R3F/Drei, no hover model, no continuous render loop.
 */
export default function MobileAnatomyStage({
  onSelectionChange,
}: MobileAnatomyStageProps): JSX.Element {
  const [status, setStatus] = useState<StageStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [system, setSystem] = useState<AnatomySystemKey>(DEFAULT_STAGE_SYSTEM);
  const [selection, setSelection] = useState<AnatomySelection | null>(null);
  const [timings, setTimings] = useState<StageTimings | null>(null);

  const glRef = useRef<ExpoWebGLRenderingContext | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const registryRef = useRef(new AnatomyStructureRegistry());
  const rootRef = useRef<THREE.Group | null>(null);
  const highlightRef = useRef<Highlight | null>(null);
  const orbitRef = useRef({ theta: 0, phi: Math.PI / 2, radius: 3, target: new THREE.Vector3() });
  const tweenRef = useRef<number | null>(null);
  const generationRef = useRef(0);
  const layoutRef = useRef({ width: 0, height: 0 });
  const touchRef = useRef({ x: 0, y: 0, at: 0, moved: false });
  const mountedRef = useRef(true);
  const systemRef = useRef<AnatomySystemKey>(DEFAULT_STAGE_SYSTEM);
  systemRef.current = system;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (tweenRef.current !== null) {
        cancelAnimationFrame(tweenRef.current);
        tweenRef.current = null;
      }
      if (rootRef.current && sceneRef.current) {
        sceneRef.current.remove(rootRef.current);
        disposeObject(rootRef.current);
        rootRef.current = null;
      }
      registryRef.current.clear();
      try {
        rendererRef.current?.dispose();
        rendererRef.current?.forceContextLoss();
      } catch {
        // Best-effort context release on unmount.
      }
      rendererRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  const renderOnce = (): void => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const gl = glRef.current;
    if (!renderer || !scene || !camera || !gl) return;
    renderer.render(scene, camera);
    (gl as unknown as { endFrameEXP(): void }).endFrameEXP();
  };

  const clearHighlight = (): void => {
    const highlight = highlightRef.current;
    if (highlight) {
      highlight.mesh.material = highlight.original;
      highlightRef.current = null;
    }
  };

  const applySelection = (next: AnatomySelection | null): void => {
    setSelection(next);
    onSelectionChange?.(next);
  };

  const unloadCurrentSystem = (): void => {
    if (tweenRef.current !== null) {
      cancelAnimationFrame(tweenRef.current);
      tweenRef.current = null;
    }
    clearHighlight();
    if (rootRef.current && sceneRef.current) {
      sceneRef.current.remove(rootRef.current);
      disposeObject(rootRef.current);
      rootRef.current = null;
    }
    registryRef.current.clear();
    applySelection(null);
  };

  const loadSystem = async (next: AnatomySystemKey): Promise<void> => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return;
    const generation = (generationRef.current += 1);
    const alive = (): boolean => mountedRef.current && generation === generationRef.current;
    setStatus('loading');
    setError(null);
    setTimings(null);
    unloadCurrentSystem();
    try {
      const entry = findManifestEntry('male', next);
      if (!entry) throw new Error(`Unsupported system for this stage: ${next}`);
      const downloadStarted = Date.now();
      const bytes = await fetchVerifiedAsset(entry);
      if (!alive()) return;
      const downloadMs = Date.now() - downloadStarted;
      const decoded = await decodeModel(bytes.buffer as ArrayBuffer);
      if (!alive()) return;
      for (const record of collectSceneRecords(decoded.scene, next, 'male')) {
        registryRef.current.register(record);
      }
      rootRef.current = decoded.scene;
      scene.add(decoded.scene);

      const box = new THREE.Box3().setFromObject(decoded.scene);
      const center = box.getCenter(new THREE.Vector3());
      const radius = Math.max(0.15, box.getBoundingSphere(new THREE.Sphere()).radius);
      const orbit = orbitRef.current;
      orbit.target.copy(center);
      orbit.radius = radius * 2.2;
      orbit.theta = 0;
      orbit.phi = Math.PI / 2;
      camera.position.set(center.x, center.y, center.z + orbit.radius);
      camera.lookAt(center);

      renderOnce();
      if (!alive()) return;
      setTimings({
        downloadMs,
        decodeMs: decoded.decodeMs,
        firstVisibleMs: Date.now() - downloadStarted,
      });
      setStatus('ready');
    } catch (err) {
      if (!alive()) return;
      setError(err instanceof Error ? err.message : 'Failed to load the 3D model.');
      setStatus('error');
    }
  };

  const focusOn = (point: THREE.Vector3, radius: number): void => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!renderer || !camera) return;
    if (tweenRef.current !== null) {
      cancelAnimationFrame(tweenRef.current);
      tweenRef.current = null;
    }
    const orbit = orbitRef.current;
    const framing = frameSelection({
      center: { x: point.x, y: point.y, z: point.z },
      radius,
      fovDegrees: 50,
      cameraPosition: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      controlsTarget: { x: orbit.target.x, y: orbit.target.y, z: orbit.target.z },
    });
    const fromPos = camera.position.clone();
    const fromTarget = orbit.target.clone();
    const toPos = new THREE.Vector3(framing.position.x, framing.position.y, framing.position.z);
    const toTarget = point.clone();
    const started = Date.now();
    const durationMs = 300;
    const step = (): void => {
      if (!mountedRef.current) return;
      const t = Math.min(1, (Date.now() - started) / durationMs);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      camera.position.lerpVectors(fromPos, toPos, eased);
      orbit.target.lerpVectors(fromTarget, toTarget, eased);
      orbit.radius = camera.position.distanceTo(orbit.target);
      camera.lookAt(orbit.target);
      renderOnce();
      if (t < 1) {
        tweenRef.current = requestAnimationFrame(step);
      } else {
        tweenRef.current = null;
      }
    };
    tweenRef.current = requestAnimationFrame(step);
  };

  const handleTap = (x: number, y: number): void => {
    const root = rootRef.current;
    const camera = cameraRef.current;
    const { width, height } = layoutRef.current;
    if (!root || !camera || width <= 0 || height <= 0) return;
    const pointer = new THREE.Vector2((x / width) * 2 - 1, -(y / height) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(root, true).find(h => (h.object as THREE.Mesh).isMesh);
    clearHighlight();
    if (!hit) {
      applySelection(null);
      renderOnce();
      return;
    }
    const mesh = hit.object as THREE.Mesh;
    const next = resolveTapSelection(mesh, registryRef.current, systemRef.current, 'male');
    if (!next) {
      // Unmapped mesh: deselect safely, never crash.
      applySelection(null);
      renderOnce();
      return;
    }
    const material = mesh.material as THREE.Material;
    if (material && typeof material === 'object' && 'emissive' in material) {
      const tinted = (material as THREE.Material).clone() as THREE.Material & {
        emissive?: THREE.Color;
        emissiveIntensity?: number;
      };
      if (tinted.emissive) {
        tinted.emissive.set('#2dd4bf');
        tinted.emissiveIntensity = 0.6;
      }
      highlightRef.current = { mesh, original: mesh.material };
      mesh.material = tinted;
    }
    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(0.1, box.getBoundingSphere(new THREE.Sphere()).radius);
    applySelection(next);
    focusOn(center, radius);
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => rendererRef.current !== null && rootRef.current !== null,
      onMoveShouldSetPanResponder: () => rendererRef.current !== null && rootRef.current !== null,
      onPanResponderGrant: event => {
        if (tweenRef.current !== null) {
          cancelAnimationFrame(tweenRef.current);
          tweenRef.current = null;
        }
        touchRef.current = {
          x: event.nativeEvent.locationX,
          y: event.nativeEvent.locationY,
          at: Date.now(),
          moved: false,
        };
      },
      onPanResponderMove: (_event, gesture) => {
        const renderer = rendererRef.current;
        const camera = cameraRef.current;
        if (!renderer || !camera) return;
        const start = touchRef.current;
        if (Math.abs(gesture.dx) + Math.abs(gesture.dy) > 10) start.moved = true;
        const orbit = orbitRef.current;
        orbit.theta -= gesture.dx * 0.006;
        orbit.phi = Math.min(Math.PI - 0.15, Math.max(0.15, orbit.phi - gesture.dy * 0.006));
        camera.position.set(
          orbit.target.x + orbit.radius * Math.sin(orbit.phi) * Math.sin(orbit.theta),
          orbit.target.y + orbit.radius * Math.cos(orbit.phi),
          orbit.target.z + orbit.radius * Math.sin(orbit.phi) * Math.cos(orbit.theta)
        );
        camera.lookAt(orbit.target);
        renderOnce();
      },
      onPanResponderRelease: event => {
        const start = touchRef.current;
        const dt = Date.now() - start.at;
        if (!start.moved && dt < 500) {
          handleTap(event.nativeEvent.locationX, event.nativeEvent.locationY);
        }
      },
    })
  ).current;

  const init = (gl: ExpoWebGLRenderingContext): void => {
    if (rendererRef.current) return;
    glRef.current = gl;
    try {
      const candidate = (globalThis as Record<string, unknown>).WebGL2RenderingContext;
      const webgl2 =
        typeof candidate === 'function' && gl instanceof (candidate as new () => object);
      if (!webgl2) {
        setError('This device does not support WebGL2, which the 3D viewer requires.');
        setStatus('unsupported');
        return;
      }
      const buffer = gl as unknown as { drawingBufferWidth: number; drawingBufferHeight: number };
      const renderer = createStageRenderer(
        gl,
        buffer.drawingBufferWidth,
        buffer.drawingBufferHeight
      );
      if (!renderer.capabilities.isWebGL2) {
        renderer.dispose();
        setError('This device does not support WebGL2, which the 3D viewer requires.');
        setStatus('unsupported');
        return;
      }
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#0b1220');
      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.set(0, 1.2, 3.5);
      scene.add(new THREE.AmbientLight(0xffffff, 0.85));
      const key = new THREE.DirectionalLight(0xffffff, 1.2);
      key.position.set(2, 3, 4);
      scene.add(key);
      rendererRef.current = renderer;
      sceneRef.current = scene;
      cameraRef.current = camera;
      void loadSystem(systemRef.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start the 3D viewer.');
      setStatus(rendererRef.current ? 'error' : 'unsupported');
    }
  };

  const info = selection ? getAnatomyInformation(selection) : undefined;

  return (
    <View style={styles.root} testID="mobile-anatomy-stage">
      <View style={styles.picker} testID="mobile-stage-systems">
        {SUPPORTED_STAGE_SYSTEMS.map(entry => (
          <View key={entry.system} style={styles.pickerButton}>
            <Button
              title={entry.system}
              onPress={() => {
                if (entry.system !== systemRef.current && status !== 'loading') {
                  setSystem(entry.system);
                  void loadSystem(entry.system);
                }
              }}
              disabled={status === 'loading' || entry.system === system}
              testID={`mobile-stage-system-${entry.system}`}
            />
          </View>
        ))}
      </View>
      <Text style={styles.note}>Male model · more systems later</Text>
      <View
        style={styles.viewport}
        onLayout={event => {
          layoutRef.current = {
            width: event.nativeEvent.layout.width,
            height: event.nativeEvent.layout.height,
          };
        }}
        {...responder.panHandlers}
        testID="mobile-stage-viewport"
      >
        <GLView style={styles.gl} onContextCreate={gl => init(gl)} testID="mobile-stage-glview" />
        {status === 'loading' ? (
          <View style={styles.overlay} testID="mobile-stage-loading">
            <ActivityIndicator size="large" />
            <Text>Loading 3D anatomy…</Text>
          </View>
        ) : null}
        {status === 'error' || status === 'unsupported' ? (
          <View style={styles.overlay} testID="mobile-stage-error">
            <Text style={styles.error}>{error ?? '3D viewer unavailable.'}</Text>
            {status === 'error' ? (
              <Button
                title="Retry"
                onPress={() => void loadSystem(systemRef.current)}
                testID="mobile-stage-retry"
              />
            ) : null}
          </View>
        ) : null}
      </View>
      {timings ? (
        <Text style={styles.timings} testID="mobile-stage-timings">
          {`load ${(timings.downloadMs + timings.decodeMs).toFixed(0)}ms · first frame ${timings.firstVisibleMs.toFixed(0)}ms`}
        </Text>
      ) : null}
      {selection ? (
        <View style={styles.info} testID="mobile-stage-info">
          <Text style={styles.infoTitle}>{info?.canonicalName ?? selection.name}</Text>
          {info ? <Text>{info.description}</Text> : null}
          {info ? <Text style={styles.infoSource}>Source: {info.source}</Text> : null}
          <Button
            title="Deselect"
            onPress={() => {
              clearHighlight();
              applySelection(null);
              renderOnce();
            }}
            testID="mobile-stage-deselect"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pickerButton: { minWidth: 100 },
  note: { opacity: 0.6, fontSize: 12 },
  viewport: { height: 380, backgroundColor: '#0b1220', borderRadius: 8, overflow: 'hidden' },
  gl: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    gap: 8,
    padding: 16,
  },
  error: { color: '#b91c1c', textAlign: 'center' },
  timings: { opacity: 0.6, fontSize: 12 },
  info: { borderWidth: 1, borderColor: '#888', borderRadius: 8, padding: 12, gap: 6 },
  infoTitle: { fontSize: 18, fontWeight: '700' },
  infoSource: { opacity: 0.6, fontSize: 12 },
});
