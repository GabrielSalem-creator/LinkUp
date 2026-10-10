import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { fonts, radius } from '@/constants/theme';
import type { AvailabilityOffer } from '@/lib/competitionApi';
import { formatMoney } from '@/lib/ticketing';
import type { VenueSeat } from '@/lib/ticketing';
import { useTheme } from '@/lib/ThemeContext';

type Geometry = { x: number; y: number; w: number; h: number; side?: string };
function parseGeometry(raw: string): Geometry {
  try {
    const g = JSON.parse(raw);
    return { x: Number(g.x ?? 0), y: Number(g.y ?? 0), w: Number(g.w ?? 20), h: Number(g.h ?? 10), side: g.side };
  } catch {
    return { x: 0, y: 0, w: 20, h: 10 };
  }
}

/**
 * Section-level venue map. Sections are positioned from their geometry (0..100 grid) around the pitch.
 * Each section is a real button with a text label, so it is usable by keyboard and screen readers.
 */
export function SectionMap({ offers, selectedId, onSelect, sport, width: containerWidth }: { offers: AvailabilityOffer[]; selectedId?: string | null; onSelect: (o: AvailabilityOffer) => void; sport?: string; width?: number }) {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const size = Math.max(280, Math.min(containerWidth || windowWidth - 32, 460));
  const h = size * 0.78;
  const isCourt = sport === 'basketball' || sport === 'volleyball' || sport === 'handball' || sport === 'futsal';
  return (
    <View style={[styles.map, { width: size, height: h, backgroundColor: colors.secondary, borderColor: colors.border }]} accessibilityRole="none">
      <View style={[styles.pitch, { left: size * 0.2, top: h * 0.22, width: size * 0.6, height: h * 0.56, backgroundColor: isCourt ? '#C47B16' : '#0C7A3E', borderColor: 'rgba(255,255,255,0.75)' }]} accessibilityLabel={isCourt ? 'Court' : 'Pitch'}>
        <View style={styles.halfLine} />
        <View style={styles.centerCircle} />
      </View>
      {offers.map((o) => {
        if (!o.section) return null;
        const g = parseGeometry(o.section.geometry);
        const on = o.id === selectedId;
        const soldOut = o.available === 0;
        const disabled = !o.sellable || soldOut;
        const price = formatMoney(o.price_minor + o.fee_minor, o.currency);
        return (
          <Pressable
            key={o.id}
            onPress={() => onSelect(o)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: on, disabled }}
            accessibilityLabel={`${o.name}, ${price}, ${soldOut ? 'sold out' : !o.sellable ? 'not on sale' : `${o.available} available`}${o.section.accessible ? ', accessible seating' : ''}`}
            style={({ pressed }) => [
              styles.section,
              {
                left: (g.x / 100) * size,
                top: (g.y / 100) * h,
                width: (g.w / 100) * size,
                height: (g.h / 100) * h,
                backgroundColor: disabled ? colors.border : on ? colors.accent : colors.primary,
                borderColor: on ? '#fff' : 'transparent',
                opacity: pressed ? 0.85 : 1,
              },
              Platform.OS === 'web' ? ({ cursor: disabled ? 'not-allowed' : 'pointer' } as object) : null,
            ]}
          >
            <Text style={styles.sectionCode} numberOfLines={1}>
              {o.section.code}
            </Text>
            <Text style={styles.sectionPrice} numberOfLines={1}>
              {soldOut ? 'Sold out' : !o.sellable ? 'Closed' : price}
            </Text>
            {o.section.accessible ? <Ionicons name="accessibility-outline" size={10} color="#fff" style={{ position: 'absolute', top: 3, right: 3 }} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export type SeatState = 'free' | 'taken' | 'mine' | 'selected';

/** Seat grid for an assigned section: rows x seats. Seat kind + state is shown via icon/label, not colour alone. */
export function SeatGrid({ seats, unavailable, mine, selected, onToggle, maxSelectable }: { seats: VenueSeat[]; unavailable: Set<string>; mine: Set<string>; selected: Set<string>; onToggle: (seat: VenueSeat) => void; maxSelectable: number }) {
  const { colors } = useTheme();
  const rows = new Map<string, VenueSeat[]>();
  for (const s of seats) {
    if (!rows.has(s.row_label)) rows.set(s.row_label, []);
    rows.get(s.row_label)!.push(s);
  }
  const atMax = selected.size >= maxSelectable;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 4 }}>
      <View style={{ gap: 6 }}>
        <View style={styles.stageWrap}>
          <Text style={[styles.stage, { color: colors.mutedForeground, borderColor: colors.border }]}>Facing the pitch</Text>
        </View>
        {[...rows.entries()].map(([row, list]) => (
          <View key={row} style={styles.seatRow}>
            <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{row}</Text>
            {list.map((seat) => {
              const taken = unavailable.has(seat.id) && !mine.has(seat.id);
              const isSel = selected.has(seat.id);
              const disabled = taken || (!isSel && atMax);
              const bg = taken ? colors.border : isSel ? colors.accent : mine.has(seat.id) ? colors.success : colors.card;
              const fg = taken ? colors.mutedForeground : isSel ? '#fff' : colors.foreground;
              const kindIcon = seat.kind === 'accessible' ? 'accessibility-outline' : seat.kind === 'companion' ? 'people-outline' : null;
              return (
                <Pressable
                  key={seat.id}
                  onPress={() => onToggle(seat)}
                  disabled={disabled}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSel, disabled }}
                  accessibilityLabel={`Row ${seat.row_label} seat ${seat.seat_number}${seat.kind !== 'standard' ? `, ${seat.kind} seat` : ''}${taken ? ', unavailable' : isSel ? ', selected' : ''}`}
                  style={({ pressed }) => [styles.seat, { backgroundColor: bg, borderColor: isSel ? colors.accent : colors.border, opacity: pressed ? 0.8 : 1 }, Platform.OS === 'web' ? ({ cursor: disabled ? 'not-allowed' : 'pointer' } as object) : null]}
                >
                  {kindIcon ? <Ionicons name={kindIcon} size={11} color={fg} /> : null}
                  <Text style={[styles.seatText, { color: fg }]}>{taken ? '×' : seat.seat_number}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/** Accessible list equivalent of the map + grid: section → row → seat, usable without vision or pointer. */
export function SeatList({ seats, unavailable, mine, selected, onToggle, maxSelectable }: { seats: VenueSeat[]; unavailable: Set<string>; mine: Set<string>; selected: Set<string>; onToggle: (seat: VenueSeat) => void; maxSelectable: number }) {
  const { colors } = useTheme();
  const atMax = selected.size >= maxSelectable;
  return (
    <View style={{ gap: 6 }} accessibilityRole="list">
      {seats.map((seat) => {
        const taken = unavailable.has(seat.id) && !mine.has(seat.id);
        const isSel = selected.has(seat.id);
        const disabled = taken || (!isSel && atMax);
        return (
          <Pressable
            key={seat.id}
            onPress={() => onToggle(seat)}
            disabled={disabled}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSel, disabled }}
            style={[styles.listRow, { backgroundColor: isSel ? `${colors.accent}1A` : colors.card, borderColor: isSel ? colors.accent : colors.border, opacity: taken ? 0.6 : 1 }]}
          >
            <Ionicons name={isSel ? 'checkbox' : taken ? 'close-circle-outline' : 'square-outline'} size={20} color={isSel ? colors.accent : colors.mutedForeground} />
            <Text style={[styles.listText, { color: colors.foreground }]}>
              Row {seat.row_label} · Seat {seat.seat_number}
            </Text>
            <Text style={[styles.listKind, { color: colors.mutedForeground }]}>{taken ? 'Unavailable' : seat.kind === 'standard' ? '' : seat.kind}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  map: { alignSelf: 'center', borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  pitch: { position: 'absolute', borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  halfLine: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(255,255,255,0.75)' },
  centerCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.75)' },
  section: { position: 'absolute', borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center', padding: 2, minWidth: 44, minHeight: 36 },
  sectionCode: { color: '#fff', fontFamily: fonts.heading, fontSize: 13 },
  sectionPrice: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.bodyMed, fontSize: 9 },
  stageWrap: { alignItems: 'center', marginBottom: 4 },
  stage: { fontFamily: fonts.bodyMed, fontSize: 10, paddingHorizontal: 12, paddingVertical: 3, borderWidth: 1, borderRadius: radius.full, textTransform: 'uppercase', letterSpacing: 0.5 },
  seatRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowLabel: { width: 18, fontFamily: fonts.bodyBold, fontSize: 12, textAlign: 'center' },
  seat: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  seatText: { fontFamily: fonts.bodySemi, fontSize: 12 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, minHeight: 48 },
  listText: { flex: 1, fontFamily: fonts.bodyMed, fontSize: 14 },
  listKind: { fontFamily: fonts.body, fontSize: 12, textTransform: 'capitalize' },
});
