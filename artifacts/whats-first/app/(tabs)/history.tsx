// History screen — completed and cancelled tasks with status + date filters.
// FIX 1: ScreenHeader handles safe-area paddingTop.
// FIX 4: Clear History button has solid background, placed below SectionList as sibling.
// FIX 5: Status filter (All/Completed/Cancelled) + date filter (All/Today/Week/Month).
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTasks } from '@/contexts/TasksContext';
import { Task } from '@/types';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { urgencyColor } from '@/utils/urgencyColor';

// ─── Filter config ─────────────────────────────────────────────────────────────
type StatusFilter = 'all' | 'completed' | 'cancelled';
type DateFilter = 'all' | 'today' | 'thisWeek' | 'thisMonth';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'completed', label: '✓ Completed' },
  { key: 'cancelled', label: '✕ Cancelled' },
];

const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: 'today', label: 'Today' },
  { key: 'thisWeek', label: 'This week' },
  { key: 'thisMonth', label: 'This month' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function formatHistoryDateLabel(dateKey: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateKey + 'T00:00:00');
  if (isSameDay(d, today)) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ─── History item ──────────────────────────────────────────────────────────────
function HistoryItem({ task }: { task: Task }) {
  const c = useColors();
  const strip = urgencyColor(task.urgency, task.dueDate);
  const completedDate = task.completedAt
    ? new Date(task.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  return (
    <View style={[styles.item, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={[styles.itemStrip, { backgroundColor: strip }]} />
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
          <View style={[styles.statusBadge, { backgroundColor: task.status === 'completed' ? '#22C55E22' : '#EF444422' }]}>
            <Feather
              name={task.status === 'completed' ? 'check' : 'x'}
              size={10}
              color={task.status === 'completed' ? '#22C55E' : '#EF4444'}
            />
            <Text style={[styles.badgeText, { color: task.status === 'completed' ? '#22C55E' : '#EF4444' }]}>
              {task.status === 'completed' ? 'Done' : 'Cancelled'}
            </Text>
          </View>
          <Text style={[styles.metaDate, { color: c.mutedForeground }]}>{completedDate}</Text>
        </View>
        {task.subtasks.length > 0 && (
          <Text style={[styles.subtaskCount, { color: c.mutedForeground }]}>
            {task.subtasks.filter((s) => s.isCompleted).length}/{task.subtasks.length} subtasks
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────
export default function HistoryScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { tasks, clearHistory } = useTasks();
  const [clearConfirm, setClearConfirm] = useState(false);
  // FIX 5: local filter state (resets on tab switch — intentional)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  const historyTasks = useMemo(
    () => tasks.filter((t) => t.status === 'completed' || t.status === 'cancelled'),
    [tasks]
  );

  // FIX 5: filter logic — pure useMemo, synchronous, no async
  const filteredTasks = useMemo(() => {
    const now = new Date();
    return historyTasks.filter((task) => {
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (dateFilter !== 'all') {
        const eventDate = new Date(task.completedAt || task.createdAt);
        if (dateFilter === 'today') return isSameDay(eventDate, now);
        if (dateFilter === 'thisWeek') {
          const weekAgo = new Date(now);
          weekAgo.setDate(now.getDate() - 7);
          return eventDate >= weekAgo;
        }
        if (dateFilter === 'thisMonth') {
          return eventDate.getMonth() === now.getMonth() &&
            eventDate.getFullYear() === now.getFullYear();
        }
      }
      return true;
    });
  }, [historyTasks, statusFilter, dateFilter]);

  // Sort by completedAt descending, then group by date
  const sections = useMemo(() => {
    const sorted = [...filteredTasks].sort(
      (a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')
    );
    const map = new Map<string, Task[]>();
    for (const t of sorted) {
      const dateKey = (t.completedAt || t.createdAt).slice(0, 10);
      const existing = map.get(dateKey) || [];
      existing.push(t);
      map.set(dateKey, existing);
    }
    return Array.from(map.entries()).map(([dateKey, data]) => ({
      title: formatHistoryDateLabel(dateKey),
      data,
    }));
  }, [filteredTasks]);

  const totalHistory = historyTasks.length;
  // FIX 4: tab bar height for bottom padding
  const tabBarHeight = 49 + insets.bottom;

  // ─── Shared pill renderer ─────────────────────────────────────────────────
  function renderPills<T extends string>(
    items: { key: T; label: string }[],
    active: T,
    onPress: (k: T) => void
  ) {
    return items.map((f) => {
      const isActive = f.key === active;
      return (
        <Pressable
          key={f.key}
          style={[
            styles.filterPill,
            { borderColor: isActive ? c.primary : c.border },
            isActive && { backgroundColor: c.primary },
          ]}
          onPress={() => onPress(f.key)}
        >
          <Text style={[styles.filterPillText, { color: isActive ? '#fff' : c.mutedForeground }]}>
            {f.label}
          </Text>
        </Pressable>
      );
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* ScreenHeader handles safe-area paddingTop */}
      <ScreenHeader title="History" />

      {/* FIX 5: Filter rows — siblings of SectionList, never scroll away */}
      <View style={[styles.filterBlock, { backgroundColor: c.background, borderBottomColor: c.border }]}>
        {/* Row 1: Status */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {renderPills(STATUS_FILTERS, statusFilter, setStatusFilter)}
        </ScrollView>
        {/* Row 2: Date */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {renderPills(DATE_FILTERS, dateFilter, setDateFilter)}
        </ScrollView>
      </View>

      {/* Task list — flex:1 so ONLY this scrolls */}
      <SectionList
        style={styles.list}
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 12, paddingTop: 4 }}
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: c.background }]}>
            <Text style={[styles.sectionTitle, { color: c.mutedForeground }]}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => <HistoryItem task={item} />}
        ListEmptyComponent={
          filteredTasks.length === 0 && historyTasks.length > 0
            ? <EmptyState message="No history matches this filter." icon="filter" />
            : <EmptyState message="No history yet — complete your first task!" icon="clock" />
        }
        stickySectionHeadersEnabled
        showsVerticalScrollIndicator={false}
      />

      {/* FIX 4: Clear button — solid bg, sibling of SectionList, NEVER transparent */}
      {totalHistory > 0 && (
        <View style={[
          styles.clearWrapper,
          {
            backgroundColor: c.background,
            borderTopColor: c.border,
            paddingBottom: tabBarHeight + 12,
          },
        ]}>
          <Pressable
            style={[styles.clearBtn, { borderColor: '#EF4444', backgroundColor: c.background }]}
            onPress={() => setClearConfirm(true)}
          >
            <Feather name="trash-2" size={16} color="#EF4444" />
            <Text style={styles.clearBtnText}>Clear History</Text>
          </Pressable>
        </View>
      )}

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
  // FIX 5: filter rows block
  filterBlock: {
    borderBottomWidth: 1,
    paddingVertical: 4,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 5,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  // List
  list: { flex: 1 },
  sectionHeader: { paddingHorizontal: 16, paddingVertical: 8 },
  sectionTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.8 },
  // History item
  item: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  itemStrip: { width: 4 },
  itemBody: { flex: 1, padding: 12, gap: 6 },
  itemTitle: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  metaDate: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  subtaskCount: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  // FIX 4: Clear button — solid bg, top border separator
  clearWrapper: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 14,
  },
  clearBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#EF4444' },
});
