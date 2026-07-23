import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { fonts, radius } from '@/constants/theme';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/ThemeContext';

function TabIcon({
  focused,
  color,
  name,
  nameOutline,
  badge,
}: {
  focused: boolean;
  color: string;
  name: keyof typeof Ionicons.glyphMap;
  nameOutline: keyof typeof Ionicons.glyphMap;
  badge?: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.iconWrap, focused && { backgroundColor: colors.primarySoft }]}>
      <Ionicons name={focused ? name : nameOutline} size={22} color={color} />
      {badge && badge > 0 ? (
        <View style={[styles.badge, { backgroundColor: colors.destructive }]}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function TabLayout() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!user?.email) return;
    api.friendships.pendingFor(user.email).then((r) => setPending(r.length));
  }, [user?.email]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === 'web' ? 68 : 72,
          paddingBottom: Platform.OS === 'web' ? 10 : 12,
          paddingTop: 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.bodySemi,
          fontSize: 11,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Events',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} name="calendar" nameOutline="calendar-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="my-clubs"
        options={{
          title: 'Clubs',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} name="shield" nameOutline="shield-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="leagues"
        options={{
          title: 'Leagues',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} name="trophy" nameOutline="trophy-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
              name="person"
              nameOutline="person-outline"
              badge={pending}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 44,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontFamily: fonts.bodyBold },
});
