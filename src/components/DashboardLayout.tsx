import { ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ArrowPathRoundedSquareIcon } from "@heroicons/react/24/outline";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  loadMinimizedDocumentTabs,
  minimizedDocumentTabsChangedEvent,
  saveMinimizedDocumentTabs,
  type StoredMinimizedDocumentTab,
} from "@/lib/minimizedDocumentTabs";
import {
  cacheHeaderProfile,
  readCachedHeaderProfile,
  type HeaderProfileCacheValue,
} from "@/lib/headerProfileCache";
import { resolveProfilePictureUrl } from "@/lib/profilePictures";
import { Icon } from "@iconify/react";
import { Bell, Calendar, Headset, Settings, Tag, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
  headerTitle?: string;
  headerDescription?: string;
  profileSubtitleMode?: "email" | "company";
  headerInlineContent?: ReactNode;
}

type UserHeaderProfile = HeaderProfileCacheValue;

type HeaderProfileUpdatedDetail = UserHeaderProfile;

const STORAGE_KEYS = {
  SIDEBAR_COLLAPSED: "sidebar:collapsed",
  HEADER_PROFILE_COLLAPSED: "header:profile-collapsed",
} as const;
const APP_HEADER_HEIGHT = "52px";

type HeaderNotificationRow = {
  id: string;
  recipientUserId?: string;
  actorName: string;
  body: string;
  age: string;
  isRead: boolean;
  sourceTable: string;
  sourceRecordId: string;
  sourceParentId: string;
  notePreview: string;
};

type TrashTabValue = "clients" | "documents" | "matters";

type TrashClientRow = {
  id: string;
  name: string;
  deletedAt: string;
};

type TrashDocumentRow = {
  id: string;
  documentName: string;
  clientName: string;
  deletedAt: string;
};

type TrashMatterRow = {
  id: string;
  fileNumber: string;
  parties: string;
  matterType: string;
  deletedAt: string;
};

const TRASH_BIN_TABLE_PAGE_SIZE = 10;

const supportContacts = [
  {
    name: "Quintin Liebenberg",
    role: "CEO",
    cell: "073 845 1557",
    email: "qliebenberg@llasa.co.za",
    imageSrc: "/support-headshots/quintin.jpg",
  },
  {
    name: "Mildrid Ellis",
    role: "Founder",
    cell: "083 393 8527",
    email: "ml@llasa.co.za",
    imageSrc: "/support-headshots/mildrid.jpg",
  },
  {
    name: "Willem Olivier",
    role: "Head of Compliance",
    cell: "076 920 8861",
    email: "wolivier@llasa.co.za",
    imageSrc: "/support-headshots/willem.jpg",
  },
  {
    name: "Nelisiwe Mhlongo",
    role: "Administrator",
    cell: "071 191 0373",
    email: "admin@llasa.co.za",
    imageSrc: "/support-headshots/nelisiwe.jpg",
  },
  {
    name: "Jaco Nienaber",
    role: "IT Support",
    cell: "082 445 9094",
    email: "jaco@rootsict.co.za",
    imageSrc: "/support-headshots/jaco.jpg",
  },
] as const;

const companyTypeSuffixByValue: Record<string, string> = {
  "Private Company ((Pty) Ltd)": "(Pty) Ltd",
  "Public Company (Ltd)": "Ltd",
  "Personal Liability Company (Inc.)": "Inc.",
  "State-Owned Company (SOC Ltd)": "SOC Ltd",
  "Non-Profit Company (NPC)": "NPC",
  "Close Corporation (CC)": "CC",
  "Co-operative (Co-op)": "Co-op",
  "Sole Proprietor (SP)": "SP",
  "Partnership (Partnership)": "Partnership",
  "Business Trust (Trust)": "Trust",
};

const appendCompanyTypeSuffix = (registeredName: string, companyType: string) => {
  const suffix = companyTypeSuffixByValue[companyType] || "";
  if (!suffix) return registeredName;
  const normalizedName = registeredName.toLowerCase();
  const normalizedSuffix = suffix.toLowerCase();
  if (normalizedName.endsWith(normalizedSuffix)) return registeredName;
  return `${registeredName} ${suffix}`;
};

const formatTrashClientName = (registeredName: unknown, companyType: unknown, tradingAs: unknown) => {
  const registered = String(registeredName ?? "").trim();
  const type = String(companyType ?? "").trim();
  const trading = String(tradingAs ?? "").trim();
  const registeredWithType = registered ? appendCompanyTypeSuffix(registered, type) : "";
  if (
    registeredWithType &&
    trading &&
    trading.toLowerCase() !== registered.toLowerCase() &&
    trading.toLowerCase() !== registeredWithType.toLowerCase()
  ) {
    return `${registeredWithType} t/a ${trading}`;
  }
  return registeredWithType || trading || "--";
};

const formatTrashDeletedAt = (value: string) => {
  const raw = String(value || "").trim();
  if (!raw) return "--";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const getPaginationNumbers = (currentPage: number, totalPages: number) => {
  if (totalPages <= 6) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (currentPage <= 3) {
    return [1, 2, 3, 4, "ellipsis", totalPages];
  }
  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis-2", totalPages];
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

const getNotificationBodyText = (notification: HeaderNotificationRow) => {
  const actorName = notification.actorName.trim();
  const body = notification.body.trim();
  const bodyWithoutActor = actorName
    ? body.replace(new RegExp(`^${actorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"), "")
    : body;
  if (bodyWithoutActor && !/matter\/client file/i.test(bodyWithoutActor)) return bodyWithoutActor;
  if (notification.sourceTable === "case_notes") return "has tagged you in a matter.";
  if (notification.sourceTable === "client_file_notes") return "has tagged you in a client file.";
  return bodyWithoutActor;
};

const getPageTitleFromPathname = (pathname: string) => {
  if (pathname.startsWith("/documents")) return "Documents";
  if (pathname.startsWith("/clients-2") || pathname.startsWith("/clients")) return "Clients";
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname.startsWith("/case-files")) return "Matters";
  if (pathname.startsWith("/calendar")) return "Calendar";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/terms")) return "Terms and Conditions";
  if (pathname.startsWith("/auth")) return "Authentication";
  if (pathname.startsWith("/reset-password")) return "Reset Password";
  return "";
};

const formatPageDateStamp = () =>
  new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export function PageDateStamp({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-2 px-0 py-0 text-[11px] font-semibold text-white/75", className)}>
      <span>{formatPageDateStamp()}</span>
      <div className="flex h-5 w-5 items-center justify-center">
        <Calendar className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
  headerTitle,
  headerDescription,
  profileSubtitleMode = "email",
  headerInlineContent,
}: DashboardLayoutProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const headerRef = useRef<HTMLElement | null>(null);
  const headerProfileContentRef = useRef<HTMLDivElement | null>(null);
  const [isTrashBinOpen, setIsTrashBinOpen] = useState(false);
  const [activeTrashTab, setActiveTrashTab] = useState<TrashTabValue>("clients");
  const [isTrashBinLoading, setIsTrashBinLoading] = useState(false);
  const [isTrashActionLoading, setIsTrashActionLoading] = useState(false);
  const [isCurrentUserSubuser, setIsCurrentUserSubuser] = useState(false);
  const [trashClients, setTrashClients] = useState<TrashClientRow[]>([]);
  const [trashDocuments, setTrashDocuments] = useState<TrashDocumentRow[]>([]);
  const [trashMatters, setTrashMatters] = useState<TrashMatterRow[]>([]);
  const [trashClientsPage, setTrashClientsPage] = useState(1);
  const [trashDocumentsPage, setTrashDocumentsPage] = useState(1);
  const [trashMattersPage, setTrashMattersPage] = useState(1);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === "1";
    } catch {
      return false;
    }
  });
  const resolvedHeaderTitle = headerTitle ?? getPageTitleFromPathname(location.pathname);
  const getMetadataHeaderProfile = () => {
    const metaName = String((user as any)?.user_metadata?.user_name || (user as any)?.user_metadata?.name || "").trim();
    const metaSurname = String((user as any)?.user_metadata?.user_surname || (user as any)?.user_metadata?.surname || "").trim();
    const email = String(user?.email || "").trim();
    if (!metaName && !metaSurname && !email) return null;
    return {
      user_name: metaName || "User",
      user_surname: metaSurname,
      user_email: email,
      profile_picture: "",
    } satisfies UserHeaderProfile;
  };
  const [profile, setProfile] = useState<UserHeaderProfile | null>(() => readCachedHeaderProfile(user?.id));
  const [minimizedDocumentTabs, setMinimizedDocumentTabs] = useState<StoredMinimizedDocumentTab[]>(() =>
    loadMinimizedDocumentTabs(),
  );
  const orderedMinimizedDocumentTabs = useMemo(
    () => [...minimizedDocumentTabs].sort((left, right) => (left.minimizedOrder ?? 0) - (right.minimizedOrder ?? 0)),
    [minimizedDocumentTabs],
  );
  const minimizedTabDisplayLabels = useMemo(() => {
    const countsByDocumentKey = new Map<string, number>();
    orderedMinimizedDocumentTabs.forEach((tab) => {
      countsByDocumentKey.set(tab.documentKey, (countsByDocumentKey.get(tab.documentKey) ?? 0) + 1);
    });

    return orderedMinimizedDocumentTabs.map((tab) => {
      const total = countsByDocumentKey.get(tab.documentKey) ?? 0;
      if (total <= 1) return tab.label;
      if (typeof tab.instanceNumber === "number" && Number.isFinite(tab.instanceNumber)) {
        return tab.instanceNumber <= 1 ? tab.label : `${tab.label} (${tab.instanceNumber - 1})`;
      }
      return tab.label;
    });
  }, [orderedMinimizedDocumentTabs]);
  const [headerNotifications, setHeaderNotifications] = useState<HeaderNotificationRow[]>([]);
  const [isHeaderProfileCollapsed, setIsHeaderProfileCollapsed] = useState<boolean>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEYS.HEADER_PROFILE_COLLAPSED);
      return stored === null ? true : stored === "1";
    } catch {
      return true;
    }
  });
  const [expandedHeaderProfileWidth, setExpandedHeaderProfileWidth] = useState(40);
  const greetingLabel = profile ? `Hi, ${profile.user_name} ${profile.user_surname}`.trim() : "Hi, User";
  const headerProfileInitials = `${String(profile?.user_name || "").trim().charAt(0)}${String(profile?.user_surname || "").trim().charAt(0)}`
    .trim()
    .toUpperCase() || "U";

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

  useEffect(() => {
    try {
      sessionStorage.setItem(
        STORAGE_KEYS.HEADER_PROFILE_COLLAPSED,
        isHeaderProfileCollapsed ? "1" : "0",
      );
    } catch {
      // ignore storage errors
    }
  }, [isHeaderProfileCollapsed]);

  useEffect(() => {
    if (!user?.id) return;
    setIsHeaderProfileCollapsed(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || isHeaderProfileCollapsed) return;
    const timer = window.setTimeout(() => {
      setIsHeaderProfileCollapsed(true);
    }, 10000);
    return () => window.clearTimeout(timer);
  }, [isHeaderProfileCollapsed, user?.id]);

  useLayoutEffect(() => {
    const contentWidth = headerProfileContentRef.current?.scrollWidth ?? 0;
    const avatarWidth = 40;
    const widthBuffer = 12;
    const nextWidth = avatarWidth + (contentWidth > 0 ? contentWidth : 0) + widthBuffer;
    setExpandedHeaderProfileWidth((currentWidth) =>
      Math.abs(currentWidth - nextWidth) < 1 ? currentWidth : nextWidth,
    );
  }, [greetingLabel, profile?.user_email, isHeaderProfileCollapsed]);

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
      return;
    }

    let isMounted = true;
    const cachedProfile = readCachedHeaderProfile(user.id);
    if (cachedProfile) {
      setProfile(cachedProfile);
    } else {
      setProfile(null);
    }
    const metadataProfile = getMetadataHeaderProfile();
    if (metadataProfile) {
      setProfile((current) => current ?? metadataProfile);
    }

    const handleHeaderProfileUpdated = (event: Event) => {
      const detail = (event as CustomEvent<HeaderProfileUpdatedDetail | null>).detail;
      if (!detail) return;
      if (!isMounted) return;
      setProfile(detail);
      cacheHeaderProfile(user.id, detail);
    };
    window.addEventListener("header-profile-updated", handleHeaderProfileUpdated);

    const loadProfile = async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("user_name, user_surname, user_email, profile_picture")
        .eq("id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (data) {
        const resolvedProfile = {
          ...(data as UserHeaderProfile),
          profile_picture: resolveProfilePictureUrl((data as any).profile_picture),
        } satisfies UserHeaderProfile;
        setProfile(resolvedProfile);
        cacheHeaderProfile(user.id, resolvedProfile);
        return;
      }

      const { data: subuserData } = await (supabase as any)
        .from("subusers")
        .select("name,surname,email,profile_picture")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (subuserData) {
        const resolvedProfile = {
          user_name: String((subuserData as any).name || "").trim(),
          user_surname: String((subuserData as any).surname || "").trim(),
          user_email: String((subuserData as any).email || user.email || "").trim(),
          profile_picture: resolveProfilePictureUrl((subuserData as any).profile_picture),
        } satisfies UserHeaderProfile;
        setProfile(resolvedProfile);
        cacheHeaderProfile(user.id, resolvedProfile);
        return;
      }

      const fallbackProfile =
        metadataProfile ??
        ({
          user_name: "User",
          user_surname: "",
          user_email: String(user.email || "").trim(),
          profile_picture: "",
        } satisfies UserHeaderProfile);
      setProfile(fallbackProfile);
      cacheHeaderProfile(user.id, fallbackProfile);
    };

    void loadProfile();

    return () => {
      isMounted = false;
      window.removeEventListener("header-profile-updated", handleHeaderProfileUpdated);
    };
  }, [
    user?.email,
    user?.id,
    (user as any)?.user_metadata?.name,
    (user as any)?.user_metadata?.surname,
    (user as any)?.user_metadata?.user_name,
    (user as any)?.user_metadata?.user_surname,
  ]);

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
        isRead: Boolean(row?.is_read),
        sourceTable: String(row?.source_table || "").trim(),
        sourceRecordId: String(row?.source_record_id || "").trim(),
        sourceParentId: String(row?.source_parent_id || "").trim(),
        notePreview: String(row?.metadata?.note_preview || "").trim(),
      }))
      .filter((row) => row.id && row.body && row.recipientUserId === user.id && !row.isRead);

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
    let isMounted = true;
    const loadCurrentUserDeletionScope = async () => {
      if (!user?.id) {
        if (isMounted) setIsCurrentUserSubuser(false);
        return;
      }
      const { data } = await (supabase as any)
        .from("subusers")
        .select("auth_user_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (!isMounted) return;
      setIsCurrentUserSubuser(Boolean(data?.auth_user_id));
    };
    void loadCurrentUserDeletionScope();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

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

  const hasNewNotifications = headerNotifications.length > 0;

  const restoreMinimizedDocumentTab = (tabId: string) => {
    navigate("/documents", { state: { restoreMinimizedTabId: tabId } });
  };

  const dismissMinimizedDocumentTab = (tabId: string) => {
    saveMinimizedDocumentTabs(minimizedDocumentTabs.filter((tab) => tab.id !== tabId));
  };
  const loadTrashBinData = useCallback(async () => {
    setIsTrashBinLoading(true);
    try {
      const [clientsResult, documentsResult, mattersResult] = await Promise.all([
        (supabase as any)
          .from("clients")
          .select("id,registered_name,company_type,trading_as,status,deleted_at")
          .eq("deleted", true)
          .order("deleted_at", { ascending: false, nullsFirst: false }),
        (supabase as any)
          .from("documents")
          .select("id,document_name,document_type,client_name,deleted_at")
          .eq("deleted", true)
          .order("deleted_at", { ascending: false, nullsFirst: false }),
        (supabase as any)
          .from("case_files")
          .select("id,file_number,parties,case_type,case_subtype,deleted_at")
          .eq("deleted", true)
          .order("deleted_at", { ascending: false, nullsFirst: false }),
      ]);

      if (clientsResult.error) throw clientsResult.error;
      if (documentsResult.error) throw documentsResult.error;
      if (mattersResult.error) throw mattersResult.error;

      setTrashClients(
        (Array.isArray(clientsResult.data) ? clientsResult.data : []).map((row: any) => ({
          id: String(row?.id ?? ""),
          name: formatTrashClientName(row?.registered_name, row?.company_type, row?.trading_as),
          deletedAt: String(row?.deleted_at ?? "").trim(),
        })),
      );
      setTrashDocuments(
        (Array.isArray(documentsResult.data) ? documentsResult.data : []).map((row: any) => ({
          id: String(row?.id ?? ""),
          documentName: String(row?.document_name ?? "").trim() || "--",
          clientName: String(row?.client_name ?? "").trim() || "--",
          deletedAt: String(row?.deleted_at ?? "").trim(),
        })),
      );
      setTrashMatters(
        (Array.isArray(mattersResult.data) ? mattersResult.data : []).map((row: any) => ({
          id: String(row?.id ?? ""),
          fileNumber: String(row?.file_number ?? "").trim() || "--",
          parties: String(row?.parties ?? "").trim() || "--",
          matterType: [String(row?.case_type ?? "").trim(), String(row?.case_subtype ?? "").trim()].filter(Boolean).join(" / ") || "--",
          deletedAt: String(row?.deleted_at ?? "").trim(),
        })),
      );
    } catch (error: any) {
      toast({
        title: "Trash Bin load failed",
        description: error?.message || "Could not load trashed items.",
        variant: "destructive",
      });
    } finally {
      setIsTrashBinLoading(false);
    }
  }, [toast]);
  const openSettingsModal = () => {
    window.dispatchEvent(new CustomEvent("documents-force-close"));
    navigate("/settings", { state: { backgroundLocation: location } });
  };
  const openTrashBinModal = () => {
    window.dispatchEvent(new CustomEvent("documents-force-close"));
    setIsTrashBinOpen(true);
  };
  const restoreTrashItem = useCallback(async (table: "clients" | "documents" | "case_files", id: string) => {
    try {
      setIsTrashActionLoading(true);
      const { error } = await (supabase as any)
        .from(table)
        .update({ deleted: false, deleted_at: null })
        .eq("id", id);
      if (error) throw error;
      await loadTrashBinData();
      window.dispatchEvent(new CustomEvent("trash-bin-changed"));
      toast({
        title: "Item restored",
        description: "The item has been restored successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Restore failed",
        description: error?.message || "Could not restore the item.",
        variant: "destructive",
      });
    } finally {
      setIsTrashActionLoading(false);
    }
  }, [loadTrashBinData, toast]);
  const hardDeleteTrashItem = useCallback(async (table: "clients" | "documents" | "case_files", id: string) => {
    if (isCurrentUserSubuser) {
      toast({
        title: "Delete not allowed",
        description: "Only the master user can permanently delete items.",
        variant: "destructive",
      });
      return;
    }
    const confirmed = window.confirm("Are you sure you want to permanently delete this item?");
    if (!confirmed) return;
    try {
      setIsTrashActionLoading(true);
      if (table === "clients") {
        const { data: contracts } = await (supabase as any).from("membership_contracts").select("file_url").eq("client_id", id);
        const contractFiles = (contracts ?? []).map((row: any) => String(row?.file_url || "").trim()).filter(Boolean);
        if (contractFiles.length > 0) {
          await supabase.storage.from("contracts").remove(contractFiles);
        }
        const { data: clientData } = await (supabase as any).from("clients").select("logo_storage_path").eq("id", id).maybeSingle();
        const logoPath = String(clientData?.logo_storage_path || "").trim();
        if (logoPath) {
          await supabase.storage.from("client-logos").remove([logoPath]);
        }
        await (supabase as any).from("client_file_notes").delete().eq("client_id", id);
        await (supabase as any).from("membership_contracts").delete().eq("client_id", id);
        await (supabase as any).from("client_logos").delete().eq("client_id", id);
        const { error } = await (supabase as any).from("clients").delete().eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from(table).delete().eq("id", id);
        if (error) throw error;
      }
      await loadTrashBinData();
      window.dispatchEvent(new CustomEvent("trash-bin-changed"));
      toast({
        title: "Item permanently deleted",
        description: "The item has been permanently removed.",
      });
    } catch (error: any) {
      toast({
        title: "Permanent delete failed",
        description: error?.message || "Could not permanently delete the item.",
        variant: "destructive",
      });
    } finally {
      setIsTrashActionLoading(false);
    }
  }, [isCurrentUserSubuser, loadTrashBinData, toast]);
  const totalTrashClientsPages = Math.max(1, Math.ceil(trashClients.length / TRASH_BIN_TABLE_PAGE_SIZE));
  const currentTrashClientsPage = Math.min(trashClientsPage, totalTrashClientsPages);
  const paginatedTrashClients = useMemo(
    () => trashClients.slice((currentTrashClientsPage - 1) * TRASH_BIN_TABLE_PAGE_SIZE, currentTrashClientsPage * TRASH_BIN_TABLE_PAGE_SIZE),
    [currentTrashClientsPage, trashClients],
  );
  const trashClientsPageNumbers = useMemo(
    () => getPaginationNumbers(currentTrashClientsPage, totalTrashClientsPages),
    [currentTrashClientsPage, totalTrashClientsPages],
  );
  const totalTrashDocumentsPages = Math.max(1, Math.ceil(trashDocuments.length / TRASH_BIN_TABLE_PAGE_SIZE));
  const currentTrashDocumentsPage = Math.min(trashDocumentsPage, totalTrashDocumentsPages);
  const paginatedTrashDocuments = useMemo(
    () => trashDocuments.slice((currentTrashDocumentsPage - 1) * TRASH_BIN_TABLE_PAGE_SIZE, currentTrashDocumentsPage * TRASH_BIN_TABLE_PAGE_SIZE),
    [currentTrashDocumentsPage, trashDocuments],
  );
  const trashDocumentsPageNumbers = useMemo(
    () => getPaginationNumbers(currentTrashDocumentsPage, totalTrashDocumentsPages),
    [currentTrashDocumentsPage, totalTrashDocumentsPages],
  );
  const totalTrashMattersPages = Math.max(1, Math.ceil(trashMatters.length / TRASH_BIN_TABLE_PAGE_SIZE));
  const currentTrashMattersPage = Math.min(trashMattersPage, totalTrashMattersPages);
  const paginatedTrashMatters = useMemo(
    () => trashMatters.slice((currentTrashMattersPage - 1) * TRASH_BIN_TABLE_PAGE_SIZE, currentTrashMattersPage * TRASH_BIN_TABLE_PAGE_SIZE),
    [currentTrashMattersPage, trashMatters],
  );
  const trashMattersPageNumbers = useMemo(
    () => getPaginationNumbers(currentTrashMattersPage, totalTrashMattersPages),
    [currentTrashMattersPage, totalTrashMattersPages],
  );
  useEffect(() => {
    setTrashClientsPage((prev) => Math.min(prev, totalTrashClientsPages));
  }, [totalTrashClientsPages]);
  useEffect(() => {
    setTrashDocumentsPage((prev) => Math.min(prev, totalTrashDocumentsPages));
  }, [totalTrashDocumentsPages]);
  useEffect(() => {
    setTrashMattersPage((prev) => Math.min(prev, totalTrashMattersPages));
  }, [totalTrashMattersPages]);
  useEffect(() => {
    setTrashClientsPage(1);
    setTrashDocumentsPage(1);
    setTrashMattersPage(1);
  }, [isTrashBinOpen]);
  useEffect(() => {
    if (!isTrashBinOpen) return;
    void loadTrashBinData();
  }, [isTrashBinOpen, loadTrashBinData]);

  useEffect(() => {
    const handleTrashBinChanged = () => {
      if (!isTrashBinOpen) return;
      void loadTrashBinData();
    };
    window.addEventListener("trash-bin-changed", handleTrashBinChanged);
    return () => window.removeEventListener("trash-bin-changed", handleTrashBinChanged);
  }, [isTrashBinOpen, loadTrashBinData]);
  const handleNotificationClick = async (notification: HeaderNotificationRow) => {
    setHeaderNotifications((current) => current.filter((row) => row.id !== notification.id));

    if (notification.id) {
      await (supabase as any)
        .from("notifications")
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq("id", notification.id);
    }

    let sourceTable = notification.sourceTable;
    let sourceParentId = notification.sourceParentId;
    let sourceRecordId = notification.sourceRecordId;

    if ((!sourceTable || !sourceParentId || !sourceRecordId) && notification.id) {
      const { data } = await (supabase as any)
        .from("notifications")
        .select("source_table,source_parent_id,source_record_id")
        .eq("id", notification.id)
        .maybeSingle();
      sourceTable = String(data?.source_table || "").trim();
      sourceParentId = String(data?.source_parent_id || "").trim();
      sourceRecordId = String(data?.source_record_id || "").trim();
    }

    if (sourceTable === "client_file_notes" && sourceParentId && sourceRecordId) {
      navigate("/clients-2", {
        state: {
          openClientId: sourceParentId,
          openClientNoteId: sourceRecordId,
        },
      });
      return;
    }
    if (sourceTable === "case_notes" && sourceParentId && sourceRecordId) {
      navigate("/case-files", {
        state: {
          openCaseId: sourceParentId,
          openCaseNoteId: sourceRecordId,
        },
      });
    }
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
              <div className="flex min-w-0 flex-1 items-center gap-2 pr-4">
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
                {headerInlineContent ? <div className="flex items-center gap-2">{headerInlineContent}</div> : null}
                {orderedMinimizedDocumentTabs.length > 0 ? (
                  <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1">
                    {orderedMinimizedDocumentTabs.map((tab, index) => (
                      <div
                        key={tab.id}
                        className="group inline-flex items-center rounded-sm border border-white/10 bg-white/70 shadow-sm transition-colors hover:border-[#3eca44] hover:bg-[#3eca44]"
                      >
                        <button
                          type="button"
                          onClick={() => restoreMinimizedDocumentTab(tab.id)}
                          className="inline-flex h-6 items-center px-2.5 text-[10px] font-semibold text-[#2D4256] transition-colors group-hover:text-[#2D4256]"
                        >
                          {minimizedTabDisplayLabels[index]}
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
                  {!isCurrentUserSubuser ? (
                    <button
                      type="button"
                      onClick={openTrashBinModal}
                      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm text-white/70 transition-colors hover:bg-[#010D1A] hover:text-white"
                      aria-label="Trash Bin"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={openSettingsModal}
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm text-white/70 transition-colors hover:bg-[#010D1A] hover:text-white"
                    aria-label="Settings"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                  <DropdownMenu>
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
                              className={`flex gap-3 border-l-[3px] border-l-transparent px-4 py-3 transition-colors hover:border-l-[#2f9f35] ${
                                index !== headerNotifications.length - 1 ? "border-b border-slate-100" : ""
                              }`}
                            >
                              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[#eef9ef] text-[#2f9f35]">
                                <Tag className="h-3.5 w-3.5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <p className="text-[11px] text-slate-900">
                                    {row.actorName ? <span className="font-semibold">{row.actorName}</span> : null}
                                    {row.actorName ? " " : ""}
                                    {getNotificationBodyText(row)}
                                    {" "}
                                    <button
                                      type="button"
                                      onClick={() => void handleNotificationClick(row)}
                                      className="inline-flex text-left text-[11px] font-medium text-slate-500 transition-colors hover:text-[#2f9f35] hover:underline"
                                    >
                                      View
                                    </button>
                                  </p>
                                  <span className="shrink-0 text-[10px] text-slate-400">{row.age}</span>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-white/70 transition-colors hover:bg-[#010D1A] hover:text-white data-[state=open]:bg-[#010D1A] data-[state=open]:text-white"
                        aria-label="Support contacts"
                      >
                        <Headset className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      sideOffset={10}
                      className="w-[360px] rounded-[12px] border border-slate-200 bg-white p-0 shadow-[0_20px_45px_rgba(15,23,42,0.16)]"
                    >
                      <div className="border-b border-slate-200 px-4 py-3">
                        <p className="text-[13px] font-semibold text-slate-900">Support Contacts</p>
                        <p className="mt-1 text-[11px] text-slate-500">Reach the relevant person directly.</p>
                      </div>
                      <div className="max-h-[420px] overflow-y-auto">
                        {supportContacts.map((contact, index) => (
                          <div
                            key={contact.email}
                            className={`group border-l-[3px] border-l-transparent pl-5 pr-4 py-3 transition-colors hover:border-l-[#2f9f35] hover:bg-[#eef9ef] ${
                              index !== supportContacts.length - 1 ? "border-b border-slate-100" : ""
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {contact.imageSrc ? (
                                <img
                                  src={contact.imageSrc}
                                  alt={contact.name}
                                  className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                                />
                              ) : (
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[12px] font-semibold text-slate-600 ring-1 ring-slate-200">
                                  {contact.name
                                    .split(" ")
                                    .filter(Boolean)
                                    .slice(0, 2)
                                    .map((part) => part[0])
                                    .join("")
                                    .toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-[14px] font-semibold text-slate-900 group-hover:underline group-hover:underline-offset-2">{contact.name}</p>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#2f9f35]">{contact.role}</p>
                                </div>
                                <div className="mt-0.5 text-[11px] text-slate-600">
                                  <p>
                                    <span>{contact.cell}</span>
                                    <span className="px-1.5 text-slate-400">|</span>
                                    <span>{contact.email}</span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <span className="mr-[5px] h-10 w-px bg-white/10 self-center" aria-hidden="true" />
                <div className="flex items-center justify-end">
                  <div
                    className={cn(
                      "group flex h-10 items-center overflow-hidden rounded-full border border-white/10 bg-[#010D1A]/45 shadow-sm transition-[width] duration-500 ease-out",
                    )}
                    style={{ width: isHeaderProfileCollapsed ? 40 : expandedHeaderProfileWidth }}
                  >
                    <button
                      type="button"
                      className="shrink-0"
                      onClick={() => setIsHeaderProfileCollapsed((prev) => !prev)}
                      aria-label={isHeaderProfileCollapsed ? "Expand profile card" : "Collapse profile card"}
                    >
                      {profile?.profile_picture ? (
                        <img
                          src={profile.profile_picture}
                          alt={greetingLabel}
                          className="h-10 w-10 rounded-full object-cover"
                          decoding="sync"
                          loading="eager"
                        />
                      ) : (
                        <Avatar className="h-10 w-10 rounded-full border-0">
                          <AvatarFallback className="bg-[#eef9ef] text-[11px] font-semibold text-[#2f9f35]">
                            {headerProfileInitials}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </button>
                    <div
                      ref={headerProfileContentRef}
                      className={cn(
                        "shrink-0 overflow-hidden whitespace-nowrap pl-3 pr-3 leading-none transition-opacity duration-300",
                        isHeaderProfileCollapsed ? "opacity-0" : "opacity-100",
                      )}
                    >
                      <p className="text-[11px] font-semibold text-white/85">{greetingLabel}</p>
                      {profile?.user_email ? <p className="mt-1 text-[10px] text-white/55">{profile.user_email}</p> : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 min-w-0 flex flex-col bg-[#2D4256] pt-[var(--app-header-height,5rem)]">
            <main className="flex-1 w-full p-6">{children}</main>
          </div>
        </div>
      </div>
      <Dialog open={isTrashBinOpen} onOpenChange={setIsTrashBinOpen}>
        <DialogContent
          className="w-[94vw] max-w-[980px] h-[92vh] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <div className="relative h-full">
            <div className="absolute inset-x-0 top-0 flex h-[46px] items-center justify-between px-4">
              <div className="flex items-center gap-2 pl-2">
                <Trash2 className="h-4 w-4 text-white" />
                <DialogTitle className="text-sm font-semibold text-white">Trash Bin</DialogTitle>
              </div>
              <DialogClose asChild>
                <button type="button" className="text-white hover:text-white/80" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </DialogClose>
            </div>

            <div className="mt-[46px] h-[calc(92vh-46px)] bg-white p-4">
              <Tabs value={activeTrashTab} onValueChange={(value) => setActiveTrashTab(value as TrashTabValue)} className="flex h-full min-h-0 flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200">
                  <TabsList className="h-auto flex-1 flex-wrap justify-start gap-0 bg-transparent px-0 py-0 shadow-none">
                    <TabsTrigger
                      value="clients"
                      className="rounded-none border-b-[3px] border-transparent px-5 py-1 text-left text-sm font-medium text-slate-500 data-[state=inactive]:hover:text-slate-800 data-[state=active]:bg-white data-[state=active]:border-[#3eca44] data-[state=active]:text-slate-900 data-[state=active]:shadow-none"
                    >
                      Clients
                    </TabsTrigger>
                    <TabsTrigger
                      value="documents"
                      className="rounded-none border-b-[3px] border-transparent px-5 py-1 text-left text-sm font-medium text-slate-500 data-[state=inactive]:hover:text-slate-800 data-[state=active]:bg-white data-[state=active]:border-[#3eca44] data-[state=active]:text-slate-900 data-[state=active]:shadow-none"
                    >
                      Documents
                    </TabsTrigger>
                    <TabsTrigger
                      value="matters"
                      className="rounded-none border-b-[3px] border-transparent px-5 py-1 text-left text-sm font-medium text-slate-500 data-[state=inactive]:hover:text-slate-800 data-[state=active]:bg-white data-[state=active]:border-[#3eca44] data-[state=active]:text-slate-900 data-[state=active]:shadow-none"
                    >
                      Matters
                    </TabsTrigger>
                  </TabsList>
                </div>

                <p className="mt-4 text-[12px] text-slate-500">Deleted items are moved here first and can be restored from this window.</p>

                <TabsContent value="clients" className="mt-4 flex-1 min-h-0 overflow-hidden">
                  <div className="flex h-full min-h-0 flex-col gap-3">
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm border border-slate-200">
                    <div className="grid grid-cols-[1fr_110px_86px] items-center gap-3 border-b border-slate-200 bg-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 [&>*+*]:border-l [&>*+*]:border-slate-200 [&>*+*]:pl-2">
                        <div>Client</div>
                        <div>Deleted On</div>
                        <div className="text-center">Action</div>
                      </div>
                      <div className="min-h-0 flex-1 overflow-y-auto text-[12px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        {isTrashBinLoading ? (
                          <div className="px-3 py-6 text-center text-[12px] text-slate-500">Loading...</div>
                        ) : trashClients.length === 0 ? (
                          <div className="px-3 py-6 text-center text-[12px] text-slate-500">No trashed clients.</div>
                        ) : (
                          paginatedTrashClients.map((row) => (
                            <div key={row.id} className="group grid grid-cols-[1fr_110px_86px] items-center gap-3 border-b border-slate-200 px-3 py-2 text-[12px] text-slate-700 transition-colors hover:bg-[#3eca44]/5 last:border-b-0 [&>*+*]:border-l [&>*+*]:border-slate-200 [&>*+*]:pl-2">
                              <div className="group-hover:font-semibold">{row.name}</div>
                              <div className="group-hover:font-semibold">{formatTrashDeletedAt(row.deletedAt)}</div>
                              <div className="flex justify-center gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button type="button" variant="ghost" className="h-7 w-7 rounded p-0 text-[#2f9f35] hover:bg-[#eaf8eb] hover:text-[#2f9f35]" onClick={() => void restoreTrashItem("clients", row.id)} disabled={isTrashActionLoading}>
                                      <ArrowPathRoundedSquareIcon className="h-4.5 w-4.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Restore</TooltipContent>
                                </Tooltip>
                                {!isCurrentUserSubuser ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button type="button" variant="ghost" className="h-7 w-7 rounded p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => void hardDeleteTrashItem("clients", row.id)} disabled={isTrashActionLoading}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Delete Permanently</TooltipContent>
                                  </Tooltip>
                                ) : null}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2 px-1">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 min-w-[86px] rounded-[4px] border border-[#8fd693] bg-white px-4 text-[11px] font-medium text-[#2f9f35] transition-colors hover:border-[#3eca44] hover:bg-[#eaf8eb] hover:text-[#2f9f35] disabled:border-[#d6ead7] disabled:text-[#a7c9a9]"
                        onClick={() => setTrashClientsPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentTrashClientsPage === 1 || isTrashBinLoading || trashClients.length === 0}
                      >
                        Previous
                      </Button>
                      {trashClientsPageNumbers.map((page) =>
                        typeof page === "number" ? (
                          <button
                            key={page}
                            type="button"
                            onClick={() => setTrashClientsPage(page)}
                            className={`flex h-8 min-w-8 items-center justify-center rounded-[4px] border px-3 text-[11px] font-medium transition-colors ${
                              page === currentTrashClientsPage
                                ? "border-[#3eca44] bg-[#3eca44] text-white"
                                : "border-[#b9e3bc] bg-white text-[#2f9f35] hover:border-[#3eca44] hover:bg-[#eaf8eb]"
                            }`}
                          >
                            {page}
                          </button>
                        ) : (
                          <span key={page} className="px-1 text-[11px] font-medium text-[#2f9f35]">...</span>
                        ),
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 min-w-[86px] rounded-[4px] border border-[#8fd693] bg-white px-4 text-[11px] font-medium text-[#2f9f35] transition-colors hover:border-[#3eca44] hover:bg-[#eaf8eb] hover:text-[#2f9f35] disabled:border-[#d6ead7] disabled:text-[#a7c9a9]"
                        onClick={() => setTrashClientsPage((prev) => Math.min(totalTrashClientsPages, prev + 1))}
                        disabled={currentTrashClientsPage === totalTrashClientsPages || isTrashBinLoading || trashClients.length === 0}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="documents" className="mt-4 flex-1 min-h-0 overflow-hidden">
                  <div className="flex h-full min-h-0 flex-col gap-3">
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm border border-slate-200">
                    <div className="grid grid-cols-[1.6fr_1.5fr_110px_86px] items-center gap-3 border-b border-slate-200 bg-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 [&>*+*]:border-l [&>*+*]:border-slate-200 [&>*+*]:pl-2">
                        <div>Document</div>
                        <div>Client</div>
                        <div>Deleted On</div>
                        <div className="text-center">Action</div>
                      </div>
                      <div className="min-h-0 flex-1 overflow-y-auto text-[12px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        {isTrashBinLoading ? (
                          <div className="px-3 py-6 text-center text-[12px] text-slate-500">Loading...</div>
                        ) : trashDocuments.length === 0 ? (
                          <div className="px-3 py-6 text-center text-[12px] text-slate-500">No trashed documents.</div>
                        ) : (
                          paginatedTrashDocuments.map((row) => (
                            <div key={row.id} className="group grid grid-cols-[1.6fr_1.5fr_110px_86px] items-center gap-3 border-b border-slate-200 px-3 py-2 text-[12px] text-slate-700 transition-colors hover:bg-[#3eca44]/5 last:border-b-0 [&>*+*]:border-l [&>*+*]:border-slate-200 [&>*+*]:pl-2">
                              <div className="group-hover:font-semibold">{row.documentName}</div>
                              <div className="group-hover:font-semibold">{row.clientName}</div>
                              <div className="group-hover:font-semibold">{formatTrashDeletedAt(row.deletedAt)}</div>
                              <div className="flex justify-center gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button type="button" variant="ghost" className="h-7 w-7 rounded p-0 text-[#2f9f35] hover:bg-[#eaf8eb] hover:text-[#2f9f35]" onClick={() => void restoreTrashItem("documents", row.id)} disabled={isTrashActionLoading}>
                                      <ArrowPathRoundedSquareIcon className="h-4.5 w-4.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Restore</TooltipContent>
                                </Tooltip>
                                {!isCurrentUserSubuser ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button type="button" variant="ghost" className="h-7 w-7 rounded p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => void hardDeleteTrashItem("documents", row.id)} disabled={isTrashActionLoading}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Delete Permanently</TooltipContent>
                                  </Tooltip>
                                ) : null}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2 px-1">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 min-w-[86px] rounded-[4px] border border-[#8fd693] bg-white px-4 text-[11px] font-medium text-[#2f9f35] transition-colors hover:border-[#3eca44] hover:bg-[#eaf8eb] hover:text-[#2f9f35] disabled:border-[#d6ead7] disabled:text-[#a7c9a9]"
                        onClick={() => setTrashDocumentsPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentTrashDocumentsPage === 1 || isTrashBinLoading || trashDocuments.length === 0}
                      >
                        Previous
                      </Button>
                      {trashDocumentsPageNumbers.map((page) =>
                        typeof page === "number" ? (
                          <button
                            key={page}
                            type="button"
                            onClick={() => setTrashDocumentsPage(page)}
                            className={`flex h-8 min-w-8 items-center justify-center rounded-[4px] border px-3 text-[11px] font-medium transition-colors ${
                              page === currentTrashDocumentsPage
                                ? "border-[#3eca44] bg-[#3eca44] text-white"
                                : "border-[#b9e3bc] bg-white text-[#2f9f35] hover:border-[#3eca44] hover:bg-[#eaf8eb]"
                            }`}
                          >
                            {page}
                          </button>
                        ) : (
                          <span key={page} className="px-1 text-[11px] font-medium text-[#2f9f35]">...</span>
                        ),
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 min-w-[86px] rounded-[4px] border border-[#8fd693] bg-white px-4 text-[11px] font-medium text-[#2f9f35] transition-colors hover:border-[#3eca44] hover:bg-[#eaf8eb] hover:text-[#2f9f35] disabled:border-[#d6ead7] disabled:text-[#a7c9a9]"
                        onClick={() => setTrashDocumentsPage((prev) => Math.min(totalTrashDocumentsPages, prev + 1))}
                        disabled={currentTrashDocumentsPage === totalTrashDocumentsPages || isTrashBinLoading || trashDocuments.length === 0}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="matters" className="mt-4 flex-1 min-h-0 overflow-hidden">
                  <div className="flex h-full min-h-0 flex-col gap-3">
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm border border-slate-200">
                    <div className="grid grid-cols-[1.8fr_1.1fr_110px_86px] items-center gap-3 border-b border-slate-200 bg-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500 [&>*+*]:border-l [&>*+*]:border-slate-200 [&>*+*]:pl-2">
                        <div>Parties</div>
                        <div>Type</div>
                        <div>Deleted On</div>
                        <div className="text-center">Action</div>
                      </div>
                      <div className="min-h-0 flex-1 overflow-y-auto text-[12px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        {isTrashBinLoading ? (
                          <div className="px-3 py-6 text-center text-[12px] text-slate-500">Loading...</div>
                        ) : trashMatters.length === 0 ? (
                          <div className="px-3 py-6 text-center text-[12px] text-slate-500">No trashed matters.</div>
                        ) : (
                          paginatedTrashMatters.map((row) => (
                            <div key={row.id} className="group grid grid-cols-[1.8fr_1.1fr_110px_86px] items-center gap-3 border-b border-slate-200 px-3 py-2 text-[12px] text-slate-700 transition-colors hover:bg-[#3eca44]/5 last:border-b-0 [&>*+*]:border-l [&>*+*]:border-slate-200 [&>*+*]:pl-2">
                              <div className="group-hover:font-semibold">{row.parties}</div>
                              <div className="group-hover:font-semibold">{row.matterType}</div>
                              <div className="group-hover:font-semibold">{formatTrashDeletedAt(row.deletedAt)}</div>
                              <div className="flex justify-center gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button type="button" variant="ghost" className="h-7 w-7 rounded p-0 text-[#2f9f35] hover:bg-[#eaf8eb] hover:text-[#2f9f35]" onClick={() => void restoreTrashItem("case_files", row.id)} disabled={isTrashActionLoading}>
                                      <ArrowPathRoundedSquareIcon className="h-4.5 w-4.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Restore</TooltipContent>
                                </Tooltip>
                                {!isCurrentUserSubuser ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button type="button" variant="ghost" className="h-7 w-7 rounded p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => void hardDeleteTrashItem("case_files", row.id)} disabled={isTrashActionLoading}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Delete Permanently</TooltipContent>
                                  </Tooltip>
                                ) : null}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2 px-1">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 min-w-[86px] rounded-[4px] border border-[#8fd693] bg-white px-4 text-[11px] font-medium text-[#2f9f35] transition-colors hover:border-[#3eca44] hover:bg-[#eaf8eb] hover:text-[#2f9f35] disabled:border-[#d6ead7] disabled:text-[#a7c9a9]"
                        onClick={() => setTrashMattersPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentTrashMattersPage === 1 || isTrashBinLoading || trashMatters.length === 0}
                      >
                        Previous
                      </Button>
                      {trashMattersPageNumbers.map((page) =>
                        typeof page === "number" ? (
                          <button
                            key={page}
                            type="button"
                            onClick={() => setTrashMattersPage(page)}
                            className={`flex h-8 min-w-8 items-center justify-center rounded-[4px] border px-3 text-[11px] font-medium transition-colors ${
                              page === currentTrashMattersPage
                                ? "border-[#3eca44] bg-[#3eca44] text-white"
                                : "border-[#b9e3bc] bg-white text-[#2f9f35] hover:border-[#3eca44] hover:bg-[#eaf8eb]"
                            }`}
                          >
                            {page}
                          </button>
                        ) : (
                          <span key={page} className="px-1 text-[11px] font-medium text-[#2f9f35]">...</span>
                        ),
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 min-w-[86px] rounded-[4px] border border-[#8fd693] bg-white px-4 text-[11px] font-medium text-[#2f9f35] transition-colors hover:border-[#3eca44] hover:bg-[#eaf8eb] hover:text-[#2f9f35] disabled:border-[#d6ead7] disabled:text-[#a7c9a9]"
                        onClick={() => setTrashMattersPage((prev) => Math.min(totalTrashMattersPages, prev + 1))}
                        disabled={currentTrashMattersPage === totalTrashMattersPages || isTrashBinLoading || trashMatters.length === 0}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
