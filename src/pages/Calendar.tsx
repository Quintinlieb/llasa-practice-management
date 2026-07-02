import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfDay,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isSameWeek,
  setHours,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PageDateStamp } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { warnIfSouthAfricanPublicHoliday } from "@/lib/southAfricanPublicHolidays";
import { formatActivityDate, logActivity, taskCreatedActivityKey } from "@/lib/activityLog";

type CalendarView = "day" | "week" | "month";

type NewCalendarEntryForm = {
  clientId: string;
  type: string;
  client: string;
  assignedTo: string;
  relatedMatter: string;
  date: string;
  time: string;
  duration: string;
  description: string;
};

type CalendarEntry = {
  id: string;
  matterId?: string;
  title: string;
  start: Date;
  end: Date;
  typeLabel: string;
  clientLabel: string;
  category: string;
  kind: "matter" | "task";
  badgeLabel: string;
  secondaryLabel: string;
  descriptionLabel: string;
  ownerLabel: string;
  ownerId: string;
  ownerMatchTokens: string[];
  palette: {
    card: string;
    border: string;
    badge: string;
    accent: string;
    text: string;
    monthBorder: string;
    hoverText: string;
  };
};

type TeamFilterOption = {
  id: string;
  label: string;
  email: string;
  type: "main" | "subuser";
};

type CalendarClientRow = {
  id: string;
  registered_name: string | null;
  trading_as: string | null;
  trading_name?: string | null;
  company_type: string | null;
};

type CalendarMatterRow = {
  id: string;
  file_number: string | null;
  parties: string | null;
  case_type: string | null;
  case_subtype: string | null;
  status: string | null;
};

type PublicHolidayRow = {
  date: string;
  localName?: string | null;
  name?: string | null;
};

type CalendarCaseDateRow = {
  id: string | null;
  case_file_id: string | null;
  date_type: string | null;
  event_label: string | null;
  date_value: string | null;
  event_time: string | null;
  duration: string | null;
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

const matterPalette = {
  card: "bg-sky-50",
  border: "border-sky-200",
  badge: "bg-sky-100 text-sky-700",
  accent: "bg-sky-500",
  text: "text-sky-700",
  monthBorder: "border-sky-700",
  hoverText: "hover:text-sky-700",
};

const hearingPalette = {
  card: "bg-orange-50",
  border: "border-orange-200",
  badge: "bg-orange-100 text-orange-700",
  accent: "bg-orange-500",
  text: "text-orange-700",
  monthBorder: "border-orange-700",
  hoverText: "hover:text-orange-700",
};

const ccmaPalette = {
  card: "bg-blue-50",
  border: "border-blue-200",
  badge: "bg-blue-100 text-blue-700",
  accent: "bg-blue-500",
  text: "text-blue-700",
  monthBorder: "border-blue-700",
  hoverText: "hover:text-blue-700",
};

const taskPalette = {
  card: "bg-emerald-50",
  border: "border-emerald-200",
  badge: "bg-emerald-100 text-emerald-700",
  accent: "bg-emerald-500",
  text: "text-emerald-700",
  monthBorder: "border-emerald-700",
  hoverText: "hover:text-emerald-700",
};

const fallbackPalette = {
  card: "bg-slate-100",
  border: "border-slate-200",
  badge: "bg-slate-200 text-slate-700",
  accent: "bg-slate-500",
  text: "text-slate-700",
  monthBorder: "border-slate-700",
  hoverText: "hover:text-slate-700",
};

const calendarTaskDurationOptions = ["15 mins", "30 mins", "1 hour", "2 hours", "Half day", "Full day"] as const;
const calendarTaskTimeHourOptions = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const calendarTaskTimeMinuteOptions = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"] as const;
const calendarTaskTypeOptions = [
  "Case Preparation",
  "Check Deadline",
  "Client Update",
  "Consultation",
  "Draft Document",
  "Email / Correspondence",
  "Follow-Up",
  "General Admin",
  "Invoice / Accounts",
  "Internal Review",
  "Phone Call",
  "Prepare Bundle",
  "Request Information",
  "Review Document",
  "Schedule Meeting",
  "Submit / File Document",
] as const;
const calendarFieldSelectTriggerClass =
  "h-8 rounded border border-slate-200 bg-white !text-[11px] md:!text-[11px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] placeholder:!text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0 justify-between data-[placeholder]:text-slate-400 data-[placeholder]:text-xs !h-[34px] !border-[0.5px] !border-slate-300 hover:!border-slate-500 focus:!border-black focus-visible:!border-black data-[state=open]:!border-black !ring-0 !ring-offset-0 !outline-none !shadow-none focus:!ring-0 focus:!ring-offset-0 focus:!shadow-none focus:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 focus-visible:!shadow-none focus-visible:!outline-none data-[state=open]:!ring-0 data-[state=open]:!ring-offset-0 data-[state=open]:!shadow-none data-[state=open]:!outline-none";
const calendarDropdownToneClass =
  "bg-white border-slate-300 hover:border-slate-500 data-[state=open]:border-black data-[state=open]:bg-white";
const calendarFieldInputClass =
  "h-8 rounded border border-slate-200 bg-white !text-[11px] md:!text-[11px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] placeholder:!text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:bg-white disabled:text-slate-900 disabled:border-slate-200 disabled:opacity-100 disabled:cursor-default !h-[34px] !border-[0.5px] !border-slate-300 hover:!border-slate-500 focus:!border-black focus-visible:!border-black";
const calendarFieldTextareaClass =
  "min-h-[88px] rounded border border-slate-200 bg-white !text-[11.67px] md:!text-[11.67px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] placeholder:!text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0 !border-[0.5px] !border-slate-300 hover:!border-slate-500 focus:!border-black focus-visible:!border-black";
const calendarSelectItemClass =
  "text-[11px] text-slate-700 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[highlighted]:bg-[#3eca44]/10 data-[highlighted]:text-[#2f9f35] [&_svg]:!text-[#2f9f35]";

const getDefaultNewCalendarEntryForm = (): NewCalendarEntryForm => ({
  clientId: "",
  type: "",
  client: "",
  assignedTo: "",
  relatedMatter: "__none__",
  date: "",
  time: "",
  duration: "30 mins",
  description: "",
});

const getCalendarTaskDurationMs = (duration: unknown) => {
  switch (normalizeText(duration).toLowerCase()) {
    case "15 mins":
      return 15 * 60 * 1000;
    case "30 mins":
      return 30 * 60 * 1000;
    case "1 hour":
      return 60 * 60 * 1000;
    case "2 hours":
      return 2 * 60 * 60 * 1000;
    case "half day":
      return 4 * 60 * 60 * 1000;
    case "full day":
      return 8 * 60 * 60 * 1000;
    default:
      return 60 * 60 * 1000;
  }
};

const normalizeText = (value: unknown) => String(value ?? "").trim();

const formatDisplayDate = (value: string) => {
  const raw = normalizeText(value);
  if (!raw) return "";
  const parsed = parseCalendarDateTime(raw);
  if (!parsed) return raw;
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};

const openDatePicker = (input: HTMLInputElement | null) => {
  if (!input) return;
  if (typeof input.showPicker === "function") {
    input.showPicker();
  } else {
    input.focus();
    input.click();
  }
};

const getInitials = (value: unknown) => {
  const tokens = normalizeText(value).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "--";
  return tokens
    .slice(0, 2)
    .map((token) => token.charAt(0).toUpperCase())
    .join("");
};

const formatCalendarEntryDateTime = (entry: Pick<CalendarEntry, "start" | "end">) =>
  `${format(entry.start, "d MMM yyyy, hh:mm aa")} - ${format(entry.end, "hh:mm aa")}`;

const formatTimeUntilCalendarEntry = (start: Date, reference: Date) => {
  const diffMinutes = Math.ceil((start.getTime() - reference.getTime()) / (60 * 1000));
  if (diffMinutes < 0) return "Past";
  if (diffMinutes < 60) return `${Math.max(diffMinutes, 0)}m`;
  const diffHours = Math.ceil(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.ceil(diffHours / 24)}d`;
};

const getLaterDate = (left: Date, right: Date) => (left.getTime() > right.getTime() ? left : right);

const parseCalendarDateTime = (dateValue: unknown, timeValue?: unknown) => {
  const safeDate = normalizeText(dateValue);
  if (!safeDate) return null;
  const isoMatch = safeDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!isoMatch) return null;

  const [hourValue = "00", minuteValue = "00"] = normalizeText(timeValue).split(":");
  const year = Number(isoMatch[1]);
  const monthIndex = Number(isoMatch[2]) - 1;
  const day = Number(isoMatch[3]);
  const hour = Number.parseInt(hourValue, 10);
  const minute = Number.parseInt(minuteValue, 10);

  return new Date(year, monthIndex, day, Number.isFinite(hour) ? hour : 0, Number.isFinite(minute) ? minute : 0);
};

const getMatterClientDisplayName = (value: unknown) => {
  const label = normalizeText(value);
  if (!label) return "--";
  const tradingAsIndex = label.toLowerCase().indexOf(" t/a ");
  if (tradingAsIndex >= 0) {
    const tradingAs = label.slice(tradingAsIndex + 5).trim();
    return tradingAs || label;
  }
  return label;
};

const getClientTradingDisplayName = (row: any) => {
  const tradingAs = normalizeText(row?.trading_as);
  const tradingName = normalizeText(row?.trading_name);
  const registeredName = normalizeText(row?.registered_name);
  return tradingAs || tradingName || registeredName || "";
};

const formatCalendarClientDisplayName = (client: CalendarClientRow) => {
  const registeredName = normalizeText(client.registered_name);
  const tradingName = normalizeText(client.trading_as) || normalizeText(client.trading_name);
  if (
    registeredName &&
    tradingName &&
    tradingName.toLowerCase() !== registeredName.toLowerCase()
  ) {
    return `${registeredName} t/a ${tradingName}`;
  }
  return registeredName || tradingName || "Unnamed client";
};

const getMatterHeaderTitle = (caseType: unknown, subtype: unknown) => {
  const safeCaseType = normalizeText(caseType);
  const safeSubtype = normalizeText(subtype);
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
};

const buildCalendarTaskRelatedMatterLabel = (matter: Pick<CalendarMatterRow, "file_number" | "case_type" | "case_subtype">) => {
  const fileNumber = normalizeText(matter.file_number) || "MATTER";
  const matterTitle = getMatterHeaderTitle(matter.case_type, matter.case_subtype);
  return matterTitle ? `${fileNumber} - ${matterTitle}` : fileNumber;
};

const resolveCalendarCompanyId = async (user: any) => {
  if (!user?.id) return "";
  let { data: subuserData } = await (supabase as any)
    .from("subusers")
    .select("company_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!subuserData) {
    const email = normalizeText(user?.email).toLowerCase();
    if (email) {
      const fallback = await (supabase as any)
        .from("subusers")
        .select("company_id")
        .eq("email", email)
        .maybeSingle();
      subuserData = fallback.data;
    }
  }

  const subuserCompanyId = normalizeText((subuserData as any)?.company_id);
  if (subuserCompanyId) return subuserCompanyId;

  const metadataCompanyId = normalizeText((user as any)?.user_metadata?.company_id);
  if (metadataCompanyId) return metadataCompanyId;

  return normalizeText(user.id);
};

const resolveCalendarCurrentUserName = async (user: any) => {
  if (!user?.id) return "Unknown User";

  const { data: subuserData } = await (supabase as any)
    .from("subusers")
    .select("name,surname")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const subuserName = `${normalizeText((subuserData as any)?.name)} ${normalizeText((subuserData as any)?.surname)}`.trim();
  if (subuserName) return subuserName;

  const { data: profileData } = await (supabase as any)
    .from("profiles")
    .select("user_name,user_surname")
    .eq("id", user.id)
    .maybeSingle();
  const profileName = `${normalizeText((profileData as any)?.user_name)} ${normalizeText((profileData as any)?.user_surname)}`.trim();
  if (profileName) return profileName;

  const metadataName = normalizeText((user as any)?.user_metadata?.full_name) || normalizeText((user as any)?.user_metadata?.display_name);
  if (metadataName) return metadataName;

  return normalizeText(user?.email) || "Unknown User";
};

const getCalendarEventLabel = (dateType: unknown, eventLabel: unknown) => {
  const label = normalizeText(eventLabel);
  if (label) return label;
  const type = normalizeText(dateType);
  return type || "Event";
};

const normalizeCalendarCaseFileRow = (value: CalendarCaseDateRow["case_files"]) => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
};

const getPaletteForEntry = (kind: CalendarEntry["kind"], category: string) => {
  const normalizedCategory = category.toLowerCase();
  if (kind === "task") return taskPalette;
  if (normalizedCategory.includes("ccma") || normalizedCategory.includes("bargaining council")) return ccmaPalette;
  if (normalizedCategory.includes("hearing")) return hearingPalette;
  if (normalizedCategory.includes("consultation")) return matterPalette;
  return fallbackPalette;
};

const hours = Array.from({ length: 24 }, (_, index) => index);
const isMutedHour = (hour: number) => hour < 7 || hour >= 17;

const CalendarPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<CalendarView>("month");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false);
  const [isSavingNewEntry, setIsSavingNewEntry] = useState(false);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [newEntryFormResetKey, setNewEntryFormResetKey] = useState(0);
  const [newEntryForm, setNewEntryForm] = useState<NewCalendarEntryForm>(() => getDefaultNewCalendarEntryForm());
  const [openDayAccordionId, setOpenDayAccordionId] = useState<string | null>(null);
  const [openWeekAccordionId, setOpenWeekAccordionId] = useState<string | null>(null);
  const [openSummaryAccordionId, setOpenSummaryAccordionId] = useState<string | null>(null);
  const [teamFilterOptions, setTeamFilterOptions] = useState<TeamFilterOption[]>([]);
  const [summaryAssigneeFilter, setSummaryAssigneeFilter] = useState("all");
  const [summaryTypeFilter, setSummaryTypeFilter] = useState<"all" | CalendarEntry["kind"]>("all");
  const [summaryCategoryFilter, setSummaryCategoryFilter] = useState("all");
  const [expandedSummaryFilterSection, setExpandedSummaryFilterSection] = useState<string | null>(null);
  const [isSummaryFilterOpen, setIsSummaryFilterOpen] = useState(false);
  const [clientRows, setClientRows] = useState<CalendarClientRow[]>([]);
  const [clientLoadMessage, setClientLoadMessage] = useState("No matching client found.");
  const [selectedClientMatterRows, setSelectedClientMatterRows] = useState<CalendarMatterRow[]>([]);
  const [selectedClientMatterLoadMessage, setSelectedClientMatterLoadMessage] = useState("Select a client first.");
  const [southAfricanPublicHolidayByDate, setSouthAfricanPublicHolidayByDate] = useState<Record<string, string>>({});
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearchValue, setClientSearchValue] = useState("");
  const { toast } = useToast();
  const mainTimeGridScrollRef = useRef<HTMLDivElement | null>(null);
  const newEntryDateInputRef = useRef<HTMLInputElement | null>(null);
  const accordionCollapseTimeoutRef = useRef<number | null>(null);
  const duplicateTaskPromptedSignaturesRef = useRef<Set<string>>(new Set());
  const duplicateTaskValidationRequestRef = useRef(0);
  const publicHolidayCacheRef = useRef<Map<number, Record<string, string>>>(new Map());

  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return Array.from({ length: 5 }, (_, index) => addDays(weekStart, index));
  }, [selectedDate]);

  const visibleDays = view === "day" ? [selectedDate] : weekDays;
  const todayVisibleDayIndex = visibleDays.findIndex((day) => isSameDay(day, currentTime));

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(selectedDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(selectedDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [selectedDate]);
  const monthWeekCount = Math.ceil(monthDays.length / 7);

  const visibleMonthYears = useMemo(
    () => Array.from(new Set(monthDays.map((day) => day.getFullYear()))),
    [monthDays],
  );

  useEffect(() => {
    let isMounted = true;

    const loadSouthAfricanPublicHolidays = async () => {
      const missingYears = visibleMonthYears.filter((year) => !publicHolidayCacheRef.current.has(year));

      await Promise.all(
        missingYears.map(async (year) => {
          try {
            const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/ZA`);
            if (!response.ok) throw new Error(`Holiday request failed for ${year}`);
            const rows = await response.json() as PublicHolidayRow[];
            const holidaysForYear = Object.fromEntries(
              (Array.isArray(rows) ? rows : [])
                .map((holiday) => [normalizeText(holiday.date), normalizeText(holiday.localName) || normalizeText(holiday.name)])
                .filter(([date, label]) => Boolean(date && label)),
            );
            publicHolidayCacheRef.current.set(year, holidaysForYear);
          } catch {
            publicHolidayCacheRef.current.set(year, {});
          }
        }),
      );

      if (!isMounted) return;

      const visibleHolidayByDate: Record<string, string> = {};
      visibleMonthYears.forEach((year) => {
        Object.assign(visibleHolidayByDate, publicHolidayCacheRef.current.get(year) ?? {});
      });
      setSouthAfricanPublicHolidayByDate(visibleHolidayByDate);
    };

    void loadSouthAfricanPublicHolidays();

    return () => {
      isMounted = false;
    };
  }, [visibleMonthYears]);

  useEffect(() => {
    let isMounted = true;
    setIsCalendarLoading(true);

    const loadCalendarEntries = async () => {
      const rangeStart = subMonths(startOfMonth(selectedDate), 1);
      const rangeEnd = addMonths(endOfMonth(selectedDate), 1);
      const startLabel = format(rangeStart, "yyyy-MM-dd");
      const endLabel = format(rangeEnd, "yyyy-MM-dd");

      const [caseDatesResult, diaryTasksResult] = await Promise.all([
        (supabase as any)
          .from("case_dates")
          .select("id,case_file_id,date_type,event_label,date_value,event_time,duration,case_files!inner(id,client_name,case_type,case_subtype,consultant,status)")
          .gte("date_value", startLabel)
          .lte("date_value", endLabel)
          .order("date_value", { ascending: true }),
        (supabase as any)
          .from("diary_tasks")
          .select("id,client_id,diary_date,task_time,duration,description,task_type,assigned_to_user_id,assigned_to_name")
          .gte("diary_date", startLabel)
          .lte("diary_date", endLabel)
          .order("diary_date", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: true, nullsFirst: false }),
      ]);

      if (!isMounted) return;

      if (caseDatesResult.error || diaryTasksResult.error) {
        setCalendarEntries([]);
        toast({
          title: "Unable to load calendar",
          description:
            caseDatesResult.error?.message ||
            diaryTasksResult.error?.message ||
            "Load failed.",
          variant: "destructive",
        });
        setIsCalendarLoading(false);
        return;
      }

      const taskRows = Array.isArray(diaryTasksResult.data) ? diaryTasksResult.data : [];
      const clientIds = Array.from(
        new Set(taskRows.map((row: any) => normalizeText(row?.client_id)).filter(Boolean)),
      );

      let taskClientLabelById = new Map<string, string>();
      if (clientIds.length > 0) {
        const { data: clientsData, error: clientsError } = await (supabase as any)
          .from("clients")
          .select("id,registered_name,trading_as,trading_name")
          .in("id", clientIds);

        if (!isMounted) return;

        if (clientsError) {
          setCalendarEntries([]);
          toast({
            title: "Unable to load calendar",
            description: clientsError.message || "Load failed.",
            variant: "destructive",
          });
          setIsCalendarLoading(false);
          return;
        }

        taskClientLabelById = new Map(
          (Array.isArray(clientsData) ? clientsData : []).map((row: any) => [
            normalizeText(row?.id),
            getClientTradingDisplayName(row),
          ]),
        );
      }

      const matterEntries = (Array.isArray(caseDatesResult.data) ? caseDatesResult.data : [])
        .map((row: CalendarCaseDateRow) => {
          const caseFile = normalizeCalendarCaseFileRow(row.case_files);
          const status = normalizeText(caseFile?.status).toLowerCase();
          if (status !== "active") return null;

          const start = parseCalendarDateTime(row.date_value, row.event_time);
          if (!start) return null;

          const title = getCalendarEventLabel(row.date_type, row.event_label);
          const typeLabel = normalizeText(caseFile?.case_type) || "Matter";
          const category = getMatterHeaderTitle(caseFile?.case_type, caseFile?.case_subtype);
          const clientLabel = getMatterClientDisplayName(caseFile?.client_name);
          const ownerLabel = normalizeText(caseFile?.consultant) || "--";

          return {
            id: `matter-${normalizeText(row.id) || crypto.randomUUID()}`,
            matterId: normalizeText(row.case_file_id) || normalizeText(caseFile?.id),
            title,
            start,
            end: new Date(start.getTime() + getCalendarTaskDurationMs(row.duration || "1 hour")),
            typeLabel,
            clientLabel,
            category,
            kind: "matter" as const,
            badgeLabel: "Matter Event",
            secondaryLabel: [clientLabel, category].filter(Boolean).join(" | "),
            descriptionLabel: "",
            ownerLabel,
            ownerId: "",
            ownerMatchTokens: [ownerLabel],
            palette: getPaletteForEntry("matter", category),
          };
        })
        .filter((entry): entry is CalendarEntry => Boolean(entry));

      const taskEntries = taskRows
        .map((row: any) => {
          const start = parseCalendarDateTime(row?.diary_date, row?.task_time || "08:00");
          if (!start) return null;

          const taskType = normalizeText(row?.task_type) || "Task";
          const duration = normalizeText(row?.duration);
          const description = normalizeText(row?.description);
          const ownerLabel = normalizeText(row?.assigned_to_name) || "--";
          const clientLabel = taskClientLabelById.get(normalizeText(row?.client_id)) || "";

          return {
            id: `task-${normalizeText(row?.id) || crypto.randomUUID()}`,
            title: taskType,
            start,
            end: new Date(start.getTime() + getCalendarTaskDurationMs(duration)),
            typeLabel: taskType,
            clientLabel,
            category: taskType,
            kind: "task" as const,
            badgeLabel: "Diary Task",
            secondaryLabel: duration,
            descriptionLabel: description,
            ownerLabel,
            ownerId: normalizeText(row?.assigned_to_user_id),
            ownerMatchTokens: [ownerLabel, normalizeText(row?.assigned_to_user_id)],
            palette: getPaletteForEntry("task", taskType),
          };
        })
        .filter((entry): entry is CalendarEntry => Boolean(entry));

      const nextEntries = [...matterEntries, ...taskEntries].sort(
        (left, right) => left.start.getTime() - right.start.getTime(),
      );

      setCalendarEntries(nextEntries);
      setIsCalendarLoading(false);
    };

    void loadCalendarEntries();

    return () => {
      isMounted = false;
    };
  }, [calendarRefreshKey, selectedDate, toast]);

  const filteredEntries = useMemo(() => {
    const assigneeFilter = normalizeText(summaryAssigneeFilter).toLowerCase();
    const categoryFilter = normalizeText(summaryCategoryFilter).toLowerCase();
    const selectedAssignee = teamFilterOptions.find((member) =>
      [member.id, member.label, member.email].some((value) => normalizeText(value).toLowerCase() === assigneeFilter),
    );
    const selectedAssigneeTokens = selectedAssignee
      ? [selectedAssignee.id, selectedAssignee.label, selectedAssignee.email]
          .map((value) => normalizeText(value).toLowerCase())
          .filter(Boolean)
      : [assigneeFilter];

    return calendarEntries.filter((entry) => {
      const matchesAssignee =
        assigneeFilter === "all" ||
        entry.ownerMatchTokens.some((token) => selectedAssigneeTokens.includes(normalizeText(token).toLowerCase()));
      const matchesType = summaryTypeFilter === "all" || entry.kind === summaryTypeFilter;
      const matchesCategory = categoryFilter === "all" || normalizeText(entry.typeLabel).toLowerCase() === categoryFilter;

      return matchesAssignee && matchesType && matchesCategory;
    });
  }, [calendarEntries, summaryAssigneeFilter, summaryCategoryFilter, summaryTypeFilter, teamFilterOptions]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    filteredEntries.forEach((event) => {
      const key = format(event.start, "yyyy-MM-dd");
      const existing = map.get(key) ?? [];
      existing.push(event);
      map.set(key, existing.sort((left, right) => left.start.getTime() - right.start.getTime()));
    });
    return map;
  }, [filteredEntries]);

  const monthTypeSummaryByDay = useMemo(() => {
    const map = new Map<string, Array<{ typeLabel: string; count: number; palette: CalendarEntry["palette"] }>>();

    eventsByDay.forEach((entries, key) => {
      const grouped = new Map<string, { typeLabel: string; count: number; palette: CalendarEntry["palette"] }>();

      entries.forEach((entry) => {
        const existing = grouped.get(entry.typeLabel);
        if (existing) {
          existing.count += 1;
          return;
        }

        grouped.set(entry.typeLabel, {
          typeLabel: entry.typeLabel,
          count: 1,
          palette: entry.palette,
        });
      });

      map.set(key, [...grouped.values()]);
    });

    return map;
  }, [eventsByDay]);

  const selectedDayEvents = useMemo(
    () => eventsByDay.get(format(selectedDate, "yyyy-MM-dd")) ?? [],
    [eventsByDay, selectedDate],
  );
  const summaryCategoryOptions = useMemo(() => {
    const values = new Set<string>();
    calendarEntries.forEach((entry) => {
      if (summaryTypeFilter !== "all" && entry.kind !== summaryTypeFilter) return;
      const category = normalizeText(entry.typeLabel);
      if (category) values.add(category);
    });
    return [...values].sort((left, right) => left.localeCompare(right));
  }, [calendarEntries, summaryTypeFilter]);
  const summaryAssigneeOptions = useMemo(() => {
    const options = new Map<string, { value: string; label: string }>();

    teamFilterOptions.forEach((member) => {
      const value = normalizeText(member.id);
      if (!value) return;
      options.set(value.toLowerCase(), { value, label: member.label });
    });

    return [...options.values()].sort((left, right) => left.label.localeCompare(right.label));
  }, [teamFilterOptions]);
  const summaryEntries = useMemo(() => {
    const rangeStart =
      view === "month"
        ? isSameMonth(selectedDate, currentTime)
          ? startOfDay(currentTime)
          : getLaterDate(startOfMonth(selectedDate), currentTime)
        : view === "week"
          ? getLaterDate(startOfDay(selectedDate), currentTime)
          : startOfDay(selectedDate);
    const rangeEnd =
      view === "month"
        ? endOfMonth(selectedDate)
        : view === "week"
          ? endOfDay(endOfWeek(selectedDate, { weekStartsOn: 1 }))
          : endOfDay(selectedDate);

    return filteredEntries
      .filter((entry) => entry.start.getTime() >= rangeStart.getTime() && entry.start.getTime() <= rangeEnd.getTime())
      .sort((left, right) => left.start.getTime() - right.start.getTime());
  }, [currentTime, filteredEntries, selectedDate, view]);
  const summaryRangeLabel =
    view === "month"
      ? isSameMonth(selectedDate, currentTime)
        ? `${format(currentTime, "d MMM")} - ${format(endOfMonth(selectedDate), "d MMM yyyy")}`
        : format(selectedDate, "MMMM yyyy")
      : view === "week"
        ? `${format(getLaterDate(startOfDay(selectedDate), currentTime), "d MMM")} - ${format(endOfWeek(selectedDate, { weekStartsOn: 1 }), "d MMM yyyy")}`
        : format(selectedDate, "d MMMM yyyy");
  const selectedDayEventsByHour = useMemo(() => {
    const map = new Map<number, CalendarEntry[]>();

    selectedDayEvents.forEach((event) => {
      const hour = event.start.getHours();
      const existing = map.get(hour) ?? [];
      existing.push(event);
      map.set(hour, existing);
    });

    return map;
  }, [selectedDayEvents]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isSummaryFilterOpen) {
      setExpandedSummaryFilterSection(null);
    }
  }, [isSummaryFilterOpen]);

  useEffect(() => {
    const [hour = "", minute = ""] = newEntryForm.time.split(":");
    const currentValues = {
      date: normalizeText(newEntryForm.date),
      type: normalizeText(newEntryForm.type),
      time: normalizeText(newEntryForm.time),
      clientId: normalizeText(newEntryForm.clientId),
      relatedMatter: normalizeText(newEntryForm.relatedMatter) || "__none__",
      assignedTo: normalizeText(newEntryForm.assignedTo),
    };
    if (
      !currentValues.date ||
      !currentValues.type ||
      !normalizeText(hour) ||
      !normalizeText(minute) ||
      !currentValues.clientId ||
      !currentValues.relatedMatter ||
      !currentValues.assignedTo
    ) {
      return;
    }

    const signature = [
      currentValues.date,
      currentValues.type,
      currentValues.time,
      currentValues.clientId,
      currentValues.relatedMatter,
      currentValues.assignedTo,
    ].join("|");

    if (duplicateTaskPromptedSignaturesRef.current.has(signature)) return;

    const requestId = duplicateTaskValidationRequestRef.current + 1;
    duplicateTaskValidationRequestRef.current = requestId;
    const selectedAssignee = teamFilterOptions.find((member) => member.label === currentValues.assignedTo);

    const validateDuplicateTask = async () => {
      let duplicateQuery = (supabase as any)
        .from("diary_tasks")
        .select("id,description,task_time,assigned_to_name,assigned_to_user_id")
        .eq("diary_date", currentValues.date)
        .eq("task_type", currentValues.type)
        .eq("client_id", currentValues.clientId)
        .limit(10);

      duplicateQuery = selectedAssignee?.id
        ? duplicateQuery.eq("assigned_to_user_id", selectedAssignee.id)
        : duplicateQuery.eq("assigned_to_name", currentValues.assignedTo);

      duplicateQuery = currentValues.relatedMatter !== "__none__"
        ? duplicateQuery.eq("related_matter_id", currentValues.relatedMatter)
        : duplicateQuery.is("related_matter_id", null);

      const { data, error } = await duplicateQuery;
      if (duplicateTaskValidationRequestRef.current !== requestId) return;

      if (error) {
        toast({
          title: "Unable to validate task",
          description: error.message || "Duplicate task check failed.",
          variant: "destructive",
        });
        return;
      }

      const matchingTask = (Array.isArray(data) ? data : []).find((row: any) => (
        normalizeText(row?.task_time).slice(0, 5) === currentValues.time &&
        (
          selectedAssignee?.id
            ? normalizeText(row?.assigned_to_user_id) === selectedAssignee.id
            : normalizeText(row?.assigned_to_name) === currentValues.assignedTo
        )
      ));
      if (!matchingTask) return;

      const existingDescription = normalizeText(matchingTask.description) || "No description captured";
      const confirmed = window.confirm(`This seems to be a duplicate of an existing task.\n\nExisting task description: ${existingDescription}\n\nDo you want to proceed?`);
      if (confirmed) {
        duplicateTaskPromptedSignaturesRef.current.add(signature);
        return;
      }

      setNewEntryForm({
        ...getDefaultNewCalendarEntryForm(),
      });
      setNewEntryFormResetKey((current) => current + 1);
    };

    void validateDuplicateTask();
  }, [
    newEntryForm.assignedTo,
    newEntryForm.clientId,
    newEntryForm.date,
    newEntryForm.relatedMatter,
    newEntryForm.time,
    newEntryForm.type,
    selectedDate,
    teamFilterOptions,
    toast,
  ]);

  useEffect(() => () => {
    if (accordionCollapseTimeoutRef.current) {
      window.clearTimeout(accordionCollapseTimeoutRef.current);
    }
  }, []);

  const clearAccordionCollapseTimeout = () => {
    if (!accordionCollapseTimeoutRef.current) return;
    window.clearTimeout(accordionCollapseTimeoutRef.current);
    accordionCollapseTimeoutRef.current = null;
  };

  const scheduleAccordionCollapse = (scope: "day" | "week" | "summary", eventId: string) => {
    clearAccordionCollapseTimeout();
    accordionCollapseTimeoutRef.current = window.setTimeout(() => {
      if (scope === "day") {
        setOpenDayAccordionId((current) => (current === eventId ? null : current));
      } else if (scope === "week") {
        setOpenWeekAccordionId((current) => (current === eventId ? null : current));
      } else {
        setOpenSummaryAccordionId((current) => (current === eventId ? null : current));
      }
      accordionCollapseTimeoutRef.current = null;
    }, 3_000);
  };

  useEffect(() => {
    if (view !== "day" && view !== "week") return;
    const container = mainTimeGridScrollRef.current;
    if (!container) return;
    container.scrollTop = 8 * 94;
  }, [view, selectedDate]);

  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;

    const loadTeamFilterOptions = async () => {
      const { data: profilesData } = await (supabase as any)
        .from("profiles")
        .select("id,user_name,user_surname,user_email")
        .order("user_name", { ascending: true });

      const { data: subusersData } = await (supabase as any)
        .from("subusers")
        .select("auth_user_id,name,surname,email,status")
        .in("status", ["accepted", "active"])
        .order("name", { ascending: true });

      if (!isMounted) return;

      const nextOptions = new Map<string, TeamFilterOption>();

      (Array.isArray(profilesData) ? profilesData : []).forEach((row: any) => {
        const id = String(row?.id || "").trim();
        if (!id) return;
        const firstName = String(row?.user_name || "").trim();
        const surname = String(row?.user_surname || "").trim();
        const email = String(row?.user_email || "").trim();
        const label = [firstName, surname].filter(Boolean).join(" ").trim() || email || "User";
        nextOptions.set(id, {
          id,
          label,
          email,
          type: "main",
        });
      });

      (Array.isArray(subusersData) ? subusersData : []).forEach((row: any) => {
        const id = String(row?.auth_user_id || "").trim();
        if (!id || nextOptions.has(id)) return;
        const firstName = String(row?.name || "").trim();
        const surname = String(row?.surname || "").trim();
        const email = String(row?.email || "").trim();
        const label = [firstName, surname].filter(Boolean).join(" ").trim() || email || "Subuser";
        nextOptions.set(id, {
          id,
          label,
          email,
          type: "subuser",
        });
      });

      const orderedOptions = [...nextOptions.values()].sort((left, right) => left.label.localeCompare(right.label));
      setTeamFilterOptions(orderedOptions);
    };

    void loadTeamFilterOptions();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    let isMounted = true;

    const loadClients = async () => {
      if (!user?.id) {
        if (isMounted) setClientLoadMessage("Sign in to load clients.");
        return;
      }

      const { data, error } = await (supabase as any)
        .from("clients")
        .select("id,registered_name,trading_as,trading_name,company_type")
        .order("registered_name", { ascending: true, nullsFirst: false });

      if (!isMounted) return;

      if (error) {
        setClientRows([]);
        setClientLoadMessage("Unable to load clients.");
        return;
      }

      const rows = Array.isArray(data) ? data as CalendarClientRow[] : [];
      setClientRows(rows);
      setClientLoadMessage(rows.length === 0 ? "No clients found." : "No matching client found.");
    };

    void loadClients();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    let isMounted = true;
    const clientId = normalizeText(newEntryForm.clientId);

    if (!clientId) {
      setSelectedClientMatterRows([]);
      setSelectedClientMatterLoadMessage("Select a client first.");
      return () => {
        isMounted = false;
      };
    }

    setSelectedClientMatterLoadMessage("Loading active matters...");
    setNewEntryForm((current) => (
      current.relatedMatter === "__none__" ? current : { ...current, relatedMatter: "__none__" }
    ));

    const loadSelectedClientMatters = async () => {
      const { data, error } = await (supabase as any)
        .from("case_files")
        .select("id,file_number,parties,case_type,case_subtype,status")
        .eq("client_id", clientId)
        .order("file_number", { ascending: true, nullsFirst: false });

      if (!isMounted) return;

      if (error) {
        setSelectedClientMatterRows([]);
        setSelectedClientMatterLoadMessage("Unable to load active matters.");
        return;
      }

      const rows = (Array.isArray(data) ? data as CalendarMatterRow[] : [])
        .filter((row) => normalizeText(row.status).toLowerCase() === "active");
      setSelectedClientMatterRows(rows);
      setSelectedClientMatterLoadMessage(rows.length === 0 ? "No active matters for this client." : "No active matters found.");
    };

    void loadSelectedClientMatters();

    return () => {
      isMounted = false;
    };
  }, [newEntryForm.clientId]);

  const headerRangeLabel =
    view === "month"
      ? format(selectedDate, "MMMM yyyy")
      : view === "day"
        ? format(selectedDate, "EEEE, d MMMM yyyy")
        : `${format(visibleDays[0], "d MMM")} - ${format(visibleDays[visibleDays.length - 1], "d MMM yyyy")}`;

  const resetNewEntryForm = () => {
    setNewEntryForm(getDefaultNewCalendarEntryForm());
    setNewEntryFormResetKey((current) => current + 1);
  };

  const handleMainCalendarPrevious = () => {
    setSelectedDate((current) =>
      view === "month" ? subMonths(current, 1) : addDays(current, view === "day" ? -1 : -7),
    );
  };

  const handleMainCalendarNext = () => {
    setSelectedDate((current) =>
      view === "month" ? addMonths(current, 1) : addDays(current, view === "day" ? 1 : 7),
    );
  };

  const currentTimeHour = currentTime.getHours() + currentTime.getMinutes() / 60;
  const showCurrentTimeLine =
    (view === "day" || view === "week") &&
    currentTimeHour >= hours[0] &&
    currentTimeHour <= hours[hours.length - 1] + 1 &&
    visibleDays.some((day) => isSameDay(day, currentTime));
  const currentTimeLineTop = (currentTimeHour - hours[0]) * 94;
  const isCurrentCalendarPeriod =
    view === "month"
      ? isSameMonth(selectedDate, currentTime)
      : view === "week"
        ? isSameWeek(selectedDate, currentTime, { weekStartsOn: 1 })
        : isSameDay(selectedDate, currentTime);
  const filteredClientRows = useMemo(() => {
    const searchValue = clientSearchValue.trim().toLowerCase();
    if (!searchValue) return clientRows;
    return clientRows.filter((client) => {
      const registeredName = normalizeText(client.registered_name).toLowerCase();
      const tradingAsName = normalizeText(client.trading_as || client.trading_name).toLowerCase();
      return registeredName.startsWith(searchValue) || tradingAsName.startsWith(searchValue);
    });
  }, [clientRows, clientSearchValue]);
  const selectedClientLabel = newEntryForm.clientId ? newEntryForm.client : "Select client";
  const isNewEntryFormComplete = useMemo(() => {
    const [hour = "", minute = ""] = newEntryForm.time.split(":");
    return Boolean(
      normalizeText(newEntryForm.date) &&
        normalizeText(hour) &&
        normalizeText(minute) &&
        normalizeText(newEntryForm.duration) &&
        normalizeText(newEntryForm.type) &&
        normalizeText(newEntryForm.clientId) &&
        normalizeText(newEntryForm.assignedTo) &&
        normalizeText(newEntryForm.description),
    );
  }, [newEntryForm]);
  const selectedDatePublicHolidayName = southAfricanPublicHolidayByDate[format(selectedDate, "yyyy-MM-dd")];
  return (
    <div className="space-y-0 -m-6 overflow-x-hidden">
      <div className="overflow-x-hidden overflow-y-hidden rounded-tl-sm border border-slate-300 border-l-0 border-r-0 bg-white shadow-sm h-[calc(100dvh-var(--app-header-height,5rem))] pb-0">
        <div className="flex h-full flex-col">
          <div className="pl-4 pr-4 pt-1">
            <div className="flex flex-col gap-4 pt-[10px] pb-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="text-4xl font-normal text-[#3eca44] -ml-1">Calendar</h1>
                <p className="mt-1.5 text-[11px] text-slate-600">
                  Plan meetings, track deadlines, and manage your practice schedule in one place.
                </p>
              </div>
              <div className="lg:pt-1">
                <PageDateStamp className="text-slate-500 [&_svg]:text-slate-500" />
              </div>
            </div>
          </div>

          <section className="flex-1 min-h-0 overflow-x-hidden bg-white pl-4 pr-5 pb-4 pt-3">
            <div className="grid h-full min-h-0 gap-4 overflow-x-hidden xl:grid-cols-[minmax(0,1fr)_290px]">
        <aside className="order-2 flex h-full max-h-full min-h-0 flex-col overflow-hidden rounded-sm border border-slate-300 bg-white shadow-none xl:order-2">
          <div className="border-b border-slate-100 px-4 py-2">
            <div className="flex h-9 items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <h2 className="text-[17px] font-semibold leading-none text-slate-900">Summary</h2>
                <p className="truncate text-right text-[10.5px] font-medium text-slate-500">{summaryRangeLabel}</p>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {isCalendarLoading ? (
              <div className="rounded-[6px] border border-slate-200 bg-slate-50 px-3 py-4 text-center text-[11px] font-medium text-slate-500">
                Loading calendar items...
              </div>
            ) : summaryEntries.length === 0 ? (
              <div className="rounded-[6px] border border-slate-200 bg-slate-50 px-3 py-4 text-center text-[11px] font-medium text-slate-500">
                No events or tasks for this view.
              </div>
            ) : (
              <div className="space-y-2">
                {summaryEntries.map((event) => {
                  const isSummaryAccordionOpen = openSummaryAccordionId === event.id;
                  return (
                    <Accordion
                      key={event.id}
                      type="single"
                      collapsible
                      value={isSummaryAccordionOpen ? event.id : ""}
                      onValueChange={(value) => setOpenSummaryAccordionId(value || null)}
                      onMouseEnter={clearAccordionCollapseTimeout}
                      onMouseLeave={() => scheduleAccordionCollapse("summary", event.id)}
                      className={cn(
                        "overflow-hidden rounded-[6px] border shadow-none transition-[height] duration-200 ease-out",
                        event.palette.card,
                        event.palette.border,
                      )}
                      style={{ height: isSummaryAccordionOpen ? 66 : 28 }}
                    >
                      <AccordionItem value={event.id} className="relative h-full border-b-0">
                        <span className={cn("absolute inset-y-1.5 left-0 z-10 w-1 rounded-full", event.palette.accent)} />
                        <AccordionTrigger className="min-h-[26px] gap-2 px-2 py-1 pl-4 text-left hover:no-underline [&>svg]:hidden">
                          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                            <p className="truncate text-[11px] font-semibold leading-[1.1] text-slate-800">{event.typeLabel}</p>
                            <div className="flex shrink-0 items-center gap-1">
                              <span className={cn("text-[9px] font-semibold leading-none", event.palette.text)}>
                                {formatTimeUntilCalendarEntry(event.start, currentTime)}
                              </span>
                              <span
                                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-[8px] font-semibold leading-none text-slate-600"
                                aria-label={event.ownerLabel}
                              >
                                {getInitials(event.ownerLabel)}
                              </span>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="cursor-pointer px-2 pb-1 pl-4" onClick={() => setOpenSummaryAccordionId(null)}>
                          <div className="space-y-[3px]">
                            <p className={cn("truncate text-[9px] font-semibold leading-none", event.palette.text)}>
                              {event.clientLabel || "--"}
                            </p>
                            <p className="truncate text-[9px] font-medium leading-none text-slate-500">
                              {formatCalendarEntryDateTime(event)}
                            </p>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <div className="order-1 flex min-h-0 flex-col overflow-hidden rounded-sm border border-slate-300 bg-white shadow-none xl:order-1">
          <div className="employee-table-scroll relative flex min-h-0 flex-1 flex-col overflow-hidden p-4 pt-12">
            <div className="absolute left-4 right-4 top-2 z-50 flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-[17px] font-semibold leading-none text-slate-950">{headerRangeLabel}</h2>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    setSelectedDate(today);
                  }}
                  className={cn(
                    "inline-flex h-7 items-center justify-center rounded-full px-3 text-[11px] font-semibold transition-colors",
                    isCurrentCalendarPeriod
                      ? "bg-[#2D4256] text-white hover:bg-[#26394b] hover:text-white"
                      : "bg-[#dbe4f0] text-[#2D4256] hover:bg-[#ccd8e8] hover:text-[#2D4256]",
                  )}
                >
                  Today
                </button>
              </div>

              <div className="flex items-center gap-2">
                <DropdownMenu
                  open={isSummaryFilterOpen}
                  onOpenChange={(open) => {
                    setIsSummaryFilterOpen(open);
                    if (!open) setExpandedSummaryFilterSection(null);
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="inline-flex h-8 w-24 items-center justify-between rounded-[4px] border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 shadow-none transition-colors hover:border-[#3eca44] hover:bg-white hover:text-[#2f9f35] focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:border-[#3eca44]"
                    >
                      <span>Filter</span>
                      <ChevronDown className={cn("h-4 w-4 transition-transform", isSummaryFilterOpen && "rotate-180")} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={0} className="w-[260px] rounded-[4px] border border-slate-200 bg-white p-0 shadow-lg">
                    <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                      <span className="text-[12px] font-semibold text-slate-800">Filter</span>
                      <button
                        type="button"
                        className="text-[10px] font-semibold uppercase tracking-wide text-[#2f9f35] hover:underline"
                        onClick={() => {
                          setSummaryAssigneeFilter("all");
                          setSummaryTypeFilter("all");
                          setSummaryCategoryFilter("all");
                          setIsSummaryFilterOpen(false);
                        }}
                      >
                        Clear
                      </button>
                    </div>
                    <div className="divide-y divide-slate-200">
                      {["assignee", "type", "category"].map((section) => (
                        <div key={section}>
                          <button
                            type="button"
                            className={`flex h-9 w-full items-center justify-between px-3 text-left text-[11px] font-semibold text-slate-800 hover:bg-slate-100 ${expandedSummaryFilterSection === section ? "bg-slate-100" : ""}`}
                            onClick={() => setExpandedSummaryFilterSection((prev) => (prev === section ? null : section))}
                          >
                            <span>{section === "assignee" ? "Assignee" : section === "type" ? "Type" : "Category"}</span>
                            <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform ${expandedSummaryFilterSection === section ? "rotate-180" : ""}`} />
                          </button>
                          {expandedSummaryFilterSection === section ? (
                            <div className="max-h-[220px] overflow-y-auto px-3 pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                              {(section === "assignee"
                                ? [{ value: "all", label: "All" }, ...summaryAssigneeOptions]
                                : section === "type"
                                  ? [
                                      { value: "all", label: "All" },
                                      { value: "task", label: "Task" },
                                      { value: "matter", label: "Matter" },
                                    ]
                                  : [{ value: "all", label: "All" }, ...summaryCategoryOptions.map((value) => ({ value, label: value }))]
                              ).map((option) => {
                                const selected =
                                  section === "assignee"
                                    ? summaryAssigneeFilter === option.value
                                    : section === "type"
                                      ? summaryTypeFilter === option.value
                                      : summaryCategoryFilter === option.value;
                                return (
                                  <button
                                    key={`${section}-${option.value}`}
                                    type="button"
                                    className="flex h-8 w-full items-center justify-between gap-3 text-left text-[11px] text-slate-700 hover:bg-[#3eca44]/10 hover:text-[#2f9f35]"
                                    onClick={() => {
                                      if (section === "assignee") setSummaryAssigneeFilter(option.value);
                                      if (section === "type") {
                                        setSummaryTypeFilter(option.value as "all" | CalendarEntry["kind"]);
                                        setSummaryCategoryFilter("all");
                                      }
                                      if (section === "category") setSummaryCategoryFilter(option.value);
                                      setIsSummaryFilterOpen(false);
                                    }}
                                  >
                                    <span className="truncate">{option.label}</span>
                                    {selected ? <Check className="h-3.5 w-3.5 shrink-0 text-[#2f9f35]" /> : null}
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="inline-flex items-center rounded-[6px] border border-slate-200 bg-slate-50 p-0.5">
                  <button
                    type="button"
                    onClick={handleMainCalendarPrevious}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-[4px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    aria-label="Previous period"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  {(["day", "week", "month"] as CalendarView[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setView(option)}
                      className={cn(
                        "rounded-[4px] px-3 py-1 text-[10.5px] font-semibold capitalize transition-all",
                        view === option
                          ? "bg-[#2D4256] text-white shadow-[0_10px_24px_rgba(45,66,86,0.22)]"
                          : "text-slate-500 hover:text-slate-900",
                      )}
                    >
                      {option}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleMainCalendarNext}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-[4px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    aria-label="Next period"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    resetNewEntryForm();
                    setIsNewEntryOpen(true);
                  }}
                  className="inline-flex h-8 min-w-[108px] items-center justify-center rounded-[4px] bg-[#3eca44] px-3 text-[11px] font-semibold text-white shadow-none hover:bg-[#37bb3e]"
                >
                  <span>New Task</span>
                </Button>
              </div>
            </div>
            <div className="min-h-0 min-w-0 flex-1">
              {view === "month" ? (
                <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[6px] border border-slate-200">
                  <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
                      <div key={label} className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {label}
                      </div>
                    ))}
                  </div>
                  <div
                    className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                  >
                    <div
                      className="grid h-full min-h-[520px] grid-cols-7"
                      style={{ gridTemplateRows: `repeat(${monthWeekCount}, minmax(0, 1fr))` }}
                    >
                      {monthDays.map((day) => {
                        const dayKey = format(day, "yyyy-MM-dd");
                        const dayTypeSummary = monthTypeSummaryByDay.get(dayKey) ?? [];
                        const publicHolidayName = southAfricanPublicHolidayByDate[dayKey];
                        const dayCellContent = (
                          <>
                            {publicHolidayName ? (
                              <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 hidden w-[92%] -translate-x-1/2 -translate-y-1/2 group-hover:block">
                                <div className="mx-auto max-w-full rounded border border-[#3eca44]/35 bg-white px-2 py-1 text-center text-[10px] font-medium text-slate-700 shadow-sm">
                                  {publicHolidayName}
                                </div>
                              </div>
                            ) : null}
                            <div className="mb-2 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDate(day);
                                  setView("day");
                                }}
                                className={cn(
                                  "flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold transition-colors",
                                  isSameDay(day, selectedDate)
                                    ? "bg-[#2D4256] text-white"
                                    : isSameMonth(day, selectedDate)
                                      ? "text-slate-700 hover:bg-slate-100"
                                      : "text-slate-300 hover:bg-slate-100",
                                  publicHolidayName && "text-[#2f9f35] hover:text-[#2f9f35] focus:text-[#2f9f35]",
                                )}
                              >
                                {format(day, "d")}
                              </button>
                            </div>
                            <div className="grid grid-cols-4 gap-1">
                              {dayTypeSummary.map((item, itemIndex) => {
                                const summaryRowIndex = Math.floor(itemIndex / 4);
                                return (
                                <button
                                  key={`${dayKey}-${item.typeLabel}`}
                                  type="button"
                                  onClick={() => {
                                    setSelectedDate(day);
                                    setView("day");
                                  }}
                                  className="group/month-item h-4 w-4 rounded-[3px] text-left hover:z-40 focus-visible:z-40 focus-visible:outline-none"
                                  aria-label={`${item.typeLabel}${item.count > 1 ? `, ${item.count}` : ""}`}
                                >
                                  <span
                                    className={cn(
                                      "flex h-4 w-4 items-center justify-center rounded-[3px] border text-[9px] font-semibold leading-none shadow-none transition-colors duration-200",
                                      item.palette.card,
                                      item.palette.text,
                                      item.palette.monthBorder,
                                    )}
                                  >
                                    {item.count > 1 ? (
                                      item.count
                                    ) : null}
                                  </span>
                                  <span
                                    className={cn(
                                      "pointer-events-none absolute left-2.5 right-2.5 z-40 flex h-5 origin-center scale-x-0 items-center rounded-[3px] border shadow-sm transition-transform duration-300 ease-out group-hover/month-item:scale-x-100 group-focus-visible/month-item:scale-x-100",
                                      item.palette.card,
                                      item.palette.monthBorder,
                                    )}
                                    style={{ top: `${46 + summaryRowIndex * 20}px` }}
                                  >
                                    <span
                                      className={cn(
                                        "hidden w-full items-center justify-between gap-2 px-2 text-[9px] font-semibold leading-none group-hover/month-item:flex group-focus-visible/month-item:flex",
                                        item.palette.text,
                                      )}
                                    >
                                      <span className="min-w-0 truncate">
                                        {item.typeLabel}
                                      </span>
                                      {item.count > 1 ? <span className="shrink-0">{item.count}</span> : null}
                                    </span>
                                  </span>
                                </button>
                                );
                              })}
                            </div>
                          </>
                        );
                        const dayCellClassName = cn(
                          "group relative min-h-0 border-b border-r border-slate-200 p-2.5 align-top",
                          isSameDay(day, new Date()) && "border border-[#3eca44]",
                          !isSameMonth(day, selectedDate) && "bg-slate-50/80",
                          publicHolidayName && "bg-[#eef9ef]",
                        );
                        const dayCell = (
                          <div
                            className={dayCellClassName}
                          >
                            {dayCellContent}
                          </div>
                        );
                        return (
                          <Fragment key={day.toISOString()}>
                            {dayCell}
                          </Fragment>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : view === "day" ? (
                <div className="overflow-hidden rounded-[6px] border border-slate-200">
                  <div
                    ref={mainTimeGridScrollRef}
                    className="h-[620px] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                  >
                    <div className="w-full">
                      <div
                        className="sticky top-0 z-30 grid border-b border-slate-200 bg-slate-50"
                        style={{ gridTemplateColumns: "84px minmax(0, 1fr)" }}
                      >
                        <div className="border-r border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Time</p>
                        </div>
                        <div className="bg-slate-50 px-4 py-3">
                          <div className="flex items-baseline gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className={cn("text-[15px] font-semibold text-slate-900", selectedDatePublicHolidayName && "text-[#2f9f35]")}>
                                  {format(selectedDate, "d")}
                                </p>
                              </TooltipTrigger>
                              {selectedDatePublicHolidayName ? (
                                <TooltipContent side="top" className="rounded border border-[#3eca44]/35 bg-white text-[10px] font-medium text-slate-700 shadow-none">
                                  {selectedDatePublicHolidayName}
                                </TooltipContent>
                              ) : null}
                            </Tooltip>
                            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
                              {format(selectedDate, "EEEE")}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid w-full" style={{ gridTemplateColumns: "84px minmax(0, 1fr)" }}>
                        {hours.map((hour) => {
                          const hourEvents = selectedDayEventsByHour.get(hour) ?? [];
                          const isCurrentHourRow = isSameDay(selectedDate, currentTime) && currentTime.getHours() === hour;

                          return (
                            <Fragment key={`hour-${hour}`}>
                              <div
                                className={cn(
                                  "border-r border-b border-slate-100 px-3 pt-2.5 text-right text-[10px] font-medium text-slate-400",
                                  isMutedHour(hour) && "bg-slate-100 text-slate-300",
                                )}
                              >
                                {format(setHours(new Date(), hour), "hh aa")}
                              </div>
                              <div
                                className={cn(
                                  "relative min-h-[94px] border-b border-slate-100 bg-white px-2 py-2",
                                  isMutedHour(hour) && "bg-slate-100",
                                )}
                              >
                                {isCurrentHourRow ? (
                                  <div
                                    className="pointer-events-none absolute left-0 right-0 top-0 z-20 border-t-2 border-slate-400"
                                  />
                                ) : null}
                                <div className="space-y-2">
                                  {hourEvents.map((event) => (
                                    (() => {
                                      const isDayAccordionOpen = openDayAccordionId === event.id;
                                      return (
                                    <Accordion
                                      key={event.id}
                                      type="single"
                                      collapsible
                                      value={isDayAccordionOpen ? event.id : ""}
                                      onValueChange={(value) => setOpenDayAccordionId(value || null)}
                                      onMouseEnter={clearAccordionCollapseTimeout}
                                      onMouseLeave={() => scheduleAccordionCollapse("day", event.id)}
                                      className={cn(
                                        "overflow-hidden rounded-[6px] border shadow-none",
                                        event.palette.card,
                                        event.palette.border,
                                      )}
                                    >
                                      <AccordionItem value={event.id} className="relative border-b-0">
                                        <span className={cn("absolute inset-y-3 left-0 z-10 w-1 rounded-full", event.palette.accent)} />
                                        {event.kind === "matter" && event.matterId ? (
                                          <button
                                            type="button"
                                            className={cn(
                                              "absolute right-2.5 top-2 z-20 text-[10px] font-semibold leading-none text-black transition-colors hover:underline",
                                              event.palette.hoverText,
                                            )}
                                            onClick={(clickEvent) => {
                                              clickEvent.stopPropagation();
                                              navigate("/case-files", { state: { openCaseId: event.matterId } });
                                            }}
                                          >
                                            View
                                          </button>
                                        ) : null}
                                        <AccordionTrigger className="gap-2 px-2.5 py-1.5 pl-4 pr-12 text-left hover:no-underline [&>svg]:hidden">
                                          <div className="flex min-w-0 items-center gap-1.5">
                                            <p className="truncate text-[11px] font-semibold text-slate-800">{event.title}</p>
                                            {event.clientLabel ? (
                                              <span className="shrink-0 rounded-full bg-white/80 px-1.5 py-0.5 text-[8px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                                                {event.clientLabel}
                                              </span>
                                            ) : null}
                                          </div>
                                        </AccordionTrigger>
                                        <AccordionContent
                                          className="cursor-pointer px-2.5 pb-1.5 pt-0 pl-4"
                                          onClick={() => setOpenDayAccordionId(null)}
                                        >
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                              {event.kind === "task" && event.descriptionLabel ? (
                                                <p className="truncate text-[9px] leading-none font-medium text-slate-500">{event.descriptionLabel}</p>
                                              ) : null}
                                              {event.kind !== "task" && event.secondaryLabel ? (
                                                <p className="truncate text-[9px] leading-none font-medium text-slate-500">{event.secondaryLabel}</p>
                                              ) : null}
                                              <p className="mt-[3px] text-[9px] leading-none font-medium text-slate-500">
                                                {format(event.start, "hh:mm aa")} - {format(event.end, "hh:mm aa")}
                                              </p>
                                              <span
                                                className="mt-[3px] inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-[8px] font-semibold text-slate-600"
                                                aria-label={event.ownerLabel}
                                                title={event.ownerLabel}
                                              >
                                                {getInitials(event.ownerLabel)}
                                              </span>
                                            </div>
                                          </div>
                                        </AccordionContent>
                                      </AccordionItem>
                                    </Accordion>
                                      );
                                    })()
                                  ))}
                                </div>
                              </div>
                            </Fragment>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-[6px] border border-slate-200">
                  <div
                    ref={mainTimeGridScrollRef}
                    className="h-[620px] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                  >
                    <div className="relative w-full">
                      {todayVisibleDayIndex >= 0 ? (
                        <div
                          className="pointer-events-none absolute bottom-0 z-40 rounded-r-[6px] border border-[#3eca44]"
                          style={{
                            top: 0,
                            left: `calc(84px + ((100% - 84px) / ${visibleDays.length}) * ${todayVisibleDayIndex})`,
                            width: `calc((100% - 84px) / ${visibleDays.length})`,
                          }}
                        />
                      ) : null}
                      <div
                        className="sticky top-0 z-50 grid border-b border-slate-200 bg-slate-50"
                        style={{ gridTemplateColumns: `84px repeat(${visibleDays.length}, minmax(0, 1fr))` }}
                      >
                        <div className="border-r border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Time</p>
                        </div>
                        {visibleDays.map((day) => {
                          const isTodayHeader = isSameDay(day, currentTime);
                          const isLastVisibleDay = day.getTime() === visibleDays[visibleDays.length - 1]?.getTime();
                          const publicHolidayName = southAfricanPublicHolidayByDate[format(day, "yyyy-MM-dd")];
                          return (
                          <div
                            key={day.toISOString()}
                            className={cn(
                              "relative border-r border-slate-200 bg-slate-50 px-4 py-3 last:border-r-0",
                              isTodayHeader && "border-l border-r border-t border-[#3eca44] last:border-r",
                              isTodayHeader && isLastVisibleDay && "rounded-tr-[6px]",
                            )}
                          >
                            <div className="flex items-baseline gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className={cn("text-[15px] font-semibold text-slate-900", publicHolidayName && "text-[#2f9f35]")}>
                                    {format(day, "d")}
                                  </p>
                                </TooltipTrigger>
                                {publicHolidayName ? (
                                  <TooltipContent side="top" className="rounded border border-[#3eca44]/35 bg-white text-[10px] font-medium text-slate-700 shadow-none">
                                    {publicHolidayName}
                                  </TooltipContent>
                                ) : null}
                              </Tooltip>
                              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
                                {format(day, "EEEE")}
                              </p>
                            </div>
                          </div>
                        )})}
                      </div>

                      <div
                        className="relative grid w-full"
                        style={{ gridTemplateColumns: `84px repeat(${visibleDays.length}, minmax(0, 1fr))` }}
                      >
                        <div className="relative border-r border-slate-200 bg-white">
                        {hours.map((hour) => (
                          <div
                            key={hour}
                            className={cn(
                              "flex h-[94px] items-start justify-end border-b border-slate-100 px-3 pt-2.5 text-[10px] font-medium text-slate-400",
                              isMutedHour(hour) && "bg-slate-100 text-slate-300",
                            )}
                          >
                            {format(setHours(new Date(), hour), "hh aa")}
                          </div>
                        ))}

                        {showCurrentTimeLine && view === "week" ? (
                          <div
                            className="pointer-events-none absolute right-0 z-20 h-2.5 w-2.5 translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-400"
                            style={{ top: currentTimeLineTop }}
                          />
                        ) : null}
                        </div>

                        {showCurrentTimeLine && view === "week" ? (
                          <div
                            className="pointer-events-none absolute left-[84px] right-0 z-20 border-t-2 border-slate-400"
                            style={{ top: currentTimeLineTop }}
                          />
                        ) : null}

                        {visibleDays.map((day) => {
                          const dayEvents = eventsByDay.get(format(day, "yyyy-MM-dd")) ?? [];
                          return (
                            <div
                              key={day.toISOString()}
                              className={cn(
                                "relative border-r border-slate-200 last:border-r-0",
                              )}
                            >
                              {hours.map((hour) => (
                                <div
                                  key={hour}
                                  className={cn(
                                    "h-[94px] border-b border-slate-100 bg-white",
                                    isMutedHour(hour) && "bg-slate-100",
                                  )}
                                />
                              ))}

                              {dayEvents.map((event) => {
                                const startHour = event.start.getHours() + event.start.getMinutes() / 60;
                                const top = (startHour - hours[0]) * 94;
                                const collapsedHeight = 28;
                                const expandedHeight = 66;
                                const isWeekAccordionOpen = openWeekAccordionId === event.id;

                                return (
                                  <Accordion
                                    key={event.id}
                                    className={cn(
                                      "absolute left-1.5 right-1.5 overflow-hidden rounded-[6px] border shadow-none transition-[height] duration-200 ease-out",
                                      event.palette.card,
                                      event.palette.border,
                                    )}
                                    type="single"
                                    collapsible
                                    value={isWeekAccordionOpen ? event.id : ""}
                                    onValueChange={(value) => setOpenWeekAccordionId(value || null)}
                                    onMouseEnter={clearAccordionCollapseTimeout}
                                    onMouseLeave={() => scheduleAccordionCollapse("week", event.id)}
                                    style={{ top: top + 8, height: isWeekAccordionOpen ? expandedHeight : collapsedHeight }}
                                  >
                                    <AccordionItem value={event.id} className="relative h-full border-b-0">
                                      <span className={cn("absolute inset-y-1.5 left-0 z-10 w-1 rounded-full", event.palette.accent)} />
                                      <AccordionTrigger className="min-h-[26px] gap-2 px-2 py-1 pl-4 text-left hover:no-underline [&>svg]:hidden">
                                        <p className="truncate text-[11px] font-semibold leading-[1.1] text-slate-800">{event.typeLabel}</p>
                                      </AccordionTrigger>
                                      <AccordionContent
                                        className="cursor-pointer px-2 pb-1 pl-4"
                                        onClick={() => setOpenWeekAccordionId(null)}
                                      >
                                        {event.clientLabel ? (
                                          <p className="truncate text-[9px] leading-none font-medium text-slate-500">{event.clientLabel}</p>
                                        ) : null}
                                        <span
                                          className="mt-[5px] inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#3eca44] bg-white/80 text-[8px] font-semibold leading-none text-[#2f9f35]"
                                          aria-label={event.ownerLabel}
                                          title={event.ownerLabel}
                                        >
                                          {getInitials(event.ownerLabel)}
                                        </span>
                                      </AccordionContent>
                                    </AccordionItem>
                                  </Accordion>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
            </div>
          </section>
        </div>
      </div>
      <Dialog
        open={isNewEntryOpen}
        onOpenChange={(open) => {
          setIsNewEntryOpen(open);
          if (!open) resetNewEntryForm();
        }}
      >
        <DialogContent className="w-[94vw] max-w-[620px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-white">
              <CalendarDays className="h-4 w-4" />
              <span>New Task</span>
            </DialogTitle>
            <DialogClose asChild>
              <button type="button" className="text-white hover:text-white/80" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>

          <form
            key={newEntryFormResetKey}
            onSubmit={async (event) => {
              event.preventDefault();
              if (!user?.id || isSavingNewEntry || !isNewEntryFormComplete) return;

              const relatedMatterId = normalizeText(newEntryForm.relatedMatter);
              const assignee = teamFilterOptions.find((member) => member.label === newEntryForm.assignedTo);
              if (!assignee?.id) {
                toast({
                  title: "Missing assignee",
                  description: "Please select a valid assignee.",
                  variant: "destructive",
                });
                return;
              }

              setIsSavingNewEntry(true);
              try {
                const companyId = await resolveCalendarCompanyId(user);
                const createdByName = await resolveCalendarCurrentUserName(user);
                if (!companyId) {
                  toast({
                    title: "Unable to save task",
                    description: "Could not determine the company for this task.",
                    variant: "destructive",
                  });
                  return;
                }

                const { data: insertedTask, error: insertError } = await (supabase as any)
                  .from("diary_tasks")
                  .insert({
                    company_id: companyId,
                    client_id: newEntryForm.clientId,
                    related_matter_id: relatedMatterId && relatedMatterId !== "__none__" ? relatedMatterId : null,
                    diary_date: newEntryForm.date,
                    task_time: newEntryForm.time,
                    duration: newEntryForm.duration,
                    description: newEntryForm.description.trim(),
                    task_type: newEntryForm.type,
                    assigned_to_user_id: assignee.id,
                    assigned_to_name: assignee.label,
                    created_by: user.id,
                    created_by_name: createdByName,
                  })
                  .select("id")
                  .single();

                if (insertError) throw insertError;

                const taskCreatedAt = new Date().toISOString();
                void logActivity({
                  activityKey: taskCreatedActivityKey,
                  actionSentence: `${createdByName} created a task on ${formatActivityDate(taskCreatedAt)}`,
                  sourceTable: "diary_tasks",
                  sourceRecordId: String((insertedTask as any)?.id || ""),
                  parentTable: relatedMatterId && relatedMatterId !== "__none__" ? "case_files" : "clients",
                  parentId: relatedMatterId && relatedMatterId !== "__none__" ? relatedMatterId : newEntryForm.clientId,
                  clientId: newEntryForm.clientId,
                  clientName: newEntryForm.client,
                  matterId: relatedMatterId && relatedMatterId !== "__none__" ? relatedMatterId : null,
                  documentType: newEntryForm.type,
                  occurredAt: taskCreatedAt,
                  activityDate: taskCreatedAt.slice(0, 10),
                  metadata: {
                    source: "calendar",
                    task_type: newEntryForm.type,
                    diary_date: newEntryForm.date,
                    assigned_to: assignee.label,
                  },
                });

                toast({
                  title: "Task saved",
                  description: "The diary task has been added.",
                });
                setCalendarRefreshKey((current) => current + 1);
                setIsNewEntryOpen(false);
              } catch (error: any) {
                toast({
                  title: "Unable to save task",
                  description: error?.message || "Save failed.",
                  variant: "destructive",
                });
              } finally {
                setIsSavingNewEntry(false);
              }
            }}
          >
            <div className="bg-white px-4 py-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="relative space-y-1">
                  <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Date <span className="text-red-600">*</span></span>
                  <Input
                    id="calendarTaskDate"
                    type="text"
                    readOnly
                    placeholder="Please select a date"
                    value={newEntryForm.date ? formatDisplayDate(newEntryForm.date) : ""}
                    onClick={() => openDatePicker(newEntryDateInputRef.current)}
                    onFocus={() => openDatePicker(newEntryDateInputRef.current)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openDatePicker(newEntryDateInputRef.current);
                      }
                    }}
                    className={calendarFieldInputClass}
                  />
                  <input
                    ref={newEntryDateInputRef}
                    type="date"
                    value={newEntryForm.date}
                    onChange={(event) => {
                      const value = event.target.value;
                      setNewEntryForm((current) => ({ ...current, date: value }));
                      void warnIfSouthAfricanPublicHoliday(value);
                    }}
                    className="sr-only"
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                </div>

                <div className="relative space-y-1">
                  <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Assigned To <span className="text-red-600">*</span></span>
                  <Select
                    value={newEntryForm.assignedTo || undefined}
                    onValueChange={(value) => setNewEntryForm((current) => ({ ...current, assignedTo: value }))}
                  >
                    <SelectTrigger id="calendarTaskAssignedTo" className={`${calendarFieldSelectTriggerClass} ${calendarDropdownToneClass} h-8 text-[11px]`}>
                      <SelectValue placeholder="Select assignee" />
                    </SelectTrigger>
                    <SelectContent className="text-[11px]">
                      {teamFilterOptions.map((member) => (
                        <SelectItem key={member.id} value={member.label} className={calendarSelectItemClass}>{member.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="relative space-y-1">
                  <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Start Time <span className="text-red-600">*</span></span>
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_60px] gap-2">
                    <Select
                      value={(newEntryForm.time.split(":")[0] || "") || undefined}
                      onValueChange={(value) => setNewEntryForm((current) => ({ ...current, time: `${value}:${current.time.split(":")[1] || "00"}` }))}
                    >
                      <SelectTrigger
                        id="calendarTaskTimeHour"
                        className={`${calendarFieldSelectTriggerClass} ${calendarDropdownToneClass} !h-8 !border-slate-300 !text-[10px] hover:!border-[#3eca44] focus:!border-[#3eca44] focus-visible:!border-[#3eca44] [&>span]:text-[10px] [&>span]:font-medium data-[placeholder]:[&>span]:font-normal data-[placeholder]:[&>span]:text-slate-400`}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Clock3 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <SelectValue placeholder="Hour" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="text-[10px]">
                        {calendarTaskTimeHourOptions.map((hour) => (
                          <SelectItem key={hour} value={hour} className="text-[10px]">
                            {hour}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={(newEntryForm.time.split(":")[1] || "") || undefined}
                      onValueChange={(value) => setNewEntryForm((current) => ({ ...current, time: `${current.time.split(":")[0] || "00"}:${value}` }))}
                    >
                      <SelectTrigger
                        id="calendarTaskTimeMinute"
                        className={`${calendarFieldSelectTriggerClass} ${calendarDropdownToneClass} !h-8 !border-slate-300 !text-[10px] hover:!border-[#3eca44] focus:!border-[#3eca44] focus-visible:!border-[#3eca44] [&>span]:text-[10px] [&>span]:font-medium data-[placeholder]:[&>span]:font-normal data-[placeholder]:[&>span]:text-slate-400`}
                      >
                        <SelectValue placeholder="Min" />
                      </SelectTrigger>
                      <SelectContent className="text-[10px]">
                        {calendarTaskTimeMinuteOptions.map((minute) => (
                          <SelectItem key={minute} value={minute} className="text-[10px]">
                            {minute}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex h-8 items-center justify-center rounded-sm border border-slate-300 bg-slate-50 text-[10px] font-semibold text-slate-600">
                      {newEntryForm.time ? (Number.parseInt(newEntryForm.time.split(":")[0] || "0", 10) >= 12 ? "PM" : "AM") : "AM/PM"}
                    </div>
                  </div>
                </div>

                <div className="relative space-y-1">
                  <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Duration <span className="text-red-600">*</span></span>
                  <Select
                    value={newEntryForm.duration || undefined}
                    onValueChange={(value) => setNewEntryForm((current) => ({ ...current, duration: value }))}
                  >
                    <SelectTrigger id="calendarTaskDuration" className={`${calendarFieldSelectTriggerClass} ${calendarDropdownToneClass} h-8 text-[11px]`}>
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent className="text-[11px]">
                      {calendarTaskDurationOptions.map((option) => (
                        <SelectItem key={option} value={option} className={calendarSelectItemClass}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="relative space-y-1 md:col-span-2">
                  <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Client <span className="text-red-600">*</span></span>
                  <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="calendarTaskClient"
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={clientSearchOpen}
                        className={cn(
                          calendarFieldSelectTriggerClass,
                          calendarDropdownToneClass,
                          "w-full px-3 text-[11px] font-medium hover:bg-white hover:text-slate-900 data-[state=open]:bg-white data-[state=open]:text-slate-900",
                          !newEntryForm.clientId && "text-[10px] text-slate-400",
                        )}
                      >
                        <span className="truncate">{selectedClientLabel}</span>
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="max-h-[380px] w-[var(--radix-popover-trigger-width)] min-w-[420px] overflow-hidden p-0"
                      onCloseAutoFocus={() => setClientSearchValue("")}
                    >
                      <Command shouldFilter={false}>
                        <CommandInput
                          value={clientSearchValue}
                          onValueChange={setClientSearchValue}
                          placeholder="Search registered or trading name..."
                          className="h-8 text-[11px] placeholder:text-[10px]"
                        />
                        <CommandList className="max-h-[320px] overscroll-contain">
                          {filteredClientRows.length === 0 ? (
                            <CommandEmpty className="px-3 py-4 text-sm text-slate-500">{clientLoadMessage}</CommandEmpty>
                          ) : null}
                          <CommandGroup>
                            {filteredClientRows.map((client) => {
                              const label = formatCalendarClientDisplayName(client);
                              return (
                                <CommandItem
                                  key={client.id}
                                  value={`${normalizeText(client.registered_name)} ${normalizeText(client.trading_as || client.trading_name)}`.trim()}
                                  onSelect={() => {
                                    setNewEntryForm((current) => ({ ...current, clientId: client.id, client: label, relatedMatter: "__none__" }));
                                    setClientSearchValue("");
                                    setClientSearchOpen(false);
                                  }}
                                  className="flex items-center justify-between gap-3 px-3 py-2 text-[10px]"
                                >
                                  <span className="min-w-0 truncate font-medium text-slate-900">{label}</span>
                                  {newEntryForm.clientId === client.id ? <Check className="h-3.5 w-3.5 text-[#2f9f35]" /> : null}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="relative space-y-1">
                  <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Type <span className="text-red-600">*</span></span>
                  <Select
                    value={newEntryForm.type || undefined}
                    onValueChange={(value) => setNewEntryForm((current) => ({ ...current, type: value }))}
                  >
                    <SelectTrigger id="calendarTaskType" className={`${calendarFieldSelectTriggerClass} ${calendarDropdownToneClass} h-8 text-[11px]`}>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="text-[11px]">
                      {calendarTaskTypeOptions.map((option) => (
                        <SelectItem key={option} value={option} className={calendarSelectItemClass}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="relative space-y-1">
                  <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Related Matter</span>
                  <Select
                    value={newEntryForm.relatedMatter}
                    onValueChange={(value) => setNewEntryForm((current) => ({ ...current, relatedMatter: value }))}
                  >
                    <SelectTrigger
                      id="calendarTaskRelatedMatter"
                      className={cn(
                        calendarFieldSelectTriggerClass,
                        calendarDropdownToneClass,
                        "h-8 text-[11px]",
                        newEntryForm.relatedMatter === "__none__" && "[&>span]:text-[10px] [&>span]:text-slate-400",
                      )}
                    >
                      <SelectValue placeholder="Select related matter (optional)" />
                    </SelectTrigger>
                    <SelectContent className="text-[11px]">
                      <SelectItem value="__none__" className={calendarSelectItemClass}>No related matter</SelectItem>
                      {selectedClientMatterRows.length === 0 ? (
                        <div className="px-3 py-2 text-[10px] text-slate-500">{selectedClientMatterLoadMessage}</div>
                      ) : null}
                      {selectedClientMatterRows.map((matter) => {
                        const parties = normalizeText(matter.parties) || "No parties captured";
                        return (
                          <Tooltip key={matter.id}>
                            <TooltipTrigger asChild>
                              <SelectItem value={matter.id} className={calendarSelectItemClass}>
                                {buildCalendarTaskRelatedMatterLabel(matter)}
                              </SelectItem>
                            </TooltipTrigger>
                            <TooltipContent side="right" align="start" className="max-w-[320px] rounded border border-[#3eca44]/35 bg-white text-[10px] font-medium leading-snug text-slate-700 shadow-none">
                              {parties}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="relative space-y-1 md:col-span-2">
                  <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Description <span className="text-red-600">*</span></span>
                  <Textarea
                    id="calendarTaskDescription"
                    value={newEntryForm.description}
                    onChange={(event) => setNewEntryForm((current) => ({ ...current, description: event.target.value }))}
                    className={calendarFieldTextareaClass}
                    placeholder="Enter the task description"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white px-4 pb-4">
              <div className="flex justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 w-[92px] rounded text-[11px] border-slate-300 bg-white text-slate-700 hover:bg-white hover:border-slate-400 hover:text-slate-800"
                  onClick={() => setIsNewEntryOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingNewEntry || !isNewEntryFormComplete}
                  className="h-8 w-[92px] rounded bg-[#3eca44] text-[11px] text-white hover:bg-[#34b73b] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white"
                >
                  {isSavingNewEntry ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarPage;

