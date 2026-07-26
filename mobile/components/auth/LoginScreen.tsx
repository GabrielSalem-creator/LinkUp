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
  const { colors } = useTheme();
  const { login, register, loginDemo } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

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
    <View style={[styles.root, { backgroundColor: colors.primary }]}>
      <LinearGradient
        colors={['#133440', '#1A4A52', '#0C1A20']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glow} />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.wrap}
        >
          <View style={styles.hero}>
            <View style={[styles.mark, { backgroundColor: colors.accent }]}>
              <Text style={styles.markText}>Lu</Text>
            </View>
            <Text style={styles.brand}>LinkUp</Text>
            <Text style={styles.headline}>Train by the coast. Connect with your club.</Text>
            <Text style={styles.sub}>Events, leagues, and teammates across Lebanon.</Text>
          </View>

          {!showForm ? (
            <View style={styles.ctaCol}>
              <Pressable
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
                onPress={() => {
                  setMode('login');
                  setShowForm(true);
                }}
                style={({ pressed }) => [
                  styles.ghostBtn,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.ghostText}>Log In</Text>
              </Pressable>
              <Pressable onPress={demo} disabled={busy} style={styles.demoLink}>
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
              >
                <Text style={{ color: colors.mutedForeground, fontFamily: fonts.bodyMed, fontSize: 14 }}>
                  {mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}
                </Text>
              </Pressable>
              <Pressable onPress={() => setShowForm(false)} style={styles.linkBtn}>
                <Text style={{ color: colors.primary, fontFamily: fonts.bodySemi, fontSize: 13 }}>Back</Text>
              </Pressable>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
  wrap: { flex: 1, padding: 24, justifyContent: 'flex-end', paddingBottom: 36 },
  hero: { flex: 1, justifyContent: 'center', paddingBottom: 24 },
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
    fontSize: 22,
    lineHeight: 28,
    color: '#FFF2E2',
    marginBottom: 8,
    maxWidth: 300,
  },
  sub: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: 'rgba(255,242,226,0.72)', maxWidth: 320 },
  ctaCol: { gap: 12 },
  coralBtn: {
    height: 54,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coralText: { color: '#fff', fontFamily: fonts.bodySemi, fontSize: 17 },
  ghostBtn: {
    height: 54,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255,242,226,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: { color: '#FFF2E2', fontFamily: fonts.bodySemi, fontSize: 16 },
  demoLink: { alignItems: 'center', paddingVertical: 10 },
  demoText: { color: 'rgba(255,242,226,0.7)', fontFamily: fonts.bodyMed, fontSize: 14 },
  panel: {
    borderRadius: radius.xl,
    padding: 18,
  },
  panelTitle: { fontFamily: fonts.headingSemi, fontSize: 20, marginBottom: 14 },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    height: 50,
    paddingHorizontal: 14,
    marginBottom: 10,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  linkBtn: { alignItems: 'center', marginTop: 12, paddingVertical: 4 },
});
