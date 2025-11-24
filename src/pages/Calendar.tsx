import { useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { CalendarClock, Shield, AlertTriangle, FileText, Users } from "lucide-react";

type EventType = "retirement" | "contract" | "warning";

const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString(undefined, { month: "long", year: "numeric" });

const CalendarPage = () => {
  const today = new Date();

  const events = useMemo(
    () => [],
    [],
  );

  const calendarMonth = useMemo(() => {
    const current = new Date(today.getFullYear(), today.getMonth(), 1);
    const startDay = current.getDay(); // 0-6 starting Sunday
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const days: { day: number; date: string; items: EventType[] }[] = [];
    for (let i = 0; i < startDay; i++) {
      days.push({ day: 0, date: "", items: [] });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = new Date(today.getFullYear(), today.getMonth(), d).toISOString().slice(0, 10);
      days.push({
        day: d,
        date: dateStr,
        items: events.filter((e) => e.date === dateStr).map((e) => e.type),
      });
    }
    return { label: formatMonthLabel(today), days };
  }, [events, today]);

  const counts = useMemo(
    () => ({
      retirement: events.filter((e) => e.type === "retirement").length,
      contract: events.filter((e) => e.type === "contract").length,
      warning: events.filter((e) => e.type === "warning").length,
    }),
    [events],
  );

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
          <div className="flex gap-2 self-start md:self-auto">
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

              {events.length === 0 ? (
                <Card className="border-dashed border-border/60 bg-secondary/40">
                  <CardContent className="p-4 text-sm text-muted-foreground">
                    No expiring items yet. As you add retirements, fixed-term contracts, or warnings with validity windows,
                    they will surface here and on the calendar grid. You can later block generating duplicate warning types while a prior one is active.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {events.map((item) => (
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
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {calendarMonth.label}
                </CardTitle>
                <CardDescription>Tap a day to review expiring items.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2 text-center text-sm">
                  {calendarMonth.days.map((day, index) => (
                    <button
                      key={`${day.date}-${index}`}
                      className={`aspect-square rounded-lg border text-sm flex flex-col items-center justify-center gap-1 ${
                        day.day === today.getDate()
                          ? "border-primary/50 bg-primary/10 text-primary font-semibold"
                          : "border-border/70 bg-background/70 text-foreground"
                      }`}
                      disabled={!day.day}
                    >
                      <span className="text-[11px] text-muted-foreground">
                        {day.day ? new Date(today.getFullYear(), today.getMonth(), day.day).toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2) : ""}
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
