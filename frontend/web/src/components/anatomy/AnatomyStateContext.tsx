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
import { AnatomyStructureRegistry } from './anatomyRegistry';

export type SelectedStructure = AnatomySelection;

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
  registerSystemStructures: (key: AnatomySystemKey, scene: THREE.Object3D) => AnatomyStructure[];
  unregisterSystemStructures: (key: AnatomySystemKey) => void;
}

const AnatomyStateContext = createContext<AnatomyStateValue | null>(null);

export function AnatomyStateProvider({ children }: { children: ReactNode }): JSX.Element {
  const registryRef = useRef<AnatomyStructureRegistry>(new AnatomyStructureRegistry());
  const [visibleSystems, setVisibleSystems] = useState(initialVisibleSystems);
  const [systemOpacity, setSystemOpacityMap] = useState<SystemOpacityMap>(INITIAL_OPACITY);
  const [isolatedSystem, setIsolatedSystem] = useState<AnatomySystemKey | null>(null);
  const [isolatedSnapshot, setIsolatedSnapshot] = useState<IsolatedSnapshot | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<SelectedStructure | null>(null);
  const [selectedBodyModel, setSelectedBodyModel] = useState<AnatomyBodyModelKey>('male');
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
    }
  }, [visibleSystems, selectedStructure]);

  // Also clear highlight when isolated system hides previous selection
  useEffect(() => {
    if (isolatedSystem && selectedStructure && selectedStructure.systemKey !== isolatedSystem) {
      // selection belongs to a now-hidden system — already handled above, but keep as safety
      if (!visibleSystems[selectedStructure.systemKey]) setSelectedStructure(null);
    }
  }, [isolatedSystem, selectedStructure, visibleSystems]);

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

  const selectStructure = useCallback((structure: SelectedStructure | null) => {
    setSelectedStructure(structure);
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
      return registryRef.current.registerSystem(key, scene, selectedBodyModel);
    },
    [selectedBodyModel]
  );

  const unregisterSystemStructures = useCallback((key: AnatomySystemKey): void => {
    registryRef.current.unregisterSystem(key);
    // Do NOT clear registry on hide for layer visibility — keep cached data.
    // Only clear selection if it belonged to the removed system (handled by effect above).
  }, []);

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
      selectedBodyModel,
      setSelectedBodyModel,
      status,
      setSystemStatus,
      errorMessages,
      setSystemError,
      attempts,
      retrySystem,
      registry: registryRef.current,
      registerSystemStructures,
      unregisterSystemStructures,
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
      selectedBodyModel,
      status,
      setSystemStatus,
      errorMessages,
      setSystemError,
      attempts,
      retrySystem,
      registerSystemStructures,
      unregisterSystemStructures,
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
