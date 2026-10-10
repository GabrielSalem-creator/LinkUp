import { Ionicons } from '@expo/vector-icons';
import { type Href, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import StatusPill from '@/components/competition/StatusPill';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { SkeletonCard } from '@/components/ui/Skeleton';
import Countdown from '@/components/ticketing/Countdown';
import { fonts, radius } from '@/constants/theme';
import { ticketingApi, type OrderDetail } from '@/lib/competitionApi';
import { ApiError } from '@/lib/serverApi';
import { formatMoney, isOrderPayable, type OrderState } from '@/lib/ticketing';
import { useTheme } from '@/lib/ThemeContext';

export function orderStateMeta(state: OrderState): { label: string; tone: 'neutral' | 'live' | 'success' | 'warning' | 'danger' | 'info'; desc: string } {
  switch (state) {
    case 'awaiting_checkout':
      return { label: 'Awaiting checkout', tone: 'info', desc: 'Your seats are held. Complete payment before the hold expires.' };
    case 'pending':
      return { label: 'Payment pending', tone: 'warning', desc: 'We are waiting for the payment provider to confirm. This can take a moment.' };
    case 'paid':
      return { label: 'Paid', tone: 'success', desc: 'Payment confirmed. Your tickets are ready.' };
    case 'failed':
      return { label: 'Payment failed', tone: 'danger', desc: 'The payment did not go through. You can try again while your seats are held.' };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'neutral', desc: 'This order was cancelled and the seats were released.' };
    case 'expired':
      return { label: 'Expired', tone: 'neutral', desc: 'The seat hold ran out before payment. Start a new booking.' };
    case 'cancellation_requested':
      return { label: 'Cancellation requested', tone: 'warning', desc: 'We received your request. Refunds are handled manually until the refund policy is approved.' };
    case 'refund_pending':
      return { label: 'Refund pending', tone: 'warning', desc: 'A refund is being processed.' };
    case 'partially_refunded':
      return { label: 'Partially refunded', tone: 'info', desc: 'Part of this order has been refunded.' };
    case 'refunded':
      return { label: 'Refunded', tone: 'neutral', desc: 'This order was refunded. Tickets are no longer valid.' };
    case 'refund_failed':
      return { label: 'Refund failed', tone: 'danger', desc: 'The refund could not be completed. We will contact you.' };
    default:
      return { label: state, tone: 'neutral', desc: '' };
  }
}

export default function OrderScreen() {
  const { orderId, checkout, attempt, repriced } = useLocalSearchParams<{ orderId: string; checkout?: string; attempt?: string; repriced?: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const [data, setData] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'error' | 'info' | 'warning' | 'success'; message: string; title?: string } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const syncedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    setError(null);
    try {
      setData(await ticketingApi.order(orderId));
    } catch (e) {
      const err = e as ApiError;
      setError(err.status === 403 ? 'This order belongs to another account.' : err.status === 404 ? 'Order not found.' : err.message);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  // Return-from-checkout: a redirect is not proof of payment, so ask the server to query the provider.
  useEffect(() => {
    if (!data || syncedOnce.current) return;
    if (data.order.state === 'pending' && !checkout) {
      syncedOnce.current = true;
      ticketingApi
        .sync(orderId!)
        .then(() => load())
        .catch(() => undefined);
    }
  }, [data, checkout, orderId, load]);

  // Poll while pending
  useEffect(() => {
    if (data?.order.state !== 'pending') return;
    const t = setInterval(() => load(), 5000);
    return () => clearInterval(t);
  }, [data?.order.state, load]);

  const run = async (key: string, fn: () => Promise<unknown>, after?: (r: unknown) => void) => {
    setBusy(key);
    setNotice(null);
    try {
      const r = await fn();
      after?.(r);
      await load();
    } catch (e) {
      const err = e as ApiError;
      const title = err.code === 'checkout_unavailable' ? 'Checkout unavailable' : err.code === 'order_expired' ? 'Order expired' : err.code === 'payment_pending' ? 'Payment in progress' : 'Could not complete';
      setNotice({ tone: err.code === 'checkout_unavailable' ? 'info' : 'error', title, message: err.message });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const startCheckout = () =>
    run(
      'checkout',
      () => ticketingApi.checkout(orderId!, Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/booking/${orderId}` : `linkup://booking/${orderId}`),
      (r) => {
        const res = r as { checkout_url: string; attempt_id: string; test_mode: boolean };
        if (res.test_mode) {
          router.setParams({ checkout: 'fake', attempt: res.attempt_id });
        } else if (res.checkout_url) {
          Linking.openURL(res.checkout_url).catch(() => setNotice({ tone: 'error', message: 'Could not open the payment page.' }));
        }
      },
    );

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Order' }} />
        <Notice tone="error" title="Order unavailable" message={error} actionLabel="Retry" onAction={load} />
        <Button label="My tickets" variant="ghost" onPress={() => router.replace('/tickets' as Href)} />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
        <Stack.Screen options={{ title: 'Order' }} />
        <SkeletonCard />
        <SkeletonCard />
      </View>
    );
  }

  const { order, items, tickets, deliveries, checkout: co } = data;
  const meta = orderStateMeta(order.state);
  const payable = isOrderPayable(order.state);
  const showFake = checkout === 'fake' && attempt && order.state === 'pending';
  const currency = order.currency;

  return (
    <>
      <Stack.Screen options={{ title: 'Your order' }} />
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {repriced ? <Notice tone="info" message="The price was updated before this order was created. The total below is the confirmed amount." /> : null}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.headRow}>
            <StatusPill label={meta.label} tone={meta.tone} />
            {order.expires_at && (payable || order.state === 'pending') ? <Countdown until={order.expires_at} prefix={order.state === 'pending' ? 'Payment window' : 'Seats held for'} onExpire={load} /> : null}
          </View>
          <Text style={[styles.desc, { color: colors.mutedForeground }]} accessibilityLiveRegion="polite">
            {meta.desc}
          </Text>
          <Text style={[styles.orderId, { color: colors.mutedForeground }]}>Order {order.id}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Summary</Text>
          {items.map((it) => (
            <View key={it.id} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemName, { color: colors.foreground }]}>{it.description}</Text>
                <Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>
                  {it.section_name}
                  {it.seat_label ? ` · Seat ${it.seat_label}` : ''}
                </Text>
              </View>
              <Text style={[styles.itemPrice, { color: colors.foreground }]}>{formatMoney(it.unit_price_minor + it.fee_minor, currency)}</Text>
            </View>
          ))}
          <View style={[styles.totals, { borderTopColor: colors.border }]}>
            <Row label="Subtotal" value={formatMoney(order.subtotal_minor, currency)} color={colors.mutedForeground} />
            <Row label="Fees" value={formatMoney(order.fees_minor, currency)} color={colors.mutedForeground} />
            <Row label="Total" value={formatMoney(order.total_minor, currency)} color={colors.foreground} bold />
          </View>
        </View>

        {notice ? <Notice tone={notice.tone} title={notice.title} message={notice.message} live /> : null}

        {showFake ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.accent }]}>
            <View style={styles.headRow}>
              <StatusPill label="TEST MODE · no real payment" tone="warning" icon="flask-outline" />
            </View>
            <Text style={[styles.desc, { color: colors.mutedForeground }]}>This simulates the hosted checkout of a payment provider. No card details are collected. Choose an outcome:</Text>
            <View style={styles.fakeRow}>
              {(['success', 'decline', 'cancel', 'pending'] as const).map((o) => (
                <Button
                  key={o}
                  label={o === 'success' ? 'Pay (success)' : o === 'decline' ? 'Decline' : o === 'cancel' ? 'Cancel at provider' : 'Leave pending'}
                  icon={o === 'success' ? 'checkmark-circle-outline' : o === 'decline' ? 'close-circle-outline' : o === 'cancel' ? 'arrow-undo-outline' : 'hourglass-outline'}
                  variant={o === 'success' ? 'primary' : o === 'decline' ? 'danger' : o === 'cancel' ? 'secondary' : 'ghost'}
                  size="sm"
                  style={styles.fakeBtn}
                  loading={busy === `fake-${o}`}
                  disabled={Boolean(busy)}
                  onPress={() =>
                    run(`fake-${o}`, () => ticketingApi.fakeComplete(attempt!, o), () => {
                      router.setParams({ checkout: '', attempt: '' });
                    })
                  }
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.actions}>
          {payable ? (
            co.enabled ? (
              <Button label={order.state === 'failed' ? 'Try payment again' : 'Pay now'} icon="card-outline" size="lg" onPress={startCheckout} loading={busy === 'checkout'} disabled={Boolean(busy)} />
            ) : (
              <Notice tone="info" title="Checkout unavailable" message="Online payment is not enabled yet. Your order is saved and your seats stay held until the timer ends." />
            )
          ) : null}
          {order.state === 'pending' ? <Button label="Check payment status" icon="refresh-outline" variant="secondary" onPress={() => run('sync', () => ticketingApi.sync(orderId!))} loading={busy === 'sync'} disabled={Boolean(busy)} /> : null}
          {order.state === 'paid' && tickets.length ? <Button label={`View ${tickets.length} ticket${tickets.length === 1 ? '' : 's'}`} icon="ticket-outline" size="lg" variant="teal" onPress={() => router.push('/tickets' as Href)} /> : null}
          {['awaiting_checkout', 'pending', 'failed', 'paid'].includes(order.state) ? (
            confirmCancel ? (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.destructive }]}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>{order.state === 'paid' ? 'Request cancellation?' : 'Cancel this order?'}</Text>
                <Text style={[styles.desc, { color: colors.mutedForeground }]}>{order.state === 'paid' ? 'Automated refunds are not enabled yet. Your request will be reviewed manually.' : 'Your held seats will be released immediately.'}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button label="Keep order" variant="ghost" style={{ flex: 1 }} onPress={() => setConfirmCancel(false)} />
                  <Button label="Confirm" variant="danger" style={{ flex: 1 }} loading={busy === 'cancel'} onPress={() => run('cancel', () => ticketingApi.cancel(orderId!), () => setConfirmCancel(false))} />
                </View>
              </View>
            ) : (
              <Button label={order.state === 'paid' ? 'Request cancellation' : 'Cancel order'} variant="ghost" onPress={() => setConfirmCancel(true)} disabled={Boolean(busy)} />
            )
          ) : null}
        </View>

        {deliveries.length ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Email delivery</Text>
            {deliveries.map((d) => (
              <View key={d.id} style={styles.deliveryRow}>
                <Ionicons name={d.state === 'sent' ? 'mail-open-outline' : d.state === 'failed' ? 'alert-circle-outline' : 'time-outline'} size={16} color={d.state === 'sent' ? colors.success : d.state === 'failed' ? colors.destructive : colors.mutedForeground} />
                <Text style={[styles.itemMeta, { color: colors.foreground, flex: 1 }]}>
                  {d.state === 'sent' ? `Sent to ${d.to}` : d.state === 'failed' ? `Delivery failed (${d.attempts} attempts)` : `Queued for ${d.to}${d.last_error ? ' · waiting for email service' : ''}`}
                </Text>
                {d.state !== 'sent' ? (
                  <Pressable onPress={() => run('retry', () => ticketingApi.retryDelivery(d.id))} accessibilityRole="button" style={styles.retry}>
                    <Text style={{ fontFamily: fonts.bodySemi, fontSize: 12, color: colors.primary }}>Retry</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
            <Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>Your tickets are always available in the app, even if the email is delayed.</Text>
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

function Row({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={{ fontFamily: bold ? fonts.bodySemi : fonts.body, fontSize: 13, color }}>{label}</Text>
      <Text style={{ fontFamily: bold ? fonts.heading : fonts.bodyMed, fontSize: bold ? 18 : 13, color }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, padding: 16, justifyContent: 'center', gap: 10 },
  body: { padding: 16, gap: 12, paddingBottom: 40 },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 14, gap: 10 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  desc: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  orderId: { fontFamily: fonts.body, fontSize: 11 },
  cardTitle: { fontFamily: fonts.headingSemi, fontSize: 16 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemName: { fontFamily: fonts.bodySemi, fontSize: 13 },
  itemMeta: { fontFamily: fonts.body, fontSize: 12 },
  itemPrice: { fontFamily: fonts.bodyMed, fontSize: 13 },
  totals: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { gap: 10 },
  fakeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fakeBtn: { width: '48%', maxWidth: 240 },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  retry: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 8 },
});
