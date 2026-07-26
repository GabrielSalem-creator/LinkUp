import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { type Href, useRouter } from 'expo-router';
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

import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import SportBadge from '@/components/ui/SportBadge';
import { fonts, radius } from '@/constants/theme';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/lib/api';
import { formatScore, metricForSport } from '@/lib/scoring';
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
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editCity, setEditCity] = useState('');

  const [completeEp, setCompleteEp] = useState<EventParticipant | null>(null);
  const [eventCode, setEventCode] = useState('');
  const [completing, setCompleting] = useState(false);

  const [memoryAct, setMemoryAct] = useState<Activity | null>(null);
  const [memTitle, setMemTitle] = useState('');
  const [memPhoto, setMemPhoto] = useState('');
  const [savingMem, setSavingMem] = useState(false);

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
    setUpcoming(eps.filter((e) => !e.confirmed));
    setMemories(mems);
    setFollowers(accepted.filter((f) => f.addressee_email === user.email).length);
    setFollowing(accepted.filter((f) => f.requester_email === user.email).length);
    setLoading(false);
  }, [user?.email]);

  useEffect(() => {
    load();
  }, [load]);

  const historyFlat = useMemo(
    () => [...activities].sort((a, b) => b.date.localeCompare(a.date)),
    [activities],
  );

  const submitComplete = async () => {
    if (!user || !completeEp) return;
    setCompleting(true);
    try {
      await api.eventParticipants.complete(completeEp, eventCode, user);
      setCompleteEp(null);
      setEventCode('');
      setTab('history');
      await load();
      Alert.alert('Completed', 'Event moved to your history.');
    } catch (e) {
      Alert.alert('Could not complete', e instanceof Error ? e.message : 'Check the code');
    } finally {
      setCompleting(false);
    }
  };

  const submitMemory = async () => {
    if (!user || !memoryAct || !memPhoto.trim()) {
      Alert.alert('Photo required', 'Paste an image URL for now (upload wiring later).');
      return;
    }
    setSavingMem(true);
    try {
      await api.memories.create({
        user_email: user.email,
        title: memTitle.trim() || memoryAct.notes?.replace('Attended event: ', '') || 'Memory',
        photo_url: memPhoto.trim(),
        date: memoryAct.date,
        location: memoryAct.club_name,
        event_title: memoryAct.notes?.replace('Attended event: ', ''),
        club_name: memoryAct.club_name,
      });
      setMemoryAct(null);
      setMemTitle('');
      setMemPhoto('');
      setTab('memories');
      await load();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSavingMem(false);
    }
  };

  if (!user) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={isDark ? ['#133440', '#0C1A20'] : ['#5ABDB7', '#FFF2E2']}
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

          <View style={[styles.statsBand, { backgroundColor: colors.primary }]}>
            <Stat label="Followers" value={String(followers)} light />
            <View style={styles.statDivider} />
            <Stat label="Following" value={String(following)} light />
          </View>

          <View style={styles.actions}>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.primarySoft }]}
              onPress={() => {
                setEditName(user.full_name);
                setEditBio(user.bio || '');
                setEditCity(user.city || '');
                setShowEdit(true);
              }}
            >
              <Ionicons name="create-outline" size={16} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.primary }]}>Edit</Text>
            </Pressable>
            <Pressable
              style={[styles.iconAction, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={() => router.push('/connections' as Href)}
            >
              <Ionicons name="link-outline" size={18} color={colors.foreground} />
            </Pressable>
            <Pressable
              style={[styles.iconAction, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={() => router.push('/club-portal')}
            >
              <Ionicons name="storefront-outline" size={18} color={colors.foreground} />
            </Pressable>
            <Pressable
              style={[styles.iconAction, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={toggle}
            >
              <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={18} color={colors.foreground} />
            </Pressable>
            <Pressable
              style={[styles.iconAction, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={() => logout()}
            >
              <Ionicons name="log-out-outline" size={18} color={colors.destructive} />
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
            <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
          ) : tab === 'events' ? (
            upcoming.length === 0 ? (
              <EmptyState
                icon="calendar-outline"
                title="No upcoming events"
                description="Join an event from Discover, then enter the code after you attend."
              />
            ) : (
              upcoming.map((ep) => (
                <Pressable
                  key={ep.id}
                  onPress={() => {
                    setCompleteEp(ep);
                    setEventCode('');
                  }}
                  style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Text style={[styles.itemTitle, { color: colors.foreground }]}>{ep.event_title}</Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12 }}>
                    {ep.club_name} · {ep.event_date}
                  </Text>
                  <Text style={{ color: colors.accent, fontFamily: fonts.bodySemi, fontSize: 12, marginTop: 8 }}>
                    Enter event code
                  </Text>
                </Pressable>
              ))
            )
          ) : tab === 'history' ? (
            historyFlat.length === 0 ? (
              <EmptyState
                icon="fitness-outline"
                title="No completed events"
                description="Complete an event with the creator’s code to build your history."
              />
            ) : (
              historyFlat.map((a) => {
                const metric = metricForSport(a.sport);
                const value =
                  metric === 'distance_km'
                    ? a.distance_km
                    : metric === 'duration_hours'
                      ? (a.duration_minutes || 0) / 60
                      : 1;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => {
                      setMemoryAct(a);
                      setMemTitle(a.notes?.replace('Attended event: ', '') || a.sport);
                      setMemPhoto('');
                    }}
                    style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={styles.historyHead}>
                      <SportBadge sport={a.sport} size="sm" />
                      <Text style={{ color: colors.primary, fontFamily: fonts.headingSemi }}>
                        {formatScore(value, metric)}
                      </Text>
                    </View>
                    <Text style={[styles.itemTitle, { color: colors.foreground, marginTop: 8 }]}>
                      {a.notes?.replace('Attended event: ', '') || a.sport}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, marginTop: 4 }}>
                      {a.date}
                      {a.club_name ? ` · ${a.club_name}` : ''}
                    </Text>
                    <Text style={{ color: colors.accent, fontFamily: fonts.bodySemi, fontSize: 12, marginTop: 8 }}>
                      Add memory photos
                    </Text>
                  </Pressable>
                );
              })
            )
          ) : memories.length === 0 ? (
            <EmptyState
              icon="images-outline"
              title="No memories yet"
              description="Open a completed event in History and add photos."
            />
          ) : (
            <View style={styles.memoryGrid}>
              {memories.map((m) => (
                <View key={m.id} style={styles.memoryCard}>
                  <Image source={{ uri: m.photo_url }} style={styles.memoryImg} contentFit="cover" />
                  <Text style={[styles.memoryTitle, { color: colors.foreground }]} numberOfLines={1}>
                    {m.title}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 11 }}>
                    {m.location || m.club_name}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showEdit} transparent animationType="slide" onRequestClose={() => setShowEdit(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
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
              <Button label="Cancel" variant="ghost" onPress={() => setShowEdit(false)} style={{ flex: 1 }} />
              <Button
                label="Save"
                onPress={async () => {
                  await updateProfile({ full_name: editName, bio: editBio, city: editCity });
                  setShowEdit(false);
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!completeEp} transparent animationType="slide" onRequestClose={() => setCompleteEp(null)}>
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Enter event code</Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: fonts.body, marginBottom: 12 }}>
              Ask the event creator for the code they shared at the end of {completeEp?.event_title}.
            </Text>
            <TextInput
              value={eventCode}
              onChangeText={setEventCode}
              autoCapitalize="characters"
              placeholder="Event code"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
            />
            <View style={styles.sheetActions}>
              <Button label="Cancel" variant="ghost" onPress={() => setCompleteEp(null)} style={{ flex: 1 }} />
              <Button label="Complete" onPress={submitComplete} loading={completing} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!memoryAct} transparent animationType="slide" onRequestClose={() => setMemoryAct(null)}>
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Add event memory</Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: fonts.body, marginBottom: 12 }}>
              Photos show up in your Memories tab.
            </Text>
            <TextInput
              value={memTitle}
              onChangeText={setMemTitle}
              placeholder="Caption"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
            />
            <TextInput
              value={memPhoto}
              onChangeText={setMemPhoto}
              autoCapitalize="none"
              placeholder="Photo URL"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
            />
            <View style={styles.sheetActions}>
              <Button label="Cancel" variant="ghost" onPress={() => setMemoryAct(null)} style={{ flex: 1 }} />
              <Button label="Save memory" onPress={submitMemory} loading={savingMem} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({ label, value, light }: { label: string; value: string; light?: boolean }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontFamily: fonts.heading, fontSize: 22, color: light ? '#FFF2E2' : undefined }}>{value}</Text>
      <Text style={{ fontFamily: fonts.bodyMed, fontSize: 12, color: light ? 'rgba(255,242,226,0.75)' : undefined }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  banner: { height: 120 },
  profileBlock: { paddingHorizontal: 20, marginTop: -44 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    alignSelf: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarLetter: { color: '#fff', fontFamily: fonts.heading, fontSize: 32 },
  name: { fontFamily: fonts.heading, fontSize: 24, textAlign: 'center', marginTop: 12 },
  cityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 4 },
  bio: { fontFamily: fonts.body, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  statsBand: {
    marginTop: 18,
    borderRadius: radius.lg,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,242,226,0.25)' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16, alignItems: 'center' },
  actionBtn: {
    flex: 1,
    height: 42,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionText: { fontFamily: fonts.bodySemi, fontSize: 13 },
  iconAction: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsWrap: { paddingHorizontal: 20, marginTop: 22 },
  tabs: { flexDirection: 'row', borderRadius: radius.full, padding: 4 },
  tab: { flex: 1, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  tabBody: { paddingHorizontal: 20, marginTop: 16 },
  itemCard: { borderWidth: 1, borderRadius: radius.md, padding: 14, marginBottom: 10 },
  itemTitle: { fontFamily: fonts.headingSemi, fontSize: 15 },
  historyHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  memoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  memoryCard: { width: '47%' },
  memoryImg: { width: '100%', height: 160, borderRadius: radius.md },
  memoryTitle: { fontFamily: fonts.bodySemi, fontSize: 12, marginTop: 6 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 20, paddingBottom: 36 },
  sheetTitle: { fontFamily: fonts.headingSemi, fontSize: 18, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    height: 48,
    paddingHorizontal: 12,
    marginBottom: 10,
    fontFamily: fonts.body,
  },
  bioInput: { height: 88, paddingTop: 12, textAlignVertical: 'top' },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
});
