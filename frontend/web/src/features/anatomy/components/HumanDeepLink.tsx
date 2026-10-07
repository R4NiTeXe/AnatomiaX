import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseStudiedKey } from '@anatomiax/anatomy-core';
import { useAnatomyState } from './AnatomyStateContext';

export default function HumanDeepLink(): null {
  const [searchParams] = useSearchParams();
  const {
    selectedBodyModel,
    setSelectedBodyModel,
    selectStructure,
    selectedStructure,
    visibleSystems,
    toggleSystem,
  } = useAnatomyState();
  const appliedRef = useRef<string | null>(null);
  const [awaitingModel, setAwaitingModel] = useState(false);

  const focusRaw = searchParams.get('focus');
  const selectedKey = selectedStructure?.structureKey ?? null;

  useEffect(() => {
    if (!focusRaw || focusRaw.length === 0 || focusRaw.length > 256) {
      if (awaitingModel) setAwaitingModel(false);
      return;
    }
    let parsed: ReturnType<typeof parseStudiedKey>;
    try {
      parsed = parseStudiedKey(focusRaw);
    } catch {
      return;
    }
    if (!parsed) {
      if (awaitingModel) setAwaitingModel(false);
      return;
    }
    if (parsed.bodyModel !== selectedBodyModel) {
      if (appliedRef.current === focusRaw) return;
      setSelectedBodyModel(parsed.bodyModel);
      if (!awaitingModel) setAwaitingModel(true);
      return;
    }
    if (selectedKey === parsed.structureKey) {
      appliedRef.current = focusRaw;
      if (awaitingModel) setAwaitingModel(false);
      return;
    }
    if (appliedRef.current === focusRaw && !awaitingModel) return;
    if (awaitingModel) {
      setAwaitingModel(false);
      return;
    }
    appliedRef.current = focusRaw;
    if (!visibleSystems[parsed.systemKey]) toggleSystem(parsed.systemKey);
    selectStructure(parsed);
  }, [
    focusRaw,
    selectedBodyModel,
    selectedKey,
    awaitingModel,
    setSelectedBodyModel,
    selectStructure,
    visibleSystems,
    toggleSystem,
  ]);

  return null;
}
