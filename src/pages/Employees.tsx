import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Trash2,
  Upload,
  FilePlus,
  Eye,
  EyeOff,
  Download,
  Search,
  ArrowLeft,
  Pencil,
  X,
  FileUp,
  User,
  UserPlus,
  Users,
  UsersRound,
  Info,
  ArrowRight,
  Menu,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { getSafeErrorMessage } from "@/lib/errorHandling";
import {
  EMPLOYEE_NUMBER_MAX_LENGTH,
  contractTypes,
  employeeBasicSchema,
  employeeImportSchema,
  employeeProfileSchema,
  sanitizeEmployeeNumber,
  nationalityOptions,
  genderOptions,
  raceOptions,
  southAfricanProvinces,
  type EmployeeBasicFormData,
  type EmployeeProfileFormData,
} from "@/lib/validation";
import { maskSAIdNumber } from "@/lib/idMasking";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
// Supabase types do not include employee_warnings; cast to any for those calls to avoid type errors.
const warningTable = () => (supabase as any).from("employee_warnings");
// Supabase types do not include employee_contracts; cast to any for those calls to avoid type errors.
const contractTable = () => (supabase as any).from("employee_contracts");

type Employee = Tables<"employees"> & {
  start_date?: string | null;
  end_date?: string | null;
  contract_type?: string | null;
  nationality?: string | null;
  employee_number?: string | null;
  job_title?: string | null;
  gender?: string | null;
  race?: string | null;
  physical_address_line1?: string | null;
  physical_address_line2?: string | null;
  city?: string | null;
  postal_address_line1?: string | null;
  postal_address_line2?: string | null;
  postal_city?: string | null;
  postal_province?: string | null;
  postal_area_code?: string | null;
  province?: string | null;
  area_code?: string | null;
  cell_number?: string | null;
  email?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_number?: string | null;
};
type EmployeeInsert = TablesInsert<"employees"> & {
  employee_number?: string | null;
  contract_type?: string | null;
  job_title?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  nationality?: string | null;
  physical_address_line1?: string | null;
  physical_address_line2?: string | null;
  city?: string | null;
  postal_address_line1?: string | null;
  postal_address_line2?: string | null;
  postal_city?: string | null;
  postal_province?: string | null;
  postal_area_code?: string | null;
  province?: string | null;
  area_code?: string | null;
  cell_number?: string | null;
  email?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_number?: string | null;
};
type EmployeeUpdate = Partial<Employee>;
type EmployeeTab = "personal" | "employment" | "address" | "discipline" | "contracts";
type EmployeeWarning = {
  id: string;
  misconductType: string;
  warningType: "First" | "Second" | "Serious" | "Final";
  issueDate: string;
  expiryDate: string;
  fileName?: string;
  fileUrl?: string;
};
type EmployeeContract = {
  id: string;
  contractType: string;
  issueDate: string;
  fileName?: string;
  fileUrl?: string;
  isActive: boolean;
};
type OffenceSection = {
  title?: string;
  offences?: Array<{ name?: string; category?: string; first?: string }>;
};
type DeleteUndoState = {
  deletedEmployees: Employee[];
  expiresAt: number;
};

type WarningDeleteUndoState = {
  warning: EmployeeWarning;
  employeeId: string;
  storagePath?: string;
  expiresAt: number;
};

type DocumentOption = {
  label: string;
  description: string;
  path: string;
  active: boolean;
};

type DocumentKey = "warnings" | "permanentContract" | "temporaryContract" | "addendum";

type ConductOffence = {
  category: "Minor" | "Serious" | "Dismissible";
  name: string;
  firstOutcome: string;
};

type WarningFormState = {
  misconductTypes: string[];
  warningType: EmployeeWarning["warningType"];
  issueDate: string;
  fileName: string;
};
type ContractFormState = {
  contractType: (typeof contractTypes)[number] | "";
  fileName: string;
};

const coerceEnumValue = <T extends string>(value: unknown, options: readonly T[]): T | "" =>
  options.includes(value as T) ? (value as T) : "";

const cleanEmployeeNumberInput = (value?: string | null) => sanitizeEmployeeNumber(value);
const normalizeEmployeeNumber = (value?: string | null) => (value || "").trim().toLowerCase();

const DEFAULT_NATIONALITY: EmployeeProfileFormData["nationality"] = "South African";
const dateToday = () => new Date().toISOString().split("T")[0];
const MISCONDUCT_TYPES = [
  // Minor
  "Unauthorised absenteeism",
  "Arriving late for work",
  "Leaving work early",
  "Failure to report absence",
  "Failure to report late arrival",
  "Failure to report leaving early",
  "Sleeping on duty",
  "Failure to clock in/out",
  "Poor housekeeping",
  "Horseplay",
  "Unauthorised use of cell phone",
  "Breach of Policy or Procedure",
  "Breach of Rules or Regulations",
  "Failure to carry out instructions",
  // Serious
  "Negligence",
  "Unauthorised absenteeism > 5 days",
  "Refusal to work overtime",
  "Consistent poor time keeping",
  "Causing inharmonious relationships",
  "Unbecoming behaviour",
  "Insolence / Disrespectful behaviour",
  "Aggressive behaviour",
  "Insubordination / Refusing instructions",
  "Refusal to comply with policy/procedure",
  "Refusal to comply with rule",
  "Damage to company name",
  "Unauthorised wastage of materials",
  "Unauthorised removal",
  "Unauthorised possession",
  "Breach of OHS standards / policies",
  "Private work during working hours",
  "Unauthorised disclosure of information",
  "Misappropriation of property / funds",
  "Testing positive for alcohol",
  "Testing positive for illegal drugs",
  "Under the influence of alcohol/drugs",
  "Possession of alcohol/drugs on duty",
  "Unauthorised possession of firearm on duty",
  "Intimidation",
  "Incitement",
  "Illegal strike / picketing",
  "Viewing pornographic material on duty",
  "Unauthorised access",
  "Unauthorised use of company property",
  "Unauthorised use of client property",
  "Abusive language",
  "Dishonesty",
  "Gambling on duty",
  "Clocking for another employee",
  // Dismissible
  "Theft",
  "Accomplice to theft",
  "Fraud",
  "Accomplice to fraud",
  "Gross dishonesty",
  "Gross negligence",
  "Assault",
  "Sexual harassment",
  "Viewing illegal pornography on duty",
  "Racism",
  "Refusal to obey OHS rules/procedures",
  "Bribery",
  "Falsification of records",
  "Intentional damage to property",
  "Gross insubordination",
  "Unauthorised discharge of firearm",
  "Unsafe use of firearm",
  "Threatening another employee/client",
  "Unauthorised possession of a weapon on duty",
];

// Remove local error extraction - now using centralized error handling

const createBlankAddForm = (): EmployeeBasicFormData => ({
  employeeName: "",
  employeeSurname: "",
  idNumber: "",
  employeeNumber: "",
});

const createProfileFormFromEmployee = (employee?: Employee): EmployeeProfileFormData => ({
  employeeName: employee?.employee_name ?? "",
  employeeSurname: employee?.employee_surname ?? "",
  idNumber: employee?.id_number ?? "",
  startDate: employee?.start_date ?? "",
  contractType:
    (coerceEnumValue(employee?.contract_type, contractTypes) as EmployeeProfileFormData["contractType"]) ??
    "Permanent",
  endDate: employee?.end_date ?? "",
  nationality:
    (coerceEnumValue(employee?.nationality, nationalityOptions) as EmployeeProfileFormData["nationality"]) ??
    DEFAULT_NATIONALITY,
  gender: (employee?.gender ?? "") as EmployeeProfileFormData["gender"],
  race: (employee?.race ?? "") as EmployeeProfileFormData["race"],
  employeeNumber: cleanEmployeeNumberInput(employee?.employee_number),
  jobTitle: employee?.job_title ?? "",
  physicalAddressLine1: employee?.physical_address_line1 ?? "",
  physicalAddressLine2: employee?.physical_address_line2 ?? "",
  city: employee?.city ?? "",
  province: coerceEnumValue(employee?.province, southAfricanProvinces) as EmployeeProfileFormData["province"],
  areaCode: employee?.area_code ?? "",
  postalAddressLine1: employee?.postal_address_line1 ?? "",
  postalAddressLine2: employee?.postal_address_line2 ?? "",
  postalCity: employee?.postal_city ?? "",
  postalProvince: coerceEnumValue(employee?.postal_province, southAfricanProvinces) as EmployeeProfileFormData["postalProvince"],
  postalAreaCode: employee?.postal_area_code ?? "",
  cellNumber: employee?.cell_number ?? "",
  email: employee?.email ?? "",
  emergencyContactName: employee?.emergency_contact_name ?? "",
  emergencyContactNumber: employee?.emergency_contact_number ?? "",
});

const formatDisplayDate = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
};

const parseMisconductTypes = (value?: string | null) => {
  if (!value) return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item)).filter(Boolean);
      }
    } catch {
      // Fallback to split if parsing fails.
    }
  }
  return trimmed
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const DEFAULT_PAGE_SIZE = 25;
const warningValidityMonths: Record<EmployeeWarning["warningType"], number> = {
  First: 6,
  Second: 6,
  Serious: 9,
  Final: 12,
};

const warningTypeLabels: Record<EmployeeWarning["warningType"], string> = {
  First: "First Written Warning",
  Second: "Second Written Warning",
  Serious: "Serious Written Warning",
  Final: "Final Written Warning",
};

const getStoragePathFromUrl = (url?: string) => {
  if (!url) return "";
  const marker = "/warnings/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  return url.slice(idx + marker.length);
};

const getContractStoragePathFromUrl = (url?: string) => {
  if (!url) return "";
  const marker = "/contracts/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  return url.slice(idx + marker.length);
};

const computeWarningExpiry = (warningType: EmployeeWarning["warningType"], issueDate: string) => {
  const months = warningValidityMonths[warningType] ?? 6;
  const base = new Date(issueDate);
  if (Number.isNaN(base.getTime())) {
    return "";
  }
  const expiry = new Date(base);
  expiry.setMonth(expiry.getMonth() + months);
  return expiry.toISOString().split("T")[0];
};

const documentOptions: DocumentOption[] = [
  {
    label: "Written Warning",
    description: "Generate a disciplinary warning with company and employee data.",
    path: "/documents/discipline/warnings",
    active: true,
  },
  {
    label: "Permanent Contract",
    description: "Generate a permanent employment contract.",
    path: "/documents/contracts/permanent",
    active: true,
  },
  {
    label: "Temporary Contract",
    description: "Generate a temporary employment contract.",
    path: "/documents/contracts/temporary",
    active: true,
  },
  {
    label: "Addendum",
    description: "Generate an addendum for an existing contract.",
    path: "/documents/contracts/addendum",
    active: true,
  },
];

const documentPathToKey: Record<string, DocumentKey> = {
  "/documents/discipline/warnings": "warnings",
  "/documents/contracts/permanent": "permanentContract",
  "/documents/contracts/temporary": "temporaryContract",
  "/documents/contracts/addendum": "addendum",
};

const Employees = () => {
 const { user, loading } = useAuth();
 const navigate = useNavigate();
 const { toast } = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [totalPermanentEmployees, setTotalPermanentEmployees] = useState<number | null>(null);
  const [totalTemporaryEmployees, setTotalTemporaryEmployees] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalEmployees, setTotalEmployees] = useState<number | null>(null);
  const [totalFilteredEmployees, setTotalFilteredEmployees] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [contractFilter, setContractFilter] = useState<"all" | "permanent" | "temporary">("all");
  const [genderFilter, setGenderFilter] = useState<"all" | EmployeeProfileFormData["gender"]>("all");
  const [raceFilter, setRaceFilter] = useState<"all" | EmployeeProfileFormData["race"]>("all");
  const [nationalityFilter, setNationalityFilter] = useState<"all" | "RSA" | "Other">("all");
   const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
 const [isProfilePanelOpen, setIsProfilePanelOpen] = useState(false);
   const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
   const [isLoading, setIsLoading] = useState(false);
  const [isEmployeesLoading, setIsEmployeesLoading] = useState(false);
   const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState<EmployeeTab>("personal");
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [addForm, setAddForm] = useState<EmployeeBasicFormData>(createBlankAddForm());
  const [profileForm, setProfileForm] = useState<EmployeeProfileFormData>(createProfileFormFromEmployee());
  const [isWarningDialogOpen, setIsWarningDialogOpen] = useState(false);
  const [warningForm, setWarningForm] = useState<WarningFormState>({
    misconductTypes: [],
    warningType: "First",
    issueDate: dateToday(),
    fileName: "",
  });
  const [warningFilter, setWarningFilter] = useState<"valid" | "expired">("valid");
  const [warningFile, setWarningFile] = useState<File | null>(null);
  const [warningsByEmployee, setWarningsByEmployee] = useState<Record<string, EmployeeWarning[]>>({});
  const [editingWarning, setEditingWarning] = useState<EmployeeWarning | null>(null);
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);
  const [contractForm, setContractForm] = useState<ContractFormState>({
    contractType: "",
    fileName: "",
  });
  const [contractStatusFilter, setContractStatusFilter] = useState<"active" | "inactive">("active");
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [contractsByEmployee, setContractsByEmployee] = useState<Record<string, EmployeeContract[]>>({});
  const [activeContractsByEmployee, setActiveContractsByEmployee] = useState<Record<string, boolean>>({});
  const [misconductSearch, setMisconductSearch] = useState("");
  const [conductOffences, setConductOffences] = useState<ConductOffence[]>([]);
  const [isMisconductMenuOpen, setIsMisconductMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documentDialogEmployee, setDocumentDialogEmployee] = useState<Employee | null>(null);
  const firstActiveDocPath = documentOptions.find((doc) => doc.active)?.path ?? "";
  const [selectedDocumentPath, setSelectedDocumentPath] = useState<string>(firstActiveDocPath);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const tableCardRef = useRef<HTMLDivElement | null>(null);
  const [tableOffsetTop, setTableOffsetTop] = useState(0);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [deleteUndo, setDeleteUndo] = useState<DeleteUndoState | null>(null);
  const [deleteUndoCountdown, setDeleteUndoCountdown] = useState(0);
  const deleteUndoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteUndoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [warningDeleteUndo, setWarningDeleteUndo] = useState<WarningDeleteUndoState | null>(null);
  const [warningDeleteCountdown, setWarningDeleteCountdown] = useState(0);
  const warningDeleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningDeleteIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAddFormComplete =
    addForm.employeeName.trim().length > 0 && addForm.employeeSurname.trim().length > 0;
  const isAddFormSubmitDisabled = isLoading || !isAddFormComplete;
  const fieldWrapperClass = "space-y-1";
  const fieldLabelClass = "text-[12px] font-semibold text-slate-500";
  const baseFieldInputClass =
    "h-9 rounded-sm border border-slate-200 bg-white text-sm font-medium text-slate-900 shadow-none placeholder:text-xs focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:border-blue-400 disabled:bg-white disabled:text-slate-900 disabled:border-slate-200 disabled:opacity-100 disabled:cursor-default";
  const fieldInputClass = baseFieldInputClass;
  const fieldSelectTriggerClass = `${fieldInputClass} justify-between data-[placeholder]:text-muted-foreground data-[placeholder]:text-xs`;
  const isReadOnlyTab = activeTab === "discipline" || activeTab === "contracts";
  const isProfileDirty = useMemo(() => {
    if (!selectedEmployee) return false;
    const original = createProfileFormFromEmployee(selectedEmployee);
    return (Object.keys(original) as Array<keyof EmployeeProfileFormData>).some(
      (key) => profileForm[key] !== original[key],
    );
  }, [profileForm, selectedEmployee]);

  useLayoutEffect(() => {
    const updateOffset = () => {
      if (!tableCardRef.current) return;
      const rect = tableCardRef.current.getBoundingClientRect();
      setTableOffsetTop(rect.top);
    };

    updateOffset();
    const onResize = () => requestAnimationFrame(updateOffset);
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, [isProfilePanelOpen, employees.length, filteredEmployees.length]);

  const tableBottomGap = 32;
  const tableFooterHeight = 32;
  const tableMaxHeight =
    tableOffsetTop > 0
      ? `calc(100vh - ${tableOffsetTop}px - ${tableBottomGap + tableFooterHeight}px)`
      : `calc(100vh - ${380 + tableBottomGap + tableFooterHeight}px)`;
  const tableBodyMaxHeight =
    tableOffsetTop > 0
      ? `calc(100vh - ${tableOffsetTop}px - ${tableBottomGap + tableFooterHeight + 56}px)`
      : `calc(100vh - ${380 + tableBottomGap + tableFooterHeight + 56}px)`;
  const totalPages =
    totalFilteredEmployees !== null ? Math.ceil(totalFilteredEmployees / DEFAULT_PAGE_SIZE) : null;
  const isFirstPage = currentPage === 1;
  const isLastPage =
    totalFilteredEmployees !== null
      ? currentPage >= Math.max(totalPages ?? 1, 1)
      : employees.length < DEFAULT_PAGE_SIZE;
  const contractFilterLabel =
    contractFilter === "all" ? "All" : contractFilter === "permanent" ? "Permanent" : "Temporary";
  const genderFilterLabel = genderFilter === "all" ? "All" : genderFilter;
  const raceFilterLabel = raceFilter === "all" ? "All" : raceFilter;
  const nationalityFilterLabel = nationalityFilter === "all" ? "All" : nationalityFilter;

  const handleDocumentCategorySelect = (path: string) => {
    const targetEmployee = documentDialogEmployee || selectedEmployee;
    const selectedDocument = documentPathToKey[path];
    const state = {
      ...(targetEmployee
        ? {
            employeeName: (targetEmployee.employee_name ?? "").trim(),
            employeeSurname: (targetEmployee.employee_surname ?? "").trim(),
            employeeIdNumber: targetEmployee.id_number ?? "",
          }
        : {}),
      ...(selectedDocument ? { selectedDocument } : {}),
    };
    setDocumentDialogEmployee(null);
    if (selectedDocument) {
      navigate("/documents", { state });
      return;
    }
    navigate(path, { state: Object.keys(state).length > 0 ? state : undefined });
  };

  useEffect(() => {
    if (documentDialogEmployee) {
      setSelectedDocumentPath(firstActiveDocPath);
    }
  }, [documentDialogEmployee, firstActiveDocPath]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (isReadOnlyTab && isEditMode) {
      setIsEditMode(false);
    }
  }, [isReadOnlyTab, isEditMode]);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) {
      setShowScrollHint(false);
      return;
    }

    const updateHint = () => {
      const canScroll = el.scrollHeight > el.clientHeight + 1;
      const atBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight - 1;
      setShowScrollHint(canScroll && !atBottom);
    };

    updateHint();
    el.addEventListener("scroll", updateHint);
    window.addEventListener("resize", updateHint);

    return () => {
      el.removeEventListener("scroll", updateHint);
      window.removeEventListener("resize", updateHint);
    };
  }, [filteredEmployees]);

  const clearDeleteUndoTimers = useCallback(() => {
    if (deleteUndoTimeoutRef.current) {
      clearTimeout(deleteUndoTimeoutRef.current);
      deleteUndoTimeoutRef.current = null;
    }
    if (deleteUndoIntervalRef.current) {
      clearInterval(deleteUndoIntervalRef.current);
      deleteUndoIntervalRef.current = null;
    }
  }, []);

  const clearDeleteUndoState = useCallback(() => {
    clearDeleteUndoTimers();
    setDeleteUndo(null);
    setDeleteUndoCountdown(0);
  }, [clearDeleteUndoTimers]);

  const startDeleteUndoTimers = useCallback(
    (expiresAt: number) => {
      clearDeleteUndoTimers();
      const updateCountdown = () => {
        const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
        setDeleteUndoCountdown(remaining);
      };
      updateCountdown();
      deleteUndoIntervalRef.current = setInterval(updateCountdown, 1000);
      deleteUndoTimeoutRef.current = setTimeout(() => {
        clearDeleteUndoState();
      }, Math.max(0, expiresAt - Date.now()));
    },
    [clearDeleteUndoTimers, clearDeleteUndoState],
  );

  useEffect(() => {
    if (deleteUndo) {
      startDeleteUndoTimers(deleteUndo.expiresAt);
    } else {
      clearDeleteUndoTimers();
      setDeleteUndoCountdown(0);
    }
    return () => {
      clearDeleteUndoTimers();
    };
  }, [deleteUndo, startDeleteUndoTimers, clearDeleteUndoTimers]);

  const clearWarningDeleteTimers = useCallback(() => {
    if (warningDeleteTimeoutRef.current) {
      clearTimeout(warningDeleteTimeoutRef.current);
      warningDeleteTimeoutRef.current = null;
    }
    if (warningDeleteIntervalRef.current) {
      clearInterval(warningDeleteIntervalRef.current);
      warningDeleteIntervalRef.current = null;
    }
  }, []);

  const clearWarningDeleteState = useCallback(() => {
    clearWarningDeleteTimers();
    setWarningDeleteUndo(null);
    setWarningDeleteCountdown(0);
  }, [clearWarningDeleteTimers]);

  const startWarningDeleteTimers = useCallback(
    (pending: WarningDeleteUndoState) => {
      clearWarningDeleteTimers();
      setWarningDeleteUndo(pending);
      const updateCountdown = () => {
        const remaining = Math.max(0, Math.ceil((pending.expiresAt - Date.now()) / 1000));
        setWarningDeleteCountdown(remaining);
      };
      updateCountdown();
      warningDeleteIntervalRef.current = setInterval(updateCountdown, 1000);
      warningDeleteTimeoutRef.current = setTimeout(async () => {
        if (pending.storagePath) {
          await supabase.storage.from("warnings").remove([pending.storagePath]);
        }
        clearWarningDeleteState();
      }, Math.max(0, pending.expiresAt - Date.now()));
    },
    [clearWarningDeleteState, clearWarningDeleteTimers],
  );

  const handleUndoWarningDelete = async () => {
    if (!warningDeleteUndo || !selectedEmployee || !user) return;
    const { warning, employeeId } = warningDeleteUndo;
    const { error } = await warningTable().insert({
      id: warning.id,
      company_id: user.id,
      employee_id: employeeId,
      misconduct_type: warning.misconductType,
      warning_type: warning.warningType,
      issue_date: warning.issueDate,
      expiry_date: warning.expiryDate,
      file_url: warning.fileUrl,
    });
    if (error) {
      toast({
        title: "Unable to restore warning",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
      return;
    }
    setWarningsByEmployee((prev) => {
      const existing = prev[employeeId] ?? [];
      return {
        ...prev,
        [employeeId]: [warning, ...existing],
      };
    });
    clearWarningDeleteState();
    toast({
      title: "Warning restored",
      description: "The warning has been restored.",
    });
  };

  const isPdfFile = (fileName?: string) => fileName?.toLowerCase().endsWith(".pdf") ?? false;

  const canSaveWarning =
    !!selectedEmployee &&
    warningForm.misconductTypes.length > 0 &&
    warningForm.issueDate.trim().length > 0 &&
    (editingWarning ? !!editingWarning.fileUrl : isPdfFile(warningForm.fileName) && !!warningFile);
  const fetchWarnings = useCallback(
    async (employeeId: string) => {
      if (!user) return;
      const { data, error } = await warningTable()
        .select("id, misconduct_type, warning_type, issue_date, expiry_date, file_url")
        .eq("company_id", user.id)
        .eq("employee_id", employeeId)
        .order("issue_date", { ascending: false });

      if (error) {
        toast({
          title: "Unable to load warnings",
          description: getSafeErrorMessage(error),
          variant: "destructive",
        });
        return;
      }

      const mapped: EmployeeWarning[] =
        (data ?? []).map((row: any) => ({
          id: row.id,
          misconductType: row.misconduct_type,
          warningType: row.warning_type,
          issueDate: row.issue_date,
          expiryDate: row.expiry_date,
          fileName: row.file_url ? row.file_url.split("/").pop() || "warning.pdf" : "",
          fileUrl: row.file_url,
        })) ?? [];

      setWarningsByEmployee((prev) => ({
        ...prev,
        [employeeId]: mapped,
      }));
    },
    [toast, user],
  );

  useEffect(() => {
    if (selectedEmployee) {
      fetchWarnings(selectedEmployee.id);
    }
  }, [selectedEmployee, fetchWarnings]);

  const resetWarningForm = () => {
    setWarningForm({
      misconductTypes: [],
      warningType: "First",
      issueDate: dateToday(),
      fileName: "",
    });
    setWarningFile(null);
    setEditingWarning(null);
  };

  const handleSaveWarning = async () => {
    const isEditing = !!editingWarning;
    if (!selectedEmployee || !user) {
      toast({
        title: "No employee selected",
        description: "Select an employee before adding a warning.",
        variant: "destructive",
      });
      return;
    }

    const missingFile = isEditing ? !editingWarning?.fileUrl : !warningFile;
    if (
      warningForm.misconductTypes.length === 0 ||
      !warningForm.issueDate ||
      missingFile ||
      (!isEditing && warningFile && !isPdfFile(warningForm.fileName))
    ) {
      toast({
        title: "Missing details",
        description: "Please select misconduct, warning type, issue date, and upload a PDF warning.",
        variant: "destructive",
      });
      return;
    }

    const expiryDate = computeWarningExpiry(warningForm.warningType, warningForm.issueDate);
    const warningPayload = {
      misconduct_type: JSON.stringify(warningForm.misconductTypes),
      warning_type: warningForm.warningType,
      issue_date: warningForm.issueDate,
      expiry_date: expiryDate,
    };

    if (!isEditing) {
      const safeName = warningFile!.name.replace(/\s+/g, "_");
      const filePath = `${user.id}/${selectedEmployee.id}-${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage.from("warnings").upload(filePath, warningFile!, {
        cacheControl: "3600",
        upsert: false,
        contentType: warningFile!.type || "application/pdf",
      });

      if (uploadError) {
        toast({
          title: "Upload failed",
          description: getSafeErrorMessage(uploadError),
          variant: "destructive",
        });
        return;
      }

      const { error: insertError } = await warningTable().insert({
        company_id: user.id,
        employee_id: selectedEmployee.id,
        ...warningPayload,
        file_url: filePath,
      });

      if (insertError) {
        toast({
          title: "Unable to save warning",
          description: getSafeErrorMessage(insertError),
          variant: "destructive",
        });
        return;
      }
    } else {
      const currentWarning = editingWarning;
      if (!currentWarning) return;
      const filePath = currentWarning.fileUrl || "";
      const { error: updateError } = await warningTable()
        .update({
          ...warningPayload,
          file_url: filePath,
        })
        .eq("id", currentWarning.id)
        .eq("company_id", user.id);

      if (updateError) {
        toast({
          title: "Unable to update warning",
          description: getSafeErrorMessage(updateError),
          variant: "destructive",
        });
        return;
      }

    }

    await fetchWarnings(selectedEmployee.id);
    resetWarningForm();
    setIsWarningDialogOpen(false);
    toast({
      title: isEditing ? "Warning updated" : "Warning uploaded",
      description: isEditing
        ? "The warning has been updated."
        : "The warning has been saved and will appear in the lists below.",
    });
  };

  const handleWarningFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && !isPdfFile(file.name)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file.",
        variant: "destructive",
      });
      event.target.value = "";
      setWarningForm((prev) => ({ ...prev, fileName: "" }));
      setWarningFile(null);
      return;
    }
    setWarningForm((prev) => ({
      ...prev,
      fileName: file?.name || "",
    }));
    setWarningFile(file ?? null);
  };

  const goToWarningGenerator = () => {
    if (!selectedEmployee) {
      toast({
        title: "No employee selected",
        description: "Open an employee profile before generating a warning.",
        variant: "destructive",
      });
      return;
    }

    navigate("/documents/discipline/warnings", {
      state: {
        employeeName: selectedEmployee.employee_name ?? "",
        employeeSurname: selectedEmployee.employee_surname ?? "",
        employeeIdNumber: selectedEmployee.id_number ?? "",
      },
    });
  };

  const handleDeleteWarning = async (warningId: string, fileUrl?: string) => {
    if (!selectedEmployee || !user) return;
    const confirmed = confirm("Are you sure you want to delete this warning?");
    if (!confirmed) return;
    const existing = warningsByEmployee[selectedEmployee.id] ?? [];
    const warning = existing.find((w) => w.id === warningId);
    if (!warning) return;

    // Optimistically remove from UI
    const next = existing.filter((w) => w.id !== warningId);
    setWarningsByEmployee((prev) => ({
      ...prev,
      [selectedEmployee.id]: next,
    }));

    const storagePath = getStoragePathFromUrl(fileUrl);

    // Delete from DB immediately
    const { error: deleteError } = await warningTable()
      .delete()
      .eq("id", warningId)
      .eq("company_id", user.id);

    if (deleteError) {
      // revert
      setWarningsByEmployee((prev) => ({
        ...prev,
        [selectedEmployee.id]: existing,
      }));
      toast({
        title: "Unable to delete warning",
        description: getSafeErrorMessage(deleteError),
        variant: "destructive",
      });
      return;
    }

    const expiresAt = Date.now() + 20_000;
    startWarningDeleteTimers({
      warning,
      employeeId: selectedEmployee.id,
      storagePath,
      expiresAt,
    });

    toast({
      title: "Warning deleted",
      description: "You can undo this for 20 seconds.",
    });
  };

  const handleOpenWarning = async (warning: EmployeeWarning) => {
    if (!warning.fileUrl) return;
    const storagePath = getStoragePathFromUrl(warning.fileUrl);
    const { data, error } = await supabase.storage
      .from("warnings")
      .createSignedUrl(storagePath, 60);
    if (error || !data?.signedUrl) {
      toast({
        title: "Unable to open warning",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleEditWarning = (warning: EmployeeWarning) => {
    setEditingWarning(warning);
    setWarningForm({
      misconductTypes: parseMisconductTypes(warning.misconductType),
      warningType: warning.warningType,
      issueDate: warning.issueDate || dateToday(),
      fileName: warning.fileName || "",
    });
    setWarningFile(null);
    setIsWarningDialogOpen(true);
  };

  const warningsForSelectedEmployee = useMemo(
    () => (selectedEmployee ? warningsByEmployee[selectedEmployee.id] ?? [] : []),
    [selectedEmployee, warningsByEmployee],
  );

  const warningsByStatus = useMemo(() => {
    const todayISO = dateToday();
    const isValid = (warning: EmployeeWarning) => warning.expiryDate && warning.expiryDate >= todayISO;
    return {
      valid: warningsForSelectedEmployee.filter(isValid),
      expired: warningsForSelectedEmployee.filter((w) => !isValid(w)),
    };
  }, [warningsForSelectedEmployee]);

  const canUploadContract =
    !!selectedEmployee &&
    contractForm.contractType.trim().length > 0 &&
    isPdfFile(contractForm.fileName) &&
    !!contractFile;

  const fetchContracts = useCallback(
    async (employeeId: string) => {
      if (!user) return;
      const { data, error } = await contractTable()
        .select("id, contract_type, issue_date, file_url, is_active")
        .eq("company_id", user.id)
        .eq("employee_id", employeeId)
        .order("issue_date", { ascending: false });

      if (error) {
        toast({
          title: "Unable to load contracts",
          description: getSafeErrorMessage(error),
          variant: "destructive",
        });
        return;
      }

      const mapped: EmployeeContract[] =
        (data ?? []).map((row: any) => ({
          id: row.id,
          contractType: row.contract_type,
          issueDate: row.issue_date,
          fileName: row.file_url ? row.file_url.split("/").pop() || "contract.pdf" : "",
          fileUrl: row.file_url,
          isActive: row.is_active ?? false,
        })) ?? [];

      setContractsByEmployee((prev) => ({
        ...prev,
        [employeeId]: mapped,
      }));
    },
    [toast, user],
  );

  const fetchActiveContractsForEmployees = useCallback(
    async (employeeIds: string[]) => {
      if (!user) return;
      if (employeeIds.length === 0) {
        setActiveContractsByEmployee({});
        return;
      }

      const { data, error } = await contractTable()
        .select("employee_id")
        .eq("company_id", user.id)
        .eq("is_active", true)
        .in("employee_id", employeeIds);

      if (error) {
        toast({
          title: "Unable to load contract status",
          description: getSafeErrorMessage(error),
          variant: "destructive",
        });
        return;
      }

      const activeIds = new Set((data ?? []).map((row: any) => row.employee_id));
      const next: Record<string, boolean> = {};
      employeeIds.forEach((id) => {
        next[id] = activeIds.has(id);
      });
      setActiveContractsByEmployee(next);
    },
    [toast, user],
  );

  useEffect(() => {
    if (selectedEmployee) {
      fetchContracts(selectedEmployee.id);
    }
  }, [selectedEmployee, fetchContracts]);

  const handleAddContract = async () => {
    if (!selectedEmployee || !user) {
      toast({
        title: "No employee selected",
        description: "Select an employee before adding a contract.",
        variant: "destructive",
      });
      return;
    }
    if (!contractForm.contractType || !isPdfFile(contractForm.fileName) || !contractFile) {
      toast({
        title: "Missing details",
        description: "Please select a contract type and upload a PDF contract.",
        variant: "destructive",
      });
      return;
    }

    const safeName = contractFile.name.replace(/\s+/g, "_");
    const filePath = `${user.id}/${selectedEmployee.id}-${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("contracts").upload(filePath, contractFile, {
      cacheControl: "3600",
      upsert: false,
      contentType: contractFile.type || "application/pdf",
    });

    if (uploadError) {
      toast({
        title: "Upload failed",
        description: getSafeErrorMessage(uploadError),
        variant: "destructive",
      });
      return;
    }

    const { data: inserted, error: insertError } = await contractTable()
      .insert({
        company_id: user.id,
        employee_id: selectedEmployee.id,
        contract_type: contractForm.contractType,
        issue_date: dateToday(),
        file_url: filePath,
        is_active: true,
      })
      .select("id")
      .single();

    if (insertError) {
      toast({
        title: "Unable to save contract",
        description: getSafeErrorMessage(insertError),
        variant: "destructive",
      });
      return;
    }

    if (inserted?.id) {
      const { error: deactivateError } = await contractTable()
        .update({ is_active: false })
        .eq("company_id", user.id)
        .eq("employee_id", selectedEmployee.id)
        .neq("id", inserted.id)
        .eq("is_active", true);

      if (deactivateError) {
        toast({
          title: "Contract saved",
          description: "Unable to deactivate previous contracts automatically.",
          variant: "destructive",
        });
      }
    }

    await fetchContracts(selectedEmployee.id);
    void fetchActiveContractsForEmployees(employees.map((employee) => employee.id));
    setContractForm({
      contractType: "",
      fileName: "",
    });
    setContractFile(null);
    setIsContractDialogOpen(false);
    toast({
      title: "Contract uploaded",
      description: "The contract has been saved and will appear in the list below.",
    });
  };

  const handleContractFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && !isPdfFile(file.name)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file.",
        variant: "destructive",
      });
      event.target.value = "";
      setContractForm((prev) => ({ ...prev, fileName: "" }));
      setContractFile(null);
      return;
    }
    setContractForm((prev) => ({
      ...prev,
      fileName: file?.name || "",
    }));
    setContractFile(file ?? null);
  };

  const handleDeleteContract = async (contractId: string, fileUrl?: string) => {
    if (!selectedEmployee || !user) return;
    const confirmed = confirm("Are you sure you want to delete this contract?");
    if (!confirmed) return;
    const existing = contractsByEmployee[selectedEmployee.id] ?? [];
    const contract = existing.find((item) => item.id === contractId);
    if (!contract) return;

    setContractsByEmployee((prev) => ({
      ...prev,
      [selectedEmployee.id]: existing.filter((item) => item.id !== contractId),
    }));

    const { error: deleteError } = await contractTable()
      .delete()
      .eq("id", contractId)
      .eq("company_id", user.id);

    if (deleteError) {
      setContractsByEmployee((prev) => ({
        ...prev,
        [selectedEmployee.id]: existing,
      }));
      toast({
        title: "Unable to delete contract",
        description: getSafeErrorMessage(deleteError),
        variant: "destructive",
      });
      return;
    }

    const storagePath = getContractStoragePathFromUrl(fileUrl);
    if (storagePath) {
      await supabase.storage.from("contracts").remove([storagePath]);
    }

    toast({
      title: "Contract deleted",
      description: "The contract has been removed.",
    });

    void fetchActiveContractsForEmployees(employees.map((employee) => employee.id));
  };

  const handleStartContractUpload = () => {
    const activeContract = contractsByStatus.active[0];
    if (activeContract) {
      const uploadedDate = formatDisplayDate(activeContract.issueDate);
      const shouldDelete = confirm(
        `An active contract uploaded on ${uploadedDate} already exists. Click OK to permanently delete it from all records first, or Cancel to keep it and upload a new one (the existing contract will become inactive).`,
      );
      if (shouldDelete) {
        void handleDeleteContract(activeContract.id, activeContract.fileUrl);
      }
    }
    setIsContractDialogOpen(true);
  };

  const handleOpenContract = async (contract: EmployeeContract) => {
    if (!contract.fileUrl) return;
    const storagePath = getContractStoragePathFromUrl(contract.fileUrl);
    const { data, error } = await supabase.storage
      .from("contracts")
      .createSignedUrl(storagePath, 60);
    if (error || !data?.signedUrl) {
      toast({
        title: "Unable to open contract",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const contractsForSelectedEmployee = useMemo(
    () => (selectedEmployee ? contractsByEmployee[selectedEmployee.id] ?? [] : []),
    [selectedEmployee, contractsByEmployee],
  );

  const contractsByStatus = useMemo(
    () => ({
      active: contractsForSelectedEmployee.filter((contract) => contract.isActive),
      inactive: contractsForSelectedEmployee.filter((contract) => !contract.isActive),
    }),
    [contractsForSelectedEmployee],
  );

  const misconductOptions = useMemo(() => {
    if (conductOffences.length > 0) return conductOffences;
    return MISCONDUCT_TYPES.map((name) => ({ name, category: "Serious" as const, firstOutcome: "" }));
  }, [conductOffences]);

  const misconductColorClasses = (category: "Minor" | "Serious" | "Dismissible") => {
    if (category === "Minor") return "text-emerald-700";
    if (category === "Serious") return "text-amber-700";
    return "text-red-700";
  };

  const misconductCheckboxClasses = (category: "Minor" | "Serious" | "Dismissible") => {
    if (category === "Minor") {
      return "border-emerald-500 data-[state=checked]:bg-emerald-100 data-[state=checked]:border-emerald-600 text-emerald-700";
    }
    if (category === "Serious") {
      return "border-amber-500 data-[state=checked]:bg-amber-100 data-[state=checked]:border-amber-600 text-amber-700";
    }
    return "border-red-500 data-[state=checked]:bg-red-100 data-[state=checked]:border-red-600 text-red-700";
  };

  const getMisconductCategory = (name: string): "Minor" | "Serious" | "Dismissible" => {
    const found = conductOffences.find((item) => item.name === name);
    return found?.category ?? "Serious";
  };

  const filteredMisconductTypes = useMemo(() => {
    const query = misconductSearch.trim().toLowerCase();
    if (!query) return misconductOptions;
    return misconductOptions.filter((type) => type.name.toLowerCase().includes(query));
  }, [misconductSearch, misconductOptions]);

  const toggleWarningMisconduct = (type: string) => {
    setWarningForm((prev) => {
      const exists = prev.misconductTypes.includes(type);
      const next = exists
        ? prev.misconductTypes.filter((item) => item !== type)
        : [...prev.misconductTypes, type];
      return { ...prev, misconductTypes: next };
    });
  };

  const handleMisconductMenuOpenChange = (open: boolean) => {
    setIsMisconductMenuOpen(open);
    if (!open) {
      setMisconductSearch("");
    }
  };

  const renderProfilePanel = () => {
    if (!selectedEmployee) return null;

    return (
      <div className="flex h-full flex-col rounded-sm bg-white px-6 py-5">
        <div className="flex items-start justify-between gap-4 pt-2">
          <div className="space-y-6 w-full">
            <div className="flex items-center justify-between gap-3 w-full">
              <Button
                variant="outline"
                className="h-8 px-3 text-xs rounded-sm"
                onClick={closeProfileDialog}
              >
                Back
              </Button>
              {!isReadOnlyTab && (
                <Button
                  variant="outline"
                  className="h-8 px-3 text-xs gap-1.5 rounded-sm"
                  onClick={() => setIsEditMode((prev) => !prev)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {isEditMode ? "Cancel" : "Edit"}
                </Button>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-700">Profile of:</p>
              <h1 className="text-3xl font-bold text-blue-700">
                {(selectedEmployee.employee_name ?? "").trim()} {(selectedEmployee.employee_surname ?? "").trim()}
              </h1>
              <p className="text-xs text-gray-600">
                View and edit this employee&apos;s information here.
              </p>
            </div>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as EmployeeTab)}
          className="mt-8"
        >
          <div className="flex flex-col gap-3">
            <div className="relative">
            <TabsList className="h-auto w-full flex-wrap justify-start gap-0 bg-transparent px-0 py-0 shadow-none">
              <TabsTrigger value="personal" className="rounded-none border-b-[3px] border-transparent px-4 py-1 text-left text-sm font-medium text-slate-500 data-[state=inactive]:hover:text-slate-800 data-[state=active]:bg-white data-[state=active]:border-blue-600 data-[state=active]:text-slate-900 data-[state=active]:shadow-none">
                Personal
              </TabsTrigger>
              <TabsTrigger value="employment" className="rounded-none border-b-[3px] border-transparent px-4 py-1 text-left text-sm font-medium text-slate-500 data-[state=inactive]:hover:text-slate-800 data-[state=active]:bg-white data-[state=active]:border-blue-600 data-[state=active]:text-slate-900 data-[state=active]:shadow-none">
                Employment
              </TabsTrigger>
              <TabsTrigger value="address" className="rounded-none border-b-[3px] border-transparent px-4 py-1 text-left text-sm font-medium text-slate-500 data-[state=inactive]:hover:text-slate-800 data-[state=active]:bg-white data-[state=active]:border-blue-600 data-[state=active]:text-slate-900 data-[state=active]:shadow-none">
                Address
              </TabsTrigger>
              <TabsTrigger value="discipline" className="rounded-none border-b-[3px] border-transparent px-4 py-1 text-left text-sm font-medium text-slate-500 data-[state=inactive]:hover:text-slate-800 data-[state=active]:bg-white data-[state=active]:border-blue-600 data-[state=active]:text-slate-900 data-[state=active]:shadow-none">
                Warnings
              </TabsTrigger>
              <TabsTrigger value="contracts" className="rounded-none border-b-[3px] border-transparent px-4 py-1 text-left text-sm font-medium text-slate-500 data-[state=inactive]:hover:text-slate-800 data-[state=active]:bg-white data-[state=active]:border-blue-600 data-[state=active]:text-slate-900 data-[state=active]:shadow-none">
                Contract
              </TabsTrigger>
            </TabsList>
            <div className="pointer-events-none absolute left-0 right-0 bottom-0 h-px bg-slate-200" aria-hidden="true" />
            </div>
            <div className="flex-1 px-0">
              <TabsContent value="personal" className="mt-4 pb-4">
                {renderPersonalTab()}
              </TabsContent>
              <TabsContent value="employment" className="mt-4 pb-4">
                {renderEmploymentTab()}
              </TabsContent>
              <TabsContent value="address" className="mt-4 pb-4">
                {renderAddressTab()}
              </TabsContent>
              <TabsContent value="discipline" className="mt-4 pb-4">
                {renderDisciplineTab()}
              </TabsContent>
              <TabsContent value="contracts" className="mt-4 pb-4">
                {renderContractTab()}
              </TabsContent>
            </div>
          </div>
        </Tabs>

        <div className="mt-auto flex items-center justify-center pt-4">
          {!isReadOnlyTab && isEditMode && (
            <Button
              className="h-9 px-10 text-xs min-w-[200px]"
              onClick={handleProfileSave}
              disabled={!isEditMode || !isProfileDirty || isProfileSaving}
            >
              {isProfileSaving ? "Saving..." : "Save"}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const fetchEmployees = useCallback(async () => {
    if (!user) return;
    const from = (currentPage - 1) * DEFAULT_PAGE_SIZE;
    const to = from + DEFAULT_PAGE_SIZE - 1;
    const queryText = searchQuery.trim();
    let query = (supabase as any)
      .from("employees")
      .select(
        "id, company_id, employee_name, employee_surname, id_number, start_date, end_date, contract_type, gender, race, nationality, employee_number, job_title, physical_address_line1, physical_address_line2, city, province, area_code, postal_address_line1, postal_address_line2, postal_city, postal_province, postal_area_code, cell_number, email, emergency_contact_name, emergency_contact_number, created_at",
        { count: "exact" },
      )
      .eq("company_id", user.id);

    if (contractFilter !== "all") {
      query = query.ilike("contract_type", contractFilter);
    }

    if (queryText.length > 0) {
      const escaped = queryText.replace(/%/g, "\\%").replace(/_/g, "\\_");
      query = query.or(
        `employee_name.ilike.%${escaped}%,employee_surname.ilike.%${escaped}%,id_number.ilike.%${escaped}%,employee_number.ilike.%${escaped}%,job_title.ilike.%${escaped}%`,
      );
    }

    const { data, error, count } = await query
      .order("employee_name", { ascending: true, nullsFirst: false })
      .order("employee_surname", { ascending: true, nullsFirst: false })
      .range(from, to);

    if (error) {
      setTotalEmployees(null);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    if (typeof count === "number") {
      setTotalFilteredEmployees(count);
      if (count === 0 && currentPage !== 1) {
        setCurrentPage(1);
        return;
      }
      if (count > 0 && from >= count && currentPage > 1) {
        const lastPage = Math.max(1, Math.ceil(count / DEFAULT_PAGE_SIZE));
        setCurrentPage(lastPage);
        return;
      }
    } else {
      setTotalFilteredEmployees(null);
    }

    const [{ count: totalCount }, { count: permanentCount }, { count: temporaryCount }] = await Promise.all([
      (supabase as any)
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("company_id", user.id),
      (supabase as any)
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("company_id", user.id)
        .ilike("contract_type", "permanent"),
      (supabase as any)
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("company_id", user.id)
        .ilike("contract_type", "temporary"),
    ]);

    setTotalEmployees(typeof totalCount === "number" ? totalCount : null);
    setTotalPermanentEmployees(typeof permanentCount === "number" ? permanentCount : null);
    setTotalTemporaryEmployees(typeof temporaryCount === "number" ? temporaryCount : null);

    const sorted = (data ?? []).sort((a, b) => {
      const nameA = `${a.employee_name ?? ""} ${a.employee_surname ?? ""}`.trim().toLowerCase();
      const nameB = `${b.employee_name ?? ""} ${b.employee_surname ?? ""}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });

    setEmployees(sorted);
    setFilteredEmployees(sorted);
    void fetchActiveContractsForEmployees(sorted.map((employee) => employee.id));
  }, [toast, user, currentPage, fetchActiveContractsForEmployees, searchQuery, contractFilter]);

  const fetchConductOffences = useCallback(async () => {
    if (!user) return;
    const { data, error } = await (supabase as any)
      .from("company_code_of_conduct")
      .select("data")
      .eq("company_id", user.id)
      .maybeSingle();
    if (error) {
      return;
    }

    const raw = (data?.data as any) ?? null;
    const sections = Array.isArray(raw?.sections)
      ? (raw.sections as OffenceSection[])
      : Array.isArray(raw)
        ? (raw as OffenceSection[])
        : [];

    const mapped = sections
      .flatMap((section) => {
        const sectionCategory = section.title?.toLowerCase().includes("dismiss")
          ? "Dismissible"
          : section.title?.toLowerCase().includes("minor")
            ? "Minor"
            : section.title?.toLowerCase().includes("serious")
              ? "Serious"
              : undefined;
        return (section.offences ?? []).map((offence) => {
          const name = offence.name?.trim();
          if (!name) return null;
          const category =
            (offence.category as "Minor" | "Serious" | "Dismissible" | undefined) ?? sectionCategory ?? "Serious";
          return { name, category, firstOutcome: offence.first ?? "" };
        });
      })
      .filter(
        (item): item is ConductOffence =>
          Boolean(item?.name),
      );

    if (mapped.length > 0) {
      setConductOffences(mapped);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadEmployees = async () => {
      setIsEmployeesLoading(true);
      await fetchEmployees();
      if (!cancelled) setIsEmployeesLoading(false);
    };

    void loadEmployees();
    return () => {
      cancelled = true;
    };
  }, [user, fetchEmployees]);

  useEffect(() => {
    if (user) {
      void fetchConductOffences();
    }
  }, [user, fetchConductOffences]);

  useEffect(() => {
    setCurrentPage(1);
  }, [user?.id]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, contractFilter, genderFilter, raceFilter, nationalityFilter]);

  useEffect(() => {
    const query = searchQuery.toLowerCase();
    const filtered = employees.filter((emp) => {
      const fullName = `${emp.employee_name ?? ""} ${emp.employee_surname ?? ""}`.trim().toLowerCase();
      const idNumber = (emp.id_number ?? "").toLowerCase();
      const employeeNumber = (emp.employee_number ?? "").toLowerCase();
      const jobTitle = (emp.job_title ?? "").toLowerCase();
      const matchesSearch =
        fullName.includes(query) || idNumber.includes(query) || employeeNumber.includes(query) || jobTitle.includes(query);

      const contractType = (emp.contract_type ?? "").toLowerCase();
      const matchesContract =
        contractFilter === "all" ||
        (contractFilter === "permanent" && contractType === "permanent") ||
        (contractFilter === "temporary" && contractType === "temporary");

      const genderValue = (emp.gender ?? "").toLowerCase();
      const raceValue = (emp.race ?? "").toLowerCase();
      const nationalityValue = (emp.nationality ?? "").trim().toLowerCase();
      const nationalityGroup = nationalityValue === "south african" ? "rsa" : "other";
      const matchesGender = genderFilter === "all" || genderValue === genderFilter.toLowerCase();
      const matchesRace = raceFilter === "all" || raceValue === raceFilter.toLowerCase();
      const matchesNationality =
        nationalityFilter === "all" || nationalityGroup === nationalityFilter.toLowerCase();

      return matchesSearch && matchesContract && matchesGender && matchesRace && matchesNationality;
    });

    const sorted = filtered.sort((a, b) => {
      const nameA = `${a.employee_name ?? ""} ${a.employee_surname ?? ""}`.trim().toLowerCase();
      const nameB = `${b.employee_name ?? ""} ${b.employee_surname ?? ""}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });

    setFilteredEmployees(sorted);
  }, [employees, searchQuery, contractFilter, genderFilter, raceFilter, nationalityFilter]);

  useEffect(() => {
    // Keep selections in sync with the currently filtered list to avoid deleting hidden rows.
    setSelectedEmployees((prev) => {
      if (prev.size === 0) return prev;
      const allowedIds = new Set(filteredEmployees.map((emp) => emp.id));
      const next = new Set(Array.from(prev).filter((id) => allowedIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filteredEmployees]);

  const handleCustomEmployeeNumberChange = (value: string) => {
    const cleaned = cleanEmployeeNumberInput(value);
    setProfileForm((prev) => ({
      ...prev,
      employeeNumber: cleaned,
    }));
  };

  const handleUndoDelete = async () => {
    if (!deleteUndo) return;
    try {
      const payload = deleteUndo.deletedEmployees.map((employee) => ({
        ...employee,
        created_at: employee.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from("employees").upsert(payload, { onConflict: "id" });
      if (error) throw error;

      toast({
        title: "Employees restored",
        description: `${deleteUndo.deletedEmployees.length} employee(s) were restored.`,
      });
      clearDeleteUndoState();
      await fetchEmployees();
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to undo deletion",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    }
  };

   const handleAddEmployee = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!user) return;
     setIsLoading(true);
    try {
      const validated = employeeBasicSchema.parse(addForm);
      const normalizedNumber = normalizeEmployeeNumber(validated.employeeNumber);
      const duplicate = normalizedNumber
        ? employees.find((emp) => normalizeEmployeeNumber(emp.employee_number) === normalizedNumber)
        : undefined;
      if (duplicate) {
        toast({
          title: "Duplicate employee number",
          description: `You already allocated that employee number to ${duplicate.employee_name ?? "Employee"} ${duplicate.employee_surname ?? ""}. Please choose a different employee number.`,
          variant: "destructive",
        });
        return;
      }
      const addPayload: EmployeeInsert = {
        company_id: user.id,
        employee_name: validated.employeeName,
        employee_surname: validated.employeeSurname,
        id_number: validated.idNumber || null,
        employee_number: validated.employeeNumber || null,
      };
      const { error } = await supabase
        .from("employees")
        .insert(addPayload as TablesInsert<"employees">);
       if (error) throw error;

      toast({
        title: "Success",
        description: "Employee added successfully!",
      });
      setAddForm(createBlankAddForm());
      setIsAddDialogOpen(false);
      await fetchEmployees();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
   };

  const handleProfileSave = async () => {
    if (!selectedEmployee) return;
    setIsProfileSaving(true);
    try {
      const validated = employeeProfileSchema.parse(profileForm);
       const endDateValue =
         validated.contractType === "Temporary" && validated.endDate ? validated.endDate : null;
       const finalEmployeeNumber = validated.employeeNumber || null;
       const normalizedNumber = normalizeEmployeeNumber(finalEmployeeNumber);
       const duplicate = normalizedNumber
         ? employees.find(
             (emp) =>
               emp.id !== selectedEmployee.id &&
               normalizeEmployeeNumber(emp.employee_number) === normalizedNumber,
           )
         : undefined;
       if (duplicate) {
         toast({
           title: "Duplicate employee number",
           description: `You already allocated that employee number to ${duplicate.employee_name ?? "Employee"} ${duplicate.employee_surname ?? ""}. Please choose a different employee number.`,
           variant: "destructive",
         });
         setIsProfileSaving(false);
         return;
       }

        const updatePayload: EmployeeUpdate = {
          employee_name: validated.employeeName,
          employee_surname: validated.employeeSurname,
          id_number: validated.idNumber || null,
          start_date: validated.startDate,
          contract_type: validated.contractType,
          end_date: endDateValue,
          nationality: validated.nationality,
          gender: validated.gender,
          race: validated.race,
          employee_number: finalEmployeeNumber,
          job_title: validated.jobTitle || null,
          physical_address_line1: validated.physicalAddressLine1 || null,
          physical_address_line2: validated.physicalAddressLine2 || null,
          city: validated.city || null,
          province: validated.province,
          area_code: validated.areaCode || null,
          postal_address_line1: validated.postalAddressLine1 || null,
          postal_address_line2: validated.postalAddressLine2 || null,
          postal_city: validated.postalCity || null,
          postal_province: validated.postalProvince || null,
          postal_area_code: validated.postalAreaCode || null,
          cell_number: validated.cellNumber || null,
          email: validated.email || null,
          emergency_contact_name: validated.emergencyContactName || null,
        emergency_contact_number: validated.emergencyContactNumber || null,
      };

       const { error } = await supabase
         .from("employees")
         .update(updatePayload as unknown as TablesInsert<"employees">)
         .eq("id", selectedEmployee.id);

       if (error) throw error;

      toast({
        title: "Employee updated",
        description: "Employee profile has been saved successfully.",
      });

      const updatedEmployee: Employee = {
        ...selectedEmployee,
        employee_name: validated.employeeName,
        employee_surname: validated.employeeSurname,
        id_number: validated.idNumber || null,
        start_date: validated.startDate || null,
        contract_type: validated.contractType,
        end_date: endDateValue,
        nationality: validated.nationality,
        employee_number: finalEmployeeNumber,
        job_title: validated.jobTitle || null,
        physical_address_line1: validated.physicalAddressLine1 || null,
        physical_address_line2: validated.physicalAddressLine2 || null,
        city: validated.city || null,
        province: validated.province,
        area_code: validated.areaCode || null,
        postal_address_line1: validated.postalAddressLine1 || null,
        postal_address_line2: validated.postalAddressLine2 || null,
        postal_city: validated.postalCity || null,
        postal_province: validated.postalProvince || null,
        postal_area_code: validated.postalAreaCode || null,
        cell_number: validated.cellNumber || null,
        email: validated.email || null,
        emergency_contact_name: validated.emergencyContactName || null,
        emergency_contact_number: validated.emergencyContactNumber || null,
      };

      setSelectedEmployee(updatedEmployee);
      setProfileForm(createProfileFormFromEmployee(updatedEmployee));
      setIsEditMode(false);
      await fetchEmployees();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsProfileSaving(false);
    }
   };

   const handleBulkDelete = async () => {
     if (selectedEmployees.size === 0 || !user) return;
   const confirmed = confirm(`Are you sure you want to delete ${selectedEmployees.size} employee(s)?`);
   if (!confirmed) return;

    const deletedEmployees = employees.filter((emp) => selectedEmployees.has(emp.id));
    if (deletedEmployees.length === 0) {
      toast({
        title: "No matching employees",
        description: "Could not find the selected employees to delete.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("employees")
      .delete()
      .in("id", Array.from(selectedEmployees));

     if (error) {
       toast({
         title: "Error",
         description: error.message,
         variant: "destructive",
       });
       return;
     }

    toast({
      title: "Success",
      description: `${selectedEmployees.size} employee(s) deleted successfully!`,
    });

    setDeleteUndo({
      deletedEmployees,
      expiresAt: Date.now() + 20_000,
    });
    setSelectedEmployees(new Set());
    await fetchEmployees();
  };

  const handleTerminateEmployee = async (employee: Employee) => {
    if (!user) return;
    const fullName = `${(employee.employee_name ?? "").trim()} ${(employee.employee_surname ?? "").trim()}`.trim();
    const confirmed = confirm(`Are you sure you want to terminate ${fullName || "this employee"}?`);
    if (!confirmed) return;

    const { error } = await supabase.from("employees").delete().eq("id", employee.id);
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Employee terminated",
      description: `${fullName || "Employee"} deleted successfully.`,
    });

    setDeleteUndo({
      deletedEmployees: [employee],
      expiresAt: Date.now() + 20_000,
    });
    setSelectedEmployees((prev) => {
      if (!prev.has(employee.id)) return prev;
      const next = new Set(prev);
      next.delete(employee.id);
      return next;
    });
    if (selectedEmployee?.id === employee.id) {
      setSelectedEmployee(null);
      setIsProfilePanelOpen(false);
    }
    await fetchEmployees();
  };

  const handleBulkDialogChange = (open: boolean) => {
    setIsBulkDialogOpen(open);
    if (!open && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };


   const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file || !user) return;
     setIsLoading(true);
     try {
       const data = await file.arrayBuffer();
       const workbook = XLSX.read(data);
       const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: "yyyy-mm-dd", defval: "" });

      const validatedEmployees: EmployeeInsert[] = [];
      const errors: string[] = [];

      const getColumnValue = (row: Record<string, unknown>, ...possibleNames: string[]): string => {
        for (const name of possibleNames) {
          if (row[name] !== undefined && row[name] !== null) {
            return String(row[name]).trim();
          }
        }
        const rowKeys = Object.keys(row);
        for (const name of possibleNames) {
          const normalizedName = name.toLowerCase().trim();
          const matchingKey = rowKeys.find((key) => key.toLowerCase().trim() === normalizedName);
          if (matchingKey && row[matchingKey] !== undefined && row[matchingKey] !== null) {
            return String(row[matchingKey]).trim();
          }
        }
        return "";
      };

      const normalizeEnumValue = (value: string, options: readonly string[]) => {
        const trimmed = value.trim();
        if (!trimmed) return "";
        const match = options.find((option) => option.toLowerCase() === trimmed.toLowerCase());
        return match ?? trimmed;
      };

      const normalizeContractType = (value: string) => normalizeEnumValue(value, contractTypes);

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as Record<string, unknown>;
        const rowNumber = i + 2;
        try {
          const rawData = {
            employeeNumber: getColumnValue(row, "Employee Number", "employee_number"),
            employeeName: getColumnValue(row, "Name", "First Name", "employee_name"),
            employeeSurname: getColumnValue(row, "Surname", "Last Name", "employee_surname"),
            idNumber: getColumnValue(row, "ID Number", "ID", "id_number", "Id Number"),
            contractType: normalizeContractType(getColumnValue(row, "Contract Type", "contract_type")),
            nationality: normalizeEnumValue(getColumnValue(row, "Nationality", "nationality"), nationalityOptions),
            jobTitle: getColumnValue(row, "Job Title", "job_title"),
          };

          const validated = employeeImportSchema.parse(rawData);
          validatedEmployees.push({
            company_id: user.id,
            employee_name: validated.employeeName,
            employee_surname: validated.employeeSurname,
            id_number: validated.idNumber || null,
            employee_number: validated.employeeNumber || null,
            contract_type: validated.contractType || null,
            nationality: validated.nationality || null,
            job_title: validated.jobTitle || null,
          });
        } catch (err: unknown) {
          errors.push(`Row ${rowNumber}: ${getSafeErrorMessage(err)}`);
        }
      }

      if (validatedEmployees.length === 0) {
        const firstError = errors[0] ?? "Each row needs at least a Name and Surname.";
        throw new Error(`No valid employee data found. ${firstError}`);
      }

      if (errors.length > 0) {
        toast({
          title: "Warning",
          description: `${errors.length} row(s) skipped due to validation errors. First error: ${errors[0]}`,
          variant: "destructive",
        });
       }

      const { error } = await supabase.from("employees").insert(validatedEmployees as TablesInsert<"employees">[]);
      if (error) throw error;

      toast({
        title: "Success",
        description: `${validatedEmployees.length} employee(s) imported successfully!`,
      });

      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchEmployees();
      handleBulkDialogChange(false);
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
   };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [
      ["Employee Number", "Name", "Surname", "ID Number", "Nationality", "Contract Type", "Job Title"],
      ["A0001", "John", "Doe", "9001015009087", "South African", "Permanent", "Store Manager"],
      ["B0002", "Jane", "Smith", "8505125800082", "Namibian", "Temporary", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const idNumberColumnIndex = 3;
    for (let rowIndex = 1; rowIndex < wsData.length; rowIndex++) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: idNumberColumnIndex });
      const cell = ws[cellRef];
      if (cell) {
        const numericValue = Number(cell.v);
        if (!Number.isNaN(numericValue)) {
          cell.t = "n";
          cell.v = numericValue;
          cell.z = "0";
        }
      }
    }
    ws["!cols"] = [
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
      { wch: 14 },
      { wch: 18 },
      { wch: 16 },
      { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, "employee_upload_template.xlsx");
    toast({
      title: "Template Downloaded",
      description: "Check your downloads folder for the Excel template.",
     });
   };

   const goToPreviousPage = () => {
     if (isFirstPage) return;
     setCurrentPage((prev) => Math.max(1, prev - 1));
   };

   const goToNextPage = () => {
     if (isLastPage) return;
     setCurrentPage((prev) => prev + 1);
   };

   const toggleSelectAll = () => {
     if (selectedEmployees.size === filteredEmployees.length) {
       setSelectedEmployees(new Set());
       return;
     }
     setSelectedEmployees(new Set(filteredEmployees.map((emp) => emp.id)));
   };

   const toggleSelectEmployee = (id: string) => {
     const next = new Set(selectedEmployees);
     if (next.has(id)) {
       next.delete(id);
     } else {
       next.add(id);
     }
     setSelectedEmployees(next);
   };

   const openProfileDialog = (employee: Employee) => {
     setSelectedEmployee(employee);
     setProfileForm(createProfileFormFromEmployee(employee));
    setActiveTab("personal");
    setIsEditMode(false);
    setIsProfilePanelOpen(true);
  };

  const closeProfileDialog = () => {
    setIsProfilePanelOpen(false);
    setSelectedEmployee(null);
    setIsEditMode(false);
   };

  const renderPersonalTab = () => (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={fieldWrapperClass}>
          <Label className={fieldLabelClass}>
            Name
          </Label>
          <Input
            className={fieldInputClass}
            placeholder="Name"
            value={profileForm.employeeName}
            disabled={!isEditMode}
            onChange={(e) =>
              setProfileForm((prev) => ({
                ...prev,
                employeeName: e.target.value,
              }))
            }
          />
        </div>
        <div className={fieldWrapperClass}>
          <Label className={fieldLabelClass}>Surname</Label>
          <Input
            className={fieldInputClass}
            placeholder="Surname"
            value={profileForm.employeeSurname}
            disabled={!isEditMode}
            onChange={(e) =>
              setProfileForm((prev) => ({
                ...prev,
                employeeSurname: e.target.value,
              }))
            }
          />
        </div>
        <div className={fieldWrapperClass}>
          <Label className={fieldLabelClass}>ID Number</Label>
          <Input
            className={fieldInputClass}
            placeholder="ID Number"
            value={profileForm.idNumber}
            disabled={!isEditMode}
            onChange={(e) =>
              setProfileForm((prev) => ({
                ...prev,
                idNumber: e.target.value,
              }))
            }
          />
        </div>
        <div className={fieldWrapperClass}>
          <Label className={fieldLabelClass}>Nationality</Label>
          <Select
            value={profileForm.nationality}
            disabled={!isEditMode}
            onValueChange={(value) =>
              setProfileForm((prev) => ({
                ...prev,
                nationality: value as EmployeeProfileFormData["nationality"],
              }))
            }
          >
            <SelectTrigger className={fieldSelectTriggerClass} showIcon={isEditMode}>
              <SelectValue placeholder="Nationality" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {nationalityOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className={fieldWrapperClass}>
          <Label className={fieldLabelClass}>Gender</Label>
          <Select
            value={profileForm.gender || ""}
            disabled={!isEditMode}
            onValueChange={(value) =>
              setProfileForm((prev) => ({
                ...prev,
                gender: value as EmployeeProfileFormData["gender"],
              }))
            }
          >
            <SelectTrigger className={fieldSelectTriggerClass} showIcon={isEditMode}>
              <SelectValue placeholder="Gender" />
            </SelectTrigger>
            <SelectContent>
              {genderOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className={fieldWrapperClass}>
          <Label className={fieldLabelClass}>Race</Label>
          <Select
            value={profileForm.race || ""}
            disabled={!isEditMode}
            onValueChange={(value) =>
              setProfileForm((prev) => ({
                ...prev,
                race: value as EmployeeProfileFormData["race"],
              }))
            }
          >
            <SelectTrigger className={fieldSelectTriggerClass} showIcon={isEditMode}>
              <SelectValue placeholder="Race" />
            </SelectTrigger>
            <SelectContent>
              {raceOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={fieldWrapperClass}>
          <Label className={fieldLabelClass}>
            Cell Number
          </Label>
          <Input
            className={fieldInputClass}
            value={profileForm.cellNumber}
            placeholder="Insert cell number..."
            disabled={!isEditMode}
            onChange={(e) =>
              setProfileForm((prev) => ({
                ...prev,
                cellNumber: e.target.value,
              }))
            }
          />
        </div>
        <div className={fieldWrapperClass}>
          <Label className={fieldLabelClass}>Email</Label>
          <Input
            className={fieldInputClass}
            type="email"
            value={profileForm.email}
            placeholder="Insert email address..."
            disabled={!isEditMode}
            onChange={(e) =>
              setProfileForm((prev) => ({
                ...prev,
                email: e.target.value,
              }))
            }
          />
        </div>
        <div className={fieldWrapperClass}>
          <Label className={fieldLabelClass}>
            Emergency Contact
          </Label>
          <Input
            className={fieldInputClass}
            placeholder="Insert emergency contact..."
            value={profileForm.emergencyContactName}
            disabled={!isEditMode}
            onChange={(e) =>
              setProfileForm((prev) => ({
                ...prev,
                emergencyContactName: e.target.value,
              }))
            }
          />
        </div>
        <div className={fieldWrapperClass}>
          <Label className={fieldLabelClass}>Emergency Contact Number</Label>
          <Input
            className={fieldInputClass}
            placeholder="Insert emergency contact number..."
            value={profileForm.emergencyContactNumber}
            disabled={!isEditMode}
            onChange={(e) =>
              setProfileForm((prev) => ({
                ...prev,
                emergencyContactNumber: e.target.value,
              }))
            }
          />
        </div>
      </div>
    </div>
  );
  const renderAddressTab = () => (
    <div className="space-y-4">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,420px)]">
        <div className="space-y-3">
          <Label className={fieldLabelClass}>Physical Address</Label>
          <div className="space-y-3">
            <div className={fieldWrapperClass}>
              <Input
                className={fieldInputClass}
                placeholder="Address Line 1"
                value={profileForm.physicalAddressLine1}
                disabled={!isEditMode}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    physicalAddressLine1: e.target.value,
                  }))
                }
              />
            </div>
            <div className={fieldWrapperClass}>
              <Input
                className={fieldInputClass}
                placeholder="Address Line 2"
                value={profileForm.physicalAddressLine2}
                disabled={!isEditMode}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    physicalAddressLine2: e.target.value,
                  }))
                }
              />
            </div>
            <div className={fieldWrapperClass}>
              <Input
                className={fieldInputClass}
                placeholder="City"
                value={profileForm.city}
                disabled={!isEditMode}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    city: e.target.value,
                  }))
                }
              />
            </div>
            <div className={fieldWrapperClass}>
              <Select
                value={profileForm.province}
                disabled={!isEditMode}
                onValueChange={(value) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    province: value as EmployeeProfileFormData["province"],
                  }))
                }
              >
                <SelectTrigger className={fieldSelectTriggerClass} showIcon={isEditMode}>
                  <SelectValue placeholder="Province" />
                </SelectTrigger>
                <SelectContent>
                  {southAfricanProvinces.map((province) => (
                    <SelectItem key={province} value={province}>
                      {province}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={fieldWrapperClass}>
              <Input
                className={fieldInputClass}
                placeholder="Area Code"
                value={profileForm.areaCode}
                disabled={!isEditMode}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    areaCode: e.target.value,
                  }))
                }
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <Label className={fieldLabelClass}>Postal Address</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px] text-slate-900 rounded-[5px] hover:bg-transparent hover:text-slate-900 hover:border-blue-600"
              disabled={!isEditMode}
              onClick={() =>
                setProfileForm((prev) => ({
                  ...prev,
                  postalAddressLine1: prev.physicalAddressLine1,
                  postalAddressLine2: prev.physicalAddressLine2,
                  postalCity: prev.city,
                  postalProvince: prev.province,
                  postalAreaCode: prev.areaCode,
                }))
              }
            >
              Copy from physical
            </Button>
          </div>
          <div className="space-y-3">
            <div className={fieldWrapperClass}>
              <Input
                className={fieldInputClass}
                placeholder="Address Line 1"
                value={profileForm.postalAddressLine1}
                disabled={!isEditMode}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    postalAddressLine1: e.target.value,
                  }))
                }
              />
            </div>
            <div className={fieldWrapperClass}>
              <Input
                className={fieldInputClass}
                placeholder="Address Line 2"
                value={profileForm.postalAddressLine2}
                disabled={!isEditMode}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    postalAddressLine2: e.target.value,
                  }))
                }
              />
            </div>
            <div className={fieldWrapperClass}>
              <Input
                className={fieldInputClass}
                placeholder="City"
                value={profileForm.postalCity}
                disabled={!isEditMode}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    postalCity: e.target.value,
                  }))
                }
              />
            </div>
            <div className={fieldWrapperClass}>
              <Select
                value={profileForm.postalProvince}
                disabled={!isEditMode}
                onValueChange={(value) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    postalProvince: value as EmployeeProfileFormData["postalProvince"],
                  }))
                }
              >
                <SelectTrigger className={fieldSelectTriggerClass} showIcon={isEditMode}>
                  <SelectValue placeholder="Province" />
                </SelectTrigger>
                <SelectContent>
                  {southAfricanProvinces.map((province) => (
                    <SelectItem key={province} value={province}>
                      {province}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={fieldWrapperClass}>
              <Input
                className={fieldInputClass}
                placeholder="Area Code"
                value={profileForm.postalAreaCode}
                disabled={!isEditMode}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    postalAreaCode: e.target.value,
                  }))
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderEmploymentTab = () => (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={fieldWrapperClass}>
          <Label className={fieldLabelClass}>
            Start Date
          </Label>
          <Input
            className={fieldInputClass}
            placeholder="Start Date"
            type="date"
            value={profileForm.startDate}
            disabled={!isEditMode}
            onChange={(e) =>
              setProfileForm((prev) => ({
                ...prev,
                startDate: e.target.value,
              }))
            }
          />
        </div>
        <div className={fieldWrapperClass}>
          <Label className={fieldLabelClass}>
            Contract Type
          </Label>
          <Select
            value={profileForm.contractType}
            disabled={!isEditMode}
            onValueChange={(value) =>
              setProfileForm((prev) => ({
                ...prev,
                contractType: value as EmployeeProfileFormData["contractType"],
                endDate: value === "Temporary" ? prev.endDate : "",
              }))
            }
          >
            <SelectTrigger className={fieldSelectTriggerClass} showIcon={isEditMode}>
              <SelectValue placeholder="Contract Type" />
            </SelectTrigger>
            <SelectContent>
              {contractTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {profileForm.contractType === "Temporary" && (
          <div className={`${fieldWrapperClass} sm:col-span-2 xl:col-span-1`}>
            <Label className={fieldLabelClass}>
              End Date
            </Label>
            <Input
              className={fieldInputClass}
              placeholder="End Date"
              type="date"
              value={profileForm.endDate}
              disabled={!isEditMode}
              onChange={(e) =>
                setProfileForm((prev) => ({
                  ...prev,
                  endDate: e.target.value,
                }))
              }
            />
          </div>
        )}
        <div className={fieldWrapperClass}>
          <Label className={fieldLabelClass}>
            Job Title
          </Label>
          <Input
            className={fieldInputClass}
            placeholder="Job Title"
            value={profileForm.jobTitle}
            disabled={!isEditMode}
            onChange={(e) =>
              setProfileForm((prev) => ({
                ...prev,
                jobTitle: e.target.value,
              }))
            }
          />
        </div>
        <div className={fieldWrapperClass}>
          <Label className={fieldLabelClass}>
            Employee Number
          </Label>
          <div className={fieldWrapperClass}>
            <Input
              className={fieldInputClass}
              value={profileForm.employeeNumber}
              disabled={!isEditMode}
              maxLength={EMPLOYEE_NUMBER_MAX_LENGTH}
              onChange={(e) => handleCustomEmployeeNumberChange(e.target.value)}
              placeholder={`Enter a custom number (up to ${EMPLOYEE_NUMBER_MAX_LENGTH} letters or numbers)`}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderDisciplineTab = () => {
    const showingValid = warningFilter === "valid";
    const activeWarnings = showingValid ? warningsByStatus.valid : warningsByStatus.expired;
    const warningTypeTag: Record<EmployeeWarning["warningType"], string> = {
      First: "First",
      Second: "Second",
      Serious: "Serious",
      Final: "Final",
    };
    const warningTypeBadgeClass: Record<EmployeeWarning["warningType"], string> = {
      First: "border-blue-200 bg-blue-50 text-blue-700",
      Second: "border-emerald-200 bg-emerald-50 text-emerald-700",
      Serious: "border-amber-200 bg-amber-50 text-amber-700",
      Final: "border-rose-200 bg-rose-50 text-rose-700",
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-3">
          <Button
            variant="outline"
            className="h-24 w-40 rounded-xl border-dashed border-2 border-primary/50 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary flex items-center justify-center p-0"
            onClick={() => setIsWarningDialogOpen(true)}
          >
            <FileUp
              className="shrink-0 text-primary"
              strokeWidth={1.25}
              style={{ width: "56px", height: "56px" }}
            />
            <span className="sr-only">Upload warning</span>
          </Button>
          <p className="text-sm text-muted-foreground">Click in the box to upload warnings</p>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-slate-900">Warnings</h4>
              <span className="text-xs rounded-full bg-muted px-2 py-1 text-foreground border border-border/60">
                {activeWarnings.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={warningFilter}
                onValueChange={(value) => setWarningFilter(value as "valid" | "expired")}
              >
                <SelectTrigger className={`${fieldSelectTriggerClass} h-8 px-2 text-xs w-[96px]`} showIcon>
                <SelectValue placeholder="Filter warnings" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="valid">Valid</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border/70">
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed">
                <thead className="bg-muted/40 text-[11px] font-semibold uppercase text-muted-foreground">
                  <tr className="text-left">
                    <th className="px-3 py-2 w-[40%]">Misconduct</th>
                    <th className="px-3 py-2 text-center w-[12%]">Type</th>
                    <th className="px-3 py-2 text-center w-[16%]">Issued</th>
                    <th className="px-3 py-2 text-center w-[16%]">{showingValid ? "Expiry" : "Expired"}</th>
                    <th className="px-3 py-2 text-center w-[16%]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-[11px]">
                  {activeWarnings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                        {showingValid ? "No valid warnings yet." : "No expired warnings."}
                      </td>
                    </tr>
                  ) : (
                    activeWarnings.map((warning) => {
                      const misconductTypes = parseMisconductTypes(warning.misconductType);
                      const primaryMisconduct = misconductTypes[0] || "Misconduct";
                      const otherMisconductTypes = misconductTypes.slice(1);
                      const hasOtherMisconduct = otherMisconductTypes.length > 0;

                      return (
                        <tr key={warning.id} className="hover:bg-muted/30">
                          <td className="px-3 py-2 font-medium text-slate-900 w-[40%]">
                            <span>{primaryMisconduct}</span>
                            {hasOtherMisconduct && (
                              <TooltipProvider delayDuration={0}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="ml-1 text-xs font-semibold text-blue-700 hover:underline"
                                    >
                                      , Other
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs border border-blue-200 bg-white text-slate-900">
                                    <ul className="list-disc space-y-1 pl-4 text-xs">
                                      {otherMisconductTypes.map((type) => (
                                        <li key={type}>{type}</li>
                                      ))}
                                    </ul>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center w-[12%]">
                            <Badge
                              variant="outline"
                              className={warningTypeBadgeClass[warning.warningType] || "border-border/70 text-muted-foreground"}
                            >
                              {warningTypeTag[warning.warningType] || warning.warningType}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-center text-muted-foreground w-[16%]">
                            {formatDisplayDate(warning.issueDate)}
                          </td>
                          <td className="px-3 py-2 text-center text-muted-foreground w-[16%]">
                            {formatDisplayDate(warning.expiryDate)}
                          </td>
                          <td className="px-3 py-2 text-center w-[16%]">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-slate-700 hover:text-blue-600 hover:bg-transparent"
                                  aria-label="Warning actions"
                                >
                                  <Menu className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="text-xs">
                                <DropdownMenuItem
                                  className="gap-2 border border-transparent text-slate-700 hover:bg-transparent hover:border-blue-500 focus:bg-transparent focus:border-blue-500 hover:text-slate-700 focus:text-slate-700"
                                  onSelect={(event) => {
                                    event.preventDefault();
                                    handleEditWarning(warning);
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Edit
                                </DropdownMenuItem>
                                {warning.fileUrl && (
                                  <DropdownMenuItem
                                    className="gap-2 border border-transparent text-slate-700 hover:bg-transparent hover:border-blue-500 focus:bg-transparent focus:border-blue-500 hover:text-slate-700 focus:text-slate-700"
                                    onSelect={(event) => {
                                      event.preventDefault();
                                      void handleOpenWarning(warning);
                                    }}
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                    Download
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="gap-2 border border-transparent text-red-600 focus:text-red-600 hover:bg-transparent hover:border-red-500 focus:bg-transparent focus:border-red-500"
                                  onSelect={(event) => {
                                    event.preventDefault();
                                    handleDeleteWarning(warning.id, warning.fileUrl);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderContractTab = () => {
    const showingActive = contractStatusFilter === "active";
    const activeContracts = showingActive ? contractsByStatus.active : contractsByStatus.inactive;

    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-3">
          <Button
            variant="outline"
            className="h-24 w-40 rounded-xl border-dashed border-2 border-primary/50 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary flex items-center justify-center p-0"
            onClick={handleStartContractUpload}
          >
            <FileUp
              className="shrink-0 text-primary"
              strokeWidth={1.25}
              style={{ width: "56px", height: "56px" }}
            />
            <span className="sr-only">Upload contract</span>
          </Button>
          <p className="text-sm text-muted-foreground">Click in the box to upload contracts</p>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-slate-900">Contracts</h4>
              <span className="text-xs rounded-full bg-muted px-2 py-1 text-foreground border border-border/60">
                {activeContracts.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={contractStatusFilter}
                onValueChange={(value) => setContractStatusFilter(value as "active" | "inactive")}
              >
                <SelectTrigger className={`${fieldSelectTriggerClass} h-8 px-2 text-xs w-[110px]`} showIcon>
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border/70">
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed">
                <thead className="bg-muted/40 text-[11px] font-semibold uppercase text-muted-foreground">
                  <tr className="text-left">
                    <th className="px-3 py-2 w-[44%]">Contract type</th>
                    <th className="px-3 py-2 text-center w-[16%]">Status</th>
                    <th className="px-3 py-2 text-center w-[20%]">Uploaded</th>
                    <th className="px-3 py-2 text-center w-[20%]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-[11px]">
                  {activeContracts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-sm text-muted-foreground">
                        {showingActive ? "No active contracts yet." : "No inactive contracts."}
                      </td>
                    </tr>
                  ) : (
                    activeContracts.map((contract) => {
                      return (
                        <tr key={contract.id} className="hover:bg-muted/30">
                          <td className="px-3 py-2 font-medium text-slate-900 w-[44%]">
                            {contract.contractType || "Contract"}
                          </td>
                          <td className="px-3 py-2 text-center w-[16%]">
                            <Badge
                              variant="outline"
                              className={
                                contract.isActive
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 bg-slate-50 text-slate-600"
                              }
                            >
                              {contract.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-center text-muted-foreground w-[20%]">
                            {formatDisplayDate(contract.issueDate)}
                          </td>
                          <td className="px-3 py-2 text-center w-[20%]">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-slate-700 hover:text-blue-600 hover:bg-transparent"
                                  aria-label="Contract actions"
                                >
                                  <Menu className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="text-xs">
                                {contract.fileUrl && (
                                  <DropdownMenuItem
                                    className="gap-2 border border-transparent text-slate-700 hover:bg-transparent hover:border-blue-500 focus:bg-transparent focus:border-blue-500 hover:text-slate-700 focus:text-slate-700"
                                    onSelect={(event) => {
                                      event.preventDefault();
                                      void handleOpenContract(contract);
                                    }}
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                    Download
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="gap-2 border border-transparent text-red-600 focus:text-red-600 hover:bg-transparent hover:border-red-500 focus:bg-transparent focus:border-red-500"
                                  onSelect={(event) => {
                                    event.preventDefault();
                                    handleDeleteContract(contract.id, contract.fileUrl);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

   if (loading) {
     return (
       <DashboardLayout>
         <div className="min-h-[60vh] flex items-center justify-center">
           <p className="text-muted-foreground">Loading...</p>
         </div>
       </DashboardLayout>
     );
   }

  return (
    <DashboardLayout>
      <div className="space-y-0 -m-6">
        <div className="border border-slate-300 border-r-0 bg-white shadow-sm h-[calc(100dvh-var(--app-header-height,5rem))] pb-0">
          <div className="flex h-full flex-col">
            <div className="pl-4 pr-4 pt-1">
              <div className="pt-5 pb-2">
                <h1 className="text-4xl font-normal text-blue-600 -ml-1">Employees</h1>
                <p className="text-xs text-slate-600 mt-2">
                  Browse, search, and manage your employees and attach their documents.
                </p>
              </div>
            </div>
            <section className="relative flex-1 overflow-y-auto overflow-x-hidden pr-2">
              <div className="space-y-0 p-0">
        <Card className="rounded-none bg-white border-0 shadow-none">
          <CardHeader className="pl-4 pr-4 pt-5 pb-3 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-[400px]">
                <Input
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 rounded-sm border border-slate-200 bg-white pr-9 !text-[11px] font-semibold shadow-sm placeholder:!text-[11px] focus-visible:!border focus-visible:!border-blue-600 focus-visible:ring-0 dark:bg-background"
                />
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                </div>
              </div>
              <div className="flex flex-wrap gap-3 justify-end">
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <Select
                    value={contractFilter}
                    onValueChange={(value) => setContractFilter(value as "all" | "permanent" | "temporary")}
                  >
                  <SelectTrigger className="h-8 w-full sm:w-40 text-[11px] rounded-sm bg-white text-slate-700 border border-slate-200 hover:border-blue-400 data-[state=open]:border-blue-600 focus:border-blue-600 !ring-0 !ring-offset-0 focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 outline-none focus:outline-none focus-visible:outline-none data-[state=open]:!ring-0 data-[state=open]:!ring-offset-0">
                    <span className="truncate">
                      Contract: <span className="font-semibold">{contractFilterLabel}</span>
                    </span>
                  </SelectTrigger>
                  <SelectContent className="text-[11px]">
                    <SelectItem
                      value="all"
                      className="group text-[11px] text-slate-700 focus:bg-blue-50/70 focus:text-blue-400 data-[highlighted]:bg-blue-50/70 data-[highlighted]:text-blue-400 data-[state=checked]:text-slate-700 data-[state=checked]:data-[highlighted]:text-slate-700"
                    >
                      All employees{" "}
                      <span className="text-slate-700 text-[0.65rem] font-semibold transition-colors group-hover:text-blue-400 group-data-[state=checked]:text-slate-700 group-data-[state=checked]:group-hover:text-slate-700">
                        ({totalEmployees ?? employees.length})
                      </span>
                    </SelectItem>
                    <SelectItem
                      value="permanent"
                      className="group text-[11px] text-slate-700 focus:bg-blue-50/70 focus:text-blue-400 data-[highlighted]:bg-blue-50/70 data-[highlighted]:text-blue-400 data-[state=checked]:text-slate-700 data-[state=checked]:data-[highlighted]:text-slate-700"
                    >
                      Permanent{" "}
                      <span className="text-slate-700 text-[0.65rem] font-semibold transition-colors group-hover:text-blue-400 group-data-[state=checked]:text-slate-700 group-data-[state=checked]:group-hover:text-slate-700">
                        ({totalPermanentEmployees ?? employees.filter((emp) => (emp.contract_type ?? "").toLowerCase() === "permanent").length})
                      </span>
                    </SelectItem>
                    <SelectItem
                      value="temporary"
                      className="group text-[11px] text-slate-700 focus:bg-blue-50/70 focus:text-blue-400 data-[highlighted]:bg-blue-50/70 data-[highlighted]:text-blue-400 data-[state=checked]:text-slate-700 data-[state=checked]:data-[highlighted]:text-slate-700"
                    >
                      Temporary{" "}
                      <span className="text-slate-700 text-[0.65rem] font-semibold transition-colors group-hover:text-blue-400 group-data-[state=checked]:text-slate-700 group-data-[state=checked]:group-hover:text-slate-700">
                        ({totalTemporaryEmployees ?? employees.filter((emp) => (emp.contract_type ?? "").toLowerCase() === "temporary").length})
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={genderFilter}
                  onValueChange={(value) => setGenderFilter(value as "all" | EmployeeProfileFormData["gender"])}
                >
                  <SelectTrigger className="h-8 w-full sm:w-32 text-[11px] rounded-sm bg-white text-slate-700 border border-slate-200 hover:border-blue-400 data-[state=open]:border-blue-600 focus:border-blue-600 !ring-0 !ring-offset-0 focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 outline-none focus:outline-none focus-visible:outline-none data-[state=open]:!ring-0 data-[state=open]:!ring-offset-0">
                    <span className="truncate">
                      Gender: <span className="font-semibold">{genderFilterLabel}</span>
                    </span>
                  </SelectTrigger>
                  <SelectContent className="text-[11px]">
                    <SelectItem
                      value="all"
                      className="text-[11px] text-slate-700 focus:bg-blue-50/70 focus:text-blue-400 data-[highlighted]:bg-blue-50/70 data-[highlighted]:text-blue-400 data-[state=checked]:text-slate-700 data-[state=checked]:data-[highlighted]:text-slate-700"
                    >
                      All genders
                    </SelectItem>
                    {genderOptions.map((option) => (
                      <SelectItem
                        key={option}
                        value={option}
                        className="text-[11px] text-slate-700 focus:bg-blue-50/70 focus:text-blue-400 data-[highlighted]:bg-blue-50/70 data-[highlighted]:text-blue-400 data-[state=checked]:text-slate-700 data-[state=checked]:data-[highlighted]:text-slate-700"
                      >
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={raceFilter}
                  onValueChange={(value) => setRaceFilter(value as "all" | EmployeeProfileFormData["race"])}
                >
                  <SelectTrigger className="h-8 w-full sm:w-32 text-[11px] rounded-sm bg-white text-slate-700 border border-slate-200 hover:border-blue-400 data-[state=open]:border-blue-600 focus:border-blue-600 !ring-0 !ring-offset-0 focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 outline-none focus:outline-none focus-visible:outline-none data-[state=open]:!ring-0 data-[state=open]:!ring-offset-0">
                    <span className="truncate">
                      Race: <span className="font-semibold">{raceFilterLabel}</span>
                    </span>
                  </SelectTrigger>
                  <SelectContent className="text-[11px]">
                    <SelectItem
                      value="all"
                      className="text-[11px] text-slate-700 focus:bg-blue-50/70 focus:text-blue-400 data-[highlighted]:bg-blue-50/70 data-[highlighted]:text-blue-400 data-[state=checked]:text-slate-700 data-[state=checked]:data-[highlighted]:text-slate-700"
                    >
                      All races
                    </SelectItem>
                    {raceOptions.map((option) => (
                      <SelectItem
                        key={option}
                        value={option}
                        className="text-[11px] text-slate-700 focus:bg-blue-50/70 focus:text-blue-400 data-[highlighted]:bg-blue-50/70 data-[highlighted]:text-blue-400 data-[state=checked]:text-slate-700 data-[state=checked]:data-[highlighted]:text-slate-700"
                      >
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={nationalityFilter}
                  onValueChange={(value) => setNationalityFilter(value as "all" | "RSA" | "Other")}
                >
                  <SelectTrigger className="h-8 w-full sm:w-36 text-[11px] rounded-sm bg-white text-slate-700 border border-slate-200 hover:border-blue-400 data-[state=open]:border-blue-600 focus:border-blue-600 !ring-0 !ring-offset-0 focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 outline-none focus:outline-none focus-visible:outline-none data-[state=open]:!ring-0 data-[state=open]:!ring-offset-0">
                    <span className="truncate">
                      Nationality: <span className="font-semibold">{nationalityFilterLabel}</span>
                    </span>
                  </SelectTrigger>
                  <SelectContent className="text-[11px]">
                    <SelectItem
                      value="all"
                      className="text-[11px] text-slate-700 focus:bg-blue-50/70 focus:text-blue-400 data-[highlighted]:bg-blue-50/70 data-[highlighted]:text-blue-400 data-[state=checked]:text-slate-700 data-[state=checked]:data-[highlighted]:text-slate-700"
                    >
                      All nationalities
                    </SelectItem>
                    <SelectItem
                      value="RSA"
                      className="text-[11px] text-slate-700 focus:bg-blue-50/70 focus:text-blue-400 data-[highlighted]:bg-blue-50/70 data-[highlighted]:text-blue-400 data-[state=checked]:text-slate-700 data-[state=checked]:data-[highlighted]:text-slate-700"
                    >
                      RSA
                    </SelectItem>
                    <SelectItem
                      value="Other"
                      className="text-[11px] text-slate-700 focus:bg-blue-50/70 focus:text-blue-400 data-[highlighted]:bg-blue-50/70 data-[highlighted]:text-blue-400 data-[state=checked]:text-slate-700 data-[state=checked]:data-[highlighted]:text-slate-700"
                    >
                      Other
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="h-8 w-36 justify-between rounded-sm px-3 text-[11px] bg-blue-600 hover:bg-blue-700 inline-flex items-center">
                      <span className="truncate">New Employee</span>
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36 text-[11px]">
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        setIsAddDialogOpen(true);
                      }}
                      className="gap-2 cursor-pointer text-[11px] text-slate-700 focus:bg-blue-50/70 focus:text-blue-400 data-[highlighted]:bg-blue-50/70 data-[highlighted]:text-blue-400"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Single
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        handleBulkDialogChange(true);
                      }}
                      className="gap-2 cursor-pointer text-[11px] text-slate-700 focus:bg-blue-50/70 focus:text-blue-400 data-[highlighted]:bg-blue-50/70 data-[highlighted]:text-blue-400"
                    >
                      <Users className="h-3.5 w-3.5" />
                      Multiple
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pl-4 pr-4 pb-2">
            {isEmployeesLoading ? (
              <div className="flex items-center justify-center py-12">
                <img
                  src="/zappir_thumbnail_blue.png"
                  alt="Loading"
                  className="h-12 w-12 animate-spin"
                  style={{ animationDuration: "2s" }}
                />
              </div>
            ) : employees.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No employees added yet</p>
                <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Your First Employee
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div
                  ref={tableCardRef}
                  className="relative overflow-hidden rounded-sm border border-slate-200"
                  style={{ maxHeight: tableMaxHeight }}
                >
                  <div className="grid grid-cols-[2fr_1.5fr_1.2fr_1fr_1.5fr_1.25fr_1fr_1fr] items-center gap-2 border-b bg-[#2D4256] pl-4 pr-3 py-3 text-xs font-semibold text-white">
                    <div className="flex items-center leading-tight">Employee</div>
                    <div className="flex items-center gap-2 leading-tight">ID Number</div>
                    <div className="flex items-center leading-tight">Contract Type</div>
                    <div className="flex items-center leading-tight text-left">Start Date</div>
                    <div className="flex items-center leading-tight">Job Title</div>
                    <div className="flex items-center leading-tight text-left">Cell Number</div>
                    <div className="flex items-center leading-tight text-left">Nationality</div>
                    <div className="flex items-center justify-center leading-tight text-center">Actions</div>
                  </div>
                  <div
                    ref={tableScrollRef}
                    className="divide-y employee-table-scroll overflow-y-auto"
                    style={{ maxHeight: tableBodyMaxHeight }}
                  >
                    {filteredEmployees.map((employee) => (
                      <div
                        key={employee.id}
                        className="grid grid-cols-[2fr_1.5fr_1.2fr_1fr_1.5fr_1.25fr_1fr_1fr] items-center gap-2 pl-4 pr-3 py-1 text-xs hover:bg-blue-50/70"
                      >
                        <div className="font-medium leading-tight">
                          <button
                            type="button"
                            onClick={() => openProfileDialog(employee)}
                            className="text-left hover:text-primary transition-colors"
                          >
                            {(employee.employee_name ?? "").trim()} {(employee.employee_surname ?? "").trim()}
                          </button>
                        </div>
                        <div className="flex items-center gap-2 leading-tight">
                          <span className="text-[11px] font-normal">
                            {employee.id_number
                              ? revealedIds.has(employee.id)
                                ? employee.id_number
                                : maskSAIdNumber(employee.id_number)
                              : "N/A"}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = new Set(revealedIds);
                              if (next.has(employee.id)) {
                                next.delete(employee.id);
                              } else {
                                next.add(employee.id);
                              }
                              setRevealedIds(next);
                            }}
                            className="h-6 w-6 p-0"
                            title={revealedIds.has(employee.id) ? "Hide ID" : "Show full ID"}
                          >
                            {revealedIds.has(employee.id) ? <EyeOff className="h-2.5 w-2.5" strokeWidth={1.5} /> : <Eye className="h-2.5 w-2.5" strokeWidth={1.5} />}
                          </Button>
                        </div>
                        <div className="leading-tight">{employee.contract_type?.trim() || "--"}</div>
                        <div className="flex items-center leading-tight text-left">
                          {formatDisplayDate(employee.start_date)}
                        </div>
                        <div className="leading-tight">{employee.job_title?.trim() || "--"}</div>
                        <div className="flex items-center leading-tight text-left">
                          {employee.cell_number?.trim() || "--"}
                        </div>
                        <div className="flex items-center leading-tight text-left">
                          {employee.nationality?.trim() || "--"}
                        </div>
                        <div className="flex items-center justify-center">
                          <TooltipProvider delayDuration={0} skipDelayDuration={0}>
                            <div className="flex items-center justify-center gap-1 ml-1">
                              <Tooltip disableHoverableContent>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openProfileDialog(employee)}
                                    className="h-6 w-6 p-0 hover:text-primary hover:bg-muted/50 bg-transparent"
                                  >
                                    <Search className="h-3 w-3" strokeWidth={1.5} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="rounded">
                                  View Profile
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip disableHoverableContent>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDocumentDialogEmployee(employee)}
                                    className="h-6 w-6 p-0 group hover:bg-muted/50 bg-transparent"
                                  >
                                    <FilePlus className="h-3 w-3 transition-colors group-hover:text-primary" strokeWidth={1.5} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="rounded">
                                  Add Document
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip disableHoverableContent>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => void handleTerminateEmployee(employee)}
                                    className="h-6 w-6 p-0 group hover:bg-muted/50 bg-transparent"
                                  >
                                    <Trash2 className="h-3 w-3 transition-colors group-hover:text-red-600" strokeWidth={1.5} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="rounded">
                                  Delete Employee
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
                        </div>
                      </div>
                    ))}
                  </div>
                  {showScrollHint && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
                      <div className="relative rounded-sm border border-blue-100 bg-white/95 px-4 py-1 text-xs font-semibold text-blue-900 backdrop-blur supports-[backdrop-filter]:bg-white/80">
                        <span className="pointer-events-none absolute inset-0 rounded-sm shadow-[0_3px_10px_rgba(59,130,246,0.35),0_-3px_10px_rgba(59,130,246,0.2)]" aria-hidden="true"></span>
                        <span className="relative">Scroll down</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-center">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={goToPreviousPage}
                      disabled={isFirstPage}
                      aria-label="Previous page"
                      className="h-8 w-8 hover:bg-transparent hover:text-blue-600"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-[10px] font-medium text-primary">
                      Page {currentPage}
                      {totalPages !== null && totalPages > 0 ? ` of ${Math.max(totalPages, 1)}` : ""}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={goToNextPage}
                      disabled={isLastPage}
                      aria-label="Next page"
                      className="h-8 w-8 hover:bg-transparent hover:text-blue-600"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
                </Card>

                <Dialog open={isBulkDialogOpen} onOpenChange={handleBulkDialogChange}>
                  <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-white [&>button]:hidden">
                    <div className="flex items-center justify-between bg-[#2D4256] px-4 py-3 -mx-px -mt-px">
                      <div className="flex items-center gap-2 pl-2">
                        <UsersRound className="h-4 w-4 text-white" />
                        <DialogTitle className="text-sm font-semibold text-white">New Bulk Employees</DialogTitle>
                      </div>
                      <DialogClose asChild>
                        <button type="button" className="text-white hover:text-white/80">
                          <X className="h-4 w-4" />
                        </button>
                      </DialogClose>
                    </div>
                    <div className="px-6 pt-0 pb-2"></div>
                    <div className="px-6 pb-6">
                      <div className="grid gap-6 sm:grid-cols-2 pt-4">
                        <div className="space-y-4 ml-3">
                          <button
                            type="button"
                            onClick={downloadTemplate}
                            className="flex h-14 w-24 items-center justify-center rounded-sm border border-blue-600 text-blue-600 transition-none hover:border-2 hover:border-blue-600"
                          >
                            <Download className="h-5 w-5" />
                          </button>
                          <h4 className="text-sm font-semibold">Step 1: Download</h4>
                          <p className="text-[11px] text-slate-600 min-h-[32px]">
                            Download the bulk employee spreadsheet.
                          </p>
                        </div>
                        <div className="space-y-4">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                            className="flex h-14 w-24 items-center justify-center rounded-sm border border-blue-600 text-blue-600 transition-none hover:border-2 hover:border-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Upload className="h-5 w-5" />
                          </button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleBulkUpload}
                            className="hidden"
                            id="bulk-upload"
                            hidden
                          />
                          <h4 className="text-sm font-semibold">Step 2: Upload</h4>
                          <p className="text-[11px] text-slate-600 min-h-[32px]">
                            Upload the completed spreadsheet.
                          </p>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogContent className="p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-white [&>button]:hidden">
                    <div className="flex items-center justify-between bg-[#2D4256] px-4 py-3 -mx-px -mt-px">
                      <div className="flex items-center gap-2 pl-2">
                        <User className="h-4 w-4 text-white" />
                        <DialogTitle className="text-sm font-semibold text-white">New Employee</DialogTitle>
                      </div>
                      <DialogClose asChild>
                        <button type="button" className="text-white hover:text-white/80">
                          <X className="h-4 w-4" />
                        </button>
                      </DialogClose>
                    </div>
                    <div className="px-6 pt-0 pb-2"></div>
                    <form onSubmit={handleAddEmployee} className="space-y-4 px-6 pb-6 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="employeeName" className="text-slate-500">Name *</Label>
                        <Input
                          id="employeeName"
                          value={addForm.employeeName}
                          onChange={(e) =>
                            setAddForm((prev) => ({
                              ...prev,
                              employeeName: e.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="employeeSurname" className="text-slate-500">Surname *</Label>
                        <Input
                          id="employeeSurname"
                          value={addForm.employeeSurname}
                          onChange={(e) =>
                            setAddForm((prev) => ({
                              ...prev,
                              employeeSurname: e.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="idNumber" className="text-slate-500">ID Number</Label>
                        <Input
                          id="idNumber"
                          value={addForm.idNumber}
                          onChange={(e) =>
                            setAddForm((prev) => ({
                              ...prev,
                              idNumber: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="addEmployeeNumber" className="text-slate-500">Employee Number (optional)</Label>
                          <TooltipProvider delayDuration={0}>
                            <Tooltip disableHoverableContent>
                              <TooltipTrigger asChild>
                                <span
                                  className="inline-flex cursor-default text-muted-foreground transition-colors hover:text-foreground"
                                  aria-hidden="true"
                                >
                                  <Info className="h-4 w-4" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="border border-blue-200 bg-white text-slate-900">
                                Up to {EMPLOYEE_NUMBER_MAX_LENGTH} characters allowed (letters, numbers, or both).
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Input
                          id="addEmployeeNumber"
                          value={addForm.employeeNumber}
                          maxLength={EMPLOYEE_NUMBER_MAX_LENGTH}
                          onChange={(e) =>
                            setAddForm((prev) => ({
                              ...prev,
                              employeeNumber: sanitizeEmployeeNumber(e.target.value),
                            }))
                          }
                        />
                      </div>
                      <div className="mt-8 border-t border-dashed border-muted/60 pt-6 flex justify-center">
                        <Button
                          type="submit"
                          variant="ghost"
                          className="w-1/2 border border-blue-600 bg-transparent text-blue-600 hover:bg-transparent hover:text-blue-600 hover:border-blue-600 disabled:text-muted-foreground disabled:cursor-not-allowed"
                          disabled={isAddFormSubmitDisabled}
                        >
                          {isLoading ? "Saving..." : "Add Employee"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </section>
          </div>
        </div>
      </div>
      {isProfilePanelOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/65"
            aria-label="Close employee profile"
            onClick={closeProfileDialog}
          />
          <section className="fixed left-[50%] top-[50%] w-full sm:w-[45vw] max-w-[680px] h-[92vh] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white shadow-2xl border border-slate-200 overflow-y-auto">
            {renderProfilePanel()}
          </section>
        </div>
      )}

      <Dialog
        open={isWarningDialogOpen}
        onOpenChange={(open) => {
          setIsWarningDialogOpen(open);
          if (!open) {
            resetWarningForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingWarning ? "Edit warning" : "Upload warning"}</DialogTitle>
            <DialogDescription>
              {editingWarning ? "Update this warning record." : "Add a warning record with auto-calculated validity."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="misconductType">Type of misconduct</Label>
              <Popover open={isMisconductMenuOpen} onOpenChange={handleMisconductMenuOpenChange}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left text-sm font-normal"
                    type="button"
                  >
                    {warningForm.misconductTypes.length === 0
                      ? "Select misconduct type(s)"
                      : `${warningForm.misconductTypes.length} selected`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[420px] p-4" align="start">
                  <div className="space-y-3">
                    <Input
                      placeholder="Search misconduct..."
                      className="h-9"
                      value={misconductSearch}
                      onChange={(e) => setMisconductSearch(e.target.value)}
                    />
                    <ScrollArea
                      className="h-48 rounded-md border border-muted"
                      onWheel={(event) => event.stopPropagation()}
                      onTouchMove={(event) => event.stopPropagation()}
                    >
                      <div className="space-y-2 p-3">
                        {filteredMisconductTypes.length === 0 && (
                          <p className="text-sm text-muted-foreground">No misconduct types match your search.</p>
                        )}
                        {["Minor", "Serious", "Dismissible"].map((category) => {
                          const bucket = filteredMisconductTypes.filter((item) => item.category === category);
                          if (bucket.length === 0) return null;
                          return (
                            <div key={category} className="space-y-1">
                              <p
                                className={`text-xs font-semibold uppercase px-2 py-1 rounded-sm ${
                                  category === "Minor"
                                    ? "bg-emerald-600 text-white"
                                    : category === "Serious"
                                      ? "bg-amber-600 text-white"
                                      : "bg-red-600 text-white"
                                }`}
                              >
                                {category} Offences
                              </p>
                              {bucket.map((item) => (
                                <label
                                  key={`${category}-${item.name}`}
                                  className={`flex items-center gap-2 text-sm cursor-pointer ${misconductColorClasses(
                                    item.category,
                                  )}`}
                                >
                                  <Checkbox
                                    checked={warningForm.misconductTypes.includes(item.name)}
                                    onCheckedChange={() => toggleWarningMisconduct(item.name)}
                                    className={misconductCheckboxClasses(item.category)}
                                  />
                                  <span className="flex-1">{item.name}</span>
                                </label>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                    {warningForm.misconductTypes.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">Selected</p>
                        <div className="flex flex-wrap gap-2">
                          {warningForm.misconductTypes.map((type) => (
                            <Badge
                              key={type}
                              variant="secondary"
                              className={`gap-1 ${misconductColorClasses(getMisconductCategory(type))}`}
                            >
                              {type}
                              <X className="h-3 w-3 cursor-pointer" onClick={() => toggleWarningMisconduct(type)} />
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              {warningForm.misconductTypes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {warningForm.misconductTypes.map((type) => (
                    <Badge
                      key={type}
                      variant="secondary"
                      className={`gap-1 ${misconductColorClasses(getMisconductCategory(type))}`}
                    >
                      {type}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => toggleWarningMisconduct(type)} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type of warning</Label>
                <Select
                  value={warningForm.warningType}
                  onValueChange={(value) =>
                    setWarningForm((prev) => ({ ...prev, warningType: value as EmployeeWarning["warningType"] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select warning type" />
                  </SelectTrigger>
                  <SelectContent>
                <SelectItem value="First">First (6 months)</SelectItem>
                <SelectItem value="Second">Second (6 months)</SelectItem>
                <SelectItem value="Serious">Serious (9 months)</SelectItem>
                <SelectItem value="Final">Final (12 months)</SelectItem>
              </SelectContent>
            </Select>
          </div>
              <div className="space-y-2">
                <Label htmlFor="issueDate">Date of issue</Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={warningForm.issueDate}
                  onChange={(e) => setWarningForm((prev) => ({ ...prev, issueDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2 rounded-lg border border-dashed border-border/60 bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Validity</span>
                <Badge variant="outline" className="border-primary/30 text-primary">
                  {warningValidityMonths[warningForm.warningType]} months
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Auto expiry</span>
                <span className="font-semibold">
                  {formatDisplayDate(computeWarningExpiry(warningForm.warningType, warningForm.issueDate))}
                </span>
              </div>
            </div>
            {editingWarning ? (
              <p className="text-xs text-muted-foreground">
                Editing does not replace the file. Delete and re-upload to attach a new document.
              </p>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="warningFile">Upload signed warning (PDF only)</Label>
                <Input
                  id="warningFile"
                  type="file"
                  accept="application/pdf,.pdf"
                  required
                  onChange={handleWarningFileChange}
                />
                {warningForm.fileName && (
                  <p className="text-xs text-muted-foreground">Attached: {warningForm.fileName}</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="flex w-full justify-center sm:flex-row sm:justify-center sm:space-x-0">
            <Button
              onClick={handleSaveWarning}
              disabled={!canSaveWarning}
              className="w-48 justify-center py-3 text-base"
            >
              {editingWarning ? "Save" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isContractDialogOpen} onOpenChange={setIsContractDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload contract</DialogTitle>
            <DialogDescription>Add the signed employment contract for this employee.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Contract type</Label>
              <Select
                value={contractForm.contractType}
                onValueChange={(value) =>
                  setContractForm((prev) => ({ ...prev, contractType: value as ContractFormState["contractType"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select contract type" />
                </SelectTrigger>
                <SelectContent>
                  {contractTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractFile">Upload signed contract (PDF only)</Label>
              <Input
                id="contractFile"
                type="file"
                accept="application/pdf,.pdf"
                required
                onChange={handleContractFileChange}
              />
              {contractForm.fileName && <p className="text-xs text-muted-foreground">Attached: {contractForm.fileName}</p>}
            </div>
          </div>
          <DialogFooter className="flex w-full justify-center sm:flex-row sm:justify-center sm:space-x-0">
            <Button
              onClick={handleAddContract}
              disabled={!canUploadContract}
              className="w-48 justify-center py-3 text-base"
            >
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {deleteUndo && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <div className="relative flex items-center gap-3 rounded-full border border-blue-200 bg-white/95 px-4 py-2 text-sm font-medium text-blue-900 shadow-[0_6px_18px_rgba(59,130,246,0.3)] backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <span className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_25px_rgba(59,130,246,0.35)] animate-pulse" aria-hidden="true"></span>
            <div className="pointer-events-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-blue-900 hover:bg-transparent hover:text-blue-900 focus-visible:bg-transparent"
                onClick={handleUndoDelete}
              >
                Undo delete
                <span className="text-xs text-blue-600">{deleteUndoCountdown}s</span>
              </Button>
              <button
                type="button"
                className="text-blue-700 hover:text-blue-700 focus-visible:text-blue-700"
                onClick={clearDeleteUndoState}
                aria-label="Dismiss undo delete notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {warningDeleteUndo && (
        <div
          className={`pointer-events-none fixed inset-x-0 ${
            deleteUndo ? "top-20" : "top-4"
          } z-50 flex justify-center px-4`}
        >
          <div className="relative flex items-center gap-3 rounded-full border border-blue-200 bg-white/95 px-4 py-2 text-sm font-medium text-blue-900 shadow-[0_6px_18px_rgba(59,130,246,0.3)] backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <span className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_25px_rgba(59,130,246,0.35)] animate-pulse" aria-hidden="true"></span>
            <div className="pointer-events-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-blue-900 hover:bg-transparent hover:text-blue-900 focus-visible:bg-transparent"
                onClick={handleUndoWarningDelete}
              >
                Undo warning delete
                <span className="text-xs text-blue-600">{warningDeleteCountdown}s</span>
              </Button>
              <button
                type="button"
                className="text-blue-700 hover:text-blue-700 focus-visible:text-blue-700"
                onClick={clearWarningDeleteState}
                aria-label="Dismiss undo warning notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={Boolean(documentDialogEmployee)}
        onOpenChange={(open) => {
          if (!open) setDocumentDialogEmployee(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-blue-600 font-semibold uppercase tracking-wide text-sm">
              Documents
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select a document to generate for this employee.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-1">
              <Label htmlFor="document-select">Choose a document</Label>
              <Select
                value={selectedDocumentPath || ""}
                onValueChange={setSelectedDocumentPath}
              >
                <SelectTrigger id="document-select">
                  <SelectValue placeholder="Select a document to generate" />
                </SelectTrigger>
                <SelectContent>
                  {documentOptions.map((doc) => (
                    <SelectItem key={doc.path} value={doc.path} disabled={!doc.active}>
                      {doc.label} {!doc.active ? "(coming soon)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                const selected = documentOptions.find((d) => d.path === selectedDocumentPath);
                if (selected?.active) {
                  handleDocumentCategorySelect(selected.path);
                }
              }}
              disabled={!documentOptions.find((d) => d.path === selectedDocumentPath && d.active)}
            >
              Go
            </Button>
          </div>
        </DialogContent>
      </Dialog>
  </DashboardLayout>
);
 };

export default Employees;

