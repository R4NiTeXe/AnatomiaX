import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import type { JSX } from 'react';
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError } from '../api/client';
import { canManageCohort } from '../api/cohorts';
import { useAuth } from '../auth/AuthContext';
import QueryState from '../components/QueryState';
import {
  useArchiveCohort,
  useCohort,
  useCohortMembers,
  useLeaveCohort,
  useRegenerateInvite,
  useRemoveCohortMember,
  useUpdateCohort,
} from '../hooks/useCohorts';
import type { CohortDetailRoute } from '../navigation/types';

export default function CohortDetailScreen(): JSX.Element {
  const route = useRoute<CohortDetailRoute>();
  const { cohortId } = route.params;
  const { user } = useAuth();

  const cohort = useCohort(cohortId);
  const members = useCohortMembers(cohortId);
  const leave = useLeaveCohort();
  const update = useUpdateCohort();
  const archive = useArchiveCohort();
  const regen = useRegenerateInvite();
  const removeMember = useRemoveCohortMember();

  const [name, setName] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const view = cohort.data ?? null;
  const manager = canManageCohort(view, user?.role);
  const archived = view?.archivedAt != null;

  const fail = (err: unknown) =>
    setActionError(err instanceof ApiError ? err.message : 'Action failed.');

  return (
    <ScrollView contentContainerStyle={styles.container} testID="mobile-cohort-detail">
      <QueryState
        isLoading={cohort.isLoading}
        error={cohort.error}
        onRetry={() => void cohort.refetch()}
      >
        {view ? (
          <View style={styles.card}>
            <Text style={styles.title}>{view.name}</Text>
            <Text>Role: {view.myRole ?? 'MEMBER'}</Text>
            {view.institutionLabel ? <Text>Institution: {view.institutionLabel}</Text> : null}
            {archived ? (
              <Text style={styles.archived} testID="mobile-cohort-archived">
                Archived — read only.
              </Text>
            ) : null}
          </View>
        ) : null}
      </QueryState>

      {actionError ? (
        <Text style={styles.error} testID="mobile-cohort-action-error">
          {actionError}
        </Text>
      ) : null}

      <Text style={styles.heading}>Members</Text>
      <QueryState
        isLoading={members.isLoading}
        error={members.error}
        onRetry={() => void members.refetch()}
        isEmpty={(members.data?.length ?? 0) === 0 && !members.isLoading && !members.error}
        emptyText="No members found."
      >
        <View style={styles.list} testID="mobile-cohort-members">
          {(members.data ?? []).map(member => (
            <View key={member.userId} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{member.name ?? member.userId}</Text>
                <Text style={styles.rowSub}>{member.role}</Text>
              </View>
              {manager && !archived && member.userId !== user?.id ? (
                <Button
                  title="Remove"
                  onPress={() => {
                    setActionError(null);
                    removeMember.mutate({ cohortId, userId: member.userId }, { onError: fail });
                  }}
                  testID={`mobile-member-remove-${member.userId}`}
                />
              ) : null}
            </View>
          ))}
        </View>
      </QueryState>

      {!archived ? (
        <View style={styles.card} testID="mobile-cohort-leave">
          <Button
            title={leave.isPending ? 'Leaving…' : 'Leave cohort'}
            onPress={() => {
              setActionError(null);
              leave.mutate(cohortId, { onError: fail });
            }}
            disabled={leave.isPending}
            testID="mobile-cohort-leave-button"
          />
        </View>
      ) : null}

      {manager && !archived ? (
        <View style={styles.card} testID="mobile-cohort-manage">
          <Text style={styles.heading}>Manage</Text>
          <TextInput
            style={styles.input}
            placeholder="New name"
            value={name}
            onChangeText={setName}
            testID="mobile-cohort-rename"
          />
          <Button
            title="Rename"
            onPress={() => {
              setActionError(null);
              update.mutate(
                { id: cohortId, input: { name: name.trim() } },
                { onSuccess: () => setName(''), onError: fail }
              );
            }}
            disabled={update.isPending || name.trim().length === 0}
            testID="mobile-cohort-rename-button"
          />
          <Button
            title="New invite code"
            onPress={() => {
              setActionError(null);
              regen.mutate(cohortId, { onError: fail });
            }}
            disabled={regen.isPending}
            testID="mobile-cohort-regen-button"
          />
          {regen.data ? (
            <Text selectable testID="mobile-cohort-invite-code">
              Invite: {regen.data.inviteCode}
            </Text>
          ) : null}
          <Button
            title="Archive cohort"
            onPress={() => {
              setActionError(null);
              archive.mutate(cohortId, { onError: fail });
            }}
            disabled={archive.isPending}
            testID="mobile-cohort-archive-button"
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  card: { borderWidth: 1, borderColor: '#888', borderRadius: 8, padding: 12, gap: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  heading: { fontWeight: '600', fontSize: 16 },
  archived: { color: '#b45309', fontWeight: '600' },
  error: { color: '#b91c1c' },
  input: { borderWidth: 1, borderColor: '#888', borderRadius: 8, padding: 10 },
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowText: { flex: 1 },
  rowTitle: { fontWeight: '600' },
  rowSub: { opacity: 0.7, fontSize: 12 },
});
