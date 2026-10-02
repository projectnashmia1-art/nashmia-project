import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabase";
import { clearAllAuthTracking } from "./auth-navigation";
import type { Database } from "@/types/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isConfigured: boolean;
  userId: string | null;
  organizationId: string | null;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ success: boolean; requiresConfirmation?: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (uid: string, fallbackEmail?: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .maybeSingle();

      if (!error && data) {
        setProfile(data);
      } else if (!data) {
        // If profile record doesn't exist yet, lazily create a default one
        const newProfile: Database["public"]["Tables"]["profiles"]["Insert"] = {
          id: uid,
          email: fallbackEmail || "",
          full_name: fallbackEmail ? fallbackEmail.split("@")[0] : "Nashmia User",
          role: "operations",
          company_name: "Nashmia Industries",
          updated_at: new Date().toISOString(),
        };
        const { data: created } = await supabase
          .from("profiles")
          .upsert(newProfile)
          .select()
          .single();
        if (created) {
          setProfile(created);
        }
      }
    } catch (err) {
      console.warn("[Auth] Failed to load or sync profile:", err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      if (!isSupabaseConfigured) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (isMounted) {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          if (currentSession?.user) {
            void fetchProfile(currentSession.user.id, currentSession.user.email);
          }
        }
      } catch (err) {
        console.error("[Auth] Initial session error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void initAuth();

    // Listen to live Auth State Changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        void fetchProfile(newSession.user.id, newSession.user.email);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!isSupabaseConfigured) {
        return { success: false, error: "Supabase connection is not configured." };
      }
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (error) {
          return { success: false, error: error.message };
        }

        if (data.user) {
          setUser(data.user);
          setSession(data.session);
          await fetchProfile(data.user.id, data.user.email);
        }
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to sign in";
        return { success: false, error: msg };
      }
    },
    [fetchProfile],
  );

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      if (!isSupabaseConfigured) {
        return { success: false, error: "Supabase connection is not configured." };
      }
      try {
        const normalizedEmail = email.trim().toLowerCase();
        const trimmedName = fullName.trim();

        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              full_name: trimmedName,
            },
          },
        });

        if (error) {
          return { success: false, error: error.message };
        }

        if (data.user) {
          // Guarantee user profile row in database
          try {
            await supabase.from("profiles").upsert({
              id: data.user.id,
              email: normalizedEmail,
              full_name: trimmedName,
              role: "operations",
              company_name: "Nashmia Industries",
              updated_at: new Date().toISOString(),
            });
          } catch (profileErr) {
            console.warn("[Auth] Post-signup profile creation warning:", profileErr);
          }

          setUser(data.user);
          setSession(data.session);
          await fetchProfile(data.user.id, normalizedEmail);
        }

        const requiresConfirmation = !data.session && !!data.user;
        return { success: true, requiresConfirmation };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to sign up";
        return { success: false, error: msg };
      }
    },
    [fetchProfile],
  );

  const resetPassword = useCallback(async (email: string) => {
    if (!isSupabaseConfigured) {
      return { success: false, error: "Supabase connection is not configured." };
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: window.location.origin + "/login",
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send reset email";
      return { success: false, error: msg };
    }
  }, []);

  const signOut = useCallback(async () => {
    clearAllAuthTracking();
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn("[Auth] Sign out error:", err);
      }
    }
    setUser(null);
    setSession(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id, user.email);
    }
  }, [user?.id, user?.email, fetchProfile]);

  const organizationId = useMemo(() => {
    const rawProfile = profile as Record<string, unknown> | null;
    return (
      (rawProfile?.organization_id as string) ||
      (user?.user_metadata?.organization_id as string) ||
      (user?.app_metadata?.organization_id as string) ||
      null
    );
  }, [profile, user]);

  const contextValue = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      profile,
      loading,
      isConfigured: isSupabaseConfigured,
      userId: user?.id ?? null,
      organizationId,
      signIn,
      signUp,
      resetPassword,
      signOut,
      refreshProfile,
    }),
    [
      user,
      session,
      profile,
      loading,
      organizationId,
      signIn,
      signUp,
      resetPassword,
      signOut,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
