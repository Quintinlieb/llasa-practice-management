import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  loadMinimizedDocumentTabs,
  minimizedDocumentTabsChangedEvent,
  saveMinimizedDocumentTabs,
  type StoredMinimizedDocumentTab,
} from "@/lib/minimizedDocumentTabs";
import { Icon } from "@iconify/react";
import { Bell, Headset, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DashboardLayoutProps {
  children: ReactNode;
  headerTitle?: string;
  headerDescription?: string;
  profileSubtitleMode?: "email" | "company";
  headerInlineContent?: ReactNode;
}

interface UserHeaderProfile {
  user_name: string;
  user_surname: string;
  user_email: string;
}

const STORAGE_KEYS = {
  SIDEBAR_COLLAPSED: "sidebar:collapsed",
} as const;

const getPageTitleFromPathname = (pathname: string) => {
  if (pathname.startsWith("/documents")) return "Documents";
  if (pathname.startsWith("/clients-2") || pathname.startsWith("/clients")) return "Clients";
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname.startsWith("/case-files")) return "Case Files";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/terms")) return "Terms and Conditions";
  if (pathname.startsWith("/auth")) return "Authentication";
  if (pathname.startsWith("/reset-password")) return "Reset Password";
  return "";
};

export default function DashboardLayout({
  children,
  headerTitle,
  headerDescription,
  profileSubtitleMode = "email",
  headerInlineContent,
}: DashboardLayoutProps) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const headerRef = useRef<HTMLElement | null>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === "1";
    } catch {
      return false;
    }
  });
  const resolvedHeaderTitle = headerTitle ?? getPageTitleFromPathname(location.pathname);
  const [profile, setProfile] = useState<UserHeaderProfile | null>(null);
  const [minimizedDocumentTabs, setMinimizedDocumentTabs] = useState<StoredMinimizedDocumentTab[]>(() =>
    loadMinimizedDocumentTabs(),
  );

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED);
      if (stored === null) {
        setIsCollapsed(false);
      }
    } catch {
      setIsCollapsed(false);
    }
  }, []);

  useLayoutEffect(() => {
    const width = isCollapsed ? "5rem" : "11.5rem";
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
    if (!user?.id) {
      setProfile(null);
      return;
    }

    let isMounted = true;

    const loadProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_name, user_surname, user_email")
        .eq("id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (data) {
        setProfile(data as UserHeaderProfile);
        return;
      }

      const { data: subuserData } = await (supabase as any)
        .from("subusers")
        .select("name,surname,email")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (subuserData) {
        setProfile({
          user_name: String((subuserData as any).name || "").trim(),
          user_surname: String((subuserData as any).surname || "").trim(),
          user_email: String((subuserData as any).email || user.email || "").trim(),
        });
        return;
      }

      const metaName = String((user as any)?.user_metadata?.user_name || (user as any)?.user_metadata?.name || "").trim();
      const metaSurname = String((user as any)?.user_metadata?.user_surname || (user as any)?.user_metadata?.surname || "").trim();
      const email = String(user.email || "").trim();

      setProfile({
        user_name: metaName || "User",
        user_surname: metaSurname,
        user_email: email,
      });
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    const syncTabs = () => setMinimizedDocumentTabs(loadMinimizedDocumentTabs());
    syncTabs();
    window.addEventListener(minimizedDocumentTabsChangedEvent, syncTabs);
    return () => window.removeEventListener(minimizedDocumentTabsChangedEvent, syncTabs);
  }, []);

  const restoreMinimizedDocumentTab = (tabId: string) => {
    navigate("/documents", { state: { restoreMinimizedTabId: tabId } });
  };

  const dismissMinimizedDocumentTab = (tabId: string) => {
    saveMinimizedDocumentTabs(minimizedDocumentTabs.filter((tab) => tab.id !== tabId));
  };

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
            <div className="relative flex w-full items-center justify-between bg-[#2D4256] pl-6 pr-6 py-1 shadow-sm">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCollapsed((prev) => !prev)}
                  className="flex h-9 w-9 -ml-2 items-center justify-start p-0 text-white/70 transition-colors hover:text-white"
                >
                  <Icon
                    icon="material-symbols:menu-open-sharp"
                    width={22}
                    height={22}
                    className={isCollapsed ? "rotate-180" : undefined}
                  />
                  <span className="sr-only">Toggle sidebar</span>
                </button>
                {resolvedHeaderTitle ? (
                  <div className="flex flex-col gap-1">
                    <h1 className="text-xl font-semibold text-white/80">{resolvedHeaderTitle}</h1>
                    {headerDescription && (
                      <p className="text-xs text-white/60">{headerDescription}</p>
                    )}
                  </div>
                ) : null}
                {headerInlineContent ? <div className="flex items-center gap-2">{headerInlineContent}</div> : null}
                {minimizedDocumentTabs.length > 0 ? (
                  <div className="absolute left-[320px] right-[260px] flex items-center gap-2 overflow-x-auto py-1">
                    <span className="h-6 w-px bg-white/10 self-center" aria-hidden="true" />
                    {minimizedDocumentTabs.map((tab, index) => (
                      <div
                        key={tab.id}
                        className="group inline-flex items-center rounded-sm border border-white/10 bg-white/70 shadow-sm transition-colors hover:border-[#3eca44] hover:bg-[#3eca44]"
                      >
                        <button
                          type="button"
                          onClick={() => restoreMinimizedDocumentTab(tab.id)}
                          className="inline-flex h-6 items-center px-2.5 text-[10px] font-semibold text-[#2D4256] transition-colors group-hover:text-[#2D4256]"
                        >
                          {`${tab.label} (${index + 1})`}
                        </button>
                        <button
                          type="button"
                          onClick={() => dismissMinimizedDocumentTab(tab.id)}
                          className="inline-flex h-6 w-0 items-center justify-center overflow-hidden border-l border-transparent text-[#2D4256] opacity-0 transition-all duration-150 group-hover:w-6 group-hover:border-l-[#2D4256]/20 group-hover:opacity-100 group-hover:text-[#2D4256] hover:!text-white/70"
                          aria-label={`Close ${tab.label} tab`}
                        >
                          <span className="text-[10px] leading-none">x</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              {profile ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-white/70 transition-colors hover:bg-[#010D1A] hover:text-white"
                      aria-label="Settings"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-white/70 transition-colors hover:bg-[#010D1A] hover:text-white"
                      aria-label="Notifications"
                    >
                      <Bell className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-white/70 transition-colors hover:bg-[#010D1A] hover:text-white"
                      aria-label="Support"
                    >
                      <Headset className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="h-10 w-px bg-white/10 self-center" aria-hidden="true" />
                  <div className="flex flex-col items-end text-right leading-tight">
                    <span className="text-xs font-medium text-white/70">
                      Hi, {profile.user_name} {profile.user_surname}
                    </span>
                  </div>
                </div>
              ) : null}
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
