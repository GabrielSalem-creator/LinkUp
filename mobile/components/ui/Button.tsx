import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { fonts, radius } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeContext';

type Variant = 'primary' | 'secondary' | 'ghost' | 'teal' | 'danger';
type Size = 'md' | 'lg' | 'sm';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
};

/**
 * Button hierarchy:
 *  primary   – coral fill, main action on a screen
 *  teal      – deep-teal fill, strong secondary action (e.g. "View tickets")
 *  secondary – white card with a teal outline and teal text
 *  ghost     – text-only, used for "cancel / back" style actions
 *  danger    – red outline, destructive confirmation
 */
export default function Button({ label, onPress, variant = 'primary', size = 'md', loading, disabled, style, icon, iconRight }: Props) {
  const { colors } = useTheme();

  let bg: string = colors.accent;
  let fg: string = colors.accentForeground;
  let border: string = colors.accent;
  let borderWidth = 0;

  if (variant === 'teal') {
    bg = colors.primary;
    fg = colors.primaryForeground;
    border = colors.primary;
  } else if (variant === 'secondary') {
    bg = colors.card;
    fg = colors.primary;
    border = colors.primary;
    borderWidth = 1.5;
  } else if (variant === 'ghost') {
    bg = 'transparent';
    fg = colors.primary;
    border = 'transparent';
  } else if (variant === 'danger') {
    bg = colors.card;
    fg = colors.destructive;
    border = colors.destructive;
    borderWidth = 1.5;
  }

  const height = size === 'lg' ? 56 : size === 'sm' ? 44 : 52;
  const fontSize = size === 'lg' ? 17 : size === 'sm' ? 14 : 15;
  const iconSize = size === 'sm' ? 16 : 18;
  const off = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [
        styles.btn,
        {
          height,
          minHeight: height,
          backgroundColor: bg,
          borderColor: border,
          borderWidth,
          opacity: off ? 0.45 : 1,
          transform: pressed && !off ? [{ scale: 0.98 }] : undefined,
        },
        pressed && !off && variant !== 'ghost' ? { opacity: 0.9 } : null,
        pressed && !off && variant === 'ghost' ? { backgroundColor: colors.secondary } : null,
        variant === 'primary' || variant === 'teal' ? styles.raised : null,
        Platform.OS === 'web' ? ({ cursor: off ? 'not-allowed' : 'pointer', transitionDuration: '120ms' } as object) : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.inner}>
          {icon ? <Ionicons name={icon} size={iconSize} color={fg} /> : null}
          <Text style={[styles.label, { color: fg, fontSize }]} numberOfLines={1}>
            {label}
          </Text>
          {iconRight ? <Ionicons name={iconRight} size={iconSize} color={fg} /> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 520 : undefined,
    alignSelf: 'stretch',
  },
  raised: {
    shadowColor: '#133440',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontFamily: fonts.bodyBold, letterSpacing: 0.1 },
});
