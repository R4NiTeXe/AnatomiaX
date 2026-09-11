import { useState } from 'react';
import type { JSX } from 'react';
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ApiError } from '../api/client';
import { canCreateCohort } from '../api/cohorts';
import { useAuth } from '../auth/AuthContext';
import QueryState from '../components/QueryState';
import { useCreateCohort, useJoinCohort, useMyCohorts } from '../hooks/useCohorts';
import type { CohortsScreenNav } from '../navigation/types';

export default function CohortsScreen(): JSX.Element {
  const navigation = useNavigation<CohortsScreenNav>();
  const { user } = useAuth();
  const cohorts = useMyCohorts();
  const create = useCreateCohort();
  const join = useJoinCohort();

  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const teacher = canCreateCohort(user?.role);

  const submitCreate = () => {
    setFormError(null);
    create.mutate(
      { name: name.trim(), institutionLabel: institution.trim() || undefined },
      {
        onSuccess: () => {
          setName('');
          setInstitution('');
        },
        onError: err => setFormError(err instanceof ApiError ? err.message : 'Create failed.'),
      }
    );
  };

  const submitJoin = () => {
    setFormError(null);
    join.mutate(inviteCode.trim(), {
      onSuccess: () => setInviteCode(''),
      onError: err => setFormError(err instanceof ApiError ? err.message : 'Join failed.'),
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container} testID="mobile-cohorts-screen">
      <Text style={styles.title}>My Cohorts</Text>

      {teacher ? (
        <View style={styles.card} testID="mobile-cohort-create">
          <Text style={styles.heading}>Create cohort</Text>
          <TextInput
            style={styles.input}
            placeholder="Cohort name"
            value={name}
            onChangeText={setName}
            testID="mobile-cohort-name"
          />
          <TextInput
            style={styles.input}
            placeholder="Institution (optional)"
            value={institution}
            onChangeText={setInstitution}
            testID="mobile-cohort-institution"
          />
          <Button
            title={create.isPending ? 'Creating…' : 'Create'}
            onPress={submitCreate}
            disabled={create.isPending || name.trim().length === 0}
            testID="mobile-cohort-create-button"
          />
        </View>
      ) : null}

      <View style={styles.card} testID="mobile-cohort-join">
        <Text style={styles.heading}>Join with invite code</Text>
        <TextInput
          style={styles.input}
          placeholder="Invite code"
          value={inviteCode}
          onChangeText={setInviteCode}
          autoCapitalize="none"
          testID="mobile-cohort-invite"
        />
        <Button
          title={join.isPending ? 'Joining…' : 'Join'}
          onPress={submitJoin}
          disabled={join.isPending || inviteCode.trim().length === 0}
          testID="mobile-cohort-join-button"
        />
      </View>

      {formError ? (
        <Text style={styles.error} testID="mobile-cohorts-form-error">
          {formError}
        </Text>
      ) : null}

      <QueryState
        isLoading={cohorts.isLoading}
        error={cohorts.error}
        onRetry={() => void cohorts.refetch()}
        isEmpty={(cohorts.data?.length ?? 0) === 0 && !cohorts.isLoading && !cohorts.error}
        emptyText="You are not in any cohort yet."
      >
        <View style={styles.list} testID="mobile-cohorts-list">
          {(cohorts.data ?? []).map(cohort => (
            <View key={cohort.id} style={styles.row} testID={`mobile-cohort-${cohort.id}`}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{cohort.name}</Text>
                <Text style={styles.rowSub}>
                  {cohort.myRole ?? 'MEMBER'}
                  {cohort.archivedAt ? ' · archived' : ''}
                </Text>
              </View>
              <Button
                title="View"
                onPress={() => navigation.navigate('CohortDetail', { cohortId: cohort.id })}
                testID={`mobile-cohort-view-${cohort.id}`}
              />
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowText: { flex: 1 },
  rowTitle: { fontWeight: '600' },
  rowSub: { opacity: 0.7, fontSize: 12 },
});
