import { Ionicons } from '@expo/vector-icons';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, radius } from '@/constants/theme';
import { registerNotifier, type NotifyTone } from '@/lib/notify';
import { useTheme } from '@/lib/ThemeContext';

type ToastItem = { id: number; title: string; message?: string; tone: NotifyTone };

const ToastContext = createContext<{ show: (title: string, message?: string, tone?: NotifyTone) => void } | null>(null);

/**
 * In-app notifications that work on web too (RN's Alert is a no-op on web).
 * Renders at the top, auto-dismisses, announced to screen readers via live region.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const show = useCallback((title: string, message?: string, tone: NotifyTone = 'info') => {
    const id = ++seq.current;
    setItems((prev) => [...prev.slice(-2), { id, title, message, tone }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), tone === 'error' ? 7000 : 4500);
  }, []);
  useEffect(() => registerNotifier(show), [show]);
  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastHost items={items} onDismiss={(id) => setItems((prev) => prev.filter((t) => t.id !== id))} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

function ToastHost({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: number) => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  if (!items.length) return null;
  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 10 }]} accessibilityLiveRegion="polite">
      {items.map((t) => {
        const color = t.tone === 'error' ? colors.destructive : t.tone === 'success' ? colors.success : t.tone === 'warning' ? '#C47B16' : colors.primary;
        const icon: keyof typeof Ionicons.glyphMap = t.tone === 'error' ? 'alert-circle' : t.tone === 'success' ? 'checkmark-circle' : t.tone === 'warning' ? 'warning' : 'information-circle';
        return (
          <Pressable key={t.id} onPress={() => onDismiss(t.id)} accessibilityRole="alert" style={[styles.toast, { backgroundColor: colors.card, borderColor: color }]}>
            <Ionicons name={icon} size={20} color={color} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.foreground }]}>{t.title}</Text>
              {t.message ? <Text style={[styles.msg, { color: colors.mutedForeground }]}>{t.message}</Text> : null}
            </View>
            <Ionicons name="close" size={16} color={colors.mutedForeground} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 12, right: 12, gap: 8, zIndex: 1000, ...(Platform.OS === 'web' ? ({ maxWidth: 456, marginHorizontal: 'auto' } as object) : {}) },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  title: { fontFamily: fonts.bodySemi, fontSize: 14 },
  msg: { fontFamily: fonts.body, fontSize: 13, marginTop: 2, lineHeight: 18 },
});
