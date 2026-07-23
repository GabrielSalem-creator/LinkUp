import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import EventCard from '@/components/events/EventCard';
import SportBadge from '@/components/ui/SportBadge';
import { fonts } from '@/constants/theme';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/ThemeContext';
import type { Activity, Club, ClubEvent, MerchItem } from '@/types';

type Tab = 'events' | 'leaderboard' | 'merch';

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [club, setClub] = useState<Club | null>(null);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [merch, setMerch] = useState<MerchItem[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('events');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [c, ev, m, acts] = await Promise.all([
      api.clubs.get(id),
      api.events.forClub(id),
      api.merch.forClub(id),
      api.activities.list(),
    ]);
    setClub(c);
    setEvents(ev);
    setMerch(m);
    setActivities(acts.filter((a) => a.club_id === id));
    if (user?.email) {
      const memberships = await api.memberships.mine(user.email);
      setJoined(memberships.some((x) => x.club_id === id));
    }
    setLoading(false);
  }, [id, user?.email]);

  useEffect(() => {
    load();
  }, [load]);

  const leaderboard = Object.values(
    activities.reduce<Record<string, { name: string; km: number }>>((acc, a) => {
      if (!acc[a.user_email]) acc[a.user_email] = { name: a.user_name || a.user_email, km: 0 };
      acc[a.user_email].km += a.distance_km;
      return acc;
    }, {})
  ).sort((a, b) => b.km - a.km);

  const toggleJoin = async () => {
    if (!user || !club) return;
    if (joined) {
      await api.memberships.leave(club.id, user.email);
      setJoined(false);
    } else {
      await api.memberships.join(club.id, user.email);
      setJoined(true);
      Alert.alert('Joined!', `You're now a member of ${club.name}`);
    }
  };

  if (loading || !club) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: club.name }} />
      <ScrollView style={{ backgroundColor: colors.background }} showsVerticalScrollIndicator={false}>
        <View style={styles.coverWrap}>
          {club.cover_url ? (
            <Image source={{ uri: club.cover_url }} style={styles.cover} contentFit="cover" />
          ) : (
            <View style={[styles.cover, { backgroundColor: colors.secondary }]} />
          )}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={StyleSheet.absoluteFill} />
        </View>

        <View style={styles.body}>
          <View style={styles.headerRow}>
            {club.logo_url ? (
              <Image source={{ uri: club.logo_url }} style={styles.logo} contentFit="cover" />
            ) : (
              <View style={[styles.logoFallback, { backgroundColor: colors.primary }]}>
                <Text style={styles.letter}>{club.name[0]}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, { color: colors.foreground }]}>{club.name}</Text>
                {club.is_verified ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
              </View>
              <Text style={{ color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12 }}>
                {club.city} · {club.member_count} members
              </Text>
              <View style={{ marginTop: 6 }}>
                <SportBadge sport={club.sport} size="sm" />
              </View>
            </View>
          </View>

          {club.description ? (
            <Text style={[styles.desc, { color: colors.mutedForeground }]}>{club.description}</Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={toggleJoin}
              style={[styles.joinBtn, { backgroundColor: joined ? colors.secondary : colors.primary }]}
            >
              <Text style={{ color: joined ? colors.foreground : '#fff', fontFamily: fonts.bodySemi }}>
                {joined ? 'Joined' : 'Join Club'}
              </Text>
            </Pressable>
            {club.instagram_link ? (
              <Pressable
                onPress={() => Linking.openURL(club.instagram_link!)}
                style={[styles.iconBtn, { borderColor: colors.border }]}
              >
                <Ionicons name="logo-instagram" size={18} color={colors.foreground} />
              </Pressable>
            ) : null}
          </View>

          <View style={[styles.tabs, { backgroundColor: colors.secondary }]}>
            {(['events', 'leaderboard', 'merch'] as Tab[]).map((t) => {
              const on = tab === t;
              return (
                <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, on && { backgroundColor: colors.card }]}>
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

          <View style={{ marginTop: 16 }}>
            {tab === 'events'
              ? events.map((ev) => <EventCard key={ev.id} event={ev} club={club} />)
              : tab === 'leaderboard'
                ? leaderboard.map((row, i) => (
                    <View
                      key={row.name + i}
                      style={[styles.lbRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <Text style={{ fontFamily: fonts.bodyBold, color: colors.mutedForeground, width: 24 }}>
                        {i + 1}
                      </Text>
                      <Text style={{ flex: 1, fontFamily: fonts.bodySemi, color: colors.foreground }}>{row.name}</Text>
                      <Text style={{ fontFamily: fonts.headingSemi, color: colors.primary }}>
                        {row.km.toFixed(1)} km
                      </Text>
                    </View>
                  ))
                : merch.length === 0
                  ? (
                    <Text style={{ color: colors.mutedForeground, fontFamily: fonts.body, textAlign: 'center' }}>
                      No merch listed yet.
                    </Text>
                    )
                  : (
                    <View style={styles.merchGrid}>
                      {merch.map((item) => (
                        <View key={item.id} style={[styles.merchCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                          {item.image_url ? (
                            <Image source={{ uri: item.image_url }} style={styles.merchImg} contentFit="cover" />
                          ) : null}
                          <Text style={{ fontFamily: fonts.bodySemi, color: colors.foreground, marginTop: 8 }}>
                            {item.name}
                          </Text>
                          <Text style={{ fontFamily: fonts.headingSemi, color: colors.primary }}>${item.price}</Text>
                        </View>
                      ))}
                    </View>
                    )}
          </View>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  coverWrap: { height: 180 },
  cover: { width: '100%', height: '100%' },
  body: { padding: 16, marginTop: -28 },
  headerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  logo: { width: 72, height: 72, borderRadius: 18, borderWidth: 3, borderColor: '#fff' },
  logoFallback: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  letter: { color: '#fff', fontFamily: fonts.heading, fontSize: 26 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontFamily: fonts.heading, fontSize: 20, flexShrink: 1 },
  desc: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginTop: 14 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  joinBtn: { flex: 1, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 44, height: 44, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', borderRadius: 999, padding: 4, marginTop: 20 },
  tab: { flex: 1, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  merchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  merchCard: { width: '47%', borderWidth: 1, borderRadius: 14, padding: 10 },
  merchImg: { width: '100%', height: 120, borderRadius: 10 },
});
