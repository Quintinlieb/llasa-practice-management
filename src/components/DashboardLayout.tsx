import { ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  loadMinimizedDocumentTabs,
  minimizedDocumentTabsChangedEvent,
  saveMinimizedDocumentTabs,
  type StoredMinimizedDocumentTab,
} from "@/lib/minimizedDocumentTabs";
import { Icon } from "@iconify/react";
import { Bell, Headset, Settings, Tag } from "lucide-react";
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
  HEADER_PROFILE: "header:profile",
} as const;
const APP_HEADER_HEIGHT = "52px";

type HeaderNotificationRow = {
  id: string;
  recipientUserId?: string;
  actorName: string;
  body: string;
  age: string;
};

const formatNotificationAge = (value: string | null | undefined) => {
  const safeValue = String(value || "").trim();
  if (!safeValue) return "";
  const timestamp = new Date(safeValue).getTime();
  if (Number.isNaN(timestamp)) return "";
  const diffMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
};

const getPageTitleFromPathname = (pathname: string) => {
  if (pathname.startsWith("/documents")) return "Documents";
  if (pathname.startsWith("/clients-2") || pathname.startsWith("/clients")) return "Clients";
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname.startsWith("/case-files")) return "Matters";
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
  const readCachedHeaderProfile = () => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEYS.HEADER_PROFILE);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<UserHeaderProfile> | null;
      if (!parsed) return null;
      return {
        user_name: String(parsed.user_name || "").trim(),
        user_surname: String(parsed.user_surname || "").trim(),
        user_email: String(parsed.user_email || "").trim(),
      } satisfies UserHeaderProfile;
    } catch {
      return null;
    }
  };
  const getMetadataHeaderProfile = () => {
    const metaName = String((user as any)?.user_metadata?.user_name || (user as any)?.user_metadata?.name || "").trim();
    const metaSurname = String((user as any)?.user_metadata?.user_surname || (user as any)?.user_metadata?.surname || "").trim();
    const email = String(user?.email || "").trim();
    if (!metaName && !metaSurname && !email) return null;
    return {
      user_name: metaName || "User",
      user_surname: metaSurname,
      user_email: email,
    } satisfies UserHeaderProfile;
  };
  const [profile, setProfile] = useState<UserHeaderProfile | null>(() => readCachedHeaderProfile());
  const [minimizedDocumentTabs, setMinimizedDocumentTabs] = useState<StoredMinimizedDocumentTab[]>(() =>
    loadMinimizedDocumentTabs(),
  );
  const [headerNotifications, setHeaderNotifications] = useState<HeaderNotificationRow[]>([]);
  const [isNotificationsMenuOpen, setIsNotificationsMenuOpen] = useState(false);

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
    document.documentElement.style.setProperty("--app-header-height", APP_HEADER_HEIGHT);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      try {
        sessionStorage.removeItem(STORAGE_KEYS.HEADER_PROFILE);
      } catch {
        // ignore storage errors
      }
      return;
    }

    let isMounted = true;
    const metadataProfile = getMetadataHeaderProfile();
    if (metadataProfile) {
      setProfile((current) => current ?? metadataProfile);
    }

    const loadProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_name, user_surname, user_email")
        .eq("id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (data) {
        const resolvedProfile = data as UserHeaderProfile;
        setProfile(resolvedProfile);
        try {
          sessionStorage.setItem(STORAGE_KEYS.HEADER_PROFILE, JSON.stringify(resolvedProfile));
        } catch {
          // ignore storage errors
        }
        return;
      }

      const { data: subuserData } = await (supabase as any)
        .from("subusers")
        .select("name,surname,email")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (subuserData) {
        const resolvedProfile = {
          user_name: String((subuserData as any).name || "").trim(),
          user_surname: String((subuserData as any).surname || "").trim(),
          user_email: String((subuserData as any).email || user.email || "").trim(),
        } satisfies UserHeaderProfile;
        setProfile(resolvedProfile);
        try {
          sessionStorage.setItem(STORAGE_KEYS.HEADER_PROFILE, JSON.stringify(resolvedProfile));
        } catch {
          // ignore storage errors
        }
        return;
      }

      const fallbackProfile =
        metadataProfile ??
        ({
          user_name: "User",
          user_surname: "",
          user_email: String(user.email || "").trim(),
        } satisfies UserHeaderProfile);
      setProfile(fallbackProfile);
      try {
        sessionStorage.setItem(STORAGE_KEYS.HEADER_PROFILE, JSON.stringify(fallbackProfile));
      } catch {
        // ignore storage errors
      }
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

  const loadHeaderNotifications = useCallback(async () => {
    if (!user?.id) {
      setHeaderNotifications([]);
      return;
    }

    const { data, error } = await (supabase as any).rpc("get_my_notifications_for_user", {
      target_user_id: user.id,
      limit_count: 12,
    });

    if (error) {
      setHeaderNotifications([]);
      return;
    }

    const notifications = (Array.isArray(data) ? data : [])
      .map((row: any) => ({
        id: String(row?.id || ""),
        recipientUserId: String(row?.recipient_user_id || "").trim(),
        actorName: String(row?.actor_name || "").trim(),
        body: String(row?.body || "").trim(),
        age: formatNotificationAge(String(row?.created_at || "")),
      }))
      .filter((row) => row.id && row.body && row.recipientUserId === user.id);

    setHeaderNotifications(notifications);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setHeaderNotifications([]);
      return;
    }

    void loadHeaderNotifications();
  }, [loadHeaderNotifications, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const refreshNotifications = () => {
      void loadHeaderNotifications();
    };
    window.addEventListener("focus", refreshNotifications);
    document.addEventListener("visibilitychange", refreshNotifications);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadHeaderNotifications();
    });
    return () => {
      window.removeEventListener("focus", refreshNotifications);
      document.removeEventListener("visibilitychange", refreshNotifications);
      subscription.unsubscribe();
    };
  }, [loadHeaderNotifications, user?.id]);

  useEffect(() => {
    if (!isNotificationsMenuOpen || !user?.id) return;
    void loadHeaderNotifications();
  }, [isNotificationsMenuOpen, loadHeaderNotifications, user?.id]);

  const hasNewNotifications = headerNotifications.length > 0;

  const restoreMinimizedDocumentTab = (tabId: string) => {
    navigate("/documents", { state: { restoreMinimizedTabId: tabId } });
  };

  const dismissMinimizedDocumentTab = (tabId: string) => {
    saveMinimizedDocumentTabs(minimizedDocumentTabs.filter((tab) => tab.id !== tabId));
  };
  const openSettingsModal = () => {
    window.dispatchEvent(new CustomEvent("documents-force-close"));
    navigate("/settings", { state: { backgroundLocation: location } });
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
        <div className="flex flex-1 min-h-screen flex-col bg-[#2D4256]">
          <header
            ref={headerRef}
            className="fixed top-0 z-40 h-[52px] bg-transparent transition-[left] duration-200 ease-linear"
            style={{ left: "var(--app-sidebar-width, 14rem)", right: 0 }}
          >
            <div className="relative flex h-full w-full items-center justify-between bg-[#2D4256] pl-6 pr-6 shadow-sm">
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
                  <div className="pointer-events-none absolute left-[320px] right-[260px] flex items-center gap-2 overflow-x-auto py-1">
                    <span className="h-6 w-px bg-white/10 self-center" aria-hidden="true" />
                    {minimizedDocumentTabs.map((tab, index) => (
                      <div
                        key={tab.id}
                        className="group pointer-events-auto inline-flex items-center rounded-sm border border-white/10 bg-white/70 shadow-sm transition-colors hover:border-[#3eca44] hover:bg-[#3eca44]"
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
              <div className="relative z-10 flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={openSettingsModal}
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm text-white/70 transition-colors hover:bg-[#010D1A] hover:text-white"
                    aria-label="Settings"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                  <DropdownMenu open={isNotificationsMenuOpen} onOpenChange={setIsNotificationsMenuOpen}>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="relative inline-flex h-8 w-8 items-center justify-center rounded-sm text-white/70 transition-colors hover:bg-[#010D1A] hover:text-white data-[state=open]:bg-[#010D1A] data-[state=open]:text-white"
                        aria-label="Notifications"
                      >
                        <Bell className="h-4 w-4" />
                        <span
                          className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full ${
                            hasNewNotifications ? "bg-[#ef4444]" : "bg-[#3eca44]"
                          }`}
                        />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      sideOffset={10}
                      className="w-[360px] rounded-[12px] border border-slate-200 bg-white p-0 shadow-[0_20px_45px_rgba(15,23,42,0.16)]"
                    >
                      <div className="border-b border-slate-200 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[13px] font-semibold text-slate-900">Notifications</p>
                            <p className="mt-1 text-[11px] text-slate-500">Latest updates across your practice.</p>
                          </div>
                          <span className="rounded-full bg-[#eef9ef] px-2.5 py-1 text-[10px] font-semibold text-[#2f9f35]">
                            {headerNotifications.length} new
                          </span>
                        </div>
                      </div>

                      <div className="max-h-[420px] overflow-y-auto">
                        {headerNotifications.length === 0 ? (
                          <div className="px-4 py-6 text-center text-[11px] text-slate-500">
                            No new notifications yet.
                          </div>
                        ) : (
                          headerNotifications.map((row, index) => (
                            <div
                              key={row.id}
                              className={`flex gap-3 px-4 py-3 ${
                                index !== headerNotifications.length - 1 ? "border-b border-slate-100" : ""
                              }`}
                            >
                              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#eef9ef] text-[#2f9f35]">
                                <Tag className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <p className="text-[12px] text-slate-900">
                                    {row.actorName ? <span className="font-semibold">{row.actorName}</span> : null}
                                    {row.actorName ? " " : ""}
                                    {row.body.replace(new RegExp(`^${row.actorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"), "")}
                                  </p>
                                  <span className="shrink-0 text-[10px] text-slate-400">{row.age}</span>
                                </div>
                                <span className="mt-2 inline-flex text-[11px] font-semibold text-[#3267e3]">
                                  View
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-center">
                        <span className="text-[11px] font-semibold text-slate-500">Notification actions will be wired later.</span>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-white/70 transition-colors hover:bg-[#010D1A] hover:text-white"
                    aria-label="Support"
                  >
                    <Headset className="h-4 w-4" />
                  </button>
                </div>
                <span className="h-10 w-px bg-white/10 self-center" aria-hidden="true" />
                <div className="flex flex-col items-end text-right leading-tight min-w-[120px]">
                  <span className="text-xs font-medium text-white/70">
                    {profile ? `Hi, ${profile.user_name} ${profile.user_surname}`.trim() : "Hi, User"}
                  </span>
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 min-w-0 flex flex-col bg-[#2D4256] pt-[var(--app-header-height,5rem)]">
            <main className="flex-1 w-full p-6">{children}</main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
