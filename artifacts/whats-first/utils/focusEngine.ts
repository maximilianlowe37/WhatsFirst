// Focus nag engine — manages the single recurring local notification
// that reminds the user to come back to their tasks while surveillance
// is active.
//
// IMPORTANT: iOS caps pending scheduled notifications at 64 per app.
// We use ONE recurring notification, not N one-shots. Re-armed on
// every successful fire so the cadence persists across app restarts.
//
// Storage of the current notification id is what makes this resumable:
// - If the app crashes, on next launch we read the stored id and
//   check whether it's still scheduled. If so, do nothing. If not,
//   re-schedule using the latest settings.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { AppSettings, Task } from '@/types';
import {
  NAG_TITLE,
  activeTasksDueToday,
  nagBody,
  nagIntervalSeconds,
  shouldNag,
} from '@/utils/focusNag';
import { getItem, setItem, removeItem, STORAGE_KEYS } from '@/utils/storage';

/**
 * Schedule the recurring focus nag. Returns the Expo notification id,
 * or null if no nag was scheduled (e.g. notifications disabled, or
 * the interval was too short).
 *
 * Idempotent — calling this twice cancels the previous schedule first.
 */
export async function startFocusNag(
  settings: AppSettings,
  tasks: Task[],
): Promise<string | null> {
  const due = activeTasksDueToday(tasks);
  if (!shouldNag(settings, due, null)) return null;

  // Cancel any existing nag first so we don't end up with two schedules.
  await stopFocusNag();

  const seconds = nagIntervalSeconds(settings.focusNagMinutes);
  if (seconds < 60) {
    // Don't bother scheduling sub-minute reminders — Android throttles them
    // and iOS batches them anyway.
    return null;
  }

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: NAG_TITLE,
        body: nagBody(due.length, settings.focusNagMessage),
        sound: false,
        data: { kind: 'focus_nag' },
        // Silent notification trick: priority MIN on Android, no interruption
        // level change on iOS — it appears in the tray but doesn't ping.
        ...(Platform.OS === 'android' && {
          // expo-notifications AndroidPriority is an enum; we use the string
          // for cross-version compatibility. The constant value is -1.
          priority: 'min' as any,
        }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: true,
      },
    });

    await setItem(STORAGE_KEYS.FOCUS_NAG_ID, id);
    return id;
  } catch {
    return null;
  }
}

/**
 * Cancel the currently-scheduled focus nag, if any. Idempotent.
 */
export async function stopFocusNag(): Promise<void> {
  const stored = await getItem<string | null>(STORAGE_KEYS.FOCUS_NAG_ID, null);
  if (stored) {
    try {
      await Notifications.cancelScheduledNotificationAsync(stored);
    } catch {
      // Notification may already be gone (fired + auto-cleaned). That's fine.
    }
    await removeItem(STORAGE_KEYS.FOCUS_NAG_ID);
  }
}

/**
 * Returns true when we believe a focus nag is currently scheduled.
 * The check is best-effort: expo-notifications doesn't expose
 * getScheduledNotifications on web, and Android may purge silently.
 */
export async function isFocusNagActive(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const stored = await getItem<string | null>(STORAGE_KEYS.FOCUS_NAG_ID, null);
  return stored !== null;
}

/**
 * Compute the timestamp until which nag should be suppressed (Free Pass
 * window). Returns null when no suppression is active.
 */
export function computeSuppressedUntil(
  currentSuppressedUntil: number | null,
  now: number = Date.now(),
): number | null {
  if (currentSuppressedUntil === null) return null;
  if (currentSuppressedUntil <= now) return null;
  return currentSuppressedUntil;
}

export async function setSuppressedUntil(timestamp: number | null): Promise<void> {
  if (timestamp === null) {
    await removeItem(STORAGE_KEYS.FOCUS_SUPPRESSED_UNTIL);
  } else {
    await setItem(STORAGE_KEYS.FOCUS_SUPPRESSED_UNTIL, timestamp);
  }
}

export async function getSuppressedUntil(): Promise<number | null> {
  return getItem<number | null>(STORAGE_KEYS.FOCUS_SUPPRESSED_UNTIL, null);
}