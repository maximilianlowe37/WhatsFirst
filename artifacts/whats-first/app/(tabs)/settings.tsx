// Settings screen — surveillance, interrupts, free passes, blocked apps, notifications.
// FIX 1: paddingTop: insets.top (headerShown: false, so we own the top inset).
// FIX 3: Configurable maxBypassPerMonth with [−]/[+] counter.
// FIX 5: maxSurveillanceDisablesPerMonth with [−]/[+] counter + disable-limit enforcement.
// FIX 6a: ScrollView with bottom padding, 44×44 step buttons.
// FIX 6b: App picker via ActionSheetIOS (iOS) or Modal (Android/web).
// FIX 8: notificationsEnabled toggle.
// PATH A: new "Focus reminders" section + status pill wiring.
// PATH C: new "Native app blocking" section (iOS only) showing live entitlement state.
import React, { useEffect, useState } from 'react';
import {
  ActionSheetIOS, Alert, FlatList, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Switch, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useSettings } from '@/contexts/SettingsContext';
import { cancelAllReminders } from '@/utils/notifications';
import {
  MAX_NAG_MINUTES,
  MIN_NAG_MINUTES,
} from '@/utils/focusNag';
import {
  getNativeBlockState,
  setupNativeBlocking,
  NativeBlockState,
} from '@/utils/familyControls';
import { FocusMessageStyle } from '@/types';

const POPULAR_APPS = [
  'TikTok', 'Instagram', 'YouTube', 'Facebook', 'Twitter/X', 'Snapchat',
  'Reddit', 'Twitch', 'Netflix', 'BeReal', 'LinkedIn', 'Pinterest',
  'Spotify', 'Discord', 'WhatsApp',
];

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text style={[styles.cardTitle, { color: c.mutedForeground }]}>{title}</Text>
      {children}
    </View>
  );
}

function ToggleRow({ label, subtitle, value, onValueChange }: {
  label: string; subtitle?: string; value: boolean; onValueChange: (v: boolean) => void;
}) {
  const c = useColors();
  return (
    <View style={[styles.toggleRow, { borderTopColor: c.border }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.rowLabel, { color: c.foreground }]}>{label}</Text>
        {subtitle ? <Text style={[styles.rowSub, { color: c.mutedForeground }]}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#333', true: '#6366F1' }}
        thumbColor="#fff"
      />
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

  function decrement() { if (value > min) onChange(Math.max(min, value - step)); }
  function increment() { if (value < max) onChange(Math.min(max, value + step)); }

  return (
    <View style={[styles.stepRowContainer, { borderTopColor: c.border }]}>
      <View style={styles.stepLabelRow}>
        <Text style={[styles.rowLabel, { color: c.foreground }]}>{label}</Text>
        <Text style={[styles.stepValueText, { color: c.primary }]}>{value} {unit}</Text>
      </View>
      <View style={styles.stepControls}>
        <Pressable
          style={[styles.stepBtn, { backgroundColor: c.surface, borderColor: c.border }]}
          onPress={decrement}
          hitSlop={4}
        >
          <Feather name="minus" size={18} color={value <= min ? c.mutedForeground : c.foreground} />
        </Pressable>
        <View style={[styles.track, { backgroundColor: c.surface }]}>
          <View style={[styles.fill, { width: `${(currentStep / steps) * 100}%` as any, backgroundColor: c.primary }]} />
        </View>
        <Pressable
          style={[styles.stepBtn, { backgroundColor: c.surface, borderColor: c.border }]}
          onPress={increment}
          hitSlop={4}
        >
          <Feather name="plus" size={18} color={value >= max ? c.mutedForeground : c.foreground} />
        </Pressable>
      </View>
    </View>
  );
}

function CounterRow({ label, subtitle, value, min, max, onChange }: {
  label: string; subtitle?: string; value: number; min: number; max: number;
  onChange: (v: number) => void;
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
          style={[styles.counterBtn, { backgroundColor: c.surface, borderColor: c.border }]}
          onPress={() => { if (value > min) onChange(value - 1); }}
        >
          <Feather name="minus" size={16} color={value <= min ? c.mutedForeground : c.foreground} />
        </Pressable>
        <Text style={[styles.counterValue, { color: c.foreground }]}>{value}</Text>
        <Pressable
          style={[styles.counterBtn, { backgroundColor: c.surface, borderColor: c.border }]}
          onPress={() => { if (value < max) onChange(value + 1); }}
        >
          <Feather name="plus" size={16} color={value >= max ? c.mutedForeground : c.foreground} />
        </Pressable>
      </View>
    </View>
  );
}

function MessageStyleRow({ value, onChange }: {
  value: FocusMessageStyle; onChange: (v: FocusMessageStyle) => void;
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
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {OPTIONS.map((opt) => {
          const active = opt.key === value;
          return (
            <Pressable
              key={opt.key}
              style={[
                styles.segment,
                {
                  backgroundColor: active ? c.primary : 'transparent',
                  borderColor: active ? c.primary : c.border,
                },
              ]}
              onPress={() => onChange(opt.key)}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: active ? '#fff' : c.mutedForeground },
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const {
    settings, updateSettings, addBlockedApp, removeBlockedApp,
    surveillanceRemaining, canDisableSurveillance, trackSurveillanceDisable,
  } = useSettings();

  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';
  const topPad = insets.top + (isWeb ? 67 : 0);
  const bottomPad = insets.bottom + (isWeb ? 34 : 0) + 20;

  const [appPickerVisible, setAppPickerVisible] = useState(false);

  function getAvailableApps() {
    const blockedNames = settings.blockedApps.map((a) => a.name.toLowerCase());
    return POPULAR_APPS.filter((a) => !blockedNames.includes(a.toLowerCase()));
  }

  function showAppPicker() {
    const available = getAvailableApps();
    if (available.length === 0) {
      Alert.alert('All popular apps already added!', 'All pre-set apps are in your list.');
      return;
    }
    if (isIOS) {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...available, 'Cancel'], cancelButtonIndex: available.length },
        (idx) => { if (idx < available.length) addBlockedApp(available[idx]); }
      );
    } else {
      setAppPickerVisible(true);
    }
  }

  function handleSurveillanceToggle(val: boolean) {
    if (!val) {
      if (!canDisableSurveillance) {
        Alert.alert(
          'Limit reached',
          `You've reached your limit for disabling surveillance this month (${settings.maxSurveillanceDisablesPerMonth} times). You can increase this limit in Settings.`
        );
        return;
      }
      Alert.alert(
        'Disable surveillance?',
        'This will stop all app monitoring until you turn it back on.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable', style: 'destructive',
            onPress: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              updateSettings({ surveillanceEnabled: false });
              trackSurveillanceDisable();
            },
          },
        ]
      );
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      updateSettings({ surveillanceEnabled: true });
    }
  }

  function handleNotificationsToggle(val: boolean) {
    updateSettings({ notificationsEnabled: val });
    if (!val) cancelAllReminders();
  }

  const [nativeState, setNativeState] = useState<NativeBlockState>({
    available: false,
    authorized: false,
    status: 'notDetermined',
    blockedCount: 0,
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
      Alert.alert(
        'Not available',
        'Native app blocking requires the iOS dev build with the Family Controls entitlement. See FAMILY_CONTROLS_SETUP.md for setup instructions.',
      );
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

        <SectionCard title="Surveillance">
          <ToggleRow
            label="Enable surveillance"
            subtitle={`${surveillanceRemaining} disable${surveillanceRemaining !== 1 ? 's' : ''} remaining this month`}
            value={settings.surveillanceEnabled}
            onValueChange={handleSurveillanceToggle}
          />
          <CounterRow
            label="Max disables per month"
            subtitle="How many times surveillance can be turned off"
            value={settings.maxSurveillanceDisablesPerMonth}
            min={1} max={10}
            onChange={(v) => updateSettings({ maxSurveillanceDisablesPerMonth: v })}
          />
        </SectionCard>

        <SectionCard title="Free Passes">
          <CounterRow
            label="Free Passes per month"
            subtitle="How many surveillance bypasses you allow yourself"
            value={settings.maxBypassPerMonth}
            min={1} max={10}
            onChange={(v) => updateSettings({ maxBypassPerMonth: v })}
          />
        </SectionCard>

        <SectionCard title="Focus reminders">
          <CounterRow
            label="Nag every"
            subtitle="How often to ping you while tasks are due"
            value={settings.focusNagMinutes}
            min={MIN_NAG_MINUTES} max={MAX_NAG_MINUTES}
            onChange={(v) => updateSettings({ focusNagMinutes: v })}
          />
          <CounterRow
            label="Skip if fewer than"
            subtitle="Tasks due today below this count = no nag"
            value={settings.lowNagLimit}
            min={0} max={10}
            onChange={(v) => updateSettings({ lowNagLimit: v })}
          />
          <MessageStyleRow
            value={settings.focusNagMessage}
            onChange={(v) => updateSettings({ focusNagMessage: v })}
          />
        </SectionCard>

        <SectionCard title="Interrupt timing">
          <StepRow
            label="First alert after"
            value={settings.firstInterruptMinutes}
            min={5} max={60} step={5}
            onChange={(v) => updateSettings({ firstInterruptMinutes: v })}
          />
          <StepRow
            label="Grace period between alerts"
            value={settings.graceMinutes}
            min={2} max={15} step={1}
            onChange={(v) => updateSettings({ graceMinutes: v })}
          />
        </SectionCard>

        <SectionCard title="Notifications">
          <ToggleRow
            label="Task reminders"
            subtitle="Get reminded 1 hour before a task is due"
            value={settings.notificationsEnabled}
            onValueChange={handleNotificationsToggle}
          />
        </SectionCard>

        {isIOS && (
          <SectionCard title="Native app blocking">
            <View style={[styles.toggleRow, { borderTopWidth: 0 }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.rowLabel, { color: c.foreground }]}>
                  iOS Screen Time shields
                </Text>
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
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: nativeState.authorized
                      ? '#22C55E'
                      : nativeState.available
                        ? '#F97316'
                        : c.mutedForeground,
                  },
                ]}
              />
            </View>

            <Pressable
              style={[
                styles.addAppToggle,
                {
                  borderColor: nativeState.available ? c.primary : c.border,
                  opacity: nativeState.available && !setupInProgress ? 1 : 0.5,
                },
              ]}
              onPress={handleNativeSetup}
              disabled={!nativeState.available || setupInProgress}
            >
              <Feather name="shield" size={14} color={c.primary} />
              <Text style={[styles.addAppToggleText, { color: c.primary }]}>
                {setupInProgress
                  ? 'Setting up…'
                  : nativeState.authorized
                    ? 'Change blocked apps'
                    : 'Set up app blocking'}
              </Text>
            </Pressable>
          </SectionCard>
        )}

        <SectionCard title="Apps to monitor">
          <View style={[styles.infoBanner, { backgroundColor: '#6366F111', borderColor: '#6366F133' }]}>
            <Feather name="info" size={14} color={c.primary} />
            <Text style={[styles.infoText, { color: c.mutedForeground }]}>
              Your planned blocked-app list. On iOS, the native section above applies the actual shield. On Android/web these are tracked for reference only — focus reminders are the active enforcement.
            </Text>
          </View>

          <View style={styles.chipsRow}>
            {settings.blockedApps.map((app) => (
              <View key={app.id} style={[styles.chip, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Text style={[styles.chipText, { color: c.foreground }]}>{app.name}</Text>
                <Pressable hitSlop={8} onPress={() => removeBlockedApp(app.id)}>
                  <Feather name="x" size={13} color={c.mutedForeground} />
                </Pressable>
              </View>
            ))}
          </View>

          <Pressable
            style={[styles.addAppToggle, { borderColor: c.border }]}
            onPress={showAppPicker}
          >
            <Feather name="plus" size={14} color={c.primary} />
            <Text style={[styles.addAppToggleText, { color: c.primary }]}>Add app</Text>
          </Pressable>
        </SectionCard>
      </ScrollView>

      <Modal
        visible={appPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAppPickerVisible(false)}
      >
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
                  onPress={() => { addBlockedApp(item); setAppPickerVisible(false); }}
                >
                  <Text style={[styles.pickerItemText, { color: c.foreground }]}>{item}</Text>
                  <Feather name="plus" size={16} color={c.primary} />
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={[styles.pickerEmpty, { color: c.mutedForeground }]}>
                  All popular apps already added
                </Text>
              }
            />
            <Pressable
              style={[styles.pickerCancel, { backgroundColor: c.surface }]}
              onPress={() => setAppPickerVisible(false)}
            >
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
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
  cardTitle: {
    fontSize: 11, fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase', letterSpacing: 1,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, gap: 12,
  },
  rowLabel: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  rowSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  stepRowContainer: { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1 },
  stepLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  stepValueText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  stepControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: {
    width: 44, height: 44, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  counterControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  counterBtn: {
    width: 44, height: 44, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  counterValue: { fontSize: 22, fontFamily: 'Inter_700Bold', minWidth: 30, textAlign: 'center' },
  statusDot: {
    width: 12, height: 12, borderRadius: 6,
  },
  segment: {
    flex: 1, paddingVertical: 9, borderRadius: 10,
    alignItems: 'center', borderWidth: 1.5,
  },
  segmentText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  infoBanner: {
    margin: 12, marginBottom: 8, borderRadius: 10, borderWidth: 1,
    padding: 12, flexDirection: 'row', gap: 8, alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
  },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  addAppToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 16, marginBottom: 14, marginTop: 4, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', justifyContent: 'center',
  },
  addAppToggleText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  pickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  pickerSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderBottomWidth: 0,
    padding: 20, paddingBottom: 40, maxHeight: '70%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  pickerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1,
  },
  pickerItemText: { fontSize: 16, fontFamily: 'Inter_400Regular' },
  pickerEmpty: { textAlign: 'center', paddingVertical: 24, fontSize: 14, fontFamily: 'Inter_400Regular' },
  pickerCancel: {
    marginTop: 12, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  pickerCancelText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});