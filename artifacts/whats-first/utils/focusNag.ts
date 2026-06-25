// Focus Mode enforcement — pure helpers (no side effects, no React).
// Used by contexts/FocusContext.tsx and components/FocusStatusPill.tsx.

import { AppSettings, FocusMessageStyle, Task } from '@/types';
import { todayISO } from '@/utils/dateHelpers';

export const MIN_NAG_MINUTES = 5;
export const MAX_NAG_MINUTES = 60;
export const NAG_STEP_MINUTES = 5;
export const DEFAULT_NAG_MINUTES = 20;

/**
 * Returns true when the user is in a state where we should be issuing
 * silent focus-reminder notifications. All four conditions must hold:
 *
 *   1. Notifications are globally enabled (`settings.notificationsEnabled`)
 *   2. Surveillance is on (no use nagging while user disabled the system)
 *   3. The nag cadence is at least MIN_NAG_MINUTES
 *   4. There are more than `lowNagLimit` active tasks due today
 *   5. We're not currently inside a Free Pass suppression window
 */
export function shouldNag(
  settings: AppSettings,
  activeTasksDueToday: Task[],
  suppressedUntil: number | null,
  now: number = Date.now(),
): boolean {
  if (!settings.notificationsEnabled) return false;
  if (settings.focusNagMinutes < MIN_NAG_MINUTES) return false;
  if (activeTasksDueToday.length <= settings.lowNagLimit) return false;
  if (suppressedUntil !== null && suppressedUntil > now) return false;
  return true;
}

/** Active tasks (status === 'active') whose dueDate equals today's ISO date. */
export function activeTasksDueToday(tasks: Task[]): Task[] {
  const today = todayISO();
  return tasks.filter((t) => t.status === 'active' && t.dueDate === today);
}

export function nagIntervalSeconds(minutes: number): number {
  // Floor to a whole minute — expo-notifications TIME_INTERVAL triggers only
  // accept whole seconds but iOS/Android batch fire notifications to the minute
  // boundary, so anything sub-minute is wasted precision.
  return Math.max(1, Math.round(minutes * 60));
}

/**
 * Pick the body text for a focus nag notification. Kept short so it fits
 * the iOS lock-screen line budget.
 */
export function nagBody(count: number, style: FocusMessageStyle): string {
  switch (style) {
    case 'minimal':
      return `📵 ${count} task${count !== 1 ? 's' : ''} open.`;
    case 'custom':
      return `📵 ${count} waiting — pick one and start.`;
    case 'motivational':
    default:
      return `📵 ${count} task${count !== 1 ? 's' : ''} waiting. What's first?`;
  }
}

export const NAG_TITLE = "🎯 What's first?";

/**
 * Clamp a value into the valid nag-minute range. Used by the settings
 * CounterRow to guard against the user dragging below MIN_NAG_MINUTES.
 */
export function clampNagMinutes(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_NAG_MINUTES;
  const clamped = Math.min(MAX_NAG_MINUTES, Math.max(MIN_NAG_MINUTES, value));
  // Snap to step so the slider stays clean.
  const snapped = Math.round((clamped - MIN_NAG_MINUTES) / NAG_STEP_MINUTES) * NAG_STEP_MINUTES + MIN_NAG_MINUTES;
  return Math.min(MAX_NAG_MINUTES, Math.max(MIN_NAG_MINUTES, snapped));
}