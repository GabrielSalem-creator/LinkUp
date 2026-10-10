import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/ui/Button';
import { SPORT_ORDER, fonts, radius, space, sportIcons } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/ThemeContext';
import type { Sport } from '@/types';

export default function CreateClubScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [sport, setSport] = useState<Sport>('running');
  const [city, setCity] = useState('Beirut');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [instagram, setInstagram] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user?.email) {
      Alert.alert('Sign in required');
      return;
    }
    if (!name.trim() || !city.trim() || !contactEmail.trim() || password.length < 4) {
      Alert.alert('Missing info', 'Name, city, contact email, and a portal password (4+ chars) are required.');
      return;
    }
    setBusy(true);
    try {
      const club = await api.clubs.create({
        name: name.trim(),
        sport,
        city: city.trim(),
        description: description.trim() || undefined,
        owner_email: user.email,
        contact_email: contactEmail.trim(),
        club_password: password,
        instagram_link: instagram.trim() || undefined,
      });
      router.replace({
        pathname: '/club-request-pending',
        params: { clubId: club.id, email: contactEmail.trim(), name: club.name },
      } as unknown as Href);
    } catch (e) {
      Alert.alert('Could not submit', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.lead, { color: colors.mutedForeground }]}>
            Tell us about your club. We review every request to keep LinkUp for real communities.
          </Text>

          <Text style={[styles.label, { color: colors.foreground }]}>Club name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Beirut Sunrise Runners"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          />

          <Text style={[styles.label, { color: colors.foreground }]}>Sport</Text>
          <View style={styles.chips}>
            {SPORT_ORDER.map((s) => {
              const on = sport === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => setSport(s as Sport)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: on ? colors.accent : colors.card,
                      borderColor: on ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={(sportIcons[s] || 'ellipse-outline') as keyof typeof Ionicons.glyphMap}
                    size={14}
                    color={on ? '#fff' : colors.primary}
                  />
                  <Text style={{ color: on ? '#fff' : colors.foreground, fontFamily: fonts.bodyMed, fontSize: 12 }}>
                    {s}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: colors.foreground }]}>Location</Text>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="City"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          />

          <Text style={[styles.label, { color: colors.foreground }]}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What is your club about?"
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[
              styles.input,
              styles.area,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
            ]}
          />

          <Text style={[styles.label, { color: colors.foreground }]}>Contact email</Text>
          <TextInput
            value={contactEmail}
            onChangeText={setContactEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="We'll reach you here"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          />

          <Text style={[styles.label, { color: colors.foreground }]}>Instagram (optional)</Text>
          <TextInput
            value={instagram}
            onChangeText={setInstagram}
            autoCapitalize="none"
            placeholder="@yourclub"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          />

          <Text style={[styles.label, { color: colors.foreground }]}>Club portal password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="For managing events later"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          />

          <Button label="Submit club request" onPress={submit} loading={busy} style={{ marginTop: 12 }} />
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: space.lg },
  lead: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, marginBottom: 18 },
  label: { fontFamily: fonts.bodySemi, fontSize: 13, marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    height: 50,
    paddingHorizontal: 14,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  area: { height: 96, paddingTop: 12, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
