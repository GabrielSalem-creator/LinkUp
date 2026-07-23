import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, radius, sportColors, sportIcons } from '@/constants/theme';

export default function SportBadge({ sport, size = 'md' }: { sport: string; size?: 'sm' | 'md' }) {
  const key = sport.toLowerCase().replace(/\s+/g, '_');
  const color = sportColors[key] || sportColors.other;
  const icon = (sportIcons[key] || sportIcons.other) as keyof typeof Ionicons.glyphMap;
  const label = sport.replace(/_/g, ' / ').replace(/\b\w/g, (c) => c.toUpperCase());
  const sm = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        sm ? styles.sm : styles.md,
        { backgroundColor: `${color}18`, borderColor: `${color}33` },
      ]}
    >
      <Ionicons name={icon} size={sm ? 11 : 13} color={color} />
      <Text style={[styles.text, sm ? styles.textSm : styles.textMd, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.full,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
  },
  sm: { paddingHorizontal: 8, paddingVertical: 3 },
  md: { paddingHorizontal: 10, paddingVertical: 5 },
  text: { fontFamily: fonts.bodySemi },
  textSm: { fontSize: 10 },
  textMd: { fontSize: 12 },
});
