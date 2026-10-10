import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import TeamBadge from '@/components/competition/TeamBadge';
import { fonts, radius } from '@/constants/theme';
import type { CompetitionTeam, Player } from '@/lib/competition';
import { useTheme } from '@/lib/ThemeContext';

export type BoardRow = { rank: number; player_id: string; team_id?: string; value: number; games?: number; previous_rank?: number };

function PlayerAvatar({ player, size = 44, color }: { player?: Player; size?: number; color: string }) {
  const initials = (player?.full_name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  if (player?.photo_url) return <Image source={{ uri: player.photo_url }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${color}22`, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.headingSemi, color, fontSize: size * 0.34 }}>{initials}</Text>
    </View>
  );
}

export function LeaderCard({
  title,
  rows,
  players,
  teams,
  decimals,
  onPress,
  expanded,
}: {
  title: string;
  rows: BoardRow[];
  players: Record<string, Player>;
  teams: Record<string, CompetitionTeam>;
  decimals: number;
  onPress: () => void;
  expanded: boolean;
}) {
  const { colors } = useTheme();
  const top = rows[0];
  const leader = top ? players[top.player_id] : undefined;
  const team = top?.team_id ? teams[top.team_id] : undefined;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${title}. ${leader ? `Leader ${leader.full_name} with ${top.value.toFixed(decimals)}` : 'No data yet'}. ${expanded ? 'Collapse' : 'Expand'} ranking`}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: expanded ? colors.accent : colors.border, opacity: pressed ? 0.95 : 1 }, Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null]}
    >
      <View style={styles.cardHead}>
        <Text style={[styles.cardTitle, { color: colors.mutedForeground }]} numberOfLines={1}>
          {title}
        </Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.mutedForeground} />
      </View>
      {top ? (
        <View style={styles.leaderRow}>
          <PlayerAvatar player={leader} color={team?.primary_color || colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.leaderName, { color: colors.foreground }]} numberOfLines={1}>
              {leader?.full_name ?? top.player_id}
            </Text>
            <View style={styles.teamLine}>
              {team ? <TeamBadge team={team} size={14} /> : null}
              <Text style={[styles.teamText, { color: colors.mutedForeground }]} numberOfLines={1}>
                {team?.name ?? (leader?.nationality ? leader.nationality : '')}
              </Text>
            </View>
          </View>
          <Text style={[styles.value, { color: colors.accent }]}>{top.value.toFixed(decimals)}</Text>
        </View>
      ) : (
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>No data yet</Text>
      )}
    </Pressable>
  );
}

export function RankingList({
  rows,
  players,
  teams,
  decimals,
  valueLabel,
  showDelta,
}: {
  rows: BoardRow[];
  players: Record<string, Player>;
  teams: Record<string, CompetitionTeam>;
  decimals: number;
  valueLabel?: string;
  showDelta?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.list, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="list">
      {rows.map((r) => {
        const p = players[r.player_id];
        const t = r.team_id ? teams[r.team_id] : undefined;
        const delta = showDelta && r.previous_rank ? r.previous_rank - r.rank : 0;
        return (
          <View key={`${r.rank}-${r.player_id}`} style={[styles.listRow, { borderTopColor: colors.border }]} accessibilityLabel={`${r.rank}. ${p?.full_name ?? r.player_id}, ${r.value.toFixed(decimals)} ${valueLabel ?? ''}`}>
            <Text style={[styles.rank, { color: r.rank <= 3 ? colors.accent : colors.mutedForeground }]}>{r.rank}</Text>
            <PlayerAvatar player={p} size={32} color={t?.primary_color || colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                {p?.full_name ?? r.player_id}
                {p?.is_lebanese ? '' : p?.nationality ? `  ·  ${p.nationality}` : ''}
              </Text>
              <Text style={[styles.sub, { color: colors.mutedForeground }]} numberOfLines={1}>
                {t?.name ?? p?.position ?? ''}
                {r.games ? ` · ${r.games} games` : ''}
              </Text>
            </View>
            {showDelta ? (
              <View style={styles.delta} accessibilityLabel={delta > 0 ? `up ${delta}` : delta < 0 ? `down ${-delta}` : 'no change'}>
                <Ionicons name={delta > 0 ? 'arrow-up' : delta < 0 ? 'arrow-down' : 'remove'} size={12} color={delta > 0 ? colors.success : delta < 0 ? colors.destructive : colors.mutedForeground} />
                <Text style={[styles.deltaText, { color: colors.mutedForeground }]}>{delta === 0 ? '' : Math.abs(delta)}</Text>
              </View>
            ) : null}
            <Text style={[styles.listValue, { color: colors.primary }]}>{r.value.toFixed(decimals)}</Text>
          </View>
        );
      })}
      {!rows.length ? <Text style={[styles.empty, { color: colors.mutedForeground, padding: 16 }]}>No entries yet</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: 230, borderRadius: radius.lg, borderWidth: 1.5, padding: 14, marginRight: 10, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  cardTitle: { fontFamily: fonts.bodySemi, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  leaderName: { fontFamily: fonts.headingSemi, fontSize: 15 },
  teamLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  teamText: { fontFamily: fonts.body, fontSize: 11, flexShrink: 1 },
  value: { fontFamily: fonts.heading, fontSize: 22 },
  empty: { fontFamily: fonts.body, fontSize: 13 },
  list: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, minHeight: 48 },
  rank: { width: 22, fontFamily: fonts.bodyBold, fontSize: 13, textAlign: 'center' },
  name: { fontFamily: fonts.bodySemi, fontSize: 13 },
  sub: { fontFamily: fonts.body, fontSize: 11 },
  delta: { flexDirection: 'row', alignItems: 'center', width: 32, justifyContent: 'flex-end' },
  deltaText: { fontFamily: fonts.bodyMed, fontSize: 10 },
  listValue: { fontFamily: fonts.headingSemi, fontSize: 15, minWidth: 44, textAlign: 'right' },
});
