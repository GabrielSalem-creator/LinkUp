import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, radius } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeContext';

export default function QuantityStepper({ value, min = 1, max, onChange, label = 'Quantity' }: { value: number; min?: number; max: number; onChange: (v: number) => void; label?: string }) {
  const { colors } = useTheme();
  const btn = (icon: 'remove' | 'add', disabled: boolean, onPress: () => void, a11y: string) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.btn, { backgroundColor: disabled ? colors.secondary : colors.primary, opacity: pressed ? 0.8 : 1 }]}
    >
      <Ionicons name={icon} size={18} color={disabled ? colors.mutedForeground : colors.primaryForeground} />
    </Pressable>
  );
  return (
    <View style={styles.wrap} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min, max, now: value, text: `${value}` }}>
      {btn('remove', value <= min, () => onChange(Math.max(min, value - 1)), 'Decrease quantity')}
      <Text style={[styles.value, { color: colors.foreground }]}>{value}</Text>
      {btn('add', value >= max, () => onChange(Math.min(max, value + 1)), 'Increase quantity')}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btn: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  value: { fontFamily: fonts.heading, fontSize: 20, minWidth: 28, textAlign: 'center' },
});
