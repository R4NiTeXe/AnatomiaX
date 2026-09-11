import * as SecureStore from 'expo-secure-store';

/**
 * 8.19.26 secure credential storage.
 *
 * Access/refresh tokens live ONLY here (expo-secure-store: Keychain on iOS,
 * EncryptedSharedPreferences on Android). Never localStorage, never app
 * state, never UI props. This module is imported solely by `api/auth` —
 * screens and navigation must go through `AuthContext` and never see tokens.
 */

const ACCESS_TOKEN_KEY = 'anatomiax.accessToken';
const REFRESH_TOKEN_KEY = 'anatomiax.refreshToken';

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
}

export async function saveSession(accessToken: string, refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function loadAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

async function loadRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function loadSession(): Promise<StoredSession | null> {
  const [accessToken, refreshToken] = await Promise.all([loadAccessToken(), loadRefreshToken()]);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]).catch(() => undefined);
}
