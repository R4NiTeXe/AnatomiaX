import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import {
  ActivityIndicator,
  Button,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as THREE from 'three';
import {
  AnatomyStructureRegistry,
  findManifestEntry,
  getAnatomyInformation,
  getRelatedAnatomyInformation,
} from '@anatomiax/anatomy-core';
import type { AnatomySelection, AnatomySystemKey } from '@anatomiax/shared-types';
import { fetchVerifiedAsset } from '../lib/assetCache';
import { decodeModel } from './meshoptLoader';
import { createFrameScheduler } from './frameScheduler';
import { createStageRenderer } from './glContext';
import { collectSceneRecords, resolveTapSelection } from './sceneRegistry';
import { createSlowNotice } from './slowNotice';
import { frameSelection } from './stageFraming';
import { StageLoadError, StageSystemManager } from './stageSystemManager';
import { DEFAULT_STAGE_SYSTEM, SUPPORTED_STAGE_SYSTEMS } from './supportedScope';

export type StageStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unsupported';

export interface StageTimings {
  downloadMs: number;
  decodeMs: number;
  firstVisibleMs: number;
  focusMs?: number;
}

interface MobileAnatomyStageProps {
  onSelectionChange?: (selection: AnatomySelection | null) => void;
  onSystemChange?: (system: AnatomySystemKey) => void;
  onStatusChange?: (status: StageStatus, system: AnatomySystemKey) => void;
}

interface Highlight {
  mesh: THREE.Mesh;
  original: THREE.Material | THREE.Material[];
}

/**
 * Production mobile anatomy stage (8.19.35/36): expo-gl + plain Three.js,
 * one resident male system (<=5MB), demand rendering, tap-to-select with
 * anatomy-core identity, core-math focus, native info UI.
 * Load orchestration (guards, disposal-before-load, stale protection) lives
 * in StageSystemManager; frame scheduling is single-slot; no R3F/Drei.
 */
export default function MobileAnatomyStage({
  onSelectionChange,
  onSystemChange,
  onStatusChange,
}: MobileAnatomyStageProps): JSX.Element {
  const [status, setStatus] = useState<StageStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [slowVisible, setSlowVisible] = useState(false);
  const [system, setSystem] = useState<AnatomySystemKey>(DEFAULT_STAGE_SYSTEM);
  const [selection, setSelection] = useState<AnatomySelection | null>(null);
  const [timings, setTimings] = useState<StageTimings | null>(null);

  const glRef = useRef<ExpoWebGLRenderingContext | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orbitRef = useRef({ theta: 0, phi: Math.PI / 2, radius: 3, target: new THREE.Vector3() });
  const layoutRef = useRef({ width: 0, height: 0 });
  const touchRef = useRef({ x: 0, y: 0, at: 0, moved: false });
  const mountedRef = useRef(true);
  const systemRef = useRef<AnatomySystemKey>(DEFAULT_STAGE_SYSTEM);
  systemRef.current = system;

  const managerRef = useRef<StageSystemManager | null>(null);
  if (!managerRef.current) {
    managerRef.current = new StageSystemManager({
      fetchAsset: async entry => {
        const started = Date.now();
        const bytes = await fetchVerifiedAsset(entry);
        return { bytes, downloadMs: Date.now() - started };
      },
      decodeAsset: async bytes => decodeModel(bytes),
      collectRecords: (scene, systemKey, bodyModel) =>
        collectSceneRecords(scene, systemKey, bodyModel),
      registry: new AnatomyStructureRegistry(),
      now: () => Date.now(),
    });
  }
  const schedulerRef = useRef(
    createFrameScheduler(
      callback => requestAnimationFrame(callback),
      handle => cancelAnimationFrame(handle)
    )
  );
  const slowRef = useRef(createSlowNotice(() => setSlowVisible(true)));
  const highlightRef = useRef<Highlight | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      schedulerRef.current.cancel();
      slowRef.current.settle();
      const manager = managerRef.current;
      const scene = sceneRef.current;
      if (manager && scene) {
        manager.unload({ attach: () => undefined, detach: root => scene.remove(root) });
      }
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

  const notifyStatus = (next: StageStatus, nextSystem: AnatomySystemKey): void => {
    onStatusChange?.(next, nextSystem);
  };

  const loadSystem = async (next: AnatomySystemKey): Promise<void> => {
    const manager = managerRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!manager || !scene || !camera) return;
    setStatus('loading');
    notifyStatus('loading', next);
    setError(null);
    setSlowVisible(false);
    setTimings(null);
    slowRef.current.start();
    clearHighlight();
    applySelection(null);
    try {
      const entry = findManifestEntry('male', next);
      if (!entry) throw new Error(`Unsupported system for this stage: ${next}`);
      const loadStarted = Date.now();
      const { downloadMs, decodeMs } = await manager.load(entry, {
        attach: root => scene.add(root),
        // Detach only: the manager disposes the previous root itself.
        detach: root => scene.remove(root),
      });
      if (!mountedRef.current) return;
      // NOTE: manager already disposed + detached the previous root above.
      const root = manager.resident?.root;
      if (!root) throw new Error('Loaded system has no scene.');
      const box = new THREE.Box3().setFromObject(root);
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
      if (!mountedRef.current) return;
      setTimings({
        downloadMs,
        decodeMs,
        firstVisibleMs: Date.now() - loadStarted,
      });
      setStatus('ready');
      notifyStatus('ready', next);
    } catch (err) {
      // Superseded loads stay silent: the newer load owns the UI.
      if (err instanceof StageLoadError && err.code === 'STALE') return;
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load the 3D model.');
      setStatus('error');
      notifyStatus('error', next);
    } finally {
      slowRef.current.settle();
    }
  };

  const focusOn = (point: THREE.Vector3, radius: number): void => {
    const camera = cameraRef.current;
    if (!camera) return;
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
    const scheduler = schedulerRef.current;
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
        scheduler.schedule(step);
      } else {
        setTimings(previous =>
          previous ? { ...previous, focusMs: Date.now() - started } : previous
        );
      }
    };
    scheduler.schedule(step);
  };

  const handleTap = (x: number, y: number): void => {
    const manager = managerRef.current;
    const camera = cameraRef.current;
    const { width, height } = layoutRef.current;
    if (!manager || !camera || width <= 0 || height <= 0) return;
    const root = manager.resident?.root;
    if (!root) return;
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
    const next = resolveTapSelection(mesh, manager.registry, systemRef.current, 'male');
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
      onStartShouldSetPanResponder: () =>
        rendererRef.current !== null && managerRef.current?.resident !== null,
      onMoveShouldSetPanResponder: () =>
        rendererRef.current !== null && managerRef.current?.resident !== null,
      onPanResponderGrant: event => {
        schedulerRef.current.cancel();
        touchRef.current = {
          x: event.nativeEvent.locationX,
          y: event.nativeEvent.locationY,
          at: Date.now(),
          moved: false,
        };
      },
      onPanResponderMove: (_event, gesture) => {
        const camera = cameraRef.current;
        if (!camera) return;
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
        notifyStatus('unsupported', systemRef.current);
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
        notifyStatus('unsupported', systemRef.current);
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
      const next: StageStatus = rendererRef.current ? 'error' : 'unsupported';
      setStatus(next);
      notifyStatus(next, systemRef.current);
    }
  };

  const info = selection ? getAnatomyInformation(selection) : undefined;
  const related = selection ? getRelatedAnatomyInformation(selection.structureKey) : [];
  const isLoading = status === 'loading';

  return (
    <View style={styles.root} testID="mobile-anatomy-stage">
      <View style={styles.pickerHeader}>
        <Text style={styles.pickerLabel}>System</Text>
        <Text style={styles.pickerHint} testID="mobile-stage-picker-hint">
          {isLoading ? `Loading ${system}…` : `Active: ${system}`}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pickerScrollContent}
        style={styles.pickerScroll}
        testID="mobile-stage-systems"
      >
        {SUPPORTED_STAGE_SYSTEMS.map(entry => {
          const active = entry.system === system;
          const disabled = isLoading || active;
          return (
            <Pressable
              key={entry.system}
              onPress={() => {
                if (!disabled && entry.system !== systemRef.current) {
                  setSystem(entry.system);
                  onSystemChange?.(entry.system);
                  void loadSystem(entry.system);
                }
              }}
              disabled={disabled}
              testID={`mobile-stage-system-${entry.system}`}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                disabled && !active && styles.chipDisabled,
                pressed && !disabled && styles.chipPressed,
              ]}
              accessibilityState={{ selected: active, disabled }}
              accessibilityLabel={`${entry.system}${active ? ' active' : ''}${isLoading ? ' loading' : ''}`}
            >
              <Text
                style={[
                  styles.chipText,
                  active && styles.chipTextActive,
                  disabled && !active && styles.chipTextDisabled,
                ]}
                numberOfLines={1}
              >
                {entry.system}
              </Text>
              {active && isLoading ? <ActivityIndicator size="small" color="#0f172a" /> : null}
              {active && !isLoading ? <View style={styles.chipDot} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
      <Text style={styles.note}>Male model · tap a structure to focus · more systems later</Text>
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
            <Text style={styles.overlayTitle} testID="mobile-stage-loading-system">
              Loading {system}…
            </Text>
            <Text style={styles.note}>Preparing 3D anatomy</Text>
            {slowVisible ? (
              <Text style={styles.note} testID="mobile-stage-slow">
                Still loading — large asset or slow connection…
              </Text>
            ) : null}
          </View>
        ) : null}
        {status === 'error' || status === 'unsupported' ? (
          <View style={styles.overlay} testID="mobile-stage-error">
            <Text style={styles.error} testID="mobile-stage-error-message">
              {error ?? '3D viewer unavailable.'}
            </Text>
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
          {`load ${(timings.downloadMs + timings.decodeMs).toFixed(0)}ms · first frame ${timings.firstVisibleMs.toFixed(0)}ms${timings.focusMs !== undefined ? ` · focus ${timings.focusMs.toFixed(0)}ms` : ''}`}
        </Text>
      ) : null}
      {selection ? (
        <View style={styles.info} testID="mobile-stage-info">
          <Text style={styles.infoTitle} testID="mobile-stage-info-name">
            {info?.canonicalName ?? selection.name}
          </Text>
          <Text style={styles.infoMeta} testID="mobile-stage-info-meta">
            {selection.systemKey} · {selection.bodyModel}
            {selection.ontologyId ? ` · ${selection.ontologyId}` : ''}
          </Text>
          {info ? (
            <>
              <Text style={styles.infoDescription} testID="mobile-stage-info-description">
                {info.description}
              </Text>
              <Text style={styles.infoFunction} testID="mobile-stage-info-function">
                {info.function}
              </Text>
              <View style={styles.provenance} testID="mobile-stage-provenance">
                <Text style={styles.provenanceLabel}>Source</Text>
                <Text style={styles.provenanceText} testID="mobile-stage-source">
                  {info.source}
                </Text>
                <Text style={styles.provenanceUrl} testID="mobile-stage-source-url">
                  {info.sourceUrl}
                </Text>
                <Text style={styles.provenanceText} testID="mobile-stage-last-verified">
                  Last verified: {info.lastVerified}
                </Text>
                {info.license ? (
                  <Text style={styles.provenanceText} testID="mobile-stage-license">
                    License: {info.license}
                  </Text>
                ) : null}
              </View>
              {related.length > 0 ? (
                <View style={styles.relations} testID="mobile-stage-relationships">
                  <Text style={styles.relationsTitle}>Relationships</Text>
                  {related.map(r => (
                    <View
                      key={r.info.structureKey}
                      style={styles.relationRow}
                      testID="mobile-stage-relation-item"
                    >
                      <Text style={styles.relationKind}>{r.relation.replace('_', ' ')}</Text>
                      <Text style={styles.relationName}>{r.info.canonicalName}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <Text style={styles.note} testID="mobile-stage-info-unavailable">
              Verified information unavailable for this structure.
            </Text>
          )}
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
      ) : (
        <View style={styles.empty} testID="mobile-stage-empty">
          <Text style={styles.emptyTitle}>No structure selected</Text>
          <Text style={styles.emptyText}>
            Tap any highlighted structure in the 3D view to see details.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    opacity: 0.6,
  },
  pickerHint: { fontSize: 12, opacity: 0.7 },
  pickerScroll: { flexGrow: 0 },
  pickerScrollContent: { gap: 8, paddingVertical: 4, paddingRight: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    minWidth: 72,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  chipDisabled: { opacity: 0.5 },
  chipPressed: { opacity: 0.8 },
  chipText: { fontSize: 13, fontWeight: '600', color: '#334155', textTransform: 'capitalize' },
  chipTextActive: { color: '#ffffff' },
  chipTextDisabled: { color: '#94a3b8' },
  chipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2dd4bf' },
  note: { opacity: 0.6, fontSize: 12 },
  viewport: { height: 400, backgroundColor: '#0b1220', borderRadius: 12, overflow: 'hidden' },
  gl: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    gap: 8,
    padding: 16,
  },
  overlayTitle: { fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },
  error: { color: '#b91c1c', textAlign: 'center', fontWeight: '600' },
  timings: { opacity: 0.6, fontSize: 11 },
  info: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    gap: 8,
    backgroundColor: '#ffffff',
  },
  infoTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  infoMeta: { fontSize: 11, opacity: 0.6, textTransform: 'capitalize' },
  infoDescription: { fontSize: 14, lineHeight: 20, color: '#334155' },
  infoFunction: { fontSize: 13, lineHeight: 18, color: '#475569', fontStyle: 'italic' },
  provenance: { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 8, gap: 2 },
  provenanceLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    opacity: 0.5,
  },
  provenanceText: { fontSize: 11, opacity: 0.7 },
  provenanceUrl: { fontSize: 11, color: '#0ea5e9' },
  relations: { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 8, gap: 6 },
  relationsTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    opacity: 0.5,
  },
  relationRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  relationKind: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
    color: '#64748b',
    minWidth: 70,
  },
  relationName: { fontSize: 13, fontWeight: '500', color: '#0f172a', flex: 1 },
  empty: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    gap: 6,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: '#334155' },
  emptyText: { fontSize: 12, opacity: 0.6, textAlign: 'center' },
});
