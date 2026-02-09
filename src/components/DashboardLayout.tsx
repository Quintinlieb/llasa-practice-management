import { ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";

interface DashboardLayoutProps {
  children: ReactNode;
  headerTitle?: string;
  headerDescription?: string;
  profileSubtitleMode?: "email" | "company";
}

interface Profile {
  user_name: string;
  user_surname: string;
  user_email: string;
}

interface HeaderInfo {
  account_type: string | null;
  company_name: string | null;
  company_type: string | null;
  domestic_surname: string | null;
  user_surname: string | null;
}

const STORAGE_KEYS = {
  COMPANY: "header:companyName",
  COMPANY_TYPE: "header:companyType",
  PROFILE: "header:profile",
  SIDEBAR_COLLAPSED: "sidebar:collapsed",
} as const;

const getStoredProfile = (): Profile | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.PROFILE);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
};

export default function DashboardLayout({
  children,
  headerTitle,
  headerDescription,
  profileSubtitleMode = "email",
}: DashboardLayoutProps) {
  const { user } = useAuth();
  const headerRef = useRef<HTMLElement | null>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === "1";
    } catch {
      return false;
    }
  });
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
  const companyDisplay = [companyName, companyType].filter(Boolean).join(" ");

  useEffect(() => {
    if (!user?.id) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED);
      if (stored === null) {
        setIsCollapsed(false);
      }
    } catch {
      setIsCollapsed(false);
    }
  }, [user?.id]);

  useLayoutEffect(() => {
    const width = isCollapsed ? "5rem" : "10.5rem";
    document.documentElement.style.setProperty("--app-sidebar-width", width);
    try {
      localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, isCollapsed ? "1" : "0");
    } catch {
      // ignore storage errors
    }
  }, [isCollapsed]);

  useLayoutEffect(() => {
    const headerEl = headerRef.current;
    if (!headerEl) return;

    const setHeaderHeight = () => {
      const height = headerEl.offsetHeight;
      document.documentElement.style.setProperty("--app-header-height", `${height}px`);
    };

    setHeaderHeight();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", setHeaderHeight);
      return () => window.removeEventListener("resize", setHeaderHeight);
    }

    const observer = new ResizeObserver(() => setHeaderHeight());
    observer.observe(headerEl);
    return () => observer.disconnect();
  }, []);



  useEffect(() => {
    if (user) {
      supabase
        .from("profiles")
        .select("account_type, company_name, company_type, domestic_surname, user_surname")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) return;
          const headerData = data as HeaderInfo;
          const isDomestic = headerData.account_type === "domestic";
          if (isDomestic) {
            const surname = headerData.domestic_surname || headerData.user_surname || "";
            setCompanyName(surname ? `${surname} Household` : "");
            setCompanyType("");
          } else {
            setCompanyName(headerData.company_name ?? "");
            setCompanyType(headerData.company_type ?? "");
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
      if (companyName) sessionStorage.setItem(STORAGE_KEYS.COMPANY, companyName);
      else sessionStorage.removeItem(STORAGE_KEYS.COMPANY);
      if (companyType) sessionStorage.setItem(STORAGE_KEYS.COMPANY_TYPE, companyType);
      else sessionStorage.removeItem(STORAGE_KEYS.COMPANY_TYPE);
      if (profile) {
        sessionStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
      }
    } catch {
      // ignore storage errors
    }
  }, [companyName, profile]);

  return (
    <SidebarProvider>
      <div className="app-shell relative min-h-screen w-screen flex bg-[#f3f4f6] overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          aria-hidden="true"
        >
          <div className="h-full w-full bg-[#f3f4f6] blur-md scale-105" />
          <div className="absolute inset-0 bg-white/08" />
        </div>
        <div
          className="fixed left-0 top-0 bottom-0 z-40 transition-[width] duration-200 ease-linear"
          style={{ width: "var(--app-sidebar-width, 14rem)", backgroundColor: "#2f3134" }}
        >
          <AppSidebar isCollapsed={isCollapsed} />
        </div>
        <div
          className="flex-shrink-0 transition-[width] duration-200 ease-linear"
          style={{ width: "var(--app-sidebar-width, 14rem)" }}
          aria-hidden="true"
        />
        <div className="flex flex-1 min-h-screen flex-col bg-transparent">
          <header
            ref={headerRef}
            className="fixed top-0 z-40 bg-transparent transition-[left] duration-200 ease-linear"
            style={{ left: "var(--app-sidebar-width, 14rem)", right: 0 }}
          >
            <div className="relative w-full bg-white pl-6 pr-6 py-1 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCollapsed((prev) => !prev)}
                  className="h-9 w-9 -ml-2 p-0 flex items-center justify-start text-slate-700 hover:text-blue-600"
                >
                  <Icon
                    icon="material-symbols:menu-open-sharp"
                    width={22}
                    height={22}
                    className={isCollapsed ? "rotate-180" : undefined}
                  />
                  <span className="sr-only">Toggle sidebar</span>
                </button>
                {headerTitle ? (
                  <div className="flex flex-col gap-1">
                    <h1 className="text-xl font-semibold text-slate-900">{headerTitle}</h1>
                    {headerDescription && (
                      <p className="text-xs text-slate-600">{headerDescription}</p>
                    )}
                  </div>
                ) : (
                  companyName && (
                    <h1 className="text-sm font-semibold -ml-1">
                      {companyName}
                      {companyType ? ` ${companyType}` : ""}
                    </h1>
                  )
                )}
              </div>
              {profile && (
                <div className="flex items-center gap-3">
                  <span className="h-10 w-px bg-slate-200 self-center" aria-hidden="true" />
                  <div className="flex flex-col items-end text-right leading-tight">
                    <span className="text-xs font-medium text-slate-700">
                      Hi, {profile.user_name} {profile.user_surname}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </header>

          <div className="flex-1 min-w-0 flex flex-col bg-transparent pt-[var(--app-header-height,5rem)]">
            <main className="flex-1 w-full p-6">{children}</main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
