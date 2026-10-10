import qrcode from 'qrcode-generator';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

/** Renders a QR code with plain Views (works on native and web, no SVG dependency). */
export default function QrCode({ value, size = 220, dark = '#1D1D1B', light = '#FFFFFF' }: { value: string; size?: number; dark?: string; light?: string }) {
  const matrix = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    const rows: boolean[][] = [];
    for (let r = 0; r < n; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < n; c++) row.push(qr.isDark(r, c));
      rows.push(row);
    }
    return rows;
  }, [value]);
  const n = matrix.length;
  const cell = Math.floor((size - 16) / n);
  const inner = cell * n;
  return (
    <View style={[styles.box, { width: inner + 16, height: inner + 16, backgroundColor: light }]} accessible accessibilityRole="image" accessibilityLabel="Ticket QR code. Show this at the entrance.">
      {matrix.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.map((dark_, c) => (
            <View key={c} style={{ width: cell, height: cell, backgroundColor: dark_ ? dark : light }} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ box: { padding: 8, borderRadius: 12, alignSelf: 'center' } });
