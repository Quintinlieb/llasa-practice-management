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
import { nationalityOptions } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
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

type CompanyStepState = {
  companyId: string;
  companyName: string;
  registeredName: string;
  tradingName: string;
  registrationNumber: string;
  phone: string;
  email: string;
  address: string;
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
  permContractSalaryAmount: string;
  permContractSalaryType: "per_hour" | "per_day" | "per_week" | "per_fortnight" | "per_month" | "";
  permContractPayCycle: "daily" | "weekly" | "fortnightly" | "monthly" | "";
  permContractProbation: "none" | "1_month" | "2_months" | "3_months" | "4_months" | "5_months" | "6_months" | "7_months" | "8_months" | "9_months" | "10_months" | "11_months" | "12_months" | "";
  permContractReportsTo: string;
  permContractRetirementAge: "55" | "60" | "65" | "70" | "";
  permContractWorkplace: string;
  permContractInterpreterRequired: "yes" | "no" | "";
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

const emptyContractState: ContractStepState = {
  permContractStartDate: "",
  permContractJobTitle: "",
  permContractDepartment: "",
  permContractSalaryAmount: "",
  permContractSalaryType: "",
  permContractPayCycle: "",
  permContractProbation: "3_months",
  permContractReportsTo: "",
  permContractRetirementAge: "65",
  permContractWorkplace: "",
  permContractInterpreterRequired: "no",
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

const PreviewRow = ({ label, value }: { label: string; value: string }) => (
  <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2 text-[12px] leading-6 text-slate-900">
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

const buildPreviewClauses = ({
  salarySummary,
}: {
  salarySummary: string;
}): PreviewClause[] => {
  const annualLeaveSummary =
    "The Employee is entitled to annual leave in accordance with the BCEA and the Employer's leave rules applicable to the workplace.";
  const clauses: Array<Omit<PreviewClause, "id">> = [
    {
      title: "Introduction",
      paragraphs: normalizeParagraphs(
        "This employment agreement is entered into between the Employer and the Employee willingly and voluntarily. The Employee confirms that he or she has had an opportunity to read, consider, and discuss the contents of this agreement and understands the terms that follow.",
      ),
    },
    {
      title: "Recordal",
      paragraphs: normalizeParagraphs(
        "The Employer appoints the Employee in a permanent capacity, which the Employee accepts on the terms of this agreement. This agreement records the essential conditions of employment, including duties, remuneration, working hours, leave, and termination, and constitutes the full understanding between the parties, subject to applicable South African labour legislation.",
      ),
    },
    {
      title: "Probation",
      paragraphs: normalizeParagraphs(
        "The Employee is appointed subject to a probationary period commencing on the Start Date, during which the Employer will assess performance, conduct, skills, and suitability for the position. If the required standards are not met, the Employer may act in accordance with labour law.",
      ),
    },
    {
      title: "Performance and Adaptability",
      paragraphs: normalizeParagraphs([
        "The Employee shall diligently perform all duties associated with the position and comply with all reasonable and lawful instructions issued by the Employer or its authorised representatives.",
        "The Employee acknowledges that the Employer may assign additional or alternative duties within the Employee's reasonable skills or capabilities, and refusal to perform such duties may constitute insubordination. Where suitable alternative work is available, the Employee may be required to perform it without loss of remuneration.",
      ]),
    },
    {
      title: "Guarantee",
      paragraphs: normalizeParagraphs(
        "The Employee warrants that all information, documentation, and credentials submitted to the Employer are true and accurate. Any false, fraudulent, or misleading submission may result in disciplinary action, including possible termination.",
      ),
    },
    {
      title: "Remuneration",
      paragraphs: normalizeParagraphs([
        `The Employee shall receive a gross salary of ${salarySummary !== "--" ? salarySummary : "the agreed amount"}, subject to all applicable legislation. Unauthorised or unapproved absence from work shall result in no payment for the period of absence.`,
        "Any future salary increases shall be considered at the Employer's discretion, taking into account performance and the Employer's financial position. No expectation of an increase is created by this clause.",
        "The Employee will be remunerated for public holiday work and any other statutory payment categories in accordance with applicable legislation.",
      ]),
    },
    {
      title: "Deductions",
      paragraphs: normalizeParagraphs(
        "The Employee consents to all lawful and statutory deductions from remuneration, including PAYE, UIF, and any agreed contributions or deductions permitted by law.",
      ),
    },
    {
      title: "Hours of Work",
      paragraphs: normalizeParagraphs(
        "The Employee's ordinary working hours shall not exceed forty-five hours per week, subject to the operational requirements of the Employer and the limits imposed by the BCEA.",
      ),
    },
    {
      title: "Overtime",
      paragraphs: normalizeParagraphs(
        "The Employee may be required to work overtime subject to the BCEA. Overtime will be handled and remunerated in accordance with applicable law, where such entitlement applies.",
      ),
    },
    {
      title: "Retirement",
      paragraphs: normalizeParagraphs(
        "The Employee shall retire at the age recorded on page 1 of this agreement, unless otherwise agreed in writing. If employment continues beyond that age, the Employer may terminate on the basis of retirement in accordance with applicable law.",
      ),
    },
    {
      title: "Exclusivity of Employment",
      paragraphs: normalizeParagraphs(
        "The Employee shall not undertake outside work or business activity without the Employer's prior written consent.",
      ),
    },
    {
      title: "Annual Bonus",
      paragraphs: normalizeParagraphs([
        "Any annual bonus is ex gratia and granted entirely at the Employer's discretion, subject to the Employer's financial position and the Employee's conduct and performance.",
        "No pro-rata bonus shall be payable upon termination of employment unless the Employer agrees otherwise in writing.",
      ]),
    },
    {
      title: "Termination of Employment",
      paragraphs: normalizeParagraphs([
        "Either party may terminate the employment relationship by giving written notice in accordance with the BCEA. The Employer may elect to make payment in lieu of notice where permitted.",
        "The Employer reserves the right to summarily dismiss the Employee for gross misconduct following a fair process and in accordance with the principles of substantive and procedural fairness.",
      ]),
    },
    {
      title: "Annual Leave",
      paragraphs: normalizeParagraphs([
        annualLeaveSummary,
        "The Employee agrees to take annual leave during any annual shutdown period implemented by the Employer, subject to operational requirements and applicable law.",
      ]),
    },
    {
      title: "Sick Leave",
      paragraphs: normalizeParagraphs([
        "The Employee is entitled to sick leave in accordance with the BCEA and must provide a valid medical certificate when required by law or reasonably required by the Employer.",
        "In cases of prolonged or recurring illness, the Employer may initiate a fair incapacity process in accordance with labour legislation.",
        "Medical proof must confirm incapacity for duty for the relevant period and be issued by a properly registered practitioner.",
      ]),
    },
    {
      title: "Parental Leave",
      paragraphs: normalizeParagraphs([
        "Parental, adoptive, commissioning, and related family leave shall be administered in accordance with the BCEA and any amendments to applicable legislation.",
        "The Employee must give the Employer written notice of intended leave dates within the time periods required by law or, where possible, as early as reasonably practicable.",
      ]),
    },
    {
      title: "Family Responsibility Leave",
      paragraphs: normalizeParagraphs([
        "Eligible Employees are entitled to family responsibility leave in accordance with the BCEA.",
        "The Employer may request reasonable proof for leave taken under this clause.",
      ]),
    },
    {
      title: "Absence from Work",
      paragraphs: normalizeParagraphs([
        "The Employee must notify the Employer before the start of the shift if unable to attend work. Where absence is foreseeable, the Employee must apply for leave in advance where reasonably possible.",
        "Unjustified absence may result in disciplinary action. Failure to report for work for an extended period without communication may be treated as abscondment and handled in accordance with fair procedure.",
      ]),
    },
    {
      title: "Protection of Personal Information",
      paragraphs: normalizeParagraphs([
        "The Employee consents to the lawful collection, use, storage, and processing of personal information for purposes related to the employment relationship and compliance obligations.",
        "Where necessary, the Employer may share relevant personal information with lawful service providers, administrators, clients, or platforms that support operational and statutory requirements.",
      ]),
    },
    {
      title: "Rules and Regulations",
      paragraphs: normalizeParagraphs([
        "The Employee agrees to comply with all workplace rules, policies, procedures, and lawful instructions communicated by the Employer.",
        "Failure to disclose misconduct, dishonesty, or material breaches of workplace rules may itself constitute misconduct.",
      ]),
    },
    {
      title: "Industrial Action",
      paragraphs: normalizeParagraphs([
        "The Employee may not participate in unprotected industrial action.",
        "Any participation in industrial action must comply with the Labour Relations Act and applicable legal requirements.",
      ]),
    },
    {
      title: "Health and Fitness",
      paragraphs: normalizeParagraphs([
        "The Employee confirms being medically fit to perform the duties of the position.",
        "Where fitness for duty becomes a concern, the Employer may require a lawful medical assessment at its cost and may follow incapacity procedures where appropriate.",
      ]),
    },
    {
      title: "Change of Status",
      paragraphs: normalizeParagraphs([
        "The Employee must promptly notify the Employer in writing of any change to personal details, contact information, address, immigration status, or other material employment information.",
        "The Employer shall not be liable for consequences arising from the Employee's failure to update these details timeously.",
      ]),
    },
    {
      title: "Domicilium Citandi",
      paragraphs: normalizeParagraphs([
        "The parties choose the physical addresses recorded on page 1 of this agreement as their domicilium citandi et executandi for all purposes relating to this agreement.",
        "Notices may be sent by hand, email, SMS, WhatsApp, post, or registered post where legally permissible, and proof of transmission may serve as proof of dispatch.",
      ]),
    },
    {
      title: "Alcohol and Drug Testing",
      paragraphs: normalizeParagraphs([
        "The Employee agrees to undergo alcohol or drug testing when reasonably required by the Employer and where such testing is conducted lawfully and reasonably.",
        "Unreasonable refusal to undergo a required test may lead to disciplinary consequences.",
      ]),
    },
    {
      title: "Polygraph Testing",
      paragraphs: normalizeParagraphs([
        "The Employee may be required to undergo polygraph testing when reasonably necessary for investigative or security purposes and where lawful to do so.",
        "Refusal to undergo a required test may justify an adverse inference and may constitute misconduct.",
      ]),
    },
    {
      title: "Temporary Lay-Off",
      paragraphs: normalizeParagraphs([
        "The Employer may implement a temporary lay-off where operational circumstances beyond its control require it, subject to fair process and applicable law.",
        "Where reasonably possible, the Employer will give advance notice of the reason and expected duration.",
      ]),
    },
    {
      title: "Proof of Citizenship",
      paragraphs: normalizeParagraphs([
        "The Employee must provide proof of South African citizenship or, where applicable, valid proof of the right to work in South Africa.",
        "It remains the Employee's responsibility to maintain any required permit, visa, or residency document throughout employment.",
      ]),
    },
    {
      title: "Confidentiality",
      paragraphs: normalizeParagraphs(
        "The Employee shall keep confidential information, trade secrets, client data, and business affairs of the Employer strictly confidential and shall not disclose or use such information other than for authorised work purposes.",
      ),
    },
    {
      title: "Entire Agreement and Acknowledgement",
      paragraphs: normalizeParagraphs([
        "This agreement constitutes the entire agreement between the parties. No variation, amendment, or addition shall be valid unless reduced to writing and signed by both parties.",
        "By signing this agreement, the parties confirm that they have read and understood its contents and agree to be bound by its terms.",
        "Any matter not specifically addressed in this agreement shall be governed by the Employer's lawful workplace rules and, where applicable, the BCEA and other South African labour legislation.",
      ]),
    },
  ];

  return clauses.map((clause) => ({
    ...clause,
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
}: {
  clause: PreviewClause;
  paragraphNumberStart: number;
  isPreviewEditable?: boolean;
  isAdded?: boolean;
  isEdited?: boolean;
  onEdit?: () => void;
}) => (
  <section className="space-y-1.5">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#2D4256]">{clause.title.toUpperCase()}</h3>
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
      {clause.paragraphs.map((paragraph, index) => (
        <div key={`${clause.title}-${index}`} className="grid grid-cols-[20px_minmax(0,1fr)] gap-2 text-[12px] leading-6 text-slate-900">
          <span className="font-normal text-slate-500">{paragraphNumberStart + index}.</span>
          <p className="text-justify font-normal text-slate-800">{paragraph}</p>
        </div>
      ))}
    </div>
  </section>
);

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
  <section className="mt-5 border-b border-slate-200 pb-6">
    <p className="text-[11px] text-black">Entered into by and between:</p>

    <div className="mt-4 grid grid-cols-[minmax(0,1fr)_220px] items-start gap-6">
      <div>
        <p className="text-[12px] font-bold uppercase text-black">{employerName}</p>
        <p className="mt-1 text-[11px] text-black">{`Reg. number: ${employerRegistration}`}</p>
      </div>
      <p className="pt-0.5 text-right text-[11px] italic text-black">Hereinafter referred to as "the Employer"</p>
    </div>

    <p className="mt-4 text-[11px] italic text-black">and</p>

    <div className="mt-4 grid grid-cols-[minmax(0,1fr)_220px] items-start gap-6">
      <div>
        <p className="text-[12px] font-bold uppercase text-black">{employeeName}</p>
        <p className="mt-1 text-[11px] text-black">{employeeReference}</p>
      </div>
      <p className="pt-0.5 text-right text-[11px] italic text-black">Hereinafter referred to as "the Employee"</p>
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
      Done and Signed at <span className="inline-block min-w-[180px] border-b border-black align-middle" /> on this{" "}
      <span className="inline-block min-w-[44px] border-b border-black align-middle" /> day of{" "}
      <span className="inline-block min-w-[140px] border-b border-black align-middle" /> 2026.
    </p>

    <div className="space-y-8">
      <h3 className="text-[13px] font-bold uppercase text-black">Signatures</h3>

      {[
        "For the Employer",
        "Employer Witness",
        "Employee",
        "Employee Witness",
      ].map((label) => (
        <div key={label} className="grid grid-cols-[minmax(0,1fr)_160px] gap-10">
          <div>
            <div className="h-5 border-b border-black" />
            <p className="pt-1 text-[11px] text-black">{label}</p>
          </div>
          <div>
            <div className="flex items-end gap-1">
              <span className="text-[11px] text-black">Date:</span>
              <div className="h-5 flex-1 border-b border-black" />
            </div>
          </div>
        </div>
      ))}
    </div>
  </section>
);

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

  const handleCompanySelect = (companyId: string) => {
    const match = companies.find((entry) => entry.id === companyId);
    if (!match) return;
    setIsFinished(false);
    setCompany(mapRecordToState(match));
    void loadLogoForCompany(companyId);
  };

  const handleLogoClear = () => {
    setCompany((current) => ({ ...current, logoUrl: "", logoOrientation: "" }));
  };

  const hasCompany = Boolean(company.companyId);
  const isEmployeeStepComplete =
    employee.permEmployeeName.trim().length > 0 &&
    employee.permEmployeeSurname.trim().length > 0 &&
    employee.permEmployeeNationality.trim().length > 0 &&
    employee.permEmployeeIdentityNumber.trim().length > 0 &&
    employee.permEmployeeResidentialAddress.trim().length > 0;
  const isContractStepComplete =
    contract.permContractStartDate.trim().length > 0 &&
    contract.permContractJobTitle.trim().length > 0 &&
    contract.permContractDepartment.trim().length > 0 &&
    contract.permContractSalaryAmount.trim().length > 0 &&
    contract.permContractPayCycle.trim().length > 0 &&
    contract.permContractProbation.trim().length > 0 &&
    contract.permContractRetirementAge.trim().length > 0;

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
      if (current.permContractWorkplace.trim().length > 0) return current;
      if (!company.address.trim()) return current;
      return {
        ...current,
        permContractWorkplace: company.address,
      };
    });
  }, [company.address]);

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
    const baseClauses = buildPreviewClauses({ salarySummary }).map((clause) => ({
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
  }, [clauseBodyEdits, clauseTitleEdits, customClauses, salarySummary]);
  const interpreterDisplay =
    contract.permContractInterpreterRequired === "yes"
      ? "Yes"
      : contract.permContractInterpreterRequired === "no"
        ? "No"
        : "--";
  const idNumberDisplay = /^\d{13}$/.test(employee.permEmployeeIdentityNumber.replace(/\D/g, ""))
    ? employee.permEmployeeIdentityNumber
    : "--";
  const passportDisplay = idNumberDisplay === "--" ? employee.permEmployeeIdentityNumber || "--" : "--";
  const activeEditingClause = editingClauseId ? previewClauses.find((clause) => clause.id === editingClauseId) ?? null : null;
  const employeeFullNameDisplay = [employee.permEmployeeName, employee.permEmployeeSurname].filter(Boolean).join(" ").trim();
  const employeeReferenceDisplay = idNumberDisplay !== "--" ? `ID no.: ${idNumberDisplay}` : `Passport no.: ${passportDisplay}`;
  const employerNameDisplay = (company.companyName || "--").toUpperCase();
  const employeeNameDisplay = (employeeFullNameDisplay || "--").toUpperCase();

  async function handlePdfDownload() {
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
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
    const titleLineFallback = "____________________";
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
      ensureSpace(11);
      pdf.setDrawColor(...sectionBorder);
      pdf.setFillColor(...sectionFill);
      pdf.roundedRect(margin, y, contentWidth, 8, 0.8, 0.8, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(0, 0, 0);
      pdf.text(label, margin + 4, y + 5.1);
      y += 12;
    };

    const drawLabelValueRow = (label: string, value: string, mode: "single" | "full" = "single") => {
      const safeValue = value || titleLineFallback;
      const labelWidth = 34;
      const valueX = margin + labelWidth;
      const valueWidth = mode === "full" ? contentWidth - labelWidth : contentWidth - labelWidth - 4;
      const lines = pdf.splitTextToSize(safeValue, valueWidth) as string[];
      const lineHeight = 4;
      const rowHeight = Math.max(4.2, lines.length * lineHeight);
      ensureSpace(rowHeight + 1);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text(label, margin, y);
      pdf.setFont("helvetica", "normal");
      lines.forEach((line, index) => {
        pdf.text(String(line), valueX, y + index * lineHeight);
      });
      y += rowHeight + 1;
    };

    const drawDualLabelValueRow = (leftLabel: string, leftValue: string, rightLabel: string, rightValue: string) => {
      const safeLeftValue = leftValue || titleLineFallback;
      const safeRightValue = rightValue || titleLineFallback;
      const columnGap = 8;
      const columnWidth = (contentWidth - columnGap) / 2;
      const leftLabelWidth = 28;
      const rightLabelWidth = 28;
      const leftValueX = margin + leftLabelWidth;
      const rightColumnX = margin + columnWidth + columnGap;
      const rightValueX = rightColumnX + rightLabelWidth;
      const leftValueWidth = columnWidth - leftLabelWidth - 4;
      const rightValueWidth = columnWidth - rightLabelWidth - 4;
      const leftLines = pdf.splitTextToSize(safeLeftValue, leftValueWidth) as string[];
      const rightLines = pdf.splitTextToSize(safeRightValue, rightValueWidth) as string[];
      const lineHeight = 4;
      const rowHeight = Math.max(4.2, Math.max(leftLines.length, rightLines.length) * lineHeight);

      ensureSpace(rowHeight + 1);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text(leftLabel, margin, y);
      pdf.text(rightLabel, rightColumnX, y);

      pdf.setFont("helvetica", "normal");
      leftLines.forEach((line, index) => {
        pdf.text(String(line), leftValueX, y + index * lineHeight);
      });
      rightLines.forEach((line, index) => {
        pdf.text(String(line), rightValueX, y + index * lineHeight);
      });

      y += rowHeight + 1;
    };

    const drawClauseBlock = (clause: PreviewClause, startNumber: number) => {
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
      pdf.setTextColor(31, 41, 55);

      clause.paragraphs.forEach((paragraph, paragraphIndex) => {
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
      });

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
      pdf.text('Hereinafter referred to as "the Employer"', margin + leftColumnWidth + 8, y, { align: "left" });
      y += 4.6;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.7);
      pdf.text(`Reg. number: ${company.registrationNumber || "--"}`, margin, y);
      y += 8.5;

      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(8.7);
      pdf.text("and", margin, y);
      y += 7;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.2);
      pdf.text(employeeNameDisplay, margin, y);
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(8.5);
      pdf.text('Hereinafter referred to as "the Employee"', margin + leftColumnWidth + 8, y, { align: "left" });
      y += 4.6;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.7);
      pdf.text(employeeReferenceDisplay, margin, y);
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
      y += 19.2;
    };

    const drawSignatureSection = () => {
      const signatureLabels = ["For the Employer", "Employer Witness", "Employee", "Employee Witness"];
      ensureSpace(66);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(0, 0, 0);
      pdf.text("Done and Signed at", margin, y);
      pdf.line(margin + 28, y + 0.2, margin + 88, y + 0.2);
      pdf.text("on this", margin + 91, y);
      pdf.line(margin + 105, y + 0.2, margin + 117, y + 0.2);
      pdf.text("day of", margin + 120, y);
      pdf.line(margin + 133, y + 0.2, margin + 173, y + 0.2);
      pdf.text("2026.", margin + 176, y);
      y += 16;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text("SIGNATURES", margin, y);
      y += 10;

      signatureLabels.forEach((label) => {
        ensureSpace(17);
        const lineY = y;
        const leftLineEnd = margin + 62;
        const rightLabelX = pageWidth - margin - 34;
        const rightLineStart = pageWidth - margin - 28;
        const rightLineEnd = pageWidth - margin;

        pdf.setDrawColor(0, 0, 0);
        pdf.line(margin, lineY, leftLineEnd, lineY);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.8);
        pdf.text(label, margin, lineY + 4.4);

        pdf.text("Date:", rightLabelX, lineY);
        pdf.line(rightLineStart, lineY, rightLineEnd, lineY);
        y += 17;
      });
    };

    const drawFooterAndPageNumber = (pageIndex: number, pageCount: number) => {
      pdf.setPage(pageIndex);
      pdf.setDrawColor(203, 213, 225);
      pdf.line(margin, footerTop - 4, pageWidth - margin, footerTop - 4);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(71, 85, 105);
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

    y += 3;
    drawSectionHeader("B. EMPLOYEE DETAILS");
    drawDualLabelValueRow("Surname:", employee.permEmployeeSurname || titleLineFallback, "Name(s):", employee.permEmployeeName || titleLineFallback);
    drawDualLabelValueRow("ID No.:", idNumberDisplay, "Passport No.:", passportDisplay);
    drawDualLabelValueRow("Age:", employee.permEmployeeAge || titleLineFallback, "Nationality:", employee.permEmployeeNationality || titleLineFallback);
    drawDualLabelValueRow("Race:", employee.permEmployeeRace || titleLineFallback, "Gender:", employee.permEmployeeGender || titleLineFallback);
    drawDualLabelValueRow("Cell number:", employee.permEmployeeCellNumber || titleLineFallback, "Email:", employee.permEmployeeEmail || titleLineFallback);
    drawDualLabelValueRow(
      "Alt. contact:",
      employee.permEmployeeAlternativeContact || titleLineFallback,
      "Employee No.:",
      employee.permEmployeeNumber || titleLineFallback,
    );
    drawLabelValueRow("Address:", employee.permEmployeeResidentialAddress || titleLineFallback, "full");
    drawLabelValueRow("Postal:", employee.permEmployeePostalAddress || titleLineFallback, "full");

    y += 3;
    drawSectionHeader("C. EMPLOYMENT DETAILS");
    drawDualLabelValueRow("Type:", "Permanent", "Start date:", startDateDisplay);
    drawDualLabelValueRow("Gross salary:", salarySummary, "Job title:", contract.permContractJobTitle || titleLineFallback);
    drawDualLabelValueRow("Department:", contract.permContractDepartment || titleLineFallback, "Probation:", probationDisplay);
    drawDualLabelValueRow(
      "Pay cycle:",
      payCycleLabelByValue[contract.permContractPayCycle] || titleLineFallback,
      "Retirement:",
      contract.permContractRetirementAge ? `Age ${contract.permContractRetirementAge}` : titleLineFallback,
    );
    drawDualLabelValueRow("Reports to:", contract.permContractReportsTo || titleLineFallback, "Interpreter:", interpreterDisplay);
    drawLabelValueRow("Workplace:", contract.permContractWorkplace || titleLineFallback, "full");

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

    const employeeInitials = employee.permEmployeeName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}.`)
      .join("");
    const employeeSurname = employee.permEmployeeSurname.trim();
    const suffix = employeeInitials && employeeSurname ? ` (${employeeInitials} ${employeeSurname})` : "";
    pdf.save(`permanent_employment_contract${suffix}.pdf`);
  }

  const openClauseEditor = (clause: PreviewClause) => {
    setEditingClauseId(clause.id);
    setClauseTitleDraft(clause.title);
    setClauseBodyDraft(serializeClauseParagraphs(clause.paragraphs));
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

    const originalClause = [...buildPreviewClauses({ salarySummary }), ...customClauses].find((item) => item.id === clause.id) ?? clause;
    const originalBody = serializeClauseParagraphs(originalClause.paragraphs).trim();

    setClauseTitleEdits((current) => {
      const next = { ...current };
      if (nextTitle !== originalClause.title) next[clause.id] = nextTitle;
      else delete next[clause.id];
      return next;
    });
    setClauseBodyEdits((current) => {
      const next = { ...current };
      if (nextBody !== originalBody) next[clause.id] = nextBody;
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

    const originalClause = [...buildPreviewClauses({ salarySummary }), ...customClauses].find((item) => item.id === clause.id);
    if (originalClause) {
      setClauseTitleDraft(originalClause.title);
      setClauseBodyDraft(serializeClauseParagraphs(originalClause.paragraphs));
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

        {company.logoUrl ? (
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
        ) : null}
      </div>
    </div>
  );

  const stepTwoBody = (
    <div className={cn("h-full py-1", hiddenScrollClassName)}>
      <div className="space-y-4">
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
              Department <span className="text-red-500">*</span>
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
              Salary Type
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
              leftValue={employee.permEmployeeSurname || "--"}
              rightLabel="Name(s):"
              rightValue={employee.permEmployeeName || "--"}
            />
            <PreviewDualRow leftLabel="ID No.:" leftValue={idNumberDisplay} rightLabel="Passport No.:" rightValue={passportDisplay} />
            <PreviewDualRow
              leftLabel="Age:"
              leftValue={employee.permEmployeeAge || "--"}
              rightLabel="Nationality:"
              rightValue={employee.permEmployeeNationality || "--"}
            />
            <PreviewDualRow
              leftLabel="Race:"
              leftValue={employee.permEmployeeRace || "--"}
              rightLabel="Gender:"
              rightValue={employee.permEmployeeGender || "--"}
            />
            <PreviewDualRow
              leftLabel="Cell number:"
              leftValue={employee.permEmployeeCellNumber || "--"}
              rightLabel="Email:"
              rightValue={employee.permEmployeeEmail || "--"}
            />
            <PreviewDualRow
              leftLabel="Alt. contact:"
              leftValue={employee.permEmployeeAlternativeContact || "--"}
              rightLabel="Employee No.:"
              rightValue={employee.permEmployeeNumber || "--"}
            />
            <PreviewRow label="Address:" value={employee.permEmployeeResidentialAddress || "--"} />
            <PreviewRow label="Postal:" value={employee.permEmployeePostalAddress || "--"} />
          </PreviewSection>

          <PreviewSection title="C. EMPLOYMENT DETAILS">
            <PreviewDualRow leftLabel="Type:" leftValue="Permanent" rightLabel="Start date:" rightValue={startDateDisplay} />
            <PreviewDualRow
              leftLabel="Probation:"
              leftValue={probationDisplay}
              rightLabel="Job title:"
              rightValue={contract.permContractJobTitle || "--"}
            />
            <PreviewDualRow
              leftLabel="Department:"
              leftValue={contract.permContractDepartment || "--"}
              rightLabel="Gross salary:"
              rightValue={salarySummary}
            />
            <PreviewDualRow
              leftLabel="Pay cycle:"
              leftValue={payCycleLabelByValue[contract.permContractPayCycle] || "--"}
              rightLabel="Retirement:"
              rightValue={contract.permContractRetirementAge ? `Age ${contract.permContractRetirementAge}` : "--"}
            />
            <PreviewDualRow
              leftLabel="Reports to:"
              leftValue={contract.permContractReportsTo || "--"}
              rightLabel="Interpreter:"
              rightValue={interpreterDisplay}
            />
            <PreviewRow label="Workplace:" value={contract.permContractWorkplace || "--"} />
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
