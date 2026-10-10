import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import TeamBadge from '@/components/competition/TeamBadge';
import { fonts } from '@/constants/theme';
import type { CompetitionTeam, ResolvedTeamMedia } from '@/lib/competition';

/**
 * One side of the match header. Walks the resolver chain on image failure and
 * ends at team colours + logo. Text keeps a dark gradient underneath for contrast.
 */
export default function TeamHero({ team, media, side, height = 190 }: { team?: CompetitionTeam | null; media: ResolvedTeamMedia; side: 'home' | 'away'; height?: number }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [media]);
  const candidates = media.chain.filter((c) => c.imageUrl);
  const current = candidates[idx];
  const primary = team?.primary_color || '#133440';
  const secondary = team?.secondary_color || '#5ABDB7';
  return (
    <View style={[styles.wrap, { height, backgroundColor: primary }]} accessible accessibilityLabel={`${side === 'home' ? 'Home' : 'Away'} team ${team?.name ?? ''}`}>
      {current ? (
        <Image
          source={{ uri: current.imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={0}
          onError={() => setIdx((i) => i + 1)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <LinearGradient colors={[primary, `${secondary}99`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.75)']} style={StyleSheet.absoluteFill} />
      <View style={[styles.content, side === 'away' ? styles.alignEnd : null]}>
        <TeamBadge team={team} size={52} />
        <Text style={[styles.name, side === 'away' && { textAlign: 'right' }]} numberOfLines={2}>
          {team?.name ?? 'TBC'}
        </Text>
        <Text style={styles.level} accessibilityLabel={`image source ${current ? current.level.replace(/_/g, ' ') : 'team colours'}`}>
          {current ? current.level.replace(/_/g, ' ') : 'team colours'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden' },
  content: { flex: 1, padding: 14, justifyContent: 'flex-end', gap: 6 },
  alignEnd: { alignItems: 'flex-end' },
  name: { color: '#fff', fontFamily: fonts.heading, fontSize: 16, lineHeight: 20, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  level: { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.body, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6 },
});
