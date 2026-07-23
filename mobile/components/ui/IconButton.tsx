import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeContext';

type IconName = keyof typeof Ionicons.glyphMap;

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  background?: string;
  onPress?: () => void;
  badge?: boolean;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
};

/** Consistent round icon control used across headers and actions */
export default function IconButton({
  name,
  size = 20,
  color,
  background,
  onPress,
  badge,
  style,
  hitSlop = 8,
}: Props) {
  const { colors } = useTheme();
  const fg = color ?? colors.foreground;
  const bg = background ?? colors.secondary;

  const inner = (
    <View style={[styles.btn, { backgroundColor: bg }, style]}>
      <Ionicons name={name} size={size} color={fg} />
      {badge ? <View style={[styles.dot, { backgroundColor: colors.destructive }]} /> : null}
    </View>
  );

  if (!onPress) return inner;

  return (
    <Pressable onPress={onPress} hitSlop={hitSlop} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}>
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
});
