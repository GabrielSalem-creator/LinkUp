import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { type Href, Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import StatusPill from '@/components/competition/StatusPill';
import EmptyState from '@/components/ui/EmptyState';
import Notice from '@/components/ui/Notice';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { fonts, radius } from '@/constants/theme';
import type { Match } from '@/lib/competition';
import { competitionApi, ticketingApi } from '@/lib/competitionApi';
import { orderStateMeta } from '@/app/booking/[orderId]';
import type { Order, Ticket, TicketState } from '@/lib/ticketing';
import { formatMoney } from '@/lib/ticketing';
import { useTheme } from '@/lib/ThemeContext';

export function ticketStateMeta(state: TicketState): { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info' } {
  switch (state) {
    case 'active':
      return { label: 'Active', tone: 'success' };
    case 'used':
      return { label: 'Used', tone: 'neutral' };
    case 'issuing':
      return { label: 'Issuing', tone: 'info' };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'danger' };
    case 'refund_pending':
      return { label: 'Refund pending', tone: 'warning' };
    case 'refunded':
      return { label: 'Refunded', tone: 'neutral' };
    default:
      return { label: state, tone: 'neutral' };
  }
}

export default function TicketsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [matches, setMatches] = useState<Record<string, Match>>({});
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [t, o] = await Promise.all([ticketingApi.tickets(), ticketingApi.orders()]);
      setTickets(t);
      setOrders(o);
      const ids = [...new Set([...t.map((x) => x.match_id), ...o.map((x) => x.match_id)])];
      const ms = await Promise.all(ids.map((id) => competitionApi.match(id)));
      setMatches(Object.fromEntries(ms.filter(Boolean).map((m) => [m!.id, m!])));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load tickets');
      setTickets((t) => t ?? []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openOrders = orders.filter((o) => !['paid', 'cancelled', 'expired', 'refunded'].includes(o.state));

  return (
    <>
      <Stack.Screen options={{ title: 'My tickets' }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.accent}
          />
        }
      >
        {error ? <Notice tone="error" message={error} actionLabel="Retry" onAction={load} /> : null}
        {tickets == null ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            {openOrders.length ? (
              <View style={{ marginBottom: 8 }}>
                <Text style={[styles.h, { color: colors.foreground }]}>Open orders</Text>
                {openOrders.map((o) => {
                  const m = matches[o.match_id];
                  const meta = orderStateMeta(o.state);
                  return (
                    <Pressable key={o.id} onPress={() => router.push(`/booking/${o.id}` as Href)} accessibilityRole="button" style={[styles.orderRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={[styles.title, { color: colors.foreground }]}>{m ? `${format(parseISO(m.kickoff_at), 'd MMM')} · ${m.round_label ?? 'Match'}` : 'Match'}</Text>
                        <StatusPill label={meta.label} tone={meta.tone} small />
                      </View>
                      <Text style={[styles.price, { color: colors.primary }]}>{formatMoney(o.total_minor, o.currency)}</Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            <Text style={[styles.h, { color: colors.foreground }]}>Tickets</Text>
            {tickets.length === 0 ? (
              <EmptyState icon="ticket-outline" title="No tickets yet" description="Tickets you buy for competition matches appear here, with a QR code for entry." />
            ) : (
              tickets.map((t) => {
                const m = matches[t.match_id];
                const meta = ticketStateMeta(t.state);
                return (
                  <Pressable key={t.id} onPress={() => router.push(`/tickets/${t.id}` as Href)} accessibilityRole="button" accessibilityLabel={`Ticket ${t.section_name}${t.seat_label ? ` seat ${t.seat_label}` : ''}, ${meta.label}`} style={[styles.ticket, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.stub, { backgroundColor: colors.primary }]}>
                      <Ionicons name="ticket" size={22} color={colors.primaryForeground} />
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={[styles.title, { color: colors.foreground }]}>{m ? `${m.round_label ?? 'Match'} · ${format(parseISO(m.kickoff_at), 'EEE d MMM, HH:mm')}` : 'Match'}</Text>
                      <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                        {t.section_name}
                        {t.seat_label ? ` · Seat ${t.seat_label}` : ' · General admission'}
                      </Text>
                      <StatusPill label={meta.label} tone={meta.tone} small />
                    </View>
                    <Ionicons name="qr-code-outline" size={22} color={colors.mutedForeground} />
                  </Pressable>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 40 },
  h: { fontFamily: fonts.headingSemi, fontSize: 16, marginBottom: 10 },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, marginBottom: 8 },
  ticket: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, borderWidth: 1, marginBottom: 10 },
  stub: { width: 44, height: 56, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.bodySemi, fontSize: 13 },
  meta: { fontFamily: fonts.body, fontSize: 12 },
  price: { fontFamily: fonts.headingSemi, fontSize: 14 },
});
