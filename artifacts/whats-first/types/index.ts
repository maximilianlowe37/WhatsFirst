// Shared TypeScript types for What's first?

export interface Subtask {
  id: string;
  title: string;
  isCompleted: boolean;
}

export type Urgency = 'low' | 'medium' | 'high';
export type TaskStatus = 'active' | 'completed' | 'cancelled';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  urgency: Urgency;
  dueDate: string; // YYYY-MM-DD
  createdAt: string;
  completedAt: string | null;
  subtasks: Subtask[];
  notificationId?: string | null;
}

export interface BypassData {
  usedThisMonth: number;
  month: number; // 0–11
}

export interface BlockedApp {
  id: string;
  name: string;
  /**
   * iOS bundle identifier returned by the FamilyControls FamilyActivityPicker.
   * Used by the native `expo-family-controls` module to shield the app.
   * Null/undefined on Android/web — those platforms use this only for display.
   */
  bundleId?: string | null;
}

export type FocusMessageStyle = 'motivational' | 'minimal' | 'custom';

export interface AppSettings {
  // CHANGE 1: setup + lock fields
  hasCompletedSetup: boolean;
  settingsLockedMonth: number; // 0–11 (-1 = never saved)
  settingsLockedYear: number;  // e.g. 2026
  // Surveillance is always active — no toggle (CHANGE 3)
  firstInterruptMinutes: number;
  graceMinutes: number;
  blockedApps: BlockedApp[];
  maxBypassPerMonth: number;
  notificationsEnabled: boolean;
  focusNagMinutes: number;
  focusNagMessage: FocusMessageStyle;
  lowNagLimit: number;
}

export type FilterOption = 'all' | 'today' | 'week' | 'urgent' | 'subtasks';
