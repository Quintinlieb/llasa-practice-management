import { useEffect, useState } from "react";
import { PageDateStamp } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { southAfricanProvinces } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2,
  Calendar,
  CalendarCheck2,
  ChevronDown,
  Files,
  FolderOpen,
  Search,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

type DashboardEventRow = {
  id: string;
  caseId: string;
  dateLabel: string;
  matterEvent: string;
  matterType: string;
  client: string;
  consultant: string;
};

type DashboardTaskRow = {
  id: string;
  dateLabel: string;
  taskType: string;
  assignedTo: string;
};

type CachedDashboardUpcomingEvents = {
  rangeStart: string;
  rangeEnd: string;
  rows: DashboardEventRow[];
};

type DashboardCaseDateRow = {
  id: string | null;
  case_file_id: string | null;
  date_type: string | null;
  event_label: string | null;
  date_value: string | null;
  case_files:
    | {
        id: string | null;
        client_name: string | null;
        case_type: string | null;
        case_subtype: string | null;
        consultant: string | null;
        status: string | null;
      }
    | {
        id: string | null;
        client_name: string | null;
        case_type: string | null;
        case_subtype: string | null;
        consultant: string | null;
        status: string | null;
      }[]
    | null;
};

const consultantPillClassNames = [
  "border-[#cfe7d2] bg-[#eef9ef] text-[#2f9f35]",
  "border-[#d8e6fb] bg-[#eef5ff] text-[#3267e3]",
  "border-[#eadcfb] bg-[#f5edff] text-[#7c3aed]",
  "border-[#fde2c8] bg-[#fff4e8] text-[#ea580c]",
] as const;

const avatarClassNames = [
  "border-[#cfe7d2] bg-[#eef9ef] text-[#2f9f35]",
  "border-[#d8e6fb] bg-[#eef5ff] text-[#3267e3]",
  "border-[#eadcfb] bg-[#f5edff] text-[#7c3aed]",
  "border-[#fde2c8] bg-[#fff4e8] text-[#ea580c]",
  "border-[#f7d2e4] bg-[#fff1f7] text-[#db2777]",
  "border-[#f2d9c2] bg-[#fff6ee] text-[#b45309]",
] as const;

const dashboardUpcomingEventsCacheKey = "dashboard:upcoming-events";

type DashboardCaseDatesQuery = {
  from: (table: "case_dates") => {
    select: (columns: string) => {
      gte: (column: string, value: string) => {
        lte: (column: string, value: string) => {
          order: (column: string, options: { ascending: boolean }) => {
            limit: (count: number) => Promise<{
              data: DashboardCaseDateRow[] | null;
              error: { message?: string } | null;
            }>;
          };
        };
      };
    };
  };
};

const statCards = [
  {
    title: "TOTAL CLIENTS",
    value: "86",
    subtitle: "Active clients",
    delta: "+ 4 this month",
    icon: Building2,
    iconShellClassName: "bg-[#eaf9ee] text-[#3eca44]",
  },
  {
    title: "DOCUMENTS GENERATED",
    value: "142",
    subtitle: "Documents generated",
    delta: "+ 18% vs last month",
    icon: Files,
    iconShellClassName: "bg-[#edf5ff] text-[#3b82f6]",
  },
  {
    title: "NEW MATTERS",
    value: "34",
    subtitle: "New matters opened",
    delta: "+ 21% vs last month",
    icon: FolderOpen,
    iconShellClassName: "bg-[#f3ebff] text-[#8b5cf6]",
  },
  {
    title: "ACTIVE EVENTS",
    value: "48",
    subtitle: "Scheduled events",
    delta: "+ 16% vs last month",
    icon: CalendarCheck2,
    iconShellClassName: "bg-[#fff4e8] text-[#f59e0b]",
  },
] as const;

type MatterCategory = {
  label: string;
  value: number;
  color: string;
};

type ClientProvinceCount = {
  label: (typeof southAfricanProvinces)[number];
  value: number;
};

const matterCategoryColors = [
  "#4f7cff",
  "#ff9b52",
  "#ff6b57",
  "#ffc44f",
  "#51b4c9",
  "#7c8bd8",
  "#8f5be8",
  "#34d399",
  "#f472b6",
  "#94a3b8",
] as const;

const clientRenewals = [
  { label: "Renewals due in next 30 days", value: 3, colorClassName: "bg-[#ff5e5e]" },
  { label: "Renewals due in next 60 days", value: 5, colorClassName: "bg-[#ffb938]" },
  { label: "Expired memberships", value: 1, colorClassName: "bg-[#8f5be8]" },
  { label: "Clients with no recent activity (90+ days)", value: 7, colorClassName: "bg-[#94a3b8]" },
] as const;

function CardLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[12px] font-semibold text-[#3267e3] transition-colors hover:text-[#234fb7]"
    >
      {label}
    </button>
  );
}

function formatDashboardDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "--";
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = String(parsed.getFullYear());
  return `${day}/${month}/${year}`;
}
function parseDashboardIsoDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function getDashboardDayDifference(value: unknown) {
  const parsed = parseDashboardIsoDate(value);
  if (!parsed) return Number.POSITIVE_INFINITY;
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfEvent = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  return Math.floor((startOfEvent.getTime() - startOfToday.getTime()) / 86_400_000);
}

function getMatterClientDisplayName(value: unknown) {
  const label = String(value ?? "").trim();
  if (!label) return "--";
  const tradingAsIndex = label.toLowerCase().indexOf(" t/a ");
  if (tradingAsIndex >= 0) {
    const tradingAs = label.slice(tradingAsIndex + 5).trim();
    return tradingAs || label;
  }
  return label;
}

function getMatterHeaderTitle(caseType: unknown, subtype: unknown) {
  const safeCaseType = String(caseType ?? "").trim();
  const safeSubtype = String(subtype ?? "").trim();
  const hasSubtype = safeSubtype && safeSubtype !== "--" && safeSubtype !== "None";

  if (safeCaseType !== "Hearing") {
    if (safeCaseType === "Consultation") {
      return hasSubtype ? `${safeSubtype} Consultation` : "Consultation";
    }
    if (safeCaseType === "CCMA") {
      return hasSubtype ? `CCMA - ${safeSubtype}` : "CCMA";
    }
    if (safeCaseType === "Bargaining Council") {
      return hasSubtype ? `Bargaining Council - ${safeSubtype}` : "Bargaining Council";
    }
    return hasSubtype ? `${safeCaseType} (${safeSubtype})` : safeCaseType || "Untitled matter";
  }

  const normalizedSubtype = safeSubtype.toLowerCase();
  if (normalizedSubtype === "discipline") return "Disciplinary Hearing";
  if (normalizedSubtype === "incapacity (performance)") return "Poor Performance Hearing";
  if (normalizedSubtype === "incapacity (ill health)") return "Ill Health Hearing";
  if (normalizedSubtype === "grievance") return "Grievance Hearing";
  if (normalizedSubtype === "abscondment") return "Abscondment Hearing";
  return "Hearing";
}
function getDashboardEventLabel(dateType: unknown, eventLabel: unknown) {
  const label = String(eventLabel ?? "").trim();
  if (label) return label;
  const type = String(dateType ?? "").trim();
  return type || "Event";
}
function normalizeDashboardCaseFileRow(value: DashboardCaseDateRow["case_files"]) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function getConsultantPillClassName(value: string) {
  const normalized = value.trim().toLowerCase();
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return consultantPillClassNames[hash % consultantPillClassNames.length];
}

function getAvatarClassName(value: string) {
  const normalized = value.trim().toLowerCase();
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return avatarClassNames[hash % avatarClassNames.length];
}

function getInitials(value: string) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0 || value.trim() === "--") return "--";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function loadCachedDashboardUpcomingEvents() {
  try {
    const raw = sessionStorage.getItem(dashboardUpcomingEventsCacheKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<CachedDashboardUpcomingEvents> | null;
    if (!parsed || !Array.isArray(parsed.rows)) return [];

    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 30);
    const expectedRangeStart = startDate.toISOString().slice(0, 10);
    const expectedRangeEnd = endDate.toISOString().slice(0, 10);

    if (parsed.rangeStart !== expectedRangeStart || parsed.rangeEnd !== expectedRangeEnd) return [];

    return parsed.rows.filter(
      (row): row is DashboardEventRow =>
        Boolean(row) &&
        typeof row === "object" &&
        typeof row.id === "string" &&
        typeof row.caseId === "string" &&
        typeof row.dateLabel === "string" &&
        typeof row.matterEvent === "string" &&
        typeof row.matterType === "string" &&
        typeof row.client === "string" &&
        typeof row.consultant === "string",
    );
  } catch {
    return [];
  }
}

function saveCachedDashboardUpcomingEvents(rangeStart: string, rangeEnd: string, rows: DashboardEventRow[]) {
  try {
    const payload: CachedDashboardUpcomingEvents = {
      rangeStart,
      rangeEnd,
      rows,
    };
    sessionStorage.setItem(dashboardUpcomingEventsCacheKey, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

function getMonthToDateComparisonEnd(referenceDate: Date) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const previousMonthLastDay = new Date(year, month, 0).getDate();
  const comparisonDay = Math.min(referenceDate.getDate(), previousMonthLastDay);

  return new Date(
    year,
    month - 1,
    comparisonDay,
    referenceDate.getHours(),
    referenceDate.getMinutes(),
    referenceDate.getSeconds(),
    referenceDate.getMilliseconds(),
  );
}

function formatMonthToDatePercentChange(currentCount: number, previousCount: number) {
  if (previousCount === 0) {
    if (currentCount === 0) return "0% this month";
    return "+ 100% this month";
  }

  const percentChange = Math.round(((currentCount - previousCount) / previousCount) * 100);
  return `${percentChange >= 0 ? "+" : "-"} ${Math.abs(percentChange)}% this month`;
}

function normalizeProvinceLabel(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return southAfricanProvinces.find((province) => province.toLowerCase() === normalized) ?? null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [eventRows, setEventRows] = useState<DashboardEventRow[]>(() => loadCachedDashboardUpcomingEvents());
  const [taskRows, setTaskRows] = useState<DashboardTaskRow[]>([]);
  const [activeClientCount, setActiveClientCount] = useState<number>(0);
  const [activeClientsThisMonthCount, setActiveClientsThisMonthCount] = useState<number>(0);
  const [documentsThisMonthCount, setDocumentsThisMonthCount] = useState<number>(0);
  const [documentsVsLastMonthLabel, setDocumentsVsLastMonthLabel] = useState<string>("0% this month");
  const [mattersThisMonthCount, setMattersThisMonthCount] = useState<number>(0);
  const [mattersVsLastMonthLabel, setMattersVsLastMonthLabel] = useState<string>("0% this month");
  const [eventsThisMonthCount, setEventsThisMonthCount] = useState<number>(0);
  const [eventsVsLastMonthLabel, setEventsVsLastMonthLabel] = useState<string>("0% this month");
  const [matterCategories, setMatterCategories] = useState<MatterCategory[]>([]);
  const [clientProvinceCounts, setClientProvinceCounts] = useState<ClientProvinceCount[]>([]);

  const donutGradient = (() => {
    const total = matterCategories.reduce((sum, item) => sum + item.value, 0);
    if (!total) return "conic-gradient(#e2e8f0 0deg 360deg)";

    let start = 0;
    const segments = matterCategories
      .map((item) => {
        const sweep = (item.value / total) * 360;
        const segment = `${item.color} ${start}deg ${start + sweep}deg`;
        start += sweep;
        return segment;
      })
      .join(", ");

    return `conic-gradient(${segments})`;
  })();

  useEffect(() => {
    let isMounted = true;

    const loadUpcomingEvents = async () => {
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 30);
      const startLabel = startDate.toISOString().slice(0, 10);
      const endLabel = endDate.toISOString().slice(0, 10);

      const caseDatesClient = supabase as unknown as DashboardCaseDatesQuery;
      const { data, error } = await caseDatesClient
        .from("case_dates")
        .select("id,case_file_id,date_type,event_label,date_value,case_files!inner(id,client_name,case_type,case_subtype,consultant,status)")
        .gte("date_value", startLabel)
        .lte("date_value", endLabel)
        .order("date_value", { ascending: true })
        .limit(50);

      if (!isMounted || error || !Array.isArray(data)) return;

      const mapped = data
        .map((row) => {
          const caseFile = normalizeDashboardCaseFileRow(row.case_files);
          return {
            id: String(row.id || ""),
            caseId: String(row.case_file_id || caseFile?.id || ""),
            dateLabel: formatDashboardDate(row.date_value),
            matterEvent: getDashboardEventLabel(row.date_type, row.event_label),
            matterType: getMatterHeaderTitle(caseFile?.case_type, caseFile?.case_subtype),
            client: getMatterClientDisplayName(caseFile?.client_name),
            consultant: String(caseFile?.consultant || "").trim() || "--",
            status: String(caseFile?.status || "").trim(),
          };
        })
        .filter((row) => row.id && row.caseId && row.dateLabel !== "--" && row.status.toLowerCase() === "active")
        .slice(0, 5);

      setEventRows(mapped);
      saveCachedDashboardUpcomingEvents(startLabel, endLabel, mapped);
    };

    void loadUpcomingEvents();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadDiaryTasks = async () => {
      const todayLabel = new Date().toISOString().slice(0, 10);
      const { data, error } = await (supabase as any)
        .from("diary_tasks")
        .select("id,diary_date,task_type,assigned_to_name")
        .gte("diary_date", todayLabel)
        .order("diary_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true, nullsFirst: false })
        .limit(5);

      if (!isMounted || error) return;

      const mapped = (Array.isArray(data) ? data : []).map((row: any) => ({
        id: String(row?.id || ""),
        dateLabel: formatDashboardDate(row?.diary_date),
        taskType: String(row?.task_type || "").trim() || "--",
        assignedTo: String(row?.assigned_to_name || "").trim() || "--",
      })).filter((row) => row.id);

      setTaskRows(mapped);
    };

    void loadDiaryTasks();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadClientProvinceCounts = async () => {
      const { data, error } = await (supabase as any)
        .from("clients")
        .select("status,province");

      if (!isMounted || error) return;

      const provinceCounts = new Map<string, number>(
        southAfricanProvinces.map((province) => [province, 0]),
      );

      const clientRows = Array.isArray(data) ? data : [];
      clientRows.forEach((row: any) => {
        const status = String(row?.status ?? "").trim().toLowerCase();
        if (status === "inactive") return;

        const province = normalizeProvinceLabel(row?.province);
        if (!province) return;

        provinceCounts.set(province, (provinceCounts.get(province) ?? 0) + 1);
      });

      setClientProvinceCounts(
        southAfricanProvinces.map((province) => ({
          label: province,
          value: provinceCounts.get(province) ?? 0,
        })),
      );
    };

    void loadClientProvinceCounts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadDocumentsThisMonthCount = async () => {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const nowIso = today.toISOString();
      const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString();
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString();
      const previousMonthComparisonEndIso = getMonthToDateComparisonEnd(today).toISOString();

      const { data, error } = await (supabase as any)
        .from("documents")
        .select("created_at")
        .gte("created_at", lastMonthStart)
        .lt("created_at", nextMonthStart);

      if (!isMounted || error) return;

      const documentRows = Array.isArray(data) ? data : [];
      const thisMonthCount = documentRows.filter((row: any) => {
        const createdAt = String(row?.created_at ?? "").trim();
        return createdAt >= monthStart && createdAt <= nowIso;
      }).length;
      const lastMonthCountAtSamePoint = documentRows.filter((row: any) => {
        const createdAt = String(row?.created_at ?? "").trim();
        return createdAt >= lastMonthStart && createdAt <= previousMonthComparisonEndIso;
      }).length;

      setDocumentsThisMonthCount(thisMonthCount);
      setDocumentsVsLastMonthLabel(
        formatMonthToDatePercentChange(thisMonthCount, lastMonthCountAtSamePoint),
      );
    };

    void loadDocumentsThisMonthCount();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadActiveClientCount = async () => {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString();

      const { data, error } = await (supabase as any)
        .from("clients")
        .select("status,created_at");

      if (!isMounted || error) return;

      const clientRows = Array.isArray(data) ? data : [];
      const activeRows = clientRows.filter((row: any) => {
        const status = String(row?.status ?? "").trim().toLowerCase();
        return status !== "inactive";
      });
      const activeThisMonth = activeRows.filter((row: any) => {
        const createdAt = String(row?.created_at ?? "").trim();
        return createdAt >= monthStart && createdAt < nextMonthStart;
      }).length;

      setActiveClientCount(activeRows.length);
      setActiveClientsThisMonthCount(activeThisMonth);
    };

    void loadActiveClientCount();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadMatterCategories = async () => {
      const { data, error } = await (supabase as any)
        .from("case_files")
        .select("case_type,case_subtype,status");

      if (!isMounted || error) return;

      const matterRows = Array.isArray(data) ? data : [];
      const counts = new Map<string, number>();

      matterRows.forEach((row: any) => {
        const status = String(row?.status ?? "").trim().toLowerCase();
        if (status !== "active") return;

        const label = getMatterHeaderTitle(row?.case_type, row?.case_subtype);
        counts.set(label, (counts.get(label) ?? 0) + 1);
      });

      const categories = Array.from(counts.entries())
        .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
        .map(([label, value], index) => ({
          label,
          value,
          color: matterCategoryColors[index % matterCategoryColors.length],
        }));

      setMatterCategories(categories);
    };

    void loadMatterCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadMattersThisMonthCount = async () => {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const nowIso = today.toISOString();
      const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString();
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString();
      const previousMonthComparisonEndIso = getMonthToDateComparisonEnd(today).toISOString();

      const { data, error } = await (supabase as any)
        .from("case_files")
        .select("created_at")
        .gte("created_at", lastMonthStart)
        .lt("created_at", nextMonthStart);

      if (!isMounted || error) return;

      const matterRows = Array.isArray(data) ? data : [];
      const thisMonthCount = matterRows.filter((row: any) => {
        const createdAt = String(row?.created_at ?? "").trim();
        return createdAt >= monthStart && createdAt <= nowIso;
      }).length;
      const lastMonthCountAtSamePoint = matterRows.filter((row: any) => {
        const createdAt = String(row?.created_at ?? "").trim();
        return createdAt >= lastMonthStart && createdAt <= previousMonthComparisonEndIso;
      }).length;

      setMattersThisMonthCount(thisMonthCount);
      setMattersVsLastMonthLabel(
        formatMonthToDatePercentChange(thisMonthCount, lastMonthCountAtSamePoint),
      );
    };

    void loadMattersThisMonthCount();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadEventsThisMonthCount = async () => {
      const today = new Date();
      const monthStartLabel = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      const todayLabel = today.toISOString().slice(0, 10);
      const nextMonthStartLabel = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString().slice(0, 10);
      const lastMonthStartLabel = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 10);
      const previousMonthComparisonEndLabel = getMonthToDateComparisonEnd(today).toISOString().slice(0, 10);

      const { data, error } = await (supabase as any)
        .from("case_dates")
        .select("date_value,case_files!inner(status)")
        .gte("date_value", lastMonthStartLabel)
        .lt("date_value", nextMonthStartLabel);

      if (!isMounted || error) return;

      const eventDateRows = Array.isArray(data) ? data : [];
      const activeEventRows = eventDateRows.filter((row: any) => {
        const caseFile = Array.isArray(row?.case_files) ? row.case_files[0] : row?.case_files;
        const status = String(caseFile?.status ?? "").trim().toLowerCase();
        return status === "active";
      });

      const thisMonthCount = activeEventRows.filter((row: any) => {
        const dateValue = String(row?.date_value ?? "").trim();
        return dateValue >= monthStartLabel && dateValue <= todayLabel;
      }).length;
      const lastMonthCountAtSamePoint = activeEventRows.filter((row: any) => {
        const dateValue = String(row?.date_value ?? "").trim();
        return dateValue >= lastMonthStartLabel && dateValue <= previousMonthComparisonEndLabel;
      }).length;

      setEventsThisMonthCount(thisMonthCount);
      setEventsVsLastMonthLabel(
        formatMonthToDatePercentChange(thisMonthCount, lastMonthCountAtSamePoint),
      );
    };

    void loadEventsThisMonthCount();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
      <div className="space-y-0 -m-6">
        <div className="h-[calc(100dvh-var(--app-header-height,5rem))] overflow-hidden rounded-tl-sm border border-slate-300 border-l-0 border-r-0 bg-white shadow-sm">
          <div className="flex h-full flex-col">
            <div className="pl-4 pr-4 pt-1">
              <div className="flex flex-col gap-4 pt-[10px] pb-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h1 className="-ml-1 text-4xl font-normal text-[#3eca44]">Dashboard</h1>
                  <p className="mt-2 text-xs text-slate-600">
                    Welcome back, Quintin. Here&apos;s what&apos;s happening with your practice today.
                  </p>
                </div>
                <div className="lg:pt-1">
                  <PageDateStamp className="text-slate-500 [&_svg]:text-slate-500" />
                </div>
              </div>
            </div>

            <section className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-2">
              <div className="min-h-0 px-4 pt-5 pb-5">
                <div className="space-y-5">
                  <div
                    className="grid gap-4"
                    style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(340px, 0.9fr)" }}
                  >
                    <Card className="min-w-0 overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-none flex h-full flex-col">
                      <CardHeader className="border-b border-slate-200 px-5 py-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 pl-[10px]">
                            <div
                              className="mt-0.5 shrink-0 shadow-sm"
                              style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "8px",
                                backgroundColor: "#24384e",
                                color: "#ffffff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Calendar size={16} strokeWidth={2.1} />
                            </div>
                            <div>
                              <CardTitle className="text-[14px] font-semibold leading-none text-slate-900">
                                Upcoming Events
                              </CardTitle>
                              <p className="mt-1.5 text-[11px] text-slate-500">
                                Matters and events coming up in the next 30 days.
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="inline-flex h-8 min-w-[116px] shrink-0 items-center justify-between gap-1.5 rounded-[8px] border border-slate-200 bg-white px-4 text-[10.5px] font-medium text-slate-600 transition-colors hover:border-[#3eca44] hover:text-[#3eca44]"
                          >
                            <span>Next 30 days</span>
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </CardHeader>

                      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
                        <div className="min-h-0 flex-1 overflow-x-auto">
                          <table className="w-full min-w-[835px]">
                            <colgroup>
                              <col className="w-[76px]" />
                              <col className="w-[26%]" />
                              <col className="w-[22%]" />
                              <col className="w-[18%]" />
                              <col className="w-[18%]" />
                              <col className="w-[16px]" />
                            </colgroup>
                            <thead>
                              <tr className="border-b border-slate-200 text-left">
                                {["DATE", "MATTER / EVENT", "TYPE", "CLIENT", "CONSULTANT", "VIEW"].map((label) => (
                                  <th
                                    key={label}
                                    className={`px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.02em] text-slate-500 ${
                                      label === "VIEW" ? "text-right" : ""
                                    }`}
                                  >
                                    {label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {eventRows.map((row) => (
                                <tr
                                  key={row.id}
                                  className="border-b border-slate-100 transition-colors hover:bg-[#3eca44]/5 last:border-b-0"
                                  style={{ height: "45px" }}
                                >
                                  <td className="px-5 py-0 align-middle" style={{ height: "45px" }}>
                                    <div className="text-[11px] text-slate-700">{row.dateLabel}</div>
                                  </td>
                                  <td className="px-5 py-0 align-middle" style={{ height: "45px" }}>
                                    <div className="text-[11px] text-slate-700">{row.matterEvent}</div>
                                  </td>
                                  <td className="px-5 py-0 align-middle text-[11px] text-slate-700" style={{ height: "45px" }}>{row.matterType}</td>
                                  <td className="px-5 py-0 align-middle text-[11px] text-slate-700" style={{ height: "45px" }}>{row.client}</td>
                                  <td className="px-5 py-0 align-middle" style={{ height: "45px" }}>
                                    <span
                                      className={cn(
                                        "inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-medium shadow-none",
                                        getConsultantPillClassName(row.consultant),
                                      )}
                                    >
                                      {row.consultant}
                                    </span>
                                  </td>
                                  <td className="px-5 py-0 text-right align-middle" style={{ height: "45px" }}>
                                    <button
                                      type="button"
                                      onClick={() => navigate("/case-files", { state: { openCaseId: row.caseId } })}
                                      className="inline-flex text-slate-400 transition-colors hover:text-slate-700"
                                      aria-label={`Open ${row.matterType}`}
                                    >
                                      <Search className="h-4 w-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="mt-auto border-t border-slate-200 px-5 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => navigate("/matters")}
                            className="text-[12px] font-semibold text-[#3267e3] transition-colors hover:text-[#3eca44] hover:underline"
                          >
                            View all events
                          </button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="min-w-0 overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-none flex h-full flex-col">
                      <CardHeader className="border-b border-slate-200 px-5 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="shrink-0"
                              style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "8px",
                                backgroundColor: "#24384e",
                                color: "#ffffff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <CalendarCheck2 size={16} strokeWidth={2.1} />
                            </div>
                            <CardTitle className="text-[14px] font-semibold leading-none text-slate-900">
                              Diary / Tasks
                            </CardTitle>
                          </div>
                          <CardLink label="View all" onClick={() => navigate("/clients")} />
                        </div>
                      </CardHeader>

                      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
                        <div className="min-h-0 flex-1 overflow-x-auto">
                          <table className="w-full min-w-[320px]">
                            <colgroup>
                              <col className="w-[84px]" />
                              <col className="w-auto" />
                              <col className="w-[72px]" />
                            </colgroup>
                            <thead>
                              <tr className="border-b border-slate-200 text-left">
                                {["DATE", "TYPE", "ASSIGNED"].map((label) => (
                                  <th
                                    key={label}
                                    className={`px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.02em] text-slate-500 ${label === "ASSIGNED" ? "text-right" : ""}`}
                                  >
                                    {label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {taskRows.length === 0 ? (
                                <tr>
                                  <td colSpan={3} className="px-5 py-4 text-[11px] text-slate-500">
                                    No diary tasks found.
                                  </td>
                                </tr>
                              ) : (
                                taskRows.map((row) => (
                                  <tr
                                    key={row.id}
                                    className="border-b border-slate-100 transition-colors hover:bg-[#3eca44]/5 last:border-b-0"
                                    style={{ height: "45px" }}
                                  >
                                    <td className="px-5 py-0 align-middle text-[11px] text-slate-700" style={{ height: "45px" }}>
                                      {row.dateLabel}
                                    </td>
                                    <td className="px-5 py-0 align-middle text-[11px] text-slate-700" style={{ height: "45px" }}>
                                      {row.taskType}
                                    </td>
                                    <td className="px-5 py-0 align-middle" style={{ height: "45px" }}>
                                      <div className="flex items-center justify-end">
                                        <TooltipProvider delayDuration={0}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span
                                                className={cn(
                                                  "inline-flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-semibold",
                                                  getAvatarClassName(row.assignedTo),
                                                )}
                                                aria-label={row.assignedTo}
                                              >
                                                {getInitials(row.assignedTo)}
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="rounded border border-[#3eca44]/35 text-[10px] shadow-none">
                                              {row.assignedTo}
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
                    {statCards.map((card, index) => {
                      const Icon = card.icon;
                      const displayValue =
                        index === 0
                          ? String(activeClientCount)
                          : index === 1
                            ? String(documentsThisMonthCount)
                            : index === 2
                              ? String(mattersThisMonthCount)
                              : index === 3
                                ? String(eventsThisMonthCount)
                                : card.value;
                      const displayDelta =
                        index === 0
                          ? `+ ${activeClientsThisMonthCount} this month`
                          : index === 1
                            ? documentsVsLastMonthLabel
                            : index === 2
                              ? mattersVsLastMonthLabel
                              : index === 3
                                ? eventsVsLastMonthLabel
                                : card.delta;

                      return (
                        <Card key={card.title} className="rounded-[10px] border border-slate-200 bg-white shadow-none">
                          <CardContent className="px-5 py-4">
                            <div className="flex items-start gap-4">
                              <div
                                className={cn(
                                  "flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px]",
                                  card.iconShellClassName,
                                )}
                              >
                                <Icon className="h-7 w-7" />
                              </div>

                              <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.02em] text-slate-500">
                                  {card.title}
                                </p>
                                <div className="mt-2 flex items-end justify-between gap-3">
                                  <p className="text-[36px] font-semibold leading-none text-slate-900">{displayValue}</p>
                                  <span className="shrink-0 text-right text-[11px] font-semibold leading-none text-[#3eca44]">
                                    {displayDelta}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                    <Card className="rounded-[10px] border border-slate-200 bg-white shadow-none">
                      <CardHeader className="px-5 py-4">
                        <CardTitle className="text-[26px] font-semibold leading-none text-slate-900">
                          Matters by Category
                        </CardTitle>
                      </CardHeader>

                      <CardContent className="px-5 pb-0">
                        <div className="flex flex-col gap-6 pb-5 sm:flex-row sm:items-center">
                          <div className="flex justify-center sm:w-[170px]">
                            <div
                              className="relative h-[136px] w-[136px] rounded-full"
                              style={{ background: donutGradient }}
                            >
                              <div className="absolute inset-[32px] rounded-full bg-white" />
                            </div>
                          </div>

                          <div className="min-w-0 flex-1 space-y-2">
                            {matterCategories.length ? (
                              matterCategories.map((item) => (
                                <div key={item.label} className="flex items-center justify-between gap-3 text-[12px]">
                                  <div className="flex min-w-0 items-center gap-3">
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span className="truncate text-slate-700">{item.label}</span>
                                  </div>
                                  <span className="font-semibold text-slate-700">{item.value}</span>
                                </div>
                              ))
                            ) : (
                              <p className="text-[12px] text-slate-500">No active matters found.</p>
                            )}
                          </div>
                        </div>
                      </CardContent>

                      <div className="border-t border-slate-200 px-5 py-4 text-center">
                        <CardLink label="View all matters" onClick={() => navigate("/matters")} />
                      </div>
                    </Card>

                    <Card className="rounded-[10px] border border-slate-200 bg-white shadow-none">
                      <CardHeader className="px-5 py-4">
                        <CardTitle className="text-[26px] font-semibold leading-none text-slate-900">
                          Clients by Province
                        </CardTitle>
                      </CardHeader>

                      <CardContent className="px-5 pb-0">
                        <div className="space-y-3 pb-5">
                          {clientProvinceCounts.map((item) => {
                            const maxValue = Math.max(...clientProvinceCounts.map((entry) => entry.value), 1);
                            const widthPercent = (item.value / maxValue) * 100;

                            return (
                              <div key={item.label} className="space-y-1.5">
                                <div className="flex items-center justify-between gap-3 text-[12px]">
                                  <span className="truncate text-slate-700">{item.label}</span>
                                  <span className="font-semibold text-slate-900">{item.value}</span>
                                </div>
                                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full rounded-full bg-[#3eca44] transition-all"
                                    style={{ width: `${widthPercent}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                          {!clientProvinceCounts.length && (
                            <div className="text-[12px] text-slate-500">
                              No client province data found.
                            </div>
                          )}
                        </div>
                      </CardContent>

                      <div className="border-t border-slate-200 px-5 py-4 text-center">
                        <CardLink label="View all clients" onClick={() => navigate("/employees")} />
                      </div>
                    </Card>

                    <Card className="rounded-[10px] border border-slate-200 bg-white shadow-none">
                      <CardHeader className="flex-row items-center justify-between px-5 py-4">
                        <CardTitle className="text-[26px] font-semibold leading-none text-slate-900">
                          Client Renewals
                        </CardTitle>
                        <CardLink label="View all" onClick={() => navigate("/employees")} />
                      </CardHeader>

                      <CardContent className="px-5 pb-0">
                        <div className="space-y-5 pb-5">
                          {clientRenewals.map((item) => (
                            <div key={item.label} className="flex items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <span className={cn("h-2.5 w-2.5 rounded-full", item.colorClassName)} />
                                <span className="text-[12px] text-slate-700">{item.label}</span>
                              </div>
                              <span className="text-[14px] font-semibold text-slate-900">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>

                      <div className="border-t border-slate-200 px-5 py-4 text-center">
                        <CardLink label="View all clients" onClick={() => navigate("/employees")} />
                      </div>
                    </Card>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
  );
}
