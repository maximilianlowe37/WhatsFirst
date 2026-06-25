// iOS Focus Filter support — runtime-side helpers.
//
// iOS 16+ lets any app register as a system Focus Filter via an Intents
// Extension. When the user enables "What's first?" in Settings > Focus >
// Add Filter, the extension runs and displays our top task in Lock Screen,
// Dynamic Island, and Control Center.
//
// This file does NOT contain the native extension itself — see
// FOCUS_FILTER_SETUP.md for the Xcode steps that produce that. Instead,
// it publishes the JSON payload the extension consumes (via an App Group
// shared UserDefaults / file) so that the extension always shows the
// freshest top task, and exposes a runtime check so the UI can hint to
// the user when the native setup is missing.
//
// Wire format (also documented in the extension's `IntentHandler.swift`):
//
//   {
//     "version": 1,
//     "updatedAt": "2025-01-01T00:00:00Z",
//     "topTask": {
//       "id": "abc123",
//       "title": "Reply to Youssef's email",
//       "urgency": "high",
//       "dueDate": "2025-01-01",
//       "subtaskCount": 0,
//       "completedSubtaskCount": 0
//     } | null,
//     "dueTodayCount": 3,
//     "surveillanceEnabled": true
//   }

import { Platform } from 'react-native';

import { Task, Urgency } from '@/types';
import { activeTasksDueToday } from '@/utils/focusNag';
import { getItem, setItem, STORAGE_KEYS } from '@/utils/storage';

export interface FocusFilterPayload {
  version: 1;
  updatedAt: string;
  topTask: {
    id: string;
    title: string;
    urgency: Urgency;
    dueDate: string;
    subtaskCount: number;
    completedSubtaskCount: number;
  } | null;
  dueTodayCount: number;
  surveillanceEnabled: boolean;
}

const URGENCY_RANK: Record<Urgency, number> = { high: 0, medium: 1, low: 2 };

function pickTopTask(due: Task[]): Task | null {
  if (due.length === 0) return null;
  // Earliest dueDate wins; ties broken by urgency; ties broken by createdAt asc.
  const sorted = [...due].sort((a, b) => {
    const d = a.dueDate.localeCompare(b.dueDate);
    if (d !== 0) return d;
    const u = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
    if (u !== 0) return u;
    return a.createdAt.localeCompare(b.createdAt);
  });
  return sorted[0] ?? null;
}

/**
 * Compute the current payload from the live task + settings state and
 * write it to AsyncStorage. The native extension reads from an App Group
 * (UserDefaults suite) that mirrors this key on the native side; until
 * the extension is installed this is a no-op write.
 *
 * Safe to call on every render — AsyncStorage writes are batched and
 * cheap.
 */
export async function writeFocusFilterPayload(
  tasks: Task[],
  surveillanceEnabled: boolean,
): Promise<FocusFilterPayload> {
  const due = activeTasksDueToday(tasks);
  const top = pickTopTask(due);
  const payload: FocusFilterPayload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    topTask: top
      ? {
          id: top.id,
          title: top.title,
          urgency: top.urgency,
          dueDate: top.dueDate,
          subtaskCount: top.subtasks.length,
          completedSubtaskCount: top.subtasks.filter((s) => s.isCompleted).length,
        }
      : null,
    dueTodayCount: due.length,
    surveillanceEnabled,
  };
  await setItem(STORAGE_KEYS.FOCUS_FILTER_PAYLOAD, payload);
  return payload;
}

export async function readFocusFilterPayload(): Promise<FocusFilterPayload | null> {
  return getItem<FocusFilterPayload | null>(STORAGE_KEYS.FOCUS_FILTER_PAYLOAD, null);
}

export interface FocusFilterStatus {
  /** True when the runtime supports registering a focus filter. */
  platformSupported: boolean;
  /** True on iOS 16+ — older iOS can't show the filter in Lock Screen. */
  osSupported: boolean;
  /** True when a payload has been written at least once. */
  payloadWritten: boolean;
}

/**
 * Best-effort runtime status. We can't detect from JS whether the native
 * Intents Extension is actually installed (it's a separate binary). The
 * extension is "configured" when the user enables it in Settings > Focus
 * — that's also invisible from JS.
 *
 * So we expose what we CAN know and let the UI show a hint card pointing
 * at FOCUS_FILTER_SETUP.md when setup is incomplete.
 */
export async function getFocusFilterStatus(): Promise<FocusFilterStatus> {
  const platformSupported = Platform.OS === 'ios';
  // iOS 16 maps to major version 16. We don't have access to Platform.Version
  // type narrowing in the standard RN API, so we coerce.
  const osSupported =
    platformSupported && parseInt(String(Platform.Version ?? '0'), 10) >= 16;
  const payload = await readFocusFilterPayload();
  return {
    platformSupported,
    osSupported,
    payloadWritten: payload !== null,
  };
}