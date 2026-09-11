import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { JSX } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import AccountScreen from '../screens/AccountScreen';
import CohortDetailScreen from '../screens/CohortDetailScreen';
import CohortsScreen from '../screens/CohortsScreen';
import LearningScreen from '../screens/LearningScreen';
import LoginScreen from '../screens/LoginScreen';
import QuizHistoryScreen from '../screens/QuizHistoryScreen';
import RegisterScreen from '../screens/RegisterScreen';
import type { AppStackParamList, AuthStackParamList, TabsParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();
const Tabs = createBottomTabNavigator<TabsParamList>();

function AuthFlow(): JSX.Element {
  return (
    <AuthStack.Navigator>
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: 'Sign in' }} />
      <AuthStack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ title: 'Register' }}
      />
    </AuthStack.Navigator>
  );
}

function MainTabs(): JSX.Element {
  return (
    <Tabs.Navigator>
      <Tabs.Screen name="Cohorts" component={CohortsScreen} options={{ title: 'My Cohorts' }} />
      <Tabs.Screen name="Learn" component={LearningScreen} options={{ title: 'Learn' }} />
      <Tabs.Screen name="History" component={QuizHistoryScreen} options={{ title: 'History' }} />
      <Tabs.Screen name="Account" component={AccountScreen} options={{ title: 'Account' }} />
    </Tabs.Navigator>
  );
}

function AppFlow(): JSX.Element {
  return (
    <AppStack.Navigator>
      <AppStack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
      <AppStack.Screen
        name="CohortDetail"
        component={CohortDetailScreen}
        options={{ title: 'Cohort' }}
      />
    </AppStack.Navigator>
  );
}

/**
 * Minimal production-structured navigation: auth stack while anonymous,
 * tabbed app stack (with pushed detail screens) while authenticated.
 * Switching stacks unmounts the other flow, so no screen state leaks.
 */
export default function RootNavigator(): JSX.Element {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={styles.center} testID="mobile-splash">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>{status === 'anonymous' ? <AuthFlow /> : <AppFlow />}</NavigationContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
