import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type SVGProps } from "react";
import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, FileText, ArrowLeft, ArrowRight, Building2, User2, Briefcase, Check, Undo2, X, Info, Plus, Upload, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import { temporaryContractSchema, salaryFrequencyOptions } from "@/lib/validation";
import type { Tables } from "@/integrations/supabase/types";
import { read, utils, write } from "xlsx";
import { cn } from "@/lib/utils";

type SalaryFrequency = (typeof salaryFrequencyOptions)[number];
type InterpreterOption = "yes" | "no";
type ContractFormState = {
  employeeId: string;
  startDate: string;
  endType: "date" | "completion";
  endDate: string;
  issueDate: string;
  employeeName: string;
  employeeSurname: string;
  employeeIdNumber: string;
  passportNumber: string;
  employeeAddress: string;
  employeePostalAddress: string;
  employeeNumber: string;
  nationality: string;
  gender: string;
  race: string;
  employeeCell: string;
  alternativeContact: string;
  employeeEmail: string;
  tradingName: string;
  employerContact: string;
  employerEmail: string;
  jobTitle: string;
  salaryAmount: string;
  salaryFrequency: SalaryFrequency;
  projectScope: string;
  workplace: string;
  interpreter: InterpreterOption;
  additionalNotes: string;
};

type ValidatedTempData = Omit<ContractFormState, "salaryAmount"> & { salaryAmount: number };

type TempEmployeeRow = {
  id: string;
  employeeName: string;
  employeeSurname: string;
  employeeIdNumber: string;
  passportNumber: string;
  employeeCell: string;
  employeeAddress: string;
};

const makeRowId = () => `emp-${Math.random().toString(16).slice(2, 8)}`;

type ClauseDefinition = {
  id: string;
  title: string;
  body: string | string[];
};

type CustomClause = ClauseDefinition & { insertAfterId: string | null };

const salaryFrequencyLabels: Record<SalaryFrequency, string> = {
  month: "per month",
  week: "per week",
  day: "per day",
  hour: "per hour",
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", minimumFractionDigits: 2 }).format(amount);

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });
};

const buildDurationClauseBody = (
  data: Pick<ValidatedTempData, "endType" | "projectScope" | "startDate" | "endDate">
) => {
  const projectScope = data.projectScope?.trim() ? data.projectScope : "the project/scope described above";
  const start = data.startDate ? formatDate(data.startDate) : "the Start Date recorded on Page 1";
  const end =
    data.endType === "completion"
      ? "completion of the project"
      : data.endDate
        ? formatDate(data.endDate)
        : "the End Date recorded on Page 1";

  const paragraphOne = `The Employee is employed for the project: ${projectScope}. This contract will commence on ${start} and automatically terminate on ${end}.`;
  const paragraphTwo =
    "The Employee specifically agrees that there is no expectation of renewal or extension of this contract. Even if this contract is extended or renewed, the Employee expressly agrees that such extension or renewal does not create an expectation of renewal, extension, or indefinite employment, regardless of how many times it is extended or renewed.";

  return [paragraphOne, paragraphTwo];
};

const buildTerminationClauseBody = (data: Pick<ValidatedTempData, "endType" | "endDate">) => {
  const endDateText =
    data.endType === "completion"
      ? "completion of the project"
      : data.endDate
        ? formatDate(data.endDate)
        : "the End Date stated above";

  return [
    `This contract will automatically terminate on ${endDateText} and no notice of termination is required.`,
    `If the contract is terminated earlier than ${endDateText} by either party, the notice periods in terms of the BCEA will apply.`,
    "If the employment is terminated by the Employer for misconduct, it will be a summary termination and no notice is required.",
  ];
};

const extractYear = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 4) : String(date.getFullYear());
};

const makeClauseId = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/(^-|-$)/g, "");

const withClauseIds = (clauses: Array<Omit<ClauseDefinition, "id">>): ClauseDefinition[] =>
  clauses.map((clause) => ({ ...clause, id: makeClauseId(clause.title) }));

const generateCustomClauseId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const TemporaryContractGenerator = ({
  embedded = false,
  onStepChange,
  onStepMetaChange,
}: {
  embedded?: boolean;
  onStepChange?: (step: string | null) => void;
  onStepMetaChange?: (meta: {
    steps: readonly string[];
    activeStep: number;
    icons?: readonly ComponentType<SVGProps<SVGSVGElement>>[];
    canGoNext?: boolean;
    canGoBack?: boolean;
    onNext?: () => void;
    onBack?: () => void;
  }) => void;
}) => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  type SlimProfile = Pick<
    Tables<"profiles">,
    "id" | "company_name" | "registration_number" | "physical_address" | "company_email" | "company_contact"
  >;

  const [profile, setProfile] = useState<SlimProfile | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showFinalActions, setShowFinalActions] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [validatedPreview, setValidatedPreview] = useState<ValidatedTempData | null>(null);
  const [clauseEdits, setClauseEdits] = useState<Record<string, string>>({});
  const [editingClause, setEditingClause] = useState<string | null>(null);
  const [clauseDraft, setClauseDraft] = useState("");
  const [customClauses, setCustomClauses] = useState<CustomClause[]>([]);
  const [addingAfter, setAddingAfter] = useState<string | null | undefined>(undefined);
  const [newClauseTitle, setNewClauseTitle] = useState("");
  const [newClauseBody, setNewClauseBody] = useState("");
  const steps = ["Employer Details", "Employee Details", "Employment Details"] as const;
  const stepIcons = [Building2, User2, Briefcase] as const;
  const [activeStep, setActiveStep] = useState(0);
  const currentYear = new Date().getFullYear();
  const [issueYear, setIssueYear] = useState<string>(String(currentYear));
  const [showEmployeeHint, setShowEmployeeHint] = useState(false);
  const [hasDismissedEmployeeHint, setHasDismissedEmployeeHint] = useState(false);
  const [tempEmployees, setTempEmployees] = useState<TempEmployeeRow[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [newEmployeeIdType, setNewEmployeeIdType] = useState<"id" | "passport">("id");
  const [newEmployeeForm, setNewEmployeeForm] = useState<Omit<TempEmployeeRow, "id">>({
    employeeName: "",
    employeeSurname: "",
    employeeIdNumber: "",
    passportNumber: "",
    employeeCell: "",
    employeeAddress: "",
  });
  const bulkUploadInputRef = useRef<HTMLInputElement | null>(null);
  const snippetPaddingTopMm = 2;
  const snippetVisibleHeightMm = 297 / 2; // show top half of the page
  const snippetContainerWidthMm = 150;
  const snippetScale = useMemo(
    () =>
      Math.min(
        (snippetContainerWidthMm - 4) / 210, // small horizontal gutter so full width fits
        (160 - snippetPaddingTopMm) / snippetVisibleHeightMm,
      ),
    [snippetContainerWidthMm, snippetPaddingTopMm, snippetVisibleHeightMm],
  );

  useEffect(() => {
    if (!embedded) return;
    onStepChange?.(steps[activeStep] ?? null);
  }, [activeStep, embedded, onStepChange, steps]);


  const [formData, setFormData] = useState<ContractFormState>({
    employeeId: "",
    startDate: new Date().toISOString().split("T")[0],
    endType: "date",
    endDate: "",
    issueDate: `${currentYear}-01-01`,
    employeeName: "",
    employeeSurname: "",
    employeeIdNumber: "",
    passportNumber: "",
    employeeAddress: "",
    employeePostalAddress: "",
    employeeNumber: "",
    nationality: "South African",
    gender: "",
    race: "",
    employeeCell: "",
    alternativeContact: "",
    employeeEmail: "",
    tradingName: "",
    employerContact: "",
    employerEmail: "",
    jobTitle: "",
    salaryAmount: "",
    salaryFrequency: "month",
    projectScope: "",
    workplace: "",
    interpreter: "no",
    additionalNotes: "",
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    if (hasDismissedEmployeeHint || activeStep !== 1) {
      setShowEmployeeHint(false);
      return;
    }
    const timer = setTimeout(() => setShowEmployeeHint(true), 1000);
    return () => clearTimeout(timer);
  }, [activeStep, hasDismissedEmployeeHint]);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, company_name, registration_number, physical_address, company_email, company_contact")
      .eq("id", user.id)
      .maybeSingle();
    if (error) {
      console.warn("Unable to load profile", error);
      return;
    }
    if (data) setProfile(data as SlimProfile);
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    if (profile) {
      setFormData((prev) => ({
        ...prev,
        workplace: prev.workplace || profile.physical_address || "",
        employerContact: prev.employerContact || profile.company_contact || "",
        employerEmail: prev.employerEmail || profile.company_email || "",
      }));
    }
  }, [profile]);

  const applyEmployeeToFormData = useCallback((employee: TempEmployeeRow | null) => {
    setFormData((prev) => ({
      ...prev,
      employeeName: employee?.employeeName ?? "",
      employeeSurname: employee?.employeeSurname ?? "",
      employeeIdNumber: employee?.employeeIdNumber ?? "",
      passportNumber: employee?.passportNumber ?? "",
      employeeCell: employee?.employeeCell ?? "",
      employeeAddress: employee?.employeeAddress ?? "",
    }));
  }, []);

  useEffect(() => {
    const normalizedYear = issueYear.length === 4 ? issueYear : String(currentYear);
    const nextIssueDate = `${normalizedYear}-01-01`;
    setFormData((prev) => (prev.issueDate === nextIssueDate ? prev : { ...prev, issueDate: nextIssueDate }));
    setValidatedPreview((prev) =>
      prev && prev.issueDate !== nextIssueDate ? { ...prev, issueDate: nextIssueDate } : prev,
    );
  }, [issueYear, currentYear]);

  const resetNewEmployeeForm = () => {
    setNewEmployeeForm({
      employeeName: "",
      employeeSurname: "",
      employeeIdNumber: "",
      passportNumber: "",
      employeeCell: "",
      employeeAddress: "",
    });
    setNewEmployeeIdType("id");
  };

  const handleAddEmployeeSave = () => {
    const name = newEmployeeForm.employeeName.trim();
    const surname = newEmployeeForm.employeeSurname.trim();
    const cell = newEmployeeForm.employeeCell.trim();
    const address = newEmployeeForm.employeeAddress.trim();
    const idNumber = newEmployeeIdType === "id" ? newEmployeeForm.employeeIdNumber.replace(/\D/g, "") : "";
    const passportNumber = newEmployeeIdType === "passport" ? newEmployeeForm.passportNumber.trim() : "";
    if (!name || !surname || !cell || !address || (!idNumber && !passportNumber)) {
      toast({
        title: "Please complete required fields",
        description: "Name, surname, ID/Passport, cell number, and address are required.",
        variant: "destructive",
      });
      return;
    }
    const row: TempEmployeeRow = {
      id: makeRowId(),
      employeeName: name,
      employeeSurname: surname,
      employeeIdNumber: newEmployeeIdType === "id" ? idNumber : "",
      passportNumber: newEmployeeIdType === "passport" ? passportNumber : "",
      employeeCell: cell,
      employeeAddress: address,
    };
    setTempEmployees((prev) => [...prev, row]);
    setSelectedEmployeeIds([]);
    applyEmployeeToFormData(row);
    setShowAddEmployee(false);
    resetNewEmployeeForm();
  };

  const handleBulkUploadClick = () => {
    bulkUploadInputRef.current?.click();
  };

  const handleDownloadTemplate = () => {
    const header = ["Name", "Surname", "ID Number", "Passport Number", "Cell Number", "Residential Address"];
    const example = ["Jane", "Doe", "9001011234088", "", "0821234567", "123 Main St, Cape Town, WC, 8001"];
    const blankRows = Array.from({ length: 10 }, () => ["", "", "", "", "", ""]);
    const rows = [header, example, ...blankRows];
    const ws = utils.aoa_to_sheet(rows);

    const textCols = [2, 3, 4]; // zero-based column indexes for ID/Passport/Cell
    for (let r = 1; r < rows.length; r += 1) {
      textCols.forEach((c) => {
        const cellRef = utils.encode_cell({ c, r });
        if (!ws[cellRef]) {
          ws[cellRef] = { t: "s", v: "" };
        } else {
          ws[cellRef].t = "s";
        }
        ws[cellRef].z = "@";
      });
    }

    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Template");
    const wbout = write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "temp_contract_employees_template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkUploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
      const normalizeKey = (key: string) => key.toLowerCase().trim();
      const getValue = (row: Record<string, string>, keys: string[]) => {
        for (const key of keys) {
          const match = Object.entries(row).find(([k]) => normalizeKey(k) === normalizeKey(key));
          if (match) return String(match[1]).trim();
        }
        return "";
      };
      const parsed: TempEmployeeRow[] = rows
        .map((row) => {
          const employeeName = getValue(row, ["name", "employee name", "first name"]);
          const employeeSurname = getValue(row, ["surname", "last name"]);
          const employeeIdNumber = getValue(row, ["id", "id number", "idno"]).replace(/\D/g, "");
          const passportNumber = getValue(row, ["passport", "passport number"]);
          const employeeCell = getValue(row, ["cell", "cell number", "phone"]).replace(/\D/g, "").slice(0, 10);
          const employeeAddress = getValue(row, ["address", "residential address"]);
          if (!employeeName || !employeeSurname || (!employeeIdNumber && !passportNumber) || !employeeCell || !employeeAddress) {
            return null;
          }
          return {
            id: makeRowId(),
            employeeName,
            employeeSurname,
            employeeIdNumber,
            passportNumber,
            employeeCell,
            employeeAddress,
          } as TempEmployeeRow;
        })
        .filter(Boolean) as TempEmployeeRow[];
      if (!parsed.length) {
        toast({
          title: "No valid rows found",
          description: "Ensure the spreadsheet has Name, Surname, ID/Passport, Cell, and Address columns.",
          variant: "destructive",
        });
        return;
      }
      setTempEmployees((prev) => [...prev, ...parsed]);
      setSelectedEmployeeIds([]);
      applyEmployeeToFormData(parsed[0]);
      toast({
        title: "Bulk upload added",
        description: `${parsed.length} employee${parsed.length === 1 ? "" : "s"} added.`,
      });
    } catch (error) {
      console.error("Bulk upload failed", error);
      toast({
        title: "Could not read file",
        description: "Please upload a valid Excel file with the required columns.",
        variant: "destructive",
      });
    } finally {
      if (event.target) event.target.value = "";
    }
  };

  const primaryEmployee = useMemo(() => {
    if (!tempEmployees.length) return null;
    const selected = tempEmployees.find((emp) => selectedEmployeeIds.includes(emp.id));
    return selected ?? tempEmployees[0];
  }, [selectedEmployeeIds, tempEmployees]);

  useEffect(() => {
    applyEmployeeToFormData(primaryEmployee);
  }, [applyEmployeeToFormData, primaryEmployee]);

  const toggleSelectAllEmployees = (checked: boolean) => {
    if (checked) {
      setSelectedEmployeeIds(tempEmployees.map((emp) => emp.id));
    } else {
      setSelectedEmployeeIds([]);
    }
  };

  const toggleSelectEmployee = (employeeId: string, checked: boolean) => {
    setSelectedEmployeeIds((prev) =>
      checked ? [...prev, employeeId] : prev.filter((id) => id !== employeeId),
    );
  };

  const handleDeleteSelected = () => {
    if (!selectedEmployeeIds.length) return;
    setTempEmployees((prev) => {
      const updated = prev.filter((emp) => !selectedEmployeeIds.includes(emp.id));
      applyEmployeeToFormData(updated[0] ?? null);
      return updated;
    });
    setSelectedEmployeeIds([]);
  };

  const resetForm = () => {
    const resetYearValue = new Date().getFullYear();
    setFormData({
      employeeId: "",
      startDate: new Date().toISOString().split("T")[0],
      endType: "date",
      endDate: "",
      issueDate: `${resetYearValue}-01-01`,
      employeeName: "",
      employeeSurname: "",
      employeeIdNumber: "",
      passportNumber: "",
      employeeAddress: "",
      employeePostalAddress: "",
      employeeNumber: "",
      nationality: "South African",
      gender: "",
      race: "",
      employeeCell: "",
      alternativeContact: "",
      employeeEmail: "",
      tradingName: "",
      employerContact: profile?.company_contact || "",
      employerEmail: profile?.company_email || "",
      jobTitle: "",
      salaryAmount: "",
      salaryFrequency: "month",
      projectScope: "",
      workplace: profile?.physical_address || "",
      interpreter: "no",
      additionalNotes: "",
    });
    setIssueYear(String(resetYearValue));
    setTempEmployees([]);
    setSelectedEmployeeIds([]);
    applyEmployeeToFormData(null);
    setValidatedPreview(null);
    setShowPreview(false);
    setShowFinalActions(false);
    setActiveStep(0);
    setClauseEdits({});
    setCustomClauses([]);
    setEditingClause(null);
    setClauseDraft("");
    setAddingAfter(null);
    setNewClauseTitle("");
    setNewClauseBody("");
  };

  const isEmployerStepComplete = useMemo(
    () => Boolean(formData.employerContact && formData.employerEmail),
    [formData.employerContact, formData.employerEmail],
  );

  const isEmployeeStepComplete = useMemo(() => tempEmployees.length > 0, [tempEmployees]);

  const isEmploymentStepComplete = useMemo(() => {
    const hasEndDate = formData.endType === "date" ? Boolean(formData.endDate) : true;
    return Boolean(
      formData.startDate &&
        hasEndDate &&
        formData.jobTitle &&
        formData.projectScope &&
        formData.salaryAmount &&
        formData.salaryFrequency &&
        formData.workplace &&
        formData.interpreter,
    );
  }, [
    formData.startDate,
    formData.endDate,
    formData.endType,
    formData.jobTitle,
    formData.projectScope,
    formData.salaryAmount,
    formData.salaryFrequency,
    formData.workplace,
    formData.interpreter,
  ]);

  const isFormComplete = useMemo(
    () => isEmployerStepComplete && isEmployeeStepComplete && isEmploymentStepComplete,
    [isEmployerStepComplete, isEmployeeStepComplete, isEmploymentStepComplete],
  );

  const canGoNext = useMemo(() => {
    if (activeStep === 0) return isEmployerStepComplete;
    if (activeStep === 1) return isEmployeeStepComplete;
    return false;
  }, [activeStep, isEmployerStepComplete, isEmployeeStepComplete]);

  const canNavigateToStep = (index: number) => {
    return index < activeStep;
  };

  const handleStepClick = (index: number) => {
    if (canNavigateToStep(index)) {
      if (index > 0) {
        if (showEmployeeHint) {
          setShowEmployeeHint(false);
        }
      }
      setActiveStep(index);
    }
  };

  const handleNext = () => {
    if (activeStep < steps.length - 1 && canGoNext) {
      if (activeStep === 0) {
        if (showEmployeeHint) {
          setShowEmployeeHint(false);
        }
      }
      setActiveStep((prev) => prev + 1);
    }
  };

  const canAdvance = activeStep === steps.length - 1 ? isFormComplete : canGoNext;

  const handleNextOrFinish = () => {
    if (activeStep === steps.length - 1) {
      if (isFormComplete) {
        handleFinish();
      }
      return;
    }
    handleNext();
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1);
    }
  };

  useEffect(() => {
    if (!embedded) return;
    onStepMetaChange?.({
      steps,
      activeStep,
      icons: stepIcons,
      canGoNext: canAdvance,
      canGoBack: activeStep > 0,
      onNext: handleNextOrFinish,
      onBack: handleBack,
    });
  }, [
    activeStep,
    embedded,
    onStepMetaChange,
    steps,
    stepIcons,
    canAdvance,
    handleNextOrFinish,
    handleBack,
    isFormComplete,
  ]);

  const validateData = (): ValidatedTempData => {
    if (!primaryEmployee) {
      throw new Error("Add at least one employee in Step 2 before continuing.");
    }
    const normalizedYear = issueYear.length === 4 ? issueYear : String(currentYear);
    const issueDateValue = `${normalizedYear}-01-01`;
    return temporaryContractSchema.parse({
      ...formData,
      issueDate: issueDateValue,
      ...primaryEmployee,
      salaryAmount: formData.salaryAmount,
      endDate: formData.endDate,
    }) as ValidatedTempData;
  };

  const serializeClauseBody = (body: string | string[]) => (Array.isArray(body) ? body.join("\n\n") : body);

  const normalizeBodyText = (text: string) => {
    const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    return paragraphs.length ? paragraphs : text.trim();
  };

  const applyClauseEdits = (clauses: ClauseDefinition[]): ClauseDefinition[] =>
    clauses.map((clause) => {
      const edited = clauseEdits[clause.id];
      if (!edited) return clause;
      return { ...clause, body: normalizeBodyText(edited) };
    });

  const mergeClauses = useCallback(
    (baseClauses: ClauseDefinition[]): ClauseDefinition[] => {
      const merged = [...baseClauses];
      customClauses.forEach((customClause) => {
        const insertIndex = customClause.insertAfterId
          ? merged.findIndex((clause) => clause.id === customClause.insertAfterId) + 1
          : 0;
        const safeIndex = Number.isInteger(insertIndex) && insertIndex > 0 ? insertIndex : 0;
        merged.splice(safeIndex, 0, customClause);
      });
      return merged;
    },
    [customClauses],
  );

  useEffect(() => {
    if (!showFinalActions) return;
    try {
      const validated = validateData();
      setValidatedPreview(validated);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please check the required fields.";
      toast({
        title: "Validation error",
        description: message,
        variant: "destructive",
      });
      setShowFinalActions(false);
    }
  }, [showFinalActions, formData, primaryEmployee]);

  useEffect(() => {
    if (!showFinalActions) return;
    try {
      const validated = validateData();
      setValidatedPreview(validated);
    } catch {
      // ignore until user corrects inputs
    }
  }, [issueYear, showFinalActions]);

  const FirstPagePreview = ({ data, compact = false }: { data: ValidatedTempData; compact?: boolean }) => {
    const displayValue = (value?: string | number | null) => (value && value.toString().trim() ? value.toString() : "________________________");
    const salaryDisplay = `${formatCurrency(data.salaryAmount)} ${salaryFrequencyLabels[data.salaryFrequency]}`;
    const workplace = data.workplace || profile?.physical_address || "";
    const idOrPassport = data.employeeIdNumber || data.passportNumber || "";
    const endInfoLabel = data.endType === "completion" ? "Ends on completion of" : "End date";
    const endInfoValue =
      data.endType === "completion"
        ? data.projectScope || "completion of the project/scope"
        : formatDate(data.endDate);

    const SectionBlock = ({
      title,
      subtitle,
      children,
    }: {
      title: string;
      subtitle?: string;
      children: ReactNode;
    }) => (
      <div className="space-y-2">
        <div className="w-full flex items-center justify-between rounded-md bg-slate-100 border border-slate-300 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-700">
          <span>{title}</span>
          {subtitle ? <span className="ml-2 italic normal-case font-medium text-gray-600">{subtitle}</span> : null}
        </div>
        <div className="space-y-1.5 px-1 text-[11px] text-gray-900">
          {children}
        </div>
      </div>
    );

    const Row = ({ label, value }: { label: string; value?: string | number | null }) => (
      <div className="grid grid-cols-[120px_1fr] gap-2 text-[11px]">
        <span className="font-semibold text-gray-700">{label}:</span>
        <span className="text-gray-900">{displayValue(value)}</span>
      </div>
    );

    const DualRow = ({
      leftLabel,
      leftValue,
      rightLabel,
      rightValue,
    }: {
      leftLabel: string;
      leftValue?: string | number | null;
      rightLabel: string;
      rightValue?: string | number | null;
    }) => (
      <div className="grid grid-cols-2 gap-4 text-[11px]">
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <span className="font-semibold text-gray-700 whitespace-nowrap">{leftLabel}:</span>
          <span className="text-gray-900">{displayValue(leftValue)}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <span className="font-semibold text-gray-700 whitespace-nowrap">{rightLabel}:</span>
          <span className="text-gray-900">{displayValue(rightValue)}</span>
        </div>
      </div>
    );

    return (
      <div
        className="bg-white text-black p-8 mx-auto border border-slate-200 shadow-sm flex flex-col"
        style={{ width: "210mm", minHeight: compact ? undefined : "297mm" }}
      >
        <h1 className="text-xl font-bold text-center text-gray-900 mb-6 uppercase tracking-wide">Employment Information</h1>

        <div className="space-y-6 flex-1">
          <SectionBlock title="A. Employer details">
            <Row label="Company name" value={profile?.company_name} />
            <Row label="Reg. number" value={profile?.registration_number} />
            <Row label="Address" value={profile?.physical_address} />
            <Row label="Email" value={profile?.company_email} />
            <Row label="Contact" value={profile?.company_contact} />
          </SectionBlock>

          <SectionBlock title="B. Employee details">
            <DualRow leftLabel="Surname" leftValue={data.employeeSurname} rightLabel="Name(s)" rightValue={data.employeeName} />
            <Row label="ID / Passport" value={idOrPassport || "--"} />
            <Row label="Contact number" value={data.employeeCell} />
            <Row label="Address" value={data.employeeAddress} />
          </SectionBlock>

          <SectionBlock title="C. Employment details">
            <DualRow leftLabel="Type" leftValue="Temporary" rightLabel="Start date" rightValue={formatDate(data.startDate)} />
            <DualRow leftLabel={endInfoLabel} leftValue={endInfoValue} rightLabel="Gross salary" rightValue={salaryDisplay} />
            <DualRow leftLabel="Job title" leftValue={data.jobTitle} rightLabel="Interpreter" rightValue={data.interpreter === "yes" ? "Yes" : "No"} />
            <Row label="Workplace" value={workplace} />
            <Row label="Project/Scope" value={data.projectScope} />
          </SectionBlock>
        </div>

      </div>
    );
  };

  const addWrappedText = (
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    fontSize = 10,
    fontStyle: "normal" | "bold" | "italic" | "bolditalic" = "normal",
  ) => {
    doc.setFont("helvetica", fontStyle);
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxWidth);
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 18;
    let cursorY = y;

    lines.forEach((line) => {
      if (cursorY > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
      }
      doc.text(line, x, cursorY);
      cursorY += lineHeight;
    });

    return cursorY;
  };

  const buildPdfDocument = (data: ValidatedTempData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 18;
    const contentWidth = pageWidth - margin * 2;
    const formattedSalary = `${formatCurrency(data.salaryAmount)} ${salaryFrequencyLabels[data.salaryFrequency]}`;
    const issueYear = extractYear(data.issueDate);
    let y = margin;

    const ensureSpace = (space: number) => {
      if (y + space > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    };

    const valueOrLine = (value?: string | number | null) => {
      if (typeof value === "number") return value.toString();
      if (typeof value === "string" && value.trim()) return value;
      return "________________________";
    };

    const drawSection = (title: string, subtitle: string | undefined, renderContent: () => void) => {
      ensureSpace(18);
      const headerHeight = 9;
      doc.setFillColor(237, 242, 247);
      doc.setDrawColor(200, 204, 209);
      doc.roundedRect(margin, y, contentWidth, headerHeight, 2, 2, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(45, 55, 72);
      doc.text(title.toUpperCase(), margin + 4, y + 6);
      if (subtitle) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.text(subtitle, margin + contentWidth - 4, y + 6, { align: "right" });
      }
      y += headerHeight + 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      renderContent();
      y += 8;
    };

    const drawSingleRow = (label: string, value?: string | number | null) => {
      const labelWidth = 42;
      const availableWidth = contentWidth - labelWidth - 6;
      const lineHeight = 5.5;
      const lines = doc.splitTextToSize(valueOrLine(value), availableWidth);
      const rowHeight = lines.length * lineHeight + 3;

      ensureSpace(rowHeight);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(55, 65, 81);
      doc.text(`${label}:`, margin + 3, y + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      lines.forEach((line, idx) => {
        doc.text(line, margin + labelWidth, y + 6 + idx * lineHeight);
      });

      y += rowHeight;
    };

    const drawDualRow = (
      leftLabel: string,
      leftValue: string | number | null,
      rightLabel: string,
      rightValue: string | number | null,
      valueFontSize = 10,
    ) => {
      const columnWidth = contentWidth / 2;
      const labelWidth = 42;
      const availableWidth = columnWidth - labelWidth;
      const lineHeight = 5.5;
      const leftLines = doc.splitTextToSize(valueOrLine(leftValue), availableWidth);
      const rightLines = doc.splitTextToSize(valueOrLine(rightValue), availableWidth);
      const rowHeight = Math.max(leftLines.length, rightLines.length) * lineHeight + 3;

      ensureSpace(rowHeight);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(55, 65, 81);
      doc.text(`${leftLabel}:`, margin + 3, y + 6);
      doc.text(`${rightLabel}:`, margin + columnWidth, y + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(valueFontSize);
      doc.setTextColor(0, 0, 0);
      leftLines.forEach((line, idx) => {
        doc.text(line, margin + labelWidth, y + 6 + idx * lineHeight);
      });
      rightLines.forEach((line, idx) => {
        doc.text(line, margin + columnWidth + labelWidth, y + 6 + idx * lineHeight);
      });

      y += rowHeight;
    };

    const drawDualRowWithMixedLeft = (
      leftLabel: string,
      amountText: string,
      suffixText: string,
      rightLabel: string,
      rightValue: string | number | null,
    ) => {
      const columnWidth = contentWidth / 2;
      const labelWidth = 42;
      const availableWidth = columnWidth - labelWidth;
      const lineHeight = 5.5;
      const combinedValue = `${amountText} ${suffixText}`;
      doc.setFont("helvetica", "normal");
      let valueFontSize = 10;
      while (doc.getTextWidth(combinedValue) > availableWidth && valueFontSize > 7) {
        valueFontSize -= 0.5;
        doc.setFontSize(valueFontSize);
      }

      const rightLines = doc.splitTextToSize(valueOrLine(rightValue), availableWidth);
      const rowHeight = lineHeight + 3;

      ensureSpace(rowHeight);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(55, 65, 81);
      doc.text(`${leftLabel}:`, margin + 3, y + 6);
      doc.text(`${rightLabel}:`, margin + columnWidth, y + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(valueFontSize);
      doc.setTextColor(0, 0, 0);
      const amountX = margin + labelWidth;
      doc.text(combinedValue, amountX, y + 6);

      doc.setFontSize(10);
      rightLines.forEach((line, idx) => {
        doc.text(line, margin + columnWidth + labelWidth, y + 6 + idx * lineHeight);
      });

      y += rowHeight;
    };

    const addSection = (title: string, body: string) => {
      ensureSpace(12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(title.toUpperCase(), margin, y);
      y += 6;
      doc.setTextColor(0, 0, 0);
      y = addWrappedText(doc, body, margin, y, contentWidth, 6, 10, "normal") + 2;
      y += 2;
    };

    const addNumberedParagraph = (index: number, text: string) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const label = `${index}.`;
      const labelWidth = doc.getTextWidth(`${label} `);
      const indent = labelWidth + 2; // small padding so wrapped lines align under text start
      const maxWidth = contentWidth - indent;
      const lineHeight = 6;
      const paragraphSpacing = 2;
      const lines = doc.splitTextToSize(text, maxWidth);
      const blockHeight = lines.length * lineHeight + paragraphSpacing;

      ensureSpace(blockHeight);
      doc.text(label, margin, y);
      lines.forEach((line, idx) => {
        const isLastLine = idx === lines.length - 1;
        const lineWidth = doc.getTextWidth(line);
        const extraSpace = maxWidth - lineWidth;
        const canJustify = !isLastLine && extraSpace > 0 && line.includes(" ");
        if (canJustify) {
          // Distribute remaining width across characters; keeps block height unchanged
          const charSpace = extraSpace / Math.max(line.length - 1, 1);
          doc.text(line, margin + indent, y + idx * lineHeight, { charSpace });
        } else {
          doc.text(line, margin + indent, y + idx * lineHeight);
        }
      });
      y += lines.length * lineHeight + paragraphSpacing;
    };

    const addClauseHeading = (title: string) => {
      const headingHeight = 6;
      ensureSpace(headingHeight * 2);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text(title.toUpperCase(), margin, y);
      y += headingHeight;
      doc.setFont("helvetica", "normal");
    };

    const addInformationPage = () => {
      const idOrPassport = data.employeeIdNumber || data.passportNumber || "";
    const endInfoLabel = data.endType === "completion" ? "Ends on completion of" : "End date";
    const endInfoValue =
      data.endType === "completion"
        ? data.projectScope || "completion of the project/scope"
        : formatDate(data.endDate);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text("EMPLOYMENT INFORMATION", pageWidth / 2, y, { align: "center" });
      y += 12;

      drawSection("A. Employer details", undefined, () => {
        drawSingleRow("Company name", profile?.company_name);
        drawSingleRow("Reg. number", profile?.registration_number);
        drawSingleRow("Address", profile?.physical_address);
        drawSingleRow("Email", profile?.company_email);
        drawSingleRow("Contact", profile?.company_contact);
      });

      drawSection("B. Employee details", undefined, () => {
        drawDualRow("Surname", data.employeeSurname, "Name(s)", data.employeeName);
        drawSingleRow("ID / Passport", idOrPassport || "--");
        drawSingleRow("Contact number", data.employeeCell);
        drawSingleRow("Address", data.employeeAddress);
      });

      drawSection("C. Employment details", undefined, () => {
        drawDualRow("Type", "Temporary", "Start date", formatDate(data.startDate));
        drawDualRow(
          endInfoLabel,
          endInfoValue,
          "Gross salary",
          `${formatCurrency(data.salaryAmount)} ${salaryFrequencyLabels[data.salaryFrequency]}`,
        );
        drawDualRow("Job title", data.jobTitle, "Interpreter", data.interpreter === "yes" ? "Yes" : "No");
        drawSingleRow("Workplace", data.workplace || profile?.physical_address || "");
        drawSingleRow("Project/Scope", data.projectScope);
      });

      doc.addPage();
      y = margin;
    };

    const addEnteredIntoHeader = () => {
      const companyName = valueOrLine(profile?.company_name).toUpperCase();
      const regNumber = valueOrLine(profile?.registration_number);
      const employeeFullName = valueOrLine(
        [data.employeeName, data.employeeSurname].filter(Boolean).join(" "),
      ).toUpperCase();
      const idLabel = data.employeeIdNumber ? "ID no." : "Passport no.";
      const idDisplay = data.employeeIdNumber || data.passportNumber || "";

      ensureSpace(58);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("TEMPORARY EMPLOYMENT CONTRACT", pageWidth / 2, y, { align: "center" });
      y += 10;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Entered into by and between:", margin, y);
      y += 8;

      doc.setFont("helvetica", "bold");
      doc.text(companyName, margin, y);
      doc.setFont("helvetica", "italic");
      doc.text('Hereinafter referred to as "the Employer"', margin + contentWidth, y, { align: "right" });
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Reg. number: ${regNumber}`, margin, y);
      y += 9;

      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.text("and", margin, y);
      y += 9;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(employeeFullName, margin, y);
      doc.setFont("helvetica", "italic");
      doc.text('Hereinafter referred to as "the Employee"', margin + contentWidth, y, { align: "right" });
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`${idLabel}: ${valueOrLine(idDisplay)}`, margin, y);
      y += 12;

      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y, margin + contentWidth, y);
      y += 10;
    };

    addInformationPage();
    addEnteredIntoHeader();

    const annualLeaveText =
      "The Employee is entitled to one (1) day of leave for every seventeen (17) days worked. Leave shall be taken at times determined by the Employer, subject to operational requirements.";

    const clauses: ClauseDefinition[] = mergeClauses(
      withClauseIds([
      {
        title: "Introduction",
        body: "This employment agreement is entered into between the Employer and the Employee willingly and voluntarily.  The Employee hereby agrees that he/she has been granted the opportunity to peruse and discuss the contract with his/her council and that he/she understands the content that follows.",
      },
      {
        title: "Recordal",
        body:
          "The Employer appoints the Employee in a temporary capacity, which the Employee accepts on the terms of this agreement. This agreement records the essential conditions of employment, including duties, remuneration, working hours, leave, and termination, and constitutes the entire understanding between the parties, replacing any prior verbal or written arrangements unless expressly stated otherwise. The employment relationship is governed by this agreement and all applicable labour laws of South Africa.",
      },
      {
        title: "Duration of Employment",
        body: buildDurationClauseBody(data),
      },
      {
        title: "Remuneration",
        body: [
          "The Employee shall receive the Gross Salary, which shall comply with all applicable legislation. Unauthorised or unapproved absence from work shall result in no payment for the period of absence.",
          "The Employee will be remunerated at two times the normal wage for work performed on a public holiday.",
        ],
      },
      {
        title: "Hours of work",
        body:
          "The Employee's ordinary working hours shall not exceed forty-five (45) hours per week. The Employee is entitled to a daily unpaid lunch break of one (1) hour, taken at a time agreed between the parties.",
      },
      {
        title: "Deductions",
        body:
          "The Employee consents to all lawful and statutory deductions from remuneration, including PAYE, UIF, and any voluntary benefits or contributions agreed to by the parties. The Employee further agrees that the Employer may deduct any amount lawfully owed to it, including losses, damages, cash or stock shortages resulting from the Employee's negligence, misconduct, or dishonesty, provided such deductions comply with applicable labour laws and are properly recorded and communicated.",
      },
      {
        title: "Termination of employment",
        body: buildTerminationClauseBody(data),
      },
      {
        title: "Guarantee",
        body:
          "The Employee warrants that all information, documentation, and credentials submitted to the Employer are true and accurate. If any submission is found to be false, fraudulent, or misleading, the Employer may institute disciplinary action for dishonesty, which may result in summary termination of employment.",
      },
      {
        title: "Exclusivity of employment",
        body:
          "The Employee shall devote their full working time and attention to the Employer's business and shall not, without the Employer's prior written consent, engage in any other employment, consultancy, or business activity that conflicts with the Employer's interests.",
      },
      {
        title: "Annual leave",
        body: [
          annualLeaveText,
          "The Employee agrees to take annual leave during any annual shutdown period implemented by the Employer. If the Employee has insufficient leave to cover for an annual shut down period, the Employee agrees that this period will be regarded as unpaid leave.",
        ],
      },
      {
        title: "Absence from work",
        body: [
          "The Employee must notify the Employer before the start of the shift if unable to attend work. Where an absence is known in advance, the Employee must arrange leave at least 24 hours beforehand. Unjustified absence may result in disciplinary action, and sick leave will be applied in line with the BCEA.",
          "Attendance at a disciplinary hearing is compulsory. If the Employee is unable to attend due to illness, an affidavit from a medical practitioner confirming incapacity to attend must be provided, and the practitioner must be available to verify it.",
          "If the Employee fails to comply with these requirements, the hearing may proceed in his or her absence, and the Employee agrees not to dispute the fairness of any outcome, including dismissal.",
          "Failure to report for work for more than five consecutive workdays without valid reason or notifying the Employer shall be regarded as abscondment.",
          "In the instance of abscondment, the Employer will send a notice by WhatsApp, SMS, normal post or registered post instructing the Employee to return to work or contact the office and notifying the Employee of the disciplinary enquiry date. Failure to return, make contact, or attend the enquiry will result in dismissal.",
        ],
      },
      {
        title: "Proof of sickness",
        body: [
          "An Employee who is absent from work due to illness must provide a valid medical certificate issued by a registered medical practitioner. Clinic attendance letters are not regarded as proof of sickness.",
          "The medical certificate must be issued and signed by a qualified medical practitioner, or any other person certified to diagnose and treat patients and registered with the HPCSA. Only original documents are accepted.",
        ],
      },
      {
        title: "Protection of personal information",
        body:
          "The Employee consents to the Employer collecting, processing, storing, and sharing the Employee's personal information in accordance with applicable data protection laws (including POPIA) for lawful business purposes, and agrees to comply with the Employer's privacy and information security policies.",
      },
      {
        title: "Health and fitness",
        body:
          "The Employee warrants that they are medically fit to perform the inherent requirements of the role. The Employee agrees to undergo reasonable medical or fitness assessments where legally permissible and required for operational or safety reasons.",
      },
      {
        title: "Personal Protective Equipment (PPE)",
        body: [
          "The Employer shall provide, when applicable, the necessary PPE free of charge.",
          "The Employee shall use such PPE responsibly and report any damage or loss immediately. Failure to do so, or negligent loss or misuse, shall render the Employee liable for the cost of replacement, recoverable through lawful deductions.",
        ],
      },
      {
        title: "Change of status",
        body:
          "The Employee must promptly notify the Employer of any change to personal particulars or legal status that affects employment, including work permits, professional registrations, licences, or criminal matters, and must provide updated documentation when requested.",
      },
      {
        title: "Domicilium citandi",
        body: [
          "The parties choose the physical addresses recorded on Page 1 of this agreement as their domicilium citandi et executandi for all purposes relating to this agreement. Any notice delivered by hand or by any means as agreed to in this agreement shall be deemed duly received.",
          "The Employee agrees that the Employer may send notices or correspondence by WhatsApp, SMS, email, regular post or registered post, and that proof of transmission or delivery shall constitute sufficient proof that the notice was sent.",
        ],
      },
      {
        title: "Alcohol and drug testing",
        body: [
          "The Employee agrees to undergo alcohol or drug testing when reasonably required by the Employer. All testing will be conducted by a competent person in a lawful and reasonable manner, and the Employer maintains a zero tolerance approach to alcohol and drug use in the workplace.",
          "The Employee further agrees to submit to a blood test where the Employer has reasonable suspicion that the Employee is under the influence of alcohol or drugs. Such testing shall be carried out by a qualified medical professional, and refusal to comply will be regarded as insubordination.",
          "Unreasonable refusal to undergo a required test may result in a negative inference being drawn, which may be treated as a presumptive positive result and may lead to disciplinary action, including dismissal.",
        ],
      },
      {
        title: "Polygraph testing",
        body: [
          "The Employee agrees to undergo polygraph testing when reasonably required by the Employer for investigative or security purposes, including matters involving theft, fraud, dishonesty, misconduct or breach of company policies. All tests will be conducted by a qualified and accredited examiner in a fair and lawful manner.",
          "Refusal to undergo a required polygraph test may result in an adverse inference being drawn.  Such refusal will also be regarded as insubordination and continued refusal could lead to dismissal.",
        ],
      },
      {
        title: "Temporary lay-off",
        body:
          "In circumstances of operational requirements, force majeure, or other lawful reasons, the Employer may implement a temporary lay-off or short-time arrangement after following any required consultation process; during such period the parties shall agree on the applicable remuneration and working arrangements in line with law.",
      },
      {
        title: "Proof of citizenship",
        body:
          "The Employee must provide valid proof of identity and legal entitlement to work in South Africa (such as ID, passport, visa, or residence permit) and keep such authorisations current; continued employment is conditional on maintaining this status.",
      },
      {
        title: "Confidentiality",
        body:
          "The Employee shall keep all confidential information, trade secrets, client data and business affairs of the Employer strictly confidential and shall not disclose or use such information for any purpose other than the performance of his or her duties.",
      },
      {
        title: "Entire Agreement and Acknoweldgement",
        body:
          "This agreement constitutes the entire understanding between the parties regarding the Employee's temporary employment. No amendment or waiver is valid unless reduced to writing and signed by both parties. The Employee acknowledges having read, understood, and accepted the terms of this agreement.",
      },
      ])
    );

    const clausesWithEdits = applyClauseEdits(clauses);

    let clauseNumber = 1;
    let isFirstClause = true;
    clausesWithEdits.forEach((clause) => {
      if (!isFirstClause) {
        y += 6; // consistent gap before each new clause
      }
      isFirstClause = false;
      const paragraphs = Array.isArray(clause.body) ? clause.body : [clause.body];
      addClauseHeading(clause.title);
      paragraphs.forEach((text) => {
        addNumberedParagraph(clauseNumber, text);
        clauseNumber += 1;
      });
    });

    if (data.additionalNotes) {
      addSection("Additional notes", data.additionalNotes);
    }

    // Leave breathing room after the final clause before the signing line
    ensureSpace(12);
    y += 8;

    const signatureLabels = ["For the Employer", "Employer Witness", "Employee", "Employee Witness"];

    // Place signing line and keep signatures on the same page where space allows
    const signingLine = `Done and Signed at ___________________________ on this _____ day of ____________________ ${issueYear}.`;
    ensureSpace(12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(signingLine, margin, y);
    y += 16;

    const signatureBlockHeight = 12 + signatureLabels.length * 20;
    ensureSpace(signatureBlockHeight);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("SIGNATURES", margin, y);
    y += 12; // increased gap before first signature line
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    signatureLabels.forEach((label) => {
      ensureSpace(20);
      doc.text("_______________________________", margin, y);
      doc.text("Date: __________________", margin + 110, y);
      y += 4;
      doc.text(label, margin, y);
      y += 16;
    });

    const pageCount = doc.getNumberOfPages();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (let i = 1; i <= pageCount; i += 1) {
      doc.setPage(i);
      // Top-right page number; does not shift layout content
      doc.setFontSize(7);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, margin - 6, { align: "right" });
      doc.setFontSize(9);

      const footerY = pageHeight - 10;
      doc.setDrawColor(226, 232, 240); // subtle divider above footer text
      doc.line(margin, footerY - 8, margin + contentWidth, footerY - 8);
      doc.text("Initial here: ______________________", pageWidth - margin, footerY, { align: "right" });
    }

    return doc;
  };

  const handlePreview = () => {
    try {
      const validated = validateData();
      setValidatedPreview(validated);
      setShowPreview(true);
      setShowFinalActions(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please check the required fields.";
      toast({
        title: "Validation error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleDownload = async () => {
    try {
      setIsGenerating(true);
      if (!tempEmployees.length) {
        throw new Error("Add at least one employee before downloading.");
      }
      const baseData = {
        ...formData,
        salaryAmount: formData.salaryAmount,
        endDate: formData.endDate,
      };
      const zip = new JSZip();
      for (const employee of tempEmployees) {
        const parsed = temporaryContractSchema.parse({
          ...baseData,
          ...employee,
        }) as ValidatedTempData;
        const doc = buildPdfDocument(parsed);
        const arrayBuffer = doc.output("arraybuffer");
        const safeName = `${parsed.employeeSurname || "employee"}_${parsed.startDate}`.replace(/[\\/:*?"<>|]+/g, "_");
        zip.file(`Temporary_Contract_${safeName}.pdf`, arrayBuffer);
      }
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Temporary_Contracts.zip";
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Download ready",
        description: `${tempEmployees.length} contract${tempEmployees.length === 1 ? "" : "s"} downloaded as zip.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please check the required fields.";
      toast({
        title: "Validation error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFinish = () => {
    try {
      const validated = validateData();
      setValidatedPreview(validated);
      setShowFinalActions(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please check the required fields.";
      toast({
        title: "Validation error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const employeeFullName = [validatedPreview?.employeeName, validatedPreview?.employeeSurname].filter(Boolean).join(" ");
  const previewSubtitle = employeeFullName
    ? `Review and download the temporary contract for ${employeeFullName}.`
    : "Review and download the temporary contract.";

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center", embedded ? "min-h-[60vh]" : "min-h-screen")}>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const content = (
    <>
      {showEmployeeHint && typeof document !== "undefined"
        ? createPortal(
              <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center px-4">
                <div className="relative flex translate-x-[60px] items-center gap-3 rounded-sm border border-blue-200 bg-[#2D4256] px-4 py-3 text-[13px] font-medium text-white shadow-[0_6px_18px_rgba(37,99,235,0.28)]">
                <span
                  className="pointer-events-none absolute inset-0 rounded-sm shadow-[0_0_25px_rgba(37,99,235,0.32)] animate-pulse"
                  aria-hidden="true"
                ></span>
                <div className="pointer-events-auto flex items-center gap-2">
                  <span className="text-blue-400">
                    TIP!{" "}
                    <span className="text-white inline-flex items-center gap-1 ml-2">
                      Add the employee to your Employee List before generating a contract
                      <ArrowRight className="h-4 w-4 text-white" aria-hidden="true" />
                    </span>
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    onClick={() => {
                      setHasDismissedEmployeeHint(true);
                      setShowEmployeeHint(false);
                      navigate("/employees");
                    }}
                  >
                    Employees page
                  </button>
                  <button
                    type="button"
                    className="text-white hover:text-white focus-visible:text-white"
                    onClick={() => {
                      setHasDismissedEmployeeHint(true);
                      setShowEmployeeHint(false);
                    }}
                    aria-label="Dismiss employee guidance message"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      <div
        className={cn(
          "space-y-6",
          embedded ? "px-0 pt-4 pr-4 pb-4" : "-ml-6 -mr-6 pl-3 pr-3",
        )}
        style={{ scrollbarGutter: "stable" }}
      >
        {!showFinalActions ? (
          <Card className="rounded-sm mt-4 shadow-xl border border-blue-100/70 bg-white/95 shadow-blue-100/60">
            {!embedded && (
              <CardHeader className="pb-2">
                <div className="flex items-center justify-center gap-8 w-full">
                  {steps.map((step, index) => {
                    const isFinalizedCurrent = showFinalActions && index === steps.length - 1;
                    const isDone = index < activeStep || isFinalizedCurrent;
                    const isActive = index === activeStep && !isFinalizedCurrent;
                    const Icon = stepIcons[index];
                    const circleClasses = isDone
                      ? "border-[#b6e6c1] text-[#038314] bg-[#e9f9ee]"
                      : isActive
                        ? "border-blue-300 text-blue-700 bg-blue-100"
                        : "border-slate-200 text-slate-500 bg-white";
                    const canClick = showFinalActions || index < activeStep;
                    const handleClick = () => {
                      if (showFinalActions) {
                        setShowFinalActions(false);
                        setActiveStep(index);
                      } else if (canNavigateToStep(index)) {
                        handleStepClick(index);
                      }
                    };

                    return (
                      <div key={step} className="flex items-center gap-4">
                        <TooltipProvider delayDuration={0} skipDelayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                disabled={!canClick}
                                aria-label={step}
                                onClick={canClick ? handleClick : undefined}
                                onKeyDown={
                                  canClick
                                    ? (e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          handleClick();
                                        }
                                      }
                                    : undefined
                                }
                                className={`flex flex-col items-start gap-1 transition ${
                                  canClick
                                    ? "cursor-pointer hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-md"
                                    : "cursor-default"
                                }`}
                              >
                                <div
                                  className={`flex h-11 w-11 items-center justify-center rounded-full border ${circleClasses}`}
                                >
                                  <Icon className="h-5 w-5" />
                                </div>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="center" className="text-xs">
                              {step}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {index < steps.length - 1 && (
                          <div
                            className={`h-px w-16 ${
                              index < activeStep || isFinalizedCurrent ? "bg-[#04b81f]" : "bg-slate-200"
                            }`}
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardHeader>
            )}
            <CardContent
              className={cn(
                "pt-3 [&_input]:h-9 [&_input]:py-2 [&_button[role=combobox]]:h-9 [&_textarea]:py-2 [&_textarea]:text-sm",
                embedded && "px-0",
                !embedded && "flex-1 min-h-0 overflow-y-auto",
              )}
            >
            <div className="space-y-4">
              {activeStep === 0 && (
                <div className="space-y-3 rounded-sm border border-blue-400 bg-slate-50/70 p-3 shadow-sm">
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="companyName">Company name</Label>
                      <Input
                        id="companyName"
                        value={profile?.company_name || ""}
                        readOnly
                        className="bg-slate-50 text-blue-700 focus-visible:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="registrationNumber">Registration number</Label>
                      <Input
                        id="registrationNumber"
                        value={profile?.registration_number || ""}
                        readOnly
                        className="bg-slate-50 text-blue-700 focus-visible:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="physicalAddress">Registered address</Label>
                      <Input
                        id="physicalAddress"
                        value={profile?.physical_address || ""}
                        readOnly
                        className="bg-slate-50 text-blue-700 focus-visible:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tradingName">Trading name</Label>
                      <Input
                        id="tradingName"
                        value={formData.tradingName}
                        onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
                        placeholder="If different from registered name"
                        className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="employerContact">Employer contact *</Label>
                      <Input
                        id="employerContact"
                        value={formData.employerContact}
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
                          setFormData({ ...formData, employerContact: digitsOnly });
                        }}
                        placeholder="10-digit contact number"
                        className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="employerEmail">Employer email *</Label>
                      <Input
                        id="employerEmail"
                        type="email"
                        value={formData.employerEmail}
                        onChange={(e) => setFormData({ ...formData, employerEmail: e.target.value })}
                        className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeStep === 1 && (
                <div className="space-y-3 rounded-sm border border-blue-400 bg-slate-50/70 p-3 shadow-sm">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAddEmployee(true)}
                          className="gap-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white"
                        >
                          <Plus className="h-4 w-4" />
                          Add employee
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleBulkUploadClick}
                          className="gap-2 hover:border-blue-600 hover:text-blue-600 hover:bg-white"
                        >
                          <Upload className="h-4 w-4" />
                          Add bulk
                        </Button>
                        <button
                          type="button"
                          onClick={handleDownloadTemplate}
                          className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          Download template
                        </button>
                        <input
                          ref={bulkUploadInputRef}
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          className="hidden"
                          onChange={handleBulkUploadFile}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={!selectedEmployeeIds.length}
                        onClick={handleDeleteSelected}
                        className="gap-2 disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-2 border-blue-600 bg-blue-50 text-blue-600 focus:ring-blue-600 checked:border-blue-600 checked:bg-blue-600 checked:text-white accent-blue-600"
                                  style={{ accentColor: "#2563eb" }}
                                  checked={selectedEmployeeIds.length === tempEmployees.length && tempEmployees.length > 0}
                                  onChange={(e) => toggleSelectAllEmployees(e.target.checked)}
                                  aria-label="Select all employees"
                                />
                              </div>
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Name</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Surname</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">ID / Passport</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Cell Number</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {tempEmployees.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-3 py-6 text-center text-xs text-slate-500">
                                Add an employee or upload a file to get started.
                              </td>
                            </tr>
                          ) : (
                            tempEmployees.map((emp) => {
                              const isChecked = selectedEmployeeIds.includes(emp.id);
                              const idValue = emp.employeeIdNumber || emp.passportNumber;
                              return (
                                <tr key={emp.id} className="hover:bg-slate-50">
                                  <td className="px-3 py-0.5">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 rounded border-2 border-blue-600 bg-white text-blue-600 focus:ring-blue-600 checked:border-blue-600 checked:bg-blue-50 accent-blue-600"
                                      style={{ accentColor: "#2563eb" }}
                                      checked={isChecked}
                                      onChange={(e) => toggleSelectEmployee(emp.id, e.target.checked)}
                                    />
                                  </td>
                                  <td className="px-3 py-0.5 text-xs text-slate-900">{emp.employeeName}</td>
                                  <td className="px-3 py-0.5 text-xs text-slate-900">{emp.employeeSurname}</td>
                                  <td className="px-3 py-0.5 text-xs text-slate-900">{idValue}</td>
                                  <td className="px-3 py-0.5 text-xs text-slate-900">{emp.employeeCell}</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeStep === 2 && (
                <div className="space-y-3 rounded-sm border border-blue-400 bg-white p-3 shadow-sm">
                  <div className="space-y-3">
                    <div className="rounded-lg border border-blue-100 bg-slate-50/80 p-3">
                      <p className="text-sm font-semibold text-gray-900 mb-2">How will the contract end?</p>
                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="flex items-start gap-2 rounded-lg border border-transparent bg-white p-3 shadow-sm transition hover:border-blue-200 hover:shadow">
                          <input
                            type="radio"
                            name="endType"
                            value="date"
                            checked={formData.endType === "date"}
                            onChange={() =>
                              setFormData((prev) => ({
                                ...prev,
                                endType: "date",
                              }))
                            }
                            className="mt-1 h-4 w-4 text-blue-600 accent-blue-600"
                          />
                          <div>
                            <div className="font-semibold text-gray-900">On a specific date</div>
                            <p className="text-sm text-slate-600">Set a fixed end date for the contract.</p>
                          </div>
                        </label>
                        <label className="flex items-start gap-2 rounded-lg border border-transparent bg-white p-3 shadow-sm transition hover:border-blue-200 hover:shadow">
                          <input
                            type="radio"
                            name="endType"
                            value="completion"
                            checked={formData.endType === "completion"}
                            onChange={() =>
                              setFormData((prev) => ({
                                ...prev,
                                endType: "completion",
                                endDate: "",
                              }))
                            }
                            className="mt-1 h-4 w-4 text-blue-600 accent-blue-600"
                          />
                          <div>
                            <div className="font-semibold text-gray-900">On completion of the project/scope</div>
                            <p className="text-sm text-slate-600">Ends automatically when the project/scope is completed.</p>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="startDate">Start Date *</Label>
                      <Input
                        id="startDate"
                        type="date"
                          value={formData.startDate}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                          className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                      />
                    </div>
                    {formData.endType === "date" ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="endDate">End Date *</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={formData.endDate}
                          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                          className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                        />
                      </div>
                    ) : null}
                    <div className="space-y-1.5">
                      <Label htmlFor="salaryAmount">Salary Amount *</Label>
                      <Input
                        id="salaryAmount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.salaryAmount}
                        onChange={(e) => setFormData({ ...formData, salaryAmount: e.target.value })}
                        placeholder="e.g. 25000"
                        className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="salaryFrequency">Salary Frequency *</Label>
                      <Select
                        value={formData.salaryFrequency}
                        onValueChange={(value) =>
                          setFormData({
                            ...formData,
                            salaryFrequency: value as SalaryFrequency,
                          })
                        }
                      >
                        <SelectTrigger className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          {salaryFrequencyOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {salaryFrequencyLabels[option as SalaryFrequency]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="jobTitle">Job Title *</Label>
                      <Input
                        id="jobTitle"
                        value={formData.jobTitle}
                        onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                        className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="interpreter">Interpreter required *</Label>
                      <Select
                        value={formData.interpreter}
                        onValueChange={(value) =>
                          setFormData({ ...formData, interpreter: value as InterpreterOption })
                        }
                      >
                        <SelectTrigger className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900">
                          <SelectValue placeholder="Select option" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="projectScope">Project/Scope *</Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-slate-500" aria-label="Project scope info" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs text-sm">
                              Any temporary contract must be linked to a specific project or scope of work as prescribed by s198B of the Labour Relations Act 66 of 1995. Probation is not an acceptable reason for a fixed term contract.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Input
                        id="projectScope"
                        value={formData.projectScope}
                        onChange={(e) => setFormData({ ...formData, projectScope: e.target.value })}
                        placeholder="Specify the project or scope of work"
                        className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="workplace">Workplace *</Label>
                      <Input
                        id="workplace"
                        value={formData.workplace}
                        onChange={(e) => setFormData({ ...formData, workplace: e.target.value })}
                        placeholder="Primary work location"
                        className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                      />
                    </div>
                  </div>
                </div>
              </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                {activeStep === steps.length - 1 ? (
                  <div className="flex w-full items-center gap-3 flex-wrap justify-between">
                    {!embedded && (
                      <div className="flex-none">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleBack}
                          className="gap-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white focus-visible:ring-blue-600"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          Back
                        </Button>
                      </div>
                    )}
                    <div className="flex-1 flex justify-center">
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={resetForm}
                              disabled={isGenerating}
                              aria-label="Reset form"
                              className="gap-2 text-slate-700 hover:text-blue-600 hover:bg-white transition-transform duration-200 hover:scale-105 disabled:text-slate-300"
                            >
                              <Undo2 className="h-4 w-4" />
                              Reset form
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Clear all fields and start over</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    {!embedded && (
                      <div className="flex-none relative">
                        <Button
                          type="button"
                          onClick={handleFinish}
                          disabled={!isFormComplete || isGenerating}
                          className={`gap-2 min-w-[140px] text-white disabled:opacity-50 transition-colors duration-150 ${
                            isFormComplete && !isGenerating
                              ? "bg-[#04b81f] hover:bg-[#049218] border border-[#038314]"
                              : "bg-primary hover:bg-primary/90 border border-primary/60"
                          }`}
                        >
                          Finish
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  !embedded && (
                    <div className="flex w-full items-center justify-between gap-2 flex-wrap">
                      <div className="flex-none">
                        {activeStep > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleBack}
                            className="gap-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white focus-visible:ring-blue-600"
                          >
                            <ArrowLeft className="h-4 w-4" />
                            Back
                          </Button>
                        )}
                      </div>
                      <div className="flex-1" />
                      <div className="flex-none">
                        {activeStep < steps.length - 1 && (
                          <Button
                            type="button"
                            onClick={handleNext}
                            disabled={!canGoNext}
                            className="gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50"
                          >
                            Next
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
            </CardContent>
          </Card>
        ) : (
            <Card className="rounded-sm mt-4 shadow-xl border border-blue-100/70 bg-white/95 shadow-blue-100/60">
              <CardHeader className="pt-4 pb-0" />
              <CardContent className="space-y-6 pt-2">
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="bg-white overflow-hidden rounded mx-auto box-border border border-blue-200"
                    style={{
                      width: `${snippetContainerWidthMm}mm`,
                      height: `${snippetPaddingTopMm + snippetVisibleHeightMm * snippetScale}mm`,
                    }}
                    >
                      {validatedPreview ? (
                        <div className="relative h-full w-full overflow-hidden">
                          <div
                            className="absolute left-1/2 top-0 transform-gpu blur-[2px]"
                            style={{
                              width: "210mm",
                              height: `${snippetVisibleHeightMm}mm`,
                              overflow: "hidden",
                              marginTop: `${snippetPaddingTopMm}mm`,
                              transform: `translateX(-50%) scale(${snippetScale})`,
                              transformOrigin: "top center",
                            }}
                          >
                            <div style={{ height: "297mm", overflow: "hidden" }}>
                              <FirstPagePreview data={validatedPreview} compact />
                            </div>
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex items-center justify-center gap-3">
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={handlePreview}
                                disabled={isGenerating}
                                aria-label="Preview"
                                className="h-11 px-6 min-w-[72px] rounded-2xl bg-blue-600 text-white hover:bg-blue-700 shadow-md transition-transform duration-200 hover:scale-105 disabled:bg-blue-300 disabled:text-white [&_svg]:h-5 [&_svg]:w-5"
                              >
                                <div className="flex items-center gap-2">
                                  <FileText />
                                  <span className="text-sm font-semibold">Preview</span>
                                </div>
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={handleDownload}
                                disabled={isGenerating}
                                aria-label="Download PDF"
                                className="h-11 px-6 min-w-[72px] rounded-2xl bg-blue-600 text-white hover:bg-blue-700 shadow-md transition-transform duration-200 hover:scale-105 disabled:bg-blue-300 disabled:text-white [&_svg]:h-5 [&_svg]:w-5"
                              >
                                <div className="flex items-center gap-2">
                                  <Download />
                                  <span className="text-sm font-semibold">Download</span>
                                </div>
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 text-sm text-slate-600">Complete the form and click Finish to see the first-page preview.</div>
                      )}
                    </div>

                <div className="flex w-full items-center gap-2">
                  <div className="flex-none">
                    <Button
                      variant="outline"
                      onClick={() => setShowFinalActions(false)}
                      className="gap-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white focus-visible:ring-blue-600"
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                      Back to form
                    </Button>
                  </div>
                  <div className="flex-1" />
                  <div className="flex-none opacity-0 pointer-events-none">
                    <Button variant="outline" className="gap-2 border-transparent">
                      Placeholder
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showAddEmployee} onOpenChange={setShowAddEmployee}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-blue-600">Add employee</DialogTitle>
            <DialogDescription>Capture the minimum details for a temporary contract.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="newEmployeeName">Name *</Label>
                <Input
                  id="newEmployeeName"
                  value={newEmployeeForm.employeeName}
                  onChange={(e) => setNewEmployeeForm((prev) => ({ ...prev, employeeName: e.target.value }))}
                  placeholder="Insert name(s) here..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="newEmployeeSurname">Surname *</Label>
                <Input
                  id="newEmployeeSurname"
                  value={newEmployeeForm.employeeSurname}
                  onChange={(e) => setNewEmployeeForm((prev) => ({ ...prev, employeeSurname: e.target.value }))}
                  placeholder="Insert surname here..."
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="newIdOrPassport">ID / Passport *</Label>
                <div className="grid gap-2 md:grid-cols-[150px_1fr]">
                  <Select value={newEmployeeIdType} onValueChange={(value) => setNewEmployeeIdType(value as "id" | "passport")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="id">ID Number</SelectItem>
                      <SelectItem value="passport">Passport Number</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    id="newIdOrPassport"
                    value={newEmployeeIdType === "id" ? newEmployeeForm.employeeIdNumber : newEmployeeForm.passportNumber}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (newEmployeeIdType === "id") {
                        const digitsOnly = value.replace(/\D/g, "").slice(0, 13);
                        setNewEmployeeForm((prev) => ({ ...prev, employeeIdNumber: digitsOnly, passportNumber: "" }));
                      } else {
                        setNewEmployeeForm((prev) => ({ ...prev, passportNumber: value, employeeIdNumber: "" }));
                      }
                    }}
                    placeholder={
                      newEmployeeIdType === "id" ? "Insert SA ID number here..." : "Insert passport number here..."
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="newEmployeeCell">Cell Number *</Label>
                <Input
                  id="newEmployeeCell"
                  value={newEmployeeForm.employeeCell}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setNewEmployeeForm((prev) => ({ ...prev, employeeCell: digitsOnly }));
                  }}
                  placeholder="Insert a contact number..."
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="newEmployeeAddress">Residential Address *</Label>
                <Textarea
                  id="newEmployeeAddress"
                  value={newEmployeeForm.employeeAddress}
                  onChange={(e) => setNewEmployeeForm((prev) => ({ ...prev, employeeAddress: e.target.value }))}
                  rows={3}
                  placeholder="Street address, city, province, area code..."
                />
              </div>
            </div>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={resetNewEmployeeForm} className="min-w-[96px]">
                Reset
              </Button>
              <Button onClick={handleAddEmployeeSave} className="gap-2 min-w-[96px]">
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pr-10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle className="text-blue-600">Preview - Temporary Contract</DialogTitle>
                <DialogDescription>{previewSubtitle}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <ScrollArea className="h-full px-6 pb-6">
            {validatedPreview ? (() => {
              const displayValue = (value?: string | number | null) =>
                value && value.toString().trim() ? value.toString() : "________________________";
              const salaryDisplay = `${formatCurrency(validatedPreview.salaryAmount)} ${salaryFrequencyLabels[validatedPreview.salaryFrequency]}`;
              const workplace = validatedPreview.workplace || profile?.physical_address || "";
              const employerName = profile?.company_name || "the Employer";
              const annualLeaveText =
                "The Employee is entitled to one (1) day of leave for every seventeen (17) days worked. Leave shall be taken at times determined by the Employer, subject to operational requirements.";

              const SectionBlock = ({
                title,
                subtitle,
                children,
              }: {
                title: string;
                subtitle?: string;
                children: ReactNode;
              }) => (
                <div className="space-y-2">
                  <div className="w-full flex items-center justify-between rounded-md bg-slate-100 border border-slate-300 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-700">
                    <span>{title}</span>
                    {subtitle ? <span className="ml-2 italic normal-case font-medium text-gray-600">{subtitle}</span> : null}
                  </div>
                  <div className="space-y-1.5 px-1 text-[11px] text-gray-900">
                    {children}
                  </div>
                </div>
              );

              const Row = ({ label, value }: { label: string; value?: string | number | null }) => (
                <div className="grid grid-cols-[120px_1fr] gap-2 text-[11px]">
                  <span className="font-semibold text-gray-700">{label}:</span>
                  <span className="text-gray-900">{displayValue(value)}</span>
                </div>
              );

              const DualRow = ({
                leftLabel,
                leftValue,
                rightLabel,
                rightValue,
              }: {
                leftLabel: string;
                leftValue?: string | number | null;
                rightLabel: string;
                rightValue?: string | number | null;
              }) => (
                <div className="grid grid-cols-2 gap-4 text-[11px]">
                  <div className="grid grid-cols-[120px_1fr] gap-2">
                    <span className="font-semibold text-gray-700 whitespace-nowrap">{leftLabel}:</span>
                    <span className="text-gray-900">{displayValue(leftValue)}</span>
                  </div>
                  <div className="grid grid-cols-[120px_1fr] gap-2">
                    <span className="font-semibold text-gray-700 whitespace-nowrap">{rightLabel}:</span>
                    <span className="text-gray-900">{displayValue(rightValue)}</span>
                  </div>
                </div>
              );

              const clauses: ClauseDefinition[] = mergeClauses(
                withClauseIds([
                {
                  title: "Introduction",
                  body:
                    "This employment agreement is entered into between the Employer and the Employee willingly and voluntarily.  The Employee hereby agrees that he/she has been granted the opportunity to peruse and discuss the contract with his/her council and that he/she understands the content that follows.",
                },
                {
                  title: "Recordal",
                  body:
                    "The Employer appoints the Employee in a temporary capacity, which the Employee accepts on the terms of this agreement. This agreement records the essential conditions of employment, including duties, remuneration, working hours, leave, and termination, and constitutes the entire understanding between the parties, replacing any prior verbal or written arrangements unless expressly stated otherwise. The employment relationship is governed by this agreement and all applicable labour laws of South Africa.",
                },
                {
                  title: "Duration of Employment",
                  body: buildDurationClauseBody(validatedPreview),
                },
                {
                  title: "Remuneration",
                  body: [
                    "The Employee shall receive the Gross Salary, which shall comply with all applicable legislation. Unauthorised or unapproved absence from work shall result in no payment for the period of absence.",
                    "The Employee will be remunerated at two times the normal wage for work performed on a public holiday.",
                  ],
                },
                {
                  title: "Hours of work",
                  body:
                    "The Employee's ordinary working hours shall not exceed forty-five (45) hours per week. The Employee is entitled to a daily unpaid lunch break of one (1) hour, taken at a time agreed between the parties.",
                },
                {
                  title: "Deductions",
                  body:
                    "The Employee consents to all lawful and statutory deductions from remuneration, including PAYE, UIF, and any voluntary benefits or contributions agreed to by the parties. The Employee further agrees that the Employer may deduct any amount lawfully owed to it, including losses, damages, cash or stock shortages resulting from the Employee's negligence, misconduct, or dishonesty, provided such deductions comply with applicable labour laws and are properly recorded and communicated.",
                },
                {
                  title: "Termination of employment",
                  body: buildTerminationClauseBody(validatedPreview),
                },
                {
                  title: "Guarantee",
                  body:
                    "The Employee warrants that all information, documentation, and credentials submitted to the Employer are true and accurate. If any submission is found to be false, fraudulent, or misleading, the Employer may institute disciplinary action for dishonesty, which may result in summary termination of employment.",
                },
                {
                  title: "Exclusivity of employment",
                  body:
                    "The Employee shall devote their full working time and attention to the Employer's business and shall not, without the Employer's prior written consent, engage in any other employment, consultancy, or business activity that conflicts with the Employer's interests.",
                },
                {
                  title: "Annual leave",
                  body: [
                    annualLeaveText,
                    "The Employee agrees to take annual leave during any annual shutdown period implemented by the Employer. If the Employee has insufficient leave to cover for an annual shut down period, the Employee agrees that this period will be regarded as unpaid leave.",
                  ],
                },
                {
                  title: "Absence from work",
                  body: [
                    "The Employee must notify the Employer before the start of the shift if unable to attend work. Where an absence is known in advance, the Employee must arrange leave at least 24 hours beforehand. Unjustified absence may result in disciplinary action, and sick leave will be applied in line with the BCEA.",
                    "Attendance at a disciplinary hearing is compulsory. If the Employee is unable to attend due to illness, an affidavit from a medical practitioner confirming incapacity to attend must be provided, and the practitioner must be available to verify it.",
                    "If the Employee fails to comply with these requirements, the hearing may proceed in his or her absence, and the Employee agrees not to dispute the fairness of any outcome, including dismissal.",
                    "Failure to report for work for more than five consecutive workdays without valid reason or notifying the Employer shall be regarded as abscondment.",
                    "In the instance of abscondment, the Employer will send a notice by WhatsApp, SMS, normal post or registered post instructing the Employee to return to work or contact the office and notifying the Employee of the disciplinary enquiry date. Failure to return, make contact, or attend the enquiry will result in dismissal.",
                  ],
                },
                {
                  title: "Proof of sickness",
                  body: [
                    "An Employee who is absent from work due to illness must provide a valid medical certificate issued by a registered medical practitioner. Clinic attendance letters are not regarded as proof of sickness.",
                    "The medical certificate must be issued and signed by a qualified medical practitioner, or any other person certified to diagnose and treat patients and registered with the HPCSA. Only original documents are accepted.",
                  ],
                },
                {
                  title: "Protection of personal information",
                  body:
                    "The Employee consents to the Employer collecting, processing, storing, and sharing the Employee's personal information in accordance with applicable data protection laws (including POPIA) for lawful business purposes, and agrees to comply with the Employer's privacy and information security policies.",
                },
                {
                  title: "Health and fitness",
                  body:
                    "The Employee warrants that they are medically fit to perform the inherent requirements of the role. The Employee agrees to undergo reasonable medical or fitness assessments where legally permissible and required for operational or safety reasons.",
                },
                {
                  title: "Personal Protective Equipment (PPE)",
                  body: [
                    "The Employer shall provide, when applicable, the necessary PPE free of charge.",
                    "The Employee shall use such PPE responsibly and report any damage or loss immediately. Failure to do so, or negligent loss or misuse, shall render the Employee liable for the cost of replacement, recoverable through lawful deductions.",
                  ],
                },
                {
                  title: "Change of status",
                  body:
                    "The Employee must promptly notify the Employer of any change to personal particulars or legal status that affects employment, including work permits, professional registrations, licences, or criminal matters, and must provide updated documentation when requested.",
                },
                {
                  title: "Domicilium citandi",
                  body: [
                    "The parties choose the physical addresses recorded on Page 1 of this agreement as their domicilium citandi et executandi for all purposes relating to this agreement. Any notice delivered by hand or by any means as agreed to in this agreement shall be deemed duly received.",
                    "The Employee agrees that the Employer may send notices or correspondence by WhatsApp, SMS, email, regular post or registered post, and that proof of transmission or delivery shall constitute sufficient proof that the notice was sent.",
                  ],
                },
                {
                  title: "Alcohol and drug testing",
                  body: [
                    "The Employee agrees to undergo alcohol or drug testing when reasonably required by the Employer. All testing will be conducted by a competent person in a lawful and reasonable manner, and the Employer maintains a zero tolerance approach to alcohol and drug use in the workplace.",
                    "The Employee further agrees to submit to a blood test where the Employer has reasonable suspicion that the Employee is under the influence of alcohol or drugs. Such testing shall be carried out by a qualified medical professional, and refusal to comply will be regarded as insubordination.",
                    "Unreasonable refusal to undergo a required test may result in a negative inference being drawn, which may be treated as a presumptive positive result and may lead to disciplinary action, including dismissal.",
                  ],
                },
                {
                  title: "Polygraph testing",
                  body: [
                    "The Employee agrees to undergo polygraph testing when reasonably required by the Employer for investigative or security purposes, including matters involving theft, fraud, dishonesty, misconduct or breach of company policies. All tests will be conducted by a qualified and accredited examiner in a fair and lawful manner.",
                    "Refusal to undergo a required polygraph test may result in an adverse inference being drawn.  Such refusal will also be regarded as insubordination and continued refusal could lead to dismissal.",
                  ],
                },
                {
                  title: "Temporary lay-off",
                  body:
                    "In circumstances of operational requirements, force majeure, or other lawful reasons, the Employer may implement a temporary lay-off or short-time arrangement after following any required consultation process; during such period the parties shall agree on the applicable remuneration and working arrangements in line with law.",
                },
                {
                  title: "Proof of citizenship",
                  body:
                    "The Employee must provide valid proof of identity and legal entitlement to work in South Africa (such as ID, passport, visa, or residence permit) and keep such authorisations current; continued employment is conditional on maintaining this status.",
                },
                {
                  title: "Confidentiality",
                  body:
                    "The Employee shall keep all confidential information, trade secrets, client data and business affairs of the Employer strictly confidential and shall not disclose or use such information for any purpose other than the performance of his or her duties.",
                },
                {
                  title: "Entire Agreement and Acknoweldgement",
                  body:
                    "This agreement constitutes the entire understanding between the parties regarding the Employee's temporary employment. No amendment or waiver is valid unless reduced to writing and signed by both parties. The Employee acknowledges having read, understood, and accepted the terms of this agreement.",
                },
              ])
            );

              const clausesWithEdits = applyClauseEdits(clauses);

              const startEditingClause = (clause: ClauseDefinition) => {
                setEditingClause(clause.id);
                setClauseDraft(clauseEdits[clause.id] ?? serializeClauseBody(clause.body));
              };

              const saveClauseEdit = (id: string) => {
                const trimmed = clauseDraft.trim();
                setClauseEdits((prev) => {
                  const next = { ...prev };
                  if (trimmed) {
                    next[id] = trimmed;
                  } else {
                    delete next[id];
                  }
                  return next;
                });
                setEditingClause(null);
                setClauseDraft("");
              };

              const resetClauseEdit = (id: string) => {
                setClauseEdits((prev) => {
                  const next = { ...prev };
                  delete next[id];
                  return next;
                });
                setEditingClause(null);
                setClauseDraft("");
              };

              const openAddClauseForm = (afterId: string | null) => {
                setAddingAfter(afterId);
                setNewClauseTitle("");
                setNewClauseBody("");
              };

              const cancelAddClause = () => {
                setAddingAfter(undefined);
                setNewClauseTitle("");
                setNewClauseBody("");
              };

              const saveNewClause = () => {
                const title = newClauseTitle.trim();
                const body = newClauseBody.trim();
                if (!title || !body) {
                  toast({
                    title: "Add clause",
                    description: "Please provide both a title and body for the new clause.",
                    variant: "destructive",
                  });
                  return;
                }
                const normalizedBody = normalizeBodyText(body);
                setCustomClauses((prev) => [
                  ...prev,
                  {
                    id: generateCustomClauseId(),
                    title,
                    body: normalizedBody,
                    insertAfterId: addingAfter,
                  },
                ]);
                cancelAddClause();
              };

              const deleteCustomClause = (id: string) => {
                setCustomClauses((prev) => prev.filter((clause) => clause.id !== id));
                setClauseEdits((prev) => {
                  const next = { ...prev };
                  delete next[id];
                  return next;
                });
                if (editingClause === id) {
                  setEditingClause(null);
                  setClauseDraft("");
                }
              };

              return (
                <div className="space-y-8">
                  <FirstPagePreview data={validatedPreview} />

                      <div
                        className="bg-white text-black p-8 mx-auto border border-slate-200 shadow-sm"
                        style={{ width: "210mm", minHeight: "297mm" }}
                      >
                        <div className="text-xs leading-relaxed space-y-5">
                          {(() => {
                            let clauseNumber = 1;
                            const renderAddClauseControl = (afterId: string | null) => {
                              const isFormOpen = addingAfter === afterId && addingAfter !== undefined;
                              return (
                                <div key={`add-${afterId ?? "start"}`} className="flex justify-center py-2 px-3">
                                  {isFormOpen ? (
                                    <div className="w-full rounded-md border border-dashed border-slate-200 bg-slate-50/60 p-4">
                                      <div className="grid gap-3">
                                        <Input
                                          value={newClauseTitle}
                                          onChange={(e) => setNewClauseTitle(e.target.value)}
                                          placeholder="Clause title"
                                          className="text-xs"
                                        />
                                        <Textarea
                                          value={newClauseBody}
                                          onChange={(e) => setNewClauseBody(e.target.value)}
                                          rows={4}
                                          className="text-xs text-slate-600"
                                          placeholder="Clause body. Separate paragraphs with a blank line."
                                          spellCheck={true}
                                          lang="en"
                                          autoCorrect="on"
                                        />
                                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                                          <span>Paragraph numbering updates automatically.</span>
                                          <div className="flex items-center gap-2">
                                            <Button
                                              size="sm"
                                              className="h-8 px-3 bg-[#04b81f] hover:bg-[#049218]"
                                              onClick={saveNewClause}
                                            >
                                              Add clause
                                            </Button>
                                            <Button size="sm" variant="ghost" className="h-8 px-3" onClick={cancelAddClause}>
                                              Cancel
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => openAddClauseForm(afterId)}
                                      className="group relative w-full max-w-[calc(100%-1.5rem)] mx-auto py-3 flex justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                    >
                                      <span className="relative z-10 inline-flex h-8 w-16 items-center justify-center bg-white text-xs font-medium text-blue-700 transition-all border border-transparent group-hover:font-semibold group-hover:border-blue-600 group-hover:rounded-full">
                                        <span className="absolute inset-0 flex items-center justify-center transition-opacity group-hover:opacity-0">
                                          <Plus className="h-3.5 w-3.5 transition-transform group-hover:scale-110" aria-hidden="true" />
                                        </span>
                                        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                                          Add
                                        </span>
                                      </span>
                                      <span className="pointer-events-none absolute inset-0 flex items-center" aria-hidden="true">
                                        <span className="flex-1 border-t border-slate-200 transition-all group-hover:border-blue-600" />
                                        <span className="w-16" />
                                        <span className="flex-1 border-t border-slate-200 transition-all group-hover:border-blue-600" />
                                      </span>
                                    </button>
                                  )}
                                </div>
                              );
                            };

                            return clausesWithEdits.flatMap((clause) => {
                              const paragraphs = Array.isArray(clause.body) ? clause.body : [clause.body];
                              const isEditing = editingClause === clause.id;
                              const isEdited = Boolean(clauseEdits[clause.id]);
                              const isCustomClause = customClauses.some((custom) => custom.id === clause.id);
                              return [
                                <div key={clause.id} className="space-y-2 rounded-md border border-slate-100/80 p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <h3 className="font-semibold text-black">{clause.title}</h3>
                                      {isEdited ? (
                                        <span className="rounded-full bg-[#04b81f]/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#04b81f]">
                                          Edited
                                        </span>
                                      ) : null}
                                      {isCustomClause ? (
                                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-700">
                                          Custom
                                        </span>
                                      ) : null}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {isEditing ? (
                                        <>
                                          <Button
                                            size="sm"
                                            className="h-8 px-3 bg-[#04b81f] hover:bg-[#049218]"
                                            onClick={() => saveClauseEdit(clause.id)}
                                          >
                                            Save
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 px-3"
                                            onClick={() => {
                                              setEditingClause(null);
                                              setClauseDraft("");
                                            }}
                                          >
                                            Cancel
                                          </Button>
                                          {isEdited ? (
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-8 px-3 text-slate-600 hover:text-slate-800"
                                              onClick={() => resetClauseEdit(clause.id)}
                                            >
                                              Reset
                                            </Button>
                                          ) : null}
                                        </>
                                      ) : (
                                        <>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 px-3"
                                            onClick={() => startEditingClause(clause)}
                                          >
                                            Edit
                                          </Button>
                                          {isCustomClause ? (
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-8 px-3 text-red-600 hover:text-red-700"
                                              onClick={() => deleteCustomClause(clause.id)}
                                            >
                                              Delete
                                            </Button>
                                          ) : null}
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {isEditing ? (
                                    <div className="space-y-2">
                                      <p className="flex items-center gap-1 text-[11px] text-orange-600">
                                        <Info className="h-3.5 w-3.5" aria-hidden="true" />
                                        Separate paragraphs with a blank line. Paragraph numbering updates automatically.
                                      </p>
                                      <Textarea
                                        value={clauseDraft}
                                        onChange={(e) => setClauseDraft(e.target.value)}
                                        rows={6}
                                        className="text-xs text-slate-600"
                                        spellCheck={true}
                                        lang="en"
                                        autoCorrect="on"
                                      />
                                    </div>
                                  ) : null}

                                  <div className="space-y-1">
                                    {paragraphs.map((text) => {
                                      const currentNumber = clauseNumber;
                                      clauseNumber += 1;
                                      return (
                                        <div key={`${clause.id}-${currentNumber}`} className="grid grid-cols-[auto,1fr] gap-2 text-justify">
                                          <span className="font-semibold">{currentNumber}.</span>
                                          <p className="text-justify whitespace-pre-line text-black">
                                            {text}
                                          </p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>,
                                renderAddClauseControl(clause.id),
                              ];
                            });
                          })()}

                      {validatedPreview.additionalNotes && (
                        <div className="space-y-1">
                          <h3 className="font-semibold text-black">Additional notes</h3>
                          <p className="whitespace-pre-wrap">{validatedPreview.additionalNotes}</p>
                        </div>
                      )}

                      <div>
                        <p className="font-semibold text-black mb-1">Signing</p>
                        <p className="flex flex-wrap items-center gap-2">
                          <span>Done and Signed at ________________________________________ on this _____ day of ______________________________</span>
                          <span className="inline-flex">
                            <Input
                              aria-label="Issue year"
                              value={issueYear}
                              onChange={(e) => {
                                const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 4);
                                setIssueYear(digitsOnly);
                              }}
                              className="h-8 w-20 px-2 py-1 text-sm"
                              inputMode="numeric"
                              placeholder={String(currentYear)}
                            />
                          </span>
                          <span>.</span>
                        </p>
                      </div>
                    </div>

                    <div className="space-y-6 text-xs mt-10">
                      {["For the Employer", "Employer Witness", "Employee", "Employee Witness"].map((label) => (
                        <div key={label}>
                          <div className="flex justify-between mb-1">
                            <span className="border-b border-black flex-1 max-w-[60%]" />
                            <span className="ml-4">
                              Date: <span className="border-b border-black inline-block w-32" />
                            </span>
                          </div>
                          <p className="mt-1">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })() : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">Complete the form to preview the contract.</p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );

  return embedded ? content : <DashboardLayout>{content}</DashboardLayout>;
};

export default TemporaryContractGenerator;


