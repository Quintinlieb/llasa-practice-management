import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FolderPlusIcon } from "@heroicons/react/24/outline";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type CaseNote = { date: string; addedBy: string; noteType: string; body: string; followUpDate: string };
type CaseTask = { title: string; assignedTo: string; dueDate: string; priority: "Low" | "Medium" | "High"; status: string };
type CaseOutcome = { outcomeType: string; outcomeDate: string; result: string; amount: string; closingNote: string; closedBy: string; closedDate: string };
type CaseFile = {
  id: string;
  clientId: string;
  fileNo: string;
  client: string;
  parties: string;
  caseType: string;
  forumVenue: string;
  nextDate: string;
  consultant: string;
  status: "Active" | "Pending" | "Awaiting Documents" | "Set Down" | "Postponed" | "Settled" | "Closed" | "Archived";
  priority: "Low" | "Medium" | "High" | "Urgent";
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
type ConsultantOption = { id: string; label: string };
type NewCaseStep = 1 | 2 | 3;
type CaseDetailsTab = "overview" | "dates" | "notes" | "documents" | "outcome";
type NewCaseForm = {
  clientId: string;
  clientName: string;
  fileNumber: string;
  parties: string;
  caseType: string;
  subtype: string;
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
type CaseEditForm = {
  parties: string;
  caseType: string;
  subtype: string;
  forumVenue: string;
  caseNumber: string;
  assignedConsultant: string;
  status: CaseFile["status"];
  priority: CaseFile["priority"];
  shortDescription: string;
  dates: Record<string, string>;
  outcome: CaseOutcome;
};
const caseFilesTableCacheKey = "case-files:table-cache";
const CASE_FILES_TABLE_PAGE_SIZE = 25;

const companyTypeSuffixByValue: Record<string, string> = {
  "Private Company ((Pty) Ltd)": "(Pty) Ltd",
  "Public Company (Ltd)": "Ltd",
  "Personal Liability Company (Inc.)": "Inc.",
  "State-Owned Company (SOC Ltd)": "SOC Ltd",
  "Non-Profit Company (NPC)": "NPC",
  "Close Corporation (CC)": "CC",
  "Co-operative (Co-op)": "Co-op",
  "Sole Proprietor (SP)": "SP",
  "Partnership (Partnership)": "Partnership",
  "Business Trust (Trust)": "Trust",
};
const appendCompanyTypeSuffix = (registeredName: string, companyType: string) => {
  const suffix = companyTypeSuffixByValue[companyType] || "";
  if (!suffix) return registeredName;
  const normalizedName = registeredName.toLowerCase();
  const normalizedSuffix = suffix.toLowerCase();
  if (normalizedName.endsWith(normalizedSuffix)) return registeredName;
  return `${registeredName} ${suffix}`;
};
const buildMatterClientLabel = (registeredName: unknown, companyType: unknown, tradingAs: unknown) => {
  const registered = String(registeredName ?? "").trim();
  const type = String(companyType ?? "").trim();
  const trading = String(tradingAs ?? "").trim();
  const registeredWithType = registered ? appendCompanyTypeSuffix(registered, type) : "";
  if (
    registeredWithType &&
    trading &&
    trading.toLowerCase() !== registered.toLowerCase() &&
    trading.toLowerCase() !== registeredWithType.toLowerCase()
  ) {
    return `${registeredWithType} t/a ${trading}`;
  }
  return registeredWithType || trading || "";
};
const getMatterClientDisplayName = (value: unknown) => {
  const label = String(value ?? "").trim();
  if (!label) return "--";
  const tradingAsIndex = label.toLowerCase().indexOf(" t/a ");
  if (tradingAsIndex >= 0) {
    const tradingAs = label.slice(tradingAsIndex + 5).trim();
    return tradingAs || label;
  }
  return label;
};

const CASE_TYPE_OPTIONS = [
  "Hearing",
  "Consultation",
  "CCMA",
  "Bargaining Council",
  "Wage Negotiations",
  "Labour Court",
] as const;
const NEW_MATTER_OPTIONS: Array<{ label: string; caseType: (typeof CASE_TYPE_OPTIONS)[number] }> = [
  { label: "Hearing", caseType: "Hearing" },
  { label: "Consultation", caseType: "Consultation" },
  { label: "CCMA", caseType: "CCMA" },
  { label: "Bargaining Council", caseType: "Bargaining Council" },
  { label: "Wage Negotiations", caseType: "Wage Negotiations" },
  { label: "Labour Court", caseType: "Labour Court" },
];
const SUBTYPE_NONE = "None";
const CASE_TYPE_SUBTYPE_OPTIONS: Partial<Record<(typeof CASE_TYPE_OPTIONS)[number], readonly string[]>> = {
  Hearing: ["Discipline", "Incapacity (performance)", "Incapacity (ill health)", "Grievance"],
  Consultation: ["General", "Grievance", "Performance", "Retrenchment", "Case Preparation", "Trade Union"],
  CCMA: ["Conciliation", "In Limine", "Con/Arb", "Arbitration"],
  "Bargaining Council": ["Conciliation", "In Limine", "Con/Arb", "Arbitration"],
};
const STATUS_OPTIONS: CaseFile["status"][] = ["Active", "Pending", "Awaiting Documents", "Set Down", "Postponed", "Settled", "Closed", "Archived"];
const PRIORITY_OPTIONS: CaseFile["priority"][] = ["Low", "Medium", "High", "Urgent"];
const OUTCOME_TYPE_OPTIONS = ["Dismissal Upheld", "Settlement", "Award Issued", "Case Withdrawn", "Matter Closed", "Consultation Completed", "Hearing Finalised"] as const;

const getSubtypeOptions = (caseType: string) => CASE_TYPE_SUBTYPE_OPTIONS[caseType as (typeof CASE_TYPE_OPTIONS)[number]] ?? [];
const shouldHideSubtype = (caseType: string) => caseType === "Wage Negotiations" || caseType === "Labour Court";
const getSubtypeValueForCaseType = (caseType: string, currentSubtype = "") => {
  if (shouldHideSubtype(caseType)) return SUBTYPE_NONE;
  const options = getSubtypeOptions(caseType);
  return options.includes(currentSubtype) ? currentSubtype : "";
};
const getScheduledDateLabel = (caseType: string) => {
  const type = String(caseType || "").trim();
  return type ? `${type} Date` : "Scheduled Date";
};
const isVisibleReadOnlyValue = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  return Boolean(
    normalized &&
    normalized !== "--" &&
    normalized !== "None" &&
    normalized !== "Pending" &&
    normalized !== "Awaiting outcome" &&
    normalized !== "R 0.00",
  );
};
const chunkItems = <T,>(items: T[], size: number) => {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
};

const createBlankCaseForm = (): NewCaseForm => ({
  clientId: "",
  clientName: "",
  fileNumber: "",
  parties: "",
  caseType: "",
  subtype: "",
  forumVenue: "",
  caseNumber: "",
  currentStage: "New File",
  nextDate: "",
  deadlineDate: "",
  assignedConsultant: "",
  status: "Active",
  priority: "Medium",
  shortDescription: "",
  openingNote: "",
});
const createCaseEditForm = (caseFile: CaseFile): CaseEditForm => ({
  parties: caseFile.parties === "--" ? "" : caseFile.parties,
  caseType: caseFile.caseType === "--" ? "" : caseFile.caseType,
  subtype: caseFile.subtype === "--" ? "" : caseFile.subtype,
  forumVenue: caseFile.forumVenue === "--" ? "" : caseFile.forumVenue,
  caseNumber: caseFile.caseNumber === "--" ? "" : caseFile.caseNumber,
  assignedConsultant: caseFile.consultant === "--" ? "" : caseFile.consultant,
  status: caseFile.status,
  priority: caseFile.priority,
  shortDescription: caseFile.shortDescription === "--" ? "" : caseFile.shortDescription,
  dates: {
    referralDate: caseFile.dates.referralDate === "--" ? "" : caseFile.dates.referralDate,
    dismissalEventDate: caseFile.dates.dismissalEventDate === "--" ? "" : caseFile.dates.dismissalEventDate,
    conciliationDate: caseFile.dates.conciliationDate === "--" ? "" : caseFile.dates.conciliationDate,
    arbitrationDate: caseFile.dates.arbitrationDate === "--" ? "" : caseFile.dates.arbitrationDate,
    labourCourtDate: caseFile.dates.labourCourtDate === "--" ? "" : caseFile.dates.labourCourtDate,
    consultationDate: caseFile.dates.consultationDate === "--" ? "" : caseFile.dates.consultationDate,
    nextActionDate: caseFile.dates.nextActionDate === "--" ? "" : caseFile.dates.nextActionDate,
    deadlineDate: caseFile.dates.deadlineDate === "--" ? "" : caseFile.dates.deadlineDate,
  },
  outcome: {
    outcomeType: caseFile.outcome.outcomeType === "Pending" ? "" : caseFile.outcome.outcomeType,
    outcomeDate: caseFile.outcome.outcomeDate === "--" ? "" : caseFile.outcome.outcomeDate,
    result: caseFile.outcome.result === "Awaiting outcome" ? "" : caseFile.outcome.result,
    amount: caseFile.outcome.amount === "R 0.00" ? "" : caseFile.outcome.amount,
    closingNote: caseFile.outcome.closingNote === "--" ? "" : caseFile.outcome.closingNote,
    closedBy: caseFile.outcome.closedBy === "--" ? "" : caseFile.outcome.closedBy,
    closedDate: caseFile.outcome.closedDate === "--" ? "" : caseFile.outcome.closedDate,
  },
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

const Matters = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [caseFiles, setCaseFiles] = useState<CaseFile[]>(() => loadCachedCaseFiles());
  const [isCaseFilesLoading, setIsCaseFilesLoading] = useState(() => loadCachedCaseFiles().length === 0);
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [clientLoadMessage, setClientLoadMessage] = useState("No clients found.");
  const [consultantOptions, setConsultantOptions] = useState<ConsultantOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [caseFilesTablePage, setCaseFilesTablePage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | CaseFile["status"]>("all");
  const [caseTypeFilter, setCaseTypeFilter] = useState("all");
  const [consultantFilter, setConsultantFilter] = useState("all");
  const [nextDateFilter, setNextDateFilter] = useState<"all" | "next7" | "next30">("all");
  const [expandedFilterSection, setExpandedFilterSection] = useState<string | null>(null);
  const [isFiltersPanelOpen, setIsFiltersPanelOpen] = useState(false);
  const [isNewCaseMenuOpen, setIsNewCaseMenuOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseFile | null>(null);
  const [activeCaseTab, setActiveCaseTab] = useState<CaseDetailsTab>("overview");
  const [isCaseEditMode, setIsCaseEditMode] = useState(false);
  const [isSavingCaseEdit, setIsSavingCaseEdit] = useState(false);
  const [caseEditForm, setCaseEditForm] = useState<CaseEditForm | null>(null);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [isNewCaseDialogOpen, setIsNewCaseDialogOpen] = useState(false);
  const [isClientSelectOpen, setIsClientSelectOpen] = useState(false);
  const [newCaseStep, setNewCaseStep] = useState<NewCaseStep>(1);
  const [newCaseForm, setNewCaseForm] = useState<NewCaseForm>(createBlankCaseForm());
  const [isSavingCase, setIsSavingCase] = useState(false);
  const nextDateInputRef = useRef<HTMLInputElement | null>(null);
  const caseDateInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const caseTypes = useMemo(() => Array.from(new Set(caseFiles.map((item) => item.caseType))), [caseFiles]);
  const consultants = useMemo(() => Array.from(new Set(caseFiles.map((item) => item.consultant).filter(Boolean))), [caseFiles]);

  const normalizeStatus = (value: string): CaseFile["status"] => {
    const allowed: CaseFile["status"][] = ["Active", "Pending", "Awaiting Documents", "Set Down", "Postponed", "Settled", "Closed", "Archived"];
    return allowed.includes(value as CaseFile["status"]) ? (value as CaseFile["status"]) : "Active";
  };

  const normalizePriority = (value: string | null | undefined): CaseFile["priority"] => {
    if (!value) return "Medium";
    const normalized = value.trim().toLowerCase();
    if (normalized === "low") return "Low";
    if (normalized === "high") return "High";
    if (normalized === "urgent") return "Urgent";
    return "Medium";
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
        clientId: row.client_id ?? "",
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
      const mapped = (data ?? []).map((c: any) => {
        const registered = String(c.registered_name ?? c.company_name ?? c.client_name ?? "").trim();
        const trading = String(c.trading_as ?? c.trading_name ?? c.client_surname ?? "").trim();
        const companyType = String(c.company_type ?? "").trim();
        return {
          id: c.id,
          label: buildMatterClientLabel(registered, companyType, trading),
        };
      });
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
    const loadConsultants = async () => {
      if (!user?.id) {
        setConsultantOptions([]);
        return;
      }

      const metadataCompanyId = String((user as any)?.user_metadata?.company_id || "").trim();
      const companyId = metadataCompanyId || user.id;
      const options: ConsultantOption[] = [];
      const seen = new Set<string>();

      const addOption = (id: string, label: string) => {
        const safeId = String(id || "").trim();
        const safeLabel = String(label || "").trim();
        if (!safeId || !safeLabel) return;
        const dedupeKey = safeLabel.toLowerCase();
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);
        options.push({ id: safeId, label: safeLabel });
      };

      const { data: masterProfiles } = await (supabase as any)
        .from("profiles")
        .select("id,user_name,user_surname,user_email")
        .order("user_name", { ascending: true, nullsFirst: false })
        .order("user_surname", { ascending: true, nullsFirst: false });

      (Array.isArray(masterProfiles) ? masterProfiles : []).forEach((row: any) => {
        const fullName = `${String(row?.user_name || "").trim()} ${String(row?.user_surname || "").trim()}`.trim();
        addOption(String(row?.id || fullName), fullName || String(row?.user_email || "").trim());
      });

      const { data: subusers } = await (supabase as any)
        .from("subusers")
        .select("id,name,surname,email,role,status,company_id")
        .eq("company_id", companyId)
        .eq("role", "Consultant")
        .in("status", ["accepted", "active"])
        .order("name", { ascending: true });

      (Array.isArray(subusers) ? subusers : []).forEach((row: any) => {
        const fullName = `${String(row?.name || "").trim()} ${String(row?.surname || "").trim()}`.trim();
        addOption(String(row?.id || fullName), fullName || String(row?.email || "").trim());
      });

      setConsultantOptions(options);
    };

    void loadConsultants();
  }, [user]);

  useEffect(() => {
    void fetchCaseFiles();
  }, [fetchCaseFiles]);

  useEffect(() => {
    saveCachedCaseFiles(caseFiles);
  }, [caseFiles]);

  useEffect(() => {
    if (!selectedCase) {
      setActiveCaseTab("overview");
      setIsCaseEditMode(false);
      setCaseEditForm(null);
      return;
    }
    setActiveCaseTab("overview");
    setIsCaseEditMode(false);
    setCaseEditForm(createCaseEditForm(selectedCase));
  }, [selectedCase?.id]);

  useEffect(() => {
    const loadSelectedCaseDetails = async () => {
      if (!selectedCase?.id) return;

      const [datesResponse, outcomeResponse] = await Promise.all([
        (supabase as any)
          .from("case_dates")
          .select("date_type,date_value")
          .eq("case_file_id", selectedCase.id),
        (supabase as any)
          .from("case_outcomes")
          .select("outcome_type,outcome_date,result,amount_awarded,amount_settled,closing_note,closed_by")
          .eq("case_file_id", selectedCase.id)
          .maybeSingle(),
      ]);

      const dateMap = {
        referralDate: "--",
        dismissalEventDate: "--",
        conciliationDate: "--",
        arbitrationDate: "--",
        labourCourtDate: "--",
        consultationDate: "--",
        nextActionDate: selectedCase.nextDate ?? "--",
        deadlineDate: "--",
      } as Record<string, string>;

      (Array.isArray(datesResponse.data) ? datesResponse.data : []).forEach((row: any) => {
        const value = String(row?.date_value || "").trim() || "--";
        switch (String(row?.date_type || "").trim()) {
          case "Referral Date":
            dateMap.referralDate = value;
            break;
          case "Date of Dismissal":
            dateMap.dismissalEventDate = value;
            break;
          case "Conciliation Date":
            dateMap.conciliationDate = value;
            break;
          case "Arbitration Date":
            dateMap.arbitrationDate = value;
            break;
          case "Labour Court Date":
            dateMap.labourCourtDate = value;
            break;
          case "Consultation Date":
            dateMap.consultationDate = value;
            break;
          case "Next Action Date":
            dateMap.nextActionDate = value;
            break;
          case "Deadline Date":
            dateMap.deadlineDate = value;
            break;
        }
      });

      const outcomeRow = outcomeResponse.data;
      const resolvedAmountRaw = outcomeRow?.amount_awarded ?? outcomeRow?.amount_settled;
      const resolvedAmount =
        resolvedAmountRaw === null || resolvedAmountRaw === undefined || resolvedAmountRaw === ""
          ? "R 0.00"
          : `R ${Number(resolvedAmountRaw).toFixed(2)}`;

      const mergedCase: CaseFile = {
        ...selectedCase,
        dates: dateMap,
        outcome: outcomeRow
          ? {
              outcomeType: String(outcomeRow.outcome_type || "").trim() || "Pending",
              outcomeDate: String(outcomeRow.outcome_date || "").trim() || "--",
              result: String(outcomeRow.result || "").trim() || "Awaiting outcome",
              amount: resolvedAmount,
              closingNote: String(outcomeRow.closing_note || "").trim() || "--",
              closedBy: String(outcomeRow.closed_by || "").trim() || "--",
              closedDate: String(outcomeRow.outcome_date || "").trim() || "--",
            }
          : selectedCase.outcome,
      };

      setSelectedCase(mergedCase);
      if (!isCaseEditMode) {
        setCaseEditForm(createCaseEditForm(mergedCase));
      }
    };

    void loadSelectedCaseDetails();
  }, [selectedCase?.id]);

  const parseCurrencyValue = (value: string) => {
    const cleaned = String(value || "").replace(/[^0-9.-]/g, "");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const handleCancelCaseEdit = () => {
    if (!selectedCase) return;
    setCaseEditForm(createCaseEditForm(selectedCase));
    setIsCaseEditMode(false);
  };

  const handleSaveCaseEdit = async () => {
    if (!selectedCase || !caseEditForm) return;
    setIsSavingCaseEdit(true);
    try {
      if (activeCaseTab === "overview") {
        const payload = {
          parties: caseEditForm.parties.trim() || null,
          case_type: caseEditForm.caseType.trim() || null,
          case_subtype: caseEditForm.subtype.trim() || null,
          forum: caseEditForm.forumVenue.trim() || null,
          case_number: caseEditForm.caseNumber.trim() || null,
          consultant: caseEditForm.assignedConsultant.trim() || null,
          status: caseEditForm.status,
          priority: caseEditForm.priority,
          short_description: caseEditForm.shortDescription.trim() || null,
        };
        const { error } = await (supabase as any).from("case_files").update(payload).eq("id", selectedCase.id);
        if (error) throw error;
      }

      if (activeCaseTab === "dates") {
        const dateTypeMap: Array<[keyof CaseEditForm["dates"], string]> = [
          ["referralDate", "Referral Date"],
          ["dismissalEventDate", "Date of Dismissal"],
          ["conciliationDate", "Conciliation Date"],
          ["arbitrationDate", "Arbitration Date"],
          ["labourCourtDate", "Labour Court Date"],
          ["consultationDate", "Consultation Date"],
          ["nextActionDate", "Next Action Date"],
          ["deadlineDate", "Deadline Date"],
        ];
        const { error: deleteError } = await (supabase as any)
          .from("case_dates")
          .delete()
          .eq("case_file_id", selectedCase.id)
          .in("date_type", dateTypeMap.map(([, dateType]) => dateType));
        if (deleteError) throw deleteError;

        const inserts = dateTypeMap
          .map(([key, dateType]) => {
            const value = caseEditForm.dates[key];
            return value
              ? { case_file_id: selectedCase.id, date_type: dateType, date_value: value, description: null }
              : null;
          })
          .filter(Boolean);
        if (inserts.length > 0) {
          const { error: insertError } = await (supabase as any).from("case_dates").insert(inserts);
          if (insertError) throw insertError;
        }

        const { error: caseFileError } = await (supabase as any)
          .from("case_files")
          .update({ next_date: caseEditForm.dates.nextActionDate || null })
          .eq("id", selectedCase.id);
        if (caseFileError) throw caseFileError;
      }

      if (activeCaseTab === "outcome") {
        const hasOutcomeValues = Boolean(
          caseEditForm.outcome.outcomeType.trim() ||
          caseEditForm.outcome.outcomeDate.trim() ||
          caseEditForm.outcome.result.trim() ||
          caseEditForm.outcome.amount.trim() ||
          caseEditForm.outcome.closingNote.trim() ||
          caseEditForm.outcome.closedBy.trim() ||
          caseEditForm.outcome.closedDate.trim(),
        );

        if (!hasOutcomeValues) {
          const { error } = await (supabase as any).from("case_outcomes").delete().eq("case_file_id", selectedCase.id);
          if (error) throw error;
        } else {
          if (!caseEditForm.outcome.outcomeType.trim()) {
            throw new Error("Outcome Type is required when saving the Outcome tab.");
          }
          const payload = {
            case_file_id: selectedCase.id,
            outcome_type: caseEditForm.outcome.outcomeType.trim(),
            outcome_date: caseEditForm.outcome.outcomeDate.trim() || caseEditForm.outcome.closedDate.trim() || null,
            result: caseEditForm.outcome.result.trim() || null,
            amount_awarded: parseCurrencyValue(caseEditForm.outcome.amount),
            amount_settled: null,
            closing_note: caseEditForm.outcome.closingNote.trim() || null,
            closed_by: caseEditForm.outcome.closedBy.trim() || null,
          };
          const { error } = await (supabase as any)
            .from("case_outcomes")
            .upsert(payload, { onConflict: "case_file_id" });
          if (error) throw error;
        }
      }

      await fetchCaseFiles();
      const refreshedCase = caseFiles.find((item) => item.id === selectedCase.id) ?? selectedCase;
      setSelectedCase({ ...refreshedCase });
      setCaseEditForm(createCaseEditForm({ ...refreshedCase }));
      setIsCaseEditMode(false);
      toast({ title: "Success", description: "Case updated successfully." });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message ?? "Unable to update case.", variant: "destructive" });
    } finally {
      setIsSavingCaseEdit(false);
    }
  };

  const getNextFileNumber = (caseType: string) => {
    const _ = caseType;
    const maxSeq = caseFiles.reduce((max, c) => {
      const raw = String(c.fileNo || "").trim();
      const m = raw.match(/^MAT\/?(\d{1,8})$/i);
      if (!m) return max;
      return Math.max(max, Number(m[1]));
    }, 0);
    return `MAT${String(maxSeq + 1).padStart(6, "0")}`;
  };

  const openNewCaseDialog = (presetCaseType?: (typeof CASE_TYPE_OPTIONS)[number]) => {
    setIsNewCaseMenuOpen(false);
    setNewCaseStep(1);
    const nextForm = createBlankCaseForm();
    if (presetCaseType) {
      nextForm.caseType = presetCaseType;
      nextForm.fileNumber = getNextFileNumber(presetCaseType);
      nextForm.subtype = getSubtypeValueForCaseType(presetCaseType);
    }
    setNewCaseForm(nextForm);
    setIsNewCaseDialogOpen(true);
  };

  const isStepOneComplete = Boolean(
    newCaseForm.clientId.trim() &&
    newCaseForm.parties.trim() &&
    newCaseForm.caseType.trim() &&
    newCaseForm.shortDescription.trim(),
  );
  const needsCaseNumber = ["CCMA", "Bargaining Council", "Labour Court"].includes(newCaseForm.caseType.trim());
  const subtypeOptions = getSubtypeOptions(newCaseForm.caseType.trim());
  const isSubtypeHidden = shouldHideSubtype(newCaseForm.caseType.trim());
  const isStepTwoComplete = true;
  const isStepThreeComplete = Boolean(
    newCaseForm.assignedConsultant.trim() &&
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
  const totalCaseFilesTablePages = Math.max(1, Math.ceil(filteredCaseFiles.length / CASE_FILES_TABLE_PAGE_SIZE));
  const currentCaseFilesTablePage = Math.min(caseFilesTablePage, totalCaseFilesTablePages);
  const currentCaseFilesTableOffset = (currentCaseFilesTablePage - 1) * CASE_FILES_TABLE_PAGE_SIZE;
  const paginatedCaseFiles = useMemo(
    () => filteredCaseFiles.slice(currentCaseFilesTableOffset, currentCaseFilesTableOffset + CASE_FILES_TABLE_PAGE_SIZE),
    [currentCaseFilesTableOffset, filteredCaseFiles],
  );
  const caseFilesTableRangeStart = filteredCaseFiles.length === 0 ? 0 : currentCaseFilesTableOffset + 1;
  const caseFilesTableRangeEnd =
    filteredCaseFiles.length === 0 ? 0 : Math.min(currentCaseFilesTableOffset + CASE_FILES_TABLE_PAGE_SIZE, filteredCaseFiles.length);
  const allVisibleCaseFilesSelected =
    paginatedCaseFiles.length > 0 &&
    paginatedCaseFiles.every((caseFile) => selectedCaseIds.has(caseFile.id));
  const caseFilesTablePageNumbers = useMemo(() => {
    if (totalCaseFilesTablePages <= 6) {
      return Array.from({ length: totalCaseFilesTablePages }, (_, index) => index + 1);
    }
    if (currentCaseFilesTablePage <= 3) {
      return [1, 2, 3, 4, "ellipsis", totalCaseFilesTablePages];
    }
    if (currentCaseFilesTablePage >= totalCaseFilesTablePages - 2) {
      return [1, "ellipsis", totalCaseFilesTablePages - 3, totalCaseFilesTablePages - 2, totalCaseFilesTablePages - 1, totalCaseFilesTablePages];
    }
    return [1, "ellipsis", currentCaseFilesTablePage - 1, currentCaseFilesTablePage, currentCaseFilesTablePage + 1, "ellipsis-2", totalCaseFilesTablePages];
  }, [currentCaseFilesTablePage, totalCaseFilesTablePages]);

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
      const next = new Set(prev);
      if (allVisibleCaseFilesSelected) {
        paginatedCaseFiles.forEach((caseFile) => next.delete(caseFile.id));
        return next;
      }
      paginatedCaseFiles.forEach((caseFile) => next.add(caseFile.id));
      return next;
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
  useEffect(() => {
    setCaseFilesTablePage((prev) => Math.min(prev, totalCaseFilesTablePages));
  }, [totalCaseFilesTablePages]);
  useEffect(() => {
    setCaseFilesTablePage(1);
  }, [searchQuery, statusFilter, caseTypeFilter, consultantFilter, nextDateFilter]);

  const openDatePicker = (input: HTMLInputElement | null) => {
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.focus();
      input.click();
    }
  };

  const setCaseDateInputRef = (key: string, node: HTMLInputElement | null) => {
    caseDateInputRefs.current[key] = node;
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
          case_subtype: newCaseForm.subtype.trim() || null,
          forum: newCaseForm.forumVenue.trim() || null,
          case_number: newCaseForm.caseNumber.trim() || null,
          consultant: newCaseForm.assignedConsultant.trim(),
          current_stage: newCaseForm.currentStage.trim() || "New File",
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
    "cursor-pointer text-[11px] font-medium text-slate-700 transition-transform duration-150 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[highlighted]:translate-x-[3px]";
  const newCaseDropdownContentStyle = "w-44 border-slate-200 p-1";
  const newCaseButtonStyle =
    "h-8 w-36 justify-between rounded-[4px] px-3 text-[11px] inline-flex items-center border border-[#3eca44] bg-[#3eca44] text-white hover:bg-[#34b73b]";
  const modalInputClass =
    "h-8 rounded border border-slate-200 bg-white !text-[11px] md:!text-[11px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] placeholder:!text-slate-400 hover:border-blue-400 !focus-visible:border-[1px] !focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:bg-white disabled:text-slate-900 disabled:border-slate-200 disabled:opacity-100 disabled:cursor-default !h-[34px] !border-[0.5px] !border-slate-300 hover:!border-slate-500 focus:!border-black focus-visible:!border-black";
  const modalSelectClass =
    "h-8 rounded border border-slate-200 bg-white !text-[11px] md:!text-[11px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] placeholder:!text-slate-400 hover:border-blue-400 !focus-visible:border-[1px] !focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:bg-white disabled:text-slate-900 disabled:border-slate-200 disabled:opacity-100 disabled:cursor-default justify-between data-[placeholder]:text-slate-400 data-[placeholder]:text-xs !h-[34px] !border-[0.5px] !border-slate-300 hover:!border-slate-500 focus:!border-black focus-visible:!border-black data-[state=open]:!border-black !ring-0 !ring-offset-0 !outline-none !shadow-none focus:!ring-0 focus:!ring-offset-0 focus:!shadow-none focus:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 focus-visible:!shadow-none focus-visible:!outline-none data-[state=open]:!ring-0 data-[state=open]:!ring-offset-0 data-[state=open]:!shadow-none data-[state=open]:!outline-none";
  const modalTextareaClass =
    "min-h-[76px] rounded border border-slate-200 bg-white !text-[11px] md:!text-[11px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] placeholder:!text-slate-400 hover:border-blue-400 !focus-visible:border-[1px] !focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:bg-white disabled:text-slate-900 disabled:border-slate-200 disabled:opacity-100 disabled:cursor-default !border-[0.5px] !border-slate-300 hover:!border-slate-500 focus:!border-black focus-visible:!border-black";
  const addModalDropdownToneClass =
    "bg-white border-slate-300 hover:border-slate-500 data-[state=open]:border-black data-[state=open]:bg-white";
  const addModalSelectItemClass =
    "text-[11px] text-slate-700 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[highlighted]:bg-[#3eca44]/10 data-[highlighted]:text-[#2f9f35] [&_svg]:!text-[#2f9f35]";
  const isEditableCaseTab = activeCaseTab === "overview" || activeCaseTab === "dates" || activeCaseTab === "outcome";
  const caseEditSubtypeOptions = getSubtypeOptions(caseEditForm?.caseType ?? "");
  const caseFileCardClass = "rounded border border-slate-200 bg-white p-3";
  const selectedCaseClientFullName =
    selectedCase?.clientId
      ? clientOptions.find((client) => client.id === selectedCase.clientId)?.label || selectedCase?.client || "--"
      : selectedCase?.client || "--";
  const overviewReadOnlyItems = selectedCase
    ? [
        ["File Number", selectedCase.fileNo],
        ["Client", getMatterClientDisplayName(selectedCase.client)],
        ["Opposing Party / Employee", selectedCase.parties.split("//")[1]?.trim() ?? "--"],
        ["Matter Type", selectedCase.caseType],
        ["Subtype", selectedCase.subtype],
        ["Forum", selectedCase.forumVenue],
        ["Case Number", selectedCase.caseNumber],
        ["Assigned Consultant", selectedCase.consultant],
        ["Employer Representative", selectedCase.employerRepresentative],
        ["Current Stage", selectedCase.currentStage],
        ["Status", selectedCase.status],
        ["Priority", selectedCase.priority],
      ].filter(([, value]) => isVisibleReadOnlyValue(value))
    : [];
  const overviewReadOnlyRows = chunkItems(overviewReadOnlyItems, 2);
  const overviewShortDescription = selectedCase?.shortDescription;
  const datesReadOnlyRows = selectedCase
    ? chunkItems(
        [
          [getScheduledDateLabel(selectedCase.caseType), isVisibleReadOnlyValue(selectedCase.dates.nextActionDate) ? formatDisplayDate(String(selectedCase.dates.nextActionDate)) : selectedCase.dates.nextActionDate],
          ["Referral Date", isVisibleReadOnlyValue(selectedCase.dates.referralDate) ? formatDisplayDate(String(selectedCase.dates.referralDate)) : selectedCase.dates.referralDate],
          ["Date of Dismissal / Event", isVisibleReadOnlyValue(selectedCase.dates.dismissalEventDate) ? formatDisplayDate(String(selectedCase.dates.dismissalEventDate)) : selectedCase.dates.dismissalEventDate],
          ["Conciliation Date", isVisibleReadOnlyValue(selectedCase.dates.conciliationDate) ? formatDisplayDate(String(selectedCase.dates.conciliationDate)) : selectedCase.dates.conciliationDate],
          ["Arbitration Date", isVisibleReadOnlyValue(selectedCase.dates.arbitrationDate) ? formatDisplayDate(String(selectedCase.dates.arbitrationDate)) : selectedCase.dates.arbitrationDate],
          ["Labour Court Date", isVisibleReadOnlyValue(selectedCase.dates.labourCourtDate) ? formatDisplayDate(String(selectedCase.dates.labourCourtDate)) : selectedCase.dates.labourCourtDate],
          ["Consultation Date", isVisibleReadOnlyValue(selectedCase.dates.consultationDate) ? formatDisplayDate(String(selectedCase.dates.consultationDate)) : selectedCase.dates.consultationDate],
          ["Deadline Date", isVisibleReadOnlyValue(selectedCase.dates.deadlineDate) ? formatDisplayDate(String(selectedCase.dates.deadlineDate)) : selectedCase.dates.deadlineDate],
        ].filter(([, value]) => isVisibleReadOnlyValue(value)),
        2,
      )
    : [];

  return (
    <DashboardLayout>
      <div className="space-y-0 -m-6">
        <div className="border border-slate-300 border-r-0 bg-white shadow-sm h-[calc(100dvh-var(--app-header-height,5rem))] pb-0">
          <div className="flex h-full flex-col">
            <div className="pl-4 pr-4 pt-1">
              <div className="pt-5 pb-2">
                <h1 className="text-4xl font-normal text-slate-900 -ml-1">Matters</h1>
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
                          <span className="text-slate-900">{`${caseFilesTableRangeStart}-${caseFilesTableRangeEnd}`}</span> of {filteredCaseFiles.length} active case files
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
                              <span className="truncate">New Matter</span>
                              <ChevronDown className="h-4 w-4 text-current" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" sideOffset={0} className={newCaseDropdownContentStyle}>
                            {NEW_MATTER_OPTIONS.map((option) => (
                              <DropdownMenuItem
                                key={option.label}
                                onSelect={(event) => {
                                  event.preventDefault();
                                  openNewCaseDialog(option.caseType);
                                }}
                                className={newCaseDropdownItemStyle}
                              >
                                {option.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 min-h-0 flex-col gap-2 overflow-hidden pl-4 pr-4 pb-0">
                    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm border border-slate-200">
                      <div className="grid grid-cols-[0.45fr_1.2fr_1.5fr_1.9fr_1.3fr_1.4fr_1fr_1fr_0.95fr] items-center gap-2 border-b bg-[#2D4256] pl-1 pr-3 py-3 text-xs font-semibold text-white">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            indicator="x"
                            checked={
                              allVisibleCaseFilesSelected
                                ? true
                                : paginatedCaseFiles.some((caseFile) => selectedCaseIds.has(caseFile.id))
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
                      <div className="employee-table-scroll min-h-0 flex-1 divide-y overflow-y-auto">
                        {isCaseFilesLoading ? (
                          <div className="px-4 py-6 text-xs text-slate-500">Loading case files...</div>
                        ) : filteredCaseFiles.length === 0 ? (
                          <div className="px-4 py-6 text-xs text-slate-500">No case files found.</div>
                        ) : (
                          paginatedCaseFiles.map((caseFile) => (
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
                    <div className="mt-auto flex flex-wrap items-center justify-center gap-2 px-1 pt-[15px] pb-[22px]">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 min-w-[86px] rounded-[4px] border border-[#8fd693] bg-white px-4 text-[11px] font-medium text-[#2f9f35] transition-colors hover:border-[#3eca44] hover:bg-[#eaf8eb] hover:text-[#2f9f35] disabled:border-[#d6ead7] disabled:text-[#a7c9a9]"
                        onClick={() => setCaseFilesTablePage((prev) => Math.max(1, prev - 1))}
                        disabled={currentCaseFilesTablePage === 1}
                      >
                        Previous
                      </Button>
                      {caseFilesTablePageNumbers.map((page) =>
                        typeof page === "number" ? (
                          <button
                            key={page}
                            type="button"
                            onClick={() => setCaseFilesTablePage(page)}
                            className={`flex h-8 min-w-8 items-center justify-center rounded-[4px] border px-3 text-[11px] font-medium transition-colors ${
                              page === currentCaseFilesTablePage
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
                        onClick={() => setCaseFilesTablePage((prev) => Math.min(totalCaseFilesTablePages, prev + 1))}
                        disabled={currentCaseFilesTablePage === totalCaseFilesTablePages}
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
      </div>

      <Dialog open={isNewCaseDialogOpen} onOpenChange={setIsNewCaseDialogOpen}>
      <DialogContent className="w-[94vw] max-w-[560px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden">
          <div className="relative">
            <div className="absolute inset-x-0 top-0 flex h-[46px] items-center justify-between px-4">
              <div className="flex items-center gap-2 pl-2">
                <FolderPlusIcon className="h-4 w-4 text-white" />
                <DialogTitle className="text-sm font-semibold text-white">New Matter</DialogTitle>
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
                        <p className="text-[10px] font-semibold text-slate-400">Case Type <span className="text-red-600">*</span></p>
                        <Select
                          value={newCaseForm.caseType || undefined}
                          onValueChange={(value) =>
                            setNewCaseForm((p) => ({
                              ...p,
                              caseType: value,
                              subtype: getSubtypeValueForCaseType(value, p.subtype),
                              fileNumber: getNextFileNumber(value),
                            }))
                          }
                        >
                          <SelectTrigger className={`${modalSelectClass} ${addModalDropdownToneClass}`}><SelectValue placeholder="Please select case type" /></SelectTrigger>
                          <SelectContent className="text-[11px]">{CASE_TYPE_OPTIONS.map((opt) => <SelectItem key={opt} value={opt} className={addModalSelectItemClass}>{opt}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      {!isSubtypeHidden ? (
                        <div className="space-y-1">
                          <p className="text-[10px] font-semibold text-slate-400">Subtype</p>
                          <Select
                            value={newCaseForm.subtype || undefined}
                            onValueChange={(value) => setNewCaseForm((p) => ({ ...p, subtype: value }))}
                          >
                            <SelectTrigger className={`${modalSelectClass} ${addModalDropdownToneClass}`}><SelectValue placeholder="Please select subtype" /></SelectTrigger>
                            <SelectContent className="text-[11px]">
                              {subtypeOptions.map((opt) => (
                                <SelectItem key={opt} value={opt} className={addModalSelectItemClass}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}
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
                        <p className="text-[10px] font-semibold text-slate-400">Parties <span className="text-red-600">*</span></p>
                        <Input className={`${modalInputClass} !text-[11px]`} value={newCaseForm.parties} onChange={(e) => setNewCaseForm((p) => ({ ...p, parties: e.target.value }))} placeholder="ABC Manufacturing (Pty) Ltd // John Smith" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400">Short Description <span className="text-red-600">*</span></p>
                        <Textarea className={modalTextareaClass} value={newCaseForm.shortDescription} onChange={(e) => setNewCaseForm((p) => ({ ...p, shortDescription: e.target.value }))} placeholder="Please type a short description of the case" />
                      </div>
                    </>
                  )}

                  {newCaseStep === 2 && (
                    <>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400">Forum / Venue</p>
                        <Input className={modalInputClass} value={newCaseForm.forumVenue} onChange={(e) => setNewCaseForm((p) => ({ ...p, forumVenue: e.target.value }))} placeholder="CCMA Johannesburg, MIBCO, Teams..." />
                      </div>
                      {needsCaseNumber ? (
                        <div className="space-y-1">
                          <p className="text-[10px] font-semibold text-slate-400">Case Number / Reference</p>
                          <Input className={modalInputClass} value={newCaseForm.caseNumber} onChange={(e) => setNewCaseForm((p) => ({ ...p, caseNumber: e.target.value }))} placeholder="Please insert case number" />
                        </div>
                      ) : null}
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400">Scheudled for</p>
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
                    </>
                  )}

                  {newCaseStep === 3 && (
                    <>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400">Assigned Consultant <span className="text-red-600">*</span></p>
                        <Select value={newCaseForm.assignedConsultant || undefined} onValueChange={(value) => setNewCaseForm((p) => ({ ...p, assignedConsultant: value }))}>
                          <SelectTrigger className={`${modalSelectClass} ${addModalDropdownToneClass}`}><SelectValue placeholder="Please select consultant" /></SelectTrigger>
                          <SelectContent className="text-[11px]">
                            {consultantOptions.map((opt) => <SelectItem key={opt.id} value={opt.label} className={addModalSelectItemClass}>{opt.label}</SelectItem>)}
                          </SelectContent>
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
                        <p className="text-[10px] font-semibold text-slate-400">Opening Note</p>
                        <Textarea className={modalTextareaClass} value={newCaseForm.openingNote} onChange={(e) => setNewCaseForm((p) => ({ ...p, openingNote: e.target.value }))} placeholder="Please type the first file note or instruction received" />
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
                        {isSavingCase ? "Saving..." : "Submit"}
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

              <div className="mt-[46px] flex h-[calc(92vh-46px)] flex-col bg-white px-4 pb-4 pt-4">
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">
                        {selectedCase.subtype && selectedCase.subtype !== "--"
                          ? `${selectedCase.caseType} (${selectedCase.subtype})`
                          : selectedCase.caseType}
                      </h2>
                      <p className="text-xs text-slate-500">{selectedCase.parties}</p>
                      <div className="mt-2">
                        <Badge className="border border-[#8fd693] bg-white px-2 py-0.5 text-[9.5px] text-[#2f9f35] hover:bg-white focus-visible:ring-0">
                          {selectedCase.fileNo}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" className="h-8 text-[11px] border-slate-300 bg-white text-slate-700 hover:bg-white hover:border-[#3eca44] hover:text-[#2f9f35] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0">Add Note</Button>
                      <Button variant="outline" className="h-8 text-[11px] border-slate-300 bg-white text-slate-700 hover:bg-white hover:border-[#3eca44] hover:text-[#2f9f35] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0">Close Case</Button>
                    </div>
                  </div>

                  <Tabs value={activeCaseTab} onValueChange={(value) => { if (!isCaseEditMode) setActiveCaseTab(value as CaseDetailsTab); }} className="w-full">
                    <TabsList className="grid w-full grid-cols-5 bg-slate-100">
                      <TabsTrigger value="overview" className="text-[11px] data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:text-[#2f9f35] data-[state=inactive]:hover:text-[12.33px] data-[state=active]:bg-[#2D4256] data-[state=active]:text-white data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Overview</TabsTrigger>
                      <TabsTrigger value="dates" className="text-[11px] data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:text-[#2f9f35] data-[state=inactive]:hover:text-[12.33px] data-[state=active]:bg-[#2D4256] data-[state=active]:text-white data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Dates</TabsTrigger>
                      <TabsTrigger value="notes" className="text-[11px] data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:text-[#2f9f35] data-[state=inactive]:hover:text-[12.33px] data-[state=active]:bg-[#2D4256] data-[state=active]:text-white data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Notes</TabsTrigger>
                      <TabsTrigger value="documents" className="text-[11px] data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:text-[#2f9f35] data-[state=inactive]:hover:text-[12.33px] data-[state=active]:bg-[#2D4256] data-[state=active]:text-white data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Documents</TabsTrigger>
                      <TabsTrigger value="outcome" className="text-[11px] data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:text-[#2f9f35] data-[state=inactive]:hover:text-[12.33px] data-[state=active]:bg-[#2D4256] data-[state=active]:text-white data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Outcome</TabsTrigger>
                    </TabsList>
                    <TabsContent value="overview" className="mt-4">
                      {isCaseEditMode && caseEditForm ? (
                        <div className="space-y-3 text-xs">
                          <div className={caseFileCardClass}>
                            <p className="mb-3 text-[13px] font-semibold text-slate-700 underline">Case Overview</p>
                            <div className="mt-2 space-y-2">
                              {[
                                { fields: [["Parties", "parties"], ["Matter Type", "caseType"]] },
                                { fields: [["Subtype", "subtype"], ["Forum", "forumVenue"]] },
                                { fields: [["Case Number", "caseNumber"], ["Assigned Consultant", "assignedConsultant"]] },
                                { fields: [["Status", "status"], ["Priority", "priority"]] },
                                { fields: [["Short Description", "shortDescription"]], fullWidth: true },
                              ].map((row, rowIndex) => (
                                <div key={rowIndex} className="grid grid-cols-1 gap-y-2 md:grid-cols-[minmax(130px,0.7fr)_minmax(220px,1.3fr)_minmax(130px,0.7fr)_minmax(220px,1.3fr)] md:items-center md:gap-x-6">
                                  {row.fields.map(([label, field]) => (
                                    <span key={String(field)} className={row.fullWidth ? "contents md:[&>*:nth-child(2)]:col-span-3" : "contents"}>
                                      <p className="text-[10px] font-medium text-slate-500">{label}</p>
                                      <div className={row.fullWidth ? "md:col-span-3" : ""}>
                                        {field === "caseType" ? (
                                          <Select value={caseEditForm.caseType || undefined} onValueChange={(value) => setCaseEditForm((prev) => prev ? { ...prev, caseType: value, subtype: getSubtypeValueForCaseType(value, prev.subtype) } : prev)}><SelectTrigger className={`${modalSelectClass} ${addModalDropdownToneClass}`}><SelectValue placeholder="Select matter type" /></SelectTrigger><SelectContent className="text-[11px]">{CASE_TYPE_OPTIONS.map((opt) => <SelectItem key={opt} value={opt} className={addModalSelectItemClass}>{opt}</SelectItem>)}</SelectContent></Select>
                                        ) : field === "subtype" ? (
                                          shouldHideSubtype(caseEditForm.caseType) ? <Input className={modalInputClass} value="None" disabled /> : <Select value={caseEditForm.subtype || undefined} onValueChange={(value) => setCaseEditForm((prev) => prev ? { ...prev, subtype: value } : prev)}><SelectTrigger className={`${modalSelectClass} ${addModalDropdownToneClass}`}><SelectValue placeholder="Select subtype" /></SelectTrigger><SelectContent className="text-[11px]">{caseEditSubtypeOptions.map((opt) => <SelectItem key={opt} value={opt} className={addModalSelectItemClass}>{opt}</SelectItem>)}</SelectContent></Select>
                                        ) : field === "assignedConsultant" ? (
                                          <Select value={caseEditForm.assignedConsultant || undefined} onValueChange={(value) => setCaseEditForm((prev) => prev ? { ...prev, assignedConsultant: value } : prev)}><SelectTrigger className={`${modalSelectClass} ${addModalDropdownToneClass}`}><SelectValue placeholder="Select consultant" /></SelectTrigger><SelectContent className="text-[11px]">{consultantOptions.map((opt) => <SelectItem key={opt.id} value={opt.label} className={addModalSelectItemClass}>{opt.label}</SelectItem>)}</SelectContent></Select>
                                        ) : field === "status" ? (
                                          <Select value={caseEditForm.status} onValueChange={(value) => setCaseEditForm((prev) => prev ? { ...prev, status: value as CaseFile["status"] } : prev)}><SelectTrigger className={`${modalSelectClass} ${addModalDropdownToneClass}`}><SelectValue /></SelectTrigger><SelectContent className="text-[11px]">{STATUS_OPTIONS.map((opt) => <SelectItem key={opt} value={opt} className={addModalSelectItemClass}>{opt}</SelectItem>)}</SelectContent></Select>
                                        ) : field === "priority" ? (
                                          <Select value={caseEditForm.priority} onValueChange={(value) => setCaseEditForm((prev) => prev ? { ...prev, priority: value as CaseFile["priority"] } : prev)}><SelectTrigger className={`${modalSelectClass} ${addModalDropdownToneClass}`}><SelectValue /></SelectTrigger><SelectContent className="text-[11px]">{PRIORITY_OPTIONS.map((opt) => <SelectItem key={opt} value={opt} className={addModalSelectItemClass}>{opt}</SelectItem>)}</SelectContent></Select>
                                        ) : field === "shortDescription" ? (
                                          <Textarea className={modalTextareaClass} value={caseEditForm.shortDescription} onChange={(e) => setCaseEditForm((prev) => prev ? { ...prev, shortDescription: e.target.value } : prev)} />
                                        ) : (
                                          <Input className={modalInputClass} value={String((caseEditForm as any)[field] ?? "")} onChange={(e) => setCaseEditForm((prev) => prev ? { ...prev, [field]: e.target.value } : prev)} />
                                        )}
                                      </div>
                                    </span>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : <div className="space-y-3 text-xs"><div className={caseFileCardClass}><p className="mb-3 text-[13px] font-semibold text-slate-700 underline">Case Overview</p><div className="mt-2 space-y-2">{overviewReadOnlyRows.map((row, rowIndex) => <div key={rowIndex} className="grid grid-cols-1 gap-y-2 md:grid-cols-[minmax(130px,0.7fr)_minmax(220px,1.3fr)_minmax(130px,0.7fr)_minmax(220px,1.3fr)] md:items-center md:gap-x-6">{row.map(([label, value]) => <span key={String(label)} className="contents"><p className="text-[10px] font-medium text-slate-500">{label}</p>{label === "Client" ? <Tooltip><TooltipTrigger asChild><p className="text-[11px] font-medium text-slate-900 transition-colors hover:text-[#2f9f35]">{value}</p></TooltipTrigger><TooltipContent side="top" className="rounded border border-[#3eca44]/35 text-[9.84px] shadow-none">{selectedCaseClientFullName}</TooltipContent></Tooltip> : <p className="text-[11px] font-medium text-slate-900">{value}</p>}</span>)}</div>)}{isVisibleReadOnlyValue(overviewShortDescription) ? <div className="grid grid-cols-1 gap-y-2 md:grid-cols-[minmax(130px,0.7fr)_minmax(220px,1.3fr)_minmax(130px,0.7fr)_minmax(220px,1.3fr)] md:items-start md:gap-x-6"><p className="text-[10px] font-medium text-slate-500">Short Description</p><p className="text-[11px] font-medium text-slate-900 md:col-span-3">{overviewShortDescription}</p></div> : null}</div></div></div>}
                    </TabsContent>
                    <TabsContent value="dates" className="mt-4">
                      {isCaseEditMode && caseEditForm ? (
                        <div className="space-y-3 text-xs">
                          <div className={caseFileCardClass}>
                            <p className="mb-3 text-[13px] font-semibold text-slate-700 underline">Case Dates</p>
                            <div className="mt-2 space-y-2">
                              {chunkItems([
                                [getScheduledDateLabel(caseEditForm.caseType), "nextActionDate"],
                                ["Referral Date", "referralDate"],
                                ["Date of Dismissal / Event", "dismissalEventDate"],
                                ["Conciliation Date", "conciliationDate"],
                                ["Arbitration Date", "arbitrationDate"],
                                ["Labour Court Date", "labourCourtDate"],
                                ["Consultation Date", "consultationDate"],
                                ["Deadline Date", "deadlineDate"],
                              ], 2).map((row, rowIndex) => (
                                <div key={rowIndex} className="grid grid-cols-1 gap-y-2 md:grid-cols-[minmax(130px,0.7fr)_minmax(220px,1.3fr)_minmax(130px,0.7fr)_minmax(220px,1.3fr)] md:items-center md:gap-x-6">
                                  {row.map(([label, key]) => (
                                    <span key={String(key)} className="contents">
                                      <p className="text-[10px] font-medium text-slate-500">{label}</p>
                                      <div>
                                        <Input
                                          className={modalInputClass}
                                          type="text"
                                          readOnly
                                          placeholder="Please select a date"
                                          value={caseEditForm.dates[key as keyof typeof caseEditForm.dates] ? formatDisplayDate(caseEditForm.dates[key as keyof typeof caseEditForm.dates]) : ""}
                                          onClick={() => openDatePicker(caseDateInputRefs.current[String(key)] ?? null)}
                                          onFocus={() => openDatePicker(caseDateInputRefs.current[String(key)] ?? null)}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              openDatePicker(caseDateInputRefs.current[String(key)] ?? null);
                                            }
                                          }}
                                        />
                                        <input
                                          ref={(node) => setCaseDateInputRef(String(key), node)}
                                          type="date"
                                          value={caseEditForm.dates[key as keyof typeof caseEditForm.dates]}
                                          onChange={(e) => setCaseEditForm((prev) => prev ? { ...prev, dates: { ...prev.dates, [key]: e.target.value } } : prev)}
                                          className="sr-only"
                                          aria-hidden="true"
                                          tabIndex={-1}
                                        />
                                      </div>
                                    </span>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : <div className="space-y-3 text-xs"><div className={caseFileCardClass}><p className="mb-3 text-[13px] font-semibold text-slate-700 underline">Case Dates</p><div className="mt-2 space-y-2">{datesReadOnlyRows.map((row, rowIndex) => <div key={rowIndex} className="grid grid-cols-1 gap-y-2 md:grid-cols-[minmax(130px,0.7fr)_minmax(220px,1.3fr)_minmax(130px,0.7fr)_minmax(220px,1.3fr)] md:items-center md:gap-x-6">{row.map(([label, value]) => <span key={String(label)} className="contents"><p className="text-[10px] font-medium text-slate-500">{label}</p><p className="text-[11px] font-medium text-slate-900">{value}</p></span>)}</div>)}</div></div></div>}
                    </TabsContent>
                    <TabsContent value="notes" className="mt-4 space-y-2"><Button variant="outline" className="h-8 text-[11px] border-slate-300 bg-white text-slate-700 hover:bg-white hover:border-[#3eca44] hover:text-[#2f9f35] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0">Add Note</Button>{selectedCase.notes.map((note, idx) => <div key={idx} className="rounded border border-slate-200 bg-slate-50 p-2 text-xs"><p className="font-semibold text-slate-900">{note.noteType}</p><p className="text-slate-500">{note.date} | {note.addedBy} | Follow-up: {note.followUpDate}</p><p className="mt-1 text-slate-800">{note.body}</p></div>)}</TabsContent>
                    <TabsContent value="documents" className="mt-4"><div className="grid gap-2 text-xs sm:grid-cols-2">{["Referral Forms", "Notices of Set Down", "Employer Documents", "Employee Documents", "Witness Statements", "Disciplinary Documents", "Bundle / Index", "Settlement Agreement", "Award / Ruling / Order", "Correspondence"].map((doc) => <div key={doc} className="rounded border border-slate-200 bg-slate-50 p-2"><p className="font-medium text-slate-900">{doc}</p><p className="text-[10px] text-slate-500">No documents uploaded</p></div>)}</div></TabsContent>
                    <TabsContent value="outcome" className="mt-4">
                      {isCaseEditMode && caseEditForm ? (
                        <div className="grid gap-3 text-xs sm:grid-cols-2">
                          <div className="space-y-1"><p className="text-[10px] text-slate-500">Outcome Type</p><Select value={caseEditForm.outcome.outcomeType || undefined} onValueChange={(value) => setCaseEditForm((prev) => prev ? { ...prev, outcome: { ...prev.outcome, outcomeType: value } } : prev)}><SelectTrigger className={`${modalSelectClass} ${addModalDropdownToneClass}`}><SelectValue placeholder="Select outcome type" /></SelectTrigger><SelectContent className="text-[11px]">{OUTCOME_TYPE_OPTIONS.map((opt) => <SelectItem key={opt} value={opt} className={addModalSelectItemClass}>{opt}</SelectItem>)}</SelectContent></Select></div>
                          <div className="space-y-1"><p className="text-[10px] text-slate-500">Outcome Date</p><Input type="date" className={modalInputClass} value={caseEditForm.outcome.outcomeDate} onChange={(e) => setCaseEditForm((prev) => prev ? { ...prev, outcome: { ...prev.outcome, outcomeDate: e.target.value } } : prev)} /></div>
                          <div className="space-y-1"><p className="text-[10px] text-slate-500">Result</p><Input className={modalInputClass} value={caseEditForm.outcome.result} onChange={(e) => setCaseEditForm((prev) => prev ? { ...prev, outcome: { ...prev.outcome, result: e.target.value } } : prev)} /></div>
                          <div className="space-y-1"><p className="text-[10px] text-slate-500">Amount Awarded/Settled</p><Input className={modalInputClass} value={caseEditForm.outcome.amount} onChange={(e) => setCaseEditForm((prev) => prev ? { ...prev, outcome: { ...prev.outcome, amount: e.target.value } } : prev)} placeholder="R 0.00" /></div>
                          <div className="space-y-1 sm:col-span-2"><p className="text-[10px] text-slate-500">Closing Note</p><Textarea className={modalTextareaClass} value={caseEditForm.outcome.closingNote} onChange={(e) => setCaseEditForm((prev) => prev ? { ...prev, outcome: { ...prev.outcome, closingNote: e.target.value } } : prev)} /></div>
                          <div className="space-y-1"><p className="text-[10px] text-slate-500">Closed By</p><Input className={modalInputClass} value={caseEditForm.outcome.closedBy} onChange={(e) => setCaseEditForm((prev) => prev ? { ...prev, outcome: { ...prev.outcome, closedBy: e.target.value } } : prev)} /></div>
                          <div className="space-y-1"><p className="text-[10px] text-slate-500">Closed Date</p><Input type="date" className={modalInputClass} value={caseEditForm.outcome.closedDate} onChange={(e) => setCaseEditForm((prev) => prev ? { ...prev, outcome: { ...prev.outcome, closedDate: e.target.value } } : prev)} /></div>
                        </div>
                      ) : <div className="grid gap-2 text-xs sm:grid-cols-2">{[["Outcome Type", selectedCase.outcome.outcomeType], ["Outcome Date", selectedCase.outcome.outcomeDate], ["Result", selectedCase.outcome.result], ["Amount Awarded/Settled", selectedCase.outcome.amount], ["Closing Note", selectedCase.outcome.closingNote], ["Closed By", selectedCase.outcome.closedBy], ["Closed Date", selectedCase.outcome.closedDate]].filter(([, value]) => isVisibleReadOnlyValue(value)).map(([label, value]) => <div key={label} className="rounded border border-slate-200 bg-slate-50 p-2"><p className="text-[10px] text-slate-500">{label}</p><p className="font-medium text-slate-900">{label.toLowerCase().includes("date") ? formatDisplayDate(String(value)) : value}</p></div>)}</div>}
                    </TabsContent>
                  </Tabs>
                </div>
                <div className="border-t border-dashed border-muted/60 pt-4">
                    <div className="flex items-center justify-center gap-2">
                      {isCaseEditMode ? (
                        <>
                          <Button type="button" variant="outline" className="h-8 min-w-[92px] rounded text-[11px] border-slate-300 bg-white text-slate-700 hover:bg-white hover:border-slate-400 hover:text-slate-800" onClick={handleCancelCaseEdit} disabled={isSavingCaseEdit}>Cancel</Button>
                          <Button type="button" className="h-8 min-w-[92px] rounded bg-[#3eca44] px-3 text-[11px] text-white hover:bg-[#34b73b]" onClick={() => void handleSaveCaseEdit()} disabled={isSavingCaseEdit}>{isSavingCaseEdit ? "Saving..." : "Save"}</Button>
                        </>
                      ) : isEditableCaseTab ? (
                        <Button type="button" variant="outline" className="h-8 min-w-[92px] rounded text-[11px] border-slate-300 bg-white text-slate-700 hover:bg-white hover:border-[#3eca44] hover:text-[#2f9f35]" onClick={() => setIsCaseEditMode(true)}>Edit Case</Button>
                      ) : null}
                    </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Matters;
