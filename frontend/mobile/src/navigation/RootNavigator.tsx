import { useState } from 'react';
import type { JSX } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import AccountScreen from '../screens/AccountScreen';
import LearningScreen from '../screens/LearningScreen';
import LoginScreen from '../screens/LoginScreen';

type AppTab = 'account' | 'learn';

/**
 * Minimal navigation: unauthenticated users see login/register, authenticated
 * users switch between the account proof and the learning placeholder.
 * No navigation library yet — conditional rendering keeps this foundation tiny.
 */
export default function RootNavigator(): JSX.Element {
  const { status } = useAuth();
  const [tab, setTab] = useState<AppTab>('account');

  if (status === 'loading') {
    return (
      <View style={styles.center} testID="mobile-splash">
        <Text>AnatomiaX</Text>
      </View>
    );
  }

  if (status === 'anonymous') {
    return <LoginScreen />;
  }

  return (
    <View style={styles.root} testID="mobile-app-stack">
      <View style={styles.content}>
        {tab === 'account' ? <AccountScreen /> : <LearningScreen />}
      </View>
      <View style={styles.tabs} testID="mobile-tabs">
        <Button title="Account" onPress={() => setTab('account')} testID="mobile-tab-account" />
        <Button title="Learn" onPress={() => setTab('learn')} testID="mobile-tab-learn" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', justifyContent: 'space-evenly', paddingVertical: 12 },
});
