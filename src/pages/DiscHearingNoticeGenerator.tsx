import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type RefObject, type SVGProps } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { logGeneratedDocument } from "@/lib/documentsLog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
import { Building2, CalendarDays, Check, ChevronsUpDown, Clock3, FileText, MapPinned, User2, X } from "lucide-react";

type DiscHearingNoticeGeneratorProps = {
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

const steps = [
  "Client Details",
  "Employee Details",
  "Notice Details",
  "Preview / Download",
] as const;

const stepIcons = [Building2, User2, FileText, Check] as const;

type ClientRow = {
  id: string;
  registered_name: string | null;
  trading_as: string | null;
  company_type: string | null;
  registration_number: string | null;
  client_number: string | null;
  owner_number: string | null;
  primary_number: string | null;
  owner_email: string | null;
  primary_email: string | null;
  physical_address_line1: string | null;
  physical_address_line2: string | null;
  city: string | null;
  province: string | null;
  area_code: string | null;
};

type ClientLogoRecord = {
  storage_path?: string | null;
  logo_path?: string | null;
  logo_url?: string | null;
  company_logo_url?: string | null;
};

type LogoOrientation = "portrait" | "landscape";
type HearingFormat = "in_person" | "virtual";
type VirtualPlatform = "Microsoft Teams" | "Zoom" | "Google Meet" | "Skype";
type OffenceCategory = "Minor" | "Serious" | "Dismissible";

type ConductOffence = {
  name: string;
  category: OffenceCategory;
  firstOutcome: string;
};

type ClientFormState = {
  clientId: string;
  clientName: string;
  clientRegisteredName: string;
  clientTradingAsName: string;
  registrationNumber: string;
  clientContactNumber: string;
  clientEmail: string;
  clientAddress: string;
  clientAddressLine1: string;
  clientAddressLine2: string;
  clientCity: string;
  clientProvince: string;
  clientAreaCode: string;
  companyLogoDataUrl: string;
  companyLogoOrientation: LogoOrientation | "";
};

type EmployeeFormState = {
  employeeName: string;
  employeeSurname: string;
  employeeIdOrPassportNumber: string;
};

type NoticeFormState = {
  hearingDate: string;
  hearingTime: string;
  hearingFormat: HearingFormat | "";
  hearingLocation: string;
  hearingPlatform: VirtualPlatform | "";
  misconductTypes: string[];
  misconductDescriptions: Record<string, string>;
};

type DiscHearingNoticeDraftState = {
  activeStep: number;
  isFinished: boolean;
  clientForm: ClientFormState;
  employeeForm: EmployeeFormState;
  noticeForm: NoticeFormState;
};

const emptyClientFormState: ClientFormState = {
  clientId: "",
  clientName: "",
  clientRegisteredName: "",
  clientTradingAsName: "",
  registrationNumber: "",
  clientContactNumber: "",
  clientEmail: "",
  clientAddress: "",
  clientAddressLine1: "",
  clientAddressLine2: "",
  clientCity: "",
  clientProvince: "",
  clientAreaCode: "",
  companyLogoDataUrl: "",
  companyLogoOrientation: "",
};

const emptyEmployeeFormState: EmployeeFormState = {
  employeeName: "",
  employeeSurname: "",
  employeeIdOrPassportNumber: "",
};

const emptyNoticeFormState: NoticeFormState = {
  hearingDate: "",
  hearingTime: "",
  hearingFormat: "in_person",
  hearingLocation: "",
  hearingPlatform: "",
  misconductTypes: [],
  misconductDescriptions: {},
};

const inputClassName =
  "h-8 rounded-sm border-slate-300 bg-white !text-[10px] md:!text-[10px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] md:placeholder:!text-[10px] placeholder:font-normal placeholder:text-slate-400 hover:border-[#3eca44] focus-visible:border-[#3eca44] focus-visible:ring-0";

const employeeIdOrPassportMaxLength = 13;
const generatedDocumentsBucket = "documents";
const clientLogosBucket = "client-logos";

const hearingFormatOptions: Array<{ value: HearingFormat; label: string }> = [
  { value: "in_person", label: "In person" },
  { value: "virtual", label: "Virtual" },
];

const virtualPlatformOptions: readonly VirtualPlatform[] = [
  "Microsoft Teams",
  "Zoom",
  "Google Meet",
  "Skype",
] as const;

const hearingHourOptions = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const hearingMinuteOptions = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));

const hearingRights = [
  "The right to be given time to prepare your case.",
  "The right to be given advance warning of the charges.",
  "The right to be represented by a fellow employee / shop steward which must be an employee of the company. It is your responsibility to ensure the availability of your representative at the hearing. No external representation is permitted.",
  "The right to ask questions of any evidence produced or of statements by witnesses.",
  "The right to a fair and proper hearing.",
  "The right to call witnesses. It is your responsibility to ensure the availability of your witness/es at the hearing.",
  "The right to an interpreter. You may request another employee to perform this function.",
  "The right to appeal against any disciplinary action in terms of the company appeal procedures.",
  "Note the importance of attending the hearing. If you do not attend the hearing or remain in attendance until the finalization thereof it will be conducted in your absence. The chairperson will then only have one version to make a decision on. It is your responsibility to inform your employer that you cannot attend with valid reasons. If absence is due to invalid reasons, the hearing will continue in your absence.",
] as const;

const offenceCategoryOrder: OffenceCategory[] = ["Minor", "Serious", "Dismissible"];

const offenceGroupLabel: Record<OffenceCategory, string> = {
  Minor: "Minor Offences",
  Serious: "Serious Offences",
  Dismissible: "Dismissible Offences",
};

const fallbackConductOffences: ConductOffence[] = [
  { name: "Unauthorised Absenteeism", category: "Minor", firstOutcome: "" },
  { name: "Arriving Late For Work", category: "Minor", firstOutcome: "" },
  { name: "Leaving Work Early", category: "Minor", firstOutcome: "" },
  { name: "Failure To Report Absence", category: "Minor", firstOutcome: "" },
  { name: "Failure To Report Late Arrival", category: "Minor", firstOutcome: "" },
  { name: "Failure To Report Leaving Early", category: "Minor", firstOutcome: "" },
  { name: "Sleeping On Duty", category: "Minor", firstOutcome: "" },
  { name: "Failure To Clock In/Out", category: "Minor", firstOutcome: "" },
  { name: "Poor Housekeeping", category: "Minor", firstOutcome: "" },
  { name: "Horseplay", category: "Minor", firstOutcome: "" },
  { name: "Unauthorised Use Of Cell Phone", category: "Minor", firstOutcome: "" },
  { name: "Breach Of Policy Or Procedure", category: "Minor", firstOutcome: "" },
  { name: "Breach Of Rules Or Regulations", category: "Minor", firstOutcome: "" },
  { name: "Failure To Carry Out Instructions", category: "Minor", firstOutcome: "" },
  { name: "Negligence", category: "Serious", firstOutcome: "" },
  { name: "Unauthorised Absenteeism > 5 Days", category: "Serious", firstOutcome: "" },
  { name: "Refusal To Work Overtime", category: "Serious", firstOutcome: "" },
  { name: "Consistent Poor Time Keeping", category: "Serious", firstOutcome: "" },
  { name: "Causing Inharmonious Relationships", category: "Serious", firstOutcome: "" },
  { name: "Unbecoming Behaviour", category: "Serious", firstOutcome: "" },
  { name: "Insolence / Disrespectful Behaviour", category: "Serious", firstOutcome: "" },
  { name: "Aggressive Behaviour", category: "Serious", firstOutcome: "" },
  { name: "Insubordination / Refusing Instructions", category: "Serious", firstOutcome: "" },
  { name: "Refusal To Comply With Policy/Procedure", category: "Serious", firstOutcome: "" },
  { name: "Refusal To Comply With Rule", category: "Serious", firstOutcome: "" },
  { name: "Damage To Company Name", category: "Serious", firstOutcome: "" },
  { name: "Unauthorised Wastage Of Materials", category: "Serious", firstOutcome: "" },
  { name: "Unauthorised Removal", category: "Serious", firstOutcome: "" },
  { name: "Unauthorised Possession", category: "Serious", firstOutcome: "" },
  { name: "Breach Of OHS Standards / Policies", category: "Serious", firstOutcome: "" },
  { name: "Private Work During Working Hours", category: "Serious", firstOutcome: "" },
  { name: "Unauthorised Disclosure Of Information", category: "Serious", firstOutcome: "" },
  { name: "Misappropriation Of Property / Funds", category: "Serious", firstOutcome: "" },
  { name: "Testing Positive For Alcohol", category: "Serious", firstOutcome: "" },
  { name: "Testing Positive For Illegal Drugs", category: "Serious", firstOutcome: "" },
  { name: "Under The Influence Of Alcohol/Drugs", category: "Serious", firstOutcome: "" },
  { name: "Possession Of Alcohol/Drugs On Duty", category: "Serious", firstOutcome: "" },
  { name: "Unauthorised Possession Of Firearm On Duty", category: "Serious", firstOutcome: "" },
  { name: "Intimidation", category: "Serious", firstOutcome: "" },
  { name: "Incitement", category: "Serious", firstOutcome: "" },
  { name: "Illegal Strike / Picketing", category: "Serious", firstOutcome: "" },
  { name: "Viewing Pornographic Material On Duty", category: "Serious", firstOutcome: "" },
  { name: "Unauthorised Access", category: "Serious", firstOutcome: "" },
  { name: "Unauthorised Use Of Company Property", category: "Serious", firstOutcome: "" },
  { name: "Unauthorised Use Of Client Property", category: "Serious", firstOutcome: "" },
  { name: "Abusive Language", category: "Serious", firstOutcome: "" },
  { name: "Dishonesty", category: "Serious", firstOutcome: "" },
  { name: "Gambling On Duty", category: "Serious", firstOutcome: "" },
  { name: "Clocking For Another Employee", category: "Serious", firstOutcome: "" },
  { name: "Theft", category: "Dismissible", firstOutcome: "" },
  { name: "Accomplice To Theft", category: "Dismissible", firstOutcome: "" },
  { name: "Fraud", category: "Dismissible", firstOutcome: "" },
  { name: "Accomplice To Fraud", category: "Dismissible", firstOutcome: "" },
  { name: "Gross Dishonesty", category: "Dismissible", firstOutcome: "" },
  { name: "Gross Negligence", category: "Dismissible", firstOutcome: "" },
  { name: "Assault", category: "Dismissible", firstOutcome: "" },
  { name: "Sexual Harassment", category: "Dismissible", firstOutcome: "" },
  { name: "Viewing Illegal Pornography On Duty", category: "Dismissible", firstOutcome: "" },
  { name: "Racism", category: "Dismissible", firstOutcome: "" },
  { name: "Refusal To Obey OHS Rules/Procedures", category: "Dismissible", firstOutcome: "" },
  { name: "Bribery", category: "Dismissible", firstOutcome: "" },
  { name: "Falsification Of Records", category: "Dismissible", firstOutcome: "" },
  { name: "Intentional Damage To Property", category: "Dismissible", firstOutcome: "" },
  { name: "Gross Insubordination", category: "Dismissible", firstOutcome: "" },
  { name: "Unauthorised Discharge Of Firearm", category: "Dismissible", firstOutcome: "" },
  { name: "Unsafe Use Of Firearm", category: "Dismissible", firstOutcome: "" },
  { name: "Threatening Another Employee/Client", category: "Dismissible", firstOutcome: "" },
  { name: "Unauthorised Possession Of A Weapon On Duty", category: "Dismissible", firstOutcome: "" },
] as const;

type UntypedSupabaseResult = Promise<{ data: unknown; error: { message: string } | null }>;
type UntypedSupabaseQuery = {
  select: (query: string) => UntypedSupabaseQuery;
  order: (column: string, options?: Record<string, unknown>) => UntypedSupabaseResult;
  eq: (column: string, value: unknown) => UntypedSupabaseQuery;
  maybeSingle: () => UntypedSupabaseResult;
  limit: (count: number) => UntypedSupabaseResult;
};

const supabaseUntyped = supabase as unknown as {
  from: (relation: string) => UntypedSupabaseQuery;
};

const companyTypeSuffixByValue: Record<string, string> = {
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

const appendCompanyTypeSuffix = (registeredName: string, companyType: string) => {
  const suffix = companyTypeSuffixByValue[companyType] || "";
  if (!suffix) return registeredName;
  const normalizedName = registeredName.toLowerCase();
  const normalizedSuffix = suffix.toLowerCase();
  if (normalizedName.endsWith(normalizedSuffix)) return registeredName;
  return `${registeredName} ${suffix}`;
};

const formatClientDisplayName = (client: ClientRow) => {
  const registeredName = String(client.registered_name || "").trim();
  const companyType = String(client.company_type || "").trim();
  const tradingName = String(client.trading_as || "").trim();
  const registeredNameWithType = registeredName ? appendCompanyTypeSuffix(registeredName, companyType) : "";
  if (
    registeredNameWithType &&
    tradingName &&
    tradingName.toLowerCase() !== registeredName.toLowerCase() &&
    tradingName.toLowerCase() !== registeredNameWithType.toLowerCase()
  ) {
    return `${registeredNameWithType} t/a ${tradingName}`;
  }
  return registeredNameWithType || tradingName || "Unnamed client";
};

const formatClientAddress = (client: ClientRow) => {
  return [
    String(client.physical_address_line1 || "").trim(),
    String(client.physical_address_line2 || "").trim(),
    String(client.city || "").trim(),
    String(client.province || "").trim(),
    String(client.area_code || "").trim(),
  ]
    .filter(Boolean)
    .join(", ");
};

const mapClientToFormState = (client: ClientRow): ClientFormState => ({
  clientId: client.id,
  clientName: formatClientDisplayName(client),
  clientRegisteredName: String(client.registered_name || "").trim(),
  clientTradingAsName: String(client.trading_as || "").trim(),
  registrationNumber: String(client.registration_number || "").trim(),
  clientContactNumber: String(client.primary_number || client.owner_number || client.client_number || "").trim(),
  clientEmail: String(client.primary_email || client.owner_email || "").trim(),
  clientAddress: formatClientAddress(client),
  clientAddressLine1: String(client.physical_address_line1 || "").trim(),
  clientAddressLine2: String(client.physical_address_line2 || "").trim(),
  clientCity: String(client.city || "").trim(),
  clientProvince: String(client.province || "").trim(),
  clientAreaCode: String(client.area_code || "").trim(),
  companyLogoDataUrl: "",
  companyLogoOrientation: "",
});

const normalizeClientFormState = (value: unknown): ClientFormState => ({
  ...emptyClientFormState,
  ...((value && typeof value === "object" ? value : {}) as Partial<ClientFormState>),
});

const normalizeEmployeeFormState = (value: unknown): EmployeeFormState => ({
  ...emptyEmployeeFormState,
  ...((value && typeof value === "object" ? value : {}) as Partial<EmployeeFormState>),
});

const normalizeNoticeFormState = (value: unknown): NoticeFormState => {
  const candidate = (value && typeof value === "object" ? value : {}) as Partial<NoticeFormState>;
  return {
    ...emptyNoticeFormState,
    ...candidate,
    hearingPlatform:
      typeof candidate.hearingPlatform === "string" ? (candidate.hearingPlatform as VirtualPlatform | "") : "",
    misconductTypes: Array.isArray(candidate.misconductTypes)
      ? candidate.misconductTypes.filter((entry): entry is string => typeof entry === "string")
      : [],
    misconductDescriptions:
      candidate.misconductDescriptions && typeof candidate.misconductDescriptions === "object"
        ? Object.fromEntries(
            Object.entries(candidate.misconductDescriptions).filter(
              (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string",
            ),
          )
        : {},
  };
};

const isDiscHearingNoticeDraftState = (value: unknown): value is DiscHearingNoticeDraftState => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.activeStep === "number" && typeof candidate.isFinished === "boolean";
};

const getClientLogoStoragePathFromUrl = (url?: string | null) => {
  const value = String(url || "").trim();
  if (!value) return "";
  if (!value.startsWith("http")) return value;
  const marker = "/client-logos/";
  const markerIndex = value.indexOf(marker);
  if (markerIndex === -1) return "";
  return decodeURIComponent(value.slice(markerIndex + marker.length));
};

const getClientLogoUrlFromRecord = (record?: ClientLogoRecord | null) => {
  if (!record) return "";
  const storagePath = String(
    record.storage_path ||
      record.logo_path ||
      getClientLogoStoragePathFromUrl(record.logo_url) ||
      getClientLogoStoragePathFromUrl(record.company_logo_url) ||
      "",
  ).trim();
  if (storagePath) {
    const { data } = supabase.storage.from(clientLogosBucket).getPublicUrl(storagePath);
    return String(data?.publicUrl || "").trim();
  }
  return String(record.logo_url || record.company_logo_url || "").trim();
};

const resolveLogoOrientation = (dataUrl: string): Promise<LogoOrientation> =>
  new Promise((resolve) => {
    if (!dataUrl) {
      resolve("landscape");
      return;
    }
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      resolve(height > width ? "portrait" : "landscape");
    };
    image.onerror = () => resolve("landscape");
    image.src = dataUrl;
  });

const formatDateLabel = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parsed);
};

const formatTimeLabel = (value: string) => {
  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number.parseInt(hoursRaw || "", 10);
  const minutes = Number.parseInt(minutesRaw || "", 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;
  const meridiem = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${meridiem}`;
};

const formatHearingVenue = (hearingFormat: HearingFormat | "", hearingLocation: string, hearingPlatform: string) => {
  if (hearingFormat === "virtual") return hearingPlatform.trim();
  return hearingLocation.trim();
};

const buildEmployeeFullName = (employeeForm: EmployeeFormState) =>
  [employeeForm.employeeName, employeeForm.employeeSurname].filter(Boolean).join(" ").trim();

const buildEmployeeDetailRows = (employeeForm: EmployeeFormState, fallback: string) => {
  const rows: Array<[string, string]> = [
    ["Name:", buildEmployeeFullName(employeeForm) || fallback],
    ["ID Number:", employeeForm.employeeIdOrPassportNumber || fallback],
  ];

  return rows;
};

const buildFooterAddressLines = (clientForm: ClientFormState) => {
  const lineOne = [clientForm.clientAddressLine1, clientForm.clientAddressLine2].filter(Boolean).join(", ");
  const lineTwo = [clientForm.clientCity, clientForm.clientProvince, clientForm.clientAreaCode].filter(Boolean).join(", ");
  return [lineOne, lineTwo].filter(Boolean).length > 0
    ? [lineOne, lineTwo].filter(Boolean)
    : (clientForm.clientAddress ? [clientForm.clientAddress] : []);
};

const buildDefaultHearingLocation = (clientForm: ClientFormState) => {
  const companyName = clientForm.clientTradingAsName.trim() || clientForm.clientName.trim();
  return companyName ? `${companyName} (Company Premises)` : "";
};

const formatSelectedClientLabel = (clientForm: ClientFormState) => {
  const clientName = clientForm.clientName.trim();
  const tradingName = clientForm.clientTradingAsName.trim();
  if (!clientName) return "Select client";
  if (!tradingName) return clientName;

  const normalizedClientName = clientName.toLowerCase();
  const normalizedTradingName = tradingName.toLowerCase();
  if (normalizedClientName.includes(`t/a ${normalizedTradingName}`) || normalizedClientName.includes(`(${normalizedTradingName})`)) {
    return clientName;
  }

  return `${clientName} (${tradingName})`;
};

const sanitizeFileSegment = (value: string, fallback: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;

const openHiddenDatePicker = (ref: RefObject<HTMLInputElement | null>) => {
  const input = ref.current;
  if (!input) return;
  if (typeof input.showPicker === "function") {
    input.showPicker();
    return;
  }
  input.focus();
  input.click();
};

const DiscHearingNoticeGeneratorContent = ({
  activeStep,
  isFinished,
  clientRows,
  clientLoadMessage,
  clientSearchOpen,
  setClientSearchOpen,
  hearingDatePickerRef,
  clientForm,
  onClientSelect,
  onClientLogoRemove,
  employeeForm,
  onEmployeeFormChange,
  noticeForm,
  onNoticeFormChange,
  misconductPickerOpen,
  setMisconductPickerOpen,
  conductOffences,
  misconductLoadMessage,
  onToggleMisconductType,
}: {
  activeStep: number;
  isFinished: boolean;
  clientRows: ClientRow[];
  clientLoadMessage: string;
  clientSearchOpen: boolean;
  setClientSearchOpen: (open: boolean) => void;
  hearingDatePickerRef: RefObject<HTMLInputElement | null>;
  clientForm: ClientFormState;
  onClientSelect: (clientId: string) => void;
  onClientLogoRemove: () => void;
  employeeForm: EmployeeFormState;
  onEmployeeFormChange: (field: keyof EmployeeFormState, value: string) => void;
  noticeForm: NoticeFormState;
  onNoticeFormChange: (
    field: keyof NoticeFormState,
    value: string | string[] | Record<string, string>,
  ) => void;
  misconductPickerOpen: boolean;
  setMisconductPickerOpen: (open: boolean) => void;
  conductOffences: ConductOffence[];
  misconductLoadMessage: string;
  onToggleMisconductType: (value: string) => void;
}) => {
  const isClientStep = !isFinished && activeStep === 0;
  const isEmployeeStep = !isFinished && activeStep === 1;
  const isNoticeStep = !isFinished && activeStep === 2;
  const isPreviewStep = isFinished;
  const selectedClientLabel = formatSelectedClientLabel(clientForm);
  const selectedMisconductLabel =
    noticeForm.misconductTypes.length === 0
      ? "Select misconduct type(s)"
      : noticeForm.misconductTypes.length === 1
        ? noticeForm.misconductTypes[0]
        : `${noticeForm.misconductTypes.length} misconduct type(s) selected`;
  const employeeFullName = buildEmployeeFullName(employeeForm) || "______________________________";
  const previewLine = "______________________________";
  const employeeDetailRows = buildEmployeeDetailRows(employeeForm, previewLine);
  const currentYear = new Date().getFullYear();
  const issuedAndSignedLine = `Issued and signed at __________________ on this _____ day of _____________________ ${currentYear}.`;
  const [selectedHour = "", selectedMinute = ""] = noticeForm.hearingTime.split(":");
  const hearingTimeMeridiem = selectedHour ? (Number.parseInt(selectedHour, 10) >= 12 ? "PM" : "AM") : "";

  return (
    <div className="h-full overflow-y-auto py-1">
      <div className={cn("space-y-4", isClientStep || isEmployeeStep ? "pt-0" : "pt-5")}>
        {isClientStep ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="discHearingClientName" className="text-[10px] font-semibold text-slate-600">
                  Client Name <span className="text-red-500">*</span>
                </Label>
                <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="discHearingClientName"
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={clientSearchOpen}
                      className={cn(
                        inputClassName,
                        "w-full justify-between px-3 text-[11px] font-medium hover:bg-white hover:text-slate-900 data-[state=open]:bg-white data-[state=open]:text-slate-900",
                        !clientForm.clientName && "text-[10px] text-slate-400",
                      )}
                    >
                      <span className="truncate">{selectedClientLabel}</span>
                      <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="max-h-[380px] w-[var(--radix-popover-trigger-width)] min-w-[420px] overflow-hidden p-0"
                    onWheel={(event) => event.stopPropagation()}
                  >
                    <Command shouldFilter>
                      <CommandInput
                        placeholder="Search registered or trading name..."
                        className="h-8 text-[11px] placeholder:text-[10px]"
                      />
                      <CommandList className="max-h-[320px] overscroll-contain">
                        <CommandEmpty className="px-3 py-4 text-sm text-slate-500">{clientLoadMessage}</CommandEmpty>
                        <CommandGroup>
                          {clientRows.map((client) => {
                            const label = formatClientDisplayName(client);
                            return (
                              <CommandItem
                                key={client.id}
                                value={`${label} ${String(client.registered_name || "")} ${String(client.trading_as || "")}`}
                                onSelect={() => {
                                  onClientSelect(client.id);
                                  setClientSearchOpen(false);
                                }}
                                className="flex items-center justify-between gap-3 px-3 py-2 text-[10px]"
                              >
                                <p className="min-w-0 truncate text-[10px] font-medium text-slate-900">{label}</p>
                                {clientForm.clientId === client.id ? <Check className="h-3.5 w-3.5 text-[#2f9f35]" /> : null}
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
                <Label htmlFor="discHearingRegistrationNumber" className="text-[10px] font-semibold text-slate-600">
                  Registration Number
                </Label>
                <Input
                  id="discHearingRegistrationNumber"
                  value={clientForm.registrationNumber}
                  readOnly
                  placeholder="Will populate from selected client"
                  className={inputClassName}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discHearingClientContactNumber" className="text-[10px] font-semibold text-slate-600">
                  Contact Number
                </Label>
                <Input
                  id="discHearingClientContactNumber"
                  value={clientForm.clientContactNumber}
                  readOnly
                  placeholder="Will populate from selected client"
                  className={inputClassName}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discHearingClientEmail" className="text-[10px] font-semibold text-slate-600">
                  Client Email
                </Label>
                <Input
                  id="discHearingClientEmail"
                  value={clientForm.clientEmail}
                  readOnly
                  placeholder="Will populate from selected client"
                  className={inputClassName}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discHearingClientAddress" className="text-[10px] font-semibold text-slate-600">
                Client Address
              </Label>
              <Input
                id="discHearingClientAddress"
                value={clientForm.clientAddress}
                readOnly
                placeholder="Will populate from selected client"
                className={inputClassName}
              />
            </div>

            {clientForm.companyLogoDataUrl ? (
              <div className="max-w-[320px] space-y-2">
                <Label className="text-[10px] font-semibold text-slate-600">Client Logo</Label>
                <div className="flex min-h-[132px] items-center justify-center rounded-sm border border-slate-300 bg-white px-4 py-5">
                  <img
                    src={clientForm.companyLogoDataUrl}
                    alt="Client logo preview"
                    className={cn(
                      "h-auto w-auto object-contain",
                      clientForm.companyLogoOrientation === "portrait"
                        ? "max-h-24 max-w-[96px]"
                        : "max-h-16 max-w-[220px]",
                    )}
                  />
                </div>
                <button
                  type="button"
                  onClick={onClientLogoRemove}
                  className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-700 transition hover:border-rose-500 hover:text-rose-600"
                >
                  <X className="h-3.5 w-3.5" />
                  Remove logo
                </button>
              </div>
            ) : null}
          </>
        ) : isEmployeeStep ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="discHearingEmployeeName" className="text-[10px] font-semibold text-slate-600">
                Employee Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="discHearingEmployeeName"
                value={employeeForm.employeeName}
                onChange={(event) => onEmployeeFormChange("employeeName", event.target.value)}
                placeholder="Enter employee name"
                className={inputClassName}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discHearingEmployeeSurname" className="text-[10px] font-semibold text-slate-600">
                Employee Surname <span className="text-red-500">*</span>
              </Label>
              <Input
                id="discHearingEmployeeSurname"
                value={employeeForm.employeeSurname}
                onChange={(event) => onEmployeeFormChange("employeeSurname", event.target.value)}
                placeholder="Enter employee surname"
                className={inputClassName}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discHearingEmployeeId" className="text-[10px] font-semibold text-slate-600">
                Employee ID/Passport Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="discHearingEmployeeId"
                value={employeeForm.employeeIdOrPassportNumber}
                onChange={(event) => onEmployeeFormChange("employeeIdOrPassportNumber", event.target.value)}
                placeholder="Enter employee ID or passport number"
                maxLength={employeeIdOrPassportMaxLength}
                className={inputClassName}
              />
            </div>

          </div>
        ) : isNoticeStep ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="discHearingDate" className="text-[10px] font-semibold text-slate-600">
                  Hearing Date <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-start gap-2">
                  <Input
                    id="discHearingDate"
                    type="text"
                    readOnly
                    value={noticeForm.hearingDate ? formatDateLabel(noticeForm.hearingDate) : ""}
                    placeholder="Please select a date"
                    onClick={() => openHiddenDatePicker(hearingDatePickerRef)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openHiddenDatePicker(hearingDatePickerRef);
                      }
                    }}
                    className={`${inputClassName} cursor-pointer placeholder:!font-normal`}
                  />
                  <input
                    ref={hearingDatePickerRef}
                    type="date"
                    value={noticeForm.hearingDate}
                    onChange={(event) => onNoticeFormChange("hearingDate", event.target.value)}
                    className="sr-only"
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discHearingTime" className="text-[10px] font-semibold text-slate-600">
                  Hearing Time <span className="text-red-500">*</span>
                </Label>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_60px] gap-2">
                  <Select
                    value={selectedHour || undefined}
                    onValueChange={(value) => onNoticeFormChange("hearingTime", `${value}:${selectedMinute || "00"}`)}
                  >
                    <SelectTrigger
                      id="discHearingTime"
                      className={cn(
                        inputClassName,
                        "!h-8 !border-slate-300 !text-[10px] hover:!border-[#3eca44] focus:!border-[#3eca44] focus-visible:!border-[#3eca44] [&>span]:text-[10px] [&>span]:font-medium data-[placeholder]:[&>span]:font-normal data-[placeholder]:[&>span]:text-slate-400",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Clock3 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <SelectValue placeholder="Hour" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="text-[10px]">
                      {hearingHourOptions.map((hour) => (
                        <SelectItem key={hour} value={hour} className="text-[10px]">
                          {hour}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={selectedMinute || undefined}
                    onValueChange={(value) => onNoticeFormChange("hearingTime", `${selectedHour || "00"}:${value}`)}
                  >
                    <SelectTrigger
                      className={cn(
                        inputClassName,
                        "!h-8 !border-slate-300 !text-[10px] hover:!border-[#3eca44] focus:!border-[#3eca44] focus-visible:!border-[#3eca44] [&>span]:text-[10px] [&>span]:font-medium data-[placeholder]:[&>span]:font-normal data-[placeholder]:[&>span]:text-slate-400",
                      )}
                    >
                      <SelectValue placeholder="Min" />
                    </SelectTrigger>
                    <SelectContent className="text-[10px]">
                      {hearingMinuteOptions.map((minute) => (
                        <SelectItem key={minute} value={minute} className="text-[10px]">
                          {minute}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex h-8 items-center justify-center rounded-sm border border-slate-300 bg-slate-50 text-[10px] font-semibold text-slate-600">
                    {hearingTimeMeridiem || "AM/PM"}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discHearingFormat" className="text-[10px] font-semibold text-slate-600">
                  Hearing Format <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={noticeForm.hearingFormat || undefined}
                  onValueChange={(value) => onNoticeFormChange("hearingFormat", value)}
                >
                  <SelectTrigger
                    id="discHearingFormat"
                    className={cn(
                      inputClassName,
                      "!h-8 !border-slate-300 !text-[10px] hover:!border-[#3eca44] focus:!border-[#3eca44] focus-visible:!border-[#3eca44] [&>span]:text-[10px] [&>span]:font-medium data-[placeholder]:[&>span]:font-normal data-[placeholder]:[&>span]:text-slate-400",
                    )}
                  >
                    <SelectValue placeholder="Select hearing format" />
                  </SelectTrigger>
                  <SelectContent className="text-[10px]">
                    {hearingFormatOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-[10px]">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {noticeForm.hearingFormat === "virtual" ? (
                <div className="space-y-2">
                  <Label htmlFor="discHearingPlatform" className="text-[10px] font-semibold text-slate-600">
                    Platform <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={noticeForm.hearingPlatform || undefined}
                    onValueChange={(value) => onNoticeFormChange("hearingPlatform", value)}
                  >
                    <SelectTrigger
                      id="discHearingPlatform"
                      className={cn(
                        inputClassName,
                        "!h-8 !border-slate-300 !text-[10px] hover:!border-[#3eca44] focus:!border-[#3eca44] focus-visible:!border-[#3eca44] [&>span]:text-[10px] [&>span]:font-medium data-[placeholder]:[&>span]:font-normal data-[placeholder]:[&>span]:text-slate-400",
                      )}
                    >
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent className="text-[10px]">
                      {virtualPlatformOptions.map((platform) => (
                        <SelectItem key={platform} value={platform} className="text-[10px]">
                          {platform}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {noticeForm.hearingFormat === "in_person" ? (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="discHearingLocation" className="text-[10px] font-semibold text-slate-600">
                    Hearing Location <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <MapPinned className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      id="discHearingLocation"
                      value={noticeForm.hearingLocation}
                      onChange={(event) => onNoticeFormChange("hearingLocation", event.target.value)}
                      placeholder="Enter venue or boardroom"
                      className={cn(inputClassName, "pl-8")}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="discHearingMisconductTypes" className="text-[10px] font-semibold text-slate-600">
                Misconduct Type(s) <span className="text-red-500">*</span>
              </Label>
              <Popover open={misconductPickerOpen} onOpenChange={setMisconductPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="discHearingMisconductTypes"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={misconductPickerOpen}
                    className={cn(
                      inputClassName,
                      "w-full justify-between px-3 text-[11px] font-medium hover:bg-white hover:text-slate-900 data-[state=open]:bg-white data-[state=open]:text-slate-900",
                      noticeForm.misconductTypes.length === 0 && "text-[10px] text-slate-400",
                    )}
                  >
                    <span className="truncate text-left">{selectedMisconductLabel}</span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="flex max-h-[380px] w-[var(--radix-popover-trigger-width)] min-w-[420px] flex-col overflow-hidden p-0"
                  onWheel={(event) => event.stopPropagation()}
                >
                  <Command shouldFilter>
                    <CommandInput
                      placeholder="Search misconduct types..."
                      className="h-8 text-[11px] placeholder:text-[10px]"
                    />
                    <CommandList className="max-h-[248px] overscroll-contain">
                      <CommandEmpty className="px-3 py-4 text-sm text-slate-500">{misconductLoadMessage}</CommandEmpty>
                      {offenceCategoryOrder.map((category) => {
                        const offences = conductOffences.filter((offence) => offence.category === category);
                        if (offences.length === 0) return null;
                        return (
                          <CommandGroup
                            key={category}
                            heading={offenceGroupLabel[category]}
                            className="px-1 [&_[cmdk-group-heading]]:border-b [&_[cmdk-group-heading]]:border-slate-200 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-slate-900"
                          >
                            {offences.map((offence) => {
                              const isSelected = noticeForm.misconductTypes.includes(offence.name);
                              return (
                                <CommandItem
                                  key={`${category}-${offence.name}`}
                                  value={`${offenceGroupLabel[category]} ${offence.name}`}
                                  onSelect={() => onToggleMisconductType(offence.name)}
                                  className={cn(
                                    "flex items-center justify-between gap-3 px-3 py-2 text-[10px]",
                                    isSelected ? "text-[#2f9f35]" : "text-slate-600",
                                  )}
                                >
                                  <p
                                    className={cn(
                                      "min-w-0 truncate text-[10px] font-medium",
                                      isSelected ? "text-[#2f9f35]" : "text-slate-600",
                                    )}
                                  >
                                    {offence.name}
                                  </p>
                                  {isSelected ? <Check className="h-3.5 w-3.5 text-[#2f9f35]" /> : null}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        );
                      })}
                    </CommandList>
                  </Command>
                  <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-3">
                    {noticeForm.misconductTypes.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {noticeForm.misconductTypes.map((type) => (
                          <div
                            key={type}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[#3eca44] bg-[#3eca44]/10 px-2.5 py-1 text-[10px] font-medium text-[#2f9f35]"
                          >
                            <span className="truncate">{type}</span>
                            <button
                              type="button"
                              aria-label={`Remove ${type}`}
                              onClick={() => onToggleMisconductType(type)}
                              className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[#2f9f35] transition-colors hover:text-[#237a28]"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500">No misconduct types selected.</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              {noticeForm.misconductTypes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {noticeForm.misconductTypes.map((type) => (
                    <div
                      key={type}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#3eca44] bg-[#3eca44]/10 px-2.5 py-1 text-[10px] font-medium text-[#2f9f35]"
                    >
                      <span className="truncate">{type}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${type}`}
                        onClick={() => onToggleMisconductType(type)}
                        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[#2f9f35] transition-colors hover:text-[#237a28]"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {noticeForm.misconductTypes.length > 0 ? (
              <div className="space-y-4">
                {noticeForm.misconductTypes.map((type) => (
                  <div key={type} className="space-y-2">
                    <Label htmlFor={`discHearingDescription-${type}`} className="text-[10px] font-semibold text-slate-600">
                      {type} Description <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id={`discHearingDescription-${type}`}
                      value={noticeForm.misconductDescriptions[type] || ""}
                      onChange={(event) => onNoticeFormChange("misconductDescriptions", {
                        ...noticeForm.misconductDescriptions,
                        [type]: event.target.value,
                      })}
                      onInput={(event) => {
                        const textarea = event.currentTarget;
                        textarea.style.height = "auto";
                        textarea.style.height = `${textarea.scrollHeight}px`;
                      }}
                      placeholder={`Describe the allegation for ${type}`}
                      rows={1}
                      className={`${inputClassName} min-h-[56px] overflow-hidden resize-none py-2`}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : isPreviewStep ? (
          <div className="mx-auto max-w-[860px]">
            <div className="bg-white px-8 pt-4 pb-6 text-black">
              <h2 className="text-center text-[24px] font-bold uppercase tracking-tight text-black">
                Notice of Disciplinary Hearing
              </h2>

              <section className="mt-[32px] overflow-hidden rounded-[4px] border border-[#5f6872]">
                <div className="bg-[#d7dde4] px-4 py-2.5">
                  <p className="text-[16px] font-bold uppercase tracking-wide text-black">A. Employee Details</p>
                </div>
                <div className="grid grid-cols-2 gap-x-10 gap-y-3 px-4 pt-4 pb-1 text-[15px] leading-6 text-black">
                  {employeeDetailRows.map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[112px_minmax(0,1fr)] gap-2">
                      <p className="font-bold">{label}</p>
                      <p>{value}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-[14px] overflow-hidden rounded-[4px] border border-[#5f6872]">
                <div className="bg-[#d7dde4] px-4 py-2.5">
                  <p className="text-[16px] font-bold uppercase tracking-wide text-black">B. Hearing Details</p>
                </div>
                <div className="grid grid-cols-2 gap-x-10 gap-y-3 px-4 pt-4 pb-1 text-[15px] leading-6 text-black">
                  <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-2">
                    <p className="font-bold">Date:</p>
                    <p>{formatDateLabel(noticeForm.hearingDate) || previewLine}</p>
                  </div>
                  <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-2">
                    <p className="font-bold">Time:</p>
                    <p>{formatTimeLabel(noticeForm.hearingTime) || previewLine}</p>
                  </div>
                  <div className="col-span-2 grid grid-cols-[112px_minmax(0,1fr)] gap-2">
                    <p className="font-bold">Place:</p>
                    <p>{formatHearingVenue(noticeForm.hearingFormat, noticeForm.hearingLocation, noticeForm.hearingPlatform) || previewLine}</p>
                  </div>
                </div>
              </section>

              <section className="mt-[14px] overflow-hidden rounded-[4px] border border-[#5f6872]">
                <div className="bg-[#d7dde4] px-4 py-2.5">
                  <p className="text-[16px] font-bold uppercase tracking-wide text-black">C. Transgression(s) / Charge(s)</p>
                </div>
                <div className="space-y-4 px-4 pt-4 pb-1 text-[14px] leading-6 text-black">
                  {noticeForm.misconductTypes.length > 0 ? (
                    noticeForm.misconductTypes.map((type, index) => (
                      <div
                        key={type}
                        className={cn("space-y-1.5", index < noticeForm.misconductTypes.length - 1 && "pb-2")}
                      >
                        <div className="grid grid-cols-[18px_minmax(0,1fr)] gap-2">
                          <p className="font-bold">{`${index + 1}.`}</p>
                          <p className="font-bold">{type}</p>
                        </div>
                        <p
                          className="pl-[26px] whitespace-pre-wrap"
                          style={{ textAlign: "justify", textJustify: "inter-word" }}
                        >
                          {noticeForm.misconductDescriptions[type] || previewLine}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p>{previewLine}</p>
                  )}
                </div>
              </section>

              <section className="mt-[31px] px-2 text-[13px] leading-[1.45] text-black">
                <p className="font-semibold">Please note that your rights at the hearing are as follows:</p>
                <div className="mt-2 space-y-1">
                  {hearingRights.map((item) => (
                    <div key={item} className="grid grid-cols-[12px_minmax(0,1fr)] gap-2">
                      <p className="font-bold">-</p>
                      <p style={{ textAlign: "justify", textJustify: "inter-word" }}>{item}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-10 px-2">
                <div className="flex w-full items-end gap-1 overflow-hidden whitespace-nowrap text-[14px] font-normal text-black">
                  <span>Issued and signed at</span>
                  <span className="inline-block w-[154px] border-b border-black" />
                  <span>on this</span>
                  <span className="inline-block w-[42px] border-b border-black" />
                  <span>day of</span>
                  <span className="inline-block w-[122px] border-b border-black" />
                  <span>{currentYear}.</span>
                </div>
                <div className="mt-12 grid grid-cols-3 gap-x-10 gap-y-14 text-[14px]">
                  {[
                    "Employer/Issuer",
                    "Employee",
                    "Representative (Optional)",
                    "Witness 1",
                    "Witness 2 (Optional)",
                    "Interpreter (Optional)",
                  ].map((label) => (
                    <div key={label}>
                      <div className="border-b border-black" />
                      <p className="mt-2 text-[14px] font-semibold">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex min-h-[56px] items-center rounded-[8px] border border-[#b8c2cc] bg-[#f5f7f9] px-4 py-2 text-[13px] italic leading-5 text-slate-700">
                  <p>
                    If the employee refuses to sign this notice, the witness&apos;s signature will confirm that the
                    employee did receive the notice and that the contents were explained to him/her.
                  </p>
                </div>
              </section>

            </div>
          </div>
        ) : (
          <div className="rounded-sm border border-dashed border-slate-300 bg-slate-50 px-4 py-5">
            <p className="text-sm font-medium text-slate-900">Preview step</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Complete the first three steps to preview the disciplinary hearing notice.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const DiscHearingNoticeGenerator = ({
  embedded = false,
  onRequestClose,
  draftState,
  onDraftStateChange,
  onStepChange,
  onStepMetaChange,
}: DiscHearingNoticeGeneratorProps) => {
  const { user } = useAuth();
  const resolvedDraftState = isDiscHearingNoticeDraftState(draftState) ? draftState : null;
  const [activeStep, setActiveStep] = useState(resolvedDraftState?.activeStep ?? 0);
  const [isFinished, setIsFinished] = useState(resolvedDraftState?.isFinished ?? false);
  const [clientRows, setClientRows] = useState<ClientRow[]>([]);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientLoadMessage, setClientLoadMessage] = useState("No clients found.");
  const hearingDatePickerRef = useRef<HTMLInputElement | null>(null);
  const [clientForm, setClientForm] = useState<ClientFormState>(() =>
    normalizeClientFormState(resolvedDraftState?.clientForm),
  );
  const [employeeForm, setEmployeeForm] = useState<EmployeeFormState>(() =>
    normalizeEmployeeFormState(resolvedDraftState?.employeeForm),
  );
  const [noticeForm, setNoticeForm] = useState<NoticeFormState>(() =>
    normalizeNoticeFormState(resolvedDraftState?.noticeForm),
  );
  const [misconductPickerOpen, setMisconductPickerOpen] = useState(false);
  const [conductOffences, setConductOffences] = useState<ConductOffence[]>([]);
  const [misconductLoadMessage, setMisconductLoadMessage] = useState("No misconduct types found.");

  const currentStepLabel = isFinished ? steps[3] : steps[activeStep];

  useEffect(() => {
    onStepChange?.(currentStepLabel);
  }, [currentStepLabel, onStepChange]);

  useEffect(() => {
    let isMounted = true;

    const loadClients = async () => {
      const { data, error } = await supabaseUntyped
        .from("clients")
        .select(
          "id,registered_name,trading_as,company_type,registration_number,client_number,owner_number,primary_number,owner_email,primary_email,physical_address_line1,physical_address_line2,city,province,area_code",
        )
        .order("registered_name", { ascending: true, nullsFirst: false });

      if (!isMounted) return;

      if (error) {
        setClientRows([]);
        setClientLoadMessage(`Unable to load clients: ${error.message}`);
        return;
      }

      const rows = (((data as unknown) as ClientRow[] | null) ?? []).sort((a, b) =>
        formatClientDisplayName(a).localeCompare(formatClientDisplayName(b), undefined, {
          sensitivity: "base",
        }),
      );

      setClientRows(rows);
      setClientLoadMessage(rows.length > 0 ? "No matching clients found." : "No clients found.");
    };

    void loadClients();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const loadMisconductTypes = async () => {
      const { data, error } = await supabaseUntyped
        .from("company_code_of_conduct")
        .select("data")
        .eq("company_id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        setConductOffences(fallbackConductOffences);
        setMisconductLoadMessage("No matching misconduct types found.");
        return;
      }

      const conductRecord = data as
        | {
            data?: {
              sections?: Array<{
                title?: string;
                offences?: Array<{ name?: string; category?: string; first?: string }>;
              }>;
            };
          }
        | null;
      const sections = conductRecord?.data?.sections ?? [];

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
              (offence.category as OffenceCategory | undefined) ?? sectionCategory ?? "Serious";
            return { name, category, firstOutcome: offence.first ?? "" };
          });
        })
        .filter((item): item is ConductOffence => Boolean(item?.name));

      const deduped = offenceCategoryOrder.flatMap((category) => {
        const seen = new Set<string>();
        return [...mapped, ...fallbackConductOffences].filter((item) => {
          if (item.category !== category) return false;
          const key = item.name.trim().toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });

      setConductOffences(deduped);
      setMisconductLoadMessage(deduped.length > 0 ? "No matching misconduct types found." : "No misconduct types found.");
    };

    void loadMisconductTypes();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const applyClientLogo = useCallback(async (logoUrl: string) => {
    const trimmed = String(logoUrl || "").trim();
    if (!trimmed) {
      setClientForm((current) => ({
        ...current,
        companyLogoDataUrl: "",
        companyLogoOrientation: "",
      }));
      return;
    }
    const orientation = await resolveLogoOrientation(trimmed);
    setClientForm((current) => ({
      ...current,
      companyLogoDataUrl: trimmed,
      companyLogoOrientation: orientation,
    }));
  }, []);

  const loadClientLogo = useCallback(async (clientId: string) => {
    try {
      const { data, error } = await supabaseUntyped.from("client_logos").select("*").eq("client_id", clientId).limit(1);
      if (error) {
        await applyClientLogo("");
        return;
      }
      const record = (Array.isArray(data) ? data[0] : data) as ClientLogoRecord | null;
      await applyClientLogo(getClientLogoUrlFromRecord(record));
    } catch {
      await applyClientLogo("");
    }
  }, [applyClientLogo]);

  const handleClientSelect = (clientId: string) => {
    const selectedClient = clientRows.find((client) => client.id === clientId);
    if (!selectedClient) return;
    const nextClientForm = mapClientToFormState(selectedClient);
    setIsFinished(false);
    setActiveStep(0);
    setClientForm(nextClientForm);
    setEmployeeForm(emptyEmployeeFormState);
    setNoticeForm({
      ...emptyNoticeFormState,
      hearingLocation: buildDefaultHearingLocation(nextClientForm),
    });
    setMisconductPickerOpen(false);
    void loadClientLogo(clientId);
  };

  const handleEmployeeFormChange = (field: keyof EmployeeFormState, value: string) => {
    setEmployeeForm((current) => ({
      ...current,
      [field]: field === "employeeIdOrPassportNumber" ? value.slice(0, employeeIdOrPassportMaxLength) : value,
    }));
  };

  const handleNoticeFormChange = (
    field: keyof NoticeFormState,
    value: string | string[] | Record<string, string>,
  ) => {
    setNoticeForm((current) => {
      if (field === "hearingFormat") {
        const nextFormat = value as HearingFormat | "";
        return {
          ...current,
          hearingFormat: nextFormat,
          hearingPlatform: nextFormat === "virtual" ? current.hearingPlatform : "",
          hearingLocation: nextFormat === "in_person" ? current.hearingLocation || buildDefaultHearingLocation(clientForm) : "",
        };
      }

      if (field === "misconductDescriptions") {
        return {
          ...current,
          misconductDescriptions: value as Record<string, string>,
        };
      }

      return {
        ...current,
        [field]: value,
      };
    });
  };

  const handleToggleMisconductType = (value: string) => {
    setNoticeForm((current) => ({
      ...current,
      misconductTypes: current.misconductTypes.includes(value)
        ? current.misconductTypes.filter((entry) => entry !== value)
        : [...current.misconductTypes, value],
      misconductDescriptions: current.misconductTypes.includes(value)
        ? Object.fromEntries(Object.entries(current.misconductDescriptions).filter(([key]) => key !== value))
        : current.misconductDescriptions,
    }));
  };

  const employeeStepComplete =
    employeeForm.employeeName.trim().length > 0 &&
    employeeForm.employeeSurname.trim().length > 0 &&
    employeeForm.employeeIdOrPassportNumber.trim().length > 0;

  const areMisconductDescriptionsComplete = noticeForm.misconductTypes.every(
    (type) => String(noticeForm.misconductDescriptions[type] || "").trim().length > 0,
  );

  const noticeStepComplete =
    noticeForm.hearingDate.trim().length > 0 &&
    noticeForm.hearingTime.trim().length > 0 &&
    Boolean(noticeForm.hearingFormat) &&
    (noticeForm.hearingFormat === "virtual"
      ? Boolean(noticeForm.hearingPlatform)
      : noticeForm.hearingLocation.trim().length > 0) &&
    noticeForm.misconductTypes.length > 0 &&
    areMisconductDescriptionsComplete;

  const handleDownloadPdf = useCallback(async () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    const hasLogoLayout = Boolean(clientForm.companyLogoDataUrl);
    const footerReserve = hasLogoLayout ? 34 : 18;
    const bottomLimit = pageHeight - footerReserve;
    const sectionBorder = [95, 104, 114] as const;
    const sectionFill = [215, 221, 228] as const;
    const lineFallback = "______________________________";
    const employeeDetailRows = buildEmployeeDetailRows(employeeForm, lineFallback);
    const placeValue = formatHearingVenue(noticeForm.hearingFormat, noticeForm.hearingLocation, noticeForm.hearingPlatform) || lineFallback;
    const footerAddressLines = buildFooterAddressLines(clientForm);
    const currentYear = new Date().getFullYear();
    const issuedAndSignedLine = `Issued and signed at __________________ on this _____ day of _____________________ ${currentYear}.`;
    let y = 13;

    const ensureSpace = (needed: number) => {
      if (y + needed <= bottomLimit) return;
      doc.addPage();
      y = 14;
    };

    const drawJustifiedLines = (
      lines: string[],
      startX: number,
      availableWidth: number,
      lineHeight: number,
    ) => {
      lines.forEach((line, index) => {
        const trimmedLine = String(line).trim();
        const words = trimmedLine.split(/\s+/).filter(Boolean);
        const isLastLine = index === lines.length - 1;

        if (isLastLine || words.length <= 1) {
          doc.text(trimmedLine || String(line), startX, y);
          y += lineHeight;
          return;
        }

        const lineWidth = doc.getTextWidth(trimmedLine);
        const extraSpace = Math.max(0, availableWidth - lineWidth);
        const gapCount = words.length - 1;
        let x = startX;

        words.forEach((word, wordIndex) => {
          doc.text(word, x, y);
          x += doc.getTextWidth(word);
          if (wordIndex < gapCount) {
            x += doc.getTextWidth(" ") + extraSpace / gapCount;
          }
        });

        y += lineHeight;
      });
    };

    const drawFooter = () => {
      if (hasLogoLayout) {
        const footerTop = pageHeight - 30;
        const footerTextX = margin;
        const footerTextWidth = contentWidth - 40;
        const footerLineHeight = 3.4;

        doc.setDrawColor(148, 163, 184);
        doc.line(margin, footerTop - 1.5, pageWidth - margin, footerTop - 1.5);

        if (clientForm.companyLogoDataUrl) {
          try {
            const imageProperties = doc.getImageProperties(clientForm.companyLogoDataUrl);
            const imageRatio = imageProperties.width / imageProperties.height;
            const maxLogoWidth = clientForm.companyLogoOrientation === "portrait" ? 22 : 34;
            const maxLogoHeight = clientForm.companyLogoOrientation === "portrait" ? 18 : 14;
            let logoWidth = maxLogoWidth;
            let logoHeight = logoWidth / imageRatio;

            if (logoHeight > maxLogoHeight) {
              const scale = maxLogoHeight / logoHeight;
              logoHeight = maxLogoHeight;
              logoWidth *= scale;
            }

            const imageSource = clientForm.companyLogoDataUrl.toLowerCase();
            const imageType =
              imageSource.includes(".jpg") || imageSource.includes(".jpeg") || imageSource.includes("image/jpeg")
                ? "JPEG"
                : "PNG";
            const logoX = pageWidth - margin - logoWidth;
            doc.addImage(clientForm.companyLogoDataUrl, imageType, logoX, footerTop, logoWidth, logoHeight);
          } catch {
            // Keep generating even if footer logo rendering fails.
          }
        }

        let footerY = footerTop + 3;
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        const companyNameLines = doc.splitTextToSize(clientForm.clientName || "", footerTextWidth);
        doc.text(companyNameLines, footerTextX, footerY);
        footerY += companyNameLines.length * footerLineHeight;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        if (clientForm.registrationNumber) {
          const registrationLines = doc.splitTextToSize(clientForm.registrationNumber, footerTextWidth);
          doc.text(registrationLines, footerTextX, footerY);
          footerY += registrationLines.length * footerLineHeight;
        }
        if (clientForm.clientContactNumber) {
          doc.text(clientForm.clientContactNumber, footerTextX, footerY);
          footerY += footerLineHeight;
        }
        if (clientForm.clientEmail) {
          const emailLines = doc.splitTextToSize(clientForm.clientEmail, footerTextWidth);
          doc.text(emailLines, footerTextX, footerY);
          footerY += emailLines.length * footerLineHeight;
        }
        footerAddressLines.forEach((line) => {
          const addressLines = doc.splitTextToSize(line, footerTextWidth);
          doc.text(addressLines, footerTextX, footerY);
          footerY += addressLines.length * footerLineHeight;
        });
      }

      const generatedByPrefix = "Document generated by ";
      const generatedByUrl = "www.llasa.co.za";
      const generatedByY = pageHeight - 5.5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.2);
      doc.setTextColor(63, 63, 70);
      const generatedByPrefixWidth = doc.getTextWidth(generatedByPrefix);
      const generatedByUrlWidth = doc.getTextWidth(generatedByUrl);
      const generatedByStartX = (pageWidth - (generatedByPrefixWidth + generatedByUrlWidth)) / 2;
      const generatedByUrlX = generatedByStartX + generatedByPrefixWidth;
      doc.text(generatedByPrefix, generatedByStartX, generatedByY);
      doc.setTextColor(62, 202, 68);
      doc.text(generatedByUrl, generatedByUrlX, generatedByY);
      doc.setDrawColor(62, 202, 68);
      doc.setLineWidth(0.15);
      doc.line(generatedByUrlX, generatedByY + 0.35, generatedByUrlX + generatedByUrlWidth, generatedByY + 0.35);
    };

    const drawSectionBox = (
      title: string,
      drawContent: () => void,
      estimatedHeight: number,
    ) => {
      ensureSpace(estimatedHeight);
      const startY = y;
      const headerHeight = 8;
      y += headerHeight + 6.5;
      drawContent();
      const contentBottom = y;
      doc.setDrawColor(...sectionBorder);
      doc.roundedRect(margin, startY, contentWidth, contentBottom - startY, 1, 1);
      doc.setFillColor(...sectionFill);
      doc.rect(margin, startY, contentWidth, headerHeight, "F");
      doc.setDrawColor(...sectionBorder);
      doc.roundedRect(margin, startY, contentWidth, contentBottom - startY, 1, 1);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text(title, margin + 3, startY + 5.4);
      y = contentBottom + 3.4;
    };

    const drawTwoColumnRow = (
      leftLabel: string,
      leftValue: string,
      rightLabel: string,
      rightValue: string,
    ) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(leftLabel, margin + 3, y);
      doc.text(rightLabel, margin + contentWidth / 2 + 3, y);
      doc.setFont("helvetica", "normal");
      doc.text(leftValue, margin + 28, y);
      doc.text(rightValue, margin + contentWidth / 2 + 28, y);
      y += 5;
    };

    const drawWideValueRow = (label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(label, margin + 3, y);
      doc.setFont("helvetica", "normal");
      const valueLines = doc.splitTextToSize(value, contentWidth - 28);
      doc.text(valueLines, margin + 28, y);
      y += Math.max(5, valueLines.length * 3.6);
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("NOTICE OF DISCIPLINARY HEARING", pageWidth / 2, y, { align: "center" });
    y += 11;

    drawSectionBox("A. EMPLOYEE DETAILS", () => {
      for (let index = 0; index < employeeDetailRows.length; index += 2) {
        const [leftLabel, leftValue] = employeeDetailRows[index];
        const rightRow = employeeDetailRows[index + 1];
        if (rightRow) {
          drawTwoColumnRow(leftLabel, leftValue, rightRow[0], rightRow[1]);
        } else {
          drawWideValueRow(leftLabel, leftValue);
        }
      }
    }, 20 + Math.max(0, employeeDetailRows.length - 2) * 6);

    drawSectionBox("B. HEARING DETAILS", () => {
      drawTwoColumnRow(
        "Date:",
        formatDateLabel(noticeForm.hearingDate) || lineFallback,
        "Time:",
        formatTimeLabel(noticeForm.hearingTime) || lineFallback,
      );
      drawWideValueRow("Place:", placeValue);
    }, 28);

    const misconductHeight =
      18 +
      noticeForm.misconductTypes.reduce((total, type, index) => {
        const description = noticeForm.misconductDescriptions[type] || lineFallback;
        const lines = doc.splitTextToSize(description, contentWidth - 12);
        return total + 8 + lines.length * 4.2 + (index < noticeForm.misconductTypes.length - 1 ? 1.4 : 0);
      }, 0);

    drawSectionBox("C. TRANSGRESSION(S) / CHARGE(S)", () => {
      noticeForm.misconductTypes.forEach((type, index) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(`${index + 1}.`, margin + 3, y);
        doc.text(type, margin + 12, y);
        y += 4.2;

        const description = noticeForm.misconductDescriptions[type] || lineFallback;
        const lines = doc.splitTextToSize(description, contentWidth - 18);
        doc.setFont("helvetica", "normal");
        drawJustifiedLines(lines, margin + 12, contentWidth - 18, 3.5);
        y += index < noticeForm.misconductTypes.length - 1 ? 2.6 : 0.8;
      });
    }, misconductHeight);

    y += 2.2;
    ensureSpace(hearingRights.length * 5 + 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Please note that your rights at the hearing are as follows:", margin + 3, y);
    y += 5;
    hearingRights.forEach((item) => {
      const lines = doc.splitTextToSize(item, contentWidth - 11);
      doc.text("-", margin + 3, y);
      drawJustifiedLines(lines, margin + 7, contentWidth - 11, 3.7);
      y += 0.7;
    });
    if (noticeForm.hearingDate === "__legacy__")
    hearingRights.forEach((item) => {
      const lines = doc.splitTextToSize(item, contentWidth - 10);
      doc.text("•", margin + 3, y);
      doc.text(lines, margin + 8, y);
      y += lines.length * 4.2 + 1.5;
    });

    ensureSpace(46);
    y += 6;
    doc.setFont("helvetica", "normal");
    let issuedLineFontSize = 9;
    doc.setFontSize(issuedLineFontSize);
    const issuedLineParts = {
      prefix: "Issued and signed at",
      middle: "on this",
      dayOf: "day of",
      year: `${currentYear}.`,
    };
    const lineAfterAt = 48;
    const lineAfterThis = 12;
    const lineAfterOf = 50;
    while (
      issuedLineFontSize > 7.5 &&
      doc.getTextWidth(`${issuedLineParts.prefix} ${issuedLineParts.middle} ${issuedLineParts.dayOf} ${issuedLineParts.year}`) +
        lineAfterAt +
        lineAfterThis +
        lineAfterOf >
        contentWidth - 6
    ) {
      issuedLineFontSize -= 0.2;
      doc.setFontSize(issuedLineFontSize);
    }
    let issuedX = margin + 3;
    doc.text(issuedLineParts.prefix, issuedX, y);
    issuedX += doc.getTextWidth(issuedLineParts.prefix) + 1.5;
    doc.setDrawColor(0, 0, 0);
    doc.line(issuedX, y + 0.4, issuedX + lineAfterAt, y + 0.4);
    issuedX += lineAfterAt + 1.8;
    doc.text(issuedLineParts.middle, issuedX, y);
    issuedX += doc.getTextWidth(issuedLineParts.middle) + 1.5;
    doc.line(issuedX, y + 0.4, issuedX + lineAfterThis, y + 0.4);
    issuedX += lineAfterThis + 1.8;
    doc.text(issuedLineParts.dayOf, issuedX, y);
    issuedX += doc.getTextWidth(issuedLineParts.dayOf) + 1.5;
    doc.line(issuedX, y + 0.4, issuedX + lineAfterOf, y + 0.4);
    issuedX += lineAfterOf + 1.8;
    doc.text(issuedLineParts.year, issuedX, y);
    y += 15;

    const signatureLabels = [
      "Employer/Issuer",
      "Employee",
      "Representative (Optional)",
      "Witness 1",
      "Witness 2 (Optional)",
      "Interpreter (Optional)",
    ] as const;

    signatureLabels.forEach((label, index) => {
      if (index % 3 === 0) {
        ensureSpace(17);
      }
      const rowIndex = Math.floor(index / 3);
      const columnIndex = index % 3;
      const columnWidth = contentWidth / 3;
      const startX = margin + 3 + columnIndex * columnWidth;
      const lineY = y + rowIndex * 16;
      doc.setDrawColor(0, 0, 0);
      doc.line(startX, lineY, startX + columnWidth - 10, lineY);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(issuedLineFontSize);
      doc.text(label, startX, lineY + 4.5);
    });
    y += 32 - 4;

    ensureSpace(14);
    doc.setDrawColor(...sectionBorder);
    doc.setFillColor(245, 247, 249);
    doc.roundedRect(margin, y, contentWidth, 10.5, 1, 1, "FD");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const note =
      "If the employee refuses to sign this notice, the witness's signature will confirm that the employee did receive the notice and that the contents were explained to him/her.";
    const noteLines = doc.splitTextToSize(note, contentWidth - 6);
    const noteBlockHeight = Math.max(10.5, noteLines.length * 3.3 + 2.4);
    const noteTextHeight = noteLines.length * 3.3;
    const noteTextY = y + (noteBlockHeight - noteTextHeight) / 2 + 2.3;
    doc.roundedRect(margin, y, contentWidth, noteBlockHeight, 1, 1, "FD");
    doc.text(noteLines, margin + 3, noteTextY);
    drawFooter();

    const employeeInitials = employeeForm.employeeName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}.`)
      .join("");
    const employeeSurname = employeeForm.employeeSurname.trim();
    const documentNameSuffix = employeeInitials && employeeSurname ? ` (${employeeInitials} ${employeeSurname})` : "";
    const documentLabel = "Disciplinary Hearing Notice";
    const documentName = `${documentLabel}${documentNameSuffix}`;
    const downloadFileName = `${sanitizeFileSegment(documentLabel, "disciplinary-hearing-notice")}${documentNameSuffix}.pdf`;
    const uploadFilePath = [
      "disciplinary-hearing-notices",
      sanitizeFileSegment(clientForm.clientName || "client", "client"),
      `${Date.now()}-${sanitizeFileSegment(documentName, "disciplinary-hearing-notice")}.pdf`,
    ].join("/");

    const uploadBlob = doc.output("blob");
    let uploadedFileUrl = "";

    const { error: uploadError } = await supabase.storage.from(generatedDocumentsBucket).upload(uploadFilePath, uploadBlob, {
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

    const userMetadata =
      user?.user_metadata && typeof user.user_metadata === "object"
        ? (user.user_metadata as Record<string, unknown>)
        : {};

    const logResult = await logGeneratedDocument({
      documentLabel,
      documentName,
      documentType: "Notice",
      clientId: clientForm.clientId,
      clientName: clientForm.clientName,
      fileUrl: uploadedFileUrl,
      createdByName: user
        ? `${String(userMetadata.user_name || "").trim()} ${String(userMetadata.user_surname || "").trim()}`.trim()
        : "",
      employeeName: employeeForm.employeeName,
      employeeSurname: employeeForm.employeeSurname,
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

    doc.save(downloadFileName);
    onRequestClose?.();
  }, [clientForm, employeeForm, noticeForm, onRequestClose, user]);

  const stepMeta = useMemo(
    () => ({
      steps,
      activeStep: isFinished ? 3 : activeStep,
      icons: stepIcons,
      canGoNext:
        isFinished ||
        (activeStep === 0
          ? Boolean(clientForm.clientId)
          : activeStep === 1
            ? employeeStepComplete
            : activeStep === 2
              ? noticeStepComplete
              : false),
      canGoBack: isFinished || activeStep > 0,
      canSelectStep: (index: number) => {
        if (index < 0 || index > 3) return false;
        if (isFinished) return true;
        if (activeStep === 0) return index === 0;
        if (activeStep === 1) return index <= 1;
        if (activeStep === 2) return index <= 2;
        return false;
      },
      onNext: () => {
        if (isFinished) {
          void handleDownloadPdf();
          return;
        }
        if (activeStep === 0 && !clientForm.clientId) return;
        if (activeStep === 1 && !employeeStepComplete) return;
        if (activeStep === 2 && !noticeStepComplete) return;
        if (activeStep < 2) {
          setActiveStep((current) => Math.min(current + 1, 2));
          return;
        }
        setIsFinished(true);
      },
      onBack: () => {
        if (isFinished) {
          setIsFinished(false);
          return;
        }
        setActiveStep((current) => Math.max(current - 1, 0));
      },
      onStepSelect: (index: number) => {
        if (index < 0 || index > 3) return;
        if (!isFinished && activeStep === 0 && index !== 0) return;
        if (!isFinished && activeStep === 1 && index > 1) return;
        if (!isFinished && activeStep === 2 && index > 2) return;
        setIsFinished(false);
        setActiveStep(Math.max(0, Math.min(index, 2)));
      },
      onClear: () => {
        setIsFinished(false);
        if (activeStep === 0) {
          setClientForm(emptyClientFormState);
          setClientSearchOpen(false);
          return;
        }
        if (activeStep === 1) {
          setEmployeeForm(emptyEmployeeFormState);
          return;
        }
        if (activeStep === 2) {
          setNoticeForm({
            ...emptyNoticeFormState,
            hearingLocation: buildDefaultHearingLocation(clientForm),
          });
          setMisconductPickerOpen(false);
        }
      },
      isFinished,
      supportsResetAtFirstStep: activeStep === 0 && Boolean(clientForm.clientId),
    }),
    [
      activeStep,
      clientForm.clientId,
      employeeStepComplete,
      handleDownloadPdf,
      isFinished,
      noticeStepComplete,
    ],
  );

  useEffect(() => {
    onStepMetaChange?.(stepMeta);
  }, [onStepMetaChange, stepMeta]);

  useEffect(() => {
    onDraftStateChange?.({
      activeStep,
      isFinished,
      clientForm,
      employeeForm,
      noticeForm,
    } satisfies DiscHearingNoticeDraftState);
  }, [activeStep, clientForm, employeeForm, isFinished, noticeForm, onDraftStateChange]);

  const content = (
    <DiscHearingNoticeGeneratorContent
      activeStep={activeStep}
      isFinished={isFinished}
      clientRows={clientRows}
      clientLoadMessage={clientLoadMessage}
      clientSearchOpen={clientSearchOpen}
      setClientSearchOpen={setClientSearchOpen}
      clientForm={clientForm}
      onClientSelect={handleClientSelect}
      onClientLogoRemove={() =>
        setClientForm((current) => ({
          ...current,
          companyLogoDataUrl: "",
          companyLogoOrientation: "",
        }))
      }
      employeeForm={employeeForm}
      onEmployeeFormChange={handleEmployeeFormChange}
      noticeForm={noticeForm}
      hearingDatePickerRef={hearingDatePickerRef}
      onNoticeFormChange={handleNoticeFormChange}
      misconductPickerOpen={misconductPickerOpen}
      setMisconductPickerOpen={setMisconductPickerOpen}
      conductOffences={conductOffences}
      misconductLoadMessage={misconductLoadMessage}
      onToggleMisconductType={handleToggleMisconductType}
    />
  );

  if (embedded) {
    return content;
  }

  return <DashboardLayout profileSubtitleMode="company">{content}</DashboardLayout>;
};

export default DiscHearingNoticeGenerator;
