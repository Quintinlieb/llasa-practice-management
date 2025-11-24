import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { FileText, Users, Plus, CalendarClock, TrendingUp, Activity } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";

type Employee = Tables<"employees">;
type WarningRow = {
  id: string;
  company_id?: string;
  employee_id?: string;
  misconduct_type?: string | null;
  warning_type?: string | null;
  issue_date?: string | null;
};

const warningTable = () => (supabase as any).from("employee_warnings");

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const Dashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [stats, setStats] = useState({ employees: 0, documents: 0 });
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [warnings, setWarnings] = useState<WarningRow[]>([]);
  const [viewMode, setViewMode] = useState<"annual" | "monthly">("annual");
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [isLoadingData, setIsLoadingData] = useState(false);

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
          navigate("/company-setup");
          return;
        }
        setProfile(profileData);

        const [{ count: employeeCount }, { count: documentCount }, employeeResponse, warningResponse] = await Promise.all([
          supabase.from("employees").select("*", { count: "exact", head: true }).eq("company_id", user.id),
          supabase.from("documents").select("*", { count: "exact", head: true }).eq("company_id", user.id),
          supabase.from("employees").select("*").eq("company_id", user.id),
          warningTable()
            .select("id, company_id, employee_id, misconduct_type, warning_type, issue_date")
            .eq("company_id", user.id),
        ]);

        setStats({
          employees: employeeCount || 0,
          documents: documentCount || 0,
        });

        if (employeeResponse.error) throw employeeResponse.error;
        if (warningResponse.error) throw warningResponse.error;

        setEmployees(employeeResponse.data ?? []);
        setWarnings((warningResponse.data as WarningRow[]) ?? []);
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

  const employeeTrendData = useMemo(() => {
    if (viewMode === "annual") {
      return monthLabels.map((label, idx) => {
        const hires = employees.filter((emp) => {
          const start = parseDate(emp.start_date);
          return start && start.getFullYear() === selectedYear && start.getMonth() === idx;
        }).length;
        return { label, hires };
      });
    }

    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, dayIdx) => {
      const day = dayIdx + 1;
      const hires = employees.filter((emp) => {
        const start = parseDate(emp.start_date);
        return (
          start &&
          start.getFullYear() === selectedYear &&
          start.getMonth() === selectedMonth &&
          start.getDate() === day
        );
      }).length;
      return { label: `${day}`, hires };
    });
  }, [employees, selectedMonth, selectedYear, viewMode]);

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
      if (!nationality || nationality === "south african") {
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
        { label: "South African", value: saCount },
        { label: "Foreign National", value: foreignCount },
      ],
    };
  }, [employees]);

  const warningCharts = useMemo(() => {
    const misconductCounts: Record<string, number> = {};
    const warningTypeCounts: Record<string, number> = {};

    warnings.forEach((row) => {
      const misconduct = row.misconduct_type || "Unspecified";
      misconductCounts[misconduct] = (misconductCounts[misconduct] || 0) + 1;

      const type = row.warning_type || "Unspecified";
      warningTypeCounts[type] = (warningTypeCounts[type] || 0) + 1;
    });

    const toSorted = (data: Record<string, number>, limit = 8) =>
      Object.entries(data)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, limit);

    return {
      misconduct: toSorted(misconductCounts),
      types: toSorted(warningTypeCounts, 5),
    };
  }, [warnings]);

  const yearOptions = useMemo(() => {
    const years = new Set<number>([
      now.getFullYear(),
      now.getFullYear() - 1,
      now.getFullYear() - 2,
      ...employees
        .map((emp) => parseDate(emp.start_date)?.getFullYear())
        .filter((yr): yr is number => typeof yr === "number"),
    ]);
    return Array.from(years).sort((a, b) => b - a);
  }, [employees, now]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1">Workforce Overview</h1>
            <p className="text-muted-foreground">
              Track hiring momentum, demographics, and warning trends at a glance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "annual" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("annual")}
              className="gap-2"
            >
              <CalendarClock className="h-4 w-4" />
              Annual
            </Button>
            <Button
              variant={viewMode === "monthly" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("monthly")}
              className="gap-2"
            >
              <Activity className="h-4 w-4" />
              Monthly
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-primary" />
                Employees
              </CardTitle>
              <CardDescription>Total registered</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.employees}</p>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" />
                Documents
              </CardTitle>
              <CardDescription>Warnings generated</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.documents}</p>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
                Active Filters
              </CardTitle>
              <CardDescription>Adjust the timeframe to explore movement</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Select value={String(selectedYear)} onValueChange={(val) => setSelectedYear(Number(val))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {viewMode === "monthly" && (
                <Select value={String(selectedMonth)} onValueChange={(val) => setSelectedMonth(Number(val))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthLabels.map((label, idx) => (
                      <SelectItem key={label} value={String(idx)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 shadow-lg border border-border/70">
            <CardHeader>
              <CardTitle className="text-xl">Hiring momentum</CardTitle>
              <CardDescription>
                {viewMode === "annual"
                  ? `Monthly hires across ${selectedYear}`
                  : `Daily hires for ${monthLabels[selectedMonth]} ${selectedYear}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  hires: { label: "New starters", color: "hsl(217, 92%, 60%)" },
                }}
                className="h-80"
              >
                <LineChart data={employeeTrendData} margin={{ left: 10, right: 10, bottom: 10 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={24} />
                  <ChartTooltip cursor={{ opacity: 0.2 }} content={<ChartTooltipContent labelFormatter={(l) => `Period: ${l}`} />} />
                  <Line
                    type="monotone"
                    dataKey="hires"
                    stroke="var(--color-hires)"
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2, stroke: "white" }}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="shadow-lg border border-border/70">
            <CardHeader>
              <CardTitle className="text-xl">Warnings by type</CardTitle>
              <CardDescription>Top categories across your data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ChartContainer
                config={{
                  count: { label: "Warnings", color: "hsl(12, 88%, 59%)" },
                }}
                className="h-64"
              >
                <BarChart data={warningCharts.types} layout="vertical" margin={{ left: 20, right: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} hide />
                  <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={110} />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="value" radius={6} fill="var(--color-count)" />
                </BarChart>
              </ChartContainer>

              <ChartContainer
                config={{
                  value: { label: "Warnings", color: "hsl(43, 89%, 61%)" },
                }}
                className="h-64"
              >
                <BarChart data={warningCharts.misconduct} margin={{ left: 0, right: 10, bottom: 10 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} hide />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" radius={6} fill="var(--color-value)" />
                  <ChartLegend content={<ChartLegendContent />} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="shadow-lg border border-border/70">
            <CardHeader>
              <CardTitle>Race distribution</CardTitle>
              <CardDescription>Snapshot of your current workforce</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  value: { label: "Employees", color: "hsl(220, 80%, 55%)" },
                }}
                className="h-64"
              >
                <BarChart data={demographicBlocks.race} margin={{ left: 0, right: 10, bottom: 10 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} hide />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" radius={6} fill="var(--color-value)" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="shadow-lg border border-border/70">
            <CardHeader>
              <CardTitle>Gender mix</CardTitle>
              <CardDescription>Balanced view of representation</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  value: { label: "Employees", color: "hsl(141, 70%, 45%)" },
                }}
                className="h-64"
              >
                <BarChart data={demographicBlocks.gender} margin={{ left: 0, right: 10, bottom: 10 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} hide />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" radius={6} fill="var(--color-value)" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="shadow-lg border border-border/70">
            <CardHeader>
              <CardTitle>Citizenship</CardTitle>
              <CardDescription>South African vs foreign nationals</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  value: { label: "Employees", color: "hsl(32, 94%, 60%)" },
                }}
                className="h-64"
              >
                <BarChart data={demographicBlocks.citizenship} margin={{ left: 0, right: 10, bottom: 10 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" radius={6} fill="var(--color-value)" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Quick Actions</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Card
              className="shadow-md hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => navigate("/warning-generator")}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-primary" />
                  Generate Written Warning
                </CardTitle>
                <CardDescription>Create a new written warning for an employee</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full group-hover:scale-105 transition-transform">Start Now</Button>
              </CardContent>
            </Card>

            <Card
              className="shadow-md hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => navigate("/employees")}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Manage Employees
                </CardTitle>
                <CardDescription>Add or edit your employee list</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full group-hover:scale-105 transition-transform">
                  View Employees
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
