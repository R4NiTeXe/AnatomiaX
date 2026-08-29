import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as THREE from 'three';
import { initialVisibleSystems } from './anatomyAssetConfig';
import type { AnatomySystemKey, AnatomySelection, AnatomyStructure } from './anatomyTypes';
import { AnatomyStructureRegistry } from './anatomyRegistry';

export type SelectedStructure = AnatomySelection;

export type SystemLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export type SystemLoadStatusMap = Record<AnatomySystemKey, SystemLoadStatus>;

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

interface AnatomyStateValue {
  visibleSystems: Record<AnatomySystemKey, boolean>;
  toggleSystem: (key: AnatomySystemKey) => void;
  skinOpacity: number;
  setSkinOpacity: (value: number) => void;
  selectedStructure: SelectedStructure | null;
  selectStructure: (structure: SelectedStructure | null) => void;
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
  const [skinOpacity, setSkinOpacity] = useState(1);
  const [selectedStructure, setSelectedStructure] = useState<SelectedStructure | null>(null);
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

  const toggleSystem = useCallback((key: AnatomySystemKey) => {
    setVisibleSystems(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

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
      return registryRef.current.registerSystem(key, scene);
    },
    []
  );

  const unregisterSystemStructures = useCallback((key: AnatomySystemKey): void => {
    registryRef.current.unregisterSystem(key);
    // Clear selection if it belonged to the system being removed.
    setSelectedStructure(prev => (prev && prev.systemKey === key ? null : prev));
  }, []);

  const value = useMemo<AnatomyStateValue>(
    () => ({
      visibleSystems,
      toggleSystem,
      skinOpacity,
      setSkinOpacity,
      selectedStructure,
      selectStructure,
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
      skinOpacity,
      selectedStructure,
      selectStructure,
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
