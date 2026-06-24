// Bypass (Free Pass) context — tracks monthly bypass usage with auto-reset.
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { BypassData } from '@/types';
import { getItem, setItem, STORAGE_KEYS } from '@/utils/storage';
import { currentMonthIndex } from '@/utils/dateHelpers';

const MAX_BYPASSES = 2;

const DEFAULT_BYPASS: BypassData = {
  usedThisMonth: 0,
  month: currentMonthIndex(),
};

interface BypassContextValue {
  usedThisMonth: number;
  remaining: number;
  canUse: boolean;
  useBypass: () => void;
}

const BypassContext = createContext<BypassContextValue | null>(null);

export function BypassProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<BypassData>(DEFAULT_BYPASS);

  useEffect(() => {
    getItem<BypassData>(STORAGE_KEYS.BYPASS, DEFAULT_BYPASS).then((stored) => {
      const currentMonth = currentMonthIndex();
      if (stored.month !== currentMonth) {
        // New month — reset counter
        const reset: BypassData = { usedThisMonth: 0, month: currentMonth };
        setData(reset);
        setItem(STORAGE_KEYS.BYPASS, reset);
      } else {
        setData(stored);
      }
    });
  }, []);

  const useBypass = useCallback(() => {
    setData((prev) => {
      const updated = { ...prev, usedThisMonth: Math.min(prev.usedThisMonth + 1, MAX_BYPASSES) };
      setItem(STORAGE_KEYS.BYPASS, updated);
      return updated;
    });
  }, []);

  const remaining = Math.max(0, MAX_BYPASSES - data.usedThisMonth);

  return (
    <BypassContext.Provider value={{
      usedThisMonth: data.usedThisMonth,
      remaining,
      canUse: remaining > 0,
      useBypass,
    }}>
      {children}
    </BypassContext.Provider>
  );
}

export function useBypass(): BypassContextValue {
  const ctx = useContext(BypassContext);
  if (!ctx) throw new Error('useBypass must be used within BypassProvider');
  return ctx;
}
