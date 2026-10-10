import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import Notice from '@/components/ui/Notice';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { fonts, radius } from '@/constants/theme';
import { getSportDefinition, type Competition, type Player, type RankingBoardDefinition, type Season } from '@/lib/competition';
import { adminApi, competitionApi } from '@/lib/competitionApi';
import { ApiError } from '@/lib/serverApi';
import { useTheme } from '@/lib/ThemeContext';

export default function AdminRankingsScreen() {
  const { season: seasonId } = useLocalSearchParams<{ season: string }>();
  const { colors } = useTheme();
  const [season, setSeason] = useState<Season | null>(null);
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [board, setBoard] = useState<RankingBoardDefinition | null>(null);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [points, setPoints] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!seasonId) return;
    try {
      const s = await competitionApi.season(seasonId);
      if (!s) throw new Error('Season not found');
      setSeason(s);
      const c = await competitionApi.competition(s.competition_id);
      setCompetition(c);
      const def = c ? getSportDefinition(c.sport) : null;
      const first = def?.rankingBoards[0] ?? null;
      setBoard((b) => b ?? first);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load');
    }
  }, [seasonId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!seasonId || !board) return;
    let alive = true;
    (async () => {
      const entries = (await competitionApi.rankings(seasonId)).filter((r) => r.board_code === board.code);
      const ps = await competitionApi.players(entries.map((e) => e.player_id));
      if (!alive) return;
      setPlayers(Object.fromEntries(ps.map((p) => [p.id, p])));
      setPoints(Object.fromEntries(entries.map((e) => [e.player_id, String(e.points)])));
    })();
    return () => {
      alive = false;
    };
  }, [seasonId, board]);

  const sportDef = competition ? getSportDefinition(competition.sport) : null;
  const rows = useMemo(() => Object.entries(points).sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0)), [points]);

  const save = async () => {
    if (!seasonId || !board) return;
    if (reason.trim().length < 3) {
      setNotice({ tone: 'error', message: 'A reason of at least 3 characters is required.' });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const entries = Object.entries(points)
        .filter(([, v]) => v !== '' && !Number.isNaN(Number(v)))
        .map(([player_id, v]) => ({ player_id, points: Number(v) }));
      await adminApi.setRankings({ season_id: seasonId, board_code: board.code, reason: reason.trim(), entries });
      setNotice({ tone: 'success', message: 'Rankings saved and re-ranked.' });
      setReason('');
    } catch (e) {
      setNotice({ tone: 'error', message: (e as ApiError).message });
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Rankings' }} />
        <Notice tone="error" message={error} actionLabel="Retry" onAction={load} />
      </View>
    );
  }
  if (!season || !sportDef) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
        <Stack.Screen options={{ title: 'Rankings' }} />
        <SkeletonCard />
      </View>
    );
  }
  if (!sportDef.rankingBoards.length) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Rankings' }} />
        <Notice tone="info" message={`${sportDef.label} has no ranking boards. Use match results and statistics instead.`} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: `${competition?.name ?? 'Rankings'}` }} />
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.body}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
          {sportDef.rankingBoards.map((b) => (
            <Chip key={b.code} size="sm" label={b.label} selected={board?.code === b.code} onPress={() => setBoard(b)} role="tab" />
          ))}
        </ScrollView>
        {notice ? <Notice tone={notice.tone} message={notice.message} live /> : null}
        <Text style={[styles.lead, { color: colors.mutedForeground }]}>
          {board?.label} · top {board?.limit}. Enter points; ranks are derived by the server. Clear a value to remove a player.
        </Text>
        {rows.map(([pid, v], i) => (
          <View key={pid} style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.rank, { color: colors.mutedForeground }]}>{i + 1}</Text>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
              {players[pid]?.full_name ?? pid}
            </Text>
            <TextInput value={v} onChangeText={(t) => setPoints((p) => ({ ...p, [pid]: t }))} keyboardType="decimal-pad" inputMode="decimal" style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} accessibilityLabel={`${players[pid]?.full_name ?? pid} points`} />
          </View>
        ))}
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Reason (required, audited)</Text>
        <TextInput value={reason} onChangeText={setReason} placeholder="e.g. Weekly ranking update" placeholderTextColor={colors.mutedForeground} style={[styles.reason, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} accessibilityLabel="Reason" />
        <Button label="Save rankings" onPress={save} loading={busy} />
        <View style={{ height: 32 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, padding: 16, justifyContent: 'center' },
  body: { padding: 16, gap: 8 },
  lead: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.md, borderWidth: 1 },
  rank: { width: 24, fontFamily: fonts.bodyBold, fontSize: 12, textAlign: 'center' },
  name: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 13 },
  input: { width: 80, height: 40, borderWidth: 1, borderRadius: radius.sm, textAlign: 'center', fontFamily: fonts.bodyMed },
  label: { fontFamily: fonts.bodySemi, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 8 },
  reason: { borderWidth: 1, borderRadius: radius.md, height: 48, paddingHorizontal: 12, fontFamily: fonts.body },
});
