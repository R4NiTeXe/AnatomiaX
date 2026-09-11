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
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three';
import {
  decodeSpikeAsset,
  disposeSpikeObject,
  fetchSpikeBytes,
  getMeshoptDecoder,
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

  const log = (line: string) => setLines(previous => [...previous, line]);

  const run = async (gl: ExpoWebGLRenderingContext) => {
    if (running.current) return;
    running.current = true;
    setStatus('running');
    const verdict: SpikeVerdictInput = {};
    const startedAll = Date.now();
    const ctx = asSpikeGL(gl);
    try {
      log(`GL buffer: ${ctx.drawingBufferWidth}x${ctx.drawingBufferHeight}`);
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
      const renderer = new THREE.WebGLRenderer({
        context: gl as unknown as WebGLRenderingContext,
        canvas: canvasStub as unknown as HTMLCanvasElement,
        antialias: true,
      });
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
      log(`Fetched ${fetched.byteLength} bytes via ${fetched.via}`);
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
      }
      verdict.rendered = true;
      log(`Rendered ${RENDER_FRAMES} frames in ${formatDuration(Date.now() - renderStarted)}`);

      scene.remove(decoded.scene);
      const disposed = disposeSpikeObject(decoded.scene);
      renderer.dispose();
      try {
        renderer.forceContextLoss();
      } catch {
        // Optional: context-loss path is best-effort on expo-gl.
      }
      verdict.disposed = true;
      log(
        `Disposed ${disposed.geometriesDisposed} geometries, ` +
          `${disposed.materialsDisposed} materials in ${formatDuration(Date.now() - startedAll)} total`
      );
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

  return (
    <View style={styles.root} testID="mobile-spike-screen">
      <Text style={styles.title}>Meshopt spike (temporary)</Text>
      <Text testID="mobile-spike-status">Status: {status}</Text>
      <GLView
        style={styles.gl}
        onContextCreate={gl => {
          void run(gl);
        }}
        testID="mobile-spike-glview"
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
