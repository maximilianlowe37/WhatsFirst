// FocusStatusPill — small status chip shown in the header area.
// Surveillance is always active (CHANGE 3), so no surveillance-off guard.
// Three states:
//   1. nagActive: green "Focus on · next nudge in ~N min"
//   2. suppressed (Free Pass): amber "Focus paused · N min remaining"
//   3. otherwise (no nag): hidden (noise-free when nothing is due)
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useFocus } from '@/contexts/FocusContext';
import { useSettings } from '@/contexts/SettingsContext';

function formatRemaining(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 1) return '<1 min';
  if (minutes === 1) return '1 min';
  return `${minutes} min`;
}

export function FocusStatusPill() {
  const c = useColors();
  const { nagActive, dueTodayCount, suppressedUntil } = useFocus();
  const { settings } = useSettings();

  // Show nothing when user has no tasks due and focus isn't paused
  if (dueTodayCount === 0 && !nagActive && !suppressedUntil) return null;

  const suppressed = suppressedUntil !== null && suppressedUntil > Date.now();
  const remaining = suppressed ? (suppressedUntil as number) - Date.now() : 0;

  const bg = nagActive ? '#22C55E22' : suppressed ? '#F9731622' : c.surface;
  const border = nagActive ? '#22C55E55' : suppressed ? '#F9731655' : c.border;
  const fg = nagActive ? '#22C55E' : suppressed ? '#F97316' : c.mutedForeground;

  const label = nagActive
    ? `Focus on · next nudge in ~${settings.focusNagMinutes} min`
    : suppressed
      ? `Focus paused · ${formatRemaining(remaining)} remaining`
      : 'Focus off';

  const icon: keyof typeof Feather.glyphMap = nagActive
    ? 'crosshair'
    : suppressed
      ? 'pause-circle'
      : 'moon';

  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: border }]}>
      <Feather name={icon} size={12} color={fg} />
      <Text style={[styles.label, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  label: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.2,
  },
});
