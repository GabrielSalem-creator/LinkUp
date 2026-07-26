import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fonts, radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/ThemeContext';

const KEY = 'linkup.connections.v1';

type State = { strava: boolean; appleHealth: boolean };

export default function ConnectionsScreen() {
  const { colors } = useTheme();
  const [state, setState] = useState<State>({ strava: false, appleHealth: false });

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => {
      if (raw) {
        try {
          setState(JSON.parse(raw));
        } catch {
          /* ignore */
        }
      }
    });
  }, []);

  const toggle = async (key: keyof State) => {
    const next = { ...state, [key]: !state[key] };
    setState(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    Alert.alert(
      next[key] ? 'Connected (stub)' : 'Disconnected',
      key === 'strava'
        ? 'Strava OAuth will sync distance into leagues once credentials are added.'
        : 'Apple Health / HealthKit will sync walks & runs on native builds. Web remains limited.',
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
      <View style={styles.content}>
        <Text style={[styles.lead, { color: colors.mutedForeground }]}>
          Link wearables and training apps so league distance updates in near real time. These buttons are ready for API
          wiring — no live OAuth yet.
        </Text>

        <Pressable
          onPress={() => toggle('strava')}
          style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={[styles.icon, { backgroundColor: '#FC4C0222' }]}>
            <Ionicons name="bicycle-outline" size={22} color="#FC4C02" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.foreground }]}>Strava</Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12 }}>
              {state.strava ? 'Stub connected' : 'Connect to import runs & rides'}
            </Text>
          </View>
          <Text style={{ color: state.strava ? colors.aqua : colors.accent, fontFamily: fonts.bodySemi }}>
            {state.strava ? 'On' : 'Connect'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => toggle('appleHealth')}
          style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={[styles.icon, { backgroundColor: `${colors.accent}22` }]}>
            <Ionicons name="heart-outline" size={22} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.foreground }]}>Apple Health</Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12 }}>
              {state.appleHealth ? 'Stub connected' : 'Sync walking & running distance'}
            </Text>
          </View>
          <Text style={{ color: state.appleHealth ? colors.aqua : colors.accent, fontFamily: fonts.bodySemi }}>
            {state.appleHealth ? 'On' : 'Connect'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: space.lg, gap: 12 },
  lead: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 16,
  },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.headingSemi, fontSize: 16 },
});
