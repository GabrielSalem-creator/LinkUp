import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { fonts, radius } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeContext';

type Variant = 'primary' | 'secondary' | 'ghost' | 'teal';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function Button({
  label,
  onPress,
  variant = 'primary',
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

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: bg,
          borderColor: border,
          opacity: disabled || loading ? 0.65 : pressed ? 0.9 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.label, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  label: { fontFamily: fonts.bodySemi, fontSize: 16 },
});
