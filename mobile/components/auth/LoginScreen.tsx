import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fonts, radius } from '@/constants/theme';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';

export default function LoginScreen() {
  const { colors, isDark } = useTheme();
  const { login, register, loginDemo } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || password.length < 8) {
      Alert.alert('Missing info', 'Email required. Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'register') {
        await register(email.trim(), password, name.trim() || 'Athlete');
      } else {
        await login(email.trim(), password);
      }
    } catch (e) {
      Alert.alert('Auth failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  const demo = async () => {
    setBusy(true);
    try {
      await loginDemo();
    } catch (e) {
      Alert.alert('Demo login failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={
          isDark
            ? ['#0F2A22', '#0A100E', '#0A100E']
            : ['#C8EDE0', '#E8F5F0', '#F2F5F4']
        }
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.wrap}
        >
          <View style={styles.hero}>
            <Text style={[styles.brand, { color: colors.primary }]}>LinkUp</Text>
            <Text style={[styles.headline, { color: colors.foreground }]}>
              Train with Lebanon&apos;s clubs
            </Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              Events, leagues, and teammates — one community for athletes.
            </Text>
          </View>

          <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {mode === 'register' ? (
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Full name"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.input,
                  { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary },
                ]}
              />
            ) : null}

            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="Email"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary },
              ]}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Password (min 8)"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary },
              ]}
            />

            <Pressable
              onPress={submit}
              disabled={busy}
              style={({ pressed }) => [
                styles.primary,
                { backgroundColor: colors.primary, opacity: busy ? 0.7 : pressed ? 0.92 : 1 },
              ]}
            >
              {busy ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>
                  {mode === 'login' ? 'Sign in' : 'Create account'}
                </Text>
              )}
            </Pressable>

            <Pressable onPress={() => setMode(mode === 'login' ? 'register' : 'login')} style={styles.linkBtn}>
              <Text style={{ color: colors.mutedForeground, fontFamily: fonts.bodyMed, fontSize: 14 }}>
                {mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={demo}
            disabled={busy}
            style={({ pressed }) => [
              styles.secondary,
              { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={{ color: colors.foreground, fontFamily: fonts.bodySemi }}>Try live demo</Text>
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  wrap: { flex: 1, padding: 24, justifyContent: 'center' },
  hero: { marginBottom: 28 },
  brand: { fontFamily: fonts.heading, fontSize: 42, letterSpacing: -1.2, marginBottom: 10 },
  headline: {
    fontFamily: fonts.headingSemi,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
    marginBottom: 8,
    maxWidth: 320,
  },
  sub: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, maxWidth: 340 },
  panel: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    height: 50,
    paddingHorizontal: 14,
    marginBottom: 10,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  primary: {
    height: 52,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  primaryText: { fontFamily: fonts.bodySemi, fontSize: 16 },
  linkBtn: { alignItems: 'center', marginTop: 14, paddingVertical: 4 },
  secondary: {
    marginTop: 14,
    height: 50,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
