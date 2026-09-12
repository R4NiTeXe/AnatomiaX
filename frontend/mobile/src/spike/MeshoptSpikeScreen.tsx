/**
 * TEMPORARY SPIKE SCREEN (8.19.29) — proves expo-gl WebGL2 + three 0.185 +
 * three-stdlib Meshopt decode + render + dispose on a real device.
 *
 * Run: 1) serve web dev assets (`npm run dev -w @anatomiax/web`),
 *      2) EXPO_PUBLIC_SPIKE=meshopt npx expo start, 3) open on the target
 *      device and read the on-screen verdict.
 * Asset URL override: EXPO_PUBLIC_SPIKE_ASSET_URL (default below targets the
 * Android emulator loopback; physical devices need the LAN IP instead).
 * Delete this whole `spike/` directory after the architecture decision.
 */
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useRef, useState } from 'react';
import type { JSX } from 'react';
import { Button, PanResponder, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three';
import {
  decodeSpikeAsset,
  disposeSpikeObject,
  fetchSpikeBytes,
  getMeshoptDecoder,
  withHiddenWebGL1Global,
} from './runMeshoptSpike';
import { evaluateSpike, formatDuration, type SpikeVerdictInput } from './spikeReport';

const DEFAULT_ASSET_URL = 'http://10.0.2.2:5173/models-dev/skin-meshopt.glb';
const RENDER_FRAMES = 5;

function assetUrl(): string {
  const fromEnv =
    typeof process !== 'undefined'
      ? (process.env as Record<string, string | undefined>).EXPO_PUBLIC_SPIKE_ASSET_URL
      : undefined;
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_ASSET_URL;
}

type SpikeStatus = 'idle' | 'running' | 'done' | 'unsupported' | 'error';

/** Structural view of the expo-gl context (its public type is narrower). */
interface SpikeGLContext {
  drawingBufferWidth: number;
  drawingBufferHeight: number;
  endFrameEXP(): void;
}

function asSpikeGL(gl: ExpoWebGLRenderingContext): SpikeGLContext {
  return gl as unknown as SpikeGLContext;
}

function isWebGL2Context(gl: ExpoWebGLRenderingContext): boolean {
  const candidate = (globalThis as Record<string, unknown>).WebGL2RenderingContext;
  return typeof candidate === 'function' && gl instanceof (candidate as new () => object);
}

export default function MeshoptSpikeScreen(): JSX.Element {
  const [status, setStatus] = useState<SpikeStatus>('idle');
  const [lines, setLines] = useState<string[]>([
    'Meshopt spike mounted. Waiting for GL context…',
    `Asset: ${assetUrl()}`,
  ]);
  const running = useRef(false);
  const disposable = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Object3D;
    verdict: SpikeVerdictInput;
    startedAll: number;
  } | null>(null);
  const [disposed, setDisposed] = useState(false);
  // TEMPORARY spike-only orbit rig (drag to orbit after render; not production).
  const orbit = useRef<{
    renderer: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
    scene: THREE.Scene;
    endFrame: () => void;
    target: THREE.Vector3;
    radius: number;
    theta: number;
    phi: number;
    frames: number;
    firstDragAt: number | null;
    firstMoveAt: number | null;
  } | null>(null);

  const log = (line: string) => setLines(previous => [...previous, line]);

  const orbitResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => orbit.current !== null,
      onMoveShouldSetPanResponder: () => orbit.current !== null,
      onPanResponderMove: (_event, gesture) => {
        const rig = orbit.current;
        if (!rig) return;
        if (rig.firstDragAt === null) {
          rig.firstDragAt = Date.now();
          rig.firstMoveAt = Date.now();
          setLines(previous => [...previous, 'Orbit: first drag received']);
        }
        rig.theta -= gesture.dx * 0.006;
        rig.phi = Math.min(Math.PI - 0.15, Math.max(0.15, rig.phi - gesture.dy * 0.006));
        rig.camera.position.set(
          rig.target.x + rig.radius * Math.sin(rig.phi) * Math.sin(rig.theta),
          rig.target.y + rig.radius * Math.cos(rig.phi),
          rig.target.z + rig.radius * Math.sin(rig.phi) * Math.cos(rig.theta)
        );
        rig.camera.lookAt(rig.target);
        rig.renderer.render(rig.scene, rig.camera);
        rig.endFrame();
        rig.frames += 1;
      },
      onPanResponderRelease: () => {
        const rig = orbit.current;
        if (rig && rig.firstDragAt !== null) {
          const elapsedSec = Math.max(0.001, (Date.now() - (rig.firstMoveAt ?? Date.now())) / 1000);
          const fps = (rig.frames / elapsedSec).toFixed(1);
          setLines(previous => [
            ...previous,
            `Orbit: ${rig.frames} drag frames in ${elapsedSec.toFixed(2)}s (${fps} fps)`,
          ]);
          rig.firstDragAt = null;
          rig.firstMoveAt = null;
          rig.frames = 0;
        }
      },
    })
  ).current;

  const run = async (gl: ExpoWebGLRenderingContext) => {
    if (running.current) return;
    running.current = true;
    setStatus('running');
    const verdict: SpikeVerdictInput = {};
    const startedAll = Date.now();
    const ctx = asSpikeGL(gl);
    try {
      log(`GL buffer: ${ctx.drawingBufferWidth}x${ctx.drawingBufferHeight}`);
      try {
        // Structural cast: lib WebGL types here are capability-thin.
        const raw = gl as unknown as {
          getExtension(name: string): { UNMASKED_RENDERER_WEBGL: number } | null;
          getParameter(p: number): unknown;
          RENDERER: number;
          VERSION: number;
        };
        const debugInfo = raw.getExtension('WEBGL_debug_renderer_info');
        const rendererName = debugInfo
          ? raw.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
          : raw.getParameter(raw.RENDERER);
        log(`GPU: ${String(rendererName)} | ${String(raw.getParameter(raw.VERSION))}`);
      } catch {
        log('GPU: unavailable (parameter query failed)');
      }
      verdict.webgl2 = isWebGL2Context(gl);
      log(`WebGL2 context: ${verdict.webgl2 ? 'YES' : 'NO'}`);

      // Minimal canvas stub — three only needs size + listener hooks here.
      const canvasStub = {
        width: ctx.drawingBufferWidth,
        height: ctx.drawingBufferHeight,
        style: {},
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        getContext: () => gl,
      };
      // SPIKE FINDING (emulator run 1): expo-gl's context is instanceof BOTH
      // WebGLRenderingContext and WebGL2RenderingContext shims, so three
      // r163+ throws "WebGL 1 is not supported" for any custom context.
      // Hiding the v1 global during construction lets the WebGL2 path through
      // (three hardcodes capabilities.isWebGL2=true afterwards).
      const host = globalThis as Record<string, unknown>;
      const realV1 = host.WebGLRenderingContext;
      log(`V1 global before hide: ${typeof realV1}`);
      const renderer = withHiddenWebGL1Global(
        () =>
          new THREE.WebGLRenderer({
            context: gl as unknown as WebGLRenderingContext,
            canvas: canvasStub as unknown as HTMLCanvasElement,
            antialias: true,
          })
      );
      log(`V1 global after restore: ${typeof realV1 === 'undefined' ? 'was-absent' : 'restored'}`);
      verdict.rendererCreated = true;
      log(
        `Renderer created (three r${THREE.REVISION}, isWebGL2=${renderer.capabilities.isWebGL2})`
      );
      if (!renderer.capabilities.isWebGL2) {
        verdict.webgl2 = false;
        renderer.dispose();
        setStatus('unsupported');
        log('NO-GO: three reports no WebGL2 — stopping without crashing.');
        return;
      }

      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#0b1220');
      const camera = new THREE.PerspectiveCamera(
        50,
        ctx.drawingBufferWidth / Math.max(1, ctx.drawingBufferHeight),
        0.1,
        100
      );
      scene.add(new THREE.AmbientLight(0xffffff, 0.85));
      const key = new THREE.DirectionalLight(0xffffff, 1.2);
      key.position.set(2, 3, 4);
      scene.add(key);

      const url = assetUrl();
      log(`Fetching ${url}`);
      const fetched = await fetchSpikeBytes(url);
      log(
        `Downloaded ${fetched.byteLength} bytes via ${fetched.via} in ${formatDuration(fetched.ms)}`
      );
      const decoderStatus = await getMeshoptDecoder();
      log(
        `Decoder: supported=${decoderStatus.supported} via=${decoderStatus.via} ` +
          `WebAssembly=${decoderStatus.hasWebAssembly ? 'yes' : 'no'}`
      );
      log('Decoding (Meshopt explicitly configured)…');
      const decoded = await decodeSpikeAsset(fetched.bytes);
      verdict.decoded = decoded.stats.meshCount > 0 && decoded.stats.triangleCount > 0;
      log(
        `Decoded via ${decoded.via} in ${formatDuration(decoded.decodeMs)}: ` +
          `${decoded.stats.meshCount} meshes, ${decoded.stats.geometryCount} geometries, ` +
          `${decoded.stats.triangleCount} triangles`
      );
      if (!verdict.decoded) {
        throw new Error('decoded scene is empty');
      }
      scene.add(decoded.scene);

      const box = new THREE.Box3().setFromObject(decoded.scene);
      const center = box.getCenter(new THREE.Vector3());
      const radius = Math.max(0.15, box.getBoundingSphere(new THREE.Sphere()).radius);
      camera.position.set(center.x, center.y, center.z + radius * 2.2);
      camera.lookAt(center);

      const renderStarted = Date.now();
      for (let frame = 0; frame < RENDER_FRAMES; frame += 1) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        renderer.render(scene, camera);
        ctx.endFrameEXP();
        if (frame === 0) {
          log(`First visible frame at ${formatDuration(Date.now() - startedAll)} after start`);
        }
      }
      verdict.rendered = true;
      log(`Rendered ${RENDER_FRAMES} frames in ${formatDuration(Date.now() - renderStarted)}`);
      log(
        `Renderer info: calls=${renderer.info.render.calls} ` +
          `triangles=${renderer.info.render.triangles} ` +
          `geometries=${renderer.info.memory.geometries} textures=${renderer.info.memory.textures}`
      );
      // Arm the temporary drag-orbit rig for the interaction check.
      orbit.current = {
        renderer,
        camera,
        scene,
        endFrame: () => ctx.endFrameEXP(),
        target: center.clone(),
        radius: radius * 2.2,
        theta: 0,
        phi: Math.PI / 2,
        frames: 0,
        firstDragAt: null,
        firstMoveAt: null,
      };
      log('Drag on the model to test orbit responsiveness, then tap Dispose.');

      // Disposal is operator-triggered so orbit runs against the live model.
      disposable.current = { renderer, scene: decoded.scene, verdict, startedAll };
      setStatus('done');
    } catch (error) {
      verdict.fatal = error instanceof Error ? error.message : String(error);
      setStatus('error');
      log(`FATAL: ${verdict.fatal}`);
    } finally {
      const result = evaluateSpike(verdict);
      log(`VERDICT: ${result.gate} — ${result.reasons.join('; ')}`);
      running.current = false;
    }
  };

  const dispose = () => {
    const target = disposable.current;
    if (!target || disposed) return;
    const counts = disposeSpikeObject(target.scene);
    target.renderer.dispose();
    try {
      target.renderer.forceContextLoss();
    } catch {
      // Optional: context-loss path is best-effort on expo-gl.
    }
    target.verdict.disposed = true;
    disposable.current = null;
    orbit.current = null;
    setDisposed(true);
    setLines(previous => [
      ...previous,
      `Disposed ${counts.geometriesDisposed} geometries, ` +
        `${counts.materialsDisposed} materials in ` +
        `${formatDuration(Date.now() - target.startedAll)} total`,
      `Renderer info after dispose: geometries=${target.renderer.info.memory.geometries} ` +
        `textures=${target.renderer.info.memory.textures}`,
      `VERDICT: ${evaluateSpike(target.verdict).gate} — ` +
        `${evaluateSpike(target.verdict).reasons.join('; ')}`,
    ]);
  };

  return (
    <View style={styles.root} testID="mobile-spike-screen">
      <Text style={styles.title}>Meshopt spike (temporary)</Text>
      <Text testID="mobile-spike-status">Status: {status}</Text>
      <View {...orbitResponder.panHandlers} testID="mobile-spike-orbit">
        <GLView
          style={styles.gl}
          onContextCreate={gl => {
            void run(gl);
          }}
          testID="mobile-spike-glview"
        />
      </View>
      <Button
        title="Dispose asset"
        onPress={dispose}
        disabled={disposed}
        testID="mobile-spike-dispose"
      />
      <ScrollView style={styles.log} testID="mobile-spike-log">
        {lines.map((line, index) => (
          <Text key={`${index}-${line.slice(0, 16)}`} style={styles.line}>
            {line}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  gl: { height: 240, backgroundColor: '#0b1220' },
  log: { flex: 1, borderWidth: 1, borderColor: '#888', borderRadius: 8, padding: 8 },
  line: { fontSize: 12, fontFamily: 'monospace' },
});
