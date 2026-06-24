// History screen — completed and cancelled tasks, with clear history action.
import React, { useMemo, useState } from 'react';
import {
  Platform, Pressable, SectionList, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTasks } from '@/contexts/TasksContext';
import { Task } from '@/types';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { urgencyColor } from '@/utils/urgencyColor';

function HistoryItem({ task }: { task: Task }) {
  const c = useColors();
  const strip = urgencyColor(task.urgency, task.dueDate);
  const completedDate = task.completedAt
    ? new Date(task.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  return (
    <View style={[styles.item, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={[styles.strip, { backgroundColor: strip }]} />
      <View style={styles.itemBody}>
        <Text style={[styles.itemTitle, { color: c.foreground }]} numberOfLines={2}>
          {task.title}
        </Text>
        <View style={styles.itemMeta}>
          <View style={[styles.badge, { backgroundColor: strip + '22' }]}>
            <View style={[styles.dot, { backgroundColor: strip }]} />
            <Text style={[styles.badgeText, { color: strip }]}>
              {task.urgency.charAt(0).toUpperCase() + task.urgency.slice(1)}
            </Text>
          </View>
          <Text style={[styles.metaText, { color: c.mutedForeground }]}>{completedDate}</Text>
          {task.subtasks.length > 0 && (
            <Text style={[styles.metaText, { color: c.mutedForeground }]}>
              {task.subtasks.filter((s) => s.isCompleted).length}/{task.subtasks.length} subtasks
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { tasks, clearHistory } = useTasks();
  const [clearConfirm, setClearConfirm] = useState(false);
  const isWeb = Platform.OS === 'web';

  const completed = useMemo(() =>
    tasks.filter((t) => t.status === 'completed')
      .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')),
    [tasks]
  );
  const cancelled = useMemo(() =>
    tasks.filter((t) => t.status === 'cancelled')
      .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')),
    [tasks]
  );

  const sections = useMemo(() => {
    const s = [];
    if (completed.length > 0) s.push({ title: 'Completed', icon: 'check-circle' as const, data: completed });
    if (cancelled.length > 0) s.push({ title: 'Cancelled', icon: 'x-circle' as const, data: cancelled });
    return s;
  }, [completed, cancelled]);

  const totalHistory = completed.length + cancelled.length;
  const topPad = isWeb ? 67 : 0;
  const bottomPad = insets.bottom + (isWeb ? 34 : 0) + 16;

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header row */}
      <View style={[styles.headerRow, { paddingTop: topPad > 0 ? topPad + 8 : 8, borderBottomColor: c.border }]}>
        <Text style={[styles.headerTitle, { color: c.foreground }]}>History</Text>
        {totalHistory > 0 && (
          <Pressable
            style={[styles.clearBtn, { borderColor: c.destructive }]}
            onPress={() => setClearConfirm(true)}
          >
            <Feather name="trash-2" size={14} color={c.destructive} />
            <Text style={[styles.clearBtnText, { color: c.destructive }]}>Clear</Text>
          </Pressable>
        )}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: bottomPad, paddingTop: 4 }}
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: c.background }]}>
            <Feather name={section.icon} size={14} color={c.mutedForeground} />
            <Text style={[styles.sectionTitle, { color: c.mutedForeground }]}>{section.title}</Text>
            <Text style={[styles.sectionCount, { color: c.mutedForeground }]}>({section.data.length})</Text>
          </View>
        )}
        renderItem={({ item }) => <HistoryItem task={item} />}
        ListEmptyComponent={
          <EmptyState message="No history yet — complete your first task!" icon="clock" />
        }
        stickySectionHeadersEnabled
        showsVerticalScrollIndicator={false}
      />

      <ConfirmDialog
        visible={clearConfirm}
        title="Clear all history?"
        message="This will permanently remove all completed and cancelled tasks."
        confirmLabel="Clear history"
        destructive
        onConfirm={() => { clearHistory(); setClearConfirm(false); }}
        onCancel={() => setClearConfirm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5 },
  clearBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10 },
  sectionTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionCount: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  item: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  strip: { width: 4 },
  itemBody: { flex: 1, padding: 12, gap: 6 },
  itemTitle: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  metaText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
});
