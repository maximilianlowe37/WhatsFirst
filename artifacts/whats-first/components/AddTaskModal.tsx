// Add Task bottom sheet modal.
// CHANGE 2: Robust subtask auto-focus — inputRefs + focusedSubtaskId + useEffect (50ms).
//   Each subtask is an editable TextInput with its own ref.
// CHANGE 4: Draggable handle — Reanimated 3 + GestureDetector Gesture.Pan().
//   HALF snap (default) and FULL snap; fast downward swipe dismisses.
// FIX 1 (prev): Date picker collapsed by default — pill chip shows date, expands on tap.
import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useTasks } from '@/contexts/TasksContext';
import { Urgency } from '@/types';
import { todayISO, tomorrowISO, inDaysISO, toISO } from '@/utils/dateHelpers';

// ─── Constants ─────────────────────────────────────────────────────────────────
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const HALF = SCREEN_HEIGHT * 0.55;
const FULL = SCREEN_HEIGHT * 0.92;

const URGENCY_OPTIONS: { key: Urgency; label: string; color: string }[] = [
  { key: 'low', label: 'Low', color: '#22C55E' },
  { key: 'medium', label: 'Medium', color: '#F97316' },
  { key: 'high', label: 'High', color: '#EF4444' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatDueLabel(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  if (d.getTime() === today.getTime()) return '📅 Today';
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.getTime() === tomorrow.getTime()) return '📅 Tomorrow';
  return '📅 ' + d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

interface SubtaskDraft {
  id: string;
  title: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function AddTaskModal({ visible, onClose }: Props) {
  const c = useColors();
  const { addTask } = useTasks();
  const isIOS = Platform.OS === 'ios';
  const isAndroid = Platform.OS === 'android';
  const isWeb = Platform.OS === 'web';

  // Form state
  const [title, setTitle] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('medium');
  const [dueDate, setDueDate] = useState(todayISO());
  const [dateObj, setDateObj] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(false);

  // CHANGE 2: Subtasks as individual draft items with their own refs
  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>([]);
  const [focusedSubtaskId, setFocusedSubtaskId] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const scrollViewRef = useRef<ScrollView>(null);

  // CHANGE 2: useEffect watching focusedSubtaskId — 50ms timeout to ensure the
  // ref is mounted before focus is called.
  useEffect(() => {
    if (!focusedSubtaskId) return;
    const t = setTimeout(() => {
      const ref = inputRefs.current[focusedSubtaskId];
      if (ref) {
        ref.focus();
        setFocusedSubtaskId(null);
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }
    }, 50);
    return () => clearTimeout(t);
  }, [focusedSubtaskId]);

  // CHANGE 4: Draggable sheet animation
  const translateY = useSharedValue(SCREEN_HEIGHT - HALF);
  const startY = useSharedValue(0);

  // Reset sheet position every time the modal opens
  useEffect(() => {
    if (visible) {
      translateY.value = SCREEN_HEIGHT - HALF;
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const panGesture = Gesture.Pan()
    .activeOffsetY([-5, 5])
    .onStart(() => {
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      const newY = startY.value + event.translationY;
      translateY.value = Math.max(
        SCREEN_HEIGHT - FULL,
        Math.min(SCREEN_HEIGHT - HALF * 0.7, newY)
      );
    })
    .onEnd((event) => {
      const midPoint = SCREEN_HEIGHT - ((FULL - HALF) / 2 + HALF);
      if (event.velocityY < -500 || translateY.value < midPoint) {
        // Snap to FULL
        translateY.value = withSpring(SCREEN_HEIGHT - FULL, { damping: 20, stiffness: 200 });
      } else if (event.velocityY > 1000) {
        // Fast downward — dismiss
        translateY.value = withSpring(SCREEN_HEIGHT, { damping: 20, stiffness: 200 }, () =>
          runOnJS(handleClose)()
        );
      } else {
        // Snap back to HALF
        translateY.value = withSpring(SCREEN_HEIGHT - HALF, { damping: 20, stiffness: 200 });
      }
    });

  // ─── Handlers ───────────────────────────────────────────────────────────────
  function reset() {
    setTitle('');
    setUrgency('medium');
    setDueDate(todayISO());
    setDateObj(new Date());
    setShowDatePicker(false);
    setShowSubtasks(false);
    setSubtasks([]);
    setFocusedSubtaskId(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function selectPreset(iso: string) {
    setDueDate(iso);
    setDateObj(new Date(iso + 'T12:00:00'));
    setShowDatePicker(false);
  }

  function handleDateChange(_event: any, date?: Date) {
    if (isAndroid) setShowDatePicker(false);
    if (date) {
      setDateObj(date);
      setDueDate(toISO(date));
    }
  }

  // CHANGE 2: Add empty subtask and trigger focus via useEffect
  function handleAddSubtask() {
    if (!showSubtasks) setShowSubtasks(true);
    const newId = uid();
    setSubtasks((prev) => [...prev, { id: newId, title: '' }]);
    setFocusedSubtaskId(newId);
  }

  function updateSubtask(id: string, title: string) {
    setSubtasks((prev) => prev.map((s) => s.id === id ? { ...s, title } : s));
  }

  function removeSubtask(id: string) {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
    delete inputRefs.current[id];
  }

  function handleSubmit() {
    if (!title.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addTask({
      title: title.trim(),
      urgency,
      dueDate,
      subtasks: subtasks.map((s) => s.title).filter(Boolean),
    });
    handleClose();
  }

  const presets = [
    { label: 'Today', value: todayISO() },
    { label: 'Tomorrow', value: tomorrowISO() },
    { label: 'In 2 days', value: inDaysISO(2) },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      {/* Backdrop — tap to close */}
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={[StyleSheet.absoluteFill, styles.backdrop]} />
      </TouchableWithoutFeedback>

      {/* CHANGE 4: Animated draggable sheet */}
      <Animated.View style={[styles.sheet, { backgroundColor: c.card }, animatedStyle]}>

        {/* Handle area — ONLY this area responds to drag, not the ScrollView */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={styles.handleArea}>
            <View style={[styles.handle, { backgroundColor: '#555555' }]} />
            <Text style={[styles.sheetTitle, { color: c.foreground }]}>New task</Text>
          </Animated.View>
        </GestureDetector>

        {/* CHANGE 2: KAV wraps form so keyboard lifts content */}
        <KeyboardAvoidingView
          behavior={isIOS ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Title */}
            <TextInput
              style={[styles.titleInput, { backgroundColor: c.surface, color: c.foreground, borderColor: c.border }]}
              value={title}
              onChangeText={setTitle}
              placeholder="What needs to be done?"
              placeholderTextColor={c.mutedForeground}
              autoFocus
              returnKeyType="done"
            />

            {/* Urgency */}
            <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>Urgency</Text>
            <View style={styles.urgencyRow}>
              {URGENCY_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  style={[styles.urgencyPill, { borderColor: opt.color, backgroundColor: urgency === opt.key ? opt.color : 'transparent' }]}
                  onPress={() => setUrgency(opt.key)}
                >
                  <View style={[styles.dot, { backgroundColor: urgency === opt.key ? '#fff' : opt.color }]} />
                  <Text style={[styles.urgencyLabel, { color: urgency === opt.key ? '#fff' : opt.color }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Due date */}
            <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>Due date</Text>
            <View style={styles.dateRow}>
              {presets.map((opt) => {
                const selected = dueDate === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[styles.datePill, { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primary : 'transparent' }]}
                    onPress={() => selectPreset(opt.value)}
                  >
                    <Text style={[styles.datePillText, { color: selected ? '#fff' : c.mutedForeground }]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.dateChipRow}>
              <Pressable
                style={[styles.dateChip, { backgroundColor: c.surface, borderColor: c.border }]}
                onPress={() => setShowDatePicker((v) => !v)}
              >
                <Text style={[styles.dateChipText, { color: c.foreground }]}>{formatDueLabel(dueDate)}</Text>
                <Feather name={showDatePicker ? 'chevron-up' : 'chevron-down'} size={14} color={c.mutedForeground} />
              </Pressable>
              {showDatePicker && isIOS && (
                <Pressable onPress={() => setShowDatePicker(false)} style={styles.doneBtn}>
                  <Text style={[styles.doneBtnText, { color: c.primary }]}>Done</Text>
                </Pressable>
              )}
            </View>
            {showDatePicker && (
              <>
                {isIOS && (
                  <DateTimePicker
                    value={dateObj} mode="date" display="spinner" locale="en-GB"
                    onChange={handleDateChange} style={styles.iosPicker}
                    textColor="#ffffff" accentColor="#6366F1"
                  />
                )}
                {isAndroid && (
                  <DateTimePicker value={dateObj} mode="date" display="default" onChange={handleDateChange} />
                )}
                {isWeb && (
                  <TextInput
                    style={[styles.webDateInput, { backgroundColor: c.surface, color: c.foreground, borderColor: c.border }]}
                    value={dueDate} onChangeText={setDueDate}
                    placeholder="YYYY-MM-DD" placeholderTextColor={c.mutedForeground}
                  />
                )}
              </>
            )}

            {/* Subtasks */}
            <Pressable style={styles.subtasksToggle} onPress={handleAddSubtask}>
              <Feather name="plus-circle" size={16} color={c.primary} />
              <Text style={[styles.subtasksToggleText, { color: c.primary }]}>Add subtask</Text>
            </Pressable>

            {showSubtasks && subtasks.length > 0 && (
              <View style={styles.subtasksSection}>
                {/* CHANGE 2: Each subtask is a live TextInput with its own ref */}
                {subtasks.map((s) => (
                  <View key={s.id} style={[styles.subtaskRow, { backgroundColor: c.surface, borderColor: c.border }]}>
                    <TextInput
                      ref={(el) => { inputRefs.current[s.id] = el; }}
                      style={[styles.subtaskInput, { color: c.foreground }]}
                      value={s.title}
                      onChangeText={(v) => updateSubtask(s.id, v)}
                      placeholder="Subtask title"
                      placeholderTextColor={c.mutedForeground}
                      blurOnSubmit={false}
                      returnKeyType="done"
                      onSubmitEditing={handleAddSubtask}
                      autoCorrect={false}
                    />
                    <Pressable onPress={() => removeSubtask(s.id)} hitSlop={8}>
                      <Feather name="x" size={14} color={c.mutedForeground} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {/* Submit */}
            <Pressable
              style={[styles.submitBtn, { backgroundColor: title.trim() ? c.primary : c.surface, opacity: title.trim() ? 1 : 0.5 }]}
              onPress={handleSubmit}
              disabled={!title.trim()}
            >
              <Text style={[styles.submitText, { color: title.trim() ? '#fff' : c.mutedForeground }]}>
                Add task
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.55)' },
  // CHANGE 4: Sheet is position:absolute, full height in DOM, translateY controls visibility
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: FULL,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  // CHANGE 4: Handle area is the only draggable zone
  handleArea: {
    width: '100%',
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    minHeight: 44,
    gap: 10,
  },
  handle: { width: 36, height: 4, borderRadius: 2 },
  sheetTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', alignSelf: 'flex-start' },
  formContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 0 },
  titleInput: {
    borderRadius: 12, borderWidth: 1, padding: 14,
    fontSize: 16, fontFamily: 'Inter_400Regular', marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12, fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
  },
  urgencyRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  urgencyPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  urgencyLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  dateRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  datePill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  datePillText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  dateChipRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  dateChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10,
  },
  dateChipText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  doneBtn: { paddingHorizontal: 4, paddingVertical: 8 },
  doneBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  iosPicker: { height: 160, marginBottom: 4 },
  webDateInput: {
    borderRadius: 10, borderWidth: 1, padding: 10,
    fontSize: 14, fontFamily: 'Inter_400Regular', marginBottom: 8,
  },
  subtasksToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 12, marginBottom: 4,
  },
  subtasksToggleText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  subtasksSection: { gap: 6, marginBottom: 8 },
  // CHANGE 2: each subtask is an editable row
  subtaskRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, gap: 8,
  },
  subtaskInput: {
    flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular',
    paddingVertical: 8,
  },
  submitBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  submitText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});
