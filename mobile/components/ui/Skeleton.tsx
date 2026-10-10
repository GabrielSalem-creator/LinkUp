import { StyleSheet, View, type DimensionValue } from 'react-native';

import { radius } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeContext';

/** Static placeholder blocks (no animation, so reduced-motion users see nothing flashing). */
export function SkeletonBlock({ width = '100%', height = 16, round }: { width?: DimensionValue; height?: number; round?: boolean }) {
  const { colors } = useTheme();
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width, height, borderRadius: round ? height / 2 : radius.sm, backgroundColor: colors.secondary }} />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityLabel="Loading">
      <View style={styles.row}>
        <SkeletonBlock width={40} height={40} round />
        <View style={{ flex: 1, gap: 8 }}>
          {Array.from({ length: lines }).map((_, i) => (
            <SkeletonBlock key={i} width={i === 0 ? '70%' : i === 1 ? '90%' : '50%'} height={12} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
});
