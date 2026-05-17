import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { logGeneratedDocument } from "@/lib/documentsLog";
import { nationalityOptions } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF, type AcroFormComboBox, type AcroFormTextField } from "jspdf";
import { Building2, Check, ChevronsUpDown, FileText, Info, Pencil, Plus, User2, X } from "lucide-react";

type PermContractGeneratorProps = {
  embedded?: boolean;
  externalNavigation?: boolean;
  onRequestClose?: () => void;
  draftState?: unknown;
  onDraftStateChange?: (draftState: unknown) => void;
  onStepChange?: (step: string | null) => void;
  onStepMetaChange?: (meta: {
    steps: readonly string[];
    activeStep: number;
    icons?: readonly ComponentType<SVGProps<SVGSVGElement>>[];
    canGoNext?: boolean;
    canGoBack?: boolean;
    canSelectStep?: (index: number) => boolean;
    onNext?: () => void;
    onBack?: () => void;
    onStepSelect?: (index: number) => void;
    onClear?: () => void;
    addendumType?: "general" | "renewal" | "extension" | "";
    isFinished?: boolean;
    isPreviewEditable?: boolean;
    supportsPreviewEditToggle?: boolean;
    supportsResetAtFirstStep?: boolean;
    temporaryEmployeeCount?: number;
  }) => void;
};

type CompanyRecord = {
  id: string;
  registered_name: string | null;
  trading_as: string | null;
  company_type: string | null;
  registration_number: string | null;
  primary_number: string | null;
  primary_email: string | null;
  physical_address_line1: string | null;
  physical_address_line2: string | null;
  city: string | null;
  province: string | null;
  area_code: string | null;
};

type CompanyLogoRecord = {
  storage_path?: string | null;
  logo_path?: string | null;
  logo_url?: string | null;
  company_logo_url?: string | null;
};

type CompanyLogoOrientation = "portrait" | "landscape";
type DocumentMode = "standard_contract" | "client_template";

type CompanyStepState = {
  companyId: string;
  companyName: string;
  registeredName: string;
  tradingName: string;
  registrationNumber: string;
  phone: string;
  email: string;
  address: string;
  documentMode: DocumentMode;
  logoUrl: string;
  logoOrientation: CompanyLogoOrientation | "";
};

type EmployeeStepState = {
  permEmployeeName: string;
  permEmployeeSurname: string;
  permEmployeeNationality: string;
  permEmployeeIdentityNumber: string;
  permEmployeeAge: string;
  permEmployeeNumber: string;
  permEmployeeGender: "Male" | "Female" | "";
  permEmployeeRace: "African" | "Coloured" | "Indian" | "White" | "Other" | "";
  permEmployeeCellNumber: string;
  permEmployeeEmail: string;
  permEmployeeAlternativeContact: string;
  permEmployeeResidentialAddress: string;
  permEmployeePostalAddress: string;
};

type ContractStepState = {
  permContractStartDate: string;
  permContractJobTitle: string;
  permContractDepartment: string;
  permContractBargainingCouncil: string;
  permContractSalaryAmount: string;
  permContractSalaryType: "per_hour" | "per_day" | "per_week" | "per_fortnight" | "per_month" | "";
  permContractPayCycle: "daily" | "weekly" | "fortnightly" | "monthly" | "";
  permContractProbation: "none" | "1_month" | "2_months" | "3_months" | "4_months" | "5_months" | "6_months" | "7_months" | "8_months" | "9_months" | "10_months" | "11_months" | "12_months" | "";
  permContractReportsTo: string;
  permContractRetirementAge: "55" | "60" | "65" | "70" | "";
  permContractWorkplace: string;
  permContractInterpreterRequired: "yes" | "no" | "";
  permContractWorkingHoursMode: "undefined" | "defined" | "scheduled";
  permContractMondayStart: string;
  permContractMondayEnd: string;
  permContractTuesdayStart: string;
  permContractTuesdayEnd: string;
  permContractWednesdayStart: string;
  permContractWednesdayEnd: string;
  permContractThursdayStart: string;
  permContractThursdayEnd: string;
  permContractFridayStart: string;
  permContractFridayEnd: string;
  permContractSaturdayStart: string;
  permContractSaturdayEnd: string;
  permContractSundayStart: string;
  permContractSundayEnd: string;
};

type PermContractDraftState = {
  activeStep: number;
  isFinished: boolean;
  company: CompanyStepState;
  employee: EmployeeStepState;
  contract: ContractStepState;
  preview?: {
    isPreviewEditable?: boolean;
    clauseBodyEdits?: Record<string, string>;
    clauseTitleEdits?: Record<string, string>;
    customClauses?: Array<{
      id: string;
      title: string;
      paragraphs: string[];
      insertAfterId: string | null;
    }>;
  };
};

type LooseQuery = {
  select: (query: string) => LooseQuery;
  order: (column: string, options?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  eq: (column: string, value: unknown) => LooseQuery;
  limit: (count: number) => Promise<{ data: unknown; error: { message: string } | null }>;
};

const db = supabase as unknown as {
  from: (table: string) => LooseQuery;
};

const steps = ["Client Details", "Employee Details", "Contract Details", "Preview / Download"] as const;
const stepIcons = [Building2, User2, FileText, Check] as const;

const emptyCompanyState: CompanyStepState = {
  companyId: "",
  companyName: "",
  registeredName: "",
  tradingName: "",
  registrationNumber: "",
  phone: "",
  email: "",
  address: "",
  documentMode: "standard_contract",
  logoUrl: "",
  logoOrientation: "",
};

const emptyEmployeeState: EmployeeStepState = {
  permEmployeeName: "",
  permEmployeeSurname: "",
  permEmployeeNationality: "",
  permEmployeeIdentityNumber: "",
  permEmployeeAge: "",
  permEmployeeNumber: "",
  permEmployeeGender: "",
  permEmployeeRace: "",
  permEmployeeCellNumber: "",
  permEmployeeEmail: "",
  permEmployeeAlternativeContact: "",
  permEmployeeResidentialAddress: "",
  permEmployeePostalAddress: "",
};

const todayDateValue = new Date().toISOString().split("T")[0] || "";
const currentYear = new Date().getFullYear();
const generatedDocumentsBucket = "documents";

const emptyContractState: ContractStepState = {
  permContractStartDate: "",
  permContractJobTitle: "",
  permContractDepartment: "",
  permContractBargainingCouncil: "None",
  permContractSalaryAmount: "",
  permContractSalaryType: "",
  permContractPayCycle: "",
  permContractProbation: "3_months",
  permContractReportsTo: "",
  permContractRetirementAge: "65",
  permContractWorkplace: "",
  permContractInterpreterRequired: "no",
  permContractWorkingHoursMode: "undefined",
  permContractMondayStart: "N/A",
  permContractMondayEnd: "N/A",
  permContractTuesdayStart: "N/A",
  permContractTuesdayEnd: "N/A",
  permContractWednesdayStart: "N/A",
  permContractWednesdayEnd: "N/A",
  permContractThursdayStart: "N/A",
  permContractThursdayEnd: "N/A",
  permContractFridayStart: "N/A",
  permContractFridayEnd: "N/A",
  permContractSaturdayStart: "N/A",
  permContractSaturdayEnd: "N/A",
  permContractSundayStart: "N/A",
  permContractSundayEnd: "N/A",
};

const fieldClassName =
  "h-8 rounded-sm border-slate-300 bg-white !text-[10px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] placeholder:font-normal placeholder:text-slate-400 hover:border-[#3eca44] focus-visible:border-[#3eca44] focus-visible:ring-0";
const hiddenScrollClassName =
  "overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

const selectTriggerClassName = cn(
  fieldClassName,
  "!h-8 !border-slate-300 !text-[10px] hover:!border-[#3eca44] focus:!border-[#3eca44] focus-visible:!border-[#3eca44] [&>span]:text-[10px] [&>span]:font-medium data-[placeholder]:[&>span]:font-normal data-[placeholder]:[&>span]:text-slate-400",
);

const companyTypeSuffixes: Record<string, string> = {
  "Private Company ((Pty) Ltd)": "(Pty) Ltd",
  "Public Company (Ltd)": "Ltd",
  "Personal Liability Company (Inc.)": "Inc.",
  "State-Owned Company (SOC Ltd)": "SOC Ltd",
  "Non-Profit Company (NPC)": "NPC",
  "Close Corporation (CC)": "CC",
  "Co-operative (Co-op)": "Co-op",
  "Sole Proprietor (SP)": "SP",
  "Partnership (Partnership)": "Partnership",
  "Business Trust (Trust)": "Trust",
};

const mergeCompanyType = (registeredName: string, companyType: string) => {
  const suffix = companyTypeSuffixes[companyType] || "";
  if (!suffix) return registeredName;
  return registeredName.toLowerCase().endsWith(suffix.toLowerCase()) ? registeredName : `${registeredName} ${suffix}`;
};

const buildCompanyName = (record: CompanyRecord) => {
  const registered = String(record.registered_name || "").trim();
  const trading = String(record.trading_as || "").trim();
  const companyType = String(record.company_type || "").trim();
  const official = registered ? mergeCompanyType(registered, companyType) : "";
  if (
    official &&
    trading &&
    trading.toLowerCase() !== registered.toLowerCase() &&
    trading.toLowerCase() !== official.toLowerCase()
  ) {
    return `${official} t/a ${trading}`;
  }
  return official || trading || "Unnamed client";
};

const buildAddress = (record: CompanyRecord) =>
  [
    record.physical_address_line1,
    record.physical_address_line2,
    record.city,
    record.province,
    record.area_code,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");

const deriveLogoUrl = (record?: CompanyLogoRecord | null) => {
  const storagePath = String(record?.storage_path || record?.logo_path || "").trim();
  if (storagePath) {
    const { data } = supabase.storage.from("client-logos").getPublicUrl(storagePath);
    return String(data?.publicUrl || "").trim();
  }
  return String(record?.logo_url || record?.company_logo_url || "").trim();
};

const inferCompanyLogoOrientation = (url: string) =>
  new Promise<CompanyLogoOrientation>((resolve) => {
    if (typeof Image === "undefined") {
      resolve("landscape");
      return;
    }
    const image = new Image();
    image.onload = () => {
      resolve(image.naturalWidth >= image.naturalHeight ? "landscape" : "portrait");
    };
    image.onerror = () => resolve("landscape");
    image.src = url;
  });

const getFooterLogoDimensions = (orientation: CompanyLogoOrientation | "") =>
  orientation === "portrait"
    ? {
        previewMaxHeight: 56,
        previewMaxWidth: 92,
        pdfMaxHeight: 18,
        pdfMaxWidth: 18,
      }
    : {
        previewMaxHeight: 54,
        previewMaxWidth: 184,
        pdfMaxHeight: 14,
        pdfMaxWidth: 52,
      };

const loadImageUrlAsDataUrl = (url: string) =>
  new Promise<string | null>((resolve) => {
    const source = String(url || "").trim();
    if (!source || typeof Image === "undefined" || typeof document === "undefined") {
      resolve(null);
      return;
    }

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(image, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = source;
  });

const mapRecordToState = (record: CompanyRecord): CompanyStepState => ({
  companyId: record.id,
  companyName: buildCompanyName(record),
  registeredName: String(record.registered_name || "").trim(),
  tradingName: String(record.trading_as || "").trim(),
  registrationNumber: String(record.registration_number || "").trim(),
  phone: String(record.primary_number || "").trim(),
  email: String(record.primary_email || "").trim(),
  address: buildAddress(record),
  documentMode: "standard_contract",
  logoUrl: "",
  logoOrientation: "",
});

const isDraftState = (value: unknown): value is PermContractDraftState => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.activeStep === "number";
};

const normalizeCompanyDraft = (value: unknown): CompanyStepState => ({
  ...emptyCompanyState,
  ...((value && typeof value === "object" ? value : {}) as Partial<CompanyStepState>),
});

const normalizeEmployeeDraft = (value: unknown): EmployeeStepState => ({
  ...emptyEmployeeState,
  ...((value && typeof value === "object" ? value : {}) as Partial<EmployeeStepState>),
});

const normalizeContractDraft = (value: unknown): ContractStepState => ({
  ...emptyContractState,
  ...((value && typeof value === "object" ? value : {}) as Partial<ContractStepState>),
});

const normalizePreviewEditRecord = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
      typeof item === "string" ? [[key, item] as const] : [],
    ),
  );
};

const normalizeCustomPreviewClauses = (value: unknown): CustomPreviewClause[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    const id = String(candidate.id || "").trim();
    const title = String(candidate.title || "").trim();
    const paragraphs = Array.isArray(candidate.paragraphs)
      ? candidate.paragraphs.map((paragraph) => String(paragraph || "").trim()).filter(Boolean)
      : [];
    if (!id || !title || paragraphs.length === 0) return [];
    return [
      {
        id,
        title,
        paragraphs,
        insertAfterId: candidate.insertAfterId == null ? null : String(candidate.insertAfterId),
      },
    ];
  });
};

const mergePreviewClauses = (baseClauses: PreviewClause[], customClauses: CustomPreviewClause[]) => {
  const merged: PreviewClause[] = [];
  const leadingCustom = customClauses.filter((clause) => clause.insertAfterId === null);
  merged.push(...leadingCustom.map(({ insertAfterId: _insertAfterId, ...clause }) => clause));

  baseClauses.forEach((clause) => {
    merged.push(clause);
    const inserted = customClauses.filter((candidate) => candidate.insertAfterId === clause.id);
    merged.push(...inserted.map(({ insertAfterId: _insertAfterId, ...candidate }) => candidate));
  });

  return merged;
};

const deriveAgeFromIdentityNumber = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 6) return "";

  const yearPart = Number(digits.slice(0, 2));
  const monthPart = Number(digits.slice(2, 4));
  const dayPart = Number(digits.slice(4, 6));
  if (
    Number.isNaN(yearPart) ||
    Number.isNaN(monthPart) ||
    Number.isNaN(dayPart) ||
    monthPart < 1 ||
    monthPart > 12 ||
    dayPart < 1 ||
    dayPart > 31
  ) {
    return "";
  }

  const today = new Date();
  const currentTwoDigitYear = today.getFullYear() % 100;
  const fullYear = yearPart <= currentTwoDigitYear ? 2000 + yearPart : 1900 + yearPart;
  const birthDate = new Date(fullYear, monthPart - 1, dayPart);

  if (
    birthDate.getFullYear() !== fullYear ||
    birthDate.getMonth() !== monthPart - 1 ||
    birthDate.getDate() !== dayPart
  ) {
    return "";
  }

  let age = today.getFullYear() - fullYear;
  const hasHadBirthday =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  if (!hasHadBirthday) age -= 1;
  return age >= 0 ? String(age) : "";
};

const formatDateForDisplay = (value: string) => {
  const trimmed = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return "";
  const [year, month, day] = trimmed.split("-");
  return `${day}/${month}/${year}`;
};

const sanitizeCurrencyInput = (value: string) => {
  const cleaned = value.replace(/,/g, "").replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  const whole = parts[0] || "";
  const decimals = parts[1] ? parts[1].slice(0, 2) : "";
  return decimals ? `${whole}.${decimals}` : whole;
};

const formatCurrencyDisplay = (value: string) => {
  const normalized = sanitizeCurrencyInput(value);
  if (!normalized) return "";
  const amount = Number(normalized);
  if (Number.isNaN(amount)) return "";
  return `R ${amount.toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatCurrencyTypingDisplay = (value: string) => sanitizeCurrencyInput(value);

const probationLabelByValue: Record<ContractStepState["permContractProbation"], string> = {
  "": "",
  none: "None",
  "1_month": "1 Month",
  "2_months": "2 Months",
  "3_months": "3 Months",
  "4_months": "4 Months",
  "5_months": "5 Months",
  "6_months": "6 Months",
  "7_months": "7 Months",
  "8_months": "8 Months",
  "9_months": "9 Months",
  "10_months": "10 Months",
  "11_months": "11 Months",
  "12_months": "12 Months",
};

const salaryTypeLabelByValue: Record<ContractStepState["permContractSalaryType"], string> = {
  "": "",
  per_hour: "per hour",
  per_day: "per day",
  per_week: "per week",
  per_fortnight: "per fortnight",
  per_month: "per month",
};

const payCycleLabelByValue: Record<ContractStepState["permContractPayCycle"], string> = {
  "": "",
  daily: "Daily",
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
};

const formatWorkingHoursTimeLabel = (value: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed || trimmed === "N/A") return "N/A";
  const [hourText, minuteText] = trimmed.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return trimmed;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
};

const bargainingCouncilOptions = [
  { label: "None", value: "None" },
  { label: "National Bargaining Council for the Road Freight and Logistics Industry (NBCRFLI)", value: "NBCRFLI" },
  { label: "Motor Industry Bargaining Council (MIBCO)", value: "MIBCO" },
  { label: "Metal and Engineering Industries Bargaining Council (MEIBC)", value: "MEIBC" },
  { label: "National Bargaining Council for the Electrical Industry of South Africa (NBCEI)", value: "NBCEI" },
  { label: "National Bargaining Council for the Private Security Sector (NBCPSS)", value: "NBCPSS" },
  { label: "Bargaining Council for the Civil Engineering Industry (BCCEI)", value: "BCCEI" },
  { label: "National Bargaining Council for the Chemical Industry (NBCCI)", value: "NBCCI" },
  { label: "National Bargaining Council for the Clothing Manufacturing Industry (NBCMI)", value: "NBCMI" },
  { label: "National Bargaining Council for the Leather Industry of South Africa (NBCLI)", value: "NBCLI" },
  { label: "National Bargaining Council for the Wood and Paper Sector (NBCWPS)", value: "NBCWPS" },
  { label: "National Bargaining Council for the Hairdressing, Cosmetology, Beauty and Skincare Industry (HCSBC)", value: "HCSBC" },
  { label: "National Bargaining Council for the Food Retail, Restaurant, Catering and Allied Trades (NBCFRRCAT)", value: "NBCFRRCAT" },
  { label: "Bargaining Council for the Furniture Manufacturing Industry of the Western Cape (BCFMIWC)", value: "BCFMIWC" },
  { label: "Building Industry Bargaining Council Cape of Good Hope (BIBC)", value: "BIBC" },
  { label: "Bargaining Council for the Restaurant, Catering and Allied Trades (BCRCAT)", value: "BCRCAT" },
  { label: "South African Local Government Bargaining Council (SALGBC)", value: "SALGBC" },
  { label: "Education Labour Relations Council (ELRC)", value: "ELRC" },
  { label: "Public Service Co-ordinating Bargaining Council (PSCBC)", value: "PSCBC" },
  { label: "General Public Service Sectoral Bargaining Council (GPSSBC)", value: "GPSSBC" },
  { label: "Public Health and Social Development Sectoral Bargaining Council (PHSDSBC)", value: "PHSDSBC" },
] as const;

const documentModeOptions: { label: string; value: DocumentMode }[] = [
  { label: "Standard Contract", value: "standard_contract" },
  { label: "Client Template", value: "client_template" },
];

const templateNationalityOptions = [
  "South African",
  ...nationalityOptions.filter((option) => option !== "South African"),
] as const;

const workingHoursModeOptions = [
  { label: "Undefined", value: "undefined" },
  { label: "Defined", value: "defined" },
  { label: "Scheduled", value: "scheduled" },
] as const;

const workingHoursDayDefinitions = [
  { label: "Monday", startField: "permContractMondayStart", endField: "permContractMondayEnd" },
  { label: "Tuesday", startField: "permContractTuesdayStart", endField: "permContractTuesdayEnd" },
  { label: "Wednesday", startField: "permContractWednesdayStart", endField: "permContractWednesdayEnd" },
  { label: "Thursday", startField: "permContractThursdayStart", endField: "permContractThursdayEnd" },
  { label: "Friday", startField: "permContractFridayStart", endField: "permContractFridayEnd" },
  { label: "Saturday", startField: "permContractSaturdayStart", endField: "permContractSaturdayEnd" },
  { label: "Sunday", startField: "permContractSundayStart", endField: "permContractSundayEnd" },
] as const satisfies ReadonlyArray<{
  label: string;
  startField: keyof ContractStepState;
  endField: keyof ContractStepState;
}>;

const workingHoursTimeOptions = [
  "N/A",
  ...Array.from({ length: 48 }, (_, index) => {
    const hour = String(Math.floor(index / 2)).padStart(2, "0");
    const minute = index % 2 === 0 ? "00" : "30";
    return `${hour}:${minute}`;
  }),
] as const;

const workingHoursTimeDropdownOptions = workingHoursTimeOptions.map((option) =>
  option === "N/A" ? option : formatWorkingHoursTimeLabel(option),
);

const previewTemplatePlaceholder = "____________________";
const previewTemplatePlaceholderShort = "____________";

type FillablePdfFieldConfig = {
  fieldName: string;
  multiline?: boolean;
  height?: number;
  maxLength?: number;
  textAlign?: "left" | "center" | "right";
  fontStyle?: "normal" | "bold" | "italic" | "bolditalic";
  fontSize?: number;
  kind?: "text" | "dropdown";
  options?: readonly string[];
};

const PreviewRow = ({ label, value }: { label: string; value: string }) => (
  <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2 text-[11px] leading-6 text-slate-900">
    <p className="font-semibold text-slate-700">{label}</p>
    <p>{value || "--"}</p>
  </div>
);

const PreviewDualRow = ({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
}: {
  leftLabel: string;
  leftValue: string;
  rightLabel: string;
  rightValue: string;
}) => (
  <div className="grid gap-4 md:grid-cols-2">
    <PreviewRow label={leftLabel} value={leftValue} />
    <PreviewRow label={rightLabel} value={rightValue} />
  </div>
);

const PreviewSection = ({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) => (
  <section className="mt-6">
    <div className="flex items-center justify-between rounded-[10px] border border-slate-300 bg-slate-100 px-4 py-2.5">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-[#2D4256]">{title}</p>
      {note ? <p className="text-[11px] italic text-slate-600">{note}</p> : null}
    </div>
    <div className="mt-5 space-y-3">{children}</div>
  </section>
);

type PreviewClause = {
  id: string;
  title: string;
  paragraphs: string[];
};

type CustomPreviewClause = PreviewClause & {
  insertAfterId: string | null;
};

type WorkingHoursScheduleRow = {
  label: string;
  start: string;
  end: string;
};

const normalizeParagraphs = (value: string | string[]) => (Array.isArray(value) ? value : [value]).filter(Boolean);

const makePreviewClauseId = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/(^-|-$)/g, "");

const serializeClauseParagraphs = (paragraphs: string[]) => paragraphs.join("\n\n");

const normalizeClauseBodyText = (value: string) =>
  value
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

const generateCustomClauseId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `perm-custom-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const buildWorkingHoursScheduleRows = (contract: ContractStepState): WorkingHoursScheduleRow[] =>
  workingHoursDayDefinitions.map((day) => ({
    label: day.label,
    start: String(contract[day.startField] || "N/A"),
    end: String(contract[day.endField] || "N/A"),
  }));

const buildWorkingHoursScheduleParagraphs = (rows: WorkingHoursScheduleRow[], isClientTemplateMode: boolean) =>
  rows.map((row) => {
    if (isClientTemplateMode) {
      return `${row.label}: ${previewTemplatePlaceholderShort} to ${previewTemplatePlaceholderShort}`;
    }
    if (row.start === "N/A" || row.end === "N/A") {
      return `${row.label}: N/A`;
    }
    return `${row.label}: ${formatWorkingHoursTimeLabel(row.start)} to ${formatWorkingHoursTimeLabel(row.end)}`;
  });

const getEditableClauseParagraphs = ({
  clause,
  workingHoursMode,
}: {
  clause: PreviewClause;
  workingHoursMode: ContractStepState["permContractWorkingHoursMode"];
}) => {
  if (clause.id !== makePreviewClauseId("Hours of Work") || workingHoursMode !== "defined") {
    return clause.paragraphs;
  }
  return [clause.paragraphs[0] || "", ...clause.paragraphs.slice(1 + workingHoursDayDefinitions.length)];
};

const mergeHoursOfWorkEditedParagraphs = ({
  editedParagraphs,
  originalClause,
}: {
  editedParagraphs: string[];
  originalClause: PreviewClause;
}) => {
  if (originalClause.id !== makePreviewClauseId("Hours of Work")) {
    return editedParagraphs;
  }
  const scheduleParagraphs = originalClause.paragraphs.slice(1, 1 + workingHoursDayDefinitions.length);
  const tailParagraphs = editedParagraphs.slice(1);
  return [editedParagraphs[0] || "", ...scheduleParagraphs, ...tailParagraphs];
};

const applyWorkingHoursClauseMode = ({
  paragraphs,
  workingHoursMode,
  workingHoursScheduleParagraphs,
}: {
  paragraphs: string[];
  workingHoursMode: ContractStepState["permContractWorkingHoursMode"];
  workingHoursScheduleParagraphs: string[];
}) => {
  if (workingHoursMode === "undefined") return paragraphs;
  if (workingHoursMode === "scheduled") {
    return normalizeParagraphs([
      "The Employee’s ordinary working hours shall not exceed forty-five (45) hours per week and shall be worked in accordance with the Employer’s operational requirements and roster system, as amended from time to time. The Employee agrees that his or her ordinary working hours may be scheduled over a compressed work week, subject to the provisions of the Basic Conditions of Employment Act and any applicable bargaining council agreement or sectoral determination.",
      ...paragraphs.slice(1),
    ]);
  }
  return normalizeParagraphs([
    "The Employee’s ordinary working hours shall not exceed forty-five (45) hours per week and shall be scheduled as follows:",
    ...workingHoursScheduleParagraphs,
    ...paragraphs.slice(1),
  ]);
};

const buildPreviewClauses = ({
  salarySummary,
  bargainingCouncil,
  workingHoursMode,
  workingHoursScheduleParagraphs,
}: {
  salarySummary: string;
  bargainingCouncil: string;
  workingHoursMode: ContractStepState["permContractWorkingHoursMode"];
  workingHoursScheduleParagraphs: string[];
}): PreviewClause[] => {
  void salarySummary;
  const clauses: Array<Omit<PreviewClause, "id">> = [
    {
      title: "Introduction",
      paragraphs: normalizeParagraphs(
        "This employment contract is entered into between the Employer and the Employee willingly and voluntarily. The Employee confirms that he/she has been granted the opportunity to peruse and discuss the contract with his/her counsel, where required, and that he/she understands the contents that follow.",
      ),
    },
    {
      title: "Recordal",
      paragraphs: normalizeParagraphs([
        "The Employer wishes to employ the Employee in a permanent capacity, and the Employee accepts such employment on the terms and conditions set out in this agreement.",
        "This contract sets forth the terms and conditions governing the Employee’s employment, including but not limited to remuneration, duties, working hours, leave entitlement, and termination provisions.",
        "The parties acknowledge that this agreement constitutes the entire understanding between them regarding the employment relationship, and it supersedes any prior discussions or agreements, whether written or verbal, except where expressly stated otherwise.",
        "The following sections of this contract shall detail the Employee’s rights and obligations, as well as the Employer’s expectations and responsibilities, in accordance with applicable labour laws in South Africa.",
      ]),
    },
    {
      title: "Effective Date",
      paragraphs: normalizeParagraphs([
        "The Employee’s “Effective Date” shall be specified as the “start date” in the employment particulars section of this agreement.",
        "The Employee’s job title is specified in the employment particulars section of this agreement, and he/she shall perform all duties and responsibilities associated with this position, as determined by the Employer from time to time.",
        "The Employee agrees that the Employer may reasonably amend or vary the Employee’s job title, duties, and responsibilities in accordance with operational requirements, provided that such changes remain within the general scope of the Employee’s skills and expertise.",
      ]),
    },
    {
      title: "Probationary Period",
      paragraphs: normalizeParagraphs([
        "The Employee is appointed subject to a probationary period, commencing on the “Effective Date” of employment. During this period, the Employer shall assess the Employee’s performance, skills, conduct, adaptability, knowledge, and overall suitability for the position.",
        "Should the Employee fail to meet the required standards in any of these aspects during the probationary period, the Employer reserves the right to terminate the employment relationship prior to or at the conclusion of the probationary period, in accordance with applicable labour laws.",
      ]),
    },
    {
      title: "Training and Development",
      paragraphs: normalizeParagraphs([
        "The Employee acknowledges that the Employer may, from time to time, require the Employee to undergo training and development programmes to ensure the effective execution of his/her duties, particularly as the operational requirements of the Employer evolve. The Employer, at its sole discretion, may incur costs for such training.",
        "In the event that the Employer incurs costs for the Employee’s training, the Employee agrees that he/she shall remain in the Employer’s service for a minimum period of twelve (12) months following the successful completion of such training.",
        "Should the Employee voluntarily terminate his/her employment, or should the Employer lawfully terminate the Employee’s employment due to misconduct or poor performance within this 12-month period, the Employee shall be liable for a pro-rata portion of the training costs. The repayment amount shall be calculated as if the training costs were amortised equally over a 12-month period, with the Employee being liable only for the outstanding balance for the remaining months not worked.",
        "The Employer shall be entitled to deduct any outstanding amount from the Employee’s remuneration, benefits, or any other monies due to the Employee at the date of termination, to the extent permitted by applicable labour laws.",
      ]),
    },
    {
      title: "Performance and Adaptability Commitment",
      paragraphs: normalizeParagraphs([
        "The Employee shall diligently and satisfactorily perform all tasks and responsibilities reasonably associated with his/her position, as required by the Employer.",
        "The Employee shall comply with all reasonable and lawful instructions issued by the Employer or by any managerial or supervisory employee acting on behalf of the Employer.",
        "The Employee confirms that he/she possesses the necessary skills, qualifications, experience, and competence to perform the duties for which he/she has been employed. The Employee further acknowledges that he/she is capable of performing these duties to the satisfaction of the Employer.",
        "The Employee acknowledges that the Employer may, from time to time, require him/her to perform additional or alternative duties that are not expressly included in his/her job description, provided that such duties fall within the Employee’s reasonable capabilities, skills, or experience. The Employee expressly agrees that a refusal to perform such additional duties will be regarded as insubordination.",
        "Should the work specified in the Employee’s job description become unavailable, the Employee agrees to perform any other suitable work that falls within his/her vocational abilities, provided that such work shall be without loss of remuneration. The Employee acknowledges that the performance of alternative work in such circumstances does not create an automatic right to continued employment. The Employer reserves the right to initiate retrenchment proceedings in accordance with applicable labour laws should no suitable alternative work be available.",
      ]),
    },
    {
      title: "Guarantee",
      paragraphs: normalizeParagraphs([
        "The Employee warrants that all documentation, information, and credentials submitted to the Employer in support of his/her application for employment are true, accurate, and authentic.",
        "Should any such documentation, information, or credentials be found to be false, fraudulent, or misleading, the Employer shall be entitled to initiate disciplinary action on the grounds of dishonesty, which may result in termination of employment.",
      ]),
    },
    {
      title: "Access to Workplace",
      paragraphs: normalizeParagraphs([
        "The Employee acknowledges that his/her right to be present on the Employer’s premises is contingent upon the adequate performance of his/her allocated duties as required by the Employer. Should the Employee, for any reason, refuse or fail to perform his/her assigned duties, the Employer may request the Employee to vacate the premises.",
        "The Employee agrees to comply with such a request in an orderly manner within twenty (20) minutes of being instructed to do so. Failure or refusal to leave the premises as directed shall constitute a material breach of contract, which may result in disciplinary action, including possible termination of employment in accordance with applicable labour laws. For the avoidance of doubt, any instruction to vacate the premises or workplace does not constitute a dismissal and shall not affect the Employee’s employment status.",
      ]),
    },
    {
      title: "Transfer",
      paragraphs: normalizeParagraphs(
        "Should the need arise, the Employer retains the right to transfer the Employee to any other business of the Employer in any position on a temporary or permanent basis, after fair consultation and reasonable notice to the Employee. Refusal by the Employee of such a transfer, without an acceptable or lawful reason, will amount to breach of contract.",
      ),
    },
    {
      title: "Remuneration",
      paragraphs: normalizeParagraphs([
        "The Employee shall receive a gross monthly salary as specified in the employment particulars section of this agreement, which shall be compliant with the National Minimum Wage Act where applicable.",
        "The Employee’s salary shall be paid monthly in arrears, no later than seven (7) days after the date on which payment becomes due.",
        "Salary payments shall be made via electronic transfer into a bank account held at a financial institution of the Employee’s choice, as designated by the Employee.",
        "Unauthorised absence from work or absence without approved leave shall result in no payment for the absence.",
        "Overtime remuneration, where applicable, shall be calculated at a rate of one and a half (1.5) times the Employee’s normal wage for overtime hours worked, in compliance with the BCEA.",
        "If the Employee is entitled to commission earnings, such commission shall be paid in the month following the month in which it was earned, subject to the completion of all necessary verifications and checks.",
        "The Employer shall not provide meals or accommodation and shall not be responsible for any transport allowance to and from the workplace.",
      ]),
    },
    {
      title: "Deductions",
      paragraphs: normalizeParagraphs([
        "The Employee acknowledges and agrees that the following statutory and agreed deductions may be made from his/her remuneration, only where applicable: Pay-As-You-Earn (PAYE), Unemployment Insurance Fund contributions (UIF), trade union subscriptions, staff loans, savings, medical aid, provident fund, pension fund, retirement fund, funeral cover, or any other lawful deduction agreed to by the Employee.",
        "By signing this agreement, the Employee expressly consents to any lawful deductions from his/her remuneration for amounts owed to the Employer for any reason, whether at the termination of employment or when such amounts become due and payable. This includes, but is not limited to, deductions for damages to company property or financial losses incurred due to the Employee’s negligence or misconduct. The validity of such deductions may be determined through a disciplinary inquiry, where applicable.",
        "The Employee agrees that the Employer may deduct from his/her salary any shortages of cash or stock resulting from the Employee’s negligence or dishonesty, provided such deductions comply with labour law regulations and are duly recorded and communicated to the Employee.",
      ]),
    },
    {
      title: "Hours of Work",
      paragraphs: normalizeParagraphs([
        "The Employee’s ordinary working hours shall not exceed forty-five (45) hours per week.",
        "The Employee shall be entitled to a one (1) hour unpaid lunch break daily, unless otherwise agreed upon based on operational requirements.",
      ]),
    },
    {
      title: "Overtime",
      paragraphs: normalizeParagraphs([
        "The Employee may be required to work overtime, subject to a maximum of three (3) hours per day and ten (10) hours per week, in accordance with applicable labour laws. The Employer shall provide reasonable notice of overtime requirements, except in cases of emergency overtime, which the Employee agrees to work on short notice.",
        "Overtime shall be remunerated in accordance with prevailing legislation, as amended from time to time. Site/store managers are top management, and not entitled to overtime payment.",
        "Any employee earning above the Minister of Employment and Labour’s prescribed earnings threshold is not entitled to overtime remuneration under the Basic Conditions of Employment Act.",
      ]),
    },
    {
      title: "Salary Increase",
      paragraphs: normalizeParagraphs([
        "Future salary increases shall be determined based on the Employee’s individual performance and the Employer’s overall financial performance in the preceding financial year. The granting of any increase remains solely at the Employer’s discretion and, where applicable, shall take effect from 1 March each year.",
        "No payment of an increase will create an expectation of an increase or the same percentage increase the following year.",
      ]),
    },
    {
      title: "Retirement",
      paragraphs: normalizeParagraphs([
        "The Employee shall retire at the age specified in the employment particulars section of this agreement, or at such other age as may be agreed upon in writing.",
        "Should the Employee continue working beyond his/her retirement birthday, the Employee acknowledges and agrees that the Employer may terminate the employment contract solely on the basis of reaching the agreed retirement age, without further consultation, by providing at least one (1) month’s written notice.",
      ]),
    },
    {
      title: "Exclusivity of Employment",
      paragraphs: normalizeParagraphs([
        "The Employee shall not engage in any other employment, work, or business activities outside of this employment contract for any third party, unless the Employer has granted prior written consent.",
        "Any approved external engagement shall not directly or indirectly compete with the Employer’s business or negatively impact the Employee’s performance, duties, or working relationship with the Employer in any manner.",
        "Non-compliance with this clause will result in disciplinary action which could lead to termination of employment due to breach of contract.",
      ]),
    },
    {
      title: "Discretionary Annual Bonus",
      paragraphs: normalizeParagraphs([
        "The Employer may, at its sole discretion, grant an ex-gratia annual bonus to the Employee. The Employee acknowledges and agrees that the payment of any such bonus shall be entirely at the Employer’s discretion and shall not create any entitlement, expectation, or contractual right to future bonus payments, irrespective of whether bonuses have been granted in consecutive years.",
        "The decision to award a bonus shall be based on the financial capacity of the Employer, as well as the Employee’s conduct and performance. Under no circumstances shall the Employee have an automatic right to a bonus, and the Employer reserves the right to withhold such payment at any time without reason or recourse.",
        "The Employee expressly agrees that in the event of termination of employment, for any reason whatsoever, he/she shall not be entitled to a pro-rata bonus for the period worked prior to termination.",
      ]),
    },
    {
      title: "Termination of Employment",
      paragraphs: normalizeParagraphs([
        "The Employee may terminate his/her employment by providing written notice as follows: one (1) week’s notice during the first six (6) months of employment, two (2) weeks’ notice after six (6) months but within the first year, and four (4) weeks’ notice upon completing one (1) year or more of service. Notice of termination by the Employee must be given on the first day of the month. Should the Employee provide short notice, the Employer shall be entitled to deduct any shortfall from the Employee’s final remuneration due in that month.",
        "The Employer reserves the right to terminate this agreement without notice or payment in lieu of notice in the event of the Employee’s dismissal for misconduct or poor performance. Any such termination shall be conducted in accordance with the Employer’s disciplinary code and procedure and in compliance with applicable labour laws.",
        "The Employee shall return all company-issued clothing, tools, and equipment upon termination of employment, unless otherwise agreed in writing by the Employer. Failure to return such items shall result in a deduction from the Employee’s final remuneration, as provided for in this agreement.",
        "The Employee acknowledges that, during the course of employment, he/she will have access to the Employer’s trade secrets and confidential information, including but not limited to business operations, clients, suppliers, advertising and promotional methods, properties handled by the Employer, and any other sensitive business information.",
      ]),
    },
    {
      title: "Annual Leave",
      paragraphs: normalizeParagraphs([
        "The Employee shall be entitled to twenty-one (21) consecutive days’ annual leave per annual leave cycle.",
        "Annual leave shall be taken at a time determined at the Employer’s discretion, subject to operational requirements, and may be scheduled at any time during the 12-month leave cycle but must be taken within six (6) months following the end of the leave cycle.",
        "Leave not taken within the applicable leave cycle shall be forfeited and will not be carried over to the next cycle unless otherwise agreed in writing by the Employer.",
        "If a public holiday falls during the Employee’s approved leave period and such day would have otherwise been a normal working day, the Employee shall be entitled to an additional day’s paid leave.",
        "The Employee agrees to take his/her annual leave during the Employer’s annual shutdown period, where applicable. Any additional leave approved during the leave cycle shall be deducted from the Employee’s total annual leave entitlement.",
      ]),
    },
    {
      title: "Sick Leave",
      paragraphs: normalizeParagraphs([
        "The Employee shall be entitled to one (1) day’s paid sick leave for every 26 days worked during the first six (6) months of employment.",
        "The Employee shall be entitled to paid sick leave equal to the number of days he/she would normally work during a six-week period within every 36-month cycle of continuous employment, in accordance with applicable labour laws. An Employee working a five-day week shall be entitled to 30 days’ sick leave over three years, while an Employee working a six-day week shall be entitled to 36 days’ sick leave over the same period. Unused sick leave shall not be carried over to the next cycle nor converted to cash upon termination of employment.",
        "Should the Employee experience persistent or recurrent illness, the Employer reserves the right to request the Employee to undergo a medical examination at a reasonable time, with the Employer bearing the cost. The Employee agrees to comply with such a request and grants the Employer access to all relevant medical reports related to his/her fitness for work. If the Employee’s absence due to illness is prolonged, the Employer may conduct a procedurally fair investigation into his/her health status, and if deemed necessary, may terminate the Employee’s contract due to incapacity, in accordance with applicable labour legislation.",
      ]),
    },
    {
      title: "Proof of Sickness",
      paragraphs: normalizeParagraphs([
        "An Employee who is absent from work due to illness must provide a valid medical certificate issued by a registered medical practitioner or traditional healer. The medical certificate must state the full name and surname of the medical practitioner or traditional healer, include the practice number of the issuing practitioner or healer, contain the physical address, contact number and email address of the practitioner or healer, indicate the date of examination of the Employee, clearly state the specific medical condition diagnosed with, clearly declare that the Employee has been unfit for duty, and specify the exact dates for which the Employee is deemed unfit to work.",
        "The medical certificate must be issued and signed by a qualified medical practitioner, or any other person certified to diagnose and treat patients and registered with a professional council.",
        "An Employer is not required to pay an Employee for sick leave if the Employee has been absent for more than two consecutive days or on more than two occasions within an eight-week period, and upon request, fails to produce a medical certificate confirming that he/she was unable to work for the duration of the absence due to sickness or injury.",
        "The Employer shall not accept any medical certificates that have been altered, including any struck-through or replaced words, letters, or numbers. Additionally, hospital or clinic attendance notes that merely confirm an Employee’s visit without explicitly stating that he/she was unfit for duty shall not be accepted.",
        "The Employee is responsible for ensuring that any medical certificate submitted complies with these requirements. Failure to do so may result in the non-approval of sick leave.",
        "The Employee expressly agrees that any medical certificate submitted as proof of sickness shall clearly specify the diagnosed medical condition for which the Employee was deemed unfit for duty. The Employee further acknowledges and agrees that a medical certificate stating only “medical condition” shall not be accepted as valid proof of illness. This requirement shall apply to all medical certificates submitted throughout the duration of employment, and failure to comply with this provision will result in the non-approval of sick leave.",
      ]),
    },
    {
      title: "Parental Leave",
      paragraphs: normalizeParagraphs([
        "Parental, adoption, and commissioning parental leave shall replace maternity, paternity, and adoption leave as previously provided under the Basic Conditions of Employment Act, to the extent required by applicable law.",
        "The Employee acknowledges that no additional paid leave will be granted in relation to parental leave, and he/she shall be required to claim benefits from the UIF where applicable.",
        "Employees who fail to provide written notice of their elected parental leave arrangement within the required timeframe may be subject to disciplinary action or may forfeit their entitlement to elect a shared parental leave arrangement, to the extent permitted by law.",
        "The Employer reserves the right to amend these provisions in accordance with any future legislative amendments or changes in South African labour law.",
        "The Employee who is a single parent shall be entitled to four (4) consecutive months and ten (10) consecutive days of parental leave.",
        "Where there are two parents, they shall be collectively entitled to four (4) consecutive months and ten (10) consecutive days of parental leave, which shall be taken in accordance with their joint election, as follows: one parent may take the entire period, or both parents may alternate or share the leave between them.",
        "Both parents shall notify their respective employers in writing prior to the date of birth regarding their elected parental leave arrangement. If they choose to share the parental leave period, they must specify which periods each parent will take.",
        "In the case of a pregnant mother, she may commence parental leave at any time from four (4) weeks before the expected due date, unless otherwise agreed or if a medical practitioner deems it necessary for health reasons.",
        "Any parental leave granted shall be unpaid, and the Employee shall be required to claim benefits from the Unemployment Insurance Fund, where applicable.",
      ]),
    },
    {
      title: "Adoption Leave",
      paragraphs: normalizeParagraphs([
        "Where the Employee adopts a child younger than two (2) years, the adoptive parents shall be collectively entitled to four (4) consecutive months and ten (10) consecutive days of parental leave, which may be allocated between them in accordance with their joint election.",
        "If the adoption involves two adoptive parents, they shall collectively share the parental leave in accordance with their joint election and notify their respective employers in writing of the periods they will each take.",
        "Adoption leave shall be unpaid, and the Employee shall be required to claim benefits from the Unemployment Insurance Fund, where applicable.",
      ]),
    },
    {
      title: "Surrogacy / Commissioning Parental Leave",
      paragraphs: normalizeParagraphs([
        "In the case of surrogacy, where the Employee is a commissioning parent under a surrogate motherhood agreement, the commissioning parent or commissioning parents shall be collectively entitled to four (4) consecutive months and ten (10) consecutive days of parental leave, which may be allocated between them in accordance with their joint election.",
        "If there are two commissioning parents, they shall collectively share the parental leave and must notify their respective employers in writing of the agreed allocation of leave before the birth of the child.",
        "Commissioning parental leave shall be unpaid, and the Employee shall be required to claim benefits from the Unemployment Insurance Fund, where applicable.",
      ]),
    },
    {
      title: "Family Responsibility Leave",
      paragraphs: normalizeParagraphs([
        "An Employee who has completed at least four (4) months of continuous employment and who works a minimum of four (4) days per week shall be entitled to only three (3) days of paid family responsibility leave per annual leave cycle, and not per incident, to attend to the illness of the Employee’s child or in the event of the death of the Employee’s spouse or life partner, parent, adoptive parent, grandparent, child, adopted child, grandchild, brother or sister.",
        "The Employee must notify the Employer before the commencement of his/her shift if he/she needs to take family responsibility leave due to the illness of his/her child or the death of a qualifying family member as outlined in this clause. In the case of a funeral for any of the individuals listed above, the Employee must provide the Employer with at least four (4) days’ prior notice, where reasonably possible.",
        "The Employer reserves the right to request reasonable proof of the reason for leave, including but not limited to a medical certificate confirming the illness of the Employee’s child, a death certificate or other acceptable documentary proof in the case of bereavement, and proof of relationship to the person in case of bereavement.",
        "Failure to provide the required notice or proof, where requested, may result in non-approval of family responsibility leave and the leave may be treated as unpaid leave.",
        "Family responsibility leave does not accumulate and cannot be carried over to the next leave cycle. Any unused family responsibility leave at the end of the annual leave cycle shall lapse.",
      ]),
    },
    {
      title: "Public Holidays",
      paragraphs: normalizeParagraphs([
        "In the event that the Employee is required to work on a public holiday, as designated under the Public Holidays Act, he/she shall be remunerated at twice (2x) his/her normal daily wage.",
        "The Employee shall not be entitled to remuneration for public holidays that occur during periods of strike action in which he/she participates.",
        "The Employee agrees that he/she will avail himself/herself to tender services as requested from time to time on any public holiday.",
      ]),
    },
    {
      title: "Absence from Work",
      paragraphs: normalizeParagraphs([
        "The Employee agrees that in the event of being unable to attend work for any reason, he/she shall notify the Employer before the commencement of his/her shift, stating the reason for the absence and the expected duration thereof.",
        "If the Employee is aware of the need for absence in advance, he/she shall discuss and arrange such leave with the Employer at least 24 hours before the commencement of his/her shift, where reasonably possible.",
        "Failure to provide sufficient justification for any absence may result in disciplinary action being taken against the Employee.",
        "The Employee’s entitlement to sick leave shall be determined in accordance with the provisions of the Basic Conditions of Employment Act or any other applicable wage-regulating measure.",
        "The Employee acknowledges that attendance at a disciplinary hearing is mandatory once formally notified. If unable to attend due to illness, the Employee must provide an affidavit from the medical practitioner confirming he/she was unfit to attend the hearing and ensure the practitioner is available to verify the affidavit.",
        "If the Employee fails to attend a disciplinary hearing without valid justification or without providing the required affidavit, the Employer may proceed with the hearing in the Employee’s absence, provided that the Employer has acted reasonably and fairly in the circumstances. Nothing in this clause shall prevent the Employee from exercising any statutory right to refer a dispute to the CCMA, bargaining council, or any other competent forum.",
      ]),
    },
    {
      title: "Desertion / Abscondment",
      paragraphs: normalizeParagraphs([
        "The Employee agrees that failure to report for work for more than five (5) consecutive workdays without notifying the Employer shall constitute desertion. A disciplinary enquiry will be conducted to determine the reasons for the absence.",
        "The Employer will issue a notice via WhatsApp, SMS, normal or registered post, instructing the Employee to return to work or contact the office, along with the date of the enquiry. Failure to return, make contact, or attend the hearing shall result in dismissal.",
      ]),
    },
    {
      title: "Confidentiality",
      paragraphs: normalizeParagraphs([
        "The Employee will not divulge any information to any unauthorised persons or bodies relating to any aspect of his/her work or to any of the operations or processes of the Employer.",
        "Such information will include methods, processes, computer software, documentation, client lists, programmes, trade secrets, technical information, chemical formulae, drawings, financial information, or any other information which could be damaging to the Employer’s operations or which could benefit other parties to the detriment of the Employer. Such restrictions will apply during and after the Employee’s employment with the Employer.",
      ]),
    },
    {
      title: "Protection of Personal Information",
      paragraphs: normalizeParagraphs([
        "By signing this agreement, the Employee expressly consents to the collection, processing, and storage of his/her Personal Information, including Special Personal Information such as race, trade union membership, and biometric data, as defined in the Protection of Personal Information Act, 4 of 2013, for purposes related to the employment relationship, including payroll administration, benefits, statutory reporting, risk management, CCTV monitoring, vehicle and equipment tracking, internet and email usage monitoring, alcohol and drug screening, identification verification, access control, operational security, internal and external communication, compliance with legal and contractual obligations, and protecting the Employer’s legitimate business interests and those of clients and service providers.",
        "The Employee further consents to the processing and transfer of relevant Personal Information, where necessary, to third-party service providers such as medical aid, pension fund administrators and insurers for employee benefit administration, clients and service providers of the Employer where required for operational and contractual purposes, and cloud-based storage facilities or foreign entities in jurisdictions that provide adequate data protection in line with POPIA or other binding agreements ensuring data security.",
        "The Employee warrants that all Personal Information provided is accurate and undertakes to immediately update the Employer should any information become outdated or incorrect.",
        "The Employee further agrees to comply with the Employer’s Protection of Personal Information policies and acknowledges that failure to do so may result in disciplinary action.",
      ]),
    },
    {
      title: "Rules and Regulations",
      paragraphs: normalizeParagraphs([
        "The Employee agrees to observe, comply with, and be bound by all rules, regulations, policies, and procedures established by the Employer or, where applicable, those prescribed by a Bargaining Council. The Employer shall take reasonable steps to ensure that the Employee is made aware of such rules, regulations, and procedures.",
        "The Employer reserves the right, at its sole discretion, to amend, modify, or introduce additional rules, regulations, and procedures as necessary, provided that the Employee is given reasonable notice of any such changes.",
        "The Employee confirms that he/she has been provided with a copy of the Employer’s Disciplinary Code as part of this agreement and that its contents have been explained and understood. The Employee further acknowledges that compliance with these provisions is a condition of employment, and any failure to adhere to them may result in disciplinary action.",
      ]),
    },
    {
      title: "Disclosure of Misconduct",
      paragraphs: normalizeParagraphs([
        "The Employee agrees to immediately notify the Employer upon becoming aware of, or when he/she reasonably ought to have been aware of, any offence, misconduct, or violation of company policies committed by himself/herself, or any other Employee.",
        "Failure to disclose such information shall be regarded as dishonesty and a breach of trust, which may result in disciplinary action, including possible dismissal for withholding information from the Employer.",
      ]),
    },
    {
      title: "Industrial Action",
      paragraphs: normalizeParagraphs([
        "The Employee agrees not to engage in, incite, or encourage any form of illegal industrial action that may disrupt the Employer’s operations or the work of other employees. Such actions include, but are not limited to, unprotected strikes, go-slows, work-to-rule actions, boycotts, stay-aways, or any conduct that obstructs, prevents, or delays the Employer’s business activities.",
        "The Employee further agrees to participate only in legally sanctioned industrial action, which may occur only after all statutory dispute resolution procedures have been followed in compliance with applicable labour laws.",
        "The Employee undertakes to actively promote, support, and maintain industrial peace and harmony in the workplace. This agreement, including all rights and obligations under the employment contract, shall be automatically suspended during any period of strike action.",
        "The Employee acknowledges and agrees that he/she shall be held liable for any damages to property, financial losses, or other harm suffered by the Employer as a result of his/her involvement in any illegal industrial action, whether directly or indirectly. Furthermore, the Employee agrees that should any damage, loss, or harm occur during a legally protected strike, he/she may still be held individually liable if his/her conduct contributed to such damage or financial loss, regardless of the strike’s legal status.",
        "The Employee further agrees to disclose any affiliation with a registered trade union upon signing this contract or within seven (7) days of becoming a union member.",
      ]),
    },
    {
      title: "Health and Fitness",
      paragraphs: normalizeParagraphs([
        "The Employee confirms that he/she is in good physical and mental health and capable of performing his/her duties. Should the Employee become incapable of fulfilling his/her duties due to health reasons, the Employer may, after following the procedures prescribed by the Labour Relations Act, terminate the Employee’s services on the grounds of incapacity.",
        "The Employer reserves the right to require the Employee to undergo a medical examination at the Employer’s expense to assess his/her fitness for duty. Unreasonable and unsubstantiated refusal to comply with such a request will result in disciplinary action.",
      ]),
    },
    {
      title: "Safety and Security",
      paragraphs: normalizeParagraphs([
        "The Employee agrees to comply with all safety and security rules and regulations as prescribed by the Employer and in accordance with the Occupational Health and Safety Act, 85 of 1993.",
        "For security and safety reasons, the Employee consents to the Employer, or any appointed representative, conducting searches of his/her person, personal possessions, and any vehicle he/she brings onto the Employer’s premises. Such searches may be conducted at the Employer’s discretion and in a reasonable manner.",
        "The Employee further agrees to wear and display any security identity card issued by the Employer at all times while entering, exiting, or being present on the Employer’s premises.",
      ]),
    },
    {
      title: "Change of Status",
      paragraphs: normalizeParagraphs(
        "The Employee agrees to promptly notify the Employer of any changes to his/her personal information as recorded in the employment particulars section of this agreement. Such notification shall be made within seven (7) days to ensure the Employer’s records remain accurate and up to date.",
      ),
    },
    {
      title: "Address Domicilia",
      paragraphs: normalizeParagraphs(
        "The parties agree that any notice or correspondence required under this agreement shall be in writing and may be delivered by hand, SMS, WhatsApp, email, registered post or regular post to the addresses recorded in the employment particulars section of this agreement, which shall serve as their domicilium citandi et executandi for all legal purposes.",
      ),
    },
    {
      title: "Alcohol and Drug Testing",
      paragraphs: normalizeParagraphs([
        "The Employee agrees to submit to alcohol and/or drug testing when deemed necessary by the Employer. Such testing shall be conducted in a lawful and reasonable manner.",
        "The Employee acknowledges that the Employer enforces a zero-tolerance policy regarding alcohol and drug abuse, due to the nature of its business irrespective of the capacity in which he/she is employed. The Employee further understands that a positive test result may lead to a disciplinary enquiry, which could result in dismissal.",
        "Should the Employee unreasonably refuse to undergo an alcohol and/or drug test, the Employee agrees that the Employer may draw a negative inference from such refusal, which may be treated as a presumptive positive result and may lead to disciplinary action, including possible dismissal. Refusal will further be regarded as breach of contract and/or insubordination.",
        "The Employee bears the responsibility to inform the Employer of any addiction to alcohol or drugs, and failure to disclose such dependency will result in disciplinary steps taken for testing positive for drugs or alcohol.",
      ]),
    },
    {
      title: "Emails and Internet",
      paragraphs: normalizeParagraphs([
        "The Employee acknowledges that, for the proper and efficient conduct of business, the Employer may intercept and/or monitor the Employee’s communications from time to time. By signing this agreement, the Employee expressly consents to the Employer intercepting, monitoring, and reviewing any direct or indirect communication to which the Employee is a party, provided that such communication occurs wholly or partly on the Employer’s premises, during working hours, involves the use of the Employer’s property or facilities, or otherwise relates to the Employer’s business.",
        "The Employee understands that such monitoring may include, but is not limited to, the listening, recording, viewing, examining, or inspecting of emails, correspondence, text messages, and internet usage. The Employee further grants permission to the Employer to monitor his/her email and internet communications, acknowledging that this is necessary to ensure compliance with workplace policies, protect business interests, and prevent unauthorised or inappropriate use of company resources.",
      ]),
    },
    {
      title: "Consent to Recording",
      paragraphs: normalizeParagraphs([
        "The Employee expressly agrees that the Employer may record, monitor, and store any verbal, electronic, or written communication involving the Employee, even in the absence of prior express consent, where such recording is conducted for legitimate business purposes. This includes, but is not limited to, workplace meetings, telephone conversations, virtual communications, and any other interactions related to the Employer’s business operations.",
        "The Employee acknowledges that such recordings may be used for training, quality control, compliance, security, dispute resolution, and other operational needs, in accordance with applicable laws and company policies.",
      ]),
    },
    {
      title: "Consent to Polygraph Testing",
      paragraphs: normalizeParagraphs([
        "The Employee agrees to submit to polygraph testing when reasonably required by the Employer for investigative or security purposes, including but not limited to cases involving theft, fraud, dishonesty, misconduct, or breach of company policies. The Employee acknowledges that such tests shall be conducted by a qualified and accredited examiner in a fair and lawful manner.",
        "Should the Employee unreasonably refuse to undergo a polygraph test, the Employee agrees that the Employer may draw an adverse inference from such refusal, which may be considered as a factor in disciplinary proceedings. However, the Employee understands that a polygraph test result alone will not be the sole basis for disciplinary action or dismissal but may form part of a broader investigation. Refusal will further be regarded as breach of contract and/or insubordination.",
      ]),
    },
    {
      title: "Temporary Lay-Off",
      paragraphs: normalizeParagraphs([
        "The Employee agrees that the Employer shall have the right to implement a temporary lay-off, provided that where reasonably possible, the Employer shall give at least one (1) day’s notice, specifying the reason and anticipated duration of the lay-off. The Employee acknowledges that the Employer shall not be liable to remunerate the Employee for the period of the temporary lay-off.",
        "Temporary lay-offs may be implemented due to circumstances beyond the Employer’s control, including but not limited to adverse weather conditions, shortages of material, or a temporary shortage of work.",
        "The Employee further agrees that any temporary lay-off in accordance with this clause shall not constitute a unilateral change to the terms and conditions of employment and shall not be deemed a dismissal, retrenchment, or breach of contract.",
      ]),
    },
    {
      title: "Proof of Citizenship",
      paragraphs: normalizeParagraphs([
        "Upon commencement of employment, the Employee shall be required to provide proof of South African citizenship. If the Employee is not a South African citizen, he/she shall be required to submit a valid work permit or proof of permanent residency within seven (7) days from such request. This will be a continued responsibility of the Employee throughout the duration of this agreement.",
        "The Employee acknowledges that it is his/her sole responsibility to ensure that any required work permits remain valid for the duration of his/her employment. Failure to maintain a valid work permit or to provide updated documentation when required may result in dismissal for breach of contract.",
      ]),
    },
    {
      title: "Confidentiality and Intellectual Property",
      paragraphs: normalizeParagraphs([
        "The Employee acknowledges that during the course of employment, he/she will have access to and become acquainted with various types of confidential and proprietary information, including but not limited to formulas, customer lists, operational methods, marketing strategies, and other materials collectively referred to as “Confidential Information” that are owned by the Employer and are vital to the Employer’s business.",
        "The Employee agrees to maintain the confidentiality of all Confidential Information obtained during employment and shall not disclose, directly or indirectly, any such information to any individual or entity without the prior written consent of the Employer, both during and after the termination of employment. The Employee further agrees to use Confidential Information solely for the performance of his/her duties and shall not utilise or disclose such information for any other purpose or in any manner that may cause harm or financial loss to the Employer.",
        "Upon termination of employment, or at the Employer’s request at any other time, the Employee shall immediately return all materials containing Confidential Information, including but not limited to documents, electronic files, and any other records in his/her possession.",
        "The obligations contained in this clause shall survive the termination of employment indefinitely. Any breach of these confidentiality obligations may result in irreparable harm to the Employer, for which monetary damages may not be an adequate remedy. Accordingly, in addition to any other legal recourse available, the Employer shall be entitled to seek injunctive relief to enforce compliance with this clause.",
      ]),
    },
    {
      title: "Entire Agreement and Acknowledgement",
      paragraphs: normalizeParagraphs([
        "This contract constitutes the entire agreement between the parties, and no variation, alteration, or addition shall be of any force or effect unless reduced to writing and signed by both parties.",
        "No indulgence, leniency, or extension of time granted by either party in the event of any claim or dispute shall prejudice their rights, preclude them from exercising such rights, or be deemed a waiver or limitation of any right under this agreement.",
        "By signing this contract, both parties acknowledge receipt of a copy, confirm that they have read and understood its contents, and agree to be bound by its terms. The Employee further undertakes to comply with the provisions contained herein.",
        "The Employee acknowledges that all terms and conditions of employment are contained in this agreement, and any matters not specifically provided for shall be governed by the Employer’s rules, regulations, and procedures. Where both this contract and the Employer’s policies are silent on any particular issue, the relevant provisions of the Basic Conditions of Employment Act shall apply.",
        "The Employee confirms that the terms of this contract have been explained and interpreted, where necessary, and that he/she voluntarily accepts its conditions.",
      ]),
    },
  ];

  if (bargainingCouncil === "MIBCO") {
    const mibcoClauseOverrides: Record<string, Omit<PreviewClause, "id">> = {
      Remuneration: {
        title: "Remuneration",
        paragraphs: normalizeParagraphs([
          "The Employee shall receive a gross monthly salary as specified in Section C on Page 1 of this agreement, which shall be compliant with the MIBCO Agreement and/or the National Minimum Wage Act, where applicable.",
          "The Employee’s salary shall be paid monthly in arrears, no later than seven (7) days after the date on which payment becomes due.",
          "Salary payments shall be made via electronic transfer into a bank account held at a financial institution of the Employee’s choice, as designated by the Employee.",
          "Unauthorised absence from work or absence without approved leave shall result in no payment for the period of absence.",
          "Overtime remuneration, where applicable, shall be calculated at a rate of one and a half (1.5) times the Employee’s normal wage for overtime hours worked, or as otherwise prescribed by the MIBCO Agreement.",
          "The Employer shall not provide meals or accommodation and shall not be responsible for any transport allowance to and from the workplace, unless otherwise required by the MIBCO Agreement or agreed to in writing.",
        ]),
      },
      "Hours of Work": {
        title: "Hours of Work",
        paragraphs: normalizeParagraphs([
          "The Employee’s normal working hours shall be forty-five (45) hours per week, in accordance with the work roster prepared by management. The specific daily working hours shall be determined by the Employee’s Manager and may be adjusted as necessary to meet operational requirements.",
          "The Employee acknowledges that, due to the nature of the Employer’s business, management reserves the right to amend or vary working hours as required, subject to applicable labour laws and the MIBCO Agreement.",
          "The Employee further agrees that he/she may be required to work on Sundays and public holidays, as well as to perform overtime duties when operational demands necessitate, subject to the applicable provisions of the MIBCO Agreement.",
          "The Employee expressly agrees to work a compressed work week, where working hours may exceed the standard daily limit but remain within the prescribed weekly limit, in compliance with applicable labour laws and/or collective agreements.",
          "The Employee shall be entitled to a lunch break of sixty (60) minutes during the course of each workday, unless otherwise regulated by the MIBCO Agreement or applicable law.",
        ]),
      },
      Overtime: {
        title: "Short Time and Overtime",
        paragraphs: normalizeParagraphs([
          "A shorter workday or workweek may be implemented in circumstances and contingencies as prescribed by the MIBCO Agreement. The Employer shall provide written notice of the intention to implement short time to the Employees, relevant trade unions, and MIBCO, in accordance with the applicable provisions of the agreement.",
          "The Employer shall provide reasonable notice of overtime requirements, except in cases of emergency overtime, which the Employee agrees to work on short notice.",
          "Overtime shall be remunerated subject to the MIBCO Agreement and/or prevailing labour legislation, as amended from time to time.",
          "Any employee earning above the Minister of Employment and Labour’s prescribed earnings threshold is not entitled to overtime remuneration under the Basic Conditions of Employment Act, unless otherwise provided for by the MIBCO Agreement or any applicable collective agreement.",
        ]),
      },
      "Salary Increase": {
        title: "Salary Increase",
        paragraphs: normalizeParagraphs([
          "Future salary increases shall be regulated by and implemented in accordance with the MIBCO Agreement, where applicable.",
          "Where the MIBCO Agreement does not prescribe an increase applicable to the Employee, any salary increase shall remain within the discretion of the Employer and may be determined with reference to the Employer’s financial position, operational requirements, and the Employee’s performance.",
        ]),
      },
      "Annual Leave": {
        title: "Annual Leave and Leave Enhancement Pay",
        paragraphs: normalizeParagraphs([
          "The Employee shall be entitled to twenty-one (21) consecutive days’ annual leave for every twelve (12) months of employment.",
          "An Employee who has more than eight (8) consecutive years’ service with the Employer shall be entitled to twenty-eight (28) consecutive days’ leave at full pay per annum, where prescribed by the MIBCO Agreement.",
          "Casual employees shall be entitled to one (1) day’s leave for every seventeen (17) days worked, where applicable.",
          "Annual leave shall be taken at a time determined at the Employer’s discretion, subject to operational requirements, and may be scheduled at any time during the twelve-month leave cycle but must be taken within six (6) months following the end of the leave cycle.",
          "Leave not taken within the applicable leave cycle shall be forfeited and will not be carried over to the next cycle unless otherwise agreed in writing by the Employer.",
          "If a public holiday falls during the Employee’s approved leave period and such day would otherwise have been a normal working day, the Employee shall be entitled to an additional day’s paid leave.",
          "The Employee agrees to take his/her annual leave during the Employer’s annual shutdown period, where applicable. Any additional leave approved during the leave cycle shall be deducted from the Employee’s total annual leave entitlement.",
          "In terms of MIBCO’s additional paid leave provisions, an Employee qualifying for his/her fourth or subsequent consecutive paid leave arising from continuous employment with the Employer shall be entitled to additional paid leave of one (1) week, as prescribed by the MIBCO Agreement.",
          "Leave enhancement pay shall be regulated by the provisions of the MIBCO Agreement.",
        ]),
      },
      "Proof of Sickness": {
        title: "Proof of Sickness",
        paragraphs: normalizeParagraphs([
          "An Employee who is absent from work due to illness must provide a valid medical certificate issued by a registered medical practitioner or traditional healer. The medical certificate must state the full name and surname of the practitioner or healer, include the practice number of the issuing practitioner or healer, contain the physical address, contact number and email address of the practitioner or healer, indicate the date of examination of the Employee, clearly declare that the Employee was unfit for duty, and specify the exact dates for which the Employee was deemed unfit to work.",
          "The medical certificate must be issued and signed by a qualified medical practitioner, or any other person certified to diagnose and treat patients and registered with a professional council.",
          "The Employer is not required to pay the Employee for sick leave if the Employee has been absent for more than two consecutive days or on more than two occasions within an eight-week period, and upon request, fails to produce a medical certificate confirming that he/she was unable to work for the duration of the absence due to sickness or injury.",
          "The Employer shall not accept any medical certificates that have been altered, including any struck-through or replaced words, letters, or numbers. Hospital or clinic attendance notes that merely confirm the Employee’s visit, without explicitly stating that he/she was unfit for duty, shall not be accepted.",
          "The Employee is responsible for ensuring that any medical certificate submitted complies with these requirements. Failure to do so may result in the non-approval of sick leave.",
          "The Employee agrees that if he/she is absent from work due to sick leave on any day from Friday to Monday, inclusive, and such days form part of his/her normal working week, he/she shall be required to provide a valid medical certificate as proof of illness.",
          "If the Employee is absent on the working day before or after a public holiday, he/she shall be required to submit a valid medical certificate for the period of absence.",
          "The Employee expressly agrees that any medical certificate submitted as proof of sickness shall clearly specify the diagnosed medical condition for which the Employee was deemed unfit for duty. The Employee further acknowledges and agrees that a medical certificate stating only “medical condition” shall not be accepted as valid proof of illness. This requirement shall apply to all medical certificates submitted throughout the duration of employment, and failure to comply with this provision may result in the non-approval of sick leave and may be subject to disciplinary action.",
        ]),
      },
    };

    return clauses.map((clause) => {
      const override = mibcoClauseOverrides[clause.title];
      const nextClause = override || clause;
      const nextParagraphs =
        nextClause.title === "Hours of Work"
          ? applyWorkingHoursClauseMode({
              paragraphs: nextClause.paragraphs,
              workingHoursMode,
              workingHoursScheduleParagraphs,
            })
          : nextClause.paragraphs;
      return {
        ...nextClause,
        paragraphs: nextParagraphs,
        id: makePreviewClauseId(nextClause.title),
      };
    });
  }

  return clauses.map((clause) => ({
    ...clause,
    paragraphs:
      clause.title === "Hours of Work"
        ? applyWorkingHoursClauseMode({
            paragraphs: clause.paragraphs,
            workingHoursMode,
            workingHoursScheduleParagraphs,
          })
        : clause.paragraphs,
    id: makePreviewClauseId(clause.title),
  }));
};

const PreviewClauseBlock = ({
  clause,
  paragraphNumberStart,
  isPreviewEditable = false,
  isAdded = false,
  isEdited = false,
  onEdit,
  workingHoursMode,
  workingHoursScheduleRows,
  onWorkingHoursTimeChange,
}: {
  clause: PreviewClause;
  paragraphNumberStart: number;
  isPreviewEditable?: boolean;
  isAdded?: boolean;
  isEdited?: boolean;
  onEdit?: () => void;
  workingHoursMode?: ContractStepState["permContractWorkingHoursMode"];
  workingHoursScheduleRows?: WorkingHoursScheduleRow[];
  onWorkingHoursTimeChange?: (field: keyof ContractStepState, value: string) => void;
}) => {
  const hoursOfWorkClauseId = makePreviewClauseId("Hours of Work");
  const shouldRenderWorkingHoursSelectors =
    clause.id === hoursOfWorkClauseId &&
    workingHoursMode === "defined" &&
    isPreviewEditable &&
    Array.isArray(workingHoursScheduleRows) &&
    workingHoursScheduleRows.length === workingHoursDayDefinitions.length;
  const shouldRenderWorkingHoursGroupedPreview =
    clause.id === hoursOfWorkClauseId &&
    workingHoursMode === "defined" &&
    Array.isArray(workingHoursScheduleRows) &&
    workingHoursScheduleRows.length === workingHoursDayDefinitions.length;

  return (
    <section className="space-y-1.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-black">{clause.title.toUpperCase()}</h3>
          {isAdded ? (
            <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
              Added
            </span>
          ) : null}
          {isEdited ? (
            <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
              Edited
            </span>
          ) : null}
        </div>
        {isPreviewEditable && onEdit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="h-7 rounded border-slate-300 px-3 text-[11px] text-slate-600 hover:border-[#3eca44] hover:bg-white hover:text-[#2f9f35]"
          >
            <Pencil className="mr-1 h-3 w-3" />
            Edit
          </Button>
        ) : null}
      </div>
      <div className="space-y-1.5">
        {shouldRenderWorkingHoursGroupedPreview ? (
          <>
            <div className="grid grid-cols-[20px_minmax(0,1fr)] gap-2 text-[12px] leading-6 text-slate-900">
              <span className="font-normal text-black">{paragraphNumberStart}.</span>
              <div className="space-y-2">
                <p className="text-justify font-normal text-black">{clause.paragraphs[0]}</p>
                <div className="space-y-1.5 pl-4">
                  {workingHoursScheduleRows.map((row, index) => {
                    const dayDefinition = workingHoursDayDefinitions[index];
                    return (
                      <div key={`${clause.title}-schedule-${row.label}`} className="grid items-center gap-2 md:grid-cols-[86px_minmax(0,108px)_14px_minmax(0,108px)]">
                        <p className="font-semibold text-black">{`${row.label}:`}</p>
                        {shouldRenderWorkingHoursSelectors ? (
                          <>
                            <Select
                              value={row.start}
                              onValueChange={(value) => onWorkingHoursTimeChange?.(dayDefinition.startField, value)}
                            >
                              <SelectTrigger className={cn(selectTriggerClassName, "w-[108px]")}>
                                <SelectValue placeholder="Select start time" />
                              </SelectTrigger>
                              <SelectContent className="text-[10px]">
                                {workingHoursTimeOptions.map((option) => (
                                  <SelectItem key={`${row.label}-preview-start-${option}`} value={option} className="text-[10px]">
                                    {option === "N/A" ? option : formatWorkingHoursTimeLabel(option)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-center text-[11px] font-medium text-slate-500">to</p>
                            <Select
                              value={row.end}
                              onValueChange={(value) => onWorkingHoursTimeChange?.(dayDefinition.endField, value)}
                            >
                              <SelectTrigger className={cn(selectTriggerClassName, "w-[108px]")}>
                                <SelectValue placeholder="Select end time" />
                              </SelectTrigger>
                              <SelectContent className="text-[10px]">
                                {workingHoursTimeOptions.map((option) => (
                                  <SelectItem key={`${row.label}-preview-end-${option}`} value={option} className="text-[10px]">
                                    {option === "N/A" ? option : formatWorkingHoursTimeLabel(option)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </>
                        ) : (
                          <>
                            <p className="pl-2 font-normal text-black">
                              {row.start === "N/A" || row.end === "N/A"
                                ? "N/A"
                                : formatWorkingHoursTimeLabel(row.start)}
                            </p>
                            <p className="text-left text-[11px] font-medium text-slate-500">
                              {row.start === "N/A" || row.end === "N/A" ? "" : "to"}
                            </p>
                            <p className="pl-4 font-normal text-black">
                              {row.start === "N/A" || row.end === "N/A"
                                ? ""
                                : formatWorkingHoursTimeLabel(row.end)}
                            </p>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            {clause.paragraphs.slice(1 + workingHoursDayDefinitions.length).map((paragraph, index) => (
              <div key={`${clause.title}-tail-${index}`} className="grid grid-cols-[20px_minmax(0,1fr)] gap-2 text-[12px] leading-6 text-slate-900">
                <span className="font-normal text-black">{paragraphNumberStart + 1 + index}.</span>
                <p className="text-justify font-normal text-black">{paragraph}</p>
              </div>
            ))}
          </>
        ) : (
          clause.paragraphs.map((paragraph, index) => (
            <div key={`${clause.title}-${index}`} className="grid grid-cols-[20px_minmax(0,1fr)] gap-2 text-[12px] leading-6 text-slate-900">
              <span className="font-normal text-black">{paragraphNumberStart + index}.</span>
              <p className="text-justify font-normal text-black">{paragraph}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

const PreviewPartiesBlock = ({
  employerName,
  employerRegistration,
  employeeName,
  employeeReference,
}: {
  employerName: string;
  employerRegistration: string;
  employeeName: string;
  employeeReference: string;
}) => (
  <section className="mt-5 pb-6">
    <p className="text-[11px] text-black">Entered into by and between:</p>

    <div className="mt-4 grid grid-cols-[minmax(0,1fr)_220px] items-start gap-6">
      <div>
        <p className="text-[12px] font-bold uppercase text-black">{employerName}</p>
        <p className="mt-1 text-[11px] text-black">{`Reg. number: ${employerRegistration}`}</p>
      </div>
      <p className="pt-0.5 text-right text-[11px] italic text-black">The Employer</p>
    </div>

    <p className="mt-4 text-[11px] italic text-black">and</p>

    <div className="mt-4 grid grid-cols-[minmax(0,1fr)_220px] items-start gap-6">
      <div>
        <p className="text-[12px] font-bold uppercase text-black">{employeeName}</p>
        <p className="mt-1 text-[11px] text-black">{employeeReference}</p>
      </div>
      <p className="pt-0.5 text-right text-[11px] italic text-black">The Employee</p>
    </div>
  </section>
);

const PreviewClauseDividerTitle = ({ title }: { title: string }) => (
  <div className="mt-2 mb-8">
    <div className="h-px bg-black" />
    <div className="flex justify-center">
      <p className="inline-block pt-5 pb-3 text-[14px] font-bold uppercase tracking-[0.09em] text-black">{title}</p>
    </div>
    <div className="h-px bg-black" />
  </div>
);

const PreviewSignatureBlock = () => (
  <section className="mt-10 space-y-8">
    <p className="text-[12px] text-black">
      Done and Signed at <span className="inline-block min-w-[120px] border-b border-black align-middle" /> on this{" "}
      <span className="inline-block min-w-[32px] border-b border-black align-middle" /> day of{" "}
      <span className="inline-block min-w-[96px] border-b border-black align-middle" /> {currentYear}.
    </p>

    <div className="space-y-8">
      <h3 className="text-[13px] font-bold uppercase text-black">Signatures</h3>

      {[
        ["For the Employer", "For the Employee"],
        ["Employer Witness", "Employee Witness"],
      ].map((row, rowIndex) => (
        <div
          key={row.join("-")}
          className={cn("grid grid-cols-2 gap-10", rowIndex === 0 ? "pt-4" : "pt-2")}
        >
          {row.map((label) => (
            <div key={label}>
              <div className="h-5 border-b border-black" />
              <p className="pt-1 text-[11px] text-black">{label}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  </section>
);

const HoverMarqueeText = ({
  text,
  className,
}: {
  text: string;
  className?: string;
}) => {
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [overflowOffset, setOverflowOffset] = useState(0);

  useEffect(() => {
    const updateOverflow = () => {
      const container = containerRef.current;
      const textNode = textRef.current;
      if (!container || !textNode) return;
      const nextOffset = Math.max(textNode.scrollWidth - container.clientWidth, 0);
      setOverflowOffset(nextOffset);
    };

    updateOverflow();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateOverflow);
    if (containerRef.current) observer.observe(containerRef.current);
    if (textRef.current) observer.observe(textRef.current);
    return () => observer.disconnect();
  }, [text]);

  const shouldAnimate = isHovered && overflowOffset > 0;
  const duration = Math.max(overflowOffset / 24, 2.5);

  return (
    <span
      ref={containerRef}
      className={cn("block min-w-0 overflow-hidden whitespace-nowrap", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span
        ref={textRef}
        className="inline-block whitespace-nowrap"
        style={{
          transform: shouldAnimate ? `translateX(-${overflowOffset}px)` : "translateX(0px)",
          transition: shouldAnimate ? `transform ${duration}s linear` : "transform 180ms ease-out",
          willChange: overflowOffset > 0 ? "transform" : undefined,
        }}
      >
        {text}
      </span>
    </span>
  );
};

const AddClauseDivider = ({
  onClick,
}: {
  onClick: () => void;
}) => (
  <div className="flex justify-center py-1">
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded border border-dashed border-slate-300 px-3 py-1.5 text-[11px] font-medium text-slate-500 transition-colors hover:border-[#3eca44] hover:text-[#2f9f35]"
    >
      <Plus className="h-3.5 w-3.5" />
      Add clause here
    </button>
  </div>
);

const TopStepper = ({
  activeStep,
  onStepSelect,
  canSelectStep,
}: {
  activeStep: number;
  onStepSelect: (index: number) => void;
  canSelectStep: (index: number) => boolean;
}) => (
  <div className="flex items-center justify-center border-b border-slate-200 px-4 py-4">
    <div className="flex items-center gap-6">
      {steps.map((step, index) => {
        const isActive = index === activeStep;
        const isComplete = index < activeStep;
        const isClickable = canSelectStep(index);
        const content = (
          <>
            <span
              className={cn(
                "inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold leading-none",
                isActive
                  ? "border-[#2D4256] bg-[#2D4256] text-white"
                  : isComplete
                    ? "border-[#3eca44] bg-[#3eca44] text-white"
                    : "border-slate-200 bg-white text-slate-400",
              )}
            >
              {isComplete ? <Check className="h-3 w-3" aria-hidden="true" /> : index + 1}
            </span>
            <span
              className={cn(
                "text-[11px] font-semibold",
                isActive ? "text-[#2D4256]" : isComplete ? "text-[#3eca44]" : "text-slate-400",
              )}
            >
              {step}
            </span>
          </>
        );
        return isClickable ? (
          <button key={step} type="button" onClick={() => onStepSelect(index)} className="flex items-center gap-2 rounded-sm px-1 hover:bg-slate-100">
            {content}
          </button>
        ) : (
          <div key={step} className="flex items-center gap-2 px-1">
            {content}
          </div>
        );
      })}
    </div>
  </div>
);

const PermContractGenerator = ({
  embedded = false,
  onRequestClose,
  draftState,
  onDraftStateChange,
  onStepChange,
  onStepMetaChange,
}: PermContractGeneratorProps) => {
  const { toast } = useToast();
  const restored = isDraftState(draftState) ? draftState : null;
  const [activeStep, setActiveStep] = useState(restored?.activeStep ?? 0);
  const [isFinished, setIsFinished] = useState(restored?.isFinished ?? false);
  const [isPreviewEditable, setIsPreviewEditable] = useState(Boolean(restored?.preview?.isPreviewEditable));
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const [companyLoadMessage, setCompanyLoadMessage] = useState("No clients found.");
  const [nationalityMenuOpen, setNationalityMenuOpen] = useState(false);
  const [bargainingCouncilMenuOpen, setBargainingCouncilMenuOpen] = useState(false);
  const [bargainingCouncilSearchQuery, setBargainingCouncilSearchQuery] = useState("");
  const [isSalaryAmountFocused, setIsSalaryAmountFocused] = useState(false);
  const [company, setCompany] = useState<CompanyStepState>(() => normalizeCompanyDraft(restored?.company));
  const [employee, setEmployee] = useState<EmployeeStepState>(() => normalizeEmployeeDraft(restored?.employee));
  const [contract, setContract] = useState<ContractStepState>(() => normalizeContractDraft(restored?.contract));
  const [clauseBodyEdits, setClauseBodyEdits] = useState<Record<string, string>>(() =>
    normalizePreviewEditRecord(restored?.preview?.clauseBodyEdits),
  );
  const [clauseTitleEdits, setClauseTitleEdits] = useState<Record<string, string>>(() =>
    normalizePreviewEditRecord(restored?.preview?.clauseTitleEdits),
  );
  const [customClauses, setCustomClauses] = useState<CustomPreviewClause[]>(() =>
    normalizeCustomPreviewClauses(restored?.preview?.customClauses),
  );
  const [editingClauseId, setEditingClauseId] = useState<string | null>(null);
  const [clauseTitleDraft, setClauseTitleDraft] = useState("");
  const [clauseBodyDraft, setClauseBodyDraft] = useState("");
  const [addingAfterId, setAddingAfterId] = useState<string | null | undefined>(undefined);
  const [newClauseTitle, setNewClauseTitle] = useState("");
  const [newClauseBody, setNewClauseBody] = useState("");
  const startDatePickerRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    onStepChange?.(isFinished ? steps[3] : steps[activeStep]);
  }, [activeStep, isFinished, onStepChange]);

  useEffect(() => {
    let cancelled = false;

    const fetchCompanies = async () => {
      const { data, error } = await db
        .from("clients")
        .select(
          "id,registered_name,trading_as,company_type,registration_number,primary_number,primary_email,physical_address_line1,physical_address_line2,city,province,area_code",
        )
        .order("registered_name", { ascending: true, nullsFirst: false });

      if (cancelled) return;

      if (error) {
        setCompanies([]);
        setCompanyLoadMessage(`Unable to load clients: ${error.message}`);
        return;
      }

      const rows = Array.isArray(data) ? (data as CompanyRecord[]) : [];
      rows.sort((left, right) =>
        buildCompanyName(left).localeCompare(buildCompanyName(right), undefined, { sensitivity: "base" }),
      );
      setCompanies(rows);
      setCompanyLoadMessage(rows.length > 0 ? "No matching clients found." : "No clients found.");
    };

    void fetchCompanies();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadLogoForCompany = async (companyId: string) => {
    const { data, error } = await db.from("client_logos").select("*").eq("client_id", companyId).limit(1);
    if (error) {
      setCompany((current) => ({ ...current, logoUrl: "", logoOrientation: "" }));
      return;
    }
    const record = Array.isArray(data) ? ((data[0] as CompanyLogoRecord | undefined) ?? null) : null;
    const logoUrl = deriveLogoUrl(record);
    if (!logoUrl) {
      setCompany((current) => ({ ...current, logoUrl: "", logoOrientation: "" }));
      return;
    }
    const logoOrientation = await inferCompanyLogoOrientation(logoUrl);
    setCompany((current) => ({ ...current, logoUrl, logoOrientation }));
  };

  const resetDownstreamState = (nextWorkplace: string) => {
    setEmployee(emptyEmployeeState);
    setContract({
      ...emptyContractState,
      permContractWorkplace: nextWorkplace,
    });
    setIsFinished(false);
    setIsPreviewEditable(false);
    setClauseBodyEdits({});
    setClauseTitleEdits({});
    setCustomClauses([]);
    setEditingClauseId(null);
    setClauseTitleDraft("");
    setClauseBodyDraft("");
    setAddingAfterId(undefined);
    setNewClauseTitle("");
    setNewClauseBody("");
    setBargainingCouncilMenuOpen(false);
    setBargainingCouncilSearchQuery("");
  };

  const handleCompanySelect = (companyId: string) => {
    const match = companies.find((entry) => entry.id === companyId);
    if (!match) return;
    const nextCompany = {
      ...mapRecordToState(match),
      documentMode: company.documentMode,
    };
    resetDownstreamState(nextCompany.address);
    setCompany(nextCompany);
    void loadLogoForCompany(companyId);
  };

  const handleLogoClear = () => {
    setCompany((current) => ({ ...current, logoUrl: "", logoOrientation: "" }));
  };

  const hasCompany = Boolean(company.companyId);
  const isClientTemplateMode = company.documentMode === "client_template";
  const isEmployeeStepComplete =
    isClientTemplateMode ||
    (employee.permEmployeeName.trim().length > 0 &&
      employee.permEmployeeSurname.trim().length > 0 &&
      employee.permEmployeeNationality.trim().length > 0 &&
      employee.permEmployeeIdentityNumber.trim().length > 0 &&
      employee.permEmployeeResidentialAddress.trim().length > 0);
  const isContractStepComplete =
    isClientTemplateMode ||
    (contract.permContractStartDate.trim().length > 0 &&
      contract.permContractJobTitle.trim().length > 0 &&
      contract.permContractSalaryAmount.trim().length > 0 &&
      contract.permContractSalaryType.trim().length > 0 &&
      contract.permContractPayCycle.trim().length > 0 &&
      contract.permContractProbation.trim().length > 0 &&
      contract.permContractRetirementAge.trim().length > 0);

  const filteredBargainingCouncilOptions = useMemo(() => {
    const query = bargainingCouncilSearchQuery.trim().toLowerCase();
    if (!query) return bargainingCouncilOptions;
    return bargainingCouncilOptions.filter((option) =>
      `${option.label} ${option.value}`.toLowerCase().includes(query),
    );
  }, [bargainingCouncilSearchQuery]);

  const updateEmployee = <K extends keyof EmployeeStepState>(field: K, value: EmployeeStepState[K]) => {
    setIsFinished(false);
    setEmployee((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateContract = <K extends keyof ContractStepState>(field: K, value: ContractStepState[K]) => {
    setIsFinished(false);
    setContract((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateWorkingHoursDay = (field: keyof ContractStepState, value: string) => {
    setContract((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateDocumentMode = (value: DocumentMode) => {
    setIsFinished(false);
    setContract((current) => {
      if (value === "client_template") {
        return {
          ...current,
          permContractWorkplace: "",
        };
      }
      if (current.permContractWorkplace.trim().length > 0) {
        return current;
      }
      return {
        ...current,
        permContractWorkplace: company.address,
      };
    });
    setCompany((current) => ({
      ...current,
      documentMode: value,
    }));
  };

  const handleIdentityNumberChange = (value: string) => {
    const calculatedAge = deriveAgeFromIdentityNumber(value);
    setEmployee((current) => ({
      ...current,
      permEmployeeIdentityNumber: value,
      permEmployeeAge: calculatedAge || current.permEmployeeAge,
    }));
  };

  const openHiddenDatePicker = (ref: React.RefObject<HTMLInputElement | null>) => {
    const input = ref.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }
    input.focus();
    input.click();
  };

  useEffect(() => {
    setContract((current) => {
      if (company.documentMode === "client_template") return current;
      if (current.permContractWorkplace.trim().length > 0) return current;
      if (!company.address.trim()) return current;
      return {
        ...current,
        permContractWorkplace: company.address,
      };
    });
  }, [company.address, company.documentMode]);

  const togglePreviewEditMode = useCallback(() => {
    setIsPreviewEditable((current) => {
      if (current) {
        setEditingClauseId(null);
        setClauseTitleDraft("");
        setClauseBodyDraft("");
        setAddingAfterId(undefined);
        setNewClauseTitle("");
        setNewClauseBody("");
      }
      return !current;
    });
  }, []);

  const stepMeta = useMemo(
    () => ({
      steps,
      activeStep: isFinished ? 3 : activeStep,
      icons: stepIcons,
      canGoNext:
        isFinished ? !isPreviewEditable : activeStep === 0 ? hasCompany : activeStep === 1 ? isEmployeeStepComplete : activeStep === 2 ? isContractStepComplete : false,
      canGoBack: isFinished || activeStep > 0,
      canSelectStep: (index: number) => {
        if (isFinished) return index >= 0 && index <= 3;
        if (index === 0) return true;
        if (index === 1) return hasCompany || activeStep > 0;
        if (index === 2) return isEmployeeStepComplete || activeStep > 1;
        return false;
      },
      onNext: () => {
        if (isFinished) {
          void handlePdfDownload();
          return;
        }
        if (activeStep === 0 && hasCompany) {
          setActiveStep(1);
          return;
        }
        if (activeStep === 1 && isEmployeeStepComplete) {
          setActiveStep(2);
          return;
        }
        if (activeStep === 2 && isContractStepComplete) {
          setIsFinished(true);
        }
      },
      onBack: () => {
        if (isFinished) {
          setIsFinished(false);
          setActiveStep(2);
          return;
        }
        setActiveStep((current) => Math.max(current - 1, 0));
      },
      onStepSelect: (index: number) => {
        if (isFinished) {
          if (index === 3) return;
          setIsFinished(false);
        }
        if (index === 0) setActiveStep(0);
        if (index === 1 && (hasCompany || activeStep > 0 || isFinished)) setActiveStep(1);
        if (index === 2 && (isEmployeeStepComplete || activeStep > 1 || isFinished)) setActiveStep(2);
      },
      onClear: () => {
        if (isFinished) {
          togglePreviewEditMode();
          return;
        }
        if (activeStep === 0) {
          setCompany(emptyCompanyState);
          setCompanyMenuOpen(false);
          return;
        }
        if (activeStep === 1) {
          setEmployee(emptyEmployeeState);
          return;
        }
        if (activeStep === 2) {
          setContract({
            ...emptyContractState,
            permContractWorkplace: company.address,
          });
        }
      },
      isFinished,
      isPreviewEditable,
      supportsPreviewEditToggle: true,
      supportsResetAtFirstStep: hasCompany,
    }),
    [activeStep, company.address, hasCompany, isEmployeeStepComplete, isContractStepComplete, isFinished, isPreviewEditable, togglePreviewEditMode],
  );

  useEffect(() => {
    onStepMetaChange?.(stepMeta);
  }, [onStepMetaChange, stepMeta]);

  useEffect(() => {
    onDraftStateChange?.({
      activeStep,
      isFinished,
      company,
      employee,
      contract,
      preview: {
        isPreviewEditable,
        clauseBodyEdits,
        clauseTitleEdits,
        customClauses,
      },
    } satisfies PermContractDraftState);
  }, [activeStep, clauseBodyEdits, clauseTitleEdits, company, contract, customClauses, employee, isFinished, isPreviewEditable, onDraftStateChange]);

  const selectedCompanyLabel = company.companyName || "Select client";
  const selectedNationalityLabel = employee.permEmployeeNationality || "Select nationality";
  const workingHoursScheduleRows = useMemo(() => buildWorkingHoursScheduleRows(contract), [contract]);
  const workingHoursScheduleParagraphs = useMemo(
    () => buildWorkingHoursScheduleParagraphs(workingHoursScheduleRows, isClientTemplateMode),
    [isClientTemplateMode, workingHoursScheduleRows],
  );
  const salarySummary =
    [
      formatCurrencyDisplay(contract.permContractSalaryAmount),
      salaryTypeLabelByValue[contract.permContractSalaryType],
    ]
      .filter(Boolean)
      .join(" ") || "--";
  const startDateDisplay = formatDateForDisplay(contract.permContractStartDate) || "--";
  const probationDisplay = probationLabelByValue[contract.permContractProbation] || "--";
  const previewClauses = useMemo(() => {
    const baseClauses = buildPreviewClauses({
      salarySummary,
      bargainingCouncil: contract.permContractBargainingCouncil,
      workingHoursMode: contract.permContractWorkingHoursMode,
      workingHoursScheduleParagraphs,
    }).map((clause) => ({
      ...clause,
      title: clauseTitleEdits[clause.id] || clause.title,
      paragraphs: clauseBodyEdits[clause.id]
        ? normalizeClauseBodyText(clauseBodyEdits[clause.id])
        : clause.paragraphs,
    }));

    const mergedCustomClauses = customClauses.map((clause) => ({
      ...clause,
      title: clauseTitleEdits[clause.id] || clause.title,
      paragraphs: clauseBodyEdits[clause.id]
        ? normalizeClauseBodyText(clauseBodyEdits[clause.id])
        : clause.paragraphs,
    }));

    return mergePreviewClauses(baseClauses, mergedCustomClauses);
  }, [
    clauseBodyEdits,
    clauseTitleEdits,
    contract.permContractBargainingCouncil,
    contract.permContractWorkingHoursMode,
    customClauses,
    salarySummary,
    workingHoursScheduleParagraphs,
  ]);
  const interpreterDisplay =
    contract.permContractInterpreterRequired === "yes"
      ? "Yes"
      : contract.permContractInterpreterRequired === "no"
        ? "No"
        : "--";
  const isSouthAfricanEmployee = employee.permEmployeeNationality === "South African";
  const idNumberDisplay = isSouthAfricanEmployee
    ? employee.permEmployeeIdentityNumber || "--"
    : /^\d{13}$/.test(employee.permEmployeeIdentityNumber.replace(/\D/g, ""))
      ? employee.permEmployeeIdentityNumber
      : "--";
  const passportDisplay = isSouthAfricanEmployee
    ? "--"
    : idNumberDisplay === "--"
      ? employee.permEmployeeIdentityNumber || "--"
      : "--";
  const activeEditingClause = editingClauseId ? previewClauses.find((clause) => clause.id === editingClauseId) ?? null : null;
  const employeeFullNameDisplay = [employee.permEmployeeName, employee.permEmployeeSurname].filter(Boolean).join(" ").trim();
  const employeeReferenceDisplay = isClientTemplateMode
    ? previewTemplatePlaceholder
    : idNumberDisplay !== "--"
      ? `ID number: ${idNumberDisplay}`
      : `Passport no.: ${passportDisplay}`;
  const employerNameDisplay = (company.companyName || "--").toUpperCase();
  const employeeNameDisplay = (isClientTemplateMode ? previewTemplatePlaceholder : employeeFullNameDisplay || "--").toUpperCase();
  const infoSheetEmployeePreview = {
    surname: isClientTemplateMode ? previewTemplatePlaceholder : employee.permEmployeeSurname || "--",
    name: isClientTemplateMode ? previewTemplatePlaceholder : employee.permEmployeeName || "--",
    idNumber: isClientTemplateMode ? previewTemplatePlaceholder : idNumberDisplay,
    passportNumber: isClientTemplateMode ? previewTemplatePlaceholder : passportDisplay,
    age: isClientTemplateMode ? previewTemplatePlaceholderShort : employee.permEmployeeAge || "--",
    nationality: isClientTemplateMode ? previewTemplatePlaceholder : employee.permEmployeeNationality || "--",
    race: isClientTemplateMode ? previewTemplatePlaceholder : employee.permEmployeeRace || "--",
    gender: isClientTemplateMode ? previewTemplatePlaceholder : employee.permEmployeeGender || "--",
    cellNumber: isClientTemplateMode ? previewTemplatePlaceholder : employee.permEmployeeCellNumber || "--",
    email: isClientTemplateMode ? previewTemplatePlaceholder : employee.permEmployeeEmail || "--",
    alternativeContact: isClientTemplateMode ? previewTemplatePlaceholder : employee.permEmployeeAlternativeContact || "--",
    employeeNumber: isClientTemplateMode ? previewTemplatePlaceholder : employee.permEmployeeNumber || "--",
    residentialAddress: isClientTemplateMode ? previewTemplatePlaceholder : employee.permEmployeeResidentialAddress || "--",
    postalAddress: isClientTemplateMode ? previewTemplatePlaceholder : employee.permEmployeePostalAddress || "--",
  };
  const infoSheetEmploymentPreview = {
    startDate: isClientTemplateMode ? previewTemplatePlaceholder : startDateDisplay,
    probation: probationDisplay,
    jobTitle: isClientTemplateMode ? previewTemplatePlaceholder : contract.permContractJobTitle || "--",
    department: isClientTemplateMode ? previewTemplatePlaceholder : contract.permContractDepartment || "--",
    grossSalary: isClientTemplateMode ? previewTemplatePlaceholder : salarySummary,
    payCycle: payCycleLabelByValue[contract.permContractPayCycle] || "--",
    retirement: contract.permContractRetirementAge ? `Age ${contract.permContractRetirementAge}` : "--",
    reportsTo: isClientTemplateMode ? previewTemplatePlaceholder : contract.permContractReportsTo || "--",
    interpreter: interpreterDisplay,
    workplace: isClientTemplateMode ? previewTemplatePlaceholder : contract.permContractWorkplace || "--",
  };

  async function handlePdfDownload() {
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const acroFormApi = pdf as jsPDF & {
      AcroForm: {
        TextField: new () => AcroFormTextField;
        ComboBox: new () => AcroFormComboBox;
      };
    };
    const pdfInternalApi = pdf as jsPDF & {
      internal: jsPDF["internal"] & {
        getFont: (fontName: string, fontStyle?: string) => { id: string };
      };
      __private__: {
        encodeColorString: (color: string) => string;
      };
    };
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    const footerTop = pageHeight - 22;
    const footerReserve = 28;
    const topStart = 20;
    const bodyBottomLimit = pageHeight - footerReserve;
    const sectionFill = [241, 245, 249] as const;
    const sectionBorder = [203, 213, 225] as const;
    const titleLineFallback = previewTemplatePlaceholder;
    const pdfRowSpacingIncrease = 2.11;
    const pdfSectionHeaderBottomSpacingIncrease = 4.77;
    const logoDataUrl = await loadImageUrlAsDataUrl(company.logoUrl);
    const footerLogoDimensions = getFooterLogoDimensions(company.logoOrientation);

    let y = topStart;

    const pushPage = () => {
      pdf.addPage();
      y = topStart;
    };

    const ensureSpace = (heightNeeded: number) => {
      if (y + heightNeeded <= bodyBottomLimit) return;
      pushPage();
    };

    const drawSectionHeader = (label: string) => {
      ensureSpace(11 + pdfSectionHeaderBottomSpacingIncrease);
      pdf.setDrawColor(...sectionBorder);
      pdf.setFillColor(...sectionFill);
      pdf.roundedRect(margin, y, contentWidth, 8, 0.8, 0.8, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(0, 0, 0);
      pdf.text(label, margin + 4, y + 5.1);
      y += 12 + pdfSectionHeaderBottomSpacingIncrease;
    };

    const addPdfTextField = ({
      fieldName,
      x,
      y: top,
      width,
      height,
      multiline = false,
      maxLength,
      textAlign = "left",
      fontStyle = "normal",
      fontSize = 9,
    }: FillablePdfFieldConfig & {
      x: number;
      y: number;
      width: number;
      height: number;
    }) => {
      const field = new acroFormApi.AcroForm.TextField() as AcroFormTextField & {
        getKeyValueListForStream: () => Array<{ key: string; value: string }>;
      };
      field.fieldName = fieldName;
      field.x = x;
      field.y = top;
      field.width = width;
      field.height = height;
      field.fontName = "helvetica";
      field.fontStyle = fontStyle;
      field.fontSize = fontSize;
      field.maxFontSize = fontSize;
      field.color = "black";
      field.value = "";
      field.defaultValue = "";
      field.textAlign = textAlign;
      field.showWhenPrinted = true;
      field.multiline = multiline;
      field.doNotScroll = false;
      field.doNotSpellCheck = false;
      if (typeof maxLength === "number") {
        field.maxLength = maxLength;
      }
      const defaultAppearanceFontKey = pdfInternalApi.internal.getFont(field.fontName, field.fontStyle).id;
      const defaultAppearanceColor = pdfInternalApi.__private__.encodeColorString(field.color);
      const defaultAppearance = `(/${defaultAppearanceFontKey} ${field.fontSize} Tf ${defaultAppearanceColor})`;
      const originalGetKeyValueListForStream = field.getKeyValueListForStream.bind(field);
      field.getKeyValueListForStream = () => {
        const keyValueList = originalGetKeyValueListForStream();
        keyValueList.push({
          key: "DA",
          value: defaultAppearance,
        });
        return keyValueList;
      };
      pdf.addField(field);
    };

    const addPdfDropdownField = ({
      fieldName,
      x,
      y: top,
      width,
      height,
      options,
      textAlign = "left",
      fontSize = 9,
    }: FillablePdfFieldConfig & {
      x: number;
      y: number;
      width: number;
      height: number;
      options: readonly string[];
    }) => {
      const field = new acroFormApi.AcroForm.ComboBox() as AcroFormComboBox & {
        getKeyValueListForStream: () => Array<{ key: string; value: string }>;
      };
      field.fieldName = fieldName;
      field.x = x;
      field.y = top;
      field.width = width;
      field.height = height;
      field.fontName = "helvetica";
      field.fontStyle = "normal";
      field.fontSize = fontSize;
      field.maxFontSize = fontSize;
      field.color = "black";
      field.value = "";
      field.defaultValue = "";
      field.textAlign = textAlign;
      field.showWhenPrinted = true;
      field.edit = false;
      field.setOptions(["", ...options]);
      const defaultAppearanceFontKey = pdfInternalApi.internal.getFont(field.fontName, field.fontStyle).id;
      const defaultAppearanceColor = pdfInternalApi.__private__.encodeColorString(field.color);
      const defaultAppearance = `(/${defaultAppearanceFontKey} ${field.fontSize} Tf ${defaultAppearanceColor})`;
      const originalGetKeyValueListForStream = field.getKeyValueListForStream.bind(field);
      field.getKeyValueListForStream = () => {
        const keyValueList = originalGetKeyValueListForStream();
        keyValueList.push({
          key: "DA",
          value: defaultAppearance,
        });
        return keyValueList;
      };
      pdf.addField(field);
    };

    const drawLabelValueRow = (
      label: string,
      value: string,
      mode: "single" | "full" = "single",
      labelWidthOverride?: number,
      fillableField?: FillablePdfFieldConfig,
    ) => {
      const safeValue = fillableField ? "" : value || titleLineFallback;
      const labelWidth = labelWidthOverride ?? 34;
      const valueX = margin + labelWidth;
      const valueWidth = mode === "full" ? contentWidth - labelWidth : contentWidth - labelWidth - 4;
      const lines = safeValue ? (pdf.splitTextToSize(safeValue, valueWidth) as string[]) : [];
      const lineHeight = 4.4;
      const fieldHeight = fillableField?.height ?? (fillableField?.multiline ? 11 : 6.8);
      const rowHeight = Math.max(4.4, lines.length * lineHeight, fillableField ? fieldHeight : 0);
      ensureSpace(rowHeight + 1 + pdfRowSpacingIncrease);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text(label, margin, y);
      if (fillableField) {
        if (fillableField.kind === "dropdown" && fillableField.options) {
          addPdfDropdownField({
            ...fillableField,
            x: valueX,
            y: y - 3.9,
            width: valueWidth,
            height: fieldHeight,
            options: fillableField.options,
          });
        } else {
          addPdfTextField({
            ...fillableField,
            x: valueX,
            y: y - 3.9,
            width: valueWidth,
            height: fieldHeight,
          });
        }
      } else {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        lines.forEach((line, index) => {
          pdf.text(String(line), valueX, y + index * lineHeight);
        });
      }
      y += rowHeight + 1 + pdfRowSpacingIncrease;
    };

    const drawDualLabelValueRow = (
      leftLabel: string,
      leftValue: string,
      rightLabel: string,
      rightValue: string,
      options?: {
        leftField?: FillablePdfFieldConfig;
        rightField?: FillablePdfFieldConfig;
        columnGap?: number;
        leftLabelWidth?: number;
        rightLabelWidth?: number;
        leftValuePadding?: number;
        rightValuePadding?: number;
      },
    ) => {
      const safeLeftValue = options?.leftField ? "" : leftValue || titleLineFallback;
      const safeRightValue = options?.rightField ? "" : rightValue || titleLineFallback;
      const columnGap = options?.columnGap ?? 8;
      const columnWidth = (contentWidth - columnGap) / 2;
      const leftLabelWidth = options?.leftLabelWidth ?? 28;
      const rightLabelWidth = options?.rightLabelWidth ?? 28;
      const leftValuePadding = options?.leftValuePadding ?? 4;
      const rightValuePadding = options?.rightValuePadding ?? 4;
      const leftValueX = margin + leftLabelWidth;
      const rightColumnX = margin + columnWidth + columnGap;
      const rightValueX = rightColumnX + rightLabelWidth;
      const leftValueWidth = columnWidth - leftLabelWidth - leftValuePadding;
      const rightValueWidth = columnWidth - rightLabelWidth - rightValuePadding;
      const leftLines = safeLeftValue ? (pdf.splitTextToSize(safeLeftValue, leftValueWidth) as string[]) : [];
      const rightLines = safeRightValue ? (pdf.splitTextToSize(safeRightValue, rightValueWidth) as string[]) : [];
      const lineHeight = 4.4;
      const leftFieldHeight = options?.leftField?.height ?? (options?.leftField?.multiline ? 11 : 6.8);
      const rightFieldHeight = options?.rightField?.height ?? (options?.rightField?.multiline ? 11 : 6.8);
      const rowHeight = Math.max(
        4.4,
        Math.max(leftLines.length, rightLines.length) * lineHeight,
        options?.leftField ? leftFieldHeight : 0,
        options?.rightField ? rightFieldHeight : 0,
      );

      ensureSpace(rowHeight + 1 + pdfRowSpacingIncrease);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text(leftLabel, margin, y);
      pdf.text(rightLabel, rightColumnX, y);

      if (options?.leftField) {
        if (options.leftField.kind === "dropdown" && options.leftField.options) {
          addPdfDropdownField({
            ...options.leftField,
            x: leftValueX,
            y: y - 3.9,
            width: leftValueWidth,
            height: leftFieldHeight,
            options: options.leftField.options,
          });
        } else {
          addPdfTextField({
            ...options.leftField,
            x: leftValueX,
            y: y - 3.9,
            width: leftValueWidth,
            height: leftFieldHeight,
          });
        }
      } else {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        leftLines.forEach((line, index) => {
          pdf.text(String(line), leftValueX, y + index * lineHeight);
        });
      }
      if (options?.rightField) {
        if (options.rightField.kind === "dropdown" && options.rightField.options) {
          addPdfDropdownField({
            ...options.rightField,
            x: rightValueX,
            y: y - 3.9,
            width: rightValueWidth,
            height: rightFieldHeight,
            options: options.rightField.options,
          });
        } else {
          addPdfTextField({
            ...options.rightField,
            x: rightValueX,
            y: y - 3.9,
            width: rightValueWidth,
            height: rightFieldHeight,
          });
        }
      } else {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        rightLines.forEach((line, index) => {
          pdf.text(String(line), rightValueX, y + index * lineHeight);
        });
      }

      y += rowHeight + 1 + pdfRowSpacingIncrease;
    };

    const drawClauseBlock = (clause: PreviewClause, startNumber: number) => {
      const hoursOfWorkClauseId = makePreviewClauseId("Hours of Work");
      const shouldRenderGroupedWorkingHours =
        contract.permContractWorkingHoursMode === "defined" &&
        clause.id === hoursOfWorkClauseId &&
        !clauseBodyEdits[clause.id];
      const headingLines = pdf.splitTextToSize(clause.title, contentWidth) as string[];
      const paragraphLineHeight = 4.9;
      const paragraphTextOffset = 7;
      const paragraphWidth = contentWidth - paragraphTextOffset;
      const paragraphGap = 2.4;
      const headingHeight = headingLines.length * 4.2 + 2.2;
      const firstParagraphLines = pdf.splitTextToSize(clause.paragraphs[0] || "", paragraphWidth) as string[];
      const firstParagraphHeight = firstParagraphLines.length * paragraphLineHeight + paragraphGap;

      // Keep the heading with at least the first paragraph.
      ensureSpace(headingHeight + firstParagraphHeight);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.4);
      pdf.setTextColor(0, 0, 0);
      pdf.text(headingLines.map((line) => String(line).toUpperCase()), margin, y);
      y += headingLines.length * 4.2 + 2.2;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);

      const drawParagraph = (paragraph: string, paragraphIndex: number) => {
        const numberLabel = `${startNumber + paragraphIndex}.`;
        const lines = pdf.splitTextToSize(paragraph, paragraphWidth) as string[];
        const blockHeight = lines.length * paragraphLineHeight;

        // After a clause has started, break only the paragraph that does not fit.
        ensureSpace(blockHeight + paragraphGap);
        pdf.setFont("helvetica", "normal");
        pdf.text(numberLabel, margin, y);
        pdf.setFont("helvetica", "normal");
        lines.forEach((line, lineIndex) => {
          const lineText = String(line);
          const lineY = y + lineIndex * paragraphLineHeight;
          const isLastLine = lineIndex === lines.length - 1;
          const words = lineText.trim().split(/\s+/).filter(Boolean);
          if (isLastLine || words.length <= 1) {
            pdf.text(lineText, margin + paragraphTextOffset, lineY);
            return;
          }
          const lineWidth = pdf.getTextWidth(lineText);
          const extraSpace = paragraphWidth - lineWidth;
          const gapCount = words.length - 1;
          let x = margin + paragraphTextOffset;
          words.forEach((word, wordIndex) => {
            pdf.text(word, x, lineY);
            x += pdf.getTextWidth(word);
            if (wordIndex < gapCount) {
              x += pdf.getTextWidth(" ") + extraSpace / gapCount;
            }
          });
        });
        y += blockHeight + paragraphGap;
      };

      if (shouldRenderGroupedWorkingHours) {
        drawParagraph(clause.paragraphs[0] || "", 0);

        workingHoursScheduleRows.forEach((row) => {
          const lineHeight = 5.48;
          const rowTextX = margin + paragraphTextOffset + 8;
          const dayLabelWidth = 22;
          const startFieldWidth = 26;
          const endFieldWidth = 26;
          const startFieldX = rowTextX + dayLabelWidth + 6;
          const toTextX = rowTextX + 54;
          const endFieldX = rowTextX + 62;
          const toText = "to";

          ensureSpace(lineHeight + paragraphGap);
          pdf.setFontSize(9.5);
          pdf.setFont("helvetica", "bold");
          pdf.text(`${row.label}:`, rowTextX, y);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(10);
          if (isClientTemplateMode) {
            addPdfDropdownField({
              fieldName: `template_working_hours_${row.label.toLowerCase()}_start`,
              x: startFieldX,
              y: y - 4.7,
              width: startFieldWidth,
              height: 6.8,
              options: workingHoursTimeDropdownOptions,
              fontSize: 8.5,
            });
            pdf.text(toText, toTextX, y);
            addPdfDropdownField({
              fieldName: `template_working_hours_${row.label.toLowerCase()}_end`,
              x: endFieldX,
              y: y - 4.7,
              width: endFieldWidth,
              height: 6.8,
              options: workingHoursTimeDropdownOptions,
              fontSize: 8.5,
            });
          } else if (row.start === "N/A" || row.end === "N/A") {
            pdf.text("N/A", startFieldX, y);
          } else {
            pdf.text(formatWorkingHoursTimeLabel(row.start), startFieldX, y);
            pdf.text(toText, toTextX, y);
            pdf.text(formatWorkingHoursTimeLabel(row.end), endFieldX, y);
          }
          y += lineHeight + paragraphGap;
        });

        clause.paragraphs.slice(1 + workingHoursScheduleRows.length).forEach((paragraph, index) => {
          drawParagraph(paragraph, 1 + index);
        });
      } else {
        clause.paragraphs.forEach((paragraph, paragraphIndex) => {
          drawParagraph(paragraph, paragraphIndex);
        });
      }

      y += 3.6;
    };

    const drawPartiesBlock = () => {
      ensureSpace(34);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(0, 0, 0);
      pdf.text("Entered into by and between:", margin, y);
      y += 7;

      const rightColumnWidth = 54;
      const leftColumnWidth = contentWidth - rightColumnWidth - 8;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.2);
      pdf.text(employerNameDisplay, margin, y);
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(8.5);
      pdf.text("The Employer", pageWidth - margin, y, { align: "right" });
      y += 4.6;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.7);
      pdf.text(`Reg. number: ${company.registrationNumber || "--"}`, margin, y);
      y += 8.5;

      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(8.7);
      pdf.text("and", margin, y);
      y += isClientTemplateMode ? 9.82 : 7;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.2);
      if (isClientTemplateMode) {
        addPdfTextField({
          fieldName: "template_parties_employee_name",
          x: margin,
          y: y - 5.4,
          width: leftColumnWidth,
          height: 7.5,
          fontStyle: "bold",
          fontSize: 9.5,
        });
      } else {
        pdf.text(employeeNameDisplay, margin, y);
      }
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(8.5);
      pdf.text("The Employee", pageWidth - margin, y, { align: "right" });
      y += 4.6;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.7);
      if (isClientTemplateMode) {
        pdf.setFontSize(8.3);
        pdf.text("ID Number.:", margin, y);
        addPdfTextField({
          fieldName: "template_parties_employee_reference",
          x: margin + 17,
          y: y - 3.9,
          width: leftColumnWidth - 17,
          height: 6.8,
          fontStyle: "normal",
          fontSize: 8,
        });
      } else {
        pdf.text(employeeReferenceDisplay, margin, y);
      }
      y += 7;
    };

    const drawClauseSectionDivider = (label: string) => {
      ensureSpace(18);
      const subtitle = label.toUpperCase();
      const lineYTop = y;
      const textY = y + 6.4;
      const lineYBottom = y + 10.8;
      const halfAvailable = contentWidth;
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.2);
      pdf.line(margin, lineYTop, margin + halfAvailable, lineYTop);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11.2);
      pdf.setTextColor(0, 0, 0);
      pdf.setCharSpace(0.35);
      const charSpace = 0.35;
      const effectiveTextWidth = pdf.getTextWidth(subtitle) + charSpace * Math.max(subtitle.length - 1, 0);
      const textX = margin + (contentWidth - effectiveTextWidth) / 2;
      pdf.text(subtitle, textX, textY);
      pdf.setCharSpace(0);
      pdf.line(margin, lineYBottom, pageWidth - margin, lineYBottom);
      pdf.setLineWidth(0.15);
      y += 19.2;
    };

    const drawSignatureSection = () => {
      const signatureRows: [string, string][] = [
        ["For the Employer", "For the Employee"],
        ["Employer Witness", "Employee Witness"],
      ];
      ensureSpace(52);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(0, 0, 0);
      const firstPrefix = "Done and Signed at";
      const secondPrefix = "on this";
      const thirdPrefix = "day of";
      const yearText = `${currentYear}.`;
      const firstLineWidth = 48;
      const secondLineWidth = 10;
      const thirdLineWidth = 30;
      let sentenceX = margin;
      pdf.text(firstPrefix, sentenceX, y);
      sentenceX += pdf.getTextWidth(firstPrefix) + 1.2;
      pdf.line(sentenceX, y + 0.2, sentenceX + firstLineWidth, y + 0.2);
      sentenceX += firstLineWidth + 2;
      pdf.text(secondPrefix, sentenceX, y);
      sentenceX += pdf.getTextWidth(secondPrefix) + 1.2;
      pdf.line(sentenceX, y + 0.2, sentenceX + secondLineWidth, y + 0.2);
      sentenceX += secondLineWidth + 2;
      pdf.text(thirdPrefix, sentenceX, y);
      sentenceX += pdf.getTextWidth(thirdPrefix) + 1.2;
      pdf.line(sentenceX, y + 0.2, sentenceX + thirdLineWidth, y + 0.2);
      sentenceX += thirdLineWidth + 2;
      pdf.text(yearText, sentenceX, y);
      y += 16;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text("SIGNATURES", margin, y);
      y += 10;

      signatureRows.forEach(([leftLabel, rightLabel], rowIndex) => {
        const topGap = rowIndex === 0 ? 8 : 4;
        ensureSpace(17 + topGap);
        y += topGap;
        const lineY = y;
        const columnGap = 20;
        const columnWidth = (contentWidth - columnGap) / 2;
        const leftColumnX = margin;
        const rightColumnX = margin + columnWidth + columnGap;

        pdf.setDrawColor(0, 0, 0);
        pdf.line(leftColumnX, lineY, leftColumnX + columnWidth, lineY);
        pdf.line(rightColumnX, lineY, rightColumnX + columnWidth, lineY);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.8);
        pdf.text(leftLabel, leftColumnX, lineY + 4.4);
        pdf.text(rightLabel, rightColumnX, lineY + 4.4);
        y += 17;
      });
    };

    const drawFooterAndPageNumber = (pageIndex: number, pageCount: number) => {
      pdf.setPage(pageIndex);
      pdf.setDrawColor(203, 213, 225);
      pdf.line(margin, footerTop - 4, pageWidth - margin, footerTop - 4);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`Page ${pageIndex} of ${pageCount}`, pageWidth - margin, 12, { align: "right" });

      if (logoDataUrl) {
        try {
          const imageProps = pdf.getImageProperties(logoDataUrl);
          const ratio = imageProps.width / imageProps.height;
          let logoWidth = footerLogoDimensions.pdfMaxWidth;
          let logoHeight = logoWidth / ratio;
          if (logoHeight > footerLogoDimensions.pdfMaxHeight) {
            const scale = footerLogoDimensions.pdfMaxHeight / logoHeight;
            logoHeight = footerLogoDimensions.pdfMaxHeight;
            logoWidth *= scale;
          }
          pdf.addImage(logoDataUrl, "PNG", margin, footerTop, logoWidth, logoHeight);
        } catch {
          // Continue without logo if it fails.
        }
      }

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(0, 0, 0);
      pdf.text("Initial here:", pageWidth - margin - 50, footerTop + 6);
      pdf.line(pageWidth - margin - 34.5, footerTop + 6.3, pageWidth - margin, footerTop + 6.3);

      const generatedByPrefix = "Document generated by ";
      const generatedByUrl = "www.llasa.co.za";
      const generatedByY = pageHeight - 5.5;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.2);
      pdf.setTextColor(63, 63, 70);
      const generatedByPrefixWidth = pdf.getTextWidth(generatedByPrefix);
      const generatedByUrlWidth = pdf.getTextWidth(generatedByUrl);
      const generatedByStartX = (pageWidth - (generatedByPrefixWidth + generatedByUrlWidth)) / 2;
      const generatedByUrlX = generatedByStartX + generatedByPrefixWidth;
      pdf.text(generatedByPrefix, generatedByStartX, generatedByY);
      pdf.setTextColor(62, 202, 68);
      pdf.text(generatedByUrl, generatedByUrlX, generatedByY);
      pdf.setDrawColor(62, 202, 68);
      pdf.setLineWidth(0.15);
      pdf.line(generatedByUrlX, generatedByY + 0.35, generatedByUrlX + generatedByUrlWidth, generatedByY + 0.35);
    };

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.setTextColor(0, 0, 0);
    pdf.text("EMPLOYMENT CONTRACT", pageWidth / 2, y, { align: "center" });
    y += 7;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    pdf.setTextColor(71, 85, 105);
    pdf.text("Information Sheet", pageWidth / 2, y, { align: "center" });
    y += 12;

    drawSectionHeader("A. EMPLOYER DETAILS");
    drawLabelValueRow("Company name:", company.companyName || titleLineFallback);
    drawLabelValueRow("Reg. number:", company.registrationNumber || titleLineFallback);
    drawLabelValueRow("Contact:", company.phone || titleLineFallback);
    drawLabelValueRow("Email:", company.email || titleLineFallback);
    drawLabelValueRow("Address:", company.address || titleLineFallback, "full");

    y += isClientTemplateMode ? 1 : 3;
    drawSectionHeader("B. EMPLOYEE DETAILS");
    drawDualLabelValueRow("Surname:", infoSheetEmployeePreview.surname, "Name(s):", infoSheetEmployeePreview.name, isClientTemplateMode
      ? {
          leftField: { fieldName: "template_employee_surname" },
          rightField: { fieldName: "template_employee_name" },
          columnGap: 6,
          leftValuePadding: 0,
          rightValuePadding: 0,
        }
      : undefined);
    drawDualLabelValueRow("ID No.:", infoSheetEmployeePreview.idNumber, "Passport No.:", infoSheetEmployeePreview.passportNumber, isClientTemplateMode
      ? {
          leftField: { fieldName: "template_employee_id_number" },
          rightField: { fieldName: "template_employee_passport_number" },
          columnGap: 6,
          leftValuePadding: 0,
          rightValuePadding: 0,
        }
      : undefined);
    drawDualLabelValueRow("Age:", infoSheetEmployeePreview.age, "Nationality:", infoSheetEmployeePreview.nationality, isClientTemplateMode
      ? {
          leftField: { fieldName: "template_employee_age", maxLength: 3 },
          rightField: {
            fieldName: "template_employee_nationality",
            kind: "dropdown",
            options: templateNationalityOptions,
          },
          columnGap: 6,
          leftValuePadding: 0,
          rightValuePadding: 0,
        }
      : undefined);
    drawDualLabelValueRow("Race:", infoSheetEmployeePreview.race, "Gender:", infoSheetEmployeePreview.gender, isClientTemplateMode
      ? {
          leftField: {
            fieldName: "template_employee_race",
            kind: "dropdown",
            options: ["African", "Coloured", "Indian", "White", "Other"],
          },
          rightField: {
            fieldName: "template_employee_gender",
            kind: "dropdown",
            options: ["Male", "Female"],
          },
          columnGap: 6,
          leftValuePadding: 0,
          rightValuePadding: 0,
        }
      : undefined);
    drawDualLabelValueRow("Cell number:", infoSheetEmployeePreview.cellNumber, "Email:", infoSheetEmployeePreview.email, isClientTemplateMode
      ? {
          leftField: { fieldName: "template_employee_cell_number" },
          rightField: { fieldName: "template_employee_email" },
          columnGap: 6,
          leftValuePadding: 0,
          rightValuePadding: 0,
        }
      : undefined);
    drawDualLabelValueRow(
      "Alt. contact:",
      infoSheetEmployeePreview.alternativeContact,
      "Employee No.:",
      infoSheetEmployeePreview.employeeNumber,
      isClientTemplateMode
        ? {
            leftField: { fieldName: "template_employee_alternative_contact" },
            rightField: { fieldName: "template_employee_number" },
            columnGap: 6,
            leftValuePadding: 0,
            rightValuePadding: 0,
          }
        : undefined,
    );
    drawLabelValueRow(
      "Address:",
      infoSheetEmployeePreview.residentialAddress,
      "full",
      28,
      isClientTemplateMode ? { fieldName: "template_employee_residential_address" } : undefined,
    );
    drawLabelValueRow(
      "Postal:",
      infoSheetEmployeePreview.postalAddress,
      "full",
      28,
      isClientTemplateMode ? { fieldName: "template_employee_postal_address" } : undefined,
    );

    y += isClientTemplateMode ? 1 : 3;
    drawSectionHeader("C. EMPLOYMENT DETAILS");
    drawDualLabelValueRow(
      "Type:",
      "Permanent",
      "Start date:",
      infoSheetEmploymentPreview.startDate,
      isClientTemplateMode
        ? {
            rightField: { fieldName: "template_contract_start_date" },
            columnGap: 6,
            leftValuePadding: 0,
            rightValuePadding: 0,
          }
        : undefined,
    );
    drawDualLabelValueRow(
      "Job title:",
      infoSheetEmploymentPreview.jobTitle,
      "Department:",
      infoSheetEmploymentPreview.department,
      isClientTemplateMode
        ? {
            leftField: { fieldName: "template_contract_job_title" },
            rightField: { fieldName: "template_contract_department" },
            columnGap: 6,
            leftValuePadding: 0,
            rightValuePadding: 0,
          }
        : undefined,
    );
    drawDualLabelValueRow(
      "Probation:",
      infoSheetEmploymentPreview.probation,
      "Gross salary:",
      infoSheetEmploymentPreview.grossSalary,
      isClientTemplateMode
        ? {
            leftField: {
              fieldName: "template_contract_probation",
              kind: "dropdown",
              options: Object.entries(probationLabelByValue)
                .filter(([value, label]) => value && label)
                .map(([, label]) => label),
            },
            rightField: { fieldName: "template_contract_gross_salary" },
            columnGap: 6,
            leftValuePadding: 0,
            rightValuePadding: 0,
          }
        : undefined,
    );
    drawDualLabelValueRow(
      "Pay cycle:",
      infoSheetEmploymentPreview.payCycle,
      "Retirement:",
      infoSheetEmploymentPreview.retirement,
      isClientTemplateMode
        ? {
            leftField: {
              fieldName: "template_contract_pay_cycle",
              kind: "dropdown",
              options: ["Daily", "Weekly", "Fortnightly", "Monthly"],
            },
            rightField: {
              fieldName: "template_contract_retirement",
              kind: "dropdown",
              options: ["Age 55", "Age 60", "Age 65", "Age 70"],
            },
            columnGap: 6,
            leftValuePadding: 0,
            rightValuePadding: 0,
          }
        : undefined,
    );
    drawDualLabelValueRow(
      "Reports to:",
      infoSheetEmploymentPreview.reportsTo,
      "Interpreter:",
      infoSheetEmploymentPreview.interpreter,
      isClientTemplateMode
        ? {
            leftField: { fieldName: "template_contract_reports_to" },
            rightField: {
              fieldName: "template_contract_interpreter",
              kind: "dropdown",
              options: ["Yes", "No"],
            },
            columnGap: 6,
            leftValuePadding: 0,
            rightValuePadding: 0,
          }
        : undefined,
    );
    drawLabelValueRow(
      "Workplace:",
      infoSheetEmploymentPreview.workplace,
      "full",
      28,
      isClientTemplateMode ? { fieldName: "template_contract_workplace" } : undefined,
    );

    pushPage();
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.setTextColor(0, 0, 0);
    pdf.text("PERMANENT EMPLOYMENT CONTRACT", pageWidth / 2, y, { align: "center" });
    y += 10;
    drawPartiesBlock();
    drawClauseSectionDivider("Terms and Conditions of Employment");

    let clauseNumber = 1;
    previewClauses.forEach((clause) => {
      drawClauseBlock(clause, clauseNumber);
      clauseNumber += clause.paragraphs.length;
    });
    drawSignatureSection();

    const pageCount = pdf.getNumberOfPages();
    for (let pageIndex = 1; pageIndex <= pageCount; pageIndex += 1) {
      drawFooterAndPageNumber(pageIndex, pageCount);
    }

    const employeeFirstInitial = employee.permEmployeeName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase())
      .find(Boolean);
    const employeeSurname = employee.permEmployeeSurname.trim();
    const documentNameSuffix = employeeFirstInitial && employeeSurname ? ` (${employeeFirstInitial}. ${employeeSurname})` : "";
    const documentName = isClientTemplateMode
      ? "Permanent Contract Template"
      : `Permanent Contract${documentNameSuffix}`;
    const downloadFileName = isClientTemplateMode
      ? "permanent_employment_contract_template.pdf"
      : `permanent_employment_contract${documentNameSuffix}.pdf`;
    const uploadBlob = pdf.output("blob");
    const uploadSafeClientName =
      (company.companyName || "client")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "client";
    const uploadSafeDocumentName =
      documentName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "permanent-contract";
    const uploadFilePath = [
      "permanent-contracts",
      uploadSafeClientName,
      `${Date.now()}-${uploadSafeDocumentName}.pdf`,
    ].join("/");
    let uploadedFileUrl = "";

    const { error: uploadError } = await supabase.storage
      .from(generatedDocumentsBucket)
      .upload(uploadFilePath, uploadBlob, {
        cacheControl: "3600",
        upsert: false,
        contentType: "application/pdf",
      });

    if (uploadError) {
      toast({
        title: "Upload Error",
        description: `Could not save document file: ${uploadError.message}`,
        variant: "destructive",
      });
    } else {
      const { data: publicUrlData } = supabase.storage.from(generatedDocumentsBucket).getPublicUrl(uploadFilePath);
      uploadedFileUrl = String(publicUrlData?.publicUrl ?? "").trim();
    }

    const logResult = await logGeneratedDocument({
      documentLabel: isClientTemplateMode ? "Permanent Contract Template" : "Permanent Contract",
      documentName,
      documentType: "Contract",
      clientName: company.companyName,
      fileUrl: uploadedFileUrl,
      employeeName: isClientTemplateMode ? "Template" : employee.permEmployeeName,
      employeeSurname: isClientTemplateMode ? "" : employee.permEmployeeSurname,
      tradingName: company.tradingName,
      registeredName: company.registeredName,
    });

    if ("error" in logResult) {
      toast({
        title: "Save Error",
        description: `Could not save document row: ${logResult.error}`,
        variant: "destructive",
      });
    } else {
      window.dispatchEvent(new CustomEvent("documents-row-created"));
    }

    pdf.save(downloadFileName);
    onRequestClose?.();
  }

  const openClauseEditor = (clause: PreviewClause) => {
    setEditingClauseId(clause.id);
    setClauseTitleDraft(clause.title);
    setClauseBodyDraft(
      serializeClauseParagraphs(
        getEditableClauseParagraphs({
          clause,
          workingHoursMode: contract.permContractWorkingHoursMode,
        }),
      ),
    );
  };

  const closeClauseEditor = () => {
    setEditingClauseId(null);
    setClauseTitleDraft("");
    setClauseBodyDraft("");
  };

  const saveClauseEdit = (clause: PreviewClause) => {
    const nextTitle = clauseTitleDraft.trim();
    const nextBody = clauseBodyDraft.trim();
    if (!nextTitle) {
      toast({
        title: "Edit clause",
        description: "Clause title cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    if (!nextBody) {
      toast({
        title: "Edit clause",
        description: "Clause body cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    const originalClause =
      [
        ...buildPreviewClauses({
          salarySummary,
          bargainingCouncil: contract.permContractBargainingCouncil,
          workingHoursMode: contract.permContractWorkingHoursMode,
          workingHoursScheduleParagraphs,
        }),
        ...customClauses,
      ].find((item) => item.id === clause.id) ?? clause;
    const originalBody = serializeClauseParagraphs(
      getEditableClauseParagraphs({
        clause: originalClause,
        workingHoursMode: contract.permContractWorkingHoursMode,
      }),
    ).trim();
    const nextParagraphs =
      originalClause.id === makePreviewClauseId("Hours of Work") && contract.permContractWorkingHoursMode === "defined"
        ? mergeHoursOfWorkEditedParagraphs({
            editedParagraphs: normalizeClauseBodyText(nextBody),
            originalClause,
          })
        : normalizeClauseBodyText(nextBody);

    setClauseTitleEdits((current) => {
      const next = { ...current };
      if (nextTitle !== originalClause.title) next[clause.id] = nextTitle;
      else delete next[clause.id];
      return next;
    });
    setClauseBodyEdits((current) => {
      const next = { ...current };
      if (nextBody !== originalBody) next[clause.id] = serializeClauseParagraphs(nextParagraphs);
      else delete next[clause.id];
      return next;
    });

    closeClauseEditor();
  };

  const resetClauseEdit = (clause: PreviewClause) => {
    setClauseTitleEdits((current) => {
      const next = { ...current };
      delete next[clause.id];
      return next;
    });
    setClauseBodyEdits((current) => {
      const next = { ...current };
      delete next[clause.id];
      return next;
    });

    const originalClause = [
      ...buildPreviewClauses({
        salarySummary,
        bargainingCouncil: contract.permContractBargainingCouncil,
        workingHoursMode: contract.permContractWorkingHoursMode,
        workingHoursScheduleParagraphs,
      }),
      ...customClauses,
    ].find((item) => item.id === clause.id);
    if (originalClause) {
      setClauseTitleDraft(originalClause.title);
      setClauseBodyDraft(
        serializeClauseParagraphs(
          getEditableClauseParagraphs({
            clause: originalClause,
            workingHoursMode: contract.permContractWorkingHoursMode,
          }),
        ),
      );
    }
  };

  const openAddClauseForm = (afterId: string | null) => {
    setAddingAfterId(afterId);
    setNewClauseTitle("");
    setNewClauseBody("");
  };

  const closeAddClauseForm = () => {
    setAddingAfterId(undefined);
    setNewClauseTitle("");
    setNewClauseBody("");
  };

  const saveNewClause = () => {
    const title = newClauseTitle.trim();
    const body = newClauseBody.trim();
    if (!title || !body) {
      toast({
        title: "Add clause",
        description: "Please provide both a clause title and body.",
        variant: "destructive",
      });
      return;
    }

    setCustomClauses((current) => [
      ...current,
      {
        id: generateCustomClauseId(),
        title,
        paragraphs: normalizeClauseBodyText(body),
        insertAfterId: addingAfterId ?? null,
      },
    ]);
    closeAddClauseForm();
  };

  const stepOneBody = (
    <div className={cn("h-full py-1", hiddenScrollClassName)}>
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="permContractCompany" className="text-[10px] font-semibold text-slate-600">
              Client Name <span className="text-red-500">*</span>
            </Label>
            <Popover open={companyMenuOpen} onOpenChange={setCompanyMenuOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="permContractCompany"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={companyMenuOpen}
                  className={cn(
                    fieldClassName,
                    "w-full justify-between px-3 text-[11px] hover:bg-white hover:text-slate-900 data-[state=open]:bg-white data-[state=open]:text-slate-900",
                    !company.companyName && "text-[10px] text-slate-400",
                  )}
                >
                  <span className="truncate">{selectedCompanyLabel}</span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="max-h-[380px] w-[var(--radix-popover-trigger-width)] min-w-[420px] overflow-hidden p-0"
                onWheel={(event) => event.stopPropagation()}
              >
                <Command shouldFilter>
                  <CommandInput placeholder="Search registered or trading name..." className="h-8 text-[11px] placeholder:text-[10px]" />
                  <CommandList className="max-h-[320px] overscroll-contain">
                    <CommandEmpty className="px-3 py-4 text-sm text-slate-500">{companyLoadMessage}</CommandEmpty>
                    <CommandGroup>
                      {companies.map((entry) => {
                        const label = buildCompanyName(entry);
                        return (
                          <CommandItem
                            key={entry.id}
                            value={`${label} ${String(entry.registered_name || "").trim()} ${String(entry.trading_as || "").trim()}`}
                            onSelect={() => {
                              handleCompanySelect(entry.id);
                              setCompanyMenuOpen(false);
                            }}
                            className="flex items-center justify-between gap-3 px-3 py-2 text-[10px]"
                          >
                            <p className="min-w-0 truncate text-[10px] font-medium text-slate-900">{label}</p>
                            {company.companyId === entry.id ? <Check className="h-3.5 w-3.5 text-[#2f9f35]" /> : null}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="permContractRegistrationNumber" className="text-[10px] font-semibold text-slate-600">
              Registration Number
            </Label>
            <Input
              id="permContractRegistrationNumber"
              value={company.registrationNumber}
              readOnly
              placeholder="Will populate from selected client"
              className={fieldClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="permContractPhone" className="text-[10px] font-semibold text-slate-600">
              Contact Number
            </Label>
            <Input
              id="permContractPhone"
              value={company.phone}
              readOnly
              placeholder="Will populate from selected client"
              className={fieldClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="permContractEmail" className="text-[10px] font-semibold text-slate-600">
              Client Email
            </Label>
            <Input
              id="permContractEmail"
              value={company.email}
              readOnly
              placeholder="Will populate from selected client"
              className={fieldClassName}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="permContractAddress" className="text-[10px] font-semibold text-slate-600">
            Client Address
          </Label>
          <Input
            id="permContractAddress"
            value={company.address}
            readOnly
            placeholder="Will populate from selected client"
            className={fieldClassName}
          />
        </div>

        {!company.logoUrl ? (
          <div className="space-y-2">
            <Label htmlFor="permContractDocumentMode" className="text-[10px] font-semibold text-slate-600">
              Document Mode
            </Label>
            <Select value={company.documentMode} onValueChange={(value) => updateDocumentMode(value as DocumentMode)}>
              <SelectTrigger id="permContractDocumentMode" className={selectTriggerClassName}>
                <SelectValue placeholder="Select document mode" />
              </SelectTrigger>
              <SelectContent className="text-[10px]">
                {documentModeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-[10px]">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {company.logoUrl ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="max-w-[320px] space-y-2">
              <Label className="text-[10px] font-semibold text-slate-600">Client Logo</Label>
              <div className="flex min-h-[132px] items-center justify-center rounded-sm border border-slate-300 bg-white px-4 py-5">
                <img src={company.logoUrl} alt="Client logo preview" className="max-h-24 max-w-[220px] object-contain" />
              </div>
              <button
                type="button"
                onClick={handleLogoClear}
                className="inline-flex w-fit items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-700 transition hover:border-rose-500 hover:text-rose-600"
              >
                <X className="h-3.5 w-3.5" />
                Remove logo
              </button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="permContractDocumentMode" className="text-[10px] font-semibold text-slate-600">
                Document Mode
              </Label>
              <Select value={company.documentMode} onValueChange={(value) => updateDocumentMode(value as DocumentMode)}>
                <SelectTrigger id="permContractDocumentMode" className={selectTriggerClassName}>
                  <SelectValue placeholder="Select document mode" />
                </SelectTrigger>
                <SelectContent className="text-[10px]">
                  {documentModeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-[10px]">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  const stepTwoBody = (
    <div className={cn("h-full py-1", hiddenScrollClassName)}>
      <div className="space-y-4">
        {isClientTemplateMode ? (
          <div className="rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] text-slate-600">
            Employee details can be left blank in Client Template mode. The preview and PDF will render template placeholders instead.
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="permEmployeeName" className="text-[10px] font-semibold text-slate-600">
              Employee Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="permEmployeeName"
              value={employee.permEmployeeName}
              onChange={(event) => updateEmployee("permEmployeeName", event.target.value)}
              placeholder="Enter employee name"
              className={fieldClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="permEmployeeSurname" className="text-[10px] font-semibold text-slate-600">
              Employee Surname <span className="text-red-500">*</span>
            </Label>
            <Input
              id="permEmployeeSurname"
              value={employee.permEmployeeSurname}
              onChange={(event) => updateEmployee("permEmployeeSurname", event.target.value)}
              placeholder="Enter employee surname"
              className={fieldClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="permEmployeeNationality" className="text-[10px] font-semibold text-slate-600">
              Nationality <span className="text-red-500">*</span>
            </Label>
            <Popover open={nationalityMenuOpen} onOpenChange={setNationalityMenuOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="permEmployeeNationality"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={nationalityMenuOpen}
                  className={cn(
                    fieldClassName,
                    "w-full justify-between px-3 text-[11px] hover:bg-white hover:text-slate-900 data-[state=open]:bg-white data-[state=open]:text-slate-900",
                    !employee.permEmployeeNationality && "text-[10px] text-slate-400",
                  )}
                >
                  <span className="truncate">{selectedNationalityLabel}</span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="max-h-[380px] w-[var(--radix-popover-trigger-width)] min-w-[420px] overflow-hidden p-0"
                onWheel={(event) => event.stopPropagation()}
              >
                <Command shouldFilter>
                  <CommandInput placeholder="Search nationalities..." className="h-8 text-[11px] placeholder:text-[10px]" />
                  <CommandList className="max-h-[320px] overscroll-contain">
                    <CommandEmpty className="px-3 py-4 text-sm text-slate-500">No matching nationalities found.</CommandEmpty>
                    <CommandGroup>
                      {nationalityOptions.map((option) => (
                        <CommandItem
                          key={option}
                          value={option}
                          onSelect={() => {
                            updateEmployee("permEmployeeNationality", option);
                            setNationalityMenuOpen(false);
                          }}
                          className="flex items-center justify-between gap-3 px-3 py-2 text-[10px]"
                        >
                          <p className="min-w-0 truncate text-[10px] font-medium text-slate-900">{option}</p>
                          {employee.permEmployeeNationality === option ? <Check className="h-3.5 w-3.5 text-[#2f9f35]" /> : null}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="permEmployeeIdentityNumber" className="text-[10px] font-semibold text-slate-600">
              ID Number or Passport Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="permEmployeeIdentityNumber"
              value={employee.permEmployeeIdentityNumber}
              onChange={(event) => handleIdentityNumberChange(event.target.value)}
              placeholder="Enter ID number or passport number"
              className={fieldClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="permEmployeeAge" className="text-[10px] font-semibold text-slate-600">
              Age
            </Label>
            <Input
              id="permEmployeeAge"
              value={employee.permEmployeeAge}
              onChange={(event) => updateEmployee("permEmployeeAge", event.target.value.replace(/\D/g, "").slice(0, 3))}
              placeholder="Auto-calculate or enter age"
              className={fieldClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="permEmployeeNumber" className="text-[10px] font-semibold text-slate-600">
              Employee Number
            </Label>
            <Input
              id="permEmployeeNumber"
              value={employee.permEmployeeNumber}
              onChange={(event) => updateEmployee("permEmployeeNumber", event.target.value)}
              placeholder="Enter employee number"
              className={fieldClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="permEmployeeGender" className="text-[10px] font-semibold text-slate-600">
              Gender
            </Label>
            <Select
              value={employee.permEmployeeGender || undefined}
              onValueChange={(value) => updateEmployee("permEmployeeGender", value as EmployeeStepState["permEmployeeGender"])}
            >
              <SelectTrigger id="permEmployeeGender" className={selectTriggerClassName}>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent className="text-[10px]">
                <SelectItem value="Male" className="text-[10px]">Male</SelectItem>
                <SelectItem value="Female" className="text-[10px]">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="permEmployeeRace" className="text-[10px] font-semibold text-slate-600">
              Race
            </Label>
            <Select
              value={employee.permEmployeeRace || undefined}
              onValueChange={(value) => updateEmployee("permEmployeeRace", value as EmployeeStepState["permEmployeeRace"])}
            >
              <SelectTrigger id="permEmployeeRace" className={selectTriggerClassName}>
                <SelectValue placeholder="Select race" />
              </SelectTrigger>
              <SelectContent className="text-[10px]">
                <SelectItem value="African" className="text-[10px]">African</SelectItem>
                <SelectItem value="Coloured" className="text-[10px]">Coloured</SelectItem>
                <SelectItem value="Indian" className="text-[10px]">Indian</SelectItem>
                <SelectItem value="White" className="text-[10px]">White</SelectItem>
                <SelectItem value="Other" className="text-[10px]">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="permEmployeeCellNumber" className="text-[10px] font-semibold text-slate-600">
              Cell Number
            </Label>
            <Input
              id="permEmployeeCellNumber"
              value={employee.permEmployeeCellNumber}
              onChange={(event) => updateEmployee("permEmployeeCellNumber", event.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="Enter cell number"
              className={fieldClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="permEmployeeEmail" className="text-[10px] font-semibold text-slate-600">
              Email
            </Label>
            <Input
              id="permEmployeeEmail"
              type="email"
              value={employee.permEmployeeEmail}
              onChange={(event) => updateEmployee("permEmployeeEmail", event.target.value)}
              placeholder="Enter email"
              className={fieldClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="permEmployeeAlternativeContact" className="text-[10px] font-semibold text-slate-600">
              Alternative Contact
            </Label>
            <Input
              id="permEmployeeAlternativeContact"
              value={employee.permEmployeeAlternativeContact}
              onChange={(event) =>
                updateEmployee("permEmployeeAlternativeContact", event.target.value.replace(/\D/g, "").slice(0, 10))
              }
              placeholder="Enter alternative contact"
              className={fieldClassName}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="permEmployeeResidentialAddress" className="text-[10px] font-semibold text-slate-600">
            Residential Address <span className="text-red-500">*</span>
          </Label>
          <Input
            id="permEmployeeResidentialAddress"
            value={employee.permEmployeeResidentialAddress}
            onChange={(event) => updateEmployee("permEmployeeResidentialAddress", event.target.value)}
            placeholder="Enter residential address"
            className={fieldClassName}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Label htmlFor="permEmployeePostalAddress" className="text-[10px] font-semibold text-slate-600">
              Postal Address
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => updateEmployee("permEmployeePostalAddress", employee.permEmployeeResidentialAddress)}
              className="h-6 rounded-[5px] px-2 text-[10px] text-slate-400 hover:border-[#3eca44] hover:bg-transparent hover:text-[#2f9f35]"
            >
              Copy from Residential
            </Button>
          </div>
          <Input
            id="permEmployeePostalAddress"
            value={employee.permEmployeePostalAddress}
            onChange={(event) => updateEmployee("permEmployeePostalAddress", event.target.value)}
            placeholder="Enter postal address"
            className={fieldClassName}
          />
        </div>
      </div>
    </div>
  );

  const stepThreeBody = (
    <div className={cn("h-full py-1", hiddenScrollClassName)}>
      <div className="space-y-4">
        {isClientTemplateMode ? (
          <div className="rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] text-slate-600">
            Keep completing drafting fields such as bargaining council and general contract settings. Employee-specific values may be left blank in Client Template mode.
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="permContractStartDate" className="text-[10px] font-semibold text-slate-600">
              Start Date <span className="text-red-500">*</span>
            </Label>
            <div className="flex items-start gap-2">
              <Input
                id="permContractStartDate"
                type="text"
                readOnly
                value={contract.permContractStartDate ? formatDateForDisplay(contract.permContractStartDate) : ""}
                placeholder="Please select a date"
                onClick={() => openHiddenDatePicker(startDatePickerRef)}
                onFocus={() => openHiddenDatePicker(startDatePickerRef)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openHiddenDatePicker(startDatePickerRef);
                  }
                }}
                className={`${fieldClassName} cursor-pointer placeholder:!font-normal`}
              />
              <input
                ref={startDatePickerRef}
                type="date"
                value={contract.permContractStartDate}
                onChange={(event) => updateContract("permContractStartDate", event.target.value)}
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="permContractJobTitle" className="text-[10px] font-semibold text-slate-600">
              Job Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="permContractJobTitle"
              value={contract.permContractJobTitle}
              onChange={(event) => updateContract("permContractJobTitle", event.target.value)}
              placeholder="Enter job title"
              className={fieldClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="permContractDepartment" className="text-[10px] font-semibold text-slate-600">
              Department
            </Label>
            <Input
              id="permContractDepartment"
              value={contract.permContractDepartment}
              onChange={(event) => updateContract("permContractDepartment", event.target.value)}
              placeholder="Enter department"
              className={fieldClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="permContractBargainingCouncil" className="text-[10px] font-semibold text-slate-600">
              Bargaining Council
            </Label>
            <Popover open={bargainingCouncilMenuOpen} onOpenChange={setBargainingCouncilMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  id="permContractBargainingCouncil"
                  className="inline-flex h-8 w-full items-center justify-between rounded-sm border border-slate-300 bg-white px-3 text-[10px] font-medium text-slate-900 shadow-none hover:border-[#3eca44] focus:outline-none focus-visible:border-[#3eca44] focus-visible:ring-0"
                >
                  <span
                    className={cn(
                      "truncate text-left text-[10px]",
                      contract.permContractBargainingCouncil ? "font-semibold text-slate-900" : "font-normal text-slate-400",
                    )}
                  >
                    {contract.permContractBargainingCouncil || "Select bargaining council"}
                  </span>
                  <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[420px] border border-slate-200 bg-white p-0 shadow-lg" align="start" sideOffset={6}>
                <Command shouldFilter={false} className="max-h-[320px] bg-white text-slate-700">
                  <CommandInput
                    value={bargainingCouncilSearchQuery}
                    onValueChange={setBargainingCouncilSearchQuery}
                    placeholder="Search bargaining council..."
                    className="h-8 border-b border-slate-200 text-[11px] placeholder:text-slate-400"
                  />
                  <div
                    className="max-h-[260px] overflow-y-auto overscroll-contain"
                    onWheel={(event) => event.stopPropagation()}
                  >
                    <CommandList className="max-h-none overflow-visible">
                    <CommandEmpty className="py-3 text-[11px] text-slate-500">No councils found.</CommandEmpty>
                    <CommandGroup>
                      {filteredBargainingCouncilOptions.map((option) => (
                        <CommandItem
                          key={option.value}
                          value={`${option.value} ${option.label}`}
                          onSelect={() => {
                            updateContract("permContractBargainingCouncil", option.value);
                            setBargainingCouncilSearchQuery("");
                            setBargainingCouncilMenuOpen(false);
                          }}
                          className="text-[11px] text-slate-700 data-[selected=true]:bg-[#3eca44]/10 data-[selected=true]:text-[#2f9f35]"
                        >
                          <Check
                            className={`mr-2 h-3.5 w-3.5 shrink-0 ${
                              contract.permContractBargainingCouncil === option.value ? "opacity-100 text-[#2f9f35]" : "opacity-0"
                            }`}
                          />
                          <HoverMarqueeText
                            text={option.label}
                            className={cn("flex-1", contract.permContractBargainingCouncil === option.value ? "font-semibold" : "font-normal")}
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    </CommandList>
                  </div>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="permContractSalaryAmount" className="text-[10px] font-semibold text-slate-600">
              Salary Amount <span className="text-red-500">*</span>
            </Label>
            <Input
              id="permContractSalaryAmount"
              value={
                isSalaryAmountFocused
                  ? formatCurrencyTypingDisplay(contract.permContractSalaryAmount)
                  : formatCurrencyDisplay(contract.permContractSalaryAmount)
              }
              onFocus={() => setIsSalaryAmountFocused(true)}
              onBlur={() => setIsSalaryAmountFocused(false)}
              onChange={(event) => updateContract("permContractSalaryAmount", sanitizeCurrencyInput(event.target.value))}
              inputMode="decimal"
              placeholder="R 0.00"
              className={fieldClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="permContractSalaryType" className="text-[10px] font-semibold text-slate-600">
              Salary Type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={contract.permContractSalaryType || undefined}
              onValueChange={(value) => updateContract("permContractSalaryType", value as ContractStepState["permContractSalaryType"])}
            >
              <SelectTrigger id="permContractSalaryType" className={selectTriggerClassName}>
                <SelectValue placeholder="Select salary type" />
              </SelectTrigger>
              <SelectContent className="text-[10px]">
                <SelectItem value="per_hour" className="text-[10px]">Per hour</SelectItem>
                <SelectItem value="per_day" className="text-[10px]">Per day</SelectItem>
                <SelectItem value="per_week" className="text-[10px]">Per week</SelectItem>
                <SelectItem value="per_fortnight" className="text-[10px]">Per fortnight</SelectItem>
                <SelectItem value="per_month" className="text-[10px]">Per month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="permContractPayCycle" className="text-[10px] font-semibold text-slate-600">
              Pay Cycle <span className="text-red-500">*</span>
            </Label>
            <Select
              value={contract.permContractPayCycle || undefined}
              onValueChange={(value) => updateContract("permContractPayCycle", value as ContractStepState["permContractPayCycle"])}
            >
              <SelectTrigger id="permContractPayCycle" className={selectTriggerClassName}>
                <SelectValue placeholder="Select pay cycle" />
              </SelectTrigger>
              <SelectContent className="text-[10px]">
                <SelectItem value="daily" className="text-[10px]">Daily</SelectItem>
                <SelectItem value="weekly" className="text-[10px]">Weekly</SelectItem>
                <SelectItem value="fortnightly" className="text-[10px]">Fortnightly</SelectItem>
                <SelectItem value="monthly" className="text-[10px]">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="permContractProbation" className="text-[10px] font-semibold text-slate-600">
              Probation <span className="text-red-500">*</span>
            </Label>
            <Select
              value={contract.permContractProbation || undefined}
              onValueChange={(value) => updateContract("permContractProbation", value as ContractStepState["permContractProbation"])}
            >
              <SelectTrigger id="permContractProbation" className={selectTriggerClassName}>
                <SelectValue placeholder="Select probation" />
              </SelectTrigger>
              <SelectContent className="text-[10px]">
                <SelectItem value="none" className="text-[10px]">None</SelectItem>
                <SelectItem value="1_month" className="text-[10px]">1 month</SelectItem>
                <SelectItem value="2_months" className="text-[10px]">2 months</SelectItem>
                <SelectItem value="3_months" className="text-[10px]">3 months</SelectItem>
                <SelectItem value="4_months" className="text-[10px]">4 months</SelectItem>
                <SelectItem value="5_months" className="text-[10px]">5 months</SelectItem>
                <SelectItem value="6_months" className="text-[10px]">6 months</SelectItem>
                <SelectItem value="7_months" className="text-[10px]">7 months</SelectItem>
                <SelectItem value="8_months" className="text-[10px]">8 months</SelectItem>
                <SelectItem value="9_months" className="text-[10px]">9 months</SelectItem>
                <SelectItem value="10_months" className="text-[10px]">10 months</SelectItem>
                <SelectItem value="11_months" className="text-[10px]">11 months</SelectItem>
                <SelectItem value="12_months" className="text-[10px]">12 months</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="permContractReportsTo" className="text-[10px] font-semibold text-slate-600">
              Reports To
            </Label>
            <Input
              id="permContractReportsTo"
              value={contract.permContractReportsTo}
              onChange={(event) => updateContract("permContractReportsTo", event.target.value)}
              placeholder="Enter reporting line"
              className={fieldClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="permContractRetirementAge" className="text-[10px] font-semibold text-slate-600">
              Retirement Age <span className="text-red-500">*</span>
            </Label>
            <Select
              value={contract.permContractRetirementAge || undefined}
              onValueChange={(value) =>
                updateContract("permContractRetirementAge", value as ContractStepState["permContractRetirementAge"])
              }
            >
              <SelectTrigger id="permContractRetirementAge" className={selectTriggerClassName}>
                <SelectValue placeholder="Select retirement age" />
              </SelectTrigger>
              <SelectContent className="text-[10px]">
                <SelectItem value="55" className="text-[10px]">55</SelectItem>
                <SelectItem value="60" className="text-[10px]">60</SelectItem>
                <SelectItem value="65" className="text-[10px]">65</SelectItem>
                <SelectItem value="70" className="text-[10px]">70</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="permContractInterpreterRequired" className="text-[10px] font-semibold text-slate-600">
              Interpreter Required
            </Label>
            <Select
              value={contract.permContractInterpreterRequired || undefined}
              onValueChange={(value) =>
                updateContract("permContractInterpreterRequired", value as ContractStepState["permContractInterpreterRequired"])
              }
            >
              <SelectTrigger id="permContractInterpreterRequired" className={selectTriggerClassName}>
                <SelectValue placeholder="Select option" />
              </SelectTrigger>
              <SelectContent className="text-[10px]">
                <SelectItem value="yes" className="text-[10px]">Yes</SelectItem>
                <SelectItem value="no" className="text-[10px]">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="permContractWorkingHoursMode" className="text-[10px] font-semibold text-slate-600">
              Working Hours
            </Label>
            <Select
              value={contract.permContractWorkingHoursMode || undefined}
              onValueChange={(value) =>
                updateContract("permContractWorkingHoursMode", value as ContractStepState["permContractWorkingHoursMode"])
              }
            >
              <SelectTrigger id="permContractWorkingHoursMode" className={selectTriggerClassName}>
                <SelectValue placeholder="Select working hours mode" />
              </SelectTrigger>
              <SelectContent className="text-[10px]">
                {workingHoursModeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-[10px]">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="permContractWorkplace" className="text-[10px] font-semibold text-slate-600">
              Workplace Address
            </Label>
            <Input
              id="permContractWorkplace"
              value={contract.permContractWorkplace}
              onChange={(event) => updateContract("permContractWorkplace", event.target.value)}
              placeholder="Enter workplace address"
              className={fieldClassName}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const previewBody = (
    <div className={cn("h-full py-1", hiddenScrollClassName)}>
      <div className="mx-auto max-w-[820px] space-y-5">
        <div className="rounded-sm bg-white px-8 pt-6 pb-10 text-black shadow-[0_0_0_1px_rgba(148,163,184,0.16)]">
          <h2 className="text-center text-[20px] font-bold uppercase tracking-tight text-black">EMPLOYMENT CONTRACT</h2>
          <p className="mt-1 text-center text-[14px] font-medium text-slate-700">Information Sheet</p>

          <PreviewSection title="A. EMPLOYER DETAILS">
            <PreviewRow label="Company name:" value={company.companyName || "--"} />
            <PreviewRow label="Reg. number:" value={company.registrationNumber || "--"} />
            <PreviewRow label="Contact:" value={company.phone || "--"} />
            <PreviewRow label="Email:" value={company.email || "--"} />
            <PreviewRow label="Address:" value={company.address || "--"} />
          </PreviewSection>

          <PreviewSection title="B. EMPLOYEE DETAILS">
            <PreviewDualRow
              leftLabel="Surname:"
              leftValue={infoSheetEmployeePreview.surname}
              rightLabel="Name(s):"
              rightValue={infoSheetEmployeePreview.name}
            />
            <PreviewDualRow
              leftLabel="ID No.:"
              leftValue={infoSheetEmployeePreview.idNumber}
              rightLabel="Passport No.:"
              rightValue={infoSheetEmployeePreview.passportNumber}
            />
            <PreviewDualRow
              leftLabel="Age:"
              leftValue={infoSheetEmployeePreview.age}
              rightLabel="Nationality:"
              rightValue={infoSheetEmployeePreview.nationality}
            />
            <PreviewDualRow
              leftLabel="Race:"
              leftValue={infoSheetEmployeePreview.race}
              rightLabel="Gender:"
              rightValue={infoSheetEmployeePreview.gender}
            />
            <PreviewDualRow
              leftLabel="Cell number:"
              leftValue={infoSheetEmployeePreview.cellNumber}
              rightLabel="Email:"
              rightValue={infoSheetEmployeePreview.email}
            />
            <PreviewDualRow
              leftLabel="Alt. contact:"
              leftValue={infoSheetEmployeePreview.alternativeContact}
              rightLabel="Employee No.:"
              rightValue={infoSheetEmployeePreview.employeeNumber}
            />
            <PreviewRow label="Address:" value={infoSheetEmployeePreview.residentialAddress} />
            <PreviewRow label="Postal:" value={infoSheetEmployeePreview.postalAddress} />
          </PreviewSection>

          <PreviewSection title="C. EMPLOYMENT DETAILS">
            <PreviewDualRow leftLabel="Type:" leftValue="Permanent" rightLabel="Start date:" rightValue={infoSheetEmploymentPreview.startDate} />
            <PreviewDualRow
              leftLabel="Job title:"
              leftValue={infoSheetEmploymentPreview.jobTitle}
              rightLabel="Department:"
              rightValue={infoSheetEmploymentPreview.department}
            />
            <PreviewDualRow
              leftLabel="Probation:"
              leftValue={infoSheetEmploymentPreview.probation}
              rightLabel="Gross salary:"
              rightValue={infoSheetEmploymentPreview.grossSalary}
            />
            <PreviewDualRow
              leftLabel="Pay cycle:"
              leftValue={infoSheetEmploymentPreview.payCycle}
              rightLabel="Retirement:"
              rightValue={infoSheetEmploymentPreview.retirement}
            />
            <PreviewDualRow
              leftLabel="Reports to:"
              leftValue={infoSheetEmploymentPreview.reportsTo}
              rightLabel="Interpreter:"
              rightValue={infoSheetEmploymentPreview.interpreter}
            />
            <PreviewRow label="Workplace:" value={infoSheetEmploymentPreview.workplace} />
          </PreviewSection>

        </div>

        <div className="rounded-sm bg-white px-8 pt-6 pb-10 text-black shadow-[0_0_0_1px_rgba(148,163,184,0.16)]">
          <div className="mt-1">
            <h2 className="text-center text-[20px] font-bold uppercase tracking-tight text-black">
              Permanent Employment Contract
            </h2>
          </div>
          <PreviewPartiesBlock
            employerName={employerNameDisplay}
            employerRegistration={company.registrationNumber || "--"}
            employeeName={employeeNameDisplay}
            employeeReference={employeeReferenceDisplay}
          />
          <PreviewClauseDividerTitle title="Terms and Conditions of Employment" />

          {(() => {
            let paragraphNumber = 1;
            return (
              <div className="space-y-6">
                {previewClauses.flatMap((clause, index) => {
                  const currentNumber = paragraphNumber;
                  paragraphNumber += clause.paragraphs.length;
                  const isLastClause = index === previewClauses.length - 1;
                  const isAdded = customClauses.some((item) => item.id === clause.id);
                  const isEdited = Boolean(clauseTitleEdits[clause.id] || clauseBodyEdits[clause.id]);
                  return [
                    <PreviewClauseBlock
                      key={clause.id}
                      clause={clause}
                      paragraphNumberStart={currentNumber}
                      isPreviewEditable={isPreviewEditable}
                      isAdded={isAdded}
                      isEdited={isEdited}
                      workingHoursMode={contract.permContractWorkingHoursMode}
                      workingHoursScheduleRows={workingHoursScheduleRows}
                      onWorkingHoursTimeChange={updateWorkingHoursDay}
                      onEdit={() => openClauseEditor(clause)}
                    />,
                    isPreviewEditable && !isLastClause ? (
                      <AddClauseDivider key={`add-after-${clause.id}`} onClick={() => openAddClauseForm(clause.id)} />
                    ) : null,
                  ];
                })}
                <PreviewSignatureBlock />
              </div>
            );
          })()}
        </div>

        {isPreviewEditable && activeEditingClause ? (
          <div className="fixed inset-0 z-[999]">
            <div className="absolute inset-0 bg-slate-900/35" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
              <div
                role="dialog"
                aria-modal="true"
                aria-label={`Edit clause ${activeEditingClause.title}`}
                className="pointer-events-auto w-[94vw] max-w-[680px] overflow-hidden rounded-sm border-0 bg-[#2D4256] shadow-xl"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <div>
                  <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Pencil className="h-4 w-4 text-white" />
                      <h3 className="text-sm font-semibold text-white">Edit Clause</h3>
                    </div>
                    <button
                      type="button"
                      onClick={closeClauseEditor}
                      className="inline-flex h-7 w-7 items-center justify-center rounded text-white/80 transition hover:bg-white/10 hover:text-white"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-4 bg-white px-4 pb-4 pt-5">
                    <div className="space-y-4">
                      <Input
                        value={clauseTitleDraft}
                        onChange={(event) => setClauseTitleDraft(event.target.value)}
                        placeholder="Clause title"
                        className="h-8 border-slate-300 !text-[11px] font-bold text-black placeholder:!text-[11px] placeholder:font-normal placeholder:text-slate-400 hover:border-slate-500 focus:border-slate-300 focus-visible:border-slate-300 focus:ring-0 focus-visible:ring-0"
                        autoFocus
                      />
                      <p className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Info className="h-3.5 w-3.5" />
                        Separate paragraphs with a blank line. Numbering is updated automatically.
                      </p>
                      <div className="space-y-2">
                        {clauseTitleEdits[activeEditingClause.id] || clauseBodyEdits[activeEditingClause.id] ? (
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => resetClauseEdit(activeEditingClause)}
                              className="h-7 rounded px-2 text-[11px] text-slate-500 hover:bg-white hover:text-[#2f9f35]"
                            >
                              Reset
                            </Button>
                          </div>
                        ) : null}
                        <Textarea
                          value={clauseBodyDraft}
                          onChange={(event) => setClauseBodyDraft(event.target.value)}
                          rows={10}
                          className="min-h-[180px] border-[0.5px] border-slate-300 !text-[11px] text-slate-700 placeholder:!text-[11px] placeholder:text-slate-400 hover:border-slate-500 focus:border-slate-300 focus-visible:border-slate-300 focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 focus-visible:ring-offset-0 focus:outline-none focus-visible:outline-none"
                        />
                      </div>
                      <div className="flex items-center justify-center gap-3 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={closeClauseEditor}
                          className="h-8 w-[92px] rounded border-slate-300 bg-white px-3 text-[11px] text-slate-700 hover:border-[#3eca44] hover:bg-white hover:text-[#2f9f35]"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => saveClauseEdit(activeEditingClause)}
                          className="h-8 w-[92px] rounded bg-[#3eca44] px-3 text-[11px] text-white hover:bg-[#34b73b]"
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {isPreviewEditable && addingAfterId !== undefined ? (
          <div className="fixed inset-0 z-[999]">
            <div className="absolute inset-0 bg-slate-900/35" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Add clause"
                className="pointer-events-auto w-[94vw] max-w-[680px] overflow-hidden rounded-sm border-0 bg-[#2D4256] shadow-xl"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <div>
                  <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4 text-white" />
                      <h3 className="text-sm font-semibold text-white">Add Clause</h3>
                    </div>
                    <button
                      type="button"
                      onClick={closeAddClauseForm}
                      className="inline-flex h-7 w-7 items-center justify-center rounded text-white/80 transition hover:bg-white/10 hover:text-white"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-4 bg-white px-4 pb-4 pt-5">
                    <div className="space-y-4">
                      <Input
                        value={newClauseTitle}
                        onChange={(event) => setNewClauseTitle(event.target.value)}
                        placeholder="Clause title"
                        className="h-8 border-slate-300 !text-[11px] font-bold text-black placeholder:!text-[11px] placeholder:font-normal placeholder:text-slate-400 hover:border-slate-500 focus:border-slate-300 focus-visible:border-slate-300 focus:ring-0 focus-visible:ring-0"
                        autoFocus
                      />
                      <p className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Info className="h-3.5 w-3.5" />
                        Separate paragraphs with a blank line. Numbering is updated automatically.
                      </p>
                      <Textarea
                        value={newClauseBody}
                        onChange={(event) => setNewClauseBody(event.target.value)}
                        rows={8}
                        className="min-h-[180px] border-[0.5px] border-slate-300 !text-[11px] text-slate-700 placeholder:!text-[11px] placeholder:text-slate-400 hover:border-slate-500 focus:border-slate-300 focus-visible:border-slate-300 focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 focus-visible:ring-offset-0 focus:outline-none focus-visible:outline-none"
                        placeholder="Clause body"
                      />
                      <div className="flex items-center justify-center gap-3 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={closeAddClauseForm}
                          className="h-8 w-[92px] rounded border-slate-300 bg-white px-3 text-[11px] text-slate-700 hover:border-[#3eca44] hover:bg-white hover:text-[#2f9f35]"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={saveNewClause}
                          className="h-8 w-[92px] rounded bg-[#3eca44] px-3 text-[11px] text-white hover:bg-[#34b73b]"
                        >
                          Add Clause
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  const body = isFinished ? previewBody : activeStep === 0 ? stepOneBody : activeStep === 1 ? stepTwoBody : stepThreeBody;

  if (embedded) {
    return body;
  }

  return (
    <DashboardLayout profileSubtitleMode="company">
      <div className="mx-auto mt-6 max-w-[1020px] overflow-hidden rounded-sm border border-slate-300 bg-white">
        <TopStepper activeStep={isFinished ? 3 : activeStep} onStepSelect={(index) => stepMeta.onStepSelect?.(index)} canSelectStep={(index) => stepMeta.canSelectStep?.(index) ?? false} />
        <div className="p-4">
          <div className="mx-auto max-w-[900px] rounded-sm border border-slate-300 bg-white px-5 pt-3 pb-4">{body}</div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PermContractGenerator;
