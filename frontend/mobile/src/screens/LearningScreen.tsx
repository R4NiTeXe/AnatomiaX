import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import {
  ActivityIndicator,
  Button,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { AnatomySelection, AnatomySystemKey } from '@anatomiax/shared-types';
import {
  getAnatomyInformation,
  getAnatomyInformationByStructureKey,
  getRelatedAnatomyInformation,
  parseStudiedKey,
} from '@anatomiax/anatomy-core';
import { ApiError } from '../api/client';
import MobileAnatomyStage, { type StageStatus } from '../anatomy/MobileAnatomyStage';
import { useMergeStudied, useProgressSnapshot } from '../hooks/useLearning';
import { useAuth } from '../auth/AuthContext';

/**
 * Learning screen: polished native workflow around MobileAnatomyStage (8.19.37).
 * Male model only, supported systems <=5MB, one resident system, tap selection,
 * focus, native info with provenance + relationships, mark studied via progress
 * API, persisted snapshot, empty states, actionable retry, system-switch
 * isolation, auth isolation, demand rendering. No new anatomy data.
 */
export default function LearningScreen(): JSX.Element {
  const { user, status: authStatus } = useAuth();
  const [selection, setSelection] = useState<AnatomySelection | null>(null);
  const [studyNote, setStudyNote] = useState<string | null>(null);
  const [studyError, setStudyError] = useState<string | null>(null);
  const [stageSystem, setStageSystem] = useState<AnatomySystemKey>('skin');
  const [stageStatus, setStageStatus] = useState<StageStatus>('idle');

  const snapshot = useProgressSnapshot();
  const merge = useMergeStudied();

  const studied = snapshot.data?.studiedKeys ?? [];
  const info = selection ? getAnatomyInformation(selection) : undefined;
  const related = selection ? getRelatedAnatomyInformation(selection.structureKey) : [];
  const isStudied = selection ? studied.includes(selection.structureKey) : false;

  // Auth isolation: logout/login resets all learning-specific mobile state.
  const prevUserIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const prev = prevUserIdRef.current;
    const cur = user?.id;
    if (prev !== cur) {
      setSelection(null);
      setStudyNote(null);
      setStudyError(null);
      setStageSystem('skin');
      setStageStatus('idle');
      prevUserIdRef.current = cur;
    }
    if (authStatus === 'anonymous') {
      setSelection(null);
      setStudyNote(null);
      setStudyError(null);
      setStageSystem('skin');
      setStageStatus('idle');
    }
  }, [authStatus, user?.id]);

  const handleSelectionChange = (next: AnatomySelection | null): void => {
    setSelection(next);
    // Clear transient study messaging whenever selection changes (including
    // system-switch clearing where next is null).
    setStudyNote(null);
    setStudyError(null);
  };

  const handleSystemChange = (next: AnatomySystemKey): void => {
    setStageSystem(next);
    // Switching systems must not leak prior selection/info state.
    setSelection(null);
    setStudyNote(null);
    setStudyError(null);
  };

  const handleStatusChange = (nextStatus: StageStatus, nextSystem: AnatomySystemKey): void => {
    setStageStatus(nextStatus);
    setStageSystem(nextSystem);
    if (nextStatus === 'loading') {
      setSelection(null);
      setStudyNote(null);
      setStudyError(null);
    }
  };

  const markStudied = (): void => {
    if (!selection) return;
    setStudyNote(null);
    setStudyError(null);
    merge.mutate(
      { keys: [selection.structureKey], bodyModel: selection.bodyModel },
      {
        onSuccess: () =>
          setStudyNote(`Saved ${info?.canonicalName ?? selection.name} to your progress.`),
        onError: err =>
          setStudyError(err instanceof ApiError ? err.message : 'Could not save progress.'),
      }
    );
  };

  const isTransitionUnsafe = stageStatus === 'loading';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="mobile-learning-screen"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.title} testID="mobile-learning-title">
          Learn
        </Text>
        <Text style={styles.subtitle} testID="mobile-learning-subtitle">
          Explore human anatomy — tap any structure to focus and learn
        </Text>
        <Text style={styles.badge} testID="mobile-learning-bodymodel">
          Male body model · {stageSystem} · more models later
        </Text>
      </View>

      <View style={styles.stageWrap} testID="mobile-learning-stage-wrap">
        <MobileAnatomyStage
          key={`stage-${user?.id ?? 'anon'}`}
          onSelectionChange={handleSelectionChange}
          onSystemChange={handleSystemChange}
          onStatusChange={handleStatusChange}
        />
      </View>

      {/* Selected-structure information */}
      {selection ? (
        <View style={styles.card} testID="mobile-learning-info">
          <Text style={styles.cardTitle} testID="mobile-learning-info-name">
            {info?.canonicalName ?? selection.name}
          </Text>
          <Text style={styles.meta} testID="mobile-learning-info-meta">
            {selection.systemKey} · {selection.bodyModel}
            {selection.ontologyId ? ` · ${selection.ontologyId}` : ''}
          </Text>
          {info ? (
            <>
              <Text style={styles.description} testID="mobile-learning-info-description">
                {info.description}
              </Text>
              <Text style={styles.function} testID="mobile-learning-info-function">
                {info.function}
              </Text>
              <View style={styles.divider} />
              <View testID="mobile-learning-provenance">
                <Text style={styles.sectionLabel}>Source · provenance</Text>
                <Text style={styles.provenanceText} testID="mobile-learning-source">
                  {info.source}
                </Text>
                <Text style={styles.link} testID="mobile-learning-source-url" numberOfLines={2}>
                  {info.sourceUrl}
                </Text>
                <Text style={styles.provenanceText} testID="mobile-learning-last-verified">
                  Last verified: {info.lastVerified}
                </Text>
                {info.license ? (
                  <Text style={styles.provenanceText} testID="mobile-learning-license">
                    License: {info.license}
                  </Text>
                ) : null}
              </View>
              {related.length > 0 ? (
                <View style={styles.relations} testID="mobile-learning-relationships">
                  <Text style={styles.sectionLabel}>Relationships</Text>
                  <Text style={styles.relationsHint}>Verified relations for this structure</Text>
                  {related.map(r => (
                    <View
                      key={r.info.structureKey}
                      style={styles.relationRow}
                      testID="mobile-learning-relation-item"
                    >
                      <Text style={styles.relationKind}>{r.relation.replace('_', ' ')}</Text>
                      <Text style={styles.relationName}>{r.info.canonicalName}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.relations} testID="mobile-learning-relationships-empty">
                  <Text style={styles.sectionLabel}>Relationships</Text>
                  <Text style={styles.emptyText}>
                    No verified relationships for this structure.
                  </Text>
                </View>
              )}
            </>
          ) : (
            <Text style={styles.emptyText} testID="mobile-learning-info-unavailable">
              Verified information unavailable for this structure.
            </Text>
          )}

          <View style={styles.actionRow} testID="mobile-studied-action">
            <Pressable
              onPress={markStudied}
              disabled={merge.isPending || isTransitionUnsafe || isStudied}
              style={({ pressed }) => [
                styles.primaryBtn,
                (merge.isPending || isTransitionUnsafe || isStudied) && styles.primaryBtnDisabled,
                pressed && !merge.isPending && !isStudied && styles.primaryBtnPressed,
              ]}
              testID="mobile-studied-save"
              accessibilityState={{ disabled: merge.isPending || isTransitionUnsafe || isStudied }}
            >
              <Text
                style={[
                  styles.primaryBtnText,
                  (merge.isPending || isTransitionUnsafe || isStudied) &&
                    styles.primaryBtnTextDisabled,
                ]}
              >
                {isStudied
                  ? `Studied ✓ ${info?.canonicalName ?? selection.name}`
                  : merge.isPending
                    ? 'Saving…'
                    : `Mark studied: ${info?.canonicalName ?? selection.name}`}
              </Text>
            </Pressable>
            {isTransitionUnsafe ? (
              <Text style={styles.meta} testID="mobile-studied-disabled-hint">
                Finish loading {stageSystem} before saving.
              </Text>
            ) : null}
            {studyNote ? (
              <Text style={styles.success} testID="mobile-studied-note">
                {studyNote}
              </Text>
            ) : null}
            {studyError ? (
              <View style={styles.errorRow} testID="mobile-studied-error">
                <Text style={styles.error} testID="mobile-studied-error-message">
                  {studyError}
                </Text>
                <Button title="Retry" onPress={markStudied} testID="mobile-studied-retry" />
              </View>
            ) : null}
            {snapshot.error ? (
              <Text style={styles.errorInline} testID="mobile-learning-progress-sync-warning">
                Progress sync warning: {(snapshot.error as Error).message}
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={styles.emptyCard} testID="mobile-learning-empty">
          <Text style={styles.emptyTitle}>No structure selected</Text>
          <Text style={styles.emptyText}>
            Tap any highlighted structure in the 3D view above to see details, relationships, and
            save it to your progress.
          </Text>
          <Text style={styles.meta}>Tip: drag to orbit · tap again to deselect</Text>
        </View>
      )}

      {/* Progress / studied snapshot — non-blocking; 3D stays dominant */}
      <View style={styles.card} testID="mobile-snapshot">
        <View style={styles.rowBetween}>
          <Text style={styles.cardHeading}>Your progress</Text>
          <Text style={styles.meta} testID="mobile-snapshot-count">
            {studied.length} studied
          </Text>
        </View>

        {snapshot.isLoading ? (
          <View style={styles.inlineLoading} testID="mobile-snapshot-loading">
            <ActivityIndicator size="small" />
            <Text style={styles.meta}>Loading progress…</Text>
          </View>
        ) : snapshot.error ? (
          <View style={styles.errorRow} testID="mobile-snapshot-error">
            <Text style={styles.error} testID="mobile-snapshot-error-message">
              {snapshot.error instanceof Error
                ? snapshot.error.message
                : 'Could not load progress.'}
            </Text>
            <Button
              title="Retry"
              onPress={() => void snapshot.refetch()}
              testID="mobile-snapshot-retry"
            />
          </View>
        ) : studied.length === 0 ? (
          <Text style={styles.emptyText} testID="mobile-snapshot-empty">
            No studied structures yet — select a structure and tap Mark studied.
          </Text>
        ) : (
          <View style={styles.studiedList} testID="mobile-snapshot-list">
            {studied.slice(0, 8).map(key => {
              const parsed = parseStudiedKey(key);
              const viaInfo = getAnatomyInformationByStructureKey(key);
              const displayName = viaInfo?.canonicalName ?? parsed?.name ?? key;
              const systemLabel = parsed?.systemKey ?? '—';
              return (
                <View key={key} style={styles.studiedRow} testID="mobile-snapshot-item">
                  <Text style={styles.studiedName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Text style={styles.studiedMeta} numberOfLines={1}>
                    {systemLabel}
                  </Text>
                </View>
              );
            })}
            {studied.length > 8 ? (
              <Text style={styles.meta}>+{studied.length - 8} more</Text>
            ) : null}
          </View>
        )}
      </View>

      {/* Actionable error for asset failures is inside MobileAnatomyStage overlay; we surface a hint here only when stage is in error */}
      {stageStatus === 'error' ? (
        <View style={styles.errorRow} testID="mobile-learning-stage-error-hint">
          <Text style={styles.error}>
            3D asset failed to load for {stageSystem}. Use Retry in the viewer.
          </Text>
        </View>
      ) : null}

      <View style={styles.footerSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  header: { gap: 4 },
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, lineHeight: 18, color: '#475569' },
  badge: { fontSize: 11, opacity: 0.6, textTransform: 'capitalize' },
  stageWrap: { gap: 8 },
  card: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    backgroundColor: '#ffffff',
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  cardHeading: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  meta: { fontSize: 11, opacity: 0.6 },
  description: { fontSize: 14, lineHeight: 20, color: '#334155' },
  function: { fontSize: 13, lineHeight: 18, color: '#475569', fontStyle: 'italic' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#e2e8f0' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#64748b',
  },
  provenanceText: { fontSize: 12, color: '#475569' },
  link: { fontSize: 12, color: '#0ea5e9' },
  relations: { gap: 6, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 8 },
  relationsHint: { fontSize: 11, opacity: 0.5 },
  relationRow: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 2 },
  relationKind: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
    color: '#64748b',
    minWidth: 72,
  },
  relationName: { fontSize: 13, fontWeight: '500', color: '#0f172a', flex: 1 },
  actionRow: { gap: 8, paddingTop: 6 },
  primaryBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnDisabled: { backgroundColor: '#e2e8f0' },
  primaryBtnPressed: { opacity: 0.9 },
  primaryBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  primaryBtnTextDisabled: { color: '#64748b' },
  success: { fontSize: 12, color: '#0f766e', fontWeight: '600' },
  error: { color: '#b91c1c', fontSize: 12, fontWeight: '600', textAlign: 'left', flex: 1 },
  errorInline: { color: '#b91c1c', fontSize: 11, opacity: 0.9 },
  errorRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  inlineLoading: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 4 },
  emptyCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 16,
    gap: 8,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: '#334155' },
  emptyText: { fontSize: 12, lineHeight: 16, opacity: 0.6, textAlign: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  studiedList: { gap: 8 },
  studiedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  studiedName: { fontSize: 13, fontWeight: '500', color: '#0f172a', flex: 1 },
  studiedMeta: { fontSize: 11, color: '#64748b', textTransform: 'capitalize' },
  footerSpace: { height: 12 },
});
