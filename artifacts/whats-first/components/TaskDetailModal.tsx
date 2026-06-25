// Task detail modal — view/edit task, manage subtasks, delete.
// FIX 1: Date picker collapsed by default — shows formatted pill, expands on tap.
// FIX 2: Add-subtask input auto-focuses after each addition via ref + setTimeout.
import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useTasks } from '@/contexts/TasksContext';
import { Task, Urgency } from '@/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toISO } from '@/utils/dateHelpers';

interface Props {
  task: Task | null;
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

export function TaskDetailModal({ task, onClose }: Props) {
  const c = useColors();
  const { updateTask, deleteTask, toggleSubtask, addSubtask, removeSubtask } = useTasks();
  const [title, setTitle] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('medium');
  const [dueDate, setDueDate] = useState('');
  const [dateObj, setDateObj] = useState(new Date());
  // FIX 1: date picker hidden by default
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [subtaskInput, setSubtaskInput] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  // FIX 2: ref for auto-focus
  const addSubtaskInputRef = useRef<TextInput>(null);
  const isIOS = Platform.OS === 'ios';
  const isAndroid = Platform.OS === 'android';
  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setUrgency(task.urgency);
      setDueDate(task.dueDate);
      setDateObj(new Date(task.dueDate + 'T12:00:00'));
      setSubtaskInput('');
      setShowDatePicker(false);
    }
  }, [task]);

  if (!task) return null;

  function handleSave() {
    if (!task || !title.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateTask(task.id, { title: title.trim(), urgency, dueDate });
    onClose();
  }

  function handleDelete() {
    if (!task) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    deleteTask(task.id);
    setDeleteConfirm(false);
    onClose();
  }

  // FIX 2: add subtask and auto-focus the input for the next one
  function handleAddSubtask() {
    if (!task || !subtaskInput.trim()) return;
    addSubtask(task.id, subtaskInput.trim());
    setSubtaskInput('');
    setTimeout(() => addSubtaskInputRef.current?.focus(), 50);
  }

  function handleDateChange(_event: any, date?: Date) {
    if (isAndroid) setShowDatePicker(false);
    if (date) {
      setDateObj(date);
      setDueDate(toISO(date));
    }
  }

  return (
    <>
      <Modal visible={!!task} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.overlay} onPress={onClose}>
          <KeyboardAvoidingView behavior={isIOS ? 'padding' : undefined} style={styles.kav}>
            <Pressable style={[styles.sheet, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={[styles.handle, { backgroundColor: c.border }]} />
              <View style={styles.header}>
                <Text style={[styles.sheetTitle, { color: c.foreground }]}>Task detail</Text>
                <Pressable onPress={onClose}>
                  <Feather name="x" size={20} color={c.mutedForeground} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Title */}
                <Text style={[styles.label, { color: c.mutedForeground }]}>Title</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: c.surface, color: c.foreground, borderColor: c.border }]}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Task title"
                  placeholderTextColor={c.mutedForeground}
                  returnKeyType="done"
                />

                {/* Urgency */}
                <Text style={[styles.label, { color: c.mutedForeground }]}>Urgency</Text>
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

                {/* Due date — FIX 1 */}
                <Text style={[styles.label, { color: c.mutedForeground }]}>Due date</Text>
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
                        style={[styles.input, { backgroundColor: c.surface, color: c.foreground, borderColor: c.border }]}
                        value={dueDate}
                        onChangeText={setDueDate}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={c.mutedForeground}
                      />
                    )}
                  </>
                )}

                {/* Subtasks */}
                <Text style={[styles.label, { color: c.mutedForeground }]}>Subtasks</Text>
                {task.subtasks.map((s) => (
                  <View key={s.id} style={[styles.subtaskRow, { borderColor: c.border }]}>
                    <Pressable
                      onPress={() => toggleSubtask(task.id, s.id)}
                      style={[styles.checkbox, { borderColor: s.isCompleted ? c.primary : c.border }]}
                    >
                      {s.isCompleted && <Feather name="check" size={10} color={c.primary} />}
                    </Pressable>
                    <Text
                      style={[
                        styles.subtaskText,
                        { color: s.isCompleted ? c.mutedForeground : c.foreground },
                        s.isCompleted && styles.strike,
                      ]}
                    >
                      {s.title}
                    </Text>
                    <Pressable onPress={() => removeSubtask(task.id, s.id)}>
                      <Feather name="x" size={14} color={c.mutedForeground} />
                    </Pressable>
                  </View>
                ))}

                {/* FIX 2: ref on subtask add input, auto-focused after each addition */}
                <View style={styles.addSubtaskRow}>
                  <TextInput
                    ref={addSubtaskInputRef}
                    style={[styles.subtaskInput, { backgroundColor: c.surface, color: c.foreground, borderColor: c.border }]}
                    value={subtaskInput}
                    onChangeText={setSubtaskInput}
                    placeholder="Add a subtask…"
                    placeholderTextColor={c.mutedForeground}
                    returnKeyType="done"
                    onSubmitEditing={handleAddSubtask}
                    blurOnSubmit={false}
                  />
                  <Pressable style={[styles.addBtn, { backgroundColor: c.primary }]} onPress={handleAddSubtask}>
                    <Feather name="plus" size={16} color="#fff" />
                  </Pressable>
                </View>

                {/* Save */}
                <Pressable
                  style={[styles.saveBtn, { backgroundColor: title.trim() ? c.primary : c.surface }]}
                  onPress={handleSave}
                  disabled={!title.trim()}
                >
                  <Text style={[styles.saveBtnText, { color: title.trim() ? '#fff' : c.mutedForeground }]}>
                    Save changes
                  </Text>
                </Pressable>

                {/* Delete */}
                <Pressable
                  style={[styles.deleteBtn, { borderColor: c.destructive }]}
                  onPress={() => setDeleteConfirm(true)}
                >
                  <Feather name="trash-2" size={14} color={c.destructive} />
                  <Text style={[styles.deleteBtnText, { color: c.destructive }]}>Delete task permanently</Text>
                </Pressable>
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <ConfirmDialog
        visible={deleteConfirm}
        title="Delete task?"
        message="This cannot be undone. The task will be permanently removed."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(false)}
      />
    </>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  label: {
    fontSize: 12, fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 4,
  },
  input: { borderRadius: 10, borderWidth: 1, padding: 12, fontSize: 15, fontFamily: 'Inter_400Regular', marginBottom: 12 },
  urgencyRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  urgencyPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  urgencyLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  // FIX 1: date chip styles
  dateChipRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  dateChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10,
  },
  dateChipText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  doneBtn: { paddingHorizontal: 4, paddingVertical: 8 },
  doneBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  iosPicker: { height: 160, marginBottom: 8 },
  subtaskRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, borderBottomWidth: 1,
  },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  subtaskText: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  strike: { textDecorationLine: 'line-through' },
  addSubtaskRow: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 16 },
  subtaskInput: {
    flex: 1, borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 14, fontFamily: 'Inter_400Regular',
  },
  addBtn: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  saveBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  deleteBtn: {
    borderRadius: 12, paddingVertical: 12, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 6, borderWidth: 1.5,
  },
  deleteBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
