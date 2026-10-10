import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, radius } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeContext';

type Tone = 'neutral' | 'live' | 'success' | 'warning' | 'danger' | 'info';

const ICONS: Record<Tone, keyof typeof Ionicons.glyphMap> = {
  neutral: 'time-outline',
  live: 'radio-outline',
  success: 'checkmark-circle-outline',
  warning: 'alert-circle-outline',
  danger: 'close-circle-outline',
  info: 'information-circle-outline',
};

/** Status is always conveyed with icon + text, never colour alone. */
export default function StatusPill({ label, tone = 'neutral', icon, small }: { label: string; tone?: Tone; icon?: keyof typeof Ionicons.glyphMap; small?: boolean }) {
  const { colors } = useTheme();
  const toneColor =
    tone === 'live' ? colors.accent : tone === 'success' ? colors.success : tone === 'warning' ? '#C47B16' : tone === 'danger' ? colors.destructive : tone === 'info' ? colors.primary : colors.mutedForeground;
  return (
    <View style={[styles.pill, small && styles.small, { backgroundColor: `${toneColor}1A`, borderColor: `${toneColor}55` }]} accessibilityRole="text" accessibilityLabel={`Status: ${label}`}>
      <Ionicons name={icon || ICONS[tone]} size={small ? 11 : 13} color={toneColor} />
      <Text style={[styles.text, small && { fontSize: 10 }, { color: toneColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, borderWidth: 1, alignSelf: 'flex-start' },
  small: { paddingHorizontal: 8, paddingVertical: 3 },
  text: { fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 0.2 },
});
