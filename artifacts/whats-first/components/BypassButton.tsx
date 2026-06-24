// Free Pass (bypass) button — shows remaining/max passes and handles monthly reset.
// FIX 3: reads maxPerMonth dynamically from BypassContext (which reads from settings).
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useBypass } from '@/contexts/BypassContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export function BypassButton() {
  const c = useColors();
  const { remaining, maxPerMonth, canUse, useBypass: activateBypass } = useBypass();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  function handlePress() {
    if (!canUse) return;
    setConfirmVisible(true);
  }

  function handleConfirm() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    activateBypass();
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
        message={`You're about to use a Free Pass (${remaining} of ${maxPerMonth} remaining this month). This temporarily disables app surveillance.`}
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
              <Text style={styles.toastText}>Free Pass activated. Enjoy your break!</Text>
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
