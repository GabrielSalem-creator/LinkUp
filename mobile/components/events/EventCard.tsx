import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import SportBadge from '@/components/ui/SportBadge';
import { fonts } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeContext';
import type { Club, ClubEvent } from '@/types';

type Props = { event: ClubEvent; club?: Club | null };

export default function EventCard({ event, club }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const image = event.cover_url || club?.cover_url || club?.logo_url;

  return (
      <Pressable
        onPress={() => router.push(`/club/${event.club_id}`)}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
        ]}
      >
        {image ? (
          <View style={styles.imageWrap}>
            <Image source={{ uri: image }} style={styles.image} contentFit="cover" />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.65)']} style={StyleSheet.absoluteFill} />
            <View style={styles.brandRow}>
              {club?.logo_url ? (
                <Image source={{ uri: club.logo_url }} style={styles.logo} contentFit="cover" />
              ) : null}
              <Text style={styles.brandName}>{club?.name || event.club_name}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              {!image && (club || event.club_name) ? (
                <Text style={[styles.clubTiny, { color: colors.mutedForeground }]}>
                  {club?.name || event.club_name}
                </Text>
              ) : null}
              <Text style={[styles.title, { color: colors.foreground }]}>{event.title}</Text>
            </View>
            {event.sport ? <SportBadge sport={event.sport} size="sm" /> : null}
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </View>

          <View style={styles.meta}>
            {event.time ? (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{event.time}</Text>
              </View>
            ) : null}
            {event.meeting_point ? (
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={12} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {event.meeting_point}
                </Text>
              </View>
            ) : null}
            {event.distance_km ? (
              <Text style={[styles.metaText, { color: colors.mutedForeground, fontFamily: fonts.bodySemi }]}>
                {event.distance_km} km
              </Text>
            ) : null}
            {event.max_participants ? (
              <View style={styles.metaItem}>
                <Ionicons name="people-outline" size={12} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {event.max_participants} spots
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  imageWrap: { height: 140 },
  image: { width: '100%', height: '100%' },
  brandRow: {
    position: 'absolute',
    left: 12,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' },
  brandName: { color: '#fff', fontFamily: fonts.bodySemi, fontSize: 12 },
  body: { padding: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  clubTiny: { fontFamily: fonts.bodyMed, fontSize: 10, marginBottom: 2 },
  title: { fontFamily: fonts.headingSemi, fontSize: 15, lineHeight: 20 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 160 },
  metaText: { fontFamily: fonts.body, fontSize: 12 },
});
