import { useState } from 'react';
import type { JSX } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';

function friendlyError(error: unknown): string {
  if (error instanceof ApiError && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}

export default function RegisterScreen(): JSX.Element {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await register(email.trim(), password, name.trim() || undefined);
      setPassword('');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container} testID="mobile-register-screen">
      <Text style={styles.title}>Create account</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        testID="mobile-register-email"
      />
      <TextInput
        style={styles.input}
        placeholder="Name (optional)"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        testID="mobile-register-name"
      />
      <TextInput
        style={styles.input}
        placeholder="Password (min 8 characters)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        testID="mobile-register-password"
      />
      {error ? (
        <Text style={styles.error} testID="mobile-register-error">
          {error}
        </Text>
      ) : null}
      <Button
        title={busy ? 'Creating…' : 'Register'}
        onPress={() => void submit()}
        disabled={busy}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#888', borderRadius: 8, padding: 12 },
  error: { color: '#b91c1c', textAlign: 'center' },
});
