import { useState } from 'react';
import type { JSX } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import type { AnatomySelection } from '@anatomiax/shared-types';
import { ApiError } from '../api/client';
import MobileAnatomyStage from '../anatomy/MobileAnatomyStage';
import QueryState from '../components/QueryState';
import { useMergeStudied, useProgressSnapshot } from '../hooks/useLearning';

/**
 * Learning screen: production 3D stage (male, one resident system) composed
 * with progress integration through the existing learning hooks. Tapping a
 * structure selects it; marking it studied persists via the progress API.
 */
export default function LearningScreen(): JSX.Element {
  const [selection, setSelection] = useState<AnatomySelection | null>(null);
  const [studyNote, setStudyNote] = useState<string | null>(null);

  const snapshot = useProgressSnapshot();
  const merge = useMergeStudied();

  const studied = snapshot.data?.studiedKeys ?? [];

  const markStudied = () => {
    if (!selection) return;
    setStudyNote(null);
    merge.mutate(
      { keys: [selection.structureKey], bodyModel: selection.bodyModel },
      {
        onSuccess: () => setStudyNote(`Saved ${selection.name} to your progress.`),
        onError: err =>
          setStudyNote(err instanceof ApiError ? err.message : 'Could not save progress.'),
      }
    );
  };

  return (
    <View style={styles.container} testID="mobile-learning-screen">
      <Text style={styles.title}>Learn</Text>
      <Text testID="mobile-learning-bodymodel">Male body model · more models later</Text>

      <MobileAnatomyStage onSelectionChange={setSelection} />

      {selection ? (
        <View style={styles.card} testID="mobile-studied-action">
          <Button
            title={merge.isPending ? 'Saving…' : `Mark studied: ${selection.name}`}
            onPress={markStudied}
            disabled={merge.isPending}
            testID="mobile-studied-save"
          />
          {studyNote ? (
            <Text style={styles.note} testID="mobile-studied-note">
              {studyNote}
            </Text>
          ) : null}
        </View>
      ) : null}

      <QueryState
        isLoading={snapshot.isLoading}
        error={snapshot.error}
        onRetry={() => void snapshot.refetch()}
      >
        <View style={styles.card} testID="mobile-snapshot">
          <Text style={styles.heading}>Studied ({studied.length})</Text>
          {studied.slice(0, 5).map(key => (
            <Text key={key} style={styles.rowSub}>
              {key}
            </Text>
          ))}
        </View>
      </QueryState>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  card: { borderWidth: 1, borderColor: '#888', borderRadius: 8, padding: 12, gap: 8 },
  heading: { fontWeight: '600' },
  rowSub: { opacity: 0.7, fontSize: 12 },
  note: { opacity: 0.7 },
});
