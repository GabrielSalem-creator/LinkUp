import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import EmptyState from '@/components/ui/EmptyState';
import { fonts } from '@/constants/theme';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/ThemeContext';
import type { Friendship, User } from '@/types';

export default function PeopleScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [pending, setPending] = useState<Friendship[]>([]);
  const [people, setPeople] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.email) return;
    setLoading(true);
    const [p, list] = await Promise.all([api.friendships.pendingFor(user.email), api.people.list()]);
    setPending(p);
    setPeople(list);
    setLoading(false);
  }, [user?.email]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.list}>
      <Text style={[styles.section, { color: colors.mutedForeground }]}>Friend requests</Text>
      {pending.length === 0 ? (
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>No pending requests</Text>
      ) : (
        pending.map((f) => (
          <View key={f.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.letter}>{(f.requester_name || '?')[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.foreground }]}>{f.requester_name}</Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12 }}>
                {f.requester_email}
              </Text>
            </View>
            <Pressable
              onPress={async () => {
                await api.friendships.accept(f.id);
                load();
              }}
              style={[styles.btn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.btnText}>Accept</Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                await api.friendships.decline(f.id);
                load();
              }}
              style={[styles.iconBtn, { borderColor: colors.border }]}
            >
              <Ionicons name="close" size={16} color={colors.foreground} />
            </Pressable>
          </View>
        ))
      )}

      <Text style={[styles.section, { color: colors.mutedForeground, marginTop: 24 }]}>Discover athletes</Text>
      {people.length === 0 ? (
        <EmptyState title="No people found" />
      ) : (
        people.map((p) => (
          <View key={p.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
              <Text style={styles.letter}>{p.full_name[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.foreground }]}>{p.full_name}</Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12 }}>
                {p.city || 'Lebanon'} · {p.total_distance_km} km
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 40 },
  section: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 10,
  },
  empty: { fontFamily: fonts.body, fontSize: 13, marginBottom: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  avatar: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  letter: { color: '#fff', fontFamily: fonts.headingSemi, fontSize: 16 },
  name: { fontFamily: fonts.bodySemi, fontSize: 14 },
  btn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  btnText: { color: '#fff', fontFamily: fonts.bodySemi, fontSize: 12 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
