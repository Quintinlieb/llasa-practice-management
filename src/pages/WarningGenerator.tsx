import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";

const WarningGenerator = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    tradingName: "",
    employeeId: "",
    employeeName: "",
    employeeSurname: "",
    employeeIdNumber: "",
    warningType: "",
    validityMonths: "",
    issuedBy: "",
    dateIssued: new Date().toISOString().split("T")[0],
    misconduct: "",
    description: "",
    datesCommitted: "",
  });

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

  const handleWarningTypeChange = (value: string) => {
    const validityMap: { [key: string]: string } = {
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
        employeeIdNumber: employee.id_number,
      });
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPosition = 20;

    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("WRITTEN WARNING", pageWidth / 2, yPosition, { align: "center" });
    yPosition += 15;

    // Company Details
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    if (profile) {
      doc.text(`Company: ${profile.company_name}`, 20, yPosition);
      yPosition += 6;
      doc.text(`Registration: ${profile.registration_number}`, 20, yPosition);
      yPosition += 6;
      doc.text(`Address: ${profile.physical_address}`, 20, yPosition);
      yPosition += 10;
    }

    if (formData.tradingName) {
      doc.text(`Trading Name: ${formData.tradingName}`, 20, yPosition);
      yPosition += 10;
    }

    // Employee Details
    doc.setFont("helvetica", "bold");
    doc.text("EMPLOYEE DETAILS:", 20, yPosition);
    yPosition += 8;
    doc.setFont("helvetica", "normal");
    doc.text(`Name: ${formData.employeeName} ${formData.employeeSurname}`, 20, yPosition);
    yPosition += 6;
    doc.text(`ID Number: ${formData.employeeIdNumber}`, 20, yPosition);
    yPosition += 10;

    // Warning Details
    const warningTypeText = {
      first: "First Written Warning",
      second: "Second Written Warning",
      serious: "Serious Written Warning",
      final: "Final Written Warning",
    }[formData.warningType] || formData.warningType;

    doc.setFont("helvetica", "bold");
    doc.text("WARNING DETAILS:", 20, yPosition);
    yPosition += 8;
    doc.setFont("helvetica", "normal");
    doc.text(`Type of Warning: ${warningTypeText}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Validity Period: ${formData.validityMonths} months`, 20, yPosition);
    yPosition += 6;
    doc.text(`Issued By: ${formData.issuedBy}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Date Issued: ${formData.dateIssued}`, 20, yPosition);
    yPosition += 10;

    // Misconduct
    doc.setFont("helvetica", "bold");
    doc.text("MISCONDUCT:", 20, yPosition);
    yPosition += 8;
    doc.setFont("helvetica", "normal");
    doc.text(formData.misconduct, 20, yPosition);
    yPosition += 10;

    // Description
    doc.setFont("helvetica", "bold");
    doc.text("DESCRIPTION OF MISCONDUCT:", 20, yPosition);
    yPosition += 8;
    doc.setFont("helvetica", "normal");
    const descriptionLines = doc.splitTextToSize(formData.description, 170);
    doc.text(descriptionLines, 20, yPosition);
    yPosition += descriptionLines.length * 6 + 6;

    // Dates Committed
    doc.setFont("helvetica", "bold");
    doc.text("DATE(S) COMMITTED:", 20, yPosition);
    yPosition += 8;
    doc.setFont("helvetica", "normal");
    doc.text(formData.datesCommitted, 20, yPosition);
    yPosition += 15;

    // Consequences
    doc.setFont("helvetica", "bold");
    doc.text("CONSEQUENCES:", 20, yPosition);
    yPosition += 8;
    doc.setFont("helvetica", "normal");
    const consequencesText =
      "You are required to refrain completely from committing any further acts of misconduct. Should you commit the same or similar act of misconduct within the validity period of this warning, progressive disciplinary action will be taken which could lead to your dismissal.";
    const consequencesLines = doc.splitTextToSize(consequencesText, 170);
    doc.text(consequencesLines, 20, yPosition);
    yPosition += consequencesLines.length * 6 + 15;

    // Signatures
    doc.setFont("helvetica", "bold");
    doc.text("SIGNATURES:", 20, yPosition);
    yPosition += 15;

    doc.setFont("helvetica", "normal");
    doc.text("_____________________________", 20, yPosition);
    doc.text("Date: _______________", 120, yPosition);
    yPosition += 6;
    doc.text("Employer/Issuer Signature", 20, yPosition);
    yPosition += 15;

    doc.text("_____________________________", 20, yPosition);
    doc.text("Date: _______________", 120, yPosition);
    yPosition += 6;
    doc.text("Employee Signature", 20, yPosition);
    yPosition += 15;

    doc.text("_____________________________", 20, yPosition);
    doc.text("Date: _______________", 120, yPosition);
    yPosition += 6;
    doc.text("Representative Signature", 20, yPosition);
    yPosition += 15;

    doc.text("_____________________________", 20, yPosition);
    doc.text("Date: _______________", 120, yPosition);
    yPosition += 6;
    doc.text("Interpreter Signature", 20, yPosition);
    yPosition += 15;

    doc.text("_____________________________", 20, yPosition);
    doc.text("Date: _______________", 120, yPosition);
    yPosition += 6;
    doc.text("Witness Signature", 20, yPosition);
    yPosition += 12;

    // Footer Note
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    const footerText =
      "If the employee refuses to sign this warning, the witness's signature will confirm that the employee did receive the warning and that the contents were explained to him/her.";
    const footerLines = doc.splitTextToSize(footerText, 170);
    doc.text(footerLines, 20, yPosition);

    doc.save(`Warning_${formData.employeeSurname}_${formData.dateIssued}.pdf`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);

    try {
      const { error } = await supabase.from("documents").insert({
        company_id: user.id,
        employee_id: formData.employeeId || null,
        trading_name: formData.tradingName,
        employee_name: formData.employeeName,
        employee_surname: formData.employeeSurname,
        employee_id_number: formData.employeeIdNumber,
        warning_type: formData.warningType as any,
        validity_months: parseInt(formData.validityMonths),
        issued_by: formData.issuedBy,
        date_issued: formData.dateIssued,
        misconduct: formData.misconduct,
        description: formData.description,
        dates_committed: formData.datesCommitted,
      });

      if (error) throw error;

      generatePDF();

      toast({
        title: "Success",
        description: "Warning document generated and saved!",
      });

      // Reset form
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
        misconduct: "",
        description: "",
        datesCommitted: "",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <Navigation />

      <div className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Generate Written Warning</h1>
            <p className="text-muted-foreground">
              Complete the form below to generate a professional written warning document
            </p>
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
                    <Label htmlFor="misconduct">Misconduct *</Label>
                    <Input
                      id="misconduct"
                      value={formData.misconduct}
                      onChange={(e) => setFormData({ ...formData, misconduct: e.target.value })}
                      placeholder="Brief title of misconduct"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description of Misconduct *</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Detailed description of the misconduct"
                      rows={5}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="datesCommitted">Date(s) Committed *</Label>
                    <Input
                      id="datesCommitted"
                      value={formData.datesCommitted}
                      onChange={(e) => setFormData({ ...formData, datesCommitted: e.target.value })}
                      placeholder="e.g., 2025-01-15, 2025-01-20"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                  {isLoading ? "Generating..." : "Generate & Download PDF"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WarningGenerator;