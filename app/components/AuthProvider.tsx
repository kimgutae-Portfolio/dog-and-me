"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import type { Profile } from "../lib/supabase/types";

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: authData } = await supabase.auth.getUser();
    const currentUser = authData.user;
    setUser(currentUser);
    if (!currentUser) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from("profiles").select("id,email,full_name,role").eq("id", currentUser.id).maybeSingle();
    setProfile((data as Profile | null) ?? null);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const timer = window.setTimeout(() => refreshProfile().finally(() => setLoading(false)), 0);
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      window.setTimeout(() => refreshProfile(), 0);
    });
    return () => { window.clearTimeout(timer); data.subscription.unsubscribe(); };
  }, [refreshProfile]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    profile,
    loading,
    refreshProfile,
    signOut: async () => {
      await getSupabaseBrowserClient().auth.signOut();
      setUser(null);
      setProfile(null);
    },
  }), [loading, profile, refreshProfile, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
