import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, PointerEvent, SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  ChevronLeft,
  ChevronRight,
  X,
  User,
  UserPlus,
  Users,
  UsersRound,
  ArrowRight,
  Menu,
  ChevronDown,
  Check,
  Save,
  Mail,
  Phone,
  Flag,
  UserCircle2,
  Calendar,
  BadgeCheck,
  BriefcaseBusiness,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { getSafeErrorMessage } from "@/lib/errorHandling";
import {
  EMPLOYEE_NUMBER_MAX_LENGTH,
  contractTypes,
  citizenshipStatusOptions,
  employeeBasicSchema,
  employeeImportSchema,
  employeeProfileSchema,
  sanitizeEmployeeNumber,
  nationalityOptions,
  genderOptions,
  raceOptions,
  southAfricanProvinces,
  type EmployeeProfileFormData,
} from "@/lib/validation";
import { maskSAIdNumber } from "@/lib/idMasking";
import { extractDobFromId } from "@/lib/validation";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
// Supabase types do not include employee_warnings; cast to any for those calls to avoid type errors.
const warningTable = () => (supabase as any).from("employee_warnings");
// Supabase types do not include employee_contracts; cast to any for those calls to avoid type errors.
const contractTable = () => (supabase as any).from("employee_contracts");
// Supabase types do not include employee_id_documents; cast to any for those calls to avoid type errors.
const idDocumentTable = () => (supabase as any).from("employee_id_documents");
// Supabase types do not include employee_licences; cast to any for those calls to avoid type errors.
const licenceTable = () => (supabase as any).from("employee_licences");
// Supabase types do not include employee_education; cast to any for those calls to avoid type errors.
const educationTable = () => (supabase as any).from("employee_education");
// Supabase types do not include employee_termination_documents; cast to any for those calls to avoid type errors.
const terminationDocumentTable = () => (supabase as any).from("employee_termination_documents");
const employeeSelectColumnsBase =
  "id, company_id, employee_name, employee_surname, id_number, status, start_date, end_date, contract_type, probation_period, union_member, trade_union, department, branch, reporting_to, occupational_level, salary_type, basic_salary, work_email, work_cell_number, gender, race, nationality, employee_number, job_title, physical_address_line1, physical_address_line2, city, province, area_code, postal_address_line1, postal_address_line2, postal_city, postal_province, postal_area_code, cell_number, email, emergency_contact_name, emergency_contact_number, created_at";
const employeeSelectColumnsWithTermination =
  "id, company_id, employee_name, employee_surname, id_number, status, termination_reason, previous_job_title, terminated_at, start_date, end_date, contract_type, probation_period, union_member, trade_union, department, branch, reporting_to, occupational_level, salary_type, basic_salary, work_email, work_cell_number, gender, race, nationality, employee_number, job_title, physical_address_line1, physical_address_line2, city, province, area_code, postal_address_line1, postal_address_line2, postal_city, postal_province, postal_area_code, cell_number, email, emergency_contact_name, emergency_contact_number, created_at";

type Employee = Tables<"employees"> & {
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  contract_type?: string | null;
  probation_period?: string | null;
  union_member?: string | null;
  trade_union?: string | null;
  department?: string | null;
  branch?: string | null;
  reporting_to?: string | null;
  occupational_level?: string | null;
  salary_type?: string | null;
  basic_salary?: string | null;
  work_email?: string | null;
  work_cell_number?: string | null;
  nationality?: string | null;
  employee_number?: string | null;
  job_title?: string | null;
  gender?: string | null;
  race?: string | null;
  date_of_birth?: string | null;
  disability_status?: boolean | null;
  citizenship_status?: string | null;
  income_tax_number?: string | null;
  uif_number?: string | null;
  physical_address_line1?: string | null;
  physical_address_line2?: string | null;
  city?: string | null;
  postal_address_line1?: string | null;
  postal_address_line2?: string | null;
  postal_city?: string | null;
  postal_province?: string | null;
  postal_area_code?: string | null;
  province?: string | null;
  area_code?: string | null;
  cell_number?: string | null;
  email?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_number?: string | null;
  termination_reason?: string | null;
  previous_job_title?: string | null;
  terminated_at?: string | null;
};
type EmployeeInsert = TablesInsert<"employees"> & {
  employee_number?: string | null;
  contract_type?: string | null;
  job_title?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  probation_period?: string | null;
  union_member?: string | null;
  trade_union?: string | null;
  department?: string | null;
  branch?: string | null;
  reporting_to?: string | null;
  occupational_level?: string | null;
  salary_type?: string | null;
  basic_salary?: string | null;
  work_email?: string | null;
  work_cell_number?: string | null;
  nationality?: string | null;
  gender?: string | null;
  race?: string | null;
  status?: string | null;
  date_of_birth?: string | null;
  disability_status?: boolean | null;
  citizenship_status?: string | null;
  income_tax_number?: string | null;
  uif_number?: string | null;
  physical_address_line1?: string | null;
  physical_address_line2?: string | null;
  city?: string | null;
  postal_address_line1?: string | null;
  postal_address_line2?: string | null;
  postal_city?: string | null;
  postal_province?: string | null;
  postal_area_code?: string | null;
  province?: string | null;
  area_code?: string | null;
  cell_number?: string | null;
  email?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_number?: string | null;
  termination_reason?: string | null;
  previous_job_title?: string | null;
  terminated_at?: string | null;
};
type EmployeeUpdate = Partial<Employee>;
type EmployeeTab = "personal" | "employment" | "address" | "licences" | "education" | "discipline" | "contracts";
type ProfileSectionKey =
  | "identity"
  | "equity"
  | "contact"
  | "statutory"
  | "employmentStatus"
  | "employmentOrg"
  | "employmentRemuneration"
  | "employmentWorkContact"
  | "employmentUnion"
  | "homeAddress"
  | "postalAddress";
type EmployeeWarning = {
  id: string;
  misconductType: string;
  warningType: "First" | "Second" | "Serious" | "Final";
  issueDate: string;
  expiryDate: string;
  fileName?: string;
  fileUrl?: string;
};
type EmployeeContract = {
  id: string;
  contractType: string;
  issueDate: string;
  fileName?: string;
  fileUrl?: string;
  isActive: boolean;
};
type EmployeeIdDocument = {
  id: string;
  employeeId: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
};
type EmployeeTerminationDocument = {
  id: string;
  employeeId: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
};
type LicenceCategory = "driving" | "firearmSecurity" | "marineAviation";
type EmployeeLicence = {
  id: string;
  employeeId: string;
  category: LicenceCategory;
  licenceType: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
};
type LicencesViewFilter =
  | "driving"
  | "firearmSecurity"
  | "marineAviation";
type EducationCategory = "academic" | "trade" | "training";
type EmployeeEducation = {
  id: string;
  employeeId: string;
  category: EducationCategory;
  qualificationType: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
};
type EducationViewFilter = "academic" | "trade" | "training";
type OffenceSection = {
  title?: string;
  offences?: Array<{ name?: string; category?: string; first?: string }>;
};
type DeleteUndoState = {
  deletedEmployees: Employee[];
  expiresAt: number;
};

type WarningDeleteUndoState = {
  warning: EmployeeWarning;
  employeeId: string;
  storagePath?: string;
  expiresAt: number;
};

type DocumentOption = {
  label: string;
  description: string;
  path: string;
  active: boolean;
};

type DocumentKey = "warnings" | "permanentContract" | "temporaryContract" | "addendum";

type ConductOffence = {
  category: "Minor" | "Serious" | "Dismissible";
  name: string;
  firstOutcome: string;
};

type WarningFormState = {
  misconductTypes: string[];
  warningType: EmployeeWarning["warningType"];
  issueDate: string;
  fileName: string;
};
type ContractFormState = {
  contractType: (typeof contractTypes)[number] | "";
  fileName: string;
};
type AddEmployeeIdType = "id" | "passport" | "";
type AddEmployeeFormState = {
  employeeName: string;
  employeeSurname: string;
  idType: AddEmployeeIdType;
  idNumber: string;
  employeeNumber: string;
  gender: (typeof genderOptions)[number] | "";
  race: (typeof raceOptions)[number] | "";
  cellNumber: string;
  email: string;
  jobTitle: string;
  contractType: (typeof contractTypes)[number] | "";
  startDate: string;
  endDate: string;
  salaryType: (typeof salaryTypeOptions)[number] | "";
  basicSalary: string;
  physicalAddressLine1: string;
  physicalAddressLine2: string;
  city: string;
  province: (typeof southAfricanProvinces)[number] | "";
  areaCode: string;
  postalAddressLine1: string;
  postalAddressLine2: string;
  postalCity: string;
  postalProvince: (typeof southAfricanProvinces)[number] | "";
  postalAreaCode: string;
};

const coerceEnumValue = <T extends string>(value: unknown, options: readonly T[]): T | "" =>
  options.includes(value as T) ? (value as T) : "";

const cleanEmployeeNumberInput = (value?: string | null) => sanitizeEmployeeNumber(value);
const normalizeEmployeeNumber = (value?: string | null) => (value || "").trim().toLowerCase();

const DEFAULT_NATIONALITY: EmployeeProfileFormData["nationality"] = "South African";
const dateToday = () => new Date().toISOString().split("T")[0];
const MISCONDUCT_TYPES = [
  // Minor
  "Unauthorised absenteeism",
  "Arriving late for work",
  "Leaving work early",
  "Failure to report absence",
  "Failure to report late arrival",
  "Failure to report leaving early",
  "Sleeping on duty",
  "Failure to clock in/out",
  "Poor housekeeping",
  "Horseplay",
  "Unauthorised use of cell phone",
  "Breach of Policy or Procedure",
  "Breach of Rules or Regulations",
  "Failure to carry out instructions",
  // Serious
  "Negligence",
  "Unauthorised absenteeism > 5 days",
  "Refusal to work overtime",
  "Consistent poor time keeping",
  "Causing inharmonious relationships",
  "Unbecoming behaviour",
  "Insolence / Disrespectful behaviour",
  "Aggressive behaviour",
  "Insubordination / Refusing instructions",
  "Refusal to comply with policy/procedure",
  "Refusal to comply with rule",
  "Damage to company name",
  "Unauthorised wastage of materials",
  "Unauthorised removal",
  "Unauthorised possession",
  "Breach of OHS standards / policies",
  "Private work during working hours",
  "Unauthorised disclosure of information",
  "Misappropriation of property / funds",
  "Testing positive for alcohol",
  "Testing positive for illegal drugs",
  "Under the influence of alcohol/drugs",
  "Possession of alcohol/drugs on duty",
  "Unauthorised possession of firearm on duty",
  "Intimidation",
  "Incitement",
  "Illegal strike / picketing",
  "Viewing pornographic material on duty",
  "Unauthorised access",
  "Unauthorised use of company property",
  "Unauthorised use of client property",
  "Abusive language",
  "Dishonesty",
  "Gambling on duty",
  "Clocking for another employee",
  // Dismissible
  "Theft",
  "Accomplice to theft",
  "Fraud",
  "Accomplice to fraud",
  "Gross dishonesty",
  "Gross negligence",
  "Assault",
  "Sexual harassment",
  "Viewing illegal pornography on duty",
  "Racism",
  "Refusal to obey OHS rules/procedures",
  "Bribery",
  "Falsification of records",
  "Intentional damage to property",
  "Gross insubordination",
  "Unauthorised discharge of firearm",
  "Unsafe use of firearm",
  "Threatening another employee/client",
  "Unauthorised possession of a weapon on duty",
];

// Remove local error extraction - now using centralized error handling

const createBlankAddForm = (): AddEmployeeFormState => ({
  employeeName: "",
  employeeSurname: "",
  idType: "",
  idNumber: "",
  employeeNumber: "",
  gender: "",
  race: "",
  cellNumber: "",
  email: "",
  jobTitle: "",
  contractType: "",
  startDate: "",
  endDate: "",
  salaryType: "",
  basicSalary: "",
  physicalAddressLine1: "",
  physicalAddressLine2: "",
  city: "",
  province: "",
  areaCode: "",
  postalAddressLine1: "",
  postalAddressLine2: "",
  postalCity: "",
  postalProvince: "",
  postalAreaCode: "",
});

const createAddFormFromEmployee = (employee: Employee): AddEmployeeFormState => {
  const idNumber = (employee.id_number ?? "").trim();
  const normalizedNationality = (employee.nationality ?? "").trim().toLowerCase();
  const isSouthAfrican = normalizedNationality === "south african";
  const idType: AddEmployeeIdType = isSouthAfrican && /^\d{13}$/.test(idNumber) ? "id" : "passport";

  return {
    employeeName: (employee.employee_name ?? "").trim(),
    employeeSurname: (employee.employee_surname ?? "").trim(),
    idType: idNumber ? idType : "",
    idNumber,
    employeeNumber: cleanEmployeeNumberInput(employee.employee_number),
    gender: coerceEnumValue(employee.gender, genderOptions),
    race: coerceEnumValue(employee.race, raceOptions),
    cellNumber: (employee.cell_number ?? "").trim(),
    email: (employee.email ?? "").trim(),
    jobTitle: (employee.job_title ?? "").trim(),
    contractType: coerceEnumValue(employee.contract_type, contractTypes),
    startDate: (employee.start_date ?? "").trim(),
    endDate: (employee.end_date ?? "").trim(),
    salaryType: coerceEnumValue(employee.salary_type, salaryTypeOptions),
    basicSalary: (employee.basic_salary ?? "").trim(),
    physicalAddressLine1: (employee.physical_address_line1 ?? "").trim(),
    physicalAddressLine2: (employee.physical_address_line2 ?? "").trim(),
    city: (employee.city ?? "").trim(),
    province: coerceEnumValue(employee.province, southAfricanProvinces),
    areaCode: (employee.area_code ?? "").trim(),
    postalAddressLine1: (employee.postal_address_line1 ?? "").trim(),
    postalAddressLine2: (employee.postal_address_line2 ?? "").trim(),
    postalCity: (employee.postal_city ?? "").trim(),
    postalProvince: coerceEnumValue(employee.postal_province, southAfricanProvinces),
    postalAreaCode: (employee.postal_area_code ?? "").trim(),
  };
};

const formatInputDate = (date: Date | null) => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const createProfileFormFromEmployee = (employee?: Employee): EmployeeProfileFormData => {
  const nationality = (employee?.nationality ?? "").trim() || DEFAULT_NATIONALITY;
  const isSouthAfrican = nationality.toLowerCase() === "south african";
  const storedDob = employee?.date_of_birth ?? "";
  const derivedDob =
    storedDob ||
    (isSouthAfrican ? formatInputDate(extractDobFromId(employee?.id_number ?? "")) : "");

  return {
    employeeName: employee?.employee_name ?? "",
    employeeSurname: employee?.employee_surname ?? "",
    idNumber: employee?.id_number ?? "",
    dateOfBirth: derivedDob,
    startDate: employee?.start_date ?? "",
    contractType:
      (coerceEnumValue(employee?.contract_type, contractTypes) as EmployeeProfileFormData["contractType"]) ??
      "Permanent",
    endDate: employee?.end_date ?? "",
    nationality,
    gender: (employee?.gender ?? "") as EmployeeProfileFormData["gender"],
    disabilityStatus: employee?.disability_status ?? false,
    citizenshipStatus: employee?.citizenship_status ?? "",
    race: (employee?.race ?? "") as EmployeeProfileFormData["race"],
    employeeNumber: cleanEmployeeNumberInput(employee?.employee_number),
    jobTitle: employee?.job_title ?? "",
    physicalAddressLine1: employee?.physical_address_line1 ?? "",
    physicalAddressLine2: employee?.physical_address_line2 ?? "",
    city: employee?.city ?? "",
    province: coerceEnumValue(employee?.province, southAfricanProvinces) as EmployeeProfileFormData["province"],
    areaCode: employee?.area_code ?? "",
    postalAddressLine1: employee?.postal_address_line1 ?? "",
    postalAddressLine2: employee?.postal_address_line2 ?? "",
    postalCity: employee?.postal_city ?? "",
    postalProvince: coerceEnumValue(
      employee?.postal_province,
      southAfricanProvinces,
    ) as EmployeeProfileFormData["postalProvince"],
    postalAreaCode: employee?.postal_area_code ?? "",
    cellNumber: employee?.cell_number ?? "",
    email: employee?.email ?? "",
    emergencyContactName: employee?.emergency_contact_name ?? "",
    emergencyContactNumber: employee?.emergency_contact_number ?? "",
    incomeTaxNumber: employee?.income_tax_number ?? "",
    uifNumber: employee?.uif_number ?? "",
  };
};


const formatDisplayDate = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
};

const formatThousandsWithCommas = (value: string) => {
  if (!value) return "";
  const [integerPart, decimalPart] = value.split(".");
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (decimalPart !== undefined) {
    return `${formattedInteger}.${decimalPart}`;
  }
  return formattedInteger;
};

const sanitizeSalaryInput = (value: string) => {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [integerPart, ...decimalParts] = cleaned.split(".");
  const decimal = decimalParts.join("").slice(0, 2);
  return decimalParts.length > 0 ? `${integerPart}.${decimal}` : integerPart;
};

const getAgeFromIdNumber = (idNumber?: string | null) => {
  if (!idNumber) return "--";
  const digits = idNumber.replace(/\D/g, "");
  if (digits.length < 6) return "--";
  const yearPart = Number(digits.slice(0, 2));
  const monthPart = Number(digits.slice(2, 4));
  const dayPart = Number(digits.slice(4, 6));
  if (Number.isNaN(yearPart) || monthPart < 1 || monthPart > 12 || dayPart < 1 || dayPart > 31) return "--";

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentTwoDigitYear = currentYear % 100;
  const century = yearPart > currentTwoDigitYear ? 1900 : 2000;
  const fullYear = century + yearPart;
  const birthDate = new Date(fullYear, monthPart - 1, dayPart);
  if (Number.isNaN(birthDate.getTime())) return "--";

  let age = currentYear - birthDate.getFullYear();
  const hasBirthdayPassed =
    now.getMonth() > birthDate.getMonth() ||
    (now.getMonth() === birthDate.getMonth() && now.getDate() >= birthDate.getDate());
  if (!hasBirthdayPassed) {
    age -= 1;
  }

  return age >= 0 && age < 130 ? String(age) : "--";
};

const parseMisconductTypes = (value?: string | null) => {
  if (!value) return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item)).filter(Boolean);
      }
    } catch {
      // Fallback to split if parsing fails.
    }
  }
  return trimmed
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const DEFAULT_PAGE_SIZE = 25;
const employmentStatusOptions = ["Active", "Inactive"] as const;
const departmentOptions = [
  "Administration",
  "Accounts Payable",
  "Accounts Receivable",
  "Actuarial",
  "Agronomy",
  "Asset Management",
  "Audit",
  "Aviation Operations",
  "Banking Operations",
  "Biotechnology",
  "Board of Directors",
  "Brand Management",
  "Business Intelligence",
  "Business Operations",
  "Business Strategy",
  "Call Centre",
  "Capital Projects",
  "Cash Management",
  "Chemical Processing",
  "Civil Engineering",
  "Client Relations",
  "Commercial",
  "Communications",
  "Community Relations",
  "Compliance",
  "Construction",
  "Corporate Affairs",
  "Corporate Finance",
  "Corporate Governance",
  "Credit Control",
  "Customer Experience",
  "Customer Service",
  "Cybersecurity",
  "Data Science",
  "Debt Collection",
  "Design",
  "Digital Marketing",
  "Distribution",
  "E-Commerce",
  "Economic Development",
  "Electrical Engineering",
  "Employee Relations",
  "Energy Operations",
  "Engineering",
  "Enterprise Risk",
  "Environmental Management",
  "Events Management",
  "Executive Management",
  "Facilities Management",
  "Finance",
  "Financial Planning",
  "Fleet Management",
  "Food Production",
  "Forestry",
  "Fraud Prevention",
  "Fund Management",
  "General Management",
  "Governance",
  "Health & Safety",
  "Healthcare Services",
  "Hospitality",
  "Human Capital",
  "Human Resources",
  "Industrial Relations",
  "Information Security",
  "Information Technology",
  "Infrastructure",
  "Innovation",
  "Insurance Operations",
  "Internal Audit",
  "Inventory Management",
  "Investment Management",
  "IT Support",
  "Legal",
  "Logistics",
  "Maintenance",
  "Management",
  "Manufacturing",
  "Marine Operations",
  "Marketing",
  "Mechanical Engineering",
  "Media Relations",
  "Mining Operations",
  "Network Operations",
  "Operations",
  "Payroll",
  "Pharmaceutical Services",
  "Policy & Regulatory Affairs",
  "Procurement",
  "Production",
  "Product Development",
  "Project Management",
  "Property Management",
  "Public Relations",
  "Quality Assurance",
  "Quality Control",
  "Quantity Surveying",
  "Real Estate",
  "Research & Development",
  "Retail Operations",
  "Risk Management",
  "Sales",
  "Security",
  "Social Development",
  "Software Development",
  "Supply Chain",
  "Technical Services",
  "Telecommunications",
  "Training & Development",
  "Transport",
  "Treasury",
  "Urban Planning",
  "Utilities",
  "Warehouse Management",
  "Water & Sanitation",
  "Wealth Management",
] as const;
const salaryTypeOptions = ["Hourly", "Daily", "Weekly", "Fortnightly", "Monthly"] as const;
const unionMemberOptions = ["Yes", "No"] as const;
const occupationalLevelOptions = [
  "Top Management",
  "Senior Management",
  "Professionally Qualified and Experienced Specialists and Mid-Management",
  "Skilled Technical and Academically Qualified Workers, Junior Management, Supervisors, Foremen and Superintendents",
  "Semi-Skilled and Discretionary Decision Making",
  "Unskilled and Defined Decision Making",
] as const;
const tradeUnionOptions = [
  "AMCU - Association of Mineworkers and Construction Union",
  "DENOSA - Democratic Nursing Organisation of South Africa",
  "FAWU - Food and Allied Workers Union",
  "GIWUSA - General Industries Workers Union of South Africa",
  "HOSPERSA - Health and Other Service Personnel Trade Union of South Africa",
  "IMATU - Independent Municipal and Allied Trade Union",
  "LEWUSA - Liberated Metalworkers Union of South Africa",
  "MISA - Motor Industry Staff Association",
  "NAPTOSA - National Professional Teachers' Organisation of South Africa",
  "NEHAWU - National Education Health and Allied Workers Union",
  "NUM - National Union of Mineworkers",
  "NUMSA - National Union of Metalworkers of South Africa",
  "NUPSAW - National Union of Public Service and Allied Workers",
  "PAWUSA - Paper, Printing, Wood and Allied Workers Union",
  "POPCRU - Police and Prisons Civil Rights Union",
  "PSA - Public Servants Association of South Africa",
  "SAEWA - South African Equity Workers Association",
  "SACCAWU - South African Commercial, Catering and Allied Workers Union",
  "SADTU - South African Democratic Teachers Union",
  "SAEPU - South African Emergency Personnel Union",
  "SAOU - Suid-Afrikaanse Onderwysersunie",
  "SAPU - South African Policing Union",
  "SASBO - South African Society of Bank Officials",
  "SATAWU - South African Transport and Allied Workers Union",
  "SAMWU - South African Municipal Workers Union",
  "Solidarity",
  "TAWUSA - Transport and Allied Workers Union of South Africa",
  "UASA - The Union",
] as const;
const terminationReasons = [
  "Dismissed",
  "Resigned",
  "Retrenched/Staff reduction",
  "Retired",
  "Contract expired",
  "Illness/Medically boarded",
  "Absconded",
] as const;
const licenceCategoryLabels: Record<LicenceCategory, string> = {
  driving: "Driving Licence(s)",
  firearmSecurity: "Firearm & Security",
  marineAviation: "Marine & Aviation",
};
const licenceTypesByCategory: Record<LicenceCategory, readonly string[]> = {
  driving: [
    "Motorcycle Licence (Code A1)",
    "Motorcycle Licence (Code A)",
    "Light Motor Vehicle Licence (Code B)",
    "Light Motor Vehicle with Trailer (Code EB)",
    "Medium Heavy Vehicle Licence (Code C1)",
    "Heavy Motor Vehicle Licence (Code C)",
    "Heavy Motor Vehicle with Trailer (Code EC1)",
    "Extra Heavy / Articulated Vehicle Licence (Code EC)",
    "Professional Driving Permit (PrDP)",
    "Forklift Operator Licence",
    "Learner's Licence",
  ],
  firearmSecurity: [
    "Firearm Licence (Section 13 - Self-Defence)",
    "Firearm Licence (Section 15 - Occasional Hunting / Sport Shooting)",
    "Firearm Licence (Section 16 - Dedicated Hunting / Sport Shooting)",
    "Competency Certificate (Firearms Control Act)",
    "Security Officer Registration (PSIRA)",
  ],
  marineAviation: [
    "Skipper's Licence",
    "Commercial Skipper Licence",
    "Pilot Licence",
    "Drone Pilot Licence",
  ],
};
const educationCategoryLabels: Record<EducationCategory, string> = {
  academic: "Academic Qualifications",
  trade: "Trade Qualifications",
  training: "Training Certificates",
};
const educationTypesByCategory: Record<EducationCategory, readonly string[]> = {
  academic: [
    "National Senior Certificate (Matric)",
    "Natioal Certificate",
    "Advanced Certificate",
    "Diploma",
    "Advanced Diploma",
    "Bachelor's Degree",
    "Honours Degree",
    "Postgraduate Diploma",
    "Master's Degree",
    "Doctorate",
  ],
  trade: [
    "Trade Certificate",
    "Trade Test Certificate",
    "Artisan Qualification",
    "Electrical Trade Certificate",
    "Plumbing Trade Certificate",
    "Welding Trade Certificate",
    "Boiler Making Trade Certificate",
    "Millwright Trade Certificate",
    "Mechanical Trade Certificate",
    "Civil Trade Certificate",
  ],
  training: [
    "First Aid Certificate",
    "Fire Fighting Training Certificate",
    "Health & Safety Representative Certificate",
    "SHEQ Training Certificate",
    "Working at Heights Training",
    "Incident Investigation Training",
    "Hazard Identification & Risk Assessment (HIRA) Training",
    "Construction Safety Training",
    "Forklift Training Certificate",
    "Reach Truck Training Certificate",
    "Crane Operator Training Certificate",
    "Mobile Equipment Training Certificate",
    "Dangerous Goods Handling Training",
  ],
};
const warningValidityMonths: Record<EmployeeWarning["warningType"], number> = {
  First: 6,
  Second: 6,
  Serious: 9,
  Final: 12,
};

const warningTypeLabels: Record<EmployeeWarning["warningType"], string> = {
  First: "First Written Warning",
  Second: "Second Written Warning",
  Serious: "Serious Written Warning",
  Final: "Final Written Warning",
};

const getStoragePathFromUrl = (url?: string) => {
  if (!url) return "";
  const marker = "/warnings/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  return url.slice(idx + marker.length);
};

const getContractStoragePathFromUrl = (url?: string) => {
  if (!url) return "";
  const marker = "/contracts/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  return url.slice(idx + marker.length);
};

const getIdDocumentStoragePathFromUrl = (url?: string) => {
  if (!url) return "";
  const marker = "/contracts/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  return url.slice(idx + marker.length);
};

const computeWarningExpiry = (warningType: EmployeeWarning["warningType"], issueDate: string) => {
  const months = warningValidityMonths[warningType] ?? 6;
  const base = new Date(issueDate);
  if (Number.isNaN(base.getTime())) {
    return "";
  }
  const expiry = new Date(base);
  expiry.setMonth(expiry.getMonth() + months);
  return expiry.toISOString().split("T")[0];
};

const computeProbationEndDate = (startDate?: string, probationPeriod?: string) => {
  if (!startDate || !probationPeriod) return "";
  const months = Number.parseInt(probationPeriod, 10);
  if (!Number.isFinite(months) || months <= 0) return "";
  const base = new Date(startDate);
  if (Number.isNaN(base.getTime())) return "";
  const end = new Date(base);
  end.setMonth(end.getMonth() + months);
  return end.toISOString().split("T")[0];
};

const documentOptions: DocumentOption[] = [
  {
    label: "Written Warning",
    description: "Generate a disciplinary warning with company and employee data.",
    path: "/documents/discipline/warnings",
    active: true,
  },
  {
    label: "Permanent Contract",
    description: "Generate a permanent employment contract.",
    path: "/documents/contracts/permanent",
    active: true,
  },
  {
    label: "Temporary Contract",
    description: "Generate a temporary employment contract.",
    path: "/documents/contracts/temporary",
    active: true,
  },
  {
    label: "Addendum",
    description: "Generate an addendum for an existing contract.",
    path: "/documents/contracts/addendum",
    active: true,
  },
];

const documentPathToKey: Record<string, DocumentKey> = {
  "/documents/discipline/warnings": "warnings",
  "/documents/contracts/permanent": "permanentContract",
  "/documents/contracts/temporary": "temporaryContract",
  "/documents/contracts/addendum": "addendum",
};

const Employees = () => {
 const { user, loading } = useAuth();
 const navigate = useNavigate();
 const { toast } = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState<"active" | "inactive">("active");
  const [contractFilter, setContractFilter] = useState<"all" | "permanent" | "temporary">("all");
  const [genderFilter, setGenderFilter] = useState<"all" | EmployeeProfileFormData["gender"]>("all");
  const [raceFilter, setRaceFilter] = useState<"all" | EmployeeProfileFormData["race"]>("all");
  const [nationalityFilter, setNationalityFilter] = useState<"all" | "RSA" | "Other">("all");
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isNewEmployeeMenuOpen, setIsNewEmployeeMenuOpen] = useState(false);
  const [isFiltersPanelOpen, setIsFiltersPanelOpen] = useState(false);
  const [expandedFilterSection, setExpandedFilterSection] = useState<
    "status" | "contract" | "gender" | "race" | "nationality" | null
  >(null);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
 const [isProfilePanelOpen, setIsProfilePanelOpen] = useState(false);
   const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
   const [isLoading, setIsLoading] = useState(false);
  const [isEmployeesLoading, setIsEmployeesLoading] = useState(false);
  const [isAllEmployeesLoading, setIsAllEmployeesLoading] = useState(false);
   const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState<EmployeeTab>("personal");
  const [activeEditSection, setActiveEditSection] = useState<ProfileSectionKey | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [addForm, setAddForm] = useState<AddEmployeeFormState>(createBlankAddForm());
  const [addFormStep, setAddFormStep] = useState<1 | 2 | 3>(1);
  const [rehireEmployeeId, setRehireEmployeeId] = useState<string | null>(null);
  const [isAddFormSubmitRequested, setIsAddFormSubmitRequested] = useState(false);
  const [profileForm, setProfileForm] = useState<EmployeeProfileFormData>(createProfileFormFromEmployee());
  const [isWarningDialogOpen, setIsWarningDialogOpen] = useState(false);
  const [warningForm, setWarningForm] = useState<WarningFormState>({
    misconductTypes: [],
    warningType: "First",
    issueDate: dateToday(),
    fileName: "",
  });
  const [warningFilter, setWarningFilter] = useState<"valid" | "expired">("valid");
  const [warningFile, setWarningFile] = useState<File | null>(null);
  const [warningsByEmployee, setWarningsByEmployee] = useState<Record<string, EmployeeWarning[]>>({});
  const [editingWarning, setEditingWarning] = useState<EmployeeWarning | null>(null);
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);
  const [contractForm, setContractForm] = useState<ContractFormState>({
    contractType: "",
    fileName: "",
  });
  const [contractStatusFilter, setContractStatusFilter] = useState<"active" | "inactive">("active");
  const [licencesViewFilter, setLicencesViewFilter] = useState<LicencesViewFilter>("driving");
  const [educationViewFilter, setEducationViewFilter] = useState<EducationViewFilter>("academic");
  const [isLicencesTabMenuOpen, setIsLicencesTabMenuOpen] = useState(false);
  const [isEducationTabMenuOpen, setIsEducationTabMenuOpen] = useState(false);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [contractsByEmployee, setContractsByEmployee] = useState<Record<string, EmployeeContract[]>>({});
  const [activeContractsByEmployee, setActiveContractsByEmployee] = useState<Record<string, boolean>>({});
  const [idDocumentByEmployee, setIdDocumentByEmployee] = useState<Record<string, EmployeeIdDocument | null>>({});
  const [pendingIdDocumentFile, setPendingIdDocumentFile] = useState<File | null>(null);
  const [pendingIdDocumentName, setPendingIdDocumentName] = useState("");
  const [isIdDocumentMarkedForRemoval, setIsIdDocumentMarkedForRemoval] = useState(false);
  const [isIdDocumentUploading, setIsIdDocumentUploading] = useState(false);
  const [terminationDocumentByEmployee, setTerminationDocumentByEmployee] = useState<Record<string, EmployeeTerminationDocument | null>>({});
  const [pendingTerminationDocumentFile, setPendingTerminationDocumentFile] = useState<File | null>(null);
  const [pendingTerminationDocumentName, setPendingTerminationDocumentName] = useState("");
  const [isTerminationDocumentUploading, setIsTerminationDocumentUploading] = useState(false);
  const [pendingEmploymentContractFile, setPendingEmploymentContractFile] = useState<File | null>(null);
  const [pendingEmploymentContractName, setPendingEmploymentContractName] = useState("");
  const [isEmploymentContractMarkedForRemoval, setIsEmploymentContractMarkedForRemoval] = useState(false);
  const [isEmploymentContractUploading, setIsEmploymentContractUploading] = useState(false);
  const [licencesByEmployee, setLicencesByEmployee] = useState<Record<string, EmployeeLicence[]>>({});
  const [licenceTypeSelection, setLicenceTypeSelection] = useState<Record<LicenceCategory, string>>({
    driving: "",
    firearmSecurity: "",
    marineAviation: "",
  });
  const [educationsByEmployee, setEducationsByEmployee] = useState<Record<string, EmployeeEducation[]>>({});
  const [educationTypeSelection, setEducationTypeSelection] = useState<Record<EducationCategory, string>>({
    academic: "",
    trade: "",
    training: "",
  });
  const [misconductSearch, setMisconductSearch] = useState("");
  const [conductOffences, setConductOffences] = useState<ConductOffence[]>([]);
  const [hasLoadedAllEmployees, setHasLoadedAllEmployees] = useState(false);
  const [hasLoadedConductOffences, setHasLoadedConductOffences] = useState(false);
  const [employmentStatus, setEmploymentStatus] = useState<(typeof employmentStatusOptions)[number] | "">("");
  const [employeeStatus, setEmployeeStatus] = useState<(typeof employmentStatusOptions)[number] | "">("");
  const [probationPeriod, setProbationPeriod] = useState("");
  const [department, setDepartment] = useState<(typeof departmentOptions)[number] | "">("");
  const [branch, setBranch] = useState("");
  const [companyBranchesEnabled, setCompanyBranchesEnabled] = useState(false);
  const [companyBranches, setCompanyBranches] = useState<string[]>([]);
  const [reportingTo, setReportingTo] = useState("");
  const [occupationalLevel, setOccupationalLevel] = useState<(typeof occupationalLevelOptions)[number] | "">("");
  const [salaryType, setSalaryType] = useState<(typeof salaryTypeOptions)[number] | "">("");
  const [basicSalary, setBasicSalary] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [workCellNumber, setWorkCellNumber] = useState("");
  const [unionMember, setUnionMember] = useState<(typeof unionMemberOptions)[number] | "">("");
  const [tradeUnion, setTradeUnion] = useState("");
  const [tradeUnionOpen, setTradeUnionOpen] = useState(false);
  const [tradeUnionQuery, setTradeUnionQuery] = useState("");
  const tradeUnionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [isMisconductMenuOpen, setIsMisconductMenuOpen] = useState(false);
  const [nationalityOpen, setNationalityOpen] = useState(false);
  const [nationalityQuery, setNationalityQuery] = useState("");
  const [genderOpen, setGenderOpen] = useState(false);
  const [raceOpen, setRaceOpen] = useState(false);
  const [citizenshipOpen, setCitizenshipOpen] = useState(false);
  const [contractTypeOpen, setContractTypeOpen] = useState(false);
  const [contractTypeQuery, setContractTypeQuery] = useState("");
  const [departmentOpen, setDepartmentOpen] = useState(false);
  const [departmentQuery, setDepartmentQuery] = useState("");
  const [reportingToOpen, setReportingToOpen] = useState(false);
  const [reportingToQuery, setReportingToQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documentDialogEmployee, setDocumentDialogEmployee] = useState<Employee | null>(null);
  const firstActiveDocPath = documentOptions.find((doc) => doc.active)?.path ?? "";
  const [selectedDocumentPath, setSelectedDocumentPath] = useState<string>(firstActiveDocPath);
  const newEmployeeMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const tableCardRef = useRef<HTMLDivElement | null>(null);
  const [tableOffsetTop, setTableOffsetTop] = useState(0);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [deleteUndo, setDeleteUndo] = useState<DeleteUndoState | null>(null);
  const [deleteUndoCountdown, setDeleteUndoCountdown] = useState(0);
  const deleteUndoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteUndoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [warningDeleteUndo, setWarningDeleteUndo] = useState<WarningDeleteUndoState | null>(null);
  const [warningDeleteCountdown, setWarningDeleteCountdown] = useState(0);
  const warningDeleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningDeleteIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startDateInputRef = useRef<HTMLInputElement | null>(null);
  const endDateInputRef = useRef<HTMLInputElement | null>(null);
  const dateOfBirthInputRef = useRef<HTMLInputElement | null>(null);
  const idPassportFileInputRef = useRef<HTMLInputElement | null>(null);
  const employmentContractFileInputRef = useRef<HTMLInputElement | null>(null);
  const terminationDocumentFileInputRef = useRef<HTMLInputElement | null>(null);
  const licenceFileInputRefs = useRef<Record<LicenceCategory, HTMLInputElement | null>>({
    driving: null,
    firearmSecurity: null,
    marineAviation: null,
  });
  const educationFileInputRefs = useRef<Record<EducationCategory, HTMLInputElement | null>>({
    academic: null,
    trade: null,
    training: null,
  });
  const sectionRefs = useRef<Record<ProfileSectionKey, HTMLDivElement | null>>({
    identity: null,
    equity: null,
    contact: null,
    statutory: null,
    employmentStatus: null,
    employmentOrg: null,
    employmentRemuneration: null,
    employmentWorkContact: null,
    employmentUnion: null,
    homeAddress: null,
    postalAddress: null,
  });
  const addFormIdDigits = addForm.idNumber.replace(/\D/g, "");
  const isAddFormIdTypeSelected = addForm.idType === "id" || addForm.idType === "passport";
  const isAddFormIdNumberComplete =
    addForm.idType === "passport"
      ? addForm.idNumber.trim().length > 0
      : addForm.idType === "id"
        ? addFormIdDigits.length === 13
        : false;
  const isAddFormStepOneComplete =
    addForm.employeeName.trim().length > 0 &&
    addForm.employeeSurname.trim().length > 0 &&
    isAddFormIdTypeSelected &&
    isAddFormIdNumberComplete;
  const isAddFormStepTwoComplete =
    addForm.jobTitle.trim().length > 0 &&
    addForm.contractType.trim().length > 0 &&
    addForm.startDate.trim().length > 0 &&
    (addForm.contractType !== "Temporary" || addForm.endDate.trim().length > 0);
  const isAddFormStepThreeComplete =
    addForm.physicalAddressLine1.trim().length > 0 &&
    addForm.city.trim().length > 0 &&
    addForm.province.trim().length > 0 &&
    addForm.areaCode.trim().length > 0;
  const fieldWrapperClass = "space-y-1";
  const fieldLabelClass = "text-[10px] font-semibold text-slate-500 block";
  const baseFieldInputClass =
    "h-8 rounded border border-slate-200 bg-white !text-[11px] md:!text-[11px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] placeholder:!text-slate-400 hover:border-blue-400 !focus-visible:border-[1px] !focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:bg-white disabled:text-slate-900 disabled:border-slate-200 disabled:opacity-100 disabled:cursor-default";
  const fieldInputClass = baseFieldInputClass;
  const fieldSelectTriggerClass = `${fieldInputClass} justify-between data-[placeholder]:text-slate-400 data-[placeholder]:text-xs`;
  // UI contract: all dropdown triggers/items on Employees page must use these shared classes.
  const employeeDropdownTriggerClass = `${fieldSelectTriggerClass} w-full max-w-[320px] ml-auto bg-white border-slate-200 hover:border-blue-400 hover:bg-white hover:text-slate-700 data-[state=open]:border-slate-300 data-[state=open]:bg-white !ring-0 !ring-offset-0 !outline-none focus:!ring-0 focus:!ring-offset-0 focus:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 focus-visible:!outline-none data-[state=open]:!ring-0 data-[state=open]:!ring-offset-0 data-[state=open]:!outline-none`;
  const employeeDropdownCommandItemClass =
    "text-[11px] text-slate-700 data-[selected=true]:bg-blue-50/70 data-[selected=true]:text-blue-600 data-[highlighted]:bg-blue-50/70 data-[highlighted]:text-blue-600";
  const employeeDropdownSelectItemClass =
    "text-[11px] text-slate-700 focus:bg-blue-50/70 focus:text-blue-600 data-[highlighted]:bg-blue-50/70 data-[highlighted]:text-blue-600 data-[state=checked]:text-slate-700 data-[state=checked]:data-[highlighted]:text-slate-700";
  const employeeDropdownMenuItemClass =
    "cursor-pointer text-[11px] text-slate-700 focus:bg-blue-50/70 focus:text-blue-600 data-[highlighted]:bg-blue-50/70 data-[highlighted]:text-blue-600";
  const employeeDropdownMenuItemWithGapClass = `gap-2 ${employeeDropdownMenuItemClass}`;
  const addModalDropdownToneClass =
    "bg-white border-slate-300 hover:border-blue-400 data-[state=open]:border-slate-300 data-[state=open]:bg-white";
  const addModalFieldInputClass = `${fieldInputClass} !h-[34px] !border-[0.5px] !border-slate-400 !focus-visible:border-slate-300`;
  const addModalFieldSelectTriggerClass =
    `${fieldSelectTriggerClass} !h-[34px] !border-[0.5px] !border-slate-400 !focus:border-blue-600 !focus-visible:border-blue-600 data-[state=open]:!border-blue-600 !ring-0 !ring-offset-0 !outline-none !shadow-none !focus:ring-0 !focus:ring-offset-0 !focus:shadow-none !focus:outline-none !focus-visible:ring-0 !focus-visible:ring-offset-0 !focus-visible:shadow-none !focus-visible:outline-none data-[state=open]:!ring-0 data-[state=open]:!ring-offset-0 data-[state=open]:!shadow-none data-[state=open]:!outline-none`;
  const getAddModalInputClass = (isComplete: boolean) =>
    `${addModalFieldInputClass} ${isComplete ? "!border-emerald-500" : ""}`;
  const getAddModalSelectTriggerClass = (isComplete: boolean) =>
    `${addModalFieldSelectTriggerClass} ${isComplete ? "!border-emerald-500" : ""}`;
  const isReadOnlyTab =
    activeTab === "discipline" || activeTab === "contracts" || activeTab === "licences" || activeTab === "education";
  const isSouthAfricanNationality = (profileForm.nationality || "").trim().toLowerCase() === "south african";

  const originalProfile = useMemo(
    () => (selectedEmployee ? createProfileFormFromEmployee(selectedEmployee) : null),
    [selectedEmployee],
  );
  const originalProbationPeriod = useMemo(
    () => (selectedEmployee?.probation_period ?? ""),
    [selectedEmployee],
  );
  const originalUnionMember = useMemo(
    () => ((selectedEmployee?.union_member ?? "") as (typeof unionMemberOptions)[number] | ""),
    [selectedEmployee],
  );
  const originalTradeUnion = useMemo(
    () => (selectedEmployee?.trade_union ?? ""),
    [selectedEmployee],
  );
  const reportingToOptions = useMemo(() => {
    const source = allEmployees.length > 0 ? allEmployees : employees;
    return source
      .map((emp) => `${(emp.employee_name ?? "").trim()} ${(emp.employee_surname ?? "").trim()}`.trim())
      .filter(Boolean);
  }, [allEmployees, employees]);
  const [originalDepartment, setOriginalDepartment] = useState("");
  const [originalBranch, setOriginalBranch] = useState("");
  const [originalReportingTo, setOriginalReportingTo] = useState("");
  const [originalOccupationalLevel, setOriginalOccupationalLevel] = useState("");
  const [originalSalaryType, setOriginalSalaryType] = useState<(typeof salaryTypeOptions)[number] | "">("");
  const [originalBasicSalary, setOriginalBasicSalary] = useState("");
  const [originalWorkEmail, setOriginalWorkEmail] = useState("");
  const [originalWorkCellNumber, setOriginalWorkCellNumber] = useState("");
  const branchOptions = useMemo(() => {
    const normalized = companyBranches
      .map((value) => value.trim())
      .filter(Boolean);
    const unique = Array.from(new Set(normalized));
    const currentBranch = branch.trim();
    if (currentBranch && !unique.some((value) => value.toLowerCase() === currentBranch.toLowerCase())) {
      unique.unshift(currentBranch);
    }
    return unique;
  }, [branch, companyBranches]);

  const fetchCompanyBranches = useCallback(async () => {
    if (!user) return;
    const { data, error } = await (supabase as any)
      .from("profiles")
      .select("branches_enabled, branches")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      const message = (error as { message?: string } | null)?.message ?? "";
      const isBranchColumnMissing = message.includes("branches_enabled") || message.includes("branches");
      if (!isBranchColumnMissing) {
        toast({
          title: "Error",
          description: "Could not load branch settings.",
          variant: "destructive",
        });
      }
      setCompanyBranchesEnabled(false);
      setCompanyBranches([]);
      return;
    }

    const loadedBranches = Array.isArray(data?.branches)
      ? data.branches
          .map((value: unknown) => String(value ?? "").trim())
          .filter(Boolean)
      : [];
    setCompanyBranchesEnabled(Boolean(data?.branches_enabled));
    setCompanyBranches(Array.from(new Set(loadedBranches)));
  }, [toast, user]);

  useEffect(() => {
    if (!selectedEmployee) return;
    setOriginalDepartment((selectedEmployee.department as (typeof departmentOptions)[number]) ?? "");
    setOriginalBranch(selectedEmployee.branch ?? "");
    setOriginalReportingTo(selectedEmployee.reporting_to ?? "");
    setOriginalOccupationalLevel(
      (selectedEmployee.occupational_level as (typeof occupationalLevelOptions)[number]) ?? "",
    );
    setOriginalSalaryType((selectedEmployee.salary_type as (typeof salaryTypeOptions)[number]) ?? "");
    setOriginalBasicSalary(selectedEmployee.basic_salary ?? "");
    setOriginalWorkEmail(selectedEmployee.work_email ?? "");
    setOriginalWorkCellNumber(selectedEmployee.work_cell_number ?? "");
  }, [selectedEmployee]);

  useEffect(() => {
    if (!isSouthAfricanNationality) return;
    const nextDob = formatInputDate(extractDobFromId(profileForm.idNumber || ""));
    if ((profileForm.dateOfBirth || "") !== nextDob) {
      setProfileForm((prev) => ({
        ...prev,
        dateOfBirth: nextDob,
      }));
    }
  }, [isSouthAfricanNationality, profileForm.dateOfBirth, profileForm.idNumber]);

  useEffect(() => {
    if (!user) return;
    void fetchCompanyBranches();
  }, [user, fetchCompanyBranches]);

  useEffect(() => {
    const nextStatus = ((selectedEmployee as any)?.status ?? "").toString().toLowerCase();
    if (nextStatus === "inactive") {
      setEmployeeStatus("Inactive");
      return;
    }
    if (nextStatus === "active") {
      setEmployeeStatus("Active");
      return;
    }
    setEmployeeStatus("");
  }, [selectedEmployee]);

  const updateEmployeeStatus = useCallback(
    async (nextStatus: "active" | "inactive") => {
      if (!selectedEmployee || !user) return;
      const statusPatch: EmployeeUpdate =
        nextStatus === "active"
          ? {
              status: nextStatus,
              termination_reason: null,
              previous_job_title: null,
              terminated_at: null,
            }
          : { status: nextStatus };

      const { error } = await supabase
        .from("employees")
        .update(statusPatch as unknown as TablesInsert<"employees">)
        .eq("id", selectedEmployee.id);
      if (error) {
        toast({
          title: "Unable to update status",
          description: getSafeErrorMessage(error),
          variant: "destructive",
        });
        return;
      }

      const displayStatus = nextStatus === "inactive" ? "Inactive" : "Active";
      setEmployeeStatus(displayStatus);
      setSelectedEmployee((prev) => (prev ? { ...prev, ...statusPatch } : prev));
      setEmployees((prev) =>
        prev.map((emp) => (emp.id === selectedEmployee.id ? { ...emp, ...statusPatch } : emp)),
      );
      setFilteredEmployees((prev) =>
        prev.map((emp) => (emp.id === selectedEmployee.id ? { ...emp, ...statusPatch } : emp)),
      );
      setAllEmployees((prev) =>
        prev.map((emp) => (emp.id === selectedEmployee.id ? { ...emp, ...statusPatch } : emp)),
      );

      toast({
        title: "Employee status updated",
        description: `Status set to ${displayStatus}.`,
      });
    },
    [selectedEmployee, user, toast],
  );

  const handleTerminateWithReason = useCallback(
    async (reason: string) => {
      if (!selectedEmployee || !user) return;
      const previousJobTitle = (profileForm.jobTitle || selectedEmployee.job_title || "").trim() || null;

      const employmentClearPatch: EmployeeUpdate = {
        status: "inactive",
        termination_reason: reason,
        previous_job_title: previousJobTitle,
        terminated_at: null,
        employee_number: null,
        start_date: null,
        end_date: null,
        contract_type: null,
        probation_period: null,
        department: null,
        branch: null,
        reporting_to: null,
        occupational_level: null,
        salary_type: null,
        basic_salary: null,
        work_email: null,
        work_cell_number: null,
        union_member: null,
        trade_union: null,
        job_title: null,
      };

      try {
        const { data: contractRows, error: contractsLoadError } = await contractTable()
          .select("id, file_url")
          .eq("company_id", user.id)
          .eq("employee_id", selectedEmployee.id);

        if (contractsLoadError) throw contractsLoadError;

        const { error: employeeUpdateError } = await supabase
          .from("employees")
          .update(employmentClearPatch as unknown as TablesInsert<"employees">)
          .eq("id", selectedEmployee.id);

        if (employeeUpdateError) throw employeeUpdateError;

        if ((contractRows ?? []).length > 0) {
          const { error: deleteContractsError } = await contractTable()
            .delete()
            .eq("company_id", user.id)
            .eq("employee_id", selectedEmployee.id);

          if (deleteContractsError) throw deleteContractsError;

          const storagePaths = ((contractRows ?? []) as Array<{ file_url?: string | null }>)
            .map((row) => getContractStoragePathFromUrl(row.file_url))
            .filter((path): path is string => !!path);

          if (storagePaths.length > 0) {
            await supabase.storage.from("contracts").remove(storagePaths);
          }
        }

        const nextSelected = { ...selectedEmployee, ...employmentClearPatch } as Employee;
        setEmployeeStatus("Inactive");
        setSelectedEmployee(nextSelected);
        setProfileForm(createProfileFormFromEmployee(nextSelected));
        setProbationPeriod("");
        setUnionMember("");
        setTradeUnion("");
        setPendingEmploymentContractFile(null);
        setPendingEmploymentContractName("");
        setIsEmploymentContractMarkedForRemoval(false);
        setContractsByEmployee((prev) => ({ ...prev, [selectedEmployee.id]: [] }));
        setActiveContractsByEmployee((prev) => ({ ...prev, [selectedEmployee.id]: false }));
        setEmployees((prev) =>
          prev.map((emp) => (emp.id === selectedEmployee.id ? { ...emp, ...employmentClearPatch } : emp)),
        );
        setFilteredEmployees((prev) =>
          prev.map((emp) => (emp.id === selectedEmployee.id ? { ...emp, ...employmentClearPatch } : emp)),
        );
        setAllEmployees((prev) =>
          prev.map((emp) => (emp.id === selectedEmployee.id ? { ...emp, ...employmentClearPatch } : emp)),
        );

        toast({
          title: "Employee terminated",
          description: "Status set to Inactive and employment details were archived.",
        });
        toast({
          title: "Next step",
          description: "Open Employment tab to set Termination Date and upload the Termination Letter.",
          className: "border-blue-500",
        });
      } catch (error: unknown) {
        toast({
          title: "Unable to terminate employee",
          description: getSafeErrorMessage(error),
          variant: "destructive",
        });
      }
    },
    [profileForm.jobTitle, selectedEmployee, toast, user],
  );

  const isProfileDirty = useMemo(() => {
    if (!originalProfile) return false;
    return (Object.keys(originalProfile) as Array<keyof EmployeeProfileFormData>).some(
      (key) => profileForm[key] !== originalProfile[key],
    );
  }, [profileForm, originalProfile]);

  const sectionDirty = useMemo(() => {
    if (!originalProfile) {
      return {
        identity: false,
        equity: false,
        contact: false,
        statutory: false,
        employmentStatus: false,
        employmentOrg: false,
        employmentRemuneration: false,
        employmentWorkContact: false,
        employmentUnion: false,
        homeAddress: false,
        postalAddress: false,
      };
    }
    const compare = (keys: Array<keyof EmployeeProfileFormData>) =>
      keys.some((key) => profileForm[key] !== originalProfile[key]);
    return {
      identity: compare([
        "employeeName",
        "employeeSurname",
        "idNumber",
        "nationality",
        "dateOfBirth",
      ]) || !!pendingIdDocumentFile || isIdDocumentMarkedForRemoval,
      equity: compare(["race", "gender", "disabilityStatus", "citizenshipStatus"]),
      contact: compare(["cellNumber", "email", "emergencyContactName", "emergencyContactNumber"]),
      statutory: compare(["incomeTaxNumber"]),
      employmentStatus:
        compare(["startDate", "contractType", "endDate", "employeeNumber"]) ||
        probationPeriod !== originalProbationPeriod ||
        !!pendingEmploymentContractFile ||
        isEmploymentContractMarkedForRemoval,
      employmentOrg:
        compare(["jobTitle"]) ||
        department !== originalDepartment ||
        branch !== originalBranch ||
        reportingTo !== originalReportingTo ||
        occupationalLevel !== originalOccupationalLevel,
      employmentRemuneration:
        salaryType !== originalSalaryType || basicSalary !== originalBasicSalary,
      employmentWorkContact:
        workEmail !== originalWorkEmail || workCellNumber !== originalWorkCellNumber,
      employmentUnion:
        unionMember !== originalUnionMember || tradeUnion !== originalTradeUnion,
      homeAddress: compare([
        "physicalAddressLine1",
        "physicalAddressLine2",
        "city",
        "province",
        "areaCode",
      ]),
      postalAddress: compare([
        "postalAddressLine1",
        "postalAddressLine2",
        "postalCity",
        "postalProvince",
        "postalAreaCode",
      ]),
    };
  }, [
    profileForm,
    originalProfile,
    probationPeriod,
    originalProbationPeriod,
    department,
    originalDepartment,
    branch,
    originalBranch,
    reportingTo,
    originalReportingTo,
    occupationalLevel,
    originalOccupationalLevel,
    salaryType,
    originalSalaryType,
    basicSalary,
    originalBasicSalary,
    workEmail,
    originalWorkEmail,
    workCellNumber,
    originalWorkCellNumber,
    unionMember,
    originalUnionMember,
    tradeUnion,
    originalTradeUnion,
    pendingIdDocumentFile,
    isIdDocumentMarkedForRemoval,
    pendingEmploymentContractFile,
    isEmploymentContractMarkedForRemoval,
  ]);

  const profileSchemaBase = useMemo(() => {
    const schema = employeeProfileSchema as unknown as { _def?: { schema?: any } };
    return schema?._def?.schema ?? employeeProfileSchema;
  }, []);

  const identitySectionSchema = useMemo(
    () =>
      profileSchemaBase.pick({
        employeeName: true,
        employeeSurname: true,
        idNumber: true,
        nationality: true,
        dateOfBirth: true,
      }),
    [profileSchemaBase],
  );

  const equitySectionSchema = useMemo(
    () =>
      profileSchemaBase.pick({
        race: true,
        gender: true,
        disabilityStatus: true,
        citizenshipStatus: true,
      }),
    [profileSchemaBase],
  );

  const contactSectionSchema = useMemo(
    () =>
      profileSchemaBase.pick({
        cellNumber: true,
        email: true,
        emergencyContactName: true,
        emergencyContactNumber: true,
      }),
    [profileSchemaBase],
  );

  const statutorySectionSchema = useMemo(
    () =>
      profileSchemaBase.pick({
        incomeTaxNumber: true,
      }),
    [profileSchemaBase],
  );

  const employmentSectionSchema = useMemo(
    () =>
      profileSchemaBase.pick({
        startDate: true,
        contractType: true,
        endDate: true,
        jobTitle: true,
        employeeNumber: true,
      }),
    [profileSchemaBase],
  );

  const homeAddressSectionSchema = useMemo(
    () =>
      profileSchemaBase.pick({
        physicalAddressLine1: true,
        physicalAddressLine2: true,
        city: true,
        province: true,
        areaCode: true,
      }),
    [profileSchemaBase],
  );

  const postalAddressSectionSchema = useMemo(
    () =>
      profileSchemaBase.pick({
        postalAddressLine1: true,
        postalAddressLine2: true,
        postalCity: true,
        postalProvince: true,
        postalAreaCode: true,
      }),
    [profileSchemaBase],
  );

  useLayoutEffect(() => {
    const updateOffset = () => {
      if (!tableCardRef.current) return;
      const rect = tableCardRef.current.getBoundingClientRect();
      setTableOffsetTop(rect.top);
    };

    updateOffset();
    const onResize = () => requestAnimationFrame(updateOffset);
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, [isProfilePanelOpen, employees.length, filteredEmployees.length]);

  const tableBottomGap = 32;
  const tableFooterHeight = 32;
  const tableMaxHeight =
    tableOffsetTop > 0
      ? `calc(100vh - ${tableOffsetTop}px - ${tableBottomGap + tableFooterHeight}px)`
      : `calc(100vh - ${380 + tableBottomGap + tableFooterHeight}px)`;
  const tableBodyMaxHeight =
    tableOffsetTop > 0
      ? `calc(100vh - ${tableOffsetTop}px - ${tableBottomGap + tableFooterHeight + 56}px)`
      : `calc(100vh - ${380 + tableBottomGap + tableFooterHeight + 56}px)`;
  const isFirstPage = currentPage === 1;
  const isLastPage = !hasNextPage;
  const activeEmployeeFilterCount =
    Number(employeeStatusFilter !== "active") +
    Number(contractFilter !== "all") +
    Number(genderFilter !== "all") +
    Number(raceFilter !== "all") +
    Number(nationalityFilter !== "all");
  const closeEmployeeFiltersPanel = () => {
    setIsFiltersPanelOpen(false);
    setExpandedFilterSection(null);
  };
  const hasEmployeeTableFiltersApplied =
    searchQuery.trim().length > 0 ||
    employeeStatusFilter !== "active" ||
    contractFilter !== "all" ||
    genderFilter !== "all" ||
    raceFilter !== "all" ||
    nationalityFilter !== "all";

  const handleDocumentCategorySelect = (path: string) => {
    const targetEmployee = documentDialogEmployee || selectedEmployee;
    const selectedDocument = documentPathToKey[path];
    const state = {
      ...(targetEmployee
        ? {
            employeeName: (targetEmployee.employee_name ?? "").trim(),
            employeeSurname: (targetEmployee.employee_surname ?? "").trim(),
            employeeIdNumber: targetEmployee.id_number ?? "",
          }
        : {}),
      ...(selectedDocument ? { selectedDocument } : {}),
    };
    setDocumentDialogEmployee(null);
    if (selectedDocument) {
      navigate("/documents", { state });
      return;
    }
    navigate(path, { state: Object.keys(state).length > 0 ? state : undefined });
  };

  useEffect(() => {
    if (documentDialogEmployee) {
      setSelectedDocumentPath(firstActiveDocPath);
    }
  }, [documentDialogEmployee, firstActiveDocPath]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (isReadOnlyTab && isEditMode) {
      setIsEditMode(false);
    }
  }, [isReadOnlyTab, isEditMode]);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) {
      setShowScrollHint(false);
      return;
    }

    const updateHint = () => {
      const canScroll = el.scrollHeight > el.clientHeight + 1;
      const atBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight - 1;
      setShowScrollHint(canScroll && !atBottom);
    };

    updateHint();
    el.addEventListener("scroll", updateHint);
    window.addEventListener("resize", updateHint);

    return () => {
      el.removeEventListener("scroll", updateHint);
      window.removeEventListener("resize", updateHint);
    };
  }, [filteredEmployees]);

  const clearDeleteUndoTimers = useCallback(() => {
    if (deleteUndoTimeoutRef.current) {
      clearTimeout(deleteUndoTimeoutRef.current);
      deleteUndoTimeoutRef.current = null;
    }
    if (deleteUndoIntervalRef.current) {
      clearInterval(deleteUndoIntervalRef.current);
      deleteUndoIntervalRef.current = null;
    }
  }, []);

  const clearDeleteUndoState = useCallback(() => {
    clearDeleteUndoTimers();
    setDeleteUndo(null);
    setDeleteUndoCountdown(0);
  }, [clearDeleteUndoTimers]);

  const startDeleteUndoTimers = useCallback(
    (expiresAt: number) => {
      clearDeleteUndoTimers();
      const updateCountdown = () => {
        const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
        setDeleteUndoCountdown(remaining);
      };
      updateCountdown();
      deleteUndoIntervalRef.current = setInterval(updateCountdown, 1000);
      deleteUndoTimeoutRef.current = setTimeout(() => {
        clearDeleteUndoState();
      }, Math.max(0, expiresAt - Date.now()));
    },
    [clearDeleteUndoTimers, clearDeleteUndoState],
  );

  useEffect(() => {
    if (deleteUndo) {
      startDeleteUndoTimers(deleteUndo.expiresAt);
    } else {
      clearDeleteUndoTimers();
      setDeleteUndoCountdown(0);
    }
    return () => {
      clearDeleteUndoTimers();
    };
  }, [deleteUndo, startDeleteUndoTimers, clearDeleteUndoTimers]);

  const clearWarningDeleteTimers = useCallback(() => {
    if (warningDeleteTimeoutRef.current) {
      clearTimeout(warningDeleteTimeoutRef.current);
      warningDeleteTimeoutRef.current = null;
    }
    if (warningDeleteIntervalRef.current) {
      clearInterval(warningDeleteIntervalRef.current);
      warningDeleteIntervalRef.current = null;
    }
  }, []);

  const clearWarningDeleteState = useCallback(() => {
    clearWarningDeleteTimers();
    setWarningDeleteUndo(null);
    setWarningDeleteCountdown(0);
  }, [clearWarningDeleteTimers]);

  const startWarningDeleteTimers = useCallback(
    (pending: WarningDeleteUndoState) => {
      clearWarningDeleteTimers();
      setWarningDeleteUndo(pending);
      const updateCountdown = () => {
        const remaining = Math.max(0, Math.ceil((pending.expiresAt - Date.now()) / 1000));
        setWarningDeleteCountdown(remaining);
      };
      updateCountdown();
      warningDeleteIntervalRef.current = setInterval(updateCountdown, 1000);
      warningDeleteTimeoutRef.current = setTimeout(async () => {
        if (pending.storagePath) {
          await supabase.storage.from("warnings").remove([pending.storagePath]);
        }
        clearWarningDeleteState();
      }, Math.max(0, pending.expiresAt - Date.now()));
    },
    [clearWarningDeleteState, clearWarningDeleteTimers],
  );

  const handleUndoWarningDelete = async () => {
    if (!warningDeleteUndo || !selectedEmployee || !user) return;
    const { warning, employeeId } = warningDeleteUndo;
    const { error } = await warningTable().insert({
      id: warning.id,
      company_id: user.id,
      employee_id: employeeId,
      misconduct_type: warning.misconductType,
      warning_type: warning.warningType,
      issue_date: warning.issueDate,
      expiry_date: warning.expiryDate,
      file_url: warning.fileUrl,
    });
    if (error) {
      toast({
        title: "Unable to restore warning",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
      return;
    }
    setWarningsByEmployee((prev) => {
      const existing = prev[employeeId] ?? [];
      return {
        ...prev,
        [employeeId]: [warning, ...existing],
      };
    });
    clearWarningDeleteState();
    toast({
      title: "Warning restored",
      description: "The warning has been restored.",
    });
  };

  const isPdfFile = (fileName?: string) => fileName?.toLowerCase().endsWith(".pdf") ?? false;

  const canSaveWarning =
    !!selectedEmployee &&
    warningForm.misconductTypes.length > 0 &&
    warningForm.issueDate.trim().length > 0 &&
    (editingWarning ? !!editingWarning.fileUrl : isPdfFile(warningForm.fileName) && !!warningFile);
  const fetchWarnings = useCallback(
    async (employeeId: string) => {
      if (!user) return;
      const { data, error } = await warningTable()
        .select("id, misconduct_type, warning_type, issue_date, expiry_date, file_url")
        .eq("company_id", user.id)
        .eq("employee_id", employeeId)
        .order("issue_date", { ascending: false });

      if (error) {
        toast({
          title: "Unable to load warnings",
          description: getSafeErrorMessage(error),
          variant: "destructive",
        });
        return;
      }

      const mapped: EmployeeWarning[] =
        (data ?? []).map((row: any) => ({
          id: row.id,
          misconductType: row.misconduct_type,
          warningType: row.warning_type,
          issueDate: row.issue_date,
          expiryDate: row.expiry_date,
          fileName: row.file_url ? row.file_url.split("/").pop() || "warning.pdf" : "",
          fileUrl: row.file_url,
        })) ?? [];

      setWarningsByEmployee((prev) => ({
        ...prev,
        [employeeId]: mapped,
      }));
    },
    [toast, user],
  );

  useEffect(() => {
    if (selectedEmployee) {
      fetchWarnings(selectedEmployee.id);
    }
  }, [selectedEmployee, fetchWarnings]);

  const resetWarningForm = () => {
    setWarningForm({
      misconductTypes: [],
      warningType: "First",
      issueDate: dateToday(),
      fileName: "",
    });
    setWarningFile(null);
    setEditingWarning(null);
  };

  const handleSaveWarning = async () => {
    const isEditing = !!editingWarning;
    if (!selectedEmployee || !user) {
      toast({
        title: "No employee selected",
        description: "Select an employee before adding a warning.",
        variant: "destructive",
      });
      return;
    }

    const missingFile = isEditing ? !editingWarning?.fileUrl : !warningFile;
    if (
      warningForm.misconductTypes.length === 0 ||
      !warningForm.issueDate ||
      missingFile ||
      (!isEditing && warningFile && !isPdfFile(warningForm.fileName))
    ) {
      toast({
        title: "Missing details",
        description: "Please select misconduct, warning type, issue date, and upload a PDF warning.",
        variant: "destructive",
      });
      return;
    }

    const expiryDate = computeWarningExpiry(warningForm.warningType, warningForm.issueDate);
    const warningPayload = {
      misconduct_type: JSON.stringify(warningForm.misconductTypes),
      warning_type: warningForm.warningType,
      issue_date: warningForm.issueDate,
      expiry_date: expiryDate,
    };

    if (!isEditing) {
      const safeName = warningFile!.name.replace(/\s+/g, "_");
      const filePath = `${user.id}/${selectedEmployee.id}-${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage.from("warnings").upload(filePath, warningFile!, {
        cacheControl: "3600",
        upsert: false,
        contentType: warningFile!.type || "application/pdf",
      });

      if (uploadError) {
        toast({
          title: "Upload failed",
          description: getSafeErrorMessage(uploadError),
          variant: "destructive",
        });
        return;
      }

      const { error: insertError } = await warningTable().insert({
        company_id: user.id,
        employee_id: selectedEmployee.id,
        ...warningPayload,
        file_url: filePath,
      });

      if (insertError) {
        toast({
          title: "Unable to save warning",
          description: getSafeErrorMessage(insertError),
          variant: "destructive",
        });
        return;
      }
    } else {
      const currentWarning = editingWarning;
      if (!currentWarning) return;
      const filePath = currentWarning.fileUrl || "";
      const { error: updateError } = await warningTable()
        .update({
          ...warningPayload,
          file_url: filePath,
        })
        .eq("id", currentWarning.id)
        .eq("company_id", user.id);

      if (updateError) {
        toast({
          title: "Unable to update warning",
          description: getSafeErrorMessage(updateError),
          variant: "destructive",
        });
        return;
      }

    }

    await fetchWarnings(selectedEmployee.id);
    resetWarningForm();
    setIsWarningDialogOpen(false);
    toast({
      title: isEditing ? "Warning updated" : "Warning uploaded",
      description: isEditing
        ? "The warning has been updated."
        : "The warning has been saved and will appear in the lists below.",
    });
  };

  const handleWarningFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && !isPdfFile(file.name)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file.",
        variant: "destructive",
      });
      event.target.value = "";
      setWarningForm((prev) => ({ ...prev, fileName: "" }));
      setWarningFile(null);
      return;
    }
    setWarningForm((prev) => ({
      ...prev,
      fileName: file?.name || "",
    }));
    setWarningFile(file ?? null);
  };

  const goToWarningGenerator = () => {
    if (!selectedEmployee) {
      toast({
        title: "No employee selected",
        description: "Open an employee profile before generating a warning.",
        variant: "destructive",
      });
      return;
    }

    navigate("/documents/discipline/warnings", {
      state: {
        employeeName: selectedEmployee.employee_name ?? "",
        employeeSurname: selectedEmployee.employee_surname ?? "",
        employeeIdNumber: selectedEmployee.id_number ?? "",
      },
    });
  };

  const handleDeleteWarning = async (warningId: string, fileUrl?: string) => {
    if (!selectedEmployee || !user) return;
    const confirmed = confirm("Are you sure you want to delete this warning?");
    if (!confirmed) return;
    const existing = warningsByEmployee[selectedEmployee.id] ?? [];
    const warning = existing.find((w) => w.id === warningId);
    if (!warning) return;

    // Optimistically remove from UI
    const next = existing.filter((w) => w.id !== warningId);
    setWarningsByEmployee((prev) => ({
      ...prev,
      [selectedEmployee.id]: next,
    }));

    const storagePath = getStoragePathFromUrl(fileUrl);

    // Delete from DB immediately
    const { error: deleteError } = await warningTable()
      .delete()
      .eq("id", warningId)
      .eq("company_id", user.id);

    if (deleteError) {
      // revert
      setWarningsByEmployee((prev) => ({
        ...prev,
        [selectedEmployee.id]: existing,
      }));
      toast({
        title: "Unable to delete warning",
        description: getSafeErrorMessage(deleteError),
        variant: "destructive",
      });
      return;
    }

    const expiresAt = Date.now() + 20_000;
    startWarningDeleteTimers({
      warning,
      employeeId: selectedEmployee.id,
      storagePath,
      expiresAt,
    });

    toast({
      title: "Warning deleted",
      description: "You can undo this for 20 seconds.",
    });
  };

  const handleOpenWarning = async (warning: EmployeeWarning) => {
    if (!warning.fileUrl) return;
    const storagePath = getStoragePathFromUrl(warning.fileUrl);
    const { data, error } = await supabase.storage
      .from("warnings")
      .createSignedUrl(storagePath, 60);
    if (error || !data?.signedUrl) {
      toast({
        title: "Unable to open warning",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleEditWarning = (warning: EmployeeWarning) => {
    setEditingWarning(warning);
    setWarningForm({
      misconductTypes: parseMisconductTypes(warning.misconductType),
      warningType: warning.warningType,
      issueDate: warning.issueDate || dateToday(),
      fileName: warning.fileName || "",
    });
    setWarningFile(null);
    setIsWarningDialogOpen(true);
  };

  const warningsForSelectedEmployee = useMemo(
    () => (selectedEmployee ? warningsByEmployee[selectedEmployee.id] ?? [] : []),
    [selectedEmployee, warningsByEmployee],
  );

  const warningsByStatus = useMemo(() => {
    const todayISO = dateToday();
    const isValid = (warning: EmployeeWarning) => warning.expiryDate && warning.expiryDate >= todayISO;
    return {
      valid: warningsForSelectedEmployee.filter(isValid),
      expired: warningsForSelectedEmployee.filter((w) => !isValid(w)),
    };
  }, [warningsForSelectedEmployee]);

  const canUploadContract =
    !!selectedEmployee &&
    contractForm.contractType.trim().length > 0 &&
    isPdfFile(contractForm.fileName) &&
    !!contractFile;

  const fetchContracts = useCallback(
    async (employeeId: string) => {
      if (!user) return;
      const { data, error } = await contractTable()
        .select("id, contract_type, issue_date, file_url, is_active")
        .eq("company_id", user.id)
        .eq("employee_id", employeeId)
        .order("issue_date", { ascending: false });

      if (error) {
        toast({
          title: "Unable to load contracts",
          description: getSafeErrorMessage(error),
          variant: "destructive",
        });
        return;
      }

      const mapped: EmployeeContract[] =
        (data ?? []).map((row: any) => ({
          id: row.id,
          contractType: row.contract_type,
          issueDate: row.issue_date,
          fileName: row.file_url ? row.file_url.split("/").pop() || "contract.pdf" : "",
          fileUrl: row.file_url,
          isActive: row.is_active ?? false,
        })) ?? [];

      setContractsByEmployee((prev) => ({
        ...prev,
        [employeeId]: mapped,
      }));
    },
    [toast, user],
  );

  const fetchActiveContractsForEmployees = useCallback(
    async (employeeIds: string[]) => {
      if (!user) return;
      if (employeeIds.length === 0) {
        setActiveContractsByEmployee({});
        return;
      }

      const { data, error } = await contractTable()
        .select("employee_id")
        .eq("company_id", user.id)
        .eq("is_active", true)
        .in("employee_id", employeeIds);

      if (error) {
        toast({
          title: "Unable to load contract status",
          description: getSafeErrorMessage(error),
          variant: "destructive",
        });
        return;
      }

      const activeIds = new Set((data ?? []).map((row: any) => row.employee_id));
      const next: Record<string, boolean> = {};
      employeeIds.forEach((id) => {
        next[id] = activeIds.has(id);
      });
      setActiveContractsByEmployee(next);
    },
    [toast, user],
  );

  useEffect(() => {
    if (selectedEmployee) {
      fetchContracts(selectedEmployee.id);
    }
  }, [selectedEmployee, fetchContracts]);

  const fetchIdDocument = useCallback(
    async (employeeId: string) => {
      if (!user) return;
      const { data, error } = await idDocumentTable()
        .select("id, employee_id, file_name, file_url, uploaded_at")
        .eq("company_id", user.id)
        .eq("employee_id", employeeId)
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        toast({
          title: "Unable to load ID / Passport document",
          description: getSafeErrorMessage(error),
          variant: "destructive",
        });
        return;
      }

      const mapped: EmployeeIdDocument | null = data
        ? {
            id: data.id,
            employeeId: data.employee_id,
            fileName: data.file_name || "document.pdf",
            fileUrl: data.file_url || "",
            uploadedAt: data.uploaded_at || "",
          }
        : null;

      setIdDocumentByEmployee((prev) => ({
        ...prev,
        [employeeId]: mapped,
      }));
    },
    [toast, user],
  );

  useEffect(() => {
    if (selectedEmployee) {
      fetchIdDocument(selectedEmployee.id);
    }
  }, [fetchIdDocument, selectedEmployee]);

  const fetchTerminationDocument = useCallback(
    async (employeeId: string) => {
      if (!user) return;
      const { data, error } = await terminationDocumentTable()
        .select("id, employee_id, file_name, file_url, uploaded_at")
        .eq("company_id", user.id)
        .eq("employee_id", employeeId)
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        toast({
          title: "Unable to load termination document",
          description: getSafeErrorMessage(error),
          variant: "destructive",
        });
        return;
      }

      const mapped: EmployeeTerminationDocument | null = data
        ? {
            id: data.id,
            employeeId: data.employee_id,
            fileName: data.file_name || "document.pdf",
            fileUrl: data.file_url || "",
            uploadedAt: data.uploaded_at || "",
          }
        : null;

      setTerminationDocumentByEmployee((prev) => ({
        ...prev,
        [employeeId]: mapped,
      }));
    },
    [toast, user],
  );

  useEffect(() => {
    if (selectedEmployee) {
      fetchTerminationDocument(selectedEmployee.id);
    }
  }, [fetchTerminationDocument, selectedEmployee]);

  const handleAddContract = async () => {
    if (!selectedEmployee || !user) {
      toast({
        title: "No employee selected",
        description: "Select an employee before adding a contract.",
        variant: "destructive",
      });
      return;
    }
    if (!contractForm.contractType || !isPdfFile(contractForm.fileName) || !contractFile) {
      toast({
        title: "Missing details",
        description: "Please select a contract type and upload a PDF contract.",
        variant: "destructive",
      });
      return;
    }

    const safeName = contractFile.name.replace(/\s+/g, "_");
    const filePath = `${user.id}/${selectedEmployee.id}-${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("contracts").upload(filePath, contractFile, {
      cacheControl: "3600",
      upsert: false,
      contentType: contractFile.type || "application/pdf",
    });

    if (uploadError) {
      toast({
        title: "Upload failed",
        description: getSafeErrorMessage(uploadError),
        variant: "destructive",
      });
      return;
    }

    const { data: inserted, error: insertError } = await contractTable()
      .insert({
        company_id: user.id,
        employee_id: selectedEmployee.id,
        contract_type: contractForm.contractType,
        issue_date: dateToday(),
        file_url: filePath,
        is_active: true,
      })
      .select("id")
      .single();

    if (insertError) {
      toast({
        title: "Unable to save contract",
        description: getSafeErrorMessage(insertError),
        variant: "destructive",
      });
      return;
    }

    if (inserted?.id) {
      const { error: deactivateError } = await contractTable()
        .update({ is_active: false })
        .eq("company_id", user.id)
        .eq("employee_id", selectedEmployee.id)
        .neq("id", inserted.id)
        .eq("is_active", true);

      if (deactivateError) {
        toast({
          title: "Contract saved",
          description: "Unable to deactivate previous contracts automatically.",
          variant: "destructive",
        });
      }
    }

    await fetchContracts(selectedEmployee.id);
    void fetchActiveContractsForEmployees(employees.map((employee) => employee.id));
    setContractForm({
      contractType: "",
      fileName: "",
    });
    setContractFile(null);
    setIsContractDialogOpen(false);
    toast({
      title: "Contract uploaded",
      description: "The contract has been saved and will appear in the list below.",
    });
  };

  const handleContractFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && !isPdfFile(file.name)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file.",
        variant: "destructive",
      });
      event.target.value = "";
      setContractForm((prev) => ({ ...prev, fileName: "" }));
      setContractFile(null);
      return;
    }
    setContractForm((prev) => ({
      ...prev,
      fileName: file?.name || "",
    }));
    setContractFile(file ?? null);
  };

  const handleDeleteContract = async (contractId: string, fileUrl?: string) => {
    if (!selectedEmployee || !user) return;
    const confirmed = confirm("Are you sure you want to delete this contract?");
    if (!confirmed) return;
    const existing = contractsByEmployee[selectedEmployee.id] ?? [];
    const contract = existing.find((item) => item.id === contractId);
    if (!contract) return;

    setContractsByEmployee((prev) => ({
      ...prev,
      [selectedEmployee.id]: existing.filter((item) => item.id !== contractId),
    }));

    const { error: deleteError } = await contractTable()
      .delete()
      .eq("id", contractId)
      .eq("company_id", user.id);

    if (deleteError) {
      setContractsByEmployee((prev) => ({
        ...prev,
        [selectedEmployee.id]: existing,
      }));
      toast({
        title: "Unable to delete contract",
        description: getSafeErrorMessage(deleteError),
        variant: "destructive",
      });
      return;
    }

    const storagePath = getContractStoragePathFromUrl(fileUrl);
    if (storagePath) {
      await supabase.storage.from("contracts").remove([storagePath]);
    }

    toast({
      title: "Contract deleted",
      description: "The contract has been removed.",
    });

    void fetchActiveContractsForEmployees(employees.map((employee) => employee.id));
  };

  const handleStartContractUpload = () => {
    const activeContract = contractsByStatus.active[0];
    if (activeContract) {
      const uploadedDate = formatDisplayDate(activeContract.issueDate);
      const shouldDelete = confirm(
        `An active contract uploaded on ${uploadedDate} already exists. Click OK to permanently delete it from all records first, or Cancel to keep it and upload a new one (the existing contract will become inactive).`,
      );
      if (shouldDelete) {
        void handleDeleteContract(activeContract.id, activeContract.fileUrl);
      }
    }
    setIsContractDialogOpen(true);
  };

  const handleOpenContract = async (contract: EmployeeContract) => {
    if (!contract.fileUrl) return;
    const storagePath = getContractStoragePathFromUrl(contract.fileUrl);
    const { data, error } = await supabase.storage
      .from("contracts")
      .createSignedUrl(storagePath, 60);
    if (error || !data?.signedUrl) {
      toast({
        title: "Unable to open contract",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const removeActiveEmploymentContract = useCallback(
    async (employeeId: string) => {
      if (!user) return;
      const existingContract = (contractsByEmployee[employeeId] ?? []).find((contract) => contract.isActive) ?? null;
      if (!existingContract) {
        setIsEmploymentContractMarkedForRemoval(false);
        return;
      }

      const { error: deleteError } = await contractTable()
        .delete()
        .eq("id", existingContract.id)
        .eq("company_id", user.id);

      if (deleteError) {
        throw deleteError;
      }

      const storagePath = getContractStoragePathFromUrl(existingContract.fileUrl);
      if (storagePath) {
        await supabase.storage.from("contracts").remove([storagePath]);
      }

      setContractsByEmployee((prev) => ({
        ...prev,
        [employeeId]: (prev[employeeId] ?? []).filter((contract) => contract.id !== existingContract.id),
      }));
      setIsEmploymentContractMarkedForRemoval(false);
    },
    [contractsByEmployee, user],
  );

  const uploadPendingEmploymentContract = useCallback(
    async (employeeId: string) => {
      if (!pendingEmploymentContractFile || !user) return;
      setIsEmploymentContractUploading(true);
      try {
        const safeName = pendingEmploymentContractFile.name.replace(/\s+/g, "_");
        const filePath = `${user.id}/${employeeId}-${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("contracts").upload(filePath, pendingEmploymentContractFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: pendingEmploymentContractFile.type || "application/pdf",
        });

        if (uploadError) throw uploadError;

        const { data: inserted, error: insertError } = await contractTable()
          .insert({
            company_id: user.id,
            employee_id: employeeId,
            contract_type: profileForm.contractType || "Permanent",
            issue_date: dateToday(),
            file_url: filePath,
            is_active: true,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;

        if (inserted?.id) {
          const { error: deactivateError } = await contractTable()
            .update({ is_active: false })
            .eq("company_id", user.id)
            .eq("employee_id", employeeId)
            .neq("id", inserted.id)
            .eq("is_active", true);

          if (deactivateError) throw deactivateError;
        }

        await fetchContracts(employeeId);
        setPendingEmploymentContractFile(null);
        setPendingEmploymentContractName("");
        setIsEmploymentContractMarkedForRemoval(false);
      } finally {
        setIsEmploymentContractUploading(false);
      }
    },
    [fetchContracts, pendingEmploymentContractFile, profileForm.contractType, user],
  );

  const handleEmploymentContractFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!isPdfFile(file.name)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }
    setPendingEmploymentContractFile(file);
    setPendingEmploymentContractName(file.name);
    setIsEmploymentContractMarkedForRemoval(false);
    setActiveEditSection("employmentStatus");
    event.target.value = "";
  };

  const handleMarkEmploymentContractForRemoval = () => {
    if (!selectedEmployee) return;
    const activeContract =
      (contractsByEmployee[selectedEmployee.id] ?? []).find((contract) => contract.isActive) ?? null;
    if (!activeContract) return;
    const confirmed = confirm(
      `Are you sure you want to delete ${activeContract.fileName} because it will be permanently removed from all databases.`,
    );
    if (!confirmed) return;
    setPendingEmploymentContractFile(null);
    setPendingEmploymentContractName("");
    setIsEmploymentContractMarkedForRemoval(true);
    setActiveEditSection("employmentStatus");
  };

  const handleTerminationDocumentFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!isPdfFile(file.name)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }
    setPendingTerminationDocumentFile(file);
    setPendingTerminationDocumentName(file.name);
    event.target.value = "";
    if (selectedEmployee) {
      void uploadTerminationDocument(selectedEmployee.id, file);
    }
  };

  const uploadTerminationDocument = useCallback(
    async (employeeId: string, file?: File) => {
      if (!user) return;
      const uploadFile = file ?? pendingTerminationDocumentFile;
      if (!uploadFile) return;

      setIsTerminationDocumentUploading(true);
      try {
        const existing = terminationDocumentByEmployee[employeeId] ?? null;
        if (existing) {
          const { error: deleteExistingError } = await terminationDocumentTable()
            .delete()
            .eq("id", existing.id)
            .eq("company_id", user.id);
          if (deleteExistingError) throw deleteExistingError;

          const existingStoragePath = getContractStoragePathFromUrl(existing.fileUrl);
          if (existingStoragePath) {
            await supabase.storage.from("contracts").remove([existingStoragePath]);
          }
        }

        const safeName = uploadFile.name.replace(/\s+/g, "_");
        const filePath = `${user.id}/termination-documents/${employeeId}-${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("contracts").upload(filePath, uploadFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: uploadFile.type || "application/pdf",
        });

        if (uploadError) throw uploadError;

        const { error: insertError } = await terminationDocumentTable().insert({
          company_id: user.id,
          employee_id: employeeId,
          file_name: uploadFile.name,
          file_url: filePath,
        });
        if (insertError) throw insertError;

        await fetchTerminationDocument(employeeId);
        setPendingTerminationDocumentFile(null);
        setPendingTerminationDocumentName("");
        toast({
          title: "Termination document uploaded",
          description: "The document has been saved.",
        });
      } catch (error: unknown) {
        toast({
          title: "Unable to upload termination document",
          description: getSafeErrorMessage(error),
          variant: "destructive",
        });
      } finally {
        setIsTerminationDocumentUploading(false);
      }
    },
    [fetchTerminationDocument, pendingTerminationDocumentFile, terminationDocumentByEmployee, toast, user],
  );

  const handleOpenTerminationDocument = async (document: EmployeeTerminationDocument) => {
    if (!document.fileUrl) return;
    const storagePath = getContractStoragePathFromUrl(document.fileUrl);
    const { data, error } = await supabase.storage
      .from("contracts")
      .createSignedUrl(storagePath, 60);
    if (error || !data?.signedUrl) {
      toast({
        title: "Unable to open termination document",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleRemoveTerminationDocument = async () => {
    if (!selectedEmployee || !user) return;
    const existing = terminationDocumentByEmployee[selectedEmployee.id] ?? null;
    if (!existing) return;
    const confirmed = confirm(
      `Are you sure you want to delete ${existing.fileName} because it will be permanently removed from all databases.`,
    );
    if (!confirmed) return;

    const { error: deleteError } = await terminationDocumentTable()
      .delete()
      .eq("id", existing.id)
      .eq("company_id", user.id);

    if (deleteError) {
      toast({
        title: "Unable to delete termination document",
        description: getSafeErrorMessage(deleteError),
        variant: "destructive",
      });
      return;
    }

    const storagePath = getContractStoragePathFromUrl(existing.fileUrl);
    if (storagePath) {
      await supabase.storage.from("contracts").remove([storagePath]);
    }

    setTerminationDocumentByEmployee((prev) => ({
      ...prev,
      [selectedEmployee.id]: null,
    }));
    toast({
      title: "Termination document deleted",
      description: "The document has been removed.",
    });
  };

  const handleTerminationDateChange = async (nextDate: string) => {
    if (!selectedEmployee || !user) return;
    const { error } = await supabase
      .from("employees")
      .update({ terminated_at: nextDate || null } as unknown as TablesInsert<"employees">)
      .eq("id", selectedEmployee.id)
      .eq("company_id", user.id);

    if (error) {
      toast({
        title: "Unable to save termination date",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
      return;
    }

    setSelectedEmployee((prev) => (prev ? { ...prev, terminated_at: nextDate || null } : prev));
    setEmployees((prev) =>
      prev.map((emp) => (emp.id === selectedEmployee.id ? { ...emp, terminated_at: nextDate || null } : emp)),
    );
    setFilteredEmployees((prev) =>
      prev.map((emp) => (emp.id === selectedEmployee.id ? { ...emp, terminated_at: nextDate || null } : emp)),
    );
    setAllEmployees((prev) =>
      prev.map((emp) => (emp.id === selectedEmployee.id ? { ...emp, terminated_at: nextDate || null } : emp)),
    );
  };

  const handleOpenIdDocument = async (document: EmployeeIdDocument) => {
    if (!document.fileUrl) return;
    const storagePath = getIdDocumentStoragePathFromUrl(document.fileUrl);
    const { data, error } = await supabase.storage
      .from("contracts")
      .createSignedUrl(storagePath, 60);
    if (error || !data?.signedUrl) {
      toast({
        title: "Unable to open ID / Passport document",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const fetchLicences = useCallback(
    async (employeeId: string) => {
      if (!user) return;
      const { data, error } = await licenceTable()
        .select("id, employee_id, category, licence_type, file_name, file_url, uploaded_at")
        .eq("company_id", user.id)
        .eq("employee_id", employeeId)
        .order("uploaded_at", { ascending: false });

      if (error) {
        toast({
          title: "Unable to load licences",
          description: getSafeErrorMessage(error),
          variant: "destructive",
        });
        return;
      }

      const mapped: EmployeeLicence[] =
        (data ?? []).map((row: any) => ({
          id: row.id,
          employeeId: row.employee_id,
          category: row.category as LicenceCategory,
          licenceType: row.licence_type || "",
          fileName: row.file_name || "document.pdf",
          fileUrl: row.file_url || "",
          uploadedAt: row.uploaded_at || "",
        })) ?? [];

      setLicencesByEmployee((prev) => ({
        ...prev,
        [employeeId]: mapped,
      }));
    },
    [toast, user],
  );

  useEffect(() => {
    if (selectedEmployee) {
      fetchLicences(selectedEmployee.id);
    }
  }, [fetchLicences, selectedEmployee]);

  const handleOpenLicence = async (licence: EmployeeLicence) => {
    if (!licence.fileUrl) return;
    const storagePath = getContractStoragePathFromUrl(licence.fileUrl);
    const { data, error } = await supabase.storage
      .from("contracts")
      .createSignedUrl(storagePath, 60);
    if (error || !data?.signedUrl) {
      toast({
        title: "Unable to open licence",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleRemoveLicence = async (licence: EmployeeLicence) => {
    if (!selectedEmployee || !user) return;
    const confirmed = confirm(
      `Are you sure you want to delete ${licence.fileName} because it will be permanently removed from all databases.`,
    );
    if (!confirmed) return;

    const existing = licencesByEmployee[selectedEmployee.id] ?? [];
    setLicencesByEmployee((prev) => ({
      ...prev,
      [selectedEmployee.id]: existing.filter((item) => item.id !== licence.id),
    }));

    const { error: deleteError } = await licenceTable()
      .delete()
      .eq("id", licence.id)
      .eq("company_id", user.id);

    if (deleteError) {
      setLicencesByEmployee((prev) => ({
        ...prev,
        [selectedEmployee.id]: existing,
      }));
      toast({
        title: "Unable to delete licence",
        description: getSafeErrorMessage(deleteError),
        variant: "destructive",
      });
      return;
    }

    const storagePath = getContractStoragePathFromUrl(licence.fileUrl);
    if (storagePath) {
      await supabase.storage.from("contracts").remove([storagePath]);
    }

    toast({
      title: "Licence removed",
      description: "The licence document has been removed.",
    });
  };

  const handleLicenceFileChange = async (category: LicenceCategory, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedEmployee || !user) return;
    const selectedType = licenceTypeSelection[category];
    if (!selectedType) {
      toast({
        title: "Licence type required",
        description: "Select a licence type before uploading a document.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }
    if (!isPdfFile(file.name)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    try {
      const existingSameType = (licencesByEmployee[selectedEmployee.id] ?? []).find(
        (item) => item.category === category && item.licenceType === selectedType,
      );
      if (existingSameType) {
        toast({
          title: "Licence already uploaded",
          description: `Only one ${selectedType} document is allowed. Remove the existing one first.`,
          variant: "destructive",
        });
        event.target.value = "";
        return;
      }

      const safeName = file.name.replace(/\s+/g, "_");
      const filePath = `${user.id}/licences/${selectedEmployee.id}-${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("contracts").upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/pdf",
      });
      if (uploadError) throw uploadError;

      const { error: insertError } = await licenceTable().insert({
        company_id: user.id,
        employee_id: selectedEmployee.id,
        category,
        licence_type: selectedType,
        file_name: file.name,
        file_url: filePath,
        uploaded_at: new Date().toISOString(),
      });
      if (insertError) throw insertError;

      await fetchLicences(selectedEmployee.id);
      setLicenceTypeSelection((prev) => ({ ...prev, [category]: "" }));
      toast({
        title: "Licence uploaded",
        description: "The licence document has been uploaded successfully.",
      });
    } catch (error: unknown) {
      toast({
        title: "Upload failed",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      event.target.value = "";
    }
  };

  const fetchEducations = useCallback(
    async (employeeId: string) => {
      if (!user) return;
      const { data, error } = await educationTable()
        .select("id, employee_id, category, qualification_type, file_name, file_url, uploaded_at")
        .eq("company_id", user.id)
        .eq("employee_id", employeeId)
        .order("uploaded_at", { ascending: false });

      if (error) {
        toast({
          title: "Unable to load education documents",
          description: getSafeErrorMessage(error),
          variant: "destructive",
        });
        return;
      }

      const mapped: EmployeeEducation[] =
        (data ?? []).map((row: any) => ({
          id: row.id,
          employeeId: row.employee_id,
          category: row.category as EducationCategory,
          qualificationType: row.qualification_type || "",
          fileName: row.file_name || "document.pdf",
          fileUrl: row.file_url || "",
          uploadedAt: row.uploaded_at || "",
        })) ?? [];

      setEducationsByEmployee((prev) => ({
        ...prev,
        [employeeId]: mapped,
      }));
    },
    [toast, user],
  );

  useEffect(() => {
    if (selectedEmployee) {
      fetchEducations(selectedEmployee.id);
    }
  }, [fetchEducations, selectedEmployee]);

  const handleOpenEducation = async (education: EmployeeEducation) => {
    if (!education.fileUrl) return;
    const storagePath = getContractStoragePathFromUrl(education.fileUrl);
    const { data, error } = await supabase.storage
      .from("contracts")
      .createSignedUrl(storagePath, 60);
    if (error || !data?.signedUrl) {
      toast({
        title: "Unable to open education document",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleRemoveEducation = async (education: EmployeeEducation) => {
    if (!selectedEmployee || !user) return;
    const confirmed = confirm(
      `Are you sure you want to delete ${education.fileName} because it will be permanently removed from all databases.`,
    );
    if (!confirmed) return;

    const existing = educationsByEmployee[selectedEmployee.id] ?? [];
    setEducationsByEmployee((prev) => ({
      ...prev,
      [selectedEmployee.id]: existing.filter((item) => item.id !== education.id),
    }));

    const { error: deleteError } = await educationTable()
      .delete()
      .eq("id", education.id)
      .eq("company_id", user.id);

    if (deleteError) {
      setEducationsByEmployee((prev) => ({
        ...prev,
        [selectedEmployee.id]: existing,
      }));
      toast({
        title: "Unable to delete education document",
        description: getSafeErrorMessage(deleteError),
        variant: "destructive",
      });
      return;
    }

    const storagePath = getContractStoragePathFromUrl(education.fileUrl);
    if (storagePath) {
      await supabase.storage.from("contracts").remove([storagePath]);
    }

    toast({
      title: "Education document removed",
      description: "The education document has been removed.",
    });
  };

  const handleEducationFileChange = async (category: EducationCategory, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedEmployee || !user) return;
    const selectedType = educationTypeSelection[category];
    if (!selectedType) {
      toast({
        title: "Education type required",
        description: "Select an education type before uploading a document.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }
    if (!isPdfFile(file.name)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    try {
      const existingSameType = (educationsByEmployee[selectedEmployee.id] ?? []).find(
        (item) => item.category === category && item.qualificationType === selectedType,
      );
      if (existingSameType) {
        toast({
          title: "Education already uploaded",
          description: `Only one ${selectedType} document is allowed. Remove the existing one first.`,
          variant: "destructive",
        });
        event.target.value = "";
        return;
      }

      const safeName = file.name.replace(/\s+/g, "_");
      const filePath = `${user.id}/education/${selectedEmployee.id}-${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("contracts").upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/pdf",
      });
      if (uploadError) throw uploadError;

      const { error: insertError } = await educationTable().insert({
        company_id: user.id,
        employee_id: selectedEmployee.id,
        category,
        qualification_type: selectedType,
        file_name: file.name,
        file_url: filePath,
        uploaded_at: new Date().toISOString(),
      });
      if (insertError) throw insertError;

      await fetchEducations(selectedEmployee.id);
      setEducationTypeSelection((prev) => ({ ...prev, [category]: "" }));
      toast({
        title: "Education uploaded",
        description: "The education document has been uploaded successfully.",
      });
    } catch (error: unknown) {
      toast({
        title: "Upload failed",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      event.target.value = "";
    }
  };

  const removeIdDocument = useCallback(
    async (employeeId: string) => {
      if (!user) return;
      const existingDocument = idDocumentByEmployee[employeeId];
      if (!existingDocument) {
        setIsIdDocumentMarkedForRemoval(false);
        return;
      }

      const { error: deleteError } = await idDocumentTable()
        .delete()
        .eq("company_id", user.id)
        .eq("employee_id", employeeId);

      if (deleteError) {
        throw deleteError;
      }

      if (existingDocument.fileUrl) {
        await supabase.storage.from("contracts").remove([getIdDocumentStoragePathFromUrl(existingDocument.fileUrl)]);
      }

      setIdDocumentByEmployee((prev) => ({
        ...prev,
        [employeeId]: null,
      }));
      setIsIdDocumentMarkedForRemoval(false);
    },
    [idDocumentByEmployee, user],
  );

  const uploadPendingIdDocument = useCallback(
    async (employeeId: string) => {
      if (!pendingIdDocumentFile || !user) return;
      setIsIdDocumentUploading(true);
      try {
        const existingDocument = idDocumentByEmployee[employeeId] ?? null;
        const safeName = pendingIdDocumentFile.name.replace(/\s+/g, "_");
        const filePath = `${user.id}/id-passports/${employeeId}-${Date.now()}-${safeName}`;

        const { error: uploadError } = await supabase.storage.from("contracts").upload(filePath, pendingIdDocumentFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: pendingIdDocumentFile.type || "application/pdf",
        });

        if (uploadError) {
          throw uploadError;
        }

        const { data, error } = await idDocumentTable()
          .upsert(
            {
              company_id: user.id,
              employee_id: employeeId,
              file_name: pendingIdDocumentFile.name,
              file_url: filePath,
              uploaded_at: new Date().toISOString(),
            },
            { onConflict: "employee_id" },
          )
          .select("id, employee_id, file_name, file_url, uploaded_at")
          .single();

        if (error) {
          throw error;
        }

        if (existingDocument?.fileUrl) {
          await supabase.storage.from("contracts").remove([getIdDocumentStoragePathFromUrl(existingDocument.fileUrl)]);
        }

        setIdDocumentByEmployee((prev) => ({
          ...prev,
          [employeeId]: {
            id: data.id,
            employeeId: data.employee_id,
            fileName: data.file_name || pendingIdDocumentFile.name,
            fileUrl: data.file_url || filePath,
            uploadedAt: data.uploaded_at || new Date().toISOString(),
          },
        }));
        setPendingIdDocumentFile(null);
        setPendingIdDocumentName("");
      } finally {
        setIsIdDocumentUploading(false);
      }
    },
    [idDocumentByEmployee, pendingIdDocumentFile, user],
  );

  const handleIdPassportFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isPdfFile(file.name)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }
    setPendingIdDocumentFile(file);
    setPendingIdDocumentName(file.name);
    setIsIdDocumentMarkedForRemoval(false);
    if (!isEditMode) {
      event.target.value = "";
      return;
    }
    setActiveEditSection("identity");
    event.target.value = "";
  };

  const handleMarkIdDocumentForRemoval = () => {
    if (!idDocumentForSelectedEmployee) return;
    const confirmed = confirm(
      `Are you sure you want to delete ${idDocumentForSelectedEmployee.fileName} because it will be permanently removed from all databases.`,
    );
    if (!confirmed) return;
    setPendingIdDocumentFile(null);
    setPendingIdDocumentName("");
    setIsIdDocumentMarkedForRemoval(true);
    if (!isEditMode) {
      return;
    }
    setActiveEditSection("identity");
  };

  const contractsForSelectedEmployee = useMemo(
    () => (selectedEmployee ? contractsByEmployee[selectedEmployee.id] ?? [] : []),
    [selectedEmployee, contractsByEmployee],
  );
  const terminationDocumentForSelectedEmployee = useMemo(
    () => (selectedEmployee ? terminationDocumentByEmployee[selectedEmployee.id] ?? null : null),
    [selectedEmployee, terminationDocumentByEmployee],
  );
  const idDocumentForSelectedEmployee = useMemo(
    () => (selectedEmployee ? idDocumentByEmployee[selectedEmployee.id] ?? null : null),
    [idDocumentByEmployee, selectedEmployee],
  );
  const hasEffectiveIdDocument = !!idDocumentForSelectedEmployee && !isIdDocumentMarkedForRemoval;

  const profileCompletion = useMemo(() => {
    const derivedDob = isSouthAfricanNationality
      ? formatInputDate(extractDobFromId(profileForm.idNumber || ""))
      : profileForm.dateOfBirth;
    const fields = [
      { label: "Name", value: profileForm.employeeName },
      { label: "Surname", value: profileForm.employeeSurname },
      { label: "ID Number", value: profileForm.idNumber },
      { label: "Date of Birth", value: derivedDob },
      { label: "Nationality", value: profileForm.nationality },
      { label: "Race", value: profileForm.race },
      { label: "Gender", value: profileForm.gender },
      { label: "Disability Status", value: profileForm.disabilityStatus ? "Yes" : "No" },
      { label: "Citizenship Status", value: profileForm.citizenshipStatus },
      { label: "Cell Number", value: profileForm.cellNumber },
      { label: "Email", value: profileForm.email },
      { label: "Emergency Contact Name", value: profileForm.emergencyContactName },
      { label: "Emergency Contact Number", value: profileForm.emergencyContactNumber },
      { label: "Income Tax Number", value: profileForm.incomeTaxNumber },
      { label: "Start Date", value: profileForm.startDate },
      { label: "Contract Type", value: profileForm.contractType },
      { label: "Job Title", value: profileForm.jobTitle },
      { label: "Employee Number", value: profileForm.employeeNumber },
      { label: "Probation Period", value: probationPeriod },
      { label: "Department", value: department },
      { label: "Branch", value: branch },
      { label: "Reporting To", value: reportingTo },
      { label: "Occupational Level", value: occupationalLevel },
      { label: "Salary Cycle", value: salaryType },
      { label: "Basic Salary", value: basicSalary },
      { label: "Union Member", value: unionMember },
    ];

    if (profileForm.contractType === "Temporary") {
      fields.push({ label: "End Date", value: profileForm.endDate });
    }

    const physicalLineGroup = [profileForm.physicalAddressLine1, profileForm.physicalAddressLine2];
    const postalLineGroup = [profileForm.postalAddressLine1, profileForm.postalAddressLine2];
    const physicalLineComplete = physicalLineGroup.some((value) => String(value ?? "").trim().length > 0);
    const postalLineComplete = postalLineGroup.some((value) => String(value ?? "").trim().length > 0);
    const physicalComplete =
      physicalLineComplete &&
      String(profileForm.city ?? "").trim().length > 0 &&
      String(profileForm.province ?? "").trim().length > 0 &&
      String(profileForm.areaCode ?? "").trim().length > 0;
    const postalComplete =
      postalLineComplete &&
      String(profileForm.postalCity ?? "").trim().length > 0 &&
      String(profileForm.postalProvince ?? "").trim().length > 0 &&
      String(profileForm.postalAreaCode ?? "").trim().length > 0;

    const filled = fields.filter((field) => String(field.value ?? "").trim().length > 0).length;
    const addressFilledCount =
      (physicalLineComplete ? 1 : 0) +
      (postalLineComplete ? 1 : 0) +
      (String(profileForm.city ?? "").trim().length > 0 ? 1 : 0) +
      (String(profileForm.province ?? "").trim().length > 0 ? 1 : 0) +
      (String(profileForm.areaCode ?? "").trim().length > 0 ? 1 : 0) +
      (String(profileForm.postalCity ?? "").trim().length > 0 ? 1 : 0) +
      (String(profileForm.postalProvince ?? "").trim().length > 0 ? 1 : 0) +
      (String(profileForm.postalAreaCode ?? "").trim().length > 0 ? 1 : 0);
    const missingFields = fields
      .filter((field) => String(field.value ?? "").trim().length === 0)
      .map((field) => field.label);
    if (!physicalComplete) {
      missingFields.push("Physical address");
    }
    if (!postalComplete) {
      missingFields.push("Postal address");
    }
    const hasContract = contractsForSelectedEmployee.length > 0;
    const hasIdPassportDocument = hasEffectiveIdDocument;
    if (!hasIdPassportDocument) {
      missingFields.push("ID/Passport document");
    }
    const addressTotalCount = 8;
    const total = fields.length + addressTotalCount + 2;
    const completed = filled + addressFilledCount + (hasContract ? 1 : 0) + (hasIdPassportDocument ? 1 : 0);
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    let colorClass = "text-emerald-600";
    if (percent < 50) {
      colorClass = "text-red-600";
    } else if (percent < 80) {
      colorClass = "text-amber-600";
    }

    const label = percent === 100 ? "Profile 100% completed" : `Profile ${percent}% complete`;

    return {
      percent,
      label,
      colorClass,
      missingFields,
      missingContract: !hasContract,
    };
  }, [
    profileForm,
    contractsForSelectedEmployee,
    isSouthAfricanNationality,
    probationPeriod,
    department,
    branch,
    reportingTo,
    occupationalLevel,
    salaryType,
    basicSalary,
    unionMember,
    hasEffectiveIdDocument,
  ]);

  const contractsByStatus = useMemo(
    () => ({
      active: contractsForSelectedEmployee.filter((contract) => contract.isActive),
      inactive: contractsForSelectedEmployee.filter((contract) => !contract.isActive),
    }),
    [contractsForSelectedEmployee],
  );
  const activeContractForSelectedEmployee = useMemo(
    () => contractsByStatus.active[0] ?? null,
    [contractsByStatus],
  );
  const hasEffectiveEmploymentContract =
    !!activeContractForSelectedEmployee && !isEmploymentContractMarkedForRemoval;
  const licencesForSelectedEmployee = useMemo(
    () => (selectedEmployee ? licencesByEmployee[selectedEmployee.id] ?? [] : []),
    [licencesByEmployee, selectedEmployee],
  );
  const educationsForSelectedEmployee = useMemo(
    () => (selectedEmployee ? educationsByEmployee[selectedEmployee.id] ?? [] : []),
    [educationsByEmployee, selectedEmployee],
  );

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
    if (category === "Minor") {
      return "border-emerald-500 data-[state=checked]:bg-emerald-100 data-[state=checked]:border-emerald-600 text-emerald-700";
    }
    if (category === "Serious") {
      return "border-amber-500 data-[state=checked]:bg-amber-100 data-[state=checked]:border-amber-600 text-amber-700";
    }
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

  const navigationEmployees = allEmployees.length > 0 ? allEmployees : employees;

  const selectedEmployeeIndex = useMemo(() => {
    if (!selectedEmployee) return -1;
    return navigationEmployees.findIndex((employee) => employee.id === selectedEmployee.id);
  }, [navigationEmployees, selectedEmployee]);

  const hasPreviousEmployee = selectedEmployeeIndex > 0;
  const hasNextEmployee =
    selectedEmployeeIndex >= 0 && selectedEmployeeIndex < navigationEmployees.length - 1;

  const navigateToEmployee = useCallback(
    (index: number) => {
      const nextEmployee = navigationEmployees[index];
      if (!nextEmployee) return;
      setSelectedEmployee(nextEmployee);
      setProfileForm(createProfileFormFromEmployee(nextEmployee));
      setProbationPeriod(nextEmployee.probation_period ?? "");
      setUnionMember((nextEmployee.union_member as (typeof unionMemberOptions)[number]) ?? "");
      setTradeUnion(nextEmployee.trade_union ?? "");
      setDepartment((nextEmployee.department as (typeof departmentOptions)[number]) ?? "");
      setBranch(nextEmployee.branch ?? "");
      setReportingTo(nextEmployee.reporting_to ?? "");
      setOccupationalLevel(
        (nextEmployee.occupational_level as (typeof occupationalLevelOptions)[number]) ?? "",
      );
      setSalaryType((nextEmployee.salary_type as (typeof salaryTypeOptions)[number]) ?? "");
      setBasicSalary(nextEmployee.basic_salary ?? "");
      setWorkEmail(nextEmployee.work_email ?? "");
      setWorkCellNumber(nextEmployee.work_cell_number ?? "");
      setActiveTab("personal");
      setIsEditMode(false);
    },
    [navigationEmployees],
  );

  const toggleWarningMisconduct = (type: string) => {
    setWarningForm((prev) => {
      const exists = prev.misconductTypes.includes(type);
      const next = exists
        ? prev.misconductTypes.filter((item) => item !== type)
        : [...prev.misconductTypes, type];
      return { ...prev, misconductTypes: next };
    });
  };

  const handleMisconductMenuOpenChange = (open: boolean) => {
    setIsMisconductMenuOpen(open);
    if (!open) {
      setMisconductSearch("");
    }
  };

  const sectionTitles: Record<ProfileSectionKey, string> = {
    identity: "Identity",
    equity: "Employment Equity",
    contact: "Contact Information",
    statutory: "Statutory Information",
    employmentStatus: "Employment Status",
    employmentOrg: "Organisational Details",
    employmentRemuneration: "Remuneration Information",
    employmentWorkContact: "Work Contact Information",
    employmentUnion: "Union Association",
    homeAddress: "Home Address",
    postalAddress: "Postal Address",
  };

  const focusActiveSection = useCallback(() => {
    if (!activeEditSection) return;
    const sectionEl = sectionRefs.current[activeEditSection];
    const focusTarget = sectionEl?.querySelector<HTMLElement>(
      "input, button[role='combobox'], select, textarea, button",
    );
    focusTarget?.focus();
  }, [activeEditSection]);

  const guardEditSession = useCallback(
    (event?: { preventDefault?: () => void; stopPropagation?: () => void }) => {
      if (isEditMode && activeEditSection) {
        event?.preventDefault();
        event?.stopPropagation();
        toast({
          title: "Finish current edit",
          description: `Save or cancel ${sectionTitles[activeEditSection]} before continuing.`,
        });
        focusActiveSection();
        return false;
      }
      return true;
    },
    [activeEditSection, focusActiveSection, isEditMode, sectionTitles, toast],
  );

  const handleSectionInteract = useCallback(
    (section: ProfileSectionKey, event: SyntheticEvent) => {
      if (isEditMode && activeEditSection && activeEditSection !== section && !guardEditSession(event)) {
        return;
      }
      if (activeEditSection !== section) {
        setActiveEditSection(section);
      }
      if (!isEditMode) {
        setIsEditMode(true);
      }
    },
    [activeEditSection, guardEditSession, isEditMode],
  );

  const renderProfilePanel = () => {
    if (!selectedEmployee) return null;

    return (
      <div className="flex h-full flex-col bg-[#f7f9fb] overflow-hidden">
        <div className="flex flex-1 min-h-0 flex-col px-6 pt-0 pb-0">
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-[10px] text-slate-500">
              <Menu className="h-3.5 w-3.5 -ml-1" />
              <span className="font-semibold text-slate-700">Employee Profile</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 w-[89px] px-2 text-[10px] text-slate-700 border border-slate-300 bg-white justify-center gap-1 hover:bg-white hover:text-slate-900 hover:border-blue-400 data-[state=open]:border-slate-300"
                onClick={(event) => {
                  if (!guardEditSession(event)) return;
                  navigateToEmployee(selectedEmployeeIndex - 1);
                }}
                disabled={!hasPreviousEmployee}
              >
                <ChevronLeft className="h-3 w-3 mr-[-1px]" />
                Previous
                <span className="h-3 w-3" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 w-[89px] px-2 text-[10px] text-slate-700 border border-slate-300 bg-white justify-center gap-1 hover:bg-white hover:text-slate-900 hover:border-blue-400 data-[state=open]:border-slate-300"
                onClick={(event) => {
                  if (!guardEditSession(event)) return;
                  navigateToEmployee(selectedEmployeeIndex + 1);
                }}
                disabled={!hasNextEmployee}
              >
                <span className="h-3 w-2" aria-hidden="true" />
                Next
                <ChevronRight className="h-3 w-3 ml-[-1px]" />
              </Button>
            </div>
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-sm bg-sky-50 text-slate-500 hover:text-slate-900"
            onClick={closeProfileDialog}
            aria-label="Close employee profile"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3 grid h-full flex-1 min-h-0 gap-3 grid-cols-[320px_1fr]">
          <aside className="h-full min-h-0 space-y-4 overflow-y-auto pr-1">

            <div className="rounded-sm border border-slate-300 bg-white overflow-hidden">
              <div className="relative bg-slate-100">
                <img
                  src="/employee_profile_background.png"
                  alt="Employee profile background"
                  className="h-36 w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute left-5 bottom-0 translate-y-1/2">
                  <div className="rounded-full border-[3px] border-white shadow-lg">
                    <img
                      src={(profileForm.gender || "").toLowerCase().startsWith("f") ? "/female_avatar(1).png" : "/male_avatar(1).png"}
                      alt="Employee avatar"
                      className="h-20 w-20 rounded-full object-cover"
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>

              {employeeStatus !== "Inactive" && (
                <div className="pl-5 pr-2 pt-2">
                  <div className="flex justify-end">
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className={`text-[10px] font-semibold ${profileCompletion.colorClass} hover:underline`}>
                            {profileCompletion.label}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[240px] text-[11px]">
                          {profileCompletion.missingFields.length === 0 && !profileCompletion.missingContract ? (
                            <p>All required fields are completed.</p>
                          ) : (
                            <div className="space-y-2">
                              {(profileCompletion.missingFields.length > 0 || profileCompletion.missingContract) && (
                                <div className="space-y-1">
                                  <p className="font-semibold text-blue-600">Incomplete fields:</p>
                                  <ul className="list-disc pl-4 text-slate-700">
                                    {profileCompletion.missingFields.map((field) => (
                                      <li key={field}>{field}</li>
                                    ))}
                                    {profileCompletion.missingContract && <li>Employment contract</li>}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              )}

              <div className="px-5 pb-4 pt-6">

              <div className="space-y-1">
                <div className="flex items-baseline gap-3.5">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {(selectedEmployee.employee_name ?? "").trim()} {(selectedEmployee.employee_surname ?? "").trim()}
                  </h3>
                  {employeeStatus !== "Inactive" && (
                    <span className="text-[10px] text-slate-400">{profileForm.employeeNumber || ""}</span>
                  )}
                </div>
                <span className="inline-flex rounded-full bg-blue-100/70 px-2 py-0.5 text-[10px] font-normal text-blue-700">
                  {employeeStatus === "Inactive"
                    ? (selectedEmployee?.termination_reason ?? "").toString().trim() || "Termination reason not set"
                    : profileForm.jobTitle?.trim() || "Job title not set"}
                </span>
              </div>

              <div className="mt-6 space-y-4">
                <h4 className="text-xs font-semibold tracking-wide text-slate-900">Basic Information</h4>
                <div className="space-y-2.5 text-xs text-slate-700">
                  <div className="flex items-center gap-4">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100/60">
                      <Mail className="h-3.5 w-3.5 text-slate-900" strokeWidth={1.5} />
                    </span>
                    <div>
                      <p className="text-[10px] text-slate-400">Email</p>
                      <p className="text-[11px] font-semibold text-slate-800">{profileForm.email?.trim() || "--"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100/60">
                      <Phone className="h-3.5 w-3.5 text-slate-900" strokeWidth={1.5} />
                    </span>
                    <div>
                      <p className="text-[10px] text-slate-400">Cell Number</p>
                      <p className="text-[11px] font-semibold text-slate-800">{profileForm.cellNumber?.trim() || "--"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100/60">
                      <Flag className="h-3.5 w-3.5 text-slate-900" strokeWidth={1.5} />
                    </span>
                    <div>
                      <p className="text-[10px] text-slate-400">Nationality</p>
                      <p className="text-[11px] font-semibold text-slate-800">{profileForm.nationality || "--"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100/60">
                      <UserCircle2 className="h-3.5 w-3.5 text-slate-900" strokeWidth={1.5} />
                    </span>
                    <div>
                      <p className="text-[10px] text-slate-400">Gender</p>
                      <p className="text-[11px] font-semibold text-slate-800">{profileForm.gender || "--"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100/60">
                      <Calendar className="h-3.5 w-3.5 text-slate-900" strokeWidth={1.5} />
                    </span>
                    <div>
                      <p className="text-[10px] text-slate-400">Age</p>
                      <p className="text-[11px] font-semibold text-slate-800">{getAgeFromIdNumber(profileForm.idNumber)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100/60">
                      <BadgeCheck className="h-3.5 w-3.5 text-slate-900" strokeWidth={1.5} />
                    </span>
                    <div>
                      <p className="text-[10px] text-slate-400">Status</p>
                      <p
                        className={`text-[11px] font-semibold ${
                          employeeStatus === "Inactive" ? "text-red-600" : "text-emerald-600"
                        }`}
                      >
                        {employeeStatus || "Active"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100/60">
                      <BriefcaseBusiness className="h-3.5 w-3.5 text-slate-900" strokeWidth={1.5} />
                    </span>
                    <div>
                      <p className="text-[10px] text-slate-400">Contract Type</p>
                      <p className="text-[11px] font-semibold text-slate-800">{profileForm.contractType || "--"}</p>
                    </div>
                  </div>
                  <div className="pt-3 flex justify-center">
                    {employeeStatus === "Inactive" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="group h-6 w-40 justify-center rounded-[3px] px-2 text-[11px] inline-flex items-center border-[0.5px] bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-600 hover:text-white hover:border-emerald-600"
                        onClick={() => {
                          if (selectedEmployee) {
                            handleStartRehire(selectedEmployee);
                          }
                        }}
                      >
                        <span className="truncate font-semibold group-hover:underline">Rehire</span>
                      </Button>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="group h-6 w-40 justify-center rounded-[3px] px-2 text-[11px] inline-flex items-center border-[0.5px] focus:border !ring-0 !ring-offset-0 focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 outline-none focus:outline-none focus-visible:outline-none data-[state=open]:!ring-0 data-[state=open]:!ring-offset-0 bg-red-600 text-white border-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 data-[state=open]:border-red-700 data-[state=open]:bg-red-600"
                          >
                            <span className="truncate font-semibold group-hover:underline">Terminate</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center" className="w-40 text-[11px] text-center">
                          {terminationReasons.map((reason) => (
                            <DropdownMenuItem
                              key={reason}
                              onClick={() => {
                                void handleTerminateWithReason(reason);
                              }}
                              className="justify-center gap-2 cursor-pointer text-[11px] text-slate-700 focus:bg-red-50/70 focus:text-red-600 data-[highlighted]:bg-red-50/70 data-[highlighted]:text-red-600 data-[state=checked]:text-slate-700 data-[state=checked]:data-[highlighted]:text-slate-700"
                            >
                              {reason}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </div>
            </div>
            </div>
          </aside>

          <div className="mt-0 flex h-full min-h-0 flex-col">
            <Tabs
              value={activeTab}
              onValueChange={(value) => {
                if (!guardEditSession()) return;
                setActiveTab(value as EmployeeTab);
              }}
              className="mt-0 flex h-full min-h-0 flex-1 flex-col"
            >
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
              <div className="relative">
              <TabsList className="h-8 w-full flex-wrap justify-start items-center gap-0 bg-transparent px-0 py-0 shadow-none">
                <TabsTrigger
                  value="personal"
                  className="rounded-t-sm border-b-[3px] border-transparent px-4 h-8 flex items-center text-left text-xs font-medium leading-none text-slate-500 data-[state=inactive]:hover:text-blue-600 data-[state=active]:bg-blue-600 data-[state=active]:border-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
                  onPointerDown={(event) => {
                    guardEditSession(event);
                  }}
                >
                  Personal
                </TabsTrigger>
                <TabsTrigger
                  value="employment"
                  className="rounded-t-sm border-b-[3px] border-transparent px-4 h-8 flex items-center text-left text-xs font-medium leading-none text-slate-500 data-[state=inactive]:hover:text-blue-600 data-[state=active]:bg-blue-600 data-[state=active]:border-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
                  onPointerDown={(event) => {
                    guardEditSession(event);
                  }}
                >
                  Employment
                </TabsTrigger>
                <TabsTrigger
                  value="address"
                  className="rounded-t-sm border-b-[3px] border-transparent px-4 h-8 flex items-center text-left text-xs font-medium leading-none text-slate-500 data-[state=inactive]:hover:text-blue-600 data-[state=active]:bg-blue-600 data-[state=active]:border-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
                  onPointerDown={(event) => {
                    guardEditSession(event);
                  }}
                >
                  Address
                </TabsTrigger>
                <TabsTrigger
                  value="discipline"
                  className="rounded-t-sm border-b-[3px] border-transparent px-4 h-8 flex items-center text-left text-xs font-medium leading-none text-slate-500 data-[state=inactive]:hover:text-blue-600 data-[state=active]:bg-blue-600 data-[state=active]:border-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
                  onPointerDown={(event) => {
                    guardEditSession(event);
                  }}
                >
                  Warnings
                </TabsTrigger>
                <DropdownMenu open={isLicencesTabMenuOpen} onOpenChange={setIsLicencesTabMenuOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      onPointerDown={(event) => {
                        guardEditSession(event);
                      }}
                      className={`rounded-t-sm border-b-[3px] px-3 h-8 inline-flex items-center justify-center text-center text-xs font-medium leading-none shadow-none !ring-0 !ring-offset-0 focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 ${
                        activeTab === "licences"
                          ? "bg-blue-600 border-transparent text-white hover:bg-blue-600 hover:text-white"
                          : isLicencesTabMenuOpen
                            ? "border-transparent bg-transparent text-blue-600 underline underline-offset-2 decoration-blue-600 hover:bg-transparent hover:text-blue-600"
                            : "border-transparent bg-transparent text-slate-500 hover:bg-transparent hover:text-blue-600"
                      }`}
                    >
                      <span>Licences</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="text-[11px]">
                    <DropdownMenuItem
                      className={employeeDropdownMenuItemClass}
                      onSelect={(event) => {
                        if (!guardEditSession(event)) return;
                        setActiveTab("licences");
                        setLicencesViewFilter("driving");
                        setIsLicencesTabMenuOpen(false);
                      }}
                    >
                      Driving Licence(s)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className={employeeDropdownMenuItemClass}
                      onSelect={(event) => {
                        if (!guardEditSession(event)) return;
                        setActiveTab("licences");
                        setLicencesViewFilter("firearmSecurity");
                        setIsLicencesTabMenuOpen(false);
                      }}
                    >
                      Firearm & Security
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className={employeeDropdownMenuItemClass}
                      onSelect={(event) => {
                        if (!guardEditSession(event)) return;
                        setActiveTab("licences");
                        setLicencesViewFilter("marineAviation");
                        setIsLicencesTabMenuOpen(false);
                      }}
                    >
                      Marine & Aviation
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu open={isEducationTabMenuOpen} onOpenChange={setIsEducationTabMenuOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      onPointerDown={(event) => {
                        guardEditSession(event);
                      }}
                      className={`rounded-t-sm border-b-[3px] px-3 h-8 inline-flex items-center justify-center text-center text-xs font-medium leading-none shadow-none !ring-0 !ring-offset-0 focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 ${
                        activeTab === "education"
                          ? "bg-blue-600 border-transparent text-white hover:bg-blue-600 hover:text-white"
                          : isEducationTabMenuOpen
                            ? "border-transparent bg-transparent text-blue-600 underline underline-offset-2 decoration-blue-600 hover:bg-transparent hover:text-blue-600"
                            : "border-transparent bg-transparent text-slate-500 hover:bg-transparent hover:text-blue-600"
                      }`}
                    >
                      <span>Education</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="text-[11px]">
                    <DropdownMenuItem
                      className={employeeDropdownMenuItemClass}
                      onSelect={(event) => {
                        if (!guardEditSession(event)) return;
                        setActiveTab("education");
                        setEducationViewFilter("academic");
                        setIsEducationTabMenuOpen(false);
                      }}
                    >
                      Academic Qualifications
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className={employeeDropdownMenuItemClass}
                      onSelect={(event) => {
                        if (!guardEditSession(event)) return;
                        setActiveTab("education");
                        setEducationViewFilter("trade");
                        setIsEducationTabMenuOpen(false);
                      }}
                    >
                      Trade Qualifications
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className={employeeDropdownMenuItemClass}
                      onSelect={(event) => {
                        if (!guardEditSession(event)) return;
                        setActiveTab("education");
                        setEducationViewFilter("training");
                        setIsEducationTabMenuOpen(false);
                      }}
                    >
                      Training Certificates
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TabsList>
              </div>
              <div className="flex min-h-0 flex-1 flex-col px-0">
                <TabsContent value="personal" className="mt-0 pb-0 flex-1 min-h-0">
                  <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto p-0 pr-2">
                    {renderPersonalTab()}
                  </div>
                </TabsContent>
                <TabsContent value="employment" className="mt-0 pb-0 flex-1 min-h-0">
                  <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto p-0 pr-2">
                    {renderEmploymentTab()}
                  </div>
                </TabsContent>
                <TabsContent value="address" className="mt-0 pb-0 flex-1 min-h-0">
                  <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto p-0 pr-2">
                    {renderAddressTab()}
                  </div>
                </TabsContent>
                <TabsContent value="licences" className="mt-0 pb-0 flex-1 min-h-0">
                  <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto p-0 pr-2">
                    {renderLicencesTab()}
                  </div>
                </TabsContent>
                <TabsContent value="education" className="mt-0 pb-0 flex-1 min-h-0">
                  <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto p-0 pr-2">
                    {renderEducationTab()}
                  </div>
                </TabsContent>
                <TabsContent value="discipline" className="mt-0 pb-0 flex-1 min-h-0">
                  <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto p-0 pr-2">
                    <div className="rounded-sm border border-slate-300 bg-white px-5 pb-5 pt-[9px]">
                      {renderDisciplineTab()}
                    </div>
                  </div>
                </TabsContent>
              </div>
            </div>
            </Tabs>
          </div>
        </div>

          <div className="mt-auto flex items-center justify-center gap-3 pt-4"></div>
        </div>
      </div>
    );
  };

  const fetchEmployees = useCallback(async () => {
    if (!user) return;
    const from = (currentPage - 1) * DEFAULT_PAGE_SIZE;
    const to = from + DEFAULT_PAGE_SIZE;
    const queryText = searchQuery.trim();
    const runEmployeesQuery = async (selectColumns: string) => {
      let query = (supabase as any)
        .from("employees")
        .select(selectColumns)
        .eq("company_id", user.id);

      if (contractFilter !== "all") {
        query = query.ilike("contract_type", contractFilter);
      }
      if (employeeStatusFilter === "inactive") {
        query = query.eq("status", "inactive");
      }

      if (queryText.length > 0) {
        const escaped = queryText.replace(/%/g, "\\%").replace(/_/g, "\\_");
        query = query.or(
          `employee_name.ilike.%${escaped}%,employee_surname.ilike.%${escaped}%,id_number.ilike.%${escaped}%,employee_number.ilike.%${escaped}%,job_title.ilike.%${escaped}%,branch.ilike.%${escaped}%`,
        );
      }

      return await query
        .order("employee_name", { ascending: true, nullsFirst: false })
        .order("employee_surname", { ascending: true, nullsFirst: false })
        .range(from, to);
    };

    let { data, error } = await runEmployeesQuery(employeeSelectColumnsWithTermination);
    if (error) {
      const message = (error as { message?: string } | null)?.message ?? "";
      const isTerminationColumnMissing =
        message.includes("termination_reason") ||
        message.includes("previous_job_title") ||
        message.includes("terminated_at");
      if (isTerminationColumnMissing) {
        ({ data, error } = await runEmployeesQuery(employeeSelectColumnsBase));
      }
    }

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    const rows = Array.isArray(data) ? data : [];
    const hasExtraRow = rows.length > DEFAULT_PAGE_SIZE;
    const pageRows = hasExtraRow ? rows.slice(0, DEFAULT_PAGE_SIZE) : rows;
    setHasNextPage(hasExtraRow);

    if (pageRows.length === 0 && currentPage > 1) {
      setCurrentPage((prev) => Math.max(1, prev - 1));
      return;
    }

    const sorted = pageRows.sort((a, b) => {
      const nameA = `${a.employee_name ?? ""} ${a.employee_surname ?? ""}`.trim().toLowerCase();
      const nameB = `${b.employee_name ?? ""} ${b.employee_surname ?? ""}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });

    setEmployees(sorted);
    setFilteredEmployees(sorted);
    void fetchActiveContractsForEmployees(sorted.map((employee) => employee.id));
  }, [toast, user, currentPage, fetchActiveContractsForEmployees, searchQuery, employeeStatusFilter, contractFilter]);

  const fetchAllEmployees = useCallback(async () => {
    if (!user) return;
    setIsAllEmployeesLoading(true);
    const runAllEmployeesQuery = async (selectColumns: string) =>
      await (supabase as any)
        .from("employees")
        .select(selectColumns)
        .eq("company_id", user.id)
        .order("employee_name", { ascending: true, nullsFirst: false })
        .order("employee_surname", { ascending: true, nullsFirst: false });

    let { data, error } = await runAllEmployeesQuery(employeeSelectColumnsWithTermination);
    if (error) {
      const message = (error as { message?: string } | null)?.message ?? "";
      const isTerminationColumnMissing =
        message.includes("termination_reason") ||
        message.includes("previous_job_title") ||
        message.includes("terminated_at");
      if (isTerminationColumnMissing) {
        ({ data, error } = await runAllEmployeesQuery(employeeSelectColumnsBase));
      }
    }

    if (error) {
      setIsAllEmployeesLoading(false);
      return;
    }
    setAllEmployees(Array.isArray(data) ? data : []);
    setIsAllEmployeesLoading(false);
  }, [user]);

  const fetchConductOffences = useCallback(async () => {
    if (!user) return;
    const { data, error } = await (supabase as any)
      .from("company_code_of_conduct")
      .select("data")
      .eq("company_id", user.id)
      .maybeSingle();
    if (error) {
      return;
    }

    const raw = (data?.data as any) ?? null;
    const sections = Array.isArray(raw?.sections)
      ? (raw.sections as OffenceSection[])
      : Array.isArray(raw)
        ? (raw as OffenceSection[])
        : [];

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
        (item): item is ConductOffence =>
          Boolean(item?.name),
      );

    if (mapped.length > 0) {
      setConductOffences(mapped);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadEmployees = async () => {
      setIsEmployeesLoading(true);
      await fetchEmployees();
      if (!cancelled) setIsEmployeesLoading(false);
    };

    void loadEmployees();
    return () => {
      cancelled = true;
    };
  }, [user, fetchEmployees]);

  useEffect(() => {
    if (!user || !isProfilePanelOpen || hasLoadedAllEmployees) return;
    let cancelled = false;
    const loadAllEmployees = async () => {
      await fetchAllEmployees();
      if (!cancelled) setHasLoadedAllEmployees(true);
    };
    void loadAllEmployees();
    return () => {
      cancelled = true;
    };
  }, [user, isProfilePanelOpen, hasLoadedAllEmployees, fetchAllEmployees]);

  useEffect(() => {
    if (!user || !isProfilePanelOpen || activeTab !== "discipline" || hasLoadedConductOffences) return;
    let cancelled = false;
    const loadConductOffences = async () => {
      await fetchConductOffences();
      if (!cancelled) setHasLoadedConductOffences(true);
    };
    void loadConductOffences();
    return () => {
      cancelled = true;
    };
  }, [user, isProfilePanelOpen, activeTab, hasLoadedConductOffences, fetchConductOffences]);

  useEffect(() => {
    setCurrentPage(1);
    setHasNextPage(false);
    setHasLoadedAllEmployees(false);
    setHasLoadedConductOffences(false);
    setAllEmployees([]);
    setConductOffences([]);
  }, [user?.id]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, employeeStatusFilter, contractFilter, genderFilter, raceFilter, nationalityFilter]);

  useEffect(() => {
    const query = searchQuery.toLowerCase();
    const filtered = employees.filter((emp) => {
      const fullName = `${emp.employee_name ?? ""} ${emp.employee_surname ?? ""}`.trim().toLowerCase();
      const idNumber = (emp.id_number ?? "").toLowerCase();
      const employeeNumber = (emp.employee_number ?? "").toLowerCase();
      const jobTitle = (emp.job_title ?? "").toLowerCase();
      const branchValue = (emp.branch ?? "").toLowerCase();
      const matchesSearch =
        fullName.includes(query) ||
        idNumber.includes(query) ||
        employeeNumber.includes(query) ||
        jobTitle.includes(query) ||
        branchValue.includes(query);

      const contractType = (emp.contract_type ?? "").toLowerCase();
      const matchesContract =
        contractFilter === "all" ||
        (contractFilter === "permanent" && contractType === "permanent") ||
        (contractFilter === "temporary" && contractType === "temporary");
      const statusValue = ((emp.status ?? "").toString().trim().toLowerCase() || "active");
      const matchesStatus =
        employeeStatusFilter === "inactive" ? statusValue === "inactive" : statusValue !== "inactive";

      const genderValue = (emp.gender ?? "").toLowerCase();
      const raceValue = (emp.race ?? "").toLowerCase();
      const nationalityValue = (emp.nationality ?? "").trim().toLowerCase();
      const nationalityGroup = nationalityValue === "south african" ? "rsa" : "other";
      const matchesGender = genderFilter === "all" || genderValue === genderFilter.toLowerCase();
      const matchesRace = raceFilter === "all" || raceValue === raceFilter.toLowerCase();
      const matchesNationality =
        nationalityFilter === "all" || nationalityGroup === nationalityFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesContract && matchesGender && matchesRace && matchesNationality;
    });

    const sorted = filtered.sort((a, b) => {
      const nameA = `${a.employee_name ?? ""} ${a.employee_surname ?? ""}`.trim().toLowerCase();
      const nameB = `${b.employee_name ?? ""} ${b.employee_surname ?? ""}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });

    setFilteredEmployees(sorted);
  }, [employees, searchQuery, employeeStatusFilter, contractFilter, genderFilter, raceFilter, nationalityFilter]);

  useEffect(() => {
    // Keep selections in sync with the currently filtered list to avoid deleting hidden rows.
    setSelectedEmployees((prev) => {
      if (prev.size === 0) return prev;
      const allowedIds = new Set(filteredEmployees.map((emp) => emp.id));
      const next = new Set(Array.from(prev).filter((id) => allowedIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filteredEmployees]);

  const handleCustomEmployeeNumberChange = (value: string) => {
    const cleaned = cleanEmployeeNumberInput(value);
    setProfileForm((prev) => ({
      ...prev,
      employeeNumber: cleaned,
    }));
  };

  const handleUndoDelete = async () => {
    if (!deleteUndo) return;
    try {
      const payload = deleteUndo.deletedEmployees.map((employee) => ({
        ...employee,
        created_at: employee.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from("employees").upsert(payload, { onConflict: "id" });
      if (error) throw error;

      toast({
        title: "Employees restored",
        description: `${deleteUndo.deletedEmployees.length} employee(s) were restored.`,
      });
      clearDeleteUndoState();
      await fetchEmployees();
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to undo deletion",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    }
  };

   const handleAddEmployee = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!user) return;
     if (addFormStep < 3) {
       setIsAddFormSubmitRequested(false);
       handleAddFormNext();
       return;
     }
     if (!isAddFormSubmitRequested) return;
     setIsAddFormSubmitRequested(false);
     if (!isAddFormStepOneComplete || !isAddFormStepTwoComplete || !isAddFormStepThreeComplete) return;
     setIsLoading(true);
    try {
      const validatedBasic = employeeBasicSchema.parse({
        employeeName: addForm.employeeName,
        employeeSurname: addForm.employeeSurname,
        idNumber: addForm.idNumber,
        employeeNumber: addForm.employeeNumber,
      });
      const validatedProfile = employeeProfileSchema.parse({
        employeeName: addForm.employeeName,
        employeeSurname: addForm.employeeSurname,
        idNumber: addForm.idNumber,
        dateOfBirth: "",
        startDate: addForm.startDate,
        contractType: addForm.contractType,
        endDate: addForm.contractType === "Temporary" ? addForm.endDate : "",
        gender: addForm.gender,
        disabilityStatus: false,
        citizenshipStatus: "",
        race: addForm.race,
        nationality: addForm.idType === "id" ? "South African" : "Other",
        employeeNumber: addForm.employeeNumber,
        jobTitle: addForm.jobTitle,
        physicalAddressLine1: addForm.physicalAddressLine1,
        physicalAddressLine2: addForm.physicalAddressLine2,
        city: addForm.city,
        province: addForm.province,
        areaCode: addForm.areaCode,
        postalAddressLine1: addForm.postalAddressLine1,
        postalAddressLine2: addForm.postalAddressLine2,
        postalCity: addForm.postalCity,
        postalProvince: addForm.postalProvince,
        postalAreaCode: addForm.postalAreaCode,
        cellNumber: addForm.cellNumber,
        email: addForm.email,
        emergencyContactName: "",
        emergencyContactNumber: "",
        incomeTaxNumber: "",
        uifNumber: "",
      });
      const normalizedNumber = normalizeEmployeeNumber(validatedBasic.employeeNumber);
      const duplicate = normalizedNumber
        ? employees.find(
            (emp) =>
              normalizeEmployeeNumber(emp.employee_number) === normalizedNumber &&
              (!rehireEmployeeId || emp.id !== rehireEmployeeId),
          )
        : undefined;
      if (duplicate) {
        toast({
          title: "Duplicate employee number",
          description: `You already allocated that employee number to ${duplicate.employee_name ?? "Employee"} ${duplicate.employee_surname ?? ""}. Please choose a different employee number.`,
          variant: "destructive",
        });
        return;
      }
      const endDateValue =
        validatedProfile.contractType === "Temporary" && validatedProfile.endDate
          ? validatedProfile.endDate
          : null;
      const addPayload: EmployeeInsert = {
        company_id: user.id,
        employee_name: validatedBasic.employeeName,
        employee_surname: validatedBasic.employeeSurname,
        id_number: validatedBasic.idNumber || null,
        employee_number: validatedBasic.employeeNumber || null,
        job_title: validatedProfile.jobTitle || null,
        contract_type: validatedProfile.contractType || null,
        start_date: validatedProfile.startDate || null,
        end_date: endDateValue,
        nationality: validatedProfile.nationality || null,
        gender: validatedProfile.gender || null,
        race: validatedProfile.race || null,
        cell_number: validatedProfile.cellNumber || null,
        email: validatedProfile.email || null,
        salary_type: addForm.salaryType || null,
        basic_salary: addForm.basicSalary.trim() || null,
        physical_address_line1: validatedProfile.physicalAddressLine1 || null,
        physical_address_line2: validatedProfile.physicalAddressLine2 || null,
        city: validatedProfile.city || null,
        province: validatedProfile.province || null,
        area_code: validatedProfile.areaCode || null,
        postal_address_line1: validatedProfile.postalAddressLine1 || null,
        postal_address_line2: validatedProfile.postalAddressLine2 || null,
        postal_city: validatedProfile.postalCity || null,
        postal_province: validatedProfile.postalProvince || null,
        postal_area_code: validatedProfile.postalAreaCode || null,
      };
      if (rehireEmployeeId) {
        const rehirePayload: EmployeeUpdate = {
          ...addPayload,
          status: "active",
          termination_reason: null,
          previous_job_title: null,
          terminated_at: null,
        };
        const { error } = await supabase
          .from("employees")
          .update(rehirePayload as unknown as TablesInsert<"employees">)
          .eq("id", rehireEmployeeId)
          .eq("company_id", user.id);
        if (error) throw error;

        const { data: existingTerminationDocs } = await terminationDocumentTable()
          .select("id, file_url")
          .eq("company_id", user.id)
          .eq("employee_id", rehireEmployeeId);
        if ((existingTerminationDocs ?? []).length > 0) {
          await terminationDocumentTable()
            .delete()
            .eq("company_id", user.id)
            .eq("employee_id", rehireEmployeeId);
          const storagePaths = (existingTerminationDocs as Array<{ file_url?: string | null }>)
            .map((row) => getContractStoragePathFromUrl(row.file_url))
            .filter((path): path is string => !!path);
          if (storagePaths.length > 0) {
            await supabase.storage.from("contracts").remove(storagePaths);
          }
          setTerminationDocumentByEmployee((prev) => ({
            ...prev,
            [rehireEmployeeId]: null,
          }));
        }

        toast({
          title: "Success",
          description: "Employee rehired successfully!",
        });
      } else {
        const { error } = await supabase
          .from("employees")
          .insert(addPayload as TablesInsert<"employees">);
        if (error) throw error;

        toast({
          title: "Success",
          description: "Employee added successfully!",
        });
      }
      setAddForm(createBlankAddForm());
      setAddFormStep(1);
      setRehireEmployeeId(null);
      setIsAddFormSubmitRequested(false);
      setIsAddDialogOpen(false);
      await fetchEmployees();
      if (selectedEmployee && rehireEmployeeId && selectedEmployee.id === rehireEmployeeId) {
        setSelectedEmployee((prev) =>
          prev
            ? ({
                ...prev,
                ...addPayload,
                status: "active",
                termination_reason: null,
                previous_job_title: null,
                terminated_at: null,
              } as Employee)
            : prev,
        );
        setEmployeeStatus("Active");
      }
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getSafeErrorMessage(error),
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
       const finalEmployeeNumber = validated.employeeNumber || null;
       const normalizedNumber = normalizeEmployeeNumber(finalEmployeeNumber);
       const duplicate = normalizedNumber
         ? employees.find(
             (emp) =>
               emp.id !== selectedEmployee.id &&
               normalizeEmployeeNumber(emp.employee_number) === normalizedNumber,
           )
         : undefined;
       if (duplicate) {
         toast({
           title: "Duplicate employee number",
           description: `You already allocated that employee number to ${duplicate.employee_name ?? "Employee"} ${duplicate.employee_surname ?? ""}. Please choose a different employee number.`,
           variant: "destructive",
         });
         setIsProfileSaving(false);
         return;
       }

        const updatePayload: EmployeeUpdate = {
          employee_name: validated.employeeName,
          employee_surname: validated.employeeSurname,
          id_number: validated.idNumber || null,
          start_date: validated.startDate,
          contract_type: validated.contractType,
          end_date: endDateValue,
          nationality: validated.nationality,
          gender: validated.gender,
          race: validated.race,
          employee_number: finalEmployeeNumber,
          job_title: validated.jobTitle || null,
          physical_address_line1: validated.physicalAddressLine1 || null,
          physical_address_line2: validated.physicalAddressLine2 || null,
          city: validated.city || null,
          province: validated.province,
          area_code: validated.areaCode || null,
          postal_address_line1: validated.postalAddressLine1 || null,
          postal_address_line2: validated.postalAddressLine2 || null,
          postal_city: validated.postalCity || null,
          postal_province: validated.postalProvince || null,
          postal_area_code: validated.postalAreaCode || null,
          cell_number: validated.cellNumber || null,
          email: validated.email || null,
          emergency_contact_name: validated.emergencyContactName || null,
        emergency_contact_number: validated.emergencyContactNumber || null,
      };

       const { error } = await supabase
         .from("employees")
         .update(updatePayload as unknown as TablesInsert<"employees">)
         .eq("id", selectedEmployee.id);

       if (error) throw error;

      toast({
        title: "Employee updated",
        description: "Employee profile has been saved successfully.",
      });

      const updatedEmployee: Employee = {
        ...selectedEmployee,
        employee_name: validated.employeeName,
        employee_surname: validated.employeeSurname,
        id_number: validated.idNumber || null,
        start_date: validated.startDate || null,
        contract_type: validated.contractType,
        end_date: endDateValue,
        nationality: validated.nationality,
        employee_number: finalEmployeeNumber,
        job_title: validated.jobTitle || null,
        physical_address_line1: validated.physicalAddressLine1 || null,
        physical_address_line2: validated.physicalAddressLine2 || null,
        city: validated.city || null,
        province: validated.province,
        area_code: validated.areaCode || null,
        postal_address_line1: validated.postalAddressLine1 || null,
        postal_address_line2: validated.postalAddressLine2 || null,
        postal_city: validated.postalCity || null,
        postal_province: validated.postalProvince || null,
        postal_area_code: validated.postalAreaCode || null,
        cell_number: validated.cellNumber || null,
        email: validated.email || null,
        emergency_contact_name: validated.emergencyContactName || null,
        emergency_contact_number: validated.emergencyContactNumber || null,
      };

      setSelectedEmployee(updatedEmployee);
      setProfileForm(createProfileFormFromEmployee(updatedEmployee));
      setIsEditMode(false);
      await fetchEmployees();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getSafeErrorMessage(error),
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

    const deletedEmployees = employees.filter((emp) => selectedEmployees.has(emp.id));
    if (deletedEmployees.length === 0) {
      toast({
        title: "No matching employees",
        description: "Could not find the selected employees to delete.",
        variant: "destructive",
      });
      return;
    }

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

    setDeleteUndo({
      deletedEmployees,
      expiresAt: Date.now() + 20_000,
    });
    setSelectedEmployees(new Set());
    await fetchEmployees();
  };

  const handleTerminateEmployee = async (employee: Employee) => {
    if (!user) return;
    const fullName = `${(employee.employee_name ?? "").trim()} ${(employee.employee_surname ?? "").trim()}`.trim();
    const confirmed = confirm(`Are you sure you want to terminate ${fullName || "this employee"}?`);
    if (!confirmed) return;

    const { error } = await supabase.from("employees").delete().eq("id", employee.id);
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Employee terminated",
      description: `${fullName || "Employee"} deleted successfully.`,
    });

    setDeleteUndo({
      deletedEmployees: [employee],
      expiresAt: Date.now() + 20_000,
    });
    setSelectedEmployees((prev) => {
      if (!prev.has(employee.id)) return prev;
      const next = new Set(prev);
      next.delete(employee.id);
      return next;
    });
    if (selectedEmployee?.id === employee.id) {
      setSelectedEmployee(null);
      setIsProfilePanelOpen(false);
    }
    await fetchEmployees();
  };

  const handleStartRehire = (employee: Employee) => {
    setIsEditMode(false);
    setActiveEditSection(null);
    setRehireEmployeeId(employee.id);
    setAddForm(createAddFormFromEmployee(employee));
    setAddFormStep(1);
    setIsAddFormSubmitRequested(false);
    setIsAddDialogOpen(true);
  };

  const handleBulkDialogChange = (open: boolean) => {
    setIsBulkDialogOpen(open);
    if (!open && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAddDialogChange = (open: boolean) => {
    setIsAddDialogOpen(open);
    if (!open) {
      setIsNewEmployeeMenuOpen(false);
      setAddForm(createBlankAddForm());
      setAddFormStep(1);
      setRehireEmployeeId(null);
      setIsAddFormSubmitRequested(false);
      requestAnimationFrame(() => {
        (document.activeElement as HTMLElement | null)?.blur?.();
        newEmployeeMenuTriggerRef.current?.blur();
      });
    }
  };

  const canAccessAddFormStep = (step: 1 | 2 | 3) => {
    if (step === 1) return true;
    if (step === 2) return isAddFormStepOneComplete;
    return isAddFormStepOneComplete && isAddFormStepTwoComplete;
  };

  const goToAddFormStep = (step: 1 | 2 | 3) => {
    if (canAccessAddFormStep(step)) {
      setAddFormStep(step);
      setIsAddFormSubmitRequested(false);
    }
  };

  const handleAddFormNext = () => {
    if (addFormStep === 1 && isAddFormStepOneComplete) {
      setAddFormStep(2);
      setIsAddFormSubmitRequested(false);
      return;
    }
    if (addFormStep === 2 && isAddFormStepTwoComplete) {
      setAddFormStep(3);
      setIsAddFormSubmitRequested(false);
    }
  };

  const handleAddFormClearStep = () => {
    setAddForm((prev) => {
      if (addFormStep === 1) {
        return {
          ...prev,
          employeeName: "",
          employeeSurname: "",
          idType: "",
          idNumber: "",
          gender: "",
          race: "",
          cellNumber: "",
          email: "",
        };
      }
      if (addFormStep === 2) {
        return {
          ...prev,
          employeeNumber: "",
          jobTitle: "",
          contractType: "",
          startDate: "",
          endDate: "",
          salaryType: "",
          basicSalary: "",
        };
      }
      return {
        ...prev,
        physicalAddressLine1: "",
        physicalAddressLine2: "",
        city: "",
        province: "",
        areaCode: "",
        postalAddressLine1: "",
        postalAddressLine2: "",
        postalCity: "",
        postalProvince: "",
        postalAreaCode: "",
      };
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
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: "yyyy-mm-dd", defval: "" });

      const validatedEmployees: EmployeeInsert[] = [];
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

      const normalizeEnumValue = (value: string, options: readonly string[]) => {
        const trimmed = value.trim();
        if (!trimmed) return "";
        const match = options.find((option) => option.toLowerCase() === trimmed.toLowerCase());
        return match ?? trimmed;
      };

      const normalizeContractType = (value: string) => normalizeEnumValue(value, contractTypes);

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as Record<string, unknown>;
        const rowNumber = i + 2;
        try {
          const rawData = {
            employeeNumber: getColumnValue(row, "Employee Number", "employee_number"),
            employeeName: getColumnValue(row, "Name", "First Name", "employee_name"),
            employeeSurname: getColumnValue(row, "Surname", "Last Name", "employee_surname"),
            idNumber: getColumnValue(row, "ID Number", "ID", "id_number", "Id Number"),
            gender: normalizeEnumValue(getColumnValue(row, "Gender", "gender"), genderOptions),
            contractType: normalizeContractType(getColumnValue(row, "Contract Type", "contract_type")),
            nationality: normalizeEnumValue(getColumnValue(row, "Nationality", "nationality"), nationalityOptions),
            jobTitle: getColumnValue(row, "Job Title", "job_title"),
          };

          const validated = employeeImportSchema.parse(rawData);
          validatedEmployees.push({
            company_id: user.id,
            employee_name: validated.employeeName,
            employee_surname: validated.employeeSurname,
            id_number: validated.idNumber || null,
            employee_number: validated.employeeNumber || null,
            contract_type: validated.contractType || null,
            gender: validated.gender || null,
            nationality: validated.nationality || null,
            job_title: validated.jobTitle || null,
          });
        } catch (err: unknown) {
          errors.push(`Row ${rowNumber}: ${getSafeErrorMessage(err)}`);
        }
      }

      if (validatedEmployees.length === 0) {
        const firstError = errors[0] ?? "Each row needs at least a Name and Surname.";
        throw new Error(`No valid employee data found. ${firstError}`);
      }

      if (errors.length > 0) {
        toast({
          title: "Warning",
          description: `${errors.length} row(s) skipped due to validation errors. First error: ${errors[0]}`,
          variant: "destructive",
        });
       }

      const { error } = await supabase.from("employees").insert(validatedEmployees as TablesInsert<"employees">[]);
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
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
   };

  const downloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Employees");

    worksheet.columns = [
      { header: "Employee Number", key: "employeeNumber", width: 18 },
      { header: "Name", key: "employeeName", width: 18 },
      { header: "Surname", key: "employeeSurname", width: 18 },
      { header: "ID Number", key: "idNumber", width: 18 },
      { header: "Gender", key: "gender", width: 12 },
      { header: "Nationality", key: "nationality", width: 18 },
      { header: "Contract Type", key: "contractType", width: 16 },
      { header: "Job Title", key: "jobTitle", width: 20 },
    ];

    worksheet.addRow({
      employeeNumber: "A0001",
      employeeName: "John",
      employeeSurname: "Doe",
      idNumber: "9001015009087",
      gender: "Male",
      nationality: "South African",
      contractType: "Permanent",
      jobTitle: "Store Manager",
    });

    worksheet.addRow({
      employeeNumber: "B0002",
      employeeName: "Jane",
      employeeSurname: "Smith",
      idNumber: "8505125800082",
      gender: "Female",
      nationality: "Namibian",
      contractType: "Temporary",
      jobTitle: "",
    });

    worksheet.getColumn(4).numFmt = "0";

    const listSheet = workbook.addWorksheet("Lists");
    listSheet.getColumn(1).values = ["", ...genderOptions];
    listSheet.getColumn(2).values = ["", ...nationalityOptions];
    listSheet.state = "veryHidden";

    const validationStartRow = 2;
    const validationEndRow = 500;
    const genderFormula = `Lists!$A$2:$A$${genderOptions.length + 1}`;
    const nationalityFormula = `Lists!$B$2:$B$${nationalityOptions.length + 1}`;

    for (let row = validationStartRow; row <= validationEndRow; row++) {
      worksheet.getCell(row, 5).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [genderFormula],
      };
      worksheet.getCell(row, 6).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [nationalityFormula],
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "employee_upload_template.xlsx";
    link.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Template Downloaded",
      description: "Check your downloads folder for the Excel template.",
    });
  };

   const goToPreviousPage = () => {
     if (isFirstPage) return;
     setCurrentPage((prev) => Math.max(1, prev - 1));
   };

   const goToNextPage = () => {
     if (isLastPage) return;
     setCurrentPage((prev) => prev + 1);
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
    setProbationPeriod(employee.probation_period ?? "");
    setUnionMember((employee.union_member as (typeof unionMemberOptions)[number]) ?? "");
    setTradeUnion(employee.trade_union ?? "");
    setDepartment((employee.department as (typeof departmentOptions)[number]) ?? "");
    setBranch(employee.branch ?? "");
    setReportingTo(employee.reporting_to ?? "");
    setOccupationalLevel(
      (employee.occupational_level as (typeof occupationalLevelOptions)[number]) ?? "",
    );
    setSalaryType((employee.salary_type as (typeof salaryTypeOptions)[number]) ?? "");
    setBasicSalary(employee.basic_salary ?? "");
    setWorkEmail(employee.work_email ?? "");
    setWorkCellNumber(employee.work_cell_number ?? "");
    setPendingIdDocumentFile(null);
    setPendingIdDocumentName("");
    setIsIdDocumentMarkedForRemoval(false);
    setPendingEmploymentContractFile(null);
    setPendingEmploymentContractName("");
    setIsEmploymentContractMarkedForRemoval(false);
    setLicenceTypeSelection({
      driving: "",
      firearmSecurity: "",
      marineAviation: "",
    });
    setEducationTypeSelection({
      academic: "",
      trade: "",
      training: "",
    });
   setActiveTab("personal");
   setIsEditMode(false);
   setActiveEditSection(null);
   setIsProfilePanelOpen(true);
  };

  const closeProfileDialog = () => {
    if (!guardEditSession()) return;
    setIsProfilePanelOpen(false);
    setSelectedEmployee(null);
    setIsEditMode(false);
    setActiveEditSection(null);
    setProbationPeriod("");
    setUnionMember("");
    setTradeUnion("");
    setTradeUnionOpen(false);
    setTradeUnionQuery("");
    setDepartment("");
    setReportingTo("");
    setOccupationalLevel("");
    setSalaryType("");
    setBasicSalary("");
    setWorkEmail("");
    setWorkCellNumber("");
    setBranch("");
    setReportingToOpen(false);
    setReportingToQuery("");
    setPendingIdDocumentFile(null);
    setPendingIdDocumentName("");
    setIsIdDocumentMarkedForRemoval(false);
    setPendingEmploymentContractFile(null);
    setPendingEmploymentContractName("");
    setIsEmploymentContractMarkedForRemoval(false);
    setLicenceTypeSelection({
      driving: "",
      firearmSecurity: "",
      marineAviation: "",
    });
    setEducationTypeSelection({
      academic: "",
      trade: "",
      training: "",
    });
   };

  const handleSectionSave = async (section: ProfileSectionKey) => {
    if (!selectedEmployee) return;
    setIsProfileSaving(true);
    try {
      const shouldUploadIdDocument = section === "identity" && !!pendingIdDocumentFile;
      const shouldRemoveIdDocument =
        section === "identity" && isIdDocumentMarkedForRemoval && !!idDocumentByEmployee[selectedEmployee.id];
      const shouldUploadEmploymentContract = section === "employmentStatus" && !!pendingEmploymentContractFile;
      const shouldRemoveEmploymentContract =
        section === "employmentStatus" &&
        isEmploymentContractMarkedForRemoval &&
        !!activeContractForSelectedEmployee;
      const identityFieldKeys: Array<keyof EmployeeProfileFormData> = [
        "employeeName",
        "employeeSurname",
        "idNumber",
        "nationality",
        "dateOfBirth",
      ];
      const employmentStatusFieldKeys: Array<keyof EmployeeProfileFormData> = [
        "startDate",
        "contractType",
        "endDate",
        "employeeNumber",
      ];
      const hasIdentityFieldChanges =
        section === "identity" && !!originalProfile
          ? identityFieldKeys.some((key) => profileForm[key] !== originalProfile[key])
          : false;
      const hasEmploymentStatusFieldChanges =
        section === "employmentStatus" && !!originalProfile
          ? employmentStatusFieldKeys.some((key) => profileForm[key] !== originalProfile[key]) ||
            probationPeriod !== originalProbationPeriod
          : false;
      const isEmploymentSection =
        section === "employmentStatus" ||
        section === "employmentOrg" ||
        section === "employmentRemuneration" ||
        section === "employmentWorkContact" ||
        section === "employmentUnion";
      let validated: any = null;
      switch (section) {
        case "identity":
          validated = identitySectionSchema.parse(profileForm);
          break;
        case "equity":
          validated = equitySectionSchema.parse(profileForm);
          break;
        case "contact":
          validated = contactSectionSchema.parse(profileForm);
          break;
        case "statutory":
          validated = statutorySectionSchema.parse(profileForm);
          break;
        case "employmentStatus":
        case "employmentOrg":
        case "employmentRemuneration":
        case "employmentWorkContact":
        case "employmentUnion":
          validated = employmentSectionSchema.parse(profileForm);
          if (validated.contractType === "Temporary" && !validated.endDate) {
            throw new Error("End date is required for temporary contracts");
          }
          break;
        case "homeAddress":
          validated = homeAddressSectionSchema.parse(profileForm);
          break;
        case "postalAddress":
          validated = postalAddressSectionSchema.parse(profileForm);
          break;
        default:
          return;
      }

      if (section === "employmentUnion" && unionMember === "Yes" && tradeUnion.trim().length === 0) {
        toast({
          title: "Trade union required",
          description: "Select a trade union or enter a custom trade union when Union Member is set to Yes.",
          variant: "destructive",
        });
        setIsProfileSaving(false);
        return;
      }

      if (isEmploymentSection) {
        const finalEmployeeNumber = validated.employeeNumber || null;
        const normalizedNumber = normalizeEmployeeNumber(finalEmployeeNumber);
        const duplicate = normalizedNumber
          ? employees.find(
              (emp) =>
                emp.id !== selectedEmployee.id &&
                normalizeEmployeeNumber(emp.employee_number) === normalizedNumber,
            )
          : undefined;
        if (duplicate) {
          toast({
            title: "Duplicate employee number",
            description: `You already allocated that employee number to ${duplicate.employee_name ?? "Employee"} ${duplicate.employee_surname ?? ""}. Please choose a different employee number.`,
            variant: "destructive",
          });
          setIsProfileSaving(false);
          return;
        }
      }

      if (section === "identity" && !hasIdentityFieldChanges && (shouldUploadIdDocument || shouldRemoveIdDocument)) {
        if (shouldRemoveIdDocument) {
          await removeIdDocument(selectedEmployee.id);
        }
        if (shouldUploadIdDocument) {
          await uploadPendingIdDocument(selectedEmployee.id);
        }
        toast({
          title: "Employee updated",
          description: "Employee profile has been saved successfully.",
        });
        setIsEditMode(false);
        setActiveEditSection(null);
        return;
      }
      if (
        section === "employmentStatus" &&
        !hasEmploymentStatusFieldChanges &&
        (shouldUploadEmploymentContract || shouldRemoveEmploymentContract)
      ) {
        if (shouldRemoveEmploymentContract) {
          await removeActiveEmploymentContract(selectedEmployee.id);
        }
        if (shouldUploadEmploymentContract) {
          await uploadPendingEmploymentContract(selectedEmployee.id);
        }
        toast({
          title: "Employee updated",
          description: "Employee profile has been saved successfully.",
        });
        setIsEditMode(false);
        setActiveEditSection(null);
        return;
      }

      const endDateValue =
        isEmploymentSection && validated.contractType === "Temporary" && validated.endDate
          ? validated.endDate
          : isEmploymentSection
            ? null
            : undefined;

      const updatePayload: EmployeeUpdate =
        section === "identity"
          ? {
              employee_name: validated.employeeName,
              employee_surname: validated.employeeSurname,
              id_number: validated.idNumber || null,
              nationality: validated.nationality,
              date_of_birth: validated.dateOfBirth || null,
            }
          : section === "equity"
            ? {
                race: validated.race,
                gender: validated.gender,
                disability_status: validated.disabilityStatus ?? false,
                citizenship_status: validated.citizenshipStatus || null,
              }
            : section === "statutory"
              ? {
                  income_tax_number: validated.incomeTaxNumber || null,
                }
            : section === "contact"
              ? {
                  cell_number: validated.cellNumber || null,
                  email: validated.email || null,
                  emergency_contact_name: validated.emergencyContactName || null,
                  emergency_contact_number: validated.emergencyContactNumber || null,
                }
              : isEmploymentSection
                ? {
                    start_date: validated.startDate,
                    contract_type: validated.contractType,
                    end_date: endDateValue ?? null,
                    employee_number: validated.employeeNumber || null,
                    job_title: validated.jobTitle || null,
                    probation_period: probationPeriod || null,
                    union_member: unionMember || null,
                    trade_union: unionMember === "Yes" ? tradeUnion || null : null,
                    department: department || null,
                    branch: branch || null,
                    reporting_to: reportingTo || null,
                    occupational_level: occupationalLevel || null,
                    salary_type: salaryType || null,
                    basic_salary: basicSalary || null,
                    work_email: workEmail || null,
                    work_cell_number: workCellNumber || null,
                  }
                : section === "homeAddress"
                  ? {
                      physical_address_line1: validated.physicalAddressLine1 || null,
                      physical_address_line2: validated.physicalAddressLine2 || null,
                      city: validated.city || null,
                      province: validated.province || "",
                      area_code: validated.areaCode || null,
                    }
                  : {
                      postal_address_line1: validated.postalAddressLine1 || null,
                      postal_address_line2: validated.postalAddressLine2 || null,
                      postal_city: validated.postalCity || null,
                      postal_province: validated.postalProvince || null,
                      postal_area_code: validated.postalAreaCode || null,
                    };

      const { error } = await supabase
        .from("employees")
        .update(updatePayload as unknown as TablesInsert<"employees">)
        .eq("id", selectedEmployee.id);

      if (error) throw error;

      toast({
        title: "Employee updated",
        description: "Employee profile has been saved successfully.",
      });

      const updatedEmployee: Employee = {
        ...selectedEmployee,
        ...updatePayload,
      };

      setSelectedEmployee(updatedEmployee);
      setProfileForm(createProfileFormFromEmployee(updatedEmployee));
      setProbationPeriod(updatedEmployee.probation_period ?? "");
      setUnionMember((updatedEmployee.union_member as (typeof unionMemberOptions)[number]) ?? "");
      setTradeUnion(updatedEmployee.trade_union ?? "");
      setDepartment((updatedEmployee.department as (typeof departmentOptions)[number]) ?? "");
      setBranch(updatedEmployee.branch ?? "");
      setReportingTo(updatedEmployee.reporting_to ?? "");
      setOccupationalLevel(
        (updatedEmployee.occupational_level as (typeof occupationalLevelOptions)[number]) ?? "",
      );
      setSalaryType((updatedEmployee.salary_type as (typeof salaryTypeOptions)[number]) ?? "");
      setBasicSalary(updatedEmployee.basic_salary ?? "");
      setWorkEmail(updatedEmployee.work_email ?? "");
      setWorkCellNumber(updatedEmployee.work_cell_number ?? "");
      if (shouldRemoveIdDocument) {
        await removeIdDocument(selectedEmployee.id);
      }
      if (shouldUploadIdDocument) {
        await uploadPendingIdDocument(selectedEmployee.id);
      }
      if (shouldRemoveEmploymentContract) {
        await removeActiveEmploymentContract(selectedEmployee.id);
      }
      if (shouldUploadEmploymentContract) {
        await uploadPendingEmploymentContract(selectedEmployee.id);
      }
      if (isEmploymentSection) {
        setOriginalDepartment(department);
        setOriginalBranch(branch);
        setOriginalReportingTo(reportingTo);
        setOriginalOccupationalLevel(occupationalLevel);
        setOriginalSalaryType(salaryType);
        setOriginalBasicSalary(basicSalary);
        setOriginalWorkEmail(workEmail);
        setOriginalWorkCellNumber(workCellNumber);
      }
      setIsEditMode(false);
      setActiveEditSection(null);
      await fetchEmployees();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsProfileSaving(false);
    }
  };

  const handleSectionCancel = useCallback(() => {
    if (!selectedEmployee) return;
    setProfileForm(createProfileFormFromEmployee(selectedEmployee));
    setProbationPeriod(selectedEmployee.probation_period ?? "");
    setUnionMember((selectedEmployee.union_member as (typeof unionMemberOptions)[number]) ?? "");
    setTradeUnion(selectedEmployee.trade_union ?? "");
    setDepartment((selectedEmployee.department as (typeof departmentOptions)[number]) ?? "");
    setBranch(selectedEmployee.branch ?? "");
    setReportingTo(selectedEmployee.reporting_to ?? "");
    setOccupationalLevel(
      (selectedEmployee.occupational_level as (typeof occupationalLevelOptions)[number]) ?? "",
    );
    setSalaryType((selectedEmployee.salary_type as (typeof salaryTypeOptions)[number]) ?? "");
    setBasicSalary(selectedEmployee.basic_salary ?? "");
    setWorkEmail(selectedEmployee.work_email ?? "");
    setWorkCellNumber(selectedEmployee.work_cell_number ?? "");
    const nextStatus = ((selectedEmployee as any)?.status ?? "").toString().toLowerCase();
    if (nextStatus === "inactive") {
      setEmployeeStatus("Inactive");
    } else if (nextStatus === "active") {
      setEmployeeStatus("Active");
    } else {
      setEmployeeStatus("");
    }
    setPendingIdDocumentFile(null);
    setPendingIdDocumentName("");
    setIsIdDocumentMarkedForRemoval(false);
    setPendingEmploymentContractFile(null);
    setPendingEmploymentContractName("");
    setIsEmploymentContractMarkedForRemoval(false);
    setLicenceTypeSelection({
      driving: "",
      firearmSecurity: "",
      marineAviation: "",
    });
    setEducationTypeSelection({
      academic: "",
      trade: "",
      training: "",
    });
    setIsEditMode(false);
    setActiveEditSection(null);
  }, [selectedEmployee]);

  const enableEditMode = useCallback(() => {
    return;
  }, []);

  const openDatePicker = useCallback((input: HTMLInputElement | null) => {
    if (!input) return;
    if (typeof (input as HTMLInputElement & { showPicker?: () => void }).showPicker === "function") {
      (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
      return;
    }
    input.focus();
  }, []);

  const handleSelectPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!isEditMode) {
        event.preventDefault();
        return;
      }
    },
    [isEditMode],
  );

  const getSectionLockClass = useCallback(
    (section: ProfileSectionKey) =>
      isEditMode && activeEditSection && activeEditSection !== section ? "pointer-events-none" : "",
    [activeEditSection, isEditMode],
  );

  const renderPersonalTab = () => {
    const isDobReadOnly = !isEditMode || isSouthAfricanNationality;

    return (
      <div className="space-y-3">
        <div
          ref={(el) => {
            sectionRefs.current.identity = el;
          }}
          className={`rounded-sm border border-slate-300 bg-white px-5 pb-5 pt-[9px] ${getSectionLockClass("identity")}`}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Identity Information</h3>
            <div className="flex items-center gap-2">
              {isEditMode && activeEditSection === "identity" && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-6 px-2 text-[10px] font-semibold text-slate-500 hover:bg-transparent hover:text-slate-700"
                  onClick={handleSectionCancel}
                  disabled={isProfileSaving}
                >
                  Cancel
                </Button>
              )}
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:text-blue-600"
                onClick={(event) => {
                  if (isEditMode && activeEditSection === "identity" && !isProfileSaving) {
                    void handleSectionSave("identity");
                    return;
                  }
                  handleSectionInteract("identity", event);
                }}
                aria-label={
                  isEditMode && activeEditSection === "identity" ? "Save identity details" : "Edit identity details"
                }
              >
                {isEditMode && activeEditSection === "identity" ? (
                  <Save className="h-3.5 w-3.5" />
                ) : (
                  <Pencil className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-3">
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Name</Label>
              <Input
                className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
                placeholder="Please insert"
                value={profileForm.employeeName}
                readOnly={!isEditMode}
                onFocus={enableEditMode}
                onMouseDown={enableEditMode}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    employeeName: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Surname</Label>
              <Input
                className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
                placeholder="Please insert"
                value={profileForm.employeeSurname}
                readOnly={!isEditMode}
                onFocus={enableEditMode}
                onMouseDown={enableEditMode}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    employeeSurname: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>
                {isSouthAfricanNationality ? "ID Number" : "Passport Number"}
              </Label>
              <Input
                className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
                placeholder="Please insert"
                value={profileForm.idNumber}
                maxLength={isSouthAfricanNationality ? 13 : 30}
                readOnly={!isEditMode}
                onFocus={enableEditMode}
                onMouseDown={enableEditMode}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    idNumber: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Nationality</Label>
              <Popover
                open={nationalityOpen}
                onOpenChange={(open) => {
                  if (open && !isEditMode) {
                  return;
                }
                  setNationalityOpen(open);
                  if (open) {
                    setNationalityQuery("");
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className={employeeDropdownTriggerClass}
                    onPointerDown={(event) => {
                      if (!isEditMode) {
                        event.preventDefault();
                        return;
                      }
                    }}
                  >
                    <span className="truncate">{profileForm.nationality || "Select nationality"}</span>
                    <ChevronDown className="h-4 w-4 opacity-50" aria-hidden="true" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Type nationality..."
                      value={nationalityQuery}
                      onValueChange={setNationalityQuery}
                    />
                    <CommandList>
                      <CommandEmpty>No nationality found.</CommandEmpty>
                      <CommandGroup>
                        {nationalityOptions
                          .filter((option) =>
                            option.toLowerCase().includes(nationalityQuery.trim().toLowerCase()),
                          )
                          .map((option) => (
                            <CommandItem
                              key={option}
                              value={option}
                              className={employeeDropdownCommandItemClass}
                              onSelect={(value) => {
                                setProfileForm((prev) => ({
                                  ...prev,
                                  nationality: value,
                                }));
                                setNationalityOpen(false);
                              }}
                            >
                              <span>{option}</span>
                              {profileForm.nationality === option && (
                                <Check className="ml-auto h-3.5 w-3.5 text-blue-600" />
                              )}
                            </CommandItem>
                          ))}
                        {nationalityQuery.trim().length > 0 &&
                          !nationalityOptions.some(
                            (option) => option.toLowerCase() === nationalityQuery.trim().toLowerCase(),
                          ) && (
                            <CommandItem
                              value={nationalityQuery.trim()}
                              className={employeeDropdownCommandItemClass}
                              onSelect={(value) => {
                                setProfileForm((prev) => ({
                                  ...prev,
                                  nationality: value,
                                }));
                                setNationalityOpen(false);
                              }}
                            >
                              <span>Use "{nationalityQuery.trim()}"</span>
                              {profileForm.nationality === nationalityQuery.trim() && (
                                <Check className="ml-auto h-3.5 w-3.5 text-blue-600" />
                              )}
                            </CommandItem>
                          )}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center gap-3">
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>
                {isSouthAfricanNationality ? "Date of Birth (Auto)" : "Date of Birth"}
              </Label>
              <Input
                className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
                placeholder={isSouthAfricanNationality ? "Auto from ID" : "Please insert"}
                type="date"
                value={profileForm.dateOfBirth}
                readOnly={isDobReadOnly}
                onFocus={enableEditMode}
                onMouseDown={enableEditMode}
                ref={dateOfBirthInputRef}
                onClick={() => {
                  if (isDobReadOnly) return;
                  if (!isEditMode) {
                    return;
                  }
                  openDatePicker(dateOfBirthInputRef.current);
                }}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    dateOfBirth: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex items-center gap-3" style={{ marginTop: "13px" }}>
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Upload ID/Passport</Label>
              <div className="ml-auto flex w-full max-w-[320px] items-center justify-start gap-2">
                {isEditMode && !hasEffectiveIdDocument && (
                  <>
                    <input
                      ref={idPassportFileInputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={handleIdPassportFileChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 rounded border-slate-200 bg-white px-3 text-[11px] text-slate-600 hover:bg-white hover:border-blue-500 hover:text-blue-600"
                      onClick={() => idPassportFileInputRef.current?.click()}
                      disabled={isIdDocumentUploading}
                    >
                      <Upload className="mr-1 h-3 w-3" />
                      {isIdDocumentUploading ? "Uploading..." : "Upload"}
                    </Button>
                  </>
                )}
                {pendingIdDocumentName ? (
                  <span className="max-w-[180px] truncate text-[11px] font-semibold text-amber-700" title={pendingIdDocumentName}>
                    {pendingIdDocumentName}
                  </span>
                ) : hasEffectiveIdDocument && idDocumentForSelectedEmployee ? (
                  <button
                    type="button"
                    className="max-w-[180px] truncate text-[11px] font-semibold text-blue-600 hover:underline"
                    onClick={() => void handleOpenIdDocument(idDocumentForSelectedEmployee)}
                    title={idDocumentForSelectedEmployee.fileName}
                  >
                    {idDocumentForSelectedEmployee.fileName}
                  </button>
                ) : (
                  <span className="text-[11px] font-semibold text-slate-500">--</span>
                )}
                {isEditMode && hasEffectiveIdDocument && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-7 rounded px-3 text-[11px] text-slate-600 hover:bg-transparent hover:text-rose-600 hover:underline border-0 shadow-none"
                    onClick={handleMarkIdDocumentForRemoval}
                    disabled={isIdDocumentUploading}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div
          ref={(el) => {
            sectionRefs.current.equity = el;
          }}
          className={`rounded-sm border border-slate-300 bg-white px-5 pb-5 pt-[9px] ${getSectionLockClass("equity")}`}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Employment Equity Information</h3>
            <div className="flex items-center gap-2">
              {isEditMode && activeEditSection === "equity" && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-6 px-2 text-[10px] font-semibold text-slate-500 hover:bg-transparent hover:text-slate-700"
                  onClick={handleSectionCancel}
                  disabled={isProfileSaving}
                >
                  Cancel
                </Button>
              )}
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:text-blue-600"
                onClick={(event) => {
                  if (isEditMode && activeEditSection === "equity" && !isProfileSaving) {
                    void handleSectionSave("equity");
                    return;
                  }
                  handleSectionInteract("equity", event);
                }}
                aria-label={
                  isEditMode && activeEditSection === "equity"
                    ? "Save employment equity details"
                    : "Edit employment equity details"
                }
              >
                {isEditMode && activeEditSection === "equity" ? (
                  <Save className="h-3.5 w-3.5" />
                ) : (
                  <Pencil className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-3">
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Race</Label>
              <Popover
                open={raceOpen}
                onOpenChange={(open) => {
                  if (open && !isEditMode) {
                  return;
                }
                  setRaceOpen(open);
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className={employeeDropdownTriggerClass}
                    onPointerDown={(event) => {
                      if (!isEditMode) {
                        event.preventDefault();
                        return;
                      }
                    }}
                  >
                    <span className="truncate">{profileForm.race || "Select race"}</span>
                    <ChevronDown className="h-4 w-4 opacity-50" aria-hidden="true" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandList>
                      <CommandGroup>
                        {raceOptions.map((option) => (
                          <CommandItem
                            key={option}
                            value={option}
                            className={employeeDropdownCommandItemClass}
                            onSelect={(value) => {
                              setProfileForm((prev) => ({
                                ...prev,
                                race: value as EmployeeProfileFormData["race"],
                              }));
                              setRaceOpen(false);
                            }}
                          >
                            <span>{option}</span>
                            {profileForm.race === option && (
                              <Check className="ml-auto h-3.5 w-3.5 text-blue-600" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center gap-3">
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Gender</Label>
              <Popover
                open={genderOpen}
                onOpenChange={(open) => {
                  if (open && !isEditMode) {
                  return;
                }
                  setGenderOpen(open);
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className={employeeDropdownTriggerClass}
                    onPointerDown={(event) => {
                      if (!isEditMode) {
                        event.preventDefault();
                        return;
                      }
                    }}
                  >
                    <span className="truncate">{profileForm.gender || "Select gender"}</span>
                    <ChevronDown className="h-4 w-4 opacity-50" aria-hidden="true" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandList>
                      <CommandGroup>
                        {genderOptions.map((option) => (
                          <CommandItem
                            key={option}
                            value={option}
                            className={employeeDropdownCommandItemClass}
                            onSelect={(value) => {
                              setProfileForm((prev) => ({
                                ...prev,
                                gender: value as EmployeeProfileFormData["gender"],
                              }));
                              setGenderOpen(false);
                            }}
                          >
                            <span>{option}</span>
                            {profileForm.gender === option && (
                              <Check className="ml-auto h-3.5 w-3.5 text-blue-600" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center gap-3">
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Disability Status</Label>
              <div className="ml-auto flex w-full max-w-[320px] items-center gap-3">
                <Switch
                  className="data-[state=unchecked]:bg-blue-100 data-[state=checked]:bg-blue-500"
                  checked={!!profileForm.disabilityStatus}
                  disabled={!isEditMode}
                  onCheckedChange={(checked) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      disabilityStatus: checked,
                    }))
                  }
                />
                <span className="text-[11px] text-slate-700">
                  {profileForm.disabilityStatus ? "Yes" : "No"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Citizenship Status</Label>
              <Popover
                open={citizenshipOpen}
                onOpenChange={(open) => {
                  if (open && !isEditMode) {
                  return;
                }
                  setCitizenshipOpen(open);
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className={employeeDropdownTriggerClass}
                    onPointerDown={(event) => {
                      if (!isEditMode) {
                        event.preventDefault();
                        return;
                      }
                    }}
                  >
                    <span className="truncate">
                      {profileForm.citizenshipStatus || "Select status"}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" aria-hidden="true" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandList>
                      <CommandGroup>
                        {citizenshipStatusOptions.map((option) => (
                          <CommandItem
                            key={option}
                            value={option}
                            className={employeeDropdownCommandItemClass}
                            onSelect={(value) => {
                              setProfileForm((prev) => ({
                                ...prev,
                                citizenshipStatus: value,
                              }));
                              setCitizenshipOpen(false);
                            }}
                          >
                            <span>{option}</span>
                            {profileForm.citizenshipStatus === option && (
                              <Check className="ml-auto h-3.5 w-3.5 text-blue-600" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <div
          ref={(el) => {
            sectionRefs.current.contact = el;
          }}
          className={`rounded-sm border border-slate-300 bg-white px-5 pb-5 pt-[9px] ${getSectionLockClass("contact")}`}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Contact Information</h3>
            <div className="flex items-center gap-2">
              {isEditMode && activeEditSection === "contact" && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-6 px-2 text-[10px] font-semibold text-slate-500 hover:bg-transparent hover:text-slate-700"
                  onClick={handleSectionCancel}
                  disabled={isProfileSaving}
                >
                  Cancel
                </Button>
              )}
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:text-blue-600"
                onClick={(event) => {
                  if (isEditMode && activeEditSection === "contact" && !isProfileSaving) {
                    void handleSectionSave("contact");
                    return;
                  }
                  handleSectionInteract("contact", event);
                }}
                aria-label={
                  isEditMode && activeEditSection === "contact" ? "Save contact details" : "Edit contact details"
                }
              >
                {isEditMode && activeEditSection === "contact" ? (
                  <Save className="h-3.5 w-3.5" />
                ) : (
                  <Pencil className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-3">
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Cell Number</Label>
              <Input
                className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
                value={profileForm.cellNumber}
                placeholder="Please insert"
                readOnly={!isEditMode}
                onFocus={enableEditMode}
                onMouseDown={enableEditMode}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    cellNumber: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Email</Label>
              <Input
                className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
                type="email"
                value={profileForm.email}
                placeholder="Please insert"
                readOnly={!isEditMode}
                onFocus={enableEditMode}
                onMouseDown={enableEditMode}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Emergency Contact Name</Label>
              <Input
                className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
                placeholder="Please insert"
                value={profileForm.emergencyContactName}
                readOnly={!isEditMode}
                onFocus={enableEditMode}
                onMouseDown={enableEditMode}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    emergencyContactName: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Emergency Contact Number</Label>
              <Input
                className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
                placeholder="Please insert"
                value={profileForm.emergencyContactNumber}
                readOnly={!isEditMode}
                onFocus={enableEditMode}
                onMouseDown={enableEditMode}
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
        <div
          ref={(el) => {
            sectionRefs.current.statutory = el;
          }}
          className={`rounded-sm border border-slate-300 bg-white px-5 pb-5 pt-[9px] ${getSectionLockClass("statutory")}`}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Statutory Information</h3>
            <div className="flex items-center gap-2">
              {isEditMode && activeEditSection === "statutory" && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-6 px-2 text-[10px] font-semibold text-slate-500 hover:bg-transparent hover:text-slate-700"
                  onClick={handleSectionCancel}
                  disabled={isProfileSaving}
                >
                  Cancel
                </Button>
              )}
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:text-blue-600"
                onClick={(event) => {
                  if (isEditMode && activeEditSection === "statutory" && !isProfileSaving) {
                    void handleSectionSave("statutory");
                    return;
                  }
                  handleSectionInteract("statutory", event);
                }}
                aria-label={
                  isEditMode && activeEditSection === "statutory"
                    ? "Save statutory details"
                    : "Edit statutory details"
                }
              >
                {isEditMode && activeEditSection === "statutory" ? (
                  <Save className="h-3.5 w-3.5" />
                ) : (
                  <Pencil className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-3">
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Income Tax Number</Label>
              <Input
                className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
                placeholder="Please insert"
                value={profileForm.incomeTaxNumber}
                readOnly={!isEditMode}
                onFocus={enableEditMode}
                onMouseDown={enableEditMode}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    incomeTaxNumber: e.target.value,
                  }))
                }
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAddressTab = () => (
    <div className="space-y-3">
      <div
        ref={(el) => {
          sectionRefs.current.homeAddress = el;
        }}
        className={`rounded-sm border border-t-slate-300 border-r-slate-300 border-b-slate-300 border-l-slate-300 bg-white px-5 pb-5 pt-[9px] ${getSectionLockClass("homeAddress")}`}
      >
        <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Home Address</h3>
          <div className="flex items-center gap-2">
            {isEditMode && activeEditSection === "homeAddress" && (
              <Button
                type="button"
                variant="ghost"
                className="h-6 px-2 text-[10px] font-semibold text-slate-500 hover:bg-transparent hover:text-slate-700"
                onClick={handleSectionCancel}
                disabled={isProfileSaving}
              >
                Cancel
              </Button>
            )}
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:text-blue-600"
              onClick={(event) => {
                if (isEditMode && activeEditSection === "homeAddress" && !isProfileSaving) {
                  void handleSectionSave("homeAddress");
                  return;
                }
                handleSectionInteract("homeAddress", event);
              }}
              aria-label={
                isEditMode && activeEditSection === "homeAddress" ? "Save home address" : "Edit home address"
              }
            >
              {isEditMode && activeEditSection === "homeAddress" ? (
                <Save className="h-3.5 w-3.5" />
              ) : (
                <Pencil className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Address Line 1</Label>
            <Input
              className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
              placeholder="Please insert"
              value={profileForm.physicalAddressLine1}
              readOnly={!isEditMode}
              onFocus={enableEditMode}
              onMouseDown={enableEditMode}
              onChange={(e) =>
                setProfileForm((prev) => ({
                  ...prev,
                  physicalAddressLine1: e.target.value,
                }))
              }
            />
          </div>
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Address Line 2</Label>
            <Input
              className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
              placeholder="Please insert"
              value={profileForm.physicalAddressLine2}
              readOnly={!isEditMode}
              onFocus={enableEditMode}
              onMouseDown={enableEditMode}
              onChange={(e) =>
                setProfileForm((prev) => ({
                  ...prev,
                  physicalAddressLine2: e.target.value,
                }))
              }
            />
          </div>
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>City</Label>
            <Input
              className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
              placeholder="Please insert"
              value={profileForm.city}
              readOnly={!isEditMode}
              onFocus={enableEditMode}
              onMouseDown={enableEditMode}
              onChange={(e) =>
                setProfileForm((prev) => ({
                  ...prev,
                  city: e.target.value,
                }))
              }
            />
          </div>
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Province</Label>
            <Select
              value={profileForm.province}
              onValueChange={(value) =>
                setProfileForm((prev) => ({
                  ...prev,
                  province: value as EmployeeProfileFormData["province"],
                }))
              }
            >
              <SelectTrigger
                className={employeeDropdownTriggerClass}
                showIcon={isEditMode}
                onPointerDown={handleSelectPointerDown}
              >
                <SelectValue placeholder="Please select" />
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
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Area Code</Label>
            <Input
              className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
              placeholder="Please insert"
              value={profileForm.areaCode}
              readOnly={!isEditMode}
              onFocus={enableEditMode}
              onMouseDown={enableEditMode}
              onChange={(e) =>
                setProfileForm((prev) => ({
                  ...prev,
                  areaCode: e.target.value,
                }))
              }
            />
          </div>
        </div>
      </div>

      <div
        ref={(el) => {
          sectionRefs.current.postalAddress = el;
        }}
        className={`rounded-sm border border-t-slate-300 border-r-slate-300 border-b-slate-300 border-l-slate-300 bg-white px-5 pb-5 pt-[9px] ${getSectionLockClass("postalAddress")}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-slate-900">Postal Address</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px] text-slate-900 rounded-[5px] hover:bg-transparent hover:text-slate-900 hover:border-blue-600"
              disabled={!isEditMode}
              onClick={() =>
                setProfileForm((prev) => ({
                  ...prev,
                  postalAddressLine1: prev.physicalAddressLine1,
                  postalAddressLine2: prev.physicalAddressLine2,
                  postalCity: prev.city,
                  postalProvince: prev.province,
                  postalAreaCode: prev.areaCode,
                }))
              }
            >
              Copy from physical
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {isEditMode && activeEditSection === "postalAddress" && (
              <Button
                type="button"
                variant="ghost"
                className="h-6 px-2 text-[10px] font-semibold text-slate-500 hover:bg-transparent hover:text-slate-700"
                onClick={handleSectionCancel}
                disabled={isProfileSaving}
              >
                Cancel
              </Button>
            )}
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:text-blue-600"
              onClick={(event) => {
                if (isEditMode && activeEditSection === "postalAddress" && !isProfileSaving) {
                  void handleSectionSave("postalAddress");
                  return;
                }
                handleSectionInteract("postalAddress", event);
              }}
              aria-label={
                isEditMode && activeEditSection === "postalAddress" ? "Save postal address" : "Edit postal address"
              }
            >
              {isEditMode && activeEditSection === "postalAddress" ? (
                <Save className="h-3.5 w-3.5" />
              ) : (
                <Pencil className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Address Line 1</Label>
            <Input
              className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
              placeholder="Please insert"
              value={profileForm.postalAddressLine1}
              readOnly={!isEditMode}
              onFocus={enableEditMode}
              onMouseDown={enableEditMode}
              onChange={(e) =>
                setProfileForm((prev) => ({
                  ...prev,
                  postalAddressLine1: e.target.value,
                }))
              }
            />
          </div>
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Address Line 2</Label>
            <Input
              className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
              placeholder="Please insert"
              value={profileForm.postalAddressLine2}
              readOnly={!isEditMode}
              onFocus={enableEditMode}
              onMouseDown={enableEditMode}
              onChange={(e) =>
                setProfileForm((prev) => ({
                  ...prev,
                  postalAddressLine2: e.target.value,
                }))
              }
            />
          </div>
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>City</Label>
            <Input
              className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
              placeholder="Please insert"
              value={profileForm.postalCity}
              readOnly={!isEditMode}
              onFocus={enableEditMode}
              onMouseDown={enableEditMode}
              onChange={(e) =>
                setProfileForm((prev) => ({
                  ...prev,
                  postalCity: e.target.value,
                }))
              }
            />
          </div>
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Province</Label>
            <Select
              value={profileForm.postalProvince}
              onValueChange={(value) =>
                setProfileForm((prev) => ({
                  ...prev,
                  postalProvince: value as EmployeeProfileFormData["postalProvince"],
                }))
              }
            >
              <SelectTrigger
                className={employeeDropdownTriggerClass}
                showIcon={isEditMode}
                onPointerDown={handleSelectPointerDown}
              >
                <SelectValue placeholder="Please select" />
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
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Area Code</Label>
            <Input
              className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
              placeholder="Please insert"
              value={profileForm.postalAreaCode}
              readOnly={!isEditMode}
              onFocus={enableEditMode}
              onMouseDown={enableEditMode}
              onChange={(e) =>
                setProfileForm((prev) => ({
                  ...prev,
                  postalAreaCode: e.target.value,
                }))
              }
            />
          </div>
        </div>
      </div>
    </div>
    );

  const renderLicencesTab = () => {
    const renderCategoryCard = (category: LicenceCategory) => {
      const rows = licencesForSelectedEmployee.filter((item) => item.category === category);
      return (
        <div key={category} className="rounded-sm border border-slate-300 bg-white px-5 pb-5 pt-[9px]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">{licenceCategoryLabels[category]}</h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-7 rounded border-slate-200 bg-white px-3 text-[11px] text-slate-600 hover:bg-white hover:border-blue-500 hover:text-blue-600"
                >
                  Upload
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[320px] p-1">
                {licenceTypesByCategory[category].map((type) => (
                  <DropdownMenuItem
                    key={type}
                    className={employeeDropdownMenuItemClass}
                    onSelect={() => {
                      setLicenceTypeSelection((prev) => ({
                        ...prev,
                        [category]: type,
                      }));
                      window.setTimeout(() => {
                        licenceFileInputRefs.current[category]?.click();
                      }, 0);
                    }}
                  >
                    {type}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <input
            ref={(el) => {
              licenceFileInputRefs.current[category] = el;
            }}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => void handleLicenceFileChange(category, event)}
          />

          {rows.length === 0 ? (
            <p className="text-[11px] font-medium text-slate-500">No uploaded licences yet.</p>
          ) : (
            <div className="divide-y divide-slate-200">
              {rows.map((row) => (
                <div key={row.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                  <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>{row.licenceType}</Label>
                  <div className="ml-auto flex w-full max-w-[320px] items-center justify-start gap-2">
                    <button
                      type="button"
                      className="max-w-[180px] truncate text-[11px] font-semibold text-blue-600 hover:underline"
                      title={row.fileName}
                      onClick={() => void handleOpenLicence(row)}
                    >
                      {row.fileName}
                    </button>
                    <TooltipProvider delayDuration={0} skipDelayDuration={0}>
                      <Tooltip disableHoverableContent>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-7 rounded px-3 text-[11px] text-slate-600 hover:bg-transparent hover:text-rose-600 hover:underline border-0 shadow-none"
                            onClick={() => void handleRemoveLicence(row)}
                            aria-label={`Remove ${row.fileName}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="rounded">
                          Remove
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="space-y-3">
        {licencesViewFilter === "driving" && renderCategoryCard("driving")}
        {licencesViewFilter === "firearmSecurity" && renderCategoryCard("firearmSecurity")}
        {licencesViewFilter === "marineAviation" && renderCategoryCard("marineAviation")}
      </div>
    );
  };

  const renderEducationTab = () => {
    const renderCategoryCard = (category: EducationCategory) => {
      const rows = educationsForSelectedEmployee.filter((item) => item.category === category);
      return (
        <div key={category} className="rounded-sm border border-slate-300 bg-white px-5 pb-5 pt-[9px]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">{educationCategoryLabels[category]}</h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-7 rounded border-slate-200 bg-white px-3 text-[11px] text-slate-600 hover:bg-white hover:border-blue-500 hover:text-blue-600"
                >
                  Upload
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[320px] p-1">
                {educationTypesByCategory[category].map((type) => (
                  <DropdownMenuItem
                    key={type}
                    className={employeeDropdownMenuItemClass}
                    onSelect={() => {
                      setEducationTypeSelection((prev) => ({
                        ...prev,
                        [category]: type,
                      }));
                      window.setTimeout(() => {
                        educationFileInputRefs.current[category]?.click();
                      }, 0);
                    }}
                  >
                    {type}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <input
            ref={(el) => {
              educationFileInputRefs.current[category] = el;
            }}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => handleEducationFileChange(category, event)}
          />

          {rows.length === 0 ? (
            <p className="text-[11px] font-medium text-slate-500">No uploaded education documents yet.</p>
          ) : (
            <div className="divide-y divide-slate-200">
              {rows.map((row) => (
                <div key={row.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                  <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>{row.qualificationType}</Label>
                  <div className="ml-auto flex w-full max-w-[320px] items-center justify-start gap-2">
                    <button
                      type="button"
                      className="max-w-[180px] truncate text-[11px] font-semibold text-blue-600 hover:underline"
                      title={row.fileName}
                      onClick={() => handleOpenEducation(row)}
                    >
                      {row.fileName}
                    </button>
                    <TooltipProvider delayDuration={0} skipDelayDuration={0}>
                      <Tooltip disableHoverableContent>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-7 rounded px-3 text-[11px] text-slate-600 hover:bg-transparent hover:text-rose-600 hover:underline border-0 shadow-none"
                            onClick={() => handleRemoveEducation(row)}
                            aria-label={`Remove ${row.fileName}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="rounded">
                          Remove
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="space-y-3">
        {educationViewFilter === "academic" && renderCategoryCard("academic")}
        {educationViewFilter === "trade" && renderCategoryCard("trade")}
        {educationViewFilter === "training" && renderCategoryCard("training")}
      </div>
    );
  };

  const renderEmploymentTab = () => {
    if (employeeStatus === "Inactive") {
      const terminationReason =
        (selectedEmployee?.termination_reason ?? "").toString().trim() || "--";
      const terminationDateRaw = (selectedEmployee?.terminated_at ?? "").toString().trim();
      const previousJobTitle =
        (selectedEmployee?.previous_job_title ?? "").toString().trim() || "--";
      const terminationDocumentInputId = `termination-document-upload-${selectedEmployee?.id ?? "none"}`;

      return (
        <div className="space-y-3">
          <div
            ref={(el) => {
              sectionRefs.current.employmentStatus = el;
            }}
            className={`rounded-sm border border-slate-300 bg-white px-5 pb-5 pt-[9px] ${getSectionLockClass("employmentStatus")}`}
          >
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900">Employment History</h4>
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-3">
                <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Termination Reason</Label>
                <Input
                  className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
                  value={terminationReason}
                  readOnly
                  disabled
                />
              </div>
              <div className="flex items-center gap-3">
                <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Termination Date</Label>
                <Input
                  className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
                  type="date"
                  value={terminationDateRaw}
                  onChange={(e) => void handleTerminationDateChange(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Termination Letter</Label>
                <div className="ml-auto flex w-full max-w-[320px] items-center justify-start gap-2">
                  <input
                    id={terminationDocumentInputId}
                    ref={terminationDocumentFileInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={handleTerminationDocumentFileChange}
                  />
                  {!terminationDocumentForSelectedEmployee && (
                    <Button
                      type="button"
                      asChild
                      variant="outline"
                      className="h-8 rounded border-slate-200 bg-white px-3 text-[11px] text-slate-600 hover:bg-white hover:border-blue-500 hover:text-blue-600"
                      disabled={isTerminationDocumentUploading}
                    >
                      <label htmlFor={terminationDocumentInputId}>
                        <Upload className="mr-1 h-3 w-3" />
                        {isTerminationDocumentUploading ? "Uploading..." : "Upload"}
                      </label>
                    </Button>
                  )}
                  {pendingTerminationDocumentName ? (
                    <span
                      className="max-w-[180px] truncate text-[11px] font-semibold text-amber-700"
                      title={pendingTerminationDocumentName}
                    >
                      {pendingTerminationDocumentName}
                    </span>
                  ) : terminationDocumentForSelectedEmployee ? (
                    <button
                      type="button"
                      className="max-w-[180px] truncate text-[11px] font-semibold text-blue-600 hover:underline"
                      onClick={() => void handleOpenTerminationDocument(terminationDocumentForSelectedEmployee)}
                      title={terminationDocumentForSelectedEmployee.fileName}
                    >
                      {terminationDocumentForSelectedEmployee.fileName}
                    </button>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-500">--</span>
                  )}
                  {terminationDocumentForSelectedEmployee && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-7 rounded px-3 text-[11px] text-slate-600 hover:bg-transparent hover:text-rose-600 hover:underline border-0 shadow-none"
                      onClick={handleRemoveTerminationDocument}
                      disabled={isTerminationDocumentUploading}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Previous Job Title</Label>
                <Input
                  className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
                  value={previousJobTitle}
                  readOnly
                  disabled
                />
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
      <div
        ref={(el) => {
          sectionRefs.current.employmentStatus = el;
        }}
        className={`rounded-sm border border-slate-300 bg-white px-5 pb-5 pt-[9px] ${getSectionLockClass("employmentStatus")}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900">Employment Status</h4>
          </div>
          <div className="flex items-center gap-2">
            {isEditMode && activeEditSection === "employmentStatus" && (
              <Button
                type="button"
                variant="ghost"
                className="h-6 px-2 text-[10px] font-semibold text-slate-500 hover:bg-transparent hover:text-slate-700"
                onClick={handleSectionCancel}
                disabled={isProfileSaving}
              >
                Cancel
              </Button>
            )}
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:text-blue-600"
              onClick={(event) => {
                if (isEditMode && activeEditSection === "employmentStatus" && !isProfileSaving) {
                  void handleSectionSave("employmentStatus");
                  return;
                }
                handleSectionInteract("employmentStatus", event);
              }}
              aria-label={
                isEditMode && activeEditSection === "employmentStatus"
                  ? "Save employment details"
                  : "Edit employment details"
              }
            >
              {isEditMode && activeEditSection === "employmentStatus" ? (
                <Save className="h-3.5 w-3.5" />
              ) : (
                <Pencil className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Employee Status</Label>
            <Select
              value={employeeStatus}
              onValueChange={(value) => {
                if (value === "Active") {
                  void updateEmployeeStatus("active");
                }
              }}
              onOpenChange={(open) => {
                if (open && !isEditMode) {
                  return;
                }
              }}
              disabled={!isEditMode}
            >
            <SelectTrigger
                className={employeeDropdownTriggerClass}
                disabled={!isEditMode}
              >
                <SelectValue placeholder="Active" />
              </SelectTrigger>
              <SelectContent className="text-[11px]">
                {employmentStatusOptions.map((option) => (
                  <SelectItem
                    key={option}
                    value={option}
                    className={employeeDropdownSelectItemClass}
                    onSelect={() => {
                      if (option === "Active") {
                        void updateEmployeeStatus("active");
                      }
                    }}
                  >
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Employee Number</Label>
            <Input
              className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
              value={profileForm.employeeNumber}
              readOnly={!isEditMode}
              onFocus={enableEditMode}
              onMouseDown={enableEditMode}
              maxLength={EMPLOYEE_NUMBER_MAX_LENGTH}
              onChange={(e) => handleCustomEmployeeNumberChange(e.target.value)}
              placeholder="Please insert"
            />
          </div>
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Contract Type</Label>
            <Popover
              open={contractTypeOpen}
              onOpenChange={(open) => {
                if (open && !isEditMode) {
                  return;
                }
                setContractTypeOpen(open);
                if (open) {
                  setContractTypeQuery("");
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  className={employeeDropdownTriggerClass}
                  onPointerDown={(event) => {
                    if (!isEditMode) {
                        event.preventDefault();
                        return;
                      }
                  }}
                  disabled={!isEditMode}
                >
                  <span className="truncate">{profileForm.contractType || "Select contract type"}</span>
                  <ChevronDown className="h-4 w-4 opacity-50" aria-hidden="true" />
                </Button>
              </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandList>
                  <CommandGroup>
                    {contractTypes.map((option) => (
                      <CommandItem
                        key={option}
                        value={option}
                        className={employeeDropdownCommandItemClass}
                        onSelect={(value) => {
                          setProfileForm((prev) => ({
                            ...prev,
                            contractType: value as EmployeeProfileFormData["contractType"],
                            endDate: value === "Temporary" ? prev.endDate : "",
                          }));
                          setContractTypeOpen(false);
                        }}
                      >
                        <span>{option}</span>
                        {profileForm.contractType === option && (
                          <Check className="ml-auto h-3.5 w-3.5 text-blue-600" />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Start Date</Label>
            <Input
              className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
              placeholder="Please insert"
              type="date"
              value={profileForm.startDate}
              readOnly={!isEditMode}
              onFocus={enableEditMode}
              onMouseDown={enableEditMode}
              ref={startDateInputRef}
              onClick={() => {
                if (!isEditMode) {
                  return;
                }
                openDatePicker(startDateInputRef.current);
              }}
              onChange={(e) =>
                setProfileForm((prev) => ({
                  ...prev,
                  startDate: e.target.value,
                }))
              }
            />
          </div>
          {profileForm.contractType === "Temporary" && (
            <div className="flex items-center gap-3">
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>End Date</Label>
              <Input
                className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
                placeholder="Please insert"
                type="date"
                value={profileForm.endDate}
                readOnly={!isEditMode}
                onFocus={enableEditMode}
                onMouseDown={enableEditMode}
                ref={endDateInputRef}
                onClick={() => {
                  if (!isEditMode) {
                    return;
                  }
                  openDatePicker(endDateInputRef.current);
                }}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    endDate: e.target.value,
                  }))
                }
              />
            </div>
          )}
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Probation Period</Label>
            <Select
              value={probationPeriod}
              onValueChange={(value) => setProbationPeriod(value)}
              onOpenChange={(open) => {
                if (open && !isEditMode) {
                  return;
                }
              }}
              disabled={!isEditMode}
            >
              <SelectTrigger
                className={employeeDropdownTriggerClass}
                disabled={!isEditMode}
              >
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent className="text-[11px]">
                <SelectItem
                  value="No probation"
                  className={employeeDropdownSelectItemClass}
                >
                  No probation
                </SelectItem>
                {Array.from({ length: 12 }, (_, idx) => {
                  const months = idx + 1;
                  return (
                    <SelectItem
                      key={months}
                      value={`${months} ${months === 1 ? "month" : "months"}`}
                      className={employeeDropdownSelectItemClass}
                    >
                      {months} {months === 1 ? "month" : "months"}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Probation End</Label>
            <Input
              className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
              value={formatDisplayDate(
                computeProbationEndDate(profileForm.startDate, probationPeriod),
              )}
              readOnly
              disabled
            />
          </div>
          <div className="flex items-center gap-3" style={{ transform: "translateY(5px)" }}>
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Upload Contract</Label>
            <div className="ml-auto flex w-full max-w-[320px] items-center justify-start gap-2">
              {isEditMode && !hasEffectiveEmploymentContract && (
                <>
                  <input
                    ref={employmentContractFileInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={handleEmploymentContractFileChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 rounded border-slate-200 bg-white px-3 text-[11px] text-slate-600 hover:bg-white hover:border-blue-500 hover:text-blue-600"
                    onClick={() => employmentContractFileInputRef.current?.click()}
                    disabled={isEmploymentContractUploading}
                  >
                    <Upload className="mr-1 h-3 w-3" />
                    {isEmploymentContractUploading ? "Uploading..." : "Upload"}
                  </Button>
                </>
              )}
              {pendingEmploymentContractName ? (
                <span
                  className="max-w-[180px] truncate text-[11px] font-semibold text-amber-700"
                  title={pendingEmploymentContractName}
                >
                  {pendingEmploymentContractName}
                </span>
              ) : hasEffectiveEmploymentContract && activeContractForSelectedEmployee ? (
                <button
                  type="button"
                  className="max-w-[180px] truncate text-[11px] font-semibold text-blue-600 hover:underline"
                  onClick={() => void handleOpenContract(activeContractForSelectedEmployee)}
                  title={activeContractForSelectedEmployee.fileName}
                >
                  {activeContractForSelectedEmployee.fileName}
                </button>
              ) : (
                <span className="text-[11px] font-semibold text-slate-500">--</span>
              )}
              {isEditMode && hasEffectiveEmploymentContract && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-7 rounded px-3 text-[11px] text-slate-600 hover:bg-transparent hover:text-rose-600 hover:underline border-0 shadow-none"
                  onClick={handleMarkEmploymentContractForRemoval}
                  disabled={isEmploymentContractUploading}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        ref={(el) => {
          sectionRefs.current.employmentOrg = el;
        }}
        className={`rounded-sm border border-slate-300 bg-white px-5 pb-5 pt-[9px] ${getSectionLockClass("employmentOrg")}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-900">Organisational Details</h4>
          <div className="flex items-center gap-2">
            {isEditMode && activeEditSection === "employmentOrg" && (
              <Button
                type="button"
                variant="ghost"
                className="h-6 px-2 text-[10px] font-semibold text-slate-500 hover:bg-transparent hover:text-slate-700"
                onClick={handleSectionCancel}
                disabled={isProfileSaving}
              >
                Cancel
              </Button>
            )}
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:text-blue-600"
              onClick={(event) => {
                if (isEditMode && activeEditSection === "employmentOrg" && !isProfileSaving) {
                  void handleSectionSave("employmentOrg");
                  return;
                }
                handleSectionInteract("employmentOrg", event);
              }}
              aria-label={
                isEditMode && activeEditSection === "employmentOrg"
                  ? "Save organisational details"
                  : "Edit organisational details"
              }
            >
              {isEditMode && activeEditSection === "employmentOrg" ? (
                <Save className="h-3.5 w-3.5" />
              ) : (
                <Pencil className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Job Title</Label>
            <Input
              className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
              placeholder="Please insert"
              value={profileForm.jobTitle}
              readOnly={!isEditMode}
              onFocus={enableEditMode}
              onMouseDown={enableEditMode}
              onChange={(e) =>
                setProfileForm((prev) => ({
                  ...prev,
                  jobTitle: e.target.value,
                }))
              }
            />
          </div>
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Department</Label>
            <Popover
              open={departmentOpen}
              onOpenChange={(open) => {
                if (open && !isEditMode) {
                  return;
                }
                setDepartmentOpen(open);
                if (open) {
                  setDepartmentQuery("");
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  className={employeeDropdownTriggerClass}
                  onPointerDown={(event) => {
                    if (!isEditMode) {
                        event.preventDefault();
                        return;
                      }
                  }}
                  disabled={!isEditMode}
                >
                  <span className="truncate">{department || "Select department"}</span>
                  <ChevronDown className="h-4 w-4 opacity-50" aria-hidden="true" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Type department..."
                    value={departmentQuery}
                    onValueChange={setDepartmentQuery}
                  />
                  <CommandList>
                    <CommandEmpty>No department found.</CommandEmpty>
                    <CommandGroup>
                      {departmentOptions
                        .filter((option) =>
                          option.toLowerCase().includes(departmentQuery.trim().toLowerCase()),
                        )
                        .map((option) => (
                          <CommandItem
                            key={option}
                            value={option}
                            className={employeeDropdownCommandItemClass}
                            onSelect={(value) => {
                              setDepartment(value as (typeof departmentOptions)[number]);
                              setDepartmentOpen(false);
                            }}
                          >
                            <span>{option}</span>
                            {department === option && (
                              <Check className="ml-auto h-3.5 w-3.5 text-blue-600" />
                            )}
                          </CommandItem>
                        ))}
                      {departmentQuery.trim().length > 0 &&
                        !departmentOptions.some(
                          (option) => option.toLowerCase() === departmentQuery.trim().toLowerCase(),
                        ) && (
                          <CommandItem
                            value={departmentQuery.trim()}
                            className={employeeDropdownCommandItemClass}
                            onSelect={(value) => {
                              setDepartment(value as (typeof departmentOptions)[number]);
                              setDepartmentOpen(false);
                            }}
                          >
                            <span>Use "{departmentQuery.trim()}"</span>
                            {department === departmentQuery.trim() && (
                              <Check className="ml-auto h-3.5 w-3.5 text-blue-600" />
                            )}
                          </CommandItem>
                        )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          {companyBranchesEnabled && (
            <div className="flex items-center gap-3">
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Branch</Label>
              <Select
                value={branch || "__none"}
                onValueChange={(value) => setBranch(value === "__none" ? "" : value)}
                onOpenChange={(open) => {
                  if (open && !isEditMode) {
                    return;
                  }
                }}
                disabled={!isEditMode || branchOptions.length === 0}
              >
                <SelectTrigger
                  className={employeeDropdownTriggerClass}
                  disabled={!isEditMode || branchOptions.length === 0}
                >
                  <SelectValue placeholder={branchOptions.length === 0 ? "No branches configured" : "Select branch"} />
                </SelectTrigger>
                <SelectContent className="text-[11px]">
                  <SelectItem value="__none" className={employeeDropdownSelectItemClass}>
                    None
                  </SelectItem>
                  {branchOptions.map((option) => (
                    <SelectItem
                      key={option}
                      value={option}
                      className={employeeDropdownSelectItemClass}
                    >
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Reporting To</Label>
            <Popover
              open={reportingToOpen}
              onOpenChange={(open) => {
                if (open && !isEditMode) {
                  return;
                }
                setReportingToOpen(open);
                if (open) {
                  setReportingToQuery("");
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  className={employeeDropdownTriggerClass}
                  onPointerDown={(event) => {
                    if (!isEditMode) {
                        event.preventDefault();
                        return;
                      }
                  }}
                  disabled={!isEditMode}
                >
                  <span className="truncate">{reportingTo || "Select employee"}</span>
                  <ChevronDown className="h-4 w-4 opacity-50" aria-hidden="true" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Type employee name..."
                    value={reportingToQuery}
                    onValueChange={setReportingToQuery}
                  />
                  <CommandList>
                    <CommandEmpty>No employee found.</CommandEmpty>
                    <CommandGroup>
                      {reportingToOptions
                        .filter((option) =>
                          option.toLowerCase().includes(reportingToQuery.trim().toLowerCase()),
                        )
                        .map((option) => (
                          <CommandItem
                            key={option}
                            value={option}
                            className={employeeDropdownCommandItemClass}
                            onSelect={(value) => {
                              setReportingTo(value);
                              setReportingToOpen(false);
                            }}
                          >
                            <span>{option}</span>
                            {reportingTo === option && (
                              <Check className="ml-auto h-3.5 w-3.5 text-blue-600" />
                            )}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Occupational Level</Label>
            <Select
              value={occupationalLevel}
              onValueChange={(value) =>
                setOccupationalLevel(value as (typeof occupationalLevelOptions)[number])
              }
              onOpenChange={(open) => {
                if (open && !isEditMode) {
                  return;
                }
              }}
            >
              <SelectTrigger
                className={employeeDropdownTriggerClass}
                disabled={!isEditMode}
              >
                <SelectValue placeholder="Select occupational level" />
              </SelectTrigger>
              <SelectContent className="text-[11px]">
                {occupationalLevelOptions.map((option) => (
                  <SelectItem
                    key={option}
                    value={option}
                    className={employeeDropdownSelectItemClass}
                  >
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div
        ref={(el) => {
          sectionRefs.current.employmentRemuneration = el;
        }}
        className={`rounded-sm border border-slate-300 bg-white px-5 pb-5 pt-[9px] ${getSectionLockClass("employmentRemuneration")}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-900">Remuneration Information</h4>
          <div className="flex items-center gap-2">
            {isEditMode && activeEditSection === "employmentRemuneration" && (
              <Button
                type="button"
                variant="ghost"
                className="h-6 px-2 text-[10px] font-semibold text-slate-500 hover:bg-transparent hover:text-slate-700"
                onClick={handleSectionCancel}
                disabled={isProfileSaving}
              >
                Cancel
              </Button>
            )}
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:text-blue-600"
              onClick={(event) => {
                if (isEditMode && activeEditSection === "employmentRemuneration" && !isProfileSaving) {
                  void handleSectionSave("employmentRemuneration");
                  return;
                }
                handleSectionInteract("employmentRemuneration", event);
              }}
              aria-label={
                isEditMode && activeEditSection === "employmentRemuneration"
                  ? "Save remuneration details"
                  : "Edit remuneration details"
              }
            >
              {isEditMode && activeEditSection === "employmentRemuneration" ? (
                <Save className="h-3.5 w-3.5" />
              ) : (
                <Pencil className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Salary Cycle</Label>
            <Select
              value={salaryType}
              onValueChange={(value) =>
                setSalaryType(value as (typeof salaryTypeOptions)[number])
              }
              onOpenChange={(open) => {
                if (open && !isEditMode) {
                  return;
                }
              }}
            >
            <SelectTrigger
                className={employeeDropdownTriggerClass}
                disabled={!isEditMode}
              >
                <SelectValue placeholder="Please select a cycle" />
              </SelectTrigger>
              <SelectContent className="text-[11px]">
                {salaryTypeOptions.map((option) => (
                  <SelectItem
                    key={option}
                    value={option}
                    className={employeeDropdownSelectItemClass}
                  >
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Basic Salary (R)</Label>
            <Input
              className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
              placeholder="e.g. 25000"
              inputMode="decimal"
              value={basicSalary}
              readOnly={!isEditMode}
              onFocus={enableEditMode}
              onMouseDown={enableEditMode}
              onChange={(e) => setBasicSalary(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div
        ref={(el) => {
          sectionRefs.current.employmentWorkContact = el;
        }}
        className={`rounded-sm border border-slate-300 bg-white px-5 pb-5 pt-[9px] ${getSectionLockClass("employmentWorkContact")}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-900">Work Contact Information</h4>
          <div className="flex items-center gap-2">
            {isEditMode && activeEditSection === "employmentWorkContact" && (
              <Button
                type="button"
                variant="ghost"
                className="h-6 px-2 text-[10px] font-semibold text-slate-500 hover:bg-transparent hover:text-slate-700"
                onClick={handleSectionCancel}
                disabled={isProfileSaving}
              >
                Cancel
              </Button>
            )}
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:text-blue-600"
              onClick={(event) => {
                if (isEditMode && activeEditSection === "employmentWorkContact" && !isProfileSaving) {
                  void handleSectionSave("employmentWorkContact");
                  return;
                }
                handleSectionInteract("employmentWorkContact", event);
              }}
              aria-label={
                isEditMode && activeEditSection === "employmentWorkContact"
                  ? "Save work contact details"
                  : "Edit work contact details"
              }
            >
              {isEditMode && activeEditSection === "employmentWorkContact" ? (
                <Save className="h-3.5 w-3.5" />
              ) : (
                <Pencil className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Work Email</Label>
            <Input
              className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
              placeholder="Please insert"
              value={workEmail}
              readOnly={!isEditMode}
              onFocus={enableEditMode}
              onMouseDown={enableEditMode}
              onChange={(e) => setWorkEmail(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Work Cell Number</Label>
            <Input
              className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
              placeholder="Please insert"
              value={workCellNumber}
              readOnly={!isEditMode}
              onFocus={enableEditMode}
              onMouseDown={enableEditMode}
              onChange={(e) => setWorkCellNumber(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div
        ref={(el) => {
          sectionRefs.current.employmentUnion = el;
        }}
        className={`rounded-sm border border-slate-300 bg-white px-5 pb-5 pt-[9px] ${getSectionLockClass("employmentUnion")}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-900">Union Association</h4>
          <div className="flex items-center gap-2">
            {isEditMode && activeEditSection === "employmentUnion" && (
              <Button
                type="button"
                variant="ghost"
                className="h-6 px-2 text-[10px] font-semibold text-slate-500 hover:bg-transparent hover:text-slate-700"
                onClick={handleSectionCancel}
                disabled={isProfileSaving}
              >
                Cancel
              </Button>
            )}
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:text-blue-600"
              onClick={(event) => {
                if (isEditMode && activeEditSection === "employmentUnion" && !isProfileSaving) {
                  void handleSectionSave("employmentUnion");
                  return;
                }
                handleSectionInteract("employmentUnion", event);
              }}
              aria-label={
                isEditMode && activeEditSection === "employmentUnion" ? "Save union details" : "Edit union details"
              }
            >
              {isEditMode && activeEditSection === "employmentUnion" ? (
                <Save className="h-3.5 w-3.5" />
              ) : (
                <Pencil className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Union Member</Label>
            <Select
              value={unionMember}
              onValueChange={(value) => {
                const nextValue = value as (typeof unionMemberOptions)[number];
                setUnionMember(nextValue);
                if (nextValue !== "Yes") {
                  setTradeUnion("");
                  return;
                }
                requestAnimationFrame(() => {
                  tradeUnionTriggerRef.current?.focus();
                });
              }}
              onOpenChange={(open) => {
                if (open && !isEditMode) {
                  return;
                }
              }}
            >
            <SelectTrigger
                className={employeeDropdownTriggerClass}
                disabled={!isEditMode}
              >
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent className="text-[11px]">
                {unionMemberOptions.map((option) => (
                  <SelectItem
                    key={option}
                    value={option}
                    className={employeeDropdownSelectItemClass}
                  >
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {unionMember === "Yes" && (
            <div className="flex items-center gap-3">
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Trade Union</Label>
              <Popover
                open={tradeUnionOpen}
                onOpenChange={(open) => {
                  if (open && !isEditMode) {
                  return;
                }
                  setTradeUnionOpen(open);
                  if (open) {
                    setTradeUnionQuery("");
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    ref={tradeUnionTriggerRef}
                    className={employeeDropdownTriggerClass}
                    onPointerDown={(event) => {
                      if (!isEditMode) {
                        event.preventDefault();
                        return;
                      }
                    }}
                  >
                    <span className="truncate">{tradeUnion || "Select trade union"}</span>
                    <ChevronDown className="h-4 w-4 opacity-50" aria-hidden="true" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Type trade union..."
                      value={tradeUnionQuery}
                      onValueChange={setTradeUnionQuery}
                    />
                    <CommandList>
                      <CommandEmpty>No trade union found.</CommandEmpty>
                      <CommandGroup>
                        {tradeUnionOptions
                          .filter((option) =>
                            option.toLowerCase().includes(tradeUnionQuery.trim().toLowerCase()),
                          )
                          .map((option) => (
                            <CommandItem
                              key={option}
                              value={option}
                              className={employeeDropdownCommandItemClass}
                              onSelect={(value) => {
                                setTradeUnion(value);
                                setTradeUnionOpen(false);
                              }}
                            >
                              <span>{option}</span>
                              {tradeUnion === option && (
                                <Check className="ml-auto h-3.5 w-3.5 text-blue-600" />
                              )}
                            </CommandItem>
                          ))}
                        {tradeUnionQuery.trim().length > 0 &&
                          !tradeUnionOptions.some(
                            (option) => option.toLowerCase() === tradeUnionQuery.trim().toLowerCase(),
                          ) && (
                            <CommandItem
                              value={tradeUnionQuery.trim()}
                              className={employeeDropdownCommandItemClass}
                              onSelect={(value) => {
                                setTradeUnion(value);
                                setTradeUnionOpen(false);
                              }}
                            >
                              <span>Use "{tradeUnionQuery.trim()}"</span>
                              {tradeUnion === tradeUnionQuery.trim() && (
                                <Check className="ml-auto h-3.5 w-3.5 text-blue-600" />
                              )}
                            </CommandItem>
                          )}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>
    </div>
  );
  };

  const renderDisciplineTab = () => {
    const showingValid = warningFilter === "valid";
    const activeWarnings = showingValid ? warningsByStatus.valid : warningsByStatus.expired;
    const warningTypeTag: Record<EmployeeWarning["warningType"], string> = {
      First: "First",
      Second: "Second",
      Serious: "Serious",
      Final: "Final",
    };
    const warningTypeBadgeClass: Record<EmployeeWarning["warningType"], string> = {
      First: "border-blue-200 bg-blue-50 text-blue-700",
      Second: "border-emerald-200 bg-emerald-50 text-emerald-700",
      Serious: "border-amber-200 bg-amber-50 text-amber-700",
      Final: "border-rose-200 bg-rose-50 text-rose-700",
    };

    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-slate-900">Warnings</h4>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={warningFilter}
                onValueChange={(value) => setWarningFilter(value as "valid" | "expired")}
                onOpenChange={(open) => {
                  if (!open && document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                }}
              >
                <SelectTrigger
                  className="h-7 w-[96px] rounded border border-slate-200 bg-white px-2 text-[10px] font-medium text-slate-900 shadow-none justify-between data-[placeholder]:text-muted-foreground data-[placeholder]:text-xs hover:border-blue-400 data-[state=open]:border-slate-300 focus:border-blue-600 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:border-blue-600 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  showIcon
                >
                <SelectValue placeholder="Filter warnings" />
              </SelectTrigger>
              <SelectContent className="text-[11px]">
                  <SelectItem
                    value="valid"
                    className={employeeDropdownSelectItemClass}
                  >
                    Valid
                  </SelectItem>
                  <SelectItem
                    value="expired"
                    className={employeeDropdownSelectItemClass}
                  >
                    Expired
                  </SelectItem>
              </SelectContent>
              </Select>
              <Button
                type="button"
                className="h-7 min-w-[92px] rounded px-2.5 text-[10px] inline-flex items-center justify-center gap-1.5 border border-blue-600 bg-white text-blue-600 hover:bg-blue-600 hover:text-white data-[state=open]:bg-blue-600 data-[state=open]:text-white [&_svg]:h-3.5 [&_svg]:w-3.5"
                onClick={() => setIsWarningDialogOpen(true)}
              >
                <Upload className="h-2.5 w-2.5" />
                Upload
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-sm border border-slate-300">
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed">
                <thead className="bg-blue-100/70 text-xs font-semibold text-slate-500">
                  <tr className="text-left">
                    <th className="pl-4 pr-3 py-2 w-[48%]">Misconduct</th>
                    <th className="pl-4 pr-3 py-2 text-center w-[12%]">Type</th>
                    <th className="pl-4 pr-3 py-2 text-center w-[20%]">{showingValid ? "Expiry" : "Expired"}</th>
                    <th className="pl-4 pr-3 py-2 text-center w-[20%]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-[11px]">
                  {activeWarnings.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-sm text-muted-foreground">
                        {showingValid ? "No valid warnings yet." : "No expired warnings."}
                      </td>
                    </tr>
                  ) : (
                    activeWarnings.map((warning) => {
                      const misconductTypes = parseMisconductTypes(warning.misconductType);
                      const primaryMisconduct = misconductTypes[0] || "Misconduct";
                      const otherMisconductTypes = misconductTypes.slice(1);
                      const hasOtherMisconduct = otherMisconductTypes.length > 0;

                      return (
                        <tr key={warning.id} className="hover:bg-muted/30">
                          <td className="px-3 py-2 font-medium text-slate-900 w-[48%]">
                            <span>{primaryMisconduct}</span>
                            {hasOtherMisconduct && (
                              <TooltipProvider delayDuration={0}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="ml-1 text-xs font-semibold text-blue-700 hover:underline"
                                    >
                                      , Other
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs border border-blue-200 bg-white text-slate-900">
                                    <ul className="list-disc space-y-1 pl-4 text-xs">
                                      {otherMisconductTypes.map((type) => (
                                        <li key={type}>{type}</li>
                                      ))}
                                    </ul>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center w-[12%]">
                            <Badge
                              variant="outline"
                              className={warningTypeBadgeClass[warning.warningType] || "border-border/70 text-muted-foreground"}
                            >
                              {warningTypeTag[warning.warningType] || warning.warningType}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-center text-muted-foreground w-[20%]">
                            {formatDisplayDate(warning.expiryDate)}
                          </td>
                          <td className="px-3 py-2 text-center w-[20%]">
                            <DropdownMenu
                              onOpenChange={(open) => {
                                if (!open && document.activeElement instanceof HTMLElement) {
                                  document.activeElement.blur();
                                }
                              }}
                            >
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-slate-700 hover:text-blue-600 hover:bg-transparent !ring-0 !ring-offset-0 focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 outline-none focus:outline-none focus-visible:outline-none"
                                  aria-label="Warning actions"
                                >
                                  <Menu className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="border-0 text-[11px]"
                                onCloseAutoFocus={(event) => event.preventDefault()}
                              >
                                <DropdownMenuItem
                                  className={employeeDropdownMenuItemWithGapClass}
                                  onSelect={(event) => {
                                    event.preventDefault();
                                    handleEditWarning(warning);
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Edit
                                </DropdownMenuItem>
                                {warning.fileUrl && (
                                  <DropdownMenuItem
                                    className={employeeDropdownMenuItemWithGapClass}
                                    onSelect={(event) => {
                                      event.preventDefault();
                                      void handleOpenWarning(warning);
                                    }}
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                    Download
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="gap-2 cursor-pointer text-[11px] text-red-600 focus:bg-red-50/70 focus:text-red-600 data-[highlighted]:bg-red-50/70 data-[highlighted]:text-red-600"
                                  onSelect={(event) => {
                                    event.preventDefault();
                                    handleDeleteWarning(warning.id, warning.fileUrl);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    );
  };

  const renderContractTab = () => {
    const showingActive = contractStatusFilter === "active";
    const activeContracts = showingActive ? contractsByStatus.active : contractsByStatus.inactive;

    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-slate-900">Contracts</h4>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={contractStatusFilter}
                onValueChange={(value) => setContractStatusFilter(value as "active" | "inactive")}
                onOpenChange={(open) => {
                  if (!open && document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                }}
              >
                <SelectTrigger
                  className="h-7 w-[110px] rounded border border-slate-200 bg-white px-2 text-[10px] font-medium text-slate-900 shadow-none justify-between data-[placeholder]:text-muted-foreground data-[placeholder]:text-xs hover:border-blue-400 data-[state=open]:border-slate-300 focus:border-blue-600 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:border-blue-600 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  showIcon
                >
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent className="text-[11px]">
                  <SelectItem
                    value="active"
                    className={employeeDropdownSelectItemClass}
                  >
                    Active
                  </SelectItem>
                  <SelectItem
                    value="inactive"
                    className={employeeDropdownSelectItemClass}
                  >
                    Inactive
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                className="h-7 min-w-[92px] rounded px-2.5 text-[10px] inline-flex items-center justify-center gap-1.5 border border-blue-600 bg-white text-blue-600 hover:bg-blue-600 hover:text-white data-[state=open]:bg-blue-600 data-[state=open]:text-white [&_svg]:h-3.5 [&_svg]:w-3.5"
                onClick={handleStartContractUpload}
              >
                <Upload className="h-2.5 w-2.5" />
                Upload
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-sm border border-slate-300">
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed">
                <thead className="bg-blue-100/70 text-xs font-semibold text-slate-500">
                  <tr className="text-left">
                    <th className="pl-4 pr-3 py-2 w-[44%]">Contract type</th>
                    <th className="pl-4 pr-3 py-2 text-center w-[16%]">Status</th>
                    <th className="pl-4 pr-3 py-2 text-center w-[20%]">Uploaded</th>
                    <th className="pl-4 pr-3 py-2 text-center w-[20%]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-[11px]">
                  {activeContracts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-sm text-muted-foreground">
                        {showingActive ? "No active contracts yet." : "No inactive contracts."}
                      </td>
                    </tr>
                  ) : (
                    activeContracts.map((contract) => {
                      return (
                        <tr key={contract.id} className="hover:bg-muted/30">
                          <td className="px-3 py-2 font-medium text-slate-900 w-[44%]">
                            {contract.contractType || "Contract"}
                          </td>
                          <td className="px-3 py-2 text-center w-[16%]">
                            <Badge
                              variant="outline"
                              className={
                                contract.isActive
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 bg-slate-50 text-slate-600"
                              }
                            >
                              {contract.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-center text-muted-foreground w-[20%]">
                            {formatDisplayDate(contract.issueDate)}
                          </td>
                          <td className="px-3 py-2 text-center w-[20%]">
                            <DropdownMenu
                              onOpenChange={(open) => {
                                if (!open && document.activeElement instanceof HTMLElement) {
                                  document.activeElement.blur();
                                }
                              }}
                            >
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-slate-700 hover:text-blue-600 hover:bg-transparent !ring-0 !ring-offset-0 focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 outline-none focus:outline-none focus-visible:outline-none"
                                  aria-label="Contract actions"
                                >
                                  <Menu className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="border-0 text-[11px]"
                                onCloseAutoFocus={(event) => event.preventDefault()}
                              >
                                {contract.fileUrl && (
                                  <DropdownMenuItem
                                    className={employeeDropdownMenuItemWithGapClass}
                                    onSelect={(event) => {
                                      event.preventDefault();
                                      void handleOpenContract(contract);
                                    }}
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                    Download
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="gap-2 cursor-pointer text-[11px] text-red-600 focus:bg-red-50/70 focus:text-red-600 data-[highlighted]:bg-red-50/70 data-[highlighted]:text-red-600"
                                  onSelect={(event) => {
                                    event.preventDefault();
                                    handleDeleteContract(contract.id, contract.fileUrl);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    );
  };

  const renderSimpleDocumentCard = (
    heading: string,
    emptyMessage: string,
    onUpload: () => void,
  ) => {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900">{heading}</h4>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="h-7 min-w-[92px] rounded px-2.5 text-[10px] inline-flex items-center justify-center gap-1.5 border border-blue-600 bg-white text-blue-600 hover:bg-blue-600 hover:text-white data-[state=open]:bg-blue-600 data-[state=open]:text-white [&_svg]:h-3.5 [&_svg]:w-3.5"
              onClick={onUpload}
            >
              <Upload className="h-3.5 w-3.5" />
              Upload
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-sm border border-slate-300">
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed">
              <thead className="bg-blue-100/70 text-xs font-semibold text-slate-500">
                <tr className="text-left">
                  <th className="pl-4 pr-3 py-2 w-[60%]">Document</th>
                  <th className="pl-4 pr-3 py-2 text-center w-[20%]">Uploaded</th>
                  <th className="pl-4 pr-3 py-2 text-center w-[20%]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y text-[11px]">
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {emptyMessage}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

   if (loading) {
     return (
       <DashboardLayout>
         <div className="min-h-[60vh] flex items-center justify-center">
           <p className="text-muted-foreground">Loading...</p>
         </div>
       </DashboardLayout>
     );
   }

  return (
    <DashboardLayout>
      <div className="space-y-0 -m-6">
        <div className="border border-slate-300 border-r-0 bg-white shadow-sm h-[calc(100dvh-var(--app-header-height,5rem))] pb-0">
          <div className="flex h-full flex-col">
            <div className="pl-4 pr-4 pt-1">
              <div className="pt-5 pb-2">
                <h1 className="text-4xl font-normal text-blue-600 -ml-1">Employees</h1>
                <p className="text-xs text-slate-600 mt-2">
                  Browse, search, and manage your employees and attach their documents.
                </p>
              </div>
            </div>
            <section className="relative flex-1 overflow-y-auto overflow-x-hidden pr-2">
              <div className="space-y-0 p-0">
        <Card className="rounded-none bg-white border-0 shadow-none">
          <CardHeader className="pl-4 pr-4 pt-5 pb-3 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="group relative w-full sm:w-[400px]">
                <Input
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`h-8 rounded-sm border border-slate-200 bg-white !text-[11px] font-semibold shadow-sm transition-colors placeholder:!text-[11px] focus-visible:!border focus-visible:!border-blue-600 focus-visible:ring-0 group-hover:border-blue-600 dark:bg-background ${
                    searchQuery.trim().length > 0 ? "pr-20" : "pr-9"
                  }`}
                />
                {searchQuery.trim().length > 0 ? (
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-500 hover:text-blue-600 hover:underline"
                    onClick={() => setSearchQuery("")}
                  >
                    Clear
                  </button>
                ) : (
                  <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                )}
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <Popover
                  open={isFiltersPanelOpen}
                  onOpenChange={(open) => {
                    setIsFiltersPanelOpen(open);
                    if (!open) setExpandedFilterSection(null);
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 w-24 justify-between rounded px-3 text-[11px] inline-flex items-center border border-slate-200 bg-white text-slate-700 hover:border-blue-400 hover:bg-white hover:text-blue-600"
                    >
                      <span>Filter</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isFiltersPanelOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="left"
                    align="start"
                    sideOffset={8}
                    className="w-[260px] rounded-sm border border-slate-200 bg-white p-0 shadow-lg"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                      <span className="text-[12px] font-semibold text-slate-800">Filter</span>
                      <button
                        type="button"
                        className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 hover:underline"
                        onClick={() => {
                          setEmployeeStatusFilter("active");
                          setContractFilter("all");
                          setGenderFilter("all");
                          setRaceFilter("all");
                          setNationalityFilter("all");
                          closeEmployeeFiltersPanel();
                        }}
                      >
                        Clear
                      </button>
                    </div>
                    <div className="divide-y divide-slate-200">
                      <div>
                        <button
                          type="button"
                          className={`flex h-9 w-full items-center justify-between px-3 text-left text-[11px] font-semibold text-slate-800 hover:bg-slate-100 ${expandedFilterSection === "status" ? "bg-slate-100" : ""}`}
                          onClick={() => setExpandedFilterSection((prev) => (prev === "status" ? null : "status"))}
                        >
                          <span>Status</span>
                          <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform ${expandedFilterSection === "status" ? "rotate-180" : ""}`} />
                        </button>
                        {expandedFilterSection === "status" && (
                          <div className="px-3 pb-2">
                            {[
                              { value: "active" as const, label: "Active" },
                              { value: "inactive" as const, label: "Inactive" },
                            ].map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                className="flex h-8 w-full items-center justify-between text-[11px] text-slate-700 hover:text-blue-600"
                                onClick={() => {
                                  setEmployeeStatusFilter(option.value);
                                  closeEmployeeFiltersPanel();
                                }}
                              >
                                <span>{option.label}</span>
                                {employeeStatusFilter === option.value && <Check className="h-3.5 w-3.5 text-blue-600" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <button
                          type="button"
                          className={`flex h-9 w-full items-center justify-between px-3 text-left text-[11px] font-semibold text-slate-800 hover:bg-slate-100 ${expandedFilterSection === "contract" ? "bg-slate-100" : ""}`}
                          onClick={() => setExpandedFilterSection((prev) => (prev === "contract" ? null : "contract"))}
                        >
                          <span>Contract Type</span>
                          <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform ${expandedFilterSection === "contract" ? "rotate-180" : ""}`} />
                        </button>
                        {expandedFilterSection === "contract" && (
                          <div className="px-3 pb-2">
                            {[
                              { value: "all" as const, label: "All employees" },
                              { value: "permanent" as const, label: "Permanent" },
                              { value: "temporary" as const, label: "Temporary" },
                            ].map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                className="flex h-8 w-full items-center justify-between text-[11px] text-slate-700 hover:text-blue-600"
                                onClick={() => {
                                  setContractFilter(option.value);
                                  closeEmployeeFiltersPanel();
                                }}
                              >
                                <span>{option.label}</span>
                                {contractFilter === option.value && <Check className="h-3.5 w-3.5 text-blue-600" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <button
                          type="button"
                          className={`flex h-9 w-full items-center justify-between px-3 text-left text-[11px] font-semibold text-slate-800 hover:bg-slate-100 ${expandedFilterSection === "gender" ? "bg-slate-100" : ""}`}
                          onClick={() => setExpandedFilterSection((prev) => (prev === "gender" ? null : "gender"))}
                        >
                          <span>Gender</span>
                          <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform ${expandedFilterSection === "gender" ? "rotate-180" : ""}`} />
                        </button>
                        {expandedFilterSection === "gender" && (
                          <div className="px-3 pb-2">
                            {[{ value: "all" as const, label: "All genders" }, ...genderOptions.map((option) => ({ value: option, label: option }))].map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                className="flex h-8 w-full items-center justify-between text-[11px] text-slate-700 hover:text-blue-600"
                                onClick={() => {
                                  setGenderFilter(option.value as "all" | EmployeeProfileFormData["gender"]);
                                  closeEmployeeFiltersPanel();
                                }}
                              >
                                <span>{option.label}</span>
                                {genderFilter === option.value && <Check className="h-3.5 w-3.5 text-blue-600" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <button
                          type="button"
                          className={`flex h-9 w-full items-center justify-between px-3 text-left text-[11px] font-semibold text-slate-800 hover:bg-slate-100 ${expandedFilterSection === "race" ? "bg-slate-100" : ""}`}
                          onClick={() => setExpandedFilterSection((prev) => (prev === "race" ? null : "race"))}
                        >
                          <span>Race</span>
                          <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform ${expandedFilterSection === "race" ? "rotate-180" : ""}`} />
                        </button>
                        {expandedFilterSection === "race" && (
                          <div className="px-3 pb-2">
                            {[{ value: "all" as const, label: "All races" }, ...raceOptions.map((option) => ({ value: option, label: option }))].map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                className="flex h-8 w-full items-center justify-between text-[11px] text-slate-700 hover:text-blue-600"
                                onClick={() => {
                                  setRaceFilter(option.value as "all" | EmployeeProfileFormData["race"]);
                                  closeEmployeeFiltersPanel();
                                }}
                              >
                                <span>{option.label}</span>
                                {raceFilter === option.value && <Check className="h-3.5 w-3.5 text-blue-600" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <button
                          type="button"
                          className={`flex h-9 w-full items-center justify-between px-3 text-left text-[11px] font-semibold text-slate-800 hover:bg-slate-100 ${expandedFilterSection === "nationality" ? "bg-slate-100" : ""}`}
                          onClick={() => setExpandedFilterSection((prev) => (prev === "nationality" ? null : "nationality"))}
                        >
                          <span>Nationality</span>
                          <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform ${expandedFilterSection === "nationality" ? "rotate-180" : ""}`} />
                        </button>
                        {expandedFilterSection === "nationality" && (
                          <div className="px-3 pb-2">
                            {[
                              { value: "all" as const, label: "All nationalities" },
                              { value: "RSA" as const, label: "RSA" },
                              { value: "Other" as const, label: "Other" },
                            ].map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                className="flex h-8 w-full items-center justify-between text-[11px] text-slate-700 hover:text-blue-600"
                                onClick={() => {
                                  setNationalityFilter(option.value);
                                  closeEmployeeFiltersPanel();
                                }}
                              >
                                <span>{option.label}</span>
                                {nationalityFilter === option.value && <Check className="h-3.5 w-3.5 text-blue-600" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <DropdownMenu open={isNewEmployeeMenuOpen} onOpenChange={setIsNewEmployeeMenuOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      ref={newEmployeeMenuTriggerRef}
                      className="h-8 w-36 justify-between rounded px-3 text-[11px] inline-flex items-center border border-blue-600 bg-white text-blue-600 hover:bg-blue-600 hover:text-white data-[state=open]:bg-blue-600 data-[state=open]:text-white"
                    >
                      <span className="truncate">New Employee</span>
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36 text-[11px]">
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        setIsNewEmployeeMenuOpen(false);
                        setRehireEmployeeId(null);
                        setAddForm(createBlankAddForm());
                        setAddFormStep(1);
                        setIsAddDialogOpen(true);
                      }}
                      className={employeeDropdownMenuItemWithGapClass}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Single
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        setIsNewEmployeeMenuOpen(false);
                        handleBulkDialogChange(true);
                      }}
                      className={employeeDropdownMenuItemWithGapClass}
                    >
                      <Users className="h-3.5 w-3.5" />
                      Multiple
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pl-4 pr-4 pb-2">
            {isEmployeesLoading ? (
              <div className="flex items-center justify-center pt-[210px] pb-10">
                <img
                  src="/zappir_thumbnail_blue.png"
                  alt="Loading"
                  className="h-12 w-12 animate-spin"
                  style={{ animationDuration: "2s" }}
                />
              </div>
            ) : employees.length === 0 && !hasEmployeeTableFiltersApplied ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No employees added yet</p>
                <Button
                  onClick={() => {
                    setRehireEmployeeId(null);
                    setAddForm(createBlankAddForm());
                    setAddFormStep(1);
                    setIsAddDialogOpen(true);
                  }}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Your First Employee
                </Button>
              </div>
            ) : employees.length === 0 || filteredEmployees.length === 0 ? (
              <div className="text-center py-12">
                {employeeStatusFilter === "inactive" ? (
                  <p className="text-muted-foreground">
                    You don't have any inactive employees. Switch back to your{" "}
                    <button
                      type="button"
                      onClick={() => setEmployeeStatusFilter("active")}
                      className="font-semibold text-blue-600 hover:underline"
                    >
                      Active
                    </button>{" "}
                    employees.
                  </p>
                ) : (
                  <p className="text-muted-foreground">No employees match the selected filters.</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div
                  ref={tableCardRef}
                  className="relative overflow-hidden rounded-sm border border-slate-200"
                  style={{ maxHeight: tableMaxHeight }}
                >
                  <div className="grid grid-cols-[2fr_1.5fr_1.2fr_1fr_1.5fr_1.25fr_1fr_1fr] items-center gap-2 border-b bg-[#2D4256] pl-4 pr-3 py-3 text-xs font-semibold text-white">
                    <div className="flex items-center leading-tight">Employee</div>
                    <div className="flex items-center gap-2 leading-tight">ID Number</div>
                    <div className="flex items-center leading-tight">Contract Type</div>
                    <div className="flex items-center leading-tight text-left">Start Date</div>
                    <div className="flex items-center leading-tight">Job Title</div>
                    <div className="flex items-center leading-tight text-left">Cell Number</div>
                    <div className="flex items-center leading-tight text-left">Nationality</div>
                    <div className="flex items-center justify-center leading-tight text-center">Actions</div>
                  </div>
                  <div
                    ref={tableScrollRef}
                    className="divide-y employee-table-scroll overflow-y-auto"
                    style={{ maxHeight: tableBodyMaxHeight }}
                  >
                    {filteredEmployees.map((employee) => (
                      <div
                        key={employee.id}
                        className="grid grid-cols-[2fr_1.5fr_1.2fr_1fr_1.5fr_1.25fr_1fr_1fr] items-center gap-2 pl-4 pr-3 py-1 text-xs hover:bg-blue-50/70"
                      >
                        <div className="font-medium leading-tight">
                          <button
                            type="button"
                            onClick={() => openProfileDialog(employee)}
                            className="text-left hover:text-primary transition-colors"
                          >
                            {(employee.employee_name ?? "").trim()} {(employee.employee_surname ?? "").trim()}
                          </button>
                        </div>
                        <div className="flex items-center gap-2 leading-tight">
                          <span className="text-[11px] font-normal">
                            {employee.id_number
                              ? revealedIds.has(employee.id)
                                ? employee.id_number
                                : maskSAIdNumber(employee.id_number)
                              : "N/A"}
                          </span>
                          <TooltipProvider delayDuration={0} skipDelayDuration={0}>
                            <Tooltip disableHoverableContent>
                              <TooltipTrigger asChild>
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
                                  className="h-6 w-6 p-0 hover:bg-transparent group"
                                >
                                  {revealedIds.has(employee.id) ? (
                                    <EyeOff
                                      className="h-2.5 w-2.5 text-slate-600 group-hover:text-blue-600"
                                      strokeWidth={1.5}
                                    />
                                  ) : (
                                    <Eye
                                      className="h-2.5 w-2.5 text-slate-600 group-hover:text-blue-600"
                                      strokeWidth={1.5}
                                    />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="rounded">
                                {revealedIds.has(employee.id) ? "Hide ID" : "Show full ID"}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="leading-tight">{employee.contract_type?.trim() || "--"}</div>
                        <div className="flex items-center leading-tight text-left">
                          {formatDisplayDate(employee.start_date)}
                        </div>
                        <div className="leading-tight">{employee.job_title?.trim() || "--"}</div>
                        <div className="flex items-center leading-tight text-left">
                          {employee.cell_number?.trim() || "--"}
                        </div>
                        <div className="flex items-center leading-tight text-left">
                          {employee.nationality?.trim() || "--"}
                        </div>
                        <div className="flex items-center justify-center">
                          <TooltipProvider delayDuration={0} skipDelayDuration={0}>
                            <div className="flex items-center justify-center gap-1 ml-1">
                              <Tooltip disableHoverableContent>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openProfileDialog(employee)}
                                    className="h-6 w-6 p-0 hover:text-primary hover:bg-muted/50 bg-transparent"
                                  >
                                    <Search className="h-3 w-3" strokeWidth={1.5} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="rounded">
                                  View Profile
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip disableHoverableContent>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDocumentDialogEmployee(employee)}
                                    className="h-6 w-6 p-0 group hover:bg-muted/50 bg-transparent"
                                  >
                                    <FilePlus className="h-3 w-3 transition-colors group-hover:text-primary" strokeWidth={1.5} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="rounded">
                                  Add Document
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip disableHoverableContent>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => void handleTerminateEmployee(employee)}
                                    className="h-6 w-6 p-0 group hover:bg-muted/50 bg-transparent"
                                  >
                                    <Trash2 className="h-3 w-3 transition-colors group-hover:text-red-600" strokeWidth={1.5} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="rounded">
                                  Delete Employee
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
                        </div>
                      </div>
                    ))}
                  </div>
                  {showScrollHint && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
                      <div className="relative rounded-sm border border-blue-100 bg-white/95 px-4 py-1 text-xs font-semibold text-blue-900 backdrop-blur supports-[backdrop-filter]:bg-white/80">
                        <span className="pointer-events-none absolute inset-0 rounded-sm shadow-[0_3px_10px_rgba(59,130,246,0.35),0_-3px_10px_rgba(59,130,246,0.2)]" aria-hidden="true"></span>
                        <span className="relative">Scroll down</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-center">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={goToPreviousPage}
                      disabled={isFirstPage}
                      aria-label="Previous page"
                      className="h-8 w-8 hover:bg-transparent hover:text-blue-600"
                    >
                      <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                    </Button>
                    <span className="text-[10px] font-medium text-slate-500">
                      {hasNextPage || currentPage > 1 ? (
                        <>
                          Pages{" "}
                          {currentPage > 1 && (
                            <span className="text-slate-500 font-semibold">
                              {currentPage - 1}
                              {currentPage !== 1 || hasNextPage ? ", " : ""}
                            </span>
                          )}
                          <span className="text-blue-600 font-semibold text-[12px] underline">{currentPage}</span>
                          {hasNextPage && (
                            <>
                              {", "}
                              <span className="text-slate-500 font-semibold">{currentPage + 1}</span>
                            </>
                          )}
                        </>
                      ) : (
                        <>Page {currentPage}</>
                      )}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={goToNextPage}
                      disabled={isLastPage}
                      aria-label="Next page"
                      className="h-8 w-8 hover:bg-transparent hover:text-blue-600"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
                </Card>

                <Dialog open={isBulkDialogOpen} onOpenChange={handleBulkDialogChange}>
                  <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-white [&>button]:hidden">
                    <div className="flex items-center justify-between bg-[#2D4256] px-4 py-3 -mx-px -mt-px">
                      <div className="flex items-center gap-2 pl-2">
                        <UsersRound className="h-4 w-4 text-white" />
                        <DialogTitle className="text-sm font-semibold text-white">Add Multiple Employees</DialogTitle>
                      </div>
                      <DialogClose asChild>
                        <button type="button" className="text-white hover:text-white/80">
                          <X className="h-4 w-4" />
                        </button>
                      </DialogClose>
                    </div>
                    <div className="px-6 pt-0 pb-2"></div>
                    <div className="px-6 pb-6">
                      <div className="grid gap-6 sm:grid-cols-2 pt-4">
                        <div className="space-y-4 ml-6">
                          <h4 className="text-sm font-semibold">Step1</h4>
                          <button
                            type="button"
                            onClick={downloadTemplate}
                            className="group flex h-14 w-24 flex-col items-center justify-center rounded-sm border border-blue-600 text-blue-600 transition-none hover:border-2 hover:border-blue-600"
                          >
                            <Download className="h-5 w-5 transition-transform duration-150 group-hover:-translate-y-1.5" />
                            <span className="max-h-0 overflow-hidden text-[10px] text-blue-600 opacity-0 transition-all duration-150 group-hover:max-h-4 group-hover:opacity-100">
                              Download
                            </span>
                          </button>
                          <p className="text-[11px] text-slate-600 min-h-[32px] max-w-[calc(100%-20px)]">
                            Click in box above to download the .xlsx file for bulk upload.
                          </p>
                        </div>
                        <div className="space-y-4 ml-6">
                          <h4 className="text-sm font-semibold">Step 2</h4>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                            className="group flex h-14 w-24 flex-col items-center justify-center rounded-sm border border-blue-600 text-blue-600 transition-none hover:border-2 hover:border-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Upload className="h-5 w-5 transition-transform duration-150 group-hover:-translate-y-1.5" />
                            <span className="max-h-0 overflow-hidden text-[10px] text-blue-600 opacity-0 transition-all duration-150 group-hover:max-h-4 group-hover:opacity-100">
                              Upload
                            </span>
                          </button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleBulkUpload}
                            className="hidden"
                            id="bulk-upload"
                            hidden
                          />
                          <p className="text-[11px] text-slate-600 min-h-[32px] max-w-[calc(100%-10px)]">
                            Click in box above to upload your completed .xlsx file.
                          </p>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={isAddDialogOpen} onOpenChange={handleAddDialogChange}>
                  <DialogContent
                    className="w-[94vw] max-w-[380px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-white [&>button]:hidden"
                    onCloseAutoFocus={(event) => event.preventDefault()}
                  >
                    <div className="flex items-center justify-between bg-[#2D4256] px-4 py-3 -mx-px -mt-px">
                      <div className="flex items-center gap-2 pl-2">
                        <User className="h-4 w-4 text-white" />
                        <DialogTitle className="text-sm font-semibold text-white">
                          {rehireEmployeeId ? "Rehire Employee" : "New Employee"}
                        </DialogTitle>
                      </div>
                      <DialogClose asChild>
                        <button type="button" className="text-white hover:text-white/80">
                          <X className="h-4 w-4" />
                        </button>
                      </DialogClose>
                    </div>
                    <div className="px-6 pt-0 pb-2"></div>
                    <form onSubmit={handleAddEmployee} className="space-y-4 px-6 pb-6 pt-2">
                      <div className="mx-auto w-full max-w-[320px] py-4">
                        <div className="relative grid grid-cols-3 items-start">
                          <div className="pointer-events-none absolute left-[calc(16.6667%+26px)] top-[10px] h-[2px] w-[calc(33.3333%-52px)] bg-slate-300" />
                          <div className="pointer-events-none absolute left-[calc(50%+26px)] top-[10px] h-[2px] w-[calc(33.3333%-52px)] bg-slate-300" />
                          {(isAddFormStepOneComplete || addFormStep > 1) && (
                            <div className="pointer-events-none absolute left-[calc(16.6667%+26px)] top-[10px] h-[2px] w-[calc(33.3333%-52px)] bg-blue-600" />
                          )}
                          {(isAddFormStepTwoComplete || addFormStep > 2) && (
                            <div className="pointer-events-none absolute left-[calc(50%+26px)] top-[10px] h-[2px] w-[calc(33.3333%-52px)] bg-blue-600" />
                          )}
                          {[
                            { step: 1 as const, label: "Basic Details" },
                            { step: 2 as const, label: "Job Details" },
                            { step: 3 as const, label: "Address" },
                          ].map((item) => {
                            const isActive = addFormStep === item.step;
                            const isComplete =
                              item.step === 1 ? isAddFormStepOneComplete : item.step === 2 ? isAddFormStepTwoComplete : false;
                            const canOpen = canAccessAddFormStep(item.step);

                            return (
                              <button
                                key={item.step}
                                type="button"
                                onClick={() => goToAddFormStep(item.step)}
                                disabled={!canOpen}
                                className={`z-10 flex flex-col items-center text-center ${canOpen ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                              >
                                <span
                                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                                    isComplete
                                      ? "bg-blue-600 text-white"
                                      : isActive
                                        ? "bg-blue-600 text-white"
                                        : "bg-slate-500 text-white"
                                  }`}
                                >
                                  {isComplete ? <Check className="h-3 w-3" /> : item.step}
                                </span>
                                <span className="mt-3 text-[10px] font-semibold text-slate-700">{item.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="h-[330px]">
                      {addFormStep === 1 && (
                        <div className="w-full space-y-4">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                            <div className="relative w-full max-w-none">
                              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                Name <span className="text-red-600">*</span>
                              </span>
                              <Input
                                id="employeeName"
                                className={getAddModalInputClass(addForm.employeeName.trim().length > 0)}
                                placeholder="Please insert name"
                                value={addForm.employeeName}
                                onChange={(e) => setAddForm((prev) => ({ ...prev, employeeName: e.target.value }))}
                              />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                            <div className="relative w-full max-w-none">
                              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                Surname <span className="text-red-600">*</span>
                              </span>
                              <Input id="employeeSurname" className={getAddModalInputClass(addForm.employeeSurname.trim().length > 0)} placeholder="Please insert surname" value={addForm.employeeSurname} onChange={(e) => setAddForm((prev) => ({ ...prev, employeeSurname: e.target.value }))} />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                            <div className="relative w-full max-w-none">
                              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                ID / Passport <span className="text-red-600">*</span>
                              </span>
                              <Select value={addForm.idType || undefined} onValueChange={(value) => setAddForm((prev) => ({ ...prev, idType: value as AddEmployeeIdType, idNumber: "" }))}>
                                <SelectTrigger className={`${getAddModalSelectTriggerClass(isAddFormIdTypeSelected)} ${addModalDropdownToneClass}`}>
                                  <SelectValue placeholder="Please select option" />
                                </SelectTrigger>
                                <SelectContent className="text-[11px]">
                                  <SelectItem value="id" className={employeeDropdownSelectItemClass}>ID Number</SelectItem>
                                  <SelectItem value="passport" className={employeeDropdownSelectItemClass}>Passport Number</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                            <div className="relative w-full max-w-none">
                              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                {addForm.idType === "id" ? "ID Number" : addForm.idType === "passport" ? "Passport Number" : "ID / Passport Number"} <span className="text-red-600">*</span>
                              </span>
                              <Input id="idNumber" className={getAddModalInputClass(isAddFormIdNumberComplete)} value={addForm.idNumber} onChange={(e) => setAddForm((prev) => ({ ...prev, idNumber: prev.idType === "id" ? e.target.value.replace(/\D/g, "").slice(0, 13) : e.target.value }))} placeholder={addForm.idType === "id" ? "Please insert ID number" : addForm.idType === "passport" ? "Please insert passport number" : "Please select option first"} />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                            <div className="relative w-full max-w-none">
                              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                Gender
                              </span>
                              <Select value={addForm.gender} onValueChange={(value) => setAddForm((prev) => ({ ...prev, gender: value as AddEmployeeFormState["gender"] }))}>
                                <SelectTrigger className={`${getAddModalSelectTriggerClass(addForm.gender.trim().length > 0)} ${addModalDropdownToneClass}`}>
                                  <SelectValue placeholder="Select gender" />
                                </SelectTrigger>
                                <SelectContent className="text-[11px]">
                                  {genderOptions.map((option) => (
                                    <SelectItem key={option} value={option} className={employeeDropdownSelectItemClass}>{option}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                            <div className="relative w-full max-w-none">
                              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                Race
                              </span>
                              <Select value={addForm.race} onValueChange={(value) => setAddForm((prev) => ({ ...prev, race: value as AddEmployeeFormState["race"] }))}>
                                <SelectTrigger className={`${getAddModalSelectTriggerClass(addForm.race.trim().length > 0)} ${addModalDropdownToneClass}`}>
                                  <SelectValue placeholder="Select race" />
                                </SelectTrigger>
                                <SelectContent className="text-[11px]">
                                  {raceOptions.map((option) => (
                                    <SelectItem key={option} value={option} className={employeeDropdownSelectItemClass}>{option}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                            <div className="relative w-full max-w-none">
                              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                Cell Number
                              </span>
                              <Input id="cellNumber" className={getAddModalInputClass(addForm.cellNumber.trim().length > 0)} placeholder="Please insert cell number" value={addForm.cellNumber} onChange={(e) => setAddForm((prev) => ({ ...prev, cellNumber: e.target.value }))} />
                            </div>
                          </div>
                        </div>
                      )}

                      {addFormStep === 2 && (
                        <div className="w-full space-y-4">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                            <div className="relative w-full max-w-none">
                              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                Employee Number
                              </span>
                              <Input id="addEmployeeNumber" className={getAddModalInputClass(addForm.employeeNumber.trim().length > 0)} placeholder="Please insert employee number" value={addForm.employeeNumber} maxLength={EMPLOYEE_NUMBER_MAX_LENGTH} onChange={(e) => setAddForm((prev) => ({ ...prev, employeeNumber: sanitizeEmployeeNumber(e.target.value) }))} />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                            <div className="relative w-full max-w-none">
                              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                Job Title <span className="text-red-600">*</span>
                              </span>
                              <Input id="jobTitle" className={getAddModalInputClass(addForm.jobTitle.trim().length > 0)} placeholder="Please insert job title" value={addForm.jobTitle} onChange={(e) => setAddForm((prev) => ({ ...prev, jobTitle: e.target.value }))} />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                            <div className="relative w-full max-w-none">
                              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                Contract Type <span className="text-red-600">*</span>
                              </span>
                              <Select value={addForm.contractType} onValueChange={(value) => setAddForm((prev) => ({ ...prev, contractType: value as AddEmployeeFormState["contractType"], endDate: value === "Temporary" ? prev.endDate : "" }))}>
                                <SelectTrigger className={`${getAddModalSelectTriggerClass(addForm.contractType.trim().length > 0)} ${addModalDropdownToneClass}`}>
                                  <SelectValue placeholder="Select contract type" />
                                </SelectTrigger>
                                <SelectContent className="text-[11px]">
                                  {contractTypes.map((option) => (
                                    <SelectItem key={option} value={option} className={employeeDropdownSelectItemClass}>{option}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                            <div className="relative w-full max-w-none">
                              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                Start Date <span className="text-red-600">*</span>
                              </span>
                              <Input id="startDate" className={getAddModalInputClass(addForm.startDate.trim().length > 0)} type="date" placeholder="Please insert start date" value={addForm.startDate} onChange={(e) => setAddForm((prev) => ({ ...prev, startDate: e.target.value }))} />
                            </div>
                          </div>
                          {addForm.contractType === "Temporary" && (
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                              <div className="relative w-full max-w-none">
                                <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                  End Date <span className="text-red-600">*</span>
                                </span>
                                <Input id="endDate" className={getAddModalInputClass(addForm.endDate.trim().length > 0)} type="date" placeholder="Please insert end date" value={addForm.endDate} onChange={(e) => setAddForm((prev) => ({ ...prev, endDate: e.target.value }))} />
                              </div>
                            </div>
                          )}
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                            <div className="relative w-full max-w-none">
                              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                Salary Cycle
                              </span>
                              <Select value={addForm.salaryType} onValueChange={(value) => setAddForm((prev) => ({ ...prev, salaryType: value as AddEmployeeFormState["salaryType"] }))}>
                                <SelectTrigger className={`${getAddModalSelectTriggerClass(addForm.salaryType.trim().length > 0)} ${addModalDropdownToneClass}`}>
                                  <SelectValue placeholder="Select salary cycle" />
                                </SelectTrigger>
                                <SelectContent className="text-[11px]">
                                  {salaryTypeOptions.map((option) => (
                                    <SelectItem key={option} value={option} className={employeeDropdownSelectItemClass}>{option}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                            <div className="relative w-full max-w-none">
                              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                Basic Salary (R)
                              </span>
                              <Input
                                id="basicSalary"
                                className={getAddModalInputClass(addForm.basicSalary.trim().length > 0)}
                                placeholder="Please insert basic salary"
                                inputMode="decimal"
                                value={formatThousandsWithCommas(addForm.basicSalary)}
                                onChange={(e) =>
                                  setAddForm((prev) => ({
                                    ...prev,
                                    basicSalary: sanitizeSalaryInput(e.target.value),
                                  }))
                                }
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {addFormStep === 3 && (
                        <div className="w-full space-y-5">
                          <div className="rounded-sm border border-slate-200 bg-white p-3">
                            <h4 className="mb-2 text-xs font-semibold text-slate-900">Home Address</h4>
                            <div className="space-y-4">
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                                <div className="relative w-full max-w-none">
                                  <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                    Address Line 1 <span className="text-red-600">*</span>
                                  </span>
                                  <Input id="physicalAddressLine1" className={getAddModalInputClass(addForm.physicalAddressLine1.trim().length > 0)} placeholder="Please insert address line 1" value={addForm.physicalAddressLine1} onChange={(e) => setAddForm((prev) => ({ ...prev, physicalAddressLine1: e.target.value }))} />
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                                <div className="relative w-full max-w-none">
                                  <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                    Address Line 2
                                  </span>
                                  <Input id="physicalAddressLine2" className={getAddModalInputClass(addForm.physicalAddressLine2.trim().length > 0)} placeholder="Please insert address line 2" value={addForm.physicalAddressLine2} onChange={(e) => setAddForm((prev) => ({ ...prev, physicalAddressLine2: e.target.value }))} />
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                                <div className="relative w-full max-w-none">
                                  <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                    City <span className="text-red-600">*</span>
                                  </span>
                                  <Input id="homeCity" className={getAddModalInputClass(addForm.city.trim().length > 0)} placeholder="Please insert city" value={addForm.city} onChange={(e) => setAddForm((prev) => ({ ...prev, city: e.target.value }))} />
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                                <div className="relative w-full max-w-none">
                                  <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                    Province <span className="text-red-600">*</span>
                                  </span>
                                  <Select value={addForm.province} onValueChange={(value) => setAddForm((prev) => ({ ...prev, province: value as AddEmployeeFormState["province"] }))}>
                                    <SelectTrigger className={`${getAddModalSelectTriggerClass(addForm.province.trim().length > 0)} ${addModalDropdownToneClass}`}>
                                      <SelectValue placeholder="Please select province" />
                                    </SelectTrigger>
                                    <SelectContent className="text-[11px]">
                                      {southAfricanProvinces.map((province) => (
                                        <SelectItem key={province} value={province} className={employeeDropdownSelectItemClass}>
                                          {province}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                                <div className="relative w-full max-w-none">
                                  <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                    Area Code <span className="text-red-600">*</span>
                                  </span>
                                  <Input id="homeAreaCode" className={getAddModalInputClass(addForm.areaCode.trim().length > 0)} placeholder="Please insert area code" value={addForm.areaCode} onChange={(e) => setAddForm((prev) => ({ ...prev, areaCode: e.target.value }))} />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      </div>

                      <div className="mt-6 grid grid-cols-3 items-center border-t border-dashed border-muted/60 pt-4">
                        <div className="justify-self-start">
                          {addFormStep > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              className="h-[28px] w-[84px] rounded border-blue-600 px-3 text-xs text-blue-600 hover:bg-transparent hover:text-blue-600"
                              onClick={() => setAddFormStep((prev) => (prev === 1 ? prev : ((prev - 1) as 1 | 2 | 3)))}
                            >
                              Back
                            </Button>
                          )}
                        </div>
                        <div className="justify-self-center">
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-[30px] rounded border-0 px-3 text-xs text-slate-500 shadow-none hover:bg-transparent hover:text-slate-600 hover:underline"
                            onClick={handleAddFormClearStep}
                          >
                            Clear
                          </Button>
                        </div>
                        <div className="justify-self-end">
                          {addFormStep < 3 ? (
                            <Button
                              type="button"
                              className="h-[28px] w-[84px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700"
                              onClick={handleAddFormNext}
                              disabled={(addFormStep === 1 && !isAddFormStepOneComplete) || (addFormStep === 2 && !isAddFormStepTwoComplete)}
                            >
                              Next
                            </Button>
                          ) : (
                            <Button
                              type="submit"
                              className="h-[30px] w-[92px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700"
                              onClick={() => setIsAddFormSubmitRequested(true)}
                              disabled={isLoading || !isAddFormStepOneComplete || !isAddFormStepTwoComplete || !isAddFormStepThreeComplete}
                            >
                              {isLoading ? "Saving..." : rehireEmployeeId ? "Rehire" : "Add"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </section>
          </div>
        </div>
      </div>
      {isProfilePanelOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/65"
            aria-label="Close employee profile"
            onClick={closeProfileDialog}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <section className="relative z-10 w-full sm:w-[75vw] max-w-[980px] h-[92vh] rounded-sm bg-blue-50 shadow-2xl overflow-y-auto overflow-x-hidden">
              {renderProfilePanel()}
            </section>
          </div>
        </div>
      )}

      <Dialog
        open={isWarningDialogOpen}
        onOpenChange={(open) => {
          setIsWarningDialogOpen(open);
          if (!open) {
            resetWarningForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingWarning ? "Edit warning" : "Upload warning"}</DialogTitle>
            <DialogDescription>
              {editingWarning ? "Update this warning record." : "Add a warning record with auto-calculated validity."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="misconductType">Type of misconduct</Label>
              <Popover open={isMisconductMenuOpen} onOpenChange={handleMisconductMenuOpenChange}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left text-sm font-normal"
                    type="button"
                  >
                    {warningForm.misconductTypes.length === 0
                      ? "Select misconduct type(s)"
                      : `${warningForm.misconductTypes.length} selected`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[420px] p-4" align="start">
                  <div className="space-y-3">
                    <Input
                      placeholder="Search misconduct..."
                      className="h-9"
                      value={misconductSearch}
                      onChange={(e) => setMisconductSearch(e.target.value)}
                    />
                    <ScrollArea
                      className="h-48 rounded-md border border-muted"
                      onWheel={(event) => event.stopPropagation()}
                      onTouchMove={(event) => event.stopPropagation()}
                    >
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
                                  className={`flex items-center gap-2 text-sm cursor-pointer ${misconductColorClasses(
                                    item.category,
                                  )}`}
                                >
                                  <Checkbox
                                    checked={warningForm.misconductTypes.includes(item.name)}
                                    onCheckedChange={() => toggleWarningMisconduct(item.name)}
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
                    {warningForm.misconductTypes.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">Selected</p>
                        <div className="flex flex-wrap gap-2">
                          {warningForm.misconductTypes.map((type) => (
                            <Badge
                              key={type}
                              variant="secondary"
                              className={`gap-1 ${misconductColorClasses(getMisconductCategory(type))}`}
                            >
                              {type}
                              <X className="h-3 w-3 cursor-pointer" onClick={() => toggleWarningMisconduct(type)} />
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              {warningForm.misconductTypes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {warningForm.misconductTypes.map((type) => (
                    <Badge
                      key={type}
                      variant="secondary"
                      className={`gap-1 ${misconductColorClasses(getMisconductCategory(type))}`}
                    >
                      {type}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => toggleWarningMisconduct(type)} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type of warning</Label>
                <Select
                  value={warningForm.warningType}
                  onValueChange={(value) =>
                    setWarningForm((prev) => ({ ...prev, warningType: value as EmployeeWarning["warningType"] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select warning type" />
                  </SelectTrigger>
                  <SelectContent>
                <SelectItem value="First">First (6 months)</SelectItem>
                <SelectItem value="Second">Second (6 months)</SelectItem>
                <SelectItem value="Serious">Serious (9 months)</SelectItem>
                <SelectItem value="Final">Final (12 months)</SelectItem>
              </SelectContent>
            </Select>
          </div>
              <div className="space-y-2">
                <Label htmlFor="issueDate">Date of issue</Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={warningForm.issueDate}
                  onChange={(e) => setWarningForm((prev) => ({ ...prev, issueDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2 rounded-lg border border-dashed border-border/60 bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Validity</span>
                <Badge variant="outline" className="border-primary/30 text-primary">
                  {warningValidityMonths[warningForm.warningType]} months
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Auto expiry</span>
                <span className="font-semibold">
                  {formatDisplayDate(computeWarningExpiry(warningForm.warningType, warningForm.issueDate))}
                </span>
              </div>
            </div>
            {editingWarning ? (
              <p className="text-xs text-muted-foreground">
                Editing does not replace the file. Delete and re-upload to attach a new document.
              </p>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="warningFile">Upload signed warning (PDF only)</Label>
                <Input
                  id="warningFile"
                  type="file"
                  accept="application/pdf,.pdf"
                  required
                  onChange={handleWarningFileChange}
                />
                {warningForm.fileName && (
                  <p className="text-xs text-muted-foreground">Attached: {warningForm.fileName}</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="flex w-full justify-center sm:flex-row sm:justify-center sm:space-x-0">
            <Button
              onClick={handleSaveWarning}
              disabled={!canSaveWarning}
              className="w-48 justify-center py-3 text-base"
            >
              {editingWarning ? "Save" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isContractDialogOpen} onOpenChange={setIsContractDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload contract</DialogTitle>
            <DialogDescription>Add the signed employment contract for this employee.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Contract type</Label>
              <Select
                value={contractForm.contractType}
                onValueChange={(value) =>
                  setContractForm((prev) => ({ ...prev, contractType: value as ContractFormState["contractType"] }))
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
            <div className="space-y-2">
              <Label htmlFor="contractFile">Upload signed contract (PDF only)</Label>
              <Input
                id="contractFile"
                type="file"
                accept="application/pdf,.pdf"
                required
                onChange={handleContractFileChange}
              />
              {contractForm.fileName && <p className="text-xs text-muted-foreground">Attached: {contractForm.fileName}</p>}
            </div>
          </div>
          <DialogFooter className="flex w-full justify-center sm:flex-row sm:justify-center sm:space-x-0">
            <Button
              onClick={handleAddContract}
              disabled={!canUploadContract}
              className="w-48 justify-center py-3 text-base"
            >
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {deleteUndo && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <div className="relative flex items-center gap-3 rounded-full border border-blue-200 bg-white/95 px-4 py-2 text-sm font-medium text-blue-900 shadow-[0_6px_18px_rgba(59,130,246,0.3)] backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <span className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_25px_rgba(59,130,246,0.35)] animate-pulse" aria-hidden="true"></span>
            <div className="pointer-events-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-blue-900 hover:bg-transparent hover:text-blue-900 focus-visible:bg-transparent"
                onClick={handleUndoDelete}
              >
                Undo delete
                <span className="text-xs text-blue-600">{deleteUndoCountdown}s</span>
              </Button>
              <button
                type="button"
                className="text-blue-700 hover:text-blue-700 focus-visible:text-blue-700"
                onClick={clearDeleteUndoState}
                aria-label="Dismiss undo delete notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {warningDeleteUndo && (
        <div
          className={`pointer-events-none fixed inset-x-0 ${
            deleteUndo ? "top-20" : "top-4"
          } z-50 flex justify-center px-4`}
        >
          <div className="relative flex items-center gap-3 rounded-full border border-blue-200 bg-white/95 px-4 py-2 text-sm font-medium text-blue-900 shadow-[0_6px_18px_rgba(59,130,246,0.3)] backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <span className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_25px_rgba(59,130,246,0.35)] animate-pulse" aria-hidden="true"></span>
            <div className="pointer-events-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-blue-900 hover:bg-transparent hover:text-blue-900 focus-visible:bg-transparent"
                onClick={handleUndoWarningDelete}
              >
                Undo warning delete
                <span className="text-xs text-blue-600">{warningDeleteCountdown}s</span>
              </Button>
              <button
                type="button"
                className="text-blue-700 hover:text-blue-700 focus-visible:text-blue-700"
                onClick={clearWarningDeleteState}
                aria-label="Dismiss undo warning notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={Boolean(documentDialogEmployee)}
        onOpenChange={(open) => {
          if (!open) setDocumentDialogEmployee(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-blue-600 font-semibold uppercase tracking-wide text-sm">
              Documents
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select a document to generate for this employee.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-1">
              <Label htmlFor="document-select">Choose a document</Label>
              <Select
                value={selectedDocumentPath || ""}
                onValueChange={setSelectedDocumentPath}
              >
                <SelectTrigger id="document-select">
                  <SelectValue placeholder="Select a document to generate" />
                </SelectTrigger>
                <SelectContent>
                  {documentOptions.map((doc) => (
                    <SelectItem key={doc.path} value={doc.path} disabled={!doc.active}>
                      {doc.label} {!doc.active ? "(coming soon)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                const selected = documentOptions.find((d) => d.path === selectedDocumentPath);
                if (selected?.active) {
                  handleDocumentCategorySelect(selected.path);
                }
              }}
              disabled={!documentOptions.find((d) => d.path === selectedDocumentPath && d.active)}
            >
              Go
            </Button>
          </div>
        </DialogContent>
      </Dialog>
  </DashboardLayout>
);
 };

export default Employees;
















