import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, isAppwriteMode } from '@/lib/api';
import type { User } from '@/types';

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  isAppwrite: boolean;
  usingFallback: boolean;
  connectionError: string | null;
  refresh: () => Promise<void>;
  loginDemo: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<User>) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const me = await api.auth.me();
    setUser(me);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let me = await api.auth.me();
        if (!me) me = await api.auth.loginDemo();
        if (!alive) return;
        setUser(me);
        setUsingFallback(false);
        setConnectionError(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Appwrite connection failed';
        console.warn(msg, e);
        if (!alive) return;
        setConnectionError(msg);
        // Last-resort local user so UI still opens; data screens fetch Appwrite publicly
        setUser({
          id: 'local-guest',
          email: 'guest@local',
          full_name: 'Guest',
          city: 'Beirut',
          total_distance_km: 0,
          total_activities: 0,
          current_streak: 0,
          longest_streak: 0,
        });
        setUsingFallback(true);
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const loginDemo = useCallback(async () => {
    const me = await api.auth.loginDemo();
    setUser(me);
    setUsingFallback(false);
    setConnectionError(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const me = await api.auth.login(email, password);
    setUser(me);
    setUsingFallback(false);
    setConnectionError(null);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const me = await api.auth.register(email, password, name);
    setUser(me);
    setUsingFallback(false);
    setConnectionError(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      /* ignore */
    }
    setIsLoading(true);
    try {
      const me = await api.auth.loginDemo();
      setUser(me);
      setUsingFallback(false);
      setConnectionError(null);
    } catch (e) {
      setConnectionError(e instanceof Error ? e.message : 'Reconnect failed');
      setUsingFallback(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (patch: Partial<User>) => {
    const me = await api.auth.updateProfile(patch);
    setUser(me);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAppwrite: isAppwriteMode && !usingFallback,
      usingFallback,
      connectionError,
      refresh,
      loginDemo,
      login,
      register,
      logout,
      updateProfile,
    }),
    [
      user,
      isLoading,
      usingFallback,
      connectionError,
      refresh,
      loginDemo,
      login,
      register,
      logout,
      updateProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
