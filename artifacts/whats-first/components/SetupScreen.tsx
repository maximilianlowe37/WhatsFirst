// First-time setup screen — shown once on first launch via SetupGate in _layout.tsx.
// User configures all preferences before reaching the main app.
// CHANGE 1: Title + subtitle explain monthly lock. "Get started" calls saveSettings.
import React, { useState } from 'react';
import {
  ActionSheetIOS, Alert, FlatList, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Switch, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useSettings } from '@/contexts/SettingsContext';
import { AppSettings, BlockedApp, FocusMessageStyle } from '@/types';
import {
  MAX_NAG_MINUTES,
  MIN_NAG_MINUTES,
} from '@/utils/focusNag';

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

const POPULAR_APPS = [
  'TikTok', 'Instagram', 'YouTube', 'Facebook', 'Twitter/X', 'Snapchat',
  'Reddit', 'Twitch', 'Netflix', 'BeReal', 'LinkedIn', 'Pinterest',
  'Spotify', 'Discord', 'WhatsApp',
];

// ─── Local UI building blocks ──────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text style={[s.cardTitle, { color: c.mutedForeground }]}>{title}</Text>
      {children}
    </View>
  );
}

function CounterRow({ label, subtitle, value, min, max, onChange }: {
  label: string; subtitle?: string; value: number; min: number; max: number;
  onChange: (v: number) => void;
}) {
  const c = useColors();
  return (
    <View style={[s.row, { borderTopColor: c.border }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.rowLabel, { color: c.foreground }]}>{label}</Text>
        {subtitle ? <Text style={[s.rowSub, { color: c.mutedForeground }]}>{subtitle}</Text> : null}
      </View>
      <View style={s.counterControls}>
        <Pressable style={[s.counterBtn, { backgroundColor: c.surface, borderColor: c.border }]} onPress={() => { if (value > min) onChange(value - 1); }}>
          <Feather name="minus" size={16} color={value <= min ? c.mutedForeground : c.foreground} />
        </Pressable>
        <Text style={[s.counterValue, { color: c.foreground }]}>{value}</Text>
        <Pressable style={[s.counterBtn, { backgroundColor: c.surface, borderColor: c.border }]} onPress={() => { if (value < max) onChange(value + 1); }}>
          <Feather name="plus" size={16} color={value >= max ? c.mutedForeground : c.foreground} />
        </Pressable>
      </View>
    </View>
  );
}

function StepRow({ label, value, min, max, step, unit = 'min', onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit?: string;
  onChange: (v: number) => void;
}) {
  const c = useColors();
  const steps = Math.round((max - min) / step);
  const currentStep = Math.round((value - min) / step);
  return (
    <View style={[s.stepRowContainer, { borderTopColor: c.border }]}>
      <View style={s.stepLabelRow}>
        <Text style={[s.rowLabel, { color: c.foreground }]}>{label}</Text>
        <Text style={[s.stepValueText, { color: c.primary }]}>{value} {unit}</Text>
      </View>
      <View style={s.stepControls}>
        <Pressable style={[s.stepBtn, { backgroundColor: c.surface, borderColor: c.border }]} onPress={() => { if (value > min) onChange(Math.max(min, value - step)); }}>
          <Feather name="minus" size={18} color={value <= min ? c.mutedForeground : c.foreground} />
        </Pressable>
        <View style={[s.track, { backgroundColor: c.surface }]}>
          <View style={[s.fill, { width: `${(currentStep / steps) * 100}%` as any, backgroundColor: c.primary }]} />
        </View>
        <Pressable style={[s.stepBtn, { backgroundColor: c.surface, borderColor: c.border }]} onPress={() => { if (value < max) onChange(Math.min(max, value + step)); }}>
          <Feather name="plus" size={18} color={value >= max ? c.mutedForeground : c.foreground} />
        </Pressable>
      </View>
    </View>
  );
}

function ToggleRow({ label, subtitle, value, onChange }: {
  label: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  const c = useColors();
  return (
    <View style={[s.row, { borderTopColor: c.border }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.rowLabel, { color: c.foreground }]}>{label}</Text>
        {subtitle ? <Text style={[s.rowSub, { color: c.mutedForeground }]}>{subtitle}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: '#333', true: '#6366F1' }} thumbColor="#fff" />
    </View>
  );
}

function MessageStyleRow({ value, onChange }: { value: FocusMessageStyle; onChange: (v: FocusMessageStyle) => void }) {
  const c = useColors();
  const OPTIONS: { key: FocusMessageStyle; label: string }[] = [
    { key: 'motivational', label: 'Motivational' },
    { key: 'minimal', label: 'Minimal' },
    { key: 'custom', label: 'Direct' },
  ];
  return (
    <View style={[s.row, { borderTopColor: c.border, flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
      <Text style={[s.rowLabel, { color: c.foreground }]}>Nag style</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {OPTIONS.map((opt) => {
          const active = opt.key === value;
          return (
            <Pressable key={opt.key} style={[s.segment, { backgroundColor: active ? c.primary : 'transparent', borderColor: active ? c.primary : c.border }]} onPress={() => onChange(opt.key)}>
              <Text style={[s.segmentText, { color: active ? '#fff' : c.mutedForeground }]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Main setup screen ─────────────────────────────────────────────────────────
export function SetupScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { settings, saveSettings } = useSettings();
  const isIOS = Platform.OS === 'ios';

  const [draft, setDraft] = useState<Partial<AppSettings>>({
    maxBypassPerMonth: settings.maxBypassPerMonth,
    focusNagMinutes: settings.focusNagMinutes,
    focusNagMessage: settings.focusNagMessage,
    firstInterruptMinutes: settings.firstInterruptMinutes,
    graceMinutes: settings.graceMinutes,
    lowNagLimit: settings.lowNagLimit,
    notificationsEnabled: settings.notificationsEnabled,
    blockedApps: [...settings.blockedApps],
  });
  const [appPickerVisible, setAppPickerVisible] = useState(false);

  function update(updates: Partial<AppSettings>) {
    setDraft((prev) => ({ ...prev, ...updates }));
  }

  function addLocalApp(name: string) {
    if (!name.trim()) return;
    const newApp: BlockedApp = { id: genId(), name: name.trim() };
    setDraft((prev) => ({ ...prev, blockedApps: [...(prev.blockedApps || []), newApp] }));
  }

  function removeLocalApp(id: string) {
    setDraft((prev) => ({ ...prev, blockedApps: (prev.blockedApps || []).filter((a) => a.id !== id) }));
  }

  function getAvailableApps() {
    const blocked = (draft.blockedApps || []).map((a) => a.name.toLowerCase());
    return POPULAR_APPS.filter((a) => !blocked.includes(a.toLowerCase()));
  }

  function showAppPicker() {
    const available = getAvailableApps();
    if (available.length === 0) {
      Alert.alert('All popular apps already added!');
      return;
    }
    if (isIOS) {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...available, 'Cancel'], cancelButtonIndex: available.length },
        (idx) => { if (idx < available.length) addLocalApp(available[idx]); }
      );
    } else {
      setAppPickerVisible(true);
    }
  }

  function handleGetStarted() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    saveSettings(draft);
  }

  const blockedApps = draft.blockedApps || [];
  const availableApps = getAvailableApps();

  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100, paddingHorizontal: 16, gap: 12 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={s.headerBlock}>
          <Ionicons name="checkmark-circle" size={40} color="#6366F1" />
          <Text style={[s.setupTitle, { color: c.foreground }]}>Set up What's first?</Text>
          <Text style={[s.setupSubtitle, { color: c.mutedForeground }]}>
            Configure your preferences. You can only change these on the 1st of each month.
          </Text>
        </View>

        {/* Static surveillance info */}
        <SectionCard title="Status">
          <View style={[s.row, { borderTopWidth: 0 }]}>
            <View style={[s.iconCircle, { backgroundColor: '#22C55E22' }]}>
              <Ionicons name="shield-checkmark" size={20} color="#22C55E" />
            </View>
            <View style={{ flex: 1, marginLeft: 10, gap: 2 }}>
              <Text style={[s.rowLabel, { color: c.foreground }]}>Surveillance active</Text>
              <Text style={[s.rowSub, { color: c.mutedForeground }]}>Managed automatically by What's first?</Text>
            </View>
          </View>
        </SectionCard>

        <SectionCard title="Free Passes">
          <CounterRow
            label="Free Passes per month"
            subtitle="How many surveillance bypasses you allow yourself"
            value={draft.maxBypassPerMonth ?? 2}
            min={1} max={10}
            onChange={(v) => update({ maxBypassPerMonth: v })}
          />
        </SectionCard>

        <SectionCard title="Focus reminders">
          <CounterRow
            label="Nag every"
            subtitle="How often to ping you while tasks are due"
            value={draft.focusNagMinutes ?? 20}
            min={MIN_NAG_MINUTES} max={MAX_NAG_MINUTES}
            onChange={(v) => update({ focusNagMinutes: v })}
          />
          <CounterRow
            label="Skip if fewer than"
            subtitle="Tasks due today below this count = no nag"
            value={draft.lowNagLimit ?? 0}
            min={0} max={10}
            onChange={(v) => update({ lowNagLimit: v })}
          />
          <MessageStyleRow value={draft.focusNagMessage ?? 'motivational'} onChange={(v) => update({ focusNagMessage: v })} />
        </SectionCard>

        <SectionCard title="Interrupt timing">
          <StepRow
            label="First alert after"
            value={draft.firstInterruptMinutes ?? 15}
            min={5} max={60} step={5}
            onChange={(v) => update({ firstInterruptMinutes: v })}
          />
          <StepRow
            label="Grace period between alerts"
            value={draft.graceMinutes ?? 5}
            min={2} max={15} step={1}
            onChange={(v) => update({ graceMinutes: v })}
          />
        </SectionCard>

        <SectionCard title="Notifications">
          <ToggleRow
            label="Task reminders"
            subtitle="Get reminded 1 hour before a task is due"
            value={draft.notificationsEnabled ?? true}
            onChange={(v) => update({ notificationsEnabled: v })}
          />
        </SectionCard>

        <SectionCard title="Apps to monitor">
          <View style={s.chipsRow}>
            {blockedApps.map((app) => (
              <View key={app.id} style={[s.chip, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Text style={[s.chipText, { color: c.foreground }]}>{app.name}</Text>
                <Pressable hitSlop={8} onPress={() => removeLocalApp(app.id)}>
                  <Feather name="x" size={13} color={c.mutedForeground} />
                </Pressable>
              </View>
            ))}
          </View>
          <Pressable style={[s.addAppToggle, { borderColor: c.border }]} onPress={showAppPicker}>
            <Feather name="plus" size={14} color={c.primary} />
            <Text style={[s.addAppToggleText, { color: c.primary }]}>Add app</Text>
          </Pressable>
        </SectionCard>
      </ScrollView>

      {/* Get started button — fixed at bottom */}
      <View style={[s.footer, { backgroundColor: c.background, borderTopColor: c.border, paddingBottom: insets.bottom + 16 }]}>
        <Pressable style={[s.getStartedBtn, { backgroundColor: c.primary }]} onPress={handleGetStarted}>
          <Text style={s.getStartedText}>Get started</Text>
        </Pressable>
      </View>

      {/* Android app picker */}
      <Modal visible={appPickerVisible} transparent animationType="slide" onRequestClose={() => setAppPickerVisible(false)}>
        <Pressable style={s.pickerOverlay} onPress={() => setAppPickerVisible(false)}>
          <Pressable style={[s.pickerSheet, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={[s.handle, { backgroundColor: c.border }]} />
            <Text style={[s.pickerTitle, { color: c.foreground }]}>Add an app to block</Text>
            <FlatList
              data={availableApps}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable style={[s.pickerItem, { borderBottomColor: c.border }]} onPress={() => { addLocalApp(item); setAppPickerVisible(false); }}>
                  <Text style={[s.pickerItemText, { color: c.foreground }]}>{item}</Text>
                  <Feather name="plus" size={16} color={c.primary} />
                </Pressable>
              )}
              ListEmptyComponent={<Text style={[s.pickerEmpty, { color: c.mutedForeground }]}>All popular apps already added</Text>}
            />
            <Pressable style={[s.pickerCancel, { backgroundColor: c.surface }]} onPress={() => setAppPickerVisible(false)}>
              <Text style={[s.pickerCancelText, { color: c.foreground }]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  headerBlock: { alignItems: 'center', gap: 10, paddingVertical: 12 },
  setupTitle: { fontSize: 26, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  setupSubtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
  cardTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, gap: 12 },
  rowLabel: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  rowSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  iconCircle: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  counterControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  counterBtn: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  counterValue: { fontSize: 22, fontFamily: 'Inter_700Bold', minWidth: 30, textAlign: 'center' },
  stepRowContainer: { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1 },
  stepLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  stepValueText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  stepControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  segment: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', borderWidth: 1.5 },
  segmentText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  addAppToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginBottom: 14, marginTop: 4, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', justifyContent: 'center' },
  addAppToggleText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  footer: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12 },
  getStartedBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  getStartedText: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#fff' },
  pickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  pickerSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, padding: 20, paddingBottom: 40, maxHeight: '70%' },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  pickerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1 },
  pickerItemText: { fontSize: 16, fontFamily: 'Inter_400Regular' },
  pickerEmpty: { textAlign: 'center', paddingVertical: 24, fontSize: 14, fontFamily: 'Inter_400Regular' },
  pickerCancel: { marginTop: 12, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  pickerCancelText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
