import { type Href, useRouter } from 'expo-router';
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

import Button from '@/components/ui/Button';
import SportBadge from '@/components/ui/SportBadge';
import { fonts, radius } from '@/constants/theme';
import { api } from '@/lib/api';
import { generateCode } from '@/lib/scoring';
import { useTheme } from '@/lib/ThemeContext';
import type { Club, ClubEvent } from '@/types';

export default function ClubPortalScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('06:00');
  const [lastCode, setLastCode] = useState<string | null>(null);

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
    const attendance_password = generateCode('', 6);
    try {
      const created = await api.events.create({
        club_id: selectedClub.id,
        club_name: selectedClub.name,
        title: title.trim(),
        sport: selectedClub.sport,
        date: date.trim(),
        time,
        meeting_point: 'TBD',
        attendance_password,
      });
      setEvents((prev) => [created, ...prev]);
      setTitle('');
      setLastCode(attendance_password);
      Alert.alert(
        'Event published',
        `Share this completion code with attendees at the end of the event:\n\n${attendance_password}\n\nOnly you (the creator) see this code here.`,
      );
    } catch (e) {
      Alert.alert('Could not create event', e instanceof Error ? e.message : 'Try again');
    }
  };

  if (!unlocked) {
    return (
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.list}>
        <Text style={[styles.lead, { color: colors.mutedForeground }]}>
          Club owners unlock the portal with a secondary password. New clubs go through assessment first.
        </Text>

        <Button
          label="Register a new club"
          onPress={() => router.push('/create-club' as Href)}
          style={{ marginBottom: 18 }}
        />

        <Text style={[styles.label, { color: colors.mutedForeground }]}>Select existing club</Text>
        {clubs.map((club) => {
          const on = selectedClub?.id === club.id;
          return (
            <Pressable
              key={club.id}
              onPress={() => setSelectedClub(club)}
              style={[
                styles.clubRow,
                {
                  backgroundColor: on ? `${colors.accent}18` : colors.card,
                  borderColor: on ? colors.accent : colors.border,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.clubName, { color: colors.foreground }]}>{club.name}</Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12 }}>
                  {club.city}
                  {!club.is_verified ? ' · pending review' : ''}
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
        <Button label="Unlock portal" onPress={unlock} disabled={!selectedClub} variant="teal" />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.list}>
      <Text style={[styles.title, { color: colors.foreground }]}>{selectedClub?.name} Portal</Text>
      <Text style={[styles.lead, { color: colors.mutedForeground }]}>
        Subscription: {selectedClub?.subscription_status} · Each event gets a secret completion code
      </Text>

      {lastCode ? (
        <View style={[styles.codeBanner, { backgroundColor: colors.primary }]}>
          <Text style={styles.codeLabel}>Latest event code (creator only)</Text>
          <Text style={styles.codeValue}>{lastCode}</Text>
          <Text style={styles.codeHint}>Give this to attendees so they can mark the event complete.</Text>
        </View>
      ) : null}

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
        <Button label="Publish event" onPress={createEvent} />
      </View>

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Your events</Text>
      {events.map((ev) => (
        <View key={ev.id} style={[styles.eventRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.clubName, { color: colors.foreground }]}>{ev.title}</Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12 }}>
            {ev.date} · {ev.time}
          </Text>
          {ev.attendance_password ? (
            <Text style={{ color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 13, marginTop: 6 }}>
              Code: {ev.attendance_password}
            </Text>
          ) : null}
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
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clubName: { fontFamily: fonts.headingSemi, fontSize: 14 },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    height: 48,
    paddingHorizontal: 12,
    marginBottom: 10,
    fontFamily: fonts.body,
  },
  title: { fontFamily: fonts.heading, fontSize: 22, marginBottom: 6 },
  panel: { borderWidth: 1, borderRadius: radius.lg, padding: 14, marginBottom: 20 },
  panelTitle: { fontFamily: fonts.headingSemi, fontSize: 16, marginBottom: 10 },
  eventRow: { borderWidth: 1, borderRadius: radius.md, padding: 12, marginBottom: 8 },
  codeBanner: { borderRadius: radius.lg, padding: 16, marginBottom: 16 },
  codeLabel: { color: 'rgba(255,242,226,0.75)', fontFamily: fonts.bodyMed, fontSize: 12 },
  codeValue: { color: '#FFF2E2', fontFamily: fonts.heading, fontSize: 28, letterSpacing: 4, marginTop: 4 },
  codeHint: { color: 'rgba(255,242,226,0.7)', fontFamily: fonts.body, fontSize: 12, marginTop: 6 },
});
