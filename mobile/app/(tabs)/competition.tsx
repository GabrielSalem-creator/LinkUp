import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, parseISO } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LeaderCard, RankingList, type BoardRow } from '@/components/competition/LeaderCards';
import MatchCard from '@/components/competition/MatchCard';
import SegmentedTabs from '@/components/competition/SegmentedTabs';
import StandingsTable from '@/components/competition/StandingsTable';
import EmptyState from '@/components/ui/EmptyState';
import Notice from '@/components/ui/Notice';
import ScreenHeader from '@/components/ui/ScreenHeader';
import { SkeletonBlock, SkeletonCard } from '@/components/ui/Skeleton';
import { fonts, radius, sportColors, sportIcons } from '@/constants/theme';
import {
  getSportDefinition,
  supportedViews,
  type Competition,
  type CompetitionTeam,
  type CompetitionView,
  type LeaderboardEntry,
  type Match,
  type Player,
  type RankingEntry,
  type Season,
  type StandingRow,
  type Venue,
} from '@/lib/competition';
import { competitionApi } from '@/lib/competitionApi';
import { useTheme } from '@/lib/ThemeContext';

const LAST_KEY = 'linkup-competition-last';
const VIEW_LABEL: Record<CompetitionView, string> = { matches: 'Matches', table: 'Table', stats: 'Stats', rankings: 'Rankings' };

type SeasonData = {
  teams: CompetitionTeam[];
  matches: Match[];
  standings: StandingRow[];
  leaderboards: LeaderboardEntry[];
  rankings: RankingEntry[];
  players: Record<string, Player>;
  venues: Record<string, Venue>;
};

export default function CompetitionScreen() {
  const { colors } = useTheme();
  const [competitions, setCompetitions] = useState<Competition[] | null>(null);
  const [competitionId, setCompetitionId] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [data, setData] = useState<SeasonData | null>(null);
  const [view, setView] = useState<CompetitionView>('matches');
  const [error, setError] = useState<string | null>(null);
  const [loadingSeason, setLoadingSeason] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [matchweek, setMatchweek] = useState<number | null>(null);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [expandedBoard, setExpandedBoard] = useState<string | null>(null);
  const [lebaneseOnly, setLebaneseOnly] = useState(false);
  const [rankingBoard, setRankingBoard] = useState<string | null>(null);

  const competition = competitions?.find((c) => c.id === competitionId) ?? null;
  const sportDef = competition ? getSportDefinition(competition.sport) : null;
  const views = competition ? supportedViews(competition.sport) : [];

  const loadCompetitions = useCallback(async () => {
    setError(null);
    try {
      const list = await competitionApi.competitions();
      setCompetitions(list);
      const last = await AsyncStorage.getItem(LAST_KEY).catch(() => null);
      const pick = list.find((c) => c.id === last) ?? list[0] ?? null;
      setCompetitionId(pick?.id ?? null);
    } catch (e) {
      setCompetitions([]);
      setError(e instanceof Error ? e.message : 'Could not load competitions');
    }
  }, []);

  useEffect(() => {
    loadCompetitions();
  }, [loadCompetitions]);

  // seasons for the selected competition
  useEffect(() => {
    if (!competitionId) return;
    let alive = true;
    AsyncStorage.setItem(LAST_KEY, competitionId).catch(() => undefined);
    setSeasons([]);
    setSeasonId(null);
    setData(null);
    setMatchweek(null);
    setTeamFilter(null);
    setExpandedBoard(null);
    setRankingBoard(null);
    competitionApi
      .seasons(competitionId)
      .then((list) => {
        if (!alive) return;
        setSeasons(list);
        setSeasonId((list.find((s) => s.is_current) ?? list[0])?.id ?? null);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Could not load seasons'));
    return () => {
      alive = false;
    };
  }, [competitionId]);

  // keep the view valid for the sport
  useEffect(() => {
    if (views.length && !views.includes(view)) setView(views[0]);
  }, [views, view]);

  const loadSeason = useCallback(async () => {
    if (!competitionId || !seasonId) return;
    setLoadingSeason(true);
    setError(null);
    try {
      const [teams, matches, standings, leaderboards, rankings] = await Promise.all([
        competitionApi.teams(competitionId),
        competitionApi.matches(seasonId),
        competitionApi.standings(seasonId),
        competitionApi.leaderboards(seasonId),
        competitionApi.rankings(seasonId),
      ]);
      const playerIds = [...leaderboards.map((l) => l.player_id), ...rankings.map((r) => r.player_id)];
      const players = await competitionApi.players(playerIds);
      const venueIds = [...new Set(matches.map((m) => m.venue_id).filter(Boolean))] as string[];
      const venues = await Promise.all(venueIds.map((id) => competitionApi.venue(id)));
      setData({
        teams,
        matches,
        standings,
        leaderboards,
        rankings,
        players: Object.fromEntries(players.map((p) => [p.id, p])),
        venues: Object.fromEntries(venues.filter(Boolean).map((v) => [v!.id, v!])),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this season');
    } finally {
      setLoadingSeason(false);
      setRefreshing(false);
    }
  }, [competitionId, seasonId]);

  useEffect(() => {
    loadSeason();
  }, [loadSeason]);

  const teamMap = useMemo(() => Object.fromEntries((data?.teams ?? []).map((t) => [t.id, t])), [data?.teams]);

  const matchweeks = useMemo(() => {
    const set = new Set<number>();
    for (const m of data?.matches ?? []) if (m.matchweek) set.add(m.matchweek);
    return [...set].sort((a, b) => a - b);
  }, [data?.matches]);

  const currentMatchweek = useMemo(() => {
    const ms = data?.matches ?? [];
    const live = ms.find((m) => m.status === 'live');
    if (live?.matchweek) return live.matchweek;
    const next = ms.find((m) => m.status === 'scheduled' || m.status === 'postponed');
    if (next?.matchweek) return next.matchweek;
    return matchweeks[matchweeks.length - 1] ?? null;
  }, [data?.matches, matchweeks]);

  useEffect(() => {
    if (matchweek == null && currentMatchweek != null) setMatchweek(currentMatchweek);
  }, [currentMatchweek, matchweek]);

  const visibleMatches = useMemo(() => {
    let ms = data?.matches ?? [];
    if (matchweeks.length && matchweek != null) ms = ms.filter((m) => m.matchweek === matchweek);
    if (teamFilter) ms = ms.filter((m) => m.home_team_id === teamFilter || m.away_team_id === teamFilter);
    return ms;
  }, [data?.matches, matchweek, matchweeks.length, teamFilter]);

  const byDay = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of visibleMatches) {
      const key = m.kickoff_at.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return [...map.entries()];
  }, [visibleMatches]);

  const filtersActive = Boolean(teamFilter) || (matchweek != null && currentMatchweek != null && matchweek !== currentMatchweek);
  const resetFilters = () => {
    setTeamFilter(null);
    setMatchweek(currentMatchweek);
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (!competitions?.length) loadCompetitions().finally(() => setRefreshing(false));
    else loadSeason();
  };

  /* ------------------------------- renderers ------------------------------- */
  const renderCompetitionChips = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={{ flexGrow: 0 }} accessibilityRole="tablist">
      {(competitions ?? []).map((c) => {
        const on = c.id === competitionId;
        const color = sportColors[c.sport] || colors.primary;
        return (
          <Pressable
            key={c.id}
            onPress={() => setCompetitionId(c.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${c.name}, ${c.sport}`}
            style={[styles.compChip, { backgroundColor: on ? colors.primary : colors.card, borderColor: on ? colors.primary : colors.border }, Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null]}
          >
            <View style={[styles.compDot, { backgroundColor: on ? colors.accent : color }]}>
              <Ionicons name={(sportIcons[c.sport] || 'trophy-outline') as keyof typeof Ionicons.glyphMap} size={13} color="#fff" />
            </View>
            <Text style={[styles.compText, { color: on ? colors.primaryForeground : colors.foreground }]} numberOfLines={1}>
              {c.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const renderSeasonRow = () => (
    <View style={styles.seasonRow}>
      <Text style={[styles.seasonLabel, { color: colors.mutedForeground }]}>Season</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {seasons.map((s) => {
          const on = s.id === seasonId;
          return (
            <Pressable
              key={s.id}
              onPress={() => {
                setSeasonId(s.id);
                setMatchweek(null);
                setTeamFilter(null);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.seasonChip, { backgroundColor: on ? colors.accent : colors.secondary, borderColor: on ? colors.accent : colors.border }]}
            >
              <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, color: on ? colors.accentForeground : colors.foreground }}>
                {s.name}
                {s.status === 'completed' ? ' · ended' : ''}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderMatches = () => {
    if (!data) return null;
    if (!data.matches.length) {
      return <EmptyState icon="calendar-outline" title="No matches yet" description="Fixtures for this season have not been published. Check back soon." />;
    }
    return (
      <View>
        {matchweeks.length ? (
          <View style={[styles.weekNav, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Pressable
              onPress={() => setMatchweek((w) => (w == null ? currentMatchweek : matchweeks[Math.max(0, matchweeks.indexOf(w) - 1)]))}
              disabled={matchweek == null || matchweeks.indexOf(matchweek) <= 0}
              accessibilityRole="button"
              accessibilityLabel="Previous matchweek"
              style={styles.weekBtn}
            >
              <Ionicons name="chevron-back" size={20} color={matchweek != null && matchweeks.indexOf(matchweek) > 0 ? colors.foreground : colors.border} />
            </Pressable>
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.weekTitle, { color: colors.foreground }]} accessibilityLiveRegion="polite">
                Matchweek {matchweek ?? '-'}
              </Text>
              {matchweek === currentMatchweek ? <Text style={[styles.weekSub, { color: colors.accent }]}>Current</Text> : null}
            </View>
            <Pressable
              onPress={() => setMatchweek((w) => (w == null ? currentMatchweek : matchweeks[Math.min(matchweeks.length - 1, matchweeks.indexOf(w) + 1)]))}
              disabled={matchweek == null || matchweeks.indexOf(matchweek) >= matchweeks.length - 1}
              accessibilityRole="button"
              accessibilityLabel="Next matchweek"
              style={styles.weekBtn}
            >
              <Ionicons name="chevron-forward" size={20} color={matchweek != null && matchweeks.indexOf(matchweek) < matchweeks.length - 1 ? colors.foreground : colors.border} />
            </Pressable>
          </View>
        ) : null}
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flex: 1 }}>
            <Pressable onPress={() => setTeamFilter(null)} accessibilityRole="button" accessibilityState={{ selected: !teamFilter }} style={[styles.teamChip, { backgroundColor: !teamFilter ? colors.primary : colors.secondary }]}>
              <Text style={{ fontFamily: fonts.bodySemi, fontSize: 11, color: !teamFilter ? colors.primaryForeground : colors.foreground }}>All teams</Text>
            </Pressable>
            {data.teams.map((t) => {
              const on = teamFilter === t.id;
              return (
                <Pressable key={t.id} onPress={() => setTeamFilter(on ? null : t.id)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`Filter by ${t.name}`} style={[styles.teamChip, { backgroundColor: on ? colors.primary : colors.secondary }]}>
                  <Text style={{ fontFamily: fonts.bodySemi, fontSize: 11, color: on ? colors.primaryForeground : colors.foreground }}>{t.short_name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {filtersActive ? (
            <Pressable onPress={resetFilters} accessibilityRole="button" accessibilityLabel="Reset filters" style={[styles.resetBtn, { borderColor: colors.border }]}>
              <Ionicons name="refresh" size={14} color={colors.foreground} />
              <Text style={{ fontFamily: fonts.bodySemi, fontSize: 11, color: colors.foreground }}>Reset</Text>
            </Pressable>
          ) : null}
        </View>
        {visibleMatches.length === 0 ? (
          <EmptyState icon="funnel-outline" title="No matches match" description="Try another matchweek or clear the team filter." />
        ) : (
          byDay.map(([day, ms]) => (
            <View key={day} style={{ marginBottom: 6 }}>
              <Text style={[styles.dayLabel, { color: colors.foreground }]}>{format(parseISO(day), 'EEEE d MMMM')}</Text>
              {ms.map((m) => (
                <MatchCard key={m.id} match={m} home={teamMap[m.home_team_id]} away={teamMap[m.away_team_id]} venue={m.venue_id ? data.venues[m.venue_id] : null} />
              ))}
            </View>
          ))
        )}
      </View>
    );
  };

  const renderTable = () => {
    if (!data || !sportDef) return null;
    if (!data.standings.length) {
      return <EmptyState icon="list-outline" title="No standings yet" description="Standings appear once the first results are recorded." />;
    }
    return (
      <View>
        <StandingsTable rows={data.standings} teams={teamMap} drawsPossible={sportDef.standings?.draw != null} setBased={sportDef.scoreKind === 'sets'} />
        <Text style={[styles.legend, { color: colors.mutedForeground }]}>
          {sportDef.standings?.setPoints ? 'Win 3-0/3-1 = 3 pts, 3-2 = 2 pts, 2-3 = 1 pt.' : sportDef.standings?.draw == null ? `Win ${sportDef.standings?.win} pts, loss ${sportDef.standings?.loss} pt.` : 'Win 3 pts, draw 1 pt.'} Ranked by points, then {sportDef.standings?.tiebreak.slice(1).join(', ').replace('for', 'scored')}.
        </Text>
      </View>
    );
  };

  const renderStats = () => {
    if (!data || !sportDef) return null;
    if (!sportDef.features.playerStats) {
      return <EmptyState icon="stats-chart-outline" title="No player statistics" description={`${sportDef.label} shows standings and fixtures only in this version.`} />;
    }
    const hasLb = sportDef.leaderboards.some((b) => b.lebaneseOnly);
    const boards = sportDef.leaderboards.filter((b) => (hasLb ? b.lebaneseOnly === lebaneseOnly : true));
    const rowsFor = (code: string): BoardRow[] => data.leaderboards.filter((l) => l.board_code === code).map((l) => ({ rank: l.rank, player_id: l.player_id, team_id: l.team_id, value: l.value, games: l.games }));
    const any = boards.some((b) => rowsFor(b.code).length);
    if (!any) {
      return <EmptyState icon="stats-chart-outline" title="No stats yet" description="Player statistics appear after the first completed matches." />;
    }
    const expanded = boards.find((b) => b.code === expandedBoard);
    return (
      <View>
        {hasLb ? (
          <View style={{ marginBottom: 12 }}>
            <SegmentedTabs
              compact
              segments={[
                { key: 'all', label: 'All players' },
                { key: 'lb', label: 'Lebanese players' },
              ]}
              value={lebaneseOnly ? 'lb' : 'all'}
              onChange={(v) => {
                setLebaneseOnly(v === 'lb');
                setExpandedBoard(null);
              }}
            />
          </View>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16 }}>
          {boards.map((b) => (
            <LeaderCard key={b.code} title={b.label} rows={rowsFor(b.code)} players={data.players} teams={teamMap} decimals={b.decimals} expanded={expandedBoard === b.code} onPress={() => setExpandedBoard((cur) => (cur === b.code ? null : b.code))} />
          ))}
        </ScrollView>
        {expanded ? (
          <View style={{ marginTop: 14 }}>
            <Text style={[styles.dayLabel, { color: colors.foreground }]}>{expanded.label}</Text>
            <RankingList rows={rowsFor(expanded.code)} players={data.players} teams={teamMap} decimals={expanded.decimals} />
          </View>
        ) : (
          <Text style={[styles.legend, { color: colors.mutedForeground }]}>Tap a leader card to expand the full ranking.</Text>
        )}
      </View>
    );
  };

  const renderRankings = () => {
    if (!data || !sportDef) return null;
    const boards = sportDef.rankingBoards;
    const active = boards.find((b) => b.code === rankingBoard) ?? boards[0];
    if (!active) return null;
    const rows: BoardRow[] = data.rankings.filter((r) => r.board_code === active.code).map((r) => ({ rank: r.rank, player_id: r.player_id, value: r.points, previous_rank: r.previous_rank }));
    return (
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 12 }}>
          {boards.map((b) => {
            const on = b.code === active.code;
            return (
              <Pressable key={b.code} onPress={() => setRankingBoard(b.code)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.teamChip, { backgroundColor: on ? colors.primary : colors.secondary }]}>
                <Text style={{ fontFamily: fonts.bodySemi, fontSize: 11, color: on ? colors.primaryForeground : colors.foreground }}>{b.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Text style={[styles.dayLabel, { color: colors.foreground }]}>
          {active.label} · Top {active.limit}
        </Text>
        {rows.length ? <RankingList rows={rows} players={data.players} teams={teamMap} decimals={0} valueLabel="points" showDelta /> : <EmptyState icon="podium-outline" title="No ranking published" description="This board has no entries yet." />}
      </View>
    );
  };

  /* --------------------------------- layout --------------------------------- */
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScreenHeader title="Competitions" subtitle={competition ? `${sportDef?.label}${competition.division ? ` · ${competition.division}` : ''}` : 'Leagues, tables and stats'} />
      {competitions == null ? (
        <View style={{ padding: 16, gap: 12 }}>
          <SkeletonBlock height={40} round />
          <SkeletonBlock height={44} round />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : competitions.length === 0 ? (
        <>
          {error ? <View style={{ padding: 16 }}><Notice tone="error" message={error} actionLabel="Retry" onAction={loadCompetitions} /></View> : null}
          <EmptyState icon="trophy-outline" title="No competitions yet" description="Published competitions will appear here." action={null} />
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}>
          {renderCompetitionChips()}
          {seasons.length ? renderSeasonRow() : null}
          {views.length ? (
            <View style={{ marginBottom: 14 }}>
              <SegmentedTabs segments={views.map((v) => ({ key: v, label: VIEW_LABEL[v] }))} value={view} onChange={setView} />
            </View>
          ) : null}
          {error ? <Notice tone="error" title="Could not load" message={error} actionLabel="Retry" onAction={loadSeason} /> : null}
          {seasons.length === 0 && !loadingSeason && competitionId ? (
            <EmptyState icon="calendar-clear-outline" title="No season published" description="This competition has no seasons yet." />
          ) : loadingSeason && !data ? (
            <View>
              <SkeletonBlock height={56} />
              <View style={{ height: 10 }} />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : view === 'matches' ? (
            renderMatches()
          ) : view === 'table' ? (
            renderTable()
          ) : view === 'stats' ? (
            renderStats()
          ) : (
            renderRankings()
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 },
  chipRow: { gap: 8, paddingBottom: 10 },
  compChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 6, paddingRight: 14, height: 44, borderRadius: radius.full, borderWidth: 1 },
  compDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  compText: { fontFamily: fonts.bodySemi, fontSize: 13, maxWidth: 190 },
  seasonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  seasonLabel: { fontFamily: fonts.bodySemi, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  seasonChip: { paddingHorizontal: 12, height: 36, borderRadius: radius.full, borderWidth: 1, justifyContent: 'center' },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 6, marginBottom: 10 },
  weekBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  weekTitle: { fontFamily: fonts.headingSemi, fontSize: 16 },
  weekSub: { fontFamily: fonts.bodySemi, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  teamChip: { paddingHorizontal: 12, height: 34, borderRadius: radius.full, justifyContent: 'center' },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 34, paddingHorizontal: 10, borderRadius: radius.full, borderWidth: 1 },
  dayLabel: { fontFamily: fonts.headingSemi, fontSize: 15, marginBottom: 10, letterSpacing: -0.2 },
  legend: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginTop: 10 },
});
