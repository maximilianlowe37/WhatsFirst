// Settings context — manages app settings with AsyncStorage persistence.
// CHANGE 1: Adds isSettingsUnlocked + saveSettings (commits draft + lock fields).
// CHANGE 3: Surveillance tracking removed — surveillance is always active.
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppSettings } from '@/types';
import { getItem, setItem, STORAGE_KEYS } from '@/utils/storage';

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

const DEFAULT_SETTINGS: AppSettings = {
  hasCompletedSetup: false,
  settingsLockedMonth: -1,
  settingsLockedYear: 0,
  firstInterruptMinutes: 15,
  graceMinutes: 5,
  blockedApps: [
    { id: 'tiktok', name: 'TikTok' },
    { id: 'instagram', name: 'Instagram' },
    { id: 'youtube', name: 'YouTube' },
  ],
  maxBypassPerMonth: 2,
  notificationsEnabled: true,
  focusNagMinutes: 20,
  focusNagMessage: 'motivational',
  lowNagLimit: 0,
};

// CHANGE 1: Settings are unlocked on first launch or on the 1st of any month.
// If today IS the 1st, it's always unlocked regardless of when they last saved.
function computeUnlocked(settings: AppSettings): boolean {
  if (!settings.hasCompletedSetup) return true;
  const now = new Date();
  return now.getDate() === 1;
}

interface SettingsContextValue {
  settings: AppSettings;
  isLoaded: boolean;
  isSettingsUnlocked: boolean;
  // updateSettings: internal updates (e.g. from BypassContext); does NOT set lock fields.
  updateSettings: (updates: Partial<AppSettings>) => void;
  // saveSettings: used on Settings/Setup save — commits draft AND sets lock fields + hasCompletedSetup.
  saveSettings: (updates: Partial<AppSettings>) => void;
  addBlockedApp: (name: string) => void;
  removeBlockedApp: (id: string) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    getItem<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS).then((stored) => {
      // Merge new default fields so existing users get new keys
      setSettings({ ...DEFAULT_SETTINGS, ...stored });
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

  // CHANGE 1: saveSettings commits all values AND stamps lock fields so the
  // screen stays unlocked for the rest of the 1st (or permanently for first setup).
  const saveSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings((prev) => {
      const now = new Date();
      const updated: AppSettings = {
        ...prev,
        ...updates,
        hasCompletedSetup: true,
        settingsLockedMonth: now.getMonth(),
        settingsLockedYear: now.getFullYear(),
      };
      setItem(STORAGE_KEYS.SETTINGS, updated);
      return updated;
    });
  }, []);

  const addBlockedApp = useCallback((name: string) => {
    if (!name.trim()) return;
    setSettings((prev) => {
      const newApp = { id: genId(), name: name.trim() };
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

  const isSettingsUnlocked = computeUnlocked(settings);

  return (
    <SettingsContext.Provider value={{
      settings, isLoaded, isSettingsUnlocked,
      updateSettings, saveSettings, addBlockedApp, removeBlockedApp,
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
