import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/ui/Button';
import { CLUB_SUBSCRIPTION_USD, fonts, radius, space } from '@/constants/theme';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/ThemeContext';

export default function ClubRequestPendingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ clubId?: string; email?: string; name?: string }>();
  const [paying, setPaying] = useState(false);
  const email = params.email || 'your email';
  const clubName = params.name || 'your club';

  const payWhish = async () => {
    setPaying(true);
    try {
      if (params.clubId) {
        await api.clubs.markPaymentIntent(params.clubId);
      }
      Alert.alert(
        CLUB_SUBSCRIPTION_USD === 0 ? 'MVP — free trial' : 'Whish',
        CLUB_SUBSCRIPTION_USD === 0
          ? 'No charge during MVP. We recorded your subscription intent. Live Whish payment will be wired later.'
          : `Whish checkout for $${CLUB_SUBSCRIPTION_USD}/mo will open here once merchant credentials are connected.`,
      );
    } catch (e) {
      Alert.alert('Could not record payment', e instanceof Error ? e.message : 'Try again');
    } finally {
      setPaying(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: `${colors.aqua}33` }]}>
          <Ionicons name="time-outline" size={36} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Request under assessment</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          Thanks for applying to open <Text style={{ fontFamily: fonts.bodySemi, color: colors.foreground }}>{clubName}</Text>{' '}
          on LinkUp. We will contact you shortly at{' '}
          <Text style={{ fontFamily: fonts.bodySemi, color: colors.foreground }}>{email}</Text>.
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.primary }]}>Keeping LinkUp legit</Text>
          <Text style={[styles.body, { color: colors.mutedForeground, marginTop: 8 }]}>
            To protect the integrity of the app, we schedule a short meeting with the people involved in this club and ask a
            few questions. After that review, we grant access so you can manage events in Club Portal.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.primary }]}>
          <Text style={styles.payTitle}>Club subscription</Text>
          <Text style={styles.payPrice}>
            {CLUB_SUBSCRIPTION_USD === 0 ? '$0 / month · MVP' : `$${CLUB_SUBSCRIPTION_USD} / month`}
          </Text>
          <Text style={styles.paySub}>
            Monthly club plan via Whish. Free during launch so real clubs can try the product.
          </Text>
          <Button
            label={CLUB_SUBSCRIPTION_USD === 0 ? 'Confirm with Whish (free)' : 'Pay with Whish'}
            onPress={payWhish}
            loading={paying}
            style={{ marginTop: 14, backgroundColor: colors.accent, borderColor: colors.accent }}
          />
        </View>

        <Button label="Back to Clubs" variant="ghost" onPress={() => router.replace('/(tabs)/my-clubs')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, padding: space.xl, justifyContent: 'center', gap: 14 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 4,
  },
  title: { fontFamily: fonts.heading, fontSize: 26, textAlign: 'center', letterSpacing: -0.4 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 18 },
  cardTitle: { fontFamily: fonts.headingSemi, fontSize: 16 },
  payTitle: { color: '#FFF2E2', fontFamily: fonts.bodyMed, fontSize: 13 },
  payPrice: { color: '#fff', fontFamily: fonts.heading, fontSize: 28, marginTop: 4 },
  paySub: { color: 'rgba(255,242,226,0.75)', fontFamily: fonts.body, fontSize: 13, marginTop: 6, lineHeight: 19 },
});
