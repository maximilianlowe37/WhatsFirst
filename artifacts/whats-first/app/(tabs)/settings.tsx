// Settings screen — surveillance toggle, interrupt timers, blocked apps management.
import React, { useState } from 'react';
import {
  Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useSettings } from '@/contexts/SettingsContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text style={[styles.cardTitle, { color: c.mutedForeground }]}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.row, { borderTopColor: c.border }]}>
      <Text style={[styles.rowLabel, { color: c.foreground }]}>{label}</Text>
      {children}
    </View>
  );
}

function SliderRow({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  const c = useColors();
  const steps = Math.round((max - min) / step);
  const currentStep = Math.round((value - min) / step);

  function decrement() {
    const next = Math.max(min, value - step);
    onChange(next);
  }
  function increment() {
    const next = Math.min(max, value + step);
    onChange(next);
  }

  return (
    <View style={[styles.row, { borderTopColor: c.border }]}>
      <View style={styles.sliderLabelRow}>
        <Text style={[styles.rowLabel, { color: c.foreground }]}>{label}</Text>
        <Text style={[styles.sliderValue, { color: c.primary }]}>{value} min</Text>
      </View>
      <View style={styles.sliderControls}>
        <Pressable style={[styles.stepBtn, { backgroundColor: c.surface, borderColor: c.border }]} onPress={decrement}>
          <Feather name="minus" size={14} color={c.foreground} />
        </Pressable>
        <View style={[styles.track, { backgroundColor: c.surface }]}>
          <View style={[styles.fill, { width: `${(currentStep / steps) * 100}%` as any, backgroundColor: c.primary }]} />
        </View>
        <Pressable style={[styles.stepBtn, { backgroundColor: c.surface, borderColor: c.border }]} onPress={increment}>
          <Feather name="plus" size={14} color={c.foreground} />
        </Pressable>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, addBlockedApp, removeBlockedApp } = useSettings();
  const [surveillanceConfirm, setSurveillanceConfirm] = useState(false);
  const [newAppName, setNewAppName] = useState('');
  const [showAddApp, setShowAddApp] = useState(false);
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : 0;
  const bottomPad = insets.bottom + (isWeb ? 34 : 0) + 20;

  function handleSurveillanceToggle(val: boolean) {
    if (!val) {
      setSurveillanceConfirm(true);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      updateSettings({ surveillanceEnabled: true });
    }
  }

  function confirmSurveillanceOff() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateSettings({ surveillanceEnabled: false });
    setSurveillanceConfirm(false);
  }

  function handleAddApp() {
    if (!newAppName.trim()) return;
    addBlockedApp(newAppName.trim());
    setNewAppName('');
    setShowAddApp(false);
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: c.background }]}
      contentContainerStyle={{ paddingTop: topPad > 0 ? topPad + 8 : 8, paddingBottom: bottomPad, gap: 12, paddingHorizontal: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.screenTitle, { color: c.foreground }]}>Settings</Text>

      {/* Surveillance */}
      <SectionCard title="Surveillance">
        <Row label="Enable surveillance">
          <Switch
            value={settings.surveillanceEnabled}
            onValueChange={handleSurveillanceToggle}
            trackColor={{ false: c.surface, true: c.primary }}
            thumbColor="#fff"
          />
        </Row>
      </SectionCard>

      {/* Interrupts */}
      <SectionCard title="Interrupts">
        <SliderRow
          label="First alert after"
          value={settings.firstInterruptMinutes}
          min={5} max={60} step={5}
          onChange={(v) => updateSettings({ firstInterruptMinutes: v })}
        />
        <SliderRow
          label="Grace period between alerts"
          value={settings.graceMinutes}
          min={2} max={15} step={1}
          onChange={(v) => updateSettings({ graceMinutes: v })}
        />
      </SectionCard>

      {/* Blocked apps */}
      <SectionCard title="Apps to monitor">
        {/* iOS-only info banner */}
        <View style={[styles.infoBanner, { backgroundColor: '#6366F111', borderColor: '#6366F133' }]}>
          <Feather name="info" size={14} color={c.primary} />
          <Text style={[styles.infoText, { color: c.mutedForeground }]}>
            App blocking requires the iOS version of this app. Configure which apps to block here in advance.
          </Text>
        </View>

        {/* App chips */}
        <View style={styles.chipsRow}>
          {settings.blockedApps.map((app) => (
            <View key={app.id} style={[styles.chip, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Text style={[styles.chipText, { color: c.foreground }]}>{app.name}</Text>
              <Pressable onPress={() => removeBlockedApp(app.id)}>
                <Feather name="x" size={13} color={c.mutedForeground} />
              </Pressable>
            </View>
          ))}
        </View>

        {/* Add app */}
        {showAddApp ? (
          <View style={styles.addAppRow}>
            <TextInput
              style={[styles.addAppInput, { backgroundColor: c.surface, color: c.foreground, borderColor: c.border }]}
              value={newAppName}
              onChangeText={setNewAppName}
              placeholder="App name…"
              placeholderTextColor={c.mutedForeground}
              returnKeyType="done"
              onSubmitEditing={handleAddApp}
              autoFocus
            />
            <Pressable style={[styles.addAppBtn, { backgroundColor: c.primary }]} onPress={handleAddApp}>
              <Feather name="check" size={16} color="#fff" />
            </Pressable>
            <Pressable style={[styles.addAppBtn, { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }]} onPress={() => setShowAddApp(false)}>
              <Feather name="x" size={16} color={c.mutedForeground} />
            </Pressable>
          </View>
        ) : (
          <Pressable style={[styles.addAppToggle, { borderColor: c.border }]} onPress={() => setShowAddApp(true)}>
            <Feather name="plus" size={14} color={c.primary} />
            <Text style={[styles.addAppToggleText, { color: c.primary }]}>Add app</Text>
          </Pressable>
        )}
      </SectionCard>

      <ConfirmDialog
        visible={surveillanceConfirm}
        title="Disable surveillance?"
        message="This will stop all app monitoring until you turn it back on."
        confirmLabel="Disable"
        destructive
        onConfirm={confirmSurveillanceOff}
        onCancel={() => setSurveillanceConfirm(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  screenTitle: { fontSize: 28, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
  cardTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1 },
  rowLabel: { fontSize: 15, fontFamily: 'Inter_400Regular', flex: 1 },
  sliderLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sliderValue: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  sliderControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  infoBanner: { margin: 12, marginBottom: 8, borderRadius: 10, borderWidth: 1, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  addAppRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  addAppInput: { flex: 1, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, fontFamily: 'Inter_400Regular' },
  addAppBtn: { width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  addAppToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginBottom: 14, marginTop: 4, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderStyle: 'dashed', justifyContent: 'center' },
  addAppToggleText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  // Override row for slider
});

// Extend Row for slider layout
export { };
