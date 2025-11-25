import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, FileText, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
import {
  permanentContractSchema,
  salaryFrequencyOptions,
  type PermanentContractFormData,
} from "@/lib/validation";
import type { Tables } from "@/integrations/supabase/types";

type ContractFormState = {
  employeeId: string;
  salaryAmount: string;
  issueDate: string;
} & Omit<PermanentContractFormData, "salaryAmount"> & {
  salaryAmount: string;
};

const salaryFrequencyLabels: Record<PermanentContractFormData["salaryFrequency"], string> = {
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

const extractYear = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 4) : String(date.getFullYear());
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

  const [formData, setFormData] = useState<ContractFormState>({
    employeeId: "",
    startDate: new Date().toISOString().split("T")[0],
    issueDate: new Date().toISOString().split("T")[0],
    employeeName: "",
    employeeSurname: "",
    employeeIdNumber: "",
    employeeAddress: "",
    employeeCell: "",
    employeeEmail: "",
    jobTitle: "",
    salaryAmount: "",
    salaryFrequency: "month",
    reportsTo: "",
    additionalNotes: "",
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [loading, navigate, user]);

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

  const handleEmployeeSelect = (employeeId: string) => {
    const employee = employees.find((emp) => emp.id === employeeId);
    if (!employee) return;

    setFormData((prev) => ({
      ...prev,
      employeeId,
      employeeName: employee.employee_name,
      employeeSurname: employee.employee_surname,
      employeeIdNumber: employee.id_number ?? "",
    }));
  };

  const resetForm = () => {
    setFormData({
      employeeId: "",
      startDate: new Date().toISOString().split("T")[0],
      issueDate: new Date().toISOString().split("T")[0],
      employeeName: "",
      employeeSurname: "",
      employeeIdNumber: "",
      employeeAddress: "",
      employeeCell: "",
      employeeEmail: "",
      jobTitle: "",
      salaryAmount: "",
      salaryFrequency: "month",
      reportsTo: "",
      additionalNotes: "",
    });
    setValidatedPreview(null);
    setShowPreview(false);
  };

  const isFormComplete = useMemo(
    () =>
      Boolean(
        formData.startDate &&
          formData.employeeName &&
          formData.employeeSurname &&
          formData.employeeIdNumber &&
          formData.employeeAddress &&
          formData.employeeCell &&
        formData.employeeEmail &&
        formData.jobTitle &&
        formData.salaryAmount &&
        formData.salaryFrequency &&
        formData.reportsTo &&
        formData.issueDate,
      ),
    [formData],
  );

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
    const sectionSpacing = 10;
    const issueYear = extractYear(data.issueDate);
    let y = margin;

    const ensureSpace = (space: number) => {
      if (y + space > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
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
      const lineHeight = 6;
      ensureSpace(lineHeight * 2);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(title.toUpperCase(), margin, y);
      y += lineHeight; // single line spacing before text
      doc.setFont("helvetica", "normal");
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("PERMANENT EMPLOYMENT AGREEMENT", pageWidth / 2, y, { align: "center" });
    y += 10;

    if (profile) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text("COMPANY INFORMATION", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      const details = [
        profile.company_name,
        `Reg No: ${profile.registration_number}`,
        `Physical Address: ${profile.physical_address}`,
        `Email: ${profile.company_email} | Contact: ${profile.company_contact}`,
      ].filter(Boolean);
      details.forEach((line) => {
        ensureSpace(5);
        doc.text(line, margin, y);
        y += 4.5;
      });
      y += 2;
    }

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("EMPLOYEE DETAILS", margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);

    const summaryRows = [
      `Employee: ${data.employeeName} ${data.employeeSurname}`,
      `ID Number: ${data.employeeIdNumber}`,
      `Address: ${data.employeeAddress}`,
      `Contact: ${data.employeeCell} | Email: ${data.employeeEmail}`,
      `Issue Date: ${formatDate(data.issueDate)}`,
      `Start Date: ${formatDate(data.startDate)}`,
      `Position: ${data.jobTitle}`,
      `Reports To: ${data.reportsTo}`,
      `Remuneration: ${formatCurrency(data.salaryAmount)} ${salaryFrequencyLabels[data.salaryFrequency]}`,
    ];

    summaryRows.forEach((line) => {
      ensureSpace(5);
      doc.text(line, margin, y);
      y += 4.5;
    });
    y += 2;

    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    const clauses = [
      {
        title: "Appointment and role",
        body: `The employee is appointed in the position of ${data.jobTitle} and will commence employment on ${formatDate(data.startDate)}. The employee will report to ${data.reportsTo} or any delegate designated by the company.`,
      },
      {
        title: "Place of work",
        body: "The employee will perform duties at the company's premises or any other location reasonably required by the company. Flexible or remote work arrangements may be agreed in writing, subject to operational needs.",
      },
      {
        title: "Remuneration",
        body: `The employee will receive ${formatCurrency(data.salaryAmount)} ${salaryFrequencyLabels[data.salaryFrequency]} before statutory deductions. Salary will be reviewed periodically at the company's discretion. Any bonuses or incentives are discretionary unless agreed otherwise in writing.`,
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
        body: "The first three months of employment constitute a probationary period during which performance and suitability will be assessed. Performance standards, feedback, and any required improvements will be communicated. The company may extend probation where reasonably necessary.",
      },
      {
        title: "Duties and conduct",
        body: "The employee undertakes to perform duties diligently, comply with all lawful and reasonable instructions, and uphold company policies, codes, and procedures. Any conflict of interest must be disclosed immediately.",
      },
      {
        title: "Confidentiality and intellectual property",
        body: "All confidential information, trade secrets, and intellectual property developed or accessed during employment remain the exclusive property of the company. The employee may not disclose or use such information except as required for duties, and this obligation survives termination.",
      },
      {
        title: "Health, safety, and compliance",
        body: "The employee will follow all health and safety rules, report incidents promptly, and comply with statutory requirements relevant to the role and industry. Failure to do so may result in disciplinary action.",
      },
      {
        title: "Termination",
        body: "Either party may terminate employment by giving written notice in accordance with the BCEA or making payment in lieu. The company reserves the right to summarily dismiss for gross misconduct in line with disciplinary procedures and substantive fairness.",
      },
      {
        title: "Return of property",
        body: "On termination, the employee will return all company property, including equipment, documents, access cards, and confidential information, and will assist with handover of duties.",
      },
      {
        title: "Entire agreement",
        body: "This agreement, together with any signed annexures and company policies, constitutes the entire understanding between the parties regarding employment. Changes are valid only if recorded in writing and signed by both parties.",
      },
    ];

    clauses.forEach((clause, idx) => {
      addClauseHeading(clause.title);
      addNumberedParagraph(idx + 1, clause.body);
      y += 3; // tighter gap before next heading
    });

    if (data.additionalNotes) {
      addSection("Additional notes", data.additionalNotes);
    }

    ensureSpace(14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
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
    doc.setTextColor(0, 0, 0);

    const signatureLabels = ["For the Employer", "Employee"];
    signatureLabels.forEach((label) => {
      ensureSpace(20);
      doc.text("_______________________________", margin, y);
      doc.text("Date: __________________", margin + 110, y);
      y += 4;
      doc.text(label, margin, y);
      y += 16;
    });

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
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-blue-600 font-semibold">Contracts</p>
            <h1 className="text-3xl font-bold text-gray-900 mt-1">Generate permanent employment contract</h1>
            <p className="text-muted-foreground max-w-2xl">
              Capture key details and produce an A4-ready, multi-page employment agreement with consistent margins.
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
            <div className="flex items-center gap-3">
              <div className="h-9 w-1.5 rounded-full bg-gradient-to-b from-blue-500 to-blue-300" aria-hidden="true" />
              <div>
                <CardTitle className="text-xl text-gray-900">Contract details</CardTitle>
                <CardDescription className="text-gray-600">All fields marked with * are required</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 shadow-sm">
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
                      className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employeeSurname">Employee Surname *</Label>
                    <Input
                      id="employeeSurname"
                      value={formData.employeeSurname}
                      onChange={(e) => setFormData({ ...formData, employeeSurname: e.target.value })}
                      className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employeeIdNumber">ID Number *</Label>
                    <Input
                      id="employeeIdNumber"
                      value={formData.employeeIdNumber}
                      onChange={(e) => setFormData({ ...formData, employeeIdNumber: e.target.value })}
                      className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employeeEmail">Email *</Label>
                    <Input
                      id="employeeEmail"
                      type="email"
                      value={formData.employeeEmail}
                      onChange={(e) => setFormData({ ...formData, employeeEmail: e.target.value })}
                      className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employeeCell">Cell Number *</Label>
                    <Input
                      id="employeeCell"
                      value={formData.employeeCell}
                      onChange={(e) => setFormData({ ...formData, employeeCell: e.target.value })}
                      placeholder="e.g. 0821234567 or +27821234567"
                      className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="employeeAddress">Residential Address *</Label>
                    <Textarea
                      id="employeeAddress"
                      value={formData.employeeAddress}
                      onChange={(e) => setFormData({ ...formData, employeeAddress: e.target.value })}
                      rows={3}
                      placeholder="Street, suburb, city, postal code"
                      className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <h3 className="font-semibold text-lg text-gray-900">Role & remuneration</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="issueDate">Issue Date *</Label>
                    <Input
                      id="issueDate"
                      type="date"
                      value={formData.issueDate}
                      onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                      className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jobTitle">Job Title *</Label>
                    <Input
                      id="jobTitle"
                      value={formData.jobTitle}
                      onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                      className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reportsTo">Reports To *</Label>
                    <Input
                      id="reportsTo"
                      value={formData.reportsTo}
                      onChange={(e) => setFormData({ ...formData, reportsTo: e.target.value })}
                      className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                    />
                  </div>
                  <div className="space-y-2">
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
                  <div className="space-y-2">
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="additionalNotes">Additional Notes (optional)</Label>
                  <Textarea
                    id="additionalNotes"
                    value={formData.additionalNotes}
                    onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
                    rows={4}
                    placeholder="Add bespoke clauses or benefits to append to the standard contract text"
                    className="focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50 text-blue-700 focus:text-gray-900"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePreview}
                  disabled={!isFormComplete || isGenerating}
                  className="gap-2 hover:border-primary"
                >
                  <FileText className="h-4 w-4" />
                  Preview
                </Button>
                <Button
                  type="button"
                  onClick={handleDownload}
                  disabled={!isFormComplete || isGenerating}
                  className="gap-2 bg-primary hover:bg-primary/90"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  disabled={isGenerating}
                  className="gap-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white focus-visible:ring-blue-600"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Clear form
                </Button>
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
            {validatedPreview ? (
              <div className="bg-white text-black p-8 mx-auto" style={{ width: "210mm", minHeight: "297mm" }}>
                <div className="bg-black h-12 -mx-8 -mt-8 mb-6 flex items-center justify-center">
                  <h1 className="text-2xl font-bold text-white">PERMANENT EMPLOYMENT AGREEMENT</h1>
                </div>

                {profile && (
                  <div className="mb-6">
                    <h2 className="text-sm font-bold text-black mb-2">COMPANY INFORMATION</h2>
                    <div className="text-xs space-y-1">
                      <p>{profile.company_name}</p>
                      <p>Reg No: {profile.registration_number}</p>
                      <p>{profile.physical_address}</p>
                      <p>Email: {profile.company_email} | Contact: {profile.company_contact}</p>
                    </div>
                  </div>
                )}

                <div className="border-t-2 border-black mb-6" />

                <div className="mb-6">
                  <h2 className="text-sm font-bold text-black mb-2">EMPLOYEE DETAILS</h2>
                  <div className="text-xs space-y-1">
                    <p>Name: {validatedPreview.employeeName} {validatedPreview.employeeSurname}</p>
                    <p>ID Number: {validatedPreview.employeeIdNumber}</p>
                    <p>Address: {validatedPreview.employeeAddress}</p>
                    <p>Contact: {validatedPreview.employeeCell} | Email: {validatedPreview.employeeEmail}</p>
                    <p>Start Date: {formatDate(validatedPreview.startDate)}</p>
                    <p>Position: {validatedPreview.jobTitle}</p>
                    <p>Reports To: {validatedPreview.reportsTo}</p>
                    <p>Issue Date: {formatDate(validatedPreview.issueDate)}</p>
                    <p>
                      Remuneration: {formatCurrency(validatedPreview.salaryAmount)}{" "}
                      {salaryFrequencyLabels[validatedPreview.salaryFrequency]}
                    </p>
                  </div>
                </div>

                <div className="border-t border-black mb-6" />

              <div className="space-y-5 text-xs leading-relaxed">
                  {[
                    {
                      title: "Appointment and role",
                      body: `The employee is appointed in the position of ${validatedPreview.jobTitle} and will commence employment on ${formatDate(validatedPreview.startDate)}. The employee will report to ${validatedPreview.reportsTo} or any delegate designated by the company.`,
                    },
                    {
                      title: "Place of work",
                      body: "The employee will perform duties at the company's premises or any other location reasonably required by the company. Flexible or remote work arrangements may be agreed in writing, subject to operational needs.",
                    },
                    {
                      title: "Remuneration",
                      body: `The employee will receive ${formatCurrency(validatedPreview.salaryAmount)} ${salaryFrequencyLabels[validatedPreview.salaryFrequency]} before statutory deductions. Salary will be reviewed periodically at the company's discretion. Any bonuses or incentives are discretionary unless agreed otherwise in writing.`,
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
                      body: "The first three months of employment constitute a probationary period during which performance and suitability will be assessed. Performance standards, feedback, and any required improvements will be communicated. The company may extend probation where reasonably necessary.",
                    },
                    {
                      title: "Duties and conduct",
                      body: "The employee undertakes to perform duties diligently, comply with all lawful and reasonable instructions, and uphold company policies, codes, and procedures. Any conflict of interest must be disclosed immediately.",
                    },
                    {
                      title: "Confidentiality and intellectual property",
                      body: "All confidential information, trade secrets, and intellectual property developed or accessed during employment remain the exclusive property of the company. The employee may not disclose or use such information except as required for duties, and this obligation survives termination.",
                    },
                    {
                      title: "Health, safety, and compliance",
                      body: "The employee will follow all health and safety rules, report incidents promptly, and comply with statutory requirements relevant to the role and industry. Failure to do so may result in disciplinary action.",
                    },
                    {
                      title: "Termination",
                      body: "Either party may terminate employment by giving written notice in accordance with the BCEA or making payment in lieu. The company reserves the right to summarily dismiss for gross misconduct in line with disciplinary procedures and substantive fairness.",
                    },
                    {
                      title: "Return of property",
                      body: "On termination, the employee will return all company property, including equipment, documents, access cards, and confidential information, and will assist with handover of duties.",
                    },
                    {
                      title: "Entire agreement",
                      body: "This agreement, together with any signed annexures and company policies, constitutes the entire understanding between the parties regarding employment. Changes are valid only if recorded in writing and signed by both parties.",
                    },
                  ].map((clause, idx) => (
                    <div key={clause.title}>
                      <h3 className="font-semibold text-black mb-1">{clause.title}</h3>
                      <div className="grid grid-cols-[auto,1fr] gap-2 text-justify">
                        <span className="font-semibold">{idx + 1}.</span>
                        <p className="text-justify">{clause.body}</p>
                      </div>
                    </div>
                  ))}
                  {validatedPreview.additionalNotes && (
                    <div>
                      <h3 className="font-semibold text-black mb-1">Additional notes</h3>
                      <p className="whitespace-pre-wrap">{validatedPreview.additionalNotes}</p>
                    </div>
                  )}

                  <div>
                    <p className="font-semibold text-black mb-1">Signing</p>
                    <p>
                      Done and Signed at ________________________________________ on this _____ day of ______________________________{" "}
                      {extractYear(validatedPreview.issueDate)}
                      .
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
            ) : (
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
