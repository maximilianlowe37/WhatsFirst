// Settings context — manages app settings + surveillance usage tracking with AsyncStorage persistence.
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppSettings, BlockedApp, SurveillanceUsage } from '@/types';
import { getItem, setItem, STORAGE_KEYS } from '@/utils/storage';
import { currentMonthIndex } from '@/utils/dateHelpers';

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

const DEFAULT_SETTINGS: AppSettings = {
  surveillanceEnabled: true,
  firstInterruptMinutes: 15,
  graceMinutes: 5,
  blockedApps: [
    { id: 'tiktok', name: 'TikTok' },
    { id: 'instagram', name: 'Instagram' },
    { id: 'youtube', name: 'YouTube' },
  ],
  maxBypassPerMonth: 2,
  maxSurveillanceDisablesPerMonth: 3,
  notificationsEnabled: true,
};

const DEFAULT_SURV_USAGE: SurveillanceUsage = {
  disabledThisMonth: 0,
  month: currentMonthIndex(),
};

interface SettingsContextValue {
  settings: AppSettings;
  isLoaded: boolean;
  updateSettings: (updates: Partial<AppSettings>) => void;
  addBlockedApp: (name: string) => void;
  removeBlockedApp: (id: string) => void;
  // Surveillance disable tracking (FIX 5)
  survUsage: SurveillanceUsage;
  surveillanceRemaining: number;
  canDisableSurveillance: boolean;
  trackSurveillanceDisable: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [survUsage, setSurvUsage] = useState<SurveillanceUsage>(DEFAULT_SURV_USAGE);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const currentMonth = currentMonthIndex();
    Promise.all([
      getItem<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS),
      getItem<SurveillanceUsage>(STORAGE_KEYS.SURVEILLANCE_USAGE, DEFAULT_SURV_USAGE),
    ]).then(([storedSettings, storedSurv]) => {
      // Merge in new default fields so existing users get the new settings
      setSettings({ ...DEFAULT_SETTINGS, ...storedSettings });
      // Reset surveillance usage if month changed
      if (storedSurv.month !== currentMonth) {
        const reset = { disabledThisMonth: 0, month: currentMonth };
        setSurvUsage(reset);
        setItem(STORAGE_KEYS.SURVEILLANCE_USAGE, reset);
      } else {
        setSurvUsage(storedSurv);
      }
      setIsLoaded(true);
    });
  }, []);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...updates };
      setItem(STORAGE_KEYS.SETTINGS, updated);
      return updated;
    });
  }, []);

  const addBlockedApp = useCallback((name: string) => {
    if (!name.trim()) return;
    setSettings((prev) => {
      const newApp: BlockedApp = { id: genId(), name: name.trim() };
      const updated = { ...prev, blockedApps: [...prev.blockedApps, newApp] };
      setItem(STORAGE_KEYS.SETTINGS, updated);
      return updated;
    });
  }, []);

  const removeBlockedApp = useCallback((id: string) => {
    setSettings((prev) => {
      const updated = { ...prev, blockedApps: prev.blockedApps.filter((a) => a.id !== id) };
      setItem(STORAGE_KEYS.SETTINGS, updated);
      return updated;
    });
  }, []);

  const trackSurveillanceDisable = useCallback(() => {
    setSurvUsage((prev) => {
      const updated = { ...prev, disabledThisMonth: prev.disabledThisMonth + 1 };
      setItem(STORAGE_KEYS.SURVEILLANCE_USAGE, updated);
      return updated;
    });
  }, []);

  const surveillanceRemaining = Math.max(
    0,
    settings.maxSurveillanceDisablesPerMonth - survUsage.disabledThisMonth
  );

  return (
    <SettingsContext.Provider value={{
      settings, isLoaded, updateSettings, addBlockedApp, removeBlockedApp,
      survUsage, surveillanceRemaining,
      canDisableSurveillance: surveillanceRemaining > 0,
      trackSurveillanceDisable,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
