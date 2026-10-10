import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, radius } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeContext';

type Tone = 'primary' | 'accent';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  /** colour swatch shown before the label (e.g. a team colour) */
  swatch?: string;
  tone?: Tone;
  size?: 'md' | 'sm';
  role?: 'tab' | 'radio' | 'button';
  accessibilityLabel?: string;
};

/**
 * One chip for every filter / selector in the app.
 * Selected = solid fill + white text; unselected = white card + border. 44px tall (40 for small).
 */
export default function Chip({ label, selected, onPress, disabled, icon, swatch, tone = 'primary', size = 'md', role = 'button', accessibilityLabel }: Props) {
  const { colors } = useTheme();
  const fill = tone === 'accent' ? colors.accent : colors.primary;
  const fillFg = tone === 'accent' ? colors.accentForeground : colors.primaryForeground;
  const bg = selected ? fill : colors.card;
  const fg = selected ? fillFg : disabled ? colors.mutedForeground : colors.foreground;
  const border = selected ? fill : colors.border;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      style={({ pressed }) => [
        styles.chip,
        size === 'sm' && styles.sm,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        selected ? styles.selectedShadow : null,
        Platform.OS === 'web' ? ({ cursor: disabled ? 'not-allowed' : 'pointer', transitionDuration: '120ms' } as object) : null,
      ]}
    >
      {swatch ? <View style={[styles.swatch, { backgroundColor: swatch, borderColor: selected ? 'rgba(255,255,255,0.7)' : colors.border }]} /> : null}
      {icon ? <Ionicons name={icon} size={size === 'sm' ? 14 : 16} color={fg} /> : null}
      <Text style={[styles.label, size === 'sm' && styles.labelSm, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
  sm: { height: 40, paddingHorizontal: 14 },
  selectedShadow: { shadowColor: '#133440', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  label: { fontFamily: fonts.bodySemi, fontSize: 14 },
  labelSm: { fontSize: 13 },
});
