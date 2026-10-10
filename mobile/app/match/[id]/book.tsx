import { Ionicons } from '@expo/vector-icons';
import { type Href, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import SegmentedTabs from '@/components/competition/SegmentedTabs';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { SkeletonBlock, SkeletonCard } from '@/components/ui/Skeleton';
import Countdown from '@/components/ticketing/Countdown';
import QuantityStepper from '@/components/ticketing/QuantityStepper';
import { SeatGrid, SeatList, SectionMap } from '@/components/ticketing/VenueMap';
import { fonts, radius } from '@/constants/theme';
import type { Competition, CompetitionTeam, Match } from '@/lib/competition';
import { competitionApi, ticketingApi, type Availability, type AvailabilityOffer } from '@/lib/competitionApi';
import { ApiError } from '@/lib/serverApi';
import { formatMoney, type TicketHold, type VenueSeat } from '@/lib/ticketing';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';

function newIdempotencyKey() {
  return `ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [match, setMatch] = useState<Match | null>(null);
  const [teams, setTeams] = useState<{ home: CompetitionTeam | null; away: CompetitionTeam | null }>({ home: null, away: null });
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AvailabilityOffer | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [seats, setSeats] = useState<VenueSeat[] | null>(null);
  const [seatIds, setSeatIds] = useState<Set<string>>(new Set());
  const [seatView, setSeatView] = useState<'map' | 'list'>('map');
  const [hold, setHold] = useState<TicketHold | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<{ message: string; code?: string } | null>(null);
  const [repriced, setRepriced] = useState<{ from: number; to: number; key: string } | null>(null);
  const [mapWidth, setMapWidth] = useState(0);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const m = await competitionApi.match(id);
      if (!m) throw new Error('Match not found');
      setMatch(m);
      const [home, away, cmp, av] = await Promise.all([competitionApi.team(m.home_team_id), competitionApi.team(m.away_team_id), competitionApi.competition(m.competition_id), ticketingApi.availability(id)]);
      setTeams({ home, away });
      setCompetition(cmp);
      setAvailability(av);
      // restore my active hold (e.g. after a reload)
      const mineOffer = av.offers.find((o) => o.mine && o.mine.length);
      if (mineOffer && !selected) setSelected(mineOffer);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load ticket availability');
    } finally {
      setLoading(false);
    }
  }, [id, selected]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!selected || selected.kind !== 'assigned') {
      setSeats(null);
      return;
    }
    let alive = true;
    setSeats(null);
    competitionApi
      .seats(selected.section_id)
      .then((s) => alive && setSeats(s))
      .catch(() => alive && setSeats([]));
    setSeatIds(new Set(selected.mine ?? []));
    return () => {
      alive = false;
    };
  }, [selected]);

  const unavailable = useMemo(() => new Set(selected?.unavailable_units ?? []), [selected]);
  const mine = useMemo(() => new Set(selected?.mine ?? []), [selected]);
  const unitPrice = selected ? selected.price_minor + selected.fee_minor : 0;
  const count = selected?.kind === 'assigned' ? seatIds.size : quantity;
  const total = unitPrice * count;
  // the web shell caps content at 480px, so only native tablets get the two-column layout
  const wide = Platform.OS !== 'web' && width >= 700;

  const toggleSeat = (seat: VenueSeat) => {
    setSeatIds((prev) => {
      const next = new Set(prev);
      if (next.has(seat.id)) next.delete(seat.id);
      else if (selected && next.size < selected.max_per_order) next.add(seat.id);
      return next;
    });
  };

  const selectOffer = (o: AvailabilityOffer) => {
    setSelected(o);
    setQuantity(Math.min(1, o.available) || 1);
    setActionError(null);
    setHold(null);
  };

  const reserve = async () => {
    if (!selected || !match) return;
    setBusy(true);
    setActionError(null);
    try {
      const h = await ticketingApi.createHold(selected.kind === 'assigned' ? { matchId: match.id, offerId: selected.id, unitKeys: [...seatIds] } : { matchId: match.id, offerId: selected.id, quantity });
      setHold(h);
    } catch (e) {
      const err = e as ApiError;
      setActionError({ message: err.message, code: err.code });
      // refresh availability so lost seats / counts update
      try {
        const av = await ticketingApi.availability(match.id);
        setAvailability(av);
        const fresh = av.offers.find((o) => o.id === selected.id);
        if (fresh) setSelected(fresh);
      } catch {
        /* keep previous */
      }
    } finally {
      setBusy(false);
    }
  };

  const releaseHold = async () => {
    if (!hold) return;
    setBusy(true);
    try {
      await ticketingApi.cancelHold(hold.id);
    } catch {
      /* ignore */
    }
    setHold(null);
    setBusy(false);
    load();
  };

  const continueToOrder = async (acceptRepricing = false) => {
    if (!hold) return;
    setBusy(true);
    setActionError(null);
    const key = repriced?.key ?? newIdempotencyKey();
    try {
      const res = await ticketingApi.createOrder({ holdId: hold.id, idempotencyKey: key, acceptRepricing });
      router.replace(`/booking/${res.order.id}${res.repriced ? '?repriced=1' : ''}` as Href);
    } catch (e) {
      const err = e as ApiError;
      if (err.code === 'repriced') {
        const m = /changed to (\d+)/.exec(err.message);
        setRepriced({ from: hold.unit_price_minor + hold.fee_minor, to: m ? Number(m[1]) : unitPrice, key });
      } else if (err.code === 'hold_expired' || err.code === 'hold_inactive') {
        setHold(null);
        setActionError({ message: err.message, code: err.code });
        load();
      } else {
        setActionError({ message: err.message, code: err.code });
      }
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Tickets' }} />
        <Notice tone="info" title="Sign in required" message="Log in with an email account to buy tickets." />
      </View>
    );
  }
  if (loading && !availability) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 16, gap: 12 }}>
        <Stack.Screen options={{ title: 'Tickets' }} />
        <SkeletonBlock height={300} />
        <SkeletonCard />
        <SkeletonCard />
      </View>
    );
  }
  if (error || !availability || !match) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Tickets' }} />
        <Notice tone="error" title="Could not load tickets" message={error ?? 'Try again'} actionLabel="Retry" onAction={load} />
      </View>
    );
  }

  const status = availability.status.status;
  const blocked = ['sold_out', 'sales_closed', 'not_on_sale', 'unavailable'].includes(status) && !availability.offers.some((o) => o.sellable && o.available > 0);
  const lowStock = selected && selected.available > 0 && selected.available <= 10;
  const errorTone = actionError?.code === 'seat_unavailable' || actionError?.code === 'insufficient_inventory' ? 'warning' : 'error';
  const errorTitle =
    actionError?.code === 'seat_unavailable'
      ? 'Seat no longer available'
      : actionError?.code === 'insufficient_inventory'
        ? 'Not enough tickets left'
        : actionError?.code === 'hold_expired'
          ? 'Hold expired'
          : actionError?.code === 'network'
            ? 'Connection problem'
            : actionError?.code === 'unauthenticated' || actionError?.code === 'forbidden' || actionError?.code === 'email_required'
              ? 'Permission needed'
              : 'Something went wrong';

  return (
    <>
      <Stack.Screen options={{ title: 'Choose tickets' }} />
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={[styles.matchTitle, { color: colors.foreground }]}>
          {teams.home?.name ?? 'Home'} <Text style={{ color: colors.mutedForeground }}>vs</Text> {teams.away?.name ?? 'Away'}
        </Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>Pick a section on the map or from the list. Prices include fees.</Text>

        {blocked ? (
          <Notice tone="info" title={status === 'sold_out' ? 'Sold out' : status === 'not_on_sale' ? 'Not on sale yet' : status === 'sales_closed' ? 'Sales closed' : 'No inventory'} message="There is nothing to book for this match right now." />
        ) : null}

        <View style={[styles.layout, wide && styles.layoutWide]}>
          <View style={wide ? { flex: 1 } : undefined} onLayout={(e) => setMapWidth(e.nativeEvent.layout.width)}>
            <SectionMap offers={availability.offers} selectedId={selected?.id} onSelect={selectOffer} sport={competition?.sport} width={mapWidth} />
            <View style={{ gap: 8, marginTop: 12 }} accessibilityRole="list">
              {availability.offers.map((o) => {
                const on = o.id === selected?.id;
                const disabled = !o.sellable || o.available === 0;
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => selectOffer(o)}
                    disabled={disabled}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on, disabled }}
                    style={[styles.offerRow, { backgroundColor: on ? `${colors.accent}14` : colors.card, borderColor: on ? colors.accent : colors.border, opacity: disabled ? 0.6 : 1 }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.offerName, { color: colors.foreground }]}>
                        {o.name} <Text style={{ color: colors.mutedForeground, fontFamily: fonts.body }}>· {o.kind === 'assigned' ? 'Reserved seats' : 'General admission'}</Text>
                      </Text>
                      <Text style={[styles.offerMeta, { color: colors.mutedForeground }]}>
                        {o.available === 0 ? 'Sold out' : !o.sellable ? (o.window_reason === 'before_window' ? 'Not on sale yet' : 'Sales closed') : `${o.available} available`}
                        {o.section?.accessible ? ' · accessible seating' : ''}
                      </Text>
                    </View>
                    <Text style={[styles.offerPrice, { color: colors.primary }]}>{formatMoney(o.price_minor + o.fee_minor, o.currency)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[wide ? { width: 340 } : undefined, { gap: 12 }]}>
            {selected ? (
              <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.panelTitle, { color: colors.foreground }]}>{selected.name}</Text>
                {lowStock ? <Notice tone="warning" message={`Only ${selected.available} left in this section.`} /> : null}
                {selected.kind === 'ga' ? (
                  <View style={styles.qtyRow}>
                    <Text style={[styles.label, { color: colors.mutedForeground }]}>Quantity (max {selected.max_per_order})</Text>
                    <QuantityStepper value={quantity} min={1} max={Math.max(1, Math.min(selected.max_per_order, selected.available))} onChange={setQuantity} />
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    <SegmentedTabs
                      compact
                      segments={[
                        { key: 'map', label: 'Seat map' },
                        { key: 'list', label: 'List view' },
                      ]}
                      value={seatView}
                      onChange={setSeatView}
                    />
                    <Text style={[styles.label, { color: colors.mutedForeground }]}>
                      Select up to {selected.max_per_order} seats · {seatIds.size} selected
                    </Text>
                    {seats == null ? (
                      <SkeletonBlock height={160} />
                    ) : seats.length === 0 ? (
                      <Notice tone="info" message="No seat layout is available for this section." />
                    ) : seatView === 'map' ? (
                      <SeatGrid seats={seats} unavailable={unavailable} mine={mine} selected={seatIds} onToggle={toggleSeat} maxSelectable={selected.max_per_order} />
                    ) : (
                      <SeatList seats={seats} unavailable={unavailable} mine={mine} selected={seatIds} onToggle={toggleSeat} maxSelectable={selected.max_per_order} />
                    )}
                    <View style={styles.legendRow}>
                      <Ionicons name="accessibility-outline" size={12} color={colors.mutedForeground} />
                      <Text style={[styles.legendText, { color: colors.mutedForeground }]}>accessible</Text>
                      <Ionicons name="people-outline" size={12} color={colors.mutedForeground} />
                      <Text style={[styles.legendText, { color: colors.mutedForeground }]}>companion</Text>
                      <Text style={[styles.legendText, { color: colors.mutedForeground }]}>× unavailable</Text>
                    </View>
                  </View>
                )}

                <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
                  <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>
                    {count} × {formatMoney(unitPrice, selected.currency)}
                  </Text>
                  <Text style={[styles.total, { color: colors.foreground }]} accessibilityLiveRegion="polite">
                    {formatMoney(total, selected.currency)}
                  </Text>
                </View>

                {actionError ? <Notice tone={errorTone} title={errorTitle} message={actionError.message} actionLabel={actionError.code === 'network' ? 'Retry' : undefined} onAction={actionError.code === 'network' ? reserve : undefined} live /> : null}

                {repriced ? (
                  <Notice
                    tone="warning"
                    title="Price updated"
                    message={`The price changed from ${formatMoney(repriced.from, selected.currency)} to ${formatMoney(repriced.to, selected.currency)} per ticket. Confirm to continue at the new price.`}
                    actionLabel="Confirm new price"
                    onAction={() => continueToOrder(true)}
                    live
                  />
                ) : null}

                {hold ? (
                  <View style={{ gap: 10 }}>
                    <View style={[styles.holdBox, { backgroundColor: `${colors.success}1A`, borderColor: `${colors.success}66` }]}>
                      <Ionicons name="lock-closed-outline" size={16} color={colors.success} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.holdTitle, { color: colors.foreground }]}>Seats held for you</Text>
                        <Countdown
                          until={hold.expires_at}
                          onExpire={() => {
                            setHold(null);
                            setActionError({ message: 'Your hold expired. Please select again.', code: 'hold_expired' });
                            load();
                          }}
                        />
                      </View>
                    </View>
                    <Button label="Continue to order" icon="arrow-forward" size="lg" onPress={() => continueToOrder(false)} loading={busy} />
                    <Button label="Release seats" variant="ghost" onPress={releaseHold} disabled={busy} />
                  </View>
                ) : (
                  <Button icon="lock-closed-outline" size="lg" label={selected.kind === 'assigned' ? `Hold ${seatIds.size || ''} seat${seatIds.size === 1 ? '' : 's'}` : `Hold ${quantity} ticket${quantity === 1 ? '' : 's'}`} onPress={reserve} loading={busy} disabled={selected.kind === 'assigned' ? seatIds.size === 0 : quantity < 1} />
                )}
              </View>
            ) : (
              <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.panelTitle, { color: colors.foreground }]}>Your selection</Text>
                <Text style={[styles.sub, { color: colors.mutedForeground }]}>Choose a section to see prices and seats.</Text>
              </View>
            )}
          </View>
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, padding: 16, justifyContent: 'center' },
  body: { padding: 16, gap: 12 },
  matchTitle: { fontFamily: fonts.heading, fontSize: 20, letterSpacing: -0.3 },
  sub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  layout: { gap: 14 },
  layoutWide: { flexDirection: 'row', alignItems: 'flex-start' },
  offerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, borderWidth: 1.5, minHeight: 56 },
  offerName: { fontFamily: fonts.bodySemi, fontSize: 14 },
  offerMeta: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  offerPrice: { fontFamily: fonts.headingSemi, fontSize: 15 },
  panel: { borderRadius: radius.lg, borderWidth: 1, padding: 14, gap: 12 },
  panelTitle: { fontFamily: fonts.headingSemi, fontSize: 16 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  label: { fontFamily: fonts.bodyMed, fontSize: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  legendText: { fontFamily: fonts.body, fontSize: 11, marginRight: 8 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  totalLabel: { fontFamily: fonts.body, fontSize: 13 },
  total: { fontFamily: fonts.heading, fontSize: 20 },
  holdBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1 },
  holdTitle: { fontFamily: fonts.bodySemi, fontSize: 13 },
});
