import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

/** Unauthenticated flow. */
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

/** Main tabs for authenticated users. */
export type TabsParamList = {
  Cohorts: undefined;
  Learn: undefined;
  History: undefined;
  Account: undefined;
};

/** Authenticated flow: tabs plus pushed detail screens. */
export type AppStackParamList = {
  Tabs: undefined;
  CohortDetail: { cohortId: string };
};

export type CohortsScreenNav = CompositeNavigationProp<
  BottomTabNavigationProp<TabsParamList, 'Cohorts'>,
  NativeStackNavigationProp<AppStackParamList>
>;

export type CohortDetailRoute = RouteProp<AppStackParamList, 'CohortDetail'>;
