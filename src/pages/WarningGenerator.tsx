import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, FileText, X, Info, ArrowLeft, ArrowRight, RotateCcw, Building2, User2, Briefcase, Check, TriangleAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import { warningGeneratorSchema } from "@/lib/validation";
import type { Tables } from "@/integrations/supabase/types";
import type { WarningGeneratorFormData } from "@/lib/validation";

const MISCONDUCT_TYPES = [
  "Unauthorised Absenteeism",
  "Poor Time Keeping",
  "Sleeping On Duty",
  "Using Phone on Duty",
  "Insubordination",
  "Insolent Behaviour",
  "Unauthorised Possession",
  "Unauthorised Excess",
  "Unauthorised Removal",
  "Testing Positive for Alcohol",
  "Intoxicated at Work",
  "Dereliction of Duties",
  "Negligence",
  "Dishonesty",
  "Breach of Policy",
  "Breach of Rule(s)",
  "Breach of Procedure",
];

type EmployeePrefillState = {
  employeeName?: string;
  employeeSurname?: string;
  employeeIdNumber?: string;
};

const isEmployeePrefillState = (value: unknown): value is EmployeePrefillState => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return ["employeeName", "employeeSurname", "employeeIdNumber"].every((key) => {
    if (!(key in candidate)) return true;
    return typeof candidate[key] === "string";
  });
};

type WarningFormData = {
  employeeId: string;
  validityMonths: string;
  warningType: WarningGeneratorFormData["warningType"] | "";
} & Pick<
  WarningGeneratorFormData,
  | "tradingName"
  | "employeeName"
  | "employeeSurname"
  | "employeeIdNumber"
  | "issuedBy"
  | "dateIssued"
  | "misconductTypes"
  | "description"
>;

type WarningEmployee = Pick<Tables<"employees">, "id" | "employee_name" | "employee_surname" | "id_number">;

const extractErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "errors" in error) {
    const parsed = error as { errors?: Array<{ message?: string }> };
    const message = parsed.errors?.[0]?.message;
    if (message) {
      return message;
    }
  }

  if (error instanceof Error) {
    return error.message || "Something went wrong. Please try again.";
  }

  return "Something went wrong. Please try again.";
};
const WarningGenerator = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [employees, setEmployees] = useState<WarningEmployee[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [misconductSearch, setMisconductSearch] = useState("");
  const [isMisconductMenuOpen, setIsMisconductMenuOpen] = useState(false);
  const misconductPopoverRef = useRef<HTMLDivElement | null>(null);
  const [warningSelectResetCount, setWarningSelectResetCount] = useState(0);
  const [conductOffences, setConductOffences] = useState<
    { category: "Minor" | "Serious" | "Dismissible"; name: string; firstOutcome: string }[]
  >([]);
  const [warningOverride, setWarningOverride] = useState<{
    open: boolean;
    message: string;
    next: WarningGeneratorFormData["warningType"] | "";
  }>({ open: false, message: "", next: "" });
  const [warningSelectOpen, setWarningSelectOpen] = useState(false);
  const [dismissibleOverride, setDismissibleOverride] = useState<{
    open: boolean;
    pending: string | null;
  }>({ open: false, pending: null });
  const [formData, setFormData] = useState<WarningFormData>({
    tradingName: "",
    employeeId: "",
    employeeName: "",
    employeeSurname: "",
    employeeIdNumber: "",
    warningType: "" as WarningGeneratorFormData["warningType"] | "",
    validityMonths: "",
    issuedBy: "",
    dateIssued: new Date().toISOString().split("T")[0],
    misconductTypes: [] as string[],
    description: "",
  });
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const steps = ["Employer Details", "Employee Details", "Warning Details"] as const;
  const stepIcons = [Building2, User2, TriangleAlert] as const;
  const [activeStep, setActiveStep] = useState(0);
  const [showFinalActions, setShowFinalActions] = useState(false);
  const snippetPaddingTopMm = 2;
  const snippetVisibleHeightMm = 297 / 2;
  const snippetContainerWidthMm = 150;
  const snippetScale = useMemo(
    () =>
      Math.min(
        (snippetContainerWidthMm - 4) / 210,
        (160 - snippetPaddingTopMm) / snippetVisibleHeightMm,
      ),
    [snippetContainerWidthMm, snippetPaddingTopMm, snippetVisibleHeightMm],
  );

  useEffect(() => {
    if (formData.misconductTypes.length === 0) {
      setFormData((prev) => {
        if (!prev.warningType && !prev.validityMonths) return prev;
        return { ...prev, warningType: "", validityMonths: "" };
      });
      setWarningSelectOpen(false);
    }
  }, [formData.misconductTypes.length]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (isEmployeePrefillState(location.state)) {
      const { employeeName, employeeSurname, employeeIdNumber } = location.state;
      if (employeeName || employeeSurname || employeeIdNumber) {
        setFormData((prev) => ({
          ...prev,
          employeeName: employeeName || "",
          employeeSurname: employeeSurname || "",
          employeeIdNumber: employeeIdNumber || "",
        }));
      }
    }
  }, [location.state]);

  const fetchProfile = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (data) {
      setProfile(data);
    }
  }, [user]);

  const fetchEmployees = useCallback(async () => {
    if (!user) return;

    const { data } = await (supabase as any)
      .from("employees")
      .select("id, employee_name, employee_surname, id_number")
      .eq("company_id", user.id);

    if (data) {
      setEmployees(data);
    }
  }, [user]);

  const fetchConductOffences = useCallback(async () => {
    if (!user) return;
    const { data, error } = await (supabase as any)
      .from("company_code_of_conduct")
      .select("data")
      .eq("company_id", user.id)
      .maybeSingle();

    if (error) {
      console.warn("Unable to load conduct offences", error);
      return;
    }

    const sections =
      (
        data?.data as {
          sections?: Array<{
            title?: string;
            offences?: Array<{ name?: string; category?: string; first?: string }>;
          }>;
        }
      )?.sections ?? [];

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
        (item): item is { name: string; category: "Minor" | "Serious" | "Dismissible"; firstOutcome: string } =>
          Boolean(item?.name),
      );

    if (mapped.length > 0) {
      setConductOffences(mapped);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchEmployees();
      fetchConductOffences();
    }
  }, [user, fetchProfile, fetchEmployees, fetchConductOffences]);

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
    if (category === "Minor") return "border-emerald-500 data-[state=checked]:bg-emerald-100 data-[state=checked]:border-emerald-600 text-emerald-700";
    if (category === "Serious") return "border-amber-500 data-[state=checked]:bg-amber-100 data-[state=checked]:border-amber-600 text-amber-700";
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

  const outcomeSeverity = (outcome: string): number => {
    const value = outcome.toLowerCase();
    if (value.includes("dismiss")) return 5;
    if (value.includes("final")) return 4;
    if (value.includes("serious")) return 3;
    if (value.includes("second")) return 2;
    if (value.includes("first")) return 1;
    return 0;
  };

  const severityFromWarningType = (value: WarningGeneratorFormData["warningType"] | ""): number => {
    switch (value) {
      case "first":
        return 1;
      case "second":
        return 2;
      case "serious":
        return 3;
      case "final":
        return 4;
      default:
        return 0;
    }
  };

  const mostRestrictiveOutcome = (selectedTypes: string[]) => {
    const matches = selectedTypes
      .map((type) => {
        const offence = conductOffences.find((item) => item.name === type);
        const severity = offence ? outcomeSeverity(offence.firstOutcome) : 0;
        return { type, severity, outcome: offence?.firstOutcome ?? "" };
      })
      .filter((item) => item.severity > 0);

    if (matches.length === 0) return null;
    return matches.reduce((prev, curr) => (curr.severity > prev.severity ? curr : prev), matches[0]);
  };

  const applyWarningType = (value: WarningGeneratorFormData["warningType"] | "") => {
    const validityMap: Record<WarningGeneratorFormData["warningType"], string> = {
      first: "6",
      second: "6",
      serious: "9",
      final: "12",
    };
    if (!value) {
      setFormData((prev) => ({ ...prev, warningType: "", validityMonths: "" }));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      warningType: value,
      validityMonths: validityMap[value] || "",
    }));
  };

  const resetWarningSelection = () => {
    setFormData((prev) => ({ ...prev, warningType: "", validityMonths: "" }));
    setWarningSelectResetCount((prev) => prev + 1);
  };

  const confirmOverrideWarning = (accepted: boolean) => {
    if (accepted && warningOverride.next) {
      applyWarningType(warningOverride.next);
    } else {
      resetWarningSelection();
    }
    setWarningOverride({ open: false, message: "", next: "" });
    setWarningSelectOpen(false);
  };

  const updateMisconductTypes = (updater: (prev: string[]) => string[]) => {
    setFormData((prev) => {
      const next = updater(prev.misconductTypes);
      const shouldResetWarning = next.length === 0;
      return {
        ...prev,
        misconductTypes: next,
        warningType: shouldResetWarning ? "" : prev.warningType,
        validityMonths: shouldResetWarning ? "" : prev.validityMonths,
      };
    });
  };

  const handleConfirmDismissible = (accept: boolean) => {
    if (accept && dismissibleOverride.pending) {
      updateMisconductTypes((prev) => {
        if (prev.includes(dismissibleOverride.pending!)) return prev;
        return [...prev, dismissibleOverride.pending!];
      });
    }
    setDismissibleOverride({ open: false, pending: null });
  };

  const handleMisconductMenuOpenChange = (open: boolean) => {
    setIsMisconductMenuOpen(open);
    if (!open) {
      setMisconductSearch("");
    }
  };

  useEffect(() => {
    if (!isMisconductMenuOpen) return;
    const handleScrollClose = (event: Event) => {
      const target = event.target as Node | null;
      if (target && misconductPopoverRef.current?.contains(target)) {
        return; // allow internal scrolling without closing
      }
      handleMisconductMenuOpenChange(false);
    };
    window.addEventListener("scroll", handleScrollClose, true);
    return () => window.removeEventListener("scroll", handleScrollClose, true);
  }, [isMisconductMenuOpen]);

  const handleMisconductSelect = (type: string) => {
    const isSelected = formData.misconductTypes.includes(type);
    if (isSelected) {
      updateMisconductTypes((prev) => prev.filter((item) => item !== type));
      return;
    }

    const newCategory = getMisconductCategory(type);
    const currentCategory =
      formData.misconductTypes.length > 0 ? getMisconductCategory(formData.misconductTypes[0]) : null;
    if (newCategory === "Dismissible") {
      setDismissibleOverride({ open: true, pending: type });
      return;
    }
    if (currentCategory && newCategory !== currentCategory) {
      toast({
        title: "Choose one category",
        description: "Select misconduct types from the same category only.",
        variant: "destructive",
      });
      return;
    }

    updateMisconductTypes((prev) => [...prev, type]);
  };

  const handleWarningSelectOpenChange = (open: boolean) => {
    if (open && formData.misconductTypes.length === 0) {
      toast({
        title: "Misconduct required",
        description: "Please select misconduct type(s) before choosing a warning type.",
        variant: "destructive",
      });
      setWarningSelectOpen(false);
      return;
    }
    setWarningSelectOpen(open);
  };

  const pulseShadowStyles = `
    @keyframes pulseShadow {
      0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.45); }
      70% { box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); }
      100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
    }
    @keyframes pulseText {
      0% { text-shadow: 0 0 0 rgba(220, 38, 38, 0.6); }
      50% { text-shadow: 0 0 12px rgba(220, 38, 38, 0.6); }
      100% { text-shadow: 0 0 0 rgba(220, 38, 38, 0.6); }
    }
  `;

  const handleWarningTypeChange = (value: WarningGeneratorFormData["warningType"]) => {
    const validityMap: Record<WarningGeneratorFormData["warningType"], string> = {
      first: "6",
      second: "6",
      serious: "9",
      final: "12",
    };

    const selectionRequirement = mostRestrictiveOutcome(formData.misconductTypes);
    const newSeverity = severityFromWarningType(value);

    if (selectionRequirement && newSeverity > 0 && selectionRequirement.severity > newSeverity) {
      const prescribed = selectionRequirement.outcome || "a higher warning";
      resetWarningSelection();
      setWarningSelectOpen(false);
      setWarningOverride({
        open: true,
        message: `The Code of Conduct prescribes "${prescribed}" for ${selectionRequirement.type}. Override and use "${value}" instead?`,
        next: value,
      });
      return;
    }

    setFormData({
      ...formData,
      warningType: value,
      validityMonths: validityMap[value] || "",
    });
  };

  const handleEmployeeSelect = (employeeId: string) => {
    const employee = employees.find((e) => e.id === employeeId);
    if (employee) {
      setFormData({
        ...formData,
        employeeId,
        employeeName: employee.employee_name,
        employeeSurname: employee.employee_surname,
        employeeIdNumber: employee.id_number ?? "",
      });
    }
  };

  const generatePDF = (download = false) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    let yPosition = 15;

    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("DISCIPLINARY WARNING NOTICE", pageWidth / 2, yPosition, { align: "center" });
    
    yPosition += 10;

        // Company Details Section
    const labelWidth = 40; // bring value column closer to labels
    const lineHeight = 5;
    const drawSectionTitle = (label: string) => {
      const sectionHeight = 8;
      doc.setFillColor(240, 240, 240);
      doc.setDrawColor(200, 200, 200);
      doc.roundedRect(margin, yPosition, contentWidth, sectionHeight, 2, 2, "FD");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(80, 80, 80);
      doc.text(label, margin + 4, yPosition + sectionHeight - 2);
      yPosition += sectionHeight + 6;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
    };

    const renderLabelValue = (label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, margin, yPosition);
      doc.setFont("helvetica", "normal");
      const text = value || "-";
      const lines = doc.splitTextToSize(text, contentWidth - labelWidth - 4);
      doc.text(lines, margin + labelWidth, yPosition);
      yPosition += Math.max(lines.length * lineHeight, lineHeight);
    };

    const formatDateForPdf = (value: string) => {
      if (!value) return "-";
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return value;
      return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    if (profile) {
      drawSectionTitle("A. EMPLOYER DETAILS");
      renderLabelValue("Company Name:", profile.company_name || "-");
      renderLabelValue("Reg No:", profile.registration_number || "-");
      renderLabelValue("Company Address:", profile.physical_address || "-");
      if (formData.tradingName) {
        renderLabelValue("Trading As:", formData.tradingName);
      }
      yPosition += 4;
    }

    drawSectionTitle("B. EMPLOYEE DETAILS");
    renderLabelValue("Employee Name:", `${formData.employeeName} ${formData.employeeSurname}`.trim() || "-");
    renderLabelValue("ID Number:", formData.employeeIdNumber || "-");
    yPosition += 4;

    const warningTypeText = {
      first: "First Written Warning",
      second: "Second Written Warning",
      serious: "Serious Written Warning",
      final: "Final Written Warning",
    }[formData.warningType] || formData.warningType || "-";

    drawSectionTitle("C. WARNING DETAILS");
    const offenceText = formData.misconductTypes.length > 0 ? formData.misconductTypes.join(", ") : "-";
    renderLabelValue("Offence(s):", offenceText);
    renderLabelValue("Description:", formData.description || "-");
    renderLabelValue("Warning Type:", warningTypeText);
    renderLabelValue("Validity Period:", formData.validityMonths ? `${formData.validityMonths} months` : "-");
    renderLabelValue("Issued By:", formData.issuedBy || "-");
    renderLabelValue("Issue Date:", formatDateForPdf(formData.dateIssued));
    yPosition += 4;

    drawSectionTitle("D. CONSEQUENCES");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const consequencesText =
      "You are required to refrain completely from committing any further acts of misconduct. Should you commit the same or similar act of misconduct within the validity period of this warning, progressive disciplinary action will be taken which could lead to your dismissal.";
    const consequencesLines = doc.splitTextToSize(consequencesText, contentWidth);
    doc.text(consequencesLines, margin, yPosition);
    yPosition += consequencesLines.length * 4.5 + 4;

    drawSectionTitle("E. SIGNATURES");
    yPosition += 6; // add space above first signature line
    
    const signaturePairs: [string, string][] = [
      ["Employer/Issuer", "Employee"],
      ["Representative", "Interpreter"],
      ["Witness 1 (optional)", "Witness 2 (optional)"],
    ];
    const colGap = 20; // smaller gap to bring the right column left
    const colWidth = (contentWidth - colGap) / 2;
    const rowHeight = 18;
    const sigLineLength = 39; // reduced ~40%
    const dateLineLength = 22; // reduced further
    const lineOffset = 0;

    const drawSignatureBlock = (label: string, x: number, y: number) => {
      const dateX = x + sigLineLength + 12;
      doc.setDrawColor(170, 170, 170); // lighter grey lines
      doc.line(x, y, x + sigLineLength, y);
      doc.line(dateX, y, dateX + dateLineLength, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0); // labels in black
      doc.text(label, x, y + lineOffset + 3);
      doc.text("Date", dateX, y + lineOffset + 3);
    };

    signaturePairs.forEach((pair, row) => {
      const yRow = yPosition + row * rowHeight;
      drawSignatureBlock(pair[0], margin, yRow);
      drawSignatureBlock(pair[1], margin + colWidth + colGap, yRow);
    });

    yPosition += signaturePairs.length * rowHeight - 4; // tighten spacing before refusal box
    const footerText =
      "If the employee refuses to sign this warning, the witness's signature will confirm that the employee did receive the warning and that the contents were explained to him/her.";
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(70, 74, 78);
    const footerPaddingX = 4;
    const footerPaddingY = 2;
    const footerLines = doc.splitTextToSize(footerText, contentWidth - footerPaddingX * 2);
    const footerBoxHeight = footerLines.length * 4 + footerPaddingY * 2;
    doc.setFillColor(247, 249, 251);
    doc.setDrawColor(200, 200, 200);
    doc.roundedRect(margin, yPosition, contentWidth, footerBoxHeight, 2, 2, "FD");
    doc.text(footerLines, margin + footerPaddingX, yPosition + footerPaddingY + 3);

    if (download) {
      doc.save(`Warning_${formData.employeeSurname}_${formData.dateIssued}.pdf`);
    } else {
      const blob = doc.output("blob");
      setPdfBlob(blob);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);

    try {
      // Validate and sanitize input
      const validatedData = warningGeneratorSchema.parse({
        tradingName: formData.tradingName,
        employeeName: formData.employeeName,
        employeeSurname: formData.employeeSurname,
        employeeIdNumber: formData.employeeIdNumber,
        warningType: formData.warningType,
        validityMonths: formData.validityMonths,
        issuedBy: formData.issuedBy,
        dateIssued: formData.dateIssued,
        misconductTypes: formData.misconductTypes,
        description: formData.description,
      });

      const { error } = await supabase.from("documents").insert({
        company_id: user.id,
        employee_id: formData.employeeId || null,
        trading_name: validatedData.tradingName,
        employee_name: validatedData.employeeName,
        employee_surname: validatedData.employeeSurname,
        employee_id_number: validatedData.employeeIdNumber,
        warning_type: validatedData.warningType,
        validity_months: validatedData.validityMonths,
        issued_by: validatedData.issuedBy,
        date_issued: validatedData.dateIssued,
        misconduct: validatedData.misconductTypes.join(", "),
        description: validatedData.description,
        dates_committed: "",
      });

      if (error) throw error;

      generatePDF(true);

      toast({
        title: "Success",
        description: "Warning document generated and saved!",
      });

      handleResetForm();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: extractErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = () => {
    if (formData.misconductTypes.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one misconduct type",
        variant: "destructive",
      });
      return;
    }
    if (!formData.description || !formData.employeeName || !formData.employeeSurname || 
        !formData.employeeIdNumber || !formData.warningType || !formData.issuedBy) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    setShowPreview(true);
  };

  const handleDownload = () => {
    if (formData.misconductTypes.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one misconduct type",
        variant: "destructive",
      });
      return;
    }
    generatePDF(true);
  };

  const handleResetForm = () => {
    setFormData({
      tradingName: "",
      employeeId: "",
      employeeName: "",
      employeeSurname: "",
      employeeIdNumber: "",
      warningType: "" as WarningGeneratorFormData["warningType"] | "",
      validityMonths: "",
      issuedBy: "",
      dateIssued: new Date().toISOString().split("T")[0],
      misconductTypes: [],
      description: "",
    });
    setPdfBlob(null);
    setWarningSelectOpen(false);
    setIsMisconductMenuOpen(false);
    setActiveStep(0);
    setShowFinalActions(false);
    resetWarningSelection();
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const isFormValid = () => {
    return (
      formData.misconductTypes.length > 0 &&
      formData.description &&
      formData.employeeName &&
      formData.employeeSurname &&
      formData.employeeIdNumber &&
      formData.warningType &&
      formData.issuedBy
    );
  };

  const isEmployerStepComplete = true;
  const isEmployeeStepComplete = useMemo(
    () => Boolean(formData.employeeName && formData.employeeSurname && formData.employeeIdNumber),
    [formData.employeeIdNumber, formData.employeeName, formData.employeeSurname],
  );
  const isWarningStepComplete = useMemo(
    () =>
      Boolean(
        formData.misconductTypes.length > 0 &&
          formData.description &&
          formData.employeeName &&
          formData.employeeSurname &&
          formData.employeeIdNumber &&
          formData.warningType &&
          formData.issuedBy,
      ),
    [
      formData.description,
      formData.employeeIdNumber,
      formData.employeeName,
      formData.employeeSurname,
      formData.issuedBy,
      formData.misconductTypes.length,
      formData.warningType,
    ],
  );

  const canGoNext = useMemo(() => {
    if (showFinalActions) return false;
    if (activeStep === 0) return isEmployerStepComplete;
    if (activeStep === 1) return isEmployeeStepComplete;
    if (activeStep === 2) return isWarningStepComplete;
    return false;
  }, [activeStep, isEmployeeStepComplete, isEmployerStepComplete, isWarningStepComplete, showFinalActions]);

  const handleNext = () => {
    if (activeStep >= steps.length - 1) return;
    if (!canGoNext) return;
    setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    if (showFinalActions) {
      setShowFinalActions(false);
      setActiveStep(steps.length - 1);
      return;
    }
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const handleFinish = () => {
    if (!isFormValid()) {
      toast({
        title: "Validation Error",
        description: "Please complete all required fields before finishing.",
        variant: "destructive",
      });
      return;
    }
    setShowFinalActions(true);
  };

  const toggleMisconductType = (type: string) => {
    updateMisconductTypes((prev) => prev.filter((t) => t !== type));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const warningSelectKey = `${formData.misconductTypes.join("|") || "empty"}-${formData.warningType || "none"}-${warningSelectResetCount}`;
  const isFinalizedCurrent = showFinalActions && activeStep === steps.length - 1;
  const renderPreviewPage = () => (
    <div className="bg-white text-black px-8 pt-2 pb-8 mx-auto" style={{ width: "210mm", minHeight: "297mm" }}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-center">
        <h1 className="text-2xl font-bold text-black">DISCIPLINARY WARNING NOTICE</h1>
      </div>

      <div className="space-y-5 text-sm text-black">
        {/* Employer Details */}
        {profile && (
          <div className="space-y-2">
            <div className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-xs font-semibold uppercase">
              A. Employer Details
            </div>
            <div className="text-xs space-y-1">
              <div className="grid grid-cols-[140px,1fr] gap-2">
                <span className="font-semibold">Company Name:</span>
                <span>{profile.company_name}</span>
              </div>
              <div className="grid grid-cols-[140px,1fr] gap-2">
                <span className="font-semibold">Reg No:</span>
                <span>{profile.registration_number}</span>
              </div>
              <div className="grid grid-cols-[140px,1fr] gap-2">
                <span className="font-semibold">Company Address:</span>
                <span>{profile.physical_address}</span>
              </div>
              {formData.tradingName && (
                <div className="grid grid-cols-[140px,1fr] gap-2">
                  <span className="font-semibold">Trading As:</span>
                  <span>{formData.tradingName}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Employee Details */}
        <div className="space-y-2">
          <div className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-xs font-semibold uppercase">
            B. Employee Details
          </div>
          <div className="text-xs space-y-1">
            <div className="grid grid-cols-[140px,1fr] gap-2">
              <span className="font-semibold">Employee Name:</span>
              <span>
                {formData.employeeName} {formData.employeeSurname}
              </span>
            </div>
            <div className="grid grid-cols-[140px,1fr] gap-2">
              <span className="font-semibold">ID Number:</span>
              <span>{formData.employeeIdNumber}</span>
            </div>
          </div>
        </div>

        {/* Warning Details */}
        <div className="space-y-2">
          <div className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-xs font-semibold uppercase">
            C. Warning Details
          </div>
          <div className="text-xs space-y-2">
            <div className="grid grid-cols-[140px,1fr] gap-2">
              <span className="font-semibold">Offence(s):</span>
              <span>{formData.misconductTypes.length > 0 ? formData.misconductTypes.join(", ") : "-"}</span>
            </div>
            <div className="grid grid-cols-[140px,1fr] gap-2">
              <span className="font-semibold">Description:</span>
              <span className="whitespace-pre-wrap">{formData.description || "-"}</span>
            </div>
            <div className="grid grid-cols-[140px,1fr] gap-2">
              <span className="font-semibold">Warning Type:</span>
              <span>
                {{
                  first: "First Written Warning",
                  second: "Second Written Warning",
                  serious: "Serious Written Warning",
                  final: "Final Written Warning",
                }[formData.warningType] || formData.warningType || "-"}
              </span>
            </div>
            <div className="grid grid-cols-[140px,1fr] gap-2">
              <span className="font-semibold">Validity Period:</span>
              <span>{formData.validityMonths ? `${formData.validityMonths} months` : "-"}</span>
            </div>
            <div className="grid grid-cols-[140px,1fr] gap-2">
              <span className="font-semibold">Issued By:</span>
              <span>{formData.issuedBy || "-"}</span>
            </div>
            <div className="grid grid-cols-[140px,1fr] gap-2">
              <span className="font-semibold">Issue Date:</span>
              <span>
                {(() => {
                  if (!formData.dateIssued) return "-";
                  const parsed = new Date(formData.dateIssued);
                  if (Number.isNaN(parsed.getTime())) return formData.dateIssued;
                  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
                })()}
              </span>
            </div>
          </div>
        </div>

        {/* Consequences */}
        <div className="space-y-2">
          <div className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-xs font-semibold uppercase">
            D. Consequences
          </div>
          <p className="text-xs leading-5">
            You are required to refrain completely from committing any further acts of misconduct. Should you commit the same or similar act of misconduct within the validity period of this warning, progressive disciplinary action will be taken which could lead to your dismissal.
          </p>
        </div>

        {/* Signatures */}
        <div className="space-y-6">
          <div className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-xs font-semibold uppercase">
            E. Signatures
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 text-xs mt-4">
            {[
              "Employer/Issuer",
              "Employee",
              "Representative",
              "Interpreter",
              "Witness 1 (optional)",
              "Witness 2 (optional)",
            ].map((label, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center gap-8">
                  <span className="flex-1 border-b border-black"></span>
                  <span className="w-24 border-b border-black"></span>
                </div>
                <div className="flex items-center gap-8 text-[11px]">
                  <span className="flex-1">{label}</span>
                  <span className="w-24">Date</span>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-[10px] italic text-gray-700">
            If the employee refuses to sign this warning, the witness's signature will confirm that the employee did receive the warning and that the contents were explained to him/her.
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <style>{pulseShadowStyles}</style>
      <div className="space-y-6 -ml-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => navigate("/documents/discipline")}
              className="text-xs font-semibold tracking-wide text-slate-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-sm"
            >
              Documents &gt; Discipline
            </button>
            <h1 className="text-xl font-bold uppercase text-blue-700">Generate Written Warning</h1>
            <p className="text-xs text-gray-600">Complete the form below to generate a compliant written warning.</p>
          </div>
        </div>

        <Card className="shadow-xl border border-blue-100/70 bg-white/95 shadow-blue-100/60">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-center gap-4 w-full">
              {steps.map((label, index) => {
                const Icon = stepIcons[index];
                const isDone = index < activeStep || isFinalizedCurrent;
                const isActive = index === activeStep && !isFinalizedCurrent;
                const canClick = isFinalizedCurrent || index < activeStep;
                return (
                  <div key={label} className="flex items-center gap-4">
                    <button
                      type="button"
                      disabled={!canClick}
                      onClick={() => {
                        setShowFinalActions(false);
                        if (canClick) setActiveStep(index);
                      }}
                      className={`flex flex-col items-start gap-1 transition ${
                        canClick
                          ? "cursor-pointer hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-md"
                          : "cursor-default"
                      }`}
                    >
                      <div
                        className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold leading-none ${
                          isDone
                            ? "bg-[#e9f9ee] border-[#b6e6c1] text-[#038314]"
                            : isActive
                              ? "bg-blue-100 border-blue-300 text-blue-800"
                              : "bg-white border-slate-200 text-slate-600"
                        }`}
                      >
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full ${
                            isDone
                              ? "bg-[#04b81f] text-white"
                              : isActive
                                ? "bg-blue-500 text-white"
                                : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          {isDone ? <Check className="h-5 w-5 -translate-y-[1px]" /> : <Icon className="h-5 w-5 -translate-y-[1px]" />}
                        </span>
                          <span className="text-sm font-semibold">{label}</span>
                        </div>
                      </button>
                      {index < steps.length - 1 ? (
                      <div
                        className={`h-px w-16 ${
                          index < activeStep || isFinalizedCurrent ? "bg-[#04b81f]" : "bg-slate-200"
                        }`}
                      />
                      ) : null}
                    </div>
                  );
                })}
            </div>
          </CardHeader>

          {showFinalActions ? (
            <CardContent className="space-y-6 pt-2">
              <div className="flex flex-col items-center gap-4">
                <div
                  className="bg-white overflow-hidden rounded mx-auto box-border border border-blue-200 shadow-inner"
                  style={{
                    width: `${snippetContainerWidthMm}mm`,
                    height: `${snippetPaddingTopMm + snippetVisibleHeightMm * snippetScale}mm`,
                  }}
                >
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
                      <div style={{ height: "297mm", overflow: "hidden" }}>{renderPreviewPage()}</div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex items-center justify-center gap-3">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handlePreview}
                          disabled={isLoading}
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
                          disabled={isLoading}
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
                </div>
                <div className="flex w-full items-center gap-2">
                  <div className="flex-none">
                    <Button
                      variant="outline"
                      onClick={handleBack}
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
          ) : (
            <CardContent className="pt-2">
              <form onSubmit={handleSubmit} className="space-y-6">
              {activeStep === 0 && (
                <div className="space-y-4 rounded-xl border border-blue-200 bg-slate-50/70 p-4 shadow-sm">
                  <div className="space-y-2">
                    <Label htmlFor="tradingName">Trading Name (optional)</Label>
                    <Input
                      id="tradingName"
                      value={formData.tradingName}
                      onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
                      placeholder="Enter trading name if different from company name"
                      className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600">Company name</Label>
                      <div className="rounded-md border border-blue-100 bg-white px-3 py-2 text-sm text-slate-800">
                        {profile?.company_name || "Not set"}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-600">Registration number</Label>
                      <div className="rounded-md border border-blue-100 bg-white px-3 py-2 text-sm text-slate-800">
                        {profile?.registration_number || "Not set"}
                      </div>
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-xs text-slate-600">Company address</Label>
                      <div className="rounded-md border border-blue-100 bg-white px-3 py-2 text-sm text-slate-800">
                        {profile?.physical_address || "Not set"}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600">
                    We'll pull employer details from your profile automatically; add a trading name if needed.
                  </p>
                </div>
              )}

              {activeStep === 1 && (
                <div className="space-y-4 rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
                  <h3 className="font-semibold text-lg">Employee Information</h3>
                  <div className="space-y-2">
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
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="employeeName">Employee Name *</Label>
                      <Input
                        id="employeeName"
                        value={formData.employeeName}
                        onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
                        required
                        className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employeeSurname">Employee Surname *</Label>
                      <Input
                        id="employeeSurname"
                        value={formData.employeeSurname}
                        onChange={(e) => setFormData({ ...formData, employeeSurname: e.target.value })}
                        required
                        className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employeeIdNumber">ID Number *</Label>
                      <Input
                        id="employeeIdNumber"
                        value={formData.employeeIdNumber}
                        onChange={(e) => setFormData({ ...formData, employeeIdNumber: e.target.value })}
                        required
                        className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeStep === 2 && (
                <div className="space-y-4 rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg text-gray-900">Warning Information</h3>
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 border border-blue-100">
                      Step 3 of 3
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <Label>Misconduct Type(s) *</Label>
                    <Popover open={isMisconductMenuOpen} onOpenChange={handleMisconductMenuOpenChange}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-900"
                          type="button"
                        >
                          {formData.misconductTypes.length === 0
                            ? "Select misconduct type(s)"
                            : `${formData.misconductTypes.length} type(s) selected`}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent ref={misconductPopoverRef} className="w-[420px] p-4" align="start">
                        <div className="space-y-3">
                          <Input
                            placeholder="Search misconduct types"
                            value={misconductSearch}
                            onChange={(e) => setMisconductSearch(e.target.value)}
                          />
                          <ScrollArea className="h-56 rounded-md border border-muted">
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
                                        className={`flex items-center gap-2 text-sm cursor-pointer ${misconductColorClasses(item.category)}`}
                                      >
                                        <Checkbox
                                          checked={formData.misconductTypes.includes(item.name)}
                                          onCheckedChange={() => handleMisconductSelect(item.name)}
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
                          {formData.misconductTypes.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Selected</p>
                              <div className="flex flex-wrap gap-2">
                                {formData.misconductTypes.map((type) => {
                                  const category = getMisconductCategory(type);
                                  return (
                                    <Badge
                                      key={type}
                                      variant="secondary"
                                      className={`gap-1 ${misconductColorClasses(category)}`}
                                    >
                                      {type}
                                      <X className="h-3 w-3 cursor-pointer" onClick={() => toggleMisconductType(type)} />
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                    {formData.misconductTypes.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.misconductTypes.map((type) => (
                          <Badge
                            key={type}
                            variant="secondary"
                            className={`gap-1 ${misconductColorClasses(getMisconductCategory(type))}`}
                          >
                            {type}
                            <X
                              className="h-3 w-3 cursor-pointer"
                              onClick={() => toggleMisconductType(type)}
                            />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description of Misconduct *</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Provide specific details about the misconduct incident(s) including dates"
                      rows={5}
                      required
                      className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="warningType">Type of Warning *</Label>
                      <Select
                        key={warningSelectKey}
                        onValueChange={handleWarningTypeChange}
                        value={formData.warningType || undefined}
                        open={warningSelectOpen}
                        onOpenChange={handleWarningSelectOpenChange}
                        required
                      >
                        <SelectTrigger className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900">
                          <SelectValue placeholder="Select warning type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="first">First Written Warning</SelectItem>
                          <SelectItem value="second">Second Written Warning</SelectItem>
                          <SelectItem value="serious">Serious Written Warning</SelectItem>
                          <SelectItem value="final">Final Written Warning</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="validityMonths">Validity Period (months) *</Label>
                      <Input
                        id="validityMonths"
                        type="number"
                        value={formData.validityMonths}
                        onChange={(e) => setFormData({ ...formData, validityMonths: e.target.value })}
                        required
                        readOnly
                        className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="issuedBy">Issued By *</Label>
                      <Input
                        id="issuedBy"
                        value={formData.issuedBy}
                        onChange={(e) => setFormData({ ...formData, issuedBy: e.target.value })}
                        required
                        className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dateIssued">Date of Issue *</Label>
                      <Input
                        id="dateIssued"
                        type="date"
                        value={formData.dateIssued}
                        onChange={(e) => setFormData({ ...formData, dateIssued: e.target.value })}
                        required
                        className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 pt-2 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Info className="h-3.5 w-3.5 text-blue-600" />
                      <span>Misconduct types must be from the same category; dismissible offences will prompt confirmation.</span>
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
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleResetForm}
                        disabled={isLoading}
                        className="gap-2 text-slate-700 hover:text-blue-600 hover:bg-white transition-transform duration-200 hover:scale-105 disabled:text-slate-300"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Reset form
                      </Button>
                    </div>
                    <div className="flex-none relative">
                      <Button
                        type="button"
                        onClick={handleFinish}
                        disabled={!isWarningStepComplete || isLoading}
                        className={`gap-2 min-w-[140px] text-white disabled:opacity-50 transition-colors duration-150 ${
                          isWarningStepComplete && !isLoading
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
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              </form>
            </CardContent>
          )}
        </Card>
      </div>

        {/* Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl h-[90vh] p-0">
          <DialogHeader className="px-6 pt-4 pb-2 space-y-1">
            <DialogTitle className="text-blue-700 text-left text-base font-semibold">PREVIEW</DialogTitle>
            <DialogDescription className="text-xs text-slate-600 text-left">
              {`Review the disciplinary warning notice for ${formData.employeeName || "the employee"} ${formData.employeeSurname || ""}`.trim()}{" "}
              before downloading.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-full px-6 pb-6">
            {renderPreviewPage()}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={warningOverride.open} onOpenChange={(open) => !open && confirmOverrideWarning(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="space-y-4 text-center">
            <DialogTitle className="text-blue-700 text-xl w-full text-center">
              Caution
            </DialogTitle>
            <DialogDescription className="mt-8 block text-gray-700 text-center">
              {warningOverride.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4">
            <div className="flex w-full justify-center gap-2">
              <Button
                onClick={() => confirmOverrideWarning(false)}
                className="min-w-[120px] border-2 border-blue-600 bg-white text-blue-600 hover:bg-blue-600 hover:text-white text-base"
              >
                No
              </Button>
              <Button
                variant="outline"
                onClick={() => confirmOverrideWarning(true)}
                className="min-w-[90px] text-sm text-gray-700 hover:text-blue-700 hover:bg-white hover:border-blue-600"
              >
                Yes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dismissibleOverride.open} onOpenChange={(open) => !open && handleConfirmDismissible(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="space-y-4 text-center">
            <DialogTitle className="text-blue-700 text-xl w-full text-center">
              Caution
            </DialogTitle>
            <DialogDescription className="mt-8 block text-gray-700 text-center">
              Issuing a warning for a dismissible offence may impact the consistency of disciplinary action and negatively impact a case before the CCMA or Bargaining Council in case of future dismissals. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4">
            <div className="flex w-full justify-center gap-2">
              <Button
                onClick={() => handleConfirmDismissible(false)}
                className="min-w-[120px] border-2 border-blue-600 bg-white text-blue-600 hover:bg-blue-600 hover:text-white text-base"
              >
                No
              </Button>
              <Button
                variant="outline"
                onClick={() => handleConfirmDismissible(true)}
                className="min-w-[90px] text-sm text-gray-700 hover:text-blue-700 hover:bg-white hover:border-blue-600"
              >
                Yes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default WarningGenerator;



