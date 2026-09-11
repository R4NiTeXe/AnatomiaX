/**
 * TEMPORARY SPIKE (8.19.29) — GO/NO-GO verdict bookkeeping only.
 * No three.js, no React Native, no expo imports: fully unit-testable.
 * Delete this whole `spike/` directory after the architecture decision.
 */

export type SpikeGate = 'GO' | 'NO-GO' | 'INCOMPLETE';

export interface SpikeVerdictInput {
  /** expo-gl context is WebGL2-capable. */
  webgl2?: boolean;
  /** THREE.WebGLRenderer constructed against the expo-gl context. */
  rendererCreated?: boolean;
  /** Meshopt GLB decoded to a non-empty scene. */
  decoded?: boolean;
  /** At least one frame presented via endFrameEXP. */
  rendered?: boolean;
  /** Geometry/materials disposed and context released without errors. */
  disposed?: boolean;
  /** Any fatal, architecture-invalidating failure message. */
  fatal?: string;
}

export interface SpikeVerdict {
  gate: SpikeGate;
  reasons: string[];
}

const GATES: Array<{ key: keyof SpikeVerdictInput; label: string }> = [
  { key: 'webgl2', label: 'WebGL2 context works' },
  { key: 'rendererCreated', label: 'Three.js renderer initializes' },
  { key: 'decoded', label: 'Meshopt GLB decodes' },
  { key: 'rendered', label: 'Asset renders' },
  { key: 'disposed', label: 'Asset disposal succeeds' },
];

export function evaluateSpike(input: SpikeVerdictInput): SpikeVerdict {
  if (input.fatal) {
    return { gate: 'NO-GO', reasons: [`fatal: ${input.fatal}`] };
  }
  const failed = GATES.filter(g => input[g.key] === false).map(g => g.label);
  if (failed.length > 0) {
    return { gate: 'NO-GO', reasons: failed.map(label => `failed: ${label}`) };
  }
  const pending = GATES.filter(g => input[g.key] !== true).map(g => g.label);
  if (pending.length > 0) {
    return { gate: 'INCOMPLETE', reasons: pending.map(label => `pending: ${label}`) };
  }
  return { gate: 'GO', reasons: GATES.map(g => `passed: ${g.label}`) };
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return 'n/a';
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;
}
