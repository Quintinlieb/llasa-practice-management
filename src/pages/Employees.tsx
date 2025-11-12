import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Plus,
  Trash2,
  Upload,
  FilePlus,
  Eye,
  EyeOff,
  Download,
  Search,
  Pencil,
  X,
  FileUp,
  User,
  UserCircle,
  UsersRound,
  Info,
  Sparkles,
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
  genderOptions,
  nationalityOptions,
  raceOptions,
  southAfricanProvinces,
  type EmployeeBasicFormData,
  type EmployeeProfileFormData,
} from "@/lib/validation";
import { maskSAIdNumber } from "@/lib/idMasking";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { documentCategories } from "@/constants/documentCategories";

type Employee = Tables<"employees">;
type EmployeeTab = "personal" | "employment" | "address" | "documents";
type AutoNumberUndoState = {
  previous: {
    id: string;
    company_id: string;
    employee_name: string;
    employee_surname: string;
    employee_number: string | null;
  }[];
  expiresAt: number;
  prefix: string;
};
type DeleteUndoState = {
  deletedEmployees: Employee[];
  expiresAt: number;
};

const DEFAULT_EMPLOYEE_NUMBER_PREFIX = "A";
const MAX_EMPLOYEE_NUMBER_PREFIX_LENGTH = 3;
const MAX_EMPLOYEE_NUMBER_LENGTH = EMPLOYEE_NUMBER_MAX_LENGTH;

const cleanPrefixInput = (value?: string | null) =>
  (value ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, MAX_EMPLOYEE_NUMBER_PREFIX_LENGTH);

const extractPrefixFromNumber = (value?: string | null) => {
  if (!value) return "";
  const match = value.toUpperCase().match(/^[A-Z]{1,3}/);
  return match?.[0] ?? "";
};

const normalizePrefix = (value?: string | null) => cleanPrefixInput(value) || DEFAULT_EMPLOYEE_NUMBER_PREFIX;
const cleanEmployeeNumberInput = (value?: string | null) => sanitizeEmployeeNumber(value);

const getSequenceLengthForPrefix = (prefix: string) =>
  Math.max(1, MAX_EMPLOYEE_NUMBER_LENGTH - prefix.length);

const formatAutoEmployeeNumber = (prefix: string, sequence: number) => {
  const normalizedPrefix = normalizePrefix(prefix);
  const sequenceLength = getSequenceLengthForPrefix(normalizedPrefix);
  const paddedSequence = String(sequence).padStart(sequenceLength, "0").slice(-sequenceLength);
  return cleanEmployeeNumberInput(`${normalizedPrefix}${paddedSequence}`);
};

const DEFAULT_NATIONALITY: EmployeeProfileFormData["nationality"] = "South African";
const dateToday = () => new Date().toISOString().split("T")[0];

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
   startDate: employee?.start_date ?? dateToday(),
   contractType: (employee?.contract_type as EmployeeProfileFormData["contractType"]) ?? "Permanent",
   endDate: employee?.end_date ?? "",
  gender: (employee?.gender as EmployeeProfileFormData["gender"]) ?? "",
  race: (employee?.race as EmployeeProfileFormData["race"]) ?? "",
  nationality: (employee?.nationality as EmployeeProfileFormData["nationality"]) ?? DEFAULT_NATIONALITY,
  employeeNumberMode: cleanEmployeeNumberInput(employee?.employee_number) ? "manual" : "auto",
  employeeNumberPrefix:
    extractPrefixFromNumber(employee?.employee_number) || DEFAULT_EMPLOYEE_NUMBER_PREFIX,
  employeeNumber: cleanEmployeeNumberInput(employee?.employee_number),
  jobTitle: employee?.job_title ?? "",
   physicalAddressLine1: employee?.physical_address_line1 ?? "",
   physicalAddressLine2: employee?.physical_address_line2 ?? "",
   city: employee?.city ?? "",
  province: (employee?.province as EmployeeProfileFormData["province"]) ?? "",
   areaCode: employee?.area_code ?? "",
   cellNumber: employee?.cell_number ?? "",
   email: employee?.email ?? "",
   emergencyContactName: employee?.emergency_contact_name ?? "",
   emergencyContactNumber: employee?.emergency_contact_number ?? "",
 });

const getNextEmployeeNumber = (currentEmployees: Employee[], prefix: string) => {
  const normalizedPrefix = normalizePrefix(prefix);
  const prefixLength = normalizedPrefix.length;
  const highestSequence = currentEmployees.reduce((max, employee) => {
    const currentNumber = cleanEmployeeNumberInput(employee.employee_number);
    if (!currentNumber.startsWith(normalizedPrefix)) {
      return max;
    }
    const sequence = parseInt(currentNumber.slice(prefixLength), 10);
    return Number.isNaN(sequence) ? max : Math.max(max, sequence);
  }, 0);
  return formatAutoEmployeeNumber(normalizedPrefix, highestSequence + 1);
};

const formatDisplayDate = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};


const TABLE_MAX_HEIGHT = "calc(100vh - 340px)";
const TABLE_BODY_MAX_HEIGHT = "calc(100vh - 340px - 56px)";

const Employees = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [contractFilter, setContractFilter] = useState<"all" | "permanent" | "temporary">("all");
   const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
   const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
   const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
   const [isLoading, setIsLoading] = useState(false);
   const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState<EmployeeTab>("personal");
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [addForm, setAddForm] = useState<EmployeeBasicFormData>(createBlankAddForm());
  const [profileForm, setProfileForm] = useState<EmployeeProfileFormData>(createProfileFormFromEmployee());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documentDialogEmployee, setDocumentDialogEmployee] = useState<Employee | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [autoNumberPrefixInput, setAutoNumberPrefixInput] = useState(DEFAULT_EMPLOYEE_NUMBER_PREFIX);
  const [isAutoNumberDialogOpen, setIsAutoNumberDialogOpen] = useState(false);
  const [isAutoAllocating, setIsAutoAllocating] = useState(false);
  const [autoNumberUndo, setAutoNumberUndo] = useState<AutoNumberUndoState | null>(null);
  const [autoNumberUndoCountdown, setAutoNumberUndoCountdown] = useState(0);
  const autoNumberUndoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoNumberUndoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [deleteUndo, setDeleteUndo] = useState<DeleteUndoState | null>(null);
  const [deleteUndoCountdown, setDeleteUndoCountdown] = useState(0);
  const deleteUndoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteUndoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoNumberPreview = useMemo(() => {
    if (profileForm.employeeNumberMode === "auto") {
      return getNextEmployeeNumber(employees, profileForm.employeeNumberPrefix);
    }
    return "";
  }, [employees, profileForm.employeeNumberMode, profileForm.employeeNumberPrefix]);

  const normalizedAutoNumberPrefix = useMemo(
    () => normalizePrefix(autoNumberPrefixInput),
    [autoNumberPrefixInput],
  );
  const autoNumberDialogPreviewStart = formatAutoEmployeeNumber(normalizedAutoNumberPrefix, 1);
  const autoNumberDialogPreviewEnd = formatAutoEmployeeNumber(
    normalizedAutoNumberPrefix,
    Math.max(employees.length, 2),
  );
  const isAddFormComplete =
    addForm.employeeName.trim().length > 0 && addForm.employeeSurname.trim().length > 0;
  const isAddFormSubmitDisabled = isLoading || !isAddFormComplete;
  const fieldWrapperClass = "space-y-1";
  const fieldLabelClass =
    "text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-blue-900/70";
  const baseFieldInputClass =
    "h-9 rounded-lg border border-border/60 bg-background/80 text-sm font-medium text-foreground shadow-sm placeholder:text-xs focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary/40 disabled:bg-background disabled:text-foreground disabled:border-border/60 disabled:opacity-100 disabled:cursor-default";
  const viewModeFieldInputExtras =
    "border-none bg-transparent shadow-none focus-visible:ring-0 focus-visible:border-transparent px-0 py-0 h-auto rounded-none";
  const fieldInputClass = `${baseFieldInputClass} ${isEditMode ? "" : viewModeFieldInputExtras}`;
  const fieldSelectTriggerClass = `${fieldInputClass} justify-between data-[placeholder]:text-muted-foreground data-[placeholder]:text-xs`;
  const fieldHelperTextClass = "text-xs text-muted-foreground";

  const getExistingPrefix = useCallback(() => {
    const existing = employees.find((emp) => extractPrefixFromNumber(emp.employee_number));
    const derived = existing ? extractPrefixFromNumber(existing.employee_number) : "";
    return derived || DEFAULT_EMPLOYEE_NUMBER_PREFIX;
  }, [employees]);

  const handleOpenAutoNumberDialog = () => {
    setAutoNumberPrefixInput(getExistingPrefix());
    setIsAutoNumberDialogOpen(true);
  };

  const clearAutoNumberUndoTimers = useCallback(() => {
    if (autoNumberUndoTimeoutRef.current) {
      clearTimeout(autoNumberUndoTimeoutRef.current);
      autoNumberUndoTimeoutRef.current = null;
    }
    if (autoNumberUndoIntervalRef.current) {
      clearInterval(autoNumberUndoIntervalRef.current);
      autoNumberUndoIntervalRef.current = null;
    }
  }, []);

  const clearAutoNumberUndoState = useCallback(() => {
    clearAutoNumberUndoTimers();
    setAutoNumberUndo(null);
    setAutoNumberUndoCountdown(0);
  }, [clearAutoNumberUndoTimers]);

  const startAutoNumberUndoTimers = useCallback(
    (expiresAt: number) => {
      clearAutoNumberUndoTimers();
      const updateCountdown = () => {
        const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
        setAutoNumberUndoCountdown(remaining);
      };
      updateCountdown();
      autoNumberUndoIntervalRef.current = setInterval(updateCountdown, 1000);
      autoNumberUndoTimeoutRef.current = setTimeout(() => {
        clearAutoNumberUndoState();
      }, Math.max(0, expiresAt - Date.now()));
    },
    [clearAutoNumberUndoTimers, clearAutoNumberUndoState],
  );

  const handleDocumentCategorySelect = (path: string) => {
    setDocumentDialogEmployee(null);
    navigate(path);
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

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
  }, [filteredEmployees.length]);

  useEffect(() => {
    if (autoNumberUndo) {
      startAutoNumberUndoTimers(autoNumberUndo.expiresAt);
    } else {
      clearAutoNumberUndoTimers();
      setAutoNumberUndoCountdown(0);
    }
    return () => {
      clearAutoNumberUndoTimers();
    };
  }, [autoNumberUndo, startAutoNumberUndoTimers, clearAutoNumberUndoTimers]);

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
  }, [filteredEmployees.length]);

  const fetchEmployees = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .eq("company_id", user.id)
      .order("employee_name", { ascending: true, nullsFirst: false })
      .order("employee_surname", { ascending: true, nullsFirst: false });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    const sorted = (data ?? []).sort((a, b) => {
      const nameA = `${a.employee_name ?? ""} ${a.employee_surname ?? ""}`.trim().toLowerCase();
      const nameB = `${b.employee_name ?? ""} ${b.employee_surname ?? ""}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });

    setEmployees(sorted);
    setFilteredEmployees(sorted);
  }, [toast, user]);

  useEffect(() => {
    if (user) {
      void fetchEmployees();
    }
  }, [user, fetchEmployees]);

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

      return matchesSearch && matchesContract;
    });

    const sorted = filtered.sort((a, b) => {
      const nameA = `${a.employee_name ?? ""} ${a.employee_surname ?? ""}`.trim().toLowerCase();
      const nameB = `${b.employee_name ?? ""} ${b.employee_surname ?? ""}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });

    setFilteredEmployees(sorted);
  }, [employees, searchQuery, contractFilter]);

  useEffect(() => {
    if (profileForm.employeeNumberMode === "auto") {
      setProfileForm((prev) => {
        const sanitizedPrefix =
          cleanPrefixInput(prev.employeeNumberPrefix) || DEFAULT_EMPLOYEE_NUMBER_PREFIX;
        return {
          ...prev,
          employeeNumberPrefix: sanitizedPrefix,
          employeeNumber: cleanEmployeeNumberInput(autoNumberPreview),
        };
      });
    }
  }, [profileForm.employeeNumberMode, autoNumberPreview]);

  const handleCustomEmployeeNumberChange = (value: string) => {
    const cleaned = cleanEmployeeNumberInput(value);
    setProfileForm((prev) => ({
      ...prev,
      employeeNumber: cleaned,
      employeeNumberMode: cleaned ? "manual" : prev.employeeNumberMode,
    }));
  };

  const handleAutoNumberDialogChange = (open: boolean) => {
    setIsAutoNumberDialogOpen(open);
    if (!open) {
      setIsAutoAllocating(false);
      setAutoNumberPrefixInput(getExistingPrefix());
    }
  };

  const handleAutoAllocateEmployeeNumbers = async () => {
    if (employees.length === 0) {
      toast({
        title: "No employees available",
        description: "Add employees before allocating numbers.",
        variant: "destructive",
      });
      return;
    }

    setIsAutoAllocating(true);
    try {
      const prefix = normalizedAutoNumberPrefix;
      const previousNumbers = employees.map((employee) => ({
        id: employee.id,
        company_id: employee.company_id,
        employee_name: employee.employee_name,
        employee_surname: employee.employee_surname,
        employee_number: employee.employee_number ?? null,
      }));
      const sorted = [...employees].sort((a, b) => {
        const nameA = `${a.employee_name ?? ""} ${a.employee_surname ?? ""}`.trim().toLowerCase();
        const nameB = `${b.employee_name ?? ""} ${b.employee_surname ?? ""}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      });

      const updates = sorted.map((employee, index) => ({
        id: employee.id,
        company_id: employee.company_id,
        employee_name: employee.employee_name,
        employee_surname: employee.employee_surname,
        employee_number: formatAutoEmployeeNumber(prefix, index + 1),
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("employees").upsert(updates, { onConflict: "id" });
      if (error) {
        throw error;
      }

      const firstNumber = formatAutoEmployeeNumber(prefix, 1);
      const lastNumber = formatAutoEmployeeNumber(prefix, sorted.length);
      toast({
        title: "Employee numbers updated",
        description: `Assigned numbers ${firstNumber} - ${lastNumber}.`,
      });
      handleAutoNumberDialogChange(false);
      setAutoNumberUndo({
        previous: previousNumbers,
        prefix,
        expiresAt: Date.now() + 20_000,
      });
      await fetchEmployees();
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to auto allocate",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsAutoAllocating(false);
    }
  };

  const handleUndoAutoNumber = async () => {
    if (!autoNumberUndo) return;
    try {
      const payload = autoNumberUndo.previous.map((entry) => ({
        id: entry.id,
        company_id: entry.company_id,
        employee_name: entry.employee_name,
        employee_surname: entry.employee_surname,
        employee_number: entry.employee_number,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from("employees").upsert(payload, { onConflict: "id" });
      if (error) throw error;

      toast({
        title: "Employee numbers restored",
        description: "Previous numbers have been reinstated.",
      });
      clearAutoNumberUndoState();
      await fetchEmployees();
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to undo",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    }
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
      const { error } = await supabase.from("employees").insert({
        company_id: user.id,
        employee_name: validated.employeeName,
        employee_surname: validated.employeeSurname,
        id_number: validated.idNumber || null,
        employee_number: validated.employeeNumber || null,
      });
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
       const finalEmployeeNumber =
         validated.employeeNumberMode === "auto"
           ? getNextEmployeeNumber(employees, validated.employeeNumberPrefix || DEFAULT_EMPLOYEE_NUMBER_PREFIX)
           : validated.employeeNumber || null;

       const { error } = await supabase
         .from("employees")
         .update({
          employee_name: validated.employeeName,
          employee_surname: validated.employeeSurname,
          id_number: validated.idNumber || null,
          start_date: validated.startDate,
          contract_type: validated.contractType,
           end_date: endDateValue,
           gender: validated.gender,
           race: validated.race,
           nationality: validated.nationality,
           employee_number: finalEmployeeNumber,
           job_title: validated.jobTitle || null,
           physical_address_line1: validated.physicalAddressLine1 || null,
           physical_address_line2: validated.physicalAddressLine2 || null,
           city: validated.city || null,
           province: validated.province,
           area_code: validated.areaCode || null,
           cell_number: validated.cellNumber || null,
           email: validated.email || null,
           emergency_contact_name: validated.emergencyContactName || null,
           emergency_contact_number: validated.emergencyContactNumber || null,
         })
         .eq("id", selectedEmployee.id);

       if (error) throw error;

      toast({
        title: "Employee updated",
        description: "Employee profile has been saved successfully.",
      });

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

      const validatedEmployees: TablesInsert<"employees">[] = [];
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

      const normalizeContractType = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return "";
        const match = contractTypes.find((type) => type.toLowerCase() === trimmed.toLowerCase());
        return match ?? trimmed;
      };

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

      const { error } = await supabase.from("employees").insert(validatedEmployees);
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
      ["Employee Number", "Name", "Surname", "ID Number", "Contract Type", "Job Title"],
      ["A0001", "John", "Doe", "9001015009087", "Permanent", "Store Manager"],
      ["B0002", "Jane", "Smith", "8505125800082", "Temporary", ""],
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
     setIsProfileDialogOpen(true);
   };

   const closeProfileDialog = () => {
     setIsProfileDialogOpen(false);
     setSelectedEmployee(null);
     setIsEditMode(false);
   };

  const renderPersonalTab = () => (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
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
      </div>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        <div className={fieldWrapperClass}>
          <Label className={fieldLabelClass}>
            Gender
          </Label>
          <Select
            value={profileForm.gender || undefined}
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
            value={profileForm.race || undefined}
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
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-4">
        <div className="min-w-[140px]">
          <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-blue-900/70">
            Physical Address:
          </p>
        </div>
        <div className="flex-1 space-y-3 sm:ml-4">
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
    </div>
  );

  const renderEmploymentTab = () => (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
          <div className="grid gap-2 rounded-xl border border-dashed border-border/60 bg-muted/20 p-3">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant={profileForm.employeeNumberMode === "manual" ? "default" : "outline"}
                disabled={!isEditMode}
                onClick={() =>
                  setProfileForm((prev) => ({
                    ...prev,
                    employeeNumberMode: "manual",
                  }))
                }
              >
                Manual
              </Button>
              <Button
                type="button"
                variant={profileForm.employeeNumberMode === "auto" ? "default" : "outline"}
                disabled={!isEditMode}
                onClick={() =>
                  setProfileForm((prev) => ({
                    ...prev,
                    employeeNumberMode: "auto",
                  }))
                }
              >
                Auto-generate
              </Button>
            </div>

            {profileForm.employeeNumberMode === "manual" ? (
              <div className={fieldWrapperClass}>
                <Input
                  className={fieldInputClass}
                  value={profileForm.employeeNumber}
                  disabled={!isEditMode}
                  maxLength={EMPLOYEE_NUMBER_MAX_LENGTH}
                  onChange={(e) => handleCustomEmployeeNumberChange(e.target.value)}
                  placeholder={`Up to ${EMPLOYEE_NUMBER_MAX_LENGTH} letters or numbers`}
                />
                <p className={fieldHelperTextClass}>
                  Maximum of {EMPLOYEE_NUMBER_MAX_LENGTH} letters or numbers.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Input
                  className={fieldInputClass}
                  value={profileForm.employeeNumberPrefix}
                  disabled={!isEditMode}
                  maxLength={MAX_EMPLOYEE_NUMBER_PREFIX_LENGTH}
                  placeholder={DEFAULT_EMPLOYEE_NUMBER_PREFIX}
                  onChange={(e) => {
                    const value = cleanPrefixInput(e.target.value);
                    setProfileForm((prev) => ({
                      ...prev,
                      employeeNumberPrefix: value,
                      employeeNumber: getNextEmployeeNumber(employees, value),
                    }));
                  }}
                />
                <p className={fieldHelperTextClass}>
                  Next number: <span className="font-medium text-primary">{autoNumberPreview}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderDocumentsTab = () => (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold">Employment Contract</h4>
          <p className="text-sm text-muted-foreground">
            Upload the signed employment contract for this employee.
          </p>
        </div>
        <Button type="button" variant="outline" disabled className="gap-2">
          <FileUp className="h-4 w-4" />
          Upload Contract (coming soon)
        </Button>
      </div>
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold">Warnings & Supporting Documents</h4>
          <p className="text-sm text-muted-foreground">
            Store written warnings or supporting documentation for disciplinary matters.
          </p>
        </div>
        <Button type="button" variant="outline" disabled className="gap-2">
          <FileUp className="h-4 w-4" />
          Upload Warning (coming soon)
        </Button>
      </div>
    </div>
  );

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
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Employees</h1>
            <p className="text-muted-foreground">Manage your employee records</p>
          </div>
          <div className="flex flex-wrap gap-3 justify-end">
            <Button
              variant="outline"
              onClick={handleBulkDelete}
              disabled={selectedEmployees.size === 0}
              className={`gap-2 ${
                selectedEmployees.size > 0
                  ? "border-destructive text-destructive hover:bg-destructive hover:text-white"
                  : ""
              }`}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>

            <Dialog open={isBulkDialogOpen} onOpenChange={handleBulkDialogChange}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Upload className="h-4 w-4" />
                  Bulk Upload
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader className="flex flex-col gap-2">
                  <div className="flex items-center gap-4">
                    <UsersRound className="h-10 w-10 flex-shrink-0 text-primary" aria-hidden="true" />
                    <div>
                      <DialogTitle>Bulk Upload</DialogTitle>
                      <DialogDescription>Add all your employees with a single upload.</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <div className="space-y-8">
                  <div>
                    <div className="space-y-3">
                      <div className="h-px bg-muted" />
                      <h4 className="text-sm font-semibold">Step 1: Download</h4>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Download the spreadsheet to capture your employee information.
                    </p>
                    <Button variant="outline" className="mt-4 gap-2 w-full text-primary [&_svg]:text-primary" onClick={downloadTemplate}>
                      <Download className="h-4 w-4" />
                      Download Template
                    </Button>
                  </div>
                  <div>
                    <div className="space-y-3">
                      <div className="h-px bg-muted" />
                      <h4 className="text-sm font-semibold">Step 2: Upload</h4>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Upload spreadsheet. Accepted formats: .xlsx or .xls
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleBulkUpload}
                      className="hidden"
                      id="bulk-upload"
                    />
                    <Button className="mt-4 gap-2 w-full" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
                      <Upload className="h-4 w-4" />
                      Upload File
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Employee
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader className="flex flex-col gap-2">
                  <div className="flex items-center gap-4">
                    <User className="h-10 w-10 flex-shrink-0 text-primary" aria-hidden="true" />
                    <div>
                      <DialogTitle>Add New Employee</DialogTitle>
                      <DialogDescription>Capture the employee&apos;s basic details to get started.</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <form onSubmit={handleAddEmployee} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="employeeName">Name *</Label>
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
                    <Label htmlFor="employeeSurname">Surname *</Label>
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
                    <Label htmlFor="idNumber">ID Number</Label>
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
                      <Label htmlFor="addEmployeeNumber">Employee Number (optional)</Label>
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
                          <TooltipContent side="top">
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
                    <p className="text-xs text-muted-foreground">Leave blank to assign later.</p>
                  </div>
                  <div className="mt-8 border-t border-dashed border-muted/60 pt-6">
                    <Button
                      type="submit"
                      className="w-full disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 disabled:cursor-not-allowed"
                      disabled={isAddFormSubmitDisabled}
                    >
                      {isLoading ? "Saving..." : "Add Employee"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-lg">
                <Input
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-12 rounded-xl border-2 border-primary/30 bg-white pr-12 text-sm shadow-md focus-visible:border-primary focus-visible:ring-0 dark:bg-background"
                />
                <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" aria-hidden="true" />
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <Select
                  value={contractFilter}
                  onValueChange={(value) => setContractFilter(value as "all" | "permanent" | "temporary")}
                >
                  <SelectTrigger className="w-full sm:w-52">
                    <SelectValue placeholder="Filter by contract" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="group">
                      All employees{" "}
                      <span className="text-primary text-[0.65rem] font-semibold transition-colors group-hover:text-white">
                        ({filteredEmployees.length})
                      </span>
                    </SelectItem>
                    <SelectItem value="permanent" className="group">
                      Permanent{" "}
                      <span className="text-primary text-[0.65rem] font-semibold transition-colors group-hover:text-white">
                        ({employees.filter((emp) => (emp.contract_type ?? "").toLowerCase() === "permanent").length})
                      </span>
                    </SelectItem>
                    <SelectItem value="temporary" className="group">
                      Temporary{" "}
                      <span className="text-primary text-[0.65rem] font-semibold transition-colors group-hover:text-white">
                        ({employees.filter((emp) => (emp.contract_type ?? "").toLowerCase() === "temporary").length})
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenAutoNumberDialog}
                        className="group w-full gap-2 sm:w-auto"
                        disabled={employees.length === 0}
                      >
                        <Sparkles className="h-4 w-4 text-primary transition-colors group-hover:text-white" />
                        Auto number
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      align="end"
                      sideOffset={12}
                      alignOffset={16}
                      className="max-w-xs text-xs text-muted-foreground"
                    >
                      <span className="text-blue-600 font-semibold">Caution:</span> this function allocates an employee number to all your listed employees irrespective of their start date.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {employees.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No employees added yet</p>
                <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Your First Employee
                </Button>
              </div>
            ) : (
              <div className="relative rounded-md overflow-hidden" style={{ maxHeight: TABLE_MAX_HEIGHT }}>
                <div className="grid grid-cols-[3rem_2fr_1.5fr_1.5fr_1.5fr_1fr] items-center gap-2 border-b bg-blue-50 dark:bg-blue-950/20 px-3 py-3 text-xs font-semibold text-muted-foreground">
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={filteredEmployees.length > 0 && selectedEmployees.size === filteredEmployees.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </div>
                  <div className="flex items-center leading-tight">Employee</div>
                  <div className="flex items-center gap-2 leading-tight">ID Number</div>
                  <div className="flex items-center leading-tight">Contract Type</div>
                  <div className="flex items-center leading-tight">Job Title</div>
                  <div className="flex items-center justify-center leading-tight text-center">Actions</div>
                </div>
                <div
                  ref={tableScrollRef}
                  className="divide-y employee-table-scroll overflow-y-auto"
                  style={{ maxHeight: TABLE_BODY_MAX_HEIGHT }}
                >
                  {filteredEmployees.map((employee) => (
                    <div
                      key={employee.id}
                      className="grid grid-cols-[3rem_2fr_1.5fr_1.5fr_1.5fr_1fr] items-center gap-2 px-3 py-1 text-xs hover:bg-muted/30"
                    >
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={selectedEmployees.has(employee.id)}
                          onCheckedChange={() => toggleSelectEmployee(employee.id)}
                        />
                      </div>
                      <div className="font-medium leading-tight">
                        <button
                          type="button"
                          onClick={() => openProfileDialog(employee)}
                          className="text-left hover:text-primary transition-colors"
                        >
                          {(employee.employee_name ?? "").trim()} {(employee.employee_surname ?? "").trim()}
                        </button>
                        {employee.employee_number && (
                          <p className="text-[10px] text-muted-foreground leading-tight">#{employee.employee_number}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 leading-tight">
                        <span className="text-xs font-normal">
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
                          {revealedIds.has(employee.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                      </div>
                      <div className="leading-tight">{employee.contract_type?.trim() || "--"}</div>
                      <div className="leading-tight">{employee.job_title?.trim() || "--"}</div>
                      <div className="flex items-center justify-center">
                        <TooltipProvider delayDuration={0} skipDelayDuration={0}>
                          <div className="flex items-center justify-center gap-1.5">
                            <Tooltip disableHoverableContent>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openProfileDialog(employee)}
                                  className="hover:text-primary hover:bg-muted/50 bg-transparent"
                                >
                                  <Search className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">View Profile</TooltipContent>
                            </Tooltip>
                            <Tooltip disableHoverableContent>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDocumentDialogEmployee(employee)}
                                  className="group hover:bg-muted/50 bg-transparent"
                                >
                                  <FilePlus className="h-4 w-4 transition-colors group-hover:text-primary" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Add Document</TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </div>
                    </div>
                  ))}
                </div>
                {showScrollHint && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
                    <div className="relative rounded-full border border-blue-100 bg-white/95 px-4 py-1 text-xs font-semibold text-blue-900 backdrop-blur supports-[backdrop-filter]:bg-white/80">
                      <span className="pointer-events-none absolute inset-0 rounded-full shadow-[0_3px_10px_rgba(59,130,246,0.35),0_-3px_10px_rgba(59,130,246,0.2)]" aria-hidden="true"></span>
                      <span className="relative">Scroll down</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {autoNumberUndo && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <div className="relative flex items-center gap-3 rounded-full border border-blue-200 bg-white/95 px-4 py-2 text-sm font-medium text-blue-900 shadow-[0_6px_18px_rgba(59,130,246,0.3)] backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <span className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_25px_rgba(59,130,246,0.35)] animate-pulse" aria-hidden="true"></span>
            <div className="pointer-events-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-blue-900 hover:bg-transparent hover:text-blue-900 focus-visible:bg-transparent"
                onClick={handleUndoAutoNumber}
              >
                Undo auto numbering
                <span className="text-xs text-blue-600">{autoNumberUndoCountdown}s</span>
              </Button>
              <button
                type="button"
                className="text-blue-700 hover:text-blue-700 focus-visible:text-blue-700"
                onClick={clearAutoNumberUndoState}
                aria-label="Dismiss undo notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteUndo && (
        <div
          className={`pointer-events-none fixed inset-x-0 ${
            autoNumberUndo ? "top-20" : "top-4"
          } z-50 flex justify-center px-4`}
        >
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

      <Dialog open={isAutoNumberDialogOpen} onOpenChange={handleAutoNumberDialogChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Auto allocate employee numbers</DialogTitle>
            <DialogDescription>Apply sequential numbers to every employee in your list.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="auto-number-prefix">Number prefix</Label>
              <Input
                id="auto-number-prefix"
                value={autoNumberPrefixInput}
                maxLength={MAX_EMPLOYEE_NUMBER_PREFIX_LENGTH}
                onChange={(e) => setAutoNumberPrefixInput(cleanPrefixInput(e.target.value))}
                placeholder={DEFAULT_EMPLOYEE_NUMBER_PREFIX}
                disabled={isAutoAllocating}
              />
              <p className="text-xs text-muted-foreground">
                Numbers will look like {autoNumberDialogPreviewStart}, {autoNumberDialogPreviewEnd}.
              </p>
            </div>
            <p className="rounded-md border border-dashed border-blue-200 bg-blue-50/70 px-3 py-2 text-xs text-blue-900">
              Existing employee numbers will be replaced for all {employees.length} employees.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => handleAutoNumberDialogChange(false)} disabled={isAutoAllocating}>
              Cancel
            </Button>
            <Button onClick={handleAutoAllocateEmployeeNumbers} disabled={isAutoAllocating}>
              {isAutoAllocating ? "Allocating..." : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isProfileDialogOpen} onOpenChange={(open) => (open ? undefined : closeProfileDialog())}>
        <DialogContent className="w-[85vw] max-w-4xl rounded-xl border border-border/50 bg-background p-0 shadow-lg transition-all duration-300 ease-out data-[state=open]:opacity-100 data-[state=closed]:opacity-0">
          <div className="flex flex-col gap-6 p-6">
            <DialogHeader className="text-left">
              <div className="flex items-center gap-4">
                <UserCircle className="h-12 w-12 text-blue-500" />
                <div className="space-y-1">
                  <DialogTitle>Employee Profile</DialogTitle>
                  <DialogDescription>
                    Here you can view, edit, and update this employee&apos;s information.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="font-medium">
                  {(selectedEmployee?.employee_name ?? "").trim()} {(selectedEmployee?.employee_surname ?? "").trim()}
                </p>
                <p className="text-sm text-muted-foreground">
                  Employee #{selectedEmployee?.employee_number ?? "Not assigned"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={isEditMode ? "outline" : "default"}
                  size="sm"
                  className="gap-2"
                  onClick={() => setIsEditMode((prev) => !prev)}
                >
                  {isEditMode ? (
                    <>
                      <X className="h-4 w-4" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <Pencil className="h-4 w-4" />
                      Edit
                    </>
                  )}
                </Button>
                {isEditMode && (
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={handleProfileSave}
                    disabled={isProfileSaving}
                  >
                    {isProfileSaving ? "Saving..." : "Save"}
                  </Button>
                )}
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as EmployeeTab)} className="mt-0">
              <TabsList className="grid gap-2 sm:grid-cols-4 w-full">
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="employment">Employment</TabsTrigger>
                <TabsTrigger value="address">Address</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
              </TabsList>
              <TabsContent value="personal" className="mt-6">
                {renderPersonalTab()}
              </TabsContent>
              <TabsContent value="employment" className="mt-6">
                {renderEmploymentTab()}
              </TabsContent>
              <TabsContent value="address" className="mt-6">
                {renderAddressTab()}
              </TabsContent>
              <TabsContent value="documents" className="mt-6">
                {renderDocumentsTab()}
              </TabsContent>
            </Tabs>
          </div>
      </DialogContent>
    </Dialog>

    <Dialog
      open={Boolean(documentDialogEmployee)}
      onOpenChange={(open) => {
        if (!open) setDocumentDialogEmployee(null);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-blue-600 font-semibold uppercase tracking-wide text-sm">
            Document Category
          </DialogTitle>
          <DialogDescription>
            {documentDialogEmployee
              ? `Choose a category type for ${(documentDialogEmployee.employee_name ?? "").trim()} ${(documentDialogEmployee.employee_surname ?? "").trim()}.`
              : "Choose a category type to continue."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {documentCategories.map((category) => (
            <Button
              key={category.slug}
              variant="outline"
              className="justify-center text-sm"
              onClick={() => handleDocumentCategorySelect(category.path)}
            >
              {category.label}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  </DashboardLayout>
);
 };

export default Employees;





