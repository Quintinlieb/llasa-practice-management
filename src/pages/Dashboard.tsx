import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  Bell,
  BriefcaseBusiness,
  Calendar,
  CalendarCheck2,
  ChevronDown,
  CircleAlert,
  FileText,
  FolderOpen,
  Search,
  TriangleAlert,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const currentDateLabel = "Tuesday, 20 May 2026";

type DashboardEventRow = {
  id: string;
  caseId: string;
  dateLabel: string;
  matterEvent: string;
  matterType: string;
  client: string;
  consultant: string;
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

const notificationRows = [
  {
    title: "3 matters are overdue",
    description: "These matters require immediate attention.",
    actionLabel: "View matters",
    age: "2h ago",
    icon: CircleAlert,
    iconShellClassName: "bg-[#fff0f0] text-[#ff6b6b]",
  },
  {
    title: "5 documents awaiting review",
    description: "Documents need your review or approval.",
    actionLabel: "View documents",
    age: "4h ago",
    icon: TriangleAlert,
    iconShellClassName: "bg-[#fff7eb] text-[#f59e0b]",
  },
  {
    title: "2 events tomorrow",
    description: "You have 2 scheduled events tomorrow.",
    actionLabel: "View calendar",
    age: "5h ago",
    icon: Calendar,
    iconShellClassName: "bg-[#eef5ff] text-[#3b82f6]",
  },
  {
    title: "Client renewal due soon",
    description: "3 client memberships expire in the next 30 days.",
    actionLabel: "View clients",
    age: "1d ago",
    icon: Users,
    iconShellClassName: "bg-[#f5edff] text-[#8b5cf6]",
  },
] as const;

const statCards = [
  {
    title: "TOTAL CLIENTS",
    value: "86",
    subtitle: "Active clients",
    delta: "+ 4 this month",
    icon: Users,
    iconShellClassName: "bg-[#eaf9ee] text-[#3eca44]",
  },
  {
    title: "DOCUMENTS THIS MONTH",
    value: "142",
    subtitle: "Documents generated",
    delta: "+ 18% vs last month",
    icon: FolderOpen,
    iconShellClassName: "bg-[#edf5ff] text-[#3b82f6]",
  },
  {
    title: "MATTERS THIS MONTH",
    value: "34",
    subtitle: "New matters opened",
    delta: "+ 21% vs last month",
    icon: BriefcaseBusiness,
    iconShellClassName: "bg-[#f3ebff] text-[#8b5cf6]",
  },
  {
    title: "EVENTS THIS MONTH",
    value: "48",
    subtitle: "Scheduled events",
    delta: "+ 16% vs last month",
    icon: CalendarCheck2,
    iconShellClassName: "bg-[#fff4e8] text-[#f59e0b]",
  },
] as const;

const matterCategories = [
  { label: "Disciplinary Hearings", value: 28, color: "#4f7cff" },
  { label: "CCMA / Bargaining Council", value: 22, color: "#ff9b52" },
  { label: "Incapacity / Performance", value: 16, color: "#ff6b57" },
  { label: "Retrenchments", value: 14, color: "#ffc44f" },
  { label: "Employment Equity", value: 8, color: "#51b4c9" },
  { label: "OHS", value: 6, color: "#7c8bd8" },
  { label: "Payroll Support", value: 4, color: "#8f5be8" },
] as const;

const recentActivity = [
  {
    title: "New matter opened: MAT000037 - Retail Group (Pty) Ltd",
    meta: "Quintin Liebenberg - 2h ago",
  },
  {
    title: "Document generated: Warning Letter - MAT000001",
    meta: "Mildrid Ellis - 3h ago",
  },
  {
    title: "Attendance note added: MAT000015 - CCMA Arbitration",
    meta: "Mildrid Ellis - 5h ago",
  },
  {
    title: "Matter status updated: MAT000022 - Consultation",
    meta: "Quintin Liebenberg - 1d ago",
  },
  {
    title: "Document uploaded: Bundle of Documents - MAT000031",
    meta: "Quintin Liebenberg - 1d ago",
  },
] as const;

const clientRenewals = [
  { label: "Renewals due in next 30 days", value: 3, colorClassName: "bg-[#ff5e5e]" },
  { label: "Renewals due in next 60 days", value: 5, colorClassName: "bg-[#ffb938]" },
  { label: "Expired memberships", value: 1, colorClassName: "bg-[#8f5be8]" },
  { label: "Clients with no recent activity (90+ days)", value: 7, colorClassName: "bg-[#94a3b8]" },
] as const;

const donutGradient = (() => {
  const total = matterCategories.reduce((sum, item) => sum + item.value, 0);
  let start = 0;
  return matterCategories
    .map((item) => {
      const sweep = (item.value / total) * 360;
      const segment = `${item.color} ${start}deg ${start + sweep}deg`;
      start += sweep;
      return segment;
    })
    .join(", ");
})();

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

export default function Dashboard() {
  const navigate = useNavigate();
  const [eventRows, setEventRows] = useState<DashboardEventRow[]>([]);

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
    };

    void loadUpcomingEvents();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-0 -m-6">
        <div className="h-[calc(100dvh-var(--app-header-height,5rem))] overflow-hidden rounded-tl-sm border border-slate-300 border-l-0 border-r-0 bg-white shadow-sm">
          <div className="flex h-full flex-col">
            <div className="pl-4 pr-4 pt-1">
              <div className="flex flex-col gap-4 pt-5 pb-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h1 className="-ml-1 text-4xl font-normal text-[#3eca44]">Dashboard</h1>
                  <p className="mt-2 text-xs text-slate-600">
                    Welcome back, Quintin. Here&apos;s what&apos;s happening with your practice today.
                  </p>
                </div>

                <div className="inline-flex items-center gap-3 self-start rounded-[10px] bg-white px-4 py-2 text-[11px] font-semibold text-slate-600">
                  <span>{currentDateLabel}</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-slate-200 bg-slate-50 text-slate-500">
                    <Calendar className="h-4 w-4" />
                  </div>
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

                    <Card className="min-w-0 overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-none">
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
                              <Bell size={16} strokeWidth={2.1} />
                            </div>
                            <CardTitle className="text-[14px] font-semibold leading-none text-slate-900">
                              Notifications
                            </CardTitle>
                          </div>
                          <CardLink label="View all" onClick={() => navigate("/documents")} />
                        </div>
                      </CardHeader>

                      <CardContent className="p-0">
                        {notificationRows.map((row, index) => {
                          const Icon = row.icon;
                          const target =
                            row.actionLabel === "View matters"
                              ? "/matters"
                              : row.actionLabel === "View documents"
                                ? "/documents"
                                : "/employees";

                          return (
                            <div
                              key={row.title}
                              className={cn(
                                "flex gap-4 px-5 py-3.5",
                                index !== notificationRows.length - 1 && "border-b border-slate-200",
                              )}
                            >
                              <div
                                className={cn(
                                  "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]",
                                  row.iconShellClassName,
                                )}
                              >
                                <Icon className="h-4 w-4" />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <p className="text-[12px] font-semibold text-slate-900">{row.title}</p>
                                  <span className="shrink-0 text-[10px] text-slate-400">{row.age}</span>
                                </div>
                                <p className="mt-1 text-[11px] text-slate-500">{row.description}</p>
                                <button
                                  type="button"
                                  onClick={() => navigate(target)}
                                  className="mt-2 text-[11px] font-semibold text-[#3267e3] transition-colors hover:text-[#234fb7]"
                                >
                                  {row.actionLabel}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
                    {statCards.map((card) => {
                      const Icon = card.icon;

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
                                <p className="text-[11px] font-semibold uppercase tracking-[0.02em] text-slate-500">
                                  {card.title}
                                </p>
                                <p className="mt-2 text-[44px] font-semibold leading-none text-slate-900">{card.value}</p>
                                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                                  <span className="text-[12px] text-slate-500">{card.subtitle}</span>
                                  <span className="text-[12px] font-semibold text-[#3eca44]">{card.delta}</span>
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
                          Matters by Category <span className="text-[13px] font-medium text-slate-500">(Active Matters)</span>
                        </CardTitle>
                      </CardHeader>

                      <CardContent className="px-5 pb-0">
                        <div className="flex flex-col gap-6 pb-5 sm:flex-row sm:items-center">
                          <div className="flex justify-center sm:w-[170px]">
                            <div
                              className="relative h-[136px] w-[136px] rounded-full"
                              style={{ background: `conic-gradient(${donutGradient})` }}
                            >
                              <div className="absolute inset-[32px] rounded-full bg-white" />
                            </div>
                          </div>

                          <div className="min-w-0 flex-1 space-y-2">
                            {matterCategories.map((item) => (
                              <div key={item.label} className="flex items-center justify-between gap-3 text-[12px]">
                                <div className="flex min-w-0 items-center gap-3">
                                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                  <span className="truncate text-slate-700">{item.label}</span>
                                </div>
                                <span className="font-semibold text-slate-700">{item.value}</span>
                              </div>
                            ))}
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
                          Recent Activity
                        </CardTitle>
                      </CardHeader>

                      <CardContent className="px-5 pb-0">
                        <div className="space-y-4 pb-5">
                          {recentActivity.map((item) => (
                            <div key={item.title} className="flex gap-3">
                              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-slate-100 text-slate-500">
                                <FileText className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-slate-900">{item.title}</p>
                                <p className="mt-1 text-[12px] text-slate-500">{item.meta}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>

                      <div className="border-t border-slate-200 px-5 py-4 text-center">
                        <CardLink label="View all activity" onClick={() => navigate("/documents")} />
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
    </DashboardLayout>
  );
}
