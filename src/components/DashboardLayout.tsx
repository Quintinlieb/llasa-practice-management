import { ReactNode, useEffect, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface DashboardLayoutProps {
  children: ReactNode;
}

interface Profile {
  user_name: string;
  user_surname: string;
  user_email: string;
}

const STORAGE_KEYS = {
  COMPANY: "header:companyName",
  PROFILE: "header:profile",
} as const;

const getStoredProfile = (): Profile | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.PROFILE);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user } = useAuth();
  const [companyName, setCompanyName] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEYS.COMPANY) || "";
    } catch {
      return "";
    }
  });
  const [profile, setProfile] = useState<Profile | null>(() => getStoredProfile());



  useEffect(() => {
    if (user) {
      supabase
        .from("profiles")
        .select("company_name")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setCompanyName(data.company_name);
        });
      supabase
        .from("profiles")
        .select("user_name, user_surname, user_email")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setProfile(data as Profile);
        });
    }
  }, [user]);

  useEffect(() => {
    try {
      if (companyName) {
        sessionStorage.setItem(STORAGE_KEYS.COMPANY, companyName);
      }
      if (profile) {
        sessionStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
      }
    } catch {
      // ignore storage errors
    }
  }, [companyName, profile]);

  const getInitials = () => {
    if (!profile) return "U";
    return `${profile.user_name.charAt(0)}${profile.user_surname.charAt(0)}`.toUpperCase();
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen w-screen flex flex-col">
        <header className="border-b-2 border-border/70 bg-background/95 backdrop-blur-sm shadow-sm sticky top-0 z-40 h-14">
          <div className="relative h-full px-6 flex items-center justify-between">
            <div className="flex items-center">
              {companyName && (
                <h1 className="text-lg font-semibold">{companyName}</h1>
              )}
            </div>
            <div className="flex items-center gap-3">
              {profile && (
                <>
                  <div className="flex flex-col items-end leading-tight">
                    <span className="text-sm font-semibold text-foreground">
                      {profile.user_name} {profile.user_surname}
                    </span>
                    <span className="text-xs text-muted-foreground truncate max-w-xs">
                      {profile.user_email}
                    </span>
                  </div>
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                    {getInitials()}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="flex flex-1 min-h-0 w-full">
          <div className="flex-shrink-0 sticky top-14 self-start">
            <AppSidebar />
          </div>
          <div className="flex-1 min-w-0 flex flex-col bg-[#f5f7fa]">
            <main className="flex-1 w-full p-6">{children}</main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
