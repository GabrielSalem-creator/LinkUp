import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import StatusPill from '@/components/competition/StatusPill';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { fonts, radius } from '@/constants/theme';
import { ticketingApi } from '@/lib/competitionApi';
import { ApiError } from '@/lib/serverApi';
import { parseCredential } from '@/lib/ticketing';
import { useTheme } from '@/lib/ThemeContext';

/** Gate validation. Paste or scan (via a hardware scanner that types) the ticket credential. */
export default function ScanScreen() {
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; title: string; message: string; tone: 'success' | 'error' | 'warning' } | null>(null);

  const check = async (dryRun: boolean) => {
    const parsed = parseCredential(code);
    if (!parsed) {
      setResult({ ok: false, title: 'Unrecognised code', message: 'This does not look like a LinkUp ticket code.', tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      const r = await ticketingApi.validate(code.trim(), dryRun);
      setResult({ ok: true, title: dryRun ? 'Valid ticket' : 'Admitted', message: `${r.ticket.section_name}${r.ticket.seat_label ? ` · Seat ${r.ticket.seat_label}` : ''} · ${r.ticket.id}`, tone: 'success' });
      if (!dryRun) setCode('');
    } catch (e) {
      const err = e as ApiError;
      setResult({ ok: false, title: err.code === 'already_used' ? 'Already used' : err.code === 'ticket_inactive' ? 'Ticket not valid' : err.code === 'forbidden' ? 'Admin only' : 'Rejected', message: err.message, tone: err.code === 'already_used' ? 'warning' : 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Validate ticket' }} />
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.body}>
        <Text style={[styles.lead, { color: colors.mutedForeground }]}>Scan the QR with a scanner that types into the field, or paste the code. The server verifies the signature and marks the ticket as used.</Text>
        <TextInput value={code} onChangeText={setCode} placeholder="LKT1.…" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" autoCorrect={false} multiline style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} accessibilityLabel="Ticket code" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button label="Check only" variant="secondary" style={{ flex: 1 }} onPress={() => check(true)} loading={busy} disabled={!code.trim()} />
          <Button label="Admit" style={{ flex: 1 }} onPress={() => check(false)} loading={busy} disabled={!code.trim()} />
        </View>
        {result ? (
          <View style={[styles.result, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityLiveRegion="assertive">
            <StatusPill label={result.title} tone={result.tone === 'success' ? 'success' : result.tone === 'warning' ? 'warning' : 'danger'} />
            <Text style={[styles.resultText, { color: colors.foreground }]}>{result.message}</Text>
          </View>
        ) : (
          <Notice tone="info" message="Results appear here. Rejections include the reason (used, refunded, tampered)." />
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 12 },
  lead: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  input: { borderWidth: 1, borderRadius: radius.md, minHeight: 80, padding: 12, fontFamily: fonts.body, fontSize: 13 },
  result: { borderRadius: radius.lg, borderWidth: 1, padding: 14, gap: 8 },
  resultText: { fontFamily: fonts.bodyMed, fontSize: 14 },
});
