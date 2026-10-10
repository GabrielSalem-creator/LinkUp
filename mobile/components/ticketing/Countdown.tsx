import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { fonts } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeContext';

/** Counts down to an ISO deadline; announces expiry via live region text. */
export default function Countdown({ until, onExpire, prefix = 'Seats held for' }: { until: string; onExpire?: () => void; prefix?: string }) {
  const { colors } = useTheme();
  const [left, setLeft] = useState(() => Math.max(0, Date.parse(until) - Date.now()));
  useEffect(() => {
    const id = setInterval(() => {
      const l = Math.max(0, Date.parse(until) - Date.now());
      setLeft(l);
      if (l === 0) {
        clearInterval(id);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [until, onExpire]);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  const expired = left === 0;
  return (
    <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: expired ? colors.destructive : m < 2 ? '#C47B16' : colors.mutedForeground }} accessibilityLiveRegion="polite">
      {expired ? 'Hold expired' : `${prefix} ${m}:${String(s).padStart(2, '0')}`}
    </Text>
  );
}
