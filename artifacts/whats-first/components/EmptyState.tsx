// Empty state component shown when no tasks match the current filter.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface Props {
  message?: string;
  icon?: keyof typeof Feather.glyphMap;
}

export function EmptyState({ message = "Nothing here — What's first?", icon = 'check-circle' }: Props) {
  const c = useColors();
  return (
    <View style={styles.container}>
      <Feather name={icon} size={48} color={c.mutedForeground} />
      <Text style={[styles.text, { color: c.mutedForeground }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  text: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
