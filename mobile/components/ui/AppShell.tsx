import { ReactNode } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/lib/ThemeContext';

const DESKTOP_MAX = 480;

type Props = {
  children: ReactNode;
  /** Use deep teal behind letterboxing (login) */
  deep?: boolean;
};

/** Centers the app on large screens and paints edge-to-edge so no white strips show. */
export default function AppShell({ children, deep }: Props) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = Platform.OS === 'web' && width > DESKTOP_MAX + 40;
  const canvas = deep ? colors.primary : colors.background;

  return (
    <View style={[styles.outer, { backgroundColor: canvas }]}>
      <View
        style={[
          styles.inner,
          wide && styles.innerWide,
          wide && { borderColor: colors.border },
          {
            backgroundColor: canvas,
            // Web notch / status strip — paint with canvas so no white gap
            paddingTop: Platform.OS === 'web' ? Math.max(insets.top, 0) : 0,
            maxWidth: wide ? DESKTOP_MAX : undefined,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  inner: {
    flex: 1,
    width: '100%',
  },
  innerWide: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
});
