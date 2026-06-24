// TaskCard — displays a task with urgency strip, subtasks, actions, and long-press move menu.
// FIX 2: Chevron and progress bar only render when subtasks exist.
import React, { useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useTasks } from '@/contexts/TasksContext';
import { Task } from '@/types';
import { urgencyColor, isOverdue } from '@/utils/urgencyColor';
import { formatShortDate, tomorrowISO, inDaysISO, todayISO } from '@/utils/dateHelpers';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface Props {
  task: Task;
  onPressDetail: (task: Task) => void;
}

export function TaskCard({ task, onPressDetail }: Props) {
  const c = useColors();
  const { completeTask, cancelTask, toggleSubtask, updateTask } = useTasks();
  const [expanded, setExpanded] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [moveMenu, setMoveMenu] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [showDateInput, setShowDateInput] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const strip = urgencyColor(task.urgency, task.dueDate);
  const overdue = isOverdue(task.dueDate);
  const today = todayISO();
  const hasSubtasks = task.subtasks.length > 0;
  const allSubtasksDone = !hasSubtasks || task.subtasks.every((s) => s.isCompleted);
  const completedCount = task.subtasks.filter((s) => s.isCompleted).length;
  const progress = hasSubtasks ? completedCount / task.subtasks.length : 0;

  const urgencyLabel = task.urgency.charAt(0).toUpperCase() + task.urgency.slice(1);

  function handleLongPress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMoveMenu(true);
  }

  function startLongPress() {
    pressTimer.current = setTimeout(handleLongPress, 500);
  }

  function cancelLongPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }

  function handlePress() {
    // Only toggle expand if there are subtasks
    if (hasSubtasks) setExpanded((e) => !e);
  }

  function handleComplete() {
    if (!allSubtasksDone) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    completeTask(task.id);
  }

  function moveTask(newDate: string) {
    updateTask(task.id, { dueDate: newDate });
    setMoveMenu(false);
    setShowDateInput(false);
    setCustomDate('');
  }

  function applyCustomDate() {
    if (!customDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Invalid date', 'Please enter a date in YYYY-MM-DD format.');
      return;
    }
    moveTask(customDate);
  }

  return (
    <>
      <Pressable
        onLongPress={handleLongPress}
        onPressIn={startLongPress}
        onPressOut={cancelLongPress}
        onPress={handlePress}
        style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
      >
        {/* Left urgency strip */}
        <View style={[styles.strip, { backgroundColor: strip }]} />

        <View style={styles.body}>
          {/* Title row */}
          <View style={styles.titleRow}>
            <View style={styles.titleLeft}>
              {overdue && (
                <View style={[styles.overdueTag, { backgroundColor: '#EF444422' }]}>
                  <Feather name="alert-triangle" size={10} color="#EF4444" />
                  <Text style={styles.overdueText}>OVERDUE</Text>
                </View>
              )}
              <Text style={[styles.title, { color: c.foreground }]} numberOfLines={expanded ? undefined : 2}>
                {task.title}
              </Text>
            </View>
            {/* FIX 2: Only render chevron when subtasks exist */}
            {hasSubtasks && (
              <Feather
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={c.mutedForeground}
              />
            )}
          </View>

          {/* Badges row */}
          <View style={styles.badgesRow}>
            <View style={[styles.urgencyBadge, { backgroundColor: strip + '22' }]}>
              <View style={[styles.dot, { backgroundColor: strip }]} />
              <Text style={[styles.badgeText, { color: strip }]}>{urgencyLabel}</Text>
            </View>
            {task.dueDate !== today && (
              <View style={[styles.dateBadge, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Feather name="calendar" size={11} color={c.mutedForeground} />
                <Text style={[styles.dateText, { color: c.mutedForeground }]}>
                  {formatShortDate(task.dueDate)}
                </Text>
              </View>
            )}
          </View>

          {/* FIX 2: Subtask progress — only when subtasks exist */}
          {hasSubtasks && (
            <View style={styles.progressSection}>
              <Text style={[styles.progressLabel, { color: c.mutedForeground }]}>
                {completedCount} / {task.subtasks.length} subtasks
              </Text>
              <View style={[styles.progressTrack, { backgroundColor: c.surface }]}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progress * 100}%` as any, backgroundColor: c.primary },
                  ]}
                />
              </View>
            </View>
          )}

          {/* Expanded subtasks */}
          {expanded && hasSubtasks && (
            <View style={styles.subtasksContainer}>
              {task.subtasks.map((s) => (
                <Pressable
                  key={s.id}
                  style={styles.subtaskRow}
                  onPress={() => toggleSubtask(task.id, s.id)}
                >
                  <View style={[styles.checkbox, { borderColor: s.isCompleted ? c.primary : c.border }]}>
                    {s.isCompleted && <Feather name="check" size={10} color={c.primary} />}
                  </View>
                  <Text
                    style={[
                      styles.subtaskText,
                      { color: s.isCompleted ? c.mutedForeground : c.foreground },
                      s.isCompleted && styles.strikethrough,
                    ]}
                  >
                    {s.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.actions}>
            <Pressable
              style={[
                styles.actionBtn,
                {
                  backgroundColor: allSubtasksDone ? '#22C55E22' : c.surface,
                  opacity: allSubtasksDone ? 1 : 0.4,
                },
              ]}
              onPress={handleComplete}
              disabled={!allSubtasksDone}
            >
              <Feather name="check" size={14} color={allSubtasksDone ? '#22C55E' : c.mutedForeground} />
              <Text style={[styles.actionText, { color: allSubtasksDone ? '#22C55E' : c.mutedForeground }]}>
                Done
              </Text>
            </Pressable>

            <Pressable
              style={[styles.actionBtn, { backgroundColor: '#EF444422' }]}
              onPress={() => setCancelConfirm(true)}
            >
              <Feather name="x" size={14} color="#EF4444" />
              <Text style={[styles.actionText, { color: '#EF4444' }]}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[styles.actionBtn, { backgroundColor: c.surface }]}
              onPress={() => onPressDetail(task)}
            >
              <Feather name="more-horizontal" size={14} color={c.mutedForeground} />
              <Text style={[styles.actionText, { color: c.mutedForeground }]}>Detail</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>

      {/* Cancel confirmation */}
      <ConfirmDialog
        visible={cancelConfirm}
        title="Cancel task?"
        message="This task will be moved to history."
        confirmLabel="Cancel task"
        cancelLabel="Keep it"
        destructive
        onConfirm={() => { setCancelConfirm(false); cancelTask(task.id); }}
        onCancel={() => setCancelConfirm(false)}
      />

      {/* Long-press move menu */}
      <Modal visible={moveMenu} transparent animationType="fade" onRequestClose={() => setMoveMenu(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => { setMoveMenu(false); setShowDateInput(false); }}>
          <Pressable style={[styles.menuBox, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.menuTitle, { color: c.foreground }]}>Move task to…</Text>
            <Pressable style={[styles.menuItem, { borderColor: c.border }]} onPress={() => moveTask(tomorrowISO())}>
              <Feather name="arrow-right" size={16} color={c.primary} />
              <Text style={[styles.menuItemText, { color: c.foreground }]}>Tomorrow</Text>
            </Pressable>
            <Pressable style={[styles.menuItem, { borderColor: c.border }]} onPress={() => moveTask(inDaysISO(2))}>
              <Feather name="arrow-right" size={16} color={c.primary} />
              <Text style={[styles.menuItemText, { color: c.foreground }]}>In 2 days</Text>
            </Pressable>
            <Pressable
              style={[styles.menuItem, { borderColor: c.border }]}
              onPress={() => setShowDateInput((v) => !v)}
            >
              <Feather name="calendar" size={16} color={c.primary} />
              <Text style={[styles.menuItemText, { color: c.foreground }]}>Pick a date</Text>
            </Pressable>
            {showDateInput && (
              <View style={styles.dateInputRow}>
                <TextInput
                  style={[styles.dateInput, { backgroundColor: c.surface, color: c.foreground, borderColor: c.border }]}
                  value={customDate}
                  onChangeText={setCustomDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={c.mutedForeground}
                  returnKeyType="done"
                  onSubmitEditing={applyCustomDate}
                />
                <Pressable style={[styles.applyBtn, { backgroundColor: c.primary }]} onPress={applyCustomDate}>
                  <Feather name="check" size={16} color="#fff" />
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 10,
    overflow: 'hidden',
  },
  strip: { width: 4 },
  body: { flex: 1, padding: 12, gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  titleLeft: { flex: 1, gap: 4 },
  overdueTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start',
  },
  overdueText: { fontSize: 10, color: '#EF4444', fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  title: { fontSize: 15, fontFamily: 'Inter_500Medium', lineHeight: 20 },
  badgesRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  urgencyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  dateBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1,
  },
  dateText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  progressSection: { gap: 4 },
  progressLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  progressTrack: { height: 3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: 2 },
  subtasksContainer: { gap: 6, paddingTop: 4 },
  subtaskRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 16, height: 16, borderRadius: 4, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  subtaskText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },
  strikethrough: { textDecorationLine: 'line-through' },
  actions: { flexDirection: 'row', gap: 6, paddingTop: 4 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  actionText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  menuOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24,
  },
  menuBox: {
    width: '100%', maxWidth: 320, borderRadius: 16, borderWidth: 1, padding: 20, gap: 4,
  },
  menuTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 8 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: 1,
  },
  menuItemText: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  dateInputRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  dateInput: {
    flex: 1, height: 40, borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 12, fontSize: 14, fontFamily: 'Inter_400Regular',
  },
  applyBtn: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
