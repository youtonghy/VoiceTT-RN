/**
 * Secure storage service for sensitive data like API keys.
 * Uses expo-secure-store for encrypted storage on mobile platforms
 * and falls back to AsyncStorage with warning on web.
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_PREFIX = '@agents/secure/';
const USE_SECURE_STORE = Platform.OS !== 'web';

/**
 * Securely store a value.
 * On mobile: Uses hardware-backed keychain/keystore
 * On web: Falls back to AsyncStorage (not encrypted)
 */
export async function secureSetItem(key: string, value: string): Promise<void> {
  const storageKey = STORAGE_PREFIX + key;

  if (USE_SECURE_STORE) {
    try {
      await SecureStore.setItemAsync(storageKey, value);
      return;
    } catch (error) {
      if (__DEV__) {
        console.warn('[SecureStorage] Failed to use secure store, falling back:', error);
      }
    }
  }

  // Fallback to AsyncStorage (not encrypted on web)
  if (__DEV__ && Platform.OS === 'web') {
    console.warn('[SecureStorage] Using unencrypted storage on web platform');
  }
  await AsyncStorage.setItem(storageKey, value);
}

/**
 * Retrieve a securely stored value.
 */
export async function secureGetItem(key: string): Promise<string | null> {
  const storageKey = STORAGE_PREFIX + key;

  if (USE_SECURE_STORE) {
    try {
      return await SecureStore.getItemAsync(storageKey);
    } catch (error) {
      if (__DEV__) {
        console.warn('[SecureStorage] Failed to read from secure store, trying fallback:', error);
      }
    }
  }

  // Fallback to AsyncStorage
  return await AsyncStorage.getItem(storageKey);
}

/**
 * Remove a securely stored value.
 */
export async function secureRemoveItem(key: string): Promise<void> {
  const storageKey = STORAGE_PREFIX + key;

  if (USE_SECURE_STORE) {
    try {
      await SecureStore.deleteItemAsync(storageKey);
      return;
    } catch (error) {
      if (__DEV__) {
        console.warn('[SecureStorage] Failed to delete from secure store:', error);
      }
    }
  }

  // Fallback to AsyncStorage
  await AsyncStorage.removeItem(storageKey);
}

/**
 * Store credentials securely as a JSON object.
 */
export async function secureSetCredentials(credentials: Record<string, string | undefined>): Promise<void> {
  const sanitized = Object.fromEntries(
    Object.entries(credentials).filter(([_, value]) => value !== undefined && value !== '')
  );

  if (Object.keys(sanitized).length === 0) {
    await secureRemoveItem('credentials');
    return;
  }

  await secureSetItem('credentials', JSON.stringify(sanitized));
}

/**
 * Retrieve credentials from secure storage.
 */
export async function secureGetCredentials(): Promise<Record<string, string> | null> {
  try {
    const json = await secureGetItem('credentials');
    if (!json) {
      return null;
    }

    const parsed = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    return parsed as Record<string, string>;
  } catch (error) {
    if (__DEV__) {
      console.warn('[SecureStorage] Failed to parse stored credentials:', error);
    }
    return null;
  }
}

/**
 * Clear all securely stored data.
 */
export async function secureClearAll(): Promise<void> {
  await secureRemoveItem('credentials');
}
