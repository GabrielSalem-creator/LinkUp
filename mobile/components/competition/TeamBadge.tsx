import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { fonts } from '@/constants/theme';
import type { CompetitionTeam } from '@/lib/competition';

type Props = { team?: CompetitionTeam | null; size?: number; label?: boolean };

/** Team logo, or colours + initials when no logo exists (media fallback level 6). */
export default function TeamBadge({ team, size = 36, label }: Props) {
  const bg = team?.primary_color || '#133440';
  const fg = team?.secondary_color || '#FFFFFF';
  const initials = (team?.short_name || team?.name || '?').slice(0, 3).toUpperCase();
  return (
    <View style={styles.wrap} accessible accessibilityLabel={team?.name || 'Team'}>
      {team?.logo_url ? (
        <Image source={{ uri: team.logo_url }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
      ) : (
        <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, borderColor: fg }]}>
          <Text style={[styles.initials, { color: fg, fontSize: Math.max(9, size * 0.3) }]}>{initials}</Text>
        </View>
      )}
      {label ? (
        <Text style={styles.label} numberOfLines={1}>
          {team?.name}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 4 },
  circle: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  initials: { fontFamily: fonts.headingSemi, letterSpacing: 0.5 },
  label: { fontFamily: fonts.bodyMed, fontSize: 11 },
});
