// Free Pass (bypass) button — shows remaining/max passes and handles monthly reset.
// FIX 3: reads maxPerMonth dynamically from BypassContext (which reads from settings).
// PATH A: also tells FocusContext to suppress focus nag for firstInterruptMinutes.
// PATH C: when the native module is available, calls unblockAll() so any
//         Family Controls shields are lifted for the duration of the pass.
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useBypass } from '@/contexts/BypassContext';
import { useFocus } from '@/contexts/FocusContext';
import { useSettings } from '@/contexts/SettingsContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { liftNativeBlocking } from '@/utils/familyControls';

export function BypassButton() {
  const c = useColors();
  const { remaining, maxPerMonth, canUse, useBypass: activateBypass } = useBypass();
  const { suppressForMinutes } = useFocus();
  const { settings } = useSettings();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  function handlePress() {
    if (!canUse) return;
    setConfirmVisible(true);
  }

  function handleConfirm() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    activateBypass();
    // Suppress focus nag for the firstInterruptMinutes window so the user
    // genuinely gets their break without being paged.
    suppressForMinutes(settings.firstInterruptMinutes).catch(() => {});
    // Lift native iOS shields (no-op when module isn't installed).
    liftNativeBlocking().catch(() => {});
    setConfirmVisible(false);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  }

  return (
    <>
      <Pressable style={styles.container} onPress={handlePress}>
        <Feather
          name={canUse ? 'unlock' : 'lock'}
          size={18}
          color={canUse ? c.primary : c.mutedForeground}
        />
        <Text style={[styles.count, { color: canUse ? c.primary : c.mutedForeground }]}>
          {remaining}/{maxPerMonth}
        </Text>
      </Pressable>

      <ConfirmDialog
        visible={confirmVisible}
        title="Use a Free Pass?"
        message={`You're about to use a Free Pass (${remaining} of ${maxPerMonth} remaining this month). This temporarily disables app surveillance for ${settings.firstInterruptMinutes} min — focus reminders will resume automatically when it ends.`}
        confirmLabel="Use Free Pass"
        cancelLabel="Keep it"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmVisible(false)}
      />

      {toastVisible && (
        <Modal transparent visible animationType="fade">
          <View style={styles.toastWrapper} pointerEvents="none">
            <View style={[styles.toast, { backgroundColor: '#22C55E' }]}>
              <Feather name="check-circle" size={16} color="#fff" />
              <Text style={styles.toastText}>
                Free Pass on — focus reminders paused for {settings.firstInterruptMinutes} min.
              </Text>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6 },
  count: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  toastWrapper: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 100 },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, maxWidth: 320,
  },
  toastText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_500Medium', flex: 1 },
});
