import { StyleSheet, Text, View } from 'react-native';

import { fonts, sportColors } from '@/constants/theme';

export default function SportBadge({ sport, size = 'md' }: { sport: string; size?: 'sm' | 'md' }) {
  const key = sport.toLowerCase().replace(/\s+/g, '_');
  const color = sportColors[key] || sportColors.other;
  const label = sport.replace(/_/g, ' / ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <View
      style={[
        styles.badge,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: `${color}22` },
      ]}
    >
      <Text style={[styles.text, size === 'sm' ? styles.textSm : styles.textMd, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  sm: { paddingHorizontal: 8, paddingVertical: 2 },
  md: { paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontFamily: fonts.bodySemi },
  textSm: { fontSize: 10 },
  textMd: { fontSize: 12 },
});
