import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, isAppwriteMode } from '@/lib/api';
import type { User } from '@/types';

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  isAppwrite: boolean;
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

  const refresh = useCallback(async () => {
    const me = await api.auth.me();
    setUser(me);
  }, []);

  useEffect(() => {
    refresh().finally(() => setIsLoading(false));
  }, [refresh]);

  const loginDemo = useCallback(async () => {
    const me = await api.auth.loginDemo();
    setUser(me);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const me = await api.auth.login(email, password);
    setUser(me);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const me = await api.auth.register(email, password, name);
    setUser(me);
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (patch: Partial<User>) => {
    const me = await api.auth.updateProfile(patch);
    setUser(me);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAppwrite: isAppwriteMode,
      refresh,
      loginDemo,
      login,
      register,
      logout,
      updateProfile,
    }),
    [user, isLoading, refresh, loginDemo, login, register, logout, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
