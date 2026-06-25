// Settings screen.
// CHANGE 1: Locked on all days except the 1st of each month or first launch.
//   - Lock banner shown at top when locked.
//   - All controls disabled (opacity 0.35, no press handlers) when locked.
//   - Draft state + "Save settings" button when unlocked.
// CHANGE 3: Surveillance section removed. Static "Surveillance active" info row added.
import React, { useEffect, useState } from 'react';
import {
  ActionSheetIOS, Alert, FlatList, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Switch, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useSettings } from '@/contexts/SettingsContext';
import { cancelAllReminders } from '@/utils/notifications';
import { MAX_NAG_MINUTES, MIN_NAG_MINUTES } from '@/utils/focusNag';
import { getNativeBlockState, setupNativeBlocking, NativeBlockState } from '@/utils/familyControls';
import { FocusMessageStyle, AppSettings } from '@/types';

const POPULAR_APPS = [
  'TikTok', 'Instagram', 'YouTube', 'Facebook', 'Twitter/X', 'Snapchat',
  'Reddit', 'Twitch', 'Netflix', 'BeReal', 'LinkedIn', 'Pinterest',
  'Spotify', 'Discord', 'WhatsApp',
];

// ─── Shared control components (accept `locked` prop) ─────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text style={[styles.cardTitle, { color: c.mutedForeground }]}>{title}</Text>
      {children}
    </View>
  );
}

function ToggleRow({ label, subtitle, value, onValueChange, locked }: {
  label: string; subtitle?: string; value: boolean;
  onValueChange: (v: boolean) => void; locked?: boolean;
}) {
  const c = useColors();
  return (
    <View style={[styles.toggleRow, { borderTopColor: c.border }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.rowLabel, { color: c.foreground }]}>{label}</Text>
        {subtitle ? <Text style={[styles.rowSub, { color: c.mutedForeground }]}>{subtitle}</Text> : null}
      </View>
      <View pointerEvents={locked ? 'none' : 'auto'} style={{ opacity: locked ? 0.35 : 1 }}>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#333', true: '#6366F1' }}
          thumbColor="#fff"
        />
      </View>
    </View>
  );
}

function StepRow({ label, value, min, max, step, unit = 'min', onChange, locked }: {
  label: string; value: number; min: number; max: number; step: number; unit?: string;
  onChange: (v: number) => void; locked?: boolean;
}) {
  const c = useColors();
  const steps = Math.round((max - min) / step);
  const currentStep = Math.round((value - min) / step);

  return (
    <View style={[styles.stepRowContainer, { borderTopColor: c.border }]}>
      <View style={styles.stepLabelRow}>
        <Text style={[styles.rowLabel, { color: c.foreground }]}>{label}</Text>
        <Text style={[styles.stepValueText, { color: c.primary }]}>{value} {unit}</Text>
      </View>
      <View style={styles.stepControls}>
        <Pressable
          style={[styles.stepBtn, { backgroundColor: c.surface, borderColor: c.border, opacity: locked ? 0.35 : 1 }]}
          onPress={locked ? undefined : () => { if (value > min) onChange(Math.max(min, value - step)); }}
        >
          <Feather name="minus" size={18} color={value <= min ? c.mutedForeground : c.foreground} />
        </Pressable>
        <View style={[styles.track, { backgroundColor: c.surface }]}>
          <View style={[styles.fill, { width: `${(currentStep / steps) * 100}%` as any, backgroundColor: c.primary }]} />
        </View>
        <Pressable
          style={[styles.stepBtn, { backgroundColor: c.surface, borderColor: c.border, opacity: locked ? 0.35 : 1 }]}
          onPress={locked ? undefined : () => { if (value < max) onChange(Math.min(max, value + step)); }}
        >
          <Feather name="plus" size={18} color={value >= max ? c.mutedForeground : c.foreground} />
        </Pressable>
      </View>
    </View>
  );
}

function CounterRow({ label, subtitle, value, min, max, onChange, locked }: {
  label: string; subtitle?: string; value: number; min: number; max: number;
  onChange: (v: number) => void; locked?: boolean;
}) {
  const c = useColors();
  return (
    <View style={[styles.toggleRow, { borderTopColor: c.border }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.rowLabel, { color: c.foreground }]}>{label}</Text>
        {subtitle ? <Text style={[styles.rowSub, { color: c.mutedForeground }]}>{subtitle}</Text> : null}
      </View>
      <View style={styles.counterControls}>
        <Pressable
          style={[styles.counterBtn, { backgroundColor: c.surface, borderColor: c.border, opacity: locked ? 0.35 : 1 }]}
          onPress={locked ? undefined : () => { if (value > min) onChange(value - 1); }}
        >
          <Feather name="minus" size={16} color={value <= min ? c.mutedForeground : c.foreground} />
        </Pressable>
        <Text style={[styles.counterValue, { color: c.foreground }]}>{value}</Text>
        <Pressable
          style={[styles.counterBtn, { backgroundColor: c.surface, borderColor: c.border, opacity: locked ? 0.35 : 1 }]}
          onPress={locked ? undefined : () => { if (value < max) onChange(value + 1); }}
        >
          <Feather name="plus" size={16} color={value >= max ? c.mutedForeground : c.foreground} />
        </Pressable>
      </View>
    </View>
  );
}

function MessageStyleRow({ value, onChange, locked }: {
  value: FocusMessageStyle; onChange: (v: FocusMessageStyle) => void; locked?: boolean;
}) {
  const c = useColors();
  const OPTIONS: { key: FocusMessageStyle; label: string }[] = [
    { key: 'motivational', label: 'Motivational' },
    { key: 'minimal', label: 'Minimal' },
    { key: 'custom', label: 'Direct' },
  ];
  return (
    <View style={[styles.toggleRow, { borderTopColor: c.border, flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
      <Text style={[styles.rowLabel, { color: c.foreground }]}>Nag style</Text>
      <View style={{ flexDirection: 'row', gap: 6 }} pointerEvents={locked ? 'none' : 'auto'}>
        {OPTIONS.map((opt) => {
          const active = opt.key === value;
          return (
            <Pressable
              key={opt.key}
              style={[
                styles.segment,
                { backgroundColor: active ? c.primary : 'transparent', borderColor: active ? c.primary : c.border, opacity: locked ? 0.35 : 1 },
              ]}
              onPress={locked ? undefined : () => onChange(opt.key)}
            >
              <Text style={[styles.segmentText, { color: active ? '#fff' : c.mutedForeground }]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { settings, isLoaded, isSettingsUnlocked, saveSettings, addBlockedApp, removeBlockedApp } = useSettings();

  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';
  const topPad = insets.top + (isWeb ? 67 : 0);
  const bottomPad = insets.bottom + (isWeb ? 34 : 0) + 20;

  const locked = !isSettingsUnlocked;

  // CHANGE 1: Draft state — all edits go to draft, committed on "Save settings"
  const [draft, setDraft] = useState<AppSettings>({ ...settings });
  const [appPickerVisible, setAppPickerVisible] = useState(false);

  // Sync draft from settings when AsyncStorage loads
  useEffect(() => {
    if (isLoaded) setDraft({ ...settings });
  }, [isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  function update(updates: Partial<AppSettings>) {
    if (locked) return;
    setDraft((prev) => ({ ...prev, ...updates }));
  }

  function handleSave() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    saveSettings(draft);
  }

  function getAvailableApps() {
    const blockedNames = draft.blockedApps.map((a) => a.name.toLowerCase());
    return POPULAR_APPS.filter((a) => !blockedNames.includes(a.toLowerCase()));
  }

  function showAppPicker() {
    if (locked) return;
    const available = getAvailableApps();
    if (available.length === 0) {
      Alert.alert('All popular apps already added!');
      return;
    }
    if (isIOS) {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...available, 'Cancel'], cancelButtonIndex: available.length },
        (idx) => { if (idx < available.length) update({ blockedApps: [...draft.blockedApps, { id: Date.now().toString(36), name: available[idx] }] }); }
      );
    } else {
      setAppPickerVisible(true);
    }
  }

  function handleNotificationsToggle(val: boolean) {
    update({ notificationsEnabled: val });
    if (!val) cancelAllReminders();
  }

  const [nativeState, setNativeState] = useState<NativeBlockState>({
    available: false, authorized: false, status: 'notDetermined', blockedCount: 0,
  });
  const [setupInProgress, setSetupInProgress] = useState(false);

  useEffect(() => {
    if (!isIOS) return;
    getNativeBlockState().then(setNativeState).catch(() => {});
  }, [isIOS]);

  async function handleNativeSetup() {
    if (setupInProgress) return;
    setSetupInProgress(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await setupNativeBlocking({
      title: "What's first?",
      subtitle: 'Complete a task to lift this shield.',
      primaryButtonLabel: "What's first?",
      secondaryButtonLabel: 'Dismiss',
    });
    setSetupInProgress(false);
    if (result === null) {
      Alert.alert('Not available', 'Requires the iOS dev build with the Family Controls entitlement.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const fresh = await getNativeBlockState();
    setNativeState(fresh);
  }

  const availableApps = getAvailableApps();

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: c.background }]}
        contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: bottomPad, gap: 12, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.screenTitle, { color: c.foreground }]}>Settings</Text>

        {/* CHANGE 1: Lock banner — shown when settings cannot be edited */}
        {locked && (
          <View style={[styles.lockBanner, { backgroundColor: '#1A1A1A', borderColor: '#F97316' }]}>
            <Ionicons name="lock-closed" size={18} color="#F97316" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.lockTitle}>Settings are locked</Text>
              <Text style={styles.lockSubtitle}>
                Settings can only be changed on the 1st of each month or when you first set up the app.
              </Text>
              <Text style={styles.lockSubtitle}>Come back on the 1st to make changes.</Text>
            </View>
          </View>
        )}

        {/* CHANGE 3: Static "Surveillance active" status row (replaces the Surveillance section) */}
        <SectionCard title="Status">
          <View style={[styles.toggleRow, { borderTopWidth: 0 }]}>
            <View style={[styles.iconCircle, { backgroundColor: '#22C55E22' }]}>
              <Ionicons name="shield-checkmark" size={20} color="#22C55E" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.rowLabel, { color: c.foreground }]}>Surveillance active</Text>
              <Text style={[styles.rowSub, { color: c.mutedForeground }]}>
                Managed automatically by What's first?
              </Text>
            </View>
          </View>
        </SectionCard>

        <SectionCard title="Free Passes">
          <CounterRow
            label="Free Passes per month"
            subtitle="How many surveillance bypasses you allow yourself"
            value={draft.maxBypassPerMonth}
            min={1} max={10}
            onChange={(v) => update({ maxBypassPerMonth: v })}
            locked={locked}
          />
        </SectionCard>

        <SectionCard title="Focus reminders">
          <CounterRow
            label="Nag every"
            subtitle="How often to ping you while tasks are due"
            value={draft.focusNagMinutes}
            min={MIN_NAG_MINUTES} max={MAX_NAG_MINUTES}
            onChange={(v) => update({ focusNagMinutes: v })}
            locked={locked}
          />
          <CounterRow
            label="Skip if fewer than"
            subtitle="Tasks due today below this count = no nag"
            value={draft.lowNagLimit}
            min={0} max={10}
            onChange={(v) => update({ lowNagLimit: v })}
            locked={locked}
          />
          <MessageStyleRow
            value={draft.focusNagMessage}
            onChange={(v) => update({ focusNagMessage: v })}
            locked={locked}
          />
        </SectionCard>

        <SectionCard title="Interrupt timing">
          <StepRow
            label="First alert after"
            value={draft.firstInterruptMinutes}
            min={5} max={60} step={5}
            onChange={(v) => update({ firstInterruptMinutes: v })}
            locked={locked}
          />
          <StepRow
            label="Grace period between alerts"
            value={draft.graceMinutes}
            min={2} max={15} step={1}
            onChange={(v) => update({ graceMinutes: v })}
            locked={locked}
          />
        </SectionCard>

        <SectionCard title="Notifications">
          <ToggleRow
            label="Task reminders"
            subtitle="Get reminded 1 hour before a task is due"
            value={draft.notificationsEnabled}
            onValueChange={handleNotificationsToggle}
            locked={locked}
          />
        </SectionCard>

        {isIOS && (
          <SectionCard title="Native app blocking">
            <View style={[styles.toggleRow, { borderTopWidth: 0 }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.rowLabel, { color: c.foreground }]}>iOS Screen Time shields</Text>
                <Text style={[styles.rowSub, { color: c.mutedForeground }]}>
                  {nativeState.available
                    ? nativeState.authorized
                      ? `Active — blocking ${nativeState.blockedCount} app${nativeState.blockedCount !== 1 ? 's' : ''}`
                      : nativeState.status === 'denied'
                        ? 'Permission denied. Enable in iOS Settings.'
                        : 'Not yet authorized'
                    : nativeState.reason === 'unsupported'
                      ? 'Requires iOS 15+ on a real device'
                      : 'Requires the iOS dev build with the Family Controls entitlement'}
                </Text>
              </View>
              <View style={[styles.statusDot, { backgroundColor: nativeState.authorized ? '#22C55E' : nativeState.available ? '#F97316' : c.mutedForeground }]} />
            </View>
            <Pressable
              style={[styles.addAppToggle, { borderColor: nativeState.available ? c.primary : c.border, opacity: nativeState.available && !setupInProgress ? 1 : 0.5 }]}
              onPress={handleNativeSetup}
              disabled={!nativeState.available || setupInProgress}
            >
              <Feather name="shield" size={14} color={c.primary} />
              <Text style={[styles.addAppToggleText, { color: c.primary }]}>
                {setupInProgress ? 'Setting up…' : nativeState.authorized ? 'Change blocked apps' : 'Set up app blocking'}
              </Text>
            </Pressable>
          </SectionCard>
        )}

        <SectionCard title="Apps to monitor">
          <View style={[styles.infoBanner, { backgroundColor: '#6366F111', borderColor: '#6366F133' }]}>
            <Feather name="info" size={14} color={c.primary} />
            <Text style={[styles.infoText, { color: c.mutedForeground }]}>
              Your planned blocked-app list. On iOS, the native section above applies the actual shield. On Android/web these are tracked for reference only.
            </Text>
          </View>
          <View style={styles.chipsRow}>
            {draft.blockedApps.map((app) => (
              <View key={app.id} style={[styles.chip, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Text style={[styles.chipText, { color: c.foreground }]}>{app.name}</Text>
                <Pressable
                  hitSlop={8}
                  style={{ opacity: locked ? 0.35 : 1 }}
                  onPress={locked ? undefined : () => update({ blockedApps: draft.blockedApps.filter((a) => a.id !== app.id) })}
                >
                  <Feather name="x" size={13} color={c.mutedForeground} />
                </Pressable>
              </View>
            ))}
          </View>
          {!locked && (
            <Pressable style={[styles.addAppToggle, { borderColor: c.border }]} onPress={showAppPicker}>
              <Feather name="plus" size={14} color={c.primary} />
              <Text style={[styles.addAppToggleText, { color: c.primary }]}>Add app</Text>
            </Pressable>
          )}
        </SectionCard>

        {/* CHANGE 1: Save button — only shown when settings are unlocked */}
        {!locked && (
          <Pressable style={[styles.saveBtn, { backgroundColor: c.primary }]} onPress={handleSave}>
            <Feather name="save" size={16} color="#fff" />
            <Text style={styles.saveBtnText}>Save settings</Text>
          </Pressable>
        )}
      </ScrollView>

      <Modal visible={appPickerVisible} transparent animationType="slide" onRequestClose={() => setAppPickerVisible(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setAppPickerVisible(false)}>
          <Pressable style={[styles.pickerSheet, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={[styles.handle, { backgroundColor: c.border }]} />
            <Text style={[styles.pickerTitle, { color: c.foreground }]}>Add an app to block</Text>
            <FlatList
              data={availableApps}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.pickerItem, { borderBottomColor: c.border }]}
                  onPress={() => { update({ blockedApps: [...draft.blockedApps, { id: Date.now().toString(36), name: item }] }); setAppPickerVisible(false); }}
                >
                  <Text style={[styles.pickerItemText, { color: c.foreground }]}>{item}</Text>
                  <Feather name="plus" size={16} color={c.primary} />
                </Pressable>
              )}
              ListEmptyComponent={<Text style={[styles.pickerEmpty, { color: c.mutedForeground }]}>All popular apps already added</Text>}
            />
            <Pressable style={[styles.pickerCancel, { backgroundColor: c.surface }]} onPress={() => setAppPickerVisible(false)}>
              <Text style={[styles.pickerCancelText, { color: c.foreground }]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  screenTitle: { fontSize: 28, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  // CHANGE 1: Lock banner
  lockBanner: {
    flexDirection: 'row', alignItems: 'flex-start',
    borderWidth: 1, borderRadius: 12, padding: 14,
    marginBottom: 4,
  },
  lockTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  lockSubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#9CA3AF', marginTop: 4 },
  // CHANGE 3: surveillance icon circle
  iconCircle: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
  cardTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, gap: 12 },
  rowLabel: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  rowSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  stepRowContainer: { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1 },
  stepLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  stepValueText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  stepControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  counterControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  counterBtn: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  counterValue: { fontSize: 22, fontFamily: 'Inter_700Bold', minWidth: 30, textAlign: 'center' },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  segment: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', borderWidth: 1.5 },
  segmentText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  infoBanner: { margin: 12, marginBottom: 8, borderRadius: 10, borderWidth: 1, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  addAppToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginBottom: 14, marginTop: 4, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', justifyContent: 'center' },
  addAppToggleText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  // CHANGE 1: Save button
  saveBtn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  saveBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
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
