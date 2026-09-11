import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import type { JSX } from 'react';
import { StyleSheet, View } from 'react-native';
import { AuthProvider } from './src/auth/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { queryClient } from './src/query/client';
// TEMPORARY SPIKE (8.19.29): env-gated entry, no navigation changes.
// Delete with src/spike/ after the architecture decision.
import MeshoptSpikeScreen from './src/spike/MeshoptSpikeScreen';

const SPIKE =
  typeof process !== 'undefined' &&
  (process.env as Record<string, string | undefined>).EXPO_PUBLIC_SPIKE === 'meshopt';

export default function App(): JSX.Element {
  if (SPIKE) {
    return (
      <View style={styles.root}>
        <StatusBar style="auto" />
        <MeshoptSpikeScreen />
      </View>
    );
  }
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <View style={styles.root}>
          <StatusBar style="auto" />
          <RootNavigator />
        </View>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
