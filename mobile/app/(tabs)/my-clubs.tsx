import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EmptyState from '@/components/ui/EmptyState';
import ScreenHeader from '@/components/ui/ScreenHeader';
import SportBadge from '@/components/ui/SportBadge';
import { SPORT_ORDER, fonts, radius } from '@/constants/theme';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/ThemeContext';
import type { Club, ClubEvent } from '@/types';

export default function MyClubsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.email) return;
    setLoading(true);
    const memberships = await api.memberships.mine(user.email);
    const ids = new Set(memberships.map((m) => m.club_id));
    const [allClubs, allEvents] = await Promise.all([api.clubs.list(), api.events.list()]);
    setClubs(allClubs.filter((c) => ids.has(c.id)));
    setEvents(allEvents);
    setLoading(false);
  }, [user?.email]);

  useEffect(() => {
    load();
  }, [load]);

  const today = format(new Date(), 'yyyy-MM-dd');
  const eventsByClub = useMemo(() => {
    const map: Record<string, ClubEvent[]> = {};
    events
      .filter((e) => e.date >= today)
      .forEach((e) => {
        if (!map[e.club_id]) map[e.club_id] = [];
        map[e.club_id].push(e);
      });
    return map;
  }, [events, today]);

  const grouped = useMemo(() => {
    const groups: Record<string, Club[]> = {};
    clubs.forEach((c) => {
      const sport = c.sport || 'other';
      if (!groups[sport]) groups[sport] = [];
      groups[sport].push(c);
    });
    return Object.entries(groups).sort(
      ([a], [b]) => SPORT_ORDER.indexOf(a as (typeof SPORT_ORDER)[number]) - SPORT_ORDER.indexOf(b as (typeof SPORT_ORDER)[number])
    );
  }, [clubs]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScreenHeader
        title="My Clubs"
        subtitle="Teams you train with"
        right={
          <Pressable
            style={[styles.exploreBtn, { backgroundColor: colors.primarySoft }]}
            onPress={() => router.push('/clubs')}
          >
            <Ionicons name="compass-outline" size={16} color={colors.primary} />
            <Text style={[styles.exploreText, { color: colors.primary }]}>Explore</Text>
          </Pressable>
        }
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : clubs.length === 0 ? (
        <EmptyState
          icon="shield-outline"
          title="No clubs yet"
          description="Join clubs to see them here and stay updated with their events."
          action={
            <Pressable style={[styles.cta, { backgroundColor: colors.primary }]} onPress={() => router.push('/clubs')}>
              <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>Explore Clubs</Text>
            </Pressable>
          }
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {grouped.map(([sport, sportClubs]) => (
            <View key={sport} style={styles.group}>
              <View style={styles.groupHead}>
                <SportBadge sport={sport} size="sm" />
                <Text style={[styles.count, { color: colors.mutedForeground }]}>
                  {sportClubs.length} club{sportClubs.length > 1 ? 's' : ''}
                </Text>
              </View>
              {sportClubs.map((club) => {
                const upcoming = eventsByClub[club.id] || [];
                return (
                  <Pressable
                    key={club.id}
                    onPress={() => router.push(`/club/${club.id}`)}
                    style={({ pressed }) => [
                      styles.card,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        opacity: pressed ? 0.94 : 1,
                      },
                    ]}
                  >
                    <View style={styles.cardTop}>
                      {club.logo_url ? (
                        <Image source={{ uri: club.logo_url }} style={styles.logo} contentFit="cover" />
                      ) : (
                        <View style={[styles.logoFallback, { backgroundColor: colors.primary }]}>
                          <Text style={styles.logoLetter}>{club.name[0]}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <View style={styles.nameRow}>
                          <Text style={[styles.clubName, { color: colors.foreground }]} numberOfLines={1}>
                            {club.name}
                          </Text>
                          {club.is_verified ? (
                            <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                          ) : null}
                        </View>
                        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                          {club.city} · {club.member_count} members
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                    </View>
                    {upcoming.length > 0 ? (
                      <View style={[styles.upcoming, { backgroundColor: colors.primarySoft }]}>
                        <Ionicons name="calendar-outline" size={14} color={colors.primary} />
                        <Text style={[styles.upcomingText, { color: colors.foreground }]} numberOfLines={1}>
                          Next: {upcoming[0].title} · {upcoming[0].date}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.full,
  },
  exploreText: { fontFamily: fonts.bodySemi, fontSize: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 32 },
  group: { marginBottom: 22 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  count: { fontFamily: fonts.bodySemi, fontSize: 11, textTransform: 'uppercase' },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 52, height: 52, borderRadius: radius.md },
  logoFallback: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: { color: '#fff', fontFamily: fonts.heading, fontSize: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clubName: { fontFamily: fonts.headingSemi, fontSize: 16, flexShrink: 1, letterSpacing: -0.2 },
  meta: { fontFamily: fonts.body, fontSize: 12, marginTop: 3 },
  upcoming: {
    marginTop: 12,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  upcomingText: { fontFamily: fonts.bodyMed, fontSize: 12, flex: 1 },
  cta: { borderRadius: radius.full, paddingHorizontal: 18, paddingVertical: 12 },
  ctaText: { fontFamily: fonts.bodySemi },
});
