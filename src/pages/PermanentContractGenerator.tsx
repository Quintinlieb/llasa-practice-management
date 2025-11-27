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
import { Download, FileText, ArrowLeft, Building2, User2, Briefcase, Check, Undo2, X } from "lucide-react";
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
} & Omit<PermanentContractFormData, "salaryAmount" | "gender" | "race"> & {
  salaryAmount: string;
  gender: PermanentContractFormData["gender"] | "";
  race: PermanentContractFormData["race"] | "";
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [validatedPreview, setValidatedPreview] = useState<PermanentContractFormData | null>(null);
  const steps = ["Employer Details", "Employee Details", "Employment Details"] as const;
  const [activeStep, setActiveStep] = useState(0);
  const [showEmployeeHint, setShowEmployeeHint] = useState(false);
  const [hasDismissedEmployeeHint, setHasDismissedEmployeeHint] = useState(false);

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
    salaryFrequency: "month",
    probationPeriod: "3",
    department: "",
    retirementAge: "60",
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
      salaryFrequency: "month",
      probationPeriod: "3",
      department: "",
      retirementAge: "60",
      workplace: profile?.physical_address || "",
      interpreter: "no",
      reportsTo: "",
      additionalNotes: "",
    });
    setValidatedPreview(null);
    setShowPreview(false);
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
    });

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
      const maxWidth = contentWidth - labelWidth;
      const lines = doc.splitTextToSize(text, maxWidth);
      const lineHeight = 6;
      const blockHeight = lines.length * lineHeight;

      ensureSpace(blockHeight);
      doc.text(label, margin, y);
      doc.text(text, margin + labelWidth, y, { maxWidth, align: "justify" as any });
      y += blockHeight;
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

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("PERMANENT EMPLOYMENT AGREEMENT", pageWidth / 2, y, { align: "center" });
    y += 10;

    const introText = `This permanent employment agreement ("Agreement") is entered into between ${valueOrLine(profile?.company_name ?? "the Employer")} ("Employer") and ${data.employeeName} ${data.employeeSurname} ("Employee"). This Agreement is issued on ${formatDate(data.issueDate)} and employment commences on ${formatDate(data.startDate)}.`;
    y = addWrappedText(doc, introText, margin, y, contentWidth, 6, 10, "normal") + 4;

    addSection(
      "Remuneration summary",
      `The Employee will receive ${formattedSalary} before statutory deductions and will report to ${data.reportsTo}. The Employer may review compensation periodically at its discretion.`,
    );

    const clauses = [
      {
        title: "Appointment and role",
        body: `The Employee is appointed in the position of ${data.jobTitle}. Duties and responsibilities may reasonably evolve in line with operational needs, provided they remain consistent with the role.`,
      },
      {
        title: "Place of work",
        body: "The Employee will perform duties at the Employer's premises or any other location reasonably required by the Employer. Flexible or remote work arrangements may be agreed in writing, subject to operational needs.",
      },
      {
        title: "Remuneration",
        body: `The Employee will receive ${formattedSalary} before statutory deductions. Salary will be reviewed periodically at the Employer's discretion. Any bonuses or incentives are discretionary unless agreed otherwise in writing.`,
      },
      {
        title: "Hours of work",
        body: "Standard working hours are those prescribed by the Basic Conditions of Employment Act (BCEA) unless varied in writing. Reasonable overtime may be required subject to BCEA limits and applicable compensation or time off in lieu.",
      },
      {
        title: "Leave entitlements",
        body: "Annual, sick, family responsibility, and any other applicable leave will accrue and be taken in accordance with the BCEA and company policies. Leave must be scheduled with reasonable notice and operational consideration.",
      },
      {
        title: "Probation and performance",
        body: "The first three months of employment constitute a probationary period during which performance and suitability will be assessed. Performance standards, feedback, and any required improvements will be communicated. The Employer may extend probation where reasonably necessary.",
      },
      {
        title: "Duties and conduct",
        body: "The Employee undertakes to perform duties diligently, comply with all lawful and reasonable instructions, and uphold company policies, codes, and procedures. Any conflict of interest must be disclosed immediately.",
      },
      {
        title: "Confidentiality and intellectual property",
        body: "All confidential information, trade secrets, and intellectual property developed or accessed during employment remain the exclusive property of the Employer. The Employee may not disclose or use such information except as required for duties, and this obligation survives termination.",
      },
      {
        title: "Health, safety, and compliance",
        body: "The Employee will follow all health and safety rules, report incidents promptly, and comply with statutory requirements relevant to the role and industry. Failure to do so may result in disciplinary action.",
      },
      {
        title: "Termination",
        body: "Either party may terminate employment by giving written notice in accordance with the BCEA or making payment in lieu. The Employer reserves the right to summarily dismiss for gross misconduct in line with disciplinary procedures and substantive fairness.",
      },
      {
        title: "Return of property",
        body: "On termination, the Employee will return all company property, including equipment, documents, access cards, and confidential information, and will assist with handover of duties.",
      },
      {
        title: "Entire agreement",
        body: "This Agreement, together with any signed annexures and company policies, constitutes the entire understanding between the parties regarding employment. Changes are valid only if recorded in writing and signed by both parties.",
      },
    ];

    clauses.forEach((clause, idx) => {
      addClauseHeading(clause.title);
      addNumberedParagraph(idx + 1, clause.body);
      y += 3;
    });

    if (data.additionalNotes) {
      addSection("Additional notes", data.additionalNotes);
    }

    ensureSpace(14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(
      `Done and Signed at ________________________________________ on this _____ day of ______________________________ ${issueYear}.`,
      margin,
      y,
    );
    y += 16;

    ensureSpace(50);
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("SIGNATURES", margin, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    const signatureLabels = ["For the Employer", "Employee"];
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
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, 12, { align: "right" });
      doc.text("Initial here: ______________________", pageWidth - margin, pageHeight - 10, { align: "right" });
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
          <div className="relative flex items-center gap-3 rounded-full border border-blue-200 bg-white/95 px-4 py-3 text-sm font-medium text-blue-900 shadow-[0_6px_18px_rgba(59,130,246,0.3)] backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <span
              className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_25px_rgba(59,130,246,0.35)] animate-pulse"
              aria-hidden="true"
            ></span>
            <div className="pointer-events-auto flex items-center gap-2">
              <span className="text-blue-600">
                TIP!{" "}
                <span className="text-blue-900">
                  Add the employee on the Employees page first before generating the contract.
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

        <Card className="shadow-xl border border-blue-100/70 bg-white/95 shadow-blue-100/60">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-center gap-4">
              {steps.map((step, index) => {
                const isActive = index === activeStep;
                const isDone = index < activeStep;
                const Icon = isDone ? Check : [Building2, User2, Briefcase][index];
                const circleClasses = isDone
                  ? "bg-emerald-500 text-white"
                  : isActive
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 text-slate-500";
                const connectorClasses = isDone ? "bg-emerald-500" : isActive ? "bg-blue-400" : "bg-slate-200";
                const hoverable = isDone;
                return (
                  <div
                    key={step}
                    className={`flex items-center gap-4 ${canNavigateToStep(index) ? "cursor-pointer" : "cursor-default opacity-90"}`}
                    role="button"
                    tabIndex={canNavigateToStep(index) ? 0 : -1}
                    onClick={() => handleStepClick(index)}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && canNavigateToStep(index)) {
                        e.preventDefault();
                        handleStepClick(index);
                      }
                    }}
                    aria-disabled={!canNavigateToStep(index)}
                    aria-label={`Go to ${step}`}
                  >
                    <div className={`flex flex-col items-center gap-2 ${hoverable ? "group" : ""}`}>
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-200 ease-out transform-gpu ${circleClasses} shadow-sm ${hoverable ? "group-hover:scale-105" : ""}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <span
                        className={`text-xs font-semibold text-gray-800 transition-all duration-200 ease-out transform-gpu ${
                          hoverable ? "group-hover:text-blue-600 group-hover:scale-105" : ""
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
          </CardHeader>
          <CardContent className="[&_input]:h-9 [&_input]:py-2 [&_button[role=combobox]]:h-9 [&_textarea]:py-2 [&_textarea]:text-sm">
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
                <div className="flex gap-2">
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
                <div className="flex flex-wrap gap-2">
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
                  {activeStep === steps.length - 1 && (
                    <TooltipProvider delayDuration={0}>
                      <div className="flex flex-wrap gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={handlePreview}
                              disabled={!isFormComplete || isGenerating}
                              aria-label="Preview"
                              className="h-10 w-10 bg-white text-slate-600 hover:text-blue-600 hover:bg-white transition-transform duration-200 hover:scale-105 disabled:text-slate-300 [&_svg]:h-7 [&_svg]:w-7"
                            >
                              <FileText />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Preview</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              size="icon"
                              onClick={handleDownload}
                              disabled={!isFormComplete || isGenerating}
                              aria-label="Download PDF"
                              className="h-10 w-10 bg-white text-slate-700 hover:text-blue-600 hover:bg-white transition-transform duration-200 hover:scale-105 disabled:text-slate-300 [&_svg]:h-7 [&_svg]:w-7"
                            >
                              <Download />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Download</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={resetForm}
                              disabled={isGenerating}
                              aria-label="Reset form"
                              className="h-10 w-10 bg-white text-slate-600 hover:text-blue-600 hover:bg-white transition-transform duration-200 hover:scale-105 disabled:text-slate-300 [&_svg]:h-7 [&_svg]:w-7"
                            >
                              <Undo2 />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Reset form</TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Permanent contract preview</DialogTitle>
            <DialogDescription>Review the generated content before downloading.</DialogDescription>
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

              const clauses = [
                {
                  title: "Appointment and role",
                  body: `The Employee is appointed in the position of ${validatedPreview.jobTitle}. Duties and responsibilities may reasonably evolve in line with operational needs, provided they remain consistent with the role.`,
                },
                {
                  title: "Place of work",
                  body: "The Employee will perform duties at the Employer's premises or any other location reasonably required by the Employer. Flexible or remote work arrangements may be agreed in writing, subject to operational needs.",
                },
                {
                  title: "Remuneration",
                  body: `The Employee will receive ${salaryDisplay} before statutory deductions. Salary will be reviewed periodically at the Employer's discretion. Any bonuses or incentives are discretionary unless agreed otherwise in writing.`,
                },
                {
                  title: "Hours of work",
                  body: "Standard working hours are those prescribed by the BCEA unless varied in writing. Reasonable overtime may be required subject to BCEA limits and applicable compensation or time off in lieu.",
                },
                {
                  title: "Leave entitlements",
                  body: "Annual, sick, family responsibility, and any other applicable leave will accrue and be taken in accordance with the BCEA and company policies. Leave must be scheduled with reasonable notice and operational consideration.",
                },
                {
                  title: "Probation and performance",
                  body: "The first three months of employment constitute a probationary period during which performance and suitability will be assessed. Performance standards, feedback, and any required improvements will be communicated. The Employer may extend probation where reasonably necessary.",
                },
                {
                  title: "Duties and conduct",
                  body: "The Employee undertakes to perform duties diligently, comply with all lawful and reasonable instructions, and uphold company policies, codes, and procedures. Any conflict of interest must be disclosed immediately.",
                },
                {
                  title: "Confidentiality and intellectual property",
                  body: "All confidential information, trade secrets, and intellectual property developed or accessed during employment remain the exclusive property of the Employer. The Employee may not disclose or use such information except as required for duties, and this obligation survives termination.",
                },
                {
                  title: "Health, safety, and compliance",
                  body: "The Employee will follow all health and safety rules, report incidents promptly, and comply with statutory requirements relevant to the role and industry. Failure to do so may result in disciplinary action.",
                },
                {
                  title: "Termination",
                  body: "Either party may terminate employment by giving written notice in accordance with the BCEA or making payment in lieu. The Employer reserves the right to summarily dismiss for gross misconduct in line with disciplinary procedures and substantive fairness.",
                },
                {
                  title: "Return of property",
                  body: "On termination, the Employee will return all company property, including equipment, documents, access cards, and confidential information, and will assist with handover of duties.",
                },
                {
                  title: "Entire agreement",
                  body: "This Agreement, together with any signed annexures and company policies, constitutes the entire understanding between the parties regarding employment. Changes are valid only if recorded in writing and signed by both parties.",
                },
              ];

              return (
                <div className="space-y-8">
                  <div
                    className="bg-white text-black p-8 mx-auto border border-slate-200 shadow-sm"
                    style={{ width: "210mm", minHeight: "297mm" }}
                  >
                    <h1 className="text-xl font-bold text-center text-gray-900 mb-6 uppercase tracking-wide">Employment Contract</h1>

                    <div className="space-y-6">
                      <div>
                        <SectionHeader
                          title="A. Employer details"
                          subtitle='(Hereinafter referred to as "The Employer")'
                        />
                        <div className="border border-slate-200 border-t-0">
                          <SingleRow label="Company name" value={profile?.company_name} />
                          <SingleRow label="Reg. number" value={profile?.registration_number} />
                          <SingleRow label="Address" value={profile?.physical_address} />
                          <SingleRow label="Email" value={profile?.company_email} />
                          <SingleRow label="Contact" value={profile?.company_contact} />
                        </div>
                      </div>

                      <div>
                        <SectionHeader
                          title="B. Employee details"
                          subtitle='(Hereinafter referred to as "the Employee")'
                        />
                        <div className="border border-slate-200 border-t-0">
                          <DualRow
                            leftLabel="Surname"
                            leftValue={validatedPreview.employeeSurname}
                            rightLabel="Name(s)"
                            rightValue={validatedPreview.employeeName}
                          />
                          <DualRow
                            leftLabel="ID no."
                            leftValue={idDisplay}
                            rightLabel="Passport no."
                            rightValue={passportDisplay}
                          />
                          <DualRow leftLabel="Age" leftValue={derivedAge} rightLabel="Nationality" rightValue={validatedPreview.nationality} />
                          <DualRow leftLabel="Race" leftValue={validatedPreview.race} rightLabel="Gender" rightValue={validatedPreview.gender} />
                          <DualRow
                            leftLabel="Cell number"
                            leftValue={validatedPreview.employeeCell}
                            rightLabel="Email"
                            rightValue={validatedPreview.employeeEmail || "--"}
                          />
                          <DualRow
                            leftLabel="Alt. contact"
                            leftValue={validatedPreview.alternativeContact || "--"}
                            rightLabel="Employee no."
                            rightValue={validatedPreview.employeeNumber}
                          />
                          <SingleRow label="Address" value={validatedPreview.employeeAddress} />
                          <SingleRow label="Postal" value={validatedPreview.employeePostalAddress} />
                        </div>
                      </div>

                      <div>
                        <SectionHeader title="C. Employment details" />
                        <div className="border border-slate-200 border-t-0">
                          <DualRow
                            leftLabel="Type"
                            leftValue="Permanent"
                            rightLabel="Start date"
                            rightValue={formatDate(validatedPreview.startDate)}
                          />
                          <DualRow
                            leftLabel="Duration"
                            leftValue="Indefinite"
                            rightLabel="Probation"
                            rightValue={probationLabels[validatedPreview.probationPeriod]}
                          />
                          <DualRow
                            leftLabel="Job title"
                            leftValue={validatedPreview.jobTitle}
                            rightLabel="Department"
                            rightValue={validatedPreview.department}
                          />
                          <DualRow
                            leftLabel="Gross salary"
                            leftValue={salaryDisplay}
                            rightLabel="Retirement"
                            rightValue={validatedPreview.retirementAge ? `Age ${validatedPreview.retirementAge}` : ""}
                          />
                          <DualRow
                            leftLabel="Reports to"
                            leftValue={validatedPreview.reportsTo}
                            rightLabel="Interpreter"
                            rightValue={validatedPreview.interpreter === "yes" ? "Yes" : "No"}
                          />
                          <SingleRow label="Workplace" value={workplace} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className="bg-white text-black p-8 mx-auto border border-slate-200 shadow-sm"
                    style={{ width: "210mm", minHeight: "297mm" }}
                  >
                    <div className="bg-slate-900 text-white -mx-8 -mt-8 px-8 py-3 mb-6 flex items-center justify-center">
                      <h2 className="text-lg font-semibold tracking-wide">PERMANENT EMPLOYMENT AGREEMENT</h2>
                    </div>

                    <div className="text-xs leading-relaxed space-y-5">
                      <p>
                        This permanent employment agreement ("Agreement") is entered into between {employerName} ("Employer") and{" "}
                        {validatedPreview.employeeName} {validatedPreview.employeeSurname} ("Employee"). This Agreement is issued on{" "}
                        {formatDate(validatedPreview.issueDate)} and employment commences on {formatDate(validatedPreview.startDate)}.
                      </p>

                      <div className="space-y-1">
                        <p className="font-semibold text-gray-900">Remuneration summary</p>
                        <p>
                          The Employee will receive {salaryDisplay} before statutory deductions and will report to{" "}
                          {validatedPreview.reportsTo}. The Employer may review compensation periodically at its discretion.
                        </p>
                      </div>

                      {clauses.map((clause, idx) => (
                        <div key={clause.title} className="space-y-1">
                          <h3 className="font-semibold text-black">{clause.title}</h3>
                          <div className="grid grid-cols-[auto,1fr] gap-2 text-justify">
                            <span className="font-semibold">{idx + 1}.</span>
                            <p className="text-justify">{clause.body}</p>
                          </div>
                        </div>
                      ))}

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
                      {["For the Employer", "Employee"].map((label) => (
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
