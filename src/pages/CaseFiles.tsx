import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, ChevronDown, Plus, Search, User, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type CaseNote = { date: string; addedBy: string; noteType: string; body: string; followUpDate: string };
type CaseTask = { title: string; assignedTo: string; dueDate: string; priority: "Low" | "Medium" | "High"; status: string };
type CaseOutcome = { outcomeType: string; outcomeDate: string; result: string; amount: string; closingNote: string; closedBy: string; closedDate: string };
type CaseFile = {
  id: string;
  fileNo: string;
  client: string;
  parties: string;
  caseType: string;
  forumVenue: string;
  nextDate: string;
  consultant: string;
  status: "Active" | "Pending" | "Awaiting Documents" | "Set Down" | "Settled" | "Closed" | "Archived";
  priority: "Normal" | "Urgent";
  lastUpdated: string;
  caseTitle: string;
  subtype: string;
  caseNumber: string;
  employerRepresentative: string;
  currentStage: string;
  shortDescription: string;
  dates: Record<string, string>;
  notes: CaseNote[];
  tasks: CaseTask[];
  outcome: CaseOutcome;
};

type ClientOption = { id: string; label: string };
type NewCaseStep = 1 | 2 | 3;
type NewCaseForm = {
  clientId: string;
  clientName: string;
  fileNumber: string;
  parties: string;
  caseType: string;
  forumVenue: string;
  caseNumber: string;
  currentStage: string;
  nextDate: string;
  deadlineDate: string;
  assignedConsultant: string;
  status: CaseFile["status"];
  priority: CaseFile["priority"];
  shortDescription: string;
  openingNote: string;
};
const caseFilesTableCacheKey = "case-files:table-cache";

const CASE_TYPE_OPTIONS = [
  "Disciplinary Hearing",
  "Performance Incapacity Hearing",
  "Ill Health Incapacity Hearing",
  "Bargaining Council Case",
  "CCMA Case",
  "Labour Court",
  "Grievance Consultation",
  "Performance Consultation",
  "Normal Consultation",
] as const;
const CASE_TYPE_CODE_MAP: Record<(typeof CASE_TYPE_OPTIONS)[number], string> = {
  "Disciplinary Hearing": "DH",
  "Performance Incapacity Hearing": "PH",
  "Ill Health Incapacity Hearing": "IH",
  "Bargaining Council Case": "BC",
  "CCMA Case": "CC",
  "Labour Court": "LC",
  "Grievance Consultation": "GC",
  "Performance Consultation": "PC",
  "Normal Consultation": "NC",
};
const CURRENT_STAGE_OPTIONS = ["New File", "Consultation", "Referral Received", "Conciliation", "Arbitration", "Set Down", "Hearing Scheduled", "Awaiting Documents", "Awaiting Outcome", "Closed"] as const;
const STATUS_OPTIONS: CaseFile["status"][] = ["Active", "Pending", "Awaiting Documents", "Set Down", "Settled", "Closed", "Archived"];
const PRIORITY_OPTIONS: CaseFile["priority"][] = ["Normal", "Urgent"];

const createBlankCaseForm = (): NewCaseForm => ({
  clientId: "",
  clientName: "",
  fileNumber: "",
  parties: "",
  caseType: "",
  forumVenue: "",
  caseNumber: "",
  currentStage: "",
  nextDate: "",
  deadlineDate: "",
  assignedConsultant: "",
  status: "Active",
  priority: "Normal",
  shortDescription: "",
  openingNote: "",
});

const toIsoDate = (value: string) => (value ? new Date(value).toISOString().slice(0, 10) : "");
const formatDisplayDate = (value?: string) => {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
};

const loadCachedCaseFiles = (): CaseFile[] => {
  try {
    const raw = sessionStorage.getItem(caseFilesTableCacheKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveCachedCaseFiles = (rows: CaseFile[]) => {
  try {
    sessionStorage.setItem(caseFilesTableCacheKey, JSON.stringify(rows));
  } catch {
    // ignore storage errors
  }
};

const CaseFiles = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [caseFiles, setCaseFiles] = useState<CaseFile[]>(() => loadCachedCaseFiles());
  const [isCaseFilesLoading, setIsCaseFilesLoading] = useState(() => loadCachedCaseFiles().length === 0);
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [clientLoadMessage, setClientLoadMessage] = useState("No clients found.");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CaseFile["status"]>("all");
  const [caseTypeFilter, setCaseTypeFilter] = useState("all");
  const [consultantFilter, setConsultantFilter] = useState("all");
  const [nextDateFilter, setNextDateFilter] = useState<"all" | "next7" | "next30">("all");
  const [expandedFilterSection, setExpandedFilterSection] = useState<string | null>(null);
  const [isFiltersPanelOpen, setIsFiltersPanelOpen] = useState(false);
  const [isNewCaseMenuOpen, setIsNewCaseMenuOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseFile | null>(null);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [isNewCaseDialogOpen, setIsNewCaseDialogOpen] = useState(false);
  const [isClientSelectOpen, setIsClientSelectOpen] = useState(false);
  const [newCaseStep, setNewCaseStep] = useState<NewCaseStep>(1);
  const [newCaseForm, setNewCaseForm] = useState<NewCaseForm>(createBlankCaseForm());
  const [isSavingCase, setIsSavingCase] = useState(false);
  const nextDateInputRef = useRef<HTMLInputElement | null>(null);
  const deadlineDateInputRef = useRef<HTMLInputElement | null>(null);

  const caseTypes = useMemo(() => Array.from(new Set(caseFiles.map((item) => item.caseType))), [caseFiles]);
  const consultants = useMemo(() => Array.from(new Set(caseFiles.map((item) => item.consultant).filter(Boolean))), [caseFiles]);

  const normalizeStatus = (value: string): CaseFile["status"] => {
    const allowed: CaseFile["status"][] = ["Active", "Pending", "Awaiting Documents", "Set Down", "Settled", "Closed", "Archived"];
    return allowed.includes(value as CaseFile["status"]) ? (value as CaseFile["status"]) : "Active";
  };

  const normalizePriority = (value: string | null | undefined): CaseFile["priority"] => {
    if (!value) return "Normal";
    return value.toLowerCase() === "urgent" ? "Urgent" : "Normal";
  };

  const fetchCaseFiles = useCallback(async () => {
    if (caseFiles.length === 0) {
      setIsCaseFilesLoading(true);
    }
    const { data, error } = await (supabase as any)
      .from("case_files")
      .select("*")
      .order("created_at", { ascending: false, nullsFirst: false });

    if (error) {
      setIsCaseFilesLoading(false);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    const rows: any[] = Array.isArray(data) ? data : [];
    const caseIds = rows.map((r) => r.id).filter(Boolean);
    const deadlineByCase = new Map<string, string>();

    if (caseIds.length > 0) {
      const { data: dateRows } = await (supabase as any)
        .from("case_dates")
        .select("case_file_id, date_type, date_value")
        .in("case_file_id", caseIds);
      (dateRows ?? []).forEach((d: any) => {
        if (d?.date_type === "Deadline Date" && d?.case_file_id) {
          deadlineByCase.set(d.case_file_id, d.date_value ?? "--");
        }
      });
    }

    const mapped: CaseFile[] = rows.map((row) => {
      const nextDate = row.next_date ?? "--";
      const deadlineDate = deadlineByCase.get(row.id) ?? "--";
      return {
        id: row.id,
        fileNo: row.file_number ?? "--",
        client: row.client_name ?? "--",
        parties: row.parties ?? "--",
        caseType: row.case_type ?? "--",
        forumVenue: row.forum ?? "--",
        nextDate,
        consultant: row.consultant ?? "--",
        status: normalizeStatus(row.status ?? "Active"),
        priority: normalizePriority(row.priority),
        lastUpdated: toIsoDate(row.last_updated ?? row.updated_at ?? row.created_at ?? new Date().toISOString()),
        caseTitle: row.parties ?? "--",
        subtype: row.case_subtype ?? "--",
        caseNumber: row.case_number ?? "--",
        employerRepresentative: "--",
        currentStage: row.current_stage ?? "--",
        shortDescription: row.short_description ?? "--",
        dates: {
          referralDate: "--",
          dismissalEventDate: "--",
          conciliationDate: "--",
          arbitrationDate: "--",
          labourCourtDate: "--",
          consultationDate: "--",
          nextActionDate: nextDate,
          deadlineDate,
        },
        notes: [],
        tasks: [],
        outcome: { outcomeType: "Pending", outcomeDate: "--", result: "Awaiting outcome", amount: "R 0.00", closingNote: "--", closedBy: "--", closedDate: "--" },
      };
    });

    setCaseFiles(mapped);
    setIsCaseFilesLoading(false);
  }, [caseFiles.length, toast]);

  useEffect(() => {
    const loadClients = async () => {
      const baseQuery = (supabase as any)
        .from("clients")
        .select("*");
      const { data, error } = await baseQuery
        .or("status.is.null,status.eq.active")
        .order("created_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false, nullsFirst: false });
      if (error) {
        setClientOptions([]);
        setClientLoadMessage(`Unable to load clients: ${error.message}`);
        return;
      }
      const mapped = (data ?? []).map((c: any) => ({
        id: c.id,
        label:
          (
            (c.registered_name ?? "").trim() ||
            (c.company_name ?? "").trim() ||
            (c.client_name ?? "").trim() ||
            ""
          ) +
          ((c.trading_as ?? c.client_surname ?? "").trim()
            ? ` (${(c.trading_as ?? c.client_surname ?? "").trim()})`
            : ""),
      }));
      const valid = mapped.filter((c) => c.label.trim().length > 0);
      if (valid.length > 0) {
        setClientOptions(valid);
        setClientLoadMessage("No clients found.");
        return;
      }
      setClientOptions([]);
      setClientLoadMessage("No clients found.");
    };
    void loadClients();
  }, []);

  useEffect(() => {
    void fetchCaseFiles();
  }, [fetchCaseFiles]);

  useEffect(() => {
    saveCachedCaseFiles(caseFiles);
  }, [caseFiles]);

  const getNextFileNumber = (caseType: string) => {
    const code = CASE_TYPE_CODE_MAP[caseType as keyof typeof CASE_TYPE_CODE_MAP];
    if (!code) return "";
    const maxSeq = caseFiles.reduce((max, c) => {
      const m = c.fileNo.match(/^CF\/([A-Z]{2})\/(\d{6})$/);
      if (!m) return max;
      if (m[1] !== code) return max;
      return Math.max(max, Number(m[2]));
    }, 0);
    return `CF/${code}/${String(maxSeq + 1).padStart(6, "0")}`;
  };

  const openNewCaseDialog = () => {
    setIsNewCaseMenuOpen(false);
    setNewCaseStep(1);
    setNewCaseForm(createBlankCaseForm());
    setIsNewCaseDialogOpen(true);
  };

  const isStepOneComplete = Boolean(
    newCaseForm.clientId.trim() &&
    newCaseForm.parties.trim() &&
    newCaseForm.caseType.trim(),
  );
  const isStepTwoComplete = Boolean(newCaseForm.currentStage.trim());
  const isStepThreeComplete = Boolean(
    newCaseForm.assignedConsultant.trim() &&
    newCaseForm.status.trim() &&
    newCaseForm.priority.trim(),
  );

  const handleNext = () => {
    if (newCaseStep === 1 && !isStepOneComplete) return;
    if (newCaseStep === 2 && !isStepTwoComplete) return;
    setNewCaseStep((prev) => (prev < 3 ? ((prev + 1) as NewCaseStep) : prev));
  };

  const filteredCaseFiles = useMemo(() => {
    const today = new Date();
    return caseFiles.filter((item) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        q.length === 0 ||
        item.fileNo.toLowerCase().includes(q) ||
        item.client.toLowerCase().includes(q) ||
        item.parties.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesType = caseTypeFilter === "all" || item.caseType === caseTypeFilter;
      const matchesConsultant = consultantFilter === "all" || item.consultant === consultantFilter;
      const next = item.nextDate ? new Date(item.nextDate) : null;
      const diffDays = next ? Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 9999;
      const matchesDate =
        nextDateFilter === "all" || (nextDateFilter === "next7" ? diffDays <= 7 : diffDays <= 30);
      return matchesSearch && matchesStatus && matchesType && matchesConsultant && matchesDate;
    });
  }, [caseFiles, caseTypeFilter, consultantFilter, nextDateFilter, searchQuery, statusFilter]);

  const toggleSelectCase = (id: string) => {
    setSelectedCaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllCases = () => {
    setSelectedCaseIds((prev) => {
      if (filteredCaseFiles.length > 0 && prev.size === filteredCaseFiles.length) {
        return new Set();
      }
      return new Set(filteredCaseFiles.map((c) => c.id));
    });
  };

  const handleDeleteSelectedCases = async () => {
    if (selectedCaseIds.size === 0) return;
    const ids = Array.from(selectedCaseIds);
    const { error } = await (supabase as any).from("case_files").delete().in("id", ids);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setSelectedCaseIds(new Set());
    await fetchCaseFiles();
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

  const handleCreateCase = async () => {
    if (!isStepOneComplete || !isStepTwoComplete || !isStepThreeComplete) return;
    if (!user?.id) {
      toast({ title: "Error", description: "You must be logged in to create a case file.", variant: "destructive" });
      return;
    }

    setIsSavingCase(true);
    try {
      const fileNumber = getNextFileNumber(newCaseForm.caseType.trim());
      const { data: insertedCase, error: caseError } = await (supabase as any)
        .from("case_files")
        .insert({
          user_id: user.id,
          client_id: newCaseForm.clientId.trim(),
          file_number: fileNumber,
          client_name: newCaseForm.clientName.trim(),
          parties: newCaseForm.parties.trim(),
          case_type: newCaseForm.caseType.trim(),
          case_subtype: null,
          forum: newCaseForm.forumVenue.trim() || null,
          case_number: newCaseForm.caseNumber.trim() || null,
          consultant: newCaseForm.assignedConsultant.trim(),
          current_stage: newCaseForm.currentStage.trim(),
          status: newCaseForm.status,
          priority: newCaseForm.priority,
          next_date: newCaseForm.nextDate || null,
          short_description: newCaseForm.shortDescription.trim() || null,
        })
        .select("id")
        .single();

      if (caseError) throw caseError;
      const caseFileId = insertedCase?.id;
      if (!caseFileId) throw new Error("Case file insert did not return an id.");

      const dateInserts: Array<{ case_file_id: string; date_type: string; date_value: string; description: string | null }> = [];
      if (newCaseForm.nextDate) {
        dateInserts.push({
          case_file_id: caseFileId,
          date_type: "Next Action Date",
          date_value: newCaseForm.nextDate,
          description: "Auto-created from New Case File form",
        });
      }
      if (newCaseForm.deadlineDate) {
        dateInserts.push({
          case_file_id: caseFileId,
          date_type: "Deadline Date",
          date_value: newCaseForm.deadlineDate,
          description: "Auto-created from New Case File form",
        });
      }
      if (dateInserts.length > 0) {
        const { error: datesError } = await (supabase as any).from("case_dates").insert(dateInserts);
        if (datesError) throw datesError;
      }

      if (newCaseForm.openingNote.trim()) {
        const { error: noteError } = await (supabase as any).from("case_notes").insert({
          case_file_id: caseFileId,
          note_type: "General Update",
          note_body: newCaseForm.openingNote.trim(),
          added_by: newCaseForm.assignedConsultant.trim() || null,
          follow_up_required: Boolean(newCaseForm.deadlineDate),
          follow_up_date: newCaseForm.deadlineDate || null,
        });
        if (noteError) throw noteError;
      }

      setIsNewCaseDialogOpen(false);
      setNewCaseForm(createBlankCaseForm());
      setNewCaseStep(1);
      await fetchCaseFiles();
      toast({ title: "Success", description: "Case file created successfully." });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message ?? "Failed to create case file.", variant: "destructive" });
    } finally {
      setIsSavingCase(false);
    }
  };

  const newCaseDropdownItemStyle =
    "!rounded-none gap-2 cursor-pointer text-[11px] text-slate-700 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[highlighted]:bg-[#3eca44]/10 data-[highlighted]:text-[#2f9f35]";
  const newCaseDropdownContentStyle = "w-36 text-[11px] !rounded-t-none !rounded-b-[4px] border-t-0 !p-0";
  const newCaseButtonStyle =
    "h-8 w-36 justify-between rounded-[4px] px-3 text-[11px] inline-flex items-center border border-[#3eca44] bg-white text-[#3eca44] hover:bg-[#3eca44] hover:text-white data-[state=open]:rounded-b-none data-[state=open]:border-[#3eca44] data-[state=open]:bg-[#3eca44] data-[state=open]:text-white";
  const modalInputClass =
    "h-[34px] border-[0.5px] border-slate-300 text-[11px] placeholder:text-[11px] focus:placeholder:text-transparent hover:border-slate-500 focus:border-slate-300 focus-visible:border-slate-300 focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 focus-visible:ring-offset-0 focus:outline-none focus-visible:outline-none";
  const modalSelectClass =
    "h-[34px] border-[0.5px] border-slate-300 text-[11px] hover:border-slate-500 focus:border-slate-300 focus-visible:border-slate-300 focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 focus-visible:ring-offset-0 focus:outline-none focus-visible:outline-none";
  const addModalDropdownToneClass =
    "bg-white border-slate-300 hover:border-slate-500 data-[state=open]:border-black data-[state=open]:bg-white";
  const addModalSelectItemClass =
    "text-[11px] text-slate-700 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[highlighted]:bg-[#3eca44]/10 data-[highlighted]:text-[#2f9f35] [&_svg]:!text-[#2f9f35]";

  return (
    <DashboardLayout>
      <div className="space-y-0 -m-6">
        <div className="border border-slate-300 border-r-0 bg-white shadow-sm h-[calc(100dvh-var(--app-header-height,5rem))] pb-0">
          <div className="flex h-full flex-col">
            <div className="pl-4 pr-4 pt-1">
              <div className="pt-5 pb-2">
                <h1 className="text-4xl font-normal text-slate-900 -ml-1">Case Files</h1>
                <p className="text-xs text-slate-600 mt-2">Manage active legal matters, hearings, consultations and representation files.</p>
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
                            placeholder="Please type in case, client or party name"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`h-8 rounded-sm border border-slate-200 bg-white !text-[11px] font-semibold shadow-sm transition-colors placeholder:!text-[11px] hover:border-[#3eca44] focus-visible:!border focus-visible:!border-black focus-visible:ring-0 group-hover:border-[#3eca44] ${searchQuery.trim().length > 0 ? "pr-20" : "pr-9"}`}
                          />
                          {searchQuery.trim().length > 0 ? (
                            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-500 hover:text-[#2f9f35] hover:underline" onClick={() => setSearchQuery("")}>Clear</button>
                          ) : (
                            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                          )}
                        </div>
                        <p className="text-[11px] font-medium text-slate-500 whitespace-nowrap sm:self-end">
                          <span className="text-slate-900">{filteredCaseFiles.length}</span> active case files
                        </p>
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        {selectedCaseIds.size > 0 ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleDeleteSelectedCases}
                            className="h-8 w-24 rounded px-3 text-[11px] inline-flex items-center justify-center border border-rose-500 bg-white text-rose-600 hover:bg-rose-600 hover:text-white"
                          >
                            Delete ({selectedCaseIds.size})
                          </Button>
                        ) : null}
                        <Popover open={isFiltersPanelOpen} onOpenChange={(open) => { setIsFiltersPanelOpen(open); if (!open) setExpandedFilterSection(null); }}>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" className="h-8 w-24 justify-between rounded px-3 text-[11px] inline-flex items-center border border-slate-200 bg-white transition-colors hover:border-[#3eca44] hover:bg-white data-[state=open]:rounded-b-none data-[state=open]:border-[#3eca44]">
                              <span>Filter</span>
                              <ChevronDown className={`h-4 w-4 transition-transform ${isFiltersPanelOpen ? "rotate-180" : ""}`} />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent side="bottom" align="end" sideOffset={0} className="w-[260px] rounded-t-none border border-slate-200 border-t-0 bg-white p-0 shadow-lg">
                            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                              <span className="text-[12px] font-semibold text-slate-800">Filter</span>
                              <button type="button" className="text-[10px] font-semibold uppercase tracking-wide text-[#2f9f35] hover:underline" onClick={() => { setStatusFilter("all"); setCaseTypeFilter("all"); setConsultantFilter("all"); setNextDateFilter("all"); setIsFiltersPanelOpen(false); }}>
                                Clear
                              </button>
                            </div>
                            <div className="divide-y divide-slate-200">
                              {["status", "type", "consultant", "date"].map((section) => (
                                <div key={section}>
                                  <button type="button" className={`flex h-9 w-full items-center justify-between px-3 text-left text-[11px] font-semibold text-slate-800 hover:bg-slate-100 ${expandedFilterSection === section ? "bg-slate-100" : ""}`} onClick={() => setExpandedFilterSection((prev) => (prev === section ? null : section))}>
                                    <span>{section === "status" ? "Status" : section === "type" ? "Case Type" : section === "consultant" ? "Consultant" : "Next Date"}</span>
                                    <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform ${expandedFilterSection === section ? "rotate-180" : ""}`} />
                                  </button>
                                  {expandedFilterSection === section && (
                                    <div className="px-3 pb-2">
                                      {(section === "status"
                                        ? ["all", ...STATUS_OPTIONS]
                                        : section === "type"
                                          ? ["all", ...caseTypes]
                                          : section === "consultant"
                                            ? ["all", ...consultants]
                                            : ["all", "next7", "next30"]
                                      ).map((value) => {
                                        const selected = section === "status" ? statusFilter === value : section === "type" ? caseTypeFilter === value : section === "consultant" ? consultantFilter === value : nextDateFilter === value;
                                        const label = value === "all" ? "All" : value === "next7" ? "Next 7 days" : value === "next30" ? "Next 30 days" : value;
                                        return (
                                          <button
                                            key={value}
                                            type="button"
                                            className="flex h-8 w-full items-center justify-between text-[11px] text-slate-700 hover:bg-[#3eca44]/10 hover:text-[#2f9f35]"
                                            onClick={() => {
                                              if (section === "status") setStatusFilter(value as "all" | CaseFile["status"]);
                                              if (section === "type") setCaseTypeFilter(value);
                                              if (section === "consultant") setConsultantFilter(value);
                                              if (section === "date") setNextDateFilter(value as "all" | "next7" | "next30");
                                              setIsFiltersPanelOpen(false);
                                            }}
                                          >
                                            <span>{label}</span>
                                            {selected && <Check className="h-3.5 w-3.5 text-[#2f9f35]" />}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <DropdownMenu open={isNewCaseMenuOpen} onOpenChange={setIsNewCaseMenuOpen}>
                          <DropdownMenuTrigger asChild>
                            <Button className={newCaseButtonStyle}>
                              <span className="truncate">New Case</span>
                              <ChevronDown className="h-4 w-4 text-current" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" sideOffset={0} className={newCaseDropdownContentStyle}>
                            <DropdownMenuItem onSelect={(event) => { event.preventDefault(); openNewCaseDialog(); }} className={newCaseDropdownItemStyle}>
                              <Plus className="h-3.5 w-3.5" />
                              New Case File
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pl-4 pr-4 pb-2 flex-1 min-h-0 overflow-hidden">
                    <div className="relative overflow-hidden rounded-sm border border-slate-200">
                      <div className="grid grid-cols-[0.45fr_1.2fr_1.5fr_1.9fr_1.3fr_1.4fr_1fr_1fr_0.95fr] items-center gap-2 border-b bg-[#2D4256] pl-1 pr-3 py-3 text-xs font-semibold text-white">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            indicator="x"
                            checked={
                              filteredCaseFiles.length > 0 && selectedCaseIds.size === filteredCaseFiles.length
                                ? true
                                : selectedCaseIds.size > 0
                                  ? "indeterminate"
                                  : false
                            }
                            onCheckedChange={toggleSelectAllCases}
                            aria-label="Select all case files"
                            className="h-3 w-3 rounded-[2px] border-white/80 bg-white text-white data-[state=checked]:border-[#3eca44] data-[state=checked]:bg-[#3eca44]"
                          />
                        </div>
                        <div>File No.</div><div>Client</div><div>Parties</div><div>Case Type</div><div>Forum / Venue</div><div>Next Date</div><div>Consultant</div><div>Status</div>
                      </div>
                      <div className="divide-y overflow-auto min-h-0" style={{ height: "calc(100dvh - var(--app-header-height,5rem) - 300px)" }}>
                        {isCaseFilesLoading ? (
                          <div className="px-4 py-6 text-xs text-slate-500">Loading case files...</div>
                        ) : filteredCaseFiles.length === 0 ? (
                          <div className="px-4 py-6 text-xs text-slate-500">No case files found.</div>
                        ) : (
                          filteredCaseFiles.map((caseFile) => (
                            <div key={caseFile.id} className="grid w-full grid-cols-[0.45fr_1.2fr_1.5fr_1.9fr_1.3fr_1.4fr_1fr_1fr_0.95fr] items-center gap-2 pl-1 pr-3 py-2 text-left text-xs hover:bg-[#3eca44]/5">
                              <div className="flex items-center justify-center">
                                <Checkbox
                                  indicator="x"
                                  checked={selectedCaseIds.has(caseFile.id)}
                                  onCheckedChange={() => toggleSelectCase(caseFile.id)}
                                  aria-label={`Select ${caseFile.fileNo}`}
                                  className="h-3 w-3 rounded-[2px] border-slate-400 text-white data-[state=checked]:border-[#3eca44] data-[state=checked]:bg-[#3eca44]"
                                />
                              </div>
                              <button type="button" onClick={() => setSelectedCase(caseFile)} className="font-medium text-left hover:underline">{caseFile.fileNo}</button>
                              <div>{caseFile.client}</div>
                              <div>{caseFile.parties}</div>
                              <div>{caseFile.caseType}</div>
                              <div>{caseFile.forumVenue}</div>
                              <div>{caseFile.nextDate}</div>
                              <div>{caseFile.consultant}</div>
                              <div><Badge className="border border-slate-300 bg-white text-slate-700">{caseFile.status}</Badge></div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>
          </div>
        </div>
      </div>

      <Dialog open={isNewCaseDialogOpen} onOpenChange={setIsNewCaseDialogOpen}>
      <DialogContent className="w-[94vw] max-w-[560px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden">
          <div className="relative">
            <div className="absolute inset-x-0 top-0 flex h-[46px] items-center justify-between px-4">
              <div className="flex items-center gap-2 pl-2">
                <User className="h-4 w-4 text-white" />
                <DialogTitle className="text-sm font-semibold text-white">New Case File</DialogTitle>
              </div>
              <DialogClose asChild>
                <button type="button" className="text-white hover:text-white/80">
                  <X className="h-4 w-4" />
                </button>
              </DialogClose>
            </div>
            <div className="mt-[46px] bg-white px-6 pb-6 pt-2">
              <form
                className="space-y-4 pt-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreateCase();
                }}
              >
                <div className="mx-auto w-full max-w-[320px] py-4">
                  <div className="relative grid grid-cols-3 items-start">
                    <div className="pointer-events-none absolute left-[calc(16.6667%+26px)] top-[10px] h-[2px] w-[calc(33.3333%-52px)] bg-slate-300" />
                    <div className="pointer-events-none absolute left-[calc(50%+26px)] top-[10px] h-[2px] w-[calc(33.3333%-52px)] bg-slate-300" />
                    {(isStepOneComplete || newCaseStep > 1) && <div className="pointer-events-none absolute left-[calc(16.6667%+26px)] top-[10px] h-[2px] w-[calc(33.3333%-52px)] bg-[#3eca44]" />}
                    {(isStepTwoComplete || newCaseStep > 2) && <div className="pointer-events-none absolute left-[calc(50%+26px)] top-[10px] h-[2px] w-[calc(33.3333%-52px)] bg-[#3eca44]" />}
                    {[{ step: 1 as const, label: "Case Identity" }, { step: 2 as const, label: "Forum & Dates" }, { step: 3 as const, label: "Allocation" }].map((item) => {
                      const active = item.step === newCaseStep;
                      const complete = item.step === 1 ? isStepOneComplete : item.step === 2 ? isStepTwoComplete : false;
                      return (
                        <button key={item.step} type="button" onClick={() => setNewCaseStep(item.step)} className="z-10 flex flex-col items-center text-center cursor-pointer">
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${complete || active ? "bg-[#3eca44] text-white" : "bg-slate-500 text-white"}`}>
                            {complete ? <Check className="h-3 w-3" /> : item.step}
                          </span>
                          <span className="mt-3 text-[10px] font-semibold text-slate-700">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="h-[420px] space-y-4 overflow-y-auto pr-1">
                  {newCaseStep === 1 && (
                    <>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400">Client <span className="text-red-600">*</span></p>
                        <Popover open={isClientSelectOpen} onOpenChange={setIsClientSelectOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className={`${modalSelectClass} ${addModalDropdownToneClass} w-full justify-between px-3 hover:bg-white hover:text-slate-700`}
                            >
                              <span className={`truncate text-left ${newCaseForm.clientName ? "" : "text-slate-400"}`}>
                                {newCaseForm.clientName || "Please select client"}
                              </span>
                              <ChevronDown className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                              <CommandInput placeholder="Search client name..." className="h-8 text-[11px]" />
                              <CommandList className="h-[420px]">
                                <CommandEmpty className="py-3 text-[11px] text-slate-500 px-2 text-center">{clientLoadMessage}</CommandEmpty>
                                <CommandGroup>
                                  {clientOptions.map((client) => (
                                    <CommandItem
                                      key={client.id}
                                      value={client.label}
                                      className="text-[11px] text-slate-700 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[selected=true]:bg-[#3eca44]/10 data-[selected=true]:text-[#2f9f35]"
                                      onSelect={() => {
                                        setNewCaseForm((prev) => ({ ...prev, clientId: client.id, clientName: client.label }));
                                        setIsClientSelectOpen(false);
                                      }}
                                    >
                                      {client.label}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400">Case Type <span className="text-red-600">*</span></p>
                        <Select
                          value={newCaseForm.caseType || undefined}
                          onValueChange={(value) =>
                            setNewCaseForm((p) => ({
                              ...p,
                              caseType: value,
                              fileNumber: getNextFileNumber(value),
                            }))
                          }
                        >
                          <SelectTrigger className={`${modalSelectClass} ${addModalDropdownToneClass}`}><SelectValue placeholder="Please select case type" /></SelectTrigger>
                          <SelectContent className="text-[11px]">{CASE_TYPE_OPTIONS.map((opt) => <SelectItem key={opt} value={opt} className={addModalSelectItemClass}>{opt}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400">Parties <span className="text-red-600">*</span></p>
                        <Input className={`${modalInputClass} !text-[11px]`} value={newCaseForm.parties} onChange={(e) => setNewCaseForm((p) => ({ ...p, parties: e.target.value }))} placeholder="ABC Manufacturing (Pty) Ltd // John Smith" />
                      </div>
                    </>
                  )}

                  {newCaseStep === 2 && (
                    <>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400">Forum / Venue</p>
                        <Input className={modalInputClass} value={newCaseForm.forumVenue} onChange={(e) => setNewCaseForm((p) => ({ ...p, forumVenue: e.target.value }))} placeholder="CCMA Johannesburg, MIBCO, Teams..." />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400">Case Number / Reference</p>
                        <Input className={modalInputClass} value={newCaseForm.caseNumber} onChange={(e) => setNewCaseForm((p) => ({ ...p, caseNumber: e.target.value }))} placeholder="Please insert case number" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400">Current Stage <span className="text-red-600">*</span></p>
                        <Select value={newCaseForm.currentStage || undefined} onValueChange={(value) => setNewCaseForm((p) => ({ ...p, currentStage: value }))}>
                          <SelectTrigger className={`${modalSelectClass} ${addModalDropdownToneClass}`}><SelectValue placeholder="Please select stage" /></SelectTrigger>
                          <SelectContent className="text-[11px]">{CURRENT_STAGE_OPTIONS.map((opt) => <SelectItem key={opt} value={opt} className={addModalSelectItemClass}>{opt}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400">Next Date</p>
                        <Input
                          className={modalInputClass}
                          type="text"
                          readOnly
                          placeholder="Please select a date"
                          value={newCaseForm.nextDate ? formatDisplayDate(newCaseForm.nextDate) : ""}
                          onClick={() => openDatePicker(nextDateInputRef.current)}
                          onFocus={() => openDatePicker(nextDateInputRef.current)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openDatePicker(nextDateInputRef.current);
                            }
                          }}
                        />
                        <input
                          ref={nextDateInputRef}
                          type="date"
                          value={newCaseForm.nextDate}
                          onChange={(e) => setNewCaseForm((p) => ({ ...p, nextDate: e.target.value }))}
                          className="sr-only"
                          aria-hidden="true"
                          tabIndex={-1}
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400">Deadline Date</p>
                        <Input
                          className={modalInputClass}
                          type="text"
                          readOnly
                          placeholder="Please select a date"
                          value={newCaseForm.deadlineDate ? formatDisplayDate(newCaseForm.deadlineDate) : ""}
                          onClick={() => openDatePicker(deadlineDateInputRef.current)}
                          onFocus={() => openDatePicker(deadlineDateInputRef.current)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openDatePicker(deadlineDateInputRef.current);
                            }
                          }}
                        />
                        <input
                          ref={deadlineDateInputRef}
                          type="date"
                          value={newCaseForm.deadlineDate}
                          onChange={(e) => setNewCaseForm((p) => ({ ...p, deadlineDate: e.target.value }))}
                          className="sr-only"
                          aria-hidden="true"
                          tabIndex={-1}
                        />
                      </div>
                    </>
                  )}

                  {newCaseStep === 3 && (
                    <>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400">Assigned Consultant <span className="text-red-600">*</span></p>
                        <Input className={modalInputClass} value={newCaseForm.assignedConsultant} onChange={(e) => setNewCaseForm((p) => ({ ...p, assignedConsultant: e.target.value }))} placeholder="Please insert consultant" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400">Status <span className="text-red-600">*</span></p>
                        <Select value={newCaseForm.status} onValueChange={(value) => setNewCaseForm((p) => ({ ...p, status: value as CaseFile["status"] }))}>
                          <SelectTrigger className={`${modalSelectClass} ${addModalDropdownToneClass}`}><SelectValue /></SelectTrigger>
                          <SelectContent className="text-[11px]">{STATUS_OPTIONS.map((opt) => <SelectItem key={opt} value={opt} className={addModalSelectItemClass}>{opt}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400">Priority <span className="text-red-600">*</span></p>
                        <Select value={newCaseForm.priority} onValueChange={(value) => setNewCaseForm((p) => ({ ...p, priority: value as CaseFile["priority"] }))}>
                          <SelectTrigger className={`${modalSelectClass} ${addModalDropdownToneClass}`}><SelectValue /></SelectTrigger>
                          <SelectContent className="text-[11px]">{PRIORITY_OPTIONS.map((opt) => <SelectItem key={opt} value={opt} className={addModalSelectItemClass}>{opt}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400">Short Description</p>
                        <Textarea className="min-h-[76px] text-[11px] border-[0.5px] border-slate-300 focus:placeholder:text-transparent hover:border-slate-500 focus:border-slate-300 focus-visible:border-slate-300 focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 focus-visible:ring-offset-0 focus:outline-none focus-visible:outline-none" value={newCaseForm.shortDescription} onChange={(e) => setNewCaseForm((p) => ({ ...p, shortDescription: e.target.value }))} placeholder="Please type a short description of the case" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400">Opening Note</p>
                        <Textarea className="min-h-[76px] text-[11px] border-[0.5px] border-slate-300 focus:placeholder:text-transparent hover:border-slate-500 focus:border-slate-300 focus-visible:border-slate-300 focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 focus-visible:ring-offset-0 focus:outline-none focus-visible:outline-none" value={newCaseForm.openingNote} onChange={(e) => setNewCaseForm((p) => ({ ...p, openingNote: e.target.value }))} placeholder="Please type the first file note or instruction received" />
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-6 grid grid-cols-3 items-center border-t border-dashed border-muted/60 pt-4">
                  <div className="justify-self-start">
                    {newCaseStep > 1 && (
                      <Button type="button" variant="outline" className="h-[28px] w-[84px] rounded border-[#3eca44] px-3 text-xs text-[#3eca44] hover:bg-transparent hover:text-[#3eca44]" onClick={() => setNewCaseStep((prev) => (prev === 1 ? prev : ((prev - 1) as NewCaseStep)))}>
                        Back
                      </Button>
                    )}
                  </div>
                  <div className="justify-self-center">
                    <Button type="button" variant="ghost" className="h-[30px] rounded border-0 px-3 text-xs text-slate-500 shadow-none hover:bg-transparent hover:text-slate-600 hover:underline" onClick={() => setNewCaseForm(createBlankCaseForm())}>
                      Clear
                    </Button>
                  </div>
                  <div className="justify-self-end">
                    {newCaseStep < 3 ? (
                      <Button type="button" className="h-[28px] w-[84px] rounded bg-[#3eca44] px-3 text-xs text-white hover:bg-[#34b73b]" onClick={handleNext} disabled={(newCaseStep === 1 && !isStepOneComplete) || (newCaseStep === 2 && !isStepTwoComplete)}>
                        Next
                      </Button>
                    ) : (
                      <Button type="submit" className="h-[30px] w-[120px] rounded bg-[#3eca44] px-3 text-xs text-white hover:bg-[#34b73b]" disabled={isSavingCase || !isStepOneComplete || !isStepTwoComplete || !isStepThreeComplete}>
                        {isSavingCase ? "Saving..." : "Create Case File"}
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selectedCase && (
        <div className="fixed inset-0 z-50">
          <button type="button" className="absolute inset-0 bg-slate-900/65" aria-label="Close case details" onClick={() => setSelectedCase(null)} />
          <div className="absolute inset-0 flex items-center justify-center">
            <section className="relative z-10 w-[94vw] max-w-[980px] h-[92vh] rounded-sm bg-[#2D4256] shadow-2xl overflow-hidden border-0">
              <div className="absolute inset-x-0 top-0 flex h-[46px] items-center justify-between px-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-sm font-semibold text-white">Case File</h2>
                </div>
                <button type="button" className="text-white hover:text-white/80" onClick={() => setSelectedCase(null)}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-[46px] h-[calc(92vh-46px)] overflow-y-auto bg-white px-4 pb-4 pt-4">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">{selectedCase.caseTitle}</h2>
                      <p className="text-xs text-slate-500">{selectedCase.fileNo}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge className="border border-slate-300 bg-white text-slate-700 hover:bg-white focus-visible:ring-0">{selectedCase.status}</Badge>
                        <Badge className="border border-slate-300 bg-white text-slate-700 hover:bg-white focus-visible:ring-0">{selectedCase.caseType}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" className="h-8 text-[11px] border-slate-300 bg-white text-slate-700 hover:bg-white hover:border-[#3eca44] hover:text-[#2f9f35] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0">Edit Case</Button>
                      <Button variant="outline" className="h-8 text-[11px] border-slate-300 bg-white text-slate-700 hover:bg-white hover:border-[#3eca44] hover:text-[#2f9f35] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0">Add Note</Button>
                      <Button variant="outline" className="h-8 text-[11px] border-slate-300 bg-white text-slate-700 hover:bg-white hover:border-[#3eca44] hover:text-[#2f9f35] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0">Close Case</Button>
                    </div>
                  </div>

                  <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="grid w-full grid-cols-6 bg-slate-100">
                      <TabsTrigger value="overview" className="text-[11px] data-[state=inactive]:text-slate-700 data-[state=inactive]:hover:text-[#2f9f35] data-[state=active]:bg-white data-[state=active]:text-[#2f9f35] data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Overview</TabsTrigger>
                      <TabsTrigger value="dates" className="text-[11px] data-[state=inactive]:text-slate-700 data-[state=inactive]:hover:text-[#2f9f35] data-[state=active]:bg-white data-[state=active]:text-[#2f9f35] data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Dates</TabsTrigger>
                      <TabsTrigger value="notes" className="text-[11px] data-[state=inactive]:text-slate-700 data-[state=inactive]:hover:text-[#2f9f35] data-[state=active]:bg-white data-[state=active]:text-[#2f9f35] data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Notes</TabsTrigger>
                      <TabsTrigger value="documents" className="text-[11px] data-[state=inactive]:text-slate-700 data-[state=inactive]:hover:text-[#2f9f35] data-[state=active]:bg-white data-[state=active]:text-[#2f9f35] data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Documents</TabsTrigger>
                      <TabsTrigger value="tasks" className="text-[11px] data-[state=inactive]:text-slate-700 data-[state=inactive]:hover:text-[#2f9f35] data-[state=active]:bg-white data-[state=active]:text-[#2f9f35] data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Tasks</TabsTrigger>
                      <TabsTrigger value="outcome" className="text-[11px] data-[state=inactive]:text-slate-700 data-[state=inactive]:hover:text-[#2f9f35] data-[state=active]:bg-white data-[state=active]:text-[#2f9f35] data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Outcome</TabsTrigger>
                    </TabsList>
                    <TabsContent value="overview" className="mt-4"><div className="grid gap-2 text-xs sm:grid-cols-2">{[["File Number", selectedCase.fileNo], ["Client", selectedCase.client], ["Opposing Party / Employee", selectedCase.parties.split("//")[1]?.trim() ?? "--"], ["Matter Type", selectedCase.caseType], ["Subtype", selectedCase.subtype], ["Forum", selectedCase.forumVenue], ["Case Number", selectedCase.caseNumber], ["Assigned Consultant", selectedCase.consultant], ["Employer Representative", selectedCase.employerRepresentative], ["Current Stage", selectedCase.currentStage], ["Status", selectedCase.status], ["Priority", selectedCase.priority], ["Short Description", selectedCase.shortDescription]].map(([label, value]) => <div key={label} className="rounded border border-slate-200 bg-slate-50 p-2"><p className="text-[10px] text-slate-500">{label}</p><p className="font-medium text-slate-900">{value}</p></div>)}</div></TabsContent>
                    <TabsContent value="dates" className="mt-4"><div className="grid gap-2 text-xs sm:grid-cols-2">{[["Referral Date", selectedCase.dates.referralDate], ["Date of Dismissal / Event", selectedCase.dates.dismissalEventDate], ["Conciliation Date", selectedCase.dates.conciliationDate], ["Arbitration Date", selectedCase.dates.arbitrationDate], ["Labour Court Date", selectedCase.dates.labourCourtDate], ["Consultation Date", selectedCase.dates.consultationDate], ["Next Action Date", selectedCase.dates.nextActionDate], ["Deadline Date", selectedCase.dates.deadlineDate]].map(([label, value]) => <div key={label} className="rounded border border-slate-200 bg-slate-50 p-2"><p className="text-[10px] text-slate-500">{label}</p><p className="font-medium text-slate-900">{value}</p></div>)}</div></TabsContent>
                    <TabsContent value="notes" className="mt-4 space-y-2"><Button variant="outline" className="h-8 text-[11px] border-slate-300 bg-white text-slate-700 hover:bg-white hover:border-[#3eca44] hover:text-[#2f9f35] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0">Add Note</Button>{selectedCase.notes.map((note, idx) => <div key={idx} className="rounded border border-slate-200 bg-slate-50 p-2 text-xs"><p className="font-semibold text-slate-900">{note.noteType}</p><p className="text-slate-500">{note.date} | {note.addedBy} | Follow-up: {note.followUpDate}</p><p className="mt-1 text-slate-800">{note.body}</p></div>)}</TabsContent>
                    <TabsContent value="documents" className="mt-4"><div className="grid gap-2 text-xs sm:grid-cols-2">{["Referral Forms", "Notices of Set Down", "Employer Documents", "Employee Documents", "Witness Statements", "Disciplinary Documents", "Bundle / Index", "Settlement Agreement", "Award / Ruling / Order", "Correspondence"].map((doc) => <div key={doc} className="rounded border border-slate-200 bg-slate-50 p-2"><p className="font-medium text-slate-900">{doc}</p><p className="text-[10px] text-slate-500">No documents uploaded</p></div>)}</div></TabsContent>
                    <TabsContent value="tasks" className="mt-4 space-y-2">{selectedCase.tasks.map((task, idx) => <div key={idx} className="rounded border border-slate-200 bg-slate-50 p-2 text-xs"><p className="font-medium text-slate-900">{task.title}</p><p className="text-slate-500">Assigned to: {task.assignedTo} | Due: {task.dueDate}</p><p className="text-slate-700">Priority: {task.priority} | Status: {task.status}</p></div>)}</TabsContent>
                    <TabsContent value="outcome" className="mt-4"><div className="grid gap-2 text-xs sm:grid-cols-2">{[["Outcome Type", selectedCase.outcome.outcomeType], ["Outcome Date", selectedCase.outcome.outcomeDate], ["Result", selectedCase.outcome.result], ["Amount Awarded/Settled", selectedCase.outcome.amount], ["Closing Note", selectedCase.outcome.closingNote], ["Closed By", selectedCase.outcome.closedBy], ["Closed Date", selectedCase.outcome.closedDate]].map(([label, value]) => <div key={label} className="rounded border border-slate-200 bg-slate-50 p-2"><p className="text-[10px] text-slate-500">{label}</p><p className="font-medium text-slate-900">{value}</p></div>)}</div></TabsContent>
                  </Tabs>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default CaseFiles;
