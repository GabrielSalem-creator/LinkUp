import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, radius } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeContext';

export type Segment<T extends string> = { key: T; label: string };

/** Keyboard- and screen-reader-friendly segmented control (role=tab, 44px targets). */
export default function SegmentedTabs<T extends string>({ segments, value, onChange, compact }: { segments: Segment<T>[]; value: T; onChange: (v: T) => void; compact?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.secondary }]} accessibilityRole="tablist">
      {segments.map((s) => {
        const on = s.key === value;
        return (
          <Pressable
            key={s.key}
            onPress={() => onChange(s.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={s.label}
            style={({ pressed }) => [
              styles.tab,
              compact && styles.compact,
              on && { backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
              pressed && { opacity: 0.85 },
              Platform.OS === 'web' ? ({ cursor: 'pointer', outlineColor: colors.accent } as object) : null,
            ]}
          >
            <Text style={[styles.text, { color: on ? colors.foreground : colors.mutedForeground }]} numberOfLines={1}>
              {s.label}
            </Text>
            {on ? <View style={[styles.underline, { backgroundColor: colors.accent }]} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', borderRadius: radius.full, padding: 4, gap: 2 },
  tab: { flex: 1, minHeight: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  compact: { minHeight: 40 },
  text: { fontFamily: fonts.bodySemi, fontSize: 13 },
  underline: { width: 16, height: 3, borderRadius: 2, marginTop: 3 },
});
