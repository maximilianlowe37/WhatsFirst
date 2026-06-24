// Bottom sheet modal for adding new tasks with urgency, due date, and optional subtasks.
import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useTasks } from '@/contexts/TasksContext';
import { Urgency } from '@/types';
import { todayISO, tomorrowISO, inDaysISO } from '@/utils/dateHelpers';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const URGENCY_OPTIONS: { key: Urgency; label: string; color: string }[] = [
  { key: 'low', label: 'Low', color: '#22C55E' },
  { key: 'medium', label: 'Medium', color: '#F97316' },
  { key: 'high', label: 'High', color: '#EF4444' },
];

const DATE_OPTIONS = [
  { label: 'Today', value: todayISO() },
  { label: 'Tomorrow', value: tomorrowISO() },
  { label: 'In 2 days', value: inDaysISO(2) },
];

export function AddTaskModal({ visible, onClose }: Props) {
  const c = useColors();
  const { addTask } = useTasks();
  const [title, setTitle] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('medium');
  const [dueDate, setDueDate] = useState(todayISO());
  const [customDate, setCustomDate] = useState('');
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [subtaskInput, setSubtaskInput] = useState('');
  const titleRef = useRef<TextInput>(null);

  function reset() {
    setTitle('');
    setUrgency('medium');
    setDueDate(todayISO());
    setCustomDate('');
    setShowCustomDate(false);
    setShowSubtasks(false);
    setSubtasks([]);
    setSubtaskInput('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function addSubtask() {
    if (!subtaskInput.trim()) return;
    setSubtasks((prev) => [...prev, subtaskInput.trim()]);
    setSubtaskInput('');
  }

  function removeSubtask(idx: number) {
    setSubtasks((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit() {
    if (!title.trim()) return;
    const finalDate = showCustomDate && customDate.match(/^\d{4}-\d{2}-\d{2}$/) ? customDate : dueDate;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addTask({ title, urgency, dueDate: finalDate, subtasks });
    handleClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kav}
        >
          <Pressable style={[styles.sheet, { backgroundColor: c.card, borderColor: c.border }]}>
            {/* Handle */}
            <View style={[styles.handle, { backgroundColor: c.border }]} />
            <Text style={[styles.sheetTitle, { color: c.foreground }]}>New task</Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Title */}
              <TextInput
                ref={titleRef}
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
              <View style={styles.dateRow}>
                {DATE_OPTIONS.map((opt) => {
                  const selected = !showCustomDate && dueDate === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      style={[styles.datePill, { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primary : 'transparent' }]}
                      onPress={() => { setDueDate(opt.value); setShowCustomDate(false); }}
                    >
                      <Text style={[styles.datePillText, { color: selected ? '#fff' : c.mutedForeground }]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  style={[styles.datePill, { borderColor: showCustomDate ? c.primary : c.border, backgroundColor: showCustomDate ? c.primary : 'transparent' }]}
                  onPress={() => setShowCustomDate((v) => !v)}
                >
                  <Feather name="calendar" size={12} color={showCustomDate ? '#fff' : c.mutedForeground} />
                </Pressable>
              </View>
              {showCustomDate && (
                <TextInput
                  style={[styles.customDateInput, { backgroundColor: c.surface, color: c.foreground, borderColor: c.border }]}
                  value={customDate}
                  onChangeText={setCustomDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={c.mutedForeground}
                  keyboardType="numbers-and-punctuation"
                />
              )}

              {/* Subtasks toggle */}
              <Pressable
                style={styles.subtasksToggle}
                onPress={() => setShowSubtasks((v) => !v)}
              >
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
                  <View style={styles.subtaskInputRow}>
                    <TextInput
                      style={[styles.subtaskInput, { backgroundColor: c.surface, color: c.foreground, borderColor: c.border }]}
                      value={subtaskInput}
                      onChangeText={setSubtaskInput}
                      placeholder="Add a subtask…"
                      placeholderTextColor={c.mutedForeground}
                      returnKeyType="done"
                      onSubmitEditing={addSubtask}
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
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, padding: 20, paddingBottom: 40, maxHeight: '90%' },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 16 },
  titleInput: { borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 16, fontFamily: 'Inter_400Regular', marginBottom: 16 },
  sectionLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  urgencyRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  urgencyPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  urgencyLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  dateRow: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  datePill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  datePillText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  customDateInput: { borderRadius: 10, borderWidth: 1, padding: 10, fontSize: 14, fontFamily: 'Inter_400Regular', marginBottom: 8 },
  subtasksToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, marginBottom: 4 },
  subtasksToggleText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  subtasksSection: { gap: 6, marginBottom: 8 },
  subtaskItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  subtaskItemText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', marginRight: 8 },
  subtaskInputRow: { flexDirection: 'row', gap: 8 },
  subtaskInput: { flex: 1, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, fontFamily: 'Inter_400Regular' },
  subtaskAddBtn: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  submitBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  submitText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
});
