import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Upload,
  FilePlus,
  Eye,
  EyeOff,
  Download,
  Search,
  Pencil,
  X,
  FileUp,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import {
  contractTypes,
  employeeBasicSchema,
  employeeImportSchema,
  employeeProfileSchema,
  sanitizeText,
  genderOptions,
  nationalityOptions,
  raceOptions,
  southAfricanProvinces,
  type EmployeeBasicFormData,
  type EmployeeProfileFormData,
} from "@/lib/validation";
import { maskSAIdNumber } from "@/lib/idMasking";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type Employee = Tables<"employees">;
type EmployeeTab = "personal" | "employment" | "documents";

const DEFAULT_EMPLOYEE_NUMBER_PREFIX = "A";
const DEFAULT_PROVINCE = southAfricanProvinces[2] ?? southAfricanProvinces[0];
const DEFAULT_NATIONALITY: EmployeeProfileFormData["nationality"] = "South African";
const dateToday = () => new Date().toISOString().split("T")[0];

const extractErrorMessage = (error: unknown): string | undefined => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const errorWithMessage = error as { message?: unknown };
    if (typeof errorWithMessage.message === "string") {
      return errorWithMessage.message;
    }

    const errorWithErrors = error as { errors?: Array<{ message?: string }> };
    const firstMessage = errorWithErrors.errors?.find((item) => typeof item?.message === "string")?.message;
    if (firstMessage) {
      return firstMessage;
    }
  }

  return undefined;
};

const createBlankAddForm = (): EmployeeBasicFormData => ({
  employeeName: "",
  employeeSurname: "",
  idNumber: "",
 });

const createProfileFormFromEmployee = (employee?: Employee): EmployeeProfileFormData => ({
   employeeName: employee?.employee_name ?? "",
   employeeSurname: employee?.employee_surname ?? "",
   idNumber: employee?.id_number ?? "",
   startDate: employee?.start_date ?? dateToday(),
   contractType: (employee?.contract_type as EmployeeProfileFormData["contractType"]) ?? "Permanent",
   endDate: employee?.end_date ?? "",
   gender: (employee?.gender as EmployeeProfileFormData["gender"]) ?? genderOptions[0],
   race: (employee?.race as EmployeeProfileFormData["race"]) ?? raceOptions[0],
   nationality: (employee?.nationality as EmployeeProfileFormData["nationality"]) ?? DEFAULT_NATIONALITY,
   employeeNumberMode: employee?.employee_number ? "manual" : "auto",
   employeeNumberPrefix: (employee?.employee_number?.[0]?.toUpperCase() ?? DEFAULT_EMPLOYEE_NUMBER_PREFIX) as string,
   employeeNumber: employee?.employee_number ?? "",
   jobTitle: employee?.job_title ?? "",
   physicalAddressLine1: employee?.physical_address_line1 ?? "",
   physicalAddressLine2: employee?.physical_address_line2 ?? "",
   city: employee?.city ?? "",
   province: (employee?.province as EmployeeProfileFormData["province"]) ?? DEFAULT_PROVINCE,
   areaCode: employee?.area_code ?? "",
   cellNumber: employee?.cell_number ?? "",
   email: employee?.email ?? "",
   emergencyContactName: employee?.emergency_contact_name ?? "",
   emergencyContactNumber: employee?.emergency_contact_number ?? "",
 });

const getNextEmployeeNumber = (currentEmployees: Employee[], prefix: string) => {
  const normalizedPrefix = prefix?.match(/^[A-Z]$/) ? prefix : DEFAULT_EMPLOYEE_NUMBER_PREFIX;
  const highestSequence = currentEmployees.reduce((max, employee) => {
    if (!employee.employee_number?.startsWith(normalizedPrefix)) {
      return max;
    }
    const sequence = parseInt(employee.employee_number.slice(1), 10);
    return Number.isNaN(sequence) ? max : Math.max(max, sequence);
   }, 0);
   return `${normalizedPrefix}${String(highestSequence + 1).padStart(4, "0")}`;
 };

const formatDisplayDate = (value?: string | null) => {
   if (!value) return "N/A";
   const date = new Date(value);
   if (Number.isNaN(date.getTime())) return value;
   return date.toLocaleDateString("en-ZA", {
     year: "numeric",
     month: "2-digit",
     day: "2-digit",
   });
 };

const Employees = () => {
   const { user, loading } = useAuth();
   const navigate = useNavigate();
   const { toast } = useToast();

   const [employees, setEmployees] = useState<Employee[]>([]);
   const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
   const [searchQuery, setSearchQuery] = useState("");
   const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
   const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
   const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
   const [isLoading, setIsLoading] = useState(false);
   const [isProfileSaving, setIsProfileSaving] = useState(false);
   const [isEditMode, setIsEditMode] = useState(false);
   const [activeTab, setActiveTab] = useState<EmployeeTab>("personal");
   const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

   const [addForm, setAddForm] = useState<EmployeeBasicFormData>(createBlankAddForm());
   const [profileForm, setProfileForm] = useState<EmployeeProfileFormData>(createProfileFormFromEmployee());
   const fileInputRef = useRef<HTMLInputElement>(null);

   const autoNumberPreview = useMemo(() => {
     if (profileForm.employeeNumberMode === "auto") {
       return getNextEmployeeNumber(employees, profileForm.employeeNumberPrefix || DEFAULT_EMPLOYEE_NUMBER_PREFIX);
     }
     return "";
   }, [employees, profileForm.employeeNumberMode, profileForm.employeeNumberPrefix]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const fetchEmployees = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .eq("company_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setEmployees(data || []);
    setFilteredEmployees(data || []);
  }, [toast, user]);

  useEffect(() => {
    if (user) {
      void fetchEmployees();
    }
  }, [user, fetchEmployees]);

   useEffect(() => {
     const query = searchQuery.toLowerCase();
    const filtered = employees.filter((emp) => {
      const fullName = `${emp.employee_name ?? ""} ${emp.employee_surname ?? ""}`.trim().toLowerCase();
       const idNumber = (emp.id_number ?? "").toLowerCase();
       const employeeNumber = (emp.employee_number ?? "").toLowerCase();
       const jobTitle = (emp.job_title ?? "").toLowerCase();
       return (
         fullName.includes(query) ||
         idNumber.includes(query) ||
         employeeNumber.includes(query) ||
         jobTitle.includes(query)
       );
     });
     setFilteredEmployees(filtered);
   }, [employees, searchQuery]);

   useEffect(() => {
     if (profileForm.employeeNumberMode === "auto") {
       setProfileForm((prev) => ({
         ...prev,
         employeeNumberPrefix: prev.employeeNumberPrefix || DEFAULT_EMPLOYEE_NUMBER_PREFIX,
         employeeNumber: autoNumberPreview,
       }));
     }
   }, [profileForm.employeeNumberMode, autoNumberPreview]);

   const handleAddEmployee = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!user) return;
     setIsLoading(true);
     try {
       const validated = employeeBasicSchema.parse(addForm);
       const { error } = await supabase.from("employees").insert({
         company_id: user.id,
         employee_name: validated.employeeName,
         employee_surname: validated.employeeSurname,
         id_number: validated.idNumber,
       });
       if (error) throw error;

      toast({
        title: "Success",
        description: "Employee added successfully!",
      });
      setAddForm(createBlankAddForm());
      setIsAddDialogOpen(false);
      await fetchEmployees();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: extractErrorMessage(error) ?? "Unable to add employee. Please check the details and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
   };

   const handleProfileSave = async () => {
     if (!selectedEmployee) return;
     setIsProfileSaving(true);
     try {
       const validated = employeeProfileSchema.parse(profileForm);
       const endDateValue =
         validated.contractType === "Temporary" && validated.endDate ? validated.endDate : null;
       const finalEmployeeNumber =
         validated.employeeNumberMode === "auto"
           ? getNextEmployeeNumber(employees, validated.employeeNumberPrefix || DEFAULT_EMPLOYEE_NUMBER_PREFIX)
           : validated.employeeNumber || null;

       const { error } = await supabase
         .from("employees")
         .update({
           employee_name: validated.employeeName,
           employee_surname: validated.employeeSurname,
           id_number: validated.idNumber,
           start_date: validated.startDate,
           contract_type: validated.contractType,
           end_date: endDateValue,
           gender: validated.gender,
           race: validated.race,
           nationality: validated.nationality,
           employee_number: finalEmployeeNumber,
           job_title: validated.jobTitle || null,
           physical_address_line1: validated.physicalAddressLine1 || null,
           physical_address_line2: validated.physicalAddressLine2 || null,
           city: validated.city || null,
           province: validated.province,
           area_code: validated.areaCode || null,
           cell_number: validated.cellNumber || null,
           email: validated.email || null,
           emergency_contact_name: validated.emergencyContactName || null,
           emergency_contact_number: validated.emergencyContactNumber || null,
         })
         .eq("id", selectedEmployee.id);

       if (error) throw error;

      toast({
        title: "Employee updated",
        description: "Employee profile has been saved successfully.",
      });

      setIsEditMode(false);
      await fetchEmployees();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: extractErrorMessage(error) ?? "Unable to save changes. Please review the details and try again.",
        variant: "destructive",
      });
    } finally {
      setIsProfileSaving(false);
    }
   };

   const handleBulkDelete = async () => {
     if (selectedEmployees.size === 0 || !user) return;
     const confirmed = confirm(`Are you sure you want to delete ${selectedEmployees.size} employee(s)?`);
     if (!confirmed) return;

     const { error } = await supabase
       .from("employees")
       .delete()
       .in("id", Array.from(selectedEmployees));

     if (error) {
       toast({
         title: "Error",
         description: error.message,
         variant: "destructive",
       });
       return;
     }

    toast({
      title: "Success",
      description: `${selectedEmployees.size} employee(s) deleted successfully!`,
    });

    setSelectedEmployees(new Set());
    await fetchEmployees();
   };

   const handleBulkDialogChange = (open: boolean) => {
     setIsBulkDialogOpen(open);
     if (!open && fileInputRef.current) {
       fileInputRef.current.value = "";
     }
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

      const validatedEmployees: TablesInsert<"employees">[] = [];
      const errors: string[] = [];

      const getColumnValue = (row: Record<string, unknown>, ...possibleNames: string[]): string => {
        for (const name of possibleNames) {
          if (row[name] !== undefined && row[name] !== null) {
            return String(row[name]).trim();
          }
        }
        const rowKeys = Object.keys(row);
        for (const name of possibleNames) {
          const normalizedName = name.toLowerCase().trim();
           const matchingKey = rowKeys.find((key) => key.toLowerCase().trim() === normalizedName);
          if (matchingKey && row[matchingKey] !== undefined && row[matchingKey] !== null) {
            return String(row[matchingKey]).trim();
          }
        }
        return "";
      };

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as Record<string, unknown>;
        const rowNumber = i + 2;
        try {
          const rawData = {
            employeeName: sanitizeText(getColumnValue(row, "Name", "First Name", "employee_name")),
            employeeSurname: sanitizeText(getColumnValue(row, "Surname", "Last Name", "employee_surname")),
            idNumber: sanitizeText(getColumnValue(row, "ID Number", "ID", "id_number", "Id Number")),
          };

          if (!rawData.employeeName && !rawData.employeeSurname && !rawData.idNumber) {
            continue;
          }

          const validated = employeeImportSchema.parse(rawData);
          validatedEmployees.push({
            company_id: user.id,
             employee_name: validated.employeeName,
             employee_surname: validated.employeeSurname,
             id_number: validated.idNumber,
           });
        } catch (err: unknown) {
          errors.push(`Row ${rowNumber}: ${extractErrorMessage(err) ?? "Unknown validation error"}`);
        }
      }

      if (validatedEmployees.length === 0) {
        throw new Error("No valid employee data found. Please ensure your Excel has columns: Name, Surname, ID Number");
      }

      if (errors.length > 0) {
        toast({
          title: "Warning",
          description: `${errors.length} row(s) skipped due to validation errors. First error: ${errors[0]}`,
          variant: "destructive",
        });
       }

      const { error } = await supabase.from("employees").insert(validatedEmployees);
      if (error) throw error;

      toast({
        title: "Success",
        description: `${validatedEmployees.length} employee(s) imported successfully!`,
      });

      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchEmployees();
      handleBulkDialogChange(false);
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: extractErrorMessage(error) ?? "Import failed. Please verify the file and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
   };

   const downloadTemplate = () => {
     const wb = XLSX.utils.book_new();
     const wsData = [
       ["Name", "Surname", "ID Number"],
       ["John", "Doe", "9001015009087"],
       ["Jane", "Smith", "8505125800082"],
     ];
     const ws = XLSX.utils.aoa_to_sheet(wsData);
     XLSX.utils.book_append_sheet(wb, ws, "Employees");
     XLSX.writeFile(wb, "employee_upload_template.xlsx");
     toast({
       title: "Template Downloaded",
       description: "Check your downloads folder for the Excel template.",
     });
   };

   const toggleSelectAll = () => {
     if (selectedEmployees.size === filteredEmployees.length) {
       setSelectedEmployees(new Set());
       return;
     }
     setSelectedEmployees(new Set(filteredEmployees.map((emp) => emp.id)));
   };

   const toggleSelectEmployee = (id: string) => {
     const next = new Set(selectedEmployees);
     if (next.has(id)) {
       next.delete(id);
     } else {
       next.add(id);
     }
     setSelectedEmployees(next);
   };

   const openProfileDialog = (employee: Employee) => {
     setSelectedEmployee(employee);
     setProfileForm(createProfileFormFromEmployee(employee));
     setActiveTab("personal");
     setIsEditMode(false);
     setIsProfileDialogOpen(true);
   };

   const closeProfileDialog = () => {
     setIsProfileDialogOpen(false);
     setSelectedEmployee(null);
     setIsEditMode(false);
   };

   const renderPersonalTab = () => (
     <div className="space-y-4">
       <div className="grid md:grid-cols-2 gap-4">
         <div className="space-y-1.5">
           <Label>Name</Label>
           <Input
             value={profileForm.employeeName}
             disabled={!isEditMode}
             onChange={(e) =>
               setProfileForm((prev) => ({
                 ...prev,
                 employeeName: e.target.value,
               }))
             }
           />
         </div>

[... truncated ...]
        <div className="space-y-1.5">
          <Label>Surname</Label>
          <Input
            value={profileForm.employeeSurname}
            disabled={!isEditMode}
            onChange={(e) =>
              setProfileForm((prev) => ({
                ...prev,
                employeeSurname: e.target.value,
              }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>ID Number</Label>
          <Input
            value={profileForm.idNumber}
            disabled={!isEditMode}
            onChange={(e) =>
              setProfileForm((prev) => ({
                ...prev,
                idNumber: e.target.value,
              }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Nationality</Label>
          <Select
            value={profileForm.nationality}
            disabled={!isEditMode}
            onValueChange={(value) =>
              setProfileForm((prev) => ({
                ...prev,
                nationality: value as EmployeeProfileFormData["nationality"],
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select nationality" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {nationalityOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Gender</Label>
          <Select
            value={profileForm.gender}
            disabled={!isEditMode}
            onValueChange={(value) =>
              setProfileForm((prev) => ({
                ...prev,
                gender: value as EmployeeProfileFormData["gender"],
              }))
            }
          >
            <SelectTrigger>
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
          <Label>Race</Label>
          <Select
            value={profileForm.race}
            disabled={!isEditMode}
            onValueChange={(value) =>
              setProfileForm((prev) => ({
                ...prev,
                race: value as EmployeeProfileFormData["race"],
              }))
            }
          >
            <SelectTrigger>
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
          <Label>Cell Number</Label>
          <Input
            value={profileForm.cellNumber}
            disabled={!isEditMode}
            onChange={(e) =>
              setProfileForm((prev) => ({
                ...prev,
                cellNumber: e.target.value,
              }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input
            type="email"
            value={profileForm.email}
            disabled={!isEditMode}
            onChange={(e) =>
              setProfileForm((prev) => ({
                ...prev,
                email: e.target.value,
              }))
            }
          />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Address Line 1</Label>
          <Input
            placeholder="Apartment/suite number and complex name"
            value={profileForm.physicalAddressLine1}
            disabled={!isEditMode}
            onChange={(e) =>
              setProfileForm((prev) => ({
                ...prev,
                physicalAddressLine1: e.target.value,
              }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Address Line 2</Label>
          <Input
            placeholder="Street name and number"
            value={profileForm.physicalAddressLine2}
            disabled={!isEditMode}
            onChange={(e) =>
              setProfileForm((prev) => ({
                ...prev,
                physicalAddressLine2: e.target.value,
              }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>City</Label>
          <Input
            value={profileForm.city}
            disabled={!isEditMode}
            onChange={(e) =>
              setProfileForm((prev) => ({
                ...prev,
                city: e.target.value,
              }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Province</Label>
          <Select
            value={profileForm.province}
            disabled={!isEditMode}
            onValueChange={(value) =>
              setProfileForm((prev) => ({
                ...prev,
                province: value as EmployeeProfileFormData["province"],
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select province" />
            </SelectTrigger>
            <SelectContent>
              {southAfricanProvinces.map((province) => (
                <SelectItem key={province} value={province}>
                  {province}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Area Code</Label>
          <Input
            value={profileForm.areaCode}
            disabled={!isEditMode}
            onChange={(e) =>
              setProfileForm((prev) => ({
                ...prev,
                areaCode: e.target.value,
              }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Emergency Contact</Label>
          <Input
            placeholder="Name and surname"
            value={profileForm.emergencyContactName}
            disabled={!isEditMode}
            onChange={(e) =>
              setProfileForm((prev) => ({
                ...prev,
                emergencyContactName: e.target.value,
              }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Emergency Contact Number</Label>
          <Input
            value={profileForm.emergencyContactNumber}
            disabled={!isEditMode}
            onChange={(e) =>
              setProfileForm((prev) => ({
                ...prev,
                emergencyContactNumber: e.target.value,
              }))
            }
          />
        </div>
      </div>
    </div>
  );

  const renderEmploymentTab = () => (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Start Date</Label>
          <Input
            type="date"
            value={profileForm.startDate}
            disabled={!isEditMode}
            onChange={(e) =>
              setProfileForm((prev) => ({
                ...prev,
                startDate: e.target.value,
              }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Contract Type</Label>
          <Select
            value={profileForm.contractType}
            disabled={!isEditMode}
            onValueChange={(value) =>
              setProfileForm((prev) => ({
                ...prev,
                contractType: value as EmployeeProfileFormData["contractType"],
                endDate: value === "Temporary" ? prev.endDate : "",
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select contract type" />
            </SelectTrigger>
            <SelectContent>
              {contractTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {profileForm.contractType === "Temporary" && (
          <div className="space-y-1.5">
            <Label>End Date</Label>
            <Input
              type="date"
              value={profileForm.endDate}
              disabled={!isEditMode}
              onChange={(e) =>
                setProfileForm((prev) => ({
                  ...prev,
                  endDate: e.target.value,
                }))
              }
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Job Title</Label>
          <Input
            value={profileForm.jobTitle}
            disabled={!isEditMode}
            onChange={(e) =>
              setProfileForm((prev) => ({
                ...prev,
                jobTitle: e.target.value,
              }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Employee Number</Label>
          <div className="grid gap-2">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant={profileForm.employeeNumberMode === "manual" ? "default" : "outline"}
                disabled={!isEditMode}
                onClick={() =>
                  setProfileForm((prev) => ({
                    ...prev,
                    employeeNumberMode: selectedEmployee?.employee_number ? "manual" : "auto",
                  }))
                }
              >
                Manual
              </Button>
              <Button
                type="button"
                variant={profileForm.employeeNumberMode === "auto" ? "default" : "outline"}
                disabled={!isEditMode}
                onClick={() =>
                  setProfileForm((prev) => ({
                    ...prev,
                    employeeNumberMode: "auto",
                  }))
                }
              >
                Auto-generate
              </Button>
            </div>

            {profileForm.employeeNumberMode === "manual" ? (
              <Input
                value={profileForm.employeeNumber}
                disabled={!isEditMode}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    employeeNumber: e.target.value.toUpperCase(),
                  }))
                }
                placeholder="Enter employee number"
              />
            ) : (
              <div className="flex items-center gap-3">
                <Input
                  value={profileForm.employeeNumberPrefix}
                  disabled={!isEditMode}
                  maxLength={1}
                  placeholder={DEFAULT_EMPLOYEE_NUMBER_PREFIX}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
                    setProfileForm((prev) => ({
                      ...prev,
                      employeeNumberPrefix: value,
                      employeeNumber: getNextEmployeeNumber(employees, value || DEFAULT_EMPLOYEE_NUMBER_PREFIX),
                    }));
                  }}
                />
                <p className="text-sm text-muted-foreground">
                  Next number: <span className="font-medium text-primary">{autoNumberPreview}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderDocumentsTab = () => (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold">Employment Contract</h4>
          <p className="text-sm text-muted-foreground">
            Upload the signed employment contract for this employee.
          </p>
        </div>
        <Button type="button" variant="outline" disabled className="gap-2">
          <FileUp className="h-4 w-4" />
          Upload Contract (coming soon)
        </Button>
      </div>
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold">Warnings & Supporting Documents</h4>
          <p className="text-sm text-muted-foreground">
            Store written warnings or supporting documentation for disciplinary matters.
          </p>
        </div>
        <Button type="button" variant="outline" disabled className="gap-2">
          <FileUp className="h-4 w-4" />
          Upload Warning (coming soon)
        </Button>
      </div>
    </div>
  );

   if (loading) {
     return (
       <div className="min-h-screen flex items-center justify-center">
         <p className="text-muted-foreground">Loading...</p>
       </div>
     );
   }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Employees</h1>
            <p className="text-muted-foreground">Manage your employee records</p>
          </div>
          <div className="flex flex-wrap gap-3 justify-end">
            <Button
              variant="outline"
              onClick={handleBulkDelete}
              disabled={selectedEmployees.size === 0}
              className={`gap-2 ${
                selectedEmployees.size > 0 ? "border-destructive text-destructive hover:bg-destructive/10" : ""
              }`}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>

            <Dialog open={isBulkDialogOpen} onOpenChange={handleBulkDialogChange}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Upload className="h-4 w-4" />
                  Bulk Upload
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Upload Bulk Employees</DialogTitle>
                  <DialogDescription>
                    Download the template, complete the details, then upload to import employees.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-8">
                  <div>
                    <div className="space-y-3">
                      <div className="h-px bg-muted" />
                      <h4 className="text-sm font-semibold">Step 1: Download</h4>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Download the spreadsheet to capture your employee information.
                    </p>
                    <Button variant="outline" className="mt-4 gap-2 w-full text-primary [&_svg]:text-primary" onClick={downloadTemplate}>
                      <Download className="h-4 w-4" />
                      Download Template
                    </Button>
                  </div>
                  <div>
                    <div className="space-y-3">
                      <div className="h-px bg-muted" />
                      <h4 className="text-sm font-semibold">Step 2: Upload</h4>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Upload spreadsheet. Accepted formats: .xlsx or .xls
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleBulkUpload}
                      className="hidden"
                      id="bulk-upload"
                    />
                    <Button className="mt-4 gap-2 w-full" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
                      <Upload className="h-4 w-4" />
                      Upload File
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Employee
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Employee</DialogTitle>
                  <DialogDescription>Capture the employee&apos;s basic details to get started.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddEmployee} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="employeeName">Name *</Label>
                    <Input
                      id="employeeName"
                      value={addForm.employeeName}
                      onChange={(e) =>
                        setAddForm((prev) => ({
                          ...prev,
                          employeeName: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employeeSurname">Surname *</Label>
                    <Input
                      id="employeeSurname"
                      value={addForm.employeeSurname}
                      onChange={(e) =>
                        setAddForm((prev) => ({
                          ...prev,
                          employeeSurname: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="idNumber">ID Number *</Label>
                    <Input
                      id="idNumber"
                      value={addForm.idNumber}
                      onChange={(e) =>
                        setAddForm((prev) => ({
                          ...prev,
                          idNumber: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Saving..." : "Add Employee"}
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
              <Input
                placeholder="Search by name, surname, ID number, employee number, or job title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-md"
              />
            </div>
          </CardHeader>
          <CardContent>
            {employees.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No employees added yet</p>
                <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Your First Employee
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={filteredEmployees.length > 0 && selectedEmployees.size === filteredEmployees.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>ID Number</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Contract Type</TableHead>
                    <TableHead>Job Title</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedEmployees.has(employee.id)}
                          onCheckedChange={() => toggleSelectEmployee(employee.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <button
                          type="button"
                          onClick={() => openProfileDialog(employee)}
                          className="text-left hover:text-primary transition-colors"
                        >
                          {(employee.employee_name ?? "").trim()} {(employee.employee_surname ?? "").trim()}
                        </button>
                        {employee.employee_number && (
                          <p className="text-xs text-muted-foreground">#{employee.employee_number}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">
                            {employee.id_number
                              ? revealedIds.has(employee.id)
                                ? employee.id_number
                                : maskSAIdNumber(employee.id_number)
                              : "N/A"}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = new Set(revealedIds);
                              if (next.has(employee.id)) {
                                next.delete(employee.id);
                              } else {
                                next.add(employee.id);
                              }
                              setRevealedIds(next);
                            }}
                            className="h-6 w-6 p-0"
                            title={revealedIds.has(employee.id) ? "Hide ID" : "Show full ID"}
                          >
                            {revealedIds.has(employee.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>{formatDisplayDate(employee.start_date)}</TableCell>
                      <TableCell>{employee.contract_type ?? "N/A"}</TableCell>
                      <TableCell>{employee.job_title ?? "N/A"}</TableCell>
                      <TableCell className="text-center">
                        <TooltipProvider delayDuration={0}>
                          <div className="flex items-center justify-center gap-1.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openProfileDialog(employee)}
                                  className="hover:text-primary hover:bg-muted/50 bg-transparent"
                                >
                                  <Search className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">View Profile</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    navigate("/warning-generator", {
                                      state: {
                                        employeeName: employee.employee_name ?? "",
                                        employeeSurname: employee.employee_surname ?? "",
                                        employeeIdNumber: employee.id_number ?? "",
                                      },
                                    })
                                  }
                                  className="group hover:bg-muted/50 bg-transparent"
                                >
                                  <FilePlus className="h-4 w-4 transition-colors group-hover:text-primary" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Add Document</TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isProfileDialogOpen} onOpenChange={(open) => (open ? undefined : closeProfileDialog())}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader className="space-y-3">
            <DialogTitle>Employee Profile</DialogTitle>
            <DialogDescription>
              Here you can view, edit, and update this employee&apos;s information.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className="font-medium">
                {(selectedEmployee?.employee_name ?? "").trim()} {(selectedEmployee?.employee_surname ?? "").trim()}
              </p>
              <p className="text-sm text-muted-foreground">
                Employee #{selectedEmployee?.employee_number ?? "Not assigned"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={isEditMode ? "outline" : "default"}
                size="sm"
                className="gap-2"
                onClick={() => setIsEditMode((prev) => !prev)}
              >
                {isEditMode ? (
                  <>
                    <X className="h-4 w-4" />
                    Cancel Editing
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4" />
                    Edit Information
                  </>
                )}
              </Button>
              {isEditMode && (
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={handleProfileSave}
                  disabled={isProfileSaving}
                >
                  {isProfileSaving ? "Saving..." : "Save Changes"}
                </Button>
              )}
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as EmployeeTab)} className="mt-4">
            <TabsList className="grid grid-cols-3 max-w-md">
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="employment">Employment</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>
            <TabsContent value="personal" className="mt-6">
              {renderPersonalTab()}
            </TabsContent>
            <TabsContent value="employment" className="mt-6">
              {renderEmploymentTab()}
            </TabsContent>
            <TabsContent value="documents" className="mt-6">
              {renderDocumentsTab()}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
 };

export default Employees;
