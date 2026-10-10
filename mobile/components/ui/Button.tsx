import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { fonts, radius } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeContext';

type Variant = 'primary' | 'secondary' | 'ghost' | 'teal';
type Size = 'md' | 'lg' | 'sm';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  style,
}: Props) {
  const { colors } = useTheme();

  let bg: string = colors.accent;
  let fg: string = colors.accentForeground;
  let border: string = colors.accent;

  if (variant === 'teal') {
    bg = colors.primary;
    fg = colors.primaryForeground;
    border = colors.primary;
  } else if (variant === 'secondary') {
    bg = colors.secondary;
    fg = colors.foreground;
    border = colors.border;
  } else if (variant === 'ghost') {
    bg = 'transparent';
    fg = colors.foreground;
    border = colors.border;
  }

  const height = size === 'lg' ? 56 : size === 'sm' ? 44 : 52;
  const fontSize = size === 'lg' ? 17 : size === 'sm' ? 14 : 16;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={({ pressed }) => [
        styles.btn,
        {
          height,
          minHeight: height,
          backgroundColor: bg,
          borderColor: border,
          opacity: disabled || loading ? 0.55 : pressed ? 0.88 : 1,
          transform: pressed && !disabled ? [{ scale: 0.985 }] : undefined,
          ...(Platform.OS === 'web'
            ? ({ cursor: disabled || loading ? 'not-allowed' : 'pointer' } as object)
            : null),
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.label, { color: fg, fontSize }]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 520 : undefined,
    alignSelf: 'stretch',
  },
  label: { fontFamily: fonts.bodySemi, letterSpacing: 0.2 },
});
