import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { type Href, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import StatusPill from '@/components/competition/StatusPill';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import QrCode from '@/components/ticketing/QrCode';
import { fonts, radius } from '@/constants/theme';
import type { CompetitionTeam, Venue } from '@/lib/competition';
import { competitionApi, ticketingApi, type TicketDetail } from '@/lib/competitionApi';
import { ApiError } from '@/lib/serverApi';
import { formatMoney } from '@/lib/ticketing';
import { ticketStateMeta } from '@/app/tickets/index';
import { useTheme } from '@/lib/ThemeContext';

export default function TicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const [data, setData] = useState<TicketDetail | null>(null);
  const [teams, setTeams] = useState<{ home: CompetitionTeam | null; away: CompetitionTeam | null; venue: Venue | null }>({ home: null, away: null, venue: null });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const d = await ticketingApi.ticket(id);
      setData(d);
      if (d.match) {
        const [home, away, venue] = await Promise.all([competitionApi.team(d.match.home_team_id), competitionApi.team(d.match.away_team_id), d.match.venue_id ? competitionApi.venue(d.match.venue_id) : null]);
        setTeams({ home, away, venue });
      }
    } catch (e) {
      const err = e as ApiError;
      setError(err.status === 403 ? 'This ticket belongs to another account.' : err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Ticket' }} />
        <Notice tone="error" title="Ticket unavailable" message={error} actionLabel="Retry" onAction={load} />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 16, gap: 12 }}>
        <Stack.Screen options={{ title: 'Ticket' }} />
        <SkeletonBlock height={240} />
        <SkeletonBlock height={80} />
      </View>
    );
  }

  const { ticket, credential, match, order, delivery } = data;
  const meta = ticketStateMeta(ticket.state);
  const kickoff = match ? parseISO(match.kickoff_at) : null;

  return (
    <>
      <Stack.Screen options={{ title: 'Ticket' }} />
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.top, { backgroundColor: colors.primary }]}>
            <Text style={styles.topLabel}>LinkUp · Match ticket</Text>
            <Text style={styles.topTitle}>
              {teams.home?.name ?? 'Home'} vs {teams.away?.name ?? 'Away'}
            </Text>
            <Text style={styles.topMeta}>{kickoff ? `${format(kickoff, 'EEEE d MMMM yyyy')} · ${format(kickoff, 'HH:mm')}` : ''}</Text>
            <Text style={styles.topMeta}>{teams.venue ? `${teams.venue.name}, ${teams.venue.city}` : match?.round_label ?? ''}</Text>
          </View>
          <View style={styles.perforation}>
            <View style={[styles.notch, { backgroundColor: colors.background, left: -12 }]} />
            <View style={[styles.dash, { borderColor: colors.border }]} />
            <View style={[styles.notch, { backgroundColor: colors.background, right: -12 }]} />
          </View>
          <View style={styles.mid}>
            <View style={styles.statusRow}>
              <StatusPill label={meta.label} tone={meta.tone} />
              {ticket.used_at ? <Text style={[styles.small, { color: colors.mutedForeground }]}>Scanned {format(parseISO(ticket.used_at), 'd MMM HH:mm')}</Text> : null}
            </View>
            {credential ? (
              <View style={{ alignItems: 'center', gap: 8 }}>
                <QrCode value={credential} size={230} />
                <Text style={[styles.small, { color: colors.mutedForeground }]}>Show this code at the entrance. It contains no personal data.</Text>
              </View>
            ) : (
              <Notice tone={ticket.state === 'used' ? 'info' : 'warning'} message={ticket.state === 'used' ? 'This ticket has already been used.' : `This ticket is ${meta.label.toLowerCase()} and cannot be scanned.`} />
            )}
            <View style={styles.grid}>
              <Field label="Section" value={ticket.section_name} color={colors} />
              <Field label="Seat" value={ticket.seat_label ?? 'General admission'} color={colors} />
              <Field label="Ticket ID" value={ticket.id} color={colors} mono />
              <Field label="Issued" value={format(parseISO(ticket.issued_at), 'd MMM yyyy HH:mm')} color={colors} />
              {order ? <Field label="Order" value={`${order.id.slice(0, 12)}… · ${formatMoney(order.total_minor, order.currency)}`} color={colors} /> : null}
            </View>
          </View>
        </View>

        <View style={[styles.deliveryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name={delivery?.state === 'sent' ? 'mail-open-outline' : 'mail-outline'} size={18} color={delivery?.state === 'sent' ? colors.success : colors.mutedForeground} />
          <Text style={[styles.small, { color: colors.foreground, flex: 1 }]}>
            {!delivery ? 'Email copy not requested.' : delivery.state === 'sent' ? `Email copy sent to ${delivery.to}.` : delivery.state === 'failed' ? 'Email delivery failed. Your in-app ticket stays valid.' : `Email copy queued for ${delivery.to}.`}
          </Text>
          {delivery && delivery.state !== 'sent' ? (
            <Button
              label="Retry"
              size="sm"
              variant="secondary"
              style={{ width: 90, maxWidth: 90 }}
              loading={busy}
              onPress={async () => {
                setBusy(true);
                try {
                  await ticketingApi.retryDelivery(delivery.id);
                  await load();
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : null}
        </View>
        <Button label="All my tickets" variant="ghost" onPress={() => router.replace('/tickets' as Href)} />
      </ScrollView>
    </>
  );
}

function Field({ label, value, color, mono }: { label: string; value: string; color: { mutedForeground: string; foreground: string }; mono?: boolean }) {
  return (
    <View style={styles.field} accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.fieldLabel, { color: color.mutedForeground }]}>{label}</Text>
      <Text style={[styles.fieldValue, { color: color.foreground }, mono && { fontSize: 11 }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, padding: 16, justifyContent: 'center' },
  body: { padding: 16, gap: 12, paddingBottom: 40 },
  card: { borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  top: { padding: 18, gap: 4 },
  topLabel: { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.bodySemi, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 },
  topTitle: { color: '#fff', fontFamily: fonts.heading, fontSize: 20, lineHeight: 26 },
  topMeta: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.body, fontSize: 13 },
  perforation: { flexDirection: 'row', alignItems: 'center', height: 24, overflow: 'visible' },
  notch: { position: 'absolute', width: 24, height: 24, borderRadius: 12, top: 0 },
  dash: { flex: 1, marginHorizontal: 20, borderTopWidth: 1, borderStyle: 'dashed' },
  mid: { padding: 18, gap: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  small: { fontFamily: fonts.body, fontSize: 12, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  field: { width: '47%', gap: 2 },
  fieldLabel: { fontFamily: fonts.bodySemi, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
  fieldValue: { fontFamily: fonts.bodyMed, fontSize: 13 },
  deliveryCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1 },
});
