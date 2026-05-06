import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    profile: {
      name: string;
      surname: string;
      contactNumber: string;
    },
  ) => Promise<{ data: { session: Session | null } | null; error: unknown }>;
  signIn: (email: string, password: string) => Promise<{ error: unknown }>;
  signOut: () => Promise<{ error: unknown }>;
  resetPassword: (email: string) => Promise<{ error: unknown }>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (
    email: string,
    password: string,
    profile: {
      name: string;
      surname: string;
      contactNumber: string;
    },
  ) => {
    const configuredAppUrl = import.meta.env.VITE_APP_URL as string | undefined;
    const appBaseUrl = (
      configuredAppUrl && configuredAppUrl.trim().length > 0 ? configuredAppUrl : window.location.origin
    ).replace(/\/+$/, "");
    const redirectUrl = `${appBaseUrl}/auth?login=1`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name: profile.name,
          surname: profile.surname,
          user_name: profile.name,
          user_surname: profile.surname,
          contact_number: profile.contactNumber,
          user_contact: profile.contactNumber,
          role: "Master user",
        },
      }
    });
    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const resetPassword = async (email: string) => {
    const configuredAppUrl = import.meta.env.VITE_APP_URL as string | undefined;
    const appBaseUrl = (
      configuredAppUrl && configuredAppUrl.trim().length > 0 ? configuredAppUrl : window.location.origin
    ).replace(/\/+$/, "");
    const redirectUrl = `${appBaseUrl}/reset-password`;

    let { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    // Fallback: if redirect URL is not allow-listed in Supabase yet, send without redirectTo
    // so reset emails can still be delivered.
    if (error) {
      const message = String((error as any)?.message ?? error).toLowerCase();
      const isRedirectError =
        message.includes("redirect") || message.includes("url") || message.includes("invalid");
      if (isRedirectError) {
        const fallback = await supabase.auth.resetPasswordForEmail(email);
        error = fallback.error;
      }
    }

    return { error };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signUp,
        signIn,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
