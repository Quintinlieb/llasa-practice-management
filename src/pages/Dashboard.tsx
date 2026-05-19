import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type MatterEvent = {
  id: string;
  caseType: string;
  subtype: string;
  matterNumber: string;
  consultant: string;
  nextDate: string;
  nextDateValue: Date | null;
};

type EventRange = "7" | "30" | "90";

const upcomingEventRanges: Array<{ value: EventRange; label: string }> = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "3 months" },
];

const parseMatterDate = (value?: string | null) => {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "--") return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = new Date(`${raw}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatMatterDate = (value: Date | null) => {
  if (!value) return "--";
  return value.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const addMonths = (date: Date, months: number) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

const getRangeEnd = (today: Date, range: EventRange) => {
  if (range === "7") return addDays(today, 7);
  if (range === "30") return addDays(today, 30);
  return addMonths(today, 3);
};

const getDaysUntil = (today: Date, value: Date) =>
  Math.ceil((value.getTime() - today.getTime()) / 86400000);

const getEventLabel = (caseType: string, subtype: string) => {
  const normalizedType = caseType.trim().toLowerCase();
  const normalizedSubtype = subtype.trim().toLowerCase();

  if (normalizedType === "hearing") {
    if (normalizedSubtype === "discipline") return "Disciplinary Hearing";
    if (normalizedSubtype === "incapacity (performance)") return "Poor Performance Hearing";
    if (normalizedSubtype === "incapacity (ill health)") return "Ill Health Hearing";
    if (subtype.trim() && subtype.trim() !== "--" && subtype.trim() !== "None") {
      return `${subtype.trim()} Hearing`;
    }
    return "Hearing";
  }

  if (normalizedType === "consultation") {
    if (subtype.trim() && subtype.trim() !== "--" && subtype.trim() !== "None") {
      return `${subtype.trim()} Consultation`;
    }
    return "Consultation";
  }

  return caseType.trim() || "--";
};

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedRange, setSelectedRange] = useState<EventRange>("30");
  const [isLoading, setIsLoading] = useState(false);
  const [matterEvents, setMatterEvents] = useState<MatterEvent[]>([]);

  useEffect(() => {
    const loadMatterEvents = async () => {
      if (!user) return;

      setIsLoading(true);

      try {
        const { data, error } = await (supabase as any)
          .from("case_files")
          .select("id,file_number,case_type,case_subtype,consultant,next_date,created_at")
          .order("next_date", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false, nullsFirst: false });

        if (error) throw error;

        const rows = Array.isArray(data) ? data : [];
        setMatterEvents(
          rows.map((row: any) => ({
            id: String(row.id),
            caseType: String(row.case_type ?? "--").trim() || "--",
            subtype: String(row.case_subtype ?? "--").trim() || "--",
            matterNumber: String(row.file_number ?? "--").trim() || "--",
            consultant: String(row.consultant ?? "--").trim() || "--",
            nextDate: String(row.next_date ?? "").trim(),
            nextDateValue: parseMatterDate(row.next_date),
          })),
        );
      } catch (error: unknown) {
        toast({
          title: "Unable to load dashboard",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    void loadMatterEvents();
  }, [toast, user]);

  const today = useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }, []);

  const filteredMatterEvents = useMemo(() => {
    const rangeEnd = getRangeEnd(today, selectedRange);

    return matterEvents
      .filter((event) => event.nextDateValue && event.nextDateValue >= today && event.nextDateValue <= rangeEnd)
      .sort((left, right) => {
        if (!left.nextDateValue || !right.nextDateValue) return 0;
        return left.nextDateValue.getTime() - right.nextDateValue.getTime();
      })
      .slice(0, 10);
  }, [matterEvents, selectedRange, today]);

  return (
    <DashboardLayout>
      <div className="space-y-0 -m-6">
        <div className="border border-slate-300 border-r-0 bg-white shadow-sm h-[calc(100dvh-var(--app-header-height,5rem))] pb-0">
          <div className="flex h-full flex-col">
            <div className="pl-4 pr-4 pt-1">
              <div className="pt-5 pb-2">
                <h1 className="text-4xl font-normal text-blue-600 -ml-1">Dashboard</h1>
                <p className="text-xs text-slate-600 mt-2">
                  Track upcoming activity, deadlines, and operational events.
                </p>
              </div>
            </div>

            <section className="relative flex-1 min-h-0 overflow-hidden overflow-x-hidden pr-2">
              <div className="h-full min-h-0 p-0 flex flex-col">
                <Card className="rounded-none border-0 bg-white shadow-none h-full min-h-0 flex flex-col">
                  <CardHeader className="items-start pl-4 pr-4 pt-5 pb-3">
                    <div className="w-full self-start lg:w-1/2 lg:pr-2">
                      <Card className="w-full rounded-sm border border-slate-300 shadow-none">
                        <CardHeader className="border-b border-slate-200 bg-slate-50/80 px-5 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-[#2D4256] text-white">
                                <CalendarDays className="h-5 w-5" />
                              </div>
                              <div>
                                <CardTitle className="text-base font-semibold text-slate-900">Upcoming Events</CardTitle>
                                <CardDescription className="mt-1 text-xs text-slate-600">
                                  Upcoming matters pulled from the matters page.
                                </CardDescription>
                              </div>
                            </div>

                            <Select value={selectedRange} onValueChange={(value) => setSelectedRange(value as EventRange)}>
                              <SelectTrigger className="h-8 w-[96px] rounded-sm border border-slate-300 bg-white px-2 text-[11px] text-slate-700 focus:ring-0 focus:ring-offset-0">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {upcomingEventRanges.map((range) => (
                                  <SelectItem
                                    key={range.value}
                                    value={range.value}
                                    className="text-[11px] text-slate-700 focus:bg-blue-50 focus:text-blue-700"
                                  >
                                    {range.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </CardHeader>

                        <CardContent className="px-5 py-4">
                          {isLoading ? (
                            <div className="rounded-sm border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-[11px] text-slate-500">
                              Loading upcoming matter events...
                            </div>
                          ) : filteredMatterEvents.length === 0 ? (
                            <div className="rounded-sm border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-[11px] text-slate-500">
                              No upcoming matters in the selected range.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {filteredMatterEvents.map((event) => {
                                const daysUntil = event.nextDateValue ? getDaysUntil(today, event.nextDateValue) : null;

                                return (
                                  <div key={event.id} className="rounded-sm border border-slate-200 bg-white px-4 py-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2D4256]">
                                          {getEventLabel(event.caseType, event.subtype)}
                                        </p>
                                        <p className="mt-1 text-sm font-medium text-slate-900">
                                          Matter No: {event.matterNumber}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-600">
                                          Consultant: {event.consultant}
                                        </p>
                                      </div>
                                      <div className="shrink-0 text-right">
                                        <p className="text-[11px] font-medium text-slate-700">
                                          {formatMatterDate(event.nextDateValue)}
                                        </p>
                                        <p className="mt-1 text-[11px] text-slate-500">
                                          {daysUntil === null ? "--" : daysUntil === 0 ? "Today" : daysUntil === 1 ? "In 1 day" : `In ${daysUntil} days`}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </CardHeader>
                </Card>
              </div>
            </section>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
