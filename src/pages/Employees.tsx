import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Upload, Edit, FilePlus, Eye, EyeOff, Download } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { employeeSchema, sanitizeText, validateSAIdNumber } from "@/lib/validation";
import { maskSAIdNumber } from "@/lib/idMasking";
interface Employee {
  id: string;
  employee_name: string;
  employee_surname: string;
  id_number: string;
}
const Employees = () => {
  const {
    user,
    loading
  } = useAuth();
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    employeeName: "",
    employeeSurname: "",
    idNumber: ""
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);
  useEffect(() => {
    if (user) {
      fetchEmployees();
    }
  }, [user]);
  useEffect(() => {
    const filtered = employees.filter(emp => emp.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) || emp.employee_surname.toLowerCase().includes(searchQuery.toLowerCase()) || emp.id_number.toLowerCase().includes(searchQuery.toLowerCase()));
    setFilteredEmployees(filtered);
  }, [employees, searchQuery]);
  const fetchEmployees = async () => {
    if (!user) return;
    const {
      data,
      error
    } = await supabase.from("employees").select("*").eq("company_id", user.id).order("created_at", {
      ascending: false
    });
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      setEmployees(data || []);
      setFilteredEmployees(data || []);
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true);
    try {
      // Validate and sanitize input
      const validatedData = employeeSchema.parse(formData);
      if (editingEmployee) {
        const {
          error
        } = await supabase.from("employees").update({
          employee_name: validatedData.employeeName,
          employee_surname: validatedData.employeeSurname,
          id_number: validatedData.idNumber
        }).eq("id", editingEmployee.id);
        if (error) throw error;
        toast({
          title: "Success",
          description: "Employee updated successfully!"
        });
      } else {
        const {
          error
        } = await supabase.from("employees").insert({
          company_id: user.id,
          employee_name: validatedData.employeeName,
          employee_surname: validatedData.employeeSurname,
          id_number: validatedData.idNumber
        });
        if (error) throw error;
        toast({
          title: "Success",
          description: "Employee added successfully!"
        });
      }
      setFormData({
        employeeName: "",
        employeeSurname: "",
        idNumber: ""
      });
      setEditingEmployee(null);
      setIsDialogOpen(false);
      fetchEmployees();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message.includes("employees_id_number_unique") ? "An employee with this ID number already exists." : error.errors?.[0]?.message || error.message || "Validation failed",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  const handleBulkDelete = async () => {
    if (selectedEmployees.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedEmployees.size} employee(s)?`)) return;
    const {
      error
    } = await supabase.from("employees").delete().in("id", Array.from(selectedEmployees));
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: `${selectedEmployees.size} employee(s) deleted successfully!`
      });
      setSelectedEmployees(new Set());
      fetchEmployees();
    }
  };
  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      employeeName: employee.employee_name,
      employeeSurname: employee.employee_surname,
      idNumber: employee.id_number
    });
    setIsDialogOpen(true);
  };
  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingEmployee(null);
      setFormData({
        employeeName: "",
        employeeSurname: "",
        idNumber: ""
      });
    }
  };
  const toggleSelectAll = () => {
    if (selectedEmployees.size === filteredEmployees.length) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(filteredEmployees.map(emp => emp.id)));
    }
  };
  const toggleSelectEmployee = (id: string) => {
    const newSelected = new Set(selectedEmployees);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedEmployees(newSelected);
  };
  const downloadTemplate = () => {
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const wsData = [["Name", "Surname", "ID Number"], ["John", "Doe", "9001015009087"], ["Jane", "Smith", "8505125800082"]];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Employees");

    // Generate and download file
    XLSX.writeFile(wb, "employee_upload_template.xlsx");
    toast({
      title: "Template Downloaded",
      description: "Check your downloads folder for the Excel template."
    });
  };
  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Validate and sanitize each employee record
      const validatedEmployees: any[] = [];
      const errors: string[] = [];

      // Helper function to find column value with flexible matching
      const getColumnValue = (row: any, ...possibleNames: string[]): string => {
        // First try exact matches
        for (const name of possibleNames) {
          if (row[name] !== undefined && row[name] !== null) {
            return String(row[name]).trim();
          }
        }

        // Then try case-insensitive and trimmed matches
        const rowKeys = Object.keys(row);
        for (const name of possibleNames) {
          const normalizedName = name.toLowerCase().trim();
          const matchingKey = rowKeys.find(key => key.toLowerCase().trim() === normalizedName);
          if (matchingKey && row[matchingKey] !== undefined && row[matchingKey] !== null) {
            return String(row[matchingKey]).trim();
          }
        }
        return "";
      };
      for (let i = 0; i < jsonData.length; i++) {
        const row: any = jsonData[i];
        const rowNumber = i + 2; // Excel row number (accounting for header)

        try {
          const rawData = {
            employeeName: sanitizeText(getColumnValue(row, "Name", "name", "Employee Name", "employee_name", "First Name", "firstname")),
            employeeSurname: sanitizeText(getColumnValue(row, "Surname", "surname", "Employee Surname", "employee_surname", "Last Name", "lastname")),
            idNumber: sanitizeText(getColumnValue(row, "ID Number", "id_number", "ID", "id", "IDNumber", "Id Number"))
          };

          // Skip empty rows
          if (!rawData.employeeName && !rawData.employeeSurname && !rawData.idNumber) {
            continue;
          }

          // Validate the data
          const validatedData = employeeSchema.parse(rawData);
          validatedEmployees.push({
            company_id: user.id,
            employee_name: validatedData.employeeName,
            employee_surname: validatedData.employeeSurname,
            id_number: validatedData.idNumber
          });
        } catch (err: any) {
          errors.push(`Row ${rowNumber}: ${err.errors?.[0]?.message || err.message}`);
        }
      }
      if (validatedEmployees.length === 0) {
        throw new Error("No valid employee data found. Please ensure your Excel has columns: Name, Surname, ID Number");
      }
      if (errors.length > 0 && errors.length < 10) {
        // Show first few errors
        toast({
          title: "Warning",
          description: `${errors.length} row(s) skipped due to validation errors. First error: ${errors[0]}`,
          variant: "destructive"
        });
      } else if (errors.length >= 10) {
        toast({
          title: "Warning",
          description: `${errors.length} row(s) skipped due to validation errors. Please check your data format.`,
          variant: "destructive"
        });
      }
      const {
        error
      } = await supabase.from("employees").insert(validatedEmployees);
      if (error) throw error;
      toast({
        title: "Success",
        description: `${validatedEmployees.length} employee(s) imported successfully!${errors.length > 0 ? ` (${errors.length} skipped)` : ""}`
      });
      fetchEmployees();
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>;
  }
  return <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">Employees</h1>
            <p className="text-muted-foreground">
              Manage your employee records
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleBulkDelete} disabled={selectedEmployees.size === 0} className={`gap-2 ${selectedEmployees.size > 0 ? "border-destructive text-destructive hover:bg-destructive/10" : ""}`}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
            <Button variant="outline" className="gap-2" onClick={downloadTemplate}>
              <Download className="h-4 w-4" />
              Download Template
            </Button>
            <div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleBulkUpload} className="hidden" id="bulk-upload" />
              <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
                <Upload className="h-4 w-4" />
                Bulk Upload
              </Button>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Employee
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingEmployee ? "Edit Employee" : "Add New Employee"}</DialogTitle>
                <DialogDescription>
                  {editingEmployee ? "Update the employee's details below" : "Enter the employee's details below"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="employeeName">Name *</Label>
                  <Input id="employeeName" value={formData.employeeName} onChange={e => setFormData({
                    ...formData,
                    employeeName: e.target.value
                  })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employeeSurname">Surname *</Label>
                  <Input id="employeeSurname" value={formData.employeeSurname} onChange={e => setFormData({
                    ...formData,
                    employeeSurname: e.target.value
                  })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="idNumber">ID Number *</Label>
                  <Input id="idNumber" value={formData.idNumber} onChange={e => setFormData({
                    ...formData,
                    idNumber: e.target.value
                  })} required />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? editingEmployee ? "Updating..." : "Adding..." : editingEmployee ? "Update Employee" : "Add Employee"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Employee List</CardTitle>
            <CardDescription>
              {employees.length} employee{employees.length !== 1 ? "s" : ""} registered
            </CardDescription>
            <div className="mt-4">
              <Input placeholder="Search by name, surname, or ID number..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="max-w-md" />
            </div>
          </CardHeader>
          <CardContent>
            {employees.length === 0 ? <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No employees added yet</p>
                <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Your First Employee
                </Button>
              </div> : <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox checked={filteredEmployees.length > 0 && selectedEmployees.size === filteredEmployees.length} onCheckedChange={toggleSelectAll} />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Surname</TableHead>
                    <TableHead>ID Number</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map(employee => <TableRow key={employee.id}>
                      <TableCell>
                        <Checkbox checked={selectedEmployees.has(employee.id)} onCheckedChange={() => toggleSelectEmployee(employee.id)} />
                      </TableCell>
                      <TableCell className="font-medium cursor-pointer hover:text-primary" onClick={() => handleEdit(employee)}>
                        {employee.employee_name}
                      </TableCell>
                      <TableCell>{employee.employee_surname}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">
                            {revealedIds.has(employee.id) ? employee.id_number : maskSAIdNumber(employee.id_number)}
                          </span>
                          <Button variant="ghost" size="sm" onClick={e => {
                      e.stopPropagation();
                      const newRevealed = new Set(revealedIds);
                      if (newRevealed.has(employee.id)) {
                        newRevealed.delete(employee.id);
                      } else {
                        newRevealed.add(employee.id);
                      }
                      setRevealedIds(newRevealed);
                    }} className="h-6 w-6 p-0" title={revealedIds.has(employee.id) ? "Hide ID" : "Show full ID"}>
                            {revealedIds.has(employee.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(employee)} className="hover:text-primary hover:bg-slate-50 bg-slate-50">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => navigate('/warning-generator', {
                      state: {
                        employeeName: employee.employee_name,
                        employeeSurname: employee.employee_surname,
                        employeeIdNumber: employee.id_number
                      }
                    })} className="group hover:bg-slate-50 bg-slate-50">
                            <FilePlus className="h-4 w-4 transition-colors group-hover:text-primary" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>)}
                </TableBody>
              </Table>}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>;
};
export default Employees;