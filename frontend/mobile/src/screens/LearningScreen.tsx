import { useState } from 'react';
import type { JSX } from 'react';
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { AnatomyBodyModelKey } from '@anatomiax/shared-types';
import { ApiError } from '../api/client';
import QueryState from '../components/QueryState';
import { useMergeStudied, useProgressSnapshot } from '../hooks/useLearning';

const BODY_MODELS: AnatomyBodyModelKey[] = ['male', 'female'];

/**
 * Learning placeholder (no 3D viewer yet): shows the persisted snapshot and
 * merges studied keys additively. Domain types come from shared-types.
 */
export default function LearningScreen(): JSX.Element {
  const [bodyModel, setBodyModel] = useState<AnatomyBodyModelKey>('male');
  const [keysInput, setKeysInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const snapshot = useProgressSnapshot();
  const merge = useMergeStudied();

  const studied = snapshot.data?.studiedKeys ?? [];

  const submitMerge = () => {
    const keys = keysInput
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);
    if (keys.length === 0) return;
    setFormError(null);
    merge.mutate(
      { keys, bodyModel },
      {
        onSuccess: () => setKeysInput(''),
        onError: err => setFormError(err instanceof ApiError ? err.message : 'Update failed.'),
      }
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container} testID="mobile-learning-screen">
      <Text style={styles.title}>Learn</Text>
      <Text testID="mobile-learning-bodymodel">Body model: {bodyModel}</Text>
      <View style={styles.row}>
        {BODY_MODELS.map(model => (
          <View key={model} style={styles.button}>
            <Button
              title={model}
              onPress={() => setBodyModel(model)}
              testID={`mobile-learning-${model}`}
            />
          </View>
        ))}
      </View>

      <QueryState
        isLoading={snapshot.isLoading}
        error={snapshot.error}
        onRetry={() => void snapshot.refetch()}
      >
        <View style={styles.card} testID="mobile-snapshot">
          <Text style={styles.heading}>Studied ({studied.length})</Text>
          {studied.slice(0, 10).map(key => (
            <Text key={key} style={styles.rowSub}>
              {key}
            </Text>
          ))}
          {studied.length > 10 ? (
            <Text style={styles.rowSub}>…and {studied.length - 10} more</Text>
          ) : null}
        </View>
      </QueryState>

      <View style={styles.card}>
        <Text style={styles.heading}>Mark studied (comma-separated keys)</Text>
        <TextInput
          style={styles.input}
          placeholder="male:nervous:UBERON:0000955, …"
          value={keysInput}
          onChangeText={setKeysInput}
          autoCapitalize="none"
          testID="mobile-studied-input"
        />
        {formError ? (
          <Text style={styles.error} testID="mobile-studied-error">
            {formError}
          </Text>
        ) : null}
        <Button
          title={merge.isPending ? 'Saving…' : 'Save'}
          onPress={submitMerge}
          disabled={merge.isPending || keysInput.trim().length === 0}
          testID="mobile-studied-save"
        />
      </View>

      <Text style={styles.placeholder}>
        The interactive 3D anatomy viewer arrives in a later step.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 },
  button: { flex: 1 },
  card: { borderWidth: 1, borderColor: '#888', borderRadius: 8, padding: 12, gap: 8 },
  heading: { fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#888', borderRadius: 8, padding: 10 },
  error: { color: '#b91c1c' },
  rowSub: { opacity: 0.7, fontSize: 12 },
  placeholder: { opacity: 0.7 },
});
