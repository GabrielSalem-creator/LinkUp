import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

type Relation = 'none' | 'pending_out' | 'pending_in' | 'friends';

export default function PeopleScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [pending, setPending] = useState<Friendship[]>([]);
  const [accepted, setAccepted] = useState<Friendship[]>([]);
  const [outgoing, setOutgoing] = useState<Friendship[]>([]);
  const [people, setPeople] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.email) return;
    setLoading(true);
    try {
      const [p, out, a, list] = await Promise.all([
        api.friendships.pendingFor(user.email),
        api.friendships.outgoingPendingFor(user.email),
        api.friendships.acceptedFor(user.email),
        api.people.list(),
      ]);
      setPending(p);
      setOutgoing(out);
      setAccepted(a);
      setPeople(list);
    } catch (e) {
      Alert.alert('Could not load people', e instanceof Error ? e.message : 'Try again');
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    load();
  }, [load]);

  const relationFor = useMemo(() => {
    const map = new Map<string, Relation>();
    if (!user?.email) return map;
    accepted.forEach((f) => {
      const other = f.requester_email === user.email ? f.addressee_email : f.requester_email;
      map.set(other, 'friends');
    });
    pending.forEach((f) => map.set(f.requester_email, 'pending_in'));
    outgoing.forEach((f) => {
      if (!map.has(f.addressee_email)) map.set(f.addressee_email, 'pending_out');
    });
    return map;
  }, [accepted, pending, outgoing, user?.email]);

  const follow = async (person: User) => {
    if (!user) return;
    setBusyEmail(person.email);
    try {
      await api.friendships.request(user, person);
      await load();
    } catch (e) {
      Alert.alert('Follow failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusyEmail(null);
    }
  };

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
        <EmptyState title="No people found" description="Create accounts and they will appear here." />
      ) : (
        people.map((p) => {
          const rel = relationFor.get(p.email) || 'none';
          const label =
            rel === 'friends' ? 'Friends' : rel === 'pending_out' ? 'Requested' : rel === 'pending_in' ? 'Accept above' : 'Follow';
          const disabled = rel !== 'none' || busyEmail === p.email;
          return (
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
              <Pressable
                onPress={() => follow(p)}
                disabled={disabled}
                style={[
                  styles.btn,
                  {
                    backgroundColor: rel === 'none' ? colors.primary : colors.secondary,
                    opacity: busyEmail === p.email ? 0.7 : 1,
                  },
                ]}
              >
                {busyEmail === p.email ? (
                  <ActivityIndicator color={rel === 'none' ? '#fff' : colors.foreground} />
                ) : (
                  <Text
                    style={{
                      color: rel === 'none' ? '#fff' : colors.foreground,
                      fontFamily: fonts.bodySemi,
                      fontSize: 12,
                    }}
                  >
                    {label}
                  </Text>
                )}
              </Pressable>
            </View>
          );
        })
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
  btn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, minWidth: 84, alignItems: 'center' },
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
