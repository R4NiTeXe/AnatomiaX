import { StatusBar } from 'expo-status-bar';
import type { JSX } from 'react';
import { StyleSheet, View } from 'react-native';
import { AuthProvider } from './src/auth/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';

export default function App(): JSX.Element {
  return (
    <AuthProvider>
      <View style={styles.root}>
        <StatusBar style="auto" />
        <RootNavigator />
      </View>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
