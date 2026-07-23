import { Ionicons } from '@expo/vector-icons';
import { format, isAfter, isBefore, parseISO } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EmptyState from '@/components/ui/EmptyState';
import SportBadge from '@/components/ui/SportBadge';
import { fonts } from '@/constants/theme';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/ThemeContext';
import type { Activity, League, LeagueParticipant } from '@/types';

const sportMap: Record<string, string[]> = {
  running_walking: ['running', 'walking'],
  walking: ['walking'],
  biking: ['biking'],
  swimming: ['swimming'],
  hyrox: ['hyrox'],
  triathlon: ['triathlon'],
  crossfit: ['crossfit'],
  yoga: ['yoga'],
  hiking: ['hiking'],
  other: ['other'],
};

export default function LeaguesScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<League | null>(null);
  const [participants, setParticipants] = useState<LeagueParticipant[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSport, setNewSport] = useState('running_walking');

  const load = useCallback(async () => {
    if (!user?.email) return;
    setLoading(true);
    const mine = await api.leagues.mine(user.email);
    setLeagues(mine);
    setLoading(false);
  }, [user?.email]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    (async () => {
      const [parts, acts] = await Promise.all([
        api.leagues.participants(selected.id),
        api.activities.list(),
      ]);
      setParticipants(parts);
      setActivities(acts);
    })();
  }, [selected]);

  const leaderboard = useMemo(() => {
    if (!selected || !participants.length) return [];
    const validSports = sportMap[selected.sport] || [selected.sport];
    const start = parseISO(selected.start_date);
    const end = parseISO(selected.end_date);
    const emails = new Set(participants.map((p) => p.user_email));
    const map: Record<string, { email: string; name: string; total_km: number; total_activities: number }> = {};
    participants.forEach((p) => {
      map[p.user_email] = {
        email: p.user_email,
        name: p.user_name || p.user_email.split('@')[0],
        total_km: 0,
        total_activities: 0,
      };
    });
    activities.forEach((a) => {
      if (!emails.has(a.user_email)) return;
      if (!validSports.includes(a.sport)) return;
      const aDate = parseISO(a.date);
      if (isBefore(aDate, start) || isAfter(aDate, end)) return;
      map[a.user_email].total_km += a.distance_km || 0;
      map[a.user_email].total_activities += 1;
    });
    return Object.values(map).sort((a, b) => b.total_km - a.total_km);
  }, [selected, participants, activities]);

  const handleJoin = async () => {
    if (!user || !joinCode.trim()) return;
    setJoining(true);
    try {
      await api.leagues.joinByCode(joinCode, user);
      setJoinCode('');
      await load();
      Alert.alert('Joined!', 'You are now in the league.');
    } catch (e) {
      Alert.alert('Invalid code', e instanceof Error ? e.message : 'Try again');
    } finally {
      setJoining(false);
    }
  };

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    const code = newName.replace(/\s+/g, '').slice(0, 6).toUpperCase() + Math.floor(Math.random() * 90 + 10);
    await api.leagues.create({
      name: newName.trim(),
      sport: newSport as League['sport'],
      description: '',
      created_by: user.email,
      creator_name: user.full_name,
      invite_code: code,
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: format(new Date(Date.now() + 30 * 86400000), 'yyyy-MM-dd'),
      max_members: 50,
    });
    setShowCreate(false);
    setNewName('');
    await load();
  };

  if (selected) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => setSelected(null)} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {selected.name}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.list}>
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SportBadge sport={selected.sport} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              {selected.start_date} → {selected.end_date}
            </Text>
            <Text style={[styles.code, { color: colors.primary }]}>Invite: {selected.invite_code}</Text>
          </View>
          {leaderboard.map((row, i) => (
            <View
              key={row.email}
              style={[styles.rankRow, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.rankBadge, { backgroundColor: i < 3 ? `${colors.accent}33` : colors.secondary }]}>
                {i === 0 ? (
                  <Ionicons name="trophy" size={16} color={colors.accent} />
                ) : (
                  <Text style={{ fontFamily: fonts.bodyBold, color: colors.mutedForeground }}>{i + 1}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rankName, { color: colors.foreground }]}>{row.name}</Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12 }}>
                  {row.total_activities} activities
                </Text>
              </View>
              <Text style={[styles.km, { color: colors.primary }]}>{row.total_km.toFixed(1)} km</Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>MyLeague</Text>
        <Pressable style={[styles.createBtn, { backgroundColor: colors.primary }]} onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.createText}>Create</Text>
        </Pressable>
      </View>

      <View style={styles.joinRow}>
        <TextInput
          value={joinCode}
          onChangeText={setJoinCode}
          placeholder="Enter invite code"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="characters"
          style={[
            styles.input,
            { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
          ]}
        />
        <Pressable
          onPress={handleJoin}
          disabled={joining}
          style={[styles.joinBtn, { backgroundColor: colors.secondary }]}
        >
          <Text style={{ fontFamily: fonts.bodySemi, color: colors.foreground }}>
            {joining ? '…' : 'Join'}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : leagues.length === 0 ? (
        <EmptyState
          icon="trophy-outline"
          title="No leagues yet"
          description="Create a mini-league with friends or join with an invite code. Try BEIRUT26."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {leagues.map((league) => (
            <Pressable
              key={league.id}
              onPress={() => setSelected(league)}
              style={[styles.leagueCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.leagueTop}>
                <Text style={[styles.leagueName, { color: colors.foreground }]}>{league.name}</Text>
                <SportBadge sport={league.sport} size="sm" />
              </View>
              <Text style={{ color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, marginTop: 6 }}>
                {league.member_count}/{league.max_members} members · {league.status}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Create league</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="League name"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground, marginTop: 12 },
              ]}
            />
            <View style={styles.sportPick}>
              {['running_walking', 'biking', 'swimming'].map((s) => {
                const on = newSport === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => setNewSport(s)}
                    style={[
                      styles.chip,
                      { backgroundColor: on ? colors.primary : colors.secondary, borderColor: colors.border },
                    ]}
                  >
                    <Text style={{ color: on ? '#fff' : colors.foreground, fontFamily: fonts.bodyMed, fontSize: 12 }}>
                      {s.replace('_', ' / ')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.sheetActions}>
              <Pressable onPress={() => setShowCreate(false)} style={[styles.btnGhost, { borderColor: colors.border }]}>
                <Text style={{ color: colors.foreground, fontFamily: fonts.bodySemi }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleCreate} style={[styles.btnPrimary, { backgroundColor: colors.primary }]}>
                <Text style={{ color: '#fff', fontFamily: fonts.bodySemi }}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontFamily: fonts.heading, fontSize: 18, flex: 1, textAlign: 'center' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  createText: { color: '#fff', fontFamily: fonts.bodySemi, fontSize: 12 },
  joinRow: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontFamily: fonts.body,
  },
  joinBtn: { height: 44, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 40 },
  leagueCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 10 },
  leagueTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  leagueName: { fontFamily: fonts.headingSemi, fontSize: 16, flex: 1 },
  infoCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16, gap: 8 },
  infoText: { fontFamily: fonts.body, fontSize: 13 },
  code: { fontFamily: fonts.bodyBold, fontSize: 14 },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  rankBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rankName: { fontFamily: fonts.bodySemi, fontSize: 14 },
  km: { fontFamily: fonts.headingSemi, fontSize: 15 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  sheetTitle: { fontFamily: fonts.headingSemi, fontSize: 18 },
  sportPick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnGhost: { flex: 1, height: 44, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { flex: 1, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
