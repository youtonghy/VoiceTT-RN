import AsyncStorage from '@react-native-async-storage/async-storage';

const PRO_STATUS_STORAGE_KEY = '@agents/pro-status';

let cachedStatus: boolean | null = null;

export async function getProStatus(): Promise<boolean> {
  if (cachedStatus !== null) {
    return cachedStatus;
  }
  const raw = await AsyncStorage.getItem(PRO_STATUS_STORAGE_KEY);
  cachedStatus = raw === 'true';
  return cachedStatus;
}

export async function setProStatus(nextStatus: boolean): Promise<void> {
  cachedStatus = nextStatus;
  await AsyncStorage.setItem(PRO_STATUS_STORAGE_KEY, nextStatus ? 'true' : 'false');
}

export async function clearProStatus(): Promise<void> {
  cachedStatus = false;
  await AsyncStorage.removeItem(PRO_STATUS_STORAGE_KEY);
}
