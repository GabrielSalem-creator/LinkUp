import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, radius } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeContext';

type Tone = 'error' | 'info' | 'warning' | 'success';

/** Inline message with an optional action (used for offline/error/retry, permission, repricing…). */
export default function Notice({ tone = 'info', title, message, actionLabel, onAction, live }: { tone?: Tone; title?: string; message: string; actionLabel?: string; onAction?: () => void; live?: boolean }) {
  const { colors } = useTheme();
  const color = tone === 'error' ? colors.destructive : tone === 'warning' ? '#C47B16' : tone === 'success' ? colors.success : colors.primary;
  const icon: keyof typeof Ionicons.glyphMap = tone === 'error' ? 'alert-circle' : tone === 'warning' ? 'warning' : tone === 'success' ? 'checkmark-circle' : 'information-circle';
  return (
    <View style={[styles.wrap, { backgroundColor: `${color}14`, borderColor: `${color}55` }]} accessibilityRole={tone === 'error' ? 'alert' : 'text'} accessibilityLiveRegion={live ? 'polite' : 'none'}>
      <Ionicons name={icon} size={18} color={color} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text> : null}
        <Text style={[styles.msg, { color: colors.foreground }]}>{message}</Text>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} accessibilityRole="button" style={({ pressed }) => [styles.action, { opacity: pressed ? 0.7 : 1 }]}>
            <Text style={[styles.actionText, { color }]}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, marginBottom: 12 },
  title: { fontFamily: fonts.bodySemi, fontSize: 13 },
  msg: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  action: { marginTop: 6, minHeight: 32, justifyContent: 'center', alignSelf: 'flex-start' },
  actionText: { fontFamily: fonts.bodySemi, fontSize: 13, textDecorationLine: 'underline' },
});
