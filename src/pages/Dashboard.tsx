import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { Activity, AlertTriangle, FileText, Sparkles, Users, CalendarDays } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";

type Employee = Tables<"employees"> & {
  start_date?: string | null;
  end_date?: string | null;
  gender?: string | null;
  race?: string | null;
  nationality?: string | null;
  contract_type?: string | null;
  employment_type?: string | null;
};

type WarningRow = {
  id: string;
  company_id?: string;
  employee_id?: string;
  misconduct_type?: string | null;
  warning_type?: string | null;
  issue_date?: string | null;
};

type DocumentRow = Tables<"documents">;

const warningTable = () => (supabase as any).from("employee_warnings");

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const warningValidityMonths: Record<string, number> = {
  first: 3,
  second: 6,
  serious: 12,
  final: 12,
};

const addMonths = (date: Date, months: number) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

const Dashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [stats, setStats] = useState({ employees: 0, documents: 0 });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [warnings, setWarnings] = useState<WarningRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [warningYear, setWarningYear] = useState<number>(new Date().getFullYear());
  const [misconductFilter, setMisconductFilter] = useState<string>("all");
  const [startYear, setStartYear] = useState<number>(new Date().getFullYear());
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState<string>("all");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setIsLoadingData(true);
      try {
        const [{ data: profileData, error: profileError }] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        ]);

        if (profileError) {
          throw profileError;
        }
        if (!profileData) {
          navigate("/account-setup");
          return;
        }

        const [
          { count: employeeCount },
          { count: documentCount },
          employeeResponse,
          warningResponse,
          documentResponse,
        ] = await Promise.all([
          supabase.from("employees").select("*", { count: "exact", head: true }).eq("company_id", user.id),
          supabase.from("documents").select("*", { count: "exact", head: true }).eq("company_id", user.id),
          (supabase as any)
            .from("employees")
            .select("id, contract_type, start_date, gender, race, nationality")
            .eq("company_id", user.id),
          warningTable()
            .select("id, company_id, employee_id, misconduct_type, warning_type, issue_date")
            .eq("company_id", user.id),
          supabase.from("documents").select("id, company_id, created_at, document_type").eq("company_id", user.id),
        ]);

        setStats({
          employees: employeeCount || 0,
          documents: documentCount || 0,
        });

        if (employeeResponse.error) throw employeeResponse.error;
        if (warningResponse.error) throw warningResponse.error;
        if (documentResponse.error) throw documentResponse.error;

        setEmployees(employeeResponse.data ?? []);
        setWarnings((warningResponse.data as WarningRow[]) ?? []);
        setDocuments((documentResponse.data as DocumentRow[]) ?? []);
      } catch (error: any) {
        console.error(error);
        toast({
          title: "Unable to load dashboard",
          description: error.message || "Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, [user, navigate, toast]);

  const parseDate = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const documentsThisMonth = useMemo(() => {
    const now = new Date();
    return documents.filter((doc) => {
      const created = parseDate(doc.created_at);
      return created && created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
    }).length;
  }, [documents]);

  const misconductRisk = useMemo(() => {
    const employeesWithWarnings = new Set(warnings.map((w) => w.employee_id).filter(Boolean)).size;
    const ratio = stats.employees ? employeesWithWarnings / stats.employees : 0;
    if (!stats.employees) return { label: "No data", tone: "text-muted-foreground", helper: "Add employees to see risk." };
    if (ratio >= 0.3) return { label: "High", tone: "text-destructive", helper: "Many employees have recent warnings." };
    if (ratio >= 0.12) return { label: "Medium", tone: "text-amber-600", helper: "Monitor active warnings closely." };
    return { label: "Low", tone: "text-emerald-600", helper: "Healthy - few warning records." };
  }, [warnings, stats.employees]);

  const employmentTypeData = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach((emp) => {
      const type =
        (emp.employment_type || emp.contract_type || "Unspecified").toLowerCase().replace(/_/g, " ").trim();
      const label =
        type === "permanent"
          ? "Permanent"
          : type === "fixed-term" || type === "fixed term"
            ? "Fixed-term"
            : type === "temporary"
              ? "Temporary"
              : type === "casual"
                ? "Casual"
                : type
                  ? type.charAt(0).toUpperCase() + type.slice(1)
                  : "Unspecified";
      counts[label] = (counts[label] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [employees]);

  const demographicBlocks = useMemo(() => {
    const raceCounts: Record<string, number> = {};
    const genderCounts: Record<string, number> = {};
    let saCount = 0;
    let foreignCount = 0;

    employees.forEach((emp) => {
      const race = emp.race || "Unspecified";
      raceCounts[race] = (raceCounts[race] || 0) + 1;

      const gender = emp.gender || "Unspecified";
      genderCounts[gender] = (genderCounts[gender] || 0) + 1;

      const nationality = (emp.nationality || "").toLowerCase();
      if (!nationality || nationality.includes("south") || nationality === "rsa" || nationality === "sa") {
        saCount += 1;
      } else {
        foreignCount += 1;
      }
    });

    const toArray = (source: Record<string, number>) =>
      Object.entries(source)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);

    return {
      race: toArray(raceCounts),
      gender: toArray(genderCounts),
      citizenship: [
        { label: "RSA", value: saCount },
        { label: "Foreigners", value: foreignCount },
      ],
    };
  }, [employees]);

  const warningsByType = useMemo(() => {
    const misconductCounts: Record<string, number> = {};
    warnings.forEach((row) => {
      const misconduct = row.misconduct_type || "Unspecified";
      misconductCounts[misconduct] = (misconductCounts[misconduct] || 0) + 1;
    });

    return Object.entries(misconductCounts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [warnings]);

  const warningStatusTimeline = useMemo(() => {
    const now = new Date();
    const monthly = monthLabels.map((label, idx) => ({ label, active: 0 }));
    warnings.forEach((row) => {
      const issued = parseDate(row.issue_date);
      if (!issued) return;
      if (issued.getFullYear() !== warningYear) return;
      if (misconductFilter !== "all" && (row.misconduct_type || "Unspecified") !== misconductFilter) return;
      const months = warningValidityMonths[(row.warning_type || "").toLowerCase()] ?? 6;
      const expiry = addMonths(issued, months);
      if (expiry < now) return;
      monthly[issued.getMonth()].active += 1;
    });
    return monthly;
  }, [warnings, warningYear, misconductFilter]);

  const warningYearOptions = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    warnings.forEach((row) => {
      const issued = parseDate(row.issue_date);
      if (issued) years.add(issued.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [warnings]);

  const misconductOptions = useMemo(() => {
    const opts = new Set<string>();
    warnings.forEach((row) => {
      if (row.misconduct_type) opts.add(row.misconduct_type);
    });
    return Array.from(opts).sort();
  }, [warnings]);

  const normalizeEmploymentType = (emp: Employee) => {
    const type = (emp.employment_type || emp.contract_type || "Unspecified").toLowerCase().replace(/_/g, " ").trim();
    return type || "unspecified";
  };

  const startsTimeline = useMemo(() => {
    return monthLabels.map((label, idx) => {
      const total = employees.filter((emp) => {
        const start = parseDate(emp.start_date);
        if (!start || start.getFullYear() !== startYear || start.getMonth() !== idx) return false;
        if (employmentTypeFilter === "all") return true;
        return normalizeEmploymentType(emp) === employmentTypeFilter;
      }).length;
      return { label, hires: total };
    });
  }, [employees, startYear, employmentTypeFilter]);

  const startYearOptions = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    employees.forEach((emp) => {
      const start = parseDate(emp.start_date);
      if (start) years.add(start.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [employees]);

  const employmentTypeOptions = useMemo(() => {
    const opts = new Set<string>();
    employees.forEach((emp) => {
      opts.add(normalizeEmploymentType(emp));
    });
    return Array.from(opts).sort();
  }, [employees]);

  if (loading || isLoadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const pieColors = ["#2563eb", "#22c55e", "#eab308", "#f97316", "#a855f7", "#06b6d4", "#ef4444"];

  return (
    <DashboardLayout>
      <div className="space-y-4 -ml-6 -mr-6 pl-3 pr-3">
        <header className="rounded-2xl px-5 py-4 space-y-1 flex flex-col gap-2 md:flex-row md:items-center md:justify-between bg-white border border-slate-300">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs font-semibold tracking-wide text-slate-700">
              <span className="underline-offset-2 rounded-sm">Home</span>
              <span aria-hidden="true" className="text-slate-500">
                &gt;
              </span>
              <span className="underline-offset-2 rounded-sm" aria-current="page">
                Dashboard
              </span>
            </div>
            <h1 className="text-xl font-bold uppercase text-blue-700 leading-snug">Workforce Overview</h1>
            <p className="text-xs text-gray-600">
              Monitor headcount trends, demographics, and disciplinary activity at a glance.
            </p>
          </div>
          <span className="text-[11px] text-muted-foreground flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-2.5 py-1.5 shadow-inner self-start md:self-auto">
            <Activity className="h-3.5 w-3.5 text-primary" />
            Live summary
          </span>
        </header>

        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-muted/40 via-background to-background p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <button
              onClick={() => navigate("/employees")}
              className="flex h-full items-center gap-3 rounded-xl border border-border/80 bg-card/90 px-4 py-3 text-left text-sm font-semibold shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-4 w-4" />
              </span>
              <div className="flex-1 leading-tight">
                Employees
                <p className="text-xs font-normal text-muted-foreground">
                  Manage and view your <span className="text-primary font-semibold">{stats.employees}</span> employees.
                </p>
              </div>
            </button>
            <button
              onClick={() => navigate("/warning-generator")}
              className="flex h-full items-center gap-3 rounded-xl border border-border/80 bg-card/90 px-4 py-3 text-left text-sm font-semibold shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div className="flex-1 leading-tight">
                Draft Warning
                <p className="text-xs font-normal text-muted-foreground">Generate a disciplinary warning.</p>
              </div>
            </button>
            <button
              onClick={() => navigate("/documents/contracts")}
              className="flex h-full items-center gap-3 rounded-xl border border-border/80 bg-card/90 px-4 py-3 text-left text-sm font-semibold shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <FileText className="h-4 w-4" />
              </span>
              <div className="flex-1 leading-tight">
                Draft Contract
                <p className="text-xs font-normal text-muted-foreground">Start an employment agreement.</p>
              </div>
            </button>
            <button
              onClick={() => navigate("/calendar")}
              className="flex h-full items-center gap-3 rounded-xl border border-border/80 bg-card/90 px-4 py-3 text-left text-sm font-semibold shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <CalendarDays className="h-4 w-4" />
              </span>
              <div className="flex-1 leading-tight">
                Calendar
                <p className="text-xs font-normal text-muted-foreground">
                  View upcoming expiring documents.
                </p>
              </div>
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border border-border/70 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader className="py-2 pb-1 space-y-1">
              <CardTitle className="text-base">Employment</CardTitle>
              <CardDescription className="text-xs">
                Total distribution by employment type.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 pb-1.5">
              <div className="flex items-center justify-between gap-3">
                <ChartContainer
                  config={{ count: { label: "Employees", color: "#2563eb" } }}
                  className="h-32 w-32 shrink-0"
                >
                  <PieChart>
                    <Pie data={employmentTypeData} dataKey="value" nameKey="label" innerRadius={26} outerRadius={44} paddingAngle={5}>
                      {employmentTypeData.map((_, idx) => (
                        <Cell key={idx} fill={pieColors[(idx + 3) % pieColors.length]} className="transition-all duration-200 hover:opacity-80" />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
                  </PieChart>
                </ChartContainer>
                <div className="flex flex-col gap-1 text-[11px] leading-tight">
                  {employmentTypeData.map((item, idx) => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: pieColors[(idx + 3) % pieColors.length] }}
                      />
                      <span className="text-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/70 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader className="py-2 pb-1 space-y-1">
              <CardTitle className="text-base">Gender</CardTitle>
              <CardDescription className="text-xs">
                Total distribution by gender.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 pb-1.5">
              <div className="flex items-center justify-between gap-3">
                <ChartContainer
                  config={{ count: { label: "Employees", color: "#2563eb" } }}
                  className="h-32 w-32 shrink-0"
                >
                  <PieChart>
                    <Pie data={demographicBlocks.gender} dataKey="value" nameKey="label" innerRadius={26} outerRadius={44} paddingAngle={5}>
                      {demographicBlocks.gender.map((_, idx) => (
                        <Cell key={idx} fill={pieColors[idx % pieColors.length]} className="transition-all duration-200 hover:opacity-80" />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
                  </PieChart>
                </ChartContainer>
                <div className="flex flex-col gap-1 text-[11px] leading-tight">
                  {demographicBlocks.gender.map((item, idx) => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: pieColors[idx % pieColors.length] }}
                      />
                      <span className="text-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/70 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader className="py-2 pb-1 space-y-1">
              <CardTitle className="text-base">Race</CardTitle>
              <CardDescription className="text-xs">
                Total distribution by race.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 pb-1.5">
              <div className="flex items-center justify-between gap-3">
                <ChartContainer
                  config={{ count: { label: "Employees", color: "#22c55e" } }}
                  className="h-32 w-32 shrink-0"
                >
                  <PieChart>
                    <Pie data={demographicBlocks.race} dataKey="value" nameKey="label" innerRadius={26} outerRadius={44} paddingAngle={5}>
                      {demographicBlocks.race.map((_, idx) => (
                        <Cell key={idx} fill={pieColors[(idx + 1) % pieColors.length]} className="transition-all duration-200 hover:opacity-80" />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
                  </PieChart>
                </ChartContainer>
                <div className="flex flex-col gap-1 text-[11px] leading-tight">
                  {demographicBlocks.race.map((item, idx) => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: pieColors[(idx + 1) % pieColors.length] }}
                      />
                      <span className="text-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/70 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader className="py-2 pb-1 space-y-1">
              <CardTitle className="text-base">Nationality</CardTitle>
              <CardDescription className="text-xs">
                Total distribution by nationality.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 pb-1.5">
              <div className="flex items-center justify-between gap-3">
                <ChartContainer
                  config={{ count: { label: "Employees", color: "#f97316" } }}
                  className="h-32 w-32 shrink-0"
                >
                  <PieChart>
                    <Pie data={demographicBlocks.citizenship} dataKey="value" nameKey="label" innerRadius={26} outerRadius={44} paddingAngle={6}>
                      {demographicBlocks.citizenship.map((_, idx) => (
                        <Cell key={idx} fill={pieColors[(idx + 2) % pieColors.length]} className="transition-all duration-200 hover:opacity-80" />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
                  </PieChart>
                </ChartContainer>
                <div className="flex flex-col gap-1 text-[11px] leading-tight">
                  {demographicBlocks.citizenship.map((item, idx) => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: pieColors[(idx + 2) % pieColors.length] }}
                      />
                      <span className="text-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="border border-border/70 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader className="py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Workforce</CardTitle>
                <CardDescription className="text-xs">View total workforce by year and month.</CardDescription>
              </div>
              <div className="w-28">
                <Select value={String(startYear)} onValueChange={(val) => setStartYear(Number(val))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {startYearOptions.map((yr) => (
                      <SelectItem key={yr} value={String(yr)}>
                        {yr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ChartContainer
                config={{ hires: { label: "Hires", color: "hsl(221, 83%, 53%)" } }}
                className="h-44 w-full aspect-auto"
              >
                <BarChart data={startsTimeline} margin={{ left: 0, right: 0, bottom: 8 }} barCategoryGap="10%">
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    interval={0}
                    height={28}
                  />
                  <YAxis
                    allowDecimals={false}
                    domain={[0, "dataMax + 2"]}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                    tick={{ fontSize: 11 }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="hires" radius={6} fill="var(--color-hires)" />
                </BarChart>
              </ChartContainer>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">Employment type</span>
                <Select value={employmentTypeFilter} onValueChange={setEmploymentTypeFilter}>
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <SelectValue placeholder="Filter employment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {employmentTypeOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/70 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader className="py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Active warnings issued</CardTitle>
                <CardDescription className="text-xs">View total active warnings by year and month.</CardDescription>
              </div>
              <div className="w-28">
                <Select value={String(warningYear)} onValueChange={(val) => setWarningYear(Number(val))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {warningYearOptions.map((yr) => (
                      <SelectItem key={yr} value={String(yr)}>
                        {yr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ChartContainer
                config={{
                  active: { label: "Active warnings", color: "hsl(152, 76%, 40%)" },
                }}
                className="h-44 w-full aspect-auto"
              >
                <BarChart data={warningStatusTimeline} margin={{ left: 0, right: 0, bottom: 8 }} barCategoryGap="10%">
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    interval={0}
                    height={28}
                  />
                  <YAxis
                    allowDecimals={false}
                    domain={[0, "dataMax + 2"]}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                    tick={{ fontSize: 11 }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="active" radius={6} fill="var(--color-active)" />
                </BarChart>
              </ChartContainer>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">Misconduct</span>
                <Select value={misconductFilter} onValueChange={setMisconductFilter}>
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue placeholder="Filter misconduct" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All misconduct</SelectItem>
                    {misconductOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

        </div>

        <div className="rounded-xl border border-dashed border-border/70 bg-card/60 p-3 text-xs text-muted-foreground shadow-inner">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            Need a document quickly?
          </div>
          <p className="mt-1">
            Generate warnings or manage employees directly from the navigation. Charts use the same underlying data - no extra setup required.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
