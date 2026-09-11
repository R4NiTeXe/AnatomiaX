import type { JSX } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';

/** Minimal account screen — proves the authenticated identity from /me. */
export default function AccountScreen(): JSX.Element {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container} testID="mobile-account-screen">
      <Text style={styles.title}>Account</Text>
      <Text testID="mobile-account-email">Email: {user?.email ?? '—'}</Text>
      <Text testID="mobile-account-name">Name: {user?.name ?? '—'}</Text>
      <Text testID="mobile-account-role">Role: {user?.role ?? '—'}</Text>
      <View style={styles.spacer} />
      <Button title="Logout" onPress={() => void logout()} testID="mobile-logout-button" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  spacer: { height: 16 },
});
