/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, PointerEvent, SyntheticEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Trash2,
  Upload,
  FilePlus,
  FolderOpen,
  Paperclip,
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
  Camera,
  LogOut,
  TriangleAlert,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import { getSafeErrorMessage } from "@/lib/errorHandling";
import {
  CLIENT_NUMBER_MAX_LENGTH,
  contractTypes,
  citizenshipStatusOptions,
  clientImportSchema,
  clientProfileSchema,
  sanitizeText,
  sanitizeClientNumber,
  nationalityOptions,
  genderOptions,
  raceOptions,
  southAfricanProvinces,
  type ClientProfileFormData,
} from "@/lib/validation";
import { extractDobFromId } from "@/lib/validation";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
// Supabase types do not include client_warnings; cast to any for those calls to avoid type errors.
const warningTable = () => (supabase as any).from("client_warnings");
// Supabase types do not include membership_contracts; cast to any for those calls to avoid type errors.
const contractTable = () => (supabase as any).from("membership_contracts");
// Supabase types do not include client_id_documents; cast to any for those calls to avoid type errors.
const idDocumentTable = () => (supabase as any).from("client_id_documents");
// Supabase types do not include employee_licences; cast to any for those calls to avoid type errors.
const licenceTable = () => (supabase as any).from("employee_licences");
// Supabase types do not include client_education; cast to any for those calls to avoid type errors.
const educationTable = () => (supabase as any).from("client_education");
// Supabase types do not include client_termination_documents; cast to any for those calls to avoid type errors.
const terminationDocumentTable = () => (supabase as any).from("client_termination_documents");
// Supabase types do not include client_logos; cast to any for those calls to avoid type errors.
const clientLogoTable = () => (supabase as any).from("client_logos");
const clientTableSelectColumns = "*";
const clientSelectColumnsBase = "*";
const clientSelectColumnsWithTermination = "*";
const clientWriteAllowedColumns = new Set<string>([
  "id",
  "company_id",
  "created_at",
  "updated_at",
  "status",
  "client_name",
  "client_surname",
  "id_number",
  "company_type",
  "industry",
  "bargaining_council",
  "client_number",
  "gender",
  "race",
  "cell_number",
  "email",
]);

const pickClientWritePayload = (payload: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => clientWriteAllowedColumns.has(key) && value !== undefined),
  ) as Record<string, unknown>;

const cropClientLogoPadding = (dataUrl: string): Promise<string> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const sourceWidth = img.naturalWidth || img.width;
      const sourceHeight = img.naturalHeight || img.height;
      if (!sourceWidth || !sourceHeight) {
        resolve(dataUrl);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(dataUrl);
        return;
      }

      context.drawImage(img, 0, 0, sourceWidth, sourceHeight);
      const pixels = context.getImageData(0, 0, sourceWidth, sourceHeight).data;

      let left = sourceWidth;
      let top = sourceHeight;
      let right = -1;
      let bottom = -1;

      for (let y = 0; y < sourceHeight; y++) {
        for (let x = 0; x < sourceWidth; x++) {
          const index = (y * sourceWidth + x) * 4;
          const r = pixels[index];
          const g = pixels[index + 1];
          const b = pixels[index + 2];
          const a = pixels[index + 3];

          const isTransparent = a < 18;
          const isNearWhite = r > 246 && g > 246 && b > 246;
          if (isTransparent || isNearWhite) continue;

          if (x < left) left = x;
          if (y < top) top = y;
          if (x > right) right = x;
          if (y > bottom) bottom = y;
        }
      }

      if (right < left || bottom < top) {
        resolve(dataUrl);
        return;
      }

      const padding = Math.max(1, Math.round(Math.min(sourceWidth, sourceHeight) * 0.025));
      const cropX = Math.max(0, left - padding);
      const cropY = Math.max(0, top - padding);
      const cropWidth = Math.min(sourceWidth - cropX, right - left + 1 + padding * 2);
      const cropHeight = Math.min(sourceHeight - cropY, bottom - top + 1 + padding * 2);

      const croppedCanvas = document.createElement("canvas");
      croppedCanvas.width = cropWidth;
      croppedCanvas.height = cropHeight;
      const croppedContext = croppedCanvas.getContext("2d");
      if (!croppedContext) {
        resolve(dataUrl);
        return;
      }

      croppedContext.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      resolve(croppedCanvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });

type Client = Tables<"clients"> & {
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  contract_type?: string | null;
  probation_period?: string | null;
  retirement_age?: number | null;
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
  job_title?: string | null;
  gender?: string | null;
  race?: string | null;
  date_of_birth?: string | null;
  disability_status?: boolean | null;
  citizenship_status?: string | null;
  income_tax_number?: string | null;
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
  registration_number?: string | null;
  registered_name?: string | null;
  trading_as?: string | null;
  vat_number?: string | null;
  company_type?: string | null;
  industry?: string | null;
  bargaining_council?: string | null;
  payment_cycle?: string | null;
  renewal_date?: string | null;
  client_number?: string | null;
  member_types?: string[] | string | null;
  company_logo_url?: string | null;
  owner?: string | null;
  tel_cell?: string | null;
  client_email?: string | null;
  termination_reason?: string | null;
  previous_job_title?: string | null;
  terminated_at?: string | null;
};
type ClientInsert = TablesInsert<"clients"> & {
  contract_type?: string | null;
  job_title?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  probation_period?: string | null;
  retirement_age?: number | null;
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
  registration_number?: string | null;
  registered_name?: string | null;
  trading_as?: string | null;
  vat_number?: string | null;
  company_type?: string | null;
  industry?: string | null;
  bargaining_council?: string | null;
  payment_cycle?: string | null;
  renewal_date?: string | null;
  client_number?: string | null;
  member_types?: string[] | string | null;
  company_logo_url?: string | null;
  owner?: string | null;
  tel_cell?: string | null;
  client_email?: string | null;
  termination_reason?: string | null;
  previous_job_title?: string | null;
  terminated_at?: string | null;
};
type ClientUpdate = Partial<Client>;
type ClientTab = "personal" | "employment" | "address" | "licences" | "education" | "discipline" | "contracts";
type ProfileSectionKey =
  | "identity"
  | "companyStructure"
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
type ClientWarning = {
  id: string;
  misconductType: string;
  warningType: "First" | "Second" | "Serious" | "Final";
  issueDate: string;
  expiryDate: string;
  fileName?: string;
  fileUrl?: string;
};
type ClientContract = {
  id: string;
  contractType: string;
  issueDate: string;
  fileName?: string;
  fileUrl?: string;
  isActive: boolean;
};
type ClientIdDocument = {
  id: string;
  clientId: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
};
type ClientTerminationDocument = {
  id: string;
  clientId: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
};
type LicenceCategory = "driving" | "firearmSecurity" | "marineAviation";
type ClientLicence = {
  id: string;
  clientId: string;
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
type ClientEducation = {
  id: string;
  clientId: string;
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
  deletedClients: Client[];
  expiresAt: number;
};

type WarningDeleteUndoState = {
  warning: ClientWarning;
  clientId: string;
  storagePath?: string;
  expiresAt: number;
};
type TerminationUndoState = {
  clientId: string;
  clientBefore: Client;
  expiresAt: number;
};

type DocumentOption = {
  category: string;
  label: string;
  path: string;
  active: boolean;
};

type DocumentKey =
  | "warnings"
  | "permanentContract"
  | "temporaryContract"
  | "addendum"
  | "noticeTermination"
  | "illHealthTermination"
  | "abscondmentTermination"
  | "retrenchmentTermination"
  | "retirementTermination"
  | "poorPerformanceTermination"
  | "mutualTermination"
  | "disciplinaryHearingNotice"
  | "precautionarySuspensionNotice"
  | "contemplatedRetrenchmentNotice"
  | "incapacityPerformanceHearingNotice"
  | "incapacityIllHealthHearingNotice"
  | "serviceCertificate"
  | "acknowledgementOfDebt";

type ConductOffence = {
  category: "Minor" | "Serious" | "Dismissible";
  name: string;
  firstOutcome: string;
};

type WarningFormState = {
  misconductTypes: string[];
  warningType: ClientWarning["warningType"];
  issueDate: string;
  fileName: string;
};
type ContractFormState = {
  contractType: (typeof contractTypes)[number] | "";
  fileName: string;
};
type AddClientFormState = {
  clientName: string;
  clientSurname: string;
  registrationNumber: string;
  idNumber: string;
  clientNumber: string;
  gender: string;
  race: string;
  cellNumber: string;
  email: string;
  memberTypes: string[];
  contractType: string;
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

const cleanClientNumberInput = (value?: string | null) => sanitizeClientNumber(value);
const normalizeClientNumber = (value?: string | null) => (value || "").trim().toLowerCase();
const normalizeIdNumberValue = (value?: string | null) => (value || "").replace(/\s+/g, "").trim().toLowerCase();
const normalizeRegistrationNumberValue = (value?: string | null) =>
  formatRegistrationNumberInput((value || "").replace(/\s+/g, "")).trim().toLowerCase();

const DEFAULT_NATIONALITY: ClientProfileFormData["nationality"] = "South African";
const retirementAgeOptions = ["55", "60", "65", "70"] as const;
const dateToday = () => new Date().toISOString().split("T")[0];
const companyTypeOptions = ["Holding", "Subsidiary"] as const;
const saIndustryOptions = [
  "Agriculture, Forestry and Fishing",
  "Mining and Quarrying",
  "Manufacturing",
  "Electricity, Gas and Water Supply",
  "Construction",
  "Wholesale and Retail Trade",
  "Transport and Logistics",
  "Information and Communication Technology",
  "Financial and Insurance Activities",
  "Real Estate Activities",
  "Professional and Business Services",
  "Administrative and Support Services",
  "Public Administration and Defence",
  "Education",
  "Human Health and Social Work Activities",
  "Arts, Entertainment and Recreation",
  "Accommodation and Food Service Activities",
  "Other Service Activities",
] as const;
const saBargainingCouncilOptions = [
  "None",
  "National Bargaining Council for the Electrical Industry of South Africa (NBCEI)",
  "Metal and Engineering Industries Bargaining Council (MEIBC)",
  "Motor Industry Bargaining Council (MIBCO)",
  "National Bargaining Council for the Road Freight and Logistics Industry (NBCRFLI)",
  "National Bargaining Council for the Private Security Sector (NBCPSS)",
  "Bargaining Council for the Civil Engineering Industry (BCCEI)",
  "South African Road Passenger Bargaining Council (SARPBAC)",
  "National Textile Bargaining Council (NTBC)",
  "National Bargaining Council for the Clothing Manufacturing Industry (NBC)",
  "National Bargaining Council for the Leather Industry of South Africa (NBCLI)",
  "National Bargaining Council for the Wood and Paper Sector (NBCWPS)",
  "Bargaining Council for the Grain Industry (BCGI)",
  "National Bargaining Council for the Hairdressing, Cosmetology, Beauty and Skincare Industry (HCSBC)",
  "Motor Ferry Industry Bargaining Council of South Africa (MFIBC)",
  "Bargaining Council for the New Tyre Manufacturing Industry (BCNTMI)",
  "Transnet Bargaining Council (TBC)",
  "South African Local Government Bargaining Council (SALGBC)",
  "Education Labour Relations Council (ELRC)",
  "General Public Service Sectoral Bargaining Council (GPSSBC)",
  "Public Health and Social Development Sectoral Bargaining Council (PHSDSBC)",
  "Public Service Co-ordinating Bargaining Council (PSCBC)",
  "Safety and Security Sectoral Bargaining Council (SSSBC)",
] as const;
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
  "Clocking for another client",
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
  "Threatening another client",
  "Unauthorised possession of a weapon on duty",
];

// Remove local error extraction - now using centralized error handling

const createBlankAddForm = (): AddClientFormState => ({
  clientName: "",
  clientSurname: "",
  registrationNumber: "",
  idNumber: "",
  clientNumber: "",
  gender: "",
  race: "",
  cellNumber: "",
  email: "",
  memberTypes: [],
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

const createAddFormFromClient = (client: Client): AddClientFormState => {
  const dynamic = client as Record<string, unknown>;
  const idNumber = ((dynamic.vat_number as string | undefined) ?? client.id_number ?? "").trim();
  const paymentCycle = ((dynamic.payment_cycle as string | undefined) ?? client.contract_type ?? "").trim();
  const parsedMemberTypes = normalizeMemberTypes(client.member_types ?? client.department ?? client.job_title)
    .filter((value) => membershipTypeOptions.includes(value as (typeof membershipTypeOptions)[number]));

  return {
    clientName:
      ((dynamic.registered_name as string | undefined) ?? (dynamic.company_name as string | undefined) ?? client.client_name ?? "").trim(),
    clientSurname:
      ((dynamic.trading_as as string | undefined) ?? client.client_surname ?? "").trim(),
    registrationNumber: (client.registration_number ?? client.income_tax_number ?? "").trim(),
    idNumber,
    clientNumber: cleanClientNumberInput((dynamic.client_number as string | undefined) ?? client.client_number),
    gender: (client.owner ?? client.gender ?? "").trim(),
    race: (client.tel_cell ?? client.race ?? "").trim(),
    cellNumber: (client.client_email ?? client.email ?? client.cell_number ?? "").trim(),
    email: (client.client_email ?? client.email ?? "").trim(),
    memberTypes: parsedMemberTypes,
    contractType: paymentCycleOptions.includes(paymentCycle as (typeof paymentCycleOptions)[number])
      ? paymentCycle
      : "",
    startDate: (client.start_date ?? "").trim(),
    endDate:
      ((dynamic.renewal_date as string | undefined) ?? "").trim() ||
      addMonthsToIsoDate((client.start_date ?? "").trim(), 12),
    salaryType: coerceEnumValue(client.salary_type, salaryTypeOptions),
    basicSalary: (client.basic_salary ?? "").trim(),
    physicalAddressLine1: (client.physical_address_line1 ?? "").trim(),
    physicalAddressLine2: (client.physical_address_line2 ?? "").trim(),
    city: (client.city ?? "").trim(),
    province: coerceEnumValue(client.province, southAfricanProvinces),
    areaCode: (client.area_code ?? "").trim(),
    postalAddressLine1: (client.postal_address_line1 ?? "").trim(),
    postalAddressLine2: (client.postal_address_line2 ?? "").trim(),
    postalCity: (client.postal_city ?? "").trim(),
    postalProvince: coerceEnumValue(client.postal_province, southAfricanProvinces),
    postalAreaCode: (client.postal_area_code ?? "").trim(),
  };
};

const formatInputDate = (date: Date | null) => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addMonthsToIsoDate = (isoDate: string, months: number) => {
  if (!isoDate) return "";
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  const renewal = new Date(parsed);
  renewal.setMonth(renewal.getMonth() + months);
  return renewal.toISOString().slice(0, 10);
};

const createProfileFormFromClient = (client?: Client): ClientProfileFormData => {
  const dynamic = (client ?? {}) as Record<string, unknown>;
  const registeredName =
    ((dynamic.registered_name as string | undefined) ??
      (dynamic.company_name as string | undefined) ??
      client?.client_name ??
      "").trim();
  const tradingName =
    ((dynamic.trading_as as string | undefined) ?? client?.client_surname ?? "").trim();
  const vatNumber = ((dynamic.vat_number as string | undefined) ?? client?.id_number ?? "").trim();
  const registrationNumber = (client?.registration_number ?? client?.income_tax_number ?? "").trim();
  const companyType = ((dynamic.company_type as string | undefined) ?? client?.citizenship_status ?? "").trim();
  const ownerName = ((dynamic.owner as string | undefined) ?? client?.gender ?? "").trim();
  const ownerNumber = ((dynamic.tel_cell as string | undefined) ?? client?.race ?? "").trim();
  const ownerEmail =
    ((dynamic.client_email as string | undefined) ??
      client?.email ??
      client?.cell_number ??
      "").trim();
  const industry = ((dynamic.industry as string | undefined) ?? client?.industry ?? "").trim();
  const bargainingCouncil = (
    (dynamic.bargaining_council as string | undefined) ??
    client?.bargaining_council ??
    ""
  ).trim() || "None";
  const paymentCycle = ((dynamic.payment_cycle as string | undefined) ?? client?.contract_type ?? "").trim();
  const renewalDate = ((dynamic.renewal_date as string | undefined) ?? client?.end_date ?? "").trim();
  const clientNumber = ((dynamic.client_number as string | undefined) ?? client?.client_number ?? "").trim();
  const nationality = (client?.nationality ?? "").trim() || DEFAULT_NATIONALITY;
  const isSouthAfrican = nationality.toLowerCase() === "south african";
  const storedDob = client?.date_of_birth ?? "";
  const derivedDob =
    storedDob ||
    (isSouthAfrican ? formatInputDate(extractDobFromId(vatNumber)) : "");

  return {
    clientName: registeredName,
    clientSurname: tradingName,
    idNumber: vatNumber,
    dateOfBirth: derivedDob,
    startDate: client?.start_date ?? "",
    contractType:
      (coerceEnumValue(paymentCycle, contractTypes) as ClientProfileFormData["contractType"]) ??
      "Permanent",
    endDate: renewalDate,
    nationality,
    gender: ownerName as ClientProfileFormData["gender"],
    disabilityStatus: client?.disability_status ?? false,
    citizenshipStatus: companyType,
    industry,
    bargainingCouncil,
    race: ownerNumber as ClientProfileFormData["race"],
    clientNumber: cleanClientNumberInput(clientNumber),
    jobTitle: client?.job_title ?? "",
    physicalAddressLine1: client?.physical_address_line1 ?? "",
    physicalAddressLine2: client?.physical_address_line2 ?? "",
    city: client?.city ?? "",
    province: coerceEnumValue(client?.province, southAfricanProvinces) as ClientProfileFormData["province"],
    areaCode: client?.area_code ?? "",
    postalAddressLine1: client?.postal_address_line1 ?? "",
    postalAddressLine2: client?.postal_address_line2 ?? "",
    postalCity: client?.postal_city ?? "",
    postalProvince: coerceEnumValue(
      client?.postal_province,
      southAfricanProvinces,
    ) as ClientProfileFormData["postalProvince"],
    postalAreaCode: client?.postal_area_code ?? "",
    cellNumber: ownerEmail,
    email: ownerEmail,
    emergencyContactName: client?.emergency_contact_name ?? "",
    emergencyContactNumber: client?.emergency_contact_number ?? "",
    incomeTaxNumber: registrationNumber,
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

const removeWhitespace = (value: string) => value.replace(/\s+/g, "");

const getRegistrationDigits = (value: string) => value.replace(/\D/g, "").slice(0, 12);
const formatRegistrationNumberInput = (value: string) => {
  const digits = getRegistrationDigits(value);
  if (digits.length === 0) return "";
  if (digits.length < 4) return digits;

  const firstPart = digits.slice(0, 4);
  const secondPart = digits.slice(4, 10);
  const thirdPart = digits.slice(10, 12);

  if (digits.length === 4) return `${firstPart}/`;
  if (digits.length < 10) return `${firstPart}/${secondPart}`;
  if (digits.length === 10) return `${firstPart}/${secondPart}/`;
  return `${firstPart}/${secondPart}/${thirdPart}`;
};
const formatRegistrationNumberMaskDisplay = (value: string) => {
  return formatRegistrationNumberInput(value);
};
const getRegistrationNumberCaretPosition = (value: string) => {
  const digitCount = getRegistrationDigits(value).length;
  if (digitCount < 4) return digitCount;
  if (digitCount === 4) return 5;
  if (digitCount < 10) return digitCount + 1;
  if (digitCount === 10) return 12;
  return Math.min(digitCount + 2, 14);
};

const formatCompanyDisplayName = (companyName?: string | null, companyType?: string | null) => {
  const name = (companyName || "").trim();
  const type = (companyType || "").trim();
  if (!name && !type) return "";
  if (!name) return type;
  if (!type) return name;
  if (name.toLowerCase().includes(type.toLowerCase())) return name;
  return `${name} ${type}`;
};

const normalizeSalaryForStorage = (value: string) => {
  const sanitized = sanitizeSalaryInput(value);
  if (!sanitized) return "";
  const [rawIntegerPart = "", rawDecimalPart = ""] = sanitized.split(".");
  const integerPart = rawIntegerPart.length > 0 ? rawIntegerPart : "0";
  const decimalPart = rawDecimalPart.padEnd(2, "0").slice(0, 2);
  return `${integerPart}.${decimalPart}`;
};

const getClientDisplayName = (client: Partial<Client>) => {
  const dynamic = client as Record<string, unknown>;
  const tradingName =
    (dynamic.trading_as as string | undefined)?.trim() ||
    (client.client_surname ?? "").trim();
  const registeredName =
    (dynamic.registered_name as string | undefined)?.trim() ||
    (dynamic.company_name as string | undefined)?.trim() ||
    (client.client_name ?? "").trim();
  return tradingName || registeredName || "Client";
};

const getClientRegisteredName = (client: Partial<Client>) => {
  const dynamic = client as Record<string, unknown>;
  return (
    (dynamic.registered_name as string | undefined)?.trim() ||
    (dynamic.company_name as string | undefined)?.trim() ||
    (client.client_name ?? "").trim() ||
    getClientDisplayName(client)
  );
};

const getClientTradingName = (client: Partial<Client>) => {
  const dynamic = client as Record<string, unknown>;
  return (
    (dynamic.trading_as as string | undefined)?.trim() ||
    (client.client_surname ?? "").trim()
  );
};
const SLA_CONTRACT_TYPE = "Service Level Agreement (SLA)";

const normalizeMemberTypes = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const formatMemberTypesDisplay = (value: unknown): string => {
  const values = normalizeMemberTypes(value);
  return values.length > 0 ? values.join(", ") : "";
};

const getDisplayFileNameFromPath = (path?: string | null, fallback = "document.pdf") => {
  const raw = (path ?? "").split("/").pop() || "";
  if (!raw) return fallback;
  // Stored contract paths use: <clientUuid>-<timestamp>-<originalFileName>
  const withPrefixRemoved = raw.replace(/^[0-9a-f-]{36}-\d+-/i, "");
  return withPrefixRemoved || raw;
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
  "Client Relations",
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
  "Illness",
  "Performance",
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
const warningValidityMonths: Record<ClientWarning["warningType"], number> = {
  First: 6,
  Second: 6,
  Serious: 9,
  Final: 12,
};

const warningTypeLabels: Record<ClientWarning["warningType"], string> = {
  First: "First Written Warning",
  Second: "Second Written Warning",
  Serious: "Serious Written Warning",
  Final: "Final Written Warning",
};

const membershipTypeOptions = [
  "Labour Relations",
  "Employment Equity",
  "Payroll",
  "Health and Safety",
] as const;

const membershipTypeAcronyms: Record<(typeof membershipTypeOptions)[number], string> = {
  "Labour Relations": "LR",
  "Employment Equity": "EE",
  Payroll: "PR",
  "Health and Safety": "HS",
};
const membershipServiceSelectionOptions = ["Yes", "No"] as const;
const membershipStatusOptions = ["Active", "Suspended", "Cancelled", "Pending"] as const;
type ClientStatusValue = (typeof membershipStatusOptions)[number] | (typeof employmentStatusOptions)[number] | "";
type MembershipServiceSelection = (typeof membershipServiceSelectionOptions)[number];

const createDefaultMembershipServiceSelections = (): Record<(typeof membershipTypeOptions)[number], MembershipServiceSelection> =>
  membershipTypeOptions.reduce(
    (acc, service) => {
      acc[service] = "No";
      return acc;
    },
    {} as Record<(typeof membershipTypeOptions)[number], MembershipServiceSelection>,
  );

const createMembershipServiceSelectionsFromClient = (client?: Partial<Client> | null) => {
  const selectedServices = new Set(
    normalizeMemberTypes(client?.member_types ?? client?.department ?? client?.job_title),
  );
  return membershipTypeOptions.reduce(
    (acc, service) => {
      acc[service] = selectedServices.has(service) ? "Yes" : "No";
      return acc;
    },
    createDefaultMembershipServiceSelections(),
  );
};

const getDisplayMembershipStatus = (value?: string | null): ClientStatusValue => {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "active") return "Active";
  if (normalized === "inactive") return "Inactive";
  if (normalized === "suspended") return "Suspended";
  if (normalized === "cancelled") return "Cancelled";
  if (normalized === "pending") return "Pending";
  return "";
};

const paymentCycleOptions = ["Monthly", "Annual"] as const;

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

const getClientLogoStoragePathFromUrl = (url?: string | null) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    const marker = "/client-logos/";
    const idx = url.indexOf(marker);
    if (idx === -1) return "";
    return url.slice(idx + marker.length);
  }
  return url;
};

const getClientLogoPathFromRecord = (record?: Record<string, unknown> | null) => {
  if (!record) return "";
  const value = record.storage_path;
  return typeof value === "string" ? value.trim() : "";
};

const computeWarningExpiry = (warningType: ClientWarning["warningType"], issueDate: string) => {
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
    category: "Warnings",
    label: "Written Warning",
    path: "/documents/warnings",
    active: true,
  },
  {
    category: "Contracts",
    label: "Permanent Contract",
    path: "/documents/contracts/permanent",
    active: true,
  },
  {
    category: "Contracts",
    label: "Temporary Contract",
    path: "/documents/contracts/temporary",
    active: true,
  },
  {
    category: "Contracts",
    label: "Addendum",
    path: "/documents/contracts/addendum",
    active: true,
  },
  {
    category: "Terminations",
    label: "Misconduct",
    path: "/documents/terminations/misconduct",
    active: true,
  },
  {
    category: "Terminations",
    label: "Ill Health",
    path: "/documents/terminations/ill-health",
    active: true,
  },
  {
    category: "Terminations",
    label: "Poor Performance",
    path: "/documents/terminations/poor-performance",
    active: true,
  },
  {
    category: "Terminations",
    label: "Abscondment/Desertion",
    path: "/documents/terminations/abscondment",
    active: true,
  },
  {
    category: "Terminations",
    label: "Retrenchment",
    path: "/documents/terminations/retrenchment",
    active: true,
  },
  {
    category: "Terminations",
    label: "Retirement",
    path: "/documents/terminations/retirement",
    active: true,
  },
  {
    category: "Terminations",
    label: "Mutual Seperation Agreement",
    path: "/documents/terminations/mutual-separation",
    active: true,
  },
  {
    category: "Notices",
    label: "Disciplinary Hearing",
    path: "/documents/notices/disciplinary-hearing",
    active: true,
  },
  {
    category: "Notices",
    label: "Incapacity Hearing (Performance)",
    path: "/documents/notices/incapacity-performance-hearing",
    active: true,
  },
  {
    category: "Notices",
    label: "Incapacity Hearing (Ill health)",
    path: "/documents/notices/incapacity-ill-health-hearing",
    active: true,
  },
  {
    category: "Notices",
    label: "Precautionary Suspension",
    path: "/documents/notices/precautionary-suspension",
    active: true,
  },
  {
    category: "Notices",
    label: "Contemplated Retrenchment (S189)",
    path: "/documents/notices/contemplated-retrenchment",
    active: true,
  },
  {
    category: "Other",
    label: "Certificate of Service",
    path: "/documents/other/certificate-of-service",
    active: true,
  },
  {
    category: "Other",
    label: "Acknowledgement of Debt",
    path: "/documents/other/acknowledgement-of-debt",
    active: true,
  },
];

const documentPathToKey: Record<string, DocumentKey> = {
  "/documents/warnings": "warnings",
  "/documents/contracts/permanent": "permanentContract",
  "/documents/contracts/temporary": "temporaryContract",
  "/documents/contracts/addendum": "addendum",
  "/documents/terminations/misconduct": "noticeTermination",
  "/documents/terminations/ill-health": "illHealthTermination",
  "/documents/terminations/poor-performance": "poorPerformanceTermination",
  "/documents/terminations/abscondment": "abscondmentTermination",
  "/documents/terminations/retrenchment": "retrenchmentTermination",
  "/documents/terminations/retirement": "retirementTermination",
  "/documents/terminations/mutual-separation": "mutualTermination",
  "/documents/notices/disciplinary-hearing": "disciplinaryHearingNotice",
  "/documents/notices/incapacity-performance-hearing": "incapacityPerformanceHearingNotice",
  "/documents/notices/incapacity-ill-health-hearing": "incapacityIllHealthHearingNotice",
  "/documents/notices/precautionary-suspension": "precautionarySuspensionNotice",
  "/documents/notices/contemplated-retrenchment": "contemplatedRetrenchmentNotice",
  "/documents/other/certificate-of-service": "serviceCertificate",
  "/documents/other/acknowledgement-of-debt": "acknowledgementOfDebt",
};

const Clients = () => {
 const { user, loading } = useAuth();
 const location = useLocation();
 const navigate = useNavigate();
 const { toast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalClientCount, setTotalClientCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [clientStatusFilter, setClientStatusFilter] = useState<"active" | "inactive">("active");
  const [contractFilter, setContractFilter] = useState<"all" | "permanent" | "temporary">("all");
  const [genderFilter, setGenderFilter] = useState<"all" | ClientProfileFormData["gender"]>("all");
  const [raceFilter, setRaceFilter] = useState<"all" | ClientProfileFormData["race"]>("all");
  const [nationalityFilter, setNationalityFilter] = useState<"all" | "RSA" | "Other">("all");
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isNewClientMenuOpen, setIsNewClientMenuOpen] = useState(false);
  const [isFiltersPanelOpen, setIsFiltersPanelOpen] = useState(false);
  const [expandedFilterSection, setExpandedFilterSection] = useState<
    "status" | "contract" | "gender" | "race" | "nationality" | null
  >(null);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
 const [isProfilePanelOpen, setIsProfilePanelOpen] = useState(false);
   const [selectedClient, setSelectedClient] = useState<Client | null>(null);
   const [isLoading, setIsLoading] = useState(false);
  const [isClientsLoading, setIsClientsLoading] = useState(false);
  const [isExportingClientsPdf, setIsExportingClientsPdf] = useState(false);
  const [isExportingClientsExcel, setIsExportingClientsExcel] = useState(false);
  const [isAllClientsLoading, setIsAllClientsLoading] = useState(false);
   const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState<ClientTab>("personal");
  const [activeEditSection, setActiveEditSection] = useState<ProfileSectionKey | null>(null);
  const [addForm, setAddForm] = useState<AddClientFormState>(createBlankAddForm());
  const [isRegistrationNumberFocused, setIsRegistrationNumberFocused] = useState(false);
  const registrationNumberInputRef = useRef<HTMLInputElement | null>(null);
  const [addFormStep, setAddFormStep] = useState<1 | 2 | 3>(1);
  const [rehireClientId, setRehireClientId] = useState<string | null>(null);
  const [isAddFormSubmitRequested, setIsAddFormSubmitRequested] = useState(false);
  const [profileForm, setProfileForm] = useState<ClientProfileFormData>(createProfileFormFromClient());
  const [serviceSelections, setServiceSelections] = useState<
    Record<(typeof membershipTypeOptions)[number], MembershipServiceSelection>
  >(createDefaultMembershipServiceSelections());
  const [isWarningDialogOpen, setIsWarningDialogOpen] = useState(false);
  const [warningForm, setWarningForm] = useState<WarningFormState>({
    misconductTypes: [],
    warningType: "First",
    issueDate: dateToday(),
    fileName: "",
  });
  const [warningFilter, setWarningFilter] = useState<"valid" | "expired">("valid");
  const [warningFile, setWarningFile] = useState<File | null>(null);
  const [warningsByClient, setWarningsByClient] = useState<Record<string, ClientWarning[]>>({});
  const [editingWarning, setEditingWarning] = useState<ClientWarning | null>(null);
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
  const [contractsByClient, setContractsByClient] = useState<Record<string, ClientContract[]>>({});
  const [activeContractsByClient, setActiveContractsByClient] = useState<Record<string, boolean>>({});
  const [idDocumentByClient, setIdDocumentByClient] = useState<Record<string, ClientIdDocument | null>>({});
  const [pendingIdDocumentFile, setPendingIdDocumentFile] = useState<File | null>(null);
  const [pendingIdDocumentName, setPendingIdDocumentName] = useState("");
  const [isIdDocumentMarkedForRemoval, setIsIdDocumentMarkedForRemoval] = useState(false);
  const [isIdDocumentUploading, setIsIdDocumentUploading] = useState(false);
  const [isClientLogoUploading, setIsClientLogoUploading] = useState(false);
  const [clientLogoPreviewByClient, setClientLogoPreviewByClient] = useState<Record<string, string>>({});
  const [clientLogoPathByClient, setClientLogoPathByClient] = useState<Record<string, string>>({});
  const [terminationDocumentByClient, setTerminationDocumentByClient] = useState<Record<string, ClientTerminationDocument | null>>({});
  const [pendingTerminationDocumentFile, setPendingTerminationDocumentFile] = useState<File | null>(null);
  const [pendingTerminationDocumentName, setPendingTerminationDocumentName] = useState("");
  const [isTerminationDocumentUploading, setIsTerminationDocumentUploading] = useState(false);
  const [pendingEmploymentContractFile, setPendingEmploymentContractFile] = useState<File | null>(null);
  const [pendingEmploymentContractName, setPendingEmploymentContractName] = useState("");
  const [isEmploymentContractMarkedForRemoval, setIsEmploymentContractMarkedForRemoval] = useState(false);
  const [isEmploymentContractUploading, setIsEmploymentContractUploading] = useState(false);
  const [pendingSlaFile, setPendingSlaFile] = useState<File | null>(null);
  const [pendingSlaFileName, setPendingSlaFileName] = useState("");
  const [isSlaUploading, setIsSlaUploading] = useState(false);
  const [licencesByClient, setLicencesByClient] = useState<Record<string, ClientLicence[]>>({});
  const [licenceTypeSelection, setLicenceTypeSelection] = useState<Record<LicenceCategory, string>>({
    driving: "",
    firearmSecurity: "",
    marineAviation: "",
  });
  const [educationsByClient, setEducationsByClient] = useState<Record<string, ClientEducation[]>>({});
  const [educationTypeSelection, setEducationTypeSelection] = useState<Record<EducationCategory, string>>({
    academic: "",
    trade: "",
    training: "",
  });
  const [misconductSearch, setMisconductSearch] = useState("");
  const [isMisconductPickerOpen, setIsMisconductPickerOpen] = useState(false);
  const [warningDraftMisconductTypes, setWarningDraftMisconductTypes] = useState<string[]>([]);
  const [conductOffences, setConductOffences] = useState<ConductOffence[]>([]);
  const [hasLoadedAllClients, setHasLoadedAllClients] = useState(false);
  const [hasLoadedConductOffences, setHasLoadedConductOffences] = useState(false);
  const [employmentStatus, setEmploymentStatus] = useState<(typeof employmentStatusOptions)[number] | "">("");
  const [clientStatus, setClientStatus] = useState<ClientStatusValue>("");
  const [probationPeriod, setProbationPeriod] = useState("");
  const [retirementAge, setRetirementAge] = useState<(typeof retirementAgeOptions)[number]>("65");
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
  const [bargainingCouncilOpen, setBargainingCouncilOpen] = useState(false);
  const [bargainingCouncilQuery, setBargainingCouncilQuery] = useState("");
  const warningMisconductSearchInputRef = useRef<HTMLInputElement | null>(null);
  const warningFileInputRef = useRef<HTMLInputElement | null>(null);
  const warningIssueDateInputRef = useRef<HTMLInputElement | null>(null);
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
  const [documentDialogClient, setDocumentDialogClient] = useState<Client | null>(null);
  const [selectedDocumentPath, setSelectedDocumentPath] = useState<string>("");
  const newClientMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [deleteUndo, setDeleteUndo] = useState<DeleteUndoState | null>(null);
  const [deleteUndoCountdown, setDeleteUndoCountdown] = useState(0);
  const deleteUndoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteUndoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [warningDeleteUndo, setWarningDeleteUndo] = useState<WarningDeleteUndoState | null>(null);
  const [warningDeleteCountdown, setWarningDeleteCountdown] = useState(0);
  const warningDeleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningDeleteIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [terminationUndo, setTerminationUndo] = useState<TerminationUndoState | null>(null);
  const [terminationUndoCountdown, setTerminationUndoCountdown] = useState(0);
  const terminationUndoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const terminationUndoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isTerminateDialogOpen, setIsTerminateDialogOpen] = useState(false);
  const [pendingTerminationReason, setPendingTerminationReason] = useState("");
  const [pendingTerminationDate, setPendingTerminationDate] = useState(dateToday());
  const startDateInputRef = useRef<HTMLInputElement | null>(null);
  const endDateInputRef = useRef<HTMLInputElement | null>(null);
  const addModalStartDateInputRef = useRef<HTMLInputElement | null>(null);
  const addModalEndDateInputRef = useRef<HTMLInputElement | null>(null);
  const dateOfBirthInputRef = useRef<HTMLInputElement | null>(null);
  const terminationDateInputRef = useRef<HTMLInputElement | null>(null);
  const terminateModalDateInputRef = useRef<HTMLInputElement | null>(null);
  const terminateModalDocumentInputRef = useRef<HTMLInputElement | null>(null);
  const idPassportFileInputRef = useRef<HTMLInputElement | null>(null);
  const clientLogoFileInputRef = useRef<HTMLInputElement | null>(null);
  const employmentContractFileInputRef = useRef<HTMLInputElement | null>(null);
  const slaFileInputRef = useRef<HTMLInputElement | null>(null);
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
    companyStructure: null,
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
  const isAddFormRegistrationNumberComplete = addForm.registrationNumber.trim().length > 0;
  const isAddFormStepOneComplete =
    addForm.clientName.trim().length > 0 &&
    isAddFormRegistrationNumberComplete &&
    addForm.gender.trim().length > 0 &&
    addForm.race.trim().length > 0 &&
    addForm.cellNumber.trim().length > 0;
  const isAddFormStepTwoComplete =
    addForm.clientNumber.trim().length > 0 &&
    addForm.contractType.trim().length > 0 &&
    addForm.startDate.trim().length > 0 &&
    addForm.endDate.trim().length > 0 &&
    addForm.memberTypes.length > 0;
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
  // UI contract: all dropdown triggers/items on Clients page must use these shared classes.
  const clientDropdownTriggerClass = `${fieldSelectTriggerClass} w-full max-w-[320px] ml-auto bg-white border-slate-200 hover:border-blue-400 hover:bg-white hover:text-slate-700 data-[state=open]:border-slate-300 data-[state=open]:bg-white !ring-0 !ring-offset-0 !outline-none focus:!ring-0 focus:!ring-offset-0 focus:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 focus-visible:!outline-none data-[state=open]:!ring-0 data-[state=open]:!ring-offset-0 data-[state=open]:!outline-none`;
  const clientDropdownCommandItemClass =
    "w-full justify-start text-left text-[11px] text-slate-700 data-[selected=true]:bg-[#3eca44]/10 data-[selected=true]:text-[#2f9f35] data-[highlighted]:bg-[#3eca44]/10 data-[highlighted]:text-[#2f9f35]";
  const clientDropdownSelectItemClass =
    "text-[11px] text-slate-700 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[highlighted]:bg-[#3eca44]/10 data-[highlighted]:text-[#2f9f35] data-[state=checked]:text-slate-700 data-[state=checked]:data-[highlighted]:text-slate-700";
  const clientDropdownMenuItemClass =
    "cursor-pointer text-[11px] text-slate-700 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[highlighted]:bg-[#3eca44]/10 data-[highlighted]:text-[#2f9f35]";
  const membershipDropdownItemClass =
    "cursor-pointer text-[11px] text-slate-700 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[highlighted]:bg-[#3eca44]/10 data-[highlighted]:text-[#2f9f35]";
  const addModalSelectItemClass =
    "text-[11px] text-slate-700 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[highlighted]:bg-[#3eca44]/10 data-[highlighted]:text-[#2f9f35] [&_svg]:!text-[#2f9f35]";
  const clientDropdownMenuItemWithGapClass = `gap-2 ${clientDropdownMenuItemClass}`;
  const newClientDropdownItemStyle =
    "!rounded-none gap-2 cursor-pointer text-[11px] text-slate-700 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[highlighted]:bg-[#3eca44]/10 data-[highlighted]:text-[#2f9f35]";
  const newClientDropdownContentStyle = "w-36 text-[11px] !rounded-t-none !rounded-b-[4px] border-t-0 !p-0";
  const newClientButtonStyle1 =
    "h-8 w-36 justify-between rounded-[4px] px-3 text-[11px] inline-flex items-center border border-[#3eca44] bg-white text-[#3eca44] hover:bg-[#3eca44] hover:text-white data-[state=open]:rounded-b-none data-[state=open]:border-[#3eca44] data-[state=open]:bg-[#3eca44] data-[state=open]:text-white";
  const toolbarButtonStyle2Base =
    "h-8 w-24 justify-between rounded px-3 text-[11px] inline-flex items-center border border-slate-200 bg-white transition-colors hover:border-[#3eca44] hover:bg-white data-[state=open]:rounded-b-none data-[state=open]:border-[#3eca44]";
  const exportButtonStyle2 = `${toolbarButtonStyle2Base} text-slate-500 hover:text-[#3eca44] disabled:text-slate-300`;
  const filterButtonStyle2 = `${toolbarButtonStyle2Base} text-slate-700 hover:text-[#3eca44]`;
  const addModalDropdownToneClass =
    "bg-white border-slate-300 hover:border-slate-500 data-[state=open]:border-black data-[state=open]:bg-white";
  const addModalFieldInputClass = `${fieldInputClass} !h-[34px] !border-[0.5px] !border-slate-300 hover:!border-slate-500 focus:!border-black focus-visible:!border-black`;
  const addModalFieldSelectTriggerClass =
    `${fieldSelectTriggerClass} !h-[34px] !border-[0.5px] !border-slate-300 hover:!border-slate-500 focus:!border-black focus-visible:!border-black data-[state=open]:!border-black !ring-0 !ring-offset-0 !outline-none !shadow-none focus:!ring-0 focus:!ring-offset-0 focus:!shadow-none focus:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 focus-visible:!shadow-none focus-visible:!outline-none data-[state=open]:!ring-0 data-[state=open]:!ring-offset-0 data-[state=open]:!shadow-none data-[state=open]:!outline-none`;
  const getAddModalInputClass = (_isComplete: boolean) => addModalFieldInputClass;
  const getAddModalSelectTriggerClass = (_isComplete: boolean) => addModalFieldSelectTriggerClass;
  const isReadOnlyTab =
    activeTab === "discipline" || activeTab === "contracts" || activeTab === "licences" || activeTab === "education";
  const isSouthAfricanNationality = (profileForm.nationality || "").trim().toLowerCase() === "south african";

  const originalProfile = useMemo(
    () => (selectedClient ? createProfileFormFromClient(selectedClient) : null),
    [selectedClient],
  );
  const originalServiceSelections = useMemo(
    () => createMembershipServiceSelectionsFromClient(selectedClient),
    [selectedClient],
  );
  const originalProbationPeriod = useMemo(
    () => (selectedClient?.probation_period ?? ""),
    [selectedClient],
  );
  const originalRetirementAge = useMemo<(typeof retirementAgeOptions)[number]>(
    () => {
      const value = (selectedClient?.retirement_age ?? 65).toString();
      return (retirementAgeOptions.find((option) => option === value) ?? "65");
    },
    [selectedClient],
  );
  const originalUnionMember = useMemo(
    () => ((selectedClient?.union_member ?? "") as (typeof unionMemberOptions)[number] | ""),
    [selectedClient],
  );
  const originalTradeUnion = useMemo(
    () => (selectedClient?.trade_union ?? ""),
    [selectedClient],
  );
  const reportingToOptions = useMemo(() => {
    const source = allClients.length > 0 ? allClients : clients;
    return source
      .map((emp) => `${(emp.client_name ?? "").trim()} ${(emp.client_surname ?? "").trim()}`.trim())
      .filter(Boolean);
  }, [allClients, clients]);

  useEffect(() => {
    setServiceSelections(createMembershipServiceSelectionsFromClient(selectedClient));
  }, [selectedClient]);
  const [originalDepartment, setOriginalDepartment] = useState("");
  const [originalBranch, setOriginalBranch] = useState("");
  const [originalReportingTo, setOriginalReportingTo] = useState("");
  const [originalOccupationalLevel, setOriginalOccupationalLevel] = useState("");
  const [originalSalaryType, setOriginalSalaryType] = useState<(typeof salaryTypeOptions)[number] | "">("");
  const [originalBasicSalary, setOriginalBasicSalary] = useState("");
  const [originalWorkEmail, setOriginalWorkEmail] = useState("");
  const [originalWorkCellNumber, setOriginalWorkCellNumber] = useState("");
  const documentOptionsByCategory = useMemo(() => {
    const grouped = new Map<string, DocumentOption[]>();
    documentOptions.forEach((option) => {
      const existing = grouped.get(option.category) ?? [];
      existing.push(option);
      grouped.set(option.category, existing);
    });
    return Array.from(grouped.entries());
  }, []);
  const allocatedBranchNames = useMemo(() => {
    const normalized = branch
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    return Array.from(new Set(normalized));
  }, [branch]);
  const allocatedBranchDisplayValue = useMemo(() => {
    if (allocatedBranchNames.length === 0) return "Unassigned";
    if (allocatedBranchNames.length === 1) return allocatedBranchNames[0];
    return `${allocatedBranchNames.length} branches`;
  }, [allocatedBranchNames]);

  const fetchCompanyBranches = useCallback(async () => {
    if (!user) return;
    const [{ data: profileData, error: profileError }, { data: branchRows, error: branchError }] = await Promise.all([
      (supabase as any)
        .from("profiles")
        .select("branches_enabled, branches")
        .eq("id", user.id)
        .maybeSingle(),
      (supabase as any)
        .from("branches")
        .select("name")
        .eq("company_id", user.id)
        .order("name", { ascending: true }),
    ]);

    if (profileError) {
      const message = (profileError as { message?: string } | null)?.message ?? "";
      const isBranchColumnMissing = message.includes("branches_enabled");
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

    const branchesFromTable = Array.isArray(branchRows)
      ? branchRows
          .map((row: any) => String(row?.name ?? "").trim())
          .filter(Boolean)
      : [];

    const legacyBranches = Array.isArray(profileData?.branches)
      ? profileData.branches
          .map((value: unknown) => {
            if (typeof value === "string") {
              const raw = value.trim();
              if (raw.startsWith("{") && raw.endsWith("}")) {
                try {
                  const parsed = JSON.parse(raw) as Record<string, unknown>;
                  return String(parsed.name ?? "").trim();
                } catch {
                  return raw;
                }
              }
              return raw;
            }
            if (value && typeof value === "object") {
              const record = value as Record<string, unknown>;
              return String(record.name ?? "").trim();
            }
            return "";
          })
          .filter(Boolean)
      : [];

    if (branchError) {
      const message = String((branchError as { message?: string } | null)?.message ?? "").toLowerCase();
      const isTableMissing = message.includes("relation") && message.includes("branches");
      if (!isTableMissing) {
        toast({
          title: "Error",
          description: "Could not load branch list.",
          variant: "destructive",
        });
      }
    }

    const nextBranches = branchesFromTable.length > 0 ? branchesFromTable : legacyBranches;
    setCompanyBranchesEnabled(Boolean(profileData?.branches_enabled));
    setCompanyBranches(Array.from(new Set(nextBranches)));
  }, [toast, user]);

  useEffect(() => {
    if (!selectedClient) return;
    setOriginalDepartment((selectedClient.department as (typeof departmentOptions)[number]) ?? "");
    setOriginalBranch(selectedClient.branch ?? "");
    setOriginalReportingTo(selectedClient.reporting_to ?? "");
    setOriginalOccupationalLevel(
      (selectedClient.occupational_level as (typeof occupationalLevelOptions)[number]) ?? "",
    );
    setOriginalSalaryType((selectedClient.salary_type as (typeof salaryTypeOptions)[number]) ?? "");
    setOriginalBasicSalary(selectedClient.basic_salary ?? "");
    setOriginalWorkEmail(selectedClient.work_email ?? "");
    setOriginalWorkCellNumber(selectedClient.work_cell_number ?? "");
  }, [selectedClient]);

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
    setClientStatus(getDisplayMembershipStatus((selectedClient as any)?.status));
  }, [selectedClient]);

  const updateClientStatus = useCallback(
    async (nextStatus: "active" | "inactive") => {
      if (!selectedClient || !user) return;
      const statusPatch: ClientUpdate =
        nextStatus === "active"
          ? {
              status: nextStatus,
              termination_reason: null,
              previous_job_title: null,
              terminated_at: null,
            }
          : { status: nextStatus };

      const { error } = await supabase
        .from("clients")
        .update(pickClientWritePayload(statusPatch as Record<string, unknown>) as unknown as TablesInsert<"clients">)
        .eq("id", selectedClient.id);
      if (error) {
        toast({
          title: "Unable to update status",
          description: getSafeErrorMessage(error),
          variant: "destructive",
        });
        return;
      }

      const displayStatus = nextStatus === "inactive" ? "Inactive" : "Active";
      setClientStatus(displayStatus);
      setSelectedClient((prev) => (prev ? { ...prev, ...statusPatch } : prev));
      setClients((prev) =>
        prev.map((emp) => (emp.id === selectedClient.id ? { ...emp, ...statusPatch } : emp)),
      );
      setFilteredClients((prev) =>
        prev.map((emp) => (emp.id === selectedClient.id ? { ...emp, ...statusPatch } : emp)),
      );
      setAllClients((prev) =>
        prev.map((emp) => (emp.id === selectedClient.id ? { ...emp, ...statusPatch } : emp)),
      );

      toast({
        title: "Client status updated",
        description: `Status set to ${displayStatus}.`,
      });
    },
    [selectedClient, user, toast],
  );

  const handleTerminateWithReason = useCallback(
    async (reason: string, terminationDate: string) => {
      if (!selectedClient || !user) return;
      if (!reason.trim()) {
        toast({
          title: "Termination reason required",
          description: "Please select a termination reason.",
          variant: "destructive",
        });
        return false;
      }
      if (!terminationDate.trim()) {
        toast({
          title: "Termination date required",
          description: "Please select a termination date.",
          variant: "destructive",
        });
        return false;
      }
      const previousJobTitle = (profileForm.jobTitle || selectedClient.job_title || "").trim() || null;

      const employmentClearPatch: ClientUpdate = {
        status: "inactive",
        termination_reason: reason,
        previous_job_title: previousJobTitle,
        terminated_at: terminationDate,
        client_number: null,
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
          .eq("client_id", selectedClient.id);

        if (contractsLoadError) throw contractsLoadError;

        const { error: clientUpdateError } = await supabase
          .from("clients")
          .update(
            pickClientWritePayload(employmentClearPatch as Record<string, unknown>) as unknown as TablesInsert<"clients">,
          )
          .eq("id", selectedClient.id);

        if (clientUpdateError) throw clientUpdateError;

        if ((contractRows ?? []).length > 0) {
          const { error: deleteContractsError } = await contractTable()
            .delete()
            .eq("company_id", user.id)
            .eq("client_id", selectedClient.id);

          if (deleteContractsError) throw deleteContractsError;

          const storagePaths = ((contractRows ?? []) as Array<{ file_url?: string | null }>)
            .map((row) => getContractStoragePathFromUrl(row.file_url))
            .filter((path): path is string => !!path);

          if (storagePaths.length > 0) {
            await supabase.storage.from("contracts").remove(storagePaths);
          }
        }

        const nextSelected = { ...selectedClient, ...employmentClearPatch } as Client;
        setClientStatus("Inactive");
        setSelectedClient(nextSelected);
        setProfileForm(createProfileFormFromClient(nextSelected));
        setProbationPeriod("");
        setRetirementAge("65");
        setUnionMember("");
        setTradeUnion("");
        setPendingEmploymentContractFile(null);
        setPendingEmploymentContractName("");
        setIsEmploymentContractMarkedForRemoval(false);
        setContractsByClient((prev) => ({ ...prev, [selectedClient.id]: [] }));
        setActiveContractsByClient((prev) => ({ ...prev, [selectedClient.id]: false }));
        setClients((prev) =>
          prev.map((emp) => (emp.id === selectedClient.id ? { ...emp, ...employmentClearPatch } : emp)),
        );
        setFilteredClients((prev) =>
          prev.map((emp) => (emp.id === selectedClient.id ? { ...emp, ...employmentClearPatch } : emp)),
        );
        setAllClients((prev) =>
          prev.map((emp) => (emp.id === selectedClient.id ? { ...emp, ...employmentClearPatch } : emp)),
        );
        setTerminationUndo({
          clientId: selectedClient.id,
          clientBefore: selectedClient,
          expiresAt: Date.now() + 20000,
        });

        toast({
          title: "Client terminated",
          description: "Status set to Inactive. You can undo this action for 20 seconds.",
        });
        return true;
      } catch (error: unknown) {
        toast({
          title: "Unable to terminate client",
          description: getSafeErrorMessage(error),
          variant: "destructive",
        });
        return false;
      }
    },
    [profileForm.jobTitle, selectedClient, toast, user],
  );

  const openTerminationDialog = useCallback(() => {
    setPendingTerminationReason("");
    setPendingTerminationDate(dateToday());
    setPendingTerminationDocumentFile(null);
    setPendingTerminationDocumentName("");
    setIsTerminateDialogOpen(true);
  }, []);

  const handleTerminateModalDocumentFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
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
    },
    [toast],
  );

  const isProfileDirty = useMemo(() => {
    if (!originalProfile) return false;
    return (Object.keys(originalProfile) as Array<keyof ClientProfileFormData>).some(
      (key) => profileForm[key] !== originalProfile[key],
    );
  }, [profileForm, originalProfile]);

  const sectionDirty = useMemo(() => {
    if (!originalProfile) {
      return {
        identity: false,
        companyStructure: false,
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
    const compare = (keys: Array<keyof ClientProfileFormData>) =>
      keys.some((key) => profileForm[key] !== originalProfile[key]);
    return {
      identity: compare([
        "clientName",
        "clientSurname",
        "idNumber",
        "nationality",
        "dateOfBirth",
      ]) || !!pendingIdDocumentFile || isIdDocumentMarkedForRemoval,
      companyStructure: compare(["citizenshipStatus", "industry", "bargainingCouncil"]),
      equity: compare(["race", "gender", "disabilityStatus"]),
      contact: compare(["cellNumber", "email", "emergencyContactName", "emergencyContactNumber"]),
      statutory: compare(["incomeTaxNumber"]),
      employmentStatus:
        compare(["startDate", "endDate", "clientNumber"]) ||
        clientStatus !== getDisplayMembershipStatus((selectedClient as any)?.status),
      employmentOrg:
        membershipTypeOptions.some(
          (service) => serviceSelections[service] !== originalServiceSelections[service],
        ),
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
    retirementAge,
    originalRetirementAge,
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
    clientStatus,
    selectedClient,
    serviceSelections,
    originalServiceSelections,
    pendingIdDocumentFile,
    isIdDocumentMarkedForRemoval,
  ]);

  const identitySectionSchema = useMemo(
    () => ({ parse: (data: ClientProfileFormData) => data }),
    [],
  );

  const companyStructureSectionSchema = useMemo(
    () => ({ parse: (data: ClientProfileFormData) => data }),
    [],
  );

  const equitySectionSchema = useMemo(
    () => ({ parse: (data: ClientProfileFormData) => data }),
    [],
  );

  const contactSectionSchema = useMemo(
    () => ({ parse: (data: ClientProfileFormData) => data }),
    [],
  );

  const statutorySectionSchema = useMemo(
    () => ({ parse: (data: ClientProfileFormData) => data }),
    [],
  );

  const employmentSectionSchema = useMemo(
    () => ({ parse: (data: ClientProfileFormData) => data }),
    [],
  );

  const homeAddressSectionSchema = useMemo(
    () => ({ parse: (data: ClientProfileFormData) => data }),
    [],
  );

  const postalAddressSectionSchema = useMemo(
    () => ({ parse: (data: ClientProfileFormData) => data }),
    [],
  );

  const totalPages = Math.max(1, Math.ceil(totalClientCount / DEFAULT_PAGE_SIZE));
  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage >= totalPages;
  const tableBottomPaddingPx = -42;
  const tableBodyResponsiveHeight = `calc(100dvh - var(--app-header-height,5rem) - ${320 + tableBottomPaddingPx}px)`;
  const tableRangeStart = totalClientCount === 0 ? 0 : (currentPage - 1) * DEFAULT_PAGE_SIZE + 1;
  const tableRangeEnd =
    totalClientCount === 0
      ? 0
      : Math.min((currentPage - 1) * DEFAULT_PAGE_SIZE + filteredClients.length, totalClientCount);
  const paginationItems = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1) as Array<number | "...">;
    }

    if (currentPage <= 3) {
      return [1, 2, 3, 4, "...", totalPages];
    }

    if (currentPage >= totalPages - 2) {
      return [1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
  }, [currentPage, totalPages]);
  const activeClientFilterCount =
    Number(clientStatusFilter !== "active") +
    Number(contractFilter !== "all") +
    Number(genderFilter !== "all") +
    Number(raceFilter !== "all") +
    Number(nationalityFilter !== "all");
  const closeClientFiltersPanel = () => {
    setIsFiltersPanelOpen(false);
    setExpandedFilterSection(null);
  };
  const hasClientTableFiltersApplied =
    searchQuery.trim().length > 0 ||
    clientStatusFilter !== "active" ||
    contractFilter !== "all" ||
    genderFilter !== "all" ||
    raceFilter !== "all" ||
    nationalityFilter !== "all";

  useEffect(() => {
    if (!isRegistrationNumberFocused) return;
    const input = registrationNumberInputRef.current;
    if (!input) return;
    const position = getRegistrationNumberCaretPosition(addForm.registrationNumber);
    requestAnimationFrame(() => {
      input.setSelectionRange(position, position);
    });
  }, [isRegistrationNumberFocused, addForm.registrationNumber]);

  const handleDocumentCategorySelect = (path: string, targetClientOverride?: Client | null) => {
    const targetClient = targetClientOverride || selectedClient;
    const selectedDocument = documentPathToKey[path];
    const state = {
      ...(targetClient
        ? {
            clientName: (targetClient.client_name ?? "").trim(),
            clientSurname: (targetClient.client_surname ?? "").trim(),
            clientIdNumber: targetClient.id_number ?? "",
          }
        : {}),
      ...(selectedDocument ? { selectedDocument } : {}),
    };
    setDocumentDialogClient(null);
    if (selectedDocument) {
      navigate("/documents", { state });
      return;
    }
    navigate(path, { state: Object.keys(state).length > 0 ? state : undefined });
  };

  useEffect(() => {
    if (documentDialogClient) {
      setSelectedDocumentPath("");
    }
  }, [documentDialogClient]);

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
  }, [filteredClients]);

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
    if (!warningDeleteUndo || !selectedClient || !user) return;
    const { warning, clientId } = warningDeleteUndo;
    const { error } = await warningTable().insert({
      id: warning.id,
      company_id: user.id,
      client_id: clientId,
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
    setWarningsByClient((prev) => {
      const existing = prev[clientId] ?? [];
      return {
        ...prev,
        [clientId]: [warning, ...existing],
      };
    });
    clearWarningDeleteState();
    toast({
      title: "Warning restored",
      description: "The warning has been restored.",
    });
  };

  const clearTerminationUndoTimers = useCallback(() => {
    if (terminationUndoTimeoutRef.current) {
      clearTimeout(terminationUndoTimeoutRef.current);
      terminationUndoTimeoutRef.current = null;
    }
    if (terminationUndoIntervalRef.current) {
      clearInterval(terminationUndoIntervalRef.current);
      terminationUndoIntervalRef.current = null;
    }
  }, []);

  const clearTerminationUndoState = useCallback(() => {
    clearTerminationUndoTimers();
    setTerminationUndo(null);
    setTerminationUndoCountdown(0);
  }, [clearTerminationUndoTimers]);

  const startTerminationUndoTimers = useCallback(
    (pending: TerminationUndoState) => {
      clearTerminationUndoTimers();
      setTerminationUndo(pending);
      const updateCountdown = () => {
        const remaining = Math.max(0, Math.ceil((pending.expiresAt - Date.now()) / 1000));
        setTerminationUndoCountdown(remaining);
      };
      updateCountdown();
      terminationUndoIntervalRef.current = setInterval(updateCountdown, 1000);
      terminationUndoTimeoutRef.current = setTimeout(() => {
        clearTerminationUndoState();
      }, Math.max(0, pending.expiresAt - Date.now()));
    },
    [clearTerminationUndoState, clearTerminationUndoTimers],
  );

  const handleUndoTermination = useCallback(async () => {
    if (!terminationUndo || !user) return;
    const { clientBefore, clientId } = terminationUndo;
    const snapshot = clientBefore as any;
    const {
      id: _id,
      company_id: _companyId,
      created_at: _createdAt,
      updated_at: _updatedAt,
      ...updatePayload
    } = snapshot;

    const { error } = await supabase
      .from("clients")
      .update(pickClientWritePayload(updatePayload as Record<string, unknown>) as TablesInsert<"clients">)
      .eq("id", clientId)
      .eq("company_id", user.id);

    if (error) {
      toast({
        title: "Unable to undo termination",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
      return;
    }

    const restored = clientBefore;
    setSelectedClient((prev) => (prev && prev.id === clientId ? restored : prev));
    setProfileForm((prev) => (selectedClient?.id === clientId ? createProfileFormFromClient(restored) : prev));
    setClients((prev) => prev.map((emp) => (emp.id === clientId ? { ...emp, ...restored } : emp)));
    setFilteredClients((prev) => prev.map((emp) => (emp.id === clientId ? { ...emp, ...restored } : emp)));
    setAllClients((prev) => prev.map((emp) => (emp.id === clientId ? { ...emp, ...restored } : emp)));

    const restoredStatus = ((restored as any).status ?? "").toString().toLowerCase();
    setClientStatus(restoredStatus === "inactive" ? "Inactive" : "Active");
    clearTerminationUndoState();
    toast({
      title: "Termination undone",
      description: "Client status and employment details were restored.",
    });
  }, [clearTerminationUndoState, selectedClient?.id, terminationUndo, toast, user]);

  useEffect(() => {
    if (terminationUndo) {
      startTerminationUndoTimers(terminationUndo);
    } else {
      clearTerminationUndoTimers();
      setTerminationUndoCountdown(0);
    }
    return () => {
      clearTerminationUndoTimers();
    };
  }, [terminationUndo, startTerminationUndoTimers, clearTerminationUndoTimers]);

  const isPdfFile = (fileName?: string) => fileName?.toLowerCase().endsWith(".pdf") ?? false;

  const canSaveWarning =
    !!selectedClient &&
    warningForm.misconductTypes.length > 0 &&
    warningForm.issueDate.trim().length > 0 &&
    (editingWarning ? !!editingWarning.fileUrl : isPdfFile(warningForm.fileName) && !!warningFile);
  const fetchWarnings = useCallback(
    async (clientId: string) => {
      if (!user) return;
      const { data, error } = await warningTable()
        .select("id, misconduct_type, warning_type, issue_date, expiry_date, file_url")
        .eq("company_id", user.id)
        .eq("client_id", clientId)
        .order("issue_date", { ascending: false });

      if (error) {
        toast({
          title: "Unable to load warnings",
          description: getSafeErrorMessage(error),
          variant: "destructive",
        });
        return;
      }

      const mapped: ClientWarning[] =
        (data ?? []).map((row: any) => ({
          id: row.id,
          misconductType: row.misconduct_type,
          warningType: row.warning_type,
          issueDate: row.issue_date,
          expiryDate: row.expiry_date,
          fileName: row.file_url ? row.file_url.split("/").pop() || "warning.pdf" : "",
          fileUrl: row.file_url,
        })) ?? [];

      setWarningsByClient((prev) => ({
        ...prev,
        [clientId]: mapped,
      }));
    },
    [toast, user],
  );

  useEffect(() => {
    if (selectedClient) {
      fetchWarnings(selectedClient.id);
    }
  }, [selectedClient, fetchWarnings]);

  const resetWarningForm = () => {
    setWarningForm({
      misconductTypes: [],
      warningType: "First",
      issueDate: dateToday(),
      fileName: "",
    });
    setWarningFile(null);
    setEditingWarning(null);
    setIsMisconductPickerOpen(false);
    setWarningDraftMisconductTypes([]);
    setMisconductSearch("");
  };

  const handleSaveWarning = async () => {
    const isEditing = !!editingWarning;
    if (!selectedClient || !user) {
      toast({
        title: "No client selected",
        description: "Select a client before adding a warning.",
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
      const filePath = `${user.id}/${selectedClient.id}-${Date.now()}-${safeName}`;

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
        client_id: selectedClient.id,
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

    await fetchWarnings(selectedClient.id);
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

  const clearWarningFileSelection = () => {
    setWarningForm((prev) => ({ ...prev, fileName: "" }));
    setWarningFile(null);
    if (warningFileInputRef.current) {
      warningFileInputRef.current.value = "";
    }
  };

  const openSelectedWarningFile = () => {
    if (!warningFile) return;
    const objectUrl = URL.createObjectURL(warningFile);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  };

  const goToWarningGenerator = () => {
    if (!selectedClient) {
      toast({
        title: "No client selected",
        description: "Open a client profile before generating a warning.",
        variant: "destructive",
      });
      return;
    }

    navigate("/documents/discipline/warnings", {
      state: {
        clientName: selectedClient.client_name ?? "",
        clientSurname: selectedClient.client_surname ?? "",
        clientIdNumber: selectedClient.id_number ?? "",
      },
    });
  };

  const handleDeleteWarning = async (warningId: string, fileUrl?: string) => {
    if (!selectedClient || !user) return;
    const confirmed = confirm("Are you sure you want to delete this warning?");
    if (!confirmed) return;
    const existing = warningsByClient[selectedClient.id] ?? [];
    const warning = existing.find((w) => w.id === warningId);
    if (!warning) return;

    // Optimistically remove from UI
    const next = existing.filter((w) => w.id !== warningId);
    setWarningsByClient((prev) => ({
      ...prev,
      [selectedClient.id]: next,
    }));

    const storagePath = getStoragePathFromUrl(fileUrl);

    // Delete from DB immediately
    const { error: deleteError } = await warningTable()
      .delete()
      .eq("id", warningId)
      .eq("company_id", user.id);

    if (deleteError) {
      // revert
      setWarningsByClient((prev) => ({
        ...prev,
        [selectedClient.id]: existing,
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
      clientId: selectedClient.id,
      storagePath,
      expiresAt,
    });

    toast({
      title: "Warning deleted",
      description: "You can undo this for 20 seconds.",
    });
  };

  const handleOpenWarning = async (warning: ClientWarning) => {
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

  const handleEditWarning = (warning: ClientWarning) => {
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

  const warningsForSelectedClient = useMemo(
    () => (selectedClient ? warningsByClient[selectedClient.id] ?? [] : []),
    [selectedClient, warningsByClient],
  );

  const warningsByStatus = useMemo(() => {
    const todayISO = dateToday();
    const isValid = (warning: ClientWarning) => warning.expiryDate && warning.expiryDate >= todayISO;
    return {
      valid: warningsForSelectedClient.filter(isValid),
      expired: warningsForSelectedClient.filter((w) => !isValid(w)),
    };
  }, [warningsForSelectedClient]);

  const canUploadContract =
    !!selectedClient &&
    contractForm.contractType.trim().length > 0 &&
    isPdfFile(contractForm.fileName) &&
    !!contractFile;

  const fetchContracts = useCallback(
    async (clientId: string) => {
      if (!user) return;
      const { data, error } = await contractTable()
        .select("id, contract_type, issue_date, file_url, is_active")
        .eq("company_id", user.id)
        .eq("client_id", clientId)
        .order("issue_date", { ascending: false });

      if (error) {
        toast({
          title: "Unable to load contracts",
          description: getSafeErrorMessage(error),
          variant: "destructive",
        });
        return;
      }

      const mapped: ClientContract[] =
        (data ?? []).map((row: any) => ({
          id: row.id,
          contractType: row.contract_type,
          issueDate: row.issue_date,
          fileName: getDisplayFileNameFromPath(row.file_url, "contract.pdf"),
          fileUrl: row.file_url,
          isActive: row.is_active ?? false,
        })) ?? [];

      setContractsByClient((prev) => ({
        ...prev,
        [clientId]: mapped,
      }));
    },
    [toast, user],
  );

  const fetchActiveContractsForClients = useCallback(
    async (clientIds: string[]) => {
      if (!user) return;
      if (clientIds.length === 0) {
        setActiveContractsByClient({});
        return;
      }

      const { data, error } = await contractTable()
        .select("client_id")
        .eq("company_id", user.id)
        .eq("is_active", true)
        .in("client_id", clientIds);

      if (error) {
        toast({
          title: "Unable to load contract status",
          description: getSafeErrorMessage(error),
          variant: "destructive",
        });
        return;
      }

      const activeIds = new Set((data ?? []).map((row: any) => row.client_id));
      const next: Record<string, boolean> = {};
      clientIds.forEach((id) => {
        next[id] = activeIds.has(id);
      });
      setActiveContractsByClient(next);
    },
    [toast, user],
  );

  useEffect(() => {
    if (selectedClient) {
      fetchContracts(selectedClient.id);
    }
  }, [selectedClient, fetchContracts]);

  const fetchIdDocument = useCallback(
    async (clientId: string) => {
      if (!user) return;
      const { data, error } = await idDocumentTable()
        .select("id, client_id, file_name, file_url, uploaded_at")
        .eq("company_id", user.id)
        .eq("client_id", clientId)
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

      const mapped: ClientIdDocument | null = data
        ? {
            id: data.id,
            clientId: data.client_id,
            fileName: data.file_name || "document.pdf",
            fileUrl: data.file_url || "",
            uploadedAt: data.uploaded_at || "",
          }
        : null;

      setIdDocumentByClient((prev) => ({
        ...prev,
        [clientId]: mapped,
      }));
    },
    [toast, user],
  );

  useEffect(() => {
    if (selectedClient) {
      fetchIdDocument(selectedClient.id);
    }
  }, [fetchIdDocument, selectedClient]);

  const fetchTerminationDocument = useCallback(
    async (clientId: string) => {
      if (!user) return;
      const { data, error } = await terminationDocumentTable()
        .select("id, client_id, file_name, file_url, uploaded_at")
        .eq("company_id", user.id)
        .eq("client_id", clientId)
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

      const mapped: ClientTerminationDocument | null = data
        ? {
            id: data.id,
            clientId: data.client_id,
            fileName: data.file_name || "document.pdf",
            fileUrl: data.file_url || "",
            uploadedAt: data.uploaded_at || "",
          }
        : null;

      setTerminationDocumentByClient((prev) => ({
        ...prev,
        [clientId]: mapped,
      }));
    },
    [toast, user],
  );

  useEffect(() => {
    if (selectedClient) {
      fetchTerminationDocument(selectedClient.id);
    }
  }, [fetchTerminationDocument, selectedClient]);

  const handleAddContract = async () => {
    if (!selectedClient || !user) {
      toast({
        title: "No client selected",
        description: "Select a client before adding a contract.",
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
    const filePath = `${user.id}/${selectedClient.id}-${Date.now()}-${safeName}`;
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
        client_id: selectedClient.id,
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
        .eq("client_id", selectedClient.id)
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

    await fetchContracts(selectedClient.id);
    void fetchActiveContractsForClients(clients.map((client) => client.id));
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
    if (!selectedClient || !user) return;
    const confirmed = confirm("Are you sure you want to delete this contract?");
    if (!confirmed) return;
    const existing = contractsByClient[selectedClient.id] ?? [];
    const contract = existing.find((item) => item.id === contractId);
    if (!contract) return;

    setContractsByClient((prev) => ({
      ...prev,
      [selectedClient.id]: existing.filter((item) => item.id !== contractId),
    }));

    const { error: deleteError } = await contractTable()
      .delete()
      .eq("id", contractId)
      .eq("company_id", user.id);

    if (deleteError) {
      setContractsByClient((prev) => ({
        ...prev,
        [selectedClient.id]: existing,
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

    void fetchActiveContractsForClients(clients.map((client) => client.id));
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

  const handleOpenContract = async (contract: ClientContract) => {
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
    async (clientId: string) => {
      if (!user) return;
      const existingContract = (contractsByClient[clientId] ?? []).find((contract) => contract.isActive) ?? null;
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

      setContractsByClient((prev) => ({
        ...prev,
        [clientId]: (prev[clientId] ?? []).filter((contract) => contract.id !== existingContract.id),
      }));
      setIsEmploymentContractMarkedForRemoval(false);
    },
    [contractsByClient, user],
  );

  const uploadPendingEmploymentContract = useCallback(
    async (clientId: string) => {
      if (!pendingEmploymentContractFile || !user) return;
      setIsEmploymentContractUploading(true);
      try {
        const safeName = pendingEmploymentContractFile.name.replace(/\s+/g, "_");
        const filePath = `${user.id}/${clientId}-${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("contracts").upload(filePath, pendingEmploymentContractFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: pendingEmploymentContractFile.type || "application/pdf",
        });

        if (uploadError) throw uploadError;

        const { data: inserted, error: insertError } = await contractTable()
          .insert({
            company_id: user.id,
            client_id: clientId,
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
            .eq("client_id", clientId)
            .neq("id", inserted.id)
            .eq("is_active", true);

          if (deactivateError) throw deactivateError;
        }

        await fetchContracts(clientId);
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
    if (!selectedClient) return;
    const activeContract =
      (contractsByClient[selectedClient.id] ?? []).find((contract) => contract.isActive) ?? null;
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

  const uploadPendingSlaDocument = useCallback(
    async (clientId: string) => {
      if (!pendingSlaFile || !user) return;
      setIsSlaUploading(true);
      try {
        const existingSla =
          (contractsByClient[clientId] ?? []).find((contract) => contract.contractType === SLA_CONTRACT_TYPE) ?? null;
        if (existingSla) {
          const { error: deleteError } = await contractTable().delete().eq("id", existingSla.id).eq("company_id", user.id);
          if (deleteError) throw deleteError;
          const existingStoragePath = getContractStoragePathFromUrl(existingSla.fileUrl);
          if (existingStoragePath) {
            await supabase.storage.from("contracts").remove([existingStoragePath]);
          }
        }

        const safeName = pendingSlaFile.name.replace(/\s+/g, "_");
        const filePath = `${user.id}/sla/${clientId}-${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("contracts").upload(filePath, pendingSlaFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: pendingSlaFile.type || "application/pdf",
        });
        if (uploadError) throw uploadError;

        const { error: insertError } = await contractTable().insert({
          company_id: user.id,
          client_id: clientId,
          contract_type: SLA_CONTRACT_TYPE,
          issue_date: dateToday(),
          file_url: filePath,
          is_active: false,
        });
        if (insertError) throw insertError;

        await fetchContracts(clientId);
        setPendingSlaFile(null);
        setPendingSlaFileName("");
      } finally {
        setIsSlaUploading(false);
      }
    },
    [contractsByClient, fetchContracts, pendingSlaFile, user],
  );

  const handleSlaFileChange = (event: ChangeEvent<HTMLInputElement>) => {
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
    setPendingSlaFile(file);
    setPendingSlaFileName(file.name);
    setActiveEditSection("employmentStatus");
    event.target.value = "";
  };

  const handleRemoveSlaDocument = useCallback(async () => {
    if (!selectedClient || !user) return;
    const slaContract =
      (contractsByClient[selectedClient.id] ?? []).find((contract) => contract.contractType === SLA_CONTRACT_TYPE) ?? null;
    if (!slaContract) return;

    const confirmed = confirm(
      `Are you sure you want to delete ${slaContract.fileName} because it will be permanently removed from all databases.`,
    );
    if (!confirmed) return;

    setIsSlaUploading(true);
    try {
      const { error: deleteError } = await contractTable().delete().eq("id", slaContract.id).eq("company_id", user.id);
      if (deleteError) throw deleteError;
      const storagePath = getContractStoragePathFromUrl(slaContract.fileUrl);
      if (storagePath) {
        await supabase.storage.from("contracts").remove([storagePath]);
      }
      await fetchContracts(selectedClient.id);
      setPendingSlaFile(null);
      setPendingSlaFileName("");
      toast({
        title: "SLA removed",
        description: "The Service Level Agreement document has been removed.",
      });
    } catch (error: unknown) {
      toast({
        title: "Unable to remove SLA",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsSlaUploading(false);
    }
  }, [contractsByClient, fetchContracts, selectedClient, toast, user]);

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
    if (selectedClient) {
      void uploadTerminationDocument(selectedClient.id, file);
    }
  };

  const uploadTerminationDocument = useCallback(
    async (clientId: string, file?: File) => {
      if (!user) return;
      const uploadFile = file ?? pendingTerminationDocumentFile;
      if (!uploadFile) return;

      setIsTerminationDocumentUploading(true);
      try {
        const existing = terminationDocumentByClient[clientId] ?? null;
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
        const filePath = `${user.id}/termination-documents/${clientId}-${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("contracts").upload(filePath, uploadFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: uploadFile.type || "application/pdf",
        });

        if (uploadError) throw uploadError;

        const { error: insertError } = await terminationDocumentTable().insert({
          company_id: user.id,
          client_id: clientId,
          file_name: uploadFile.name,
          file_url: filePath,
        });
        if (insertError) throw insertError;

        await fetchTerminationDocument(clientId);
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
    [fetchTerminationDocument, pendingTerminationDocumentFile, terminationDocumentByClient, toast, user],
  );

  const handleConfirmTerminate = useCallback(async () => {
    if (!selectedClient) return;
    const fullName = `${selectedClient.client_name ?? ""} ${selectedClient.client_surname ?? ""}`.trim() || "this client";
    const confirmed = confirm(
      `Are you sure you want to terminate ${fullName}?\n\nThis action can be undone for 20 seconds.`,
    );
    if (!confirmed) return;
    const clientId = selectedClient.id;
    const ok = await handleTerminateWithReason(pendingTerminationReason, pendingTerminationDate);
    if (ok) {
      if (pendingTerminationDocumentFile) {
        await uploadTerminationDocument(clientId, pendingTerminationDocumentFile);
      }
      setIsTerminateDialogOpen(false);
      setPendingTerminationReason("");
      setPendingTerminationDate(dateToday());
    }
  }, [
    handleTerminateWithReason,
    pendingTerminationDate,
    pendingTerminationReason,
    pendingTerminationDocumentFile,
    selectedClient,
    uploadTerminationDocument,
  ]);

  const handleOpenTerminationDocument = async (document: ClientTerminationDocument) => {
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
    if (!selectedClient || !user) return;
    const existing = terminationDocumentByClient[selectedClient.id] ?? null;
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

    setTerminationDocumentByClient((prev) => ({
      ...prev,
      [selectedClient.id]: null,
    }));
    toast({
      title: "Termination document deleted",
      description: "The document has been removed.",
    });
  };

  const handleTerminationDateChange = async (nextDate: string) => {
    if (!selectedClient || !user) return;
    const { error } = await supabase
      .from("clients")
      .update(pickClientWritePayload({ terminated_at: nextDate || null }) as unknown as TablesInsert<"clients">)
      .eq("id", selectedClient.id)
      .eq("company_id", user.id);

    if (error) {
      toast({
        title: "Unable to save termination date",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
      return;
    }

    setSelectedClient((prev) => (prev ? { ...prev, terminated_at: nextDate || null } : prev));
    setClients((prev) =>
      prev.map((emp) => (emp.id === selectedClient.id ? { ...emp, terminated_at: nextDate || null } : emp)),
    );
    setFilteredClients((prev) =>
      prev.map((emp) => (emp.id === selectedClient.id ? { ...emp, terminated_at: nextDate || null } : emp)),
    );
    setAllClients((prev) =>
      prev.map((emp) => (emp.id === selectedClient.id ? { ...emp, terminated_at: nextDate || null } : emp)),
    );
  };

  const handleOpenIdDocument = async (document: ClientIdDocument) => {
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
    async (clientId: string) => {
      if (!user) return;
      const { data, error } = await licenceTable()
        .select("id, employee_id, category, licence_type, file_name, file_url, uploaded_at")
        .eq("company_id", user.id)
        .eq("employee_id", clientId)
        .order("uploaded_at", { ascending: false });

      if (error) {
        toast({
          title: "Unable to load licences",
          description: getSafeErrorMessage(error),
          variant: "destructive",
        });
        return;
      }

      const mapped: ClientLicence[] =
        (data ?? []).map((row: any) => ({
          id: row.id,
          clientId: row.employee_id,
          category: row.category as LicenceCategory,
          licenceType: row.licence_type || "",
          fileName: row.file_name || "document.pdf",
          fileUrl: row.file_url || "",
          uploadedAt: row.uploaded_at || "",
        })) ?? [];

      setLicencesByClient((prev) => ({
        ...prev,
        [clientId]: mapped,
      }));
    },
    [toast, user],
  );

  useEffect(() => {
    if (selectedClient) {
      fetchLicences(selectedClient.id);
    }
  }, [fetchLicences, selectedClient]);

  const handleOpenLicence = async (licence: ClientLicence) => {
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

  const handleRemoveLicence = async (licence: ClientLicence) => {
    if (!selectedClient || !user) return;
    const confirmed = confirm(
      `Are you sure you want to delete ${licence.fileName} because it will be permanently removed from all databases.`,
    );
    if (!confirmed) return;

    const existing = licencesByClient[selectedClient.id] ?? [];
    setLicencesByClient((prev) => ({
      ...prev,
      [selectedClient.id]: existing.filter((item) => item.id !== licence.id),
    }));

    const { error: deleteError } = await licenceTable()
      .delete()
      .eq("id", licence.id)
      .eq("company_id", user.id);

    if (deleteError) {
      setLicencesByClient((prev) => ({
        ...prev,
        [selectedClient.id]: existing,
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
    if (!file || !selectedClient || !user) return;
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
      const existingSameType = (licencesByClient[selectedClient.id] ?? []).find(
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
      const filePath = `${user.id}/licences/${selectedClient.id}-${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("contracts").upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/pdf",
      });
      if (uploadError) throw uploadError;

      const { error: insertError } = await licenceTable().insert({
        company_id: user.id,
        employee_id: selectedClient.id,
        category,
        licence_type: selectedType,
        file_name: file.name,
        file_url: filePath,
        uploaded_at: new Date().toISOString(),
      });
      if (insertError) throw insertError;

      await fetchLicences(selectedClient.id);
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
    async (clientId: string) => {
      if (!user) return;
      const { data, error } = await educationTable()
        .select("id, client_id, category, qualification_type, file_name, file_url, uploaded_at")
        .eq("company_id", user.id)
        .eq("client_id", clientId)
        .order("uploaded_at", { ascending: false });

      if (error) {
        toast({
          title: "Unable to load education documents",
          description: getSafeErrorMessage(error),
          variant: "destructive",
        });
        return;
      }

      const mapped: ClientEducation[] =
        (data ?? []).map((row: any) => ({
          id: row.id,
          clientId: row.client_id,
          category: row.category as EducationCategory,
          qualificationType: row.qualification_type || "",
          fileName: row.file_name || "document.pdf",
          fileUrl: row.file_url || "",
          uploadedAt: row.uploaded_at || "",
        })) ?? [];

      setEducationsByClient((prev) => ({
        ...prev,
        [clientId]: mapped,
      }));
    },
    [toast, user],
  );

  useEffect(() => {
    if (selectedClient) {
      fetchEducations(selectedClient.id);
    }
  }, [fetchEducations, selectedClient]);

  const handleOpenEducation = async (education: ClientEducation) => {
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

  const handleRemoveEducation = async (education: ClientEducation) => {
    if (!selectedClient || !user) return;
    const confirmed = confirm(
      `Are you sure you want to delete ${education.fileName} because it will be permanently removed from all databases.`,
    );
    if (!confirmed) return;

    const existing = educationsByClient[selectedClient.id] ?? [];
    setEducationsByClient((prev) => ({
      ...prev,
      [selectedClient.id]: existing.filter((item) => item.id !== education.id),
    }));

    const { error: deleteError } = await educationTable()
      .delete()
      .eq("id", education.id)
      .eq("company_id", user.id);

    if (deleteError) {
      setEducationsByClient((prev) => ({
        ...prev,
        [selectedClient.id]: existing,
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
    if (!file || !selectedClient || !user) return;
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
      const existingSameType = (educationsByClient[selectedClient.id] ?? []).find(
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
      const filePath = `${user.id}/education/${selectedClient.id}-${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("contracts").upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/pdf",
      });
      if (uploadError) throw uploadError;

      const { error: insertError } = await educationTable().insert({
        company_id: user.id,
        client_id: selectedClient.id,
        category,
        qualification_type: selectedType,
        file_name: file.name,
        file_url: filePath,
        uploaded_at: new Date().toISOString(),
      });
      if (insertError) throw insertError;

      await fetchEducations(selectedClient.id);
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
    async (clientId: string) => {
      if (!user) return;
      const existingDocument = idDocumentByClient[clientId];
      if (!existingDocument) {
        setIsIdDocumentMarkedForRemoval(false);
        return;
      }

      const { error: deleteError } = await idDocumentTable()
        .delete()
        .eq("company_id", user.id)
        .eq("client_id", clientId);

      if (deleteError) {
        throw deleteError;
      }

      if (existingDocument.fileUrl) {
        await supabase.storage.from("contracts").remove([getIdDocumentStoragePathFromUrl(existingDocument.fileUrl)]);
      }

      setIdDocumentByClient((prev) => ({
        ...prev,
        [clientId]: null,
      }));
      setIsIdDocumentMarkedForRemoval(false);
    },
    [idDocumentByClient, user],
  );

  const uploadPendingIdDocument = useCallback(
    async (clientId: string) => {
      if (!pendingIdDocumentFile || !user) return;
      setIsIdDocumentUploading(true);
      try {
        const existingDocument = idDocumentByClient[clientId] ?? null;
        const safeName = pendingIdDocumentFile.name.replace(/\s+/g, "_");
        const filePath = `${user.id}/id-passports/${clientId}-${Date.now()}-${safeName}`;

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
              client_id: clientId,
              file_name: pendingIdDocumentFile.name,
              file_url: filePath,
              uploaded_at: new Date().toISOString(),
            },
            { onConflict: "client_id" },
          )
          .select("id, client_id, file_name, file_url, uploaded_at")
          .single();

        if (error) {
          throw error;
        }

        if (existingDocument?.fileUrl) {
          await supabase.storage.from("contracts").remove([getIdDocumentStoragePathFromUrl(existingDocument.fileUrl)]);
        }

        setIdDocumentByClient((prev) => ({
          ...prev,
          [clientId]: {
            id: data.id,
            clientId: data.client_id,
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
    [idDocumentByClient, pendingIdDocumentFile, user],
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
    if (!idDocumentForSelectedClient) return;
    const confirmed = confirm(
      `Are you sure you want to delete ${idDocumentForSelectedClient.fileName} because it will be permanently removed from all databases.`,
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

  const contractsForSelectedClient = useMemo(
    () => (selectedClient ? contractsByClient[selectedClient.id] ?? [] : []),
    [selectedClient, contractsByClient],
  );
  const slaContractForSelectedClient = useMemo(
    () => contractsForSelectedClient.find((contract) => contract.contractType === SLA_CONTRACT_TYPE) ?? null,
    [contractsForSelectedClient],
  );
  const terminationDocumentForSelectedClient = useMemo(
    () => (selectedClient ? terminationDocumentByClient[selectedClient.id] ?? null : null),
    [selectedClient, terminationDocumentByClient],
  );
  const idDocumentForSelectedClient = useMemo(
    () => (selectedClient ? idDocumentByClient[selectedClient.id] ?? null : null),
    [idDocumentByClient, selectedClient],
  );
  const hasEffectiveIdDocument = !!idDocumentForSelectedClient && !isIdDocumentMarkedForRemoval;

  const profileCompletion = useMemo(() => {
    const derivedDob = isSouthAfricanNationality
      ? formatInputDate(extractDobFromId(profileForm.idNumber || ""))
      : profileForm.dateOfBirth;
    const fields = [
      { label: "Name", value: profileForm.clientName },
      { label: "Surname", value: profileForm.clientSurname },
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
      { label: "Client Number", value: profileForm.clientNumber },
      { label: "Probation Period", value: probationPeriod },
      { label: "Retirement Age", value: retirementAge },
      { label: "Department", value: department },
      ...(companyBranchesEnabled ? [{ label: "Branch", value: branch }] : []),
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
    const hasContract = contractsForSelectedClient.length > 0;
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
    contractsForSelectedClient,
    isSouthAfricanNationality,
    probationPeriod,
    retirementAge,
    department,
    branch,
    companyBranchesEnabled,
    reportingTo,
    occupationalLevel,
    salaryType,
    basicSalary,
    unionMember,
    hasEffectiveIdDocument,
  ]);

  const contractsByStatus = useMemo(
    () => ({
      active: contractsForSelectedClient.filter((contract) => contract.isActive),
      inactive: contractsForSelectedClient.filter((contract) => !contract.isActive),
    }),
    [contractsForSelectedClient],
  );
  const activeContractForSelectedClient = useMemo(
    () => contractsByStatus.active[0] ?? null,
    [contractsByStatus],
  );
  const hasEffectiveEmploymentContract =
    !!activeContractForSelectedClient && !isEmploymentContractMarkedForRemoval;
  const licencesForSelectedClient = useMemo(
    () => (selectedClient ? licencesByClient[selectedClient.id] ?? [] : []),
    [licencesByClient, selectedClient],
  );
  const educationsForSelectedClient = useMemo(
    () => (selectedClient ? educationsByClient[selectedClient.id] ?? [] : []),
    [educationsByClient, selectedClient],
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

  const getMisconductCategory = (name: string): "Minor" | "Serious" | "Dismissible" => {
    const found = conductOffences.find((item) => item.name === name);
    return found?.category ?? "Serious";
  };

  const filteredMisconductTypes = useMemo(() => {
    const query = misconductSearch.trim().toLowerCase();
    if (!query) return misconductOptions;
    return misconductOptions.filter((type) => type.name.toLowerCase().includes(query));
  }, [misconductSearch, misconductOptions]);

  const navigationClients = allClients.length > 0 ? allClients : clients;

  const selectedClientIndex = useMemo(() => {
    if (!selectedClient) return -1;
    return navigationClients.findIndex((client) => client.id === selectedClient.id);
  }, [navigationClients, selectedClient]);

  const hasPreviousClient = selectedClientIndex > 0;
  const hasNextClient =
    selectedClientIndex >= 0 && selectedClientIndex < navigationClients.length - 1;

  const navigateToClient = useCallback(
    async (index: number) => {
      const nextClient = navigationClients[index];
      if (!nextClient) return;
      let clientForProfile = nextClient;
      if (user) {
        const { data } = await (supabase as any)
          .from("clients")
          .select(clientSelectColumnsWithTermination)
          .eq("company_id", user.id)
          .eq("id", nextClient.id)
          .maybeSingle();
        if (data) {
          clientForProfile = data as Client;
        }
      }
      setSelectedClient(clientForProfile);
      setProfileForm(createProfileFormFromClient(clientForProfile));
      setProbationPeriod(clientForProfile.probation_period ?? "");
      setRetirementAge(
        retirementAgeOptions.find((option) => option === String(clientForProfile.retirement_age ?? 65)) ?? "65",
      );
      setUnionMember((clientForProfile.union_member as (typeof unionMemberOptions)[number]) ?? "");
      setTradeUnion(clientForProfile.trade_union ?? "");
      setDepartment((clientForProfile.department as (typeof departmentOptions)[number]) ?? "");
      setBranch(clientForProfile.branch ?? "");
      setReportingTo(clientForProfile.reporting_to ?? "");
      setOccupationalLevel(
        (clientForProfile.occupational_level as (typeof occupationalLevelOptions)[number]) ?? "",
      );
      setSalaryType((clientForProfile.salary_type as (typeof salaryTypeOptions)[number]) ?? "");
      setBasicSalary(clientForProfile.basic_salary ?? "");
      setWorkEmail(clientForProfile.work_email ?? "");
      setWorkCellNumber(clientForProfile.work_cell_number ?? "");
      setActiveTab("personal");
      setIsEditMode(false);
    },
    [navigationClients, user],
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
  const toggleWarningDraftMisconduct = (type: string) => {
    setWarningDraftMisconductTypes((prev) => {
      const exists = prev.includes(type);
      return exists ? prev.filter((item) => item !== type) : [...prev, type];
    });
  };
  const openWarningMisconductPicker = () => {
    setWarningDraftMisconductTypes(warningForm.misconductTypes);
    setMisconductSearch("");
    setIsMisconductPickerOpen(true);
  };
  const cancelWarningMisconductPicker = () => {
    setIsMisconductPickerOpen(false);
    setWarningDraftMisconductTypes(warningForm.misconductTypes);
    setMisconductSearch("");
  };
  const applyWarningMisconductPicker = () => {
    setWarningForm((prev) => ({ ...prev, misconductTypes: warningDraftMisconductTypes }));
    setIsMisconductPickerOpen(false);
    setMisconductSearch("");
  };
  useEffect(() => {
    if (!isMisconductPickerOpen) return;
    const timer = setTimeout(() => warningMisconductSearchInputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [isMisconductPickerOpen]);

  const sectionTitles: Record<ProfileSectionKey, string> = {
    identity: "Identity",
    companyStructure: "Company Structure",
    equity: "Employment Equity",
    contact: "Contact Information",
    statutory: "Statutory Information",
    employmentStatus: "Membership Details",
    employmentOrg: "Service Selection",
    employmentRemuneration: "Billing Terms",
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

  const persistClientLogoPath = useCallback(async (clientId: string, companyId: string, storagePath: string) => {
    const payload = {
      client_id: clientId,
      storage_path: storagePath,
      company_id: companyId,
      uploaded_by: companyId,
    };
    const { error } = await clientLogoTable().upsert(payload, { onConflict: "client_id" });
    if (error) throw error;
  }, []);

  const removeClientLogoRecord = useCallback(async (clientId: string) => {
    const filters: Array<"client_id"> = ["client_id"];
    let success = false;
    for (const column of filters) {
      const { error } = await clientLogoTable().delete().eq(column, clientId);
      if (!error) {
        success = true;
      }
    }
    if (!success) {
      throw new Error("Unable to remove client logo record.");
    }
  }, []);

  const loadClientLogoPath = useCallback(async (clientId: string) => {
    const filters: Array<"client_id"> = ["client_id"];
    for (const column of filters) {
      const { data, error } = await clientLogoTable().select("storage_path").eq(column, clientId).limit(1);
      if (error) continue;
      const row = (Array.isArray(data) ? data[0] : null) as Record<string, unknown> | null;
      const path = getClientLogoPathFromRecord(row);
      setClientLogoPathByClient((prev) => ({ ...prev, [clientId]: path }));
      return path;
    }
    return "";
  }, []);

  const resolveClientLogoUrl = useCallback(
    (client: Client | null) => {
      if (!client) return "";
      const cached = clientLogoPreviewByClient[client.id];
      if (cached) return cached;
      const mapped = (clientLogoPathByClient[client.id] ?? "").trim();
      if (mapped) {
        if (mapped.startsWith("http://") || mapped.startsWith("https://")) {
          return mapped;
        }
        const { data } = supabase.storage.from("client-logos").getPublicUrl(mapped);
        return data.publicUrl || "";
      }
      return "";
    },
    [clientLogoPathByClient, clientLogoPreviewByClient],
  );

  useEffect(() => {
    if (!selectedClient?.id) return;
    if (clientLogoPreviewByClient[selectedClient.id]) return;
    if (Object.prototype.hasOwnProperty.call(clientLogoPathByClient, selectedClient.id)) return;
    void loadClientLogoPath(selectedClient.id);
  }, [clientLogoPathByClient, clientLogoPreviewByClient, loadClientLogoPath, selectedClient?.id]);

  const uploadClientLogoFile = useCallback(
    async (file: File) => {
      if (!selectedClient || !user) return;
      const safeName = file.name.replace(/\s+/g, "_");
      const storagePath = `${selectedClient.id}/${Date.now()}-${safeName}`;
      const mappedLogoPath = (clientLogoPathByClient[selectedClient.id] ?? "").trim();
      const existingLogoPath = getClientLogoStoragePathFromUrl(mappedLogoPath);

      setIsClientLogoUploading(true);
      try {
        const { error: uploadError } = await supabase.storage.from("client-logos").upload(storagePath, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type || "image/png",
        });
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("client-logos").getPublicUrl(storagePath);
        const nextLogoUrl = data.publicUrl || "";
        setClientLogoPreviewByClient((prev) => ({
          ...prev,
          [selectedClient.id]: nextLogoUrl,
        }));
        setClientLogoPathByClient((prev) => ({
          ...prev,
          [selectedClient.id]: storagePath,
        }));

        await persistClientLogoPath(selectedClient.id, user.id, storagePath);

        if (existingLogoPath && existingLogoPath !== storagePath) {
          await supabase.storage.from("client-logos").remove([existingLogoPath]);
        }

        toast({
          title: "Logo updated",
          description: "Client logo has been uploaded successfully.",
        });
      } catch (error: unknown) {
        toast({
          title: "Unable to upload logo",
          description: getSafeErrorMessage(error),
          variant: "destructive",
        });
      } finally {
        setIsClientLogoUploading(false);
      }
    },
    [clientLogoPathByClient, persistClientLogoPath, selectedClient, toast, user],
  );

  const handleClientLogoFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !selectedClient || !user) return;
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file type",
          description: "Please upload an image file for the client logo.",
          variant: "destructive",
        });
        return;
      }

      try {
        const source = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ""));
          reader.onerror = () => reject(new Error("Could not read selected image."));
          reader.readAsDataURL(file);
        });

        const cleanedLogo = await cropClientLogoPadding(source);
        const blob = await fetch(cleanedLogo).then((response) => response.blob());
        const cleanedFile = new File([blob], file.name.replace(/\.[^.]+$/, ".png"), { type: "image/png" });
        await uploadClientLogoFile(cleanedFile);
      } catch (error: unknown) {
        toast({
          title: "Unable to prepare logo",
          description: getSafeErrorMessage(error),
          variant: "destructive",
        });
      }
    },
    [selectedClient, toast, uploadClientLogoFile, user],
  );

  const removeClientLogo = useCallback(async () => {
    if (!selectedClient || !user) return;

    const mappedLogoPath = (clientLogoPathByClient[selectedClient.id] ?? "").trim();
    const existingLogoPath = getClientLogoStoragePathFromUrl(mappedLogoPath);

    setIsClientLogoUploading(true);
    try {
      await removeClientLogoRecord(selectedClient.id);
      setClientLogoPreviewByClient((prev) => {
        const next = { ...prev };
        delete next[selectedClient.id];
        return next;
      });
      setClientLogoPathByClient((prev) => {
        const next = { ...prev };
        delete next[selectedClient.id];
        return next;
      });

      if (existingLogoPath) {
        await supabase.storage.from("client-logos").remove([existingLogoPath]);
      }

      toast({
        title: "Logo removed",
        description: "Client logo has been removed.",
      });
    } catch (error: unknown) {
      toast({
        title: "Unable to remove logo",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsClientLogoUploading(false);
    }
  }, [clientLogoPathByClient, removeClientLogoRecord, selectedClient, toast, user]);

  const renderProfilePanel = () => {
    if (!selectedClient) return null;
    const clientLogoUrl = resolveClientLogoUrl(selectedClient);

    return (
      <div className="flex h-full flex-col bg-[#f7f9fb] overflow-hidden">
        <div className="flex flex-1 min-h-0 flex-col px-6 pt-0 pb-0">
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-[10px] text-slate-500">
              <Menu className="h-3.5 w-3.5 -ml-1" />
              <span className="font-semibold text-slate-700">Client File</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 w-[89px] px-2 text-[10px] text-slate-700 border border-slate-300 bg-white justify-center gap-1 hover:bg-white hover:text-slate-900 hover:border-blue-400 data-[state=open]:border-slate-300"
                onClick={(event) => {
                  if (!guardEditSession(event)) return;
                  void navigateToClient(selectedClientIndex - 1);
                }}
                disabled={!hasPreviousClient}
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
                  void navigateToClient(selectedClientIndex + 1);
                }}
                disabled={!hasNextClient}
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
            aria-label="Close client profile"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3 grid h-full flex-1 min-h-0 gap-3 grid-cols-[320px_1fr]">
          <aside className="h-full min-h-0 space-y-4 overflow-y-auto pr-1">

            <div className="rounded-sm border border-slate-300 bg-white overflow-hidden">
              <div className="relative mx-5 mt-5 rounded-sm border border-slate-200 bg-slate-50">
                <input
                  ref={clientLogoFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => void handleClientLogoFileChange(event)}
                />
                <div className="flex h-32 items-center justify-center p-3">
                  {clientLogoUrl ? (
                    <img
                      src={clientLogoUrl}
                      alt="Client logo"
                      className="max-h-[104px] max-w-[94%] object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-white bg-slate-200 text-lg font-semibold uppercase text-slate-600 shadow-lg">
                      {`${(selectedClient.client_name ?? "").trim().charAt(0)}${(selectedClient.client_surname ?? "").trim().charAt(0)}`.trim() || "C"}
                    </div>
                  )}
                </div>
                {clientLogoUrl ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="absolute right-0.5 top-0.5 z-20 h-7 w-7 rounded-full text-slate-400 hover:bg-transparent hover:text-red-500"
                    onClick={() => void removeClientLogo()}
                    disabled={isClientLogoUploading}
                    aria-label="Remove logo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
                <div className="absolute bottom-0 left-0 z-20 flex h-10 w-10 -translate-x-[38%] translate-y-[38%] items-center justify-center rounded-full bg-white">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-6 w-6 rounded-full border-slate-300 bg-white text-slate-700 shadow-sm [&_svg]:size-3.5 hover:bg-white hover:border-[#3eca44] hover:text-[#2f9f35]"
                    onClick={() => clientLogoFileInputRef.current?.click()}
                    disabled={isClientLogoUploading}
                    aria-label={
                      isClientLogoUploading
                        ? "Uploading logo"
                        : clientLogoUrl
                          ? "Edit logo"
                          : "Upload logo"
                    }
                  >
                    {clientLogoUrl ? <Pencil /> : <Camera className="h-2 w-2" />}
                  </Button>
                </div>
              </div>
              <div className="pt-2 pb-2" />

              <div className="pl-5 pr-2 pt-2 min-h-[28px]">
                {clientStatus !== "Inactive" ? (
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
                ) : null}
              </div>

              <div className="px-5 pb-4 pt-4">

              <div className="space-y-1">
                <div className="flex items-baseline gap-3.5">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {(selectedClient.client_name ?? "").trim()} {(selectedClient.client_surname ?? "").trim()}
                  </h3>
                  {clientStatus !== "Inactive" && (
                    <span className="text-[10px] text-slate-400">{profileForm.clientNumber || ""}</span>
                  )}
                </div>
                <span className="inline-flex rounded-full bg-blue-100/70 px-2 py-0.5 text-[10px] font-normal text-blue-700">
                  {clientStatus === "Inactive"
                    ? (selectedClient?.termination_reason ?? "").toString().trim() || "Termination reason not set"
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
                          clientStatus === "Inactive" ? "text-red-600" : "text-emerald-600"
                        }`}
                      >
                        {clientStatus || "Active"}
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
                    {clientStatus === "Inactive" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="group h-6 w-40 justify-center rounded-[3px] px-2 text-[11px] inline-flex items-center border-[0.5px] bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-600 hover:text-white hover:border-emerald-600"
                        onClick={() => {
                          if (selectedClient) {
                            handleStartRehire(selectedClient);
                          }
                        }}
                      >
                        <span className="truncate font-semibold group-hover:underline">Rehire</span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="group h-6 w-40 justify-center rounded-[3px] px-2 text-[11px] inline-flex items-center border-[0.5px] focus:border !ring-0 !ring-offset-0 focus:!ring-0 focus:!ring-offset-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 outline-none focus:outline-none focus-visible:outline-none bg-red-600 text-white border-red-600 hover:bg-red-600 hover:text-white hover:border-red-600"
                        onClick={openTerminationDialog}
                      >
                        <span className="truncate font-semibold group-hover:underline">Terminate</span>
                      </Button>
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
                setActiveTab(value as ClientTab);
              }}
              className="mt-0 flex h-full min-h-0 flex-1 flex-col"
            >
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
              <div className="relative">
              <TabsList className="h-8 w-full flex-wrap justify-start items-center gap-0 bg-transparent px-0 py-0 shadow-none">
                <TabsTrigger
                  value="personal"
                  className="rounded-t-sm border-b-[3px] border-transparent px-4 h-8 flex items-center text-left text-xs font-medium leading-none text-slate-500 data-[state=inactive]:hover:text-[#3eca44] data-[state=active]:bg-[#3eca44] data-[state=active]:border-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
                  onPointerDown={(event) => {
                    guardEditSession(event);
                  }}
                >
                  Client
                </TabsTrigger>
                <TabsTrigger
                  value="employment"
                  className="rounded-t-sm border-b-[3px] border-transparent px-4 h-8 flex items-center text-left text-xs font-medium leading-none text-slate-500 data-[state=inactive]:hover:text-[#3eca44] data-[state=active]:bg-[#3eca44] data-[state=active]:border-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
                  onPointerDown={(event) => {
                    guardEditSession(event);
                  }}
                >
                  Membership
                </TabsTrigger>
                <TabsTrigger
                  value="address"
                  className="rounded-t-sm border-b-[3px] border-transparent px-4 h-8 flex items-center text-left text-xs font-medium leading-none text-slate-500 data-[state=inactive]:hover:text-[#3eca44] data-[state=active]:bg-[#3eca44] data-[state=active]:border-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
                  onPointerDown={(event) => {
                    guardEditSession(event);
                  }}
                >
                  Notes
                </TabsTrigger>
                <TabsTrigger
                  value="discipline"
                  className="rounded-t-sm border-b-[3px] border-transparent px-4 h-8 flex items-center text-left text-xs font-medium leading-none text-slate-500 data-[state=inactive]:hover:text-[#3eca44] data-[state=active]:bg-[#3eca44] data-[state=active]:border-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
                  onPointerDown={(event) => {
                    guardEditSession(event);
                  }}
                >
                  Attendances
                </TabsTrigger>
                <TabsTrigger
                  value="licences"
                  className="rounded-t-sm border-b-[3px] border-transparent px-4 h-8 flex items-center text-left text-xs font-medium leading-none text-slate-500 data-[state=inactive]:hover:text-[#3eca44] data-[state=active]:bg-[#3eca44] data-[state=active]:border-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
                  onPointerDown={(event) => {
                    if (!guardEditSession(event)) return;
                    setLicencesViewFilter("driving");
                  }}
                >
                  Cases
                </TabsTrigger>
                <TabsTrigger
                  value="education"
                  className="rounded-t-sm border-b-[3px] border-transparent px-4 h-8 flex items-center text-left text-xs font-medium leading-none text-slate-500 data-[state=inactive]:hover:text-[#3eca44] data-[state=active]:bg-[#3eca44] data-[state=active]:border-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
                  onPointerDown={(event) => {
                    if (!guardEditSession(event)) return;
                    setEducationViewFilter("academic");
                  }}
                >
                  Documents
                </TabsTrigger>
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

  const fetchClients = useCallback(async () => {
    if (!user) return;
    const from = (currentPage - 1) * DEFAULT_PAGE_SIZE;
    const to = from + DEFAULT_PAGE_SIZE - 1;
    const queryText = searchQuery.trim();
    let query = (supabase as any)
      .from("clients")
      .select(clientTableSelectColumns)
      .eq("company_id", user.id);

    if (clientStatusFilter === "inactive") {
      query = query.eq("status", "inactive");
    } else {
      query = query.or("status.is.null,status.eq.active");
    }

    if (queryText.length > 0) {
      const escaped = queryText.replace(/%/g, "\\%").replace(/_/g, "\\_");
      query = query.or(
        `client_number.ilike.%${escaped}%,client_name.ilike.%${escaped}%,client_surname.ilike.%${escaped}%,id_number.ilike.%${escaped}%,email.ilike.%${escaped}%,cell_number.ilike.%${escaped}%`,
      );
    }

    const { data, error } = await query
      .order("created_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false, nullsFirst: false })
      .range(from, to);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    const pageRows = Array.isArray(data) ? data : [];

    if (pageRows.length === 0 && currentPage > 1) {
      setCurrentPage((prev) => Math.max(1, prev - 1));
      return;
    }

    setClients(pageRows);
    setFilteredClients(pageRows);
  }, [
    toast,
    user,
    currentPage,
    searchQuery,
    clientStatusFilter,
  ]);

  const fetchClientsCount = useCallback(async () => {
    if (!user) return;
    const queryText = searchQuery.trim();
    let query = (supabase as any)
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("company_id", user.id);

    if (clientStatusFilter === "inactive") {
      query = query.eq("status", "inactive");
    } else {
      query = query.or("status.is.null,status.eq.active");
    }

    if (queryText.length > 0) {
      const escaped = queryText.replace(/%/g, "\\%").replace(/_/g, "\\_");
      query = query.or(
        `client_number.ilike.%${escaped}%,client_name.ilike.%${escaped}%,client_surname.ilike.%${escaped}%,id_number.ilike.%${escaped}%,email.ilike.%${escaped}%,cell_number.ilike.%${escaped}%`,
      );
    }

    const { count, error } = await query;
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    const nextCount = count ?? 0;
    setTotalClientCount(nextCount);
    setCurrentPage((prev) => {
      const maxPage = Math.max(1, Math.ceil(nextCount / DEFAULT_PAGE_SIZE));
      return prev > maxPage ? maxPage : prev;
    });
  }, [
    toast,
    user,
    searchQuery,
    clientStatusFilter,
  ]);

  const fetchAllClients = useCallback(async () => {
    if (!user) return;
    setIsAllClientsLoading(true);
    const runAllClientsQuery = async (selectColumns: string) =>
      await (supabase as any)
        .from("clients")
        .select(selectColumns)
        .eq("company_id", user.id)
        .order("created_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false, nullsFirst: false });

    let { data, error } = await runAllClientsQuery(clientSelectColumnsWithTermination);
    if (error) {
      const message = (error as { message?: string } | null)?.message ?? "";
      const isTerminationColumnMissing =
        message.includes("termination_reason") ||
        message.includes("previous_job_title") ||
        message.includes("terminated_at");
      if (isTerminationColumnMissing) {
        ({ data, error } = await runAllClientsQuery(clientSelectColumnsBase));
      }
    }

    if (error) {
      setIsAllClientsLoading(false);
      return;
    }
    setAllClients(Array.isArray(data) ? data : []);
    setIsAllClientsLoading(false);
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

    const loadClients = async () => {
      setIsClientsLoading(true);
      await fetchClients();
      if (!cancelled) setIsClientsLoading(false);
    };

    void loadClients();
    return () => {
      cancelled = true;
    };
  }, [user, fetchClients]);

  useEffect(() => {
    if (!user) return;
    void fetchClientsCount();
  }, [user, fetchClientsCount]);

  useEffect(() => {
    if (!user || !isProfilePanelOpen || hasLoadedAllClients) return;
    let cancelled = false;
    const loadAllClients = async () => {
      await fetchAllClients();
      if (!cancelled) setHasLoadedAllClients(true);
    };
    void loadAllClients();
    return () => {
      cancelled = true;
    };
  }, [user, isProfilePanelOpen, hasLoadedAllClients, fetchAllClients]);

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
    setTotalClientCount(0);
    setHasLoadedAllClients(false);
    setHasLoadedConductOffences(false);
    setAllClients([]);
    setConductOffences([]);
  }, [user?.id]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, clientStatusFilter, contractFilter, genderFilter, raceFilter, nationalityFilter]);

  useEffect(() => {
    setFilteredClients(clients);
  }, [clients]);

  useEffect(() => {
    // Keep selections in sync with the currently filtered list to avoid deleting hidden rows.
    setSelectedClients((prev) => {
      if (prev.size === 0) return prev;
      const allowedIds = new Set(filteredClients.map((emp) => emp.id));
      const next = new Set(Array.from(prev).filter((id) => allowedIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filteredClients]);

  const handleCustomClientNumberChange = (value: string) => {
    const cleaned = cleanClientNumberInput(value);
    setProfileForm((prev) => ({
      ...prev,
      clientNumber: cleaned,
    }));
  };

  const handleUndoDelete = async () => {
    if (!deleteUndo || !user?.id) return;
    try {
      const payload = deleteUndo.deletedClients.map((client) => ({
        ...client,
        company_id: user.id,
        created_at: client.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      const sanitizedPayload = payload.map(
        (row) => pickClientWritePayload(row as Record<string, unknown>) as TablesInsert<"clients">,
      );
      const { error } = await supabase.from("clients").upsert(sanitizedPayload, { onConflict: "id" });
      if (error) throw error;

      toast({
        title: "Clients restored",
        description: `${deleteUndo.deletedClients.length} client(s) were restored.`,
      });
      clearDeleteUndoState();
      await fetchClients();
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to undo deletion",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    }
  };

   const handleAddClient = async (e: React.FormEvent) => {
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
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const selectedMemberTypes = addForm.memberTypes
        .map((value) => value.trim())
        .filter(Boolean);
      const sanitizedRegisteredName = sanitizeText(addForm.clientName);
      const sanitizedTradingAsInput = sanitizeText(addForm.clientSurname);
      const sanitizedTradingAs = sanitizedTradingAsInput || sanitizedRegisteredName;
      const sanitizedIdNumber = sanitizeText(addForm.idNumber);
      const sanitizedRegistrationNumber = formatRegistrationNumberInput(addForm.registrationNumber.trim());
      const sanitizedClientNumber = sanitizeClientNumber(addForm.clientNumber);
      const sanitizedStartDate = addForm.startDate.trim();
      const sanitizedEndDate = addForm.endDate.trim();
      const sanitizedContractType = sanitizeText(addForm.contractType);
      const sanitizedOwner = sanitizeText(addForm.gender);
      const sanitizedTellCell = sanitizeText(addForm.race);
      const sanitizedCompanyEmail = sanitizeText(addForm.cellNumber);
      const sanitizedAddressLine1 = sanitizeText(addForm.physicalAddressLine1);
      const sanitizedAddressLine2 = sanitizeText(addForm.physicalAddressLine2);
      const sanitizedCity = sanitizeText(addForm.city);
      const sanitizedProvince = addForm.province.trim();
      const sanitizedAreaCode = sanitizeText(addForm.areaCode);
      const sanitizedPostalAddressLine1 = sanitizeText(addForm.postalAddressLine1);
      const sanitizedPostalAddressLine2 = sanitizeText(addForm.postalAddressLine2);
      const sanitizedPostalCity = sanitizeText(addForm.postalCity);
      const sanitizedPostalProvince = addForm.postalProvince.trim();
      const sanitizedPostalAreaCode = sanitizeText(addForm.postalAreaCode);

      if (sanitizedRegisteredName.length < 2 || sanitizedRegisteredName.length > 100) {
        throw new Error("Registered name must be between 2 and 100 characters.");
      }
      if (sanitizedTradingAs.length < 2 || sanitizedTradingAs.length > 100) {
        throw new Error("Trading as must be between 2 and 100 characters.");
      }
      if (!sanitizedClientNumber || sanitizedClientNumber.length > CLIENT_NUMBER_MAX_LENGTH) {
        throw new Error(`Client number must be up to ${CLIENT_NUMBER_MAX_LENGTH} letters or numbers.`);
      }
      if (!dateRegex.test(sanitizedStartDate) || !dateRegex.test(sanitizedEndDate)) {
        throw new Error("Please select valid dates for start date and membership renewal date.");
      }
      if (!sanitizedContractType) {
        throw new Error("Please select a payment cycle.");
      }
      if (!southAfricanProvinces.includes(sanitizedProvince as (typeof southAfricanProvinces)[number])) {
        throw new Error("Please select a valid province.");
      }

      const normalizedNumber = normalizeClientNumber(sanitizedClientNumber);
      const duplicate = normalizedNumber
        ? clients.find(
            (emp) => {
              const dynamic = emp as Record<string, unknown>;
              const existingClientNumber =
                (dynamic.client_number as string | undefined) ?? emp.client_number ?? "";
              return (
                normalizeClientNumber(existingClientNumber) === normalizedNumber &&
                (!rehireClientId || emp.id !== rehireClientId)
              );
            },
          )
        : undefined;
      if (duplicate) {
        toast({
          title: "Duplicate client number",
          description: `You already allocated that client number to ${getClientDisplayName(duplicate)}. Please choose a different client number.`,
          variant: "destructive",
        });
        return;
      }
      const normalizedRegistrationNumber = normalizeRegistrationNumberValue(sanitizedRegistrationNumber);
      const duplicateRegistrationClient = normalizedRegistrationNumber
        ? clients.find(
            (emp) =>
              normalizeRegistrationNumberValue(
                emp.registration_number ?? ((emp as Record<string, unknown>).registration_number as string | null) ?? "",
              ) ===
                normalizedRegistrationNumber &&
              (!rehireClientId || emp.id !== rehireClientId),
          )
        : undefined;
      if (duplicateRegistrationClient) {
        toast({
          title: "Duplicate registration number",
          description: `That registration number is already allocated to ${getClientDisplayName(duplicateRegistrationClient)}. Please use a different registration number.`,
          variant: "destructive",
        });
        return;
      }

      const basePayload: Record<string, unknown> = {
        company_id: user.id,
        client_name: sanitizedRegisteredName || null,
        client_surname: sanitizedTradingAs || null,
        id_number: sanitizedIdNumber || null,
        client_number: sanitizedClientNumber || null,
        gender: sanitizedOwner || null,
        race: sanitizedTellCell || null,
        cell_number: sanitizedCompanyEmail || sanitizeText(addForm.email) || null,
        email: sanitizeText(addForm.email) || null,
      };
      const optionalPopupPayload: Record<string, unknown> = {
        status: "active",
        bargaining_council: "None",
      };
      const createClientPayload = (): Record<string, unknown> => {
        const payload: Record<string, unknown> = { ...basePayload };
        for (const [key, value] of Object.entries(optionalPopupPayload)) {
          if (value !== null && value !== "") payload[key] = value;
        }
        return payload;
      };
      const getMissingColumnName = (error: unknown) => {
        const message = (error as { message?: string } | null)?.message ?? "";
        const match = message.match(/'([^']+)' column/);
        return match?.[1] ?? null;
      };
      const runClientsWrite = async (mode: "insert" | "update") => {
        const payload = createClientPayload();
        const triedMissingColumns = new Set<string>();
        // Retry by pruning unknown optional columns so runtime stays compatible with evolving schema.
        while (true) {
          if (mode === "update") {
            const sanitized = pickClientWritePayload({ ...payload, status: "active" });
            const { error } = await supabase
              .from("clients")
              .update(sanitized as any)
              .eq("id", rehireClientId)
              .eq("company_id", user.id);
            if (!error) return payload;
            const missingColumn = getMissingColumnName(error);
            if (
              missingColumn &&
              Object.prototype.hasOwnProperty.call(payload, missingColumn) &&
              !Object.prototype.hasOwnProperty.call(basePayload, missingColumn) &&
              !triedMissingColumns.has(missingColumn)
            ) {
              delete payload[missingColumn];
              triedMissingColumns.add(missingColumn);
              continue;
            }
            throw error;
          }

          const { error } = await supabase.from("clients").insert(pickClientWritePayload(payload) as any);
          if (!error) return payload;
          const missingColumn = getMissingColumnName(error);
          if (
            missingColumn &&
            Object.prototype.hasOwnProperty.call(payload, missingColumn) &&
            !Object.prototype.hasOwnProperty.call(basePayload, missingColumn) &&
            !triedMissingColumns.has(missingColumn)
          ) {
            delete payload[missingColumn];
            triedMissingColumns.add(missingColumn);
            continue;
          }
          throw error;
        }
      };
      let persistedPayload: Record<string, unknown> = {};
      if (rehireClientId) {
        persistedPayload = await runClientsWrite("update");

        const { data: existingTerminationDocs } = await terminationDocumentTable()
          .select("id, file_url")
          .eq("company_id", user.id)
          .eq("client_id", rehireClientId);
        if ((existingTerminationDocs ?? []).length > 0) {
          await terminationDocumentTable()
            .delete()
            .eq("company_id", user.id)
            .eq("client_id", rehireClientId);
          const storagePaths = (existingTerminationDocs as Array<{ file_url?: string | null }>)
            .map((row) => getContractStoragePathFromUrl(row.file_url))
            .filter((path): path is string => !!path);
          if (storagePaths.length > 0) {
            await supabase.storage.from("contracts").remove(storagePaths);
          }
          setTerminationDocumentByClient((prev) => ({
            ...prev,
            [rehireClientId]: null,
          }));
        }

        toast({
          title: "Success",
          description: "Client rehired successfully!",
        });
      } else {
        persistedPayload = await runClientsWrite("insert");

        toast({
          title: "Success",
          description: "Client added successfully!",
        });
      }
      setAddForm(createBlankAddForm());
      setAddFormStep(1);
      setRehireClientId(null);
      setIsRegistrationNumberFocused(false);
      setIsAddFormSubmitRequested(false);
      setIsAddDialogOpen(false);
      await fetchClients();
      if (selectedClient && rehireClientId && selectedClient.id === rehireClientId) {
        setSelectedClient((prev) =>
          prev
            ? ({
                ...prev,
                ...persistedPayload,
                status: "active",
                termination_reason: null,
                previous_job_title: null,
                terminated_at: null,
              } as Client)
            : prev,
        );
        setClientStatus("Active");
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
    if (!selectedClient) return;
    setIsProfileSaving(true);
    try {
      const validated = clientProfileSchema.parse(profileForm);
       const endDateValue =
         validated.contractType === "Temporary" && validated.endDate ? validated.endDate : null;
       const finalClientNumber = validated.clientNumber || null;
       const normalizedStatus = clientStatus.trim().toLowerCase() || null;
       const normalizedNumber = normalizeClientNumber(finalClientNumber);
       const duplicate = normalizedNumber
         ? clients.find(
             (emp) =>
               emp.id !== selectedClient.id &&
               normalizeClientNumber(emp.client_number) === normalizedNumber,
           )
         : undefined;
       if (duplicate) {
         toast({
           title: "Duplicate client number",
           description: `You already allocated that client number to ${duplicate.client_name ?? "Client"} ${duplicate.client_surname ?? ""}. Please choose a different client number.`,
           variant: "destructive",
         });
         setIsProfileSaving(false);
         return;
       }
       const normalizedIdNumber = normalizeIdNumberValue(validated.idNumber);
       const duplicateIdClient = normalizedIdNumber
         ? clients.find(
             (emp) =>
               emp.id !== selectedClient.id &&
               normalizeIdNumberValue(emp.id_number) === normalizedIdNumber,
           )
         : undefined;
       if (duplicateIdClient) {
         toast({
           title: "Duplicate ID/passport number",
           description: `That ID/passport number is already allocated to ${duplicateIdClient.client_name ?? "Client"} ${duplicateIdClient.client_surname ?? ""}. Please use a different ID/passport number.`,
           variant: "destructive",
         });
         setIsProfileSaving(false);
         return;
       }

        const updatePayload: ClientUpdate = {
          client_name: validated.clientName,
          client_surname: validated.clientSurname,
          id_number: validated.idNumber || null,
          gender: validated.gender,
          race: validated.race,
          client_number: finalClientNumber,
          cell_number: validated.cellNumber || null,
          email: validated.email || null,
          status: normalizedStatus,
      };

       const { error } = await supabase
         .from("clients")
         .update(pickClientWritePayload(updatePayload as Record<string, unknown>) as unknown as TablesInsert<"clients">)
         .eq("id", selectedClient.id);

       if (error) throw error;

      toast({
        title: "Client updated",
        description: "Client profile has been saved successfully.",
      });

      const updatedClient: Client = {
        ...selectedClient,
        client_name: validated.clientName,
        client_surname: validated.clientSurname,
        id_number: validated.idNumber || null,
        start_date: validated.startDate || null,
        contract_type: validated.contractType,
        end_date: endDateValue,
        nationality: validated.nationality,
        client_number: finalClientNumber,
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

      setSelectedClient(updatedClient);
      setProfileForm(createProfileFormFromClient(updatedClient));
      setIsEditMode(false);
      await fetchClients();
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
     if (selectedClients.size === 0 || !user) return;
   const confirmed = confirm(
     "The selected client(s) will be permanently removed from all databases/storage. Are you sure you want to delete selected client(s)?",
   );
   if (!confirmed) return;

    const deletedClients = clients.filter((emp) => selectedClients.has(emp.id));
    if (deletedClients.length === 0) {
      toast({
        title: "No matching clients",
        description: "Could not find the selected clients to delete.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("clients")
      .delete()
      .in("id", Array.from(selectedClients));

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
      description: `${selectedClients.size} client(s) deleted successfully!`,
    });

    setDeleteUndo({
      deletedClients,
      expiresAt: Date.now() + 20_000,
    });
    setSelectedClients(new Set());
    await fetchClients();
  };

  const handleTerminateClient = async (client: Client) => {
    if (!user) return;
    const fullName = `${(client.client_name ?? "").trim()} ${(client.client_surname ?? "").trim()}`.trim();
    const confirmed = confirm(
      `This action permanently removes this client and all related records from Zappir's databases. You will have 20 seconds to undo after deletion; once that 20-second undo period expires, this action cannot be undone.\n\nAre you sure you want to delete ${fullName || "this client"}?`,
    );
    if (!confirmed) return;

    const { error } = await supabase.from("clients").delete().eq("id", client.id);
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Client terminated",
      description: `${fullName || "Client"} deleted successfully.`,
    });

    setDeleteUndo({
      deletedClients: [client],
      expiresAt: Date.now() + 20_000,
    });
    setSelectedClients((prev) => {
      if (!prev.has(client.id)) return prev;
      const next = new Set(prev);
      next.delete(client.id);
      return next;
    });
    if (selectedClient?.id === client.id) {
      setSelectedClient(null);
      setIsProfilePanelOpen(false);
    }
    await fetchClients();
  };

  const handleExportClientsPdf = async () => {
    if (!user) return;

    setIsExportingClientsPdf(true);
    try {
      const { data, error } = await (supabase as any)
        .from("clients")
        .select("*")
        .eq("company_id", user.id)
        .ilike("status", "active")
        .order("client_surname", { ascending: true })
        .order("client_name", { ascending: true });

      if (error) throw error;

      type ExportClientRow = Pick<
        Client,
        "client_name" | "client_surname" | "client_number" | "id_number" | "contract_type" | "job_title" | "cell_number" | "gender" | "race" | "status"
      >;
      const activeClients = (data ?? []) as ExportClientRow[];

      if (activeClients.length === 0) {
        toast({
          title: "No active clients",
          description: "There are no active clients to export.",
          variant: "destructive",
        });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_name, company_type, registration_number, physical_address, company_contact, company_email")
        .eq("id", user.id)
        .maybeSingle();

      const getGroupKey = (contractType?: string | null): "permanent" | "temporary" | "other" => {
        const normalized = (contractType || "").trim().toLowerCase();
        if (!normalized) return "other";
        if (normalized.includes("permanent")) return "permanent";
        if (normalized.includes("temporary")) return "temporary";
        return "other";
      };

      const grouped = {
        permanent: activeClients.filter((emp) => getGroupKey(emp.contract_type) === "permanent"),
        temporary: activeClients.filter((emp) => getGroupKey(emp.contract_type) === "temporary"),
        other: activeClients.filter((emp) => getGroupKey(emp.contract_type) === "other"),
      };

      const groupsAll: Array<{ key: "permanent" | "temporary" | "other"; title: string; rows: ExportClientRow[] }> = [
        { key: "permanent", title: "Permanent Staff", rows: grouped.permanent },
        { key: "temporary", title: "Temporary Staff", rows: grouped.temporary },
        { key: "other", title: "Other Staff", rows: grouped.other },
      ];
      const groups = groupsAll.filter((group) => group.rows.length > 0);

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 12;
      const contentWidth = pageWidth - margin * 2;
      const footerHeight = 20;
      const contentBottom = pageHeight - footerHeight - 4;
      const firstPageTopContentY = 19;
      const continuationTopContentY = 12;
      let y = firstPageTopContentY;

      const columns = [
        { key: "name", label: "Name", width: 64 },
        { key: "clientNo", label: "Client #", width: 28 },
        { key: "id", label: "ID Number", width: 34 },
        { key: "job", label: "Job Title", width: 58 },
        { key: "cell", label: "Cell Number", width: 36 },
        { key: "gender", label: "Gender", width: 24 },
        { key: "race", label: "Race", width: 29 },
      ] as const;

      const drawHeader = () => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text("Client Register", pageWidth / 2, 11, { align: "center" });
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.line(margin, 14.5, margin + contentWidth, 14.5);
      };

      const drawSectionHeader = (title: string) => {
        const sectionHeight = 7;
        doc.setFillColor(51, 65, 85);
        doc.setDrawColor(51, 65, 85);
        doc.rect(margin, y, contentWidth, sectionHeight, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text(title, margin + 3, y + 4.8);
        y += sectionHeight + 1.8;
      };

      const drawTableHeader = () => {
        const headerHeight = 7;
        let x = margin;
        columns.forEach((col) => {
          doc.setFillColor(241, 245, 249);
          doc.rect(x, y, col.width, headerHeight, "F");
          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.15);
          doc.rect(x, y, col.width, headerHeight, "S");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(51, 65, 85);
          doc.text(col.label, x + 2, y + 4.6);
          x += col.width;
        });
        y += headerHeight;
      };

      const newPage = () => {
        doc.addPage();
        y = continuationTopContentY;
      };

      const ensureSpace = (height: number) => {
        if (y + height > contentBottom) {
          newPage();
        }
      };

      drawHeader();

      groups.forEach((group, groupIndex) => {
        ensureSpace(16);
        drawSectionHeader(group.title);
        drawTableHeader();

        group.rows.forEach((client) => {
          const rowValues = [
            `${(client.client_name || "").trim()} ${(client.client_surname || "").trim()}`.trim() || "-",
            (client.client_number || "").trim() || "-",
            (client.id_number || "").trim() || "-",
            (client.job_title || "").trim() || "-",
            (client.cell_number || "").trim() || "-",
            (client.gender || "").trim() || "-",
            (client.race || "").trim() || "-",
          ];
          const lineHeight = 3.6;
          const paddingX = 2;
          const paddingY = 2;
          const rowLines = columns.map((col, idx) =>
            doc.splitTextToSize(rowValues[idx], col.width - paddingX * 2),
          );
          const maxLines = Math.max(...rowLines.map((lines) => Math.max(lines.length, 1)));
          const rowHeight = maxLines * lineHeight + paddingY * 2;

          if (y + rowHeight > contentBottom) {
            newPage();
            drawTableHeader();
          }

          let x = margin;
          columns.forEach((col, idx) => {
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.12);
            doc.rect(x, y, col.width, rowHeight);
            doc.setFont("helvetica", idx === 0 ? "bold" : "normal");
            doc.setFontSize(8);
            doc.setTextColor(17, 24, 39);
            rowLines[idx].forEach((line: string, lineIdx: number) => {
              doc.text(line, x + paddingX, y + paddingY + 2.8 + lineIdx * lineHeight);
            });
            x += col.width;
          });

          y += rowHeight;
        });

        if (groupIndex < groups.length - 1) {
          y += 3.5;
        }
      });

      const companyName = formatCompanyDisplayName(profile?.company_name, profile?.company_type) || "Company";
      const footerCenterText = "This document is confidential and for internal use only.";

      const totalPages = doc.getNumberOfPages();
      for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page);
        const footerTop = pageHeight - footerHeight;
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.line(margin, footerTop, margin + contentWidth, footerTop);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(70, 74, 78);
        doc.text(companyName, margin, footerTop + 6.2, { align: "left" });
        doc.text(footerCenterText, pageWidth / 2, footerTop + 6.2, { align: "center" });
        doc.text(`Page ${page} of ${totalPages}`, margin + contentWidth, footerTop + 6.2, { align: "right" });
      }

      doc.save("Company_Clients.pdf");
      toast({
        title: "Export ready",
        description: "Client list exported successfully.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsExportingClientsPdf(false);
    }
  };

  const handleExportClientsExcel = async () => {
    if (!user) return;

    setIsExportingClientsExcel(true);
    try {
      const { data, error } = await (supabase as any)
        .from("clients")
        .select("*")
        .eq("company_id", user.id)
        .ilike("status", "active")
        .order("client_surname", { ascending: true })
        .order("client_name", { ascending: true });

      if (error) throw error;

      type ExportExcelClientRow = Pick<
        Client,
        | "client_number"
        | "client_name"
        | "client_surname"
        | "id_number"
        | "gender"
        | "race"
        | "nationality"
        | "cell_number"
        | "email"
        | "income_tax_number"
        | "contract_type"
        | "job_title"
        | "physical_address_line1"
        | "physical_address_line2"
        | "city"
        | "province"
        | "area_code"
      >;

      const activeClients = (data ?? []) as ExportExcelClientRow[];

      if (activeClients.length === 0) {
        toast({
          title: "No active clients",
          description: "There are no active clients to export.",
          variant: "destructive",
        });
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Clients");

      worksheet.columns = [
        { header: "Client Number", key: "clientNumber", width: 18 },
        { header: "Name", key: "clientName", width: 18 },
        { header: "Surname", key: "clientSurname", width: 18 },
        { header: "ID Number", key: "idNumber", width: 18 },
        { header: "Gender", key: "gender", width: 12 },
        { header: "Race", key: "race", width: 14 },
        { header: "Nationality", key: "nationality", width: 18 },
        { header: "Cell Number", key: "cellNumber", width: 16 },
        { header: "Email", key: "email", width: 26 },
        { header: "Income Tax Number", key: "incomeTaxNumber", width: 20 },
        { header: "Contract Type", key: "contractType", width: 16 },
        { header: "Job Title", key: "jobTitle", width: 20 },
        { header: "Address Line 1", key: "addressLine1", width: 24 },
        { header: "Address Line 2", key: "addressLine2", width: 24 },
        { header: "City", key: "city", width: 18 },
        { header: "Province", key: "province", width: 20 },
        { header: "Area Code", key: "areaCode", width: 12 },
      ];
      worksheet.getRow(1).font = { bold: true };

      activeClients.forEach((client) => {
        worksheet.addRow({
          clientNumber: (client.client_number || "").trim(),
          clientName: (client.client_name || "").trim(),
          clientSurname: (client.client_surname || "").trim(),
          idNumber: (client.id_number || "").trim(),
          gender: (client.gender || "").trim(),
          race: (client.race || "").trim(),
          nationality: (client.nationality || "").trim(),
          cellNumber: (client.cell_number || "").trim(),
          email: (client.email || "").trim(),
          incomeTaxNumber: (client.income_tax_number || "").trim(),
          contractType: (client.contract_type || "").trim(),
          jobTitle: (client.job_title || "").trim(),
          addressLine1: (client.physical_address_line1 || "").trim(),
          addressLine2: (client.physical_address_line2 || "").trim(),
          city: (client.city || "").trim(),
          province: (client.province || "").trim(),
          areaCode: (client.area_code || "").trim(),
        });
      });

      worksheet.getColumn(4).numFmt = "0";

      const listSheet = workbook.addWorksheet("Lists");
      listSheet.getColumn(1).values = ["", ...genderOptions];
      listSheet.getColumn(2).values = ["", ...raceOptions];
      listSheet.getColumn(3).values = ["", ...nationalityOptions];
      listSheet.getColumn(4).values = ["", ...southAfricanProvinces];
      listSheet.getColumn(5).values = ["", ...contractTypes];
      listSheet.state = "veryHidden";

      const validationStartRow = 2;
      const validationEndRow = Math.max(500, activeClients.length + 50);
      const genderFormula = `Lists!$A$2:$A$${genderOptions.length + 1}`;
      const raceFormula = `Lists!$B$2:$B$${raceOptions.length + 1}`;
      const nationalityFormula = `Lists!$C$2:$C$${nationalityOptions.length + 1}`;
      const provinceFormula = `Lists!$D$2:$D$${southAfricanProvinces.length + 1}`;
      const contractTypeFormula = `Lists!$E$2:$E$${contractTypes.length + 1}`;

      for (let row = validationStartRow; row <= validationEndRow; row++) {
        worksheet.getCell(row, 5).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [genderFormula],
        };
        worksheet.getCell(row, 6).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [raceFormula],
        };
        worksheet.getCell(row, 7).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [nationalityFormula],
        };
        worksheet.getCell(row, 16).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [provinceFormula],
        };
        worksheet.getCell(row, 11).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [contractTypeFormula],
        };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Client_Register.xlsx";
      link.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export ready",
        description: "Client register exported successfully.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: getSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsExportingClientsExcel(false);
    }
  };

  const handleStartRehire = (client: Client) => {
    setIsEditMode(false);
    setActiveEditSection(null);
    setRehireClientId(client.id);
    setAddForm(createAddFormFromClient(client));
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
      setIsNewClientMenuOpen(false);
      setAddForm(createBlankAddForm());
      setAddFormStep(1);
      setRehireClientId(null);
      setIsRegistrationNumberFocused(false);
      setIsAddFormSubmitRequested(false);
      requestAnimationFrame(() => {
        (document.activeElement as HTMLElement | null)?.blur?.();
        newClientMenuTriggerRef.current?.blur();
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
          clientName: "",
          clientSurname: "",
          registrationNumber: "",
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
          clientNumber: "",
          memberTypes: [],
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
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: "dd/mm/yyyy", defval: "" });

      const validatedClients: Array<{
        rowNumber: number;
        normalizedIdNumber: string;
        payload: ClientInsert;
      }> = [];
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
      const normalizeStartDate = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return "";

        const yyyyMmDdMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
        if (yyyyMmDdMatch) return trimmed;

        const ddMmYyyyMatch = /^(\d{2})[ \\/.-](\d{2})[ \\/.-](\d{4})$/.exec(trimmed);
        if (ddMmYyyyMatch) {
          const [, day, month, year] = ddMmYyyyMatch;
          return `${year}-${month}-${day}`;
        }

        return trimmed;
      };

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as Record<string, unknown>;
        const rowNumber = i + 2;
        try {
          const rawData = {
            clientNumber: getColumnValue(row, "Client Number", "Client Number", "client_number"),
            clientName: getColumnValue(row, "Name", "First Name", "client_name"),
            clientSurname: getColumnValue(row, "Surname", "Last Name", "client_surname"),
            idNumber: getColumnValue(row, "ID Number", "ID", "id_number", "Id Number"),
            gender: normalizeEnumValue(getColumnValue(row, "Gender", "gender"), genderOptions),
            race: normalizeEnumValue(getColumnValue(row, "Race", "race"), raceOptions),
            contractType: normalizeContractType(getColumnValue(row, "Contract Type", "contract_type")),
            startDate: normalizeStartDate(getColumnValue(row, "Start Date", "start_date", "StartDate")),
            nationality: normalizeEnumValue(getColumnValue(row, "Nationality", "nationality"), nationalityOptions),
            cellNumber: getColumnValue(row, "Cell Number", "cell_number"),
            email: getColumnValue(row, "Email", "email"),
            incomeTaxNumber: getColumnValue(row, "Income Tax Number", "income_tax_number"),
            addressLine1: getColumnValue(row, "Address Line 1", "physical_address_line1"),
            addressLine2: getColumnValue(row, "Address Line 2", "physical_address_line2"),
            city: getColumnValue(row, "City", "city"),
            province: normalizeEnumValue(getColumnValue(row, "Province", "province"), southAfricanProvinces),
            areaCode: getColumnValue(row, "Area Code", "area_code"),
            jobTitle: getColumnValue(row, "Job Title", "job_title"),
          };

          const validated = clientImportSchema.parse(rawData);
          validatedClients.push({
            rowNumber,
            normalizedIdNumber: normalizeIdNumberValue(validated.idNumber),
            payload: {
              company_id: user.id,
              client_name: validated.clientName,
              client_surname: validated.clientSurname,
              id_number: validated.idNumber || null,
              client_number: validated.clientNumber || null,
              gender: validated.gender || null,
              race: validated.race || null,
              cell_number: validated.cellNumber || null,
              email: validated.email || null,
            },
          });
        } catch (err: unknown) {
          errors.push(`Row ${rowNumber}: ${getSafeErrorMessage(err)}`);
        }
      }

      if (validatedClients.length === 0) {
        const firstError = errors[0] ?? "Each row needs at least a Name and Surname.";
        throw new Error(`No valid client data found. ${firstError}`);
      }

      const seenFileIdRows = new Map<string, number>();
      const dedupedRows: typeof validatedClients = [];
      for (const row of validatedClients) {
        if (!row.normalizedIdNumber) {
          dedupedRows.push(row);
          continue;
        }
        const firstSeenRow = seenFileIdRows.get(row.normalizedIdNumber);
        if (firstSeenRow) {
          errors.push(`Row ${row.rowNumber}: duplicate ID/passport number already used in row ${firstSeenRow}.`);
          continue;
        }
        seenFileIdRows.set(row.normalizedIdNumber, row.rowNumber);
        dedupedRows.push(row);
      }

      if (errors.length > 0) {
        toast({
          title: "Warning",
          description: `${errors.length} row(s) skipped due to validation errors. First error: ${errors[0]}`,
          variant: "destructive",
        });
      }

      if (dedupedRows.length === 0) {
        throw new Error("No valid client rows remain after duplicate ID/passport checks.");
      }

      const idNumbersInFile = dedupedRows
        .map((row) => row.payload.id_number)
        .filter((value): value is string => !!value && value.trim().length > 0);

      const existingClientsById = new Map<string, { id: string }>();
      if (idNumbersInFile.length > 0) {
        const { data: existingWithIds, error: existingError } = await supabase
          .from("clients")
          .select("id, id_number")
          .eq("company_id", user.id)
          .in("id_number", idNumbersInFile);
        if (existingError) throw existingError;
        for (const client of existingWithIds ?? []) {
          const normalized = normalizeIdNumberValue(client.id_number);
          if (normalized) {
            existingClientsById.set(normalized, { id: client.id });
          }
        }
      }

      const clientsToInsert: ClientInsert[] = [];
      const clientsToUpdate: Array<{ id: string; payload: ClientUpdate }> = [];
      for (const row of dedupedRows) {
        const existing = row.normalizedIdNumber ? existingClientsById.get(row.normalizedIdNumber) : undefined;
        if (existing) {
          const { company_id: _companyId, ...updatePayload } = row.payload;
          clientsToUpdate.push({ id: existing.id, payload: updatePayload as ClientUpdate });
        } else {
          clientsToInsert.push(row.payload);
        }
      }

      if (clientsToInsert.length > 0) {
        const { error } = await supabase.from("clients").insert(
          clientsToInsert.map((row) => pickClientWritePayload(row as Record<string, unknown>)) as TablesInsert<"clients">[],
        );
        if (error) throw error;
      }

      for (const row of clientsToUpdate) {
        const { error } = await supabase
          .from("clients")
          .update(pickClientWritePayload(row.payload as Record<string, unknown>) as unknown as TablesInsert<"clients">)
          .eq("id", row.id)
          .eq("company_id", user.id);
        if (error) throw error;
      }

      const importedCount = clientsToInsert.length;
      const updatedCount = clientsToUpdate.length;

      toast({
        title: "Success",
        description: `${importedCount} client(s) imported and ${updatedCount} client(s) updated.`,
      });

      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchClients();
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
    const worksheet = workbook.addWorksheet("Clients");

    worksheet.columns = [
      { header: "Client Number", key: "clientNumber", width: 18 },
      { header: "Name", key: "clientName", width: 18 },
      { header: "Surname", key: "clientSurname", width: 18 },
      { header: "ID Number", key: "idNumber", width: 18 },
      { header: "Gender", key: "gender", width: 12 },
      { header: "Race", key: "race", width: 14 },
      { header: "Nationality", key: "nationality", width: 18 },
      { header: "Cell Number", key: "cellNumber", width: 16 },
      { header: "Email", key: "email", width: 26 },
      { header: "Income Tax Number", key: "incomeTaxNumber", width: 20 },
      { header: "Contract Type", key: "contractType", width: 16 },
      { header: "Start Date", key: "startDate", width: 14 },
      { header: "Job Title", key: "jobTitle", width: 20 },
      { header: "Address Line 1", key: "addressLine1", width: 24 },
      { header: "Address Line 2", key: "addressLine2", width: 24 },
      { header: "City", key: "city", width: 18 },
      { header: "Province", key: "province", width: 20 },
      { header: "Area Code", key: "areaCode", width: 12 },
    ];
    worksheet.getRow(1).font = { bold: true };

    worksheet.addRow({
      clientNumber: "A0001",
      clientName: "John",
      clientSurname: "Doe",
      idNumber: "9001015009087",
      gender: "Male",
      race: "African",
      nationality: "South African",
      cellNumber: "0821234567",
      email: "john.doe@example.com",
      incomeTaxNumber: "1234567890",
      contractType: "Permanent",
      startDate: new Date(2024, 0, 15),
      jobTitle: "Store Manager",
      addressLine1: "123 Main Street",
      addressLine2: "",
      city: "Johannesburg",
      province: "Gauteng",
      areaCode: "2000",
    });

    worksheet.addRow({
      clientNumber: "B0002",
      clientName: "Jane",
      clientSurname: "Smith",
      idNumber: "8505125800082",
      gender: "Female",
      race: "White",
      nationality: "Namibian",
      cellNumber: "0839876543",
      email: "jane.smith@example.com",
      incomeTaxNumber: "0987654321",
      contractType: "Temporary",
      startDate: new Date(2025, 1, 1),
      jobTitle: "Admin Clerk",
      addressLine1: "45 Market Road",
      addressLine2: "Unit 7",
      city: "Cape Town",
      province: "Western Cape",
      areaCode: "8001",
    });

    worksheet.getColumn(4).numFmt = "0";
    worksheet.getColumn(12).numFmt = "dd/mm/yyyy";
    worksheet.getColumn(12).alignment = { horizontal: "left" };

    const listSheet = workbook.addWorksheet("Lists");
    listSheet.getColumn(1).values = ["", ...genderOptions];
    listSheet.getColumn(2).values = ["", ...raceOptions];
    listSheet.getColumn(3).values = ["", ...nationalityOptions];
    listSheet.getColumn(4).values = ["", ...southAfricanProvinces];
    listSheet.getColumn(5).values = ["", ...contractTypes];
    listSheet.state = "veryHidden";

    const validationStartRow = 2;
    const validationEndRow = 500;
    const genderFormula = `Lists!$A$2:$A$${genderOptions.length + 1}`;
    const raceFormula = `Lists!$B$2:$B$${raceOptions.length + 1}`;
    const nationalityFormula = `Lists!$C$2:$C$${nationalityOptions.length + 1}`;
    const provinceFormula = `Lists!$D$2:$D$${southAfricanProvinces.length + 1}`;
    const contractTypeFormula = `Lists!$E$2:$E$${contractTypes.length + 1}`;

    for (let row = validationStartRow; row <= validationEndRow; row++) {
      worksheet.getCell(row, 5).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [genderFormula],
      };
      worksheet.getCell(row, 6).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [raceFormula],
      };
      worksheet.getCell(row, 7).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [nationalityFormula],
      };
      worksheet.getCell(row, 17).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [provinceFormula],
      };
      worksheet.getCell(row, 11).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [contractTypeFormula],
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "client_upload_template.xlsx";
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
     if (selectedClients.size === filteredClients.length) {
       setSelectedClients(new Set());
       return;
     }
     setSelectedClients(new Set(filteredClients.map((emp) => emp.id)));
   };

   const toggleSelectClient = (id: string) => {
     const next = new Set(selectedClients);
     if (next.has(id)) {
       next.delete(id);
     } else {
       next.add(id);
     }
     setSelectedClients(next);
   };

  const openProfileDialog = async (client: Client, initialTab: ClientTab = "personal") => {
    let clientForProfile = client;
    if (user) {
      const { data } = await (supabase as any)
        .from("clients")
        .select(clientSelectColumnsWithTermination)
        .eq("company_id", user.id)
        .eq("id", client.id)
        .maybeSingle();
      if (data) {
        clientForProfile = data as Client;
      }
    }
    setSelectedClient(clientForProfile);
    setProfileForm(createProfileFormFromClient(clientForProfile));
    setProbationPeriod(clientForProfile.probation_period ?? "");
    setRetirementAge(
      retirementAgeOptions.find((option) => option === String(clientForProfile.retirement_age ?? 65)) ?? "65",
    );
    setUnionMember((clientForProfile.union_member as (typeof unionMemberOptions)[number]) ?? "");
    setTradeUnion(clientForProfile.trade_union ?? "");
    setDepartment((clientForProfile.department as (typeof departmentOptions)[number]) ?? "");
    setBranch(clientForProfile.branch ?? "");
    setReportingTo(clientForProfile.reporting_to ?? "");
    setOccupationalLevel(
      (clientForProfile.occupational_level as (typeof occupationalLevelOptions)[number]) ?? "",
    );
    setSalaryType((clientForProfile.salary_type as (typeof salaryTypeOptions)[number]) ?? "");
    setBasicSalary(clientForProfile.basic_salary ?? "");
    setWorkEmail(clientForProfile.work_email ?? "");
    setWorkCellNumber(clientForProfile.work_cell_number ?? "");
    setPendingIdDocumentFile(null);
    setPendingIdDocumentName("");
    setIsIdDocumentMarkedForRemoval(false);
    setPendingEmploymentContractFile(null);
    setPendingEmploymentContractName("");
    setIsEmploymentContractMarkedForRemoval(false);
    setPendingSlaFile(null);
    setPendingSlaFileName("");
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
   setActiveTab(initialTab);
   setIsEditMode(false);
   setActiveEditSection(null);
   setIsProfilePanelOpen(true);
  };

  useEffect(() => {
    const state = (location.state ?? {}) as { openClientId?: string; openClientTab?: ClientTab };
    const requestedId = (state.openClientId ?? "").trim();
    const requestedTab = state.openClientTab ?? "personal";
    if (!requestedId) return;
    const run = async () => {
      const existing = clients.find((client) => client.id === requestedId);
      const fetched =
        existing || !user?.id
          ? null
          : ((await (supabase as any)
              .from("clients")
              .select(clientSelectColumnsWithTermination)
              .eq("company_id", user.id)
              .eq("id", requestedId)
              .maybeSingle()).data as Client | null);
      const targetClient = existing ?? fetched;
      if (targetClient) {
        await openProfileDialog(targetClient, requestedTab);
      }
      navigate("/clients", { replace: true, state: {} });
    };
    void run();
  }, [clients, location.state, navigate, user?.id]);

  const closeProfileDialog = () => {
    if (!guardEditSession()) return;
    setIsProfilePanelOpen(false);
    setSelectedClient(null);
    setIsEditMode(false);
    setActiveEditSection(null);
    setProbationPeriod("");
    setRetirementAge("65");
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
    setPendingSlaFile(null);
    setPendingSlaFileName("");
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
    if (!selectedClient) return;
    setIsProfileSaving(true);
    try {
      const shouldUploadIdDocument = section === "identity" && !!pendingIdDocumentFile;
      const shouldRemoveIdDocument =
        section === "identity" && isIdDocumentMarkedForRemoval && !!idDocumentByClient[selectedClient.id];
      const shouldUploadEmploymentContract = section === "employmentStatus" && !!pendingEmploymentContractFile;
      const shouldUploadSlaDocument = section === "employmentStatus" && !!pendingSlaFile;
      const shouldRemoveEmploymentContract =
        section === "employmentStatus" &&
        isEmploymentContractMarkedForRemoval &&
        !!activeContractForSelectedClient;
      const identityFieldKeys: Array<keyof ClientProfileFormData> = [
        "clientName",
        "clientSurname",
        "incomeTaxNumber",
        "idNumber",
      ];
      const employmentStatusFieldKeys: Array<keyof ClientProfileFormData> = [
        "startDate",
        "endDate",
        "clientNumber",
      ];
      const hasIdentityFieldChanges =
        section === "identity" && !!originalProfile
          ? identityFieldKeys.some((key) => profileForm[key] !== originalProfile[key])
          : false;
      const hasEmploymentStatusFieldChanges =
        section === "employmentStatus" && !!originalProfile
          ? employmentStatusFieldKeys.some((key) => profileForm[key] !== originalProfile[key]) ||
            clientStatus !== getDisplayMembershipStatus((selectedClient as any)?.status)
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
        case "companyStructure":
          validated = companyStructureSectionSchema.parse(profileForm);
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
          if (section === "employmentStatus" && validated.contractType === "Temporary" && !validated.endDate) {
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
        const finalClientNumber = validated.clientNumber || null;
        const normalizedNumber = normalizeClientNumber(finalClientNumber);
        const duplicate = normalizedNumber
          ? clients.find(
              (emp) => {
                const dynamic = emp as Record<string, unknown>;
                const existingClientNumber =
                  (dynamic.client_number as string | undefined) ?? emp.client_number ?? "";
                return (
                  emp.id !== selectedClient.id &&
                  normalizeClientNumber(existingClientNumber) === normalizedNumber
                );
              },
            )
          : undefined;
        if (duplicate) {
          toast({
            title: "Duplicate client number",
            description: `You already allocated that client number to ${duplicate.client_name ?? "Client"} ${duplicate.client_surname ?? ""}. Please choose a different client number.`,
            variant: "destructive",
          });
          setIsProfileSaving(false);
          return;
        }
      }
      if (section === "identity") {
        const normalizedIdNumber = normalizeIdNumberValue(validated.idNumber);
        const duplicateIdClient = normalizedIdNumber
          ? clients.find(
              (emp) => {
                const dynamic = emp as Record<string, unknown>;
                const existingVatNumber =
                  (dynamic.vat_number as string | undefined) ?? emp.id_number ?? "";
                return (
                  emp.id !== selectedClient.id &&
                  normalizeIdNumberValue(existingVatNumber) === normalizedIdNumber
                );
              },
            )
          : undefined;
        if (duplicateIdClient) {
          toast({
            title: "Duplicate ID/passport number",
            description: `That ID/passport number is already allocated to ${duplicateIdClient.client_name ?? "Client"} ${duplicateIdClient.client_surname ?? ""}. Please use a different ID/passport number.`,
            variant: "destructive",
          });
          setIsProfileSaving(false);
          return;
        }
      }

      if (section === "identity" && !hasIdentityFieldChanges && (shouldUploadIdDocument || shouldRemoveIdDocument)) {
        if (shouldRemoveIdDocument) {
          await removeIdDocument(selectedClient.id);
        }
        if (shouldUploadIdDocument) {
          await uploadPendingIdDocument(selectedClient.id);
        }
        toast({
          title: "Client updated",
          description: "Client profile has been saved successfully.",
        });
        setIsEditMode(false);
        setActiveEditSection(null);
        return;
      }
      if (
        section === "employmentStatus" &&
        !hasEmploymentStatusFieldChanges &&
        (shouldUploadEmploymentContract || shouldRemoveEmploymentContract || shouldUploadSlaDocument)
      ) {
        if (shouldRemoveEmploymentContract) {
          await removeActiveEmploymentContract(selectedClient.id);
        }
        if (shouldUploadEmploymentContract) {
          await uploadPendingEmploymentContract(selectedClient.id);
        }
        if (shouldUploadSlaDocument) {
          await uploadPendingSlaDocument(selectedClient.id);
        }
        toast({
          title: "Client updated",
          description: "Client profile has been saved successfully.",
        });
        setIsEditMode(false);
        setActiveEditSection(null);
        return;
      }

      const normalizedStatus = clientStatus.trim().toLowerCase() || null;

      const updatePayload: ClientUpdate =
        section === "identity"
          ? {
              client_name: validated.clientName || null,
              client_surname: validated.clientSurname || null,
              id_number: validated.idNumber || null,
            }
          : section === "companyStructure"
            ? {
                company_type: validated.citizenshipStatus || null,
                industry: validated.industry || null,
                bargaining_council: validated.bargainingCouncil || null,
              }
          : section === "equity"
            ? {
                gender: validated.gender || null,
                race: validated.race || null,
              }
            : section === "contact"
              ? {
                  cell_number: validated.cellNumber || null,
                  email: validated.email || null,
                }
            : section === "statutory"
              ? {}
            : isEmploymentSection
                ? {
                    ...(section === "employmentStatus"
                      ? {
                          client_number: validated.clientNumber || null,
                          status: normalizedStatus,
                        }
                      : {}),
                  }
                : section === "homeAddress"
                  ? {}
                  : {};

      const { error } = await supabase
        .from("clients")
        .update(pickClientWritePayload(updatePayload as Record<string, unknown>) as unknown as TablesInsert<"clients">)
        .eq("id", selectedClient.id);

      if (error) throw error;

      toast({
        title: "Client updated",
        description: "Client profile has been saved successfully.",
      });

      const updatedClient: Client = {
        ...selectedClient,
        ...updatePayload,
      };

      setSelectedClient(updatedClient);
      setClientStatus(getDisplayMembershipStatus((updatedClient as any).status));
      setProfileForm(createProfileFormFromClient(updatedClient));
      setProbationPeriod(updatedClient.probation_period ?? "");
      setRetirementAge(
        retirementAgeOptions.find((option) => option === String(updatedClient.retirement_age ?? 65)) ?? "65",
      );
      setUnionMember((updatedClient.union_member as (typeof unionMemberOptions)[number]) ?? "");
      setTradeUnion(updatedClient.trade_union ?? "");
      setDepartment((updatedClient.department as (typeof departmentOptions)[number]) ?? "");
      setBranch(updatedClient.branch ?? "");
      setReportingTo(updatedClient.reporting_to ?? "");
      setOccupationalLevel(
        (updatedClient.occupational_level as (typeof occupationalLevelOptions)[number]) ?? "",
      );
      setSalaryType((updatedClient.salary_type as (typeof salaryTypeOptions)[number]) ?? "");
      setBasicSalary(updatedClient.basic_salary ?? "");
      setWorkEmail(updatedClient.work_email ?? "");
      setWorkCellNumber(updatedClient.work_cell_number ?? "");
      if (shouldRemoveIdDocument) {
        await removeIdDocument(selectedClient.id);
      }
      if (shouldUploadIdDocument) {
        await uploadPendingIdDocument(selectedClient.id);
      }
      if (shouldRemoveEmploymentContract) {
        await removeActiveEmploymentContract(selectedClient.id);
      }
      if (shouldUploadEmploymentContract) {
        await uploadPendingEmploymentContract(selectedClient.id);
      }
      if (shouldUploadSlaDocument) {
        await uploadPendingSlaDocument(selectedClient.id);
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
      await fetchClients();
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
    if (!selectedClient) return;
    setProfileForm(createProfileFormFromClient(selectedClient));
    setProbationPeriod(selectedClient.probation_period ?? "");
    setRetirementAge(
      retirementAgeOptions.find((option) => option === String(selectedClient.retirement_age ?? 65)) ?? "65",
    );
    setUnionMember((selectedClient.union_member as (typeof unionMemberOptions)[number]) ?? "");
    setTradeUnion(selectedClient.trade_union ?? "");
    setDepartment((selectedClient.department as (typeof departmentOptions)[number]) ?? "");
    setBranch(selectedClient.branch ?? "");
    setReportingTo(selectedClient.reporting_to ?? "");
    setOccupationalLevel(
      (selectedClient.occupational_level as (typeof occupationalLevelOptions)[number]) ?? "",
    );
    setSalaryType((selectedClient.salary_type as (typeof salaryTypeOptions)[number]) ?? "");
    setBasicSalary(selectedClient.basic_salary ?? "");
    setWorkEmail(selectedClient.work_email ?? "");
    setWorkCellNumber(selectedClient.work_cell_number ?? "");
    setClientStatus(getDisplayMembershipStatus((selectedClient as any)?.status));
    setServiceSelections(createMembershipServiceSelectionsFromClient(selectedClient));
    setPendingIdDocumentFile(null);
    setPendingIdDocumentName("");
    setIsIdDocumentMarkedForRemoval(false);
    setPendingEmploymentContractFile(null);
    setPendingEmploymentContractName("");
    setIsEmploymentContractMarkedForRemoval(false);
    setPendingSlaFile(null);
    setPendingSlaFileName("");
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
  }, [selectedClient]);

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
    const normalizedBargainingCouncilQuery = bargainingCouncilQuery.trim().toLowerCase();
    const filteredBargainingCouncilOptions = saBargainingCouncilOptions.filter((option) =>
      option.toLowerCase().includes(normalizedBargainingCouncilQuery),
    );
    const canUseCustomBargainingCouncil =
      bargainingCouncilQuery.trim().length > 0 &&
      !saBargainingCouncilOptions.some(
        (option) => option.toLowerCase() === bargainingCouncilQuery.trim().toLowerCase(),
      );

    return (
      <div className="space-y-3">
        <div
          ref={(el) => {
            sectionRefs.current.identity = el;
          }}
          className={`rounded-sm border border-slate-300 bg-white px-5 pb-5 pt-[9px] ${getSectionLockClass("identity")}`}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Company Identity</h3>
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
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Registered Name</Label>
              <Input
                className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
                placeholder="Please insert"
                value={profileForm.clientName}
                readOnly={!isEditMode}
                onFocus={enableEditMode}
                onMouseDown={enableEditMode}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    clientName: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Trading As</Label>
              <Input
                className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
                placeholder="Please insert"
                value={profileForm.clientSurname}
                readOnly={!isEditMode}
                onFocus={enableEditMode}
                onMouseDown={enableEditMode}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    clientSurname: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Registration Number</Label>
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
                    incomeTaxNumber: removeWhitespace(e.target.value),
                  }))
                }
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>VAT Number</Label>
              <Input
                className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
                placeholder="Please insert"
                value={profileForm.idNumber}
                readOnly={!isEditMode}
                onFocus={enableEditMode}
                onMouseDown={enableEditMode}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    idNumber: removeWhitespace(e.target.value),
                  }))
                }
              />
            </div>
          </div>
        </div>

        <div
          ref={(el) => {
            sectionRefs.current.companyStructure = el;
          }}
          className={`rounded-sm border border-slate-300 bg-white px-5 pb-5 pt-[9px] ${getSectionLockClass("companyStructure")}`}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Company Structure</h3>
            <div className="flex items-center gap-2">
              {isEditMode && activeEditSection === "companyStructure" && (
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
                  if (isEditMode && activeEditSection === "companyStructure" && !isProfileSaving) {
                    void handleSectionSave("companyStructure");
                    return;
                  }
                  handleSectionInteract("companyStructure", event);
                }}
                aria-label={
                  isEditMode && activeEditSection === "companyStructure"
                    ? "Save company structure details"
                    : "Edit company structure details"
                }
              >
                {isEditMode && activeEditSection === "companyStructure" ? (
                  <Save className="h-3.5 w-3.5" />
                ) : (
                  <Pencil className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-3">
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Company Type</Label>
              <Select
                value={profileForm.citizenshipStatus || ""}
                onValueChange={(value) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    citizenshipStatus: value,
                  }))
                }
              >
                <SelectTrigger
                  className={clientDropdownTriggerClass}
                  showIcon={isEditMode}
                  onPointerDown={handleSelectPointerDown}
                >
                  <SelectValue placeholder="Please select" />
                </SelectTrigger>
                <SelectContent className="text-[11px]">
                  {companyTypeOptions.map((option) => (
                    <SelectItem key={option} value={option} className={clientDropdownSelectItemClass}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Industry</Label>
              <Select
                value={profileForm.industry || ""}
                onValueChange={(value) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    industry: value,
                  }))
                }
              >
                <SelectTrigger
                  className={clientDropdownTriggerClass}
                  showIcon={isEditMode}
                  onPointerDown={handleSelectPointerDown}
                >
                  <SelectValue placeholder="Please select" />
                </SelectTrigger>
                <SelectContent className="text-[11px]">
                  {saIndustryOptions.map((option) => (
                    <SelectItem key={option} value={option} className={clientDropdownSelectItemClass}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Bargaining Council</Label>
              <Popover
                open={bargainingCouncilOpen}
                onOpenChange={(open) => {
                  if (!isEditMode) return;
                  setBargainingCouncilOpen(open);
                  if (!open) {
                    setBargainingCouncilQuery("");
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={`${clientDropdownTriggerClass} flex w-full items-center justify-between px-3 py-2 [&>span]:line-clamp-1`}
                    onPointerDown={handleSelectPointerDown}
                    disabled={!isEditMode}
                  >
                    <span className="truncate text-left">
                      {profileForm.bargainingCouncil || "Please select"}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="end">
                  <Command shouldFilter={false}>
                    <CommandInput
                      value={bargainingCouncilQuery}
                      onValueChange={setBargainingCouncilQuery}
                      placeholder="Search or type bargaining council..."
                      className="h-8 text-[11px]"
                    />
                    <CommandList>
                      <CommandEmpty className="py-3 text-center text-[11px] text-slate-500">
                        No bargaining council found.
                      </CommandEmpty>
                      <CommandGroup>
                        {canUseCustomBargainingCouncil && (
                          <CommandItem
                            className={clientDropdownCommandItemClass}
                            onSelect={() => {
                              const customValue = bargainingCouncilQuery.trim();
                              setProfileForm((prev) => ({ ...prev, bargainingCouncil: customValue }));
                              setBargainingCouncilOpen(false);
                              setBargainingCouncilQuery("");
                            }}
                          >
                            Use "{bargainingCouncilQuery.trim()}"
                          </CommandItem>
                        )}
                        {filteredBargainingCouncilOptions.map((option) => (
                          <CommandItem
                            key={option}
                            value={option}
                            className={`${clientDropdownCommandItemClass} bargaining-option`}
                            onSelect={() => {
                              setProfileForm((prev) => ({ ...prev, bargainingCouncil: option }));
                              setBargainingCouncilOpen(false);
                              setBargainingCouncilQuery("");
                            }}
                          >
                            <span className="bargaining-option-label">{option}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <style>{`
              .bargaining-option {
                overflow: hidden;
              }
              .bargaining-option-label {
                display: inline-block;
                min-width: 100%;
                white-space: nowrap;
                transform: translateX(0);
              }
              .bargaining-option:hover .bargaining-option-label {
                animation: bargaining-option-scroll 6s linear infinite alternate;
              }
              @keyframes bargaining-option-scroll {
                from {
                  transform: translateX(0);
                }
                to {
                  transform: translateX(-45%);
                }
              }
            `}</style>
          </div>
        </div>

        <div
          ref={(el) => {
            sectionRefs.current.equity = el;
          }}
          className={`rounded-sm border border-slate-300 bg-white px-5 pb-5 pt-[9px] ${getSectionLockClass("equity")}`}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Contacts</h3>
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
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Owner</Label>
              <Input
                className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
                placeholder="Please insert"
                value={profileForm.gender}
                readOnly={!isEditMode}
                onFocus={enableEditMode}
                onMouseDown={enableEditMode}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    gender: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Owner Number</Label>
              <Input
                className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
                placeholder="Please insert"
                value={profileForm.race}
                readOnly={!isEditMode}
                onFocus={enableEditMode}
                onMouseDown={enableEditMode}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    race: removeWhitespace(e.target.value),
                  }))
                }
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Owner Email</Label>
              <Input
                className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
                type="email"
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
          </div>
        </div>

        <div
          ref={(el) => {
            sectionRefs.current.contact = el;
          }}
          className={`rounded-sm border border-slate-300 bg-white px-5 pb-5 pt-[9px] ${getSectionLockClass("contact")}`}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Physical Address</h3>
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
                value={profileForm.physicalAddressLine2}
                placeholder="Please insert"
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
                    province: value as ClientProfileFormData["province"],
                  }))
                }
              >
                <SelectTrigger
                  className={clientDropdownTriggerClass}
                  showIcon={isEditMode}
                  onPointerDown={handleSelectPointerDown}
                >
                  <SelectValue placeholder="Please select" />
                </SelectTrigger>
                <SelectContent className="text-[11px]">
                  {southAfricanProvinces.map((province) => (
                    <SelectItem
                      key={province}
                      value={province}
                      className={clientDropdownSelectItemClass}
                    >
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
                readOnly={!isEditMode}
                onFocus={enableEditMode}
                onMouseDown={enableEditMode}
                value={profileForm.areaCode}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    areaCode: removeWhitespace(e.target.value),
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
                    postalProvince: value as ClientProfileFormData["postalProvince"],
                  }))
                }
              >
                <SelectTrigger
                  className={clientDropdownTriggerClass}
                  showIcon={isEditMode}
                  onPointerDown={handleSelectPointerDown}
                >
                  <SelectValue placeholder="Please select" />
                </SelectTrigger>
                <SelectContent className="text-[11px]">
                  {southAfricanProvinces.map((province) => (
                    <SelectItem
                      key={province}
                      value={province}
                      className={clientDropdownSelectItemClass}
                    >
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
                    postalAreaCode: removeWhitespace(e.target.value),
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
                  province: value as ClientProfileFormData["province"],
                }))
              }
            >
              <SelectTrigger
                className={clientDropdownTriggerClass}
                showIcon={isEditMode}
                onPointerDown={handleSelectPointerDown}
              >
                <SelectValue placeholder="Please select" />
              </SelectTrigger>
              <SelectContent className="text-[11px]">
                {southAfricanProvinces.map((province) => (
                  <SelectItem
                    key={province}
                    value={province}
                    className={clientDropdownSelectItemClass}
                  >
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
                  areaCode: removeWhitespace(e.target.value),
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
                  postalProvince: value as ClientProfileFormData["postalProvince"],
                }))
              }
            >
              <SelectTrigger
                className={clientDropdownTriggerClass}
                showIcon={isEditMode}
                onPointerDown={handleSelectPointerDown}
              >
                <SelectValue placeholder="Please select" />
              </SelectTrigger>
              <SelectContent className="text-[11px]">
                {southAfricanProvinces.map((province) => (
                  <SelectItem
                    key={province}
                    value={province}
                    className={clientDropdownSelectItemClass}
                  >
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
                  postalAreaCode: removeWhitespace(e.target.value),
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
      const rows = licencesForSelectedClient.filter((item) => item.category === category);
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
                    className={clientDropdownMenuItemClass}
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
      const rows = educationsForSelectedClient.filter((item) => item.category === category);
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
                    className={clientDropdownMenuItemClass}
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
    if (clientStatus === "Inactive") {
      const terminationReason =
        (selectedClient?.termination_reason ?? "").toString().trim() || "--";
      const terminationDateRaw = (selectedClient?.terminated_at ?? "").toString().trim();
      const previousJobTitle =
        (selectedClient?.previous_job_title ?? "").toString().trim() || "--";
      const terminationDocumentInputId = `termination-document-upload-${selectedClient?.id ?? "none"}`;

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
                <div className="ml-auto w-full max-w-[320px]">
                  <Input
                    className={`${fieldInputClass} w-full`}
                    type="text"
                    readOnly
                    placeholder="Please select a date"
                    value={terminationDateRaw ? formatDisplayDate(terminationDateRaw) : ""}
                    onClick={() => openDatePicker(terminationDateInputRef.current)}
                    onFocus={() => openDatePicker(terminationDateInputRef.current)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openDatePicker(terminationDateInputRef.current);
                      }
                    }}
                  />
                  <input
                    ref={terminationDateInputRef}
                    type="date"
                    value={terminationDateRaw}
                    onChange={(e) => void handleTerminationDateChange(e.target.value)}
                    className="sr-only"
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                </div>
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
                  {!terminationDocumentForSelectedClient && (
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
                  ) : terminationDocumentForSelectedClient ? (
                    <button
                      type="button"
                      className="max-w-[180px] truncate text-[11px] font-semibold text-blue-600 hover:underline"
                      onClick={() => void handleOpenTerminationDocument(terminationDocumentForSelectedClient)}
                      title={terminationDocumentForSelectedClient.fileName}
                    >
                      {terminationDocumentForSelectedClient.fileName}
                    </button>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-500">--</span>
                  )}
                  {terminationDocumentForSelectedClient && (
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
            <h4 className="text-sm font-semibold text-slate-900">Membership Details</h4>
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
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Member Number</Label>
            <Input
              className={`${fieldInputClass} w-full max-w-[320px] ml-auto`}
              value={profileForm.clientNumber}
              readOnly={!isEditMode}
              onFocus={enableEditMode}
              onMouseDown={enableEditMode}
              maxLength={CLIENT_NUMBER_MAX_LENGTH}
              onChange={(e) => handleCustomClientNumberChange(e.target.value)}
              placeholder="Please insert"
            />
          </div>
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Start Date</Label>
            <div className="ml-auto w-full max-w-[320px]">
              <Input
                className={`${fieldInputClass} w-full`}
                type="text"
                readOnly
                placeholder="Please select a date"
                value={profileForm.startDate ? formatDisplayDate(profileForm.startDate) : ""}
                onFocus={() => {
                  enableEditMode();
                  if (!isEditMode) return;
                  openDatePicker(startDateInputRef.current);
                }}
                onMouseDown={enableEditMode}
                onClick={() => {
                  if (!isEditMode) return;
                  openDatePicker(startDateInputRef.current);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (!isEditMode) return;
                    openDatePicker(startDateInputRef.current);
                  }
                }}
              />
              <input
                ref={startDateInputRef}
                type="date"
                value={profileForm.startDate}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    startDate: e.target.value,
                  }))
                }
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Renewal Date</Label>
            <div className="ml-auto w-full max-w-[320px]">
              <Input
                className={`${fieldInputClass} w-full`}
                type="text"
                readOnly
                placeholder="Please select a date"
                value={profileForm.endDate ? formatDisplayDate(profileForm.endDate) : ""}
                onFocus={() => {
                  enableEditMode();
                  if (!isEditMode) return;
                  openDatePicker(endDateInputRef.current);
                }}
                onMouseDown={enableEditMode}
                onClick={() => {
                  if (!isEditMode) return;
                  openDatePicker(endDateInputRef.current);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (!isEditMode) return;
                    openDatePicker(endDateInputRef.current);
                  }
                }}
              />
              <input
                ref={endDateInputRef}
                type="date"
                value={profileForm.endDate}
                onChange={(e) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    endDate: e.target.value,
                  }))
                }
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>Status</Label>
            <Select
              value={clientStatus}
              onValueChange={(value) => setClientStatus(value as (typeof membershipStatusOptions)[number])}
              onOpenChange={(open) => {
                if (open && !isEditMode) {
                  return;
                }
              }}
              disabled={!isEditMode}
            >
              <SelectTrigger className={clientDropdownTriggerClass} disabled={!isEditMode}>
                <SelectValue placeholder="Please select" />
              </SelectTrigger>
              <SelectContent className="text-[11px]">
                {membershipStatusOptions.map((option) => (
                  <SelectItem key={option} value={option} className={clientDropdownSelectItemClass}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-start gap-3">
            <Label className={`${fieldLabelClass} w-28 shrink-0 pt-1 text-left`}>Service Level Agreement (SLA)</Label>
            <div className="ml-auto flex w-full max-w-[320px] flex-col gap-1">
              <input
                ref={slaFileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={handleSlaFileChange}
              />
              <div className="flex flex-wrap items-center gap-2">
                {isEditMode && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 rounded border-slate-200 bg-white px-3 text-[11px] text-slate-600 hover:bg-white hover:border-blue-500 hover:text-blue-600"
                    disabled={isSlaUploading}
                    onClick={() => slaFileInputRef.current?.click()}
                  >
                    <Upload className="mr-1 h-3 w-3" />
                    {isSlaUploading ? "Uploading..." : "Upload"}
                  </Button>
                )}
                {pendingSlaFileName ? (
                  <span className="max-w-[170px] truncate text-[11px] font-semibold text-amber-700" title={pendingSlaFileName}>
                    {pendingSlaFileName}
                  </span>
                ) : slaContractForSelectedClient ? (
                  <button
                    type="button"
                    className="max-w-[170px] truncate text-[11px] font-semibold text-blue-600 hover:underline"
                    onClick={() => void handleOpenContract(slaContractForSelectedClient)}
                    title={slaContractForSelectedClient.fileName}
                  >
                    {slaContractForSelectedClient.fileName}
                  </button>
                ) : (
                  <span className="text-[11px] font-semibold text-slate-500">--</span>
                )}
                {isEditMode && slaContractForSelectedClient && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-7 rounded px-3 text-[11px] text-slate-600 hover:bg-transparent hover:text-rose-600 hover:underline border-0 shadow-none"
                    onClick={() => void handleRemoveSlaDocument()}
                    disabled={isSlaUploading}
                  >
                    Remove
                  </Button>
                )}
              </div>
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
          <h4 className="text-sm font-semibold text-slate-900">Service Selection</h4>
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
          {membershipTypeOptions.map((service) => (
            <div key={service} className="flex items-center gap-3">
              <Label className={`${fieldLabelClass} w-28 shrink-0 text-left`}>{service}</Label>
              <Select
                value={serviceSelections[service]}
                onValueChange={(value) =>
                  setServiceSelections((prev) => ({
                    ...prev,
                    [service]: value as MembershipServiceSelection,
                  }))
                }
                onOpenChange={(open) => {
                  if (open && !isEditMode) {
                    return;
                  }
                }}
                disabled={!isEditMode}
              >
                <SelectTrigger className={clientDropdownTriggerClass} disabled={!isEditMode}>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent className="text-[11px]">
                  {membershipServiceSelectionOptions.map((option) => (
                    <SelectItem key={option} value={option} className={clientDropdownSelectItemClass}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      <div
        ref={(el) => {
          sectionRefs.current.employmentRemuneration = el;
        }}
        className={`rounded-sm border border-slate-300 bg-white px-5 pb-5 pt-[9px] ${getSectionLockClass("employmentRemuneration")}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-900">Billing Terms</h4>
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
                className={clientDropdownTriggerClass}
                disabled={!isEditMode}
              >
                <SelectValue placeholder="Please select a cycle" />
              </SelectTrigger>
              <SelectContent className="text-[11px]">
                {salaryTypeOptions.map((option) => (
                  <SelectItem
                    key={option}
                    value={option}
                    className={clientDropdownSelectItemClass}
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
              value={formatThousandsWithCommas(sanitizeSalaryInput(basicSalary))}
              readOnly={!isEditMode}
              onFocus={enableEditMode}
              onMouseDown={enableEditMode}
              onChange={(e) => setBasicSalary(sanitizeSalaryInput(e.target.value))}
              onBlur={() => setBasicSalary((prev) => normalizeSalaryForStorage(prev))}
            />
          </div>
        </div>
      </div>

    </div>
  );
  };

  const renderDisciplineTab = () => {
    const showingValid = warningFilter === "valid";
    const activeWarnings = showingValid ? warningsByStatus.valid : warningsByStatus.expired;
    const warningTypeTag: Record<ClientWarning["warningType"], string> = {
      First: "First",
      Second: "Second",
      Serious: "Serious",
      Final: "Final",
    };
    const warningTypeBadgeClass: Record<ClientWarning["warningType"], string> = {
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
                    className={clientDropdownSelectItemClass}
                  >
                    Valid
                  </SelectItem>
                  <SelectItem
                    value="expired"
                    className={clientDropdownSelectItemClass}
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
                                  className={clientDropdownMenuItemWithGapClass}
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
                                    className={clientDropdownMenuItemWithGapClass}
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
                    className={clientDropdownSelectItemClass}
                  >
                    Active
                  </SelectItem>
                  <SelectItem
                    value="inactive"
                    className={clientDropdownSelectItemClass}
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
                                    className={clientDropdownMenuItemWithGapClass}
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
                <h1 className="text-4xl font-normal text-blue-600 -ml-1">Clients</h1>
                <p className="text-xs text-slate-600 mt-2">
                  Browse, search, and manage your clients and attach their documents.
                </p>
              </div>
            </div>
            <section className="relative flex-1 min-h-0 overflow-hidden overflow-x-hidden pr-2">
              <div className="h-full min-h-0 space-y-0 p-0 flex flex-col">
        <Card className="rounded-none bg-white border-0 shadow-none h-full min-h-0 flex flex-col">
          <CardHeader className="pl-4 pr-4 pt-5 pb-3 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="group relative w-full sm:w-[400px]">
                <Input
                  placeholder="Search clients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`h-8 rounded-sm border border-slate-200 bg-white !text-[11px] font-semibold shadow-sm transition-colors placeholder:!text-[11px] hover:border-[#3eca44] focus-visible:!border focus-visible:!border-black focus-visible:ring-0 group-hover:border-[#3eca44] dark:bg-background ${
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
                <p className="text-[11px] font-medium text-slate-500 whitespace-nowrap sm:self-end">
                  <span className="text-slate-900">{tableRangeStart}-{tableRangeEnd}</span> of {totalClientCount} clients
                </p>
              </div>
              <div className="flex items-center gap-2 justify-end">
                {clientStatusFilter === "active" && selectedClients.size > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleBulkDelete()}
                    className="h-8 w-24 rounded px-3 text-[11px] inline-flex items-center justify-center border border-rose-500 bg-white text-rose-600 hover:bg-rose-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-rose-600"
                  >
                    Delete ({selectedClients.size})
                  </Button>
                ) : null}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isExportingClientsPdf || isExportingClientsExcel}
                      className={exportButtonStyle2}
                    >
                      <span>{isExportingClientsPdf || isExportingClientsExcel ? "Exporting" : "Export"}</span>
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={0} className="w-36 text-[11px] rounded-t-none border-t-0">
                    <DropdownMenuItem
                      onClick={() => void handleExportClientsPdf()}
                      disabled={isExportingClientsPdf || isExportingClientsExcel}
                      className={clientDropdownMenuItemWithGapClass}
                    >
                      <Download className={`h-3.5 w-3.5${isExportingClientsPdf ? " animate-pulse" : ""}`} />
                      Export as PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => void handleExportClientsExcel()}
                      disabled={isExportingClientsPdf || isExportingClientsExcel}
                      className={clientDropdownMenuItemWithGapClass}
                    >
                      <Download className={`h-3.5 w-3.5${isExportingClientsExcel ? " animate-pulse" : ""}`} />
                      Export as Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
                      className={filterButtonStyle2}
                    >
                      <span>Filter</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isFiltersPanelOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="bottom"
                    align="end"
                    sideOffset={0}
                    className="w-[260px] rounded-t-none border border-slate-200 border-t-0 bg-white p-0 shadow-lg"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                      <span className="text-[12px] font-semibold text-slate-800">Filter</span>
                      <button
                        type="button"
                        className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 hover:underline"
                        onClick={() => {
                          setClientStatusFilter("active");
                          setContractFilter("all");
                          setGenderFilter("all");
                          setRaceFilter("all");
                          setNationalityFilter("all");
                          closeClientFiltersPanel();
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
                                className="flex h-8 w-full items-center justify-between text-[11px] text-slate-700 hover:bg-blue-50/70 hover:text-blue-600"
                                onClick={() => {
                                  setClientStatusFilter(option.value);
                                  closeClientFiltersPanel();
                                }}
                              >
                                <span>{option.label}</span>
                                {clientStatusFilter === option.value && <Check className="h-3.5 w-3.5 text-blue-600" />}
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
                              { value: "all" as const, label: "All clients" },
                              { value: "permanent" as const, label: "Permanent" },
                              { value: "temporary" as const, label: "Temporary" },
                            ].map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                className="flex h-8 w-full items-center justify-between text-[11px] text-slate-700 hover:bg-blue-50/70 hover:text-blue-600"
                                onClick={() => {
                                  setContractFilter(option.value);
                                  closeClientFiltersPanel();
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
                                className="flex h-8 w-full items-center justify-between text-[11px] text-slate-700 hover:bg-blue-50/70 hover:text-blue-600"
                                onClick={() => {
                                  setGenderFilter(option.value as "all" | ClientProfileFormData["gender"]);
                                  closeClientFiltersPanel();
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
                                className="flex h-8 w-full items-center justify-between text-[11px] text-slate-700 hover:bg-blue-50/70 hover:text-blue-600"
                                onClick={() => {
                                  setRaceFilter(option.value as "all" | ClientProfileFormData["race"]);
                                  closeClientFiltersPanel();
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
                                className="flex h-8 w-full items-center justify-between text-[11px] text-slate-700 hover:bg-blue-50/70 hover:text-blue-600"
                                onClick={() => {
                                  setNationalityFilter(option.value);
                                  closeClientFiltersPanel();
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
                <DropdownMenu open={isNewClientMenuOpen} onOpenChange={setIsNewClientMenuOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      ref={newClientMenuTriggerRef}
                      className={newClientButtonStyle1}
                    >
                      <span className="truncate">New Client</span>
                      <ChevronDown className="h-4 w-4 text-current" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={0} className={newClientDropdownContentStyle}>
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        setIsNewClientMenuOpen(false);
                        setRehireClientId(null);
                        setAddForm(createBlankAddForm());
                        setAddFormStep(1);
                        setIsAddDialogOpen(true);
                      }}
                      className={newClientDropdownItemStyle}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Single
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        setIsNewClientMenuOpen(false);
                        handleBulkDialogChange(true);
                      }}
                      className={newClientDropdownItemStyle}
                    >
                      <Users className="h-3.5 w-3.5" />
                      Multiple
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pl-4 pr-4 pb-2 flex-1 min-h-0 overflow-hidden">
            {isClientsLoading ? (
              <div className="flex items-center justify-center pt-[210px] pb-10">
                <img
                  src="/llasa_thumbnail.png"
                  alt="Loading"
                  className="h-12 w-12 animate-spin"
                  style={{ animationDuration: "2s" }}
                />
              </div>
            ) : clients.length === 0 && !hasClientTableFiltersApplied ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No clients added yet</p>
                <Button
                  onClick={() => {
                    setRehireClientId(null);
                    setAddForm(createBlankAddForm());
                    setAddFormStep(1);
                    setIsAddDialogOpen(true);
                  }}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Your First Client
                </Button>
              </div>
            ) : clients.length === 0 || filteredClients.length === 0 ? (
              <div className="text-center py-12">
                {clientStatusFilter === "inactive" ? (
                  <p className="text-muted-foreground">
                    You don't have any inactive clients. Switch back to your{" "}
                    <button
                      type="button"
                      onClick={() => setClientStatusFilter("active")}
                      className="font-semibold text-blue-600 hover:underline"
                    >
                      Active
                    </button>{" "}
                    clients.
                  </p>
                ) : (
                  <p className="text-muted-foreground">No clients match the selected filters.</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div
                  className="relative overflow-hidden rounded-sm border border-slate-200"
                >
                  <div className="grid grid-cols-[0.4fr_2fr_2fr_1.4fr_1.1fr_1.1fr_1.4fr_0.7fr_1fr] items-center gap-2 border-b bg-[#2D4256] pl-1 pr-3 py-3 text-xs font-semibold text-white">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        indicator="x"
                        checked={
                          filteredClients.length > 0 && selectedClients.size === filteredClients.length
                            ? true
                            : selectedClients.size > 0
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={() => toggleSelectAll()}
                        aria-label="Select all clients"
                        className="h-3 w-3 rounded-[2px] border-white/80 bg-white text-white data-[state=checked]:border-[#3eca44] data-[state=checked]:bg-[#3eca44]"
                      />
                    </div>
                    <div className="flex items-center leading-tight">Company Name</div>
                    <div className="flex items-center leading-tight">Trading As</div>
                    <div className="flex items-center gap-2 leading-tight">Registration Number</div>
                    <div className="flex items-center leading-tight">Contact Person</div>
                    <div className="flex items-center leading-tight text-left">Contact Number</div>
                    <div className="flex items-center leading-tight text-left">Email</div>
                    <div className="flex items-center leading-tight text-left">Status</div>
                    <div className="flex items-center justify-center leading-tight text-center">Actions</div>
                  </div>
                  <div
                    ref={tableScrollRef}
                    className="divide-y client-table-scroll overflow-y-auto min-h-0"
                    style={{ height: tableBodyResponsiveHeight, maxHeight: tableBodyResponsiveHeight }}
                  >
                    {filteredClients.map((client) => (
                      <div
                        key={client.id}
                        className="grid grid-cols-[0.4fr_2fr_2fr_1.4fr_1.1fr_1.1fr_1.4fr_0.7fr_1fr] items-center gap-2 pl-1 pr-3 py-1 text-xs hover:bg-[#3eca44]/5"
                      >
                        <div className="flex items-center justify-center">
                          <Checkbox
                            indicator="x"
                            checked={selectedClients.has(client.id)}
                            onCheckedChange={() => toggleSelectClient(client.id)}
                            aria-label={`Select ${getClientDisplayName(client).toLowerCase()}`}
                            className="h-3 w-3 rounded-[2px] border-slate-400 text-white data-[state=checked]:border-[#3eca44] data-[state=checked]:bg-[#3eca44]"
                          />
                        </div>
                        <div className="font-medium leading-tight">
                          <button
                            type="button"
                            onClick={() => void openProfileDialog(client)}
                            className="text-left text-slate-900 hover:text-slate-900 hover:underline transition-colors"
                          >
                            {getClientRegisteredName(client)}
                          </button>
                        </div>
                        <div className="leading-tight">{getClientTradingName(client) || "--"}</div>
                        <div className="flex items-center gap-2 leading-tight">
                          <span>
                            {(client.registration_number ?? client.income_tax_number ?? "").trim()
                              ? formatRegistrationNumberMaskDisplay(
                                  (client.registration_number ?? client.income_tax_number ?? "").trim(),
                                )
                              : "--"}
                          </span>
                        </div>
                        <div className="leading-tight">
                          {(client.owner ?? client.gender ?? "").trim() || "--"}
                        </div>
                        <div className="flex items-center leading-tight text-left">
                          {(client.tel_cell ?? client.race ?? client.cell_number ?? "").trim() || "--"}
                        </div>
                        <div className="flex items-center leading-tight text-left">
                          {(client.client_email ?? client.email ?? "").trim() || "--"}
                        </div>
                        <div className="flex items-center leading-tight text-left">
                          {(client.status ?? "").trim()
                            ? (client.status ?? "").trim().toLowerCase() === "inactive"
                              ? "Inactive"
                              : "Active"
                            : "--"}
                        </div>
                        <div className="flex items-center justify-center">
                          <TooltipProvider delayDuration={0} skipDelayDuration={0}>
                            <div className="flex items-center justify-center gap-1 ml-1">
                              <Tooltip disableHoverableContent>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => void openProfileDialog(client)}
                                    className="h-6 w-6 p-0 hover:text-[#3eca44] hover:bg-muted/50 bg-transparent"
                                  >
                                    <FolderOpen className="h-3 w-3" strokeWidth={1.5} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="rounded border border-slate-200 bg-white text-slate-700 text-[11px] shadow-[0_4px_12px_rgba(15,23,42,0.18)]">
                                  Client File
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip disableHoverableContent>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDocumentDialogClient(client)}
                                    className="h-6 w-6 p-0 group hover:bg-muted/50 bg-transparent"
                                  >
                                    <FilePlus className="h-3 w-3 transition-colors group-hover:text-[#3eca44]" strokeWidth={1.5} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="rounded border border-slate-200 bg-white text-slate-700 text-[11px] shadow-[0_4px_12px_rgba(15,23,42,0.18)]">
                                  Add Document
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip disableHoverableContent>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => void handleTerminateClient(client)}
                                    className="h-6 w-6 p-0 group hover:bg-muted/50 bg-transparent"
                                  >
                                    <Trash2 className="h-3 w-3 transition-colors group-hover:text-red-600" strokeWidth={1.5} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="rounded border border-slate-200 bg-white text-slate-700 text-[11px] shadow-[0_4px_12px_rgba(15,23,42,0.18)]">
                                  Delete Client
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
                      <div className="relative rounded-sm border border-[#3eca44]/30 bg-white/95 px-4 py-1 text-xs font-semibold text-[#2f9f35] backdrop-blur supports-[backdrop-filter]:bg-white/80">
                        <span className="pointer-events-none absolute inset-0 rounded-sm shadow-[0_3px_10px_rgba(62,202,68,0.28),0_-3px_10px_rgba(62,202,68,0.18)]" aria-hidden="true"></span>
                        <span className="relative">Scroll down</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative top-[5px] flex items-center justify-center gap-8">
                    <Button
                      variant="outline"
                      onClick={goToPreviousPage}
                      disabled={isFirstPage}
                      aria-label="Previous page"
                      className="h-7 w-20 rounded px-2 text-[10px] inline-flex items-center justify-center border border-[#3eca44] bg-white text-[#3eca44] hover:bg-[#3eca44] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-[#3eca44]"
                    >
                      Previous
                    </Button>
                    <div className="flex max-w-[420px] items-center gap-1 overflow-x-auto px-1 py-0.5">
                      {paginationItems.map((item, index) =>
                        item === "..." ? (
                          <span key={`ellipsis-${index}`} className="px-1 text-[11px] font-semibold text-slate-500">
                            ...
                          </span>
                        ) : (
                          (() => {
                            const pageNumber = Number(item);
                            return (
                              <Button
                                key={pageNumber}
                                type="button"
                                variant="outline"
                                onClick={() => setCurrentPage(pageNumber)}
                                className={`h-7 min-w-7 rounded px-1.5 text-[10px] inline-flex items-center justify-center ${
                                  currentPage === pageNumber
                                    ? "border border-[#3eca44] bg-white text-[#3eca44] hover:bg-[#3eca44]/10 hover:text-[#3eca44]"
                                    : "border border-slate-300 bg-white text-[#3eca44] hover:border-[#3eca44] hover:bg-[#3eca44]/10 hover:text-[#3eca44]"
                                }`}
                              >
                                {pageNumber}
                              </Button>
                            );
                          })()
                        ),
                      )}
                    </div>
                    <Button
                      variant="outline"
                      onClick={goToNextPage}
                      disabled={isLastPage}
                      aria-label="Next page"
                      className="h-7 w-20 rounded px-2 text-[10px] inline-flex items-center justify-center border border-[#3eca44] bg-white text-[#3eca44] hover:bg-[#3eca44] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-[#3eca44]"
                    >
                      Next
                    </Button>
                </div>
              </div>
            )}
          </CardContent>
                </Card>

                <Dialog open={isBulkDialogOpen} onOpenChange={handleBulkDialogChange}>
                  <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden">
                    <div className="relative">
                      <div className="absolute inset-x-0 top-0 flex h-[46px] items-center justify-between px-4">
                        <div className="flex items-center gap-2 pl-2">
                          <UsersRound className="h-4 w-4 text-white" />
                          <DialogTitle className="text-sm font-semibold text-white">Add Multiple Clients</DialogTitle>
                        </div>
                        <DialogClose asChild>
                          <button type="button" className="text-white hover:text-white/80">
                            <X className="h-4 w-4" />
                          </button>
                        </DialogClose>
                      </div>
                      <div className="mt-[46px] bg-white px-6 pb-6 pt-2">
                      <div className="pt-0 pb-2"></div>
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
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={isAddDialogOpen} onOpenChange={handleAddDialogChange}>
                  <DialogContent
                    className="w-[94vw] max-w-[380px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden"
                    onCloseAutoFocus={(event) => event.preventDefault()}
                  >
                    <div className="relative">
                      <div className="absolute inset-x-0 top-0 flex h-[46px] items-center justify-between px-4">
                        <div className="flex items-center gap-2 pl-2">
                          <User className="h-4 w-4 text-white" />
                          <DialogTitle className="text-sm font-semibold text-white">
                            {rehireClientId ? "Rehire Client" : "New Client"}
                          </DialogTitle>
                        </div>
                        <DialogClose asChild>
                          <button type="button" className="text-white hover:text-white/80">
                            <X className="h-4 w-4" />
                          </button>
                        </DialogClose>
                      </div>
                      <div className="mt-[46px] bg-white px-6 pb-6 pt-2">
                    <div className="pt-0 pb-2"></div>
                    <form onSubmit={handleAddClient} className="space-y-4 pt-2">
                      <div className="mx-auto w-full max-w-[320px] py-4">
                        <div className="relative grid grid-cols-3 items-start">
                          <div className="pointer-events-none absolute left-[calc(16.6667%+26px)] top-[10px] h-[2px] w-[calc(33.3333%-52px)] bg-slate-300" />
                          <div className="pointer-events-none absolute left-[calc(50%+26px)] top-[10px] h-[2px] w-[calc(33.3333%-52px)] bg-slate-300" />
                          {(isAddFormStepOneComplete || addFormStep > 1) && (
                            <div className="pointer-events-none absolute left-[calc(16.6667%+26px)] top-[10px] h-[2px] w-[calc(33.3333%-52px)] bg-[#3eca44]" />
                          )}
                          {(isAddFormStepTwoComplete || addFormStep > 2) && (
                            <div className="pointer-events-none absolute left-[calc(50%+26px)] top-[10px] h-[2px] w-[calc(33.3333%-52px)] bg-[#3eca44]" />
                          )}
                          {[
                            { step: 1 as const, label: "Client Details" },
                            { step: 2 as const, label: "Membership" },
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
                                      ? "bg-[#3eca44] text-white"
                                      : isActive
                                        ? "bg-[#3eca44] text-white"
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
                                Registered Name <span className="text-red-600">*</span>
                              </span>
                              <Input
                                id="clientName"
                                className={getAddModalInputClass(addForm.clientName.trim().length > 0)}
                                placeholder="Insert company registered name"
                                value={addForm.clientName}
                                onChange={(e) => setAddForm((prev) => ({ ...prev, clientName: e.target.value }))}
                              />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                            <div className="relative w-full max-w-none">
                              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                Trading as
                              </span>
                              <Input id="clientSurname" className={getAddModalInputClass(addForm.clientSurname.trim().length > 0)} placeholder="Insert trading name" value={addForm.clientSurname} onChange={(e) => setAddForm((prev) => ({ ...prev, clientSurname: e.target.value }))} />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                            <div className="relative w-full max-w-none">
                              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                Registration Number <span className="text-red-600">*</span>
                              </span>
                              <Input
                                id="registrationNumber"
                                ref={registrationNumberInputRef}
                                className={getAddModalInputClass(isAddFormRegistrationNumberComplete)}
                                value={
                                  isRegistrationNumberFocused || addForm.registrationNumber.trim().length > 0
                                    ? formatRegistrationNumberMaskDisplay(addForm.registrationNumber)
                                    : ""
                                }
                                onChange={(e) =>
                                  setAddForm((prev) => ({
                                    ...prev,
                                    registrationNumber: formatRegistrationNumberInput(e.target.value),
                                  }))
                                }
                                onKeyDown={(e) => {
                                  const currentDigits = getRegistrationDigits(addForm.registrationNumber);
                                  const isDigitKey = /^\d$/.test(e.key);
                                  if (isDigitKey) {
                                    e.preventDefault();
                                    if (currentDigits.length >= 12) return;
                                    const nextDigits = `${currentDigits}${e.key}`;
                                    setAddForm((prev) => ({
                                      ...prev,
                                      registrationNumber: formatRegistrationNumberInput(nextDigits),
                                    }));
                                    return;
                                  }

                                  if (e.key === "Backspace") {
                                    e.preventDefault();
                                    const nextDigits = currentDigits.slice(0, -1);
                                    setAddForm((prev) => ({
                                      ...prev,
                                      registrationNumber: formatRegistrationNumberInput(nextDigits),
                                    }));
                                    return;
                                  }

                                  if (e.key === "Delete") {
                                    e.preventDefault();
                                    return;
                                  }

                                  if (e.key === "Tab") return;
                                  if (e.ctrlKey || e.metaKey) return;
                                  e.preventDefault();
                                }}
                                onPaste={(e) => {
                                  e.preventDefault();
                                  const pastedDigits = getRegistrationDigits(e.clipboardData.getData("text"));
                                  setAddForm((prev) => ({
                                    ...prev,
                                    registrationNumber: formatRegistrationNumberInput(pastedDigits),
                                  }));
                                }}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setIsRegistrationNumberFocused(true);
                                  registrationNumberInputRef.current?.focus();
                                }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  const position = getRegistrationNumberCaretPosition(addForm.registrationNumber);
                                  registrationNumberInputRef.current?.setSelectionRange(position, position);
                                }}
                                onFocus={() => {
                                  setIsRegistrationNumberFocused(true);
                                  const position = getRegistrationNumberCaretPosition(addForm.registrationNumber);
                                  requestAnimationFrame(() => {
                                    registrationNumberInputRef.current?.setSelectionRange(position, position);
                                  });
                                }}
                                onSelect={() => {
                                  const position = getRegistrationNumberCaretPosition(addForm.registrationNumber);
                                  registrationNumberInputRef.current?.setSelectionRange(position, position);
                                }}
                                onBlur={() => setIsRegistrationNumberFocused(false)}
                                placeholder="Insert company registration number"
                                inputMode="numeric"
                              />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                            <div className="relative w-full max-w-none">
                              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                VAT Number
                              </span>
                              <Input id="idNumber" className={getAddModalInputClass(addForm.idNumber.trim().length > 0)} value={addForm.idNumber} onChange={(e) => setAddForm((prev) => ({ ...prev, idNumber: e.target.value }))} placeholder="Insert company vat number" />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                            <div className="relative w-full max-w-none">
                              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                Owner <span className="text-red-600">*</span>
                              </span>
                              <Input
                                id="owner"
                                className={getAddModalInputClass(addForm.gender.trim().length > 0)}
                                placeholder="Insert owner's name and surname"
                                value={addForm.gender}
                                onChange={(e) => setAddForm((prev) => ({ ...prev, gender: e.target.value }))}
                              />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                            <div className="relative w-full max-w-none">
                              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                Tell / Cell <span className="text-red-600">*</span>
                              </span>
                              <Input
                                id="tellCell"
                                className={getAddModalInputClass(addForm.race.trim().length > 0)}
                                placeholder="Insert company contact number"
                                value={addForm.race}
                                onChange={(e) => setAddForm((prev) => ({ ...prev, race: e.target.value }))}
                              />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                            <div className="relative w-full max-w-none">
                              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                Email <span className="text-red-600">*</span>
                              </span>
                              <Input id="cellNumber" className={getAddModalInputClass(addForm.cellNumber.trim().length > 0)} placeholder="Insert company email" value={addForm.cellNumber} onChange={(e) => setAddForm((prev) => ({ ...prev, cellNumber: e.target.value }))} />
                            </div>
                          </div>
                        </div>
                      )}

                      {addFormStep === 2 && (
                        <div className="w-full space-y-4">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                            <div className="relative w-full max-w-none">
                              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                Client Number <span className="text-red-600">*</span>
                              </span>
                              <Input id="addClientNumber" className={getAddModalInputClass(addForm.clientNumber.trim().length > 0)} placeholder="Please insert client number" value={addForm.clientNumber} maxLength={CLIENT_NUMBER_MAX_LENGTH} onChange={(e) => setAddForm((prev) => ({ ...prev, clientNumber: sanitizeClientNumber(e.target.value) }))} />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                            <div className="relative w-full max-w-none">
                              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                Start Date <span className="text-red-600">*</span>
                              </span>
                              <Input
                                id="startDate"
                                className={getAddModalInputClass(addForm.startDate.trim().length > 0)}
                                type="text"
                                readOnly
                                placeholder="Please select a date"
                                value={addForm.startDate ? formatDisplayDate(addForm.startDate) : ""}
                                onClick={() => openDatePicker(addModalStartDateInputRef.current)}
                                onFocus={() => openDatePicker(addModalStartDateInputRef.current)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    openDatePicker(addModalStartDateInputRef.current);
                                  }
                                }}
                              />
                              <input
                                ref={addModalStartDateInputRef}
                                type="date"
                                value={addForm.startDate}
                                onChange={(e) =>
                                  setAddForm((prev) => ({
                                    ...prev,
                                    startDate: e.target.value,
                                    endDate: addMonthsToIsoDate(e.target.value, 12),
                                  }))
                                }
                                className="sr-only"
                                aria-hidden="true"
                                tabIndex={-1}
                              />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                            <div className="relative w-full max-w-none">
                              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                Membership Renewal Date <span className="text-red-600">*</span>
                              </span>
                              <Input
                                id="endDate"
                                className={getAddModalInputClass(addForm.endDate.trim().length > 0)}
                                type="text"
                                readOnly
                                placeholder="Auto-calculated from start date"
                                value={addForm.endDate ? formatDisplayDate(addForm.endDate) : ""}
                              />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                            <div className="relative w-full max-w-none">
                              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                Payment Cycle <span className="text-red-600">*</span>
                              </span>
                              <Select
                                value={addForm.contractType || undefined}
                                onValueChange={(value) => setAddForm((prev) => ({ ...prev, contractType: value }))}
                              >
                                <SelectTrigger
                                  id="paymentCycle"
                                  className={`${getAddModalSelectTriggerClass(addForm.contractType.trim().length > 0)} ${addModalDropdownToneClass}`}
                                >
                                  <SelectValue placeholder="Please select payment cycle" />
                                </SelectTrigger>
                                <SelectContent className="text-[11px]">
                                  {paymentCycleOptions.map((cycle) => (
                                    <SelectItem key={cycle} value={cycle} className={addModalSelectItemClass}>
                                      {cycle}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">                            <div className="relative w-full max-w-none">
                              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                Member Type <span className="text-red-600">*</span>
                              </span>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className={`${getAddModalSelectTriggerClass(addForm.memberTypes.length > 0)} ${addModalDropdownToneClass} w-full justify-between px-3 hover:bg-white hover:text-slate-700`}
                                  >
                                    <span
                                      className={`truncate text-left ${
                                        addForm.memberTypes.length === 0 ? "text-[10px] text-slate-400" : ""
                                      }`}
                                    >
                                      {addForm.memberTypes.length > 0
                                        ? addForm.memberTypes
                                            .map((memberType) => membershipTypeAcronyms[memberType as keyof typeof membershipTypeAcronyms] || memberType)
                                            .join(", ")
                                        : "Select member type(s)"}
                                    </span>
                                    <ChevronDown className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-[320px] text-[11px]">
                                  {membershipTypeOptions.map((memberType) => {
                                    const isChecked = addForm.memberTypes.includes(memberType);
                                    return (
                                      <DropdownMenuCheckboxItem
                                        key={memberType}
                                        checked={isChecked}
                                        onSelect={(event) => event.preventDefault()}
                                        onCheckedChange={() =>
                                          setAddForm((prev) => ({
                                            ...prev,
                                            memberTypes: prev.memberTypes.includes(memberType)
                                              ? prev.memberTypes.filter((value) => value !== memberType)
                                              : [...prev.memberTypes, memberType],
                                          }))
                                        }
                                        className={membershipDropdownItemClass}
                                      >
                                        <span className="flex w-full items-center justify-between gap-3">
                                          <span>{memberType}</span>
                                          <span className="text-[10px] font-semibold text-slate-500">
                                            {membershipTypeAcronyms[memberType]}
                                          </span>
                                        </span>
                                      </DropdownMenuCheckboxItem>
                                    );
                                  })}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      )}

                      {addFormStep === 3 && (
                        <div className="w-full space-y-5">
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
                                  <Select value={addForm.province} onValueChange={(value) => setAddForm((prev) => ({ ...prev, province: value as AddClientFormState["province"] }))}>
                                  <SelectTrigger className={`${getAddModalSelectTriggerClass(addForm.province.trim().length > 0)} ${addModalDropdownToneClass}`}>
                                    <SelectValue placeholder="Please select province" />
                                  </SelectTrigger>
                                  <SelectContent className="text-[11px]">
                                    {southAfricanProvinces.map((province) => (
                                        <SelectItem key={province} value={province} className={addModalSelectItemClass}>
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
                      )}
                      </div>

                      <div className="mt-6 grid grid-cols-3 items-center border-t border-dashed border-muted/60 pt-4">
                        <div className="justify-self-start">
                          {addFormStep > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              className="h-[28px] w-[84px] rounded border-[#3eca44] px-3 text-xs text-[#3eca44] hover:bg-transparent hover:text-[#3eca44]"
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
                              className="h-[28px] w-[84px] rounded bg-[#3eca44] px-3 text-xs text-white hover:bg-[#34b73b]"
                              onClick={handleAddFormNext}
                              disabled={(addFormStep === 1 && !isAddFormStepOneComplete) || (addFormStep === 2 && !isAddFormStepTwoComplete)}
                            >
                              Next
                            </Button>
                          ) : (
                            <Button
                              type="submit"
                              className="h-[30px] w-[92px] rounded bg-[#3eca44] px-3 text-xs text-white hover:bg-[#34b73b]"
                              onClick={() => setIsAddFormSubmitRequested(true)}
                              disabled={isLoading || !isAddFormStepOneComplete || !isAddFormStepTwoComplete || !isAddFormStepThreeComplete}
                            >
                              {isLoading ? "Saving..." : rehireClientId ? "Rehire" : "Add"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </form>
                      </div>
                      </div>
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
            aria-label="Close client profile"
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
        <DialogContent className="w-[94vw] max-w-[560px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden">
          <div className="relative">
            <div className="absolute inset-x-0 top-0 flex h-[46px] items-center justify-between px-4">
              <div className="flex items-center gap-2 pl-2">
                <Upload className="h-4 w-4 text-white" />
                <DialogTitle className="text-sm font-semibold text-white">{editingWarning ? "Edit warning" : "Upload warning"}</DialogTitle>
              </div>
              <DialogClose asChild>
                <button type="button" className="text-white hover:text-white/80">
                  <X className="h-4 w-4" />
                </button>
              </DialogClose>
            </div>
            <div className="mt-[46px] bg-white">
          <DialogHeader className="px-6 pt-4 pb-0">
            <DialogDescription className="text-[11px] text-slate-600">
              {editingWarning ? "Update this warning record." : "Add a warning record with auto-calculated validity."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 pb-6 pt-4 [&_label]:text-[10px] [&_label]:font-semibold [&_label]:text-slate-400">
            <div className="space-y-2">
              <Label htmlFor="misconductType">
                Type of misconduct <span className="text-red-500">*</span>
              </Label>
              <Button
                type="button"
                variant="outline"
                onClick={openWarningMisconductPicker}
                className={`${getAddModalSelectTriggerClass(warningForm.misconductTypes.length > 0)} ${addModalDropdownToneClass} w-full justify-between hover:bg-white hover:text-slate-700`}
              >
                <span className={warningForm.misconductTypes.length === 0 ? "text-slate-400 text-xs" : ""}>
                  {warningForm.misconductTypes.length === 0
                    ? "Select misconduct type(s)"
                    : `${warningForm.misconductTypes.length} selected`}
                </span>
                <span className="text-[10px] text-slate-500">Open selector</span>
              </Button>
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
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setWarningForm((prev) => ({ ...prev, misconductTypes: [] }))}
                    className="h-6 px-2 text-[11px] text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                  >
                    Clear all
                  </Button>
                </div>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>
                  Type of warning <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={warningForm.warningType}
                  onValueChange={(value) =>
                    setWarningForm((prev) => ({ ...prev, warningType: value as ClientWarning["warningType"] }))
                  }
                >
                  <SelectTrigger className={`${getAddModalSelectTriggerClass(Boolean(warningForm.warningType))} ${addModalDropdownToneClass}`}>
                    <SelectValue placeholder="Select warning type" />
                  </SelectTrigger>
                  <SelectContent className="text-[11px]">
                <SelectItem value="First" className={clientDropdownSelectItemClass}>First (6 months)</SelectItem>
                <SelectItem value="Second" className={clientDropdownSelectItemClass}>Second (6 months)</SelectItem>
                <SelectItem value="Serious" className={clientDropdownSelectItemClass}>Serious (9 months)</SelectItem>
                <SelectItem value="Final" className={clientDropdownSelectItemClass}>Final (12 months)</SelectItem>
              </SelectContent>
            </Select>
          </div>
              <div className="space-y-2">
                <Label htmlFor="issueDate">
                  Date of issue <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-start gap-2">
                  <Input
                    id="issueDate"
                    type="text"
                    readOnly
                    placeholder="Please select a date"
                    value={warningForm.issueDate ? formatDisplayDate(warningForm.issueDate) : ""}
                    onClick={() => openDatePicker(warningIssueDateInputRef.current)}
                    onFocus={() => openDatePicker(warningIssueDateInputRef.current)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openDatePicker(warningIssueDateInputRef.current);
                      }
                    }}
                    className={`${getAddModalInputClass(warningForm.issueDate.trim().length > 0)} flex-1 cursor-pointer`}
                  />
                  <input
                    ref={warningIssueDateInputRef}
                    type="date"
                    value={warningForm.issueDate}
                    onChange={(e) => setWarningForm((prev) => ({ ...prev, issueDate: e.target.value }))}
                    className="sr-only"
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                </div>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Validity</Label>
                <Input
                  value={`${warningValidityMonths[warningForm.warningType]} months`}
                  readOnly
                  className={getAddModalInputClass(true)}
                />
              </div>
              <div className="space-y-2">
                <Label>Auto expiry</Label>
                <Input
                  value={formatDisplayDate(computeWarningExpiry(warningForm.warningType, warningForm.issueDate))}
                  readOnly
                  className={getAddModalInputClass(true)}
                />
              </div>
            </div>
            {editingWarning ? (
              <p className="text-xs text-muted-foreground">
                Editing does not replace the file. Delete and re-upload to attach a new document.
              </p>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="warningFile">
                  Upload signed warning (PDF only) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="warningFile"
                  ref={warningFileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleWarningFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => warningFileInputRef.current?.click()}
                  className={`${getAddModalInputClass(warningForm.fileName.trim().length > 0)} flex w-full items-center justify-start !px-3 text-left text-[11px] text-slate-700 hover:bg-white hover:text-blue-600 hover:underline`}
                >
                  {warningForm.fileName ? "Replace File" : "Choose File"}
                </button>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {warningForm.fileName && warningFile ? (
                    <button
                      type="button"
                      onClick={openSelectedWarningFile}
                      className="group inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-600"
                    >
                      <Paperclip className="h-3 w-3" />
                      <span className="group-hover:underline">{warningForm.fileName}</span>
                    </button>
                  ) : (
                    <p>No file chosen</p>
                  )}
                  {warningForm.fileName ? (
                    <button
                      type="button"
                      onClick={clearWarningFileSelection}
                      className="group inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-black hover:underline"
                    >
                      <X className="h-3 w-3 text-red-600 opacity-0 transition-opacity group-hover:opacity-100" />
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="px-6 pb-6 pt-0">
            <div className="grid w-full grid-cols-3 items-center border-t border-dashed border-muted/60 pt-4">
              <div className="justify-self-start">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsWarningDialogOpen(false)}
                  className="h-[28px] w-[84px] rounded border-blue-600 px-3 text-xs text-blue-600 hover:bg-transparent hover:text-blue-600"
                >
                  Cancel
                </Button>
              </div>
              <div />
              <div className="justify-self-end">
                <Button
                  type="button"
                  onClick={handleSaveWarning}
                  disabled={!canSaveWarning}
                  className="h-[30px] w-[92px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700 disabled:bg-slate-300"
                >
                  {editingWarning ? "Save" : "Upload"}
                </Button>
              </div>
            </div>
          </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isMisconductPickerOpen} onOpenChange={(open) => (open ? openWarningMisconductPicker() : cancelWarningMisconductPicker())}>
        <DialogContent className="w-[94vw] max-w-[680px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden">
          <div className="relative">
            <div className="absolute inset-x-0 top-0 flex h-[46px] items-center justify-between px-4">
              <div className="flex items-center gap-2 pl-2">
                <TriangleAlert className="h-4 w-4 text-white" />
                <DialogTitle className="text-sm font-semibold text-white">Select Misconduct Type(s)</DialogTitle>
              </div>
              <DialogClose asChild>
                <button type="button" className="text-white hover:text-white/80">
                  <X className="h-4 w-4" />
                </button>
              </DialogClose>
            </div>
            <div className="mt-[46px] bg-white">
          <DialogHeader className="px-6 pt-4 pb-0">
            <DialogDescription className="text-[11px] text-slate-600">
              Choose one or more misconduct types for which the warning was issued.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-6 pb-6 pt-4">
            <Input
              ref={warningMisconductSearchInputRef}
              placeholder="Search misconduct types"
              value={misconductSearch}
              onChange={(e) => setMisconductSearch(e.target.value)}
              className="h-8 rounded border-slate-300 text-[11px] placeholder:text-[10px] placeholder:text-slate-400"
            />
            <ScrollArea className="h-72 rounded border border-slate-200 bg-white">
              <div className="space-y-2 p-3">
                {filteredMisconductTypes.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">No misconduct types match your search.</p>
                )}
                {["Minor", "Serious", "Dismissible"].map((category) => {
                  const bucket = filteredMisconductTypes.filter((item) => item.category === category);
                  if (bucket.length === 0) return null;
                  return (
                    <div key={category} className="space-y-1">
                      <p
                        className={`text-xs font-semibold uppercase px-2 py-1 rounded ${
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
                          className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 text-[11px] text-slate-700 hover:bg-blue-50/70 hover:text-blue-600 focus-within:bg-blue-50/70"
                        >
                          <Checkbox
                            checked={warningDraftMisconductTypes.includes(item.name)}
                            onCheckedChange={() => toggleWarningDraftMisconduct(item.name)}
                            className="h-4 w-4 rounded-[2px] border-slate-400 text-white data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
                          />
                          <span className="flex-1">{item.name}</span>
                        </label>
                      ))}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <div>
              {warningDraftMisconductTypes.length === 0 ? (
                <div className="text-xs text-slate-600">No type selected</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {warningDraftMisconductTypes.map((type) => (
                    <Badge
                      key={type}
                      variant="secondary"
                      className={`gap-1 ${misconductColorClasses(getMisconductCategory(type))}`}
                    >
                      {type}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="px-6 pb-6 pt-0">
            <div className="grid w-full grid-cols-3 items-center border-t border-dashed border-muted/60 pt-4">
              <div className="justify-self-start">
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelWarningMisconductPicker}
                  className="h-[28px] w-[84px] rounded border-blue-600 px-3 text-xs text-blue-600 hover:bg-transparent hover:text-blue-600"
                >
                  Cancel
                </Button>
              </div>
              <div className="justify-self-center">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setWarningDraftMisconductTypes([])}
                  disabled={warningDraftMisconductTypes.length === 0}
                  className="h-[30px] rounded border-0 px-3 text-xs text-slate-500 shadow-none hover:bg-transparent hover:text-slate-600 hover:underline disabled:text-slate-300"
                >
                  Clear
                </Button>
              </div>
              <div className="justify-self-end">
                <Button
                  type="button"
                  onClick={applyWarningMisconductPicker}
                  className="h-[30px] w-[92px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700"
                >
                  Done
                </Button>
              </div>
            </div>
          </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isContractDialogOpen} onOpenChange={setIsContractDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload contract</DialogTitle>
            <DialogDescription>Add the signed employment contract for this client.</DialogDescription>
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

      <Dialog
        open={isTerminateDialogOpen}
        onOpenChange={(open) => {
          setIsTerminateDialogOpen(open);
          if (!open) {
            setPendingTerminationReason("");
          }
        }}
      >
        <DialogContent className="w-[94vw] max-w-[380px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden">
          <div className="relative">
            <div className="absolute inset-x-0 top-0 flex h-[46px] items-center justify-between px-4">
              <div className="flex items-center gap-2 pl-2">
                <LogOut className="h-4 w-4 text-white" />
                <DialogTitle className="text-sm font-semibold text-white">Terminate Client</DialogTitle>
              </div>
              <DialogClose asChild>
                <button type="button" className="text-white hover:text-white/80">
                  <X className="h-4 w-4" />
                </button>
              </DialogClose>
            </div>
            <div className="mt-[46px] bg-white px-6 pb-6 pt-4 space-y-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-slate-500">
                Termination reason <span className="text-red-600">*</span>
              </Label>
              <Select value={pendingTerminationReason || undefined} onValueChange={setPendingTerminationReason}>
                <SelectTrigger className={`${fieldSelectTriggerClass} w-full !ring-0 !ring-offset-0 !outline-none focus:!ring-0 focus:!ring-offset-0 focus:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 focus-visible:!outline-none data-[state=open]:!ring-0 data-[state=open]:!ring-offset-0 data-[state=open]:!outline-none`}>
                  <SelectValue placeholder="Please select reason" />
                </SelectTrigger>
                <SelectContent className="text-[11px]">
                  {terminationReasons.map((reason) => (
                    <SelectItem key={reason} value={reason} className={clientDropdownSelectItemClass}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-slate-500">
                Termination / Last Date of Employment <span className="text-red-600">*</span>
              </Label>
              <Input
                type="text"
                readOnly
                placeholder="Please select a date"
                value={pendingTerminationDate ? formatDisplayDate(pendingTerminationDate) : ""}
                onClick={() => openDatePicker(terminateModalDateInputRef.current)}
                onFocus={() => openDatePicker(terminateModalDateInputRef.current)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDatePicker(terminateModalDateInputRef.current);
                  }
                }}
                className={fieldInputClass}
              />
              <input
                ref={terminateModalDateInputRef}
                type="date"
                value={pendingTerminationDate}
                onChange={(e) => setPendingTerminationDate(e.target.value)}
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-slate-500">
                Termination letter (optional)
              </Label>
              <input
                ref={terminateModalDocumentInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={handleTerminateModalDocumentFileChange}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => terminateModalDocumentInputRef.current?.click()}
                className="h-8 w-full justify-start rounded border-slate-200 bg-white px-3 text-[11px] text-slate-700 hover:bg-white hover:border-blue-500 hover:text-blue-600"
              >
                {pendingTerminationDocumentName ? "Change document" : "Upload letter"}
              </Button>
              <p className="flex items-center gap-1.5 text-[10px] text-slate-600">
                <Paperclip className="h-3 w-3 shrink-0 text-slate-500" />
                <span className="truncate">{pendingTerminationDocumentName || "No file selected"}</span>
              </p>
            </div>
            <DialogFooter className="px-0 pb-0 pt-0">
            <div className="flex w-full justify-center border-t border-dashed border-muted/60 pt-4">
                <Button
                  type="button"
                  onClick={() => void handleConfirmTerminate()}
                  disabled={!pendingTerminationDate.trim() || !pendingTerminationReason.trim()}
                  className="h-[32px] w-[160px] rounded bg-red-600 px-3 text-xs text-white hover:bg-red-700 disabled:bg-slate-300"
                >
                  Terminate
                </Button>
            </div>
          </DialogFooter>
            </div>
          </div>
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

      {terminationUndo && (
        <div
          className={`pointer-events-none fixed inset-x-0 ${
            deleteUndo && warningDeleteUndo ? "top-36" : deleteUndo || warningDeleteUndo ? "top-20" : "top-4"
          } z-50 flex justify-center px-4`}
        >
          <div className="relative flex items-center gap-3 rounded-full border border-red-200 bg-white/95 px-4 py-2 text-sm font-medium text-red-900 shadow-[0_6px_18px_rgba(220,38,38,0.25)] backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <span className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_25px_rgba(220,38,38,0.25)] animate-pulse" aria-hidden="true"></span>
            <div className="pointer-events-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-red-900 hover:bg-transparent hover:text-red-900 focus-visible:bg-transparent"
                onClick={() => void handleUndoTermination()}
              >
                Undo termination
                <span className="text-xs text-red-600">{terminationUndoCountdown}s</span>
              </Button>
              <button
                type="button"
                className="text-red-700 hover:text-red-700 focus-visible:text-red-700"
                onClick={clearTerminationUndoState}
                aria-label="Dismiss undo termination notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={Boolean(documentDialogClient)}
        onOpenChange={(open) => {
          if (!open) setDocumentDialogClient(null);
        }}
      >
        <DialogContent className="w-[94vw] max-w-[380px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden">
          <div className="relative">
            <div className="absolute inset-x-0 top-0 flex h-[46px] items-center justify-between px-4">
              <div className="flex items-center gap-2 pl-2">
                <FilePlus className="h-4 w-4 text-white" />
                <DialogTitle className="text-sm font-semibold text-white">Client File</DialogTitle>
              </div>
              <DialogClose asChild>
                <button type="button" className="text-white hover:text-white/80">
                  <X className="h-4 w-4" />
                </button>
              </DialogClose>
            </div>
            <div className="mt-[46px] bg-white px-6 pt-4 pb-6">
            <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
              Select any document from the list below to instantly start drafting a new document for{" "}
              {`${documentDialogClient?.client_name ?? ""} ${documentDialogClient?.client_surname ?? ""}`.trim()}.
            </p>
            <div className="space-y-1">
              <Label htmlFor="document-select">Choose a document</Label>
              <Select value={selectedDocumentPath || ""} onValueChange={setSelectedDocumentPath}>
                <SelectTrigger
                  id="document-select"
                  className={`${getAddModalSelectTriggerClass(Boolean(selectedDocumentPath))} ${addModalDropdownToneClass}`}
                >
                  <SelectValue placeholder="Select a document" />
                </SelectTrigger>
                <SelectContent className="text-[11px]">
                  {documentOptionsByCategory.map(([category, items], categoryIndex) => (
                    <SelectGroup key={category}>
                      <SelectLabel className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {category}
                      </SelectLabel>
                      {items.map((doc) => (
                        <SelectItem
                          key={doc.path}
                          value={doc.path}
                          disabled={!doc.active}
                          className={clientDropdownSelectItemClass}
                        >
                          {doc.label} {!doc.active ? "(coming soon)" : ""}
                        </SelectItem>
                      ))}
                      {categoryIndex < documentOptionsByCategory.length - 1 && <SelectSeparator />}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="h-[27px]" />
            <Button
              className="h-[30px] w-full rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700"
              onClick={() => {
                const selected = documentOptions.find((d) => d.path === selectedDocumentPath);
                if (selected?.active) {
                  handleDocumentCategorySelect(selected.path, documentDialogClient);
                }
              }}
              disabled={!documentOptions.find((d) => d.path === selectedDocumentPath && d.active)}
            >
              Draft
            </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

  </DashboardLayout>
);
 };

export default Clients;
















