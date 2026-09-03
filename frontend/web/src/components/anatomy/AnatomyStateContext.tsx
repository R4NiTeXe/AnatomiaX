import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as THREE from 'three';
import { initialVisibleSystems } from './anatomyAssetConfig';
import type {
  AnatomyBodyModelKey,
  AnatomySelection,
  AnatomyStructure,
  AnatomySystemKey,
} from './anatomyTypes';
import {
  AnatomyStructureRegistry,
  createStructureKey,
  extractOntologyId,
  resolveObjectName,
} from './anatomyRegistry';
import {
  getAnatomyInformationByStructureKey as getInfoByStructureKey,
  getAnatomyInformationSeed,
} from './anatomyInformation';

export type SelectedStructure = AnatomySelection;

export interface AnatomyQuizQuestion {
  id: string;
  canonicalName: string;
  bodyModel: AnatomyBodyModelKey;
  systemKey: AnatomySystemKey;
  ontologyId: string | null;
  structureKey: string;
  question: string;
  choices: string[];
  correctIndex: number;
}

export type SystemLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export type SystemLoadStatusMap = Record<AnatomySystemKey, SystemLoadStatus>;

export type SystemOpacityMap = Record<AnatomySystemKey, number>;

const IDLE_STATUS: SystemLoadStatusMap = {
  skin: 'idle',
  musculoskeletal: 'idle',
  nervous: 'idle',
  cardiovascular: 'idle',
  respiratory: 'idle',
  digestive: 'idle',
  urinary: 'idle',
  reproductive: 'idle',
  lymphatic: 'idle',
};

const INITIAL_OPACITY: SystemOpacityMap = {
  skin: 1,
  musculoskeletal: 1,
  nervous: 1,
  cardiovascular: 1,
  respiratory: 1,
  digestive: 1,
  urinary: 1,
  reproductive: 1,
  lymphatic: 1,
};

interface IsolatedSnapshot {
  visibleSystems: Record<AnatomySystemKey, boolean>;
  selectedStructure: SelectedStructure | null;
}

interface AnatomyStateValue {
  visibleSystems: Record<AnatomySystemKey, boolean>;
  toggleSystem: (key: AnatomySystemKey) => void;
  systemOpacity: SystemOpacityMap;
  setSystemOpacity: (key: AnatomySystemKey, value: number) => void;
  /** Legacy alias for skin — kept for backward compatibility */
  skinOpacity: number;
  setSkinOpacity: (value: number) => void;
  isolatedSystem: AnatomySystemKey | null;
  isolateSystem: (key: AnatomySystemKey) => void;
  resetView: () => void;
  selectedStructure: SelectedStructure | null;
  selectStructure: (structure: SelectedStructure | null) => void;
  hoveredStructure: SelectedStructure | null;
  setHoveredStructure: (structure: SelectedStructure | null) => void;
  recentHistory: SelectedStructure[];
  clearHistory: () => void;
  compareStructure: SelectedStructure | null;
  setCompareStructure: (structure: SelectedStructure | null) => void;
  clearCompare: () => void;
  quizQuestions: AnatomyQuizQuestion[];
  quizIndex: number;
  quizScore: number;
  quizSelectedChoice: number | null;
  quizAnswered: boolean;
  quizCompleted: boolean;
  startQuiz: () => void;
  answerQuiz: (choiceIndex: number) => void;
  nextQuizQuestion: () => void;
  retryQuiz: () => void;
  resetQuiz: () => void;
  /** Prepared for shared viewer — /human remains male */
  selectedBodyModel: AnatomyBodyModelKey;
  setSelectedBodyModel: (model: AnatomyBodyModelKey) => void;
  status: SystemLoadStatusMap;
  setSystemStatus: (key: AnatomySystemKey, status: SystemLoadStatus) => void;
  errorMessages: Record<AnatomySystemKey, string>;
  setSystemError: (key: AnatomySystemKey, message: string) => void;
  attempts: Record<AnatomySystemKey, number>;
  retrySystem: (key: AnatomySystemKey) => void;
  registry: AnatomyStructureRegistry;
  registryVersion: number;
  registerSystemStructures: (key: AnatomySystemKey, scene: THREE.Object3D) => AnatomyStructure[];
  unregisterSystemStructures: (key: AnatomySystemKey) => void;
  registerSystemScene: (key: AnatomySystemKey, scene: THREE.Object3D) => void;
  unregisterSystemScene: (key: AnatomySystemKey) => void;
  getMeshesForStructure: (selection: SelectedStructure | null) => THREE.Mesh[];
}

const AnatomyStateContext = createContext<AnatomyStateValue | null>(null);

export function AnatomyStateProvider({
  children,
  initialBodyModel = 'male' as AnatomyBodyModelKey,
}: {
  children: ReactNode;
  initialBodyModel?: AnatomyBodyModelKey;
}): JSX.Element {
  const registryRef = useRef<AnatomyStructureRegistry>(new AnatomyStructureRegistry());
  const systemScenesRef = useRef<Map<AnatomySystemKey, THREE.Object3D>>(new Map());
  const [registryVersion, setRegistryVersion] = useState(0);
  const [visibleSystems, setVisibleSystems] = useState(initialVisibleSystems);
  const [systemOpacity, setSystemOpacityMap] = useState<SystemOpacityMap>(INITIAL_OPACITY);
  const [isolatedSystem, setIsolatedSystem] = useState<AnatomySystemKey | null>(null);
  const [isolatedSnapshot, setIsolatedSnapshot] = useState<IsolatedSnapshot | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<SelectedStructure | null>(null);
  const [hoveredStructure, setHoveredStructure] = useState<SelectedStructure | null>(null);
  const [recentHistory, setRecentHistory] = useState<SelectedStructure[]>([]);
  const [compareStructure, setCompareStructure] = useState<SelectedStructure | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<AnatomyQuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizSelectedChoice, setQuizSelectedChoice] = useState<number | null>(null);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [selectedBodyModel, setSelectedBodyModel] = useState<AnatomyBodyModelKey>(initialBodyModel);
  const [status, setStatus] = useState<SystemLoadStatusMap>(IDLE_STATUS);
  const [errorMessages, setErrorMessages] = useState<Record<AnatomySystemKey, string>>({
    skin: '',
    musculoskeletal: '',
    nervous: '',
    cardiovascular: '',
    respiratory: '',
    digestive: '',
    urinary: '',
    reproductive: '',
    lymphatic: '',
  });
  const [attempts, setAttempts] = useState<Record<AnatomySystemKey, number>>({
    skin: 0,
    musculoskeletal: 0,
    nervous: 0,
    cardiovascular: 0,
    respiratory: 0,
    digestive: 0,
    urinary: 0,
    reproductive: 0,
    lymphatic: 0,
  });

  // Clear selection when its system becomes hidden
  useEffect(() => {
    if (selectedStructure && !visibleSystems[selectedStructure.systemKey]) {
      setSelectedStructure(null);
      setCompareStructure(null);
    }
    if (compareStructure && !visibleSystems[compareStructure.systemKey]) {
      setCompareStructure(null);
    }
    if (hoveredStructure && !visibleSystems[hoveredStructure.systemKey]) {
      setHoveredStructure(null);
    }
  }, [visibleSystems, selectedStructure, compareStructure, hoveredStructure]);

  // Also clear highlight when isolated system hides previous selection
  useEffect(() => {
    if (isolatedSystem && selectedStructure && selectedStructure.systemKey !== isolatedSystem) {
      // selection belongs to a now-hidden system — already handled above, but keep as safety
      if (!visibleSystems[selectedStructure.systemKey]) setSelectedStructure(null);
    }
  }, [isolatedSystem, selectedStructure, visibleSystems]);

  // Handle body model switch — clear per-body state but keep GLTF cache
  const prevBodyModelRef = useRef(selectedBodyModel);
  useEffect(() => {
    if (prevBodyModelRef.current !== selectedBodyModel) {
      prevBodyModelRef.current = selectedBodyModel;
      registryRef.current.clear();
      systemScenesRef.current.clear();
      setRegistryVersion(v => v + 1);
      setSelectedStructure(null);
      setHoveredStructure(null);
      setRecentHistory([]);
      setCompareStructure(null);
      setQuizQuestions([]);
      setQuizIndex(0);
      setQuizScore(0);
      setQuizSelectedChoice(null);
      setQuizAnswered(false);
      setIsolatedSnapshot(null);
      setIsolatedSystem(null);
      setStatus(IDLE_STATUS);
      setErrorMessages({
        skin: '',
        musculoskeletal: '',
        nervous: '',
        cardiovascular: '',
        respiratory: '',
        digestive: '',
        urinary: '',
        reproductive: '',
        lymphatic: '',
      });
      setAttempts({
        skin: 0,
        musculoskeletal: 0,
        nervous: 0,
        cardiovascular: 0,
        respiratory: 0,
        digestive: 0,
        urinary: 0,
        reproductive: 0,
        lymphatic: 0,
      });
      setVisibleSystems(initialVisibleSystems);
      setSystemOpacityMap(INITIAL_OPACITY);
    }
  }, [selectedBodyModel]);

  const toggleSystem = useCallback((key: AnatomySystemKey) => {
    setVisibleSystems(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const setSystemOpacity = useCallback((key: AnatomySystemKey, value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    setSystemOpacityMap(prev => (prev[key] === clamped ? prev : { ...prev, [key]: clamped }));
  }, []);

  const skinOpacity = systemOpacity.skin;
  const setSkinOpacity = useCallback(
    (value: number) => setSystemOpacity('skin', value),
    [setSystemOpacity]
  );

  const isolateSystem = useCallback(
    (key: AnatomySystemKey) => {
      if (isolatedSystem === key) return;
      if (!isolatedSnapshot) {
        setIsolatedSnapshot({
          visibleSystems: { ...visibleSystems },
          selectedStructure,
        });
      }
      const nextVisible = Object.fromEntries(
        (Object.keys(initialVisibleSystems) as AnatomySystemKey[]).map(k => [k, k === key])
      ) as Record<AnatomySystemKey, boolean>;
      setVisibleSystems(nextVisible);
      setIsolatedSystem(key);
    },
    [isolatedSystem, isolatedSnapshot, visibleSystems, selectedStructure]
  );

  const resetView = useCallback(() => {
    if (isolatedSnapshot) {
      setVisibleSystems(isolatedSnapshot.visibleSystems);
      setSelectedStructure(isolatedSnapshot.selectedStructure);
      setIsolatedSnapshot(null);
      setIsolatedSystem(null);
    }
    // Opacity always resets to defaults on Reset View (per spec: restore opacity)
    setSystemOpacityMap(INITIAL_OPACITY);
    if (!isolatedSnapshot) {
      setVisibleSystems(initialVisibleSystems);
      setSelectedStructure(null);
      setIsolatedSnapshot(null);
      setIsolatedSystem(null);
    }
  }, [isolatedSnapshot]);

  const selectStructure = useCallback(
    (structure: SelectedStructure | null) => {
      setSelectedStructure(structure);
      setHoveredStructure(null);
      // If compare is same as new selection, clear compare
      if (structure && compareStructure) {
        const selKey = `${structure.bodyModel}:${structure.structureKey}`;
        const cmpKey = `${compareStructure.bodyModel}:${compareStructure.structureKey}`;
        if (selKey === cmpKey) setCompareStructure(null);
      }
      if (!structure) {
        setCompareStructure(null);
        setHoveredStructure(null);
      }
      if (structure) {
        setRecentHistory(prev => {
          const key = `${structure.bodyModel}:${structure.structureKey}`;
          const filtered = prev.filter(s => `${s.bodyModel}:${s.structureKey}` !== key);
          const next = [structure, ...filtered];
          return next.slice(0, 5);
        });
      }
    },
    [compareStructure]
  );

  const setCompareStructureSafe = useCallback(
    (structure: SelectedStructure | null) => {
      if (!structure) {
        setCompareStructure(null);
        return;
      }
      if (selectedStructure) {
        const selKey = `${selectedStructure.bodyModel}:${selectedStructure.structureKey}`;
        const cmpKey = `${structure.bodyModel}:${structure.structureKey}`;
        if (selKey === cmpKey) return;
      }
      setCompareStructure(structure);
      setHoveredStructure(null);
    },
    [selectedStructure]
  );

  const clearCompare = useCallback(() => {
    setCompareStructure(null);
  }, []);

  const clearHistory = useCallback(() => {
    setRecentHistory([]);
  }, []);

  const generateQuizQuestions = useCallback((): AnatomyQuizQuestion[] => {
    const seed = getAnatomyInformationSeed();
    // Guarantee exactly 5 when >=5 unique canonical are available
    const uniqueByCanonical = new Map<string, (typeof seed)[number]>();
    for (const s of seed) {
      if (!uniqueByCanonical.has(s.canonicalName)) uniqueByCanonical.set(s.canonicalName, s);
    }
    let uniquePool = [...uniqueByCanonical.values()];
    if (uniquePool.length < 5) return [];
    // Resolve selectedStructure by exact bodyModel + structureKey, independent of canonical dedup
    let ordered: typeof uniquePool = [];
    let selectedEntry: (typeof uniquePool)[number] | null = null;
    if (selectedStructure) {
      const selInfo = getInfoByStructureKey(selectedStructure.structureKey);
      if (selInfo) {
        const found = uniquePool.find(
          s => s.structureKey === selInfo.structureKey && s.bodyModel === selInfo.bodyModel
        );
        if (found) selectedEntry = found;
        else {
          const raw = seed.find(s => s.structureKey === selectedStructure.structureKey);
          if (raw) {
            const canon = uniquePool.find(c => c.canonicalName === raw.canonicalName);
            if (canon) selectedEntry = canon;
          }
        }
      }
    }
    const shuffled = [...uniquePool].sort(() => Math.random() - 0.5);
    if (selectedEntry) {
      ordered = [
        selectedEntry,
        ...shuffled.filter(s => s.structureKey !== selectedEntry!.structureKey),
      ];
    } else {
      ordered = shuffled;
    }
    // Ensure we have at least 5 unique canonical for questions
    if (ordered.length < 5) return [];
    const questions: AnatomyQuizQuestion[] = [];
    for (let i = 0; i < 5; i++) {
      const correct = ordered[i];
      if (!correct) break;
      // Prefer distractors from different systems
      const sameSystemDistractors: typeof uniquePool = [];
      const diffSystemDistractors: typeof uniquePool = [];
      for (const s of ordered) {
        if (s.canonicalName === correct.canonicalName) continue;
        if (s.function === correct.function) continue;
        if (s.systemKey === correct.systemKey) sameSystemDistractors.push(s);
        else diffSystemDistractors.push(s);
      }
      // Prefer different system, fallback to same system only if needed
      let distractors: typeof uniquePool = [];
      const diffShuffled = [...diffSystemDistractors].sort(() => Math.random() - 0.5);
      distractors = diffShuffled.slice(0, 3);
      if (distractors.length < 3) {
        const sameShuffled = [...sameSystemDistractors].sort(() => Math.random() - 0.5);
        distractors = [...distractors, ...sameShuffled].slice(0, 3);
      }
      if (distractors.length < 3) continue;
      // Ensure distinct function and canonical
      const distinctFunctions = new Set<string>();
      const distinctCanonical = new Set<string>([correct.canonicalName]);
      const finalDistractors: typeof uniquePool = [];
      for (const d of distractors) {
        if (distinctFunctions.has(d.function) || distinctCanonical.has(d.canonicalName)) continue;
        distinctFunctions.add(d.function);
        distinctCanonical.add(d.canonicalName);
        finalDistractors.push(d);
        if (finalDistractors.length >= 3) break;
      }
      if (finalDistractors.length < 3) {
        // Fallback: take any distinct
        for (const s of ordered) {
          if (s.canonicalName === correct.canonicalName) continue;
          if (finalDistractors.length >= 3) break;
          if (finalDistractors.some(d => d.canonicalName === s.canonicalName)) continue;
          if (finalDistractors.some(d => d.function === s.function)) continue;
          finalDistractors.push(s);
        }
      }
      if (finalDistractors.length < 3) continue;
      const choices = [correct.function, ...finalDistractors.slice(0, 3).map(s => s.function)];
      const shuffledChoices = [...choices].sort(() => Math.random() - 0.5);
      const correctIndex = shuffledChoices.indexOf(correct.function);
      if (correctIndex < 0) continue;
      questions.push({
        id: `${correct.structureKey}-${i}-${Date.now()}-${Math.random()}`,
        canonicalName: correct.canonicalName,
        bodyModel: correct.bodyModel,
        systemKey: correct.systemKey,
        ontologyId: correct.ontologyId,
        structureKey: correct.structureKey,
        question: `What is the function of the ${correct.canonicalName}${correct.bodyModel !== selectedBodyModel ? ` (${correct.bodyModel})` : ''}?`,
        choices: shuffledChoices,
        correctIndex,
      });
      if (questions.length >= 5) break;
    }
    // Guarantee exactly 5 when possible
    if (questions.length < 5 && uniquePool.length >= 5) {
      // Fallback: fill remaining with any valid
      for (const s of shuffled) {
        if (questions.length >= 5) break;
        if (questions.some(q => q.canonicalName === s.canonicalName)) continue;
        const distractors = uniquePool.filter(
          c => c.canonicalName !== s.canonicalName && c.function !== s.function
        );
        if (distractors.length < 3) continue;
        const d = [...distractors].sort(() => Math.random() - 0.5).slice(0, 3);
        const ch = [s.function, ...d.map(x => x.function)].sort(() => Math.random() - 0.5);
        const idx = ch.indexOf(s.function);
        questions.push({
          id: `${s.structureKey}-fallback-${questions.length}`,
          canonicalName: s.canonicalName,
          bodyModel: s.bodyModel,
          systemKey: s.systemKey,
          ontologyId: s.ontologyId,
          structureKey: s.structureKey,
          question: `What is the function of the ${s.canonicalName}?`,
          choices: ch,
          correctIndex: idx,
        });
      }
    }
    return questions.slice(0, 5);
  }, [selectedBodyModel, selectedStructure]);

  const startQuiz = useCallback(() => {
    const qs = generateQuizQuestions();
    setQuizQuestions(qs);
    setQuizIndex(0);
    setQuizScore(0);
    setQuizSelectedChoice(null);
    setQuizAnswered(false);
  }, [generateQuizQuestions]);

  const answerQuiz = useCallback(
    (choiceIndex: number) => {
      if (quizAnswered) return;
      setQuizSelectedChoice(choiceIndex);
      setQuizAnswered(true);
      const q = quizQuestions[quizIndex];
      if (q && choiceIndex === q.correctIndex) {
        setQuizScore(s => s + 1);
      }
    },
    [quizAnswered, quizQuestions, quizIndex]
  );

  const nextQuizQuestion = useCallback(() => {
    if (quizIndex < quizQuestions.length - 1) {
      setQuizIndex(i => i + 1);
      setQuizSelectedChoice(null);
      setQuizAnswered(false);
    }
  }, [quizIndex, quizQuestions.length]);

  const retryQuiz = useCallback(() => {
    startQuiz();
  }, [startQuiz]);

  const resetQuiz = useCallback(() => {
    setQuizQuestions([]);
    setQuizIndex(0);
    setQuizScore(0);
    setQuizSelectedChoice(null);
    setQuizAnswered(false);
  }, []);

  const setSystemStatus = useCallback((key: AnatomySystemKey, next: SystemLoadStatus) => {
    setStatus(prev => (prev[key] === next ? prev : { ...prev, [key]: next }));
  }, []);

  const setSystemError = useCallback((key: AnatomySystemKey, message: string) => {
    setErrorMessages(prev => (prev[key] === message ? prev : { ...prev, [key]: message }));
  }, []);

  const retrySystem = useCallback((key: AnatomySystemKey) => {
    setErrorMessages(prev => ({ ...prev, [key]: '' }));
    setStatus(prev => ({ ...prev, [key]: 'idle' }));
    setAttempts(prev => ({ ...prev, [key]: prev[key] + 1 }));
  }, []);

  const registerSystemStructures = useCallback(
    (key: AnatomySystemKey, scene: THREE.Object3D): AnatomyStructure[] => {
      const res = registryRef.current.registerSystem(key, scene, selectedBodyModel);
      setRegistryVersion(v => v + 1);
      return res;
    },
    [selectedBodyModel]
  );

  const unregisterSystemStructures = useCallback((key: AnatomySystemKey): void => {
    registryRef.current.unregisterSystem(key);
    setRegistryVersion(v => v + 1);
    // Do NOT clear registry on hide for layer visibility — keep cached data.
    // Only clear selection if it belonged to the removed system (handled by effect above).
  }, []);

  const registerSystemScene = useCallback((key: AnatomySystemKey, scene: THREE.Object3D): void => {
    systemScenesRef.current.set(key, scene);
  }, []);

  const unregisterSystemScene = useCallback((key: AnatomySystemKey): void => {
    systemScenesRef.current.delete(key);
  }, []);

  const getMeshesForStructure = useCallback((selection: SelectedStructure | null): THREE.Mesh[] => {
    if (!selection) return [];
    const scene = systemScenesRef.current.get(selection.systemKey);
    // If system scene not yet stored (e.g., legacy hide), fall back to empty
    if (!scene) return [];
    // Do not focus hidden system — caller should check visibility
    const targets: THREE.Mesh[] = [];
    scene.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (!(mesh as unknown as { isMesh?: boolean }).isMesh || !mesh.geometry) return;
      const objectName = resolveObjectName(mesh);
      const ontologyId = extractOntologyId(mesh);
      const key = createStructureKey(
        selection.systemKey,
        ontologyId,
        objectName,
        selection.bodyModel
      );
      if (key === selection.structureKey) {
        targets.push(mesh);
      } else if (selection.ontologyId && ontologyId && ontologyId === selection.ontologyId) {
        // Multiple meshes sharing same ontologyId within same system — focus all
        if (!targets.includes(mesh)) targets.push(mesh);
      }
    });
    return targets;
  }, []);

  // E2E observability — expose registry/selection for QA (no architecture change)
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__ANATOMIA_REGISTRY = registryRef.current;
    (window as unknown as Record<string, unknown>).__ANATOMIA_SELECTION = selectedStructure;
    (window as unknown as Record<string, unknown>).__ANATOMIA_HOVERED = hoveredStructure;
    (window as unknown as Record<string, unknown>).__ANATOMIA_HISTORY = recentHistory;
    (window as unknown as Record<string, unknown>).__ANATOMIA_COMPARE = compareStructure;
    (window as unknown as Record<string, unknown>).__ANATOMIA_QUIZ = {
      questions: quizQuestions,
      index: quizIndex,
      score: quizScore,
      selectedChoice: quizSelectedChoice,
      answered: quizAnswered,
    };
  }, [
    selectedStructure,
    hoveredStructure,
    recentHistory,
    compareStructure,
    quizQuestions,
    quizIndex,
    quizScore,
    quizSelectedChoice,
    quizAnswered,
  ]);

  const value = useMemo<AnatomyStateValue>(
    () => ({
      visibleSystems,
      toggleSystem,
      systemOpacity,
      setSystemOpacity,
      skinOpacity,
      setSkinOpacity,
      isolatedSystem,
      isolateSystem,
      resetView,
      selectedStructure,
      selectStructure,
      hoveredStructure,
      setHoveredStructure,
      recentHistory,
      clearHistory,
      compareStructure,
      setCompareStructure: setCompareStructureSafe,
      clearCompare,
      quizQuestions,
      quizIndex,
      quizScore,
      quizSelectedChoice,
      quizAnswered,
      quizCompleted:
        quizQuestions.length > 0 && quizIndex === quizQuestions.length - 1 && quizAnswered,
      startQuiz,
      answerQuiz,
      nextQuizQuestion,
      retryQuiz,
      resetQuiz,
      selectedBodyModel,
      setSelectedBodyModel,
      status,
      setSystemStatus,
      errorMessages,
      setSystemError,
      attempts,
      retrySystem,
      registry: registryRef.current,
      registryVersion,
      registerSystemStructures,
      unregisterSystemStructures,
      registerSystemScene,
      unregisterSystemScene,
      getMeshesForStructure,
    }),
    [
      visibleSystems,
      toggleSystem,
      systemOpacity,
      setSystemOpacity,
      skinOpacity,
      setSkinOpacity,
      isolatedSystem,
      isolateSystem,
      resetView,
      selectedStructure,
      selectStructure,
      hoveredStructure,
      setHoveredStructure,
      recentHistory,
      clearHistory,
      compareStructure,
      setCompareStructureSafe,
      clearCompare,
      quizQuestions,
      quizIndex,
      quizScore,
      quizSelectedChoice,
      quizAnswered,
      startQuiz,
      answerQuiz,
      nextQuizQuestion,
      retryQuiz,
      resetQuiz,
      selectedBodyModel,
      status,
      setSystemStatus,
      errorMessages,
      setSystemError,
      attempts,
      retrySystem,
      registryVersion,
      registerSystemStructures,
      unregisterSystemStructures,
      registerSystemScene,
      unregisterSystemScene,
      getMeshesForStructure,
    ]
  );

  return <AnatomyStateContext.Provider value={value}>{children}</AnatomyStateContext.Provider>;
}

export function useAnatomyState(): AnatomyStateValue {
  const ctx = useContext(AnatomyStateContext);
  if (!ctx) {
    throw new Error('useAnatomyState must be used within AnatomyStateProvider');
  }
  return ctx;
}
