import { useEffect, useMemo, useState } from "react";
import { PageDateStamp } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { southAfricanProvinces } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  getCurrentDashboardWeeklyMattersRange,
  loadCachedDashboardWeeklyMatters,
  loadCachedDashboardWeeklySchedulePeople,
  prefetchDashboardWeeklySchedule,
  prefetchDashboardWeeklySchedulePeople,
  type DashboardWeeklyMatterEvent,
  type DashboardWeeklySchedulePerson,
} from "@/lib/dashboardWeeklyMatters";
import {
  Building2,
  Calendar,
  CalendarCheck2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Files,
  FolderOpen,
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

type DashboardEventRangeDays = 7 | 30 | 60;

type DashboardEventConsultantOption = {
  value: string;
  label: string;
};

type DashboardTaskRow = {
  id: string;
  dateLabel: string;
  taskType: string;
  assignedTo: string;
};

type ConsultantEventPerson = DashboardWeeklySchedulePerson;

type ConsultantWeekEvent = DashboardWeeklyMatterEvent;

type ConsultantWeekEventGroup = {
  category: string;
  events: ConsultantWeekEvent[];
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

const avatarClassNames = [
  "border-[#cfe7d2] bg-[#eef9ef] text-[#2f9f35]",
  "border-[#d8e6fb] bg-[#eef5ff] text-[#3267e3]",
  "border-[#eadcfb] bg-[#f5edff] text-[#7c3aed]",
  "border-[#fde2c8] bg-[#fff4e8] text-[#ea580c]",
  "border-[#f7d2e4] bg-[#fff1f7] text-[#db2777]",
  "border-[#f2d9c2] bg-[#fff6ee] text-[#b45309]",
] as const;

const dashboardUpcomingEventsCacheKey = "dashboard:ccma-bargaining-council-events";
const allDashboardEventConsultantsValue = "__all__";
const allDashboardEventConsultantsLabel = "All consultants";
const dashboardEventRangeOptions: Array<{ value: DashboardEventRangeDays; label: string }> = [
  { value: 7, label: "Next 7 days" },
  { value: 30, label: "Next 30 days" },
  { value: 60, label: "Next 60 days" },
];

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

const dashboardMatterPalette = {
  card: "bg-sky-50",
  border: "border-sky-200",
  text: "text-sky-700",
};
const dashboardHearingPalette = {
  card: "bg-orange-50",
  border: "border-orange-200",
  text: "text-orange-700",
};
const dashboardCcmaPalette = {
  card: "bg-blue-50",
  border: "border-blue-200",
  text: "text-blue-700",
};
const dashboardEquityMeetingPalette = {
  card: "bg-emerald-50",
  border: "border-emerald-200",
  text: "text-emerald-700",
};
const dashboardFallbackPalette = {
  card: "bg-slate-100",
  border: "border-slate-200",
  text: "text-slate-700",
};

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
function formatDashboardDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function getDashboardUpcomingEventsRange(days: DashboardEventRangeDays) {
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + days);
  return {
    startLabel: formatDashboardDateValue(startDate),
    endLabel: formatDashboardDateValue(endDate),
  };
}
function formatDashboardShortDate(value: unknown) {
  const parsed = parseDashboardIsoDate(value);
  if (!parsed) return "--";
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function getDashboardMonday(date: Date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  result.setDate(result.getDate() + (day === 0 ? -6 : 1 - day));
  return result;
}
function addDashboardDays(date: Date, amount: number) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + amount);
  return result;
}
function normalizeDashboardPersonName(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}
function getDashboardEventTimeSortValue(value: string) {
  const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]) * 60 + Number(match[2]);
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
      if (safeSubtype === "Employment Equity") return "Equity Meeting";
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
  if (normalizedSubtype === "discipline" || normalizedSubtype === "disciplinary") return "Disciplinary Hearing";
  if (
    normalizedSubtype === "incapacity (performance)" ||
    normalizedSubtype === "incapacity (ill health)" ||
    normalizedSubtype === "incapacity"
  ) {
    return "Incapacity Hearing";
  }
  if (normalizedSubtype === "appeal") return "Appeal Hearing";
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
function getDashboardCalendarEventPalette(category: string) {
  const normalizedCategory = category.toLowerCase();
  if (normalizedCategory === "equity meeting") return dashboardEquityMeetingPalette;
  if (normalizedCategory.includes("ccma") || normalizedCategory.includes("bargaining council")) return dashboardCcmaPalette;
  if (normalizedCategory.includes("hearing")) return dashboardHearingPalette;
  if (normalizedCategory.includes("consultation")) return dashboardMatterPalette;
  return dashboardFallbackPalette;
}
function normalizeDashboardCaseFileRow(value: DashboardCaseDateRow["case_files"]) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
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

function getDashboardUpcomingEventsCacheKey(rangeStart: string, rangeEnd: string, consultantFilter: string) {
  return `${dashboardUpcomingEventsCacheKey}:${rangeStart}:${rangeEnd}:${consultantFilter || allDashboardEventConsultantsValue}`;
}

function loadCachedDashboardUpcomingEvents(rangeStart: string, rangeEnd: string, consultantFilter = allDashboardEventConsultantsValue) {
  try {
    const raw = sessionStorage.getItem(getDashboardUpcomingEventsCacheKey(rangeStart, rangeEnd, consultantFilter));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<CachedDashboardUpcomingEvents> | null;
    if (!parsed || !Array.isArray(parsed.rows)) return [];
    if (parsed.rangeStart !== rangeStart || parsed.rangeEnd !== rangeEnd) return [];

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

function saveCachedDashboardUpcomingEvents(rangeStart: string, rangeEnd: string, consultantFilter: string, rows: DashboardEventRow[]) {
  try {
    const payload: CachedDashboardUpcomingEvents = {
      rangeStart,
      rangeEnd,
      rows,
    };
    sessionStorage.setItem(getDashboardUpcomingEventsCacheKey(rangeStart, rangeEnd, consultantFilter), JSON.stringify(payload));
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
  const { user } = useAuth();
  const initialWeeklyMattersRange = getCurrentDashboardWeeklyMattersRange();
  const initialUpcomingEventsRange = getDashboardUpcomingEventsRange(30);
  const [upcomingEventsRangeDays, setUpcomingEventsRangeDays] = useState<DashboardEventRangeDays>(30);
  const [upcomingEventsConsultantFilter, setUpcomingEventsConsultantFilter] = useState(allDashboardEventConsultantsValue);
  const [upcomingEventConsultantOptions, setUpcomingEventConsultantOptions] = useState<DashboardEventConsultantOption[]>([]);
  const [eventRows, setEventRows] = useState<DashboardEventRow[]>(
    () => loadCachedDashboardUpcomingEvents(
      initialUpcomingEventsRange.startLabel,
      initialUpcomingEventsRange.endLabel,
      allDashboardEventConsultantsValue,
    ),
  );
  const [taskRows, setTaskRows] = useState<DashboardTaskRow[]>([]);
  const [consultantPeople, setConsultantPeople] = useState<ConsultantEventPerson[]>(
    () => loadCachedDashboardWeeklySchedulePeople() ?? [],
  );
  const [consultantWeekEvents, setConsultantWeekEvents] = useState<ConsultantWeekEvent[]>(
    () => loadCachedDashboardWeeklyMatters(initialWeeklyMattersRange.startLabel, initialWeeklyMattersRange.endLabel) ?? [],
  );
  const [consultantWeekStart, setConsultantWeekStart] = useState<Date>(() => getDashboardMonday(new Date()));
  const [hoveredConsultantWeekDate, setHoveredConsultantWeekDate] = useState<string | null>(null);
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
  const consultantWeekDays = useMemo(
    () => Array.from({ length: 5 }, (_, index) => addDashboardDays(consultantWeekStart, index)),
    [consultantWeekStart],
  );
  const todayDateLabel = formatDashboardDateValue(new Date());
  const upcomingEventsRangeLabel = dashboardEventRangeOptions.find((option) => option.value === upcomingEventsRangeDays)?.label ?? "Next 30 days";
  const upcomingEventsConsultantLabel =
    upcomingEventConsultantOptions.find((option) => option.value === upcomingEventsConsultantFilter)?.label ?? allDashboardEventConsultantsLabel;
  const consultantWeekStartLabel = formatDashboardDateValue(consultantWeekDays[0]);
  const consultantWeekEndLabel = formatDashboardDateValue(consultantWeekDays[4]);
  const consultantEventsByPersonAndDate = useMemo(() => {
    const grouped = new Map<string, ConsultantWeekEventGroup[]>();
    [...consultantWeekEvents]
      .sort((left, right) => getDashboardEventTimeSortValue(left.timeLabel) - getDashboardEventTimeSortValue(right.timeLabel))
      .forEach((event) => {
      const key = `${event.normalizedConsultant}::${event.dateValue}`;
      const currentGroups = grouped.get(key) ?? [];
      const existingGroup = currentGroups.find((group) => group.category === event.category);
      if (existingGroup) {
        existingGroup.events.push(event);
        return;
      }
      grouped.set(key, [...currentGroups, { category: event.category, events: [event] }]);
    });
    return grouped;
  }, [consultantWeekEvents]);

  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;

    const loadConsultantPeople = async () => {
      const cachedRows = loadCachedDashboardWeeklySchedulePeople();
      if (cachedRows) {
        setConsultantPeople(cachedRows);
        return;
      }

      try {
        const people = await prefetchDashboardWeeklySchedulePeople();
        if (isMounted) setConsultantPeople(people);
      } catch {
        // Keep cached/empty state if the consultant prefetch fails.
      }
    };

    void loadConsultantPeople();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    let isMounted = true;

    const loadConsultantWeekEvents = async () => {
      const cachedRows = loadCachedDashboardWeeklyMatters(consultantWeekStartLabel, consultantWeekEndLabel);
      if (cachedRows) {
        setConsultantWeekEvents(cachedRows);
        return;
      }

      setConsultantWeekEvents([]);

      try {
        const { matters } = await prefetchDashboardWeeklySchedule({
          startLabel: consultantWeekStartLabel,
          endLabel: consultantWeekEndLabel,
        });
        if (isMounted) setConsultantWeekEvents(matters);
      } catch {
        // Keep the current empty state if the dashboard prefetch fails.
      }
    };

    void loadConsultantWeekEvents();

    return () => {
      isMounted = false;
    };
  }, [consultantWeekEndLabel, consultantWeekStartLabel]);

  useEffect(() => {
    let isMounted = true;

    const loadUpcomingEvents = async () => {
      const { startLabel, endLabel } = getDashboardUpcomingEventsRange(upcomingEventsRangeDays);
      const cachedRows = loadCachedDashboardUpcomingEvents(startLabel, endLabel, upcomingEventsConsultantFilter);
      setEventRows(cachedRows);

      const caseDatesClient = supabase as unknown as DashboardCaseDatesQuery;
      const { data, error } = await caseDatesClient
        .from("case_dates")
        .select("id,case_file_id,date_type,event_label,date_value,case_files!inner(id,client_name,case_type,case_subtype,consultant,status)")
        .gte("date_value", startLabel)
        .lte("date_value", endLabel)
        .order("date_value", { ascending: true })
        .limit(200);

      if (!isMounted || error || !Array.isArray(data)) return;

      const activeForumRows = data
        .map((row) => {
          const caseFile = normalizeDashboardCaseFileRow(row.case_files);
          const consultant = String(caseFile?.consultant || "").trim() || "--";
          return {
            id: String(row.id || ""),
            caseId: String(row.case_file_id || caseFile?.id || ""),
            dateLabel: formatDashboardDate(row.date_value),
            matterEvent: getDashboardEventLabel(row.date_type, row.event_label),
            matterType: getMatterHeaderTitle(caseFile?.case_type, caseFile?.case_subtype),
            client: getMatterClientDisplayName(caseFile?.client_name),
            consultant,
            normalizedConsultant: normalizeDashboardPersonName(consultant),
            status: String(caseFile?.status || "").trim(),
            caseType: String(caseFile?.case_type || "").trim(),
          };
        })
        .filter(
          (row) =>
            row.id &&
            row.caseId &&
            row.dateLabel !== "--" &&
            row.status.toLowerCase() === "active" &&
            (row.caseType === "CCMA" || row.caseType === "Bargaining Council"),
        );

      const consultantOptions = new Map<string, string>();
      activeForumRows.forEach((row) => {
        if (row.consultant === "--" || !row.normalizedConsultant) return;
        if (!consultantOptions.has(row.normalizedConsultant)) consultantOptions.set(row.normalizedConsultant, row.consultant);
      });

      const nextConsultantOptions = [
        { value: allDashboardEventConsultantsValue, label: allDashboardEventConsultantsLabel },
        ...Array.from(consultantOptions.entries())
          .map(([value, label]) => ({ value, label }))
          .sort((left, right) => left.label.localeCompare(right.label)),
      ];
      const resolvedConsultantFilter = nextConsultantOptions.some((option) => option.value === upcomingEventsConsultantFilter)
        ? upcomingEventsConsultantFilter
        : allDashboardEventConsultantsValue;

      const mapped = activeForumRows
        .filter(
          (row) =>
            resolvedConsultantFilter === allDashboardEventConsultantsValue ||
            row.normalizedConsultant === resolvedConsultantFilter,
        )
        .map(({ caseType, normalizedConsultant, status, ...row }) => row)
        .slice(0, 5);

      setUpcomingEventConsultantOptions(nextConsultantOptions);
      if (resolvedConsultantFilter !== upcomingEventsConsultantFilter) {
        setUpcomingEventsConsultantFilter(resolvedConsultantFilter);
      }
      setEventRows(mapped);
      saveCachedDashboardUpcomingEvents(startLabel, endLabel, resolvedConsultantFilter, mapped);
    };

    void loadUpcomingEvents();

    return () => {
      isMounted = false;
    };
  }, [upcomingEventsConsultantFilter, upcomingEventsRangeDays]);

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
                <div className="flex flex-col gap-5">
                  <div
                    className="grid gap-4"
                    style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(340px, 0.9fr)" }}
                  >
                    <Card className="min-w-0 overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-none flex h-full flex-col transition-colors hover:border-[#50677B]">
                      <CardHeader className="border-b border-slate-200 bg-slate-100 px-5 py-2">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-white/70 text-slate-700 shadow-sm">
                              <Calendar size={16} strokeWidth={2.1} />
                            </div>
                            <div>
                              <CardTitle className="text-[17.33px] font-semibold leading-none text-slate-800">
                                CCMA / Bargaining Council
                              </CardTitle>
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex h-7 min-w-[150px] max-w-[210px] items-center justify-between gap-1.5 rounded-[4px] border border-slate-300 bg-white/70 px-4 text-[10.5px] font-medium text-slate-700 transition-colors hover:border-[#3eca44] hover:text-[#3eca44]"
                                >
                                  <span className="truncate">{upcomingEventsConsultantLabel}</span>
                                  <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="max-h-[260px] w-52 overflow-y-auto rounded-[4px] border-slate-200 p-1">
                                {(upcomingEventConsultantOptions.length
                                  ? upcomingEventConsultantOptions
                                  : [{ value: allDashboardEventConsultantsValue, label: allDashboardEventConsultantsLabel }]
                                ).map((option) => (
                                  <DropdownMenuItem
                                    key={option.value}
                                    onClick={() => setUpcomingEventsConsultantFilter(option.value)}
                                    className={cn(
                                      "cursor-pointer text-[11px]",
                                      option.value === upcomingEventsConsultantFilter && "bg-[#3eca44]/10 text-[#2f9f35]",
                                    )}
                                  >
                                    {option.label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex h-7 min-w-[116px] items-center justify-between gap-1.5 rounded-[4px] border border-[#3eca44] bg-[#3eca44] px-4 text-[10.5px] font-medium text-white transition-colors hover:bg-[#34b73b]"
                                >
                                  <span>{upcomingEventsRangeLabel}</span>
                                  <ChevronDown className="h-3.5 w-3.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40 rounded-[4px] border-slate-200 p-1">
                                {dashboardEventRangeOptions.map((option) => (
                                  <DropdownMenuItem
                                    key={option.value}
                                    onClick={() => setUpcomingEventsRangeDays(option.value)}
                                    className={cn(
                                      "cursor-pointer text-[11px]",
                                      option.value === upcomingEventsRangeDays && "bg-[#3eca44]/10 text-[#2f9f35]",
                                    )}
                                  >
                                    {option.label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
                        <div className="min-h-0 flex-1 overflow-x-auto">
                          <table className="w-full min-w-[690px]">
                            <colgroup>
                              <col className="w-[76px]" />
                              <col className="w-[34%]" />
                              <col className="w-[32%]" />
                              <col className="w-[120px]" />
                            </colgroup>
                            <thead>
                              <tr className="border-b border-slate-200 text-left">
                                {["DATE", "MATTER / EVENT", "CLIENT", "ASSIGNED"].map((label, index) => (
                                  <th
                                    key={label}
                                    className="relative px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.02em] text-slate-500"
                                  >
                                    {index > 0 ? (
                                      <span className="absolute left-0 top-1/2 h-4 -translate-y-1/2 border-l border-slate-200" aria-hidden="true" />
                                    ) : null}
                                    {label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {eventRows.map((row) => (
                                <tr
                                  key={row.id}
                                  className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-[#3eca44]/5 last:border-b-0"
                                  style={{ height: "36px" }}
                                  onClick={() => navigate("/case-files", { state: { openCaseId: row.caseId } })}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      navigate("/case-files", { state: { openCaseId: row.caseId } });
                                    }
                                  }}
                                  role="button"
                                  tabIndex={0}
                                  aria-label={`Open ${row.matterEvent}`}
                                >
                                  <td className="px-5 py-0 align-middle" style={{ height: "36px" }}>
                                    <div className="text-[11px] text-slate-700">{row.dateLabel}</div>
                                  </td>
                                  <td className="border-l border-l-slate-100 px-5 py-0 align-middle" style={{ height: "36px" }}>
                                    <div className="text-[11px] text-slate-700">{row.matterEvent}</div>
                                  </td>
                                  <td className="border-l border-l-slate-100 px-5 py-0 align-middle text-[11px] text-slate-700" style={{ height: "36px" }}>{row.client}</td>
                                  <td className="border-l border-l-slate-100 px-5 py-0 align-middle" style={{ height: "36px" }}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span
                                          className={cn(
                                            "inline-flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-semibold shadow-none",
                                            getAvatarClassName(row.consultant),
                                          )}
                                        >
                                          {getInitials(row.consultant)}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="rounded border border-[#3eca44]/35 text-[10px] shadow-none">
                                        {row.consultant}
                                      </TooltipContent>
                                    </Tooltip>
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

                    <Card className="min-w-0 overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-none flex h-full flex-col transition-colors hover:border-[#50677B]">
                      <CardHeader className="border-b border-slate-200 bg-slate-100 px-5 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-white/70 text-slate-700 shadow-sm">
                              <CalendarCheck2 size={16} strokeWidth={2.1} />
                            </div>
                            <CardTitle className="text-[14px] font-semibold leading-none text-slate-800">
                              Diary / Tasks
                            </CardTitle>
                          </div>
                          <button
                            type="button"
                            onClick={() => navigate("/clients")}
                            className="text-[12px] font-semibold text-slate-700 transition-colors hover:text-[#3eca44]"
                          >
                            View all
                          </button>
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

                  <Card className="order-first min-w-0 overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-none transition-colors hover:border-[#50677B]">
                    <CardHeader className="border-b border-slate-200 bg-slate-100 px-5 py-2">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-white/70 text-slate-700 shadow-sm"
                          >
                            <Users size={16} strokeWidth={2.1} />
                          </div>
                          <div>
                            <CardTitle className="text-[17.33px] font-semibold leading-none text-slate-800">
                              Weekly Schedule
                            </CardTitle>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="inline-flex h-7 w-[86px] items-center justify-center gap-1.5 rounded-[4px] border border-slate-300 bg-white/70 px-2.5 text-[10.5px] font-semibold text-slate-700 hover:border-[#3eca44] hover:text-[#3eca44]"
                            onClick={() => setConsultantWeekStart((current) => addDashboardDays(current, -7))}
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                            Previous
                          </button>
                          <div className="min-w-[138px] rounded-[4px] border border-[#3eca44] bg-[#3eca44] px-2.5 py-1 text-center text-[10.5px] font-semibold text-white">
                            {formatDashboardShortDate(consultantWeekStartLabel)} - {formatDashboardShortDate(consultantWeekEndLabel)}
                          </div>
                          <button
                            type="button"
                            className="inline-flex h-7 w-[86px] items-center justify-center gap-1.5 rounded-[4px] border border-slate-300 bg-white/70 px-2.5 text-[10.5px] font-semibold text-slate-700 hover:border-[#3eca44] hover:text-[#3eca44]"
                            onClick={() => setConsultantWeekStart((current) => addDashboardDays(current, 7))}
                          >
                            Next
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[860px] table-fixed">
                          <colgroup>
                            <col className="w-[210px]" />
                            <col />
                            <col />
                            <col />
                            <col />
                            <col />
                          </colgroup>
                          <thead>
                            <tr className="border-b border-slate-200 text-left">
                              <th className="border-b border-slate-200 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-600">
                                Consultant
                              </th>
                              {consultantWeekDays.map((day) => {
                                const dateValue = formatDashboardDateValue(day);
                                const isHovered = hoveredConsultantWeekDate === dateValue;
                                const isToday = todayDateLabel === dateValue;
                                return (
                                  <th
                                    key={dateValue}
                                    className="relative border-b border-slate-200 px-4 py-3 text-left"
                                    onMouseEnter={() => setHoveredConsultantWeekDate(dateValue)}
                                    onMouseLeave={() => setHoveredConsultantWeekDate(null)}
                                  >
                                  <span
                                    className="absolute left-0 top-1/2 h-4 -translate-y-1/2 border-l border-slate-200"
                                    aria-hidden="true"
                                  />
                                  <div
                                    className={cn(
                                      "flex items-baseline gap-2 text-[11px]",
                                      isHovered && "underline underline-offset-2",
                                      isHovered && isToday && "decoration-[#3eca44]",
                                    )}
                                  >
                                    <span className={cn("font-semibold uppercase tracking-[0.02em]", isToday ? "text-[#3eca44]" : isHovered ? "text-slate-800" : "text-slate-600")}>
                                      {day.toLocaleDateString("en-GB", { weekday: "short" })}
                                    </span>
                                    <span className={cn("font-medium", isToday ? "text-[#3eca44]" : isHovered ? "text-slate-700" : "text-slate-500")}>
                                      {formatDashboardShortDate(dateValue)}
                                    </span>
                                  </div>
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {consultantPeople.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="px-5 py-4 text-center text-[12px] text-slate-500">
                                  No consultants found.
                                </td>
                              </tr>
                            ) : (
                              consultantPeople.map((person) => (
                                <tr
                                  key={`${person.type}:${person.id}`}
                                  className="group hover:bg-[#3eca44]/5"
                                >
                                  <td className="border-b border-l border-t border-b-slate-100 border-l-transparent border-t-transparent px-5 py-2 align-middle">
                                    <div className="font-semibold text-[11px] text-slate-800 group-hover:text-[12px]">{person.label}</div>
                                  </td>
                                  {consultantWeekDays.map((day, dayIndex) => {
                                    const dateValue = formatDashboardDateValue(day);
                                    const eventGroups = consultantEventsByPersonAndDate.get(`${person.normalizedLabel}::${dateValue}`) ?? [];
                                    return (
                                      <td
                                        key={dateValue}
                                        className={cn(
                                          "border-b border-l border-t border-b-slate-100 border-l-slate-100 border-t-transparent px-4 py-2 align-middle",
                                          dayIndex === consultantWeekDays.length - 1 && "border-r border-r-transparent",
                                        )}
                                        onMouseEnter={() => setHoveredConsultantWeekDate(dateValue)}
                                        onMouseLeave={() => setHoveredConsultantWeekDate(null)}
                                      >
                                        {eventGroups.length > 0 ? (
                                          <div className="space-y-1.5 py-0.5">
                                            {eventGroups.map((group) => {
                                              const palette = getDashboardCalendarEventPalette(group.category);
                                              return (
                                                <Tooltip key={group.category}>
                                                  <TooltipTrigger asChild>
                                                    <div
                                                      className={cn(
                                                        "flex cursor-default items-center justify-between gap-2 rounded border px-2 py-0.5 text-[11px] leading-snug",
                                                        palette.card,
                                                        palette.border,
                                                        palette.text,
                                                      )}
                                                    >
                                                      <span className="truncate">{group.category}</span>
                                                      {group.events.length > 1 ? (
                                                        <span className="shrink-0 rounded-full bg-white/70 px-1.5 text-[9px] font-semibold leading-4 text-slate-600 ring-1 ring-inset ring-slate-200">
                                                          {group.events.length}
                                                        </span>
                                                      ) : null}
                                                    </div>
                                                  </TooltipTrigger>
                                                  <TooltipContent side="top" className="max-w-[360px] rounded border border-[#3eca44]/35 text-[10px] shadow-none">
                                                    <div className="space-y-1">
                                                      {group.events.map((event) => (
                                                        <div key={event.id} className="whitespace-normal break-words">
                                                          <span className="font-semibold">{event.timeLabel}:</span> {event.parties}
                                                        </div>
                                                      ))}
                                                    </div>
                                                  </TooltipContent>
                                                </Tooltip>
                                              );
                                            })}
                                          </div>
                                        ) : (
                                          <span className="text-[11px] text-slate-400">None</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

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
                        <Card key={card.title} className="rounded-[10px] border border-slate-200 bg-white shadow-none transition-colors hover:border-[#50677B]">
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
                    <Card className="rounded-[10px] border border-slate-200 bg-white shadow-none transition-colors hover:border-[#50677B]">
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

                    <Card className="rounded-[10px] border border-slate-200 bg-white shadow-none transition-colors hover:border-[#50677B]">
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

                    <Card className="rounded-[10px] border border-slate-200 bg-white shadow-none transition-colors hover:border-[#2D4256]">
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
