import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import SportBadge from '@/components/ui/SportBadge';
import { fonts } from '@/constants/theme';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/ThemeContext';
import type { Club, ClubEvent } from '@/types';

export default function ClubPortalScreen() {
  const { colors } = useTheme();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('06:00');

  useEffect(() => {
    api.clubs.list().then(setClubs);
  }, []);

  useEffect(() => {
    if (unlocked && selectedClub) {
      api.events.forClub(selectedClub.id).then(setEvents);
    }
  }, [unlocked, selectedClub]);

  const unlock = async () => {
    if (!selectedClub) return;
    const ok = await api.verifyClubPassword(selectedClub.id, password);
    if (!ok) {
      Alert.alert('Wrong password', 'Demo tip: use demo1234 for Run Club Beirut');
      return;
    }
    setUnlocked(true);
  };

  const createEvent = async () => {
    if (!selectedClub || !title.trim() || !date.trim()) {
      Alert.alert('Missing fields', 'Title and date (YYYY-MM-DD) are required');
      return;
    }
    try {
      const created = await api.events.create({
        club_id: selectedClub.id,
        club_name: selectedClub.name,
        title: title.trim(),
        sport: selectedClub.sport,
        date: date.trim(),
        time,
        meeting_point: 'TBD',
      });
      setEvents((prev) => [created, ...prev]);
      setTitle('');
      Alert.alert('Event published', `${created.title} is now live on LinkUp.`);
    } catch (e) {
      Alert.alert('Could not create event', e instanceof Error ? e.message : 'Try again');
    }
  };

  if (!unlocked) {
    return (
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.list}>
        <Text style={[styles.lead, { color: colors.mutedForeground }]}>
          Club owners unlock the portal with a secondary password. Athletes stay on the main app.
        </Text>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Select club</Text>
        {clubs.map((club) => {
          const on = selectedClub?.id === club.id;
          return (
            <Pressable
              key={club.id}
              onPress={() => setSelectedClub(club)}
              style={[
                styles.clubRow,
                {
                  backgroundColor: on ? `${colors.primary}22` : colors.card,
                  borderColor: on ? colors.primary : colors.border,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.clubName, { color: colors.foreground }]}>{club.name}</Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12 }}>
                  {club.city}
                </Text>
              </View>
              <SportBadge sport={club.sport} size="sm" />
            </Pressable>
          );
        })}

        <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 16 }]}>Portal password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Enter club password"
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
          ]}
        />
        <Pressable
          onPress={unlock}
          disabled={!selectedClub}
          style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: selectedClub ? 1 : 0.5 }]}
        >
          <Text style={styles.primaryText}>Unlock portal</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.list}>
      <Text style={[styles.title, { color: colors.foreground }]}>{selectedClub?.name} Portal</Text>
      <Text style={[styles.lead, { color: colors.mutedForeground }]}>
        Subscription: {selectedClub?.subscription_status} · Manage events below
      </Text>

      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.panelTitle, { color: colors.foreground }]}>Create event</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Event title"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
        />
        <TextInput
          value={date}
          onChangeText={setDate}
          placeholder="Date YYYY-MM-DD"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
        />
        <TextInput
          value={time}
          onChangeText={setTime}
          placeholder="Time"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { backgroundColor: colors.secondary, borderColor: colors.border, color: colors.foreground }]}
        />
        <Pressable onPress={createEvent} style={[styles.primaryBtn, { backgroundColor: colors.primary }]}>
          <Text style={styles.primaryText}>Publish event</Text>
        </Pressable>
      </View>

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Your events</Text>
      {events.map((ev) => (
        <View key={ev.id} style={[styles.eventRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.clubName, { color: colors.foreground }]}>{ev.title}</Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12 }}>
            {ev.date} · {ev.time}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40 },
  lead: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  clubRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clubName: { fontFamily: fonts.headingSemi, fontSize: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 12,
    marginBottom: 10,
    fontFamily: fonts.body,
  },
  primaryBtn: { height: 46, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryText: { color: '#fff', fontFamily: fonts.bodySemi },
  title: { fontFamily: fonts.heading, fontSize: 22, marginBottom: 6 },
  panel: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 20 },
  panelTitle: { fontFamily: fonts.headingSemi, fontSize: 16, marginBottom: 10 },
  eventRow: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
});
