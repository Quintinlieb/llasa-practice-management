import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Download, Search, Settings2 } from "lucide-react";
import jsPDF from "jspdf";
import { PageDateStamp } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type ActivityLogRow = {
  id: string;
  actor_user_id: string | null;
  actor_name: string;
  actor_role: string | null;
  activity_key: string;
  activity_group: string;
  activity_label: string;
  action_sentence: string;
  points: number;
  source_table: string | null;
  client_name: string | null;
  matter_file_number: string | null;
  matter_type: string | null;
  document_type: string | null;
  occurred_at: string;
  activity_date: string;
};

type ActivityScoreRule = {
  activity_key: string;
  activity_group: string;
  activity_label: string;
  points: number;
  is_productive: boolean;
  active: boolean;
};

const allValue = "__all__";
const activityFetchBatchSize = 1000;
const activityTablePageSize = 25;
const dateRangeOptions = [
  { value: "7", label: "Last 7 days", days: 7 },
  { value: "30", label: "Last 30 days", days: 30 },
  { value: "60", label: "Last 60 days", days: 60 },
  { value: "90", label: "Last 90 days", days: 90 },
  { value: "last_6_months", label: "Last 6 months", days: null },
  { value: "last_12_months", label: "Last 12 Months", days: null },
  { value: "current_month", label: "This Month", days: null },
  { value: "this_year", label: "This Year", days: null },
  { value: "all", label: "All", days: null },
] as const;
type DateRangeOption = (typeof dateRangeOptions)[number]["value"];

const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10);

const arrayBufferToDataUrl = (buffer: ArrayBuffer, mimeType: string) => {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
};

const formatDisplayDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "--";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getInitialDateRange = () => {
  return getPresetDateRange("current_month");
};

const getPresetDateRange = (range: DateRangeOption) => {
  const end = new Date();
  const start = new Date();
  const option = dateRangeOptions.find((item) => item.value === range);
  if (option?.value === "all") {
    return {
      startDate: "",
      endDate: "",
    };
  }
  if (option?.value === "current_month") {
    start.setDate(1);
  } else if (option?.value === "this_year") {
    start.setMonth(0, 1);
  } else if (option?.value === "last_6_months") {
    start.setMonth(end.getMonth() - 6);
    start.setDate(end.getDate() + 1);
  } else if (option?.value === "last_12_months") {
    start.setFullYear(end.getFullYear() - 1);
    start.setDate(end.getDate() + 1);
  } else {
    start.setDate(end.getDate() - ((option?.days ?? 30) - 1));
  }
  return {
    startDate: toDateInputValue(start),
    endDate: toDateInputValue(end),
  };
};

const getPaginationNumbers = (currentPage: number, totalPages: number) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (currentPage <= 3) return [1, 2, 3, 4, "ellipsis", totalPages] as const;
  if (currentPage >= totalPages - 2) return [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as const;
  return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis-2", totalPages] as const;
};

const sourceLabelByTable: Record<string, string> = {
  client_file_notes: "Client File",
  diary_tasks: "Calendar",
  case_files: "Matter",
  case_dates: "Matter",
  case_notes: "Matter",
  case_documents: "Matter",
  case_outcomes: "Matter",
  documents: "Document",
};

const Reports = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const initialDateRange = useMemo(() => getInitialDateRange(), []);
  const [startDate, setStartDate] = useState(initialDateRange.startDate);
  const [endDate, setEndDate] = useState(initialDateRange.endDate);
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeOption>("current_month");
  const [personFilter, setPersonFilter] = useState(allValue);
  const [groupFilter, setGroupFilter] = useState(allValue);
  const [searchQuery, setSearchQuery] = useState("");
  const [activityTablePage, setActivityTablePage] = useState(1);
  const [activityRows, setActivityRows] = useState<ActivityLogRow[]>([]);
  const [scoreRules, setScoreRules] = useState<ActivityScoreRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMainUser, setIsMainUser] = useState<boolean | null>(null);
  const [isScoreDrawerOpen, setIsScoreDrawerOpen] = useState(false);
  const [isFiltersPanelOpen, setIsFiltersPanelOpen] = useState(false);
  const [expandedFilterSection, setExpandedFilterSection] = useState<string | null>(null);
  const [savingRuleKey, setSavingRuleKey] = useState("");

  const checkAccess = useCallback(async () => {
    if (!user?.id) {
      setIsMainUser(false);
      return false;
    }
    const { data } = await (supabase as any)
      .from("profiles")
      .select("id,auth_user_id")
      .or(`id.eq.${user.id},auth_user_id.eq.${user.id}`)
      .maybeSingle();
    const allowed = Boolean(data?.id || data?.auth_user_id);
    setIsMainUser(allowed);
    return allowed;
  }, [user?.id]);

  const loadScoreRules = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("activity_score_rules")
      .select("activity_key,activity_group,activity_label,points,is_productive,active")
      .order("activity_group", { ascending: true })
      .order("activity_label", { ascending: true });
    if (error) throw error;
    setScoreRules((data ?? []).map((row: any) => ({
      activity_key: String(row.activity_key || ""),
      activity_group: String(row.activity_group || ""),
      activity_label: String(row.activity_label || ""),
      points: Number(row.points || 0),
      is_productive: Boolean(row.is_productive),
      active: Boolean(row.active),
    })));
  }, []);

  const loadActivityRows = useCallback(async () => {
    const rows: any[] = [];
    let from = 0;
    let shouldContinue = true;

    while (shouldContinue) {
      let query = (supabase as any)
        .from("activity_logs")
        .select("id,actor_user_id,actor_name,actor_role,activity_key,activity_group,activity_label,action_sentence,points,source_table,client_name,matter_file_number,matter_type,document_type,occurred_at,activity_date")
        .order("occurred_at", { ascending: false })
        .range(from, from + activityFetchBatchSize - 1);

      if (startDate) query = query.gte("activity_date", startDate);
      if (endDate) query = query.lte("activity_date", endDate);
      if (personFilter !== allValue) query = query.eq("actor_name", personFilter);
      if (groupFilter !== allValue) query = query.eq("activity_group", groupFilter);

      const { data, error } = await query;
      if (error) throw error;

      const batch = Array.isArray(data) ? data : [];
      rows.push(...batch);
      shouldContinue = batch.length === activityFetchBatchSize;
      from += activityFetchBatchSize;
    }

    setActivityRows(rows.map((row: any) => ({
      id: String(row.id || ""),
      actor_user_id: row.actor_user_id ? String(row.actor_user_id) : null,
      actor_name: String(row.actor_name || "Unknown User"),
      actor_role: row.actor_role ? String(row.actor_role) : null,
      activity_key: String(row.activity_key || ""),
      activity_group: String(row.activity_group || ""),
      activity_label: String(row.activity_label || ""),
      action_sentence: String(row.action_sentence || ""),
      points: Number(row.points || 0),
      source_table: row.source_table ? String(row.source_table) : null,
      client_name: row.client_name ? String(row.client_name) : null,
      matter_file_number: row.matter_file_number ? String(row.matter_file_number) : null,
      matter_type: row.matter_type ? String(row.matter_type) : null,
      document_type: row.document_type ? String(row.document_type) : null,
      occurred_at: String(row.occurred_at || ""),
      activity_date: String(row.activity_date || ""),
    })));
  }, [endDate, groupFilter, personFilter, startDate]);

  const reloadReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const allowed = await checkAccess();
      if (!allowed) return;
      const { error: syncError } = await (supabase as any).rpc("sync_reached_matter_date_activities");
      if (syncError) console.warn("Unable to sync reached matter date activities:", syncError.message);
      await Promise.all([loadScoreRules(), loadActivityRows()]);
    } catch (error: any) {
      toast({
        title: "Unable to load reports",
        description: error?.message || "Run the activity reports SQL in Supabase, then refresh.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [checkAccess, loadActivityRows, loadScoreRules, toast]);

  useEffect(() => {
    void reloadReports();
  }, [reloadReports]);

  useEffect(() => {
    setActivityTablePage(1);
  }, [endDate, groupFilter, personFilter, searchQuery, startDate]);

  const scoreRulePoints = useMemo(() => {
    return new Map(scoreRules.map((rule) => [rule.activity_key, rule.points]));
  }, [scoreRules]);

  const scoredRows = useMemo(() => {
    return activityRows.map((row) => ({
      ...row,
      points: scoreRulePoints.get(row.activity_key) ?? row.points,
    }));
  }, [activityRows, scoreRulePoints]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return scoredRows;
    return scoredRows.filter((row) =>
      [
        row.action_sentence,
        row.actor_name,
        row.activity_label,
        row.activity_group,
        row.client_name,
        row.matter_file_number,
        row.matter_type,
        row.document_type,
      ].some((value) => String(value || "").toLowerCase().includes(query)),
    );
  }, [scoredRows, searchQuery]);

  const personOptions = useMemo(() => {
    return Array.from(new Set(activityRows.map((row) => row.actor_name).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [activityRows]);

  const groupOptions = useMemo(() => {
    return Array.from(new Set(scoreRules.map((rule) => rule.activity_group).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [scoreRules]);

  const totalPoints = useMemo(() => filteredRows.reduce((sum, row) => sum + row.points, 0), [filteredRows]);

  const userSummaries = useMemo(() => {
    const byUser = new Map<string, { name: string; points: number; activities: number; percentage: number }>();
    filteredRows.forEach((row) => {
      const name = row.actor_name || "Unknown User";
      const current = byUser.get(name) ?? { name, points: 0, activities: 0, percentage: 0 };
      current.points += row.points;
      current.activities += 1;
      byUser.set(name, current);
    });
    return Array.from(byUser.values())
      .map((item) => ({
        ...item,
        percentage: totalPoints > 0 ? (item.points / totalPoints) * 100 : 0,
      }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  }, [filteredRows, totalPoints]);

  const totalActivityTablePages = Math.max(1, Math.ceil(filteredRows.length / activityTablePageSize));
  const currentActivityTablePage = Math.min(activityTablePage, totalActivityTablePages);
  const currentActivityTableOffset = (currentActivityTablePage - 1) * activityTablePageSize;
  const paginatedActivityRows = useMemo(
    () => filteredRows.slice(currentActivityTableOffset, currentActivityTableOffset + activityTablePageSize),
    [currentActivityTableOffset, filteredRows],
  );
  const activityTablePageNumbers = useMemo(
    () => getPaginationNumbers(currentActivityTablePage, totalActivityTablePages),
    [currentActivityTablePage, totalActivityTablePages],
  );
  const activityRangeStart = filteredRows.length === 0 ? 0 : currentActivityTableOffset + 1;
  const activityRangeEnd = filteredRows.length === 0 ? 0 : Math.min(currentActivityTableOffset + activityTablePageSize, filteredRows.length);

  const clearFilters = () => {
    const nextRange = getInitialDateRange();
    setStartDate(nextRange.startDate);
    setEndDate(nextRange.endDate);
    setDateRangeFilter("current_month");
    setPersonFilter(allValue);
    setGroupFilter(allValue);
    setIsFiltersPanelOpen(false);
    setExpandedFilterSection(null);
  };

  const setPresetDateFilter = (value: DateRangeOption) => {
    const nextRange = getPresetDateRange(value);
    setDateRangeFilter(value);
    setStartDate(nextRange.startDate);
    setEndDate(nextRange.endDate);
    setIsFiltersPanelOpen(false);
  };

  const updateScoreRule = async (rule: ActivityScoreRule, points: number) => {
    setSavingRuleKey(rule.activity_key);
    try {
      const safePoints = Math.max(0, Number.isFinite(points) ? Number(points.toFixed(2)) : 0);
      const { error } = await (supabase as any)
        .from("activity_score_rules")
        .update({ points: safePoints })
        .eq("activity_key", rule.activity_key);
      if (error) throw error;
      setScoreRules((prev) => prev.map((item) => item.activity_key === rule.activity_key ? { ...item, points: safePoints } : item));
      toast({ title: "Score updated", description: `${rule.activity_label} is now ${safePoints} point${safePoints === 1 ? "" : "s"}.` });
    } catch (error: any) {
      toast({ title: "Unable to update score", description: error?.message || "Update failed.", variant: "destructive" });
    } finally {
      setSavingRuleKey("");
    }
  };

  const handleExportReportsPdf = useCallback(async () => {
    if (filteredRows.length === 0) {
      toast({
        title: "Nothing to export",
        description: "There are no activities available for the selected filters.",
        variant: "destructive",
      });
      return;
    }

    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 12;
      const contentWidth = pageWidth - margin * 2;
      const footerHeight = 20;
      const contentBottom = pageHeight - footerHeight - 3;
      const exportTitle = "Activity Report";
      const dateLabel = dateRangeOptions.find((option) => option.value === dateRangeFilter)?.label || "Selected Range";
      const periodLabel = dateRangeFilter === "all" ? "All activity dates" : `${dateLabel}: ${startDate} to ${endDate}`;
      const personLabel = personFilter === allValue ? "All people" : personFilter;
      const groupLabel = groupFilter === allValue ? "All groups" : groupFilter;
      const introText = `This activity report lists ${filteredRows.length} activities for ${periodLabel}. Person filter: ${personLabel}. Group filter: ${groupLabel}. Total productivity score: ${Number(totalPoints.toFixed(2))}.`;
      const columns = [
        { key: "index", label: "#", width: 10 },
        { key: "activity", label: "Activity", width: 92 },
        { key: "person", label: "Person", width: 42 },
        { key: "source", label: "Source", width: 30 },
        { key: "points", label: "Points", width: 18 },
        { key: "date", label: "Date", width: 34 },
        { key: "detail", label: "Detail", width: 47 },
      ] as const;
      let y = 22;

      const drawPageHeader = () => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text(exportTitle, pageWidth / 2, 11, { align: "center" });
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.line(margin, 14.5, margin + contentWidth, 14.5);
      };

      const drawContinuationPageHeader = () => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text("Activity Report (Continued...)", margin, 10.5, { align: "left" });
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.line(margin, 13, margin + contentWidth, 13);
      };

      const drawSectionHeader = () => {
        const sectionHeaderHeight = 7;
        doc.setFillColor(51, 65, 85);
        doc.setDrawColor(51, 65, 85);
        doc.setLineWidth(0.16);
        doc.rect(margin, y, contentWidth, sectionHeaderHeight, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text(`Activities (${filteredRows.length})`, margin + 3, y + 4.8);
        doc.setFontSize(7);
        doc.text(`${Number(totalPoints.toFixed(2))} points`, margin + contentWidth - 3, y + 4.8, { align: "right" });
        y += sectionHeaderHeight + 1.8;
      };

      const drawTableHeader = () => {
        const headerHeight = 7;
        let x = margin;
        columns.forEach((column) => {
          doc.setFillColor(226, 232, 240);
          doc.rect(x, y, column.width, headerHeight, "F");
          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.15);
          doc.rect(x, y, column.width, headerHeight, "S");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(0, 0, 0);
          doc.text(column.label, x + 2, y + 4.6);
          x += column.width;
        });
        y += headerHeight;
      };

      const startNewPage = () => {
        doc.addPage();
        y = 15.5;
        drawContinuationPageHeader();
      };

      const loadFooterLogoDataUrl = async () => {
        try {
          const response = await fetch("/Horizontal Logo (3).png");
          if (!response.ok) return "";
          const buffer = await response.arrayBuffer();
          return arrayBufferToDataUrl(buffer, response.headers.get("content-type") || "image/png");
        } catch {
          return "";
        }
      };

      drawPageHeader();

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      const introLines = doc.splitTextToSize(introText, contentWidth) as string[];
      introLines.forEach((line, index) => {
        doc.text(line, margin, y + index * 3.8);
      });
      y += introLines.length * 3.8 + 5;

      drawSectionHeader();
      drawTableHeader();

      filteredRows.forEach((row, rowIndex) => {
        const rowValues = [
          String(rowIndex + 1),
          row.action_sentence || "--",
          row.actor_name || "--",
          row.source_table ? sourceLabelByTable[row.source_table] || row.source_table : "--",
          String(row.points),
          formatDisplayDateTime(row.occurred_at),
          [row.client_name, row.matter_file_number, row.document_type].filter(Boolean).join(" | ") || row.activity_label || "--",
        ];
        const lineHeight = 3.3;
        const cellPaddingX = 2.3;
        const cellPaddingY = 1.6;
        const cellLines = columns.map((column, idx) =>
          doc.splitTextToSize(String(rowValues[idx] || "--"), column.width - cellPaddingX * 2) as string[],
        );
        const maxLines = Math.max(...cellLines.map((lines) => Math.max(lines.length, 1)));
        const rowHeight = maxLines * lineHeight + cellPaddingY * 2;

        if (y + rowHeight > contentBottom) {
          startNewPage();
          drawTableHeader();
        }

        let x = margin;
        columns.forEach((column, columnIndex) => {
          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.12);
          doc.rect(x, y, column.width, rowHeight);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(17, 24, 39);
          const lines = cellLines[columnIndex];
          lines.forEach((line: string, lineIdx: number) => {
            doc.text(line, x + cellPaddingX, y + cellPaddingY + 2.5 + lineIdx * lineHeight);
          });
          x += column.width;
        });

        y += rowHeight;
      });

      const footerLogoDataUrl = await loadFooterLogoDataUrl();
      const totalPages = doc.getNumberOfPages();
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        doc.setPage(pageNumber);
        const footerTop = pageHeight - footerHeight;
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.line(margin, footerTop, margin + contentWidth, footerTop);
        if (footerLogoDataUrl) {
          try {
            const imageType = footerLogoDataUrl.includes("image/jpeg") ? "JPEG" : "PNG";
            doc.addImage(footerLogoDataUrl, imageType, margin, footerTop + 2.6, 34, 10.3, undefined, "FAST");
          } catch {
            doc.text("LLASA", margin, footerTop + 6.2, { align: "left" });
          }
        } else {
          doc.text("LLASA", margin, footerTop + 6.2, { align: "left" });
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(70, 74, 78);
        doc.text("This document is confidential and for internal use only.", pageWidth / 2, footerTop + 6.2, { align: "center" });
        doc.text(`Page ${pageNumber} of ${totalPages}`, margin + contentWidth, footerTop + 6.2, { align: "right" });
      }

      doc.setTextColor(0, 0, 0);
      doc.save(`Activity Report - ${dateLabel}.pdf`);
      toast({
        title: "Export ready",
        description: "Activity report exported successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error?.message || "Unable to export the activity report right now.",
        variant: "destructive",
      });
    }
  }, [dateRangeFilter, endDate, filteredRows, groupFilter, personFilter, startDate, toast, totalPoints]);

  const productivityDropdownContent = (
    <DropdownMenuContent
      align="end"
      sideOffset={10}
      className="w-[380px] rounded-[12px] border border-slate-200 bg-white p-0 shadow-[0_20px_45px_rgba(15,23,42,0.16)]"
    >
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-[13px] font-semibold text-slate-900">Productivity Share</p>
        <p className="mt-1 text-[11px] text-slate-500">{totalPoints} points across {filteredRows.length} activities</p>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {userSummaries.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12px] text-slate-500">No activity for the selected filters.</div>
        ) : (
          userSummaries.map((row, index) => (
            <div
              key={row.name}
              className={`group border-l-[3px] border-l-transparent px-4 py-3 transition-colors hover:border-l-[#2f9f35] hover:bg-[#eef9ef] ${
                index !== userSummaries.length - 1 ? "border-b border-slate-100" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-slate-900">{row.name}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{row.activities} activities | {row.points} points</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[16px] font-semibold text-[#2f9f35]">{row.percentage.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </DropdownMenuContent>
  );

  if (isMainUser === false) {
    return (
      <div className="space-y-0 -m-6">
        <div className="overflow-hidden rounded-tl-sm border border-slate-300 border-l-0 border-r-0 bg-white shadow-sm h-[calc(100dvh-var(--app-header-height,5rem))]">
          <div className="flex h-full items-center justify-center px-6">
            <div className="max-w-md text-center">
              <h1 className="text-3xl font-normal text-[#3eca44]">Reports</h1>
              <p className="mt-3 text-sm text-slate-600">Only the main user can view company activity reports.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0 -m-6">
      <div className="overflow-hidden rounded-tl-sm border border-slate-300 border-l-0 border-r-0 bg-white shadow-sm h-[calc(100dvh-var(--app-header-height,5rem))] pb-0">
        <div className="flex h-full flex-col">
          <div className="pl-4 pr-4 pt-1">
            <div className="flex flex-col gap-4 pt-[10px] pb-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="text-4xl font-normal text-[#3eca44] -ml-1">Reports</h1>
                <p className="text-xs text-slate-600 mt-2">Track company activity, points, and productivity share by person.</p>
              </div>
              <div className="flex items-center gap-2 lg:pt-1">
                <PageDateStamp className="text-slate-500 [&_svg]:text-slate-500" />
              </div>
            </div>
          </div>

          <section className="relative flex-1 min-h-0 overflow-hidden overflow-x-hidden pr-2">
            <div className="h-full min-h-0 p-0 flex flex-col">
              <Card className="rounded-none bg-white border-0 shadow-none h-full min-h-0 flex flex-col">
                <CardHeader className="pl-4 pr-4 pt-5 pb-3 space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="group relative w-full sm:w-[400px]">
                        <Input
                          placeholder="Search activity..."
                          value={searchQuery}
                          onChange={(event) => setSearchQuery(event.target.value)}
                          className={cn(
                            "h-8 rounded-sm border border-slate-200 bg-white !text-[12.33px] font-medium shadow-sm transition-colors placeholder:!text-[12.33px] hover:border-[#3eca44] focus-visible:!border focus-visible:!border-black focus-visible:ring-0 group-hover:border-[#3eca44]",
                            searchQuery.trim().length > 0 ? "pr-20" : "pr-9",
                          )}
                        />
                        {searchQuery.trim().length > 0 ? (
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[12.33px] font-semibold text-slate-500 hover:text-[#2f9f35] hover:underline"
                            onClick={() => setSearchQuery("")}
                          >
                            Clear
                          </button>
                        ) : (
                          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                        )}
                      </div>
                      <p className="text-[11px] font-medium text-slate-500 whitespace-nowrap sm:self-end">
                        <span className="text-slate-900">{`${activityRangeStart}-${activityRangeEnd}`}</span> of {filteredRows.length} activities
                      </p>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <Button type="button" variant="outline" className="h-8 rounded-[4px] px-3 text-[12.33px] inline-flex items-center border border-slate-200 bg-white transition-colors hover:border-[#3eca44] hover:bg-white hover:text-[#2f9f35] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0" onClick={() => void handleExportReportsPdf()}>
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Export
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="outline" className="h-8 rounded-[4px] px-3 text-[12.33px] inline-flex items-center border border-slate-200 bg-white transition-colors hover:border-[#3eca44] hover:bg-white hover:text-[#2f9f35] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:border-[#3eca44]">
                            Productivity
                          </Button>
                        </DropdownMenuTrigger>
                        {productivityDropdownContent}
                      </DropdownMenu>
                      <DropdownMenu open={isFiltersPanelOpen} onOpenChange={(open) => { setIsFiltersPanelOpen(open); if (!open) setExpandedFilterSection(null); }}>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="outline" className="h-8 w-24 justify-between rounded-[4px] px-3 text-[12.33px] inline-flex items-center border border-slate-200 bg-white transition-colors hover:border-[#3eca44] hover:bg-white hover:text-[#2f9f35] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:border-[#3eca44]">
                            <span>Filter</span>
                            <ChevronDown className={`h-4 w-4 transition-transform ${isFiltersPanelOpen ? "rotate-180" : ""}`} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={0} className="w-[292px] rounded-[4px] border border-slate-200 bg-white p-0 shadow-lg">
                          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                            <span className="text-[13.33px] font-semibold text-slate-800">Filter</span>
                            <button type="button" className="text-[11.33px] font-semibold uppercase tracking-wide text-[#2f9f35] hover:underline" onClick={clearFilters}>
                              Clear
                            </button>
                          </div>
                          <div className="divide-y divide-slate-200">
                            {["person", "group", "date"].map((section) => (
                              <div key={section}>
                                <button
                                  type="button"
                                  className={`flex h-9 w-full items-center justify-between px-3 text-left text-[12.33px] font-semibold text-slate-800 hover:bg-slate-100 ${expandedFilterSection === section ? "bg-slate-100" : ""}`}
                                  onClick={() => setExpandedFilterSection((prev) => (prev === section ? null : section))}
                                >
                                  <span>{section === "person" ? "Person" : section === "group" ? "Group" : "Date"}</span>
                                  <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform ${expandedFilterSection === section ? "rotate-180" : ""}`} />
                                </button>
                                {expandedFilterSection === section ? (
                                  <div className="px-3 pb-2">
                                    {section === "date" ? (
                                      <div className="py-1">
                                        {dateRangeOptions.map((option) => (
                                          <button
                                            key={option.value}
                                            type="button"
                                            className="flex h-8 w-full items-center justify-between text-[12.33px] text-slate-700 hover:bg-[#3eca44]/10 hover:text-[#2f9f35]"
                                            onClick={() => setPresetDateFilter(option.value)}
                                          >
                                            <span className="truncate pr-2">{option.label}</span>
                                            {dateRangeFilter === option.value ? <Check className="h-3.5 w-3.5 shrink-0 text-[#2f9f35]" /> : null}
                                          </button>
                                        ))}
                                      </div>
                                    ) : (
                                      (section === "person"
                                        ? [allValue, ...personOptions]
                                        : [allValue, ...groupOptions]
                                      ).map((value) => {
                                        const selected =
                                          section === "person"
                                            ? personFilter === value
                                            : groupFilter === value;
                                        const label = value === allValue
                                          ? "All"
                                          : value;
                                        return (
                                          <button
                                            key={value}
                                            type="button"
                                            className="flex h-8 w-full items-center justify-between text-[12.33px] text-slate-700 hover:bg-[#3eca44]/10 hover:text-[#2f9f35]"
                                            onClick={() => {
                                              if (section === "person") setPersonFilter(value);
                                              if (section === "group") {
                                                setGroupFilter(value);
                                              }
                                              setIsFiltersPanelOpen(false);
                                            }}
                                          >
                                            <span className="truncate pr-2">{label}</span>
                                            {selected ? <Check className="h-3.5 w-3.5 shrink-0 text-[#2f9f35]" /> : null}
                                          </button>
                                        );
                                      })
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button type="button" className="h-8 rounded bg-[#3eca44] px-3 text-[11px] text-white hover:bg-[#34b73b]" onClick={() => setIsScoreDrawerOpen(true)}>
                        <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                        Scoring
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 min-h-0 flex-col gap-2 overflow-hidden pl-4 pr-4 pb-0">
                  <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm border border-slate-200">
                    <div className="grid grid-cols-[44px_1.65fr_0.58fr_0.58fr_0.46fr_0.66fr] items-center gap-2 border-b bg-[#2D4256] pl-3 pr-3 py-3 text-xs font-semibold text-white [&>*+*]:pl-2">
                      <div>#</div>
                      <div>Activity</div>
                      <div>Person</div>
                      <div>Source</div>
                      <div className="text-center">Points</div>
                      <div className="text-right">Date</div>
                    </div>
                    <div className="employee-table-scroll min-h-0 flex-1 divide-y overflow-y-auto">
                      {isLoading ? (
                        <div className="px-4 py-6 text-xs text-slate-500">Loading activity...</div>
                      ) : filteredRows.length === 0 ? (
                        <div className="px-4 py-6 text-xs text-slate-500">No activity found.</div>
                      ) : (
                        paginatedActivityRows.map((row, rowIndex) => (
                          <div key={row.id} className="group grid h-[40px] w-full cursor-default grid-cols-[44px_1.65fr_0.58fr_0.58fr_0.46fr_0.66fr] items-center gap-2 pl-3 pr-3 text-left text-xs hover:bg-[#3eca44]/5 [&>*+*]:border-l [&>*+*]:border-slate-200 [&>*+*]:pl-2">
                            <div className="font-medium text-slate-500">{currentActivityTableOffset + rowIndex + 1}</div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-900 transition-colors group-hover:font-semibold">{row.action_sentence}</p>
                              <p className="truncate text-[10px] text-slate-500">{[row.client_name, row.matter_file_number, row.document_type].filter(Boolean).join(" | ") || row.activity_label}</p>
                            </div>
                            <div className="truncate text-slate-700">{row.actor_name || "--"}</div>
                            <div>
                              <Badge className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-700 shadow-none transition-colors hover:border-[#3eca44] hover:bg-[#3eca44] hover:text-white">
                                {row.source_table ? sourceLabelByTable[row.source_table] || row.source_table : "--"}
                              </Badge>
                            </div>
                            <div className="text-center font-semibold text-slate-900">{row.points}</div>
                            <div className="text-right text-[10px] text-slate-500">{formatDisplayDateTime(row.occurred_at)}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center justify-center gap-2 px-1 pt-[15px] pb-[22px]">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 min-w-[86px] rounded-[4px] border border-[#8fd693] bg-white px-4 text-[11px] font-medium text-[#2f9f35] transition-colors hover:border-[#3eca44] hover:bg-[#eaf8eb] hover:text-[#2f9f35] disabled:border-[#d6ead7] disabled:text-[#a7c9a9]"
                      onClick={() => setActivityTablePage((prev) => Math.max(1, prev - 1))}
                      disabled={currentActivityTablePage === 1}
                    >
                      Previous
                    </Button>
                    {activityTablePageNumbers.map((page) =>
                      typeof page === "number" ? (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setActivityTablePage(page)}
                          className={`flex h-8 min-w-8 items-center justify-center rounded-[4px] border px-3 text-[11px] font-medium transition-colors ${
                            page === currentActivityTablePage
                              ? "border-[#3eca44] bg-[#3eca44] text-white"
                              : "border-[#b9e3bc] bg-white text-[#2f9f35] hover:border-[#3eca44] hover:bg-[#eaf8eb]"
                          }`}
                        >
                          {page}
                        </button>
                      ) : (
                        <span key={page} className="px-1 text-[11px] font-medium text-[#2f9f35]">
                          ...
                        </span>
                      ),
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 min-w-[86px] rounded-[4px] border border-[#8fd693] bg-white px-4 text-[11px] font-medium text-[#2f9f35] transition-colors hover:border-[#3eca44] hover:bg-[#eaf8eb] hover:text-[#2f9f35] disabled:border-[#d6ead7] disabled:text-[#a7c9a9]"
                      onClick={() => setActivityTablePage((prev) => Math.min(totalActivityTablePages, prev + 1))}
                      disabled={currentActivityTablePage === totalActivityTablePages}
                    >
                      Next
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        </div>
      </div>

      <Sheet open={isScoreDrawerOpen} onOpenChange={setIsScoreDrawerOpen}>
        <SheetContent side="right" className="w-[440px] max-w-[440px] overflow-y-auto bg-white p-0 sm:max-w-[440px]">
          <SheetHeader className="border-b border-slate-200 px-5 py-4">
            <SheetTitle className="text-[18px] text-slate-900">Scoring Rules</SheetTitle>
            <SheetDescription className="text-[11px] text-slate-500">Update activity points used by the productivity report.</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-5 py-4">
            {scoreRules.map((rule) => (
              <div key={rule.activity_key} className="grid grid-cols-[1fr_76px] items-center gap-3 rounded border border-slate-200 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-slate-900">{rule.activity_label}</p>
                  <p className="text-[10px] text-slate-500">{rule.activity_group}</p>
                </div>
                <Input
                  type="number"
                  min={0}
                  value={rule.points}
                  onChange={(event) => {
                    const nextValue = Number(event.target.value || 0);
                    setScoreRules((prev) => prev.map((item) => item.activity_key === rule.activity_key ? { ...item, points: nextValue } : item));
                  }}
                  onBlur={(event) => void updateScoreRule(rule, Number(event.target.value || 0))}
                  disabled={savingRuleKey === rule.activity_key}
                  step={0.5}
                  className="h-8 rounded border-slate-300 text-center text-[11px]"
                />
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Reports;
