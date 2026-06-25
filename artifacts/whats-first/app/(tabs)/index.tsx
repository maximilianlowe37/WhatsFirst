// Main task list screen — grouped by date, filterable, paginated.
// FIX 3: FilterBar is a sibling of SectionList (NOT inside ListHeaderComponent),
// SectionList has flex:1 so ONLY it scrolls; header + filter bar stay pinned.
import React, { useMemo, useState } from 'react';
import {
  Platform, Pressable, SectionList, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useTasks } from '@/contexts/TasksContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Task, FilterOption } from '@/types';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FilterBar } from '@/components/FilterBar';
import { TaskCard } from '@/components/TaskCard';
import { AddTaskModal } from '@/components/AddTaskModal';
import { TaskDetailModal } from '@/components/TaskDetailModal';
import { EmptyState } from '@/components/EmptyState';
import { BypassButton } from '@/components/BypassButton';
import { FocusStatusPill } from '@/components/FocusStatusPill';
import { todayISO, withinDays, formatDayLabel } from '@/utils/dateHelpers';

const URGENCY_ORDER = { high: 0, medium: 1, low: 2 };
const PAGE_SIZE = 10;

function HomeTitle() {
  const c = useColors();
  return (
    <Text style={[styles.titleText, { color: c.foreground }]} numberOfLines={1}>
      {'What\'s first'}
      <Text style={{ color: c.primary }}>?</Text>
    </Text>
  );
}

export default function TasksScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { tasks } = useTasks();
  const { settings } = useSettings();
  const [filter, setFilter] = useState<FilterOption>('all');
  const [addVisible, setAddVisible] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [page, setPage] = useState(1);

  const today = todayISO();

  // Filter active tasks
  const filtered = useMemo(() => {
    const active = tasks.filter((t) => t.status === 'active');
    switch (filter) {
      case 'today': return active.filter((t) => t.dueDate === today);
      case 'week': return active.filter((t) => withinDays(t.dueDate, 7));
      case 'urgent': return active.filter((t) => t.urgency === 'high');
      case 'subtasks': return active.filter((t) => t.subtasks.length > 0);
      default: return active;
    }
  }, [tasks, filter, today]);

  // Sort: by dueDate ASC, within each date by urgency
  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => {
      const dComp = a.dueDate.localeCompare(b.dueDate);
      if (dComp !== 0) return dComp;
      return URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
    }),
    [filtered]
  );

  const paginated = sorted.slice(0, page * PAGE_SIZE);
  const hasMore = sorted.length > paginated.length;
  const totalCount = sorted.length;
  const shownCount = paginated.length;
  const remaining = sorted.length - paginated.length;

  // Group into sections by dueDate
  const sections = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of paginated) {
      const existing = map.get(t.dueDate) || [];
      existing.push(t);
      map.set(t.dueDate, existing);
    }
    return Array.from(map.entries()).map(([date, data]) => ({
      title: formatDayLabel(date),
      date,
      data,
    }));
  }, [paginated]);

  function resetPagination(f: FilterOption) {
    setFilter(f);
    setPage(1);
  }

  // Tab bar ≈ 49pt + bottom inset; FAB floats above it
  const tabBarHeight = 49 + insets.bottom;
  const fabBottom = tabBarHeight + 12;
  const listBottomPad = tabBarHeight + 24;

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>

      {/* 1. Safe-area-aware header — NEVER scrolls */}
      <ScreenHeader
        titleNode={<HomeTitle />}
        rightContent={<BypassButton />}
      />

      {/* Focus mode status — auto-hides when surveillance is off */}
      <FocusStatusPill />

      {/* Surveillance off banner */}
      {!settings.surveillanceEnabled && (
        <View style={[styles.banner, { backgroundColor: '#F97316' }]}>
          <Text style={styles.bannerText}>
            Surveillance off — your apps are not being monitored.
          </Text>
        </View>
      )}
      {!settings.surveillanceEnabled && (
        <View style={[styles.banner, { backgroundColor: '#F97316' }]}>
          <Text style={styles.bannerText}>
            Surveillance off — your apps are not being monitored.
          </Text>
        </View>
      )}

      {/* 3. Filter bar — NEVER scrolls, always pinned below header.
              It is a SIBLING of SectionList, NOT inside ListHeaderComponent. */}
      <View style={[styles.filterBarWrapper, { backgroundColor: c.background, borderBottomColor: c.border }]}>
        <FilterBar active={filter} onChange={resetPagination} />
      </View>

      {/* 4. Task count — pinned, never scrolls */}
      {totalCount > 0 && (
        <Text style={[styles.countLabel, { color: c.mutedForeground }]}>
          Showing {shownCount} of {totalCount} task{totalCount !== 1 ? 's' : ''}
        </Text>
      )}

      {/* 5. SectionList — THIS IS THE ONLY THING THAT SCROLLS */}
      <SectionList
        style={styles.list}
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: listBottomPad, paddingTop: 4 }}
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: c.background }]}>
            <Text style={[styles.sectionTitle, { color: c.foreground }]}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TaskCard task={item} onPressDetail={setDetailTask} />
        )}
        ListEmptyComponent={
          <EmptyState message="Nothing here — What's first?" />
        }
        ListFooterComponent={hasMore ? (
          <Pressable
            style={[styles.loadMoreBtn, { borderColor: c.border, backgroundColor: c.card }]}
            onPress={() => setPage((p) => p + 1)}
          >
            <Text style={[styles.loadMoreText, { color: c.primary }]}>
              Load {remaining} more
            </Text>
          </Pressable>
        ) : null}
        stickySectionHeadersEnabled
        showsVerticalScrollIndicator={false}
      />

      {/* 6. FAB — floats above tab bar */}
      <Pressable
        style={[styles.fab, { backgroundColor: c.primary, bottom: fabBottom }]}
        onPress={() => setAddVisible(true)}
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>

      <AddTaskModal visible={addVisible} onClose={() => setAddVisible(false)} />
      <TaskDetailModal task={detailTask} onClose={() => setDetailTask(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  titleText: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  banner: { paddingHorizontal: 16, paddingVertical: 10 },
  bannerText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  // FIX 3: Pinned filter bar wrapper with solid bg + bottom border
  filterBarWrapper: {
    borderBottomWidth: 1,
    zIndex: 10,
  },
  countLabel: {
    fontSize: 12, fontFamily: 'Inter_400Regular',
    paddingHorizontal: 16, paddingVertical: 6,
  },
  // FIX 3: flex:1 ensures ONLY the list scrolls
  list: { flex: 1 },
  sectionHeader: { paddingHorizontal: 16, paddingVertical: 8 },
  sectionTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.8 },
  loadMoreBtn: {
    marginHorizontal: 16, marginVertical: 10,
    borderRadius: 12, borderWidth: 1, paddingVertical: 12, alignItems: 'center',
  },
  loadMoreText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  fab: {
    position: 'absolute',
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabIcon: { color: '#fff', fontSize: 28, lineHeight: 32, fontFamily: 'Inter_400Regular' },
});
