import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import SportBadge from '@/components/ui/SportBadge';
import { SPORTS, fonts } from '@/constants/theme';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/ThemeContext';
import type { Club } from '@/types';

export default function ClubsExploreScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sport, setSport] = useState<string | null>(null);

  useEffect(() => {
    api.clubs.list().then((c) => {
      setClubs(c);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    return clubs.filter((c) => {
      if (sport && c.sport !== sport.toLowerCase()) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q);
    });
  }, [clubs, query, sport]);

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.searchWrap}>
        <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search clubs or cities"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground }]}
          />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Pressable
          onPress={() => setSport(null)}
          style={[
            styles.chip,
            { backgroundColor: !sport ? colors.primary : colors.secondary, borderColor: colors.border },
          ]}
        >
          <Text style={{ color: !sport ? '#fff' : colors.foreground, fontFamily: fonts.bodyMed, fontSize: 12 }}>
            All
          </Text>
        </Pressable>
        {SPORTS.map((s) => {
          const on = sport === s;
          return (
            <Pressable
              key={s}
              onPress={() => setSport(on ? null : s)}
              style={[
                styles.chip,
                { backgroundColor: on ? colors.primary : colors.secondary, borderColor: colors.border },
              ]}
            >
              <Text style={{ color: on ? '#fff' : colors.foreground, fontFamily: fonts.bodyMed, fontSize: 12 }}>
                {s}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {filtered.map((club) => (
            <Pressable
              key={club.id}
              onPress={() => router.push(`/club/${club.id}`)}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
                {club.cover_url ? (
                  <Image source={{ uri: club.cover_url }} style={styles.cover} contentFit="cover" />
                ) : null}
                <View style={styles.cardBody}>
                  <View style={styles.row}>
                    {club.logo_url ? (
                      <Image source={{ uri: club.logo_url }} style={styles.logo} contentFit="cover" />
                    ) : (
                      <View style={[styles.logoFallback, { backgroundColor: colors.primary }]}>
                        <Text style={styles.letter}>{club.name[0]}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                          {club.name}
                        </Text>
                        {club.is_verified ? (
                          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                        ) : null}
                      </View>
                      <Text style={{ color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12 }}>
                        {club.city} · {club.member_count} members
                      </Text>
                    </View>
                    <SportBadge sport={club.sport} size="sm" />
                  </View>
                </View>
              </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  searchWrap: { paddingHorizontal: 16, paddingTop: 8 },
  search: {
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 14 },
  chips: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginRight: 0 },
  list: { padding: 16, paddingTop: 0, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  cover: { width: '100%', height: 110 },
  cardBody: { padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 44, height: 44, borderRadius: 12 },
  logoFallback: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  letter: { color: '#fff', fontFamily: fonts.heading, fontSize: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontFamily: fonts.headingSemi, fontSize: 15, flexShrink: 1 },
});
