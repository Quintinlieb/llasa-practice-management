import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Download, FileText, ArrowLeft, ArrowRight, Building2, User2, Briefcase, Check, Undo2, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
import {
  permanentContractSchema,
  salaryFrequencyOptions,
  nationalityOptions,
  genderOptions,
  raceOptions,
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
};

type ClauseDefinition = {
  title: string;
  body: string | string[];
};

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

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", minimumFractionDigits: 2 }).format(amount);

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });
};

const extractYear = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 4) : String(date.getFullYear());
};

const deriveAgeFromId = (id: string) => {
  const dob = extractDobFromId(id);
  if (!dob) return "";
  return String(calculateAgeFromDob(dob));
};

const PermanentContractGenerator = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [employees, setEmployees] = useState<Tables<"employees">[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showFinalActions, setShowFinalActions] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [validatedPreview, setValidatedPreview] = useState<PermanentContractFormData | null>(null);
  const [clauseEdits, setClauseEdits] = useState<Record<string, string>>({});
  const [editingClause, setEditingClause] = useState<string | null>(null);
  const [clauseDraft, setClauseDraft] = useState("");
  const steps = ["Employer Details", "Employee Details", "Employment Details"] as const;
  const [activeStep, setActiveStep] = useState(0);
  const [showEmployeeHint, setShowEmployeeHint] = useState(false);
  const [hasDismissedEmployeeHint, setHasDismissedEmployeeHint] = useState(false);
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

  const [formData, setFormData] = useState<ContractFormState>({
    employeeId: "",
    age: "",
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

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    if (hasDismissedEmployeeHint) return;
    const timer = setTimeout(() => setShowEmployeeHint(true), 1000);
    return () => clearTimeout(timer);
  }, [hasDismissedEmployeeHint]);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) {
      console.warn("Unable to load profile", error);
      return;
    }
    if (data) setProfile(data);
  }, [user]);

  const fetchEmployees = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from("employees").select("*").eq("company_id", user.id);
    if (error) {
      console.warn("Unable to load employees", error);
      return;
    }
    if (data) setEmployees(data);
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

  const handleNationalityChange = (value: PermanentContractFormData["nationality"]) => {
    setFormData((prev) => ({
      ...prev,
      nationality: value,
      // Clear ID/age when switching away from SA; clear passport when switching to SA
      employeeIdNumber: value === "South African" ? prev.employeeIdNumber : "",
      passportNumber: value === "South African" ? "" : prev.passportNumber,
      age: value === "South African" ? deriveAgeFromId(prev.employeeIdNumber) : "",
    }));
  };

  const handleEmployeeSelect = (employeeId: string) => {
    const employee = employees.find((emp) => emp.id === employeeId);
    if (!employee) return;
    const employeeNationality =
      (employee as Partial<Tables<"employees">> & { nationality?: PermanentContractFormData["nationality"] })
        .nationality || "South African";
    const passportNumber = (employee as Partial<Tables<"employees">> & { passport_number?: string }).passport_number ?? "";
    const emergencyContact =
      (employee as Partial<Tables<"employees">> & { emergency_contact_number?: string }).emergency_contact_number ?? "";
    const genderValue = (employee as Partial<Tables<"employees">> & { gender?: PermanentContractFormData["gender"] }).gender || "";
    const raceValue = (employee as Partial<Tables<"employees">> & { race?: PermanentContractFormData["race"] }).race || "";
    const cellNumber = (employee as Partial<Tables<"employees">> & { cell_number?: string }).cell_number ?? "";
    const emailAddress = (employee as Partial<Tables<"employees">> & { email?: string }).email ?? "";
    const jobTitle = (employee as Partial<Tables<"employees">> & { job_title?: string }).job_title ?? "";
    const startDate = (employee as Partial<Tables<"employees">> & { start_date?: string }).start_date ?? "";
    const employeeNumber = (employee as Partial<Tables<"employees">> & { employee_number?: string }).employee_number ?? "";
    const ageFromId = employeeNationality === "South African" ? deriveAgeFromId(employee.id_number ?? "") : "";

    setFormData((prev) => ({
      ...prev,
      employeeId,
      employeeName: employee.employee_name,
      employeeSurname: employee.employee_surname,
      employeeIdNumber: employee.id_number ?? "",
      passportNumber,
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
    }));
  };

  const resetForm = () => {
    setFormData({
      employeeId: "",
      age: "",
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
    setValidatedPreview(null);
    setShowPreview(false);
    setShowFinalActions(false);
    setActiveStep(0);
  };

  useEffect(() => {
    if (formData.nationality === "South African") {
      const derived = formData.employeeIdNumber.length === 13 ? deriveAgeFromId(formData.employeeIdNumber) : "";
      setFormData((prev) => (derived !== prev.age ? { ...prev, age: derived } : prev));
    }
  }, [formData.employeeIdNumber, formData.nationality]);

  const isEmployerStepComplete = useMemo(
    () => Boolean(formData.employerContact && formData.employerEmail),
    [formData.employerContact, formData.employerEmail],
  );

  const isEmployeeStepComplete = useMemo(
    () =>
      Boolean(
        formData.employeeName &&
          formData.employeeSurname &&
          formData.employeeAddress &&
          formData.employeePostalAddress &&
          formData.nationality &&
          formData.gender &&
          formData.race &&
          ((formData.nationality === "South African" && formData.employeeIdNumber) ||
            (formData.nationality !== "South African" && formData.passportNumber)) &&
          formData.employeeCell,
      ),
    [
      formData.employeeName,
      formData.employeeSurname,
      formData.employeeAddress,
      formData.employeePostalAddress,
      formData.nationality,
      formData.gender,
      formData.race,
      formData.employeeIdNumber,
      formData.passportNumber,
      formData.employeeCell,
    ],
  );

  const isEmploymentStepComplete = useMemo(
    () =>
      Boolean(
        formData.startDate &&
          formData.issueDate &&
          formData.jobTitle &&
          formData.reportsTo &&
          formData.salaryAmount &&
          formData.salaryFrequency &&
          formData.annualLeaveDays &&
          formData.probationPeriod &&
          formData.retirementAge &&
          formData.workplace &&
          formData.interpreter,
      ),
    [
      formData.startDate,
      formData.issueDate,
      formData.jobTitle,
      formData.reportsTo,
      formData.salaryAmount,
      formData.annualLeaveDays,
      formData.salaryFrequency,
      formData.probationPeriod,
      formData.retirementAge,
      formData.workplace,
      formData.interpreter,
    ],
  );

  const isFormComplete = useMemo(
    () => isEmployerStepComplete && isEmployeeStepComplete && isEmploymentStepComplete,
    [isEmployerStepComplete, isEmployeeStepComplete, isEmploymentStepComplete],
  );

  const derivedAgeDisplay = useMemo(
    () => (formData.nationality === "South African" ? deriveAgeFromId(formData.employeeIdNumber) : formData.age),
    [formData.age, formData.employeeIdNumber, formData.nationality],
  );

  const isIdDateInvalid = useMemo(
    () =>
      formData.nationality === "South African" &&
      formData.employeeIdNumber.length === 13 &&
      !extractDobFromId(formData.employeeIdNumber),
    [formData.employeeIdNumber, formData.nationality],
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
        setHasDismissedEmployeeHint(true);
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
        setHasDismissedEmployeeHint(true);
        if (showEmployeeHint) {
          setShowEmployeeHint(false);
        }
      }
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1);
    }
  };

  const validateData = () =>
    permanentContractSchema.parse({
      ...formData,
      salaryAmount: formData.salaryAmount,
      annualLeaveDays: formData.annualLeaveDays,
    });

  const serializeClauseBody = (body: string | string[]) => (Array.isArray(body) ? body.join("\n\n") : body);

  const applyClauseEdits = (clauses: ClauseDefinition[]): ClauseDefinition[] =>
    clauses.map((clause) => {
      const edited = clauseEdits[clause.title];
      if (!edited) return clause;
      const paragraphs = edited.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
      return { ...clause, body: paragraphs.length ? paragraphs : edited };
    });

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

  const FirstPagePreview = ({ data, compact = false }: { data: PermanentContractFormData; compact?: boolean }) => {
    const displayValue = (value?: string | number | null) => (value && value.toString().trim() ? value.toString() : "________________________");
    const salaryDisplay = `${formatCurrency(data.salaryAmount)} ${salaryFrequencyLabels[data.salaryFrequency]}`;
    const workplace = data.workplace || profile?.physical_address || "";
    const isSouthAfrican = data.nationality === "South African";
    const derivedAge = isSouthAfrican ? deriveAgeFromId(data.employeeIdNumber) : "";
    const idDisplay = isSouthAfrican ? data.employeeIdNumber : "--";
    const passportDisplay = isSouthAfrican ? "--" : data.passportNumber || "--";

    const SectionHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
      <div className="bg-slate-100 border border-slate-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-700 flex items-center">
        <span>{title}</span>
        {subtitle ? <span className="ml-2 italic normal-case font-medium text-gray-600">{subtitle}</span> : null}
      </div>
    );

    const SingleRow = ({ label, value }: { label: string; value?: string | number | null }) => (
      <div className="grid grid-cols-[120px_1fr] gap-2 border-b border-slate-200 py-2 px-3 text-[11px]">
        <span className="font-semibold italic uppercase text-gray-700">{label}:</span>
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

    return (
      <div
        className="bg-white text-black p-8 mx-auto border border-slate-200 shadow-sm flex flex-col"
        style={{ width: "210mm", minHeight: compact ? undefined : "297mm" }}
      >
        <h1 className="text-xl font-bold text-center text-gray-900 mb-6 uppercase tracking-wide">Employment Contract</h1>

        <div className="space-y-6 flex-1">
          <div>
            <SectionHeader title="A. Employer details" subtitle='(Hereinafter referred to as "The Employer")' />
            <div className="border border-slate-200 border-t-0">
              <SingleRow label="Company name" value={profile?.company_name} />
              <SingleRow label="Reg. number" value={profile?.registration_number} />
              <SingleRow label="Address" value={profile?.physical_address} />
              <SingleRow label="Email" value={profile?.company_email} />
              <SingleRow label="Contact" value={profile?.company_contact} />
            </div>
          </div>

          <div>
            <SectionHeader title="B. Employee details" subtitle='(Hereinafter referred to as "the Employee")' />
            <div className="border border-slate-200 border-t-0">
              <DualRow leftLabel="Surname" leftValue={data.employeeSurname} rightLabel="Name(s)" rightValue={data.employeeName} />
              <DualRow leftLabel="ID no." leftValue={idDisplay} rightLabel="Passport no." rightValue={passportDisplay} />
              <DualRow leftLabel="Age" leftValue={derivedAge} rightLabel="Nationality" rightValue={data.nationality} />
              <DualRow leftLabel="Race" leftValue={data.race} rightLabel="Gender" rightValue={data.gender} />
              <DualRow leftLabel="Cell number" leftValue={data.employeeCell} rightLabel="Email" rightValue={data.employeeEmail || "--"} />
              <DualRow leftLabel="Alt. contact" leftValue={data.alternativeContact || "--"} rightLabel="Employee no." rightValue={data.employeeNumber} />
              <SingleRow label="Address" value={data.employeeAddress} />
              <SingleRow label="Postal" value={data.employeePostalAddress} />
            </div>
          </div>

          <div>
            <SectionHeader title="C. Employment details" />
            <div className="border border-slate-200 border-t-0">
              <DualRow leftLabel="Type" leftValue="Permanent" rightLabel="Start date" rightValue={formatDate(data.startDate)} />
              <DualRow leftLabel="Duration" leftValue="Indefinite" rightLabel="Probation" rightValue={probationLabels[data.probationPeriod]} />
              <DualRow leftLabel="Job title" leftValue={data.jobTitle} rightLabel="Department" rightValue={data.department} />
              <DualRow leftLabel="Gross salary" leftValue={salaryDisplay} rightLabel="Retirement" rightValue={data.retirementAge ? `Age ${data.retirementAge}` : ""} />
              <DualRow leftLabel="Reports to" leftValue={data.reportsTo} rightLabel="Interpreter" rightValue={data.interpreter === "yes" ? "Yes" : "No"} />
              <SingleRow label="Workplace" value={workplace} />
            </div>
          </div>
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

  const generatePDF = (data: PermanentContractFormData, download = false) => {
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
      ensureSpace(16);
      const boxTop = y;
      doc.setFillColor(237, 242, 247);
      doc.setDrawColor(206, 212, 218);
      doc.rect(margin, y, contentWidth, 10, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(45, 55, 72);
      doc.text(title.toUpperCase(), margin + 3, y + 7);
      if (subtitle) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.text(subtitle, margin + contentWidth - 3, y + 7, { align: "right" });
      }
      y += 12;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      renderContent();
      const boxHeight = y - boxTop;
      doc.setDrawColor(224, 231, 235);
      doc.rect(margin, boxTop, contentWidth, boxHeight, "S");
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
      doc.setFontSize(9);
      doc.setTextColor(55, 65, 81);
      doc.text(`${label.toUpperCase()}:`, margin + 3, y + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      lines.forEach((line, idx) => {
        doc.text(line, margin + labelWidth, y + 6 + idx * lineHeight);
      });

      doc.setDrawColor(224, 231, 235);
      doc.setLineWidth(0.3);
      doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

      y += rowHeight;
    };

    const drawDualRow = (
      leftLabel: string,
      leftValue: string | number | null,
      rightLabel: string,
      rightValue: string | number | null,
      valueFontSize = 10,
    ) => {
      const columnWidth = (contentWidth - 8) / 2;
      const labelWidth = 42;
      const availableWidth = columnWidth - labelWidth - 6;
      const lineHeight = 5.5;
      const leftLines = doc.splitTextToSize(valueOrLine(leftValue), availableWidth);
      const rightLines = doc.splitTextToSize(valueOrLine(rightValue), availableWidth);
      const rowHeight = Math.max(leftLines.length, rightLines.length) * lineHeight + 3;

      ensureSpace(rowHeight);

      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(55, 65, 81);
      doc.text(`${leftLabel.toUpperCase()}:`, margin + 3, y + 6);
      doc.text(`${rightLabel.toUpperCase()}:`, margin + columnWidth + 8 + 3, y + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(valueFontSize);
      doc.setTextColor(0, 0, 0);
      leftLines.forEach((line, idx) => {
        doc.text(line, margin + labelWidth, y + 6 + idx * lineHeight);
      });
      rightLines.forEach((line, idx) => {
        doc.text(line, margin + columnWidth + 8 + labelWidth, y + 6 + idx * lineHeight);
      });

      doc.setDrawColor(224, 231, 235);
      doc.setLineWidth(0.3);
      doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

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
      const availableWidth = columnWidth - labelWidth - 6;
      const lineHeight = 5.5;

      let suffixSize = 8;
      let suffixDisplay = suffixText;

      const fits = (size: number, suffix: string) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const amountWidth = doc.getTextWidth(amountText);
        doc.setFontSize(size);
        const suffixWidth = doc.getTextWidth(` ${suffix}`);
        return amountWidth + suffixWidth <= availableWidth;
      };

      while (!fits(suffixSize, suffixDisplay) && suffixSize > 6) {
        suffixSize -= 0.5;
      }
      if (!fits(suffixSize, suffixDisplay)) {
        suffixDisplay = suffixText.replace("per ", "/");
      }

      const rightLines = doc.splitTextToSize(valueOrLine(rightValue), availableWidth);
      const rowHeight = lineHeight + 3;

      ensureSpace(rowHeight);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(55, 65, 81);
      doc.text(`${leftLabel.toUpperCase()}:`, margin + 3, y + 6);
      doc.text(`${rightLabel.toUpperCase()}:`, margin + columnWidth + 8 + 3, y + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      const amountX = margin + labelWidth;
      doc.text(amountText, amountX, y + 6);
      doc.setFontSize(suffixSize);
      doc.text(` ${suffixDisplay}`, amountX + doc.getTextWidth(amountText) + 4, y + 6);

      doc.setFontSize(10);
      rightLines.forEach((line, idx) => {
        doc.text(line, margin + columnWidth + 8 + labelWidth, y + 6 + idx * lineHeight);
      });

      doc.setDrawColor(224, 231, 235);
      doc.setLineWidth(0.3);
      doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

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
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(title.toUpperCase(), margin, y);
      y += headingHeight;
      doc.setFont("helvetica", "normal");
    };

    const addInformationPage = () => {
      const isSouthAfrican = data.nationality === "South African";
      const idDisplay = isSouthAfrican ? data.employeeIdNumber : "--";
      const passportDisplay = isSouthAfrican ? "--" : data.passportNumber || "";
      const derivedAge = isSouthAfrican ? deriveAgeFromId(data.employeeIdNumber) : "";

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text("EMPLOYMENT CONTRACT", pageWidth / 2, y, { align: "center" });
      y += 12;

      drawSection("A. Employer details", '(Hereinafter referred to as "The Employer")', () => {
        drawSingleRow("Company name", profile?.company_name);
        drawSingleRow("Reg. number", profile?.registration_number);
        drawSingleRow("Address", profile?.physical_address);
        drawSingleRow("Email", profile?.company_email);
        drawSingleRow("Contact", profile?.company_contact);
      });

      drawSection("B. Employee details", '(Hereinafter referred to as "the Employee")', () => {
        drawDualRow("Surname", data.employeeSurname, "Name(s)", data.employeeName);
        drawDualRow("ID No.", idDisplay, "Passport No.", passportDisplay || "--");
        drawDualRow("Age", derivedAge, "Nationality", data.nationality);
        drawDualRow("Race", data.race, "Gender", data.gender);
        drawDualRow("Cell number", data.employeeCell, "Email", data.employeeEmail || "--");
        drawDualRow("Alt. contact", data.alternativeContact || "--", "Employee No.", data.employeeNumber);
        drawSingleRow("Address", data.employeeAddress);
        drawSingleRow("Postal", data.employeePostalAddress);
      });

      drawSection("C. Employment details", undefined, () => {
        drawDualRow("Type", "Permanent", "Start date", formatDate(data.startDate));
        drawDualRow("Duration", "Indefinite", "Probation", probationLabels[data.probationPeriod]);
        drawDualRow("Job title", data.jobTitle, "Department", data.department || "");
        drawDualRowWithMixedLeft(
          "Gross salary",
          formatCurrency(data.salaryAmount),
          salaryFrequencyLabels[data.salaryFrequency],
          "Retirement",
          data.retirementAge ? `Age ${data.retirementAge}` : "",
        );
        drawDualRow("Reports to", data.reportsTo, "Interpreter", data.interpreter === "yes" ? "Yes" : "No");
        drawSingleRow("Workplace", data.workplace || profile?.physical_address || "");
      });

      doc.addPage();
      y = margin;
    };

    addInformationPage();

    const annualLeaveText = `The Employee is entitled to ${data.annualLeaveDays} days' annual leave per leave cycle. Leave shall be taken at times determined by the Employer, subject to operational requirements. Unused leave will be forfeited if not taken within the applicable cycle.`;

    const clauses: ClauseDefinition[] = [
      {
        title: "Introduction",
        body: "This employment agreement is entered into between the Employer and the Employee willingly and voluntarily.  The Employee hereby agrees that he/she has been granted the opportunity to peruse and discuss the contract with his/her council and that he/she understands the content that follows.",
      },
      {
        title: "Recordal",
        body:
          "The Employer appoints the Employee in a permanent capacity, which the Employee accepts on the terms of this agreement. This agreement records the essential conditions of employment, including duties, remuneration, working hours, leave, and termination, and constitutes the entire understanding between the parties, replacing any prior verbal or written arrangements unless expressly stated otherwise. The employment relationship is governed by this agreement and all applicable labour laws of South Africa.",
      },
      {
        title: "Probation",
        body:
          "The Employee is appointed subject to a probationary period commencing on the Start Date, during which the Employer will assess the Employee’s performance, conduct, skills, and suitability for the position. If the required standards are not met, the Employer may terminate the employment in accordance with labour law. Successful completion of probation does not guarantee continued employment, and confirmation of permanent employment remains at the Employer’s discretion.",
      },
      {
        title: "Performance and adaptability",
        body: [
          "The Employee shall diligently perform all duties associated with the position and comply with all reasonable and lawful instructions issued by the Employer or its authorised representatives. The Employee confirms that he/she has the necessary skills, qualifications, and experience to perform the required duties to the Employer’s satisfaction.",
          "The Employee acknowledges that the Employer may assign additional or alternative duties within the Employee’s reasonable skills or capabilities, and refusal to perform such duties may constitute insubordination. If the work described in the Employee’s job description becomes unavailable, the Employee agrees to perform suitable alternative work without loss of remuneration, although this does not create a right to continued employment. Should no suitable alternative work exist, the Employer may initiate retrenchment processes in accordance with applicable labour laws.",
        ],
      },
      {
        title: "Guarantee",
        body:
          "The Employee warrants that all information, documentation, and credentials submitted to the Employer are true and accurate. If any submission is found to be false, fraudulent, or misleading, the Employer may institute disciplinary action for dishonesty, which may result in summary termination of employment.",
      },
      {
        title: "Remuneration",
        body: [
          "The Employee shall receive the Gross Salary, which shall comply with all applicable legislation.  Unauthorised or unapproved absence from work shall result in no payment for the period of absence.",
          "Any future salary increases shall be considered at the Employer’s discretion, taking into account the Employee’s performance and the Employer’s financial position in the preceding financial year. No expectation of an increase is created by this clause, and the granting of any increase remains entirely discretionary.",
          "The Employee will be remunerated at two times the normal wage for work performed on a public holiday.",
        ],
      },
      {
        title: "Deductions",
        body:
          "The Employee consents to all lawful and statutory deductions from remuneration, including PAYE, UIF, and any voluntary benefits or contributions agreed to by the parties. The Employee further agrees that the Employer may deduct any amount lawfully owed to it, including losses, damages, cash or stock shortages resulting from the Employee’s negligence, misconduct, or dishonesty, provided such deductions comply with applicable labour laws and are properly recorded and communicated.",
      },
      {
        title: "Hours of work",
        body:
          "The Employee’s ordinary working hours shall not exceed forty-five (45) hours per week. The Employee shall be entitled to a daily unpaid lunch break of one (1) hour, taken at the time agreed between the parties.",
      },
      {
        title: "Overtime",
        body:
          "The Employee may be required to work overtime, subject to the limits set by the BCEA. Reasonable notice of overtime will be given, except in emergencies where short-notice overtime may be required. Overtime shall be remunerated in accordance with applicable legislation; however, employees earning above the Ministerial earnings threshold and employees classified as top management are not entitled to overtime pay.",
      },
      {
        title: "Retirement",
        body:
          "The Employee shall retire at the age recorded in page 1 of this agreement, unless otherwise agreed in writing. If the Employee continues working beyond the agreed retirement age, the Employer may terminate the employment contract on the basis of retirement by giving at least one (1) month’s written notice, and no further consultation shall be required.",
      },
      {
        title: "Exclusivity of employment",
        body: "The Employee shall not undertake any outside work or business activity without the Employer’s prior written consent.",
      },
      {
        title: "Annual bonus",
        body: [
          "Any annual bonus is ex-gratia and granted entirely at the Employer’s discretion, subject to the Employer’s financial position and the Employee’s conduct and performance. No entitlement or expectation of a bonus is created, regardless of whether bonuses were granted in previous years, and the Employer may withhold a bonus at any time.",
          "The Employee agrees that no pro-rata bonus shall be payable in the event of termination of employment for any reason.",
        ],
      },
      {
        title: "Termination of employment",
        body: [
          "Either party may terminate the employment relationship by giving written notice in accordance with the BCEA. The Employer may, at its discretion, make payment in lieu of notice when terminating the Employee’s services.",
          "The Employer reserves the right to summarily dismiss the Employee for gross misconduct, following a fair disciplinary process and in accordance with the principles of substantive and procedural fairness.",
        ],
      },
      {
        title: "Annual leave",
        body: [
          annualLeaveText,
          "The Employee agrees to take annual leave during any annual shutdown period implemented by the Employer. Any additional leave taken during the cycle will be deducted from the Employee's leave entitlement.",
        ],
      },
      {
        title: "Sick leave",
        body: [
          "The Employee is entitled to sick leave in accordance with the BCEA. The Employee must provide a valid medical certificate when required by law or by the Employer.",
          "In cases of prolonged or recurring illness, the Employer may initiate a fair incapacity process in line with applicable labour legislation, which may result in termination of employment where the Employee is unable to perform the inherent requirements of the job.",
          "The Employee must submit a valid medical certificate issued and signed by a registered medical practitioner or any person certified to diagnose and treat patients and registered with a recognised professional council.",
          "Clinic or hospital attendance notes that merely confirm a visit, and do not expressly declare the Employee unfit for duty for a specific period, shall also not be accepted as proof of sickness.",
        ],
      },
      {
        title: "Parental leave",
        body: [
          "Where both parents are employed, they are jointly entitled to a combined period of four months and ten days of parental leave, which may be shared between them as they agree. The leave may be taken at the same time or one after the other. If the parents cannot agree on the division of leave, it shall be shared equally.",
          "Where the Employee is a single parent or where only one parent is employed, that parent is entitled to four consecutive months of parental leave.",
          "A pregnant Employee may commence parental leave at any time from four weeks before the expected date of birth, or earlier if medically required, and may not return to work within six weeks after giving birth unless declared fit for duty by a medical practitioner or midwife.",
          "Adoptive and commissioning parents are entitled to parental leave on the same basis as biological parents, subject to the statutory notice requirements.",
          "The Employee must notify the Employer in writing of the intended parental leave dates and return date at least four weeks before the start of the leave.",
          "Parental leave under this agreement is unpaid and the Employee must claim any available benefits from the Unemployment Insurance Fund.",
        ],
      },
      {
        title: "Family responsibility leave",
        body: [
          "An Employee who has completed four months of continuous employment and who works at least four days per week is entitled to three days of paid family responsibility leave per annual leave cycle. This leave may be taken for the illness of the Employee’s child, or in the event of the death of the Employee’s spouse or life partner, parent or adoptive parent, grandparent, child or adopted child, grandchild, or sibling.",
          "The Employee must notify the Employer as soon as reasonably possible if family responsibility leave is required. Where the leave relates to a funeral, the Employee must, where practicable, give at least four days’ prior notice.",
          "The Employer may request reasonable proof of the reason for leave, including a medical certificate for a child’s illness, a death certificate or other acceptable proof in cases of bereavement, and proof of the Employee’s relationship to the deceased.",
          "Failure to provide notice or proof when requested may result in the leave not being approved and treated as unpaid leave. Family responsibility leave does not accumulate, may not be carried over, and lapses at the end of each annual leave cycle.",
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
        title: "Protection of personal information",
        body: [
          "The Employee consents to the collection, use and storage of Personal Information and Special Personal Information, as defined in POPIA, for purposes related to the employment relationship. This includes payroll and benefit administration, statutory reporting, security and access control, monitoring for operational and risk-management purposes, internal and external communication, and compliance with legal and contractual obligations.",
          "The Employee consents to the sharing or transfer of Personal Information, where necessary, to third party service providers such as benefit administrators and insurers, to clients or service providers for operational purposes, and to secure cloud-based or foreign storage platforms that offer adequate data protection in accordance with POPIA.",
          "The Employee warrants that all Personal Information supplied is accurate and undertakes to update the Employer if any information changes. The Employee agrees to comply with the Employer’s POPIA policies and acknowledges that failure to do so may result in disciplinary action.",
        ],
      },
      {
        title: "Rules and regulations",
        body: [
          "The Employee agrees to comply with all rules, policies, procedures and regulations of the Employer, whether communicated in writing, verbally, or arising by reasonable implication from the nature of the workplace and the duties performed.",
          "The Employee must immediately inform the Employer of any offence, misconduct or breach of company rules committed by himself or herself, or by any other Employee, as soon as he or she becomes aware of it or reasonably ought to have become aware of it.",
          "Failure to disclose such information shall be regarded as dishonesty and a breach of trust, and may result in disciplinary action, including possible dismissal.",
        ],
      },
      {
        title: "Industrial action",
        body: [
          "The Employee may not participate in any unprotected strike, stoppage, or form of industrial action. No strike or picket may be undertaken unless it is protected in terms of the Labour Relations Act and preceded by the required certificate to strike and authorisation to picket.",
          "The Employee acknowledges and agrees that he/she shall be held liable for any damages to property, financial losses, or other harm suffered by the Employer as a result of his/her involvement in any legal or illegal industrial action, whether directly or indirectly.",
        ],
      },
      {
        title: "Health and fitness",
        body: [
          "The Employee confirms that he or she is medically fit to perform the duties of the position. Should the Employee become unable to perform these duties for health reasons, the Employer may follow the applicable incapacity procedures prescribed by the Labour Relations Act, which may result in termination of employment.",
          "The Employer may require the Employee to undergo a medical assessment, at the Employer’s cost, to determine fitness for duty. Unreasonable refusal to attend such an assessment may result in disciplinary action.",
        ],
      },
      {
        title: "Change of status",
        body: [
          "The Employee must promptly notify the Employer in writing of any change to his or her personal details as recorded in this agreement, and in any event within seven days of such change, so that the Employer’s records remain accurate and up to date.",
          "The Employee cannot hold the Employer liable for making use of incorrect details if the Employee breaches this clause.",
        ],
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
        body: [
          "The Employee agrees that the Employer may implement a temporary lay off when necessary. Where reasonably possible, the Employer will provide at least one day’s notice, stating the reason and expected duration. The Employee acknowledges that no remuneration is payable during a temporary lay off.",
          "Temporary lay offs may be introduced due to circumstances beyond the Employer’s control, including adverse weather, shortages of material or a temporary shortage of work. A temporary lay off in terms of this clause does not constitute a unilateral change to conditions of employment, nor shall it be regarded as a dismissal, retrenchment or breach of contract.",
        ],
      },
      {
        title: "Proof of citizenship",
        body: [
          "The Employee must provide proof of South African citizenship upon commencement of employment. If not a South African citizen, the Employee must submit a valid work permit or proof of permanent residency within seven days of request, and must continue to provide updated documentation whenever required.",
          "It is the Employee’s sole responsibility to ensure that any work permit remains valid for the full duration of employment. The Employee agrees that failure to maintain a valid permit or to provide updated proof when required will result in immediate termination of employment.",
        ],
      },
      {
        title: "Confidentiality",
        body:
          "The Employee shall keep all confidential information, trade secrets, client data and business affairs of the Employer strictly confidential and shall not disclose or use such information for any purpose other than the performance of his or her duties.",
      },
      {
        title: "Entire Agreement and Acknoweldgement",
        body: [
          "This agreement constitutes the entire agreement between the parties, and no variation, amendment or addition shall be valid unless reduced to writing and signed by both parties. Any indulgence or leniency granted shall not constitute a waiver of rights.",
          "By signing this agreement, both parties acknowledge that they have read and understood its contents and agree to be bound by its terms. The Employee confirms that the conditions of employment have been explained where necessary and that he or she voluntarily accepts them.",
          "The Employee acknowledges that all terms and conditions of employment are contained in this agreement, and any matters not specifically addressed shall be governed by the Employer’s rules and procedures. Where this agreement and the Employer’s policies are silent, the provisions of the Basic Conditions of Employment Act shall apply.",
        ],
      },
    ];

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

    // Place signing line on the page above the signature page
    const signingLine = `Done and Signed at ___________________________ on this _____ day of ____________________ ${issueYear}.`;
    ensureSpace(12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(signingLine, margin, y);
    y += 16;

    // Start a fresh page for the signature block
    doc.addPage();
    y = margin;

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
      const footerY = pageHeight - 10;
      doc.text(`Page ${i} of ${pageCount}`, margin, footerY, { align: "left" });
      doc.text("Initial here: ______________________", pageWidth - margin, footerY, { align: "right" });
    }

    if (download) {
      doc.save(`Permanent_Contract_${data.employeeSurname || "employee"}_${data.startDate}.pdf`);
      toast({
        title: "Download ready",
        description: "Permanent employment contract has been generated.",
      });
    } else {
      const blobUrl = doc.output("bloburl");
      window.open(blobUrl, "_blank");
    }
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

  const handleDownload = () => {
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
    ? `Review and download the permanent contract for ${employeeFullName}.`
    : "Review and download the permanent contract.";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <DashboardLayout>
      {showEmployeeHint && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <div className="relative flex items-center gap-3 rounded-full border border-orange-200 bg-white/95 px-4 py-3 text-sm font-medium text-blue-900 shadow-[0_6px_18px_rgba(234,88,12,0.28)] backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <span
              className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_25px_rgba(234,88,12,0.32)] animate-pulse"
              aria-hidden="true"
            ></span>
            <div className="pointer-events-auto flex items-center gap-2">
              <span className="text-orange-600">
                TIP!{" "}
                <span className="text-blue-900 inline-flex items-center gap-1 ml-2">
                  Add the employee to your Employee List before generating a contract
                  <ArrowRight className="h-4 w-4 text-orange-500" aria-hidden="true" />
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
                className="text-blue-700 hover:text-blue-700 focus-visible:text-blue-700"
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
        </div>
      )}
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Contracts</p>
            <h1 className="text-3xl font-bold text-gray-900">Permanent Employment Contract</h1>
            <p className="text-base text-gray-600">
              Fill out the details in the quick multistep form to generate a permanent contract.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/documents/contracts")}
            className="flex-shrink-0 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white focus-visible:ring-blue-600"
          >
            <ArrowLeft className="mr-0.5 h-4 w-4" aria-hidden="true" />
            Back to contracts
          </Button>
        </div>

        <div className="flex items-center justify-center gap-4">
          {steps.map((step, index) => {
            const isFinalizedCurrent = showFinalActions && index === steps.length - 1;
            const isDone = index < activeStep || isFinalizedCurrent;
            const isActive = index === activeStep && !isFinalizedCurrent;
            const Icon = isDone ? Check : [Building2, User2, Briefcase][index];
            const circleClasses = isDone
              ? "bg-[#04b81f] text-white"
              : isActive
                ? "bg-blue-600 text-white"
                : "bg-slate-200 text-slate-500";
            const connectorClasses = isDone ? "bg-[#04b81f]" : isActive ? "bg-blue-400" : "bg-slate-200";
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
                <div
                  className={`flex flex-col items-center gap-2 ${
                    canClick ? "cursor-pointer group" : "cursor-default opacity-90"
                  }`}
                  role={canClick ? "button" : undefined}
                  tabIndex={canClick ? 0 : -1}
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
                  aria-disabled={!canClick}
                  aria-label={canClick ? `Go to ${step}` : undefined}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-200 ease-out transform-gpu ${circleClasses} shadow-sm ${canClick ? "group-hover:scale-105" : ""}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`text-xs font-semibold text-gray-800 transition-all duration-200 ease-out transform-gpu ${
                      canClick ? "group-hover:text-blue-600 group-hover:scale-105" : ""
                    }`}
                  >
                    {step}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-1 w-16 rounded-full transition-all duration-300 ${connectorClasses} self-center -mt-5`}
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </div>

        {!showFinalActions ? (
          <Card className="mt-4 shadow-xl border border-blue-100/70 bg-white/95 shadow-blue-100/60">
          <CardContent className="pt-6 [&_input]:h-9 [&_input]:py-2 [&_button[role=combobox]]:h-9 [&_textarea]:py-2 [&_textarea]:text-sm">
            <div className="space-y-4">
              {activeStep === 0 && (
                <div className="space-y-3 rounded-xl border border-blue-400 bg-slate-50/70 p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-lg text-gray-900">Employer details</h3>
                    <span className="text-xs text-slate-500">Step 1 of 3</span>
                  </div>
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
                <div className="space-y-3 rounded-xl border border-blue-400 bg-slate-50/70 p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-lg text-gray-900">Employee details</h3>
                    <span className="text-xs text-slate-500">Step 2 of 3</span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="space-y-1.5">
                      <Label htmlFor="employee">Select Employee (optional)</Label>
                      <Select onValueChange={handleEmployeeSelect}>
                        <SelectTrigger className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900">
                          <SelectValue placeholder="Select from saved employees or fill manually" />
                        </SelectTrigger>
                        <SelectContent className="w-[var(--radix-select-trigger-width)]">
                          {employees.map((employee) => (
                            <SelectItem key={employee.id} value={employee.id}>
                              {employee.employee_name} {employee.employee_surname}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="employeeName">Employee Name *</Label>
                        <Input
                          id="employeeName"
                          value={formData.employeeName}
                          onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
                          className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="employeeSurname">Employee Surname *</Label>
                        <Input
                          id="employeeSurname"
                          value={formData.employeeSurname}
                          onChange={(e) => setFormData({ ...formData, employeeSurname: e.target.value })}
                          className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="nationality">Nationality *</Label>
                        <Select
                          value={formData.nationality}
                          onValueChange={(value) =>
                            handleNationalityChange(value as PermanentContractFormData["nationality"])
                          }
                        >
                          <SelectTrigger className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900">
                            <SelectValue placeholder="Select nationality" />
                          </SelectTrigger>
                          <SelectContent className="max-h-64">
                            {nationalityOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="idOrPassport">
                          {formData.nationality === "South African" ? "ID Number *" : "Passport Number *"}
                        </Label>
                        <Input
                          id="idOrPassport"
                          value={formData.nationality === "South African" ? formData.employeeIdNumber : formData.passportNumber}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (formData.nationality === "South African") {
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
                          className={`focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900 ${
                            isIdDateInvalid ? "border-red-500 ring-red-500" : ""
                          }`}
                          placeholder={
                            formData.nationality === "South African" ? "Insert 13-digit ID number" : "Insert passport number"
                          }
                        />
                      </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="employeeAge">Age</Label>
                    <Input
                      id="employeeAge"
                      value={derivedAgeDisplay}
                      readOnly={formData.nationality === "South African"}
                      onChange={(e) => {
                        if (formData.nationality === "South African") return;
                        const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 3);
                        setFormData((prev) => ({ ...prev, age: digitsOnly }));
                      }}
                      inputMode={formData.nationality === "South African" ? "text" : "numeric"}
                      className={`focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900 ${
                        formData.nationality === "South African" ? "bg-slate-50" : ""
                      }`}
                      placeholder={
                        formData.nationality === "South African" ? "Auto-calculated" : "Insert employee age"
                      }
                    />
                  </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="employeeNumber">Employee Number</Label>
                        <Input
                          id="employeeNumber"
                          value={formData.employeeNumber}
                          onChange={(e) => setFormData({ ...formData, employeeNumber: e.target.value })}
                          placeholder="E.g. EMP001"
                          className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                        />
                      </div>
                      <div className="space-y-1.5">
                    <Label htmlFor="gender">Gender *</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(value) => setFormData({ ...formData, gender: value as PermanentContractFormData["gender"] })}
                    >
                      <SelectTrigger className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900">
                            <SelectValue placeholder="Select gender" />
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
                      <div className="space-y-1.5">
                    <Label htmlFor="race">Race *</Label>
                    <Select
                      value={formData.race}
                      onValueChange={(value) => setFormData({ ...formData, race: value as PermanentContractFormData["race"] })}
                    >
                      <SelectTrigger className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900">
                            <SelectValue placeholder="Select race" />
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
                      <div className="space-y-1.5">
                        <Label htmlFor="employeeEmail">Email</Label>
                        <Input
                          id="employeeEmail"
                          type="email"
                          value={formData.employeeEmail}
                          onChange={(e) => setFormData({ ...formData, employeeEmail: e.target.value })}
                          className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="employeeCell">Cell Number *</Label>
                        <Input
                          id="employeeCell"
                          value={formData.employeeCell}
                          onChange={(e) => {
                            const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
                            setFormData({ ...formData, employeeCell: digitsOnly });
                          }}
                          placeholder="Insert contact number"
                          className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="alternativeContact">Alternative Contact</Label>
                        <Input
                          id="alternativeContact"
                          value={formData.alternativeContact}
                          onChange={(e) => {
                            const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
                            setFormData({ ...formData, alternativeContact: digitsOnly });
                          }}
                          placeholder="Insert alternative contact number"
                          className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label htmlFor="employeeAddress">Residential Address *</Label>
                        <Textarea
                          id="employeeAddress"
                          value={formData.employeeAddress}
                          onChange={(e) => setFormData({ ...formData, employeeAddress: e.target.value })}
                          rows={3}
                          placeholder="Street, suburb, city, province, postal code"
                          className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <div className="flex items-center gap-6">
                          <Label htmlFor="employeePostalAddress">Postal Address *</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                employeePostalAddress: prev.employeeAddress,
                              }))
                            }
                            className="h-8 px-3 text-xs border-slate-300 text-gray-700 hover:border-blue-500 hover:bg-white hover:text-blue-600"
                          >
                            Copy from Residential
                          </Button>
                        </div>
                        <Textarea
                          id="employeePostalAddress"
                          value={formData.employeePostalAddress}
                          onChange={(e) => setFormData({ ...formData, employeePostalAddress: e.target.value })}
                          rows={2}
                          placeholder="PO Box, suburb, city, province, postal code"
                          className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeStep === 2 && (
                <div className="space-y-3 rounded-xl border border-blue-400 bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-lg text-gray-900">Employment details</h3>
                    <span className="text-xs text-slate-500">Step 3 of 3</span>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="issueDate">Issue Date *</Label>
                      <Input
                        id="issueDate"
                        type="date"
                        value={formData.issueDate}
                        onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                        className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                      />
                    </div>
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
                      <Label htmlFor="reportsTo">Reports To *</Label>
                      <Input
                        id="reportsTo"
                        value={formData.reportsTo}
                        onChange={(e) => setFormData({ ...formData, reportsTo: e.target.value })}
                        className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                      />
                    </div>
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
                            salaryFrequency: value as PermanentContractFormData["salaryFrequency"],
                          })
                        }
                      >
                        <SelectTrigger className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          {salaryFrequencyOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {salaryFrequencyLabels[option as PermanentContractFormData["salaryFrequency"]]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="probationPeriod">Probation *</Label>
                      <Select
                        value={formData.probationPeriod}
                        onValueChange={(value) =>
                          setFormData({
                            ...formData,
                            probationPeriod: value as PermanentContractFormData["probationPeriod"],
                          })
                        }
                      >
                        <SelectTrigger className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900">
                          <SelectValue placeholder="Select probation period" />
                        </SelectTrigger>
                        <SelectContent>
                          {probationOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {probationLabels[option]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="annualLeaveDays">Annual leave days *</Label>
                      <Input
                        id="annualLeaveDays"
                        type="number"
                        min="1"
                        max="60"
                        step="1"
                        value={formData.annualLeaveDays}
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 3);
                          setFormData({ ...formData, annualLeaveDays: digitsOnly });
                        }}
                        placeholder="15"
                        className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="department">Department</Label>
                      <Input
                        id="department"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        placeholder="E.g. Finance, Operations"
                        className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="retirementAge">Retirement age *</Label>
                      <Select
                        value={formData.retirementAge}
                        onValueChange={(value) =>
                          setFormData({
                            ...formData,
                            retirementAge: value as PermanentContractFormData["retirementAge"],
                          })
                        }
                      >
                        <SelectTrigger className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900">
                          <SelectValue placeholder="Select retirement age" />
                        </SelectTrigger>
                        <SelectContent>
                          {retirementAgeOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              Age {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                    <div className="space-y-1.5">
                      <Label htmlFor="interpreter">Interpreter required *</Label>
                      <Select
                        value={formData.interpreter}
                        onValueChange={(value) =>
                          setFormData({ ...formData, interpreter: value as PermanentContractFormData["interpreter"] })
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
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                {activeStep === steps.length - 1 ? (
                  <div className="flex w-full items-center gap-3 flex-wrap justify-between">
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
                  </div>
                ) : (
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
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
          </Card>
          ) : (
            <Card className="mt-4 shadow-xl border border-blue-100/70 bg-white/95 shadow-blue-100/60">
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

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pr-10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle className="text-blue-600">Preview - Permanent Contract</DialogTitle>
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
              const derivedAge = validatedPreview.nationality === "South African" ? deriveAgeFromId(validatedPreview.employeeIdNumber) : "";
              const isSouthAfrican = validatedPreview.nationality === "South African";
              const idDisplay = isSouthAfrican ? validatedPreview.employeeIdNumber : "--";
              const passportDisplay = isSouthAfrican ? "--" : validatedPreview.passportNumber || "--";
              const annualLeaveText = `The Employee is entitled to ${validatedPreview.annualLeaveDays} days' annual leave per leave cycle. Leave shall be taken at times determined by the Employer, subject to operational requirements. Unused leave will be forfeited if not taken within the applicable cycle.`;

              const SectionHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
                <div className="bg-slate-100 border border-slate-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-700 flex items-center">
                  <span>{title}</span>
                  {subtitle ? <span className="ml-2 italic normal-case font-medium text-gray-600">{subtitle}</span> : null}
                </div>
              );

              const SingleRow = ({ label, value }: { label: string; value?: string | number | null }) => (
                <div className="grid grid-cols-[120px_1fr] gap-2 border-b border-slate-200 py-2 px-3 text-[11px]">
                  <span className="font-semibold italic uppercase text-gray-700">{label}:</span>
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

              const clauses: ClauseDefinition[] = [
                {
                  title: "Introduction",
                  body:
                    "This employment agreement is entered into between the Employer and the Employee willingly and voluntarily.  The Employee hereby agrees that he/she has been granted the opportunity to peruse and discuss the contract with his/her council and that he/she understands the content that follows.",
                },
                {
                  title: "Recordal",
                  body:
                    "The Employer appoints the Employee in a permanent capacity, which the Employee accepts on the terms of this agreement. This agreement records the essential conditions of employment, including duties, remuneration, working hours, leave, and termination, and constitutes the entire understanding between the parties, replacing any prior verbal or written arrangements unless expressly stated otherwise. The employment relationship is governed by this agreement and all applicable labour laws of South Africa.",
                },
                {
                  title: "Probation",
                  body:
                    "The Employee is appointed subject to a probationary period commencing on the Start Date, during which the Employer will assess the Employee’s performance, conduct, skills, and suitability for the position. If the required standards are not met, the Employer may terminate the employment in accordance with labour law. Successful completion of probation does not guarantee continued employment, and confirmation of permanent employment remains at the Employer’s discretion.",
                },
                {
                  title: "Performance and adaptability",
                  body: [
                    "The Employee shall diligently perform all duties associated with the position and comply with all reasonable and lawful instructions issued by the Employer or its authorised representatives. The Employee confirms that he/she has the necessary skills, qualifications, and experience to perform the required duties to the Employer’s satisfaction.",
                    "The Employee acknowledges that the Employer may assign additional or alternative duties within the Employee’s reasonable skills or capabilities, and refusal to perform such duties may constitute insubordination. If the work described in the Employee’s job description becomes unavailable, the Employee agrees to perform suitable alternative work without loss of remuneration, although this does not create a right to continued employment. Should no suitable alternative work exist, the Employer may initiate retrenchment processes in accordance with applicable labour laws.",
                  ],
                },
                {
                  title: "Guarantee",
                  body:
                    "The Employee warrants that all information, documentation, and credentials submitted to the Employer are true and accurate. If any submission is found to be false, fraudulent, or misleading, the Employer may institute disciplinary action for dishonesty, which may result in summary termination of employment.",
                },
                {
                  title: "Remuneration",
                  body: [
                    "The Employee shall receive the Gross Salary, which shall comply with all applicable legislation.  Unauthorised or unapproved absence from work shall result in no payment for the period of absence.",
                    "Any future salary increases shall be considered at the Employer’s discretion, taking into account the Employee’s performance and the Employer’s financial position in the preceding financial year. No expectation of an increase is created by this clause, and the granting of any increase remains entirely discretionary.",
                    "The Employee will be remunerated at two times the normal wage for work performed on a public holiday.",
                  ],
                },
                {
                  title: "Deductions",
                  body:
                    "The Employee consents to all lawful and statutory deductions from remuneration, including PAYE, UIF, and any voluntary benefits or contributions agreed to by the parties. The Employee further agrees that the Employer may deduct any amount lawfully owed to it, including losses, damages, cash or stock shortages resulting from the Employee’s negligence, misconduct, or dishonesty, provided such deductions comply with applicable labour laws and are properly recorded and communicated.",
                },
                {
                  title: "Hours of work",
                  body:
                    "The Employee’s ordinary working hours shall not exceed forty-five (45) hours per week. The Employee shall be entitled to a daily unpaid lunch break of one (1) hour, taken at the time agreed between the parties.",
                },
                {
                  title: "Overtime",
                  body:
                    "The Employee may be required to work overtime, subject to the limits set by the BCEA. Reasonable notice of overtime will be given, except in emergencies where short-notice overtime may be required. Overtime shall be remunerated in accordance with applicable legislation; however, employees earning above the Ministerial earnings threshold and employees classified as top management are not entitled to overtime pay.",
                },
                {
                  title: "Retirement",
                  body:
                    "The Employee shall retire at the age recorded in page 1 of this agreement, unless otherwise agreed in writing. If the Employee continues working beyond the agreed retirement age, the Employer may terminate the employment contract on the basis of retirement by giving at least one (1) month’s written notice, and no further consultation shall be required.",
                },
                {
                  title: "Exclusivity of employment",
                  body: "The Employee shall not undertake any outside work or business activity without the Employer’s prior written consent.",
                },
                {
                  title: "Annual bonus",
                  body: [
                    "Any annual bonus is ex-gratia and granted entirely at the Employer’s discretion, subject to the Employer’s financial position and the Employee’s conduct and performance. No entitlement or expectation of a bonus is created, regardless of whether bonuses were granted in previous years, and the Employer may withhold a bonus at any time.",
                    "The Employee agrees that no pro-rata bonus shall be payable in the event of termination of employment for any reason.",
                  ],
                },
                {
                  title: "Termination of employment",
                  body: [
                    "Either party may terminate the employment relationship by giving written notice in accordance with the BCEA. The Employer may, at its discretion, make payment in lieu of notice when terminating the Employee’s services.",
                    "The Employer reserves the right to summarily dismiss the Employee for gross misconduct, following a fair disciplinary process and in accordance with the principles of substantive and procedural fairness.",
                  ],
                },
                {
                  title: "Annual leave",
                  body: [
                    annualLeaveText,
                    "The Employee agrees to take annual leave during any annual shutdown period implemented by the Employer. Any additional leave taken during the cycle will be deducted from the Employee's leave entitlement.",
                  ],
                },
                {
                  title: "Sick leave",
                  body: [
                    "The Employee is entitled to sick leave in accordance with the BCEA. The Employee must provide a valid medical certificate when required by law or by the Employer.",
                    "In cases of prolonged or recurring illness, the Employer may initiate a fair incapacity process in line with applicable labour legislation, which may result in termination of employment where the Employee is unable to perform the inherent requirements of the job.",
                    "The Employee must submit a valid medical certificate issued and signed by a registered medical practitioner or any person certified to diagnose and treat patients and registered with a recognised professional council.",
                    "Clinic or hospital attendance notes that merely confirm a visit, and do not expressly declare the Employee unfit for duty for a specific period, shall also not be accepted as proof of sickness.",
                  ],
                },
                {
                  title: "Parental leave",
                  body: [
                    "Where both parents are employed, they are jointly entitled to a combined period of four months and ten days of parental leave, which may be shared between them as they agree. The leave may be taken at the same time or one after the other. If the parents cannot agree on the division of leave, it shall be shared equally.",
                    "Where the Employee is a single parent or where only one parent is employed, that parent is entitled to four consecutive months of parental leave.",
                    "A pregnant Employee may commence parental leave at any time from four weeks before the expected date of birth, or earlier if medically required, and may not return to work within six weeks after giving birth unless declared fit for duty by a medical practitioner or midwife.",
                    "Adoptive and commissioning parents are entitled to parental leave on the same basis as biological parents, subject to the statutory notice requirements.",
                    "The Employee must notify the Employer in writing of the intended parental leave dates and return date at least four weeks before the start of the leave.",
                    "Parental leave under this agreement is unpaid and the Employee must claim any available benefits from the Unemployment Insurance Fund.",
                  ],
                },
                {
                  title: "Family responsibility leave",
                  body: [
                    "An Employee who has completed four months of continuous employment and who works at least four days per week is entitled to three days of paid family responsibility leave per annual leave cycle. This leave may be taken for the illness of the Employee’s child, or in the event of the death of the Employee’s spouse or life partner, parent or adoptive parent, grandparent, child or adopted child, grandchild, or sibling.",
                    "The Employee must notify the Employer as soon as reasonably possible if family responsibility leave is required. Where the leave relates to a funeral, the Employee must, where practicable, give at least four days’ prior notice.",
                    "The Employer may request reasonable proof of the reason for leave, including a medical certificate for a child’s illness, a death certificate or other acceptable proof in cases of bereavement, and proof of the Employee’s relationship to the deceased.",
                    "Failure to provide notice or proof when requested may result in the leave not being approved and treated as unpaid leave. Family responsibility leave does not accumulate, may not be carried over, and lapses at the end of each annual leave cycle.",
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
                  title: "Protection of personal information",
                  body: [
                    "The Employee consents to the collection, use and storage of Personal Information and Special Personal Information, as defined in POPIA, for purposes related to the employment relationship. This includes payroll and benefit administration, statutory reporting, security and access control, monitoring for operational and risk-management purposes, internal and external communication, and compliance with legal and contractual obligations.",
                    "The Employee consents to the sharing or transfer of Personal Information, where necessary, to third party service providers such as benefit administrators and insurers, to clients or service providers for operational purposes, and to secure cloud-based or foreign storage platforms that offer adequate data protection in accordance with POPIA.",
                    "The Employee warrants that all Personal Information supplied is accurate and undertakes to update the Employer if any information changes. The Employee agrees to comply with the Employer’s POPIA policies and acknowledges that failure to do so may result in disciplinary action.",
                  ],
                },
                {
                  title: "Rules and regulations",
                  body: [
                    "The Employee agrees to comply with all rules, policies, procedures and regulations of the Employer, whether communicated in writing, verbally, or arising by reasonable implication from the nature of the workplace and the duties performed.",
                    "The Employee must immediately inform the Employer of any offence, misconduct or breach of company rules committed by himself or herself, or by any other Employee, as soon as he or she becomes aware of it or reasonably ought to have become aware of it.",
                    "Failure to disclose such information shall be regarded as dishonesty and a breach of trust, and may result in disciplinary action, including possible dismissal.",
                  ],
                },
                {
                  title: "Industrial action",
                  body: [
                    "The Employee may not participate in any unprotected strike, stoppage, or form of industrial action. No strike or picket may be undertaken unless it is protected in terms of the Labour Relations Act and preceded by the required certificate to strike and authorisation to picket.",
                    "The Employee acknowledges and agrees that he/she shall be held liable for any damages to property, financial losses, or other harm suffered by the Employer as a result of his/her involvement in any legal or illegal industrial action, whether directly or indirectly.",
                  ],
                },
                {
                  title: "Health and fitness",
                  body: [
                    "The Employee confirms that he or she is medically fit to perform the duties of the position. Should the Employee become unable to perform these duties for health reasons, the Employer may follow the applicable incapacity procedures prescribed by the Labour Relations Act, which may result in termination of employment.",
                    "The Employer may require the Employee to undergo a medical assessment, at the Employer’s cost, to determine fitness for duty. Unreasonable refusal to attend such an assessment may result in disciplinary action.",
                  ],
                },
                {
                  title: "Change of status",
                  body: [
                    "The Employee must promptly notify the Employer in writing of any change to his or her personal details as recorded in this agreement, and in any event within seven days of such change, so that the Employer’s records remain accurate and up to date.",
                    "The Employee cannot hold the Employer liable for making use of incorrect details if the Employee breaches this clause.",
                  ],
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
                  body: [
                    "The Employee agrees that the Employer may implement a temporary lay off when necessary. Where reasonably possible, the Employer will provide at least one day’s notice, stating the reason and expected duration. The Employee acknowledges that no remuneration is payable during a temporary lay off.",
                    "Temporary lay offs may be introduced due to circumstances beyond the Employer’s control, including adverse weather, shortages of material or a temporary shortage of work. A temporary lay off in terms of this clause does not constitute a unilateral change to conditions of employment, nor shall it be regarded as a dismissal, retrenchment or breach of contract.",
                  ],
                },
                {
                  title: "Proof of citizenship",
                  body: [
                    "The Employee must provide proof of South African citizenship upon commencement of employment. If not a South African citizen, the Employee must submit a valid work permit or proof of permanent residency within seven days of request, and must continue to provide updated documentation whenever required.",
                    "It is the Employee’s sole responsibility to ensure that any work permit remains valid for the full duration of employment. The Employee agrees that failure to maintain a valid permit or to provide updated proof when required will result in immediate termination of employment.",
                  ],
                },
                {
                  title: "Confidentiality",
                  body:
                    "The Employee shall keep all confidential information, trade secrets, client data and business affairs of the Employer strictly confidential and shall not disclose or use such information for any purpose other than the performance of his or her duties.",
                },
                {
                  title: "Entire Agreement and Acknoweldgement",
                  body: [
                    "This agreement constitutes the entire agreement between the parties, and no variation, amendment or addition shall be valid unless reduced to writing and signed by both parties. Any indulgence or leniency granted shall not constitute a waiver of rights.",
                    "By signing this agreement, both parties acknowledge that they have read and understood its contents and agree to be bound by its terms. The Employee confirms that the conditions of employment have been explained where necessary and that he or she voluntarily accepts them.",
                    "The Employee acknowledges that all terms and conditions of employment are contained in this agreement, and any matters not specifically addressed shall be governed by the Employer’s rules and procedures. Where this agreement and the Employer’s policies are silent, the provisions of the Basic Conditions of Employment Act shall apply.",
                  ],
                },
              ];

              const clausesWithEdits = applyClauseEdits(clauses);

              const startEditingClause = (clause: ClauseDefinition) => {
                setEditingClause(clause.title);
                setClauseDraft(clauseEdits[clause.title] ?? serializeClauseBody(clause.body));
              };

              const saveClauseEdit = (title: string) => {
                const trimmed = clauseDraft.trim();
                setClauseEdits((prev) => {
                  const next = { ...prev };
                  if (trimmed) {
                    next[title] = trimmed;
                  } else {
                    delete next[title];
                  }
                  return next;
                });
                setEditingClause(null);
                setClauseDraft("");
              };

              const resetClauseEdit = (title: string) => {
                setClauseEdits((prev) => {
                  const next = { ...prev };
                  delete next[title];
                  return next;
                });
                setEditingClause(null);
                setClauseDraft("");
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
                            return clausesWithEdits.map((clause) => {
                              const paragraphs = Array.isArray(clause.body) ? clause.body : [clause.body];
                              const isEditing = editingClause === clause.title;
                              const isEdited = Boolean(clauseEdits[clause.title]);
                              return (
                                <div key={clause.title} className="space-y-2 rounded-md border border-slate-100/80 p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <h3 className="font-semibold text-black">{clause.title}</h3>
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
                                            className="h-8 px-3 bg-[#04b81f] hover:bg-[#049218]"
                                            onClick={() => saveClauseEdit(clause.title)}
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
                                              onClick={() => resetClauseEdit(clause.title)}
                                            >
                                              Reset
                                            </Button>
                                          ) : null}
                                        </>
                                      ) : (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-8 px-3"
                                          onClick={() => startEditingClause(clause)}
                                        >
                                          Edit
                                        </Button>
                                      )}
                                    </div>
                                  </div>

                                  {isEditing ? (
                                    <div className="space-y-2">
                                      <Textarea
                                        value={clauseDraft}
                                        onChange={(e) => setClauseDraft(e.target.value)}
                                        rows={6}
                                        className="text-xs"
                                        spellCheck={true}
                                        lang="en"
                                        autoCorrect="on"
                                      />
                                      <p className="text-[11px] text-slate-500">Separate paragraphs with a blank line.</p>
                                    </div>
                                  ) : null}

                                  <div className="space-y-1">
                                    {paragraphs.map((text) => {
                                      const currentNumber = clauseNumber;
                                      clauseNumber += 1;
                                      return (
                                        <div key={`${clause.title}-${currentNumber}`} className="grid grid-cols-[auto,1fr] gap-2 text-justify">
                                          <span className="font-semibold">{currentNumber}.</span>
                                          <p className="text-justify whitespace-pre-line">{text}</p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
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
    </DashboardLayout>
  );
};

export default PermanentContractGenerator;
