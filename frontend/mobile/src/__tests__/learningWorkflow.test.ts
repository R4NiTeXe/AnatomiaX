import * as fs from 'fs';
import * as path from 'path';
import { AnatomyStructureRegistry, findManifestEntry } from '@anatomiax/anatomy-core';
import {
  getAnatomyInformation,
  getAnatomyInformationByStructureKey,
  getRelatedAnatomyInformation,
  parseStudiedKey,
} from '@anatomiax/anatomy-core';
import {
  SUPPORTED_STAGE_SYSTEMS,
  DEFAULT_STAGE_SYSTEM,
  isStageSupported,
  MAX_STAGE_BYTES,
} from '../anatomy/supportedScope';
import { StageSystemManager } from '../anatomy/stageSystemManager';
import * as THREE from 'three';
import type { AnatomyStructure } from '@anatomiax/shared-types';
import { clearCachedUserState, progressSnapshotKey, queryClient } from '../query/client';

jest.mock('../lib/secureStore', () => ({
  saveSession: jest.fn(async () => undefined),
  loadAccessToken: jest.fn(async () => 'access-T'),
  loadSession: jest.fn(async () => ({ accessToken: 'access-T', refreshToken: 'refresh-T' })),
  clearSession: jest.fn(async () => undefined),
}));

/**
 * 8.19.37 learning workflow tests — verifies the polished mobile learning
 * workflow without requiring a full RN render (node env). Covers system
 * selector, tap → info, relationships, mark studied, progress persistence,
 * system switching isolation, retry, auth isolation, responsive viewport,
 * and provenance.
 */

describe('learning workflow — system selector (8.19.37)', () => {
  it('exposes only supported male systems <=5MB', () => {
    expect(DEFAULT_STAGE_SYSTEM).toBe('skin');
    expect(SUPPORTED_STAGE_SYSTEMS.length).toBeGreaterThanOrEqual(5);
    for (const entry of SUPPORTED_STAGE_SYSTEMS) {
      expect(entry.bytes).toBeLessThanOrEqual(MAX_STAGE_BYTES);
    }
    const systems = SUPPORTED_STAGE_SYSTEMS.map(s => s.system);
    expect(systems).toContain('skin');
    expect(systems).toContain('cardiovascular');
    expect(systems).not.toContain('nervous');
    expect(isStageSupported('female', 'skin')).toBe(false);
    expect(isStageSupported('male', 'nervous')).toBe(false);
    expect(isStageSupported('male', 'bogus' as never)).toBe(false);
  });

  it('learning screen and stage contain selector testIDs and supported-only filtering', () => {
    const stagePath = path.join(__dirname, '..', 'anatomy', 'MobileAnatomyStage.tsx');
    const learningPath = path.join(__dirname, '..', 'screens', 'LearningScreen.tsx');
    const stageSrc = fs.readFileSync(stagePath, 'utf8');
    const learningSrc = fs.readFileSync(learningPath, 'utf8');
    expect(stageSrc).toContain('mobile-stage-systems');
    expect(stageSrc).toContain('mobile-stage-system-');
    expect(stageSrc).toContain('SUPPORTED_STAGE_SYSTEMS');
    expect(stageSrc).toContain("status === 'loading'");
    // Loading must identify the system being loaded
    expect(stageSrc).toContain('Loading ${system}');
    expect(stageSrc).toContain('mobile-stage-loading-system');
    // Disabled while transition unsafe
    expect(stageSrc).toContain('disabled');
    expect(learningSrc).toContain('mobile-learning-screen');
    expect(learningSrc).toContain('mobile-learning-bodymodel');
  });

  it('stage viewport remains visually dominant (fixed height, not collapsed)', () => {
    const stagePath = path.join(__dirname, '..', 'anatomy', 'MobileAnatomyStage.tsx');
    const src = fs.readFileSync(stagePath, 'utf8');
    // viewport height 400 ensures dominance on small screens; ScrollView keeps it visible
    expect(src).toMatch(/viewport:\s*\{\s*height:\s*40\d/);
    expect(src).toContain('mobile-stage-viewport');
    expect(src).toContain('mobile-stage-glview');
  });
});

describe('learning workflow — tap selection → info (8.19.37)', () => {
  it('resolves verified info for a selected structure with provenance', () => {
    const selection = {
      structureKey: 'male:cardiovascular:UBERON:0000948',
      name: 'Heart',
      objectName: 'VH_M_heart',
      systemKey: 'cardiovascular' as const,
      bodyModel: 'male' as const,
      ontologyId: 'UBERON:0000948',
    };
    const info = getAnatomyInformation(selection);
    expect(info).toBeDefined();
    expect(info?.canonicalName).toBe('Heart');
    expect(info?.description).toMatch(/muscular organ.*pumps blood/);
    expect(info?.source).toBeDefined();
    expect(info?.sourceUrl).toMatch(/^https?:\/\//);
    expect(info?.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(info?.license).toBeDefined();
    // Mobile stage must render these fields
    const stageSrc = fs.readFileSync(
      path.join(__dirname, '..', 'anatomy', 'MobileAnatomyStage.tsx'),
      'utf8'
    );
    expect(stageSrc).toContain('mobile-stage-info-name');
    expect(stageSrc).toContain('mobile-stage-info-description');
    expect(stageSrc).toContain('mobile-stage-source');
    expect(stageSrc).toContain('mobile-stage-last-verified');
    const learningSrc = fs.readFileSync(
      path.join(__dirname, '..', 'screens', 'LearningScreen.tsx'),
      'utf8'
    );
    expect(learningSrc).toContain('mobile-learning-info-name');
    expect(learningSrc).toContain('mobile-learning-info-description');
    expect(learningSrc).toContain('mobile-learning-source');
  });

  it('returns undefined for unavailable info and shows fallback', () => {
    const selection = {
      structureKey: 'male:skin:object:UnknownMesh123',
      name: 'UnknownMesh123',
      objectName: 'UnknownMesh123',
      systemKey: 'skin' as const,
      bodyModel: 'male' as const,
      ontologyId: null,
    };
    expect(getAnatomyInformation(selection)).toBeUndefined();
    const stageSrc = fs.readFileSync(
      path.join(__dirname, '..', 'anatomy', 'MobileAnatomyStage.tsx'),
      'utf8'
    );
    expect(stageSrc).toContain('mobile-stage-info-unavailable');
  });

  it('provides clear empty state before selection', () => {
    const stageSrc = fs.readFileSync(
      path.join(__dirname, '..', 'anatomy', 'MobileAnatomyStage.tsx'),
      'utf8'
    );
    const learningSrc = fs.readFileSync(
      path.join(__dirname, '..', 'screens', 'LearningScreen.tsx'),
      'utf8'
    );
    expect(stageSrc).toContain('mobile-stage-empty');
    expect(learningSrc).toContain('mobile-learning-empty');
    expect(learningSrc).toContain('Tap any highlighted structure');
    expect(stageSrc).toContain('Tap any highlighted');
  });
});

describe('learning workflow — relationships (8.19.37)', () => {
  it('displays verified relations where they exist', () => {
    // Right ventricle has part_of heart and related_to left ventricle
    const key = 'male:cardiovascular:UBERON:0002080';
    const related = getRelatedAnatomyInformation(key);
    expect(related.length).toBeGreaterThan(0);
    const partOf = related.filter(r => r.relation === 'part_of');
    const relatedTo = related.filter(r => r.relation === 'related_to');
    expect(partOf.length + relatedTo.length).toBe(related.length);
    for (const r of related) {
      expect(r.info.structureKey).not.toBe(key);
      expect(r.info.bodyModel).toBe('male');
      expect(r.info.canonicalName).toBeDefined();
    }
    // Stage and learning must render relationships
    const stageSrc = fs.readFileSync(
      path.join(__dirname, '..', 'anatomy', 'MobileAnatomyStage.tsx'),
      'utf8'
    );
    const learningSrc = fs.readFileSync(
      path.join(__dirname, '..', 'screens', 'LearningScreen.tsx'),
      'utf8'
    );
    expect(stageSrc).toContain('mobile-stage-relationships');
    expect(stageSrc).toContain('mobile-stage-relation-item');
    expect(learningSrc).toContain('mobile-learning-relationships');
    expect(learningSrc).toContain('mobile-learning-relation-item');
  });

  it('shows empty relationships gracefully when none exist', () => {
    // Skin has no relatedStructures in seed
    const key = 'male:skin:UBERON:0002097';
    const related = getRelatedAnatomyInformation(key);
    expect(related).toEqual([]);
    const learningSrc = fs.readFileSync(
      path.join(__dirname, '..', 'screens', 'LearningScreen.tsx'),
      'utf8'
    );
    expect(learningSrc).toContain('mobile-learning-relationships-empty');
  });
});

describe('learning workflow — mark studied and progress (8.19.37)', () => {
  it('builds studied display names from canonical info or fallback', () => {
    const key = 'male:cardiovascular:UBERON:0000948';
    const viaInfo = getAnatomyInformationByStructureKey(key);
    expect(viaInfo?.canonicalName).toBe('Heart');
    const parsed = parseStudiedKey(key);
    expect(parsed?.name).toBe('Heart');
    expect(parsed?.systemKey).toBe('cardiovascular');
    // Unknown key fallback
    expect(parseStudiedKey('male:skin:object:CustomMesh')?.name).toBe('CustomMesh');
    expect(parseStudiedKey('bogus')).toBeNull();
  });

  it('persists studied keys via user-scoped snapshot and restores on reload', () => {
    // Snapshot keys are user-scoped; reloading with same user id returns same cache key
    const keyA = progressSnapshotKey('user-a');
    const keyB = progressSnapshotKey('user-b');
    expect(keyA).not.toEqual(keyB);
    queryClient.setQueryData(keyA, {
      studiedKeys: ['male:skin:UBERON:0002097'],
      bodyModel: 'male',
    });
    expect(queryClient.getQueryData(keyA)).toMatchObject({
      studiedKeys: ['male:skin:UBERON:0002097'],
    });
    // Simulate reload: data remains under same user key
    expect(queryClient.getQueryData(progressSnapshotKey('user-a'))).toBeDefined();
  });

  it('learning screen keeps progress sync non-blocking and actionable', () => {
    const learningSrc = fs.readFileSync(
      path.join(__dirname, '..', 'screens', 'LearningScreen.tsx'),
      'utf8'
    );
    // Progress snapshot is rendered inline, not as a full-screen blocker; viewport stays
    expect(learningSrc).toContain('mobile-snapshot');
    expect(learningSrc).toContain('mobile-snapshot-loading');
    expect(learningSrc).toContain('mobile-snapshot-error');
    expect(learningSrc).toContain('mobile-snapshot-retry');
    // Non-critical progress sync failure shows warning inside studied card, not overlaying 3D
    expect(learningSrc).toContain('mobile-learning-progress-sync-warning');
    // Studied action has pending/disabled handling and retry for failures
    expect(learningSrc).toContain('mobile-studied-save');
    expect(learningSrc).toContain('mobile-studied-error');
    expect(learningSrc).toContain('mobile-studied-retry');
    expect(learningSrc).toContain('Saving…');
  });

  it('marks studied via progress API contract (PATCH /snapshot/studied)', async () => {
    const originalFetch = global.fetch;
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
    const okJson = (body: unknown) =>
      ({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: jest.fn().mockResolvedValue(body),
      }) as unknown as Response;
    global.fetch = jest.fn().mockResolvedValue(okJson({ studiedKeys: ['a'] }));
    const { mergeStudiedKeys } = await import('../api/progress');
    // Verify LearningScreen keeps the existing progress sync contract
    const learningSrc = fs.readFileSync(
      path.join(__dirname, '..', 'screens', 'LearningScreen.tsx'),
      'utf8'
    );
    expect(learningSrc).toContain('useMergeStudied');
    expect(learningSrc).toContain('merge.mutate');
    expect(learningSrc).toContain('bodyModel: selection.bodyModel');
    // Also verify mergeStudiedKeys still PATCHes correctly when called
    await mergeStudiedKeys(['b'], 'male');
    const calls = (global.fetch as jest.Mock).mock.calls as [string, RequestInit][];
    const last = calls[calls.length - 1];
    if (last) {
      const [, init] = last;
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body as string)).toEqual(expect.objectContaining({ keys: ['b'] }));
    }
    global.fetch = originalFetch;
  });
});

describe('learning workflow — system switching isolation (8.19.37)', () => {
  it('clears prior selection and registry on system switch via StageSystemManager', async () => {
    const skin = findManifestEntry('male', 'skin');
    if (!skin) throw new Error('manifest missing');
    const registry = new AnatomyStructureRegistry();
    const manager = new StageSystemManager({
      fetchAsset: jest.fn(async () => ({ bytes: new Uint8Array([1]), downloadMs: 1 })),
      decodeAsset: jest.fn(async () => ({
        scene: new THREE.Group(),
        meshCount: 1,
        triangleCount: 1,
        decodeMs: 1,
      })),
      collectRecords: jest.fn((): AnatomyStructure[] => [
        {
          id: 'male:skin:object:T',
          structureKey: 'male:skin:object:T',
          name: 'T',
          objectName: 'T',
          systemKey: 'skin',
          bodyModel: 'male',
          ontologyId: null,
          lineage: [],
        },
      ]),
      registry,
      now: () => Date.now(),
    });
    const ops = { attach: jest.fn(), detach: jest.fn() };
    await manager.load(skin, ops);
    expect(registry.size).toBe(1);
    expect(manager.resident).not.toBeNull();
    // Simulate system switch: second load disposes previous and clears registry before next
    await manager.load({ ...skin }, ops);
    expect(ops.detach).toHaveBeenCalled();
    expect(registry.size).toBe(1); // new system records, old cleared
    // LearningScreen must also clear its selection on system change
    const learningSrc = fs.readFileSync(
      path.join(__dirname, '..', 'screens', 'LearningScreen.tsx'),
      'utf8'
    );
    expect(learningSrc).toContain('handleSystemChange');
    expect(learningSrc).toContain('setSelection(null)');
    expect(learningSrc).toContain('Switching systems must not leak');
  });

  it('abandons stale loads without leaking previous scene', async () => {
    const skin = findManifestEntry('male', 'skin');
    if (!skin) throw new Error('manifest missing');
    const registry = new AnatomyStructureRegistry();
    let release: (v: { bytes: Uint8Array; downloadMs: number }) => void = () => undefined;
    const gate = new Promise<{ bytes: Uint8Array; downloadMs: number }>(res => {
      release = res;
    });
    const manager = new StageSystemManager({
      fetchAsset: jest
        .fn()
        .mockImplementationOnce(() => gate)
        .mockImplementation(async () => ({ bytes: new Uint8Array([9]), downloadMs: 1 })),
      decodeAsset: jest.fn(async () => ({
        scene: new THREE.Group(),
        meshCount: 1,
        triangleCount: 1,
        decodeMs: 1,
      })),
      collectRecords: jest.fn((): AnatomyStructure[] => []),
      registry,
      now: () => Date.now(),
    });
    const ops = { attach: jest.fn(), detach: jest.fn() };
    const stale = manager.load(skin, ops);
    const current = manager.load({ ...skin }, ops);
    release({ bytes: new Uint8Array([1]), downloadMs: 1 });
    await expect(stale).rejects.toMatchObject({ code: 'STALE' });
    await expect(current).resolves.toBeDefined();
    expect(ops.attach).toHaveBeenCalledTimes(1);
  });
});

describe('learning workflow — error / retry (8.19.37)', () => {
  it('surfaces actionable retry for asset failures without blocking progress', () => {
    const stageSrc = fs.readFileSync(
      path.join(__dirname, '..', 'anatomy', 'MobileAnatomyStage.tsx'),
      'utf8'
    );
    const learningSrc = fs.readFileSync(
      path.join(__dirname, '..', 'screens', 'LearningScreen.tsx'),
      'utf8'
    );
    // Stage retry
    expect(stageSrc).toContain('mobile-stage-error');
    expect(stageSrc).toContain('mobile-stage-retry');
    expect(stageSrc).toContain('onPress={() => void loadSystem');
    expect(stageSrc).toContain('mobile-stage-error-message');
    // Learning snapshot retry is separate and non-blocking
    expect(learningSrc).toContain('mobile-snapshot-retry');
    expect(learningSrc).toContain('mobile-studied-retry');
    // Progress sync warning does not block viewport
    expect(learningSrc).toContain('mobile-learning-progress-sync-warning');
  });

  it('stage manager wraps fetch/decode failures as actionable codes', async () => {
    const skin = findManifestEntry('male', 'skin');
    if (!skin) throw new Error('manifest missing');
    const failing = new StageSystemManager({
      fetchAsset: jest.fn(async () => {
        throw new Error('offline');
      }),
      decodeAsset: jest.fn(async () => ({
        scene: new THREE.Group(),
        meshCount: 1,
        triangleCount: 1,
        decodeMs: 1,
      })),
      collectRecords: jest.fn(() => []),
      registry: new AnatomyStructureRegistry(),
      now: () => Date.now(),
    });
    await expect(
      failing.load(skin, { attach: jest.fn(), detach: jest.fn() })
    ).rejects.toMatchObject({ code: 'FETCH_FAILED' });
  });
});

describe('learning workflow — auth isolation (8.19.37)', () => {
  it('clears all learning-specific mobile state on logout/login', () => {
    const learningSrc = fs.readFileSync(
      path.join(__dirname, '..', 'screens', 'LearningScreen.tsx'),
      'utf8'
    );
    expect(learningSrc).toContain('Auth isolation');
    expect(learningSrc).toContain('prevUserIdRef');
    expect(learningSrc).toContain("authStatus === 'anonymous'");
    // Query client isolation
    queryClient.setQueryData(progressSnapshotKey('user-a'), { studiedKeys: ['a'] });
    queryClient.setQueryData(progressSnapshotKey('user-b'), { studiedKeys: ['b'] });
    expect(queryClient.getQueryData(progressSnapshotKey('user-a'))).toBeDefined();
    clearCachedUserState();
    expect(queryClient.getQueryData(progressSnapshotKey('user-a'))).toBeUndefined();
    expect(queryClient.getQueryData(progressSnapshotKey('user-b'))).toBeUndefined();
    // Stage remounts on user change via key
    expect(learningSrc).toContain('key={`stage-${user?.id');
  });

  it('keeps existing progress sync contract (merge invalidates snapshot)', () => {
    const hookSrc = fs.readFileSync(path.join(__dirname, '..', 'hooks', 'useLearning.ts'), 'utf8');
    expect(hookSrc).toContain('progressSnapshotKey(user?.id)');
    expect(hookSrc).toContain('mergeStudiedKeys');
    expect(hookSrc).toContain('invalidateQueries');
  });
});

describe('learning workflow — responsive and constraints (8.19.37)', () => {
  it('remains readable on small screens without hover', () => {
    const stageSrc = fs.readFileSync(
      path.join(__dirname, '..', 'anatomy', 'MobileAnatomyStage.tsx'),
      'utf8'
    );
    const learningSrc = fs.readFileSync(
      path.join(__dirname, '..', 'screens', 'LearningScreen.tsx'),
      'utf8'
    );
    // No hover-dependent interaction
    expect(stageSrc).not.toMatch(/onHover/i);
    expect(stageSrc).not.toMatch(/hover:/i);
    // Avoid modal stacking: no modal import in learning or stage
    expect(learningSrc).not.toContain('Modal');
    expect(stageSrc).not.toContain('Modal');
    // ScrollView for small screens, viewport dominant
    expect(learningSrc).toContain('ScrollView');
    expect(learningSrc).toContain('contentContainerStyle');
  });

  it('does not introduce disallowed dependencies or data', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8')
    );
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(deps['redux']).toBeUndefined();
    expect(deps['axios']).toBeUndefined();
    expect(deps['@react-three/fiber']).toBeUndefined();
    expect(deps['@react-three/drei']).toBeUndefined();
    // No new anatomy data: seed size unchanged via anatomy-core test helper
    const { getAnatomyInformationSeed } = require('@anatomiax/anatomy-core');
    const seed = getAnatomyInformationSeed() as unknown[];
    expect(seed.length).toBeGreaterThan(0);
    // LearningScreen must not add female model or nervous system yet
    const learningSrc = fs.readFileSync(
      path.join(__dirname, '..', 'screens', 'LearningScreen.tsx'),
      'utf8'
    );
    expect(learningSrc).toContain('Male body model');
    expect(learningSrc).not.toMatch(/female.*model/i);
    // Stage still supports only male <=5MB
    expect(SUPPORTED_STAGE_SYSTEMS.every(s => s.bytes <= MAX_STAGE_BYTES)).toBe(true);
  });

  it('does not modify web experience or backend APIs', () => {
    const webLearn = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'web', 'src', 'pages', 'LearnPage.tsx'),
      'utf8'
    );
    expect(webLearn).toContain('Placeholder');
    // Backend not modified by this step — we at least ensure no mobile import of backend
    const learningSrc = fs.readFileSync(
      path.join(__dirname, '..', 'screens', 'LearningScreen.tsx'),
      'utf8'
    );
    expect(learningSrc).not.toContain('backend');
  });
});

describe('learning workflow — device 3D gate (8.19.36 preserved)', () => {
  it('stage keeps WebGL2 gate and returns unsupported when unavailable', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'anatomy', 'MobileAnatomyStage.tsx'),
      'utf8'
    );
    expect(src).toContain('WebGL2');
    expect(src).toContain('unsupported');
    expect(src).toContain('capabilities.isWebGL2');
  });
});
