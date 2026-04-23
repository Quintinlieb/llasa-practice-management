import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts";
import { CircleAlert, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { contractTypes } from "@/lib/validation";

type Employee = Tables<"employees"> & {
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  contract_type?: string | null;
  probation_period?: string | null;
  termination_reason?: string | null;
  terminated_at?: string | null;
  nationality?: string | null;
};

type WarningRow = {
  id: string;
  employee_id?: string;
  warning_type?: string | null;
  misconduct_type?: string | null;
  issue_date?: string | null;
  date_issued?: string | null;
  issued_date?: string | null;
  expiry_date?: string | null;
  expiry?: string | null;
  created_at?: string | null;
};

type RangeKey = "7d" | "30d" | "3m" | "6m";
type ProbationItem = { id: string; name: string; label: string; start: string; end: string; progress: number };
type UpcomingEvent = { id: string; employeeId: string | null; name: string; type: string; date: Date; dateLabel: string };

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const terminationReasonOptions = [
  "Dismissed",
  "Resigned",
  "Retrenched",
  "Retired",
  "Contract expired",
  "Illness",
  "Performance",
  "Absconded",
] as const;
const rangeOptions: Array<{ value: RangeKey; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "3m", label: "3 months" },
  { value: "6m", label: "6 months" },
];
const warningMonths: Record<string, number> = { first: 3, second: 6, serious: 12, final: 12 };
const trigCls =
  "h-8 rounded border border-slate-200 bg-white px-2 text-[11px] hover:border-blue-400 data-[state=open]:border-blue-400 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0";
const itemCls = "text-[11px] text-slate-700 focus:bg-blue-50/70 focus:text-blue-600";
const warningTable = () => (supabase as any).from("employee_warnings");
const pieColors = ["#2563eb", "#16a34a", "#ea580c", "#7c3aed", "#0891b2", "#dc2626", "#0f766e"];
const genderColor = (label: string) => {
  const key = label.trim().toLowerCase();
  if (key === "male") return "#2563eb";
  if (key === "female") return "#7c3aed";
  if (key === "unspecified") return "#94a3b8";
  return "#64748b";
};
const raceColor = (label: string, idx: number) => {
  const key = label.trim().toLowerCase();
  if (key === "unspecified") return "#94a3b8";
  if (key === "white") return "#2563eb";
  if (key === "indian") return "#eab308";
  return pieColors[idx % pieColors.length];
};
const nationalityColor = (label: string) => {
  const key = label.trim().toLowerCase();
  if (key === "unspecified") return "#94a3b8";
  if (key === "south african") return "#16a34a";
  return "#ea580c";
};

const parseDate = (v?: string | null) => {
  if (!v) return null;
  const raw = String(v).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const slash = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slash) {
    const [, dd, mm, yyyy] = slash;
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const dash = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dash) {
    const [, dd, mm, yyyy] = dash;
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const addMonths = (d: Date, n: number) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
};

const rangeEnd = (t: Date, r: RangeKey) =>
  r === "30d" ? addDays(t, 30) : r === "3m" ? addMonths(t, 3) : r === "6m" ? addMonths(t, 6) : addDays(t, 7);

const normType = (v?: string | null) => {
  const k = (v ?? "").toLowerCase().trim();
  if (k === "first") return "First Written Warning";
  if (k === "second") return "Second Written Warning";
  if (k === "serious") return "Serious Written Warning";
  if (k === "final") return "Final Written Warning";
  return v?.trim() || "Warning";
};

const getWarningExpiry = (w: WarningRow) => {
  const ex = parseDate(w.expiry_date);
  if (ex) return ex;
  const issue = parseDate(w.issue_date) ?? parseDate(w.created_at);
  if (!issue) return null;
  return addMonths(issue, warningMonths[(w.warning_type ?? "").toLowerCase().trim()] ?? 6);
};

const getWarningIssueDate = (w: WarningRow) =>
  parseDate(w.issue_date) ?? parseDate(w.created_at);

const cType = (v?: string | null) => (v?.trim() ? v.trim() : "Unspecified");

const isInactiveStatus = (v?: string | null) => (v ?? "").trim().toLowerCase() === "inactive";

const Dashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [warnings, setWarnings] = useState<WarningRow[]>([]);
  const [busy, setBusy] = useState(false);

  const [upcomingRange, setUpcomingRange] = useState<RangeKey>("30d");

  const [issuedYear, setIssuedYear] = useState(new Date().getFullYear());
  const [terminationYear, setTerminationYear] = useState(new Date().getFullYear());

  const [workforceYearFilter, setWorkforceYearFilter] = useState<string>(String(new Date().getFullYear()));
  const [contractFilter, setContractFilter] = useState<string>("all");
  const [terminationReason, setTerminationReason] = useState("all");

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, navigate, user]);

  useEffect(() => {
    const run = async () => {
      if (!user) return;
      setBusy(true);
      try {
        const { data: p, error: pe } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
        if (pe) throw pe;
        if (!p) {
          navigate("/account-setup");
          return;
        }
        const [e, w] = await Promise.all([
          (supabase as any)
            .from("employees")
            .select("id,employee_name,employee_surname,status,start_date,end_date,contract_type,probation_period,termination_reason,terminated_at,gender,race,nationality")
            .eq("company_id", user.id),
          warningTable()
            .select("id,employee_id,warning_type,misconduct_type,issue_date,expiry_date,created_at")
            .eq("company_id", user.id),
        ]);
        if (e.error) throw e.error;
        if (w.error) throw w.error;
        setEmployees((e.data ?? []) as Employee[]);
        setWarnings((w.data ?? []) as WarningRow[]);
      } catch (err: unknown) {
        toast({
          title: "Unable to load dashboard",
          description: err instanceof Error ? err.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setBusy(false);
      }
    };
    void run();
  }, [navigate, toast, user]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const names = useMemo(
    () => new Map(employees.map((e) => [e.id, `${e.employee_name ?? "Employee"} ${e.employee_surname ?? ""}`.trim()])),
    [employees],
  );

  const activeEmployees = useMemo(
    () => employees.filter((e) => !isInactiveStatus(e.status)),
    [employees],
  );

  const genderData = useMemo(() => {
    const counts = new Map<string, number>();
    activeEmployees.forEach((e) => {
      const value = ((e as any).gender ?? "").toString().trim() || "Unspecified";
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total);
  }, [activeEmployees]);

  const raceData = useMemo(() => {
    const counts = new Map<string, number>();
    activeEmployees.forEach((e) => {
      const value = ((e as any).race ?? "").toString().trim() || "Unspecified";
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total);
  }, [activeEmployees]);

  const nationalityData = useMemo(() => {
    const counts = new Map<string, number>([
      ["Unspecified", 0],
      ["South African", 0],
      ["Foreigners", 0],
    ]);
    activeEmployees.forEach((e) => {
      const value = ((e as any).nationality ?? "").toString().trim().toLowerCase();
      const key = !value ? "Unspecified" : value === "south african" ? "South African" : "Foreigners";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, total]) => ({ label, total }))
      .filter((item) => item.total > 0);
  }, [activeEmployees]);

  const warningYears = useMemo(() => {
    const years = warnings
      .map((w) => getWarningIssueDate(w)?.getFullYear())
      .filter((y): y is number => typeof y === "number");
    if (!years.length) return [new Date().getFullYear()];
    return Array.from(new Set(years)).sort((a, b) => b - a);
  }, [warnings]);

  useEffect(() => {
    if (!warningYears.includes(issuedYear)) setIssuedYear(warningYears[0]);
  }, [issuedYear, warningYears]);

  const workforceYears = useMemo(() => {
    const years = employees
      .flatMap((e) => [parseDate(e.start_date)?.getFullYear(), parseDate(e.end_date)?.getFullYear()])
      .filter((y): y is number => typeof y === "number");
    if (!years.length) return [new Date().getFullYear()];
    const min = Math.min(...years);
    const max = new Date().getFullYear();
    const out: number[] = [];
    for (let y = max; y >= min; y -= 1) out.push(y);
    return out;
  }, [employees]);

  const terminationYears = useMemo(() => {
    const max = new Date().getFullYear();
    const min = max - 5;
    const out: number[] = [];
    for (let y = max; y >= min; y -= 1) out.push(y);
    return out;
  }, []);

  useEffect(() => {
    if (workforceYears.includes(Number(workforceYearFilter))) return;
    const currentYear = new Date().getFullYear();
    if (workforceYears.includes(currentYear)) {
      setWorkforceYearFilter(String(currentYear));
      return;
    }
    setWorkforceYearFilter(workforceYears.length > 0 ? String(workforceYears[0]) : "all");
  }, [workforceYearFilter, workforceYears]);

  useEffect(() => {
    if (!terminationYears.includes(terminationYear)) setTerminationYear(terminationYears[0]);
  }, [terminationYear, terminationYears]);

  const allContractOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...contractTypes,
          ...employees.map((e) => cType(e.contract_type)),
        ]),
      ).sort(),
    [employees],
  );

  const workforceChartData = useMemo(() => {
    const years = workforceYearFilter === "all" ? workforceYears : [Number(workforceYearFilter)];
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const onlyCurrentYear = years.length === 1 && years[0] === currentYear;
    return monthLabels.map((label, monthIdx) => {
      if (onlyCurrentYear && monthIdx > currentMonth) {
        return { label, total: null };
      }
      let total = 0;
      years.forEach((year) => {
        const monthStart = new Date(year, monthIdx, 1);
        const monthEnd = new Date(year, monthIdx + 1, 0, 23, 59, 59, 999);
        const isCurrentMonthCell = year === currentYear && monthIdx === currentMonth;
        total += employees.filter((e) => {
          if (contractFilter !== "all" && cType(e.contract_type) !== contractFilter) return false;
          const start = parseDate(e.start_date);
          if (!start) return isCurrentMonthCell && !isInactiveStatus(e.status);
          if (start > monthEnd) return false;
          const end = parseDate(e.end_date);
          if (end && end < monthStart) return false;
          return true;
        }).length;
      });
      return { label, total };
    });
  }, [contractFilter, employees, today, workforceYearFilter, workforceYears]);
  const terminationOptions = useMemo(() => [...terminationReasonOptions], []);

  const issuedByMonth = useMemo(() => {
    const data = monthLabels.map((label) => ({ label, total: 0 }));
    warnings.forEach((w) => {
      const d = getWarningIssueDate(w);
      if (d && d.getFullYear() === issuedYear) data[d.getMonth()].total += 1;
    });
    return data;
  }, [issuedYear, warnings]);


  const probationActive = useMemo(
    () =>
      activeEmployees
        .map((e) => {
          const start = parseDate(e.start_date);
          const months = Number.parseInt((e.probation_period ?? "").trim(), 10);
          if (!start || !Number.isFinite(months) || months <= 0) return null;
          const end = addMonths(start, months);
          if (today < start || today > end) return null;
          const total = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
          const done = Math.max(0, Math.ceil((today.getTime() - start.getTime()) / 86400000));
          return {
            id: e.id,
            name: `${e.employee_name ?? "Employee"} ${e.employee_surname ?? ""}`.trim(),
            label: months === 1 ? "1 month" : `${months} months`,
            start: fmtDate(start),
            end: fmtDate(end),
            progress: Math.max(0, Math.min(100, Math.round((done / total) * 100))),
          };
        })
        .filter((x): x is ProbationItem => Boolean(x))
        .sort((a, b) => b.progress - a.progress),
    [activeEmployees, today],
  );


  const upcomingEvents = useMemo(() => {
    const endWindow = rangeEnd(today, upcomingRange);
    const warningEvents = warnings
      .map((w) => {
        const due = getWarningExpiry(w);
        if (!due || due < today || due > endWindow) return null;
        return {
          id: `warning-${w.id}`,
          employeeId: w.employee_id ?? null,
          name: names.get(w.employee_id ?? "") ?? "Employee",
          type: "Warning expires",
          date: due,
          dateLabel: fmtDate(due),
        };
      })
      .filter((item): item is UpcomingEvent => Boolean(item));

    const contractEvents = activeEmployees
      .map((e) => {
        const contractType = (e.contract_type ?? "").toLowerCase().trim();
        const isTemporary = contractType === "temporary" || contractType === "fixed-term" || contractType === "fixed term";
        if (!isTemporary) return null;
        const due = parseDate(e.end_date);
        if (!due || due < today || due > endWindow) return null;
        return {
          id: `contract-${e.id}`,
          employeeId: e.id,
          name: `${e.employee_name ?? "Employee"} ${e.employee_surname ?? ""}`.trim(),
          type: "Temporary contract ends",
          date: due,
          dateLabel: fmtDate(due),
        };
      })
      .filter((item): item is UpcomingEvent => Boolean(item));

    const probationEvents = activeEmployees
      .map((e) => {
        const start = parseDate(e.start_date);
        const months = Number.parseInt((e.probation_period ?? "").trim(), 10);
        if (!start || !Number.isFinite(months) || months <= 0) return null;
        const due = addMonths(start, months);
        if (due < today || due > endWindow) return null;
        return {
          id: `probation-${e.id}`,
          employeeId: e.id,
          name: `${e.employee_name ?? "Employee"} ${e.employee_surname ?? ""}`.trim(),
          type: "Probation ends",
          date: due,
          dateLabel: fmtDate(due),
        };
      })
      .filter((item): item is UpcomingEvent => Boolean(item));

    return [...warningEvents, ...contractEvents, ...probationEvents]
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 20);
  }, [activeEmployees, names, today, upcomingRange, warnings]);

  const terminationsByMonth = useMemo(() => {
    const data = monthLabels.map((label) => ({ label, total: 0 }));
    employees.forEach((e) => {
      const d = parseDate(e.terminated_at);
      const r = (e.termination_reason ?? "").trim();
      if (!d || d.getFullYear() !== terminationYear) return;
      const normalized = r.toLowerCase();
      const matchesReason =
        terminationReason === "all" ||
        r === terminationReason ||
        (terminationReason === "Illness" &&
          (r === "Illness" || r === "Illness/Medically boarded" || normalized.includes("illness"))) ||
        (terminationReason === "Performance" && normalized.includes("performance"));
      if (matchesReason) data[d.getMonth()].total += 1;
    });
    return data;
  }, [employees, terminationReason, terminationYear]);

  const handleUpcomingEventClick = (event: UpcomingEvent) => {
    if (!event.employeeId) return;
    navigate("/employees", { state: { openEmployeeId: event.employeeId, openEmployeeTab: "employment" } });
  };

  const rangeSelect = (value: RangeKey, onChange: (v: RangeKey) => void) => (
    <Select value={value} onValueChange={(v) => onChange(v as RangeKey)}>
      <SelectTrigger className={`${trigCls} w-[92px]`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {rangeOptions.map((r) => (
          <SelectItem key={r.value} value={r.value} className={itemCls}>
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const hintIcon = (message: string) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-500 hover:text-blue-600"
          aria-label="More information"
        >
          <CircleAlert className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px] text-[11px] leading-snug">
        <p>{message}</p>
      </TooltipContent>
    </Tooltip>
  );

  const chartCard = (
    title: string,
    desc: string,
    controls: ReactNode,
    chart: ReactNode,
    hint?: string,
    cardClassName?: string,
  ) => (
    <Card className={`rounded-sm border border-slate-300 shadow-none flex min-h-[270px] flex-col overflow-hidden ${cardClassName ?? ""}`}>
      <CardHeader className="border-b border-slate-200 bg-slate-50/70 py-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
              {hint ? hintIcon(hint) : null}
            </div>
            <CardDescription className="mt-1 text-[11px]">{desc}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">{controls}</div>
        </div>
      </CardHeader>
      <CardContent className="pt-3">{chart}</CardContent>
    </Card>
  );

  if (loading || busy) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <img src="/llasa_thumbnail.png" alt="Loading" className="h-12 w-12 animate-spin" style={{ animationDuration: "2s" }} />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <TooltipProvider>
      <div className="space-y-0 -m-6">
        <div className="border border-slate-300 border-r-0 bg-white shadow-sm h-[calc(100dvh-var(--app-header-height,5rem))]">
          <div className="flex h-full flex-col">
            <div className="pl-4 pr-4 pt-1">
              <div className="flex items-end justify-between gap-3 pt-5 pb-8">
                <div>
                  <h1 className="text-4xl font-normal text-blue-600 -ml-1">Dashboard</h1>
                  <p className="text-xs text-slate-600 mt-2">Operational events and workforce trends.</p>
                </div>
                <Button type="button" className="mr-6 h-8 w-auto translate-y-3 whitespace-nowrap rounded border border-blue-600 bg-white px-4 text-[11px] font-medium text-blue-600 hover:bg-blue-600 hover:text-white">
                  <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Generate Report
                </Button>
              </div>
            </div>
            <section className="relative flex-1 min-h-0 overflow-auto overflow-x-hidden pr-2 pb-4">
              <div className="grid items-stretch gap-3 px-4 pb-2 md:grid-cols-2">
                <Card className="rounded-sm border border-slate-300 shadow-none flex h-[230px] flex-col overflow-hidden" style={{ height: 230, minHeight: 230 }}>
                  <CardHeader className="border-b border-slate-200 bg-slate-50/70 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-sm font-semibold">Upcoming Events</CardTitle>
                        <CardDescription className="mt-1 text-[11px]">
                          Plan ahead with full insight into upcoming workforce events.
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">{rangeSelect(upcomingRange, setUpcomingRange)}</div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 min-h-0 pt-3">
                    {upcomingEvents.length === 0 ? (
                      <div className="rounded-sm border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-[11px] text-slate-500">
                        No upcoming events in the selected range.
                      </div>
                    ) : (
                      <div className="h-full min-h-0 overflow-y-auto pr-1">
                        <ul className="list-disc list-outside space-y-2 pl-5 text-[11px] text-slate-700">
                          {upcomingEvents.map((event) => (
                            <li key={event.id} className="cursor-default select-none leading-4 transition-colors marker:text-slate-500 hover:text-blue-600 hover:underline hover:decoration-blue-600 hover:underline-offset-2 hover:marker:text-blue-600">
                              {event.employeeId ? (
                                <button
                                  type="button"
                                  className="cursor-pointer text-left"
                                  onClick={() => handleUpcomingEventClick(event)}
                                >
                                  {event.type === "Temporary contract ends"
                                    ? `Temporary contract for ${event.name} expiring on ${event.dateLabel}.`
                                    : event.type === "Probation ends"
                                      ? `Probation period for ${event.name} ending on ${event.dateLabel}.`
                                      : `Warning for ${event.name} expiring on ${event.dateLabel}.`}
                                </button>
                              ) : (
                                <span>
                                  {event.type === "Temporary contract ends"
                                    ? `Temporary contract for ${event.name} expiring on ${event.dateLabel}.`
                                    : event.type === "Probation ends"
                                      ? `Probation period for ${event.name} ending on ${event.dateLabel}.`
                                      : `Warning for ${event.name} expiring on ${event.dateLabel}.`}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-sm border border-slate-300 shadow-none flex h-[230px] flex-col overflow-hidden" style={{ height: 230, minHeight: 230 }}>
                  <CardHeader className="border-b border-slate-200 bg-slate-50/70 py-3">
                    <div className="flex items-center gap-1.5">
                      <CardTitle className="text-sm font-semibold">Employee Demographics</CardTitle>
                      {hintIcon("Complete employee profiles on the Employees page and capture gender, race, and nationality to populate these demographics accurately.")}
                    </div>
                    <CardDescription className="mt-1 text-[11px]">
                      Clear breakdown of your workforce composition at a glance.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-1 items-center justify-center pt-2 pb-1">
                    <div className="grid w-fit gap-1 sm:grid-cols-3">
                      <div className="rounded-sm px-0 pt-1 pb-0">
                        <div className="flex items-start gap-1">
                          <div className="shrink-0">
                            <p className="mb-1 text-center text-[11px] font-semibold text-slate-700 underline decoration-slate-500 underline-offset-2">Gender</p>
                            <ChartContainer config={{ total: { label: "Employees", color: "#2563eb" } }} className="h-[88px] w-[88px] shrink-0">
                              <PieChart>
                                <Pie data={genderData} dataKey="total" nameKey="label" innerRadius={15} outerRadius={30} paddingAngle={3}>
                                  {genderData.map((_, idx) => (
                                    <Cell key={`gender-${idx}`} fill={genderColor(genderData[idx]?.label ?? "")} />
                                  ))}
                                </Pie>
                              </PieChart>
                            </ChartContainer>
                          </div>
                          <div className="mt-2 ml-2 self-center space-y-0 text-[10px] text-slate-700">
                            {genderData.map((item) => (
                              <p key={item.label} className="flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: genderColor(item.label) }} />
                                <span>{item.label} ({item.total})</span>
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="rounded-sm px-0 pt-1 pb-0">
                        <div className="flex items-start gap-1">
                          <div className="shrink-0">
                            <p className="mb-1 text-center text-[11px] font-semibold text-slate-700 underline decoration-slate-500 underline-offset-2">Race</p>
                            <ChartContainer config={{ total: { label: "Employees", color: "#2563eb" } }} className="h-[88px] w-[88px] shrink-0">
                              <PieChart>
                                <Pie data={raceData} dataKey="total" nameKey="label" innerRadius={15} outerRadius={30} paddingAngle={3}>
                                  {raceData.map((_, idx) => (
                                    <Cell key={`race-${idx}`} fill={raceColor(raceData[idx]?.label ?? "", idx)} />
                                  ))}
                                </Pie>
                              </PieChart>
                            </ChartContainer>
                          </div>
                          <div className="mt-2 ml-2 self-center space-y-0 text-[10px] text-slate-700">
                            {raceData.map((item, idx) => (
                              <p key={item.label} className="flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: raceColor(item.label, idx) }} />
                                <span>{item.label} ({item.total})</span>
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="rounded-sm px-0 pt-1 pb-0">
                        <div className="flex items-start gap-1">
                          <div className="shrink-0">
                            <p className="mb-1 text-center text-[11px] font-semibold text-slate-700 underline decoration-slate-500 underline-offset-2">Nationality</p>
                            <ChartContainer config={{ total: { label: "Employees", color: "#2563eb" } }} className="h-[88px] w-[88px] shrink-0">
                              <PieChart>
                                <Pie data={nationalityData} dataKey="total" nameKey="label" innerRadius={15} outerRadius={30} paddingAngle={3}>
                                  {nationalityData.map((item) => (
                                    <Cell key={`nationality-${item.label}`} fill={nationalityColor(item.label)} />
                                  ))}
                                </Pie>
                              </PieChart>
                            </ChartContainer>
                          </div>
                          <div className="mt-2 ml-2 self-center space-y-0 text-[10px] text-slate-700">
                            {nationalityData.map((item) => (
                              <p key={item.label} className="flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: nationalityColor(item.label) }} />
                                <span>{item.label} ({item.total})</span>
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {chartCard(
                  "Current Workforce",
                  "Track employee growth across contracts and year.",
                  <div className="flex flex-nowrap gap-2">
                    <Select value={workforceYearFilter} onValueChange={setWorkforceYearFilter}>
                      <SelectTrigger className={`${trigCls} w-[92px]`}>
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className={itemCls}>All years</SelectItem>
                        {workforceYears.map((y) => (
                          <SelectItem key={y} value={String(y)} className={itemCls}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={contractFilter} onValueChange={setContractFilter}>
                      <SelectTrigger className={`${trigCls} w-[114px]`}>
                        <SelectValue placeholder="Contract type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className={itemCls}>All contracts</SelectItem>
                        {allContractOptions.map((c) => (
                          <SelectItem key={c} value={c} className={itemCls}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>,
                  <ChartContainer config={{ total: { label: "Employees", color: "hsl(217, 91%, 60%)" } }} className="h-52 w-full">
                    <LineChart data={workforceChartData}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} tick={{ fontSize: 9 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="total" stroke="var(--color-total)" strokeWidth={2} dot={{ r: 2.5 }} />
                    </LineChart>
                  </ChartContainer>,
                  "Complete employee profiles on the Employees page and capture contract type, start date, and end date to keep this graph accurate.",
                  "min-h-[290px]",
                )}

                <Card className="rounded-sm border border-slate-300 shadow-none flex min-h-[290px] flex-col overflow-hidden">
                  <CardHeader className="border-b border-slate-200 bg-slate-50/70 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <CardTitle className="text-sm font-semibold">Probation Periods</CardTitle>
                          {hintIcon("Complete employee profiles on the Employees page and capture start date and probation period to keep probation progress up to date.")}
                        </div>
                        <CardDescription className="mt-1 text-[11px]">Monitor employees on probation with real-time progress tracking.</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 min-h-0 pt-3">
                    {probationActive.length === 0 ? (
                      <div className="rounded-sm border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-[11px] text-slate-500">
                        No active probation periods.
                      </div>
                    ) : (
                      <div className="h-full min-h-0 divide-y divide-slate-200 overflow-y-auto pr-1">
                        {probationActive.map((p) => (
                          <div key={p.id} className="bg-white py-2">
                            <div className="flex items-center justify-between gap-3">
                              <p className="min-w-0 text-[11px] text-slate-700">
                                <span className="font-semibold text-slate-900">{p.name}</span>
                                <span> - {p.label} (Start: {p.start} | End: {p.end})</span>
                              </p>
                              <div className="flex w-[170px] shrink-0 items-center gap-2">
                                <div className="h-1.5 w-full rounded-full bg-slate-200">
                                  <div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${p.progress}%` }} />
                                </div>
                                <span className="w-[34px] text-right text-[10px] font-semibold text-blue-700">{p.progress}%</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {chartCard(
                  "Terminations",
                  "Analyse termination patterns by reason and year.",
                  <div className="flex flex-nowrap gap-2">
                    <Select value={String(terminationYear)} onValueChange={(v) => setTerminationYear(Number(v))}>
                      <SelectTrigger className={`${trigCls} w-[92px]`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {terminationYears.map((y) => (
                          <SelectItem key={y} value={String(y)} className={itemCls}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={terminationReason} onValueChange={setTerminationReason}>
                      <SelectTrigger className={`${trigCls} w-[148px]`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className={itemCls}>All reasons</SelectItem>
                        {terminationOptions.map((r) => (
                          <SelectItem key={r} value={r} className={itemCls}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>,
                  <ChartContainer config={{ total: { label: "Terminations", color: "hsl(0, 72%, 51%)" } }} className="h-44 w-full">
                    <LineChart data={terminationsByMonth}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} tick={{ fontSize: 9 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="total" stroke="var(--color-total)" strokeWidth={2} dot={{ r: 2.5 }} />
                    </LineChart>
                  </ChartContainer>,
                )}

                {chartCard(
                  "Warnings Issued",
                  "View current disciplinary warnings at a glance.",
                  <Select value={String(issuedYear)} onValueChange={(v) => setIssuedYear(Number(v))}>
                    <SelectTrigger className={`${trigCls} w-[92px]`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {warningYears.map((y) => (
                        <SelectItem key={y} value={String(y)} className={itemCls}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>,
                  <ChartContainer config={{ total: { label: "Warnings", color: "hsl(221, 83%, 53%)" } }} className="h-44 w-full">
                    <BarChart data={issuedByMonth}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} tick={{ fontSize: 9 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="total" radius={4} fill="var(--color-total)" />
                    </BarChart>
                  </ChartContainer>,
                )}

              </div>
            </section>
          </div>
        </div>
      </div>
      </TooltipProvider>
    </DashboardLayout>
  );
};

export default Dashboard;

