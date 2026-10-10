import { StyleSheet, Text, View } from 'react-native';

import TeamBadge from '@/components/competition/TeamBadge';
import { fonts, radius } from '@/constants/theme';
import type { CompetitionTeam, StandingRow } from '@/lib/competition';
import { useTheme } from '@/lib/ThemeContext';

type Props = { rows: StandingRow[]; teams: Record<string, CompetitionTeam>; highlightTeamId?: string; drawsPossible?: boolean; setBased?: boolean };

export default function StandingsTable({ rows, teams, highlightTeamId, drawsPossible = true, setBased }: Props) {
  const { colors } = useTheme();
  type ColKey = 'played' | 'won' | 'drawn' | 'lost' | 'diff' | 'points';
  const cols: { key: ColKey; label: string; a11y: string }[] = [
    { key: 'played', label: 'P', a11y: 'Played' },
    { key: 'won', label: 'W', a11y: 'Won' },
    ...(drawsPossible ? [{ key: 'drawn' as ColKey, label: 'D', a11y: 'Drawn' }] : []),
    { key: 'lost', label: 'L', a11y: 'Lost' },
    { key: 'diff', label: setBased ? 'SD' : 'GD', a11y: setBased ? 'Set difference' : 'Goal difference' },
    { key: 'points', label: 'Pts', a11y: 'Points' },
  ];

  return (
    <View style={[styles.table, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="list">
      <View style={[styles.head, { backgroundColor: colors.secondary }]}>
        <Text style={[styles.hPos, { color: colors.mutedForeground }]}>#</Text>
        <Text style={[styles.hTeam, { color: colors.mutedForeground }]}>Team</Text>
        {cols.map((c) => (
          <Text key={c.key} style={[styles.hCell, c.key === 'points' && styles.ptsCell, { color: colors.mutedForeground }]} accessibilityLabel={c.a11y}>
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => {
        const team = teams[r.team_id];
        const top = i < 3;
        const mine = r.team_id === highlightTeamId;
        return (
          <View
            key={r.id}
            accessibilityRole="text"
            accessibilityLabel={`${r.rank}. ${team?.name ?? r.team_id}: ${cols.map((c) => `${c.a11y} ${r[c.key]}`).join(', ')}`}
            style={[styles.row, { borderTopColor: colors.border }, mine && { backgroundColor: `${colors.accent}14` }]}
          >
            <View style={styles.posWrap}>
              <View style={[styles.posDot, { backgroundColor: top ? colors.accent : 'transparent' }]} />
              <Text style={[styles.pos, { color: colors.foreground }]}>{r.rank}</Text>
            </View>
            <View style={styles.teamCell}>
              <TeamBadge team={team} size={24} />
              <Text style={[styles.teamName, { color: colors.foreground }]} numberOfLines={1}>
                {team?.short_name && rows.length > 6 ? team.short_name : (team?.name ?? r.team_id)}
              </Text>
            </View>
            {cols.map((c) => (
              <Text key={c.key} style={[styles.cell, c.key === 'points' && [styles.ptsCell, styles.pts], { color: c.key === 'points' ? colors.primary : colors.foreground }]}>
                {c.key === 'diff' && r.diff > 0 ? `+${r.diff}` : r[c.key]}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  table: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10 },
  hPos: { width: 28, fontFamily: fonts.bodySemi, fontSize: 11 },
  hTeam: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 11 },
  hCell: { width: 30, textAlign: 'center', fontFamily: fonts.bodySemi, fontSize: 11 },
  ptsCell: { width: 36 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, borderTopWidth: StyleSheet.hairlineWidth, minHeight: 44 },
  posWrap: { width: 28, flexDirection: 'row', alignItems: 'center', gap: 4 },
  posDot: { width: 4, height: 16, borderRadius: 2 },
  pos: { fontFamily: fonts.bodyBold, fontSize: 12 },
  teamCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 4 },
  teamName: { fontFamily: fonts.bodySemi, fontSize: 13, flexShrink: 1 },
  cell: { width: 30, textAlign: 'center', fontFamily: fonts.bodyMed, fontSize: 12 },
  pts: { fontFamily: fonts.headingSemi, fontSize: 14 },
});
