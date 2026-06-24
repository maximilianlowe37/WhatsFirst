// FocusContext — orchestrates focus nag and Free Pass suppression.
//
// Lifecycle responsibilities:
//  1. On mount: hydrate `suppressedUntil` from AsyncStorage. If we have a
//     stale id stored for a focus nag that iOS may have purged, this is
//     fine — startFocusNag is idempotent and will re-schedule.
//  2. On every (settings, tasks, suppressedUntil) change: recompute
//     `nagActive` and start/stop the recurring notification accordingly.
//  3. When the user activates a Free Pass, suppress nag for
//     `settings.firstInterruptMinutes` minutes. When that window ends,
//     re-evaluate automatically.
//
// The context does NOT own the notification id (that's the engine's job);
// it just decides whether to call start or stop.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Task } from '@/types';
import { useSettings } from '@/contexts/SettingsContext';
import { useTasks } from '@/contexts/TasksContext';
import {
  activeTasksDueToday,
  shouldNag as shouldNagPure,
} from '@/utils/focusNag';
import {
  computeSuppressedUntil,
  getSuppressedUntil,
  setSuppressedUntil,
  startFocusNag,
  stopFocusNag,
} from '@/utils/focusEngine';

interface FocusContextValue {
  /** True when the recurring focus nag is currently scheduled. */
  nagActive: boolean;
  /** Active tasks due today — the count we show in the UI pill. */
  dueTodayCount: number;
  /** Timestamp (ms epoch) until which nag is suppressed by a Free Pass. */
  suppressedUntil: number | null;
  /** Activate the Free Pass suppression window. */
  suppressForMinutes: (minutes: number) => Promise<void>;
  /** Force-cancel any active suppression (used when surveillance is turned off). */
  clearSuppression: () => Promise<void>;
}

const FocusContext = createContext<FocusContextValue | null>(null);

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const { tasks } = useTasks();

  const [suppressedUntil, setSuppressedUntilState] = useState<number | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Track the last time we successfully (re)scheduled the nag. Used only for
  // diagnostics from the dev menu — not exposed in the UI.
  const lastScheduledAt = useRef<number | null>(null);

  // Hydrate suppressedUntil on mount.
  useEffect(() => {
    let cancelled = false;
    getSuppressedUntil().then((stored) => {
      if (cancelled) return;
      const fresh = computeSuppressedUntil(stored);
      setSuppressedUntilState(fresh);
      setIsHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Compute the derived state.
  const due = useMemo(() => activeTasksDueToday(tasks), [tasks]);
  const nagActive = useMemo(
    () => shouldNagPure(settings, due, suppressedUntil),
    [settings, due, suppressedUntil],
  );

  // Whenever nagActive flips, start/stop the recurring notification.
  // We depend on the individual settings fields that drive the engine so
  // changing the cadence re-schedules a fresh timer.
  useEffect(() => {
    if (!isHydrated) return;
    let cancelled = false;
    if (nagActive) {
      startFocusNag(settings, tasks).then((id) => {
        if (cancelled) return;
        if (id) lastScheduledAt.current = Date.now();
      });
    } else {
      stopFocusNag();
    }
    return () => {
      cancelled = true;
    };
    // We intentionally depend on settings (object) and tasks (object) so
    // any deep change re-evaluates. eslint-disable-line react-hooks/exhaustive-deps
  }, [
    nagActive,
    settings.focusNagMinutes,
    settings.focusNagMessage,
    settings.notificationsEnabled,
    settings.surveillanceEnabled,
    settings.lowNagLimit,
    tasks,
    isHydrated,
  ]);

  // Auto-clear stale suppression windows so the pill flips back to active
  // once the Free Pass expires — without needing the user to open the app.
  useEffect(() => {
    if (suppressedUntil === null) return;
    const remaining = suppressedUntil - Date.now();
    if (remaining <= 0) {
      setSuppressedUntilState(null);
      setSuppressedUntil(null);
      return;
    }
    const t = setTimeout(() => {
      setSuppressedUntilState(null);
      setSuppressedUntil(null);
    }, remaining);
    return () => clearTimeout(t);
  }, [suppressedUntil]);

  const suppressForMinutes = useCallback(
    async (minutes: number) => {
      const until = Date.now() + Math.max(1, minutes) * 60 * 1000;
      setSuppressedUntilState(until);
      await setSuppressedUntil(until);
      await stopFocusNag();
    },
    [],
  );

  const clearSuppression = useCallback(async () => {
    setSuppressedUntilState(null);
    await setSuppressedUntil(null);
  }, []);

  const value: FocusContextValue = useMemo(
    () => ({
      nagActive,
      dueTodayCount: due.length,
      suppressedUntil,
      suppressForMinutes,
      clearSuppression,
    }),
    [nagActive, due.length, suppressedUntil, suppressForMinutes, clearSuppression],
  );

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}

export function useFocus(): FocusContextValue {
  const ctx = useContext(FocusContext);
  if (!ctx) throw new Error('useFocus must be used within FocusProvider');
  return ctx;
}