import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { readPersistedSupabaseSession, supabase } from "@/integrations/supabase/client";
import { cacheHeaderProfile, readCachedHeaderProfilePicture } from "@/lib/headerProfileCache";
import { resolveProfilePictureUrl } from "@/lib/profilePictures";

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
  const persistedSession = readPersistedSupabaseSession() as Session | null;
  const [user, setUser] = useState<User | null>(persistedSession?.user ?? null);
  const [session, setSession] = useState<Session | null>(persistedSession);
  const [loading, setLoading] = useState(!persistedSession);
  const explicitSignInInProgressRef = useRef(false);

  const preloadHeaderProfile = async (authUser: User) => {
    const { data: profileData } = await (supabase as any)
      .from("profiles")
      .select("user_name, user_surname, user_email, profile_picture")
      .eq("id", authUser.id)
      .maybeSingle();

    if (profileData) {
      cacheHeaderProfile(authUser.id, {
        user_name: String(profileData.user_name || "").trim(),
        user_surname: String(profileData.user_surname || "").trim(),
        user_email: String(profileData.user_email || authUser.email || "").trim(),
        profile_picture: resolveProfilePictureUrl((profileData as any).profile_picture),
      });
      return;
    }

    const { data: subuserData } = await (supabase as any)
      .from("subusers")
      .select("name,surname,email,profile_picture")
      .eq("auth_user_id", authUser.id)
      .maybeSingle();

    if (subuserData) {
      cacheHeaderProfile(authUser.id, {
        user_name: String((subuserData as any).name || "").trim(),
        user_surname: String((subuserData as any).surname || "").trim(),
        user_email: String((subuserData as any).email || authUser.email || "").trim(),
        profile_picture: resolveProfilePictureUrl((subuserData as any).profile_picture),
      });
      return;
    }

    cacheHeaderProfile(authUser.id, {
      user_name: String((authUser as any)?.user_metadata?.user_name || (authUser as any)?.user_metadata?.name || "User").trim(),
      user_surname: String((authUser as any)?.user_metadata?.user_surname || (authUser as any)?.user_metadata?.surname || "").trim(),
      user_email: String(authUser.email || "").trim(),
      profile_picture: "",
    });
  };

  const decodeHeaderProfilePicture = async (authUserId: string) => {
    if (typeof window === "undefined") return;
    const picture = readCachedHeaderProfilePicture(authUserId);
    if (!picture) return;

    await new Promise<void>((resolve) => {
      const image = new Image();
      image.decoding = "sync";
      image.onload = () => resolve();
      image.onerror = () => resolve();
      image.src = picture;
      if (image.complete) resolve();
    });
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (explicitSignInInProgressRef.current && event === "SIGNED_IN") {
          return;
        }
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
    explicitSignInInProgressRef.current = true;
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      explicitSignInInProgressRef.current = false;
      setLoading(false);
      return { error };
    }

    if (data.user?.id) {
      try {
        await preloadHeaderProfile(data.user);
        await decodeHeaderProfilePicture(data.user.id);
      } catch {
        // Do not block sign-in if profile preloading fails.
      }
    }

    setSession(data.session);
    setUser(data.user ?? null);
    setLoading(false);
    explicitSignInInProgressRef.current = false;
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
