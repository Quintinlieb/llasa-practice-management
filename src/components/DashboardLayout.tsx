import { ReactNode, useEffect, useMemo, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  COMPANY_TYPE: "header:companyType",
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
  const [companyType, setCompanyType] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEYS.COMPANY_TYPE) || "";
    } catch {
      return "";
    }
  });
  const [profile, setProfile] = useState<Profile | null>(() => getStoredProfile());
  const initials = useMemo(() => {
    if (!profile?.user_name || !profile?.user_surname) return "U";
    return `${profile.user_name.charAt(0)}${profile.user_surname.charAt(0)}`.toUpperCase();
  }, [profile]);



  useEffect(() => {
    if (user) {
      supabase
        .from("profiles")
        .select("company_name, company_type")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setCompanyName(data.company_name);
            setCompanyType(data.company_type ?? "");
          }
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
      if (companyType) {
        sessionStorage.setItem(STORAGE_KEYS.COMPANY_TYPE, companyType);
      }
      if (profile) {
        sessionStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
      }
    } catch {
      // ignore storage errors
    }
  }, [companyName, profile]);

  return (
    <SidebarProvider>
      <div className="app-shell relative min-h-screen w-screen flex bg-transparent overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          aria-hidden="true"
        >
          <div className="h-full w-full bg-[#c0d3f2] blur-md scale-105" />
          <div className="absolute inset-0 bg-white/08" />
        </div>
        <div
          className="fixed left-0 top-0 z-40 h-screen p-4 transition-[width] duration-200 ease-linear"
          style={{ width: "var(--app-sidebar-width, 14rem)", backgroundColor: "#c0d3f2" }}
        >
          <AppSidebar />
        </div>
        <div
          className="flex-shrink-0 transition-[width] duration-200 ease-linear"
          style={{ width: "var(--app-sidebar-width, 14rem)" }}
          aria-hidden="true"
        />
        <div className="flex flex-1 min-h-screen flex-col bg-transparent">
          <header
            className="fixed top-0 z-40 pr-4 pl-0 pt-4 pb-0 bg-transparent transition-[left] duration-200 ease-linear"
            style={{ left: "var(--app-sidebar-width, 14rem)", right: 0 }}
          >
            <div className="relative w-full rounded-2xl border border-slate-300 bg-white px-6 py-3 flex items-center justify-between">
              <div className="flex items-center">
                {companyName && (
                  <h1 className="text-lg font-semibold">
                    {companyName}
                    {companyType ? ` ${companyType}` : ""}
                  </h1>
                )}
              </div>
              {profile && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm">
                      {initials}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="end" collisionPadding={12} className="text-xs">
                    <div className="font-semibold">
                      {profile.user_name} {profile.user_surname}
                    </div>
                    <a className="text-primary underline-offset-4 hover:underline" href={`mailto:${profile.user_email}`}>
                      {profile.user_email}
                    </a>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </header>

          <div className="flex-1 min-w-0 flex flex-col bg-transparent pt-20">
            <main className="flex-1 w-full p-6">{children}</main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
