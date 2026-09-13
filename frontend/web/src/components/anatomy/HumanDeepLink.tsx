import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseStudiedKey } from '@anatomiax/anatomy-core';
import { useAnatomyState } from './AnatomyStateContext';

/**
 * Applies `?focus=<structureKey>` deep links from dashboard/history.
 * Parsing needs no loaded meshes; camera focus follows via the existing
 * focus controller when meshes are available. Invalid keys are ignored.
 *
 * Commit protocol: the provider's body-model switch effect wipes the
 * selection in the same commit where the new model first matches, and
 * child effects always run before it — so a select issued in that commit
 * never survives. `awaitingModel` therefore swallows exactly one
 * model-match commit (queuing a follow-up) and selects in the next one,
 * which the provider leaves untouched. Later user deselections are
 * respected (applied key + settled flag ⇒ return).
 */
export default function HumanDeepLink(): null {
  const [searchParams] = useSearchParams();
  const { selectedBodyModel, setSelectedBodyModel, selectStructure, selectedStructure } =
    useAnatomyState();
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
      // First model-match commit: the provider wipe runs after this commit,
      // so only settle the flag here and select in the follow-up commit.
      setAwaitingModel(false);
      return;
    }
    appliedRef.current = focusRaw;
    selectStructure(parsed);
  }, [
    focusRaw,
    selectedBodyModel,
    selectedKey,
    awaitingModel,
    setSelectedBodyModel,
    selectStructure,
  ]);

  return null;
}
