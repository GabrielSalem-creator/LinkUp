import { format, parseISO } from 'date-fns';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { matchStatusMeta } from '@/components/competition/MatchCard';
import SegmentedTabs from '@/components/competition/SegmentedTabs';
import StatusPill from '@/components/competition/StatusPill';
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import Notice from '@/components/ui/Notice';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { fonts, radius } from '@/constants/theme';
import { canTransitionMatch, enterableStatCodes, getSportDefinition, isMatchReadOnly, MATCH_STATUSES, type Competition, type CompetitionTeam, type Match, type MatchStatus, type Player } from '@/lib/competition';
import { adminApi, competitionApi } from '@/lib/competitionApi';
import { ApiError } from '@/lib/serverApi';
import { useTheme } from '@/lib/ThemeContext';

type Tab = 'result' | 'stats' | 'history';

export default function AdminMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [match, setMatch] = useState<Match | null>(null);
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [teams, setTeams] = useState<Record<string, CompetitionTeam>>({});
  const [squads, setSquads] = useState<Record<string, Player[]>>({});
  const [tab, setTab] = useState<Tab>('result');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'warning'; title?: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [unlockFinal, setUnlockFinal] = useState(false);
  // result form
  const [status, setStatus] = useState<MatchStatus>('scheduled');
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [sets, setSets] = useState('');
  const [reason, setReason] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // stats form: key `${teamId}:${playerId}:${code}` -> value string
  const [playerVals, setPlayerVals] = useState<Record<string, string>>({});
  const [teamVals, setTeamVals] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<Record<string, unknown>[] | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const m = await competitionApi.match(id);
      if (!m) throw new Error('Match not found');
      setMatch(m);
      setStatus(m.status);
      setHome(m.home_score != null ? String(m.home_score) : '');
      setAway(m.away_score != null ? String(m.away_score) : '');
      try {
        const d = m.score_detail ? (JSON.parse(m.score_detail) as { sets?: [number, number][] }) : null;
        setSets(d?.sets ? d.sets.map((s) => `${s[0]}-${s[1]}`).join(', ') : '');
      } catch {
        setSets('');
      }
      const [c, h, a, stats] = await Promise.all([competitionApi.competition(m.competition_id), competitionApi.team(m.home_team_id), competitionApi.team(m.away_team_id), competitionApi.matchStats(m.id)]);
      setCompetition(c);
      setTeams({ ...(h ? { [h.id]: h } : {}), ...(a ? { [a.id]: a } : {}) });
      const [sh, sa] = await Promise.all([competitionApi.squad(m.season_id, m.home_team_id), competitionApi.squad(m.season_id, m.away_team_id)]);
      setSquads({ [m.home_team_id]: sh.players, [m.away_team_id]: sa.players });
      const pv: Record<string, string> = {};
      for (const l of stats.players) pv[`${l.team_id}:${l.player_id}:${l.stat_code}`] = String(l.value);
      setPlayerVals(pv);
      const tv: Record<string, string> = {};
      for (const l of stats.team) tv[`${l.team_id}:${l.stat_code}`] = String(l.value);
      setTeamVals(tv);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab !== 'history' || !id) return;
    adminApi
      .corrections(id)
      .then(setHistory)
      .catch((e) => setNotice({ tone: 'error', message: (e as ApiError).message }));
  }, [tab, id]);

  const sportDef = competition ? getSportDefinition(competition.sport) : null;
  const readOnly = match ? isMatchReadOnly(match.status) && !unlockFinal : false;
  const playerCodes = useMemo(() => (sportDef ? enterableStatCodes(sportDef.sport, 'player') : []), [sportDef]);
  const teamCodes = useMemo(() => (sportDef ? enterableStatCodes(sportDef.sport, 'team') : []), [sportDef]);

  const handleApi = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      setNotice({ tone: 'success', message: okMsg });
      setReason('');
      setUnlockFinal(false);
      await load();
    } catch (e) {
      const err = e as ApiError;
      if (err.code === 'conflict') setNotice({ tone: 'warning', title: 'Someone else changed this match', message: `${err.message} The latest version has been reloaded.` });
      else if (err.code === 'forbidden' || err.code === 'unauthenticated') setNotice({ tone: 'error', title: 'Permission revoked', message: err.message });
      else setNotice({ tone: 'error', title: 'Save failed', message: err.message });
      if (err.code === 'conflict') await load();
    } finally {
      setBusy(false);
    }
  };

  const saveResult = () => {
    if (!match) return;
    const errs: Record<string, string> = {};
    if (reason.trim().length < 3) errs.reason = 'Give a reason (at least 3 characters)';
    if ((status === 'final' || status === 'live') && (home === '' || away === '')) errs.score = 'Both scores are required';
    if ((home !== '' && !/^\d+$/.test(home)) || (away !== '' && !/^\d+$/.test(away))) errs.score = 'Scores must be whole numbers';
    if (!canTransitionMatch(match.status, status)) errs.status = `Cannot move from ${match.status} to ${status}`;
    let score_detail: string | undefined;
    if (sets.trim()) {
      const parsed = sets.split(',').map((s) => s.trim().split('-').map(Number));
      if (!parsed.every((p) => p.length === 2 && p.every((n) => Number.isInteger(n) && n >= 0))) errs.sets = 'Sets must look like 25-20, 23-25';
      else score_detail = JSON.stringify({ sets: parsed });
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    handleApi(
      () =>
        adminApi.updateMatch(match.id, {
          expectedVersion: match.result_version,
          status,
          home_score: home === '' ? undefined : Number(home),
          away_score: away === '' ? undefined : Number(away),
          score_detail,
          reason: reason.trim(),
        }),
      'Result saved. Standings recalculated.',
    );
  };

  const saveStats = () => {
    if (!match) return;
    if (reason.trim().length < 3) {
      setFieldErrors({ reason: 'Give a reason (at least 3 characters)' });
      return;
    }
    setFieldErrors({});
    const players: { team_id: string; player_id: string; stat_code: string; value: number }[] = [];
    for (const [k, v] of Object.entries(playerVals)) {
      if (v === '' || v == null) continue;
      const [team_id, player_id, stat_code] = k.split(':');
      players.push({ team_id, player_id, stat_code, value: Number(v) });
    }
    const team: { team_id: string; stat_code: string; value: number }[] = [];
    for (const [k, v] of Object.entries(teamVals)) {
      if (v === '' || v == null) continue;
      const [team_id, stat_code] = k.split(':');
      team.push({ team_id, stat_code, value: Number(v) });
    }
    handleApi(() => adminApi.setStats(match.id, { expectedVersion: match.result_version, reason: reason.trim(), players, team }), 'Statistics saved. Leaderboards recalculated.');
  };

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Match admin' }} />
        <Notice tone="error" message={error} actionLabel="Retry" onAction={load} />
      </View>
    );
  }
  if (!match || !sportDef) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
        <Stack.Screen options={{ title: 'Match admin' }} />
        <SkeletonCard />
      </View>
    );
  }
  const meta = matchStatusMeta(match.status);
  const input = [styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }];
  const h = teams[match.home_team_id];
  const a = teams[match.away_team_id];

  return (
    <>
      <Stack.Screen options={{ title: `${h?.short_name ?? '?'} v ${a?.short_name ?? '?'}` }} />
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.body}>
        <View style={styles.head}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {h?.name} vs {a?.name}
          </Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {format(parseISO(match.kickoff_at), 'EEE d MMM yyyy HH:mm')} · {match.round_label ?? ''} · version {match.result_version}
          </Text>
          <StatusPill label={meta.label} tone={meta.tone} />
        </View>
        <View style={{ marginVertical: 12 }}>
          <SegmentedTabs
            segments={[
              { key: 'result', label: 'Result' },
              { key: 'stats', label: 'Statistics' },
              { key: 'history', label: 'Audit' },
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>
        {notice ? <Notice tone={notice.tone} title={notice.title} message={notice.message} live /> : null}
        {Object.keys(fieldErrors).length ? <Notice tone="error" title="Please fix the highlighted fields" message={Object.values(fieldErrors).join(' · ')} live /> : null}

        {readOnly ? (
          <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.panelTitle, { color: colors.foreground }]}>{match.status === 'final' ? 'Completed match (read-only)' : 'Cancelled match (read-only)'}</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>{match.status === 'final' ? 'Corrections must carry a reason and are recorded in the audit history.' : 'Cancelled matches cannot be edited.'}</Text>
            {match.status === 'final' ? <Button label="Correct this result" icon="create-outline" variant="secondary" onPress={() => setUnlockFinal(true)} /> : null}
          </View>
        ) : null}

        {tab === 'result' ? (
          <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }, readOnly && { opacity: 0.6 }]} pointerEvents={readOnly ? 'none' : 'auto'}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Status</Text>
            <View style={styles.chips}>
              {MATCH_STATUSES.map((s) => {
                const allowed = canTransitionMatch(match.status, s);
                return <Chip key={s} size="sm" label={matchStatusMeta(s).label} selected={status === s} disabled={!allowed} onPress={() => setStatus(s)} role="radio" />;
              })}
            </View>
            {fieldErrors.status ? <Text style={[styles.fieldError, { color: colors.destructive }]}>{fieldErrors.status}</Text> : null}
            <View style={styles.scoreRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>{h?.short_name} {sportDef.scoreKind === 'sets' ? 'sets' : sportDef.scoreKind}</Text>
                <TextInput value={home} onChangeText={setHome} keyboardType="number-pad" inputMode="numeric" placeholder="0" placeholderTextColor={colors.mutedForeground} style={input} accessibilityLabel={`${h?.name} score`} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>{a?.short_name} {sportDef.scoreKind === 'sets' ? 'sets' : sportDef.scoreKind}</Text>
                <TextInput value={away} onChangeText={setAway} keyboardType="number-pad" inputMode="numeric" placeholder="0" placeholderTextColor={colors.mutedForeground} style={input} accessibilityLabel={`${a?.name} score`} />
              </View>
            </View>
            {fieldErrors.score ? <Text style={[styles.fieldError, { color: colors.destructive }]}>{fieldErrors.score}</Text> : null}
            {sportDef.scoreKind === 'sets' ? (
              <>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Set scores (home-away, comma separated)</Text>
                <TextInput value={sets} onChangeText={setSets} placeholder="25-20, 23-25, 25-18" placeholderTextColor={colors.mutedForeground} style={input} accessibilityLabel="Set scores" />
                {fieldErrors.sets ? <Text style={[styles.fieldError, { color: colors.destructive }]}>{fieldErrors.sets}</Text> : null}
              </>
            ) : null}
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Reason (required, audited)</Text>
            <TextInput value={reason} onChangeText={setReason} placeholder="e.g. Full-time result from the official sheet" placeholderTextColor={colors.mutedForeground} style={input} accessibilityLabel="Reason for this change" />
            {fieldErrors.reason ? <Text style={[styles.fieldError, { color: colors.destructive }]}>{fieldErrors.reason}</Text> : null}
            <Button label="Save result" onPress={saveResult} loading={busy} />
          </View>
        ) : tab === 'stats' ? (
          !sportDef.features.playerStats && !teamCodes.length ? (
            <Notice tone="info" message={`${sportDef.label} has no statistic entry in V1 (standings and fixtures only).`} />
          ) : (
            <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }, readOnly && { opacity: 0.6 }]} pointerEvents={readOnly ? 'none' : 'auto'}>
              {teamCodes.length ? (
                <>
                  <Text style={[styles.panelTitle, { color: colors.foreground }]}>Team statistics</Text>
                  {[match.home_team_id, match.away_team_id].map((tid) => (
                    <View key={tid} style={{ marginBottom: 8 }}>
                      <Text style={[styles.label, { color: colors.mutedForeground }]}>{teams[tid]?.name}</Text>
                      <View style={styles.statGrid}>
                        {teamCodes.map((code) => (
                          <View key={code} style={styles.statCell}>
                            <Text style={[styles.statCode, { color: colors.mutedForeground }]}>{sportDef.teamStats.find((s) => s.code === code)?.shortLabel ?? code}</Text>
                            <TextInput value={teamVals[`${tid}:${code}`] ?? ''} onChangeText={(v) => setTeamVals((p) => ({ ...p, [`${tid}:${code}`]: v }))} keyboardType="number-pad" inputMode="numeric" placeholder="-" placeholderTextColor={colors.mutedForeground} style={[styles.statInput, { borderColor: colors.border, color: colors.foreground }]} accessibilityLabel={`${teams[tid]?.short_name} ${code}`} />
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </>
              ) : null}
              {playerCodes.length ? (
                <>
                  <Text style={[styles.panelTitle, { color: colors.foreground, marginTop: 8 }]}>Player statistics</Text>
                  {[match.home_team_id, match.away_team_id].map((tid) => (
                    <View key={tid} style={{ marginBottom: 10 }}>
                      <Text style={[styles.label, { color: colors.mutedForeground }]}>{teams[tid]?.name}</Text>
                      {(squads[tid] ?? []).map((p) => (
                        <View key={p.id} style={[styles.playerRow, { borderTopColor: colors.border }]}>
                          <Text style={[styles.playerName, { color: colors.foreground }]} numberOfLines={1}>
                            {p.full_name} <Text style={{ color: colors.mutedForeground }}>{p.position ?? ''}</Text>
                          </Text>
                          <View style={styles.statGrid}>
                            {playerCodes.map((code) => {
                              const def = sportDef.playerStats.find((s) => s.code === code);
                              if (def?.positionFilter && p.position !== def.positionFilter) return null;
                              const key = `${tid}:${p.id}:${code}`;
                              return (
                                <View key={code} style={styles.statCell}>
                                  <Text style={[styles.statCode, { color: colors.mutedForeground }]}>{def?.shortLabel ?? code}</Text>
                                  <TextInput value={playerVals[key] ?? ''} onChangeText={(v) => setPlayerVals((prev) => ({ ...prev, [key]: v }))} keyboardType="number-pad" inputMode="numeric" placeholder="-" placeholderTextColor={colors.mutedForeground} style={[styles.statInput, { borderColor: colors.border, color: colors.foreground }]} accessibilityLabel={`${p.full_name} ${def?.label ?? code}`} />
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      ))}
                      {!(squads[tid] ?? []).length ? <Text style={[styles.sub, { color: colors.mutedForeground }]}>No squad registered for this season.</Text> : null}
                    </View>
                  ))}
                </>
              ) : null}
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Reason (required, audited)</Text>
              <TextInput value={reason} onChangeText={setReason} placeholder="e.g. Match sheet entered" placeholderTextColor={colors.mutedForeground} style={input} accessibilityLabel="Reason for this change" />
              {fieldErrors.reason ? <Text style={[styles.fieldError, { color: colors.destructive }]}>{fieldErrors.reason}</Text> : null}
              <Button label="Save statistics" onPress={saveStats} loading={busy} />
            </View>
          )
        ) : history == null ? (
          <SkeletonCard />
        ) : history.length === 0 ? (
          <Notice tone="info" message="No corrections recorded for this match yet." />
        ) : (
          history.map((c) => (
            <View key={String(c.id)} style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 8 }]}>
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>
                {String(c.target_type)} · {format(parseISO(String(c.created_at)), 'd MMM HH:mm')}
              </Text>
              <Text style={[styles.sub, { color: colors.foreground }]}>Reason: {String(c.reason)}</Text>
              <Text style={[styles.mono, { color: colors.mutedForeground }]}>actor {String(c.actor_id)} · req {String(c.correlation_id)}</Text>
              <Text style={[styles.mono, { color: colors.mutedForeground }]} numberOfLines={4}>
                before: {String(c.before_json).slice(0, 300)}
              </Text>
              <Text style={[styles.mono, { color: colors.mutedForeground }]} numberOfLines={4}>
                after: {String(c.after_json).slice(0, 300)}
              </Text>
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, padding: 16, justifyContent: 'center' },
  body: { padding: 16 },
  head: { gap: 6 },
  title: { fontFamily: fonts.heading, fontSize: 20 },
  sub: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  panel: { borderRadius: radius.lg, borderWidth: 1, padding: 14, gap: 8 },
  panelTitle: { fontFamily: fonts.headingSemi, fontSize: 15 },
  label: { fontFamily: fonts.bodySemi, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  scoreRow: { flexDirection: 'row', gap: 10 },
  input: { borderWidth: 1, borderRadius: radius.md, height: 48, paddingHorizontal: 12, fontFamily: fonts.body },
  fieldError: { fontFamily: fonts.bodyMed, fontSize: 12 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statCell: { width: 64, gap: 2 },
  statCode: { fontFamily: fonts.bodySemi, fontSize: 10, textAlign: 'center' },
  statInput: { borderWidth: 1, borderRadius: radius.sm, height: 40, textAlign: 'center', fontFamily: fonts.bodyMed },
  playerRow: { paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, gap: 4 },
  playerName: { fontFamily: fonts.bodySemi, fontSize: 13 },
  mono: { fontFamily: fonts.body, fontSize: 11 },
});
