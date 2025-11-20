import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, FileText, X, Info, ArrowLeft } from "lucide-react";
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
  const [employees, setEmployees] = useState<Tables<"employees">[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isMisconductDialogOpen, setIsMisconductDialogOpen] = useState(false);
  const [misconductSearch, setMisconductSearch] = useState("");
  const [pendingMisconductTypes, setPendingMisconductTypes] = useState<string[]>([]);
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
      if (employeeName && employeeSurname && employeeIdNumber) {
        setFormData((prev) => ({
          ...prev,
          employeeName,
          employeeSurname,
          employeeIdNumber,
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

    const { data } = await supabase
      .from("employees")
      .select("*")
      .eq("company_id", user.id);

    if (data) {
      setEmployees(data);
    }
  }, [user]);

  const fetchConductOffences = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
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

  const confirmOverrideWarning = (accepted: boolean) => {
    if (accepted && warningOverride.next) {
      applyWarningType(warningOverride.next);
    }
    setWarningOverride({ open: false, message: "", next: "" });
  };

  const handleConfirmDismissible = (accept: boolean) => {
    if (accept && dismissibleOverride.pending) {
      setPendingMisconductTypes((prev) => {
        const hasCategory = prev.length > 0 ? getMisconductCategory(prev[0]) : getMisconductCategory(dismissibleOverride.pending);
        if (hasCategory === "Dismissible") {
          // keep consistent; but disallow mixing with others already enforced
          return [...prev, dismissibleOverride.pending!];
        }
        return [...prev, dismissibleOverride.pending!];
      });
    }
    setDismissibleOverride({ open: false, pending: null });
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
    doc.text("WRITTEN WARNING", pageWidth / 2, yPosition, { align: "center" });
    
    yPosition += 10;

    // Company Details Section
    if (profile) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(37, 8, 211);

      doc.text("COMPANY INFORMATION", margin, yPosition);
      yPosition += 5;
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.text(`${profile.company_name}`, margin, yPosition);
      yPosition += 4;
      doc.text(`Reg No: ${profile.registration_number}`, margin, yPosition);
      yPosition += 4;
      doc.text(`${profile.physical_address}`, margin, yPosition);
      yPosition += 7;
    }

    if (formData.tradingName) {
      doc.setFontSize(9);
      doc.text(`Trading As: ${formData.tradingName}`, margin, yPosition);
      yPosition += 7;
    }

    // Divider line
    doc.setDrawColor(37, 8, 211);

    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 6;

    // Employee Details
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(37, 8, 211);
    doc.text("EMPLOYEE DETAILS", margin, yPosition);
    yPosition += 5;
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.text(`Name: ${formData.employeeName} ${formData.employeeSurname}`, margin, yPosition);
    yPosition += 4;
    doc.text(`ID Number: ${formData.employeeIdNumber}`, margin, yPosition);
    yPosition += 7;

    // Warning Details
    const warningTypeText = {
      first: "First Written Warning",
      second: "Second Written Warning",
      serious: "Serious Written Warning",
      final: "Final Written Warning",
    }[formData.warningType] || formData.warningType;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(37, 8, 211);
    doc.text("WARNING DETAILS", margin, yPosition);
    yPosition += 5;
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.text(`Type: ${warningTypeText}`, margin, yPosition);
    yPosition += 4;
    doc.text(`Validity: ${formData.validityMonths} months`, margin, yPosition);
    yPosition += 4;
    doc.text(`Issued By: ${formData.issuedBy}`, margin, yPosition);
    yPosition += 4;
    doc.text(`Date: ${formData.dateIssued}`, margin, yPosition);
    yPosition += 7;

    // Divider line
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 6;

    // Misconduct Types
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(37, 8, 211);
    doc.text("MISCONDUCT TYPE(S)", margin, yPosition);
    yPosition += 5;
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    formData.misconductTypes.forEach((type) => {
      doc.text(`• ${type}`, margin + 2, yPosition);
      yPosition += 4;
    });
    yPosition += 3;

    // Description
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(37, 8, 211);
    doc.text("DESCRIPTION OF MISCONDUCT", margin, yPosition);
    yPosition += 5;
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    const descriptionLines = doc.splitTextToSize(formData.description, contentWidth);
    doc.text(descriptionLines, margin, yPosition);
    yPosition += descriptionLines.length * 4.5 + 7;

    // Divider line
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 6;

    // Consequences
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(37, 8, 211);
    doc.text("CONSEQUENCES", margin, yPosition);
    yPosition += 5;
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    const consequencesText =
      "You are required to refrain completely from committing any further acts of misconduct. Should you commit the same or similar act of misconduct within the validity period of this warning, progressive disciplinary action will be taken which could lead to your dismissal.";
    const consequencesLines = doc.splitTextToSize(consequencesText, contentWidth);
    doc.text(consequencesLines, margin, yPosition);
    yPosition += consequencesLines.length * 4.5 + 8;

    // Divider line
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 6;

    // Signatures Section
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(37, 8, 211);
    doc.text("SIGNATURES", margin, yPosition);
    yPosition += 8;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    
    const signatureSpacing = 13;
    const signatures = [
      "Employer/Issuer",
      "Employee",
      "Representative",
      "Interpreter",
      "Witness"
    ];

    signatures.forEach((label) => {
      doc.text("___________________________________", margin, yPosition);
      doc.text("Date: ______________", 130, yPosition);
      yPosition += 4;
      doc.text(label, margin, yPosition);
      yPosition += signatureSpacing;
    });

    // Footer Note
    yPosition += 2;
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 100, 100);
    const footerText =
      "If the employee refuses to sign this warning, the witness's signature will confirm that the employee did receive the warning and that the contents were explained to him/her.";
    const footerLines = doc.splitTextToSize(footerText, contentWidth);
    doc.text(footerLines, margin, yPosition);

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

      handleDiscard();
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

  const handleDiscard = () => {
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
    navigate("/documents/discipline");
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

  const toggleMisconductType = (type: string) => {
    setFormData(prev => {
      const next = prev.misconductTypes.includes(type)
        ? prev.misconductTypes.filter(t => t !== type)
        : [...prev.misconductTypes, type];

      const shouldResetWarning = next.length === 0;

      return {
        ...prev,
        misconductTypes: next,
        warningType: shouldResetWarning ? "" : prev.warningType,
        validityMonths: shouldResetWarning ? "" : prev.validityMonths,
      };
    });
  };

  const togglePendingMisconductType = (type: string) => {
    setPendingMisconductTypes((prev) => {
      const isSelected = prev.includes(type);
      if (isSelected) {
        return prev.filter((item) => item !== type);
      }

      const newCategory = getMisconductCategory(type);
      const currentCategory = prev.length > 0 ? getMisconductCategory(prev[0]) : null;
      if (newCategory === "Dismissible") {
        setDismissibleOverride({ open: true, pending: type });
        return prev;
      }
      if (currentCategory && newCategory !== currentCategory) {
        toast({
          title: "Choose one category",
          description: "Select misconduct types from the same category only.",
          variant: "destructive",
        });
        return prev;
      }

      return [...prev, type];
    });
  };

  const openMisconductDialog = () => {
    setPendingMisconductTypes(formData.misconductTypes);
    setMisconductSearch("");
    setIsMisconductDialogOpen(true);
  };

  const closeMisconductDialog = () => {
    setIsMisconductDialogOpen(false);
    setMisconductSearch("");
  };

  const applyMisconductSelection = () => {
    setFormData((prev) => {
      const next = [...pendingMisconductTypes];
      const shouldResetWarning = next.length === 0;
      return {
        ...prev,
        misconductTypes: next,
        warningType: shouldResetWarning ? "" : prev.warningType,
        validityMonths: shouldResetWarning ? "" : prev.validityMonths,
      };
    });
    closeMisconductDialog();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const warningSelectKey = formData.misconductTypes.join("|") || "empty";

  return (
    <DashboardLayout>
      <style>{pulseShadowStyles}</style>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Generate Written Warning</h1>
            <p className="text-muted-foreground">
              Complete the form below to generate a professional written warning document
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/documents/discipline")}
            className="flex-shrink-0 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white focus-visible:ring-blue-600"
          >
            <ArrowLeft className="mr-0.5 h-4 w-4" aria-hidden="true" />
            Back
          </Button>
        </div>

          <Card className="shadow-xl border border-blue-100/70 bg-white/95 shadow-blue-100/60">
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-9 w-1.5 rounded-full bg-gradient-to-b from-blue-500 to-blue-300" aria-hidden="true" />
                <div>
                  <CardTitle className="text-xl text-gray-900">Warning Details</CardTitle>
                  <CardDescription className="text-gray-600">All fields marked with * are required</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Company & Trading Name */}
                <div className="space-y-4 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 shadow-sm">
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
                </div>

                {/* Employee Selection */}
                <div className="space-y-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
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

                {/* Warning Details */}
                <div className="space-y-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
                  <h3 className="font-semibold text-lg text-gray-900">Warning Information</h3>
                  <div className="space-y-2">
                    <Label>Misconduct Type(s) *</Label>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-900"
                      type="button"
                      onClick={openMisconductDialog}
                    >
                      {formData.misconductTypes.length === 0
                        ? "Select misconduct type(s)"
                        : `${formData.misconductTypes.length} type(s) selected`}
                    </Button>
                      {formData.misconductTypes.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.misconductTypes.map((type) => (
                          <Badge key={type} variant="secondary" className="gap-1 bg-blue-50 text-blue-800 border border-blue-100">
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

                  <Dialog open={isMisconductDialogOpen} onOpenChange={(open) => (open ? openMisconductDialog() : closeMisconductDialog())}>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Select misconduct type(s)</DialogTitle>
                      </DialogHeader>
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
                                  <p className="text-xs font-semibold uppercase text-muted-foreground">{category} Offences</p>
                                  {bucket.map((item) => (
                                    <label key={`${category}-${item.name}`} className="flex items-center gap-2 text-sm cursor-pointer">
                                      <Checkbox
                                        checked={pendingMisconductTypes.includes(item.name)}
                                        onCheckedChange={() => togglePendingMisconductType(item.name)}
                                      />
                                      <span>{item.name}</span>
                                    </label>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                        {pendingMisconductTypes.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Selected</p>
                            <div className="flex flex-wrap gap-2">
                              {pendingMisconductTypes.map((type) => {
                                const category = getMisconductCategory(type);
                                const bgClass =
                                  category === "Minor"
                                    ? "bg-orange-100 text-orange-800"
                                    : category === "Serious"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-slate-200 text-slate-800";
                                return (
                                  <Badge
                                    key={type}
                                    variant="secondary"
                                    className={`gap-1 ${bgClass}`}
                                  >
                                    {type}
                                    <X className="h-3 w-3 cursor-pointer" onClick={() => togglePendingMisconductType(type)} />
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                      <DialogFooter className="gap-2">
                        <Button type="button" variant="outline" onClick={closeMisconductDialog}>
                          Cancel
                        </Button>
                        <Button type="button" onClick={applyMisconductSelection} className="bg-blue-600 text-white hover:bg-blue-500">
                          Add selected
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
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
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePreview}
                    disabled={isLoading || !isFormValid()}
                    className="gap-2 hover:border-primary"
                  >
                    <FileText className="h-4 w-4" />
                    Preview
                  </Button>
                  <Button
                    type="button"
                    onClick={handleDownload}
                    disabled={isLoading || !isFormValid()}
                    className="gap-2 bg-primary hover:bg-primary/90"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDiscard}
                    disabled={isLoading}
                    className="gap-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white focus-visible:ring-blue-600"
                  >
                    <X className="h-4 w-4" />
                    Discard
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Warning Document Preview</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-full px-6 pb-6">
            <div className="bg-white text-black p-8 mx-auto" style={{ width: '210mm', minHeight: '297mm' }}>
              {/* Header */}
              <div className="bg-primary h-12 -mx-8 -mt-8 mb-6 flex items-center justify-center">
                <h1 className="text-2xl font-bold text-white">WRITTEN WARNING</h1>
              </div>

              {/* Company Information */}
              {profile && (
                <div className="mb-6">
                  <h2 className="text-sm font-bold text-primary mb-2">COMPANY INFORMATION</h2>
                  <div className="text-xs space-y-1">
                    <p>{profile.company_name}</p>
                    <p>Reg No: {profile.registration_number}</p>
                    <p>{profile.physical_address}</p>
                  </div>
                </div>
              )}

              {formData.tradingName && (
                <div className="text-xs mb-6">
                  <p>Trading As: {formData.tradingName}</p>
                </div>
              )}

              {/* Divider */}
              <div className="border-t-2 border-primary mb-6" />

              {/* Employee Details */}
              <div className="mb-6">
                <h2 className="text-sm font-bold text-primary mb-2">EMPLOYEE DETAILS</h2>
                <div className="text-xs space-y-1">
                  <p>Name: {formData.employeeName} {formData.employeeSurname}</p>
                  <p>ID Number: {formData.employeeIdNumber}</p>
                </div>
              </div>

              {/* Warning Details */}
              <div className="mb-6">
                <h2 className="text-sm font-bold text-primary mb-2">WARNING DETAILS</h2>
                <div className="text-xs space-y-1">
                  <p>Type: {
                    {
                      first: "First Written Warning",
                      second: "Second Written Warning",
                      serious: "Serious Written Warning",
                      final: "Final Written Warning",
                    }[formData.warningType] || formData.warningType
                  }</p>
                  <p>Validity: {formData.validityMonths} months</p>
                  <p>Issued By: {formData.issuedBy}</p>
                  <p>Date: {formData.dateIssued}</p>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-primary mb-6" />

              {/* Misconduct Types */}
              <div className="mb-6">
                <h2 className="text-sm font-bold text-primary mb-2">MISCONDUCT TYPE(S)</h2>
                <div className="text-xs space-y-1">
                  {formData.misconductTypes.map((type, idx) => (
                    <p key={idx}>• {type}</p>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="mb-6">
                <h2 className="text-sm font-bold text-primary mb-2">DESCRIPTION OF MISCONDUCT</h2>
                <p className="text-xs whitespace-pre-wrap">{formData.description}</p>
              </div>

              {/* Divider */}
              <div className="border-t border-primary mb-6" />

              {/* Consequences */}
              <div className="mb-6">
                <h2 className="text-sm font-bold text-primary mb-2">CONSEQUENCES</h2>
                <p className="text-xs">
                  You are required to refrain completely from committing any further acts of misconduct. 
                  Should you commit the same or similar act of misconduct within the validity period of this warning, 
                  progressive disciplinary action will be taken which could lead to your dismissal.
                </p>
              </div>

              {/* Divider */}
              <div className="border-t border-primary mb-6" />

              {/* Signatures */}
              <div className="mb-6">
                <h2 className="text-sm font-bold text-primary mb-3">SIGNATURES</h2>
                <div className="space-y-6 text-xs">
                  {["Employer/Issuer", "Employee", "Representative", "Interpreter", "Witness"].map((label, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between mb-1">
                        <span className="border-b border-black flex-1 max-w-[60%]"></span>
                        <span className="ml-4">Date: <span className="border-b border-black inline-block w-32"></span></span>
                      </div>
                      <p className="mt-1">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer Note */}
              <div className="mt-8">
                <p className="text-[10px] text-gray-600 italic">
                  If the employee refuses to sign this warning, the witness's signature will confirm that the employee 
                  did receive the warning and that the contents were explained to him/her.
                </p>
              </div>
            </div>
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
