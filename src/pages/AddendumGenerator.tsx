import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, ArrowRight, Building2, User2, Briefcase, Check, Undo2, X, Info, Plus, Calendar } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
import { cn } from "@/lib/utils";
import {
  salaryFrequencyOptions,
  extractDobFromId,
  calculateAgeFromDob,
  type PermanentContractFormData,
} from "@/lib/validation";
import type { Tables } from "@/integrations/supabase/types";

type ContractFormState = {
  employeeId: string;
  age: string;
} & Omit<PermanentContractFormData, "salaryAmount" | "gender" | "race" | "annualLeaveDays"> & {
  salaryAmount: string;
  annualLeaveDays: string;
  gender: PermanentContractFormData["gender"] | "";
  race: PermanentContractFormData["race"] | "";
  contractReference: string;
  addendumType: AddendumType | "";
  effectiveDate: string;
  contractEndDate: string;
  newEndDate: string;
  idType: "id" | "passport";
};

type AmendmentType = "add" | "amend";
type AddendumType = "general" | "renewal" | "extension";

type AddendumData = PermanentContractFormData & {
  contractReference: string;
  addendumType: AddendumType;
  effectiveDate: string;
  contractEndDate: string;
  newEndDate: string;
  idType: "id" | "passport";
};

type SlimProfile = Pick<
  Tables<"profiles">,
  "id" | "company_name" | "registration_number" | "physical_address" | "company_contact" | "company_email"
>;
type SlimEmployee = {
  id: string;
  id_number: string | null;
  employee_name: string;
  employee_surname: string;
  nationality: string | null;
  emergency_contact_number: string | null;
  gender: string | null;
  race: string | null;
  cell_number: string | null;
  email: string | null;
  job_title: string | null;
  start_date: string | null;
  employee_number: string | null;
};
type ClauseDefinition = {
  id: string;
  title: string;
  body: string | string[];
  amendmentType?: AmendmentType;
};

type CustomClause = ClauseDefinition & { insertAfterId: string | null; amendmentType: AmendmentType };

const salaryFrequencyLabels: Record<PermanentContractFormData["salaryFrequency"], string> = {
  month: "per month",
  week: "per week",
  day: "per day",
  hour: "per hour",
};

const probationOptions: PermanentContractFormData["probationPeriod"][] = ["1", "3", "6"];
const probationLabels: Record<PermanentContractFormData["probationPeriod"], string> = {
  "1": "1 Month",
  "3": "3 Months",
  "6": "6 Months",
};

const retirementAgeOptions: PermanentContractFormData["retirementAge"][] = ["55", "60", "65"];

const addendumTypeOptions: Array<{ value: AddendumType; label: string }> = [
  { value: "general", label: "General Addendum" },
  { value: "renewal", label: "Contract Renewal" },
  { value: "extension", label: "Contract Extension" },
];

const addendumTypeLabels: Record<AddendumType, string> = {
  general: "General Addendum",
  renewal: "Contract Renewal",
  extension: "Contract Extension",
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", minimumFractionDigits: 2 }).format(amount);

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
};

const toDisplayDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
};

const toIsoDate = (value: string) => {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const day = d.padStart(2, "0");
  const month = m.padStart(2, "0");
  const iso = `${y}-${month}-${day}`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : iso;
};

const fillClausePlaceholders = (body: string | string[], contractRef: string, effectiveDate: string, newEndDate = "") => {
  const replaceText = (text: string) =>
    text
      .replace("[contract reference]", contractRef)
      .replace("[effective date]", effectiveDate)
      .replace("[new end date]", newEndDate || "________________________");
  return Array.isArray(body) ? body.map(replaceText) : replaceText(body);
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

const deriveAgeFromId = (id: string) => {
  const dob = extractDobFromId(id);
  if (!dob) return "";
  return String(calculateAgeFromDob(dob));
};

type FirstPagePreviewProps = {
  data: AddendumData;
  compact?: boolean;
  children?: ReactNode;
  profile: SlimProfile | null;
};

const FirstPagePreview = ({ data, compact = false, children, profile }: FirstPagePreviewProps) => {
  const displayValue = (value?: string | number | null) => (value && value.toString().trim() ? value.toString() : "________________________");
  const addendumTypeDisplay = addendumTypeLabels[data.addendumType] || data.addendumType;
  const usesId = data.idType === "id";
  const idDisplay = usesId ? data.employeeIdNumber : data.passportNumber || "--";
  const employeeNameDisplay = displayValue([data.employeeName, data.employeeSurname].filter(Boolean).join(" ")).toUpperCase();
  const companyNameDisplay = displayValue(profile?.company_name).toUpperCase();
  const regNumberDisplay = displayValue(profile?.registration_number);
  const documentTitle =
    data.addendumType === "extension"
      ? "Temporary Contract Extension"
      : data.addendumType === "renewal"
        ? "Temporary Contract Renewal"
        : "Addendum to Employment Contract";
  const employerLabel = 'Hereinafter referred to as "the Employer"';
  const employeeLabel = 'Hereinafter referred to as "the Employee"';

  return (
    <div
      className="bg-white text-black p-8 mx-auto shadow-sm flex flex-col"
      style={{ width: "210mm", minHeight: compact ? undefined : "297mm" }}
    >
      <h1 className="text-xl font-bold text-center text-gray-900 mb-8 uppercase tracking-wide">{documentTitle}</h1>

      <div className="relative top-2 space-y-5 flex-1 text-sm text-gray-900">
        <p className="text-xs tracking-wide text-black">Entered into by and between:</p>

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 pt-1">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-black">{companyNameDisplay}</p>
              <p className="text-xs text-gray-600">Reg. number: {regNumberDisplay}</p>
            </div>
            <p className="text-xs tracking-wide text-black text-right">{employerLabel}</p>
          </div>

          <div className="text-left text-xs font-semibold text-black mt-2 mb-2">and</div>

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-black">{employeeNameDisplay}</p>
              <p className="text-xs text-gray-600">
                {usesId ? "ID no." : "Passport no."}: {displayValue(idDisplay)}
              </p>
            </div>
            <p className="text-xs tracking-wide text-black text-right">{employeeLabel}</p>
          </div>
        </div>

      </div>

      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  );
};

const AddendumGenerator = ({
  embedded = false,
  externalNavigation = false,
  onStepChange,
  onStepMetaChange,
}: {
  embedded?: boolean;
  externalNavigation?: boolean;
  onStepChange?: (step: string | null) => void;
  onStepMetaChange?: (meta: {
    steps: readonly string[];
    activeStep: number;
    icons?: readonly ComponentType<SVGProps<SVGSVGElement>>[];
    canGoNext?: boolean;
    canGoBack?: boolean;
    onNext?: () => void;
    onBack?: () => void;
    onClear?: () => void;
    addendumType?: AddendumType | "";
    isFinished?: boolean;
  }) => void;
}) => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<SlimProfile | null>(null);
  const [employees, setEmployees] = useState<SlimEmployee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [showFinalActions, setShowFinalActions] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [validatedPreview, setValidatedPreview] = useState<AddendumData | null>(null);
  const [clauseEdits, setClauseEdits] = useState<Record<string, string>>({});
  const [customClauseTitleEdits, setCustomClauseTitleEdits] = useState<Record<string, string>>({});
  const [editingClause, setEditingClause] = useState<string | null>(null);
  const [clauseDraft, setClauseDraft] = useState("");
  const [customClauseTitleDraft, setCustomClauseTitleDraft] = useState("");
  const [customClauses, setCustomClauses] = useState<CustomClause[]>([]);
  const [addingAfter, setAddingAfter] = useState<string | null | undefined>(undefined);
  const [newClauseTitle, setNewClauseTitle] = useState("");
  const [newClauseBody, setNewClauseBody] = useState("");
  const [newClauseAmendmentType, setNewClauseAmendmentType] = useState<AmendmentType | "">("");
  const steps = ["Employer Details", "Employee Details", "Addendum Details"] as const;
  const stepIcons = [Building2, User2, Briefcase] as const;
  const [activeStep, setActiveStep] = useState(0);
  const [showEmployeeHint, setShowEmployeeHint] = useState(false);
  const [hasDismissedEmployeeHint, setHasDismissedEmployeeHint] = useState(false);
  const effectiveDatePickerRef = useRef<HTMLInputElement | null>(null);
  const contractReferencePickerRef = useRef<HTMLInputElement | null>(null);
  const contractEndDatePickerRef = useRef<HTMLInputElement | null>(null);
  const newEndDatePickerRef = useRef<HTMLInputElement | null>(null);
  const clauseFieldFocusRef = useRef<HTMLElement | null>(null);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const previewScrollTop = useRef(0);
  const baseModalFieldClass =
    "h-8 rounded border border-slate-200 bg-white !text-[11px] md:!text-[11px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] placeholder:!text-slate-400 hover:border-blue-400 !focus-visible:border-[1.75px] !focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:bg-white disabled:text-slate-900 disabled:border-slate-200 disabled:opacity-100 disabled:cursor-default";
  const addendumModalDropdownToneClass =
    "bg-white border-slate-300 hover:border-blue-400 data-[state=open]:border-slate-300 data-[state=open]:bg-white";
  const addendumModalSelectItemClass =
    "text-[11px] text-slate-700 focus:bg-blue-50/70 focus:text-blue-600 data-[highlighted]:bg-blue-50/70 data-[highlighted]:text-blue-600 data-[state=checked]:text-slate-700 data-[state=checked]:data-[highlighted]:text-slate-700";
  const getAddendumModalInputClass = (isComplete: boolean) =>
    `${baseModalFieldClass} !h-[34px] !border-[1.75px] !border-slate-300 !focus-visible:border-slate-300 ${isComplete ? "!border-emerald-500" : ""}`;
  const getAddendumModalSelectTriggerClass = (isComplete: boolean) =>
    `${baseModalFieldClass} justify-between data-[placeholder]:text-slate-400 data-[placeholder]:text-xs !h-[34px] !border-[1.75px] !border-slate-300 !focus:border-blue-600 !focus-visible:border-blue-600 data-[state=open]:!border-blue-600 !ring-0 !ring-offset-0 !outline-none !shadow-none !focus:ring-0 !focus:ring-offset-0 !focus:shadow-none !focus:outline-none !focus-visible:ring-0 !focus-visible:ring-offset-0 !focus-visible:shadow-none !focus-visible:outline-none data-[state=open]:!ring-0 data-[state=open]:!ring-offset-0 data-[state=open]:!shadow-none data-[state=open]:!outline-none ${isComplete ? "!border-emerald-500" : ""}`;
  const modalFieldLabelClass = "text-[10px] font-semibold text-slate-400";
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
    onStepChange?.(showFinalActions ? "Preview / Edit" : (steps[activeStep] ?? null));
  }, [activeStep, embedded, onStepChange, showFinalActions, steps]);


  const [formData, setFormData] = useState<ContractFormState>({
    employeeId: "",
    age: "",
    contractReference: "",
    addendumType: "general",
    effectiveDate: "",
    contractEndDate: "",
    newEndDate: "",
    idType: "id",
    startDate: new Date().toISOString().split("T")[0],
    issueDate: new Date().toISOString().split("T")[0],
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
    annualLeaveDays: "15",
    salaryFrequency: "month",
    probationPeriod: "3",
    department: "",
    retirementAge: "65",
    workplace: "",
    interpreter: "no",
    reportsTo: "",
    additionalNotes: "",
  });

  const sortedEmployees = useMemo(
    () =>
      [...employees].sort((a, b) => {
        const nameOrder = a.employee_name.localeCompare(b.employee_name, undefined, { sensitivity: "base" });
        if (nameOrder !== 0) return nameOrder;
        return a.employee_surname.localeCompare(b.employee_surname, undefined, { sensitivity: "base" });
      }),
    [employees],
  );

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
      .select("id, company_name, registration_number, physical_address, company_contact, company_email")
      .eq("id", user.id)
      .maybeSingle();
    if (error) {
      console.warn("Unable to load profile", error);
      return;
    }
    if (data) setProfile(data as SlimProfile);
  }, [user]);

  const fetchEmployees = useCallback(async () => {
    if (!user) return;
    const { data, error } = await (supabase as any)
      .from("employees")
      .select(
        "id, id_number, employee_name, employee_surname, nationality, emergency_contact_number, gender, race, cell_number, email, job_title, start_date, employee_number",
      )
      .eq("company_id", user.id);
    if (error) {
      console.warn("Unable to load employees", error);
      return;
    }
    if (data) setEmployees(data as SlimEmployee[]);
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchEmployees();
    }
  }, [user, fetchEmployees, fetchProfile]);

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

  const handleEmployeeSelect = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    const employee = employees.find((emp) => emp.id === employeeId);
    if (!employee) return;
    const employeeNationality =
      (employee as Partial<Tables<"employees">> & { nationality?: PermanentContractFormData["nationality"] })
        .nationality || "South African";
    const hasIdNumber = Boolean(employee.id_number);
    const passportNumber = !hasIdNumber ? employee.id_number ?? "" : "";
    const emergencyContact =
      (employee as Partial<Tables<"employees">> & { emergency_contact_number?: string }).emergency_contact_number ?? "";
    const genderValue = (employee as Partial<Tables<"employees">> & { gender?: PermanentContractFormData["gender"] }).gender || "";
    const raceValue = (employee as Partial<Tables<"employees">> & { race?: PermanentContractFormData["race"] }).race || "";
    const cellNumber = (employee as Partial<Tables<"employees">> & { cell_number?: string }).cell_number ?? "";
    const emailAddress = (employee as Partial<Tables<"employees">> & { email?: string }).email ?? "";
    const jobTitle = (employee as Partial<Tables<"employees">> & { job_title?: string }).job_title ?? "";
    const startDate = (employee as Partial<Tables<"employees">> & { start_date?: string }).start_date ?? "";
    const employeeNumber = (employee as Partial<Tables<"employees">> & { employee_number?: string }).employee_number ?? "";
    const idNumber = hasIdNumber ? employee.id_number ?? "" : "";
    const ageFromId = hasIdNumber ? deriveAgeFromId(idNumber) : "";
    const nextIdType: "id" | "passport" = hasIdNumber ? "id" : "passport";

    setFormData((prev) => ({
      ...prev,
      employeeId,
      employeeName: employee.employee_name,
      employeeSurname: employee.employee_surname,
      employeeIdNumber: idNumber,
      passportNumber: passportNumber || prev.passportNumber,
      nationality: employeeNationality,
      alternativeContact: emergencyContact || prev.alternativeContact,
      gender: genderValue || prev.gender,
      race: raceValue || prev.race,
      employeeCell: cellNumber || prev.employeeCell,
      employeeEmail: emailAddress || prev.employeeEmail,
      jobTitle: jobTitle || prev.jobTitle,
      startDate: startDate || prev.startDate,
      employeeNumber: employeeNumber || prev.employeeNumber,
      age: ageFromId,
      idType: nextIdType,
    }));
  };

  const resetForm = () => {
    setFormData({
      employeeId: "",
      age: "",
      contractReference: "",
      addendumType: "general",
      effectiveDate: "",
      contractEndDate: "",
      newEndDate: "",
      idType: "id",
      startDate: new Date().toISOString().split("T")[0],
      issueDate: new Date().toISOString().split("T")[0],
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
      annualLeaveDays: "15",
      salaryFrequency: "month",
      probationPeriod: "3",
      department: "",
      retirementAge: "65",
      workplace: profile?.physical_address || "",
      interpreter: "no",
      reportsTo: "",
      additionalNotes: "",
    });
    setSelectedEmployeeId("");
    setValidatedPreview(null);
    setShowFinalActions(false);
    setActiveStep(0);
    setClauseEdits({});
    setCustomClauseTitleEdits({});
    setCustomClauses([]);
    setEditingClause(null);
    setClauseDraft("");
    setCustomClauseTitleDraft("");
    setAddingAfter(null);
    setNewClauseTitle("");
    setNewClauseBody("");
  };

  useEffect(() => {
    if (formData.idType === "id") {
      const derived = formData.employeeIdNumber.length === 13 ? deriveAgeFromId(formData.employeeIdNumber) : "";
      setFormData((prev) => (derived !== prev.age ? { ...prev, age: derived } : prev));
    }
  }, [formData.employeeIdNumber, formData.idType]);

  const isEmployerStepComplete = useMemo(
    () => Boolean(formData.employerContact && formData.employerEmail),
    [formData.employerContact, formData.employerEmail],
  );

  const isEmployeeStepComplete = useMemo(
    () =>
      Boolean(
        formData.employeeName &&
          formData.employeeSurname &&
          ((formData.idType === "id" && formData.employeeIdNumber) ||
            (formData.idType === "passport" && formData.passportNumber)),
      ),
    [formData.employeeName, formData.employeeSurname, formData.employeeIdNumber, formData.passportNumber, formData.idType],
  );

  const isEmploymentStepComplete = useMemo(
    () => {
      if (!formData.addendumType || !formData.effectiveDate) return false;
      if (formData.addendumType === "extension" || formData.addendumType === "renewal") {
        return Boolean(formData.contractEndDate && formData.newEndDate);
      }
      return Boolean(formData.contractReference);
    },
    [
      formData.addendumType,
      formData.effectiveDate,
      formData.contractReference,
      formData.contractEndDate,
      formData.newEndDate,
    ],
  );

  const isFormComplete = useMemo(
    () => isEmployerStepComplete && isEmployeeStepComplete && isEmploymentStepComplete,
    [isEmployerStepComplete, isEmployeeStepComplete, isEmploymentStepComplete],
  );

  const isIdDateInvalid = useMemo(
    () =>
      formData.idType === "id" &&
      formData.employeeIdNumber.length === 13 &&
      !extractDobFromId(formData.employeeIdNumber),
    [formData.employeeIdNumber, formData.idType],
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
    if (showFinalActions) {
      setShowFinalActions(false);
      setActiveStep(steps.length - 1);
      return;
    }
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
      canGoNext: showFinalActions ? !isGenerating : canAdvance,
      canGoBack: showFinalActions || activeStep > 0,
      onNext: showFinalActions ? handleDownload : handleNextOrFinish,
      onBack: handleBack,
      onClear: clearCurrentStepFields,
      addendumType: formData.addendumType,
      isFinished: showFinalActions,
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
    handleDownload,
    isGenerating,
    isFormComplete,
    showFinalActions,
    formData.addendumType,
  ]);

  const resetEmployeeStepFields = () => {
    setFormData((prev) => ({
      ...prev,
      employeeId: "",
      employeeName: "",
      employeeSurname: "",
      idType: "id",
      employeeIdNumber: "",
      passportNumber: "",
      age: "",
    }));
    setSelectedEmployeeId("");
  };

  const resetEmployerStepFields = () => {
    setFormData((prev) => ({
      ...prev,
      tradingName: "",
      employerContact: profile?.company_contact || "",
      employerEmail: profile?.company_email || "",
    }));
  };

  const resetAddendumStepFields = () => {
    setFormData((prev) => ({
      ...prev,
      addendumType: "general",
      effectiveDate: "",
      contractEndDate: "",
      newEndDate: "",
      contractReference: "",
    }));
  };

  const clearCurrentStepFields = () => {
    if (activeStep === 0) {
      resetEmployerStepFields();
      return;
    }
    if (activeStep === 1) {
      resetEmployeeStepFields();
      return;
    }
    if (activeStep === 2) {
      resetAddendumStepFields();
      return;
    }
    resetForm();
  };

  const getPreviewScrollElement = useCallback(
    () =>
      (previewScrollRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null) ?? null,
    [],
  );

  const rememberClauseFieldFocus = (el: HTMLElement | null) => {
    if (el) clauseFieldFocusRef.current = el;
  };

  const rememberPreviewScroll = () => {
    const scrollEl = getPreviewScrollElement();
    if (scrollEl) {
      previewScrollTop.current = scrollEl.scrollTop;
    }
  };

  useEffect(() => {
    const target = clauseFieldFocusRef.current;
    if (target && document.activeElement !== target) {
      target.focus({ preventScroll: true } as FocusOptions);
    }
    const scrollEl = getPreviewScrollElement();
    if (scrollEl && scrollEl.scrollTop !== previewScrollTop.current) {
      scrollEl.scrollTop = previewScrollTop.current;
    }
  }, [addingAfter, editingClause, getPreviewScrollElement]);

  const openEffectiveDatePicker = () => {
    const picker = effectiveDatePickerRef.current;
    if (!picker) return;
    if (typeof (picker as any).showPicker === "function") {
      (picker as any).showPicker();
    } else {
      picker.click();
    }
  };

  const openContractReferencePicker = () => {
    const picker = contractReferencePickerRef.current;
    if (!picker) return;
    if (typeof (picker as any).showPicker === "function") {
      (picker as any).showPicker();
    } else {
      picker.click();
    }
  };

  const openContractEndDatePicker = () => {
    const picker = contractEndDatePickerRef.current;
    if (!picker) return;
    if (typeof (picker as any).showPicker === "function") {
      (picker as any).showPicker();
    } else {
      picker.click();
    }
  };

  const openNewEndDatePicker = () => {
    const picker = newEndDatePickerRef.current;
    if (!picker) return;
    if (typeof (picker as any).showPicker === "function") {
      (picker as any).showPicker();
    } else {
      picker.click();
    }
  };

  const validateData = () => {
    const missingFields: string[] = [];
    const checkRequired = (value: string | undefined | null, label: string) => {
      if (!value || !value.toString().trim()) {
        missingFields.push(label);
      }
    };

    const isExtension = formData.addendumType === "extension";
    const isRenewal = formData.addendumType === "renewal";

    checkRequired(formData.employerContact, "Employer contact");
    checkRequired(formData.employerEmail, "Employer email");
    checkRequired(formData.employeeName, "Employee name");
    checkRequired(formData.employeeSurname, "Employee surname");
    checkRequired(formData.idType, "ID/Passport selection");
    if (formData.idType === "id") {
      checkRequired(formData.employeeIdNumber, "ID number");
    } else {
      checkRequired(formData.passportNumber, "Passport number");
    }

    checkRequired(formData.addendumType, "Addendum type");
    checkRequired(formData.effectiveDate, "Effective date");
    if (isExtension || isRenewal) {
      checkRequired(formData.contractEndDate, "Contract end date");
      checkRequired(formData.newEndDate, "New end date");
    } else {
      checkRequired(formData.contractReference, "Contract reference");
    }

    if (missingFields.length) {
      throw new Error(`Please fill in the following required fields: ${missingFields.join(", ")}`);
    }

    const issueDate = formData.issueDate || formData.effectiveDate || new Date().toISOString().split("T")[0];

    return {
      ...formData,
      issueDate,
      salaryAmount: Number(formData.salaryAmount) || 0,
      annualLeaveDays: Number(formData.annualLeaveDays) || 0,
      addendumType: formData.addendumType as AddendumType,
      gender: formData.gender as PermanentContractFormData["gender"],
      race: formData.race as PermanentContractFormData["race"],
      idType: formData.idType,
      contractEndDate: formData.contractEndDate,
      newEndDate: formData.newEndDate,
    } as AddendumData;
  };

  const serializeClauseBody = (body: string | string[]) => (Array.isArray(body) ? body.join("\n\n") : body);

  const normalizeBodyText = (text: string) => {
    const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    return paragraphs.length ? paragraphs : text.trim();
  };

  const applyClauseEdits = (clauses: ClauseDefinition[]): ClauseDefinition[] =>
    clauses.map((clause) => {
      const edited = clauseEdits[clause.id];
      const editedTitle = customClauseTitleEdits[clause.id];
      const nextTitle = editedTitle ?? clause.title;
      if (!edited) {
        return nextTitle === clause.title ? clause : { ...clause, title: nextTitle };
      }
      return { ...clause, title: nextTitle, body: normalizeBodyText(edited) };
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
  }, [showFinalActions, formData]);

  const addWrappedText = (
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    fontSize = 9,
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

  const generatePDF = (data: AddendumData, download = false) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 18;
    const contentWidth = pageWidth - margin * 2;
    const formattedSalary = `${formatCurrency(data.salaryAmount)} ${salaryFrequencyLabels[data.salaryFrequency]}`;
    const addendumTypeDisplay = addendumTypeLabels[data.addendumType] || data.addendumType;
    const effectiveDateDisplay = data.effectiveDate || data.issueDate;
    const issueYear = extractYear(data.issueDate);
    const newEndDateDisplay = formatDate(data.newEndDate || data.contractEndDate);
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
      doc.setFontSize(9);
      doc.setTextColor(45, 55, 72);
      doc.text(title.toUpperCase(), margin + 4, y + 6);
      if (subtitle) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.text(subtitle, margin + contentWidth - 4, y + 6, { align: "right" });
      }
      y += headerHeight + 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
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
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(55, 65, 81);
      doc.text(`${label.toUpperCase()}:`, margin + 3, y + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
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
      valueFontSize = 9,
    ) => {
      // Give the amount/suffix extra breathing room to avoid wrapping.
      const columnWidth = (contentWidth - 2) / 2;
      const labelWidth = 40;
      const availableWidth = columnWidth - labelWidth + 12;
      const lineHeight = 5.5;
      const leftLines = doc.splitTextToSize(valueOrLine(leftValue), availableWidth);
      const rightLines = doc.splitTextToSize(valueOrLine(rightValue), availableWidth);
      const rowHeight = Math.max(leftLines.length, rightLines.length) * lineHeight + 3;

      ensureSpace(rowHeight);

      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(55, 65, 81);
      doc.text(`${leftLabel.toUpperCase()}:`, margin + 3, y + 6);
      doc.text(`${rightLabel.toUpperCase()}:`, margin + columnWidth + 2, y + 6);

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
      const columnWidth = (contentWidth - 8) / 2;
      const labelWidth = 42;
      const availableWidth = columnWidth - labelWidth;
      const lineHeight = 5.5;

      let suffixSize = 6.5;
      let suffixDisplay = suffixText;

      const fits = (size: number, suffix: string) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        const amountWidth = doc.getTextWidth(amountText);
        doc.setFontSize(size);
        const suffixWidth = doc.getTextWidth(` ${suffix}`);
        return amountWidth + suffixWidth <= availableWidth;
      };

      while (!fits(suffixSize, suffixDisplay) && suffixSize > 5) {
        suffixSize -= 0.5;
      }
      if (!fits(suffixSize, suffixDisplay)) {
        suffixDisplay = suffixText.replace("per ", "/");
        if (!fits(suffixSize, suffixDisplay)) {
          suffixSize = 4.5;
        }
      }

      const rightLines = doc.splitTextToSize(valueOrLine(rightValue), availableWidth);
      const rowHeight = lineHeight + 3;

      ensureSpace(rowHeight);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(55, 65, 81);
      doc.text(`${leftLabel.toUpperCase()}:`, margin + 3, y + 6);
      doc.text(`${rightLabel.toUpperCase()}:`, margin + columnWidth + 8 + 3, y + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      const amountX = margin + labelWidth;
      doc.text(amountText, amountX, y + 6);
      doc.setFontSize(suffixSize);
      doc.text(` ${suffixDisplay}`, amountX + doc.getTextWidth(amountText), y + 6);

      doc.setFontSize(9);
      rightLines.forEach((line, idx) => {
        doc.text(line, margin + columnWidth + 8 + labelWidth, y + 6 + idx * lineHeight);
      });

      y += rowHeight;
    };

    const addSection = (title: string, body: string) => {
      ensureSpace(12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(title.toUpperCase(), margin, y);
      y += 6;
      doc.setTextColor(0, 0, 0);
      y = addWrappedText(doc, body, margin, y, contentWidth, 6, 9, "normal") + 2;
      y += 2;
    };

    const addUnnumberedParagraph = (text: string) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const lineHeight = 6;
      const paragraphSpacing = 2;
      const maxWidth = contentWidth;
      const lines = doc.splitTextToSize(text, maxWidth);
      const blockHeight = lines.length * lineHeight + paragraphSpacing;

      ensureSpace(blockHeight);
      lines.forEach((line, idx) => {
        doc.text(line, margin, y + idx * lineHeight);
      });
      y += lines.length * lineHeight + paragraphSpacing;
    };

    const addNumberedParagraph = (index: number, text: string) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
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
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(title.toUpperCase(), margin, y);
      y += headingHeight;
      doc.setFont("helvetica", "normal");
    };

    const addInformationPage = () => {
      const effectiveDisplay = formatDate(effectiveDateDisplay || data.issueDate);
      const usesId = data.idType === "id";
      const idDisplay = usesId ? data.employeeIdNumber : data.passportNumber || "";
      const companyName = (profile?.company_name || "________________________").toUpperCase();
      const regNumber = profile?.registration_number || "________________________";
      const employeeFullName =
        ([data.employeeName, data.employeeSurname].filter(Boolean).join(" ") || "________________________").toUpperCase();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(0, 0, 0);
      const documentTitle =
        data.addendumType === "extension"
          ? "TEMPORARY CONTRACT EXTENSION"
          : data.addendumType === "renewal"
            ? "TEMPORARY CONTRACT RENEWAL"
            : "ADDENDUM TO EMPLOYMENT CONTRACT";
      doc.text(documentTitle, pageWidth / 2, y, { align: "center" });
      y += 10;

      const blockOffset = 4;
      let blockY = y + blockOffset;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Entered into by and between:", margin, blockY);
      blockY += 8;

      // Employer block
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      blockY += 2;
      doc.text(companyName, margin, blockY);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text('Hereinafter referred to as "the Employer"', margin + contentWidth, blockY, { align: "right" });
      blockY += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Reg. number: ${valueOrLine(regNumber)}`, margin, blockY);
      blockY += 10;

      // Separator
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      blockY += 2; // extra spacing above "and"
      doc.text("and", margin, blockY);
      blockY += 10; // extra spacing below "and"

      // Employee block
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(valueOrLine(employeeFullName), margin, blockY);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text('Hereinafter referred to as "the Employee"', margin + contentWidth, blockY, { align: "right" });
      blockY += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const idLabel = usesId ? "ID no." : "Passport no.";
      doc.text(`${idLabel}: ${valueOrLine(idDisplay)}`, margin, blockY);
      blockY += 10;

      // Spacing before clauses (divider added later); keep overall flow unchanged
      y = blockY - blockOffset + 4;
    };

    addInformationPage();

    const annualLeaveText = `The Employee is entitled to ${data.annualLeaveDays} days' annual leave per leave cycle. Leave shall be taken at times determined by the Employer, subject to operational requirements. Unused leave will be forfeited if not taken within the applicable cycle.`;

    ensureSpace(0);
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(margin, y, margin + contentWidth, y);
    y += 10; // gap before first clause heading

    ensureSpace(24);

    const contractRefDisplay = formatDate(data.contractReference);
    const previousEndDateDisplay = formatDate(data.contractEndDate || data.contractReference);
    const recordEffectiveDisplay = formatDate(effectiveDateDisplay || data.issueDate);
    const isExtension = data.addendumType === "extension";
    const isRenewal = data.addendumType === "renewal";

    const introductionBody = isExtension
      ? `This Addendum is entered into by and between the Employer and the Employee to extend the temporary employment contract, which ends or ended on ${previousEndDateDisplay || "________________________"}.`
      : isRenewal
        ? "The Employer and the Employee hereby agree to renew the temporary employment relationship on a temporary basis following the termination of the previous temporary employment contract."
        : fillClausePlaceholders(
            "This Addendum is entered into by and between the Employer and Employee to amend the employment contract concluded between them and dated [contract reference].",
            contractRefDisplay,
            recordEffectiveDisplay,
          );

    const recordalBody = isExtension
      ? fillClausePlaceholders(
          [
            "This Addendum must be read together with the temporary employment contract referred to above, and unless amended, all terms and conditions thereof shall remain unchanged and of full force and effect.",
            "Effective from [effective date], the temporary employment contract, referred to above, is extended until [new end date].",
          ],
          contractRefDisplay,
          recordEffectiveDisplay,
          newEndDateDisplay,
        )
      : isRenewal
        ? [
            `The parties record that the previous temporary employment contract terminated on ${previousEndDateDisplay || "________________________"}.`,
            `This Addendum records the renewal of the employment relationship and constitutes a new fixed-term contract of employment for the period commencing on ${recordEffectiveDisplay || "________________________"} and ending on ${newEndDateDisplay || "________________________"}.`,
            "Save as expressly amended by this Addendum, all terms and conditions of the previous employment contract shall apply to the renewed fixed-term period of employment.",
          ]
        : "This Addendum must be read together with the employment contract referred to above, and unless amended, all terms and conditions thereof shall remain unchanged and of full force and effect.";

    const baseClauses: Array<Omit<ClauseDefinition, "id">> = [
      {
        title: "Introduction",
        body: introductionBody,
      },
      {
        title: "Recordal",
        body: recordalBody,
      },
      ...(isExtension
        ? [
            {
              title: "Termination",
              body: fillClausePlaceholders(
                [
                  "The temporary employment contract shall terminate automatically on [new end date], without notice.",
                  "The Employee acknowledges and agrees that this extension does not create any expectation of further extension, renewal, or permanent or indefinite employment.",
                ],
                contractRefDisplay,
                recordEffectiveDisplay,
                newEndDateDisplay,
              ),
            },
          ]
        : isRenewal
          ? [
              {
                title: "Termination",
                body: [
                  `The renewed temporary employment contract shall terminate automatically on ${newEndDateDisplay || "________________________"}, without notice.`,
                  "The Employee acknowledges and agrees that this renewal does not create any expectation of further renewal, extension, or permanent or indefinite employment.",
                ],
              },
            ]
        : []),
      {
        title: "Entire Agreement and Acknoweldgement",
        body: [
          "This Addendum constitutes the entire agreement between the parties in respect of the amendments recorded herein. No amendment to this Addendum shall be valid unless reduced to writing and signed by both parties.",
          "By signing this Addendum, the parties acknowledge that they have read and understood its contents and agree to be bound by its terms.",
          "Save as expressly amended by this Addendum, all terms and conditions of the employment contract remain unchanged and of full force and effect.",
        ],
      },
    ];

    const clauses: ClauseDefinition[] = mergeClauses(withClauseIds(baseClauses));

    const clausesWithEdits = applyClauseEdits(clauses);

    let clauseNumber = 1;
    let isFirstClause = true;
    clausesWithEdits.forEach((clause) => {
      if (!isFirstClause) {
        y += 6; // consistent gap before each new clause
      }
      isFirstClause = false;
      const paragraphs = Array.isArray(clause.body) ? clause.body : [clause.body];
      const preface =
        clause.amendmentType === "add"
          ? "The following term(s) will be added to the employment contract:"
          : clause.amendmentType === "amend"
            ? "The terms of the clause is hereby amended as follows:"
            : null;
      addClauseHeading(clause.title);
      if (preface) {
        addUnnumberedParagraph(preface);
      }
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

    // Place signing line on the page above the signature page
    const signingLine = `Done and Signed at ___________________________ on this _____ day of ____________________ ${issueYear}.`;
    ensureSpace(12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(signingLine, margin, y);
    y += 16;

    // Draw signature block on the same page where possible; only push if no space remains
    const signatureBlockHeight = 12 + signatureLabels.length * 20;
    ensureSpace(signatureBlockHeight);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("SIGNATURES", margin, y);
    y += 12; // increased gap before first signature line
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

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
    doc.setFontSize(8);
    for (let i = 1; i <= pageCount; i += 1) {
      doc.setPage(i);
      // Top-right page number (does not affect layout flow)
      doc.setFontSize(7);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, margin - 6, { align: "right" });
      doc.setFontSize(8);

      const footerY = pageHeight - 10; // slightly lower for more space above
      doc.setDrawColor(226, 232, 240); // subtle divider above footer text
      doc.line(margin, footerY - 8, margin + contentWidth, footerY - 8);
      doc.text("Initial here: ______________________", pageWidth - margin, footerY, { align: "right" });
    }

    if (download) {
      doc.save(`Addendum_${data.employeeSurname || "employee"}_${data.startDate}.pdf`);
      toast({
        title: "Download ready",
        description: "Addendum has been generated.",
      });
    } else {
      const blobUrl = doc.output("bloburl");
      window.open(blobUrl, "_blank");
    }
  };

  function handleDownload() {
    try {
      setIsGenerating(true);
      const validated = validateData();
      generatePDF(validated, true);
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
  }

  function handleFinish() {
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
  }

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center", embedded ? "min-h-[60vh]" : "min-h-screen")}>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }
  const useExternalShell = embedded && externalNavigation;

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
          useExternalShell && "h-full min-h-0 space-y-0 pt-0 pr-0 pb-0",
        )}
        style={{ scrollbarGutter: "stable" }}
      >
        {!showFinalActions ? (
          <Card className={cn("rounded-sm mt-4 shadow-none border-0 bg-transparent", useExternalShell && "mt-0 h-full min-h-0")}>
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
                "pt-1 [&_input]:h-9 [&_input]:py-2 [&_button[role=combobox]]:h-9 [&_textarea]:py-2 [&_textarea]:text-sm",
                embedded && "px-0",
                !embedded && "flex-1 min-h-0 overflow-y-auto",
                useExternalShell && "p-0 h-full min-h-0 flex flex-col overflow-hidden",
              )}
            >
              <div className={cn("space-y-4", useExternalShell && "min-h-0 flex-1 overflow-y-auto pr-1")}>
              {activeStep === 0 && (
                <div className="space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="companyName" className={modalFieldLabelClass}>Company name</Label>
                      <Input
                        id="companyName"
                        value={profile?.company_name || ""}
                        readOnly
                        className={getAddendumModalInputClass(Boolean(profile?.company_name))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="registrationNumber" className={modalFieldLabelClass}>Registration number</Label>
                      <Input
                        id="registrationNumber"
                        value={profile?.registration_number || ""}
                        readOnly
                        className={getAddendumModalInputClass(Boolean(profile?.registration_number))}
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="physicalAddress" className={modalFieldLabelClass}>Registered address</Label>
                      <Input
                        id="physicalAddress"
                        value={profile?.physical_address || ""}
                        readOnly
                        className={getAddendumModalInputClass(Boolean(profile?.physical_address))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tradingName" className={modalFieldLabelClass}>Trading name</Label>
                      <Input
                        id="tradingName"
                        value={formData.tradingName}
                        onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
                        placeholder="If different from registered name"
                        className={getAddendumModalInputClass(formData.tradingName.trim().length > 0)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="employerContact" className={modalFieldLabelClass}>Employer contact *</Label>
                      <Input
                        id="employerContact"
                        value={formData.employerContact}
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
                          setFormData({ ...formData, employerContact: digitsOnly });
                        }}
                        placeholder="10-digit contact number"
                        className={getAddendumModalInputClass(formData.employerContact.trim().length > 0)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="employerEmail" className={modalFieldLabelClass}>Employer email *</Label>
                      <Input
                        id="employerEmail"
                        type="email"
                        value={formData.employerEmail}
                        onChange={(e) => setFormData({ ...formData, employerEmail: e.target.value })}
                        className={getAddendumModalInputClass(formData.employerEmail.trim().length > 0)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeStep === 1 && (
                <div className="space-y-3">
                    <div className="space-y-2.5">
                      <div className="space-y-1.5">
                        <Label htmlFor="employee" className={modalFieldLabelClass}>Select Employee (optional)</Label>
                      <Select value={selectedEmployeeId} onValueChange={handleEmployeeSelect}>
                        <SelectTrigger className={`${getAddendumModalSelectTriggerClass(selectedEmployeeId.trim().length > 0)} ${addendumModalDropdownToneClass}`}>
                          <SelectValue placeholder="Select from saved employees or fill manually" />
                        </SelectTrigger>
                        <SelectContent className="w-[var(--radix-select-trigger-width)]">
                          {sortedEmployees.map((employee) => (
                            <SelectItem key={employee.id} value={employee.id} className={addendumModalSelectItemClass}>
                              {employee.employee_name} {employee.employee_surname}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="employeeName" className={modalFieldLabelClass}>Employee Name *</Label>
                        <Input
                          id="employeeName"
                          value={formData.employeeName}
                          onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
                          className={getAddendumModalInputClass(formData.employeeName.trim().length > 0)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="employeeSurname" className={modalFieldLabelClass}>Employee Surname *</Label>
                        <Input
                          id="employeeSurname"
                          value={formData.employeeSurname}
                          onChange={(e) => setFormData({ ...formData, employeeSurname: e.target.value })}
                          className={getAddendumModalInputClass(formData.employeeSurname.trim().length > 0)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className={modalFieldLabelClass}>ID/Passport *</Label>
                        <Select
                          value={formData.idType}
                          onValueChange={(value) => {
                            setFormData((prev) => ({
                              ...prev,
                              idType: value as "id" | "passport",
                            }));
                          }}
                        >
                          <SelectTrigger className={`${getAddendumModalSelectTriggerClass(Boolean(formData.idType))} ${addendumModalDropdownToneClass}`}>
                            <SelectValue placeholder="Choose document type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="id" className={addendumModalSelectItemClass}>ID Number</SelectItem>
                            <SelectItem value="passport" className={addendumModalSelectItemClass}>Passport Number</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="idOrPassport" className={modalFieldLabelClass}>
                          {formData.idType === "id" ? "ID Number *" : "Passport Number *"}
                        </Label>
                        <Input
                          id="idOrPassport"
                          value={formData.idType === "id" ? formData.employeeIdNumber : formData.passportNumber}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (formData.idType === "id") {
                              const digitsOnly = value.replace(/\D/g, "").slice(0, 13);
                              const derived = deriveAgeFromId(digitsOnly);
                              setFormData((prev) => ({
                                ...prev,
                                employeeIdNumber: digitsOnly,
                                age: derived,
                              }));
                            } else {
                              setFormData((prev) => ({
                                ...prev,
                                passportNumber: value,
                              }));
                            }
                          }}
                          className={`${getAddendumModalInputClass(
                            formData.idType === "id"
                              ? formData.employeeIdNumber.trim().length > 0
                              : formData.passportNumber.trim().length > 0,
                          )} ${
                            isIdDateInvalid ? "border-red-500 ring-red-500" : ""
                          }`}
                          placeholder={
                            formData.idType === "id" ? "Insert 13-digit ID number" : "Insert passport number"
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeStep === 2 && (
                <div className="space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="addendumType" className={modalFieldLabelClass}>Addendum Type *</Label>
                      <Select
                        value={formData.addendumType}
                        onValueChange={(value) => {
                          const nextType = value as AddendumType;
                          setFormData((prev) => ({
                            ...prev,
                            addendumType: nextType,
                            contractReference: nextType === "general" ? prev.contractReference : "",
                            contractEndDate:
                              nextType === "extension" || nextType === "renewal" ? prev.contractEndDate : "",
                            newEndDate: nextType === "extension" || nextType === "renewal" ? prev.newEndDate : "",
                          }));
                        }}
                      >
                        <SelectTrigger className={`${getAddendumModalSelectTriggerClass(Boolean(formData.addendumType))} ${addendumModalDropdownToneClass}`}>
                          <SelectValue
                            placeholder="Select addendum type"
                            className="data-[placeholder]:text-slate-400"
                            style={!formData.addendumType ? { color: "#94a3b8" } : undefined}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {addendumTypeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value} className={addendumModalSelectItemClass}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="effectiveDate" className={modalFieldLabelClass}>Effective Date *</Label>
                      <div className="flex items-start gap-2">
                        <Input
                          id="effectiveDate"
                          type="text"
                          readOnly
                          placeholder="Please select a date"
                          value={formData.effectiveDate ? toDisplayDate(formData.effectiveDate) : ""}
                          onClick={openEffectiveDatePicker}
                          onFocus={openEffectiveDatePicker}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openEffectiveDatePicker();
                            }
                          }}
                          className={`${getAddendumModalInputClass(formData.effectiveDate.trim().length > 0)} flex-1 cursor-pointer placeholder:text-gray-900`}
                        />
                        <input
                          ref={effectiveDatePickerRef}
                          type="date"
                          value={formData.effectiveDate && /^\d{4}-\d{2}-\d{2}$/.test(formData.effectiveDate) ? formData.effectiveDate : ""}
                          onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                          className="sr-only"
                          aria-hidden="true"
                          tabIndex={-1}
                        />
                      </div>
                    </div>
                    {formData.addendumType === "extension" || formData.addendumType === "renewal" ? (
                      <>
                        <div className="space-y-1.5">
                          <Label htmlFor="contractEndDate" className={modalFieldLabelClass}>What was the previous contract end date? *</Label>
                          <div className="flex items-start gap-2">
                            <Input
                              id="contractEndDate"
                              type="text"
                              readOnly
                              placeholder="Please select a date"
                              value={formData.contractEndDate ? toDisplayDate(formData.contractEndDate) : ""}
                              onClick={openContractEndDatePicker}
                              onFocus={openContractEndDatePicker}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  openContractEndDatePicker();
                                }
                              }}
                              className={`${getAddendumModalInputClass(formData.contractEndDate.trim().length > 0)} flex-1 cursor-pointer placeholder:text-gray-900`}
                            />
                            <input
                              ref={contractEndDatePickerRef}
                              type="date"
                              value={
                                formData.contractEndDate && /^\d{4}-\d{2}-\d{2}$/.test(formData.contractEndDate)
                                  ? formData.contractEndDate
                                  : ""
                              }
                              onChange={(e) => setFormData({ ...formData, contractEndDate: e.target.value })}
                              className="sr-only"
                              aria-hidden="true"
                              tabIndex={-1}
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="newEndDate" className={modalFieldLabelClass}>New End Date *</Label>
                          <div className="flex items-start gap-2">
                            <Input
                              id="newEndDate"
                              type="text"
                              readOnly
                              placeholder="Please select a date"
                              value={formData.newEndDate ? toDisplayDate(formData.newEndDate) : ""}
                              onClick={openNewEndDatePicker}
                              onFocus={openNewEndDatePicker}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  openNewEndDatePicker();
                                }
                              }}
                              className={`${getAddendumModalInputClass(formData.newEndDate.trim().length > 0)} flex-1 cursor-pointer placeholder:text-gray-900`}
                            />
                            <input
                              ref={newEndDatePickerRef}
                              type="date"
                              value={
                                formData.newEndDate && /^\d{4}-\d{2}-\d{2}$/.test(formData.newEndDate)
                                  ? formData.newEndDate
                                  : ""
                              }
                              onChange={(e) => setFormData({ ...formData, newEndDate: e.target.value })}
                              className="sr-only"
                              aria-hidden="true"
                              tabIndex={-1}
                            />
                          </div>
                        </div>
                      </>
                    ) : null}
                    {formData.addendumType === "general" ? (
                      <div className="space-y-1.5 md:col-span-2">
                        <Label htmlFor="contractReference" className={modalFieldLabelClass}>Select the date of the employment contract (signature or isuing date) *</Label>
                        <div className="flex items-start gap-2">
                          <Input
                            id="contractReference"
                            type="text"
                            readOnly
                            placeholder="Please select a date"
                            value={formData.contractReference ? toDisplayDate(formData.contractReference) : ""}
                            onClick={openContractReferencePicker}
                            onFocus={openContractReferencePicker}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                openContractReferencePicker();
                              }
                            }}
                            aria-required="true"
                            className={`${getAddendumModalInputClass(formData.contractReference.trim().length > 0)} flex-1 cursor-pointer placeholder:text-gray-900`}
                          />
                          <input
                            ref={contractReferencePickerRef}
                            type="date"
                            value={
                              formData.contractReference && /^\d{4}-\d{2}-\d{2}$/.test(formData.contractReference)
                                ? formData.contractReference
                                : ""
                            }
                            onChange={(e) => setFormData({ ...formData, contractReference: e.target.value })}
                            className="sr-only"
                            aria-hidden="true"
                            tabIndex={-1}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                {!(embedded && externalNavigation) ? (
                  <>
                {activeStep === steps.length - 1 ? (
                  <div className="flex w-full items-center gap-3 flex-wrap justify-between">
                    <div className="flex-none">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleBack}
                        className="h-[28px] w-[84px] rounded border-blue-600 px-3 text-xs text-blue-600 hover:bg-transparent hover:text-blue-600"
                      >
                        Back
                      </Button>
                    </div>
                    <div className="flex-1 flex justify-center">
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={clearCurrentStepFields}
                              disabled={isGenerating}
                              aria-label="Reset fields"
                              className="gap-2 text-slate-700 hover:text-blue-600 hover:bg-white transition-transform duration-200 hover:scale-105 disabled:text-slate-300"
                            >
                              <Undo2 className="h-4 w-4" />
                              Reset
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Reset fields for this step</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex-none relative">
                      <Button
                        type="button"
                        onClick={handleFinish}
                        disabled={!isFormComplete || isGenerating}
                        className="h-[30px] w-[92px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700 disabled:bg-slate-300"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex w-full items-center justify-between gap-2 flex-wrap">
                    <div className="flex-none">
                      {activeStep > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleBack}
                          className="h-[28px] w-[84px] rounded border-blue-600 px-3 text-xs text-blue-600 hover:bg-transparent hover:text-blue-600"
                        >
                          Back
                        </Button>
                      )}
                    </div>
                    <div className="flex-1 flex justify-center">
                      {activeStep > 0 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={clearCurrentStepFields}
                          disabled={isGenerating}
                          aria-label="Reset fields"
                          className="gap-2 text-slate-700 hover:text-blue-600 hover:bg-white transition-transform duration-200 hover:scale-105 disabled:text-slate-300"
                        >
                          <Undo2 className="h-4 w-4" />
                          Reset
                        </Button>
                      ) : null}
                    </div>
                    <div className="flex-none">
                      {activeStep < steps.length - 1 && (
                        <Button
                          type="button"
                          onClick={handleNext}
                          disabled={!canGoNext}
                          className="h-[28px] w-[84px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700 disabled:bg-slate-300"
                        >
                          Next
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                  </>
                ) : null}
              </div>
            </div>
          </CardContent>
          </Card>
          ) : (
            <Card className={cn("rounded-sm mt-4 shadow-none border-0 bg-transparent", useExternalShell && "mt-0 contents")}>
              <CardHeader className="pt-4 pb-0" />
              <CardContent className={cn("space-y-6 pt-2", useExternalShell && "contents")}>
                  <ScrollArea className="h-[70vh] w-full rounded-sm bg-white px-6 pb-6" ref={previewScrollRef}>
            {validatedPreview ? (() => {
              const displayValue = (value?: string | number | null) =>
                value && value.toString().trim() ? value.toString() : "________________________";
              const salaryDisplay = `${formatCurrency(validatedPreview.salaryAmount)} ${salaryFrequencyLabels[validatedPreview.salaryFrequency]}`;
              const workplace = validatedPreview.workplace || profile?.physical_address || "";
              const employerName = profile?.company_name || "the Employer";
              const usesId = validatedPreview.idType === "id";
              const derivedAge = usesId ? deriveAgeFromId(validatedPreview.employeeIdNumber) : "";
              const idDisplay = usesId ? validatedPreview.employeeIdNumber : "--";
              const passportDisplay = usesId ? "--" : validatedPreview.passportNumber || "--";
              const contractRefDisplay = formatDate(validatedPreview.contractReference);
              const effectiveDisplay = formatDate(validatedPreview.effectiveDate || validatedPreview.issueDate);
              const newEndDateDisplay = formatDate(validatedPreview.newEndDate || validatedPreview.contractEndDate);
              const previousEndDateDisplay = formatDate(validatedPreview.contractEndDate || validatedPreview.contractReference);
              const annualLeaveText = `The Employee is entitled to ${validatedPreview.annualLeaveDays} days' annual leave per leave cycle. Leave shall be taken at times determined by the Employer, subject to operational requirements. Unused leave will be forfeited if not taken within the applicable cycle.`;

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
                <div className="grid grid-cols-2 gap-4 border-b border-slate-200 py-2 px-3 text-[11px]">
                  <div className="grid grid-cols-[120px_1fr] gap-2">
                    <span className="font-semibold italic uppercase text-gray-700 whitespace-nowrap">{leftLabel}:</span>
                    <span className="text-gray-900">{displayValue(leftValue)}</span>
                  </div>
                  <div className="grid grid-cols-[120px_1fr] gap-2">
                    <span className="font-semibold italic uppercase text-gray-700 whitespace-nowrap">{rightLabel}:</span>
                    <span className="text-gray-900">{displayValue(rightValue)}</span>
                  </div>
                </div>
              );

    const isExtension = validatedPreview.addendumType === "extension";
    const isRenewal = validatedPreview.addendumType === "renewal";

    const baseClauses: Array<Omit<ClauseDefinition, "id">> = [
      {
        title: "Introduction",
        body:
          isExtension
            ? `This Addendum is entered into by and between the Employer and the Employee to extend the temporary employment contract, which ends or ended on ${previousEndDateDisplay || "________________________"}.`
            : isRenewal
              ? "The Employer and the Employee hereby agree to renew the temporary employment relationship on a temporary basis following the termination of the previous temporary employment contract."
              : fillClausePlaceholders(
                  "This Addendum is entered into by and between the Employer and Employee to amend the employment contract concluded between them dated [contract reference].",
                  contractRefDisplay,
                  effectiveDisplay,
                ),
      },
      {
        title: "Recordal",
        body: isExtension
          ? fillClausePlaceholders(
              [
                "This Addendum must be read together with the temporary employment contract referred to above, and unless amended, all terms and conditions thereof shall remain unchanged and of full force and effect.",
                "Effective from [effective date], the temporary employment contract, referred to above, is extended until [new end date].",
              ],
              contractRefDisplay,
              effectiveDisplay,
              newEndDateDisplay,
            )
          : isRenewal
            ? [
                `The parties record that the previous temporary employment contract terminated on ${previousEndDateDisplay || "________________________"}.`,
                `This Addendum records the renewal of the employment relationship and constitutes a new fixed-term contract of employment for the period commencing on ${effectiveDisplay || "________________________"} and ending on ${newEndDateDisplay || "________________________"}.`,
                "Save as expressly amended by this Addendum, all terms and conditions of the previous employment contract shall apply to the renewed fixed-term period of employment.",
              ]
            : "This Addendum must be read together with the employment contract referred to above, and unless amended, all terms and conditions thereof shall remain unchanged and of full force and effect.",
      },
      ...(isExtension
        ? [
            {
              title: "Termination",
              body: fillClausePlaceholders(
                [
                  "The temporary employment contract shall terminate automatically on [new end date], without notice.",
                  "The Employee acknowledges and agrees that this extension does not create any expectation of further extension, renewal, or permanent or indefinite employment.",
                ],
                contractRefDisplay,
                effectiveDisplay,
                newEndDateDisplay,
              ),
            },
          ]
        : isRenewal
          ? [
              {
                title: "Termination",
                body: [
                  `The renewed temporary employment contract shall terminate automatically on ${newEndDateDisplay || "________________________"}, without notice.`,
                  "The Employee acknowledges and agrees that this renewal does not create any expectation of further renewal, extension, or permanent or indefinite employment.",
                ],
              },
            ]
        : []),
      {
        title: "Entire Agreement and Acknoweldgement",
        body: [
          "This Addendum constitutes the entire agreement between the parties in respect of the amendments recorded herein. No amendment to this Addendum shall be valid unless reduced to writing and signed by both parties.",
          "By signing this Addendum, the parties acknowledge that they have read and understood its contents and agree to be bound by its terms.",
          "Save as expressly amended by this Addendum, all terms and conditions of the employment contract remain unchanged and of full force and effect.",
        ],
      },
    ];

    const clauses: ClauseDefinition[] = mergeClauses(withClauseIds(baseClauses));

              const clausesWithEdits = applyClauseEdits(clauses);

              const startEditingClause = (clause: ClauseDefinition) => {
                rememberPreviewScroll();
                const isCustomClause = customClauses.some((custom) => custom.id === clause.id);
                setEditingClause(clause.id);
                setClauseDraft(clauseEdits[clause.id] ?? serializeClauseBody(clause.body));
                setCustomClauseTitleDraft(isCustomClause ? (customClauseTitleEdits[clause.id] ?? clause.title) : "");
              };

              const saveClauseEdit = (id: string) => {
                const trimmed = clauseDraft.trim();
                const baseCustomClause = customClauses.find((clause) => clause.id === id);
                if (baseCustomClause) {
                  const titleTrimmed = customClauseTitleDraft.trim();
                  setCustomClauseTitleEdits((prev) => {
                    const next = { ...prev };
                    if (!titleTrimmed || titleTrimmed === baseCustomClause.title) {
                      delete next[id];
                    } else {
                      next[id] = titleTrimmed;
                    }
                    return next;
                  });
                }
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
                setCustomClauseTitleDraft("");
              };

              const resetClauseEdit = (id: string) => {
                setClauseEdits((prev) => {
                  const next = { ...prev };
                  delete next[id];
                  return next;
                });
                setCustomClauseTitleEdits((prev) => {
                  const next = { ...prev };
                  delete next[id];
                  return next;
                });
                setEditingClause(null);
                setClauseDraft("");
                setCustomClauseTitleDraft("");
              };

              const openAddClauseForm = (afterId: string | null) => {
                rememberPreviewScroll();
                setAddingAfter(afterId);
                setNewClauseTitle("");
                setNewClauseBody("");
                setNewClauseAmendmentType("");
              };

              const cancelAddClause = () => {
                setAddingAfter(undefined);
                setNewClauseTitle("");
                setNewClauseBody("");
                setNewClauseAmendmentType("");
              };

              const saveNewClause = () => {
                const title = newClauseTitle.trim();
                const body = newClauseBody.trim();
                if (!newClauseAmendmentType) {
                  toast({
                    title: "Add clause",
                    description: "Please select an amendment type.",
                    variant: "destructive",
                  });
                  return;
                }
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
                    amendmentType: newClauseAmendmentType,
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
                setCustomClauseTitleEdits((prev) => {
                  const next = { ...prev };
                  delete next[id];
                  return next;
                });
                if (editingClause === id) {
                  setEditingClause(null);
                  setClauseDraft("");
                  setCustomClauseTitleDraft("");
                }
              };

              return (
                <div className="space-y-8">
                  <FirstPagePreview data={validatedPreview} profile={profile}>
                    <div className="text-xs leading-relaxed space-y-5">
                          {(() => {
                            let clauseNumber = 1;
                            const renderAddClauseControl = (afterId: string | null) => {
                          if (afterId === "introduction" || afterId === "entire-agreement-and-acknoweldgement") return null;
                              const isFormOpen = addingAfter === afterId && addingAfter !== undefined;
                              return (
                                <div key={`add-${afterId ?? "start"}`} className="flex justify-center py-2 px-3">
                                  {isFormOpen ? (
                                    <div className="w-full rounded-md bg-slate-50/60 p-4">
                                      <div className="grid gap-3">
                                        <div className="grid gap-1 text-left">
                                          <Label className="text-xs">Amendment type</Label>
                                          <Select
                                            value={newClauseAmendmentType}
                                            onValueChange={(value) => setNewClauseAmendmentType(value as AmendmentType)}
                                          >
                                            <SelectTrigger
                                              className={`${getAddendumModalSelectTriggerClass(Boolean(newClauseAmendmentType))} ${addendumModalDropdownToneClass}`}
                                            >
                                              <SelectValue placeholder="Please Select amendment type" />
                                            </SelectTrigger>
                                            <SelectContent className="w-[var(--radix-select-trigger-width)] text-xs">
                                              <SelectItem className={addendumModalSelectItemClass} value="add">
                                                Add new term(s)
                                              </SelectItem>
                                              <SelectItem className={addendumModalSelectItemClass} value="amend">
                                                Amend existing term(s)
                                              </SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        {newClauseAmendmentType ? (
                                          <>
                                            <Input
                                              value={newClauseTitle}
                                              onChange={(e) => setNewClauseTitle(e.target.value)}
                                              placeholder="Clause title"
                                              onFocus={(e) => rememberClauseFieldFocus(e.currentTarget)}
                                              onClick={rememberPreviewScroll}
                                              className={getAddendumModalInputClass(newClauseTitle.trim().length > 0)}
                                            />
                                            <Textarea
                                              value={newClauseBody}
                                              onChange={(e) => setNewClauseBody(e.target.value)}
                                              rows={4}
                                              className="rounded text-xs text-slate-600 border-slate-300 hover:border-blue-400 focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0"
                                              placeholder="Clause body. Separate paragraphs with a blank line."
                                              spellCheck={true}
                                              lang="en"
                                              autoCorrect="on"
                                              onFocus={(e) => rememberClauseFieldFocus(e.currentTarget)}
                                              onClick={rememberPreviewScroll}
                                            />
                                          </>
                                        ) : null}
                                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                                          <span>Paragraph numbering updates automatically.</span>
                                          <div className="flex items-center gap-2">
                                            <Button
                                              size="sm"
                                              className="h-[28px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700 disabled:bg-slate-300"
                                              onClick={saveNewClause}
                                              disabled={
                                                !newClauseAmendmentType ||
                                                !newClauseTitle.trim() ||
                                                !newClauseBody.trim()
                                              }
                                            >
                                              Add clause
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-[28px] rounded border-blue-600 px-3 text-xs text-blue-600 hover:bg-transparent hover:text-blue-600"
                                              onClick={cancelAddClause}
                                            >
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

                            return [
                              <div key="clause-divider" className="my-4 border-t border-slate-200" aria-hidden="true" />,
                              ...clausesWithEdits.flatMap((clause) => {
                              const paragraphs = Array.isArray(clause.body) ? clause.body : [clause.body];
                              const preface =
        clause.amendmentType === "add"
          ? "The following term(s) will be added to the employment contract:"
          : clause.amendmentType === "amend"
            ? "The terms of the clause is hereby amended as follows:"
            : null;
                              const isEditing = editingClause === clause.id;
                              const isEdited = Boolean(clauseEdits[clause.id]);
                              const isCustomClause = customClauses.some((custom) => custom.id === clause.id);
                              return [
                                <div key={clause.id} className="space-y-2 rounded-md p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <h3 className="font-semibold text-black">{clause.title}</h3>
                                      {isCustomClause ? (
                                        <span
                                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                            clause.amendmentType === "amend"
                                              ? "bg-blue-50 text-blue-700"
                                              : clause.amendmentType === "add"
                                                ? "bg-green-50 text-green-600"
                                                : "bg-blue-50 text-blue-700"
                                          }`}
                                        >
                                          {clause.amendmentType === "amend"
                                            ? "Amended Existing Term(s)"
                                            : clause.amendmentType === "add"
                                              ? "Added New Term(s)"
                                              : "Custom"}
                                        </span>
                                      ) : null}
                                      {isEdited ? (
                                        <span className="rounded-full bg-[#04b81f]/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#04b81f]">
                                          Edited
                                        </span>
                                      ) : null}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {isEditing ? (
                                        <>
                                          <Button
                                            size="sm"
                                            className="h-[28px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700 disabled:bg-slate-300"
                                            onClick={() => saveClauseEdit(clause.id)}
                                          >
                                            Save
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-[28px] rounded border-blue-600 px-3 text-xs text-blue-600 hover:bg-transparent hover:text-blue-600"
                                            onClick={() => {
                                              setEditingClause(null);
                                              setClauseDraft("");
                                              setCustomClauseTitleDraft("");
                                            }}
                                          >
                                            Cancel
                                          </Button>
                                          {isEdited ? (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-[28px] rounded border-blue-600 px-3 text-xs text-blue-600 hover:bg-transparent hover:text-blue-600"
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
                                            className="h-[28px] rounded border-slate-300 px-3 text-xs text-slate-500 hover:border-blue-600 hover:bg-transparent hover:text-blue-600"
                                            onClick={() => startEditingClause(clause)}
                                          >
                                            Edit
                                          </Button>
                                          {isCustomClause ? (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-[28px] rounded border-red-500 px-3 text-xs text-red-600 hover:bg-transparent hover:text-red-700"
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
                                      {isCustomClause ? (
                                        <Input
                                          value={customClauseTitleDraft}
                                          onChange={(e) => setCustomClauseTitleDraft(e.target.value)}
                                          placeholder="Clause title"
                                          className={getAddendumModalInputClass(customClauseTitleDraft.trim().length > 0)}
                                          onFocus={(e) => rememberClauseFieldFocus(e.currentTarget)}
                                          onClick={rememberPreviewScroll}
                                        />
                                      ) : null}
                                      <p className="flex items-center gap-1 text-[11px] text-orange-600">
                                        <Info className="h-3.5 w-3.5" aria-hidden="true" />
                                        Separate paragraphs with a blank line. Paragraph numbering updates automatically.
                                      </p>
                                      <Textarea
                                        value={clauseDraft}
                                        onChange={(e) => setClauseDraft(e.target.value)}
                                        rows={6}
                                        className="rounded text-xs text-slate-600 border-slate-300 hover:border-blue-400 focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0"
                                        spellCheck={true}
                                        lang="en"
                                        autoCorrect="on"
                                        onFocus={(e) => rememberClauseFieldFocus(e.currentTarget)}
                                        onClick={rememberPreviewScroll}
                                      />
                                    </div>
                                  ) : null}

                                  <div className="space-y-1">
                                    {preface ? (
                                      <p className="text-justify whitespace-pre-line text-black font-semibold">{preface}</p>
                                    ) : null}
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
                            }),
                            ];
                          })()}

                      {validatedPreview.additionalNotes && (
                        <div className="space-y-1">
                          <h3 className="font-semibold text-black">Additional notes</h3>
                          <p className="whitespace-pre-wrap">{validatedPreview.additionalNotes}</p>
                        </div>
                      )}

                      <div>
                        <p className="font-semibold text-black mb-1">Signing</p>
                        <p>
                          Done and Signed at ________________________________________ on this _____ day of ______________________________{" "}
                          {extractYear(validatedPreview.issueDate)}.
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
                </FirstPagePreview>
              </div>
            );
          })() : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">Complete the form to preview the contract.</p>
              </div>
            )}
          </ScrollArea>
                {!useExternalShell ? (
                  <div className="flex w-full items-center justify-end gap-2">
                    <div className="flex-none">
                      <Button
                        type="button"
                        onClick={handleDownload}
                        disabled={isGenerating}
                        className="h-[28px] w-[84px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700 disabled:bg-slate-300"
                      >
                        Download
                      </Button>
                    </div>
                  </div>
                ) : null}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );

  return embedded ? content : <DashboardLayout>{content}</DashboardLayout>;
};

export default AddendumGenerator;




