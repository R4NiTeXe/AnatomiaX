import type { JSX, ReactNode } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../api/client';

interface QueryStateProps {
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  isEmpty?: boolean;
  emptyText?: string;
  children: ReactNode;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.message) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}

/** Consistent loading / error + retry / empty states for query screens. */
export default function QueryState({
  isLoading,
  error,
  onRetry,
  isEmpty = false,
  emptyText = 'Nothing here yet.',
  children,
}: QueryStateProps): JSX.Element {
  if (isLoading) {
    return (
      <View style={styles.center} testID="query-loading">
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center} testID="query-error">
        <Text style={styles.error} testID="query-error-message">
          {errorMessage(error)}
        </Text>
        <Button title="Retry" onPress={onRetry} testID="query-retry" />
      </View>
    );
  }
  if (isEmpty) {
    return (
      <View style={styles.center} testID="query-empty">
        <Text>{emptyText}</Text>
      </View>
    );
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  error: { color: '#b91c1c', textAlign: 'center' },
});
