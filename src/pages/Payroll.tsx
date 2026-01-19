import { useCallback, useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Download, FileText } from "lucide-react";

type PayslipFormData = {
  companyName: string;
  companyRegistration: string;
  employeeName: string;
  employeeId: string;
  jobTitle: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  payDate: string;
  grossPay: string;
  deductions: string;
};

type PayrollEmployee = Pick<
  Tables<"employees">,
  "id" | "employee_name" | "employee_surname" | "id_number" | "employee_number" | "job_title"
>;

const toNumber = (value: string) => {
  const normalized = value.replace(/,/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const Payroll = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showPreview, setShowPreview] = useState(false);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [employees, setEmployees] = useState<PayrollEmployee[]>([]);
  const [formData, setFormData] = useState<PayslipFormData>({
    companyName: "",
    companyRegistration: "",
    employeeName: "",
    employeeId: "",
    jobTitle: "",
    payPeriodStart: "",
    payPeriodEnd: "",
    payDate: "",
    grossPay: "",
    deductions: "",
  });

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
      .select("id, employee_name, employee_surname, id_number, employee_number, job_title")
      .eq("company_id", user.id);
    if (data) {
      setEmployees(data);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchProfile();
    fetchEmployees();
  }, [user, fetchProfile, fetchEmployees]);

  useEffect(() => {
    if (!profile) return;
    setFormData((prev) => ({
      ...prev,
      companyName: prev.companyName || profile.company_name || "",
      companyRegistration: prev.companyRegistration || profile.registration_number || "",
    }));
  }, [profile]);

  const grossPayValue = useMemo(() => toNumber(formData.grossPay), [formData.grossPay]);
  const deductionsValue = useMemo(() => toNumber(formData.deductions), [formData.deductions]);
  const netPayValue = useMemo(() => Math.max(0, grossPayValue - deductionsValue), [grossPayValue, deductionsValue]);

  const canGenerate = Boolean(
    formData.companyName &&
      formData.employeeName &&
      formData.payPeriodStart &&
      formData.payPeriodEnd &&
      formData.payDate &&
      formData.grossPay,
  );

  const handleEmployeeSelect = (employeeId: string) => {
    const employee = employees.find((item) => item.id === employeeId);
    if (!employee) return;
    const fullName = `${employee.employee_name} ${employee.employee_surname}`.trim();
    const employeeIdValue = employee.employee_number || employee.id_number || "";
    setFormData((prev) => ({
      ...prev,
      employeeId: employeeIdValue || prev.employeeId,
      employeeName: fullName || prev.employeeName,
      jobTitle: employee.job_title ?? prev.jobTitle,
    }));
  };

  const handleMissingFields = () => {
    toast({
      title: "Missing required details",
      description: "Complete company, employee, pay period, pay date, and gross pay before generating a payslip.",
      variant: "destructive",
    });
  };

  const generatePDF = (download = false) => {
    const doc = new jsPDF();
    const lineHeight = 7;
    let y = 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(formData.companyName || "Company", 14, y);
    y += lineHeight;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Registration: ${formData.companyRegistration || "N/A"}`, 14, y);
    y += lineHeight + 2;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Payslip", 14, y);
    y += lineHeight + 2;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Employee: ${formData.employeeName || "N/A"}`, 14, y);
    y += lineHeight;
    doc.text(`Employee ID: ${formData.employeeId || "N/A"}`, 14, y);
    y += lineHeight;
    doc.text(`Job Title: ${formData.jobTitle || "N/A"}`, 14, y);
    y += lineHeight;
    doc.text(`Pay Period: ${formData.payPeriodStart || "N/A"} to ${formData.payPeriodEnd || "N/A"}`, 14, y);
    y += lineHeight;
    doc.text(`Pay Date: ${formData.payDate || "N/A"}`, 14, y);
    y += lineHeight + 3;

    doc.setFont("helvetica", "bold");
    doc.text("Earnings", 14, y);
    y += lineHeight;
    doc.setFont("helvetica", "normal");
    doc.text(`Gross Pay: ${formatCurrency(grossPayValue)}`, 20, y);
    y += lineHeight + 2;

    doc.setFont("helvetica", "bold");
    doc.text("Deductions", 14, y);
    y += lineHeight;
    doc.setFont("helvetica", "normal");
    doc.text(`Total Deductions: ${formatCurrency(deductionsValue)}`, 20, y);
    y += lineHeight + 2;

    doc.setFont("helvetica", "bold");
    doc.text(`Net Pay: ${formatCurrency(netPayValue)}`, 14, y);

    if (download) {
      const safeEmployee = (formData.employeeName || "employee").replace(/\s+/g, "_");
      const safeDate = formData.payDate || "payslip";
      doc.save(`Payslip_${safeEmployee}_${safeDate}.pdf`);
    }
  };

  const handlePreview = () => {
    if (!canGenerate) {
      handleMissingFields();
      return;
    }
    setShowPreview(true);
  };

  const handleDownload = () => {
    if (!canGenerate) {
      handleMissingFields();
      return;
    }
    generatePDF(true);
  };

  const previewCard = (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Payslip</p>
        <h2 className="text-lg font-semibold text-slate-800">{formData.companyName || "Company Name"}</h2>
        <p className="text-xs text-slate-500">{formData.companyRegistration || "Registration: N/A"}</p>
      </div>
      <div className="grid gap-6 px-6 py-4 text-sm text-slate-700">
        <div className="grid gap-2">
          <p><span className="font-semibold text-slate-900">Employee:</span> {formData.employeeName || "N/A"}</p>
          <p><span className="font-semibold text-slate-900">Employee ID:</span> {formData.employeeId || "N/A"}</p>
          <p><span className="font-semibold text-slate-900">Job Title:</span> {formData.jobTitle || "N/A"}</p>
          <p>
            <span className="font-semibold text-slate-900">Pay Period:</span>{" "}
            {formData.payPeriodStart || "N/A"} to {formData.payPeriodEnd || "N/A"}
          </p>
          <p><span className="font-semibold text-slate-900">Pay Date:</span> {formData.payDate || "N/A"}</p>
        </div>
        <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-700">Gross Pay</span>
            <span className="font-semibold text-slate-900">{formatCurrency(grossPayValue)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-700">Deductions</span>
            <span className="font-semibold text-slate-900">{formatCurrency(deductionsValue)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-2">
            <span className="font-semibold text-slate-900">Net Pay</span>
            <span className="font-semibold text-blue-700">{formatCurrency(netPayValue)}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="w-[calc(100%+1.5rem)] max-w-none space-y-6 -ml-6 pr-0">
        <header className="rounded-2xl px-5 py-4 space-y-1 bg-white border border-slate-300">
          <div className="flex items-center gap-1 text-xs font-semibold tracking-wide text-slate-700">
            <span className="underline-offset-2 rounded-sm">Home</span>
            <span aria-hidden="true" className="text-slate-500">
              &gt;
            </span>
            <span className="underline-offset-2 rounded-sm" aria-current="page">
              Payroll
            </span>
          </div>
          <h1 className="text-xl font-bold uppercase text-blue-700">Payroll Payslip</h1>
          <p className="text-xs text-gray-600 max-w-3xl">
            Enter payroll details to preview and download a payslip in seconds.
          </p>
        </header>

        <Card className="border border-slate-200">
          <CardHeader className="space-y-1">
            <h2 className="text-base font-semibold text-slate-800">Payslip Details</h2>
            <p className="text-xs text-slate-600">Complete the required fields to enable preview and download.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-sm font-semibold text-black">
                  Company Name *
                </Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(event) => setFormData({ ...formData, companyName: event.target.value })}
                  placeholder="Company name"
                  className="text-sm focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyRegistration" className="text-sm font-semibold text-black">
                  Registration Number
                </Label>
                <Input
                  id="companyRegistration"
                  value={formData.companyRegistration}
                  onChange={(event) => setFormData({ ...formData, companyRegistration: event.target.value })}
                  placeholder="Reg number"
                  className="text-sm focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employeeSelect" className="text-sm font-semibold text-black">
                  Employee
                </Label>
                <Select onValueChange={handleEmployeeSelect}>
                  <SelectTrigger id="employeeSelect" className="text-sm">
                    <SelectValue placeholder="Select from saved employees or fill manually" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.length === 0 && (
                      <SelectItem value="none" disabled>
                        No employees found
                      </SelectItem>
                    )}
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.employee_name} {employee.employee_surname}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="employeeName" className="text-sm font-semibold text-black">
                  Employee Name *
                </Label>
                <Input
                  id="employeeName"
                  value={formData.employeeName}
                  onChange={(event) => setFormData({ ...formData, employeeName: event.target.value })}
                  placeholder="Employee full name"
                  className="text-sm focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employeeId" className="text-sm font-semibold text-black">
                  Employee ID / Number
                </Label>
                <Input
                  id="employeeId"
                  value={formData.employeeId}
                  onChange={(event) => setFormData({ ...formData, employeeId: event.target.value })}
                  placeholder="Employee ID"
                  className="text-sm focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobTitle" className="text-sm font-semibold text-black">
                  Job Title
                </Label>
                <Input
                  id="jobTitle"
                  value={formData.jobTitle}
                  onChange={(event) => setFormData({ ...formData, jobTitle: event.target.value })}
                  placeholder="Job title"
                  className="text-sm focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="payPeriodStart" className="text-sm font-semibold text-black">
                  Pay Period Start *
                </Label>
                <Input
                  id="payPeriodStart"
                  type="date"
                  value={formData.payPeriodStart}
                  onChange={(event) => setFormData({ ...formData, payPeriodStart: event.target.value })}
                  className="text-sm focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payPeriodEnd" className="text-sm font-semibold text-black">
                  Pay Period End *
                </Label>
                <Input
                  id="payPeriodEnd"
                  type="date"
                  value={formData.payPeriodEnd}
                  onChange={(event) => setFormData({ ...formData, payPeriodEnd: event.target.value })}
                  className="text-sm focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payDate" className="text-sm font-semibold text-black">
                  Pay Date *
                </Label>
                <Input
                  id="payDate"
                  type="date"
                  value={formData.payDate}
                  onChange={(event) => setFormData({ ...formData, payDate: event.target.value })}
                  className="text-sm focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="grossPay" className="text-sm font-semibold text-black">
                  Gross Pay *
                </Label>
                <Input
                  id="grossPay"
                  inputMode="decimal"
                  value={formData.grossPay}
                  onChange={(event) => setFormData({ ...formData, grossPay: event.target.value })}
                  placeholder="0.00"
                  className="text-sm focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deductions" className="text-sm font-semibold text-black">
                  Deductions
                </Label>
                <Input
                  id="deductions"
                  inputMode="decimal"
                  value={formData.deductions}
                  onChange={(event) => setFormData({ ...formData, deductions: event.target.value })}
                  placeholder="0.00"
                  className="text-sm focus-visible:ring-blue-500 hover:border-blue-200 hover:bg-blue-50/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="netPay" className="text-sm font-semibold text-black">
                  Net Pay (calculated)
                </Label>
                <Input
                  id="netPay"
                  value={formatCurrency(netPayValue)}
                  readOnly
                  className="text-sm bg-slate-50 text-slate-700"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handlePreview}
                className="gap-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white"
              >
                <FileText className="h-4 w-4" />
                Preview payslip
              </Button>
              <Button
                type="button"
                onClick={handleDownload}
                className="gap-2 bg-primary hover:bg-primary/90"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl h-[90vh] p-0">
          <DialogHeader className="px-6 pt-4 pb-2 space-y-1">
            <DialogTitle className="text-blue-700 text-left text-base font-semibold">PREVIEW</DialogTitle>
            <DialogDescription className="text-xs text-slate-600 text-left">
              Review the payslip for {formData.employeeName || "the employee"} before downloading.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-full px-6 pb-6">{previewCard}</ScrollArea>
          <DialogFooter className="px-6 pb-4">
            <Button
              type="button"
              onClick={handleDownload}
              className="gap-2 bg-primary hover:bg-primary/90"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Payroll;
