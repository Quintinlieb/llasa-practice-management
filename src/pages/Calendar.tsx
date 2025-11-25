import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  CalendarClock,
  Shield,
  AlertTriangle,
  FileText,
  Users,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type EventType = "retirement" | "contract" | "warning";
type CalendarEvent = {
  id: string;
  type: EventType;
  date: string;
  label: string;
  person: string;
};
type CalendarEmployee = {
  id: string;
  employee_name?: string | null;
  employee_surname?: string | null;
  end_date?: string | null;
  contract_type?: string | null;
};
type CalendarWarning = {
  id: string;
  employee_id: string;
  expiry_date?: string | null;
  misconduct_type?: string | null;
  warning_type?: string | null;
};

const fromDateKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return new Date(key);
  return new Date(y, m - 1, d);
};
const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
const formatDayMonthYear = (dateInput: string | Date) => {
  const date = typeof dateInput === "string" ? fromDateKey(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};
const toDateKey = (input: string | Date): string => {
  if (typeof input === "string") {
    const base = input.split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(base)) return base;
  }
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const CalendarPage = () => {
  const today = new Date();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const todayKey = toDateKey(today);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("month");
  const [selectedDate, setSelectedDate] = useState(toDateKey(today));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"month" | "year">("month");
  const [pickerYearBase, setPickerYearBase] = useState(currentYear);

  const updateSelectedDate = (date: Date | string) => {
    const key = toDateKey(date);
    if (!key) return;
    const dateObj = typeof date === "string" ? fromDateKey(key) : date;
    setSelectedDate(key);
    setSelectedYear(dateObj.getFullYear());
    setSelectedMonth(dateObj.getMonth());
  };

  const getWeekStart = (dateKey: string) => {
    const date = fromDateKey(dateKey);
    if (Number.isNaN(date.getTime())) return new Date();
    const day = date.getDay(); // 0 = Sunday
    const mondayOffset = (day + 6) % 7; // days since Monday
    const start = new Date(date);
    start.setDate(date.getDate() - mondayOffset);
    return start;
  };

  const shiftPeriod = (direction: "prev" | "next") => {
    const delta = direction === "next" ? 1 : -1;
    const base = fromDateKey(selectedDate || toDateKey(today));
    if (Number.isNaN(base.getTime())) return;
    if (viewMode === "day") {
      base.setDate(base.getDate() + delta);
      updateSelectedDate(base);
      return;
    }
    if (viewMode === "week") {
      base.setDate(base.getDate() + delta * 7);
      updateSelectedDate(base);
      return;
    }
    // month
    const monthTarget = new Date(selectedYear, selectedMonth + delta, 1);
    updateSelectedDate(monthTarget);
  };

  useEffect(() => {
    if (isDatePickerOpen) {
      const current = fromDateKey(selectedDate);
      setPickerYearBase(current.getFullYear());
      setPickerMode("month");
    }
  }, [isDatePickerOpen, selectedDate]);

  const loadEvents = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    try {
      const { data: employeeData, error: employeeError } = await (supabase as any)
        .from("employees")
        .select("id, employee_name, employee_surname, end_date, contract_type")
        .eq("company_id", user.id);
      const { data: warningData, error: warningError } = await (supabase as any)
        .from("employee_warnings")
        .select("id, employee_id, expiry_date, misconduct_type, warning_type")
        .eq("company_id", user.id);

      if (employeeError) throw employeeError;
      if (warningError) throw warningError;

      const employees = (employeeData as CalendarEmployee[] | null) ?? [];

      const employeesById: Record<
        string,
        { name: string; endDate?: string | null; contractType?: string | null }
      > = {};
      employees.forEach((emp) => {
        employeesById[emp.id] = {
          name: `${emp.employee_name ?? "Employee"} ${emp.employee_surname ?? ""}`.trim(),
          endDate: emp.end_date ? toDateKey(emp.end_date) : null,
          contractType: emp.contract_type,
        };
      });

      const contractEvents: CalendarEvent[] =
        Object.entries(employeesById)
          .map(([id, info]) => ({ id, ...info }))
          .filter((emp) => emp.endDate)
          .map((emp) => {
            const dateOnly = toDateKey(emp.endDate as string);
            if (!dateOnly) return null;
            return {
              id: `contract-${emp.id}`,
              type: "contract",
              date: dateOnly,
              label: emp.contractType ? `${emp.contractType} contract end` : "Contract end",
              person: emp.name,
            };
          })
          .filter((evt): evt is CalendarEvent => !!evt && new Date(evt.date) >= todayStart) ?? [];

      const warnings = (warningData as CalendarWarning[] | null) ?? [];

      const warningEvents: CalendarEvent[] =
        warnings
          .filter((w) => w.expiry_date)
          .map((w) => {
            const employee = employeesById[w.employee_id] ?? { name: "Employee" };
            const dateOnly = toDateKey(w.expiry_date as string);
            if (!dateOnly) return null;
            return {
              id: `warning-${w.id}`,
              type: "warning",
              date: dateOnly,
              label: w.misconduct_type || "Warning expiry",
              person: employee.name,
            };
          })
          .filter((evt): evt is CalendarEvent => !!evt && new Date(evt.date) >= todayStart) ?? [];

      setEvents([...contractEvents, ...warningEvents].sort((a, b) => a.date.localeCompare(b.date)));
    } catch (error: unknown) {
      toast({
        title: "Unable to load calendar",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, user]);

  useEffect(() => {
    if (!loading && user) {
      loadEvents();
    }
  }, [loading, loadEvents, user]);

  const calendarPeriod = useMemo(() => {
    const parsedSelected = fromDateKey(selectedDate);
    const safeSelected = Number.isNaN(parsedSelected.getTime()) ? today : parsedSelected;
    const currentMonthDate = new Date(selectedYear, selectedMonth, 1);
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const selectedDayDate = toDateKey(safeSelected);
    const buildDay = (date: Date): { day: number; date: string; items: EventType[] } => {
      const dateStr = toDateKey(date);
      return {
        day: date.getDate(),
        date: dateStr,
        items: events.filter((e) => e.date === dateStr).map((e) => e.type),
      };
    };

    if (viewMode === "day") {
      return {
        label: formatDayMonthYear(selectedDayDate),
        days: [buildDay(safeSelected)],
        selectedDayDate,
      };
    }

    if (viewMode === "month") {
      const startDay = currentMonthDate.getDay(); // 0-6 starting Sunday
      const days: { day: number; date: string; items: EventType[] }[] = [];
      for (let i = 0; i < startDay; i++) {
        days.push({ day: 0, date: "", items: [] });
      }
      for (let d = 1; d <= daysInMonth; d++) {
        const dayDate = new Date(selectedYear, selectedMonth, d);
        days.push(buildDay(dayDate));
      }
      return { label: formatMonthLabel(currentMonthDate), days };
    }

    const span = 7;
    const startDate = getWeekStart(selectedDayDate);
    const days: { day: number; date: string; items: EventType[] }[] = [];
    for (let i = 0; i < span; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(buildDay(date));
    }
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + span - 1);
    const viewLabel = `${formatDayMonthYear(startDate)} - ${formatDayMonthYear(endDate)}`;
    return { label: viewLabel, days, selectedDayDate };
  }, [events, selectedDate, selectedMonth, selectedYear, viewMode, today]);

  const counts = useMemo(
    () => ({
      retirement: events.filter((e) => e.type === "retirement").length,
      contract: events.filter((e) => e.type === "contract").length,
      warning: events.filter((e) => e.type === "warning").length,
    }),
    [events],
  );

  const upcomingEvents = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date(todayStart);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return events.filter((evt) => {
      const eventDate = new Date(evt.date);
      return eventDate >= todayStart && eventDate <= thirtyDaysFromNow;
    });
  }, [events]);

  const severityBadge = (type: EventType) => {
    if (type === "warning") return "bg-amber-100 text-amber-800 border-amber-200";
    if (type === "contract") return "bg-primary/10 text-primary border-primary/30";
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <header className="space-y-1 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Calendar</p>
            <h1 className="text-3xl font-bold text-gray-900 leading-snug">Expiries & validity</h1>
            <p className="text-base text-gray-600">
              Track expiring warnings, contracts, and events by month.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 self-start md:self-auto">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
              Upcoming expiring documents
            </Badge>
          </div>
        </header>

        <div className="grid lg:grid-cols-[320px_1fr] gap-6">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarClock className="h-5 w-5 text-primary" />
                Next 30 days
              </CardTitle>
              <CardDescription>Track retirements, contract end-dates, and warning validity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3">
                  <p className="text-xs text-emerald-700">Retirement</p>
                  <p className="text-lg font-semibold text-emerald-900">{counts.retirement}</p>
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <p className="text-xs text-primary">Contracts</p>
                  <p className="text-lg font-semibold text-primary">{counts.contract}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3">
                  <p className="text-xs text-amber-700">Warnings</p>
                  <p className="text-lg font-semibold text-amber-800">{counts.warning}</p>
                </div>
              </div>

              <Separator />

              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading events…</p>
              ) : upcomingEvents.length === 0 ? (
                <Card className="border-dashed border-border/60 bg-secondary/40">
                  <CardContent className="p-4 text-sm text-muted-foreground">
                    No expiring items in the next 30 days. As you add fixed-term contracts with end dates or warnings with validity windows,
                    they will surface here and on the calendar grid.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/80 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${severityBadge(item.type)}`}
                        >
                          {item.type === "retirement" && "Retirement"}
                          {item.type === "contract" && "Contract"}
                          {item.type === "warning" && "Warning"}
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-semibold truncate">{item.label}</span>
                          <span className="text-xs text-muted-foreground truncate">{item.person}</span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(item.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              <Card className="bg-primary/5 border-primary/30">
                <CardContent className="p-4 flex items-start gap-3">
                  <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">Warning validity rule</p>
                    <p className="text-sm text-muted-foreground">
                      Prevent generating a new warning type for an employee while a prior warning of the same type is still valid.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-border/70">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" onClick={() => shiftPeriod("prev")} aria-label="Previous period">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        className="h-10 px-3 justify-start border-0 hover:bg-primary/10 text-foreground hover:text-foreground"
                      >
                        <span className="text-base font-semibold">{calendarPeriod.label}</span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground ml-2" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[260px]" align="start">
                      <div className="p-3">
                        <div className="flex items-center justify-between mb-3">
                          <button
                            type="button"
                            className="text-sm font-semibold hover:text-primary"
                            onClick={() => setPickerMode(pickerMode === "month" ? "year" : "month")}
                          >
                            {pickerMode === "month"
                              ? `${pickerYearBase}`
                              : `${pickerYearBase} - ${pickerYearBase + 11}`}
                          </button>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setPickerYearBase((prev) => prev - (pickerMode === "month" ? 1 : 12))}
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setPickerYearBase((prev) => prev + (pickerMode === "month" ? 1 : 12))}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {pickerMode === "month" ? (
                          <div className="grid grid-cols-4 gap-2">
                            {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(
                              (label, idx) => {
                                const isActive =
                                  pickerYearBase === selectedYear && idx === selectedMonth;
                                return (
                                  <Button
                                    key={label}
                                    variant="ghost"
                                    className={`h-9 w-full justify-center text-sm text-foreground hover:text-foreground ${
                                      isActive ? "bg-primary/15 font-semibold" : "hover:bg-primary/10"
                                    }`}
                                    onClick={() => {
                                      const date = new Date(pickerYearBase, idx, 1);
                                      updateSelectedDate(date);
                                      setIsDatePickerOpen(false);
                                    }}
                                  >
                                    {label}
                                  </Button>
                                );
                              },
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-4 gap-2">
                            {Array.from({ length: 12 }, (_, idx) => pickerYearBase + idx).map((year) => {
                              const isActive = year === selectedYear;
                              return (
                                <Button
                                  key={year}
                                  variant="ghost"
                                  className={`h-9 w-full justify-center text-sm text-foreground hover:text-foreground ${
                                    isActive ? "bg-primary/15 font-semibold" : "hover:bg-primary/10"
                                  }`}
                                  onClick={() => {
                                    setPickerYearBase(year);
                                    setSelectedYear(year);
                                    setPickerMode("month");
                                  }}
                                >
                                  {year}
                                </Button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button variant="ghost" size="icon" onClick={() => shiftPeriod("next")} aria-label="Next period">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <div className="ml-auto">
                    <Select
                      value={viewMode}
                      onValueChange={(mode) => setViewMode(mode as "day" | "week" | "month")}
                    >
                      <SelectTrigger className="w-[150px] justify-between">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4" />
                          <SelectValue
                            placeholder="View mode"
                            aria-label={`${viewMode} view`}
                          />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="min-w-[180px]">
                        <SelectItem value="day">Day</SelectItem>
                        <SelectItem value="week">Week</SelectItem>
                        <SelectItem value="month">Month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {viewMode === "day" && calendarPeriod.selectedDayDate ? (
                  <div className="rounded-lg border border-border/70 bg-background/70 p-4 min-h-[60vh] flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Selected day</p>
                        <p className="text-xl font-semibold">{formatDayMonthYear(calendarPeriod.selectedDayDate)}</p>
                      </div>
                      <Badge variant="outline" className="px-3">
                        {events.filter((e) => e.date === calendarPeriod.selectedDayDate).length} event(s)
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      {events.filter((e) => e.date === calendarPeriod.selectedDayDate).length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border/60 bg-secondary/40 p-4 text-sm text-muted-foreground">
                          No events scheduled for this day.
                        </div>
                      ) : (
                        events
                          .filter((e) => e.date === calendarPeriod.selectedDayDate)
                          .map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background px-3 py-2"
                            >
                              <div className="flex items-center gap-3">
                                <span
                                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${
                                    item.type === "warning"
                                      ? "bg-amber-50 text-amber-800 border-amber-200"
                                      : item.type === "contract"
                                        ? "bg-primary/10 text-primary border-primary/30"
                                        : "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  }`}
                                >
                                  {item.type === "warning" && "W"}
                                  {item.type === "contract" && "C"}
                                  {item.type === "retirement" && "R"}
                                </span>
                                <div>
                                  <p className="text-sm font-semibold">{item.label}</p>
                                  <p className="text-xs text-muted-foreground">{item.person}</p>
                                </div>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {formatDayMonthYear(item.date)}
                              </span>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    className="grid gap-2 text-center text-sm grid-cols-7"
                  >
                    {calendarPeriod.days.map((day, index) => (
                      <button
                        key={`${day.date}-${index}`}
                        className={`aspect-square rounded-lg border text-sm flex flex-col items-center justify-center gap-1 ${
                          day.date === todayKey
                            ? "border-primary/50 bg-primary/10 text-primary font-semibold"
                            : "border-border/70 bg-background/70 text-foreground"
                        }`}
                        disabled={!day.day}
                        onClick={() => {
                          if (!day.date) return;
                          updateSelectedDate(day.date);
                          setViewMode("day");
                        }}
                      >
                        <span className="text-[11px] text-muted-foreground">
                          {day.day
                            ? new Date(selectedYear, selectedMonth, day.day)
                                .toLocaleDateString(undefined, { weekday: "short" })
                                .slice(0, 2)
                            : ""}
                        </span>
                        <span className="text-base font-semibold leading-none">{day.day || ""}</span>
                        <div className="flex gap-1">
                          {day.items.map((type, idx) => (
                            <span
                              key={`${type}-${idx}`}
                              className={`h-1.5 w-1.5 rounded-full ${type === "warning" ? "bg-amber-500" : type === "contract" ? "bg-primary" : "bg-emerald-500"}`}
                            />
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-3 rounded-lg border border-border/70 p-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-semibold">Follow-up on expiring items</p>
                    <p className="text-muted-foreground">Reach out to employees whose contracts or warnings approach expiry.</p>
                  </div>
                </div>
              <div className="flex items-start gap-3 rounded-lg border border-border/70 p-3">
                  <Shield className="h-4 w-4 text-primary mt-0.5" />
                  <div>
                    <p className="font-semibold">Maintain compliance</p>
                    <p className="text-muted-foreground">Ensure documentation timelines respect progressive discipline.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CalendarPage;
