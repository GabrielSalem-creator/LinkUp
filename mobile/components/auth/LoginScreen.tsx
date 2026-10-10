import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/ui/Button';
import { fonts, radius } from '@/constants/theme';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function friendlyAuthError(e: unknown, mode: 'login' | 'register'): string {
  const raw = e instanceof Error ? e.message : String(e ?? '');
  const msg = raw.toLowerCase();
  if (msg.includes('user_already_exists') || msg.includes('already exists')) return 'An account with this email already exists. Log in instead.';
  if (msg.includes('invalid credentials') || msg.includes('invalid email or password') || msg.includes('user_invalid_credentials')) return 'Wrong email or password.';
  if (msg.includes('password') && msg.includes('8')) return 'Password must be at least 8 characters.';
  if (msg.includes('rate limit') || msg.includes('too many')) return 'Too many attempts. Wait a minute and try again.';
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) return 'No connection to the server. Check your internet and try again.';
  if (msg.includes('user_blocked')) return 'This account is blocked.';
  if (msg.includes('email') && msg.includes('invalid')) return 'That email address is not valid.';
  return raw || (mode === 'login' ? 'Could not log in.' : 'Could not create the account.');
}

export default function LoginScreen() {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const { login, register, loginGuest } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<'submit' | 'guest' | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const compact = height < 700;

  const validate = () => {
    const errs: typeof fieldErrors = {};
    if (mode === 'register' && name.trim().length < 2) errs.name = 'Enter your name';
    if (!EMAIL_RE.test(email.trim())) errs.email = 'Enter a valid email address';
    if (password.length < 8) errs.password = 'Password must be at least 8 characters';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async () => {
    setError(null);
    if (!validate()) return;
    setBusy('submit');
    try {
      if (mode === 'register') await register(email.trim().toLowerCase(), password, name.trim());
      else await login(email.trim().toLowerCase(), password);
    } catch (e) {
      setError(friendlyAuthError(e, mode));
    } finally {
      setBusy(null);
    }
  };

  const guest = async () => {
    setError(null);
    setBusy('guest');
    try {
      await loginGuest();
    } catch (e) {
      setError(friendlyAuthError(e, 'login'));
    } finally {
      setBusy(null);
    }
  };

  const openForm = (m: 'login' | 'register') => {
    setMode(m);
    setError(null);
    setFieldErrors({});
    setShowForm(true);
  };

  const inputStyle = (bad?: string) => [styles.input, { borderColor: bad ? colors.destructive : colors.border, color: colors.foreground, backgroundColor: colors.card }];

  return (
    <View style={[styles.root, { backgroundColor: '#133440' }]}>
      <LinearGradient colors={['#133440', '#1A4A52', '#0C1A20']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.glow} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView contentContainerStyle={[styles.wrap, compact && styles.wrapCompact]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
            <View style={[styles.hero, (compact || showForm) && { flexGrow: 0, paddingBottom: 16 }]}>
              <View style={[styles.mark, { backgroundColor: colors.accent }]}>
                <Text style={styles.markText}>Lu</Text>
              </View>
              <Text style={[styles.brand, (compact || showForm) && { fontSize: 34 }]}>LinkUp</Text>
              {!showForm ? (
                <>
                  <Text style={styles.headline}>Train by the coast. Connect with your club.</Text>
                  <Text style={styles.sub}>Events, leagues, competitions and tickets across Lebanon.</Text>
                </>
              ) : null}
            </View>

            {!showForm ? (
              <View style={styles.ctaCol}>
                <Button label="Get Started" size="lg" onPress={() => openForm('register')} />
                <Pressable accessibilityRole="button" onPress={() => openForm('login')} style={({ pressed }) => [styles.ghostBtn, { opacity: pressed ? 0.85 : 1 }]}>
                  <Text style={styles.ghostText}>Log In</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={guest} disabled={busy != null} style={styles.demoLink} hitSlop={12}>
                  <Text style={styles.demoText}>{busy === 'guest' ? 'Signing you in…' : 'Continue as guest'}</Text>
                </Pressable>
                {error ? (
                  <View style={styles.errorBanner} accessibilityRole="alert">
                    <Ionicons name="alert-circle" size={18} color="#FFD3CC" />
                    <Text style={styles.errorBannerText}>{error}</Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={[styles.panel, { backgroundColor: colors.background }]}>
                <Text style={[styles.panelTitle, { color: colors.foreground }]}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</Text>
                {error ? (
                  <View style={[styles.errorBox, { backgroundColor: `${colors.destructive}14`, borderColor: `${colors.destructive}66` }]} accessibilityRole="alert" accessibilityLiveRegion="assertive">
                    <Ionicons name="alert-circle" size={18} color={colors.destructive} />
                    <Text style={[styles.errorText, { color: colors.foreground }]}>{error}</Text>
                  </View>
                ) : null}
                {mode === 'register' ? (
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.mutedForeground }]}>Full name</Text>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder="e.g. Maya Haddad"
                      placeholderTextColor={colors.mutedForeground}
                      autoComplete="name"
                      textContentType="name"
                      returnKeyType="next"
                      onSubmitEditing={() => emailRef.current?.focus()}
                      style={inputStyle(fieldErrors.name)}
                      accessibilityLabel="Full name"
                    />
                    {fieldErrors.name ? <Text style={[styles.fieldError, { color: colors.destructive }]}>{fieldErrors.name}</Text> : null}
                  </View>
                ) : null}
                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>Email</Text>
                  <TextInput
                    ref={emailRef}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    autoComplete="email"
                    textContentType="emailAddress"
                    inputMode="email"
                    placeholder="you@example.com"
                    placeholderTextColor={colors.mutedForeground}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    style={inputStyle(fieldErrors.email)}
                    accessibilityLabel="Email"
                  />
                  {fieldErrors.email ? <Text style={[styles.fieldError, { color: colors.destructive }]}>{fieldErrors.email}</Text> : null}
                </View>
                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>Password</Text>
                  <View>
                    <TextInput
                      ref={passwordRef}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      textContentType={mode === 'login' ? 'password' : 'newPassword'}
                      placeholder={mode === 'login' ? 'Your password' : 'At least 8 characters'}
                      placeholderTextColor={colors.mutedForeground}
                      returnKeyType="go"
                      onSubmitEditing={submit}
                      style={[...inputStyle(fieldErrors.password), { paddingRight: 52 }]}
                      accessibilityLabel="Password"
                    />
                    <Pressable onPress={() => setShowPassword((v) => !v)} accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} style={styles.eye} hitSlop={8}>
                      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.mutedForeground} />
                    </Pressable>
                  </View>
                  {fieldErrors.password ? <Text style={[styles.fieldError, { color: colors.destructive }]}>{fieldErrors.password}</Text> : null}
                </View>
                <Button label={mode === 'login' ? 'Log In' : 'Create account'} size="lg" onPress={submit} loading={busy === 'submit'} disabled={busy != null} />
                <Pressable onPress={() => openForm(mode === 'login' ? 'register' : 'login')} style={styles.linkBtn} hitSlop={10} accessibilityRole="button">
                  <Text style={{ color: colors.primary, fontFamily: fonts.bodySemi, fontSize: 14 }}>{mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setShowForm(false);
                    setError(null);
                  }}
                  style={styles.linkBtn}
                  hitSlop={10}
                  accessibilityRole="button"
                >
                  <Text style={{ color: colors.mutedForeground, fontFamily: fonts.bodyMed, fontSize: 14 }}>Back</Text>
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
  glow: { position: 'absolute', top: -80, right: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(90,189,183,0.22)' },
  safe: { flex: 1 },
  wrap: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28, justifyContent: 'flex-end' },
  wrapCompact: { justifyContent: 'flex-start', paddingTop: 24 },
  hero: { flexGrow: 1, justifyContent: 'center', paddingBottom: 28 },
  mark: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  markText: { color: '#fff', fontFamily: fonts.heading, fontSize: 22 },
  brand: { fontFamily: fonts.heading, fontSize: 44, letterSpacing: -1.2, color: '#FFF2E2', marginBottom: 12 },
  headline: { fontFamily: fonts.headingSemi, fontSize: 20, lineHeight: 27, color: '#FFF2E2', marginBottom: 8, maxWidth: 320 },
  sub: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: 'rgba(255,242,226,0.72)', maxWidth: 340 },
  ctaCol: { gap: 12, width: '100%' },
  ghostBtn: { height: 56, minHeight: 56, borderRadius: radius.full, borderWidth: 1.5, borderColor: 'rgba(255,242,226,0.7)', alignItems: 'center', justifyContent: 'center', width: '100%' },
  ghostText: { color: '#FFF2E2', fontFamily: fonts.bodyBold, fontSize: 16 },
  demoLink: { alignItems: 'center', paddingVertical: 14, minHeight: 44 },
  demoText: { color: 'rgba(255,242,226,0.8)', fontFamily: fonts.bodySemi, fontSize: 14, textDecorationLine: 'underline' },
  errorBanner: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: 'rgba(224,69,69,0.25)', borderRadius: radius.md, padding: 12 },
  errorBannerText: { color: '#FFF2E2', fontFamily: fonts.bodyMed, fontSize: 13, flex: 1 },
  panel: { borderRadius: radius.xl, padding: 18, width: '100%' },
  panelTitle: { fontFamily: fonts.headingSemi, fontSize: 20, marginBottom: 14 },
  errorBox: { flexDirection: 'row', gap: 8, alignItems: 'center', borderWidth: 1, borderRadius: radius.md, padding: 10, marginBottom: 12 },
  errorText: { fontFamily: fonts.bodyMed, fontSize: 13, flex: 1, lineHeight: 18 },
  field: { marginBottom: 12 },
  label: { fontFamily: fonts.bodySemi, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  input: { borderWidth: 1.5, borderRadius: radius.md, height: 52, paddingHorizontal: 14, fontFamily: fonts.body, fontSize: 16 },
  eye: { position: 'absolute', right: 6, top: 6, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  fieldError: { fontFamily: fonts.bodyMed, fontSize: 12, marginTop: 4 },
  linkBtn: { alignItems: 'center', marginTop: 12, paddingVertical: 8, minHeight: 40 },
});
