import { supabase } from "@/integrations/supabase/client";

export type DashboardWeeklyMatterEvent = {
  id: string;
  dateValue: string;
  timeLabel: string;
  consultant: string;
  normalizedConsultant: string;
  matterEvent: string;
  category: string;
  parties: string;
};

export type DashboardWeeklySchedulePerson = {
  id: string;
  label: string;
  normalizedLabel: string;
  type: "main" | "subuser";
};

type CachedDashboardWeeklyMatters = {
  rangeStart: string;
  rangeEnd: string;
  rows: DashboardWeeklyMatterEvent[];
};

type CachedDashboardWeeklySchedulePeople = {
  rows: DashboardWeeklySchedulePerson[];
};

type DashboardWeeklyMattersRange = {
  startLabel: string;
  endLabel: string;
};

type DashboardWeeklyMatterCaseFileRow = {
  id: string | null;
  parties: string | null;
  case_type: string | null;
  case_subtype: string | null;
  consultant: string | null;
  status: string | null;
};

type DashboardWeeklyMatterQueryRow = {
  id: string | null;
  date_type: string | null;
  event_label: string | null;
  date_value: string | null;
  event_time: string | null;
  case_files: DashboardWeeklyMatterCaseFileRow | DashboardWeeklyMatterCaseFileRow[] | null;
};

type DashboardWeeklyMattersQuery = {
  from: (table: "case_dates") => {
    select: (columns: string) => {
      gte: (column: string, value: string) => {
        lte: (column: string, value: string) => {
          order: (column: string, options: { ascending: boolean }) => Promise<{
            data: DashboardWeeklyMatterQueryRow[] | null;
            error: { message?: string } | null;
          }>;
        };
      };
    };
  };
};

type DashboardProfilesQueryRow = {
  id: string | null;
  user_name: string | null;
  user_surname: string | null;
  user_email: string | null;
};

type DashboardSubusersQueryRow = {
  auth_user_id: string | null;
  name: string | null;
  surname: string | null;
  email: string | null;
  status: string | null;
  role: string | null;
};

type DashboardWeeklySchedulePeopleQuery = {
  from: (table: "profiles") => {
    select: (columns: string) => {
      order: (column: string, options: { ascending: boolean }) => Promise<{
        data: DashboardProfilesQueryRow[] | null;
        error: { message?: string } | null;
      }>;
    };
  };
} & {
  from: (table: "subusers") => {
    select: (columns: string) => {
      in: (column: string, values: string[]) => {
        order: (column: string, options: { ascending: boolean }) => Promise<{
          data: DashboardSubusersQueryRow[] | null;
          error: { message?: string } | null;
        }>;
      };
    };
  };
};

const dashboardWeeklyMattersCachePrefix = "dashboard:weekly-matters";
const dashboardWeeklySchedulePeopleCacheKey = "dashboard:weekly-schedule-people";
const inFlightDashboardWeeklyMatters = new Map<string, Promise<DashboardWeeklyMatterEvent[]>>();
let inFlightDashboardWeeklySchedulePeople: Promise<DashboardWeeklySchedulePerson[]> | null = null;

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

function formatDashboardDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDashboardPersonName(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function formatDashboardEventTime(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "--";
  const match = raw.match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : raw;
}

function getDashboardEventLabel(dateType: unknown, eventLabel: unknown) {
  const label = String(eventLabel ?? "").trim();
  if (label) return label;
  const type = String(dateType ?? "").trim();
  return type || "Event";
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
  if (normalizedSubtype === "discipline") return "Disciplinary Hearing";
  if (normalizedSubtype === "incapacity (performance)") return "Poor Performance Hearing";
  if (normalizedSubtype === "incapacity (ill health)") return "Ill Health Hearing";
  if (normalizedSubtype === "grievance") return "Grievance Hearing";
  if (normalizedSubtype === "abscondment") return "Abscondment Hearing";
  return "Hearing";
}

function normalizeDashboardWeeklyMatterCaseFileRow(value: DashboardWeeklyMatterQueryRow["case_files"]) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function getDashboardWeeklyMattersCacheKey(rangeStart: string, rangeEnd: string) {
  return `${dashboardWeeklyMattersCachePrefix}:${rangeStart}:${rangeEnd}`;
}

function isDashboardWeeklyMatterEvent(value: unknown): value is DashboardWeeklyMatterEvent {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as DashboardWeeklyMatterEvent).id === "string" &&
    typeof (value as DashboardWeeklyMatterEvent).dateValue === "string" &&
    typeof (value as DashboardWeeklyMatterEvent).timeLabel === "string" &&
    typeof (value as DashboardWeeklyMatterEvent).consultant === "string" &&
    typeof (value as DashboardWeeklyMatterEvent).normalizedConsultant === "string" &&
    typeof (value as DashboardWeeklyMatterEvent).matterEvent === "string" &&
    typeof (value as DashboardWeeklyMatterEvent).category === "string" &&
    typeof (value as DashboardWeeklyMatterEvent).parties === "string"
  );
}

function isDashboardWeeklySchedulePerson(value: unknown): value is DashboardWeeklySchedulePerson {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as DashboardWeeklySchedulePerson).id === "string" &&
    typeof (value as DashboardWeeklySchedulePerson).label === "string" &&
    typeof (value as DashboardWeeklySchedulePerson).normalizedLabel === "string" &&
    ((value as DashboardWeeklySchedulePerson).type === "main" || (value as DashboardWeeklySchedulePerson).type === "subuser")
  );
}

export function getCurrentDashboardWeeklyMattersRange(referenceDate = new Date()): DashboardWeeklyMattersRange {
  const weekStart = getDashboardMonday(referenceDate);
  return {
    startLabel: formatDashboardDateValue(weekStart),
    endLabel: formatDashboardDateValue(addDashboardDays(weekStart, 4)),
  };
}

export function loadCachedDashboardWeeklySchedulePeople() {
  try {
    const raw = sessionStorage.getItem(dashboardWeeklySchedulePeopleCacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedDashboardWeeklySchedulePeople> | null;
    if (!parsed || !Array.isArray(parsed.rows)) return null;
    return parsed.rows.filter(isDashboardWeeklySchedulePerson);
  } catch {
    return null;
  }
}

function saveCachedDashboardWeeklySchedulePeople(rows: DashboardWeeklySchedulePerson[]) {
  try {
    const payload: CachedDashboardWeeklySchedulePeople = { rows };
    sessionStorage.setItem(dashboardWeeklySchedulePeopleCacheKey, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

export function loadCachedDashboardWeeklyMatters(rangeStart: string, rangeEnd: string) {
  try {
    const raw = sessionStorage.getItem(getDashboardWeeklyMattersCacheKey(rangeStart, rangeEnd));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedDashboardWeeklyMatters> | null;
    if (!parsed || parsed.rangeStart !== rangeStart || parsed.rangeEnd !== rangeEnd || !Array.isArray(parsed.rows)) {
      return null;
    }
    return parsed.rows.filter(isDashboardWeeklyMatterEvent);
  } catch {
    return null;
  }
}

function saveCachedDashboardWeeklyMatters(rangeStart: string, rangeEnd: string, rows: DashboardWeeklyMatterEvent[]) {
  try {
    const payload: CachedDashboardWeeklyMatters = {
      rangeStart,
      rangeEnd,
      rows,
    };
    sessionStorage.setItem(getDashboardWeeklyMattersCacheKey(rangeStart, rangeEnd), JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

async function fetchDashboardWeeklySchedulePeople(): Promise<DashboardWeeklySchedulePerson[]> {
  const schedulePeopleClient = supabase as unknown as DashboardWeeklySchedulePeopleQuery;
  const [profilesResult, subusersResult] = await Promise.all([
    schedulePeopleClient
      .from("profiles")
      .select("id,user_name,user_surname,user_email")
      .order("user_name", { ascending: true }),
    schedulePeopleClient
      .from("subusers")
      .select("auth_user_id,name,surname,email,status,role")
      .in("status", ["accepted", "active"])
      .order("name", { ascending: true }),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (subusersResult.error) throw subusersResult.error;

  const people = new Map<string, DashboardWeeklySchedulePerson>();

  (Array.isArray(profilesResult.data) ? profilesResult.data : []).forEach((row) => {
    const id = String(row?.id || "").trim();
    if (!id) return;
    const label = [row?.user_name, row?.user_surname]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join(" ")
      .trim() || String(row?.user_email || "").trim() || "User";
    people.set(`main:${id}`, {
      id,
      label,
      normalizedLabel: normalizeDashboardPersonName(label),
      type: "main",
    });
  });

  (Array.isArray(subusersResult.data) ? subusersResult.data : []).forEach((row) => {
    const role = String(row?.role || "").trim().toLowerCase();
    if (role && role !== "consultant") return;
    const id = String(row?.auth_user_id || row?.email || "").trim();
    if (!id) return;
    const label = [row?.name, row?.surname]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join(" ")
      .trim() || String(row?.email || "").trim() || "Subuser";
    people.set(`subuser:${id}`, {
      id,
      label,
      normalizedLabel: normalizeDashboardPersonName(label),
      type: "subuser",
    });
  });

  return [...people.values()].sort((left, right) => left.label.localeCompare(right.label));
}

async function fetchDashboardWeeklyMatters(rangeStart: string, rangeEnd: string): Promise<DashboardWeeklyMatterEvent[]> {
  const weeklyMattersClient = supabase as unknown as DashboardWeeklyMattersQuery;
  const { data, error } = await weeklyMattersClient
    .from("case_dates")
    .select("id,date_type,event_label,date_value,event_time,case_files!inner(id,parties,case_type,case_subtype,consultant,status)")
    .gte("date_value", rangeStart)
    .lte("date_value", rangeEnd)
    .order("date_value", { ascending: true });

  if (error) throw error;

  return (Array.isArray(data) ? data : [])
    .map((row) => {
      const caseFile = normalizeDashboardWeeklyMatterCaseFileRow(row.case_files);
      const consultant = String(caseFile?.consultant || "").trim();
      const status = String(caseFile?.status || "").trim().toLowerCase();
      if (!row.id || !row.date_value || !normalizeDashboardPersonName(consultant) || status !== "active") return null;

      return {
        id: String(row.id || ""),
        dateValue: String(row.date_value || "").trim(),
        timeLabel: formatDashboardEventTime(row.event_time),
        consultant,
        normalizedConsultant: normalizeDashboardPersonName(consultant),
        matterEvent: getDashboardEventLabel(row.date_type, row.event_label),
        category: getMatterHeaderTitle(caseFile?.case_type, caseFile?.case_subtype),
        parties: String(caseFile?.parties || "").trim() || "--",
      };
    })
    .filter((row): row is DashboardWeeklyMatterEvent => Boolean(row));
}

export async function prefetchDashboardWeeklySchedulePeople() {
  const cached = loadCachedDashboardWeeklySchedulePeople();
  if (cached) return cached;
  if (inFlightDashboardWeeklySchedulePeople) return inFlightDashboardWeeklySchedulePeople;

  inFlightDashboardWeeklySchedulePeople = fetchDashboardWeeklySchedulePeople()
    .then((rows) => {
      saveCachedDashboardWeeklySchedulePeople(rows);
      return rows;
    })
    .finally(() => {
      inFlightDashboardWeeklySchedulePeople = null;
    });

  return inFlightDashboardWeeklySchedulePeople;
}

export async function prefetchDashboardWeeklyMatters(range = getCurrentDashboardWeeklyMattersRange()) {
  const cached = loadCachedDashboardWeeklyMatters(range.startLabel, range.endLabel);
  if (cached) return cached;

  const cacheKey = getDashboardWeeklyMattersCacheKey(range.startLabel, range.endLabel);
  const inFlight = inFlightDashboardWeeklyMatters.get(cacheKey);
  if (inFlight) return inFlight;

  const request = fetchDashboardWeeklyMatters(range.startLabel, range.endLabel)
    .then((rows) => {
      saveCachedDashboardWeeklyMatters(range.startLabel, range.endLabel, rows);
      return rows;
    })
    .finally(() => {
      inFlightDashboardWeeklyMatters.delete(cacheKey);
    });

  inFlightDashboardWeeklyMatters.set(cacheKey, request);
  return request;
}

export async function prefetchDashboardWeeklySchedule(range = getCurrentDashboardWeeklyMattersRange()) {
  const [people, matters] = await Promise.all([
    prefetchDashboardWeeklySchedulePeople(),
    prefetchDashboardWeeklyMatters(range),
  ]);
  return { people, matters };
}

export function invalidateDashboardWeeklyMattersCache() {
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(`${dashboardWeeklyMattersCachePrefix}:`))
      .forEach((key) => sessionStorage.removeItem(key));
    sessionStorage.removeItem(dashboardWeeklySchedulePeopleCacheKey);
  } catch {
    // ignore storage errors
  }
}
