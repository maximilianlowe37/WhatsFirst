// Add Task bottom sheet modal.
// FIX 1: Date picker collapsed by default — shows formatted pill, expands on tap.
// FIX 2: Subtask input auto-focuses after each addition via ref + setTimeout.
import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useTasks } from '@/contexts/TasksContext';
import { Urgency } from '@/types';
import { todayISO, tomorrowISO, inDaysISO, toISO } from '@/utils/dateHelpers';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const URGENCY_OPTIONS: { key: Urgency; label: string; color: string }[] = [
  { key: 'low', label: 'Low', color: '#22C55E' },
  { key: 'medium', label: 'Medium', color: '#F97316' },
  { key: 'high', label: 'High', color: '#EF4444' },
];

// FIX 1: Human-readable date label for the collapsed chip.
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

export function AddTaskModal({ visible, onClose }: Props) {
  const c = useColors();
  const { addTask } = useTasks();
  const [title, setTitle] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('medium');
  const [dueDate, setDueDate] = useState(todayISO());
  const [dateObj, setDateObj] = useState(new Date());
  // FIX 1: picker hidden by default, revealed on chip tap
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [subtaskInput, setSubtaskInput] = useState('');
  // FIX 2: ref for auto-focus after adding a subtask
  const subtaskInputRef = useRef<TextInput>(null);
  const isIOS = Platform.OS === 'ios';
  const isAndroid = Platform.OS === 'android';
  const isWeb = Platform.OS === 'web';

  function reset() {
    setTitle('');
    setUrgency('medium');
    setDueDate(todayISO());
    setDateObj(new Date());
    setShowDatePicker(false);
    setShowSubtasks(false);
    setSubtasks([]);
    setSubtaskInput('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function selectPreset(iso: string) {
    setDueDate(iso);
    setDateObj(new Date(iso + 'T12:00:00'));
    // Collapse picker when a quick preset is chosen
    setShowDatePicker(false);
  }

  function handleDateChange(_event: any, date?: Date) {
    if (isAndroid) setShowDatePicker(false);
    if (date) {
      setDateObj(date);
      setDueDate(toISO(date));
    }
  }

  // FIX 2: add subtask and auto-focus the input for the next one
  function addSubtask() {
    if (!subtaskInput.trim()) return;
    setSubtasks((prev) => [...prev, subtaskInput.trim()]);
    setSubtaskInput('');
    setTimeout(() => subtaskInputRef.current?.focus(), 50);
  }

  function removeSubtask(idx: number) {
    setSubtasks((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit() {
    if (!title.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addTask({ title, urgency, dueDate, subtasks });
    handleClose();
  }

  const presets = [
    { label: 'Today', value: todayISO() },
    { label: 'Tomorrow', value: tomorrowISO() },
    { label: 'In 2 days', value: inDaysISO(2) },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <KeyboardAvoidingView behavior={isIOS ? 'padding' : undefined} style={styles.kav}>
          <Pressable style={[styles.sheet, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={[styles.handle, { backgroundColor: c.border }]} />
            <Text style={[styles.sheetTitle, { color: c.foreground }]}>New task</Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
                    style={[
                      styles.urgencyPill,
                      { borderColor: opt.color, backgroundColor: urgency === opt.key ? opt.color : 'transparent' },
                    ]}
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

              {/* Quick presets */}
              <View style={styles.dateRow}>
                {presets.map((opt) => {
                  const selected = dueDate === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      style={[
                        styles.datePill,
                        { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primary : 'transparent' },
                      ]}
                      onPress={() => selectPreset(opt.value)}
                    >
                      <Text style={[styles.datePillText, { color: selected ? '#fff' : c.mutedForeground }]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* FIX 1: Collapsed date chip + expand/collapse controls */}
              <View style={styles.dateChipRow}>
                <Pressable
                  style={[styles.dateChip, { backgroundColor: c.surface, borderColor: c.border }]}
                  onPress={() => setShowDatePicker((v) => !v)}
                >
                  <Text style={[styles.dateChipText, { color: c.foreground }]}>
                    {formatDueLabel(dueDate)}
                  </Text>
                  <Feather name={showDatePicker ? 'chevron-up' : 'chevron-down'} size={14} color={c.mutedForeground} />
                </Pressable>
                {showDatePicker && isIOS && (
                  <Pressable onPress={() => setShowDatePicker(false)} style={styles.doneBtn}>
                    <Text style={[styles.doneBtnText, { color: c.primary }]}>Done</Text>
                  </Pressable>
                )}
              </View>

              {/* FIX 1: Date picker — only shown after tapping chip */}
              {showDatePicker && (
                <>
                  {isIOS && (
                    <DateTimePicker
                      value={dateObj}
                      mode="date"
                      display="spinner"
                      locale="en-GB"
                      onChange={handleDateChange}
                      style={styles.iosPicker}
                      textColor="#ffffff"
                      accentColor="#6366F1"
                    />
                  )}
                  {isAndroid && (
                    <DateTimePicker
                      value={dateObj}
                      mode="date"
                      display="default"
                      onChange={handleDateChange}
                    />
                  )}
                  {isWeb && (
                    <TextInput
                      style={[styles.webDateInput, { backgroundColor: c.surface, color: c.foreground, borderColor: c.border }]}
                      value={dueDate}
                      onChangeText={(v) => setDueDate(v)}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={c.mutedForeground}
                    />
                  )}
                </>
              )}

              {/* Subtasks toggle */}
              <Pressable style={styles.subtasksToggle} onPress={() => setShowSubtasks((v) => !v)}>
                <Feather name={showSubtasks ? 'minus-circle' : 'plus-circle'} size={16} color={c.primary} />
                <Text style={[styles.subtasksToggleText, { color: c.primary }]}>
                  {showSubtasks ? 'Hide subtasks' : 'Add subtasks'}
                </Text>
              </Pressable>

              {showSubtasks && (
                <View style={styles.subtasksSection}>
                  {subtasks.map((s, i) => (
                    <View key={i} style={[styles.subtaskItem, { backgroundColor: c.surface, borderColor: c.border }]}>
                      <Text style={[styles.subtaskItemText, { color: c.foreground }]} numberOfLines={1}>{s}</Text>
                      <Pressable onPress={() => removeSubtask(i)}>
                        <Feather name="x" size={14} color={c.mutedForeground} />
                      </Pressable>
                    </View>
                  ))}
                  {/* FIX 2: ref on input + auto-focus on addSubtask */}
                  <View style={styles.subtaskInputRow}>
                    <TextInput
                      ref={subtaskInputRef}
                      style={[styles.subtaskInput, { backgroundColor: c.surface, color: c.foreground, borderColor: c.border }]}
                      value={subtaskInput}
                      onChangeText={setSubtaskInput}
                      placeholder="Add a subtask…"
                      placeholderTextColor={c.mutedForeground}
                      returnKeyType="done"
                      onSubmitEditing={addSubtask}
                      blurOnSubmit={false}
                    />
                    <Pressable style={[styles.subtaskAddBtn, { backgroundColor: c.primary }]} onPress={addSubtask}>
                      <Feather name="plus" size={16} color="#fff" />
                    </Pressable>
                  </View>
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
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  kav: { justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderBottomWidth: 0,
    padding: 20, paddingBottom: 40, maxHeight: '92%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 16 },
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
  // FIX 1: collapsed date chip
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
  subtasksToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, marginBottom: 4 },
  subtasksToggleText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  subtasksSection: { gap: 6, marginBottom: 8 },
  subtaskItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1,
  },
  subtaskItemText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', marginRight: 8 },
  subtaskInputRow: { flexDirection: 'row', gap: 8 },
  subtaskInput: {
    flex: 1, borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 14, fontFamily: 'Inter_400Regular',
  },
  subtaskAddBtn: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  submitBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  submitText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});
