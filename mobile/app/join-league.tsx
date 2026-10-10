import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/ui/Button';
import { fonts, space } from '@/constants/theme';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/ThemeContext';

export default function JoinLeagueScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!code || !user) return;
    (async () => {
      setBusy(true);
      try {
        await api.leagues.joinByCode(String(code), user);
        setDone(true);
      } catch (e) {
        Alert.alert('Could not join', e instanceof Error ? e.message : 'Invalid code');
      } finally {
        setBusy(false);
      }
    })();
  }, [code, user]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.center}>
        {busy ? (
          <ActivityIndicator color={colors.accent} size="large" />
        ) : (
          <>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {done ? 'You joined the league!' : 'Join league'}
            </Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              Code: {(code || '—').toString().toUpperCase()}
            </Text>
            <Button label="Open Leagues" onPress={() => router.replace('/(tabs)/leagues')} style={{ marginTop: 20 }} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  title: { fontFamily: fonts.heading, fontSize: 24, textAlign: 'center' },
  sub: { fontFamily: fonts.bodyMed, fontSize: 15, marginTop: 8 },
});
