import 'react-native-url-polyfill/auto';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import 'react-native-reanimated';

import LoginScreen from '@/components/auth/LoginScreen';
import { fonts } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { AppThemeProvider, useTheme } from '@/lib/ThemeContext';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  const [fontTimeout, setFontTimeout] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setFontTimeout(true), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError || fontTimeout) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, fontError, fontTimeout]);

  // Never stay on a blank screen waiting for fonts
  if (!fontsLoaded && !fontError && !fontTimeout) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F7F8' }}>
        <ActivityIndicator color="#129B7A" size="large" />
        <Text style={{ marginTop: 12, color: '#6B7280', fontFamily: 'System' }}>Loading LinkUp…</Text>
      </View>
    );
  }

  return (
    <AppThemeProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </AppThemeProvider>
  );
}

function RootLayoutNav() {
  const { colors, isDark } = useTheme();
  const { isLoading, user, usingFallback } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={{ marginTop: 12, color: colors.mutedForeground, fontFamily: fonts.body }}>
          Connecting…
        </Text>
      </View>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {usingFallback ? (
        <View style={{ backgroundColor: '#F59E0B', paddingVertical: 6, paddingHorizontal: 12 }}>
          <Text style={{ color: '#111', fontFamily: fonts.bodyMed, fontSize: 11, textAlign: 'center' }}>
            Offline demo data (Appwrite unreachable). Events still show.
          </Text>
        </View>
      ) : null}
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerTitleStyle: { fontFamily: 'SpaceGrotesk_600SemiBold' },
          contentStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="clubs/index" options={{ title: 'Explore Clubs' }} />
        <Stack.Screen name="club/[id]" options={{ title: 'Club' }} />
        <Stack.Screen name="people" options={{ title: 'People' }} />
        <Stack.Screen name="club-portal" options={{ title: 'Club Portal' }} />
      </Stack>
    </>
  );
}
