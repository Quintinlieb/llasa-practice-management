import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ComponentType, type SVGProps } from "react";
import { PageDateStamp } from "@/components/DashboardLayout";
import { cn } from "@/lib/utils";
import { useLocation, useNavigate } from "react-router-dom";
import { DocumentMagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  loadMinimizedDocumentTabs,
  minimizedDocumentTabsChangedEvent,
  saveMinimizedDocumentTabs,
  type StoredMinimizedDocumentTab,
} from "@/lib/minimizedDocumentTabs";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight, Menu, Minus, Search, Undo2, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";

type DocumentKey =
  | "codeOfConduct"
  | "discWarningGenerator"
  | "hearingNotice"
  | "abscondHearingNotice"
  | "disciplinaryHearingOutcome"
  | "precautionarySuspensionNotice"
  | "contemplatedRetrenchmentNotice"
  | "incapacityPerformanceHearingNotice"
  | "incapacityIllHealthHearingNotice"
  | "serviceCertificate"
  | "acknowledgementOfDebt"
  | "permContract"
  | "temporaryContract"
  | "addendum"
  | "noticeTermination"
  | "illHealthTermination"
  | "abscondmentTermination"
  | "retrenchmentTermination"
  | "retirementTermination"
  | "poorPerformanceTermination"
  | "mutualTermination";
type ModalDocumentKey = DocumentKey;

type DocumentComponentProps = {
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

type DocumentTableRow = {
  id: string;
  documentName: string;
  documentType: string;
  clientName: string;
  createdOn: string;
  createdAtRaw: string;
  createdBy: string;
  fileUrl: string;
};

type CurrentUserSubuserRoleRow = {
  role: string | null;
};

type StepNotes = readonly [
  readonly string[],
  readonly string[],
  readonly string[],
  readonly string[],
];

type MinimizedGeneratorTab = {
  id: string;
  documentKey: ModalDocumentKey;
  label: string;
  instanceNumber?: number;
  minimizedOrder?: number;
  draftState?: unknown;
};

const normalizeLegacyDocumentKey = (value: string | null | undefined): DocumentKey | null =>
  value === "disciplinaryHearingNotice"
    ? "hearingNotice"
    : value && value in documentComponents
      ? (value as DocumentKey)
      : null;

const documentsTableCacheKey = "documents:table-cache";
const DOCUMENTS_TABLE_PAGE_SIZE = 25;
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
const buildDocumentClientLabel = (registeredName: unknown, companyType: unknown, tradingAs: unknown) => {
  const registered = String(registeredName ?? "").trim();
  const type = String(companyType ?? "").trim();
  const trading = String(tradingAs ?? "").trim();
  const registeredWithType = registered ? appendCompanyTypeSuffix(registered, type) : "";
  if (registeredWithType && trading) {
    return `${registeredWithType} t/a ${trading}`;
  }
  return registeredWithType || trading || "";
};
const getDocumentClientLabelFromRelation = (value: unknown) => {
  const client = Array.isArray(value) ? value[0] : value;
  if (!client || typeof client !== "object") return "";
  return buildDocumentClientLabel(
    (client as { registered_name?: unknown }).registered_name,
    (client as { company_type?: unknown }).company_type,
    (client as { trading_as?: unknown }).trading_as,
  );
};

const formatDocumentClientName = (value: string) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parts = raw.split(/\s+t\/a\s+/i);
  return parts.length > 1 ? String(parts[parts.length - 1] || "").trim() || raw : raw;
};

const getDocumentTypePillClassName = (type: string) => {
  const normalized = type.toLowerCase();
  if (normalized.includes("warning")) {
    return "border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-50 hover:text-orange-600";
  }
  if (normalized.includes("notice")) {
    return "border-violet-600 bg-violet-50 text-violet-700 hover:bg-violet-50 hover:text-violet-700";
  }
  if (normalized.includes("termination") || normalized.includes("retrenchment") || normalized.includes("abscondment")) {
    return "border-rose-600 bg-rose-50 text-rose-700 hover:bg-rose-50 hover:text-rose-700";
  }
  if (normalized.includes("outcome")) {
    return "border-blue-600 bg-blue-50 text-blue-700 hover:bg-blue-50 hover:text-blue-700";
  }
  if (normalized.includes("contract") || normalized.includes("addendum")) {
    return "border-slate-600 bg-slate-100 text-slate-800 hover:bg-slate-100 hover:text-slate-800";
  }
  if (normalized.includes("other") || normalized.includes("service") || normalized.includes("certificate") || normalized.includes("debt")) {
    return "border-slate-500 bg-slate-100 text-slate-700 hover:bg-slate-100 hover:text-slate-700";
  }
  return "border-slate-500 bg-slate-100 text-slate-700 hover:bg-slate-100 hover:text-slate-700";
};

const getInitials = (value: unknown) => {
  const tokens = String(value ?? "").trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "--";
  return tokens.slice(0, 2).map((token) => token.charAt(0).toUpperCase()).join("");
};

const getDiscWarningBreadcrumbClientName = (draftState: unknown) => {
  if (!draftState || typeof draftState !== "object") return "";
  const clientForm = (draftState as { clientForm?: unknown }).clientForm;
  if (!clientForm || typeof clientForm !== "object") return "";
  const candidate = clientForm as {
    clientTradingAsName?: unknown;
    clientRegisteredName?: unknown;
  };
  const tradingAsName = String(candidate.clientTradingAsName || "").trim();
  if (tradingAsName) return tradingAsName;
  return String(candidate.clientRegisteredName || "").trim();
};

const getDiscHearingBreadcrumbClientName = (draftState: unknown) => {
  if (!draftState || typeof draftState !== "object") return "";
  const clientForm = (draftState as { clientForm?: unknown }).clientForm;
  if (!clientForm || typeof clientForm !== "object") return "";
  const candidate = clientForm as {
    clientTradingAsName?: unknown;
    clientRegisteredName?: unknown;
  };
  const tradingAsName = String(candidate.clientTradingAsName || "").trim();
  if (tradingAsName) return tradingAsName;
  return String(candidate.clientRegisteredName || "").trim();
};

const getHearingNoticeBreadcrumbType = (draftState: unknown) => {
  if (!draftState || typeof draftState !== "object") return "";
  const candidate = draftState as {
    hearingType?: unknown;
    hearingNoticeType?: unknown;
    noticeForm?: unknown;
  };
  const directType = String(candidate.hearingType || candidate.hearingNoticeType || "").trim();
  if (directType) return directType;
  const noticeForm = candidate.noticeForm;
  if (!noticeForm || typeof noticeForm !== "object") return "";
  const noticeCandidate = noticeForm as {
    hearingType?: unknown;
    hearingNoticeType?: unknown;
  };
  return String(noticeCandidate.hearingType || noticeCandidate.hearingNoticeType || "").trim();
};

const formatHearingNoticeBreadcrumbTitle = (draftState: unknown) => {
  const hearingType = getHearingNoticeBreadcrumbType(draftState);
  const clientName = getDiscHearingBreadcrumbClientName(draftState);
  const parts = ["Hearing Notice"];
  if (hearingType) parts.push(hearingType);
  const base = parts.join(" / ");
  return clientName ? `${base} (${clientName})` : base;
};

const getAbscondHearingBreadcrumbClientName = (draftState: unknown) => {
  if (!draftState || typeof draftState !== "object") return "";
  const clientDetails = (draftState as { clientDetails?: unknown }).clientDetails;
  if (!clientDetails || typeof clientDetails !== "object") return "";
  const candidate = clientDetails as {
    tradingAs?: unknown;
    registeredName?: unknown;
    clientName?: unknown;
  };
  const tradingAsName = String(candidate.tradingAs || "").trim();
  if (tradingAsName) return tradingAsName;
  const registeredName = String(candidate.registeredName || "").trim();
  if (registeredName) return registeredName;
  return String(candidate.clientName || "").trim();
};

const getDiscHearingOutcomeBreadcrumbClientName = (draftState: unknown) => {
  if (!draftState || typeof draftState !== "object") return "";
  const clientForm = (draftState as { clientForm?: unknown }).clientForm;
  if (!clientForm || typeof clientForm !== "object") return "";
  const candidate = clientForm as {
    clientTradingAsName?: unknown;
    clientRegisteredName?: unknown;
  };
  const tradingAsName = String(candidate.clientTradingAsName || "").trim();
  if (tradingAsName) return tradingAsName;
  return String(candidate.clientRegisteredName || "").trim();
};

const getDiscHearingOutcomeBreadcrumbType = (draftState: unknown) => {
  if (!draftState || typeof draftState !== "object") return "";
  const candidate = draftState as {
    hearingType?: unknown;
    hearingDetailsForm?: unknown;
  };
  const directType = String(candidate.hearingType || "").trim();
  if (directType) return directType;
  const hearingDetailsForm = candidate.hearingDetailsForm;
  if (!hearingDetailsForm || typeof hearingDetailsForm !== "object") return "";
  return String((hearingDetailsForm as { hearingType?: unknown }).hearingType || "").trim();
};

const getDiscHearingOutcomeBreadcrumbTitle = (draftState: unknown) => {
  const hearingType = getDiscHearingOutcomeBreadcrumbType(draftState);
  return hearingType ? `${hearingType} Hearing` : "Hearing";
};

const getPermContractBreadcrumbClientName = (draftState: unknown) => {
  if (!draftState || typeof draftState !== "object") return "";
  const company = (draftState as { company?: unknown }).company;
  if (!company || typeof company !== "object") return "";
  const candidate = company as {
    tradingName?: unknown;
    registeredName?: unknown;
    companyName?: unknown;
  };
  const tradingName = String(candidate.tradingName || "").trim();
  if (tradingName) return tradingName;
  const registeredName = String(candidate.registeredName || "").trim();
  if (registeredName) return registeredName;
  return String(candidate.companyName || "").trim();
};

const getMiscTerminationBreadcrumbClientName = (draftState: unknown) => {
  if (!draftState || typeof draftState !== "object") return "";
  const client = (draftState as { client?: unknown }).client;
  if (!client || typeof client !== "object") return "";
  const candidate = client as {
    tradingName?: unknown;
  };
  return String(candidate.tradingName || "").trim();
};

const splitCreatedOnParts = (value: string) => {
  const raw = String(value || "").trim();
  if (!raw) return { date: "", time: "" };
  const parts = raw.split(", ");
  if (parts.length < 2) return { date: raw, time: "" };
  return {
    date: parts.slice(0, -1).join(", "),
    time: parts[parts.length - 1] || "",
  };
};

const documentsTableGridClassName = "grid-cols-[24px_0.72fr_2.35fr_2.05fr_0.82fr_1fr_0.36fr]";

const loadCachedDocumentRows = (): DocumentTableRow[] => {
  try {
    const raw = sessionStorage.getItem(documentsTableCacheKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is DocumentTableRow =>
        Boolean(row) &&
        typeof row === "object" &&
        typeof (row as DocumentTableRow).id === "string" &&
        typeof (row as DocumentTableRow).documentName === "string" &&
        typeof (row as DocumentTableRow).documentType === "string" &&
        typeof (row as DocumentTableRow).clientName === "string" &&
        typeof (row as DocumentTableRow).createdOn === "string" &&
        typeof (row as DocumentTableRow).createdAtRaw === "string" &&
        typeof (row as DocumentTableRow).createdBy === "string" &&
        typeof (row as DocumentTableRow).fileUrl === "string",
    );
  } catch {
    return [];
  }
};

const saveCachedDocumentRows = (rows: DocumentTableRow[]) => {
  try {
    sessionStorage.setItem(documentsTableCacheKey, JSON.stringify(rows));
  } catch {
    // ignore storage errors
  }
};

const lazyDocumentComponent = (loader: () => Promise<any>) =>
  lazy(async () => {
    const mod = await loader();
    return { default: mod.default as ComponentType<DocumentComponentProps> };
  });

const documentComponents: Record<DocumentKey, ComponentType<DocumentComponentProps>> = {
  codeOfConduct: lazyDocumentComponent(() => import("./documents/discipline/CodeOfConductPreview")),
  discWarningGenerator: lazyDocumentComponent(() => import("./DiscWarningGenerator")),
  hearingNotice: lazyDocumentComponent(() => import("./HearingNoticeGenerator")),
  abscondHearingNotice: lazyDocumentComponent(() => import("./AbscondHearingNoticeGenerator")),
  disciplinaryHearingOutcome: lazyDocumentComponent(() => import("./DisciplinaryHearingOutcomeGenerator")),
  precautionarySuspensionNotice: lazyDocumentComponent(() => import("./PrecautionarySuspensionNoticeGenerator")),
  contemplatedRetrenchmentNotice: lazyDocumentComponent(() => import("./ContemplatedRetrenchmentNoticeGenerator")),
  incapacityPerformanceHearingNotice: lazyDocumentComponent(() => import("./IncapacityPerformanceHearingNoticeGenerator")),
  incapacityIllHealthHearingNotice: lazyDocumentComponent(() => import("./IncapacityIllHealthHearingNoticeGenerator")),
  serviceCertificate: lazyDocumentComponent(() => import("./ServiceCertificateGenerator")),
  acknowledgementOfDebt: lazyDocumentComponent(() => import("./AcknowledgementOfDebtGenerator")),
  permContract: lazyDocumentComponent(() => import("./PermContractGenerator")),
  temporaryContract: lazyDocumentComponent(() => import("./TemporaryContractGenerator")),
  addendum: lazyDocumentComponent(() => import("./AddendumGenerator")),
  noticeTermination: lazyDocumentComponent(() => import("./MiscTermLetterGenerator")),
  illHealthTermination: lazyDocumentComponent(() => import("./IllHealthTerminationGenerator")),
  abscondmentTermination: lazyDocumentComponent(() => import("./AbscondmentTerminationGenerator")),
  retrenchmentTermination: lazyDocumentComponent(() => import("./RetrenchmentTerminationGenerator")),
  retirementTermination: lazyDocumentComponent(() => import("./RetirementTerminationGenerator")),
  poorPerformanceTermination: lazyDocumentComponent(() => import("./PoorPerformanceTerminationGenerator")),
  mutualTermination: lazyDocumentComponent(() => import("./MutualTerminationGenerator")),
};

const documentMeta: Record<DocumentKey, { category: string; label: string }> = {
  codeOfConduct: { category: "Discipline", label: "Code of Conduct" },
  discWarningGenerator: { category: "Discipline", label: "Warnings 2" },
  hearingNotice: { category: "Notices", label: "Hearing Notice" },
  abscondHearingNotice: { category: "Notices", label: "Abscondment Letter" },
  disciplinaryHearingOutcome: { category: "Outcome", label: "Hearing Outcome" },
  precautionarySuspensionNotice: { category: "Notices", label: "Precautionary Suspension" },
  contemplatedRetrenchmentNotice: { category: "Notices", label: "Contemplated Retrenchment (S189)" },
  incapacityPerformanceHearingNotice: { category: "Notices", label: "Incapacity Hearing (Performance)" },
  incapacityIllHealthHearingNotice: { category: "Notices", label: "Incapacity Hearing (Ill health)" },
  serviceCertificate: { category: "Other", label: "Certificate of Service" },
  acknowledgementOfDebt: { category: "Other", label: "Acknowledgement of Debt" },
  permContract: { category: "Contracts", label: "Permanent" },
  temporaryContract: { category: "Contracts", label: "Temporary Contract" },
  addendum: { category: "Contracts", label: "Addendum" },
  noticeTermination: { category: "Terminations", label: "Misconduct" },
  illHealthTermination: { category: "Terminations", label: "Ill Health" },
  abscondmentTermination: { category: "Terminations", label: "Abscondment/Desertion" },
  retrenchmentTermination: { category: "Terminations", label: "Retrenchment" },
  retirementTermination: { category: "Terminations", label: "Retirement" },
  poorPerformanceTermination: { category: "Terminations", label: "Poor Performance" },
  mutualTermination: { category: "Terminations", label: "Mutual Separation Agreement" },
};

const terminationDocumentKeys = [
  "noticeTermination",
  "illHealthTermination",
  "abscondmentTermination",
  "retrenchmentTermination",
  "retirementTermination",
  "poorPerformanceTermination",
  "mutualTermination",
] as const satisfies readonly DocumentKey[];

const terminationLetterDocumentKeys = [
  "noticeTermination",
  "illHealthTermination",
  "abscondmentTermination",
  "retrenchmentTermination",
  "retirementTermination",
  "poorPerformanceTermination",
] as const satisfies readonly DocumentKey[];

const noticeDocumentKeys = [
  "hearingNotice",
  "abscondHearingNotice",
  "precautionarySuspensionNotice",
  "contemplatedRetrenchmentNotice",
  "incapacityPerformanceHearingNotice",
  "incapacityIllHealthHearingNotice",
] as const satisfies readonly DocumentKey[];

const documentCreateMenuItems = [
  { title: "Discipline" },
  { title: "Contracts" },
  { title: "Terminations" },
  { title: "Notices" },
  { title: "Outcome" },
  { title: "Litigation" },
  { title: "Other" },
] as const;

const documentCreateFlyoutItems: Record<
  (typeof documentCreateMenuItems)[number]["title"],
  Array<{ title: string; selectedDocument?: DocumentKey; disabled?: boolean }>
> = {
  Discipline: [
    { title: "Code of Conduct", selectedDocument: "codeOfConduct" },
    { title: "Warning", selectedDocument: "discWarningGenerator" },
  ],
  Contracts: [
    { title: "Permanent", selectedDocument: "permContract" },
    { title: "Temporary Contract", selectedDocument: "temporaryContract" },
    { title: "Addendum", selectedDocument: "addendum" },
  ],
  Terminations: [
    { title: "Misconduct", selectedDocument: "noticeTermination" },
    { title: "Ill Health", selectedDocument: "illHealthTermination" },
    { title: "Poor Performance", selectedDocument: "poorPerformanceTermination" },
    { title: "Abscondment/Desertion", selectedDocument: "abscondmentTermination" },
    { title: "Retrenchment", selectedDocument: "retrenchmentTermination" },
    { title: "Retirement", selectedDocument: "retirementTermination" },
    { title: "Mutual Separation", selectedDocument: "mutualTermination" },
  ],
  Notices: [
    { title: "Hearing Notice", selectedDocument: "hearingNotice" },
    { title: "Abscondment Letter", selectedDocument: "abscondHearingNotice" },
    { title: "Incapacity Hearing (Performance)", selectedDocument: "incapacityPerformanceHearingNotice" },
    { title: "Incapacity Hearing (Ill Health)", selectedDocument: "incapacityIllHealthHearingNotice" },
    { title: "Precautionary Suspension", selectedDocument: "precautionarySuspensionNotice" },
    { title: "Contemplated Retrenchment (S189)", selectedDocument: "contemplatedRetrenchmentNotice" },
  ],
  Outcome: [
    { title: "Hearing Outcome", selectedDocument: "disciplinaryHearingOutcome" },
    { title: "Performance Hearing", disabled: true },
    { title: "Illness Hearing", disabled: true },
    { title: "Performance Consultation", disabled: true },
    { title: "Retrenchment Consultation", disabled: true },
    { title: "Grievance Consultation", disabled: true },
    { title: "Wage Negotiations", disabled: true },
  ],
  Litigation: [],
  Other: [
    { title: "Certificate of Service", selectedDocument: "serviceCertificate" },
    { title: "Acknowledgement of Debt", selectedDocument: "acknowledgementOfDebt" },
  ],
};

const activeNewDocumentKeys = new Set<DocumentKey>([
  "codeOfConduct",
  "discWarningGenerator",
  "permContract",
  "noticeTermination",
  "hearingNotice",
  "abscondHearingNotice",
  "disciplinaryHearingOutcome",
]);

type DocumentCreateCategory = (typeof documentCreateMenuItems)[number]["title"];

const wizardDocumentKeys = [
  "discWarningGenerator",
  ...noticeDocumentKeys,
  "disciplinaryHearingOutcome",
  "serviceCertificate",
  "acknowledgementOfDebt",
  "addendum",
  ...terminationDocumentKeys,
  "permContract",
  "temporaryContract",
] as const satisfies readonly DocumentKey[];

const darkStepperDocumentKeys = [
  "discWarningGenerator",
  "hearingNotice",
  "abscondHearingNotice",
  "disciplinaryHearingOutcome",
  "permContract",
  ...terminationDocumentKeys,
] as const satisfies readonly DocumentKey[];
const darkStepperDocumentSet = new Set<DocumentKey>(darkStepperDocumentKeys);
const chevronTrackerDocumentSet = new Set<DocumentKey>([
  "discWarningGenerator",
  "hearingNotice",
  "abscondHearingNotice",
  "disciplinaryHearingOutcome",
  "noticeTermination",
  "permContract",
]);
const darkShellDocumentKeys = ["codeOfConduct", ...darkStepperDocumentKeys] as const satisfies readonly DocumentKey[];
const lightWizardDocumentKeys = wizardDocumentKeys.filter((key) => !darkStepperDocumentSet.has(key)) as DocumentKey[];
const modalOnlyDocumentKeys = [...wizardDocumentKeys, "codeOfConduct"] as const satisfies readonly DocumentKey[];

const terminationDocumentSet = new Set<DocumentKey>(terminationDocumentKeys);
const terminationLetterDocumentSet = new Set<DocumentKey>(terminationLetterDocumentKeys);
const wizardDocumentSet = new Set<DocumentKey>(wizardDocumentKeys);
const darkShellDocumentSet = new Set<DocumentKey>(darkShellDocumentKeys);
const lightWizardDocumentSet = new Set<DocumentKey>(lightWizardDocumentKeys);
const modalOnlyDocumentSet = new Set<DocumentKey>(modalOnlyDocumentKeys);

const modalTitleByDocument: Record<DocumentKey, string> = {
  codeOfConduct: "Code of Conduct",
  discWarningGenerator: "Warning",
  hearingNotice: "Hearing Notice",
  abscondHearingNotice: "Abscondment Letter",
  disciplinaryHearingOutcome: "Hearing Outcome",
  precautionarySuspensionNotice: "Precautionary Suspension",
  contemplatedRetrenchmentNotice: "Contemplated Retrenchment (S189)",
  incapacityPerformanceHearingNotice: "Incapacity Hearing (Performance)",
  incapacityIllHealthHearingNotice: "Incapacity Hearing (Ill health)",
  serviceCertificate: "Certificate of Service",
  acknowledgementOfDebt: "Acknowledgement of Debt",
  permContract: "Permanent",
  temporaryContract: "Temporary Contract",
  addendum: "Addendum",
  noticeTermination: "Misconduct",
  illHealthTermination: "Ill Health",
  abscondmentTermination: "Abscondment/Desertion",
  retrenchmentTermination: "Retrenchment",
  retirementTermination: "Retirement",
  poorPerformanceTermination: "Poor Performance",
  mutualTermination: "Mutual Separation Agreement",
};

const minimizedTabLabelByDocument: Partial<Record<DocumentKey, string>> = {
  noticeTermination: "Misc Termination",
};

const getMinimizedTabLabel = (documentKey: DocumentKey) =>
  minimizedTabLabelByDocument[documentKey] || modalTitleByDocument[documentKey];

const normalizeLoadedMinimizedTabs = (tabs: MinimizedGeneratorTab[]) =>
  tabs.map((tab) => {
    const normalizedKey = normalizeLegacyDocumentKey(tab.documentKey);
    if (!normalizedKey) return tab;
    return {
      ...tab,
      documentKey: normalizedKey,
      label: getMinimizedTabLabel(normalizedKey),
    };
  });

const detailStepLabelByDocument: Partial<Record<DocumentKey, string>> = {
  discWarningGenerator: "Warning Details",
  hearingNotice: "Notice Details",
  abscondHearingNotice: "Hearing Details",
  disciplinaryHearingOutcome: "Hearing Details",
  precautionarySuspensionNotice: "Notice Details",
  contemplatedRetrenchmentNotice: "Notice Details",
  incapacityPerformanceHearingNotice: "Notice Details",
  incapacityIllHealthHearingNotice: "Notice Details",
  serviceCertificate: "Certificate Details",
  acknowledgementOfDebt: "Debt Details",
  addendum: "Addendum Details",
  noticeTermination: "Termination Details",
  illHealthTermination: "Termination Details",
  abscondmentTermination: "Termination Details",
  retrenchmentTermination: "Termination Details",
  retirementTermination: "Termination Details",
  poorPerformanceTermination: "Termination Details",
  mutualTermination: "Termination Details",
  permContract: "Contract Details",
  temporaryContract: "Employment Details",
};

const getShellCategoryTitle = (documentKey: DocumentKey) => {
  if (terminationLetterDocumentSet.has(documentKey)) return "Termination Letter";
  if (documentKey === "mutualTermination") return "Terminations";
  return documentMeta[documentKey].category;
};

const canAccessDisciplinaryHearingOutcome = (subuserRole: string) => {
  const role = subuserRole.trim().toLowerCase();
  return !role || role === "consultant";
};

const isDocumentAccessAllowed = (documentKey: DocumentKey, subuserRole: string) => {
  if (documentKey !== "disciplinaryHearingOutcome") return true;
  return canAccessDisciplinaryHearingOutcome(subuserRole);
};

const Documents = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDocumentsRoute = location.pathname.startsWith("/documents");
  const [selectedDocument, setSelectedDocument] = useState<DocumentKey | null>(null);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [breadcrumbStep, setBreadcrumbStep] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<MinimizedGeneratorTab | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [documentsTablePage, setDocumentsTablePage] = useState(1);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [documentTypeFilter, setDocumentTypeFilter] = useState("all");
  const [documentCreatedByFilter, setDocumentCreatedByFilter] = useState("all");
  const [documentCreatedOnFilter, setDocumentCreatedOnFilter] = useState<"all" | "last7" | "last14" | "last30" | "last60">("all");
  const [expandedFilterSection, setExpandedFilterSection] = useState<string | null>(null);
  const [isNewDocumentMenuOpen, setIsNewDocumentMenuOpen] = useState(false);
  const [openDocumentCategory, setOpenDocumentCategory] = useState<DocumentCreateCategory | null>(null);
  const [currentUserSubuserRole, setCurrentUserSubuserRole] = useState("");
  const [isCurrentUserRoleLoaded, setIsCurrentUserRoleLoaded] = useState(false);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(new Set());
  const [documentRows, setDocumentRows] = useState<DocumentTableRow[]>(() => loadCachedDocumentRows());
  const [isDocumentsLoading, setIsDocumentsLoading] = useState(() => loadCachedDocumentRows().length === 0);
  const [minimizedTabs, setMinimizedTabs] = useState<MinimizedGeneratorTab[]>(() =>
    normalizeLoadedMinimizedTabs(loadMinimizedDocumentTabs() as MinimizedGeneratorTab[]),
  );
  const [stepMeta, setStepMeta] = useState<{
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
  } | null>(null);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("documents-modal-state", {
        detail: {
          open: Boolean(isDocumentsRoute && activeSession?.documentKey),
          documentKey: isDocumentsRoute ? activeSession?.documentKey ?? null : null,
        },
      }),
    );
  }, [activeSession, isDocumentsRoute]);

  useEffect(() => {
    if (!isFilterOpen) {
      setExpandedFilterSection(null);
    }
  }, [isFilterOpen]);

  const closeModal = () => {
    setActiveSession(null);
    setStepMeta(null);
    setBreadcrumbStep(null);
  };

  const minimizeModal = () => {
    if (!activeSession) return;
    const minimizedSession = { ...activeSession, label: getMinimizedTabLabel(activeSession.documentKey) };
    setMinimizedTabs((prev) => {
      if (prev.some((item) => item.id === activeSession.id)) return prev;

      const sameDocumentTabs = prev.filter((item) => item.documentKey === activeSession.documentKey);
      const usedInstanceNumbers = sameDocumentTabs
        .map((item) => item.instanceNumber)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
      let nextInstanceNumber = minimizedSession.instanceNumber;
      if (!(typeof nextInstanceNumber === "number" && Number.isFinite(nextInstanceNumber))) {
        if (sameDocumentTabs.length === 0) {
          nextInstanceNumber = 1;
        } else {
          let candidate = 2;
          while (usedInstanceNumbers.includes(candidate)) candidate += 1;
          nextInstanceNumber = candidate;
        }
      }

      const usedOrders = prev
        .map((item) => item.minimizedOrder)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
      const nextMinimizedOrder =
        typeof minimizedSession.minimizedOrder === "number" && Number.isFinite(minimizedSession.minimizedOrder)
          ? minimizedSession.minimizedOrder
          : usedOrders.length > 0
            ? Math.max(...usedOrders) + 1
            : 0;

      return [...prev, { ...minimizedSession, instanceNumber: nextInstanceNumber, minimizedOrder: nextMinimizedOrder }].sort(
        (left, right) => (left.minimizedOrder ?? 0) - (right.minimizedOrder ?? 0),
      );
    });
    closeModal();
  };

  const restoreModal = (tabId: string) => {
    const tab = minimizedTabs.find((item) => item.id === tabId);
    if (!tab) return;
    setActiveSession(tab);
    setMinimizedTabs((prev) => prev.filter((item) => item.id !== tabId));
  };

  const dismissMinimizedTab = (tabId: string) => {
    setMinimizedTabs((prev) => prev.filter((item) => item.id !== tabId));
  };

  useEffect(() => {
    const routeState = (location.state as { selectedDocument?: string; restoreMinimizedTabId?: string } | null) ?? null;
    const nextSelected = normalizeLegacyDocumentKey(routeState?.selectedDocument);
    const restoreMinimizedTabId = routeState?.restoreMinimizedTabId;

    if (restoreMinimizedTabId) {
      const minimizedTab = minimizedTabs.find((item) => item.id === restoreMinimizedTabId);
      const normalizedMinimizedDocumentKey = normalizeLegacyDocumentKey(minimizedTab?.documentKey);
      if (normalizedMinimizedDocumentKey === "disciplinaryHearingOutcome" && !isCurrentUserRoleLoaded) return;
      if (
        minimizedTab &&
        normalizedMinimizedDocumentKey &&
        documentComponents[normalizedMinimizedDocumentKey] &&
        isDocumentAccessAllowed(normalizedMinimizedDocumentKey, currentUserSubuserRole)
      ) {
        setSelectedDocument(normalizedMinimizedDocumentKey);
        setStepMeta(null);
        setBreadcrumbStep(null);
        setActiveSession({ ...minimizedTab, documentKey: normalizedMinimizedDocumentKey });
        setMinimizedTabs((prev) => prev.filter((item) => item.id !== restoreMinimizedTabId));
      }
      const nextState = { ...(routeState as Record<string, unknown>) };
      delete nextState.restoreMinimizedTabId;
      navigate(location.pathname, {
        replace: true,
        state: Object.keys(nextState).length > 0 ? nextState : null,
      });
      return;
    }

    if (nextSelected === "disciplinaryHearingOutcome" && !isCurrentUserRoleLoaded) return;
    if (nextSelected && documentComponents[nextSelected]) {
      if (!isDocumentAccessAllowed(nextSelected, currentUserSubuserRole)) {
        toast({
          title: "Permission denied",
          description: "Only the master user and consultant subusers can access the disciplinary hearing outcome generator.",
          variant: "destructive",
        });
        const nextState = { ...((routeState as Record<string, unknown> | null) ?? {}) };
        delete nextState.selectedDocument;
        navigate(location.pathname, {
          replace: true,
          state: Object.keys(nextState).length > 0 ? nextState : null,
        });
        return;
      }
      setSelectedDocument(nextSelected);
      setStepMeta(null);
      setBreadcrumbStep(null);
      setActiveSession({ id: crypto.randomUUID(), documentKey: nextSelected, label: getMinimizedTabLabel(nextSelected) });
      const nextState = { ...((routeState as Record<string, unknown> | null) ?? {}) };
      delete nextState.selectedDocument;
      navigate(location.pathname, {
        replace: true,
        state: Object.keys(nextState).length > 0 ? nextState : null,
      });
    }
  }, [currentUserSubuserRole, isCurrentUserRoleLoaded, location.pathname, location.state, minimizedTabs, navigate]);

  useEffect(() => {
    setBreadcrumbStep(null);
  }, [selectedDocument]);

  useEffect(() => {
    if (isDocumentsRoute || !activeSession) return;
    setMinimizedTabs((prev) => (prev.some((item) => item.id === activeSession.id) ? prev : [...prev, activeSession]));
    setActiveSession(null);
    setStepMeta(null);
    setBreadcrumbStep(null);
  }, [activeSession, isDocumentsRoute]);

  useEffect(() => {
    saveMinimizedDocumentTabs(minimizedTabs as StoredMinimizedDocumentTab[]);
  }, [minimizedTabs]);

  useEffect(() => {
    saveCachedDocumentRows(documentRows);
  }, [documentRows]);

  useEffect(() => {
    const syncMinimizedTabs = () =>
      setMinimizedTabs(normalizeLoadedMinimizedTabs(loadMinimizedDocumentTabs() as MinimizedGeneratorTab[]));
    window.addEventListener(minimizedDocumentTabsChangedEvent, syncMinimizedTabs);
    return () => window.removeEventListener(minimizedDocumentTabsChangedEvent, syncMinimizedTabs);
  }, []);

  useEffect(() => {
    const handleForceClose = () => {
      closeModal();
    };
    window.addEventListener("documents-force-close", handleForceClose);
    return () => window.removeEventListener("documents-force-close", handleForceClose);
  }, []);

  useEffect(() => {
    const el = contentScrollRef.current;
    if (!el) return;
    const checkScroll = () => {
      const canScroll = el.scrollHeight > el.clientHeight + 4;
      const atTop = el.scrollTop <= 8;
      setShowScrollHint(canScroll && atTop);
    };
    checkScroll();
    const onScroll = () => checkScroll();
    el.addEventListener("scroll", onScroll);
    const onResize = () => checkScroll();
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [selectedDocument]);

  useEffect(() => {
    let isMounted = true;
    const formatCreatedOn = (value: string) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      return date.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    };
    const loadDocuments = async () => {
      if (isMounted && documentRows.length === 0) {
        setIsDocumentsLoading(true);
      }
      let queryResult = await (supabase as any)
        .from("documents")
        .select(
          "id, document_name, document_type, client_id, client_name, created_at, created_by_name, file_url, client:clients(registered_name,company_type,trading_as)",
        )
        .eq("deleted", false)
        .order("created_at", { ascending: false });
      if (queryResult.error) {
        queryResult = await (supabase as any)
          .from("documents")
          .select(
            "id, document_name, document_type, client_id, client_name, created_at, created_by, file_url, client:clients(registered_name,company_type,trading_as)",
          )
          .eq("deleted", false)
          .order("created_at", { ascending: false });
      }
      if (!isMounted) return;
      if (queryResult.error) {
        setIsDocumentsLoading(false);
        return;
      }
      const rows: DocumentTableRow[] = (queryResult.data ?? []).map((row: any) => {
        const resolvedClientLabel = getDocumentClientLabelFromRelation(row.client);
        return {
          id: String(row.id ?? crypto.randomUUID()),
          documentName: String(row.document_name ?? ""),
          documentType: String(row.document_type ?? ""),
          clientName: resolvedClientLabel || String(row.client_name ?? ""),
          createdOn: formatCreatedOn(String(row.created_at ?? "")),
          createdAtRaw: String(row.created_at ?? ""),
          createdBy: String(row.created_by_name ?? row.created_by ?? ""),
          fileUrl: String(row.file_url ?? ""),
        };
      });
      setDocumentRows(rows);
      setIsDocumentsLoading(false);
    };
    void loadDocuments();
    const interval = setInterval(() => void loadDocuments(), 10000);
    const onFocus = () => void loadDocuments();
    const onDocumentsRowCreated = () => void loadDocuments();
    const onTrashBinChanged = () => void loadDocuments();
    window.addEventListener("focus", onFocus);
    window.addEventListener("documents-row-created", onDocumentsRowCreated);
    window.addEventListener("trash-bin-changed", onTrashBinChanged);
    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("documents-row-created", onDocumentsRowCreated);
      window.removeEventListener("trash-bin-changed", onTrashBinChanged);
    };
  }, [documentRows.length]);

  useEffect(() => {
    let isMounted = true;

    const loadCurrentUserRole = async () => {
      setIsCurrentUserRoleLoaded(false);
      if (!user?.id) {
        if (isMounted) {
          setCurrentUserSubuserRole("");
          setIsCurrentUserRoleLoaded(true);
        }
        return;
      }

      const { data: subuserData } = await (supabase as unknown as {
        from: (table: "subusers") => {
          select: (query: "role") => {
            eq: (column: "auth_user_id", value: string) => {
              maybeSingle: () => Promise<{ data: CurrentUserSubuserRoleRow | null }>;
            };
          };
        };
      })
        .from("subusers")
        .select("role")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!isMounted) return;
      setCurrentUserSubuserRole(String(subuserData?.role || "").trim());
      setIsCurrentUserRoleLoaded(true);
    };

    void loadCurrentUserRole();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const SelectedComponent = selectedDocument ? documentComponents[selectedDocument] : null;
  const modalDocument = activeSession?.documentKey ?? null;
  const ModalComponent = modalDocument ? documentComponents[modalDocument] : null;
  const activeDocumentMeta = selectedDocument ? documentMeta[selectedDocument] : null;
  const activeCategoryTitle = activeDocumentMeta?.category ?? "";
  const breadcrumbCategoryTitle = selectedDocument ? getShellCategoryTitle(selectedDocument) : activeCategoryTitle;
  const activeDocumentLabel = activeDocumentMeta?.label ?? "";
  const modalTitle = modalDocument ? modalTitleByDocument[modalDocument] : "";
  const discWarningBreadcrumbClientName =
    modalDocument === "discWarningGenerator" ? getDiscWarningBreadcrumbClientName(activeSession?.draftState) : "";
  const abscondHearingBreadcrumbClientName =
    modalDocument === "abscondHearingNotice" ? getAbscondHearingBreadcrumbClientName(activeSession?.draftState) : "";
  const discHearingOutcomeBreadcrumbClientName =
    modalDocument === "disciplinaryHearingOutcome" ? getDiscHearingOutcomeBreadcrumbClientName(activeSession?.draftState) : "";
  const discHearingOutcomeBreadcrumbTitle =
    modalDocument === "disciplinaryHearingOutcome" ? getDiscHearingOutcomeBreadcrumbTitle(activeSession?.draftState) : "";
  const permContractBreadcrumbClientName =
    modalDocument === "permContract" ? getPermContractBreadcrumbClientName(activeSession?.draftState) : "";
  const miscTerminationBreadcrumbClientName =
    modalDocument === "noticeTermination" ? getMiscTerminationBreadcrumbClientName(activeSession?.draftState) : "";
  const modalBreadcrumbTitle =
    modalDocument === "discWarningGenerator" && discWarningBreadcrumbClientName
      ? `${modalTitle} (${discWarningBreadcrumbClientName})`
      : modalDocument === "hearingNotice"
        ? formatHearingNoticeBreadcrumbTitle(activeSession?.draftState)
        : modalDocument === "abscondHearingNotice" && abscondHearingBreadcrumbClientName
          ? `${modalTitle} (${abscondHearingBreadcrumbClientName})`
        : modalDocument === "disciplinaryHearingOutcome" && discHearingOutcomeBreadcrumbClientName
          ? `${discHearingOutcomeBreadcrumbTitle} (${discHearingOutcomeBreadcrumbClientName})`
          : modalDocument === "disciplinaryHearingOutcome"
            ? discHearingOutcomeBreadcrumbTitle
          : modalDocument === "permContract" && permContractBreadcrumbClientName
            ? `${modalTitle} (${permContractBreadcrumbClientName})`
            : modalDocument === "noticeTermination" && miscTerminationBreadcrumbClientName
              ? `${modalTitle} (${miscTerminationBreadcrumbClientName})`
      : modalTitle;
  const modalHeaderCategoryTitle = modalDocument ? getShellCategoryTitle(modalDocument) : "";
  const modalHeaderLabel = modalDocument ? documentMeta[modalDocument].label : "";
  const isTerminationModal = modalDocument ? terminationDocumentSet.has(modalDocument) : false;
  const isDarkStepperModal = modalDocument ? darkStepperDocumentSet.has(modalDocument) : false;
  const usesChevronTracker = modalDocument ? chevronTrackerDocumentSet.has(modalDocument) : false;
  const isCodeOfConductModal = modalDocument === "codeOfConduct";
  const isLightWizardModal = modalDocument ? lightWizardDocumentSet.has(modalDocument) : false;
  const isDisciplinaryOutcomeModal = modalDocument === "disciplinaryHearingOutcome";
  const modalSteps =
    stepMeta?.steps && stepMeta.steps.length > 0
      ? stepMeta.steps
      : modalDocument && wizardDocumentSet.has(modalDocument)
        ? ([
            modalDocument === "disciplinaryHearingOutcome"
              ? "Parties"
              : modalDocument === "discWarningGenerator" || modalDocument === "permContract"
                ? "Client Details"
                : "Employer Details",
            "Employee Details",
            detailStepLabelByDocument[modalDocument] ?? "Employment Details",
            "Preview / Edit",
          ] as const)
        : ([] as const);
  const modalActiveStep = stepMeta?.isFinished
    ? Math.max(0, modalSteps.length - 1)
    : Math.min(stepMeta?.activeStep ?? 0, Math.max(0, modalSteps.length - 1));
  const canSelectTrackerStep = (index: number) => {
    if (!stepMeta?.onStepSelect) return false;
    if (stepMeta.canSelectStep) return stepMeta.canSelectStep(index);
    const maxIndex = stepMeta.steps.length - 1;
    if (index < 0 || index > maxIndex) return false;
    return index < stepMeta.activeStep;
  };
  const handleTrackerStepSelect = (index: number) => {
    if (!canSelectTrackerStep(index)) return;
    stepMeta?.onStepSelect?.(index);
  };
  const activeModalStepLabel = modalSteps[modalActiveStep] ?? modalSteps[0] ?? "";
  const addendumStepNotes = [
    [
      "The company name, registration number, and address can be changed in Company Settings.",
      "If applicable, you may insert a trading name for your company. The contact number and email address are auto populated but can be changed by selecting the respective input fields.",
    ],
    [
      "You may either select from saved employee records or enter employee details manually.",
      "If the employee is not yet saved, complete the employee details manually for this document.",
    ],
    [
      "Choose one of the three addendum types and insert the applicable dates.",
      "A General Addendum is ordinarily used to amend specific terms of an existing employment contract, such as remuneration, working hours, position, or benefits.",
      "An extension is used where a current temporary contract is still active and the Parties agree to extend the existing end date.",
      "A renewal applies where a temporary contract has already expired and the Parties agree to enter into a new temporary period of employment.",
    ],
    [
      "Review and finalize the editable preview before downloading.",
      "The general addendum is a starting point, so add the specific amendments the parties agreed to for the existing contract.",
      "Use Edit to change clause text, Add to insert new clauses, and Delete (for custom clauses) to remove terms.",
      "Example:",
      "Salary / Remuneration (Clause title)",
      "Clause 5 of the employment contract is hereby amended, with effect from 3 March 2026, and the salary is R25,000 per month. (Clause body)",
    ],
  ] as const;
  const permContractStepNotes = [
    [
      "Select the client record that should be used as the employer for this contract.",
      "The company profile is pulled in automatically so the draft starts from the correct business details.",
    ],
    [
      "Capture the employee manually in this first version of the new generator.",
      "This keeps the new permanent contract flow clean while we build the later step refinements.",
    ],
    [
      "Capture the appointment summary that should feed the permanent contract output.",
      "Only the new employment-term fields in this screen are used for the generated preview and PDF.",
    ],
    [
      "Review the fresh contract summary before downloading the generated PDF.",
      "This preview is intentionally not using the legacy permanent contract clause pack.",
    ],
  ] as const;
  const temporaryStepNotes = [
    [
      "The company name, registration number, and address can be changed in Company Settings.",
      "If applicable, you may insert a trading name for your company. The contact number and email address are auto populated but can be changed by selecting the respective input fields.",
    ],
    [
      'Add one employee or multiple employees by selecting the "Add employee" button and following the prompts.',
      "Ensure each added employee has name, surname, ID/Passport, cell number and address.",
    ],
    [
      "Capture temporary employment details and confirm how the contract ends (specific date or on completion of project/scope).",
      "Complete all required fields before moving to preview and edit.",
    ],
    [
      "Review and finalize the editable preview before downloading.",
      "Use Edit to change clause text, Add to insert new clauses, and Delete (for custom clauses) to remove terms.",
    ],
  ] as const;
  const warningStepNotes = [
    [
      "The company name, registration number, and address can be changed in Company Settings.",
      "If applicable, you may insert a trading name for your company. The contact number and email address are auto populated but can be changed by selecting the respective input fields.",
    ],
    [
      "You may either select from saved employee records or enter employee details manually.",
      "If the employee is not yet saved, complete the employee details manually for this document.",
    ],
    [
      "Select one or more misconduct types, provide a detailed description, and choose the correct warning type.",
      "The warning validity period is populated from the selected warning type.",
    ],
    [
      "Review the warning preview and download once details are verified.",
      "Use Back to return to the form if any information must be corrected.",
    ],
  ] as const;
  const noticeTerminationStepNotes = [
    [
      "This step sets how your company details appear on the letterhead in the final document.",
      "Company name, registration number, and address are pulled from Company Settings. You can still add a trading name and adjust contact details for this letter if needed.",
      "If you upload a logo, choose the letterhead layout and colour theme carefully.",
    ],
    [
      "Select an employee from your saved list or capture the employee details manually.",
      "For the address portion of this form, city, province, and area code are required. Address line 1 and 2 are optional.",
    ],
    [
      "Complete all fields in this step carefully, as these selections determine how key parts of the termination letter are worded.",
      "Before moving to preview, confirm that each required field reflects the outcome you intend to communicate.",
      "If you are unsure what to select, hover over the info icon next to the field label for guidance.",
    ],
    [
      "The preview opens read-only. Select Edit to unlock paragraph editing and add/delete controls.",
      "After editing, select Save to lock the preview again. Download is enabled only when not in edit mode.",
      "Review all text carefully before downloading the final termination letter.",
      "NB! Issue the letter on the same day as the letter date. If it will only be issued later, update the letter date before finalizing.",
    ],
  ] as const;
  const disciplinaryHearingStepNotes = [
    [
      "This step controls how your company details appear on the disciplinary hearing notice.",
      "Company name, registration number, and address are pulled from Company Settings. You can still add a trading name and adjust contact details for this notice.",
      "If you upload a logo, choose the letterhead layout and colour theme that match your company style.",
    ],
    [
      "Select an employee from your saved list or capture employee details manually.",
      "For the address section, city, province, and area code are required. Address line 1 and 2 are optional.",
    ],
    [
      "Capture the notice date, hearing date, hearing time, hearing location, and the applicable misconduct type(s).",
      "Each selected misconduct type requires a charge description before you can continue.",
      "A proper charge description should answer when, what, and how.",
      "Type each charge description manually and review it before continuing.",
    ],
    [
      "The preview opens read-only. Select Edit to unlock paragraph editing and add/delete controls.",
      "After editing, select Save to lock the preview again. Download is enabled only when not in edit mode.",
      "Review all wording carefully before downloading the final disciplinary hearing notice.",
    ],
  ] as const;
  const precautionarySuspensionStepNotes = [
    [
      "This step controls how your company details appear on the precautionary suspension notice.",
      "Company name, registration number, and address are pulled from Company Settings. You can still add a trading name and adjust contact details for this notice.",
      "If you upload a logo, choose the letterhead layout and colour theme that match your company style.",
    ],
    [
      "Select an employee from your saved list or capture employee details manually.",
      "For the address section, city, province, and area code are required. Address line 1 and 2 are optional.",
    ],
    [
      "Capture the notice date, hearing date, hearing time, hearing format, hearing location, and the applicable charge type(s).",
      "Each selected charge type requires a clear charge description before you can continue.",
      "A proper charge description should answer when, what, and how.",
      "Type each charge description manually and review it before continuing.",
    ],
    [
      "The preview opens read-only. Select Edit to unlock paragraph editing and add/delete controls.",
      "After editing, select Save to lock the preview again. Download is enabled only when not in edit mode.",
      "Review all wording carefully before downloading the final precautionary suspension notice.",
    ],
  ] as const;
  const incapacityPerformanceHearingStepNotes = [
    [
      "This step controls how your company details appear on the incapacity hearing notice.",
      "Company name, registration number, and address are pulled from Company Settings. You can still add a trading name and adjust contact details for this notice.",
      "If you upload a logo, choose the letterhead layout and colour theme that match your company style.",
    ],
    [
      "Select an employee from your saved list or capture employee details manually.",
      "For the address section, city, province, and area code are required. Address line 1 and 2 are optional.",
    ],
    [
      "Capture the notice date, hearing date, hearing time, hearing location, and the applicable performance concern type(s).",
      "Each selected performance concern type requires a concern description before you can continue.",
      "A proper concern description should answer where the employee did not meet required standards, with enough detail to prepare a response.",
      "Use an incapacity (poor performance) procedure for performance concerns. Do not treat poor performance as misconduct or follow a disciplinary misconduct process.",
    ],
    [
      "The preview opens read-only. Select Edit to unlock paragraph editing and add/delete controls.",
      "After editing, select Save to lock the preview again. Download is enabled only when not in edit mode.",
      "Review all wording carefully before downloading the final incapacity hearing notice.",
    ],
  ] as const;
  const incapacityIllHealthHearingStepNotes = [
    [
      "This step controls how your company details appear on the incapacity hearing notice.",
      "Company name, registration number, and address are pulled from Company Settings. You can still add a trading name and adjust contact details for this notice.",
      "If you upload a logo, choose the letterhead layout and colour theme that match your company style.",
    ],
    [
      "Select an employee from your saved list or capture employee details manually.",
      "For the address section, city, province, and area code are required. Address line 1 and 2 are optional.",
    ],
    [
      "Capture the notice date, hearing date, hearing time, hearing location, and the applicable ill-health concern type(s).",
      "Each selected ill-health concern type requires a concern description before you can continue.",
      "A proper concern description should explain how the employee's health condition affects the ability to perform required duties.",
      "Use an incapacity (ill health) procedure. Do not treat ill health as misconduct or follow a disciplinary misconduct process.",
    ],
    [
      "The preview opens read-only. Select Edit to unlock paragraph editing and add/delete controls.",
      "After editing, select Save to lock the preview again. Download is enabled only when not in edit mode.",
      "Review all wording carefully before downloading the final incapacity hearing notice.",
    ],
  ] as const;
  const contemplatedRetrenchmentNoticeStepNotes = [
    [
      "This step controls how your company details appear on the contemplated retrenchment notice.",
      "Company name, registration number, and address are pulled from Company Settings. You can still add a trading name and adjust contact details for this notice.",
      "If you upload a logo, choose the letterhead layout and colour theme that match your company style.",
    ],
    [
      "Select one or more employees from your saved list or capture one employee manually.",
      "Address details are not required for this notice.",
    ],
    [
      "Capture all section 189 consultation details carefully so the notice reflects the contemplated process correctly.",
      "Use the info tips next to each field if you are unsure what to select.",
    ],
    [
      "The preview opens read-only. Select Edit to unlock paragraph editing and add/delete controls.",
      "After editing, select Save to lock the preview again. Download is enabled only when not in edit mode.",
      "Review all wording carefully before downloading the final contemplated retrenchment notice.",
    ],
  ] as const;
  const serviceCertificateStepNotes = [
    [
      "This step controls how your company details appear on the certificate of service.",
      "Company name, registration number, and address are pulled from Company Settings. You can still add a trading name and adjust contact details for this certificate.",
      "If you upload a logo, choose the letterhead layout and colour theme that match your company style.",
    ],
    [
      "Select an employee from your saved list or capture employee details manually.",
      "For the address section, city, province, and area code are required. Address line 1 and 2 are optional.",
    ],
    [
      "Capture the employee's position, employment dates, and any other required certificate details carefully.",
      "Review all captured details before moving to preview.",
    ],
    [
      "The preview opens read-only. Select Edit to unlock paragraph editing and add/delete controls.",
      "After editing, select Save to lock the preview again. Download is enabled only when not in edit mode.",
      "Review all wording carefully before downloading the final certificate of service.",
    ],
  ] as const satisfies StepNotes;
  const acknowledgementOfDebtStepNotes = [
    [
      "This step controls how your company details appear on the acknowledgement of debt.",
      "Company name, registration number, and address are pulled from Company Settings. You can still add a trading name and adjust contact details for this document.",
      "If you upload a logo, choose the letterhead layout and colour theme that match your company style.",
    ],
    [
      "Select an employee from your saved list or capture employee details manually.",
      "For the address section, city, province, and area code are required. Address line 1 and 2 are optional.",
    ],
    [
      "Capture the debt details carefully, including the amount, repayment terms, and any agreed conditions.",
      "Review the captured figures and dates before moving to preview.",
    ],
    [
      "The preview opens read-only. Select Edit to unlock paragraph editing and add/delete controls.",
      "After editing, select Save to lock the preview again. Download is enabled only when not in edit mode.",
      "Review all wording carefully before downloading the final acknowledgement of debt.",
    ],
  ] as const satisfies StepNotes;
  const addendumActiveNotes = addendumStepNotes[modalActiveStep] ?? addendumStepNotes[0];
  const permContractActiveNotes = permContractStepNotes[modalActiveStep] ?? permContractStepNotes[0];
  const warningActiveNotes = warningStepNotes[modalActiveStep] ?? warningStepNotes[0];
  const noticeTerminationActiveNotes =
    noticeTerminationStepNotes[modalActiveStep] ?? noticeTerminationStepNotes[0];
  const disciplinaryHearingActiveNotes =
    disciplinaryHearingStepNotes[modalActiveStep] ?? disciplinaryHearingStepNotes[0];
  const precautionarySuspensionActiveNotes =
    precautionarySuspensionStepNotes[modalActiveStep] ?? precautionarySuspensionStepNotes[0];
  const incapacityPerformanceHearingActiveNotes =
    incapacityPerformanceHearingStepNotes[modalActiveStep] ?? incapacityPerformanceHearingStepNotes[0];
  const incapacityIllHealthHearingActiveNotes =
    incapacityIllHealthHearingStepNotes[modalActiveStep] ?? incapacityIllHealthHearingStepNotes[0];
  const contemplatedRetrenchmentNoticeActiveNotes =
    contemplatedRetrenchmentNoticeStepNotes[modalActiveStep] ?? contemplatedRetrenchmentNoticeStepNotes[0];
  const serviceCertificateActiveNotes =
    serviceCertificateStepNotes[modalActiveStep] ?? serviceCertificateStepNotes[0];
  const acknowledgementOfDebtActiveNotes =
    acknowledgementOfDebtStepNotes[modalActiveStep] ?? acknowledgementOfDebtStepNotes[0];
  const mutualTerminationStepNotes = noticeTerminationStepNotes.map((notes, index) =>
    index === 0
      ? [
          "This step sets how your company details appear on the separation agreement.",
          "Company name and registration number are populated from Company Settings. You can still add a trading name if applicable.",
        ]
    : index === 1
      ? [notes[0]]
    : index === 2
      ? [
          "Complete all fields in this step carefully, as these selections determine how key parts of the separation agreement are worded.",
          ...notes.slice(1),
          "Generally, you should indicate the reason for termination on the UI19 form as Contract Ended.",
        ]
      : notes,
  );
  const mutualTerminationActiveNotes = (mutualTerminationStepNotes[modalActiveStep] ?? mutualTerminationStepNotes[0]).filter((note) => !note.startsWith("NB! "));
  const temporaryEmployeeCount = stepMeta?.temporaryEmployeeCount ?? 0;
  const temporaryActiveNotes = (() => {
    const baseNotes: string[] = [...(temporaryStepNotes[modalActiveStep] ?? temporaryStepNotes[0])];
    if (modalActiveStep === 2 && temporaryEmployeeCount > 1) {
      baseNotes.push(
        "The employment information selected and/or inserted in this step 3 will apply to all the employees. For example: Salary Amount will be the salary amount reflected on all the temporary contract of all the added employees at the previous step 2.",
      );
    }
    return baseNotes;
  })();
  const modalActiveNotes =
    modalDocument === "discWarningGenerator"
      ? warningActiveNotes
      : modalDocument === "permContract"
        ? permContractActiveNotes
      : modalDocument === "hearingNotice"
        ? disciplinaryHearingActiveNotes
      : modalDocument === "precautionarySuspensionNotice"
        ? precautionarySuspensionActiveNotes
      : modalDocument === "contemplatedRetrenchmentNotice"
        ? contemplatedRetrenchmentNoticeActiveNotes
      : modalDocument === "incapacityPerformanceHearingNotice"
        ? incapacityPerformanceHearingActiveNotes
      : modalDocument === "incapacityIllHealthHearingNotice"
        ? incapacityIllHealthHearingActiveNotes
      : modalDocument === "serviceCertificate"
        ? serviceCertificateActiveNotes
      : modalDocument === "acknowledgementOfDebt"
        ? acknowledgementOfDebtActiveNotes
      : modalDocument === "noticeTermination" ||
          modalDocument === "illHealthTermination" ||
          modalDocument === "abscondmentTermination" ||
          modalDocument === "retrenchmentTermination" ||
          modalDocument === "retirementTermination" ||
          modalDocument === "poorPerformanceTermination" ||
          modalDocument === "mutualTermination"
        ? modalDocument === "mutualTermination"
          ? mutualTerminationActiveNotes
          : noticeTerminationActiveNotes
        : modalDocument === "temporaryContract"
          ? temporaryActiveNotes
          : addendumActiveNotes;
  const shouldRenderInlineDocument = Boolean(
    SelectedComponent && selectedDocument && !modalOnlyDocumentSet.has(selectedDocument),
  );
  const canCurrentUserAccessDisciplinaryHearingOutcome =
    isCurrentUserRoleLoaded && canAccessDisciplinaryHearingOutcome(currentUserSubuserRole);
  const breadcrumbParts: string[] = [];
  if (breadcrumbCategoryTitle) breadcrumbParts.push(breadcrumbCategoryTitle);
  if (activeDocumentLabel) breadcrumbParts.push(activeDocumentLabel);
  if (breadcrumbStep) breadcrumbParts.push(breadcrumbStep);
  const canCurrentUserDeleteDocuments = useMemo(() => {
    if (!user?.id || !isCurrentUserRoleLoaded) return false;
    const role = currentUserSubuserRole.trim().toLowerCase();
    return !role;
  }, [currentUserSubuserRole, isCurrentUserRoleLoaded, user?.id]);
  const documentTypes = useMemo(
    () => Array.from(new Set(documentRows.map((row) => row.documentType).filter(Boolean))).sort((left, right) => left.localeCompare(right)),
    [documentRows],
  );
  const documentCreators = useMemo(
    () => Array.from(new Set(documentRows.map((row) => row.createdBy).filter(Boolean))).sort((left, right) => left.localeCompare(right)),
    [documentRows],
  );
  const filteredDocumentRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return documentRows.filter((row) => {
      const matchesSearch =
        !q ||
        row.documentName.toLowerCase().includes(q) ||
        row.documentType.toLowerCase().includes(q) ||
        formatDocumentClientName(row.clientName).toLowerCase().includes(q) ||
        row.createdBy.toLowerCase().includes(q);
      const matchesType = documentTypeFilter === "all" || row.documentType === documentTypeFilter;
      const matchesCreatedBy = documentCreatedByFilter === "all" || row.createdBy === documentCreatedByFilter;
      let matchesCreatedOn = true;
      if (documentCreatedOnFilter !== "all") {
        const createdAt = new Date(row.createdAtRaw);
        if (Number.isNaN(createdAt.getTime())) {
          matchesCreatedOn = false;
        } else {
          const now = new Date();
          const diffMs = now.getTime() - createdAt.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          const maxDays =
            documentCreatedOnFilter === "last7" ? 7 :
            documentCreatedOnFilter === "last14" ? 14 :
            documentCreatedOnFilter === "last30" ? 30 : 60;
          matchesCreatedOn = diffDays >= 0 && diffDays <= maxDays;
        }
      }
      return matchesSearch && matchesType && matchesCreatedBy && matchesCreatedOn;
    });
  }, [documentCreatedByFilter, documentCreatedOnFilter, documentRows, documentTypeFilter, searchQuery]);
  const totalDocumentsTablePages = Math.max(1, Math.ceil(filteredDocumentRows.length / DOCUMENTS_TABLE_PAGE_SIZE));
  const currentDocumentsTablePage = Math.min(documentsTablePage, totalDocumentsTablePages);
  const currentDocumentsTableOffset = (currentDocumentsTablePage - 1) * DOCUMENTS_TABLE_PAGE_SIZE;
  const paginatedDocumentRows = useMemo(
    () => filteredDocumentRows.slice(currentDocumentsTableOffset, currentDocumentsTableOffset + DOCUMENTS_TABLE_PAGE_SIZE),
    [currentDocumentsTableOffset, filteredDocumentRows],
  );
  const documentsTableRangeStart = filteredDocumentRows.length === 0 ? 0 : currentDocumentsTableOffset + 1;
  const documentsTableRangeEnd =
    filteredDocumentRows.length === 0 ? 0 : Math.min(currentDocumentsTableOffset + DOCUMENTS_TABLE_PAGE_SIZE, filteredDocumentRows.length);
  const allVisibleSelected =
    paginatedDocumentRows.length > 0 &&
    paginatedDocumentRows.every((row) => selectedDocumentIds.has(row.id));
  const documentsTablePageNumbers = useMemo(() => {
    if (totalDocumentsTablePages <= 6) {
      return Array.from({ length: totalDocumentsTablePages }, (_, index) => index + 1);
    }
    if (currentDocumentsTablePage <= 3) {
      return [1, 2, 3, 4, "ellipsis", totalDocumentsTablePages];
    }
    if (currentDocumentsTablePage >= totalDocumentsTablePages - 2) {
      return [1, "ellipsis", totalDocumentsTablePages - 3, totalDocumentsTablePages - 2, totalDocumentsTablePages - 1, totalDocumentsTablePages];
    }
    return [1, "ellipsis", currentDocumentsTablePage - 1, currentDocumentsTablePage, currentDocumentsTablePage + 1, "ellipsis-2", totalDocumentsTablePages];
  }, [currentDocumentsTablePage, totalDocumentsTablePages]);
  const toggleSelectAllVisibleDocuments = (checked: boolean) => {
    setSelectedDocumentIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const row of paginatedDocumentRows) next.add(row.id);
      } else {
        for (const row of paginatedDocumentRows) next.delete(row.id);
      }
      return next;
    });
  };
  const toggleSelectDocument = (documentId: string) => {
    setSelectedDocumentIds((prev) => {
      const next = new Set(prev);
      if (next.has(documentId)) next.delete(documentId);
      else next.add(documentId);
      return next;
    });
  };
  const openDocumentRowFile = (fileUrl: string) => {
    const resolvedUrl = String(fileUrl || "").trim();
    if (!resolvedUrl) return;
    window.open(resolvedUrl, "_blank", "noopener,noreferrer");
  };
  const handleDeleteSelectedDocuments = async (idsToDelete: string[]) => {
    if (idsToDelete.length === 0) return;
    if (!canCurrentUserDeleteDocuments) {
      toast({
        title: "Permission denied",
        description: "Only the master user can delete documents.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await (supabase as any)
      .from("documents")
      .update({ deleted: true, deleted_at: new Date().toISOString() })
      .in("id", idsToDelete);

    if (error) {
      toast({
        title: "Delete Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setDocumentRows((prev) => prev.filter((row) => !idsToDelete.includes(row.id)));
    setSelectedDocumentIds((prev) => {
      const next = new Set(prev);
      idsToDelete.forEach((id) => next.delete(id));
      return next;
    });
    window.dispatchEvent(new CustomEvent("trash-bin-changed"));
    toast({
      title: "Documents moved to Trash Bin",
      description: `Moved ${idsToDelete.length} document${idsToDelete.length === 1 ? "" : "s"} to the Trash Bin.`,
    });
  };
  const promptDeleteSelectedDocuments = () => {
    if (!canCurrentUserDeleteDocuments) {
      toast({
        title: "Permission denied",
        description: "Only the master user can delete documents.",
        variant: "destructive",
      });
      return;
    }
    const idsToDelete = Array.from(selectedDocumentIds);
    if (idsToDelete.length === 0) return;
    const confirmed = window.confirm(
      idsToDelete.length === 1
        ? "Are you sure you want to move this document to the Trash Bin?"
        : `Are you sure you want to move these ${idsToDelete.length} documents to the Trash Bin?`,
    );
    if (!confirmed) return;
    void handleDeleteSelectedDocuments(idsToDelete);
  };
  useEffect(() => {
    setDocumentsTablePage((prev) => Math.min(prev, totalDocumentsTablePages));
  }, [totalDocumentsTablePages]);
  useEffect(() => {
    setDocumentsTablePage(1);
  }, [searchQuery]);

  const newDocumentDropdownItemStyle =
    "cursor-pointer text-[12.33px] font-medium text-slate-700 transition-transform duration-150 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[highlighted]:translate-x-[3px]";
  const newDocumentDropdownContentStyle = "w-56 rounded-[4px] border-slate-200 p-1";
  const newDocumentSubItemStyle =
    "cursor-pointer pl-3 text-[11.83px] font-medium text-slate-600 transition-transform duration-150 focus:bg-transparent focus:text-[#2f9f35] data-[highlighted]:bg-transparent data-[highlighted]:translate-x-[3px] data-[highlighted]:text-[#2f9f35]";
  const newDocumentButtonStyle =
    "h-8 w-36 justify-between rounded-[4px] px-3 text-[12.33px] inline-flex items-center border border-[#3eca44] bg-[#3eca44] text-white hover:bg-[#34b73b] focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0";

  const openDocumentGenerator = (documentKey: DocumentKey) => {
    if (!isDocumentAccessAllowed(documentKey, currentUserSubuserRole) || (documentKey === "disciplinaryHearingOutcome" && !isCurrentUserRoleLoaded)) {
      toast({
        title: "Permission denied",
        description: "Only the master user and consultant subusers can access the disciplinary hearing outcome generator.",
        variant: "destructive",
      });
      return;
    }
    setIsNewDocumentMenuOpen(false);
    setOpenDocumentCategory(null);
    navigate("/documents", { state: { selectedDocument: documentKey } });
  };

  return (
    <>
      <div className="space-y-0 -m-6">
        <div className="overflow-hidden rounded-tl-sm border border-slate-300 border-l-0 border-r-0 bg-white shadow-sm h-[calc(100dvh-var(--app-header-height,5rem))] pb-0">
          <div className="flex h-full flex-col">
            <div className="pl-4 pr-4 pt-1">
              <div className="flex flex-col gap-4 pt-[10px] pb-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h1 className="text-4xl font-normal text-blue-600 -ml-1">Documents</h1>
                  <p className="text-xs text-slate-600 mt-2">
                    Generate labour documents quickly with guided step-by-step forms.
                  </p>
                </div>
                <div className="lg:pt-1">
                  <PageDateStamp className="text-slate-500 [&_svg]:text-slate-500" />
                </div>
              </div>
            </div>

            <section className="relative flex-1 min-h-0 overflow-hidden overflow-x-hidden pr-2">
              <div className="h-full min-h-0 p-0 flex flex-col">
                <Card className="rounded-none bg-white border-0 shadow-none h-full min-h-0 flex flex-col">
                  <CardHeader className="pl-4 pr-4 pt-5 pb-3 space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="group relative w-full sm:w-[400px]">
                          <Input
                            placeholder="Search documents..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={cn(
                              "h-8 rounded-sm border border-slate-200 bg-white !text-[12.33px] font-medium shadow-sm transition-colors placeholder:!text-[12.33px] hover:border-[#3eca44] focus-visible:!border focus-visible:!border-black focus-visible:ring-0 group-hover:border-[#3eca44]",
                              searchQuery.trim().length > 0 ? "pr-20" : "pr-9",
                            )}
                          />
                          {searchQuery.trim().length > 0 ? (
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[12.33px] font-semibold text-slate-500 hover:text-[#2f9f35] hover:underline"
                              onClick={() => setSearchQuery("")}
                            >
                              Clear
                            </button>
                          ) : (
                            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                          )}
                        </div>
                        <p className="text-[11px] font-medium text-slate-500 whitespace-nowrap sm:self-end">
                          <span className="text-slate-900">
                            {`${documentsTableRangeStart}-${documentsTableRangeEnd}`}
                          </span>{" "}
                          of {filteredDocumentRows.length} documents
                        </p>
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        {selectedDocumentIds.size > 0 && canCurrentUserDeleteDocuments ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={promptDeleteSelectedDocuments}
                            className="h-8 rounded px-3 text-[12.33px] inline-flex items-center border border-slate-200 bg-white text-slate-700 transition-colors hover:border-red-400 hover:bg-white hover:text-red-600"
                          >
                            Delete
                          </Button>
                        ) : null}
                        <DropdownMenu
                          open={isFilterOpen}
                          onOpenChange={(open) => {
                            setIsFilterOpen(open);
                            if (!open) setExpandedFilterSection(null);
                          }}
                        >
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 w-24 justify-between rounded-[4px] px-3 text-[12.33px] inline-flex items-center border border-slate-200 bg-white text-slate-700 transition-colors hover:border-[#3eca44] hover:bg-white hover:text-[#2f9f35] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:border-[#3eca44]"
                            >
                              <span>Filter</span>
                              <ChevronDown className={cn("h-4 w-4 transition-transform", isFilterOpen && "rotate-180")} aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" sideOffset={0} className="w-[260px] rounded-[4px] border border-slate-200 bg-white p-0 shadow-lg">
                            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                              <span className="text-[13.33px] font-semibold text-slate-800">Filter</span>
                              <button
                                type="button"
                                className="text-[11.33px] font-semibold uppercase tracking-wide text-[#2f9f35] hover:underline"
                                onClick={() => {
                                  setDocumentTypeFilter("all");
                                  setDocumentCreatedByFilter("all");
                                  setDocumentCreatedOnFilter("all");
                                  setIsFilterOpen(false);
                                }}
                              >
                                Clear
                              </button>
                            </div>
                            <div className="divide-y divide-slate-200">
                              {["type", "createdBy", "createdOn"].map((section) => (
                                <div key={section}>
                                  <button
                                    type="button"
                                    className={`flex h-9 w-full items-center justify-between px-3 text-left text-[12.33px] font-semibold text-slate-800 hover:bg-slate-100 ${expandedFilterSection === section ? "bg-slate-100" : ""}`}
                                    onClick={() => setExpandedFilterSection((prev) => (prev === section ? null : section))}
                                  >
                                    <span>{section === "type" ? "Type" : section === "createdBy" ? "Created By" : "Created On"}</span>
                                    <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform ${expandedFilterSection === section ? "rotate-180" : ""}`} />
                                  </button>
                                  {expandedFilterSection === section ? (
                                    <div className="px-3 pb-2">
                                      {(section === "type"
                                        ? ["all", ...documentTypes]
                                        : section === "createdBy"
                                          ? ["all", ...documentCreators]
                                          : ["all", "last7", "last14", "last30", "last60"]
                                      ).map((value) => {
                                        const selected =
                                          section === "type"
                                            ? documentTypeFilter === value
                                            : section === "createdBy"
                                              ? documentCreatedByFilter === value
                                              : documentCreatedOnFilter === value;
                                        const label =
                                          value === "all"
                                            ? "All"
                                            : value === "last7"
                                              ? "Last 7 days"
                                              : value === "last14"
                                                ? "Last 14 days"
                                                : value === "last30"
                                                  ? "Last 30 days"
                                                  : value === "last60"
                                                    ? "Last 60 days"
                                                  : value;
                                        return (
                                          <button
                                            key={value}
                                            type="button"
                                            className="flex h-8 w-full items-center justify-between text-[12.33px] text-slate-700 hover:bg-[#3eca44]/10 hover:text-[#2f9f35]"
                                            onClick={() => {
                                              if (section === "type") setDocumentTypeFilter(value);
                                              if (section === "createdBy") setDocumentCreatedByFilter(value);
                                              if (section === "createdOn") setDocumentCreatedOnFilter(value as "all" | "last7" | "last14" | "last30" | "last60");
                                              setIsFilterOpen(false);
                                            }}
                                          >
                                            <span>{label}</span>
                                            {selected ? <Check className="h-3.5 w-3.5 text-[#2f9f35]" /> : null}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <DropdownMenu
                          open={isNewDocumentMenuOpen}
                          onOpenChange={(open) => {
                            setIsNewDocumentMenuOpen(open);
                            if (!open) {
                              setOpenDocumentCategory(null);
                            }
                          }}
                        >
                          <DropdownMenuTrigger asChild>
                            <Button type="button" className={newDocumentButtonStyle}>
                              <span className="truncate">New Document</span>
                              <ChevronDown className="h-4 w-4 text-current" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            sideOffset={0}
                            className={newDocumentDropdownContentStyle}
                          >
                            {documentCreateMenuItems.map((category) => {
                              const flyoutItems = documentCreateFlyoutItems[category.title];
                              const isOpen = openDocumentCategory === category.title;
                              if (flyoutItems.length === 0) {
                                return (
                                  <DropdownMenuItem
                                    key={category.title}
                                    disabled
                                    className={cn(newDocumentDropdownItemStyle, "cursor-not-allowed opacity-50")}
                                  >
                                    {category.title}
                                  </DropdownMenuItem>
                                );
                              }

                              return (
                                <div key={category.title}>
                                  <DropdownMenuItem
                                    onSelect={(event) => {
                                      event.preventDefault();
                                      setOpenDocumentCategory((current) => (current === category.title ? null : category.title));
                                    }}
                                    className={cn(newDocumentDropdownItemStyle, isOpen && "bg-[#3eca44]/10 text-[#2f9f35]")}
                                  >
                                    <span className="flex w-full items-center justify-between gap-2">
                                      <span>{category.title}</span>
                                      <ChevronDown
                                        className={cn(
                                          "h-3.5 w-3.5 flex-none transition-transform duration-150",
                                          isOpen ? "rotate-180 text-[#2f9f35]" : "text-slate-500",
                                        )}
                                        aria-hidden="true"
                                      />
                                    </span>
                                  </DropdownMenuItem>
                                  {isOpen ? (
                                    <div className="pb-1">
                                      {flyoutItems.map((item) => {
                                        const itemDisabled =
                                          item.disabled ||
                                          !item.selectedDocument ||
                                          !activeNewDocumentKeys.has(item.selectedDocument) ||
                                          (item.selectedDocument === "disciplinaryHearingOutcome" &&
                                            !canCurrentUserAccessDisciplinaryHearingOutcome);

                                        return (
                                          <DropdownMenuItem
                                            key={`${category.title}-${item.title}`}
                                            onSelect={(event) => {
                                              event.preventDefault();
                                              if (itemDisabled || !item.selectedDocument) return;
                                              openDocumentGenerator(item.selectedDocument);
                                            }}
                                            disabled={itemDisabled}
                                            className={cn(
                                              newDocumentSubItemStyle,
                                              itemDisabled ? "cursor-not-allowed opacity-50" : "",
                                            )}
                                          >
                                            <span className="flex items-center gap-2">
                                              <ChevronRight className="h-3 w-3 text-slate-400" aria-hidden="true" />
                                              <span>{item.title}</span>
                                            </span>
                                          </DropdownMenuItem>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 min-h-0 flex-col gap-2 overflow-hidden pl-4 pr-4 pb-0">
                    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm border border-slate-200">
                      <div className={cn("grid items-center gap-2 border-b bg-[#2D4256] pl-1 pr-3 py-3 text-xs font-semibold text-white [&>*+*]:pl-2", documentsTableGridClassName)}>
                        <div className="flex items-center justify-center">
                          <Checkbox
                            indicator="x"
                            aria-label="Select all documents"
                            checked={allVisibleSelected}
                            onCheckedChange={(checked) => toggleSelectAllVisibleDocuments(Boolean(checked))}
                            className="h-3 w-3 rounded-[2px] border-white/80 bg-white text-white data-[state=checked]:border-[#3eca44] data-[state=checked]:bg-[#3eca44]"
                          />
                        </div>
                        <div>Date</div>
                        <div>Document Description</div>
                        <div>Client</div>
                        <div className="text-center">Type</div>
                        <div className="text-center">Created By</div>
                        <div className="text-center">View</div>
                      </div>
                      <div className="employee-table-scroll min-h-0 flex-1 divide-y overflow-y-auto">
                        {isDocumentsLoading ? (
                          <div className="px-4 py-6 text-xs text-slate-500">Loading documents...</div>
                        ) : filteredDocumentRows.length === 0 ? (
                          <div className="px-4 py-6 text-xs text-slate-500">No documents found.</div>
                        ) : (
                          paginatedDocumentRows.map((row) => (
                            <div key={row.id} className={cn("group grid h-[36px] w-full cursor-default items-center gap-2 pl-1 pr-3 text-left text-xs hover:bg-[#3eca44]/5 [&>*+*]:border-l [&>*+*]:border-slate-200 [&>*+*]:pl-2", documentsTableGridClassName)}>
                              <div className="flex items-center justify-center">
                                <Checkbox
                                  indicator="x"
                                  checked={selectedDocumentIds.has(row.id)}
                                  onCheckedChange={() => toggleSelectDocument(row.id)}
                                  aria-label={`Select ${row.documentName}`}
                                  className="h-3 w-3 rounded-[2px] border-slate-400 text-white data-[state=checked]:border-[#3eca44] data-[state=checked]:bg-[#3eca44]"
                                />
                              </div>
                              <div>
                                {splitCreatedOnParts(row.createdOn).date ? (
                                  <Tooltip disableHoverableContent>
                                    <TooltipTrigger asChild>
                                      <span className="inline-block transition-colors group-hover:font-semibold">
                                        {splitCreatedOnParts(row.createdOn).date}
                                      </span>
                                    </TooltipTrigger>
                                    {splitCreatedOnParts(row.createdOn).time ? (
                                      <TooltipContent side="top" className="rounded border border-[#3eca44]/35 text-[9.84px] shadow-none">
                                        {`@ ${splitCreatedOnParts(row.createdOn).time}`}
                                      </TooltipContent>
                                    ) : null}
                                  </Tooltip>
                                ) : (
                                  "--"
                                )}
                              </div>
                              <div>
                                <span className="transition-colors group-hover:font-semibold">
                                  {row.documentName}
                                </span>
                              </div>
                              <div className="transition-colors group-hover:font-semibold">{formatDocumentClientName(row.clientName)}</div>
                              <div className="flex justify-center">
                                {row.documentType ? (
                                  <span
                                    className={cn(
                                      "inline-flex max-w-full items-center rounded-full border px-2 py-0 text-[10px] font-medium leading-4 shadow-none",
                                      getDocumentTypePillClassName(row.documentType),
                                    )}
                                  >
                                    <span className="truncate">{row.documentType}</span>
                                  </span>
                                ) : null}
                              </div>
                              <div className="flex min-w-0 items-center justify-center">
                                <span className="inline-flex max-w-full items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium leading-4 text-slate-700 shadow-none">
                                  <span className="truncate">{row.createdBy || "Unknown user"}</span>
                                </span>
                              </div>
                              <div className="flex items-center justify-center">
                                <button
                                  type="button"
                                  className="inline-flex h-5 w-5 items-center justify-center bg-transparent text-slate-500 transition-colors hover:text-[#2f9f35] disabled:cursor-not-allowed disabled:opacity-40"
                                  onClick={() => openDocumentRowFile(row.fileUrl)}
                                  disabled={!row.fileUrl}
                                  aria-label={`View ${row.documentName || "document"}`}
                                >
                                  <DocumentMagnifyingGlassIcon className="h-5 w-5 stroke-[1.25] transition-transform duration-150 hover:scale-110" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="mt-auto flex flex-wrap items-center justify-center gap-2 px-1 pt-[15px] pb-[22px]">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 min-w-[86px] rounded-[4px] border border-[#8fd693] bg-white px-4 text-[11px] font-medium text-[#2f9f35] transition-colors hover:border-[#3eca44] hover:bg-[#eaf8eb] hover:text-[#2f9f35] disabled:border-[#d6ead7] disabled:text-[#a7c9a9]"
                        onClick={() => setDocumentsTablePage((prev) => Math.max(1, prev - 1))}
                        disabled={currentDocumentsTablePage === 1}
                      >
                        Previous
                      </Button>
                      {documentsTablePageNumbers.map((page) =>
                        typeof page === "number" ? (
                          <button
                            key={page}
                            type="button"
                            onClick={() => setDocumentsTablePage(page)}
                            className={`flex h-8 min-w-8 items-center justify-center rounded-[4px] border px-3 text-[11px] font-medium transition-colors ${
                              page === currentDocumentsTablePage
                                ? "border-[#3eca44] bg-[#3eca44] text-white"
                                : "border-[#b9e3bc] bg-white text-[#2f9f35] hover:border-[#3eca44] hover:bg-[#eaf8eb]"
                            }`}
                          >
                            {page}
                          </button>
                        ) : (
                          <span key={page} className="px-1 text-[11px] font-medium text-[#2f9f35]">
                            ...
                          </span>
                        ),
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 min-w-[86px] rounded-[4px] border border-[#8fd693] bg-white px-4 text-[11px] font-medium text-[#2f9f35] transition-colors hover:border-[#3eca44] hover:bg-[#eaf8eb] hover:text-[#2f9f35] disabled:border-[#d6ead7] disabled:text-[#a7c9a9]"
                        onClick={() => setDocumentsTablePage((prev) => Math.min(totalDocumentsTablePages, prev + 1))}
                        disabled={currentDocumentsTablePage === totalDocumentsTablePages}
                      >
                        Next
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>
          </div>
        </div>
      </div>
      <Dialog
        open={isDocumentsRoute && Boolean(activeSession)}
        onOpenChange={(open) => {
          if (open) return;
          closeModal();
        }}
      >
      <DialogContent
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
        className={cn(
          "p-0 focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 [&>button]:hidden",
          isDarkStepperModal
            ? "no-modal-shadow h-[90vh] max-w-[1020px] rounded-sm border-0 bg-[#2D4256] !shadow-none overflow-hidden"
            : isCodeOfConductModal
              ? "no-modal-shadow h-[90vh] max-w-[1020px] rounded-sm border-0 bg-[#2D4256] !shadow-none overflow-hidden"
            : isLightWizardModal
            ? "no-modal-shadow h-[90vh] max-w-[1240px] rounded-sm border-0 bg-[#f7f9fb] !shadow-none overflow-hidden"
            : "h-[90vh] max-w-[1320px] overflow-hidden border border-slate-200",
        )}
      >
          <div className="absolute right-5 top-[23px] z-20 flex -translate-y-1/2 items-center gap-2">
            <button
              type="button"
              onClick={minimizeModal}
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-sm border border-transparent transition-colors focus:outline-none focus-visible:ring-0",
                isDarkStepperModal || isCodeOfConductModal
                  ? "text-slate-400 hover:bg-transparent hover:text-white"
                  : "text-slate-400 hover:bg-transparent hover:text-slate-700",
              )}
              aria-label="Minimize generator"
            >
              <Minus className="h-4 w-4 stroke-[2.4]" />
            </button>
            <button
              type="button"
              onClick={closeModal}
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-sm border border-transparent transition-colors focus:outline-none focus-visible:ring-0",
                isDarkStepperModal || isCodeOfConductModal
                  ? "text-slate-400 hover:bg-transparent hover:text-white"
                  : "text-slate-400 hover:bg-transparent hover:text-slate-700",
              )}
              aria-label="Close generator"
            >
              <X className="h-4 w-4 stroke-[2.4]" />
            </button>
          </div>
          <DialogTitle className="sr-only">{modalBreadcrumbTitle} Generator</DialogTitle>
          {isDarkStepperModal ? (
            <div className="flex h-full min-h-0 flex-col bg-[#2D4256]">
              <header className="absolute inset-x-0 top-0 flex h-[46px] items-center px-4">
                <div className="inline-flex items-center gap-1.5 text-[11px] text-white/90">
                  <Menu className="h-3.5 w-3.5 -ml-0.5" />
                    <span className="font-semibold">
                      <span className="text-white/60">
                      {modalDocument === "discWarningGenerator"
                        ? "Documents / Discipline / "
                        : modalDocument === "hearingNotice"
                          ? "Documents / "
                          : modalDocument === "abscondHearingNotice"
                          ? "Documents / Notices / "
                          : modalDocument === "disciplinaryHearingOutcome"
                            ? "Documents / Outcome / "
                          : modalDocument === "permContract"
                            ? "Documents / Contracts / "
                            : "Documents / Terminations / "}
                      </span>
                    <span className="text-white">{modalBreadcrumbTitle}</span>
                    </span>
                </div>
              </header>
              <div className="mt-[46px] h-[calc(90vh-46px)] bg-white">
                <div className="flex h-14 items-center justify-center border-b border-slate-200 px-4">
                  {usesChevronTracker ? (
                    <div className="flex w-full justify-center overflow-x-auto">
                      <div className="mx-auto flex min-w-fit items-center gap-1">
                        {modalSteps.map((step, index) => {
                          const isActive = index === modalActiveStep;
                          const isComplete = index < modalActiveStep;
                          const isClickable = canSelectTrackerStep(index);
                          const segmentClassName = cn(
                            "relative flex h-9 w-[196px] shrink-0 items-center px-3 text-[10px] font-semibold text-white transition-colors",
                            isComplete
                              ? "bg-[#31b236]"
                              : isActive
                                ? "bg-[#2D4256]"
                                : "bg-slate-200 text-slate-500",
                            isClickable && "cursor-pointer hover:brightness-95",
                          );
                          const segmentContent = (
                            <span className="relative block h-full w-full">
                              <span
                                className={cn(
                                  "absolute left-5 top-1/2 inline-flex h-6 w-6 shrink-0 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[9px] font-bold leading-none",
                                  isComplete
                                    ? "text-[#31b236]"
                                    : isActive
                                      ? "text-[#2D4256]"
                                      : "text-slate-400",
                                )}
                              >
                                {isComplete ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
                              </span>
                              <span
                                className={cn(
                                  "absolute left-[56px] right-3 top-1/2 block -translate-y-1/2 truncate whitespace-nowrap text-[10px] font-semibold text-left",
                                  isActive || isComplete ? "text-white" : "text-slate-500",
                                )}
                              >
                                {step}
                              </span>
                            </span>
                          );
                          const segmentStyle = {
                            clipPath:
                              index === 0
                                ? "polygon(0 0, calc(100% - 24px) 0, 100% 50%, calc(100% - 24px) 100%, 0 100%, 18px 50%)"
                                : "polygon(0 0, calc(100% - 24px) 0, 100% 50%, calc(100% - 24px) 100%, 0 100%, 24px 50%)",
                          } as const;

                          return isClickable ? (
                            <button
                              key={step}
                              type="button"
                              onClick={() => handleTrackerStepSelect(index)}
                              className={segmentClassName}
                              style={segmentStyle}
                            >
                              {segmentContent}
                            </button>
                          ) : (
                            <div key={step} className={segmentClassName} style={segmentStyle}>
                              {segmentContent}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-6">
                      {modalSteps.map((step, index) => {
                        const isActive = index === modalActiveStep;
                        const isComplete = index < modalActiveStep;
                        const isClickable = canSelectTrackerStep(index);
                        const stepContent = (
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
                          <button
                            key={step}
                            type="button"
                            onClick={() => handleTrackerStepSelect(index)}
                            className="flex items-center gap-2 rounded-sm px-1 hover:bg-slate-100"
                          >
                            {stepContent}
                          </button>
                        ) : (
                          <div key={step} className="flex items-center gap-2 px-1">
                            {stepContent}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="h-[calc(100%-56px)] p-4">
                  <div className="mx-auto flex h-full max-w-[900px] min-h-0 flex-col">
                    <section
                      className={cn(
                        "min-h-0 flex-1 overflow-hidden rounded-sm border border-slate-300 bg-white px-5 pt-3 pb-4",
                        isDisciplinaryOutcomeModal && stepMeta?.isFinished && stepMeta?.isPreviewEditable
                          ? "!border-yellow-400"
                          : isDisciplinaryOutcomeModal && stepMeta?.isFinished && stepMeta?.canGoNext
                            ? "!border-[#3eca44]"
                            : "",
                      )}
                    >
                    <Suspense
                      fallback={
                        <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
                          Loading document generator...
                        </div>
                      }
                    >
                      <div className="h-full min-h-0">
                        {ModalComponent ? (
                          <ModalComponent
                            embedded
                            externalNavigation
                            draftState={activeSession?.draftState}
                            onDraftStateChange={(draftState) =>
                              setActiveSession((prev) => (prev ? { ...prev, draftState } : prev))
                            }
                            onRequestClose={() => {
                              closeModal();
                            }}
                            onStepChange={setBreadcrumbStep}
                            onStepMetaChange={setStepMeta}
                          />
                          ) : null}
                      </div>
                    </Suspense>
                    </section>
                    <div className="mt-3 grid grid-cols-3 items-center">
                      <div className="justify-self-start">
                        <button
                          type="button"
                          onClick={() => stepMeta?.onBack?.()}
                          disabled={!stepMeta?.canGoBack}
                          className="h-[28px] w-[84px] rounded border border-[#3eca44] px-3 text-[13.33px] font-semibold text-[#2f9f35] hover:bg-transparent hover:text-[#2f9f35] disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-300"
                        >
                          Back
                        </button>
                      </div>
                      <div className="justify-self-center">
                        {stepMeta?.onClear &&
                        ((((stepMeta?.activeStep ?? 0) > 0 || stepMeta?.supportsResetAtFirstStep) && !stepMeta?.isFinished) ||
                          (stepMeta?.isFinished && stepMeta?.supportsPreviewEditToggle)) ? (
                          <button
                            type="button"
                            onClick={() => stepMeta.onClear?.()}
                            className={cn(
                              "inline-flex h-[28px] w-[84px] items-center justify-center gap-1.5 rounded border bg-white text-xs font-semibold disabled:cursor-not-allowed",
                              stepMeta?.isFinished
                                ? "border-slate-300 text-slate-600 hover:border-[#3eca44] hover:bg-white hover:text-[#2f9f35] disabled:border-slate-300 disabled:text-slate-300"
                                : "border-transparent text-slate-700 hover:border-transparent hover:bg-white hover:text-[#2f9f35] disabled:text-slate-300",
                            )}
                          >
                            {!stepMeta?.isFinished ? <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                            {stepMeta?.isFinished
                              ? stepMeta?.isPreviewEditable
                                ? "Save"
                                : "Edit"
                              : "Reset"}
                          </button>
                        ) : null}
                      </div>
                      <div className="justify-self-end">
                        <button
                          type="button"
                          onClick={() => stepMeta?.onNext?.()}
                          disabled={!stepMeta?.canGoNext}
                          className="h-[28px] w-[84px] rounded bg-[#3eca44] px-3 text-[13.33px] font-semibold text-white hover:bg-[#34b73b] disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {stepMeta?.isFinished
                            ? "Download"
                            : "Next"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : isCodeOfConductModal ? (
            <div className="flex h-full min-h-0 flex-col bg-[#2D4256]">
              <header className="absolute inset-x-0 top-0 flex h-[46px] items-center px-4">
                <div className="inline-flex items-center gap-1.5 text-[11px] text-white/90">
                  <Menu className="h-3.5 w-3.5 -ml-0.5" />
                  <span className="font-semibold">
                    <span className="text-white/60">Documents / Discipline / </span>
                    <span className="text-white">Code of Conduct</span>
                  </span>
                </div>
              </header>
              <div className="mt-[46px] h-[calc(90vh-46px)] bg-white p-4">
                <div className="mx-auto h-full max-w-[900px] min-h-0">
                  <Suspense
                    fallback={
                      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
                        Loading document...
                      </div>
                    }
                  >
                    <div className="h-full min-h-0">
                      {ModalComponent ? (
                        <ModalComponent
                          embedded
                          externalNavigation
                          draftState={activeSession?.draftState}
                          onDraftStateChange={(draftState) =>
                            setActiveSession((prev) => (prev ? { ...prev, draftState } : prev))
                          }
                          onStepChange={setBreadcrumbStep}
                          onStepMetaChange={setStepMeta}
                        />
                      ) : null}
                    </div>
                  </Suspense>
                </div>
              </div>
            </div>
          ) : isLightWizardModal ? (
            <div className="flex h-full min-h-0 flex-col bg-[#f7f9fb]">
              <header className="flex items-center justify-between px-6 pt-4 pb-3">
                <div className="inline-flex items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-[10px] text-slate-500">
                  <Menu className="h-3.5 w-3.5 -ml-1" />
                  <span className="font-semibold text-slate-700">
                    {`Documents / ${modalHeaderCategoryTitle} / ${modalHeaderLabel}`}
                  </span>
                </div>
              </header>
              <div className="min-h-0 flex-1 px-6 pb-4">
                <div className="flex h-full min-h-0 items-stretch gap-4">
                  <aside className="h-full w-[280px] rounded-sm border border-slate-300 bg-white p-4">
                    <div className="space-y-3">
                      {modalSteps.map((step, index) => {
                        const isActive = index === modalActiveStep;
                        const isComplete = index < modalActiveStep;
                        const isClickable = canSelectTrackerStep(index);
                        const itemClasses = cn(
                          "flex items-start gap-3 rounded-sm border px-3 py-2 transition-colors",
                          isActive
                            ? "border-[#9dd8a2] bg-[#e9f9ee]"
                            : isComplete
                              ? "border-emerald-300 bg-emerald-50"
                              : "border-slate-300 bg-white",
                          isClickable && "cursor-pointer hover:border-[#9dd8a2] hover:bg-[#3eca44]/10",
                        );
                        const itemContent = (
                          <>
                            <span
                              className={cn(
                                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                                isActive
                                  ? "border-[#3eca44] bg-[#3eca44] text-white"
                                  : isComplete
                                    ? "border-emerald-600 bg-emerald-600 text-white"
                                    : "border-slate-300 bg-white text-slate-500",
                              )}
                            >
                              {isComplete ? <Check className="h-3 w-3" aria-hidden="true" /> : index + 1}
                            </span>
                            <span
                              className={cn(
                                "text-left text-xs font-semibold leading-5",
                                isActive ? "text-[#2f9f35]" : isComplete ? "text-emerald-700" : "text-slate-600",
                              )}
                            >
                              {step}
                            </span>
                          </>
                        );
                        return isClickable ? (
                          <button
                            key={step}
                            type="button"
                            onClick={() => handleTrackerStepSelect(index)}
                            className={cn(itemClasses, "w-full text-left")}
                          >
                            {itemContent}
                          </button>
                        ) : (
                          <div key={step} className={itemClasses}>
                            {itemContent}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 rounded-sm bg-white px-3 py-3">
                      <h3 className="mb-[11px] text-[11px] font-semibold uppercase tracking-wide text-[#2f9f35]">Notes:</h3>
                      <p className="mt-1 text-[11px] font-semibold text-slate-600 underline decoration-slate-500 underline-offset-2">
                        {activeModalStepLabel}
                      </p>
                      <div className="mt-2 space-y-2">
                        {modalActiveNotes.map((note, index) => {
                          const isExampleLabel = note === "Example:";
                          const isNbNote = note.startsWith("NB! ");
                          const noteBody = isNbNote ? note.slice(4) : note;
                          return (
                            <p
                              key={index}
                              className={cn("text-[11px] leading-5 text-slate-600", isExampleLabel && "font-semibold")}
                            >
                              {isNbNote ? <strong>NB! </strong> : null}
                              {noteBody}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  </aside>
                  <div className="min-w-0 flex-1 min-h-0 flex flex-col">
                    <section
                      className={cn(
                        "relative min-h-0 overflow-hidden rounded-sm border border-slate-300 bg-white px-5 pt-2 pb-4",
                        isDisciplinaryOutcomeModal && stepMeta?.isFinished && stepMeta?.isPreviewEditable
                          ? "!border-yellow-400"
                          : isDisciplinaryOutcomeModal && stepMeta?.isFinished && stepMeta?.canGoNext
                            ? "!border-[#3eca44]"
                            : "",
                        modalDocument === "discWarningGenerator"
                          ? stepMeta?.isFinished
                            ? "flex-1"
                            : "overflow-visible"
                          : "flex-1",
                      )}
                    >
                      <Suspense
                        fallback={
                          <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
                            Loading document generator...
                          </div>
                        }
                      >
                        <div className="h-full min-h-0">
                          {ModalComponent ? (
                            <ModalComponent
                              embedded
                              externalNavigation
                              onStepChange={setBreadcrumbStep}
                              onStepMetaChange={setStepMeta}
                            />
                          ) : null}
                        </div>
                      </Suspense>
                    </section>
                    <div className="mt-3 grid grid-cols-3 items-center">
                      <div className="justify-self-start">
                        <button
                          type="button"
                          onClick={() => stepMeta?.onBack?.()}
                          disabled={!stepMeta?.canGoBack}
                          className="h-[28px] w-[84px] rounded border border-[#3eca44] px-3 text-[13.33px] font-semibold text-[#2f9f35] hover:bg-transparent hover:text-[#2f9f35] disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-300"
                        >
                          Back
                        </button>
                      </div>
                      <div className="justify-self-center">
                        {stepMeta?.onClear &&
                        ((((stepMeta?.activeStep ?? 0) > 0 || stepMeta?.supportsResetAtFirstStep) && !stepMeta?.isFinished) ||
                          (stepMeta?.isFinished && stepMeta?.supportsPreviewEditToggle)) ? (
                          <button
                            type="button"
                            onClick={() => stepMeta.onClear?.()}
                            className={cn(
                              "inline-flex h-[28px] w-[84px] items-center justify-center gap-1.5 rounded border bg-white text-xs font-semibold disabled:cursor-not-allowed",
                              stepMeta?.isFinished
                                ? "border-slate-300 text-slate-600 hover:border-[#3eca44] hover:bg-white hover:text-[#2f9f35] disabled:border-slate-300 disabled:text-slate-300"
                                : "border-transparent text-slate-700 hover:border-transparent hover:bg-white hover:text-[#2f9f35] disabled:text-slate-300",
                            )}
                          >
                            {!stepMeta?.isFinished ? <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                            {stepMeta?.isFinished
                              ? stepMeta?.isPreviewEditable
                                ? "Save"
                                : "Edit"
                              : "Reset"}
                          </button>
                        ) : null}
                      </div>
                      <div className="justify-self-end">
                        <button
                          type="button"
                          onClick={() => stepMeta?.onNext?.()}
                          disabled={!stepMeta?.canGoNext}
                          className="h-[28px] w-[84px] rounded bg-[#3eca44] px-3 text-[13.33px] font-semibold text-white hover:bg-[#34b73b] disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {stepMeta?.isFinished
                            ? "Download"
                            : "Next"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-0 bg-slate-50">
              <aside className="w-[280px] border-r border-slate-200 bg-white p-5">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Discipline</p>
                  <h2 className="text-base font-semibold text-slate-900">{modalTitle}</h2>
                </div>
                <div className="mt-6 space-y-3">
                  {modalSteps.map((step, index) => {
                    const isActive = index === modalActiveStep;
                    const isComplete = index < modalActiveStep;
                    const isClickable = canSelectTrackerStep(index);
                    const itemClasses = cn(
                      "flex items-start gap-3 rounded-sm border px-3 py-2 transition-colors",
                      isActive
                        ? "border-blue-300 bg-blue-50"
                        : isComplete
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-slate-200 bg-white",
                      isClickable && "cursor-pointer hover:border-blue-300 hover:bg-blue-50/40",
                    );
                    const itemContent = (
                      <>
                        <span
                          className={cn(
                            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                            isActive
                              ? "border-blue-600 bg-blue-600 text-white"
                              : isComplete
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-slate-300 bg-white text-slate-500",
                          )}
                        >
                          {index + 1}
                        </span>
                        <span
                          className={cn(
                            "text-left text-xs font-semibold leading-5",
                            isActive ? "text-blue-700" : isComplete ? "text-emerald-700" : "text-slate-600",
                          )}
                        >
                          {step}
                        </span>
                      </>
                    );
                    return isClickable ? (
                      <button
                        key={step}
                        type="button"
                        onClick={() => handleTrackerStepSelect(index)}
                        className={cn(itemClasses, "w-full text-left")}
                      >
                        {itemContent}
                      </button>
                    ) : (
                      <div key={step} className={itemClasses}>
                        {itemContent}
                      </div>
                    );
                  })}
                </div>
              </aside>
              <section className="min-w-0 flex-1 overflow-y-auto bg-white px-5 py-4">
                <Suspense
                  fallback={
                    <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
                      Loading document generator...
                    </div>
                  }
                >
                  <div className="space-y-2">
                      {ModalComponent ? (
                        <ModalComponent
                          embedded
                          draftState={activeSession?.draftState}
                          onDraftStateChange={(draftState) =>
                            setActiveSession((prev) => (prev ? { ...prev, draftState } : prev))
                          }
                          onRequestClose={() => {
                            closeModal();
                          }}
                          onStepChange={setBreadcrumbStep}
                          onStepMetaChange={setStepMeta}
                      />
                    ) : null}
                  </div>
                </Suspense>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Documents;


