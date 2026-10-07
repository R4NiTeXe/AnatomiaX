import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { parseStudiedKey } from '@anatomiax/anatomy-core';
import { useAuth } from '@/features/auth/components/AuthProvider';
import { useMergeStudied, useProgressSnapshot } from '@/features/progress/hooks/useProgress';
import { useAnatomyState, type SelectedStructure } from './AnatomyStateContext';

const STUDIED_SYNC_DEBOUNCE_MS = 1500;
const MAX_LOCAL_HISTORY = 5;

export { parseStudiedKey };

export default function AnatomyProgressSync(): null {
  const { user, status } = useAuth();
  const queryClient = useQueryClient();
  const { recentHistory, clearHistory, hydrateHistory, resetQuiz, selectedBodyModel } =
    useAnatomyState();
  const snapshotQuery = useProgressSnapshot();
  const { mutate: mergeStudiedKeys } = useMergeStudied();

  const prevUserId = useRef<string | null | undefined>(undefined);
  const hydratedFor = useRef<string | null>(null);
  const syncedKeys = useRef<Set<string>>(new Set());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const userId = user?.id ?? null;
    if (prevUserId.current !== undefined && prevUserId.current !== userId) {
      queryClient.removeQueries({ queryKey: ['progress'] });
      clearHistory();
      resetQuiz();
      hydratedFor.current = null;
      syncedKeys.current = new Set();
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    }
    prevUserId.current = userId;
  }, [user?.id, queryClient, clearHistory, resetQuiz]);

  const userId = user?.id;
  const snapshotData = snapshotQuery.data;
  useEffect(() => {
    if (status !== 'authenticated' || !userId || !snapshotData) return;
    if (hydratedFor.current === userId) return;
    hydratedFor.current = userId;
    const serverKeys = snapshotData.studiedKeys ?? [];
    serverKeys.forEach(key => syncedKeys.current.add(key));
    const parsed = serverKeys
      .map(parseStudiedKey)
      .filter((item): item is SelectedStructure => item !== null)
      .slice(0, MAX_LOCAL_HISTORY);
    if (parsed.length > 0) {
      hydrateHistory(parsed);
    }
  }, [status, userId, snapshotData, hydrateHistory]);

  useEffect(() => {
    if (status !== 'authenticated' || !user) return;
    const fresh = recentHistory
      .map(item => item.structureKey)
      .filter(key => !syncedKeys.current.has(key));
    if (fresh.length === 0) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      const batch = recentHistory
        .map(item => item.structureKey)
        .filter(key => !syncedKeys.current.has(key));
      if (batch.length === 0) return;
      mergeStudiedKeys(
        { keys: batch, bodyModel: selectedBodyModel },
        {
          onSuccess: data => {
            (data.studiedKeys ?? []).forEach(key => syncedKeys.current.add(key));
            batch.forEach(key => syncedKeys.current.add(key));
          },
        }
      );
    }, STUDIED_SYNC_DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
        const batch = recentHistory
          .map(item => item.structureKey)
          .filter(key => !syncedKeys.current.has(key));
        if (batch.length > 0) {
          batch.forEach(key => syncedKeys.current.add(key));
          mergeStudiedKeys(
            { keys: batch, bodyModel: selectedBodyModel },
            {
              onSuccess: data => {
                (data.studiedKeys ?? []).forEach(key => syncedKeys.current.add(key));
                batch.forEach(key => syncedKeys.current.add(key));
              },
            }
          );
        }
      }
    };
  }, [recentHistory, status, user, selectedBodyModel, mergeStudiedKeys]);

  return null;
}
