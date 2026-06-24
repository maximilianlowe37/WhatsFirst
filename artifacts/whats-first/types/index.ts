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

export interface SurveillanceUsage {
  disabledThisMonth: number;
  month: number;
}

export interface BlockedApp {
  id: string;
  name: string;
}

export interface AppSettings {
  surveillanceEnabled: boolean;
  firstInterruptMinutes: number;
  graceMinutes: number;
  blockedApps: BlockedApp[];
  maxBypassPerMonth: number;
  maxSurveillanceDisablesPerMonth: number;
  notificationsEnabled: boolean;
}

export type FilterOption = 'all' | 'today' | 'week' | 'urgent' | 'subtasks';
