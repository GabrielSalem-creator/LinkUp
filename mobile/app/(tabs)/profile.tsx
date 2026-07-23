import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import SportBadge from '@/components/ui/SportBadge';
import { fonts } from '@/constants/theme';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/ThemeContext';
import type { Activity, EventParticipant, Memory } from '@/types';

type Tab = 'events' | 'history' | 'memories';

export default function ProfileScreen() {
  const { colors, isDark, toggle } = useTheme();
  const { user, updateProfile, logout } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('events');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [upcoming, setUpcoming] = useState<EventParticipant[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [friends, setFriends] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editCity, setEditCity] = useState('');

  const load = useCallback(async () => {
    if (!user?.email) return;
    setLoading(true);
    const [acts, eps, mems, accepted] = await Promise.all([
      api.activities.forUser(user.email),
      api.eventParticipants.mine(user.email),
      api.memories.forUser(user.email),
      api.friendships.acceptedFor(user.email),
    ]);
    setActivities(acts);
    setUpcoming(eps);
    setMemories(mems);
    setFriends(accepted.length);
    setLoading(false);
  }, [user?.email]);

  useEffect(() => {
    load();
  }, [load]);

  const historyBySport = useMemo(() => {
    const map: Record<string, Activity[]> = {};
    activities.forEach((a) => {
      if (!map[a.sport]) map[a.sport] = [];
      map[a.sport].push(a);
    });
    return Object.entries(map);
  }, [activities]);

  if (!user) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={isDark ? ['#144F42', '#0C1017'] : ['#C8F5E8', '#F7F7F8']}
          style={styles.banner}
        />
        <View style={styles.profileBlock}>
          <View style={[styles.avatar, { borderColor: colors.background, backgroundColor: colors.primary }]}>
            {user.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <Text style={styles.avatarLetter}>{(user.full_name || '?')[0].toUpperCase()}</Text>
            )}
          </View>
          <Text style={[styles.name, { color: colors.foreground }]}>{user.full_name}</Text>
          {user.city ? (
            <View style={styles.cityRow}>
              <Ionicons name="location-outline" size={13} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12 }}>{user.city}</Text>
            </View>
          ) : null}
          {user.bio ? (
            <Text style={[styles.bio, { color: colors.mutedForeground }]}>{user.bio}</Text>
          ) : null}

          <View style={styles.statsRow}>
            <Stat label="km" value={user.total_distance_km.toFixed(0)} colors={colors} />
            <Stat label="activities" value={String(user.total_activities)} colors={colors} />
            <Stat label="streak" value={String(user.current_streak)} colors={colors} />
            <Stat label="friends" value={String(friends)} colors={colors} />
          </View>

          <View style={styles.actions}>
            <Pressable
              style={[styles.actionBtn, { borderColor: colors.border }]}
              onPress={() => {
                setEditName(user.full_name);
                setEditBio(user.bio || '');
                setEditCity(user.city || '');
                setShowEdit(true);
              }}
            >
              <Ionicons name="create-outline" size={16} color={colors.foreground} />
              <Text style={[styles.actionText, { color: colors.foreground }]}>Edit</Text>
            </Pressable>
            <Pressable
              style={[styles.iconAction, { borderColor: colors.border }]}
              onPress={() => router.push('/club-portal')}
            >
                <Ionicons name="business-outline" size={16} color={colors.foreground} />
              </Pressable>
            <Pressable style={[styles.iconAction, { borderColor: colors.border }]} onPress={toggle}>
              <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={16} color={colors.foreground} />
            </Pressable>
            <Pressable
              style={[styles.iconAction, { borderColor: colors.border }]}
              onPress={() => logout()}
            >
              <Ionicons name="log-out-outline" size={16} color={colors.foreground} />
            </Pressable>
          </View>
        </View>

        <View style={styles.tabsWrap}>
          <View style={[styles.tabs, { backgroundColor: colors.secondary }]}>
            {(['events', 'history', 'memories'] as Tab[]).map((t) => {
              const on = tab === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setTab(t)}
                  style={[styles.tab, on && { backgroundColor: colors.card }]}
                >
                  <Text
                    style={{
                      fontFamily: fonts.bodySemi,
                      fontSize: 12,
                      color: on ? colors.foreground : colors.mutedForeground,
                      textTransform: 'capitalize',
                    }}
                  >
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.tabBody}>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : tab === 'events' ? (
            upcoming.length === 0 ? (
              <Text style={[styles.empty, { color: colors.mutedForeground }]}>No upcoming events joined.</Text>
            ) : (
              upcoming.map((ep) => (
                <View
                  key={ep.id}
                  style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Text style={[styles.itemTitle, { color: colors.foreground }]}>{ep.event_title}</Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12 }}>
                    {ep.club_name} · {ep.event_date}
                  </Text>
                </View>
              ))
            )
          ) : tab === 'history' ? (
            historyBySport.map(([sport, acts]) => {
              const total = acts.reduce((s, a) => s + a.distance_km, 0);
              return (
                <View key={sport} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.historyHead}>
                    <SportBadge sport={sport} size="sm" />
                    <Text style={{ color: colors.primary, fontFamily: fonts.headingSemi }}>{total.toFixed(1)} km</Text>
                  </View>
                  {acts.slice(0, 3).map((a) => (
                    <Text key={a.id} style={{ color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, marginTop: 6 }}>
                      {a.date} · {a.distance_km} km {a.club_name ? `· ${a.club_name}` : ''}
                    </Text>
                  ))}
                </View>
              );
            })
          ) : memories.length === 0 ? (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>No memories yet.</Text>
          ) : (
            <View style={styles.memoryGrid}>
              {memories.map((m) => (
                <View key={m.id} style={styles.memoryCard}>
                  <Image source={{ uri: m.photo_url }} style={styles.memoryImg} contentFit="cover" />
                  <Text style={[styles.memoryTitle, { color: colors.foreground }]} numberOfLines={1}>
                    {m.title}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 11 }}>
                    {m.location}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showEdit} transparent animationType="slide" onRequestClose={() => setShowEdit(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Edit profile</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Name"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
            />
            <TextInput
              value={editCity}
              onChangeText={setEditCity}
              placeholder="City"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
            />
            <TextInput
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Bio"
              multiline
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                styles.bioInput,
                { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary },
              ]}
            />
            <View style={styles.sheetActions}>
              <Pressable onPress={() => setShowEdit(false)} style={[styles.btnGhost, { borderColor: colors.border }]}>
                <Text style={{ color: colors.foreground, fontFamily: fonts.bodySemi }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  await updateProfile({ full_name: editName, bio: editBio, city: editCity });
                  setShowEdit(false);
                }}
                style={[styles.btnPrimary, { backgroundColor: colors.primary }]}
              >
                <Text style={{ color: '#fff', fontFamily: fonts.bodySemi }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: { foreground: string; mutedForeground: string };
}) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontFamily: fonts.heading, fontSize: 18, color: colors.foreground }}>{value}</Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.mutedForeground }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  banner: { height: 110 },
  profileBlock: { paddingHorizontal: 20, marginTop: -40 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 20,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarLetter: { color: '#fff', fontFamily: fonts.heading, fontSize: 28 },
  name: { fontFamily: fonts.heading, fontSize: 20, marginTop: 12 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  bio: { fontFamily: fonts.body, fontSize: 13, marginTop: 10, lineHeight: 18 },
  statsRow: { flexDirection: 'row', marginTop: 18 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  actionBtn: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionText: { fontFamily: fonts.bodySemi, fontSize: 13 },
  iconAction: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsWrap: { paddingHorizontal: 20, marginTop: 22 },
  tabs: { flexDirection: 'row', borderRadius: 999, padding: 4 },
  tab: { flex: 1, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  tabBody: { paddingHorizontal: 20, marginTop: 16 },
  empty: { fontFamily: fonts.body, textAlign: 'center', marginTop: 20 },
  itemCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  itemTitle: { fontFamily: fonts.headingSemi, fontSize: 14 },
  historyHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  memoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  memoryCard: { width: '47%' },
  memoryImg: { width: '100%', height: 160, borderRadius: 14 },
  memoryTitle: { fontFamily: fonts.bodySemi, fontSize: 12, marginTop: 6 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  sheetTitle: { fontFamily: fonts.headingSemi, fontSize: 18, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 12,
    marginBottom: 10,
    fontFamily: fonts.body,
  },
  bioInput: { height: 88, paddingTop: 12, textAlignVertical: 'top' },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnGhost: { flex: 1, height: 44, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { flex: 1, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
