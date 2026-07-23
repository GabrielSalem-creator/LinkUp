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

import { fonts } from '@/constants/theme';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';

export default function LoginScreen() {
  const { colors } = useTheme();
  const { login, register, loginDemo, isAppwrite } = useAuth();
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
      Alert.alert(
        'Demo login failed',
        e instanceof Error
          ? `${e.message}\n\nAppwrite Console → Auth → Settings → enable Anonymous sessions.`
          : 'Enable Anonymous auth in Appwrite'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.wrap}
      >
        <Text style={[styles.brand, { color: colors.primary }]}>LinkUp</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          One community for Lebanon&apos;s athletes
        </Text>
        <Text style={[styles.badge, { color: colors.mutedForeground }]}>
          Backend: {isAppwrite ? 'Appwrite (FRA) live' : 'Local mock'}
        </Text>
        <Text style={[styles.badge, { color: colors.mutedForeground, marginBottom: 16 }]}>
          Demo: demo@linkup.app / LinkUpDemo123!
        </Text>

        {mode === 'register' ? (
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Full name"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
          />
        ) : null}

        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Password (min 8)"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
        />

        <Pressable
          onPress={submit}
          disabled={busy}
          style={[styles.primary, { backgroundColor: colors.primary, opacity: busy ? 0.7 : 1 }]}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>{mode === 'login' ? 'Sign in' : 'Create account'}</Text>
          )}
        </Pressable>

        <Pressable onPress={() => setMode(mode === 'login' ? 'register' : 'login')} style={styles.linkBtn}>
          <Text style={{ color: colors.foreground, fontFamily: fonts.bodyMed }}>
            {mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
          </Text>
        </Pressable>

        <Pressable
          onPress={demo}
          disabled={busy}
          style={[styles.secondary, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.foreground, fontFamily: fonts.bodySemi }}>
            Enter live demo (Appwrite)
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  wrap: { flex: 1, padding: 24, justifyContent: 'center' },
  brand: { fontFamily: fonts.heading, fontSize: 40, marginBottom: 6 },
  sub: { fontFamily: fonts.body, fontSize: 15, marginBottom: 8 },
  badge: { fontFamily: fonts.bodyMed, fontSize: 12, marginBottom: 28 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 14,
    marginBottom: 10,
    fontFamily: fonts.body,
  },
  primary: {
    height: 50,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryText: { color: '#fff', fontFamily: fonts.bodySemi, fontSize: 15 },
  linkBtn: { alignItems: 'center', marginTop: 16 },
  secondary: {
    marginTop: 24,
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
