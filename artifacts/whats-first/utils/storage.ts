// AsyncStorage wrapper with JSON parse/stringify and default value fallback.
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function getItem<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

export async function setItem<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export async function removeItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
}

export const STORAGE_KEYS = {
  TASKS: 'wf_tasks',
  BYPASS: 'wf_bypass',
  SETTINGS: 'wf_settings',
  SURVEILLANCE_USAGE: 'wf_surveillance_usage',
  PUSH_TOKEN: 'wf_push_token',
  FOCUS_NAG_ID: 'wf_focus_nag_id',
  FOCUS_SUPPRESSED_UNTIL: 'wf_focus_suppressed_until',
  FOCUS_FILTER_PAYLOAD: 'wf_focus_filter_payload',
  NATIVE_BLOCKED_TOKENS: 'wf_native_blocked_tokens',
} as const;
