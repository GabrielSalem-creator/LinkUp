import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import ScreenHeader from '@/components/ui/ScreenHeader';
import SportBadge from '@/components/ui/SportBadge';
import { INVITE_BASE_URL, fonts, radius, space } from '@/constants/theme';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/lib/api';
import { formatScore, metricLabel, scoreActivities, sportsForLeague } from '@/lib/scoring';
import { useTheme } from '@/lib/ThemeContext';
import type { Activity, League, LeagueParticipant } from '@/types';

const CREATE_SPORTS = [
  'running_walking',
  'biking',
  'swimming',
  'yoga',
  'crossfit',
  'tennis',
  'hiking',
  'hyrox',
] as const;

async function copyText(text: string, label: string) {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    Alert.alert('Copied', `${label} copied to clipboard`);
    return;
  }
  Alert.alert(label, text);
}

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
    return scoreActivities(activities, {
      emails: participants.map((p) => ({
        email: p.user_email,
        name: p.user_name || p.user_email.split('@')[0],
      })),
      sports: sportsForLeague(selected.sport),
      startDate: selected.start_date,
      endDate: selected.end_date,
      metricSport: selected.sport,
    });
  }, [selected, participants, activities]);

  const inviteLink = selected
    ? `${INVITE_BASE_URL}/join-league?code=${encodeURIComponent(selected.invite_code)}`
    : '';

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
    try {
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
      Alert.alert('League created', `Invite code: ${code}`);
    } catch (e) {
      Alert.alert('Could not create league', e instanceof Error ? e.message : 'Try again');
    }
  };

  if (selected) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.detailHeader, { borderBottomColor: colors.border }]}>
          <IconButton name="chevron-back" onPress={() => setSelected(null)} />
          <Text style={[styles.detailTitle, { color: colors.foreground }]} numberOfLines={1}>
            {selected.name}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.list}>
          <View style={[styles.inviteBar, { backgroundColor: colors.primary }]}>
            <Text style={styles.inviteLabel}>Invite code</Text>
            <Text style={styles.inviteCode}>{selected.invite_code}</Text>
            <View style={styles.inviteActions}>
              <Pressable
                style={[styles.inviteBtn, { backgroundColor: colors.accent }]}
                onPress={() => copyText(selected.invite_code, 'Invite code')}
              >
                <Ionicons name="copy-outline" size={16} color="#fff" />
                <Text style={styles.inviteBtnText}>Copy code</Text>
              </Pressable>
              <Pressable
                style={[styles.inviteBtn, { backgroundColor: 'rgba(255,242,226,0.15)' }]}
                onPress={() => copyText(inviteLink, 'Invite link')}
              >
                <Ionicons name="link-outline" size={16} color="#FFF2E2" />
                <Text style={[styles.inviteBtnText, { color: '#FFF2E2' }]}>Copy link</Text>
              </Pressable>
            </View>
          </View>
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SportBadge sport={selected.sport} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              {selected.start_date} → {selected.end_date}
            </Text>
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              Ranked by {metricLabel(leaderboard[0]?.metric || 'distance_km').toLowerCase()}
            </Text>
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
                  {row.activityCount} activities
                </Text>
              </View>
              <Text style={[styles.km, { color: colors.primary }]}>{formatScore(row.value, row.metric)}</Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScreenHeader
        title="MyLeague"
        subtitle="Compete with friends"
        right={
          <Pressable
            style={[styles.createBtn, { backgroundColor: colors.accent }]}
            onPress={() => setShowCreate(true)}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={[styles.createText, { color: '#fff' }]}>Create</Text>
          </Pressable>
        }
      />

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
        <Button label={joining ? '…' : 'Join'} onPress={handleJoin} loading={joining} style={styles.joinBtn} />
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
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Create league</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="League name"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                {
                  backgroundColor: colors.secondary,
                  borderColor: colors.border,
                  color: colors.foreground,
                  marginTop: 12,
                  flex: undefined,
                },
              ]}
            />
            <View style={styles.sportPick}>
              {CREATE_SPORTS.map((s) => {
                const on = newSport === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => setNewSport(s)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: on ? colors.accent : colors.secondary,
                        borderColor: on ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: on ? '#fff' : colors.foreground,
                        fontFamily: fonts.bodyMed,
                        fontSize: 12,
                      }}
                    >
                      {s.replace('_', ' / ')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.sheetActions}>
              <Button label="Cancel" variant="ghost" onPress={() => setShowCreate(false)} style={{ flex: 1 }} />
              <Button label="Create" onPress={handleCreate} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  detailHeader: {
    height: 56,
    paddingHorizontal: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailTitle: { fontFamily: fonts.headingSemi, fontSize: 17, flex: 1, textAlign: 'center' },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  createText: { fontFamily: fonts.bodySemi, fontSize: 12 },
  joinRow: { flexDirection: 'row', gap: 8, padding: space.lg, paddingBottom: space.sm, alignItems: 'center' },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    fontFamily: fonts.body,
  },
  joinBtn: { height: 48, paddingHorizontal: 18, minWidth: 88 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: space.lg, paddingBottom: 40 },
  leagueCard: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, marginBottom: 10 },
  leagueTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  leagueName: { fontFamily: fonts.headingSemi, fontSize: 16, flex: 1 },
  inviteBar: { borderRadius: radius.lg, padding: space.lg, marginBottom: space.md },
  inviteLabel: { color: 'rgba(255,242,226,0.7)', fontFamily: fonts.bodyMed, fontSize: 12 },
  inviteCode: { color: '#FFF2E2', fontFamily: fonts.heading, fontSize: 28, letterSpacing: 2, marginTop: 4 },
  inviteActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  inviteBtn: {
    flex: 1,
    height: 42,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  inviteBtnText: { color: '#fff', fontFamily: fonts.bodySemi, fontSize: 13 },
  infoCard: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, marginBottom: space.lg, gap: 8 },
  infoText: { fontFamily: fonts.body, fontSize: 13 },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: 8,
  },
  rankBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rankName: { fontFamily: fonts.bodySemi, fontSize: 14 },
  km: { fontFamily: fonts.headingSemi, fontSize: 15 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 20, paddingBottom: 36 },
  sheetTitle: { fontFamily: fonts.headingSemi, fontSize: 18 },
  sportPick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 8 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
});
