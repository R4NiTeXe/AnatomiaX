import { useState } from 'react';
import type { JSX } from 'react';
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { AnatomyBodyModelKey } from '@anatomiax/shared-types';
import { ApiError } from '../api/client';
import { buildPracticeAnswers } from '../api/progress';
import QueryState from '../components/QueryState';
import { useQuizAttempts, useSubmitQuizAttempt } from '../hooks/useLearning';

/**
 * Quiz history: lists persisted attempts and records a self-scored practice
 * result (counts only — no anatomy claims are fabricated).
 */
export default function QuizHistoryScreen(): JSX.Element {
  const [bodyModel] = useState<AnatomyBodyModelKey>('male');
  const [total, setTotal] = useState('5');
  const [correct, setCorrect] = useState('4');
  const [formError, setFormError] = useState<string | null>(null);

  const attempts = useQuizAttempts();
  const submit = useSubmitQuizAttempt();

  const submitPractice = () => {
    const totalNum = Number.parseInt(total, 10);
    const scoreNum = Number.parseInt(correct, 10);
    if (!Number.isInteger(totalNum) || totalNum < 1 || totalNum > 100) {
      setFormError('Total must be a whole number between 1 and 100.');
      return;
    }
    if (!Number.isInteger(scoreNum) || scoreNum < 0 || scoreNum > totalNum) {
      setFormError('Correct must be a whole number between 0 and the total.');
      return;
    }
    setFormError(null);
    submit.mutate(
      {
        bodyModel,
        score: scoreNum,
        total: totalNum,
        answers: buildPracticeAnswers(scoreNum, totalNum),
        startedAt: new Date().toISOString(),
      },
      { onError: err => setFormError(err instanceof ApiError ? err.message : 'Submit failed.') }
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container} testID="mobile-history-screen">
      <Text style={styles.title}>Quiz History</Text>

      <View style={styles.card} testID="mobile-practice-form">
        <Text style={styles.heading}>Record practice result</Text>
        <TextInput
          style={styles.input}
          placeholder="Total questions"
          value={total}
          onChangeText={setTotal}
          keyboardType="numeric"
          testID="mobile-practice-total"
        />
        <TextInput
          style={styles.input}
          placeholder="Correct answers"
          value={correct}
          onChangeText={setCorrect}
          keyboardType="numeric"
          testID="mobile-practice-correct"
        />
        {formError ? (
          <Text style={styles.error} testID="mobile-practice-error">
            {formError}
          </Text>
        ) : null}
        <Button
          title={submit.isPending ? 'Saving…' : 'Save result'}
          onPress={submitPractice}
          disabled={submit.isPending}
          testID="mobile-practice-save"
        />
      </View>

      <QueryState
        isLoading={attempts.isLoading}
        error={attempts.error}
        onRetry={() => void attempts.refetch()}
        isEmpty={(attempts.data?.length ?? 0) === 0 && !attempts.isLoading && !attempts.error}
        emptyText="No quiz attempts yet."
      >
        <View style={styles.list} testID="mobile-attempts-list">
          {(attempts.data ?? []).map(attempt => (
            <View key={attempt.id} style={styles.row} testID={`mobile-attempt-${attempt.id}`}>
              <Text style={styles.rowTitle}>
                {attempt.score}/{attempt.total} · {attempt.bodyModel}
              </Text>
              <Text style={styles.rowSub}>{attempt.completedAt}</Text>
            </View>
          ))}
        </View>
      </QueryState>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  card: { borderWidth: 1, borderColor: '#888', borderRadius: 8, padding: 12, gap: 8 },
  heading: { fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#888', borderRadius: 8, padding: 10 },
  error: { color: '#b91c1c' },
  list: { gap: 8 },
  row: { borderBottomWidth: 1, borderBottomColor: '#ddd', paddingVertical: 6 },
  rowTitle: { fontWeight: '600' },
  rowSub: { opacity: 0.7, fontSize: 12 },
});
