import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { type Href, useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import TeamBadge from '@/components/competition/TeamBadge';
import StatusPill from '@/components/competition/StatusPill';
import { fonts, radius } from '@/constants/theme';
import type { CompetitionTeam, Match, Venue } from '@/lib/competition';
import { useTheme } from '@/lib/ThemeContext';

export function matchStatusMeta(status: Match['status']): { label: string; tone: 'neutral' | 'live' | 'success' | 'warning' | 'danger' } {
  switch (status) {
    case 'live':
      return { label: 'Live', tone: 'live' };
    case 'final':
      return { label: 'Full time', tone: 'success' };
    case 'postponed':
      return { label: 'Postponed', tone: 'warning' };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'danger' };
    default:
      return { label: 'Upcoming', tone: 'neutral' };
  }
}

type Props = { match: Match; home?: CompetitionTeam | null; away?: CompetitionTeam | null; venue?: Venue | null; ticketHint?: string | null };

export default function MatchCard({ match, home, away, venue, ticketHint }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const meta = matchStatusMeta(match.status);
  const hasScore = match.home_score != null && match.away_score != null && (match.status === 'final' || match.status === 'live');
  const kickoff = parseISO(match.kickoff_at);
  const a11y = `${home?.name ?? 'Home'} versus ${away?.name ?? 'Away'}, ${meta.label}${hasScore ? `, ${match.home_score} to ${match.away_score}` : `, ${format(kickoff, 'EEE d MMM HH:mm')}`}`;

  return (
    <Pressable
      onPress={() => router.push(`/match/${match.id}` as Href)}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint="Opens match details"
      style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.94 : 1 }, Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null]}
    >
      <View style={styles.row}>
        <View style={styles.team}>
          <TeamBadge team={home} size={40} />
          <Text style={[styles.teamName, { color: colors.foreground }]} numberOfLines={2}>
            {home?.name ?? 'TBC'}
          </Text>
        </View>
        <View style={styles.center}>
          {hasScore ? (
            <View style={[styles.scoreBox, { backgroundColor: match.status === 'live' ? colors.accent : colors.primary }]}>
              <Text style={styles.score}>
                {match.home_score} - {match.away_score}
              </Text>
            </View>
          ) : (
            <View style={styles.timeBox}>
              <Text style={[styles.time, { color: colors.foreground }]}>{format(kickoff, 'HH:mm')}</Text>
              <Text style={[styles.date, { color: colors.mutedForeground }]}>{format(kickoff, 'EEE d MMM')}</Text>
            </View>
          )}
          <StatusPill label={meta.label} tone={meta.tone} small />
        </View>
        <View style={styles.team}>
          <TeamBadge team={away} size={40} />
          <Text style={[styles.teamName, { color: colors.foreground }]} numberOfLines={2}>
            {away?.name ?? 'TBC'}
          </Text>
        </View>
      </View>
      <View style={[styles.foot, { borderTopColor: colors.border }]}>
        <View style={styles.footItem}>
          <Ionicons name="location-outline" size={12} color={colors.mutedForeground} />
          <Text style={[styles.footText, { color: colors.mutedForeground }]} numberOfLines={1}>
            {venue ? `${venue.name}, ${venue.city}` : 'Venue TBC'}
          </Text>
        </View>
        {ticketHint ? (
          <View style={styles.footItem}>
            <Ionicons name="ticket-outline" size={12} color={colors.primary} />
            <Text style={[styles.footText, { color: colors.primary }]}>{ticketHint}</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, marginBottom: 10, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8 },
  team: { flex: 1, alignItems: 'center', gap: 6 },
  teamName: { fontFamily: fonts.bodySemi, fontSize: 12, textAlign: 'center', lineHeight: 16 },
  center: { alignItems: 'center', gap: 6, minWidth: 96 },
  scoreBox: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.sm },
  score: { color: '#fff', fontFamily: fonts.heading, fontSize: 20, letterSpacing: 1 },
  timeBox: { alignItems: 'center' },
  time: { fontFamily: fonts.heading, fontSize: 20, letterSpacing: -0.3 },
  date: { fontFamily: fonts.body, fontSize: 11 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth },
  footItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, flex: 1 },
  footText: { fontFamily: fonts.bodyMed, fontSize: 11, flexShrink: 1 },
});
