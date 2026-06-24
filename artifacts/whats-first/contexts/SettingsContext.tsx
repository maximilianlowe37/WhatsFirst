// Settings context — manages app settings with AsyncStorage persistence.
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppSettings, BlockedApp } from '@/types';
import { getItem, setItem, STORAGE_KEYS } from '@/utils/storage';

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
};

interface SettingsContextValue {
  settings: AppSettings;
  isLoaded: boolean;
  updateSettings: (updates: Partial<AppSettings>) => void;
  addBlockedApp: (name: string) => void;
  removeBlockedApp: (id: string) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    getItem<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS).then((stored) => {
      setSettings(stored);
      setIsLoaded(true);
    });
  }, []);

  const persist = useCallback((updated: AppSettings) => {
    setSettings(updated);
    setItem(STORAGE_KEYS.SETTINGS, updated);
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

  return (
    <SettingsContext.Provider value={{ settings, isLoaded, updateSettings, addBlockedApp, removeBlockedApp }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
