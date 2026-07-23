import { Ionicons } from '@expo/vector-icons';
import { format, isToday, isTomorrow, parseISO, addDays } from 'date-fns';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EventCard from '@/components/events/EventCard';
import EmptyState from '@/components/ui/EmptyState';
import { SPORTS, fonts } from '@/constants/theme';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/ThemeContext';
import type { Club, ClubEvent } from '@/types';

function dayLabel(dateStr: string) {
  const d = parseISO(dateStr);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'EEE, MMM d');
}

function toDateStr(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

export default function EventsScreen() {
  const { colors } = useTheme();
  const { user, usingFallback } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ev, cl] = await Promise.all([api.events.list(), api.clubs.list()]);
      setEvents(ev);
      setClubs(cl);
      if (user?.email) {
        const [p, mine] = await Promise.all([
          api.friendships.pendingFor(user.email).catch(() => []),
          api.eventParticipants.mine(user.email).catch(() => []),
        ]);
        setPending(p.length);
        setJoinedIds(new Set(mine.map((x) => x.event_id)));
      }
    } catch (e) {
      console.warn('Events load failed, using offline data', e);
      const { mockApi } = await import('@/lib/api.mock');
      const [ev, cl] = await Promise.all([mockApi.events.list(), mockApi.clubs.list()]);
      setEvents(ev);
      setClubs(cl);
    } finally {
      setLoading(false);
    }
  }, [user?.email, usingFallback]);

  const joinEvent = async (ev: ClubEvent) => {
    if (!user?.email) {
      Alert.alert('Sign in required', 'Log in to join events.');
      return;
    }
    if (joinedIds.has(ev.id)) return;
    setJoiningId(ev.id);
    try {
      await api.eventParticipants.join(ev, user.email);
      setJoinedIds((prev) => new Set([...prev, ev.id]));
      Alert.alert('Joined', `You're in for ${ev.title}`);
    } catch (e) {
      Alert.alert('Could not join', e instanceof Error ? e.message : 'Try again');
    } finally {
      setJoiningId(null);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  const clubMap = useMemo(() => Object.fromEntries(clubs.map((c) => [c.id, c])), [clubs]);
  const cities = useMemo(() => [...new Set(clubs.map((c) => c.city))].sort(), [clubs]);

  const filtered = useMemo(() => {
    return events.filter((ev) => {
      if (selectedSports.length) {
        const s = (ev.sport || '').toLowerCase();
        if (!selectedSports.some((x) => x.toLowerCase() === s)) return false;
      }
      if (selectedCities.length) {
        const club = clubMap[ev.club_id];
        if (!club || !selectedCities.includes(club.city)) return false;
      }
      return true;
    });
  }, [events, selectedSports, selectedCities, clubMap]);

  const days = useMemo(() => {
    const start = toDateStr(new Date());
    return Array.from({ length: 30 }, (_, i) => toDateStr(addDays(parseISO(start), i)));
  }, []);

  const byDay = useMemo(() => {
    const map: Record<string, ClubEvent[]> = {};
    filtered.forEach((ev) => {
      if (!ev.date) return;
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    });
    return map;
  }, [filtered]);

  const daysWithEvents = days.filter((d) => byDay[d]?.length);
  const activeFilters = selectedSports.length + selectedCities.length;

  const toggleSport = (sport: string) => {
    const key = sport.toLowerCase();
    setSelectedSports((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]));
  };

  const toggleCity = (city: string) => {
    setSelectedCities((prev) => (prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]));
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.brand, { color: colors.primary }]}>LinkUp</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconBtn} onPress={() => router.push('/people')}>
              <Ionicons name="notifications-outline" size={20} color={colors.foreground} />
              {pending > 0 ? (
                <View style={[styles.badge, { backgroundColor: colors.destructive }]}>
                  <Text style={styles.badgeText}>{pending > 9 ? '9+' : pending}</Text>
                </View>
              ) : null}
            </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => setShowFilters(true)}>
            <Ionicons name="options-outline" size={20} color={colors.foreground} />
            {activeFilters > 0 ? (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text style={styles.badgeText}>{activeFilters}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : daysWithEvents.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="No events match"
          description="Try clearing filters or check back soon for new club sessions across Lebanon."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {daysWithEvents.map((date) => (
            <View key={date} style={styles.dayBlock}>
              <Text style={[styles.dayLabel, { color: colors.foreground }]}>{dayLabel(date)}</Text>
              {byDay[date].map((ev) => (
                <EventCard
                  key={ev.id}
                  event={ev}
                  club={clubMap[ev.club_id]}
                  joined={joinedIds.has(ev.id)}
                  joining={joiningId === ev.id}
                  onJoin={() => joinEvent(ev)}
                />
              ))}
            </View>
          ))}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      <Modal visible={showFilters} animationType="slide" transparent onRequestClose={() => setShowFilters(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHead}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Filters</Text>
              <Pressable onPress={() => setShowFilters(false)}>
                <Ionicons name="close" size={22} color={colors.foreground} />
              </Pressable>
            </View>

            <Text style={[styles.filterLabel, { color: colors.mutedForeground }]}>Sport</Text>
            <View style={styles.chips}>
              {SPORTS.map((sport) => {
                const on = selectedSports.includes(sport.toLowerCase());
                return (
                  <Pressable
                    key={sport}
                    onPress={() => toggleSport(sport)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: on ? colors.primary : colors.secondary,
                        borderColor: on ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: on ? '#fff' : colors.foreground, fontFamily: fonts.bodyMed, fontSize: 12 }}>
                      {sport}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.filterLabel, { color: colors.mutedForeground, marginTop: 16 }]}>City</Text>
            <View style={styles.chips}>
              {cities.map((city) => {
                const on = selectedCities.includes(city);
                return (
                  <Pressable
                    key={city}
                    onPress={() => toggleCity(city)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: on ? colors.primary : colors.secondary,
                        borderColor: on ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: on ? '#fff' : colors.foreground, fontFamily: fonts.bodyMed, fontSize: 12 }}>
                      {city}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.sheetActions}>
              <Pressable
                onPress={() => {
                  setSelectedSports([]);
                  setSelectedCities([]);
                }}
                style={[styles.btnSecondary, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.foreground, fontFamily: fonts.bodySemi }}>Clear</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowFilters(false)}
                style={[styles.btnPrimary, { backgroundColor: colors.primary }]}
              >
                <Text style={{ color: '#fff', fontFamily: fonts.bodySemi }}>Apply</Text>
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
  brand: { fontFamily: fonts.heading, fontSize: 22 },
  headerActions: { flexDirection: 'row', gap: 4 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontFamily: fonts.bodyBold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16 },
  dayBlock: { marginBottom: 8 },
  dayLabel: { fontFamily: fonts.headingSemi, fontSize: 16, marginBottom: 10 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { fontFamily: fonts.headingSemi, fontSize: 18 },
  filterLabel: { fontFamily: fonts.bodySemi, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  btnSecondary: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 999,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { flex: 1, borderRadius: 999, height: 44, alignItems: 'center', justifyContent: 'center' },
});
