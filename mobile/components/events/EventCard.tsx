import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import SportBadge from '@/components/ui/SportBadge';
import { fonts, radius } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeContext';
import type { Club, ClubEvent } from '@/types';

type Props = {
  event: ClubEvent;
  club?: Club | null;
  joined?: boolean;
  joining?: boolean;
  onJoin?: () => void;
};

export default function EventCard({ event, club, joined, joining, onJoin }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const image = event.cover_url || club?.cover_url || club?.logo_url;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable
        onPress={() => router.push(`/club/${event.club_id}`)}
        style={({ pressed }) => [{ opacity: pressed ? 0.94 : 1 }]}
      >
        {image ? (
          <View style={styles.imageWrap}>
            <Image source={{ uri: image }} style={styles.image} contentFit="cover" />
            <LinearGradient
              colors={['transparent', 'rgba(10,16,14,0.78)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.brandRow}>
              {club?.logo_url ? (
                <Image source={{ uri: club.logo_url }} style={styles.logo} contentFit="cover" />
              ) : (
                <View style={[styles.logoFallback, { backgroundColor: colors.primary }]}>
                  <Text style={styles.logoLetter}>{(club?.name || event.club_name || '?')[0]}</Text>
                </View>
              )}
              <Text style={styles.brandName} numberOfLines={1}>
                {club?.name || event.club_name}
              </Text>
            </View>
            {event.sport ? (
              <View style={styles.badgeFloat}>
                <SportBadge sport={event.sport} size="sm" />
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1, gap: 4 }}>
              {!image && (club || event.club_name) ? (
                <Text style={[styles.clubTiny, { color: colors.mutedForeground }]}>
                  {club?.name || event.club_name}
                </Text>
              ) : null}
              <Text style={[styles.title, { color: colors.foreground }]}>{event.title}</Text>
            </View>
            {!image && event.sport ? <SportBadge sport={event.sport} size="sm" /> : null}
          </View>

          <View style={styles.meta}>
            {event.time ? (
              <View style={[styles.metaChip, { backgroundColor: colors.secondary }]}>
                <Ionicons name="time-outline" size={13} color={colors.primary} />
                <Text style={[styles.metaText, { color: colors.foreground }]}>{event.time}</Text>
              </View>
            ) : null}
            {event.meeting_point ? (
              <View style={[styles.metaChip, { backgroundColor: colors.secondary }]}>
                <Ionicons name="location-outline" size={13} color={colors.primary} />
                <Text style={[styles.metaText, { color: colors.foreground }]} numberOfLines={1}>
                  {event.meeting_point}
                </Text>
              </View>
            ) : null}
            {event.distance_km ? (
              <View style={[styles.metaChip, { backgroundColor: colors.secondary }]}>
                <Ionicons name="speedometer-outline" size={13} color={colors.primary} />
                <Text style={[styles.metaText, { color: colors.foreground }]}>{event.distance_km} km</Text>
              </View>
            ) : null}
            {event.max_participants ? (
              <View style={[styles.metaChip, { backgroundColor: colors.secondary }]}>
                <Ionicons name="people-outline" size={13} color={colors.primary} />
                <Text style={[styles.metaText, { color: colors.foreground }]}>
                  {event.max_participants} spots
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>

      {onJoin ? (
        <View style={styles.joinWrap}>
          <Pressable
            onPress={onJoin}
            disabled={joined || joining}
            style={({ pressed }) => [
              styles.joinBtn,
              {
                backgroundColor: joined ? colors.primarySoft : colors.accent,
                opacity: joining ? 0.7 : pressed ? 0.9 : 1,
              },
            ]}
          >
            {joining ? (
              <ActivityIndicator color={joined ? colors.primary : colors.accentForeground} />
            ) : (
              <>
                <Ionicons
                  name={joined ? 'checkmark-circle' : 'add-circle-outline'}
                  size={18}
                  color={joined ? colors.primary : colors.accentForeground}
                />
                <Text
                  style={{
                    color: joined ? colors.primary : colors.accentForeground,
                    fontFamily: fonts.bodySemi,
                    fontSize: 14,
                  }}
                >
                  {joined ? "You're in" : 'Join Event'}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
  },
  imageWrap: { height: 156 },
  image: { width: '100%', height: '100%' },
  brandRow: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: { width: 32, height: 32, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  logoFallback: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: { color: '#fff', fontFamily: fonts.headingSemi, fontSize: 14 },
  brandName: { color: '#fff', fontFamily: fonts.bodySemi, fontSize: 13, flex: 1 },
  badgeFloat: { position: 'absolute', top: 12, right: 12 },
  body: { padding: 14, gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  clubTiny: { fontFamily: fonts.bodyMed, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
  title: { fontFamily: fonts.headingSemi, fontSize: 16, lineHeight: 22, letterSpacing: -0.2 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radius.full,
    maxWidth: '100%',
  },
  metaText: { fontFamily: fonts.bodyMed, fontSize: 12 },
  joinWrap: { paddingHorizontal: 14, paddingBottom: 14 },
  joinBtn: {
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
});
