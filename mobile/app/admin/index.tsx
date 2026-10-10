import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { type Href, Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { matchStatusMeta } from '@/components/competition/MatchCard';
import SegmentedTabs from '@/components/competition/SegmentedTabs';
import StatusPill from '@/components/competition/StatusPill';
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import EmptyState from '@/components/ui/EmptyState';
import Notice from '@/components/ui/Notice';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { fonts, radius } from '@/constants/theme';
import { getSportDefinition, type Competition, type CompetitionTeam, type Match, type Season } from '@/lib/competition';
import { adminApi, competitionApi } from '@/lib/competitionApi';
import { ApiError, serverApi } from '@/lib/serverApi';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';

type Tab = 'matches' | 'create' | 'tools';

export default function AdminScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('matches');
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionId, setCompetitionId] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [teams, setTeams] = useState<CompetitionTeam[]>([]);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // create form
  const [homeId, setHomeId] = useState('');
  const [awayId, setAwayId] = useState('');
  const [kickoff, setKickoff] = useState('');
  const [week, setWeek] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    serverApi
      .me()
      .then((m) => setIsAdmin(m.is_app_admin))
      .catch(() => setIsAdmin(false));
  }, [user?.id]);

  useEffect(() => {
    competitionApi
      .competitions()
      .then((c) => {
        setCompetitions(c);
        setCompetitionId(c[0]?.id ?? null);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!competitionId) return;
    setSeasons([]);
    setSeasonId(null);
    setMatches(null);
    Promise.all([competitionApi.seasons(competitionId), competitionApi.teams(competitionId)])
      .then(([s, t]) => {
        setSeasons(s);
        setTeams(t);
        setSeasonId((s.find((x) => x.is_current) ?? s[0])?.id ?? null);
      })
      .catch((e) => setError(e.message));
  }, [competitionId]);

  const loadMatches = useCallback(async () => {
    if (!seasonId) return;
    setError(null);
    try {
      setMatches(await competitionApi.matches(seasonId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load matches');
    }
  }, [seasonId]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const teamMap = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams]);
  const competition = competitions.find((c) => c.id === competitionId);
  const sportDef = competition ? getSportDefinition(competition.sport) : null;

  const createMatch = async () => {
    const errs: Record<string, string> = {};
    if (!homeId) errs.home = 'Choose a home team';
    if (!awayId) errs.away = 'Choose an away team';
    if (homeId && awayId && homeId === awayId) errs.away = 'Away team must differ from home';
    if (!kickoff || Number.isNaN(Date.parse(kickoff))) errs.kickoff = 'Use an ISO date-time, e.g. 2026-11-02T18:00:00Z';
    if (week && !/^\d+$/.test(week)) errs.week = 'Matchweek must be a whole number';
    setFieldErrors(errs);
    if (Object.keys(errs).length || !competitionId || !seasonId) return;
    setBusy(true);
    setNotice(null);
    try {
      const m = await adminApi.createMatch({ competition_id: competitionId, season_id: seasonId, home_team_id: homeId, away_team_id: awayId, kickoff_at: new Date(kickoff).toISOString(), matchweek: week ? Number(week) : undefined, round_label: week ? `Matchweek ${week}` : undefined });
      setNotice({ tone: 'success', message: 'Match created.' });
      setHomeId('');
      setAwayId('');
      setKickoff('');
      await loadMatches();
      router.push(`/admin/match/${m.id}` as Href);
    } catch (e) {
      setNotice({ tone: 'error', message: (e as ApiError).message });
    } finally {
      setBusy(false);
    }
  };

  const tool = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    setNotice(null);
    try {
      const r = await fn();
      setNotice({ tone: 'success', message: `${label}: ${JSON.stringify(r)}` });
    } catch (e) {
      setNotice({ tone: 'error', message: (e as ApiError).message });
    } finally {
      setBusy(false);
    }
  };

  if (isAdmin === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
        <Stack.Screen options={{ title: 'Admin' }} />
        <SkeletonCard />
      </View>
    );
  }
  if (!isAdmin) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Admin' }} />
        <EmptyState icon="lock-closed-outline" title="App admins only" description="Your account is not a member of the app-admins team. Club portal access does not grant competition administration." />
      </View>
    );
  }

  const inputStyle = [styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }];

  return (
    <>
      <Stack.Screen options={{ title: 'Competition admin' }} />
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.body}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
          {competitions.map((c) => (
            <Chip key={c.id} label={c.name} selected={c.id === competitionId} onPress={() => setCompetitionId(c.id)} role="tab" />
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {seasons.map((s) => (
            <Chip key={s.id} size="sm" tone="accent" label={s.name} selected={s.id === seasonId} onPress={() => setSeasonId(s.id)} />
          ))}
        </View>
        <View style={{ marginBottom: 12 }}>
          <SegmentedTabs
            segments={[
              { key: 'matches', label: 'Matches' },
              { key: 'create', label: 'New match' },
              { key: 'tools', label: 'Tools' },
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>
        {error ? <Notice tone="error" message={error} actionLabel="Retry" onAction={loadMatches} /> : null}
        {notice ? <Notice tone={notice.tone} message={notice.message} live /> : null}

        {tab === 'matches' ? (
          !seasonId ? (
            <EmptyState icon="calendar-clear-outline" title="No season" description="Create a season first (seed script) to manage matches." />
          ) : matches == null ? (
            <SkeletonCard />
          ) : !sportDef?.features.fixtures ? (
            <View>
              <EmptyState icon="podium-outline" title="Rankings competition" description={`${sportDef?.label} has no fixtures. Manage ranking boards below.`} />
              <Button label="Edit rankings" onPress={() => router.push(`/admin/rankings?season=${seasonId}` as Href)} />
            </View>
          ) : matches.length === 0 ? (
            <EmptyState icon="calendar-outline" title="No matches" description="Create the first match from the New match tab." />
          ) : (
            matches.map((m) => {
              const meta = matchStatusMeta(m.status);
              return (
                <Pressable key={m.id} onPress={() => router.push(`/admin/match/${m.id}` as Href)} accessibilityRole="button" style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[styles.rowTitle, { color: colors.foreground }]}>
                      {teamMap[m.home_team_id]?.short_name ?? '?'} {m.home_score ?? ''}{m.home_score != null ? ' - ' : ' v '}{m.away_score ?? ''} {teamMap[m.away_team_id]?.short_name ?? '?'}
                    </Text>
                    <Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>
                      {format(parseISO(m.kickoff_at), 'd MMM HH:mm')} · {m.round_label ?? `MW ${m.matchweek ?? '-'}`} · v{m.result_version}
                    </Text>
                  </View>
                  <StatusPill label={meta.label} tone={meta.tone} small />
                  <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                </Pressable>
              );
            })
          )
        ) : tab === 'create' ? (
          <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Home team</Text>
            <View style={styles.teamPick}>
              {teams.map((t) => (
                <Chip key={t.id} size="sm" label={t.short_name} swatch={t.primary_color} selected={homeId === t.id} onPress={() => setHomeId(t.id)} role="radio" accessibilityLabel={`Home team ${t.name}`} />
              ))}
            </View>
            {fieldErrors.home ? <Text style={[styles.fieldError, { color: colors.destructive }]}>{fieldErrors.home}</Text> : null}
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Away team</Text>
            <View style={styles.teamPick}>
              {teams.map((t) => (
                <Chip key={t.id} size="sm" tone="accent" label={t.short_name} swatch={t.primary_color} selected={awayId === t.id} onPress={() => setAwayId(t.id)} role="radio" accessibilityLabel={`Away team ${t.name}`} />
              ))}
            </View>
            {fieldErrors.away ? <Text style={[styles.fieldError, { color: colors.destructive }]}>{fieldErrors.away}</Text> : null}
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Kick-off (ISO, UTC)</Text>
            <TextInput value={kickoff} onChangeText={setKickoff} placeholder="2026-11-02T18:00:00Z" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" style={inputStyle} accessibilityLabel="Kick-off date and time" />
            {fieldErrors.kickoff ? <Text style={[styles.fieldError, { color: colors.destructive }]}>{fieldErrors.kickoff}</Text> : null}
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Matchweek (optional)</Text>
            <TextInput value={week} onChangeText={setWeek} placeholder="e.g. 7" placeholderTextColor={colors.mutedForeground} keyboardType="number-pad" inputMode="numeric" style={inputStyle} accessibilityLabel="Matchweek number" />
            {fieldErrors.week ? <Text style={[styles.fieldError, { color: colors.destructive }]}>{fieldErrors.week}</Text> : null}
            <Button label="Create match" onPress={createMatch} loading={busy} />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <Button label="Validate a ticket (scanner)" icon="qr-code-outline" variant="teal" onPress={() => router.push('/admin/scan' as Href)} />
            <Button label="Recalculate standings & leaderboards" icon="refresh-outline" variant="secondary" disabled={!seasonId || busy} onPress={() => seasonId && tool('Recalculated', () => adminApi.recalc(seasonId))} />
            <Button label="Edit rankings" icon="podium-outline" variant="secondary" disabled={!seasonId} onPress={() => router.push(`/admin/rankings?season=${seasonId}` as Href)} />
            <Button label="Run housekeeping (expire holds, retry emails)" icon="time-outline" variant="secondary" disabled={busy} onPress={() => tool('Jobs', () => adminApi.runJobs())} />
            <Button label="Pause online checkout" icon="pause-circle-outline" variant="danger" disabled={busy} onPress={() => tool('Settings', () => adminApi.updateSettings({ checkout_enabled: false, reason: 'Paused from admin tools' }))} />
            <Button label="Resume online checkout (test provider)" icon="play-circle-outline" variant="ghost" disabled={busy} onPress={() => tool('Settings', () => adminApi.updateSettings({ checkout_enabled: true, reason: 'Resumed from admin tools' }))} />
          </View>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, padding: 16, justifyContent: 'center' },
  body: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, marginBottom: 8 },
  rowTitle: { fontFamily: fonts.bodySemi, fontSize: 14 },
  rowMeta: { fontFamily: fonts.body, fontSize: 12 },
  panel: { borderRadius: radius.lg, borderWidth: 1, padding: 14, gap: 8 },
  label: { fontFamily: fonts.bodySemi, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 6 },
  teamPick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { borderWidth: 1, borderRadius: radius.md, height: 48, paddingHorizontal: 12, fontFamily: fonts.body },
  fieldError: { fontFamily: fonts.bodyMed, fontSize: 12 },
});
