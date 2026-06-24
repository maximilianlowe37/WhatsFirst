// Filter pill bar for the main task list.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { FilterOption } from '@/types';

const FILTERS: { key: FilterOption; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'subtasks', label: 'Has Subtasks' },
];

interface Props {
  active: FilterOption;
  onChange: (filter: FilterOption) => void;
}

export function FilterBar({ active, onChange }: Props) {
  const c = useColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {FILTERS.map((f) => {
        const isActive = f.key === active;
        return (
          <Pressable
            key={f.key}
            style={[
              styles.pill,
              { borderColor: isActive ? c.primary : c.border },
              isActive && { backgroundColor: c.primary },
            ]}
            onPress={() => onChange(f.key)}
          >
            <Text style={[styles.label, { color: isActive ? '#fff' : c.mutedForeground }]}>
              {f.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  label: { fontSize: 13, fontFamily: 'Inter_500Medium' },
});
