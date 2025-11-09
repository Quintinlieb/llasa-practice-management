import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
} & Pick<
  WarningGeneratorFormData,
  | "tradingName"
  | "employeeName"
  | "employeeSurname"
  | "employeeIdNumber"
  | "warningType"
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
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchEmployees();
    }
  }, [user]);

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

  const fetchProfile = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (data) {
      setProfile(data);
    }
  };

  const fetchEmployees = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("employees")
      .select("*")
      .eq("company_id", user.id);

    if (data) {
      setEmployees(data);
    }
  };

  const handleWarningTypeChange = (value: WarningGeneratorFormData["warningType"]) => {
    const validityMap: Record<WarningGeneratorFormData["warningType"], string> = {
      first: "6",
      second: "6",
      serious: "9",
      final: "12",
    };

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
      warningType: "",
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
    setFormData(prev => ({
      ...prev,
      misconductTypes: prev.misconductTypes.includes(type)
        ? prev.misconductTypes.filter(t => t !== type)
        : [...prev.misconductTypes, type]
    }));
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

          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle>Warning Details</CardTitle>
              <CardDescription>All fields marked with * are required</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Company & Trading Name */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tradingName">Trading Name (optional)</Label>
                    <Input
                      id="tradingName"
                      value={formData.tradingName}
                      onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
                      placeholder="Enter trading name if different from company name"
                    />
                  </div>
                </div>

                {/* Employee Selection */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Employee Information</h3>
                  <div className="space-y-2">
                    <Label htmlFor="employee">Select Employee (optional)</Label>
                    <Select onValueChange={handleEmployeeSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select from saved employees or fill manually" />
                      </SelectTrigger>
                      <SelectContent>
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
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employeeSurname">Employee Surname *</Label>
                      <Input
                        id="employeeSurname"
                        value={formData.employeeSurname}
                        onChange={(e) => setFormData({ ...formData, employeeSurname: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="employeeIdNumber">ID Number *</Label>
                      <Input
                        id="employeeIdNumber"
                        value={formData.employeeIdNumber}
                        onChange={(e) => setFormData({ ...formData, employeeIdNumber: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Warning Details */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Warning Information</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="warningType">Type of Warning *</Label>
                      <Select onValueChange={handleWarningTypeChange} required>
                        <SelectTrigger>
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
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="issuedBy">Issued By *</Label>
                      <Input
                        id="issuedBy"
                        value={formData.issuedBy}
                        onChange={(e) => setFormData({ ...formData, issuedBy: e.target.value })}
                        required
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
                      />
                    </div>
                  </div>
                </div>

                {/* Misconduct Details */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Misconduct Details</h3>
                  <div className="space-y-2">
                    <Label>Misconduct Type(s) *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          {formData.misconductTypes.length === 0
                            ? "Select misconduct type(s)"
                            : `${formData.misconductTypes.length} type(s) selected`}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-4 max-h-[300px] overflow-y-auto" align="start">
                        <div className="space-y-2">
                          {MISCONDUCT_TYPES.map((type) => (
                            <div key={type} className="flex items-center space-x-2">
                              <Checkbox
                                id={type}
                                checked={formData.misconductTypes.includes(type)}
                                onCheckedChange={() => toggleMisconductType(type)}
                              />
                              <label
                                htmlFor={type}
                                className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {type}
                              </label>
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                    {formData.misconductTypes.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.misconductTypes.map((type) => (
                          <Badge key={type} variant="secondary" className="gap-1">
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
                    <div className="flex items-center gap-2">
                      <Label htmlFor="description">Description of Misconduct *</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Type a brief summary of what the employee did in respect of the selected misconduct type(s), together with the dates committed.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Provide specific details about the misconduct incident(s) including dates"
                      rows={5}
                      required
                    />
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
    </DashboardLayout>
  );
};

export default WarningGenerator;
