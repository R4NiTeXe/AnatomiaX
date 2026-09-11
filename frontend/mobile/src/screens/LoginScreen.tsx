import { useState } from 'react';
import type { JSX } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';

export default function LoginScreen(): JSX.Element {
  const { login, register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (mode: 'login' | 'register') => async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password, name.trim() || undefined);
      }
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container} testID="mobile-login-screen">
      <Text style={styles.title}>AnatomiaX</Text>
      <Text style={styles.subtitle}>Sign in to continue learning</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        testID="mobile-login-email"
      />
      <TextInput
        style={styles.input}
        placeholder="Name (register only)"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        testID="mobile-login-name"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        testID="mobile-login-password"
      />
      {error ? (
        <Text style={styles.error} testID="mobile-login-error">
          {error}
        </Text>
      ) : null}
      <View style={styles.row}>
        <Button title={busy ? '…' : 'Login'} onPress={submit('login')} disabled={busy} />
        <Button title={busy ? '…' : 'Register'} onPress={submit('register')} disabled={busy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', opacity: 0.7 },
  input: { borderWidth: 1, borderColor: '#888', borderRadius: 8, padding: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-evenly' },
  error: { color: '#b91c1c', textAlign: 'center' },
});
