import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { initialVisibleSystems, type AnatomySystemKey } from './anatomyAssetConfig';

export interface SelectedStructure {
  /** Verified object/node name from the loaded GLB — not a curated label. */
  name: string;
  systemKey: AnatomySystemKey;
}

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
}

const AnatomyStateContext = createContext<AnatomyStateValue | null>(null);

export function AnatomyStateProvider({ children }: { children: ReactNode }): JSX.Element {
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
