import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fonts, radius } from '@/constants/theme';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';

export default function LoginScreen() {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const { login, register, loginDemo } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const compact = height < 700;

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
    <View style={[styles.root, { backgroundColor: '#133440' }]}>
      <LinearGradient
        colors={['#133440', '#1A4A52', '#0C1A20']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glow} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={[styles.wrap, compact && styles.wrapCompact]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={[styles.hero, compact && { flexGrow: 0, paddingBottom: 16 }]}>
              <View style={[styles.mark, { backgroundColor: colors.accent }]}>
                <Text style={styles.markText}>Lu</Text>
              </View>
              <Text style={[styles.brand, compact && { fontSize: 36 }]}>LinkUp</Text>
              <Text style={styles.headline}>Train by the coast. Connect with your club.</Text>
              <Text style={styles.sub}>Events, leagues, and teammates across Lebanon.</Text>
            </View>

            {!showForm ? (
              <View style={styles.ctaCol}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setMode('register');
                    setShowForm(true);
                  }}
                  style={({ pressed }) => [
                    styles.coralBtn,
                    { backgroundColor: colors.accent, opacity: pressed ? 0.9 : 1 },
                  ]}
                >
                  <Text style={styles.coralText}>Get Started</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setMode('login');
                    setShowForm(true);
                  }}
                  style={({ pressed }) => [styles.ghostBtn, { opacity: pressed ? 0.85 : 1 }]}
                >
                  <Text style={styles.ghostText}>Log In</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={demo}
                  disabled={busy}
                  style={styles.demoLink}
                  hitSlop={12}
                >
                  <Text style={styles.demoText}>{busy ? 'Loading…' : 'Try live demo'}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={[styles.panel, { backgroundColor: colors.background }]}>
                <Text style={[styles.panelTitle, { color: colors.foreground }]}>
                  {mode === 'login' ? 'Welcome back' : 'Create account'}
                </Text>
                {mode === 'register' ? (
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Full name"
                    placeholderTextColor={colors.mutedForeground}
                    style={[
                      styles.input,
                      { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card },
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
                    { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card },
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
                    { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card },
                  ]}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={submit}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.coralBtn,
                    { backgroundColor: colors.accent, opacity: busy ? 0.7 : pressed ? 0.92 : 1 },
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.coralText}>{mode === 'login' ? 'Log In' : 'Get Started'}</Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
                  style={styles.linkBtn}
                  hitSlop={10}
                >
                  <Text style={{ color: colors.mutedForeground, fontFamily: fonts.bodyMed, fontSize: 14 }}>
                    {mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setShowForm(false)} style={styles.linkBtn} hitSlop={10}>
                  <Text style={{ color: colors.primary, fontFamily: fonts.bodySemi, fontSize: 14 }}>Back</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%' },
  flex: { flex: 1 },
  glow: {
    position: 'absolute',
    top: -80,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(90,189,183,0.22)',
  },
  safe: { flex: 1 },
  wrap: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 28,
    justifyContent: 'flex-end',
  },
  wrapCompact: { justifyContent: 'flex-start', paddingTop: 24 },
  hero: { flexGrow: 1, justifyContent: 'center', paddingBottom: 28 },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  markText: { color: '#fff', fontFamily: fonts.heading, fontSize: 22 },
  brand: { fontFamily: fonts.heading, fontSize: 44, letterSpacing: -1.2, color: '#FFF2E2', marginBottom: 12 },
  headline: {
    fontFamily: fonts.headingSemi,
    fontSize: 20,
    lineHeight: 27,
    color: '#FFF2E2',
    marginBottom: 8,
    maxWidth: 320,
  },
  sub: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: 'rgba(255,242,226,0.72)', maxWidth: 340 },
  ctaCol: { gap: 12, width: '100%' },
  coralBtn: {
    height: 56,
    minHeight: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  coralText: { color: '#fff', fontFamily: fonts.bodySemi, fontSize: 17 },
  ghostBtn: {
    height: 56,
    minHeight: 56,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255,242,226,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  ghostText: { color: '#FFF2E2', fontFamily: fonts.bodySemi, fontSize: 16 },
  demoLink: { alignItems: 'center', paddingVertical: 14 },
  demoText: { color: 'rgba(255,242,226,0.75)', fontFamily: fonts.bodyMed, fontSize: 14 },
  panel: {
    borderRadius: radius.xl,
    padding: 18,
    width: '100%',
  },
  panelTitle: { fontFamily: fonts.headingSemi, fontSize: 20, marginBottom: 14 },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    height: 52,
    paddingHorizontal: 14,
    marginBottom: 10,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  linkBtn: { alignItems: 'center', marginTop: 12, paddingVertical: 8 },
});
