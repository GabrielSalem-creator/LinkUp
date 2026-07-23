import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, radius } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeContext';

type Props = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  large?: boolean;
};

export default function ScreenHeader({ title, subtitle, right, large }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { borderBottomColor: colors.border }]}>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            large ? styles.brand : styles.title,
            { color: large ? colors.primary : colors.foreground },
          ]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>{subtitle}</Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

export function MetaChip({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: colors.secondary }]}>
      <Ionicons name={icon} size={12} color={colors.primary} />
      <Text style={[styles.chipText, { color: colors.foreground }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  brand: { fontFamily: fonts.heading, fontSize: 28, letterSpacing: -0.6 },
  title: { fontFamily: fonts.heading, fontSize: 24, letterSpacing: -0.4 },
  sub: { fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    maxWidth: 180,
  },
  chipText: { fontFamily: fonts.bodyMed, fontSize: 12 },
});
