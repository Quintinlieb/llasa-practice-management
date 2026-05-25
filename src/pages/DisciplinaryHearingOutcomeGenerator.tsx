import { useEffect, useMemo, useRef, useState, type ComponentType, type KeyboardEvent, type RefObject, type SVGProps, type SyntheticEvent } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { logGeneratedDocument } from "@/lib/documentsLog";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Check, ChevronDown, ChevronsUpDown, FileText, Info, Pencil, Plus, User2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { jsPDF } from "jspdf";

type DisciplinaryHearingOutcomeGeneratorProps = {
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

type ClientRow = {
  id: string;
  registered_name: string | null;
  trading_as: string | null;
  company_type: string | null;
  registration_number: string | null;
  owner_number: string | null;
  primary_number: string | null;
  owner_email: string | null;
  primary_email: string | null;
  physical_address_line1: string | null;
  physical_address_line2: string | null;
  city: string | null;
  province: string | null;
  area_code: string | null;
  bargaining_council: string | null;
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
  clientCity: string;
  clientProvince: string;
};

type EmployeeFormState = {
  employeeName: string;
  employeeSurname: string;
  employeeIdOrPassportNumber: string;
};

type HearingFormat = "in_person" | "virtual";
type EmployeeAttendance = "Absent" | "Present";
type HearingProcess = "Continued" | "Continued in absence" | "Postponed" | "Withdrawn";
type RepresentationOption =
  | "Conduct own defense"
  | "Co-worker"
  | "Shop Steward"
  | "Union Official"
  | "Attorney"
  | "Other";
type InterpreterOption = "Yes" | "No";
type PleaOption = "No plea" | "Guilty" | "Not guilty";
type OffenceCategory = "Minor" | "Serious" | "Dismissible";

type ConductOffence = {
  name: string;
  category: OffenceCategory;
};

type HearingDetailsFormState = {
  noticeDate: string;
  hearingDate: string;
  hearingFormat: HearingFormat | "";
  misconductTypes: string[];
  employeeAttendance: EmployeeAttendance | "";
  hearingProcess: HearingProcess | "";
  bargainingCouncil: string;
  representation: RepresentationOption | "";
  interpreter: InterpreterOption | "";
  pleasByCharge: Record<string, PleaOption | "">;
};

type PreviewFormState = {
  preliminaryOne: string;
  preliminaryTwo: string;
  preliminaryThree: string;
  preliminaryFour: string;
  preliminaryExtra: string;
  issueInDispute: string;
  analysisIntro: string;
  employeeStatement: string;
  employerStatement: string;
  employerEvidence: string;
  employeeEvidence: string;
  analysisFinding: string;
  aggravatingFactors: string;
  mitigatingFactors: string;
  recommendation: string;
};

type EditorTarget = keyof PreviewFormState | "preliminarySection" | "issueSection" | "analysisSection";

type OutcomeDraftState = {
  activeStep: number;
  isFinished: boolean;
  clientForm: ClientFormState;
  employeeForm: EmployeeFormState;
  hearingDetailsForm: HearingDetailsFormState;
  previewForm: PreviewFormState;
  hasRecommendationSection: boolean;
  isPreviewEditable: boolean;
};

const steps = ["Client Details", "Employee Details", "Hearing Details", "Preview"] as const;
const stepIcons = [Building2, User2, FileText, Check] as const;
const employeeIdOrPassportMaxLength = 13;

const inputClassName =
  "h-8 rounded-sm border-slate-300 bg-white !text-[10px] md:!text-[10px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] md:placeholder:!text-[10px] placeholder:font-normal placeholder:text-slate-400 hover:border-[#3eca44] focus-visible:border-[#3eca44] focus-visible:ring-0";
const editablePlaceholderText = "Please start typing here...";
const generatedDocumentsBucket = "documents";

const defaultAnalysisFindingParagraph =
  "Having considered the evidence, the probabilities, and the submissions made during the disciplinary hearing, I am satisfied that the employer followed a fair procedure consistent with the Code of Good Practice: Dismissal contained in Schedule 8 to the Labour Relations Act 66 of 1995. The employee was afforded proper notice of the proceedings, an opportunity to state his/her case, and the matter was dealt with in a procedurally fair manner.";
const defaultIssueInDisputeParagraph =
  "I must determine whether there are sufficient grounds to prove, on a balance of probability, that the alleged misconduct was committed and further that a fair and reasonable procedure has been followed.";

const emptyClientFormState: ClientFormState = {
  clientId: "",
  clientName: "",
  clientRegisteredName: "",
  clientTradingAsName: "",
  registrationNumber: "",
  clientContactNumber: "",
  clientEmail: "",
  clientAddress: "",
  clientCity: "",
  clientProvince: "",
};

const emptyEmployeeFormState: EmployeeFormState = {
  employeeName: "",
  employeeSurname: "",
  employeeIdOrPassportNumber: "",
};

const emptyHearingDetailsFormState: HearingDetailsFormState = {
  noticeDate: "",
  hearingDate: "",
  hearingFormat: "",
  misconductTypes: [],
  employeeAttendance: "",
  hearingProcess: "",
  bargainingCouncil: "None",
  representation: "",
  interpreter: "",
  pleasByCharge: {},
};

const emptyPreviewFormState: PreviewFormState = {
  preliminaryOne: "",
  preliminaryTwo: "",
  preliminaryThree: "",
  preliminaryFour: "",
  preliminaryExtra: "",
  issueInDispute: "",
  analysisIntro: "",
  employeeStatement: "",
  employerStatement: "",
  employerEvidence: "",
  employeeEvidence: "",
  analysisFinding: "",
  aggravatingFactors: "",
  mitigatingFactors: "",
  recommendation: "",
};

const AddSectionDivider = ({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) => (
  <div className="flex justify-center py-1">
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded border border-dashed border-slate-300 px-3 py-1.5 text-[11px] font-medium text-slate-500 transition-colors hover:border-[#3eca44] hover:text-[#2f9f35]"
    >
      <Plus className="h-3.5 w-3.5" />
      {label}
    </button>
  </div>
);

const hearingFormatOptions: Array<{ value: HearingFormat; label: string }> = [
  { value: "in_person", label: "In person" },
  { value: "virtual", label: "Virtual" },
];

const employeeAttendanceOptions: readonly EmployeeAttendance[] = ["Absent", "Present"] as const;
const hearingProcessOptions: readonly HearingProcess[] = ["Continued", "Continued in absence", "Postponed", "Withdrawn"] as const;
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
const representationOptions: readonly RepresentationOption[] = [
  "Conduct own defense",
  "Co-worker",
  "Shop Steward",
  "Union Official",
  "Attorney",
  "Other",
] as const;
const interpreterOptions: readonly InterpreterOption[] = ["Yes", "No"] as const;
const pleaOptions: readonly PleaOption[] = ["No plea", "Guilty", "Not guilty"] as const;
const offenceCategoryOrder: OffenceCategory[] = ["Minor", "Serious", "Dismissible"];
const offenceGroupLabel: Record<OffenceCategory, string> = {
  Minor: "Minor Offences",
  Serious: "Serious Offences",
  Dismissible: "Dismissible Offences",
};
const conductOffenceOptions: ConductOffence[] = [
  { name: "Unauthorised Absenteeism", category: "Minor" },
  { name: "Arriving Late For Work", category: "Minor" },
  { name: "Leaving Work Early", category: "Minor" },
  { name: "Failure To Report Absence", category: "Minor" },
  { name: "Failure To Report Late Arrival", category: "Minor" },
  { name: "Failure To Report Leaving Early", category: "Minor" },
  { name: "Sleeping On Duty", category: "Minor" },
  { name: "Failure To Clock In/Out", category: "Minor" },
  { name: "Poor Housekeeping", category: "Minor" },
  { name: "Horseplay", category: "Minor" },
  { name: "Unauthorised Use Of Cell Phone", category: "Minor" },
  { name: "Breach Of Policy Or Procedure", category: "Minor" },
  { name: "Breach Of Rules Or Regulations", category: "Minor" },
  { name: "Failure To Carry Out Instructions", category: "Minor" },
  { name: "Negligence", category: "Serious" },
  { name: "Unauthorised Absenteeism > 5 Days", category: "Serious" },
  { name: "Refusal To Work Overtime", category: "Serious" },
  { name: "Consistent Poor Time Keeping", category: "Serious" },
  { name: "Causing Inharmonious Relationships", category: "Serious" },
  { name: "Unbecoming Behaviour", category: "Serious" },
  { name: "Insolence / Disrespectful Behaviour", category: "Serious" },
  { name: "Aggressive Behaviour", category: "Serious" },
  { name: "Insubordination / Refusing Instructions", category: "Serious" },
  { name: "Refusal To Comply With Policy/Procedure", category: "Serious" },
  { name: "Refusal To Comply With Rule", category: "Serious" },
  { name: "Damage To Company Name", category: "Serious" },
  { name: "Unauthorised Wastage Of Materials", category: "Serious" },
  { name: "Unauthorised Removal", category: "Serious" },
  { name: "Unauthorised Possession", category: "Serious" },
  { name: "Breach Of OHS Standards / Policies", category: "Serious" },
  { name: "Private Work During Working Hours", category: "Serious" },
  { name: "Unauthorised Disclosure Of Information", category: "Serious" },
  { name: "Misappropriation Of Property / Funds", category: "Serious" },
  { name: "Testing Positive For Alcohol", category: "Serious" },
  { name: "Testing Positive For Illegal Drugs", category: "Serious" },
  { name: "Under The Influence Of Alcohol/Drugs", category: "Serious" },
  { name: "Possession Of Alcohol/Drugs On Duty", category: "Serious" },
  { name: "Unauthorised Possession Of Firearm On Duty", category: "Serious" },
  { name: "Intimidation", category: "Serious" },
  { name: "Incitement", category: "Serious" },
  { name: "Illegal Strike / Picketing", category: "Serious" },
  { name: "Viewing Pornographic Material On Duty", category: "Serious" },
  { name: "Unauthorised Access", category: "Serious" },
  { name: "Unauthorised Use Of Company Property", category: "Serious" },
  { name: "Unauthorised Use Of Client Property", category: "Serious" },
  { name: "Abusive Language", category: "Serious" },
  { name: "Dishonesty", category: "Serious" },
  { name: "Gambling On Duty", category: "Serious" },
  { name: "Clocking For Another Employee", category: "Serious" },
  { name: "Theft", category: "Dismissible" },
  { name: "Accomplice To Theft", category: "Dismissible" },
  { name: "Fraud", category: "Dismissible" },
  { name: "Accomplice To Fraud", category: "Dismissible" },
  { name: "Gross Dishonesty", category: "Dismissible" },
  { name: "Gross Negligence", category: "Dismissible" },
  { name: "Assault", category: "Dismissible" },
  { name: "Sexual Harassment", category: "Dismissible" },
  { name: "Viewing Illegal Pornography On Duty", category: "Dismissible" },
  { name: "Racism", category: "Dismissible" },
  { name: "Refusal To Obey OHS Rules/Procedures", category: "Dismissible" },
  { name: "Bribery", category: "Dismissible" },
  { name: "Falsification Of Records", category: "Dismissible" },
  { name: "Intentional Damage To Property", category: "Dismissible" },
  { name: "Gross Insubordination", category: "Dismissible" },
  { name: "Unauthorised Discharge Of Firearm", category: "Dismissible" },
  { name: "Unsafe Use Of Firearm", category: "Dismissible" },
  { name: "Threatening Another Employee/Client", category: "Dismissible" },
  { name: "Unauthorised Possession Of A Weapon On Duty", category: "Dismissible" },
];

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
  if (registeredName.toLowerCase().endsWith(suffix.toLowerCase())) return registeredName;
  return `${registeredName} ${suffix}`;
};

const formatClientDisplayName = (client: ClientRow) => {
  const registeredName = String(client.registered_name || "").trim();
  const tradingName = String(client.trading_as || "").trim();
  const companyType = String(client.company_type || "").trim();
  const registeredWithType = registeredName ? appendCompanyTypeSuffix(registeredName, companyType) : "";
  if (
    registeredWithType &&
    tradingName &&
    tradingName.toLowerCase() !== registeredName.toLowerCase() &&
    tradingName.toLowerCase() !== registeredWithType.toLowerCase()
  ) {
    return `${registeredWithType} t/a ${tradingName}`;
  }
  return registeredWithType || tradingName || "Unnamed client";
};

const formatClientAddress = (client: ClientRow) =>
  [
    String(client.physical_address_line1 || "").trim(),
    String(client.physical_address_line2 || "").trim(),
    String(client.city || "").trim(),
    String(client.province || "").trim(),
    String(client.area_code || "").trim(),
  ]
    .filter(Boolean)
    .join(", ");

const mapClientToFormState = (client: ClientRow): ClientFormState => ({
  clientId: client.id,
  clientName: formatClientDisplayName(client),
  clientRegisteredName: String(client.registered_name || "").trim(),
  clientTradingAsName: String(client.trading_as || "").trim(),
  registrationNumber: String(client.registration_number || "").trim(),
  clientContactNumber: String(client.primary_number || client.owner_number || "").trim(),
  clientEmail: String(client.primary_email || client.owner_email || "").trim(),
  clientAddress: formatClientAddress(client),
  clientCity: String(client.city || "").trim(),
  clientProvince: String(client.province || "").trim(),
});

const normalizeClientBargainingCouncil = (value: string | null) => {
  const raw = String(value || "").trim();
  return raw || "None";
};

const getOutcomeDisputeForumText = (bargainingCouncil: string) => {
  const councilName = String(bargainingCouncil || "").trim();
  if (!councilName || councilName.toLowerCase() === "none") return "the CCMA";
  const councilLabel = bargainingCouncilOptions.find((option) => option.value === councilName)?.label || councilName;
  return `the ${councilLabel}`;
};

const normalizeHearingDetailsFormState = (value: unknown): HearingDetailsFormState => {
  const candidate = (value && typeof value === "object" ? value : {}) as Partial<HearingDetailsFormState>;
  const employeeAttendance =
    candidate.employeeAttendance === "Present" || candidate.employeeAttendance === "Absent" ? candidate.employeeAttendance : "";
  const visibleProcessOptions =
    employeeAttendance === "Present"
      ? hearingProcessOptions.filter((option) => option !== "Continued in absence")
      : employeeAttendance === "Absent"
        ? hearingProcessOptions.filter((option) => option !== "Continued")
        : hearingProcessOptions;
  const hearingProcess =
    candidate.hearingProcess && visibleProcessOptions.includes(candidate.hearingProcess)
      ? candidate.hearingProcess
      : employeeAttendance === "Present"
        ? "Continued"
        : employeeAttendance === "Absent"
          ? "Continued in absence"
          : "";
  return {
    ...emptyHearingDetailsFormState,
    ...candidate,
    employeeAttendance,
    hearingProcess,
    bargainingCouncil: String(candidate.bargainingCouncil || emptyHearingDetailsFormState.bargainingCouncil).trim() || "None",
    misconductTypes: Array.isArray(candidate.misconductTypes)
      ? candidate.misconductTypes.filter((entry): entry is string => typeof entry === "string")
      : [],
    pleasByCharge:
      candidate.pleasByCharge && typeof candidate.pleasByCharge === "object"
        ? Object.fromEntries(
            Object.entries(candidate.pleasByCharge).filter(
              (entry): entry is [string, PleaOption | ""] => typeof entry[0] === "string" && typeof entry[1] === "string",
            ),
          )
        : {},
  };
};

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

const serializeOutcomeDraftState = (draft: OutcomeDraftState) =>
  JSON.stringify({
    activeStep: draft.activeStep,
    isFinished: draft.isFinished,
    clientForm: draft.clientForm,
    employeeForm: draft.employeeForm,
    hearingDetailsForm: draft.hearingDetailsForm,
    previewForm: draft.previewForm,
    hasRecommendationSection: draft.hasRecommendationSection,
    isPreviewEditable: draft.isPreviewEditable,
  });

const toSentenceCaseLower = (value: string) => {
  const trimmed = String(value || "").trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.charAt(0) + trimmed.slice(1);
};

const withIndefiniteArticle = (value: string) => {
  const normalized = toSentenceCaseLower(value);
  if (!normalized) return "";
  const article = /^[aeiou]/i.test(normalized) ? "an" : "a";
  return `${article} ${normalized}`;
};

const joinWithAnd = (values: string[]) => {
  const normalized = values.map((value) => toSentenceCaseLower(value)).filter(Boolean);
  if (normalized.length === 0) return "";
  if (normalized.length === 1) return normalized[0];
  if (normalized.length === 2) return `${normalized[0]} and ${normalized[1]}`;
  return `${normalized.slice(0, -1).join(", ")}, and ${normalized[normalized.length - 1]}`;
};

const normalizeParagraphText = (value: string) =>
  String(value || "")
    .split(/\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

const sanitizeFileSegment = (value: string, fallback: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;

const stripParagraphNumberPrefix = (value: string) => String(value || "").replace(/^\s*\d+(?:\.\d+)?\.?\s*/, "").trim();

const splitEditorDraftLines = (value: string) =>
  String(value || "")
    .split(/\r?\n/)
    .map((line) => stripParagraphNumberPrefix(line));

const parseDraftState = (value: unknown): OutcomeDraftState => {
  if (!value || typeof value !== "object") {
    return {
      activeStep: 0,
      isFinished: false,
      clientForm: emptyClientFormState,
      employeeForm: emptyEmployeeFormState,
      hearingDetailsForm: emptyHearingDetailsFormState,
      previewForm: emptyPreviewFormState,
      hasRecommendationSection: false,
      isPreviewEditable: false,
    };
  }
  const candidate = value as {
    activeStep?: unknown;
    isFinished?: unknown;
    clientForm?: Partial<ClientFormState>;
    employeeForm?: Partial<EmployeeFormState>;
    hearingDetailsForm?: Partial<HearingDetailsFormState>;
    previewForm?: Partial<PreviewFormState>;
    hasRecommendationSection?: unknown;
    isPreviewEditable?: unknown;
  };
  const activeStep = Math.max(0, Math.min(2, Number(candidate.activeStep) || 0));
  return {
    activeStep,
    isFinished: Boolean(candidate.isFinished),
    clientForm: {
      ...emptyClientFormState,
      ...(candidate.clientForm || {}),
    },
    employeeForm: {
      ...emptyEmployeeFormState,
      ...(candidate.employeeForm || {}),
    },
    hearingDetailsForm: normalizeHearingDetailsFormState(candidate.hearingDetailsForm),
    previewForm: {
      ...emptyPreviewFormState,
      ...(candidate.previewForm || {}),
    },
    hasRecommendationSection: Boolean(candidate.hasRecommendationSection),
    isPreviewEditable: Boolean(candidate.isPreviewEditable),
  };
};

const DisciplinaryHearingOutcomeGenerator = ({
  onRequestClose,
  draftState,
  onDraftStateChange,
  onStepChange,
  onStepMetaChange,
}: DisciplinaryHearingOutcomeGeneratorProps) => {
  const { user } = useAuth();
  const initialDraft = useMemo(() => parseDraftState(draftState), [draftState]);
  const [activeStep, setActiveStep] = useState(initialDraft.activeStep);
  const [isFinished, setIsFinished] = useState(initialDraft.isFinished);
  const [clientForm, setClientForm] = useState<ClientFormState>(initialDraft.clientForm);
  const [employeeForm, setEmployeeForm] = useState<EmployeeFormState>(initialDraft.employeeForm);
  const [hearingDetailsForm, setHearingDetailsForm] = useState<HearingDetailsFormState>(initialDraft.hearingDetailsForm);
  const [previewForm, setPreviewForm] = useState<PreviewFormState>(initialDraft.previewForm);
  const [hasRecommendationSection, setHasRecommendationSection] = useState(initialDraft.hasRecommendationSection);
  const [isPreviewEditable, setIsPreviewEditable] = useState(initialDraft.isPreviewEditable);
  const [clientRows, setClientRows] = useState<ClientRow[]>([]);
  const [clientLoadMessage, setClientLoadMessage] = useState("Loading clients...");
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearchValue, setClientSearchValue] = useState("");
  const [chargePickerOpen, setChargePickerOpen] = useState(false);
  const [bargainingCouncilPickerOpen, setBargainingCouncilPickerOpen] = useState(false);
  const [bargainingCouncilSearchValue, setBargainingCouncilSearchValue] = useState("");
  const noticeDatePickerRef = useRef<HTMLInputElement | null>(null);
  const hearingDatePickerRef = useRef<HTMLInputElement | null>(null);
  const editingTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const downloadPdfRef = useRef<(() => void) | null>(null);
  const lastEmittedDraftSnapshotRef = useRef<string | null>(null);
  const [editingParagraphId, setEditingParagraphId] = useState<EditorTarget | null>(null);
  const [editingParagraphLabel, setEditingParagraphLabel] = useState("");
  const [editingParagraphDraft, setEditingParagraphDraft] = useState("");
  const [isAddRecommendationOpen, setIsAddRecommendationOpen] = useState(false);
  const [recommendationDraft, setRecommendationDraft] = useState("");

  useEffect(() => {
    const nextDraft = parseDraftState(draftState);
    const nextSnapshot = serializeOutcomeDraftState(nextDraft);
    if (nextSnapshot === lastEmittedDraftSnapshotRef.current) return;
    setActiveStep(nextDraft.activeStep);
    setIsFinished(nextDraft.isFinished);
    setClientForm(nextDraft.clientForm);
    setEmployeeForm(nextDraft.employeeForm);
    setHearingDetailsForm(nextDraft.hearingDetailsForm);
    setPreviewForm(nextDraft.previewForm);
    setHasRecommendationSection(nextDraft.hasRecommendationSection);
    setIsPreviewEditable(nextDraft.isPreviewEditable);
  }, [draftState]);

  useEffect(() => {
    let isMounted = true;
    const loadClients = async () => {
      if (!user?.id) {
        if (isMounted) setClientLoadMessage("Sign in to load clients.");
        return;
      }
      const { data, error } = await supabase
        .from("clients")
        .select("id, registered_name, trading_as, company_type, registration_number, owner_number, primary_number, owner_email, primary_email, physical_address_line1, physical_address_line2, city, province, area_code, bargaining_council")
        .order("registered_name", { ascending: true, nullsFirst: false });
      if (!isMounted) return;
      if (error) {
        setClientRows([]);
        setClientLoadMessage("Unable to load clients.");
        return;
      }
      const rows = Array.isArray(data) ? (data as unknown as ClientRow[]) : [];
      setClientRows(rows);
      setClientLoadMessage(rows.length === 0 ? "No clients found." : "No matching client found.");
    };
    void loadClients();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    const nextDraftState = {
      activeStep,
      isFinished,
      clientForm,
      employeeForm,
      hearingDetailsForm,
      previewForm,
      hasRecommendationSection,
      isPreviewEditable,
    } satisfies OutcomeDraftState;
    lastEmittedDraftSnapshotRef.current = serializeOutcomeDraftState(nextDraftState);
    onDraftStateChange?.(nextDraftState);
  }, [activeStep, clientForm, employeeForm, hasRecommendationSection, hearingDetailsForm, isFinished, isPreviewEditable, onDraftStateChange, previewForm]);

  useEffect(() => {
    onStepChange?.(isFinished ? steps[3] : steps[Math.min(activeStep, steps.length - 1)] ?? null);
  }, [activeStep, isFinished, onStepChange]);

  const isClientStepValid = Boolean(clientForm.clientId.trim());
  const isEmployeeStepValid = Boolean(employeeForm.employeeName.trim() && employeeForm.employeeSurname.trim());
  const selectedPleaCount = hearingDetailsForm.misconductTypes.filter((type) =>
    Boolean(String(hearingDetailsForm.pleasByCharge[type] || "").trim()),
  ).length;
  const isHearingDetailsStepValid = Boolean(
    hearingDetailsForm.noticeDate.trim() &&
      hearingDetailsForm.hearingDate.trim() &&
      hearingDetailsForm.hearingFormat.trim() &&
      hearingDetailsForm.misconductTypes.length > 0 &&
      hearingDetailsForm.employeeAttendance.trim() &&
      hearingDetailsForm.hearingProcess.trim() &&
      hearingDetailsForm.bargainingCouncil.trim() &&
      hearingDetailsForm.representation.trim() &&
      hearingDetailsForm.interpreter.trim() &&
      selectedPleaCount === hearingDetailsForm.misconductTypes.length,
  );
  const usesNoMitigatingFactorsMessage =
    hearingDetailsForm.employeeAttendance === "Absent" && hearingDetailsForm.hearingProcess === "Continued in absence";
  const hasEditablePreviewText = (value: string) => {
    const trimmedValue = value.trim();
    return Boolean(trimmedValue) && trimmedValue !== editablePlaceholderText;
  };
  const isPreviewDownloadReady =
    hasEditablePreviewText(previewForm.employeeStatement) &&
    hasEditablePreviewText(previewForm.employerStatement) &&
    hasEditablePreviewText(previewForm.employerEvidence) &&
    hasEditablePreviewText(previewForm.employeeEvidence) &&
    hasEditablePreviewText(previewForm.analysisFinding) &&
    hasEditablePreviewText(previewForm.aggravatingFactors) &&
    (usesNoMitigatingFactorsMessage || hasEditablePreviewText(previewForm.mitigatingFactors)) &&
    (!hasRecommendationSection || hasEditablePreviewText(previewForm.recommendation));

  useEffect(() => {
    onStepMetaChange?.({
      steps,
      activeStep: isFinished ? 3 : activeStep,
      icons: stepIcons,
      canGoBack: isFinished || activeStep > 0,
      canGoNext:
        isFinished
          ? isPreviewDownloadReady
          : activeStep === 0
            ? isClientStepValid
            : activeStep === 1
              ? isEmployeeStepValid
              : activeStep === 2
                ? isHearingDetailsStepValid
                : false,
      supportsPreviewEditToggle: true,
      isPreviewEditable,
      canSelectStep: (index) => {
        if (index < 0 || index > 3) return false;
        if (isFinished) return true;
        if (activeStep === 0) return index === 0;
        if (activeStep === 1) return index <= 1;
        if (activeStep === 2) return index <= 2;
        return false;
      },
      onBack: () => {
        if (isFinished) {
          setIsFinished(false);
          setIsPreviewEditable(false);
          return;
        }
        setActiveStep((current) => Math.max(0, current - 1));
      },
      onNext: () => {
        if (isFinished) {
          downloadPdfRef.current?.();
          return;
        }
        if (activeStep === 0) {
          if (!isClientStepValid) return;
          setActiveStep(1);
          return;
        }
        if (activeStep === 1) {
          if (!isEmployeeStepValid) return;
          setActiveStep(2);
          return;
        }
        if (activeStep === 2 && isHearingDetailsStepValid) {
          setIsFinished(true);
          setIsPreviewEditable(false);
        }
      },
      onStepSelect: (index) => {
        if (index < 0 || index > 3) return;
        if (isFinished) {
          setIsFinished(false);
          setIsPreviewEditable(false);
        }
        if (!isFinished && activeStep === 0 && index !== 0) return;
        if (!isFinished && activeStep === 1 && index > 1) return;
        if (!isFinished && activeStep === 2 && index > 2) return;
        setActiveStep(Math.max(0, Math.min(index, 2)));
      },
      onClear: () => {
        if (isFinished) {
          setIsPreviewEditable((current) => !current);
          return;
        }
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
          setHearingDetailsForm(emptyHearingDetailsFormState);
          setHasRecommendationSection(false);
          setChargePickerOpen(false);
          setBargainingCouncilPickerOpen(false);
          setBargainingCouncilSearchValue("");
          return;
        }
      },
      supportsResetAtFirstStep: Boolean(clientForm.clientId.trim()),
      isFinished,
    });
  }, [activeStep, clientForm.clientId, isClientStepValid, isEmployeeStepValid, isFinished, isHearingDetailsStepValid, isPreviewDownloadReady, isPreviewEditable, onStepMetaChange]);

  const selectedClientLabel = clientForm.clientId ? clientForm.clientName : "Select client";
  const filteredBargainingCouncilOptions = useMemo(() => {
    const searchValue = bargainingCouncilSearchValue.trim().toLowerCase();
    if (!searchValue) return bargainingCouncilOptions;
    return bargainingCouncilOptions.filter(
      (option) =>
        option.label.toLowerCase().includes(searchValue) ||
        option.value.toLowerCase().includes(searchValue),
    );
  }, [bargainingCouncilSearchValue]);
  const selectedBargainingCouncilLabel = hearingDetailsForm.bargainingCouncil || "None";
  const visibleHearingProcessOptions = useMemo(() => {
    if (hearingDetailsForm.employeeAttendance === "Present") {
      return hearingProcessOptions.filter((option) => option !== "Continued in absence");
    }
    if (hearingDetailsForm.employeeAttendance === "Absent") {
      return hearingProcessOptions.filter((option) => option !== "Continued");
    }
    return hearingProcessOptions;
  }, [hearingDetailsForm.employeeAttendance]);
  const filteredClientRows = useMemo(() => {
    const searchValue = clientSearchValue.trim().toLowerCase();
    if (!searchValue) return clientRows;
    return clientRows.filter((client) => {
      const registeredName = String(client.registered_name || "").trim().toLowerCase();
      const tradingAsName = String(client.trading_as || "").trim().toLowerCase();
      return registeredName.startsWith(searchValue) || tradingAsName.startsWith(searchValue);
    });
  }, [clientRows, clientSearchValue]);

  const handleClientSelect = (clientId: string) => {
    const selectedClient = clientRows.find((row) => row.id === clientId);
    if (!selectedClient) return;
    setClientForm(mapClientToFormState(selectedClient));
    setEmployeeForm(emptyEmployeeFormState);
    setHearingDetailsForm({
      ...emptyHearingDetailsFormState,
      bargainingCouncil: normalizeClientBargainingCouncil(selectedClient.bargaining_council),
    });
    setPreviewForm(emptyPreviewFormState);
    setActiveStep(0);
    setIsFinished(false);
    setHasRecommendationSection(false);
    setIsPreviewEditable(false);
    setClientSearchValue("");
    setClientSearchOpen(false);
  };

  const handleEmployeeFieldChange = (field: keyof EmployeeFormState, value: string) => {
    setEmployeeForm((current) => ({
      ...current,
      [field]: field === "employeeIdOrPassportNumber" ? value.slice(0, employeeIdOrPassportMaxLength) : value,
    }));
  };

  const handleHearingDetailsFieldChange = <T extends keyof HearingDetailsFormState>(
    field: T,
    value: HearingDetailsFormState[T],
  ) => {
    setHearingDetailsForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleEmployeeAttendanceChange = (value: EmployeeAttendance) => {
    setHearingDetailsForm((current) => {
      const visibleOptions: readonly HearingProcess[] =
        value === "Present"
          ? hearingProcessOptions.filter((option) => option !== "Continued in absence")
          : hearingProcessOptions.filter((option) => option !== "Continued");
      const defaultProcess = value === "Present" ? "Continued" : "Continued in absence";
      return {
        ...current,
        employeeAttendance: value,
        hearingProcess: visibleOptions.includes(current.hearingProcess as HearingProcess) ? current.hearingProcess : defaultProcess,
      };
    });
  };

  const handlePleaChange = (charge: string, plea: PleaOption) => {
    setHearingDetailsForm((current) => ({
      ...current,
      pleasByCharge: {
        ...current.pleasByCharge,
        [charge]: plea,
      },
    }));
  };

  const closeParagraphEditor = () => {
    setEditingParagraphId(null);
    setEditingParagraphLabel("");
    setEditingParagraphDraft("");
  };

  const openAddRecommendationForm = () => {
    setRecommendationDraft(previewForm.recommendation.trim());
    setIsAddRecommendationOpen(true);
  };

  const closeAddRecommendationForm = () => {
    setIsAddRecommendationOpen(false);
    setRecommendationDraft("");
  };

  const saveAddRecommendationForm = () => {
    const nextRecommendation = recommendationDraft.trim();
    if (!nextRecommendation) {
      toast({
        title: "Add section",
        description: "Please provide recommendation text.",
        variant: "destructive",
      });
      return;
    }
    setPreviewForm((current) => ({
      ...current,
      recommendation: nextRecommendation,
    }));
    setHasRecommendationSection(true);
    closeAddRecommendationForm();
  };

  const removeRecommendationSection = () => {
    setHasRecommendationSection(false);
    setPreviewForm((current) => ({
      ...current,
      recommendation: "",
    }));
  };

  const saveParagraphEditor = () => {
    if (!editingParagraphId) return;
    const normalizedDraft = parseEditorDraft(editingParagraphDraft);
    if (!normalizedDraft.trim()) {
      toast({
        title: "Edit paragraph",
        description: "Paragraph text cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    if (editingParagraphId === "preliminarySection") {
      const lines = splitEditorDraftLines(editingParagraphDraft);
      setPreviewForm((current) => ({
        ...current,
        preliminaryOne: (lines[0] || "").trim(),
        preliminaryTwo: (lines[1] || "").trim(),
        preliminaryThree: (lines[2] || "").trim(),
        preliminaryFour: (lines[3] || "").trim(),
        preliminaryExtra: lines.slice(4).map((line) => line.trim()).filter(Boolean).join("\n"),
      }));
      closeParagraphEditor();
      return;
    }
    if (editingParagraphId === "issueSection") {
      const lines = splitEditorDraftLines(editingParagraphDraft);
      setPreviewForm((current) => ({
        ...current,
        issueInDispute: lines.map((line) => line.trim()).filter(Boolean).join("\n"),
      }));
      closeParagraphEditor();
      return;
    }
    if (editingParagraphId === "analysisSection") {
      const lines = splitEditorDraftLines(editingParagraphDraft);
      setPreviewForm((current) => ({
        ...current,
        analysisIntro: (lines[0] || "").trim(),
        analysisFinding: lines.slice(1).join("\n").trim(),
      }));
      closeParagraphEditor();
      return;
    }
    setPreviewForm((current) => ({
      ...current,
      [editingParagraphId]: normalizedDraft,
    }));
    closeParagraphEditor();
  };

  const handleEditingParagraphKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget;
    if (!editingParagraphId) return;
    const lines = textarea.value.split(/\r?\n/);
    const lineIndex = textarea.value.slice(0, textarea.selectionStart).split(/\r?\n/).length - 1;
    const lineStart = textarea.value.lastIndexOf("\n", textarea.selectionStart - 1) + 1;
    const prefix = `${getEditorParagraphNumber(editingParagraphId, lineIndex)} `;
    const minPosition = lineStart + prefix.length;
    if (event.key === "Home") {
      event.preventDefault();
      requestAnimationFrame(() => {
        editingTextareaRef.current?.setSelectionRange(minPosition, minPosition);
      });
      return;
    }
    if (event.key === "Backspace" && textarea.selectionStart === textarea.selectionEnd) {
      const currentLine = lines[lineIndex] || "";
      const currentContent = stripParagraphNumberPrefix(currentLine);
      if (!currentContent && lineIndex > 0) {
        event.preventDefault();
        const nextLines = lines.filter((_, index) => index !== lineIndex);
        const renumbered = renumberEditorDraft(editingParagraphId, nextLines);
        setEditingParagraphDraft(renumbered);
        requestAnimationFrame(() => {
          const previousLineText = nextLines[lineIndex - 1] || "";
          const previousPrefix = `${getEditorParagraphNumber(editingParagraphId, lineIndex - 1)} `;
          const previousContentLength = stripParagraphNumberPrefix(previousLineText).length;
          const lineOffset = previousPrefix.length + previousContentLength;
          const finalPosition = renumbered
            .split(/\r?\n/)
            .slice(0, lineIndex - 1)
            .reduce((total, line) => total + line.length + 1, 0) + lineOffset;
          editingTextareaRef.current?.setSelectionRange(finalPosition, finalPosition);
        });
        return;
      }
    }
    if ((event.key === "ArrowLeft" || event.key === "Backspace") && textarea.selectionStart <= minPosition && textarea.selectionEnd <= minPosition) {
      event.preventDefault();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (editingParagraphId === "analysisIntro") {
        return;
      }
      const nextLines = [...lines];
      nextLines.splice(lineIndex + 1, 0, "");
      const renumbered = renumberEditorDraft(editingParagraphId, nextLines);
      setEditingParagraphDraft(renumbered);
      requestAnimationFrame(() => {
        const nextLineStart = renumbered
          .split(/\r?\n/)
          .slice(0, lineIndex + 1)
          .reduce((total, line) => total + line.length + 1, 0);
        const nextPrefix = `${getEditorParagraphNumber(editingParagraphId, lineIndex + 1)} `;
        const nextCaretPosition = nextLineStart + nextPrefix.length;
        editingTextareaRef.current?.setSelectionRange(nextCaretPosition, nextCaretPosition);
      });
    }
  };

  const handleToggleCharge = (charge: string) => {
    setHearingDetailsForm((current) => {
      const isSelected = current.misconductTypes.includes(charge);
      const nextMisconductTypes = isSelected
        ? current.misconductTypes.filter((item) => item !== charge)
        : [...current.misconductTypes, charge];
      const nextPleasByCharge = { ...current.pleasByCharge };
      if (isSelected) {
        delete nextPleasByCharge[charge];
      } else if (!nextPleasByCharge[charge]) {
        nextPleasByCharge[charge] = "";
      }
      return {
        ...current,
        misconductTypes: nextMisconductTypes,
        pleasByCharge: nextPleasByCharge,
      };
    });
  };

  const selectedChargeLabel =
    hearingDetailsForm.misconductTypes.length === 0
      ? "Select misconduct type(s)"
      : hearingDetailsForm.misconductTypes.length === 1
        ? hearingDetailsForm.misconductTypes[0]
        : `${hearingDetailsForm.misconductTypes.length} misconduct type(s) selected`;
  const misconductListLabel = joinWithAnd(hearingDetailsForm.misconductTypes);
  const clientLocationHeading = [clientForm.clientCity, clientForm.clientProvince]
    .filter(Boolean)
    .join(", ")
    .toUpperCase() || "CITY, PROVINCE";
  const clientMatterName = (clientForm.clientName || "EMPLOYER NAME").toUpperCase();
  const employeeFullName = [employeeForm.employeeName, employeeForm.employeeSurname].filter(Boolean).join(" ").trim() || "______________________________";
  const employeeMatterName =
    [employeeForm.employeeName, employeeForm.employeeSurname].filter(Boolean).join(" ").trim().toUpperCase() || "EMPLOYEE NAME";
  const employeeStatementValue = previewForm.employeeStatement.trim() || editablePlaceholderText;
  const employerStatementValue = previewForm.employerStatement.trim() || editablePlaceholderText;
  const employerEvidenceValue = previewForm.employerEvidence.trim() || editablePlaceholderText;
  const employeeEvidenceValue = previewForm.employeeEvidence.trim() || editablePlaceholderText;
  const selectedMisconductCount = hearingDetailsForm.misconductTypes.length;
  const representationSentence =
    hearingDetailsForm.representation === "Conduct own defense"
      ? " and represented him/her self."
      : hearingDetailsForm.representation
        ? ` and was represented by ${withIndefiniteArticle(hearingDetailsForm.representation)}.`
        : ".";
  const hearingProcessLower = toSentenceCaseLower(hearingDetailsForm.hearingProcess);
  const employeeAttendanceSentence =
    hearingDetailsForm.employeeAttendance === "Absent"
      ? hearingDetailsForm.hearingProcess === "Continued in absence"
        ? "The employee was absent at the hearing and the hearing continued in his/her absence."
        : hearingProcessLower
          ? `The employee was absent at the hearing and the hearing was ${hearingProcessLower}.`
          : "The employee was absent at the hearing."
      : `The employee was ${String(hearingDetailsForm.employeeAttendance || "______________________________").toLowerCase()} at the hearing${representationSentence}`;
  const preliminaryOneValue =
    previewForm.preliminaryOne.trim() ||
    `The disciplinary hearing was held on ${formatDateLabel(hearingDetailsForm.hearingDate) || "______________________________"}.`;
  const preliminaryTwoValue = previewForm.preliminaryTwo.trim() || employeeAttendanceSentence;
  const preliminaryThreeValue =
    previewForm.preliminaryThree.trim() ||
    `The employee received the notice to attend on ${formatDateLabel(hearingDetailsForm.noticeDate) || "______________________________"}.`;
  const singleChargePlea = hearingDetailsForm.misconductTypes.length === 1
    ? toSentenceCaseLower(String(hearingDetailsForm.pleasByCharge[hearingDetailsForm.misconductTypes[0]] || "").trim())
    : "";
  const preliminaryFourValue =
    previewForm.preliminaryFour.trim() ||
    (selectedMisconductCount === 1 && singleChargePlea
      ? `The employee was charged with ${misconductListLabel} and pleaded ${singleChargePlea}.`
      : selectedMisconductCount > 0
        ? `The employee was charged with ${misconductListLabel}.`
        : "The employee was charged with ______________________________.");
  const pleaRows = hearingDetailsForm.misconductTypes.map((type, index) => {
    const plea = toSentenceCaseLower(String(hearingDetailsForm.pleasByCharge[type] || "").trim());
    const charge = toSentenceCaseLower(type);
    return {
      number: `4.${index + 1}`,
      value: plea && charge ? `In respect of ${charge}, the employee pleaded ${plea}.` : "",
    };
  }).filter((row) => row.value);
  const preliminaryRows = [
    {
      number: "1.",
      value: preliminaryOneValue,
      field: "preliminaryOne",
      label: "Preliminary paragraph 1",
    },
    {
      number: "2.",
      value: preliminaryTwoValue,
      field: "preliminaryTwo",
      label: "Preliminary paragraph 2",
    },
    {
      number: "3.",
      value: preliminaryThreeValue,
      field: "preliminaryThree",
      label: "Preliminary paragraph 3",
    },
    {
      number: "4.",
      value: preliminaryFourValue,
      field: "preliminaryFour",
      label: "Preliminary paragraph 4",
      subRows: selectedMisconductCount > 1 ? pleaRows : [],
    },
    ...normalizeParagraphText(previewForm.preliminaryExtra).map((paragraph, index) => ({
      number: `${5 + index}.`,
      value: paragraph,
      field: "preliminaryExtra" as const,
      label: "Preliminary paragraph",
    })),
  ];
  const firstIssueNumber = preliminaryRows.length + 1;
  const issueInDisputeValue = previewForm.issueInDispute.trim() || defaultIssueInDisputeParagraph;
  const analysisIntroValue = previewForm.analysisIntro.trim() || defaultAnalysisFindingParagraph;
  const analysisFindingValue = previewForm.analysisFinding.trim() || editablePlaceholderText;
  const aggravatingFactorsValue = previewForm.aggravatingFactors.trim() || editablePlaceholderText;
  const mitigatingFactorsValue = previewForm.mitigatingFactors.trim() || editablePlaceholderText;
  const recommendationValue = previewForm.recommendation.trim() || editablePlaceholderText;
  const issueParagraphs = normalizeParagraphText(issueInDisputeValue);
  const issueRows = issueParagraphs.map((paragraph, index) => ({
    number: `${firstIssueNumber + index}.`,
    value: paragraph,
    field: "issueInDispute" as const,
    label: "Issue(s) In Dispute",
  }));
  const employerEvidenceParagraphs = normalizeParagraphText(employerEvidenceValue);
  const employeeEvidenceParagraphs = normalizeParagraphText(employeeEvidenceValue);
  const analysisParagraphs = normalizeParagraphText(analysisFindingValue);
  const aggravatingParagraphs = normalizeParagraphText(aggravatingFactorsValue);
  const mitigatingParagraphs = normalizeParagraphText(mitigatingFactorsValue);
  const recommendationParagraphs = normalizeParagraphText(recommendationValue);
  const employeeStatementNumber = firstIssueNumber + issueParagraphs.length;
  const employerStatementNumber = employeeStatementNumber + 1;
  const employerEvidenceNumber = employerStatementNumber + 1;
  const employeeEvidenceNumber = employerEvidenceNumber + 1;
  const analysisIntroNumber = employeeEvidenceNumber + 1;
  const analysisFindingStartNumber = analysisIntroNumber + 1;
  const aggravatingHeadingNumber = analysisFindingStartNumber + analysisParagraphs.length;
  const mitigatingHeadingNumber = aggravatingHeadingNumber + 1;
  const recommendationHeadingNumber = mitigatingHeadingNumber + 1;
  const recourseHeadingNumber = hasRecommendationSection
    ? recommendationHeadingNumber + recommendationParagraphs.length
    : mitigatingHeadingNumber + 1;
  const disputeForumText = getOutcomeDisputeForumText(hearingDetailsForm.bargainingCouncil);
  const recourseParagraph =
    `If the employer chooses to dismiss the employee, he/she must be notified that he/she may refer a dispute to ${disputeForumText} within 30 (THIRTY) days of dismissal or alternatively, apply for an appeal to the outcome within 3 (THREE) days of dismissal.`;
  const recourseParagraphNumber = `${recourseHeadingNumber}.`;

  async function handleDownloadPdf() {
    if (!isPreviewDownloadReady) {
      toast({
        title: "Complete preview",
        description: "Please complete all required preview paragraphs before downloading.",
        variant: "destructive",
      });
      return;
    }

    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginX = 20;
    const marginTop = 20;
    const marginBottom = 18;
    const usableWidth = pageWidth - marginX * 2;
    const bodyLimitY = pageHeight - marginBottom;
    const numberColumnWidth = 8;
    const nestedNumberColumnWidth = 12;
    const paragraphLineHeight = 4.9;
    const paragraphGap = 2.4;
    const sectionGap = 4.2;
    let cursorY = marginTop;

    const startPage = () => {
      pdf.addPage();
      cursorY = marginTop;
    };

    const keepRoom = (height: number) => {
      if (cursorY + height <= bodyLimitY) return;
      startPage();
    };

    const textLines = (text: string, width: number) => pdf.splitTextToSize(text, width).map((line) => String(line));

    const writeJustifiedLines = (lines: string[], x: number, startY: number, width: number) => {
      lines.forEach((line, lineIndex) => {
        const lineText = String(line);
        const lineY = startY + lineIndex * paragraphLineHeight;
        const isLastLine = lineIndex === lines.length - 1;
        const words = lineText.trim().split(/\s+/).filter(Boolean);
        if (isLastLine || words.length <= 1) {
          pdf.text(lineText, x, lineY);
          return;
        }

        const extraSpace = width - pdf.getTextWidth(lineText);
        const gapCount = words.length - 1;
        let wordX = x;
        words.forEach((word, wordIndex) => {
          pdf.text(word, wordX, lineY);
          wordX += pdf.getTextWidth(word);
          if (wordIndex < gapCount) {
            wordX += pdf.getTextWidth(" ") + extraSpace / gapCount;
          }
        });
      });
    };

    const writeCenteredLine = (text: string, size: number, fontStyle: "normal" | "bold", gapAfter: number) => {
      keepRoom(5 + gapAfter);
      pdf.setFont("helvetica", fontStyle);
      pdf.setFontSize(size);
      pdf.setTextColor(0, 0, 0);
      pdf.text(text, pageWidth / 2, cursorY, { align: "center" });
      cursorY += 5 + gapAfter;
    };

    const writeMatterRow = (leftText: string, rightText: string, boldLeft = false) => {
      const rightWidth = 34;
      const leftWidth = usableWidth - rightWidth - 8;
      const leftLines = textLines(leftText, leftWidth);
      const rowHeight = Math.max(leftLines.length * paragraphLineHeight, paragraphLineHeight);
      keepRoom(rowHeight + 1.4);
      pdf.setFont("helvetica", boldLeft ? "bold" : "normal");
      pdf.setFontSize(10);
      leftLines.forEach((line, index) => {
        pdf.text(line, marginX, cursorY + index * paragraphLineHeight);
      });
      pdf.setFont("helvetica", "normal");
      pdf.text(rightText, pageWidth - marginX, cursorY, { align: "right" });
      cursorY += rowHeight + 1.4;
    };

    const writePlainParagraph = (text: string, options?: { indent?: number; size?: number; bold?: boolean; gapAfter?: number }) => {
      const indent = options?.indent ?? 0;
      const width = usableWidth - indent;
      const lines = textLines(text, width);
      keepRoom(lines.length * paragraphLineHeight + (options?.gapAfter ?? paragraphGap));
      pdf.setFont("helvetica", options?.bold ? "bold" : "normal");
      pdf.setFontSize(options?.size ?? 10);
      lines.forEach((line, index) => {
        pdf.text(line, marginX + indent, cursorY + index * paragraphLineHeight);
      });
      cursorY += lines.length * paragraphLineHeight + (options?.gapAfter ?? paragraphGap);
    };

    const writeSectionHeading = (heading: string) => {
      const lines = textLines(heading.toUpperCase(), usableWidth);
      keepRoom(lines.length * 4.2 + 2.2 + paragraphLineHeight);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.4);
      lines.forEach((line, index) => {
        const lineY = cursorY + index * 4.2;
        pdf.text(line, marginX, lineY);
        const lineWidth = pdf.getTextWidth(line);
        pdf.setLineWidth(0.15);
        pdf.line(marginX, lineY + 0.8, marginX + lineWidth, lineY + 0.8);
      });
      cursorY += lines.length * 4.2 + 4;
    };

    const writeNumberedParagraph = (number: string, text: string, options?: { nested?: boolean; gapAfter?: number }) => {
      const numberWidth = options?.nested ? nestedNumberColumnWidth : numberColumnWidth;
      const leftOffset = numberWidth + 4;
      const lines = textLines(text, usableWidth - leftOffset);
      const blockHeight = lines.length * paragraphLineHeight + (options?.gapAfter ?? paragraphGap);
      keepRoom(blockHeight);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text(number, marginX, cursorY);
      writeJustifiedLines(lines, marginX + leftOffset, cursorY, usableWidth - leftOffset);
      cursorY += blockHeight;
    };

    const writeDocumentSection = (heading: string, render: () => void) => {
      keepRoom(16);
      writeSectionHeading(heading);
      render();
      cursorY += sectionGap;
    };

    const addPageNumbers = () => {
      const pageCount = pdf.getNumberOfPages();
      for (let pageIndex = 1; pageIndex <= pageCount; pageIndex += 1) {
        pdf.setPage(pageIndex);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(0, 0, 0);
        pdf.text(`Page ${pageIndex} of ${pageCount}`, pageWidth - marginX, 12, { align: "right" });
      }
    };

    writeCenteredLine("IN THE DISCIPLINARY HEARING", 10, "bold", 0.2);
    writeCenteredLine(`HELD AT ${clientLocationHeading}`, 10, "bold", 10);

    writePlainParagraph("In the matter between:", { gapAfter: 4 });
    writeMatterRow(clientMatterName, "EMPLOYER", true);
    cursorY += 2.6;
    writePlainParagraph("and", { gapAfter: 4 });
    writeMatterRow(employeeMatterName, "EMPLOYEE", true);
    cursorY += 3;

    keepRoom(18);
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.2);
    pdf.line(marginX, cursorY, pageWidth - marginX, cursorY);
    cursorY += 8.4;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.text("OUTCOME OF THE DISCIPLINARY HEARING", pageWidth / 2, cursorY, { align: "center" });
    cursorY += 6.4;
    pdf.line(marginX, cursorY, pageWidth - marginX, cursorY);
    cursorY += 9;

    writeDocumentSection("Preliminary", () => {
      preliminaryRows.forEach((row) => {
        writeNumberedParagraph(row.number, row.value);
        if ("subRows" in row) {
          row.subRows.forEach((subRow) => {
            writeNumberedParagraph(subRow.number, subRow.value, { nested: true });
          });
        }
      });
    });

    writeDocumentSection("Issue(s) In Dispute", () => {
      issueRows.forEach((row) => writeNumberedParagraph(row.number, row.value));
    });

    writeDocumentSection("Background To The Issue", () => {
      writeNumberedParagraph(`${employeeStatementNumber}.`, "The Employee's statement:");
      normalizeParagraphText(employeeStatementValue).forEach((paragraph, index) => {
        writeNumberedParagraph(`${employeeStatementNumber}.${index + 1}`, paragraph, { nested: true });
      });
      cursorY += 1.2;
      writeNumberedParagraph(`${employerStatementNumber}.`, "The Employer's statement:");
      normalizeParagraphText(employerStatementValue).forEach((paragraph, index) => {
        writeNumberedParagraph(`${employerStatementNumber}.${index + 1}`, paragraph, { nested: true });
      });
    });

    writeDocumentSection("Survey Of Evidence", () => {
      writeNumberedParagraph(`${employerEvidenceNumber}.`, "The employer submitted the following evidence:");
      employerEvidenceParagraphs.forEach((paragraph, index) => {
        writeNumberedParagraph(`${employerEvidenceNumber}.${index + 1}`, paragraph, { nested: true });
      });
      cursorY += 1.2;
      writeNumberedParagraph(`${employeeEvidenceNumber}.`, "The employee submitted the following evidence:");
      employeeEvidenceParagraphs.forEach((paragraph, index) => {
        writeNumberedParagraph(`${employeeEvidenceNumber}.${index + 1}`, paragraph, { nested: true });
      });
    });

    writeDocumentSection("Analysis Of Evidence And Finding", () => {
      writeNumberedParagraph(`${analysisIntroNumber}.`, analysisIntroValue);
      analysisParagraphs.forEach((paragraph, index) => {
        writeNumberedParagraph(`${analysisFindingStartNumber + index}.`, paragraph);
      });
    });

    writeDocumentSection("Aggravating And Mitigating", () => {
      writeNumberedParagraph(`${aggravatingHeadingNumber}.`, "The following aggravating factors were submitted:");
      aggravatingParagraphs.forEach((paragraph, index) => {
        writeNumberedParagraph(`${aggravatingHeadingNumber}.${index + 1}`, paragraph, { nested: true });
      });
      cursorY += 1.2;
      writeNumberedParagraph(`${mitigatingHeadingNumber}.`, "The following mitigating factors were submitted:");
      if (usesNoMitigatingFactorsMessage) {
        writeNumberedParagraph(`${mitigatingHeadingNumber}.1`, "No mitigating factors were submitted by the employee.", { nested: true });
      } else {
        mitigatingParagraphs.forEach((paragraph, index) => {
          writeNumberedParagraph(`${mitigatingHeadingNumber}.${index + 1}`, paragraph, { nested: true });
        });
      }
    });

    if (hasRecommendationSection) {
      writeDocumentSection("Recommendation", () => {
        recommendationParagraphs.forEach((paragraph, index) => {
          writeNumberedParagraph(`${recommendationHeadingNumber + index}.`, paragraph);
        });
      });
    }

    writeDocumentSection("Recourse", () => {
      writeNumberedParagraph(recourseParagraphNumber, recourseParagraph);
    });

    keepRoom(24);
    cursorY += 8;
    pdf.setDrawColor(0, 0, 0);
    pdf.line(marginX, cursorY, marginX + 58, cursorY);
    cursorY += 5.2;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text("CHAIRPERSON", marginX, cursorY);

    addPageNumbers();

    const safeEmployeeName =
      [employeeForm.employeeName, employeeForm.employeeSurname]
        .filter(Boolean)
        .join("_")
        .replace(/[^A-Za-z0-9_-]+/g, "_")
        .replace(/^_+|_+$/g, "") || "employee";
    const safeDate = hearingDetailsForm.hearingDate || new Date().toISOString().slice(0, 10);
    const documentLabel = "Disciplinary Hearing Outcome";
    const employeeInitials = employeeForm.employeeName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}.`)
      .join("");
    const employeeSurname = employeeForm.employeeSurname.trim();
    const documentNameSuffix = employeeInitials && employeeSurname ? ` (${employeeInitials} ${employeeSurname})` : "";
    const documentName = `${documentLabel}${documentNameSuffix}`;
    const downloadFileName = `Disciplinary_Hearing_Outcome_${safeEmployeeName}_${safeDate}.pdf`;
    const uploadFilePath = [
      "disciplinary-hearing-outcomes",
      sanitizeFileSegment(clientForm.clientName || "client", "client"),
      `${Date.now()}-${sanitizeFileSegment(documentName, "disciplinary-hearing-outcome")}.pdf`,
    ].join("/");
    const uploadBlob = pdf.output("blob");
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

    const logResult = await logGeneratedDocument({
      documentLabel,
      documentName,
      documentType: "Outcome",
      clientId: clientForm.clientId,
      clientName: clientForm.clientName,
      fileUrl: uploadedFileUrl,
      employeeName: employeeForm.employeeName,
      employeeSurname: employeeForm.employeeSurname,
      tradingName: clientForm.clientTradingAsName,
      registeredName: clientForm.clientRegisteredName,
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
    toast({
      title: "Download ready",
      description: "The disciplinary hearing outcome PDF has been downloaded.",
    });
    onRequestClose?.();
  }

  downloadPdfRef.current = handleDownloadPdf;

  const isClientStep = !isFinished && activeStep === 0;
  const isEmployeeStep = !isFinished && activeStep === 1;
  const isHearingDetailsStep = !isFinished && activeStep === 2;
  const isPreviewStep = isFinished;
  const previewWrapperClassName = "rounded-sm bg-white px-8 pt-6 pb-10 text-black shadow-[0_0_0_1px_rgba(148,163,184,0.16)]";
  const previewNumberClassName = "pt-[1px] text-[13px] leading-7 text-black";
  const previewBodyClassName = "text-[13px] leading-7 text-black";
  const previewSectionHeadingClassName = "text-[13px] font-bold uppercase underline underline-offset-2";
  const previewEditableParagraphClassName =
    "rounded-sm transition-colors hover:bg-slate-100/70";
  const placeholderRowClassName = "rounded-sm bg-red-50";
  const isEditablePlaceholder = (value: string) => value.trim() === editablePlaceholderText;
  const getEditorParagraphNumber = (field: EditorTarget, index: number) => {
    if (field === "preliminarySection") return `${index + 1}.`;
    if (field === "issueSection") return `${firstIssueNumber + index}.`;
    if (field === "analysisSection") return `${analysisIntroNumber + index}.`;
    if (field === "preliminaryOne") return "1.";
    if (field === "preliminaryTwo") return "2.";
    if (field === "preliminaryThree") return "3.";
    if (field === "preliminaryFour") return "4.";
    if (field === "preliminaryExtra") return `${5 + index}.`;
    if (field === "issueInDispute") return `${firstIssueNumber}.`;
    if (field === "analysisIntro") return `${analysisIntroNumber}.`;
    if (field === "employeeStatement") return `${employeeStatementNumber}.${index + 1}`;
    if (field === "employerStatement") return `${employerStatementNumber}.${index + 1}`;
    if (field === "employerEvidence") return `${employerEvidenceNumber}.${index + 1}`;
    if (field === "employeeEvidence") return `${employeeEvidenceNumber}.${index + 1}`;
    if (field === "analysisFinding") return `${analysisFindingStartNumber + index}.`;
    if (field === "aggravatingFactors") return `${aggravatingHeadingNumber}.${index + 1}`;
    if (field === "mitigatingFactors") return `${mitigatingHeadingNumber}.${index + 1}`;
    if (field === "recommendation") return `${recommendationHeadingNumber + index}.`;
    return `${index + 1}.`;
  };
  const formatEditorDraft = (field: EditorTarget, value: string) => {
    const paragraphs = normalizeParagraphText(value);
    if (paragraphs.length === 0) {
      return `${getEditorParagraphNumber(field, 0)} `;
    }
    return paragraphs
      .map((paragraph, index) => `${getEditorParagraphNumber(field, index)} ${stripParagraphNumberPrefix(paragraph)}`.trimEnd())
      .join("\n");
  };
  const parseEditorDraft = (value: string) =>
    String(value || "")
      .split(/\r?\n/)
      .map((line) => stripParagraphNumberPrefix(line))
      .filter(Boolean)
      .join("\n");
  const renumberEditorDraft = (field: EditorTarget, lines: string[]) =>
    lines
      .map((line) => stripParagraphNumberPrefix(line))
      .map((line, index) => {
        const prefix = `${getEditorParagraphNumber(field, index)} `;
        return line.length > 0 ? `${prefix}${line}` : prefix;
      })
      .join("\n");

  const removeEditablePlaceholderParagraphs = (value: string) =>
    normalizeParagraphText(value).filter((paragraph) => paragraph.trim() !== editablePlaceholderText);

  const moveEditorCaretToLineEnd = (lineIndex: number) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const textarea = editingTextareaRef.current;
        if (!textarea) return;
        const lines = textarea.value.split(/\r?\n/);
        const targetLineIndex = Math.max(0, Math.min(lineIndex, lines.length - 1));
        const lineStart = lines.slice(0, targetLineIndex).reduce((total, line) => total + line.length + 1, 0);
        const targetPosition = lineStart + (lines[targetLineIndex] || "").length;
        textarea.focus();
        textarea.setSelectionRange(targetPosition, targetPosition);
      });
    });
  };

  const openParagraphEditor = (field: EditorTarget, label: string, selectedLineIndex = 0) => {
    setEditingParagraphId(field);
    setEditingParagraphLabel(label);
    if (field === "preliminarySection") {
      setEditingParagraphDraft(
        [preliminaryOneValue, preliminaryTwoValue, preliminaryThreeValue, preliminaryFourValue, ...normalizeParagraphText(previewForm.preliminaryExtra)]
          .map((paragraph, index) => `${getEditorParagraphNumber("preliminarySection", index)} ${stripParagraphNumberPrefix(paragraph)}`.trimEnd())
          .join("\n"),
      );
      moveEditorCaretToLineEnd(selectedLineIndex);
      return;
    }
    if (field === "issueSection") {
      setEditingParagraphDraft(formatEditorDraft("issueSection", issueInDisputeValue));
      moveEditorCaretToLineEnd(selectedLineIndex);
      return;
    }
    if (field === "analysisSection") {
      const savedAnalysisParagraphs = removeEditablePlaceholderParagraphs(previewForm.analysisFinding);
      setEditingParagraphDraft(
        [analysisIntroValue, ...(savedAnalysisParagraphs.length > 0 ? savedAnalysisParagraphs : [""])]
          .map((paragraph, index) => `${getEditorParagraphNumber("analysisSection", index)} ${stripParagraphNumberPrefix(paragraph)}`.trimEnd())
          .join("\n"),
      );
      moveEditorCaretToLineEnd(selectedLineIndex);
      return;
    }
    if (field === "analysisIntro") {
      setEditingParagraphDraft(`${getEditorParagraphNumber("analysisIntro", 0)} ${stripParagraphNumberPrefix(previewForm.analysisIntro.trim() || analysisIntroValue)}`.trimEnd());
      moveEditorCaretToLineEnd(0);
      return;
    }
    if (field === "analysisFinding") {
      const savedAnalysisParagraphs = removeEditablePlaceholderParagraphs(previewForm.analysisFinding);
      setEditingParagraphDraft(
        (savedAnalysisParagraphs.length > 0 ? savedAnalysisParagraphs : [""])
          .map((paragraph, index) => `${getEditorParagraphNumber("analysisFinding", index)} ${stripParagraphNumberPrefix(paragraph)}`.trimEnd())
          .join("\n"),
      );
      moveEditorCaretToLineEnd(selectedLineIndex);
      return;
    }
    setEditingParagraphDraft(formatEditorDraft(field, previewForm[field]));
    moveEditorCaretToLineEnd(selectedLineIndex);
  };
  const enforceEditorCaretAfterPrefix = (textarea: HTMLTextAreaElement) => {
    if (!editingParagraphId) return;
    const lineIndex = textarea.value.slice(0, textarea.selectionStart).split(/\r?\n/).length - 1;
    const lineStart = textarea.value.lastIndexOf("\n", textarea.selectionStart - 1) + 1;
    const prefix = `${getEditorParagraphNumber(editingParagraphId, lineIndex)} `;
    const minPosition = lineStart + prefix.length;
    if (textarea.selectionStart < minPosition || textarea.selectionEnd < minPosition) {
      textarea.setSelectionRange(minPosition, minPosition);
    }
  };
  const handleEditingParagraphSelect = (event: SyntheticEvent<HTMLTextAreaElement>) => {
    enforceEditorCaretAfterPrefix(event.currentTarget);
  };

  return (
    <div className="h-full overflow-y-auto py-1">
      {isClientStep ? (
        <div className="space-y-4 pt-0">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="disciplinaryOutcomeClientName" className="text-[10px] font-semibold text-slate-600">
                Client Name <span className="text-red-500">*</span>
              </Label>
              <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="disciplinaryOutcomeClientName"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={clientSearchOpen}
                    className={cn(
                      inputClassName,
                      "w-full justify-between px-3 text-[11px] font-medium hover:bg-white hover:text-slate-900 data-[state=open]:bg-white data-[state=open]:text-slate-900",
                      !clientForm.clientId && "text-[10px] text-slate-400",
                    )}
                  >
                    <span className="truncate">{selectedClientLabel}</span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="max-h-[380px] w-[var(--radix-popover-trigger-width)] min-w-[420px] overflow-hidden p-0"
                  onCloseAutoFocus={() => setClientSearchValue("")}
                >
                  <Command shouldFilter={false}>
                    <CommandInput
                      value={clientSearchValue}
                      onValueChange={setClientSearchValue}
                      placeholder="Search registered or trading name..."
                      className="h-8 text-[11px] placeholder:text-[10px]"
                    />
                    <CommandList className="max-h-[320px] overscroll-contain">
                      {filteredClientRows.length === 0 ? (
                        <CommandEmpty className="px-3 py-4 text-sm text-slate-500">{clientLoadMessage}</CommandEmpty>
                      ) : null}
                      <CommandGroup>
                        {filteredClientRows.map((client) => {
                          const label = formatClientDisplayName(client);
                          return (
                            <CommandItem
                              key={client.id}
                              value={`${String(client.registered_name || "").trim()} ${String(client.trading_as || "").trim()}`.trim()}
                              onSelect={() => handleClientSelect(client.id)}
                              className="flex items-center justify-between gap-3 px-3 py-2 text-[10px]"
                            >
                              <span className="min-w-0 truncate font-medium text-slate-900">{label}</span>
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
              <Label htmlFor="disciplinaryOutcomeRegistrationNumber" className="text-[10px] font-semibold text-slate-600">
                Registration Number
              </Label>
              <Input
                id="disciplinaryOutcomeRegistrationNumber"
                value={clientForm.registrationNumber}
                readOnly
                placeholder="Will populate from selected client"
                className={inputClassName}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="disciplinaryOutcomeClientContactNumber" className="text-[10px] font-semibold text-slate-600">
                Contact Number
              </Label>
              <Input
                id="disciplinaryOutcomeClientContactNumber"
                value={clientForm.clientContactNumber}
                readOnly
                placeholder="Will populate from selected client"
                className={inputClassName}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="disciplinaryOutcomeClientEmail" className="text-[10px] font-semibold text-slate-600">
                Client Email
              </Label>
              <Input
                id="disciplinaryOutcomeClientEmail"
                value={clientForm.clientEmail}
                readOnly
                placeholder="Will populate from selected client"
                className={inputClassName}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="disciplinaryOutcomeClientAddress" className="text-[10px] font-semibold text-slate-600">
              Client Address
            </Label>
            <Input
              id="disciplinaryOutcomeClientAddress"
              value={clientForm.clientAddress}
              readOnly
              placeholder="Will populate from selected client"
              className={inputClassName}
            />
          </div>
        </div>
      ) : isEmployeeStep ? (
        <div className="grid gap-4 pt-0 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="disciplinaryOutcomeEmployeeName" className="text-[10px] font-semibold text-slate-600">
              Employee Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="disciplinaryOutcomeEmployeeName"
              value={employeeForm.employeeName}
              onChange={(event) => handleEmployeeFieldChange("employeeName", event.target.value)}
              placeholder="Enter employee name"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="disciplinaryOutcomeEmployeeSurname" className="text-[10px] font-semibold text-slate-600">
              Employee Surname <span className="text-red-500">*</span>
            </Label>
            <Input
              id="disciplinaryOutcomeEmployeeSurname"
              value={employeeForm.employeeSurname}
              onChange={(event) => handleEmployeeFieldChange("employeeSurname", event.target.value)}
              placeholder="Enter employee surname"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="disciplinaryOutcomeEmployeeId" className="text-[10px] font-semibold text-slate-600">
              Employee ID/Passport Number
            </Label>
            <Input
              id="disciplinaryOutcomeEmployeeId"
              value={employeeForm.employeeIdOrPassportNumber}
              onChange={(event) => handleEmployeeFieldChange("employeeIdOrPassportNumber", event.target.value)}
              placeholder="Enter employee ID or passport number"
              maxLength={employeeIdOrPassportMaxLength}
              className={inputClassName}
            />
          </div>
        </div>
      ) : isHearingDetailsStep ? (
        <div className="space-y-4 pt-0">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="disciplinaryOutcomeNoticeDate" className="text-[10px] font-semibold text-slate-600">
                Notice Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="disciplinaryOutcomeNoticeDate"
                type="text"
                readOnly
                value={hearingDetailsForm.noticeDate ? formatDateLabel(hearingDetailsForm.noticeDate) : ""}
                placeholder="Please select a date"
                onClick={() => openHiddenDatePicker(noticeDatePickerRef)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openHiddenDatePicker(noticeDatePickerRef);
                  }
                }}
                className={`${inputClassName} cursor-pointer`}
              />
              <input
                ref={noticeDatePickerRef}
                type="date"
                value={hearingDetailsForm.noticeDate}
                onChange={(event) => handleHearingDetailsFieldChange("noticeDate", event.target.value)}
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="disciplinaryOutcomeHearingDate" className="text-[10px] font-semibold text-slate-600">
                Hearing Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="disciplinaryOutcomeHearingDate"
                type="text"
                readOnly
                value={hearingDetailsForm.hearingDate ? formatDateLabel(hearingDetailsForm.hearingDate) : ""}
                placeholder="Please select a date"
                onClick={() => openHiddenDatePicker(hearingDatePickerRef)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openHiddenDatePicker(hearingDatePickerRef);
                  }
                }}
                className={`${inputClassName} cursor-pointer`}
              />
              <input
                ref={hearingDatePickerRef}
                type="date"
                value={hearingDetailsForm.hearingDate}
                onChange={(event) => handleHearingDetailsFieldChange("hearingDate", event.target.value)}
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="disciplinaryOutcomeHearingFormat" className="text-[10px] font-semibold text-slate-600">
                Hearing Format <span className="text-red-500">*</span>
              </Label>
              <Select
                value={hearingDetailsForm.hearingFormat || undefined}
                onValueChange={(value) => handleHearingDetailsFieldChange("hearingFormat", value as HearingFormat)}
              >
                <SelectTrigger id="disciplinaryOutcomeHearingFormat" className={inputClassName}>
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

            <div className="space-y-2">
              <Label htmlFor="disciplinaryOutcomeEmployeeAttendance" className="text-[10px] font-semibold text-slate-600">
                Employee Attendance <span className="text-red-500">*</span>
              </Label>
              <Select
                value={hearingDetailsForm.employeeAttendance || undefined}
                onValueChange={(value) => handleEmployeeAttendanceChange(value as EmployeeAttendance)}
              >
                <SelectTrigger id="disciplinaryOutcomeEmployeeAttendance" className={inputClassName}>
                  <SelectValue placeholder="Select attendance" />
                </SelectTrigger>
                <SelectContent className="text-[10px]">
                  {employeeAttendanceOptions.map((option) => (
                    <SelectItem key={option} value={option} className="text-[10px]">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="disciplinaryOutcomeHearingProcess" className="text-[10px] font-semibold text-slate-600">
                Hearing Process <span className="text-red-500">*</span>
              </Label>
              <Select
                value={hearingDetailsForm.hearingProcess || undefined}
                onValueChange={(value) => handleHearingDetailsFieldChange("hearingProcess", value as HearingProcess)}
              >
                <SelectTrigger id="disciplinaryOutcomeHearingProcess" className={inputClassName}>
                  <SelectValue placeholder="Select hearing process" />
                </SelectTrigger>
                <SelectContent className="text-[10px]">
                  {visibleHearingProcessOptions.map((option) => (
                    <SelectItem key={option} value={option} className="text-[10px]">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="disciplinaryOutcomeBargainingCouncil" className="text-[10px] font-semibold text-slate-600">
                Bargaining Council <span className="text-red-500">*</span>
              </Label>
              <Popover open={bargainingCouncilPickerOpen} onOpenChange={setBargainingCouncilPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    id="disciplinaryOutcomeBargainingCouncil"
                    type="button"
                    className={cn(
                      inputClassName,
                      "inline-flex w-full items-center justify-between border border-slate-300 px-3 text-[11px] hover:bg-white hover:text-slate-900 data-[state=open]:bg-white data-[state=open]:text-slate-900",
                    )}
                  >
                    <span className="truncate text-left text-slate-900">{selectedBargainingCouncilLabel}</span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  sideOffset={6}
                  className="w-[420px] border border-slate-200 bg-white p-0 shadow-lg"
                  onCloseAutoFocus={() => setBargainingCouncilSearchValue("")}
                >
                  <Command shouldFilter={false} className="bg-white text-slate-700">
                    <CommandInput
                      value={bargainingCouncilSearchValue}
                      onValueChange={setBargainingCouncilSearchValue}
                      placeholder="Search bargaining council..."
                      className="h-8 border-b border-slate-200 text-[11px] placeholder:text-slate-400"
                    />
                    <CommandList>
                      <CommandEmpty className="py-3 text-[11px] text-slate-500">No councils found.</CommandEmpty>
                      <CommandGroup>
                        {filteredBargainingCouncilOptions.map((option) => (
                          <CommandItem
                            key={option.value}
                            value={`${option.value} ${option.label}`}
                            onSelect={() => {
                              handleHearingDetailsFieldChange("bargainingCouncil", option.value);
                              setBargainingCouncilSearchValue("");
                              setBargainingCouncilPickerOpen(false);
                            }}
                            className="text-[11px] text-slate-700 data-[selected=true]:bg-[#3eca44]/10 data-[selected=true]:text-[#2f9f35]"
                          >
                            <Check
                              className={`mr-2 h-3.5 w-3.5 ${
                                hearingDetailsForm.bargainingCouncil === option.value ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            <span className="truncate">{option.label}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="disciplinaryOutcomeRepresentation" className="text-[10px] font-semibold text-slate-600">
                Representation <span className="text-red-500">*</span>
              </Label>
              <Select
                value={hearingDetailsForm.representation || undefined}
                onValueChange={(value) => handleHearingDetailsFieldChange("representation", value as RepresentationOption)}
              >
                <SelectTrigger id="disciplinaryOutcomeRepresentation" className={inputClassName}>
                  <SelectValue placeholder="Select representation" />
                </SelectTrigger>
                <SelectContent className="text-[10px]">
                  {representationOptions.map((option) => (
                    <SelectItem key={option} value={option} className="text-[10px]">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="disciplinaryOutcomeInterpreter" className="text-[10px] font-semibold text-slate-600">
                Interpreter <span className="text-red-500">*</span>
              </Label>
              <Select
                value={hearingDetailsForm.interpreter || undefined}
                onValueChange={(value) => handleHearingDetailsFieldChange("interpreter", value as InterpreterOption)}
              >
                <SelectTrigger id="disciplinaryOutcomeInterpreter" className={inputClassName}>
                  <SelectValue placeholder="Select interpreter option" />
                </SelectTrigger>
                <SelectContent className="text-[10px]">
                  {interpreterOptions.map((option) => (
                    <SelectItem key={option} value={option} className="text-[10px]">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="disciplinaryOutcomeCharges" className="text-[10px] font-semibold text-slate-600">
              Charge <span className="text-red-500">*</span>
            </Label>
            <Popover open={chargePickerOpen} onOpenChange={setChargePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="disciplinaryOutcomeCharges"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={chargePickerOpen}
                  className={cn(
                    inputClassName,
                    "w-full justify-between px-3 text-[11px] font-medium hover:bg-white hover:text-slate-900 data-[state=open]:bg-white data-[state=open]:text-slate-900",
                    hearingDetailsForm.misconductTypes.length === 0 && "text-[10px] text-slate-400",
                  )}
                >
                  <span className="truncate text-left">{selectedChargeLabel}</span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="flex max-h-[380px] w-[var(--radix-popover-trigger-width)] min-w-[420px] flex-col overflow-hidden p-0">
                <Command shouldFilter>
                  <CommandInput
                    placeholder="Search misconduct types..."
                    className="h-8 text-[11px] placeholder:text-[10px]"
                  />
                  <CommandList className="max-h-[248px] overscroll-contain">
                    <CommandEmpty className="px-3 py-4 text-sm text-slate-500">No matching misconduct type found.</CommandEmpty>
                    {offenceCategoryOrder.map((category) => {
                      const offences = conductOffenceOptions.filter((offence) => offence.category === category);
                      if (offences.length === 0) return null;
                      return (
                        <CommandGroup
                          key={category}
                          heading={offenceGroupLabel[category]}
                          className="px-1 [&_[cmdk-group-heading]]:border-b [&_[cmdk-group-heading]]:border-slate-200 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-slate-900"
                        >
                          {offences.map((offence) => {
                            const isSelected = hearingDetailsForm.misconductTypes.includes(offence.name);
                            return (
                              <CommandItem
                                key={`${category}-${offence.name}`}
                                value={`${offenceGroupLabel[category]} ${offence.name}`}
                                onSelect={() => handleToggleCharge(offence.name)}
                                className={cn(
                                  "flex items-center justify-between gap-3 px-3 py-2 text-[10px]",
                                  isSelected ? "text-[#2f9f35]" : "text-slate-600",
                                )}
                              >
                                <span className={cn("min-w-0 truncate font-medium", isSelected ? "text-[#2f9f35]" : "text-slate-600")}>
                                  {offence.name}
                                </span>
                                {isSelected ? <Check className="h-3.5 w-3.5 text-[#2f9f35]" /> : null}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      );
                    })}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {hearingDetailsForm.misconductTypes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {hearingDetailsForm.misconductTypes.map((type) => (
                  <div
                    key={type}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#3eca44] bg-[#3eca44]/10 px-2.5 py-1 text-[10px] font-medium text-[#2f9f35]"
                  >
                    <span className="truncate">{type}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${type}`}
                      onClick={() => handleToggleCharge(type)}
                      className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[#2f9f35] transition-colors hover:text-[#237a28]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {hearingDetailsForm.misconductTypes.length > 0 ? (
            <div className="space-y-4">
              {hearingDetailsForm.misconductTypes.map((type) => (
                <div key={type} className="space-y-2">
                  <Label htmlFor={`disciplinaryOutcomePlea-${type}`} className="text-[10px] font-semibold text-slate-600">
                    Plea for {type} <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={hearingDetailsForm.pleasByCharge[type] || undefined}
                    onValueChange={(value) => handlePleaChange(type, value as PleaOption)}
                  >
                    <SelectTrigger id={`disciplinaryOutcomePlea-${type}`} className={inputClassName}>
                      <SelectValue placeholder="Select plea" />
                    </SelectTrigger>
                    <SelectContent className="text-[10px]">
                      {pleaOptions.map((option) => (
                        <SelectItem key={option} value={option} className="text-[10px]">
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : isPreviewStep ? (
        <div className="h-full py-1">
          <div className="mx-auto max-w-[820px] space-y-5">
            <div className={previewWrapperClassName}>
              <div className="space-y-10">
                <div className="pt-6 text-center">
                  <p className="text-[13px] font-bold uppercase leading-6">In The Disciplinary Hearing</p>
                  <p className="text-[13px] font-bold uppercase leading-6">Held At {clientLocationHeading}</p>
                </div>

                <div className="space-y-4">
                  <p className={previewBodyClassName}>In the matter between:</p>
                  <div className="grid grid-cols-[minmax(0,1fr)_140px] items-center gap-6">
                    <p className="text-[13px] font-bold uppercase leading-7">{clientMatterName}</p>
                    <p className="text-right text-[13px] uppercase leading-7">Employer</p>
                  </div>
                  <p className={previewBodyClassName}>And</p>
                  <div className="grid grid-cols-[minmax(0,1fr)_140px] items-center gap-6">
                    <p className="text-[13px] font-bold uppercase leading-7">{employeeMatterName}</p>
                    <p className="text-right text-[13px] uppercase leading-7">Employee</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="border-t border-black" />
                  <p className="text-center text-[13px] font-bold uppercase leading-6">Outcome Of The Disciplinary Hearing</p>
                  <div className="border-t border-black" />
                </div>

                <div className="space-y-10">
                  <section className="space-y-3">
                    <p className={previewSectionHeadingClassName}>Preliminary</p>
                    <div className="space-y-2">
                      {preliminaryRows.map((row, index) => (
                        <div key={row.number} className="space-y-2">
                          <div className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-4">
                            <div className={previewNumberClassName}>{row.number}</div>
                            <button
                              type="button"
                              onClick={() => (isPreviewEditable ? openParagraphEditor("preliminarySection", "Preliminary", index) : undefined)}
                              className={cn("text-left", isPreviewEditable ? previewEditableParagraphClassName : "")}
                            >
                              <p className={previewBodyClassName}>{row.value}</p>
                            </button>
                          </div>
                          {"subRows" in row && row.subRows.length > 0 ? (
                            <div className="space-y-2 pl-10">
                              {row.subRows.map((subRow) => (
                                <div key={subRow.number} className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4">
                                  <div className={previewNumberClassName}>{subRow.number}</div>
                                  <p className={previewBodyClassName}>{subRow.value}</p>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <p className={previewSectionHeadingClassName}>Issue(s) In Dispute</p>
                    <div className="space-y-2">
                      {issueRows.map((row, index) => (
                        <div key={row.number} className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-4">
                          <div className={previewNumberClassName}>{row.number}</div>
                          <button
                            type="button"
                            onClick={() => (isPreviewEditable ? openParagraphEditor("issueSection", "Issue(s) In Dispute", index) : undefined)}
                            className={cn("text-left", isPreviewEditable ? previewEditableParagraphClassName : "")}
                          >
                            <p className={previewBodyClassName}>{row.value}</p>
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <p className={previewSectionHeadingClassName}>Background To The Issue</p>

                    <div className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-4">
                      <div className={previewNumberClassName}>{`${employeeStatementNumber}.`}</div>
                      <div className="space-y-1.5">
                        <p className={previewBodyClassName}>The Employee&apos;s statement:</p>
                      </div>
                    </div>

                    <div className="pl-10">
                      <div>
                        <button
                          type="button"
                          onClick={() => (isPreviewEditable ? openParagraphEditor("employeeStatement", "The Employee's statement", 0) : undefined)}
                          className={cn(
                            "w-full text-left",
                            isPreviewEditable ? previewEditableParagraphClassName : "",
                          )}
                        >
                          {normalizeParagraphText(employeeStatementValue).map((paragraph, index) => (
                            <div
                              key={`employee-${index}`}
                              onClick={(event) => {
                                if (!isPreviewEditable) return;
                                event.stopPropagation();
                                openParagraphEditor("employeeStatement", "The Employee's statement", index);
                              }}
                              className={cn("grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4", isEditablePlaceholder(paragraph) ? placeholderRowClassName : "")}
                            >
                              <div className={previewNumberClassName}>{`${employeeStatementNumber}.${index + 1}`}</div>
                              <p className={cn(previewBodyClassName, "whitespace-pre-wrap")}>{paragraph}</p>
                            </div>
                          ))}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-4 pt-2">
                      <div className={previewNumberClassName}>{`${employerStatementNumber}.`}</div>
                      <div className="space-y-1.5">
                        <p className={previewBodyClassName}>The Employer&apos;s statement:</p>
                      </div>
                    </div>

                    <div className="pl-10">
                      <div>
                        <button
                          type="button"
                          onClick={() => (isPreviewEditable ? openParagraphEditor("employerStatement", "The Employer's statement", 0) : undefined)}
                          className={cn(
                            "w-full text-left",
                            isPreviewEditable ? previewEditableParagraphClassName : "",
                          )}
                        >
                          {normalizeParagraphText(employerStatementValue).map((paragraph, index) => (
                            <div
                              key={`employer-${index}`}
                              onClick={(event) => {
                                if (!isPreviewEditable) return;
                                event.stopPropagation();
                                openParagraphEditor("employerStatement", "The Employer's statement", index);
                              }}
                              className={cn("grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4", isEditablePlaceholder(paragraph) ? placeholderRowClassName : "")}
                            >
                              <div className={previewNumberClassName}>{`${employerStatementNumber}.${index + 1}`}</div>
                              <p className={cn(previewBodyClassName, "whitespace-pre-wrap")}>{paragraph}</p>
                            </div>
                          ))}
                        </button>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <p className={previewSectionHeadingClassName}>Survey Of Evidence</p>
                    <div className="space-y-3">
                      <div className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-4">
                        <div className={previewNumberClassName}>{`${employerEvidenceNumber}.`}</div>
                        <p className={previewBodyClassName}>The employer submitted the following evidence:</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => (isPreviewEditable ? openParagraphEditor("employerEvidence", "Employer evidence", 0) : undefined)}
                        className={cn("w-full text-left", isPreviewEditable ? previewEditableParagraphClassName : "")}
                      >
                        {employerEvidenceParagraphs.map((paragraph, index) => (
                          <div
                            key={`evidence-employer-${index}`}
                            onClick={(event) => {
                              if (!isPreviewEditable) return;
                              event.stopPropagation();
                              openParagraphEditor("employerEvidence", "Employer evidence", index);
                            }}
                            className={cn("grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4", isEditablePlaceholder(paragraph) ? placeholderRowClassName : "")}
                          >
                            <div className={previewNumberClassName}>{`${employerEvidenceNumber}.${index + 1}`}</div>
                            <p className={cn(previewBodyClassName, "whitespace-pre-wrap")}>{paragraph}</p>
                          </div>
                        ))}
                      </button>
                      <div className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-4 pt-2">
                        <div className={previewNumberClassName}>{`${employeeEvidenceNumber}.`}</div>
                        <p className={previewBodyClassName}>The employee submitted the following evidence:</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => (isPreviewEditable ? openParagraphEditor("employeeEvidence", "Employee evidence", 0) : undefined)}
                        className={cn("w-full text-left", isPreviewEditable ? previewEditableParagraphClassName : "")}
                      >
                        {employeeEvidenceParagraphs.map((paragraph, index) => (
                          <div
                            key={`evidence-employee-${index}`}
                            onClick={(event) => {
                              if (!isPreviewEditable) return;
                              event.stopPropagation();
                              openParagraphEditor("employeeEvidence", "Employee evidence", index);
                            }}
                            className={cn("grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4", isEditablePlaceholder(paragraph) ? placeholderRowClassName : "")}
                          >
                            <div className={previewNumberClassName}>{`${employeeEvidenceNumber}.${index + 1}`}</div>
                            <p className={cn(previewBodyClassName, "whitespace-pre-wrap")}>{paragraph}</p>
                          </div>
                        ))}
                      </button>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <p className={previewSectionHeadingClassName}>Analysis Of Evidence And Finding</p>
                    <div className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4">
                      <div className={previewNumberClassName}>{`${analysisIntroNumber}.`}</div>
                      <button
                        type="button"
                        onClick={() => (isPreviewEditable ? openParagraphEditor("analysisIntro", "Analysis of evidence and finding", 0) : undefined)}
                        className={cn("text-left", isPreviewEditable ? previewEditableParagraphClassName : "")}
                      >
                        <p className={cn(previewBodyClassName, "whitespace-pre-wrap")}>{analysisIntroValue}</p>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => (isPreviewEditable ? openParagraphEditor("analysisFinding", "Analysis finding", 0) : undefined)}
                      className={cn("w-full text-left", isPreviewEditable ? previewEditableParagraphClassName : "")}
                    >
                      {analysisParagraphs.map((paragraph, index) => (
                        <div
                          key={`analysis-${index}`}
                          onClick={(event) => {
                            if (!isPreviewEditable) return;
                            event.stopPropagation();
                            openParagraphEditor("analysisFinding", "Analysis finding", index);
                          }}
                          className={cn("grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4", isEditablePlaceholder(paragraph) ? placeholderRowClassName : "")}
                        >
                          <div className={previewNumberClassName}>{`${analysisFindingStartNumber + index}.`}</div>
                          <p className={cn(previewBodyClassName, "whitespace-pre-wrap")}>{paragraph}</p>
                        </div>
                      ))}
                    </button>
                  </section>

                  <section className="space-y-3">
                    <p className={previewSectionHeadingClassName}>Aggravating And Mitigating</p>
                    <div className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4">
                      <div className={previewNumberClassName}>{`${aggravatingHeadingNumber}.`}</div>
                      <p className={previewBodyClassName}>The following aggravating factors were submitted:</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => (isPreviewEditable ? openParagraphEditor("aggravatingFactors", "Aggravating factors", 0) : undefined)}
                      className={cn("w-full text-left", isPreviewEditable ? previewEditableParagraphClassName : "")}
                    >
                      {aggravatingParagraphs.map((paragraph, index) => (
                        <div
                          key={`aggravating-${index}`}
                          onClick={(event) => {
                            if (!isPreviewEditable) return;
                            event.stopPropagation();
                            openParagraphEditor("aggravatingFactors", "Aggravating factors", index);
                          }}
                          className={cn("grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4", isEditablePlaceholder(paragraph) ? placeholderRowClassName : "")}
                        >
                          <div className={previewNumberClassName}>{`${aggravatingHeadingNumber}.${index + 1}`}</div>
                          <p className={cn(previewBodyClassName, "whitespace-pre-wrap")}>{paragraph}</p>
                        </div>
                      ))}
                    </button>

                    <div className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4 pt-2">
                      <div className={previewNumberClassName}>{`${mitigatingHeadingNumber}.`}</div>
                      <p className={previewBodyClassName}>The following mitigating factors were submitted:</p>
                    </div>
                    {usesNoMitigatingFactorsMessage ? (
                      <div className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4">
                        <div className={previewNumberClassName}>{`${mitigatingHeadingNumber}.1`}</div>
                        <p className={previewBodyClassName}>No mitigating factors were submitted by the employee.</p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => (isPreviewEditable ? openParagraphEditor("mitigatingFactors", "Mitigating factors", 0) : undefined)}
                        className={cn("w-full text-left", isPreviewEditable ? previewEditableParagraphClassName : "")}
                      >
                        {mitigatingParagraphs.map((paragraph, index) => (
                            <div
                              key={`mitigating-${index}`}
                              onClick={(event) => {
                                if (!isPreviewEditable) return;
                                event.stopPropagation();
                                openParagraphEditor("mitigatingFactors", "Mitigating factors", index);
                              }}
                              className={cn("grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4", isEditablePlaceholder(paragraph) ? placeholderRowClassName : "")}
                            >
                            <div className={previewNumberClassName}>{`${mitigatingHeadingNumber}.${index + 1}`}</div>
                            <p className={cn(previewBodyClassName, "whitespace-pre-wrap")}>{paragraph}</p>
                          </div>
                        ))}
                      </button>
                    )}
                  </section>

                  {hasRecommendationSection ? (
                    <section className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className={previewSectionHeadingClassName}>Recommendation</p>
                        {isPreviewEditable ? (
                          <button
                            type="button"
                            onClick={removeRecommendationSection}
                            className="text-[11px] font-medium text-slate-500 transition-colors hover:text-red-600"
                          >
                            Remove Recommendation
                          </button>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => (isPreviewEditable ? openParagraphEditor("recommendation", "Recommendation", 0) : undefined)}
                        className={cn("w-full text-left", isPreviewEditable ? previewEditableParagraphClassName : "")}
                      >
                        {recommendationParagraphs.map((paragraph, index) => (
                          <div
                            key={`recommendation-${index}`}
                            onClick={(event) => {
                              if (!isPreviewEditable) return;
                              event.stopPropagation();
                              openParagraphEditor("recommendation", "Recommendation", index);
                            }}
                            className={cn("grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4", isEditablePlaceholder(paragraph) ? placeholderRowClassName : "")}
                          >
                            <div className={previewNumberClassName}>{`${recommendationHeadingNumber + index}.`}</div>
                            <p className={cn(previewBodyClassName, "whitespace-pre-wrap")}>{paragraph}</p>
                          </div>
                        ))}
                      </button>
                    </section>
                  ) : isPreviewEditable ? (
                    <AddSectionDivider onClick={openAddRecommendationForm} label="Add Recommendation here" />
                  ) : null}

                  <section className="space-y-3">
                    <p className={previewSectionHeadingClassName}>Recourse</p>
                    <div className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4">
                      <div className={previewNumberClassName}>{recourseParagraphNumber}</div>
                      <p className={previewBodyClassName}>{recourseParagraph}</p>
                    </div>
                  </section>

                </div>

                <div className="pt-6">
                  <div className="w-[220px] border-t border-black" />
                  <p className="mt-2 text-[13px] font-bold uppercase leading-7 text-black">Chairperson</p>
                </div>
              </div>
            </div>

            {isPreviewEditable && editingParagraphId ? (
              <div className="fixed inset-0 z-[999]">
                <div className="absolute inset-0 bg-slate-900/35" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Edit ${editingParagraphLabel}`}
                    className="pointer-events-auto w-[94vw] max-w-[680px] overflow-hidden rounded-sm border-0 bg-[#2D4256] shadow-xl"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Pencil className="h-4 w-4 text-white" />
                        <h3 className="text-sm font-semibold text-white">Edit Paragraph</h3>
                      </div>
                      <button
                        type="button"
                        onClick={closeParagraphEditor}
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-white/80 transition hover:bg-white/10 hover:text-white"
                        aria-label="Close"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-4 bg-white px-4 pb-4 pt-5">
                      <Input
                        value={editingParagraphLabel}
                        readOnly
                        className="h-8 border-slate-300 !text-[11px] font-bold text-black hover:border-slate-300 focus:border-slate-300 focus-visible:border-slate-300 focus:ring-0 focus-visible:ring-0"
                      />
                      <p className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Info className="h-3.5 w-3.5" />
                        Press Enter to start the next numbered paragraph.
                      </p>
                      <textarea
                        ref={editingTextareaRef}
                        value={editingParagraphDraft}
                        onChange={(event) => setEditingParagraphDraft(event.target.value)}
                        onKeyDown={handleEditingParagraphKeyDown}
                        onSelect={handleEditingParagraphSelect}
                        onClick={handleEditingParagraphSelect}
                        rows={10}
                        autoFocus
                        className="min-h-[180px] w-full resize-none rounded-sm border-[0.5px] border-slate-300 px-3 py-2 text-[11px] text-slate-700 placeholder:text-[11px] placeholder:text-slate-400 hover:border-slate-500 focus:border-slate-300 focus:outline-none"
                      />
                      <div className="flex items-center justify-center gap-3 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={closeParagraphEditor}
                          className="h-8 w-[92px] rounded border-slate-300 bg-white px-3 text-[11px] text-slate-700 hover:border-[#3eca44] hover:bg-white hover:text-[#2f9f35]"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={saveParagraphEditor}
                          className="h-8 w-[92px] rounded bg-[#3eca44] px-3 text-[11px] text-white hover:bg-[#34b73b]"
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {isPreviewEditable && isAddRecommendationOpen ? (
              <div className="fixed inset-0 z-[999]">
                <div className="absolute inset-0 bg-slate-900/35" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Add recommendation section"
                    className="pointer-events-auto w-[94vw] max-w-[680px] overflow-hidden rounded-sm border-0 bg-[#2D4256] shadow-xl"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4 text-white" />
                        <h3 className="text-sm font-semibold text-white">Add Section</h3>
                      </div>
                      <button
                        type="button"
                        onClick={closeAddRecommendationForm}
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-white/80 transition hover:bg-white/10 hover:text-white"
                        aria-label="Close"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-4 bg-white px-4 pb-4 pt-5">
                      <Input
                        value="Recommendation"
                        readOnly
                        className="h-8 border-slate-300 !text-[11px] font-bold text-black hover:border-slate-300 focus:border-slate-300 focus-visible:border-slate-300 focus:ring-0 focus-visible:ring-0"
                      />
                      <p className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Info className="h-3.5 w-3.5" />
                        Press Enter to start the next paragraph. Numbering is updated automatically.
                      </p>
                      <textarea
                        value={recommendationDraft}
                        onChange={(event) => setRecommendationDraft(event.target.value)}
                        rows={8}
                        autoFocus
                        className="min-h-[180px] w-full resize-none rounded-sm border-[0.5px] border-slate-300 px-3 py-2 text-[11px] text-slate-700 placeholder:text-[11px] placeholder:text-slate-400 hover:border-slate-500 focus:border-slate-300 focus:outline-none"
                        placeholder="Please start typing here..."
                      />
                      <div className="flex items-center justify-center gap-3 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={closeAddRecommendationForm}
                          className="h-8 w-[92px] rounded border-slate-300 bg-white px-3 text-[11px] text-slate-700 hover:border-[#3eca44] hover:bg-white hover:text-[#2f9f35]"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={saveAddRecommendationForm}
                          className="h-8 w-[92px] rounded bg-[#3eca44] px-3 text-[11px] text-white hover:bg-[#34b73b]"
                        >
                          Add Section
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DisciplinaryHearingOutcomeGenerator;
