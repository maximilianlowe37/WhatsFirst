// ScreenHeader — reusable header that always clears the notch, Dynamic Island,
// and status bar on any iPhone model using manual inset padding.
// Do NOT use SafeAreaView here — manual insets are more reliable across Expo versions.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

interface Props {
  title?: string;
  titleNode?: React.ReactNode;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
}

export function ScreenHeader({ title, titleNode, leftContent, rightContent }: Props) {
  const insets = useSafeAreaInsets();
  const c = useColors();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 8,
          backgroundColor: c.background,
          borderBottomColor: c.border,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.side}>{leftContent ?? null}</View>
        <View style={styles.titleArea}>
          {titleNode ?? (
            <Text style={[styles.title, { color: c.foreground }]} numberOfLines={1}>
              {title}
            </Text>
          )}
        </View>
        <View style={[styles.side, styles.sideRight]}>{rightContent ?? null}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  side: {
    minWidth: 70,
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  titleArea: {
    flex: 1,
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
});
