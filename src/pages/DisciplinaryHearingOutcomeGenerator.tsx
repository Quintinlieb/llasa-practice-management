import { useEffect, useMemo, useRef, useState, type ComponentType, type RefObject, type SVGProps } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Check, ChevronsUpDown, FileText, Info, Pencil, User2, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
  representation: RepresentationOption | "";
  interpreter: InterpreterOption | "";
  pleasByCharge: Record<string, PleaOption | "">;
};

type PreviewFormState = {
  employeeStatement: string;
  employerStatement: string;
  employerEvidence: string;
  employeeEvidence: string;
  analysisFinding: string;
  aggravatingMitigating: string;
};

type OutcomeDraftState = {
  activeStep: number;
  isFinished: boolean;
  clientForm: ClientFormState;
  employeeForm: EmployeeFormState;
  hearingDetailsForm: HearingDetailsFormState;
  previewForm: PreviewFormState;
  isPreviewEditable: boolean;
};

const steps = ["Client Details", "Employee Details", "Hearing Details", "Preview"] as const;
const stepIcons = [Building2, User2, FileText, Check] as const;
const employeeIdOrPassportMaxLength = 13;

const inputClassName =
  "h-8 rounded-sm border-slate-300 bg-white !text-[10px] md:!text-[10px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] md:placeholder:!text-[10px] placeholder:font-normal placeholder:text-slate-400 hover:border-[#3eca44] focus-visible:border-[#3eca44] focus-visible:ring-0";

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
  representation: "",
  interpreter: "",
  pleasByCharge: {},
};

const emptyPreviewFormState: PreviewFormState = {
  employeeStatement: "",
  employerStatement: "",
  employerEvidence: "",
  employeeEvidence: "",
  analysisFinding: "",
  aggravatingMitigating: "",
};

const hearingFormatOptions: Array<{ value: HearingFormat; label: string }> = [
  { value: "in_person", label: "In person" },
  { value: "virtual", label: "Virtual" },
];

const employeeAttendanceOptions: readonly EmployeeAttendance[] = ["Absent", "Present"] as const;
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

const normalizeHearingDetailsFormState = (value: unknown): HearingDetailsFormState => {
  const candidate = (value && typeof value === "object" ? value : {}) as Partial<HearingDetailsFormState>;
  return {
    ...emptyHearingDetailsFormState,
    ...candidate,
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
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

const parseDraftState = (value: unknown): OutcomeDraftState => {
  if (!value || typeof value !== "object") {
    return {
      activeStep: 0,
      isFinished: false,
      clientForm: emptyClientFormState,
      employeeForm: emptyEmployeeFormState,
      hearingDetailsForm: emptyHearingDetailsFormState,
      previewForm: emptyPreviewFormState,
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
    isPreviewEditable: Boolean(candidate.isPreviewEditable),
  };
};

const DisciplinaryHearingOutcomeGenerator = ({
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
  const [isPreviewEditable, setIsPreviewEditable] = useState(initialDraft.isPreviewEditable);
  const [clientRows, setClientRows] = useState<ClientRow[]>([]);
  const [clientLoadMessage, setClientLoadMessage] = useState("Loading clients...");
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [chargePickerOpen, setChargePickerOpen] = useState(false);
  const noticeDatePickerRef = useRef<HTMLInputElement | null>(null);
  const hearingDatePickerRef = useRef<HTMLInputElement | null>(null);
  const lastEmittedDraftSnapshotRef = useRef<string | null>(null);
  const [editingParagraphId, setEditingParagraphId] = useState<keyof PreviewFormState | null>(null);
  const [editingParagraphLabel, setEditingParagraphLabel] = useState("");
  const [editingParagraphDraft, setEditingParagraphDraft] = useState("");

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
    setIsPreviewEditable(nextDraft.isPreviewEditable);
  }, [draftState]);

  useEffect(() => {
    let isMounted = true;
    const loadClients = async () => {
      if (!user?.id) {
        if (isMounted) setClientLoadMessage("Sign in to load clients.");
        return;
      }
      const { data, error } = await (supabase as any)
        .from("clients")
        .select("id, registered_name, trading_as, company_type, registration_number, owner_number, primary_number, owner_email, primary_email, physical_address_line1, physical_address_line2, city, province, area_code")
        .order("registered_name", { ascending: true, nullsFirst: false });
      if (!isMounted) return;
      if (error) {
        setClientRows([]);
        setClientLoadMessage("Unable to load clients.");
        return;
      }
      const rows = Array.isArray(data) ? (data as ClientRow[]) : [];
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
      isPreviewEditable,
    } satisfies OutcomeDraftState;
    lastEmittedDraftSnapshotRef.current = serializeOutcomeDraftState(nextDraftState);
    onDraftStateChange?.(nextDraftState);
  }, [activeStep, clientForm, employeeForm, hearingDetailsForm, isFinished, isPreviewEditable, onDraftStateChange, previewForm]);

  useEffect(() => {
    onStepChange?.(isFinished ? steps[3] : steps[Math.min(activeStep, steps.length - 1)] ?? null);
  }, [activeStep, isFinished, onStepChange]);

  const isClientStepValid = Boolean(clientForm.clientId.trim());
  const isEmployeeStepValid = Boolean(
    employeeForm.employeeName.trim() &&
      employeeForm.employeeSurname.trim() &&
      employeeForm.employeeIdOrPassportNumber.trim(),
  );
  const selectedPleaCount = hearingDetailsForm.misconductTypes.filter((type) =>
    Boolean(String(hearingDetailsForm.pleasByCharge[type] || "").trim()),
  ).length;
  const isHearingDetailsStepValid = Boolean(
    hearingDetailsForm.noticeDate.trim() &&
      hearingDetailsForm.hearingDate.trim() &&
      hearingDetailsForm.hearingFormat.trim() &&
      hearingDetailsForm.misconductTypes.length > 0 &&
      hearingDetailsForm.employeeAttendance.trim() &&
      hearingDetailsForm.representation.trim() &&
      hearingDetailsForm.interpreter.trim() &&
      selectedPleaCount === hearingDetailsForm.misconductTypes.length,
  );

  useEffect(() => {
    onStepMetaChange?.({
      steps,
      activeStep: isFinished ? 3 : activeStep,
      icons: stepIcons,
      canGoBack: isFinished || activeStep > 0,
      canGoNext:
        isFinished
          ? false
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
        if (isFinished) return;
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
          setChargePickerOpen(false);
          return;
        }
      },
      supportsResetAtFirstStep: Boolean(clientForm.clientId.trim()),
      isFinished,
    });
  }, [activeStep, clientForm.clientId, isClientStepValid, isEmployeeStepValid, isFinished, isHearingDetailsStepValid, isPreviewEditable, onStepMetaChange]);

  const selectedClientLabel = clientForm.clientId ? clientForm.clientName : "Select client";

  const handleClientSelect = (clientId: string) => {
    const selectedClient = clientRows.find((row) => row.id === clientId);
    if (!selectedClient) return;
    setClientForm(mapClientToFormState(selectedClient));
    setEmployeeForm(emptyEmployeeFormState);
    setHearingDetailsForm(emptyHearingDetailsFormState);
    setPreviewForm(emptyPreviewFormState);
    setActiveStep(0);
    setIsFinished(false);
    setIsPreviewEditable(false);
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

  const handlePleaChange = (charge: string, plea: PleaOption) => {
    setHearingDetailsForm((current) => ({
      ...current,
      pleasByCharge: {
        ...current.pleasByCharge,
        [charge]: plea,
      },
    }));
  };

  const openParagraphEditor = (field: keyof PreviewFormState, label: string) => {
    setEditingParagraphId(field);
    setEditingParagraphLabel(label);
    setEditingParagraphDraft(previewForm[field]);
  };

  const closeParagraphEditor = () => {
    setEditingParagraphId(null);
    setEditingParagraphLabel("");
    setEditingParagraphDraft("");
  };

  const saveParagraphEditor = () => {
    if (!editingParagraphId) return;
    if (!editingParagraphDraft.trim()) {
      toast({
        title: "Edit paragraph",
        description: "Paragraph text cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    setPreviewForm((current) => ({
      ...current,
      [editingParagraphId]: editingParagraphDraft.trim(),
    }));
    closeParagraphEditor();
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
  const employeeStatementValue = previewForm.employeeStatement.trim() || "Please start typing here...";
  const employerStatementValue = previewForm.employerStatement.trim() || "Please start typing here...";
  const employerEvidenceValue = previewForm.employerEvidence.trim() || "Please start typing here...";
  const employeeEvidenceValue = previewForm.employeeEvidence.trim() || "Please start typing here...";
  const analysisFindingValue = previewForm.analysisFinding.trim() || "Please start typing here...";
  const aggravatingMitigatingValue = previewForm.aggravatingMitigating.trim() || "Please start typing here...";
  const selectedMisconductCount = hearingDetailsForm.misconductTypes.length;
  const representationSentence =
    hearingDetailsForm.representation === "Conduct own defense"
      ? " and represented him/her self."
      : hearingDetailsForm.representation
        ? ` and was represented by ${withIndefiniteArticle(hearingDetailsForm.representation)}.`
        : ".";
  const pleaSentences = hearingDetailsForm.misconductTypes
    .map((type) => {
      const plea = toSentenceCaseLower(String(hearingDetailsForm.pleasByCharge[type] || "").trim());
      const charge = toSentenceCaseLower(type);
      return plea && charge ? `In respect of ${charge}, the employee pleaded ${plea}.` : "";
    })
    .filter(Boolean)
    .join(" ");
  const preliminaryRows = [
    {
      number: "1.",
      value: `The disciplinary hearing was held on ${formatDateLabel(hearingDetailsForm.hearingDate) || "______________________________"}.`,
    },
    {
      number: "2.",
      value: `The employee was ${String(hearingDetailsForm.employeeAttendance || "______________________________").toLowerCase()} at the hearing${representationSentence}`,
    },
    {
      number: "3.",
      value: `The employee received the notice to attend on ${formatDateLabel(hearingDetailsForm.noticeDate) || "______________________________"}.`,
    },
    {
      number: "4.",
      value:
        selectedMisconductCount > 0
          ? `The employee was charged with ${misconductListLabel}.${pleaSentences ? ` ${pleaSentences}` : ""}`
          : "The employee was charged with ______________________________.",
    },
  ] as const;
  const issueRows = [
    {
      number: "5.",
      value:
        "I must determine whether there are sufficient grounds to prove, on a balance of probability, that the alleged misconduct was committed and further that a fair and reasonable procedure has been followed.",
    },
  ] as const;
  const employerEvidenceParagraphs = normalizeParagraphText(employerEvidenceValue);
  const employeeEvidenceParagraphs = normalizeParagraphText(employeeEvidenceValue);
  const analysisParagraphs = normalizeParagraphText(analysisFindingValue);
  const aggravatingParagraphs = normalizeParagraphText(aggravatingMitigatingValue);
  const recourseParagraph =
    "If the employer chooses to dismiss the employee, he/she must be notified that he/she may refer a dispute to the CCMA within 30 (THIRTY) days of dismissal or alternatively, apply for an appeal to the outcome within 3 (THREE) days of dismissal.";
  const recourseParagraphNumber = `${13 + aggravatingParagraphs.length}.`;
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
                <PopoverContent align="start" className="max-h-[380px] w-[var(--radix-popover-trigger-width)] min-w-[420px] overflow-hidden p-0">
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
              Employee ID/Passport Number <span className="text-red-500">*</span>
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
                onValueChange={(value) => handleHearingDetailsFieldChange("employeeAttendance", value as EmployeeAttendance)}
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
                      {preliminaryRows.map((row) => (
                        <div key={row.number} className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-4">
                          <div className={previewNumberClassName}>{row.number}</div>
                          <p className={previewBodyClassName}>{row.value}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <p className={previewSectionHeadingClassName}>Issue(s) In Dispute</p>
                    <div className="space-y-2">
                      {issueRows.map((row) => (
                        <div key={row.number} className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-4">
                          <div className={previewNumberClassName}>{row.number}</div>
                          <p className={previewBodyClassName}>{row.value}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <p className={previewSectionHeadingClassName}>Background To The Issue</p>

                    <div className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-4">
                      <div className={previewNumberClassName}>6.</div>
                      <div className="space-y-1.5">
                        <p className={previewBodyClassName}>The Employee&apos;s statement:</p>
                      </div>
                    </div>

                    <div className="pl-10">
                      <div>
                        <button
                          type="button"
                          onClick={() => (isPreviewEditable ? openParagraphEditor("employeeStatement", "The Employee's statement") : undefined)}
                          className={cn(
                            "w-full text-left",
                            isPreviewEditable ? previewEditableParagraphClassName : "",
                          )}
                        >
                          {normalizeParagraphText(employeeStatementValue).map((paragraph, index) => (
                            <div key={`employee-${index}`} className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4">
                              <div className={previewNumberClassName}>{`6.${index + 1}`}</div>
                              <p className={cn(previewBodyClassName, "whitespace-pre-wrap")}>{paragraph}</p>
                            </div>
                          ))}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-4 pt-2">
                      <div className={previewNumberClassName}>7.</div>
                      <div className="space-y-1.5">
                        <p className={previewBodyClassName}>The Employer&apos;s statement:</p>
                      </div>
                    </div>

                    <div className="pl-10">
                      <div>
                        <button
                          type="button"
                          onClick={() => (isPreviewEditable ? openParagraphEditor("employerStatement", "The Employer's statement") : undefined)}
                          className={cn(
                            "w-full text-left",
                            isPreviewEditable ? previewEditableParagraphClassName : "",
                          )}
                        >
                          {normalizeParagraphText(employerStatementValue).map((paragraph, index) => (
                            <div key={`employer-${index}`} className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4">
                              <div className={previewNumberClassName}>{`7.${index + 1}`}</div>
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
                        <div className={previewNumberClassName}>8.</div>
                        <p className={previewBodyClassName}>The employer submitted the following evidence:</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => (isPreviewEditable ? openParagraphEditor("employerEvidence", "Employer evidence") : undefined)}
                        className={cn("w-full text-left", isPreviewEditable ? previewEditableParagraphClassName : "")}
                      >
                        {employerEvidenceParagraphs.map((paragraph, index) => (
                          <div key={`evidence-employer-${index}`} className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4">
                            <div className={previewNumberClassName}>{`8.${index + 1}`}</div>
                            <p className={cn(previewBodyClassName, "whitespace-pre-wrap")}>{paragraph}</p>
                          </div>
                        ))}
                      </button>
                      <div className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-4 pt-2">
                        <div className={previewNumberClassName}>9.</div>
                        <p className={previewBodyClassName}>The employee submitted the following evidence:</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => (isPreviewEditable ? openParagraphEditor("employeeEvidence", "Employee evidence") : undefined)}
                        className={cn("w-full text-left", isPreviewEditable ? previewEditableParagraphClassName : "")}
                      >
                        {employeeEvidenceParagraphs.map((paragraph, index) => (
                          <div key={`evidence-employee-${index}`} className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4">
                            <div className={previewNumberClassName}>{`9.${index + 1}`}</div>
                            <p className={cn(previewBodyClassName, "whitespace-pre-wrap")}>{paragraph}</p>
                          </div>
                        ))}
                      </button>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <p className={previewSectionHeadingClassName}>Analysis Of Evidence And Finding</p>
                    <button
                      type="button"
                      onClick={() => (isPreviewEditable ? openParagraphEditor("analysisFinding", "Analysis of evidence and finding") : undefined)}
                      className={cn("w-full text-left", isPreviewEditable ? previewEditableParagraphClassName : "")}
                    >
                      {analysisParagraphs.map((paragraph, index) => (
                        <div key={`analysis-${index}`} className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4">
                          <div className={previewNumberClassName}>{`${index + 10}.`}</div>
                          <p className={cn(previewBodyClassName, "whitespace-pre-wrap")}>{paragraph}</p>
                        </div>
                      ))}
                    </button>
                  </section>

                  <section className="space-y-3">
                    <p className={previewSectionHeadingClassName}>Aggravating And Mitigating</p>
                    <button
                      type="button"
                      onClick={() => (isPreviewEditable ? openParagraphEditor("aggravatingMitigating", "Aggravating and mitigating") : undefined)}
                      className={cn("w-full text-left", isPreviewEditable ? previewEditableParagraphClassName : "")}
                    >
                      {aggravatingParagraphs.map((paragraph, index) => (
                        <div key={`aggravating-${index}`} className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4">
                          <div className={previewNumberClassName}>{`${index + 13}.`}</div>
                          <p className={cn(previewBodyClassName, "whitespace-pre-wrap")}>{paragraph}</p>
                        </div>
                      ))}
                    </button>
                  </section>

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
                        Separate paragraphs with a blank line. Numbering is updated automatically.
                      </p>
                      <textarea
                        value={editingParagraphDraft}
                        onChange={(event) => setEditingParagraphDraft(event.target.value)}
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
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DisciplinaryHearingOutcomeGenerator;
