import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, isAppwriteMode, setPreferMock } from '@/lib/api';
import { mockApi } from '@/lib/api.mock';
import type { User } from '@/types';

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  isAppwrite: boolean;
  usingFallback: boolean;
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

  const refresh = useCallback(async () => {
    const me = await api.auth.me();
    setUser(me);
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      // 1) Show UI instantly with demo data (never blank)
      setPreferMock(true);
      const demo = await mockApi.auth.loginDemo();
      if (!alive) return;
      setUser(demo);
      setUsingFallback(true);
      setIsLoading(false);

      // 2) Upgrade to Appwrite in background if available
      if (!isAppwriteMode) return;
      try {
        setPreferMock(false);
        let me = await api.auth.me();
        if (!me) me = await api.auth.loginDemo();
        if (!alive) return;
        setUser(me);
        setUsingFallback(false);
        setPreferMock(false);
      } catch (e) {
        console.warn('Staying on offline demo data', e);
        setPreferMock(true);
        if (!alive) return;
        setUsingFallback(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const loginDemo = useCallback(async () => {
    setPreferMock(false);
    try {
      const me = await api.auth.loginDemo();
      setUser(me);
      setUsingFallback(false);
    } catch {
      setPreferMock(true);
      const me = await mockApi.auth.loginDemo();
      setUser(me);
      setUsingFallback(true);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setPreferMock(false);
    const me = await api.auth.login(email, password);
    setUser(me);
    setUsingFallback(false);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    setPreferMock(false);
    const me = await api.auth.register(email, password, name);
    setUser(me);
    setUsingFallback(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      /* ignore */
    }
    setPreferMock(true);
    const me = await mockApi.auth.loginDemo();
    setUser(me);
    setUsingFallback(true);
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
      refresh,
      loginDemo,
      login,
      register,
      logout,
      updateProfile,
    }),
    [user, isLoading, usingFallback, refresh, loginDemo, login, register, logout, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
