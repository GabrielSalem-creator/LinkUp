import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { type Href, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { matchStatusMeta } from '@/components/competition/MatchCard';
import StatusPill from '@/components/competition/StatusPill';
import TeamBadge from '@/components/competition/TeamBadge';
import TeamHero from '@/components/competition/TeamHero';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import { fonts, radius } from '@/constants/theme';
import { getSportDefinition, resolveTeamMedia, type Competition, type CompetitionTeam, type Match, type MatchPlayerStat, type MatchTeamStat, type Player, type TeamMedia, type Venue } from '@/lib/competition';
import { competitionApi, ticketingApi, type Availability } from '@/lib/competitionApi';
import { ApiError } from '@/lib/serverApi';
import { formatMoney } from '@/lib/ticketing';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';

type Loaded = {
  match: Match;
  competition: Competition | null;
  home: CompetitionTeam | null;
  away: CompetitionTeam | null;
  venue: Venue | null;
  media: TeamMedia[];
  stats: { team: MatchTeamStat[]; players: MatchPlayerStat[] };
  players: Record<string, Player>;
};

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [availError, setAvailError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const match = await competitionApi.match(id);
      if (!match) {
        setError('This match is not available.');
        return;
      }
      const [competition, home, away, venue, media, stats] = await Promise.all([
        competitionApi.competition(match.competition_id),
        competitionApi.team(match.home_team_id),
        competitionApi.team(match.away_team_id),
        match.venue_id ? competitionApi.venue(match.venue_id) : Promise.resolve(null),
        competitionApi.media([match.home_team_id, match.away_team_id]),
        competitionApi.matchStats(match.id),
      ]);
      const players = await competitionApi.players(stats.players.map((p) => p.player_id));
      setData({ match, competition, home, away, venue, media, stats, players: Object.fromEntries(players.map((p) => [p.id, p])) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this match');
    }
  }, [id]);

  const loadAvailability = useCallback(async () => {
    if (!id) return;
    setAvailError(null);
    try {
      setAvailability(await ticketingApi.availability(id));
    } catch (e) {
      setAvailability(null);
      setAvailError(e instanceof ApiError && e.status === 404 ? null : e instanceof Error ? e.message : 'Ticket status unavailable');
    }
  }, [id]);

  useEffect(() => {
    load();
    loadAvailability();
  }, [load, loadAvailability]);

  const sportDef = data?.competition ? getSportDefinition(data.competition.sport) : null;
  const homeMedia = useMemo(
    () => (data ? resolveTeamMedia(data.media, { teamId: data.match.home_team_id, competitionId: data.match.competition_id, venueId: data.match.venue_id, matchOverrideUrl: data.match.media_override_home }) : null),
    [data],
  );
  const awayMedia = useMemo(
    () => (data ? resolveTeamMedia(data.media, { teamId: data.match.away_team_id, competitionId: data.match.competition_id, venueId: data.match.venue_id, matchOverrideUrl: data.match.media_override_away }) : null),
    [data],
  );

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Match' }} />
        <Notice tone="error" title="Match unavailable" message={error} actionLabel="Retry" onAction={load} />
        <Button label="Back to competitions" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }
  if (!data || !homeMedia || !awayMedia) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 16, gap: 12 }}>
        <Stack.Screen options={{ title: 'Match' }} />
        <SkeletonBlock height={190} />
        <SkeletonBlock height={24} width="60%" />
        <SkeletonBlock height={80} />
      </View>
    );
  }

  const { match, home, away, venue, competition } = data;
  const meta = matchStatusMeta(match.status);
  const kickoff = parseISO(match.kickoff_at);
  const hasScore = match.home_score != null && match.away_score != null && (match.status === 'final' || match.status === 'live');
  const wide = width >= 700;
  const heroHeight = wide ? 260 : 190;

  /* -------------------------- ticket status card -------------------------- */
  const ts = availability?.status;
  const ticketCard = () => {
    if (availError) return <Notice tone="warning" title="Ticket status unavailable" message={availError} actionLabel="Retry" onAction={loadAvailability} />;
    if (!availability) return <SkeletonBlock height={72} />;
    const map: Record<string, { label: string; tone: 'success' | 'warning' | 'neutral' | 'danger' | 'info'; cta?: string; desc: string }> = {
      available: { label: 'Tickets available', tone: 'success', cta: 'Get tickets', desc: ts?.fromMinor != null && ts.currency ? `From ${formatMoney(ts.fromMinor, ts.currency)} · ${ts.available} left` : 'Choose your section' },
      low_availability: { label: 'Selling fast', tone: 'warning', cta: 'Get tickets', desc: `Only ${ts?.available} left${ts?.fromMinor != null && ts.currency ? ` · from ${formatMoney(ts.fromMinor, ts.currency)}` : ''}` },
      not_on_sale: { label: 'Not on sale yet', tone: 'info', desc: 'Tickets will be released soon. Check back later.' },
      sold_out: { label: 'Sold out', tone: 'danger', desc: 'All tickets for this match have been sold.' },
      sales_closed: { label: 'Sales closed', tone: 'neutral', desc: 'Ticket sales for this match have ended.' },
      unavailable: { label: 'Booking unavailable', tone: 'neutral', desc: match.status === 'postponed' ? 'A new date will be announced.' : match.status === 'cancelled' ? 'This match was cancelled.' : 'No tickets are offered for this match.' },
    };
    const info = map[ts?.status ?? 'unavailable'];
    return (
      <View style={[styles.ticketCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={{ flex: 1, gap: 6 }}>
          <StatusPill label={info.label} tone={info.tone} icon="ticket-outline" />
          <Text style={[styles.ticketDesc, { color: colors.mutedForeground }]}>{info.desc}</Text>
        </View>
        {info.cta ? (
          <Button
            label={info.cta}
            icon="ticket-outline"
            size="sm"
            style={{ width: 150, maxWidth: 150 }}
            onPress={() => {
              if (!user) return;
              router.push(`/match/${match.id}/book` as Href);
            }}
          />
        ) : null}
      </View>
    );
  };

  const playerName = (pid: string) => data.players[pid]?.full_name ?? pid;
  const statLabel = (code: string) => sportDef?.playerStats.find((s) => s.code === code)?.shortLabel ?? sportDef?.teamStats.find((s) => s.code === code)?.shortLabel ?? code;
  const playersByTeam = (teamId: string) => {
    const lines = data.stats.players.filter((l) => l.team_id === teamId);
    const byPlayer = new Map<string, MatchPlayerStat[]>();
    for (const l of lines) {
      if (!byPlayer.has(l.player_id)) byPlayer.set(l.player_id, []);
      byPlayer.get(l.player_id)!.push(l);
    }
    return [...byPlayer.entries()];
  };

  return (
    <>
      <Stack.Screen options={{ title: `${home?.short_name ?? 'Home'} v ${away?.short_name ?? 'Away'}` }} />
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* hero */}
        <View style={[styles.hero, { height: heroHeight }]}>
          <TeamHero team={home} media={homeMedia} side="home" height={heroHeight} />
          <TeamHero team={away} media={awayMedia} side="away" height={heroHeight} />
          <View style={styles.vsWrap} pointerEvents="none">
            <View style={[styles.vsBadge, { backgroundColor: hasScore ? (match.status === 'live' ? colors.accent : colors.primary) : colors.card, borderColor: colors.background }]}>
              {hasScore ? (
                <Text style={[styles.vsScore, { color: '#fff' }]} accessibilityLabel={`Score ${match.home_score} to ${match.away_score}`}>
                  {match.home_score} - {match.away_score}
                </Text>
              ) : (
                <Text style={[styles.vs, { color: colors.foreground }]}>VS</Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.statusRow}>
            <StatusPill label={meta.label} tone={meta.tone} />
            {match.status === 'postponed' || match.status === 'cancelled' ? <Text style={[styles.statusNote, { color: colors.mutedForeground }]}>{match.note || (match.status === 'postponed' ? 'New date to be confirmed' : 'Match will not be played')}</Text> : null}
          </View>
          <Text style={[styles.title, { color: colors.foreground }]} accessibilityRole="header">
            {home?.name ?? 'TBC'} <Text style={{ color: colors.mutedForeground }}>vs</Text> {away?.name ?? 'TBC'}
          </Text>
          {match.score_detail && sportDef?.scoreKind === 'sets' ? (
            <Text style={[styles.sets, { color: colors.mutedForeground }]}>
              Sets: {(() => {
                try {
                  const d = JSON.parse(match.score_detail) as { sets?: [number, number][] };
                  return (d.sets ?? []).map((s) => `${s[0]}-${s[1]}`).join(', ');
                } catch {
                  return '';
                }
              })()}
            </Text>
          ) : null}

          <View style={[styles.metaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {[
              { icon: 'trophy-outline' as const, label: competition ? `${competition.name}${match.round_label ? ` · ${match.round_label}` : match.matchweek ? ` · Matchweek ${match.matchweek}` : ''}` : 'Competition' },
              { icon: 'calendar-outline' as const, label: `${format(kickoff, 'EEEE d MMMM yyyy')} · ${format(kickoff, 'HH:mm')}` },
              { icon: 'location-outline' as const, label: venue ? `${venue.name}, ${venue.city}${venue.address ? ` · ${venue.address}` : ''}` : 'Venue to be confirmed' },
            ].map((row) => (
              <View key={row.icon} style={styles.metaRow}>
                <Ionicons name={row.icon} size={16} color={colors.primary} />
                <Text style={[styles.metaText, { color: colors.foreground }]}>{row.label}</Text>
              </View>
            ))}
          </View>

          {ticketCard()}

          {/* team stats */}
          {data.stats.team.length ? (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Match stats</Text>
              {[...new Set(data.stats.team.map((t) => t.stat_code))].map((code) => {
                const h = data.stats.team.find((t) => t.stat_code === code && t.team_id === match.home_team_id)?.value ?? 0;
                const a = data.stats.team.find((t) => t.stat_code === code && t.team_id === match.away_team_id)?.value ?? 0;
                const total = h + a || 1;
                return (
                  <View key={code} style={{ marginBottom: 10 }} accessibilityLabel={`${statLabel(code)}: ${home?.short_name} ${h}, ${away?.short_name} ${a}`}>
                    <View style={styles.statRow}>
                      <Text style={[styles.statVal, { color: colors.foreground }]}>{h}</Text>
                      <Text style={[styles.statName, { color: colors.mutedForeground }]}>{sportDef?.teamStats.find((s) => s.code === code)?.label ?? code}</Text>
                      <Text style={[styles.statVal, { color: colors.foreground, textAlign: 'right' }]}>{a}</Text>
                    </View>
                    <View style={[styles.bar, { backgroundColor: colors.secondary }]}>
                      <View style={{ flex: h / total, backgroundColor: home?.primary_color || colors.primary }} />
                      <View style={{ flex: a / total, backgroundColor: away?.primary_color || colors.accent }} />
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          {/* player stats */}
          {data.stats.players.length ? (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Player stats</Text>
              {[home, away].map((team) =>
                team ? (
                  <View key={team.id} style={{ marginBottom: 12 }}>
                    <View style={styles.teamHead}>
                      <TeamBadge team={team} size={22} />
                      <Text style={[styles.teamHeadText, { color: colors.foreground }]}>{team.name}</Text>
                    </View>
                    {playersByTeam(team.id).map(([pid, lines]) => (
                      <View key={pid} style={[styles.playerRow, { borderTopColor: colors.border }]}>
                        <Text style={[styles.playerName, { color: colors.foreground }]} numberOfLines={1}>
                          {playerName(pid)}
                        </Text>
                        <Text style={[styles.playerStats, { color: colors.mutedForeground }]}>{lines.map((l) => `${l.value} ${statLabel(l.stat_code)}`).join(' · ')}</Text>
                      </View>
                    ))}
                    {!playersByTeam(team.id).length ? <Text style={[styles.playerStats, { color: colors.mutedForeground, paddingVertical: 6 }]}>No lines recorded</Text> : null}
                  </View>
                ) : null,
              )}
            </View>
          ) : match.status === 'final' ? (
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>Player statistics for this match have not been entered yet.</Text>
          ) : null}

          <Pressable onPress={() => router.push('/(tabs)/competition' as Href)} accessibilityRole="link" style={styles.backLink}>
            <Ionicons name="arrow-back" size={14} color={colors.primary} />
            <Text style={{ fontFamily: fonts.bodySemi, color: colors.primary, fontSize: 13 }}>All competitions</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, padding: 16, justifyContent: 'center' },
  hero: { flexDirection: 'row' },
  vsWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  vsBadge: { minWidth: 72, height: 72, borderRadius: 36, borderWidth: 4, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  vs: { fontFamily: fonts.heading, fontSize: 22, letterSpacing: 1 },
  vsScore: { fontFamily: fonts.heading, fontSize: 22, letterSpacing: 1 },
  body: { padding: 16, gap: 14 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  statusNote: { fontFamily: fonts.body, fontSize: 12 },
  title: { fontFamily: fonts.heading, fontSize: 22, letterSpacing: -0.4, lineHeight: 28 },
  sets: { fontFamily: fonts.bodyMed, fontSize: 13, marginTop: -8 },
  metaCard: { borderRadius: radius.lg, borderWidth: 1, padding: 14, gap: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaText: { fontFamily: fonts.bodyMed, fontSize: 13, flex: 1, lineHeight: 18 },
  ticketCard: { borderRadius: radius.lg, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  ticketDesc: { fontFamily: fonts.body, fontSize: 13 },
  section: { borderRadius: radius.lg, borderWidth: 1, padding: 14 },
  sectionTitle: { fontFamily: fonts.headingSemi, fontSize: 16, marginBottom: 12 },
  statRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  statVal: { width: 40, fontFamily: fonts.headingSemi, fontSize: 14 },
  statName: { flex: 1, textAlign: 'center', fontFamily: fonts.bodyMed, fontSize: 12 },
  bar: { height: 6, borderRadius: 3, flexDirection: 'row', overflow: 'hidden' },
  teamHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  teamHeadText: { fontFamily: fonts.bodySemi, fontSize: 13 },
  playerRow: { paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, gap: 2 },
  playerName: { fontFamily: fonts.bodySemi, fontSize: 13 },
  playerStats: { fontFamily: fonts.body, fontSize: 12 },
  hint: { fontFamily: fonts.body, fontSize: 12, textAlign: 'center' },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', minHeight: 44, paddingHorizontal: 12 },
});
