import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FolderPlusIcon } from "@heroicons/react/24/outline";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, ChevronDown, FolderOpen, Pencil, Search, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type CaseNote = {
  id: string;
  case_file_id?: string;
  note_date: string;
  note_content: string;
  note_user_name: string;
  updated_at?: string | null;
};
type CaseDateEvent = {
  id: string;
  case_file_id?: string;
  eventType: string;
  eventLabel: string;
  eventDate: string;
  createdByName: string;
  created_at?: string | null;
  updated_at?: string | null;
};
type CaseTask = { title: string; assignedTo: string; dueDate: string; priority: "Low" | "Medium" | "High"; status: string };
type CaseOutcome = { outcomeType: string; outcomeDate: string; result: string; amount: string; closingNote: string; closedBy: string; closedDate: string };
type CaseFile = {
  id: string;
  clientId: string;
  fileNo: string;
  client: string;
  parties: string;
  caseType: string;
  forumVenue: string;
  nextDate: string;
  consultant: string;
  status: "Active" | "Inactive";
  priority: "Low" | "Medium" | "High" | "Urgent";
  lastUpdated: string;
  caseTitle: string;
  subtype: string;
  caseNumber: string;
  employerRepresentative: string;
  currentStage: string;
  shortDescription: string;
  dateEvents: CaseDateEvent[];
  notes: CaseNote[];
  tasks: CaseTask[];
  outcome: CaseOutcome;
};

type ClientOption = { id: string; label: string };
type ConsultantOption = { id: string; label: string };
type MentionOption = { id: string; label: string; token: string; searchText: string };
type NewCaseStep = 1 | 2 | 3;
type CaseDetailsTab = "overview" | "dates" | "notes" | "documents" | "outcome";
type NewCaseForm = {
  clientId: string;
  clientName: string;
  fileNumber: string;
  parties: string;
  caseType: string;
  subtype: string;
  forumVenue: string;
  caseNumber: string;
  currentStage: string;
  nextDate: string;
  deadlineDate: string;
  assignedConsultant: string;
  status: CaseFile["status"];
  priority: CaseFile["priority"];
  shortDescription: string;
  openingNote: string;
  dateEvents: CaseDateEvent[];
};
type CaseEditForm = {
  parties: string;
  caseType: string;
  subtype: string;
  forumVenue: string;
  caseNumber: string;
  currentStage: string;
  assignedConsultant: string;
  status: CaseFile["status"];
  priority: CaseFile["priority"];
  shortDescription: string;
  dateEvents: CaseDateEvent[];
  outcome: CaseOutcome;
};
const caseFilesTableCacheKey = "case-files:table-cache";
const CASE_FILES_TABLE_PAGE_SIZE = 25;
const FILE_NOTE_EDIT_TAG_REGEX =
  /\s*(?:\((Edited by .* on [^)]+)\)|(Edited by .* on .+?(?:\s+at\s+\d{1,2}:\d{2}\s*[AP]M)?))\s*$/i;

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
const buildMatterClientLabel = (registeredName: unknown, companyType: unknown, tradingAs: unknown) => {
  const registered = String(registeredName ?? "").trim();
  const type = String(companyType ?? "").trim();
  const trading = String(tradingAs ?? "").trim();
  const registeredWithType = registered ? appendCompanyTypeSuffix(registered, type) : "";
  if (
    registeredWithType &&
    trading &&
    trading.toLowerCase() !== registered.toLowerCase() &&
    trading.toLowerCase() !== registeredWithType.toLowerCase()
  ) {
    return `${registeredWithType} t/a ${trading}`;
  }
  return registeredWithType || trading || "";
};
const getMatterClientDisplayName = (value: unknown) => {
  const label = String(value ?? "").trim();
  if (!label) return "--";
  const tradingAsIndex = label.toLowerCase().indexOf(" t/a ");
  if (tradingAsIndex >= 0) {
    const tradingAs = label.slice(tradingAsIndex + 5).trim();
    return tradingAs || label;
  }
  return label;
};
const getMatterClientTradingAsName = (value: unknown) => {
  const label = String(value ?? "").trim();
  if (!label) return "";
  const tradingAsIndex = label.toLowerCase().indexOf(" t/a ");
  if (tradingAsIndex < 0) return "";
  return label.slice(tradingAsIndex + 5).trim();
};

const CASE_TYPE_OPTIONS = [
  "Hearing",
  "Consultation",
  "CCMA",
  "Bargaining Council",
  "Wage Negotiations",
  "Labour Court",
] as const;
const NEW_MATTER_OPTIONS: Array<{ label: string; caseType: (typeof CASE_TYPE_OPTIONS)[number] }> = [
  { label: "Hearing", caseType: "Hearing" },
  { label: "Consultation", caseType: "Consultation" },
  { label: "CCMA", caseType: "CCMA" },
  { label: "Bargaining Council", caseType: "Bargaining Council" },
  { label: "Wage Negotiations", caseType: "Wage Negotiations" },
  { label: "Labour Court", caseType: "Labour Court" },
];
const SUBTYPE_NONE = "None";
const CASE_TYPE_SUBTYPE_OPTIONS: Partial<Record<(typeof CASE_TYPE_OPTIONS)[number], readonly string[]>> = {
  Hearing: ["Discipline", "Incapacity (performance)", "Incapacity (ill health)", "Grievance"],
  Consultation: ["General", "Grievance", "Performance", "Retrenchment", "Case Preparation", "Trade Union"],
  CCMA: ["Conciliation", "In Limine", "Con/Arb", "Arbitration"],
  "Bargaining Council": ["Conciliation", "In Limine", "Con/Arb", "Arbitration"],
};
const STATUS_OPTIONS: CaseFile["status"][] = ["Active", "Inactive"];
const PRIORITY_OPTIONS: CaseFile["priority"][] = ["Low", "Medium", "High", "Urgent"];
const CURRENT_STAGE_OPTIONS = ["Scheduled", "Awaiting Date", "Finalised", "In progress"] as const;
const OUTCOME_TYPE_OPTIONS = ["Dismissal Upheld", "Settlement", "Award Issued", "Case Withdrawn", "Matter Closed", "Consultation Completed", "Hearing Finalised"] as const;
const CASE_DATE_EVENT_TYPE_OPTIONS = [
  "Instruction Received",
  "Consultation Date",
  "Referral Date",
  "Date of Dismissal",
  "Notice Issued",
  "Notice of Set Down",
  "Hearing Date",
  "Conciliation Date",
  "Arbitration Date",
  "Labour Court Date",
  "Pre-Trial Conference",
  "Pleadings Due",
  "Deadline Date",
  "Settlement Date",
  "Award / Judgment Date",
  "Next Action Date",
] as const;
const AUTO_PROGRESS_EVENT_TYPES = new Set([
  "Consultation Date",
  "Notice of Set Down",
  "Hearing Date",
  "Conciliation Date",
  "Arbitration Date",
  "Labour Court Date",
  "Pre-Trial Conference",
]);

const getSubtypeOptions = (caseType: string) => CASE_TYPE_SUBTYPE_OPTIONS[caseType as (typeof CASE_TYPE_OPTIONS)[number]] ?? [];
const shouldHideSubtype = (caseType: string) => caseType === "Wage Negotiations" || caseType === "Labour Court";
const getSubtypeValueForCaseType = (caseType: string, currentSubtype = "") => {
  if (shouldHideSubtype(caseType)) return SUBTYPE_NONE;
  const options = getSubtypeOptions(caseType);
  return options.includes(currentSubtype) ? currentSubtype : "";
};
const isVisibleReadOnlyValue = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  return Boolean(
    normalized &&
    normalized !== "--" &&
    normalized !== "None" &&
    normalized !== "Pending" &&
    normalized !== "Awaiting outcome" &&
    normalized !== "R 0.00",
  );
};
const chunkItems = <T,>(items: T[], size: number) => {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
};

const createBlankCaseForm = (): NewCaseForm => ({
  clientId: "",
  clientName: "",
  fileNumber: "",
  parties: "",
  caseType: "",
  subtype: "",
  forumVenue: "",
  caseNumber: "",
  currentStage: "Awaiting Date",
  nextDate: "",
  deadlineDate: "",
  assignedConsultant: "",
  status: "Active",
  priority: "Medium",
  shortDescription: "",
  openingNote: "",
  dateEvents: [],
});
const createCaseEditForm = (caseFile: CaseFile): CaseEditForm => ({
  parties: caseFile.parties === "--" ? "" : caseFile.parties,
  caseType: caseFile.caseType === "--" ? "" : caseFile.caseType,
  subtype: caseFile.subtype === "--" ? "" : caseFile.subtype,
  forumVenue: caseFile.forumVenue === "--" ? "" : caseFile.forumVenue,
  caseNumber: caseFile.caseNumber === "--" ? "" : caseFile.caseNumber,
  currentStage: caseFile.currentStage === "--" ? "Awaiting Date" : caseFile.currentStage,
  assignedConsultant: caseFile.consultant === "--" ? "" : caseFile.consultant,
  status: caseFile.status,
  priority: caseFile.priority,
  shortDescription: caseFile.shortDescription === "--" ? "" : caseFile.shortDescription,
  dateEvents: (caseFile.dateEvents ?? []).map((event) => ({
    ...event,
    eventType: event.eventType || "",
    eventLabel: event.eventLabel || "",
    eventDate: event.eventDate || "",
    createdByName: event.createdByName || "",
  })),
  outcome: {
    outcomeType: caseFile.outcome.outcomeType === "Pending" ? "" : caseFile.outcome.outcomeType,
    outcomeDate: caseFile.outcome.outcomeDate === "--" ? "" : caseFile.outcome.outcomeDate,
    result: caseFile.outcome.result === "Awaiting outcome" ? "" : caseFile.outcome.result,
    amount: caseFile.outcome.amount === "R 0.00" ? "" : caseFile.outcome.amount,
    closingNote: caseFile.outcome.closingNote === "--" ? "" : caseFile.outcome.closingNote,
    closedBy: caseFile.outcome.closedBy === "--" ? "" : caseFile.outcome.closedBy,
    closedDate: caseFile.outcome.closedDate === "--" ? "" : caseFile.outcome.closedDate,
  },
});

const toIsoDate = (value: string) => (value ? new Date(value).toISOString().slice(0, 10) : "");
const createCaseDateEventDraft = (overrides?: Partial<CaseDateEvent>): CaseDateEvent => ({
  id: String(overrides?.id || `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
  case_file_id: overrides?.case_file_id,
  eventType: String(overrides?.eventType || ""),
  eventLabel: String(overrides?.eventLabel || ""),
  eventDate: String(overrides?.eventDate || ""),
  createdByName: String(overrides?.createdByName || ""),
  created_at: overrides?.created_at ?? null,
  updated_at: overrides?.updated_at ?? null,
});
const createNewCasePrimaryDateEvent = (createdByName = "") =>
  createCaseDateEventDraft({
    createdByName,
    eventType: "",
    eventDate: "",
  });
const formatDisplayDate = (value?: string) => {
  if (!value) return "";
  const trimmed = String(value).trim();
  const isoDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/);
  if (isoDateMatch) {
    return `${isoDateMatch[3]}/${isoDateMatch[2]}/${isoDateMatch[1]}`;
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, "0");
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const year = String(parsed.getFullYear());
    return `${day}/${month}/${year}`;
  }
  return trimmed;
};
const formatDisplayTime = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(String(value || "").trim());
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
};
const dateToday = () => new Date().toISOString().slice(0, 10);
const resolveCaseDateEventLabel = (event: Pick<CaseDateEvent, "eventType" | "eventLabel">) =>
  String(event.eventLabel || "").trim() || String(event.eventType || "").trim() || "--";
const sortCaseDateEvents = (events: CaseDateEvent[]) =>
  [...events].sort((left, right) => {
    const leftDate = String(left.eventDate || "");
    const rightDate = String(right.eventDate || "");
    if (leftDate && rightDate && leftDate !== rightDate) return rightDate.localeCompare(leftDate);
    const leftCreated = String(left.created_at || "");
    const rightCreated = String(right.created_at || "");
    if (leftCreated && rightCreated && leftCreated !== rightCreated) return rightCreated.localeCompare(leftCreated);
    return resolveCaseDateEventLabel(left).localeCompare(resolveCaseDateEventLabel(right));
  });
const getCaseNextActionDate = (events: CaseDateEvent[]) => {
  const nextActionEvents = events.filter((event) => event.eventType === "Next Action Date" && event.eventDate);
  if (nextActionEvents.length === 0) return "--";
  const today = dateToday();
  const upcoming = nextActionEvents
    .map((event) => event.eventDate)
    .filter((value) => value >= today)
    .sort((left, right) => left.localeCompare(right));
  if (upcoming.length > 0) return upcoming[0];
  return nextActionEvents
    .map((event) => event.eventDate)
    .sort((left, right) => right.localeCompare(left))[0] || "--";
};
const getFirstScheduledEventDate = (events: CaseDateEvent[]) =>
  events
    .filter((event) => AUTO_PROGRESS_EVENT_TYPES.has(String(event.eventType || "").trim()) && String(event.eventDate || "").trim())
    .map((event) => String(event.eventDate || "").trim())
    .sort((left, right) => left.localeCompare(right))[0] || "";
const normalizeCurrentStageValue = (value: unknown) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "scheduled") return "Scheduled";
  if (normalized === "awaiting date") return "Awaiting Date";
  if (normalized === "finalised" || normalized === "finalized") return "Finalised";
  if (normalized === "in progress") return "In progress";
  return "";
};
const resolveCurrentStage = (value: unknown, status: CaseFile["status"], events: CaseDateEvent[]) => {
  if (status === "Inactive") return "Finalised";
  const normalizedStage = normalizeCurrentStageValue(value) || "Awaiting Date";
  if (normalizedStage === "Scheduled") {
    const firstScheduledDate = getFirstScheduledEventDate(events);
    if (firstScheduledDate && firstScheduledDate <= dateToday()) {
      return "In progress";
    }
  }
  return normalizedStage;
};
const getCurrentStagePillClassName = (value: unknown) => {
  const stage = normalizeCurrentStageValue(value);
  if (stage === "Scheduled") {
    return "border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50 hover:text-sky-700";
  }
  if (stage === "Awaiting Date") {
    return "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50 hover:text-amber-700";
  }
  if (stage === "In progress") {
    return "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700";
  }
  if (stage === "Finalised") {
    return "border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100 hover:text-slate-700";
  }
  return "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-50 hover:text-slate-600";
};
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const toMentionToken = (value: string) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_.-]/g, "");
const renderTextWithMentions = (value: string) => {
  const escaped = escapeHtml(String(value || ""));
  return escaped
    .replace(/\r\n|\r|\n/g, "<br />")
    .replace(/(^|[\s(>])(@[A-Za-z0-9_.-]+)/g, '$1<span class="text-[#2f9f35]">$2</span>');
};
const renderInlineMentionHighlights = (value: string) => {
  const escaped = escapeHtml(String(value || ""));
  return escaped.replace(
    /(^|[\s(>])(@[A-Za-z0-9_.-]+)/g,
    '$1<span class="rounded bg-slate-200 px-1 py-[1px] text-slate-700">$2</span>',
  );
};
const getActiveMentionMatch = (value: string, caretIndex: number) => {
  const safeValue = String(value || "");
  const beforeCaret = safeValue.slice(0, caretIndex);
  const match = beforeCaret.match(/(?:^|\s)(@[A-Za-z0-9_.-]*)$/);
  if (!match) return null;
  const query = String(match[1] || "");
  const start = beforeCaret.length - query.length;
  return { query, start, end: caretIndex };
};
const getMentionTokenRangeAtCaret = (value: string, caretIndex: number) => {
  const safeValue = String(value || "");
  const mentionRegex = /@[A-Za-z0-9_.-]+/g;
  let match: RegExpExecArray | null;
  while ((match = mentionRegex.exec(safeValue)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (caretIndex === end || (caretIndex > start && caretIndex <= end)) {
      return { start, end };
    }
  }
  return null;
};
const getTextareaMentionPopupPosition = (textarea: HTMLTextAreaElement, caretIndex: number) => {
  const computed = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";
  mirror.style.overflowWrap = "break-word";
  mirror.style.boxSizing = "border-box";
  mirror.style.font = computed.font;
  mirror.style.fontFamily = computed.fontFamily;
  mirror.style.fontSize = computed.fontSize;
  mirror.style.fontWeight = computed.fontWeight;
  mirror.style.lineHeight = computed.lineHeight;
  mirror.style.letterSpacing = computed.letterSpacing;
  mirror.style.padding = computed.padding;
  mirror.style.border = computed.border;
  mirror.style.width = `${textarea.clientWidth}px`;
  mirror.textContent = textarea.value.slice(0, caretIndex);
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const markerRect = marker.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();
  const top = markerRect.top - mirrorRect.top - textarea.scrollTop;
  const left = markerRect.left - mirrorRect.left - textarea.scrollLeft;
  document.body.removeChild(mirror);
  return { top, left };
};
const normalizeEditedTagForDisplay = (tag: string) => {
  const value = String(tag || "").trim();
  if (!value) return "";
  const match = value.match(/^Edited by\s+(.+?)\s+on\s+(.+?)(?:\s+at\s+(.+))?$/i);
  if (!match) return value;
  const actor = String(match[1] || "").trim();
  const rawDate = String(match[2] || "").trim();
  const rawTime = String(match[3] || "").trim();
  let parsedDate: Date | null = null;
  const slashDate = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashDate) {
    parsedDate = new Date(Number(slashDate[3]), Number(slashDate[2]) - 1, Number(slashDate[1]));
  } else {
    const generic = new Date(rawDate);
    parsedDate = Number.isNaN(generic.getTime()) ? null : generic;
  }
  const nextDate = parsedDate ? formatDisplayDate(parsedDate.toISOString()) : rawDate;
  if (rawTime) return `Edited by ${actor} on ${nextDate} at ${rawTime}`;
  return `Edited by ${actor} on ${nextDate}`;
};
const ensureEditedTagHasTime = (tag: string, updatedAt?: string | null) => {
  const normalized = normalizeEditedTagForDisplay(tag);
  if (!normalized) return normalized;
  if (/\sat\s/i.test(normalized)) return normalized;
  const fallbackTime = formatDisplayTime(String(updatedAt || "").trim());
  if (!fallbackTime) return normalized;
  return `${normalized} at ${fallbackTime}`;
};
const sanitizeEditedTag = (tag: string, updatedAt?: string | null) => {
  const value = String(tag || "").trim();
  if (!value) return "";
  const actorMatch = value.match(/^Edited by\s+(.+?)\s+on\s+/i);
  const actor = String(actorMatch?.[1] || "").trim();
  if (!actor) return ensureEditedTagHasTime(value, updatedAt);
  const displayDate = updatedAt ? formatDisplayDate(updatedAt) : "";
  const displayTime = formatDisplayTime(String(updatedAt || "").trim());
  if (displayDate && displayTime) return `Edited by ${actor} on ${displayDate} at ${displayTime}`;
  if (displayDate) return `Edited by ${actor} on ${displayDate}`;
  return ensureEditedTagHasTime(value, updatedAt);
};
const splitFileNoteContentAndEditTag = (raw: string) => {
  const value = String(raw || "").trim();
  if (!value) return { content: "", editTag: "" };

  const editedIndex = value.toLowerCase().lastIndexOf("edited by ");
  if (editedIndex >= 0) {
    const content = value.slice(0, editedIndex).trim();
    const editTag = value.slice(editedIndex).trim();
    return { content, editTag };
  }

  const match = value.match(FILE_NOTE_EDIT_TAG_REGEX);
  const editTag = match ? String(match[1] || match[2] || "").trim() : "";
  const content = editTag ? value.replace(FILE_NOTE_EDIT_TAG_REGEX, "").trim() : value;
  return { content, editTag };
};

const getCurrentMatterYearSegment = () => String(new Date().getFullYear()).slice(-2);

const getMatterHeaderTitle = (caseFile: CaseFile | null) => {
  if (!caseFile) return "";
  if (caseFile.caseType !== "Hearing") {
    const subtype = String(caseFile.subtype || "").trim();
    const hasSubtype = subtype && subtype !== "--" && subtype !== "None";
    if (caseFile.caseType === "Consultation") {
      return hasSubtype ? `${subtype} Consultation` : "Consultation";
    }
    if (caseFile.caseType === "CCMA") {
      return hasSubtype ? `CCMA - ${subtype}` : "CCMA";
    }
    if (caseFile.caseType === "Bargaining Council") {
      return hasSubtype ? `Bargaining Council - ${subtype}` : "Bargaining Council";
    }
    return hasSubtype ? `${caseFile.caseType} (${subtype})` : caseFile.caseType;
  }

  const subtype = String(caseFile.subtype || "").trim().toLowerCase();
  if (subtype === "discipline") return "Disciplinary Hearing";
  if (subtype === "incapacity (performance)") return "Poor Performance Hearing";
  if (subtype === "incapacity (ill health)") return "Ill Health Hearing";
  if (subtype === "grievance") return "Grievance Hearing";
  return "Hearing";
};

const loadCachedCaseFiles = (): CaseFile[] => {
  try {
    const raw = sessionStorage.getItem(caseFilesTableCacheKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveCachedCaseFiles = (rows: CaseFile[]) => {
  try {
    sessionStorage.setItem(caseFilesTableCacheKey, JSON.stringify(rows));
  } catch {
    // ignore storage errors
  }
};

const Matters = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [caseFiles, setCaseFiles] = useState<CaseFile[]>(() => loadCachedCaseFiles());
  const [isCaseFilesLoading, setIsCaseFilesLoading] = useState(() => loadCachedCaseFiles().length === 0);
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [clientLoadMessage, setClientLoadMessage] = useState("No clients found.");
  const [consultantOptions, setConsultantOptions] = useState<ConsultantOption[]>([]);
  const [mentionOptions, setMentionOptions] = useState<MentionOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [caseFilesTablePage, setCaseFilesTablePage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | CaseFile["status"]>("all");
  const [caseTypeFilter, setCaseTypeFilter] = useState("all");
  const [consultantFilter, setConsultantFilter] = useState("all");
  const [nextDateFilter, setNextDateFilter] = useState<"all" | "next7" | "next30">("all");
  const [expandedFilterSection, setExpandedFilterSection] = useState<string | null>(null);
  const [isFiltersPanelOpen, setIsFiltersPanelOpen] = useState(false);
  const [isNewCaseMenuOpen, setIsNewCaseMenuOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseFile | null>(null);
  const [activeCaseTab, setActiveCaseTab] = useState<CaseDetailsTab>("overview");
  const [isCaseEditMode, setIsCaseEditMode] = useState(false);
  const [isSavingCaseEdit, setIsSavingCaseEdit] = useState(false);
  const [caseEditForm, setCaseEditForm] = useState<CaseEditForm | null>(null);
  const [isCaseDateDialogOpen, setIsCaseDateDialogOpen] = useState(false);
  const [editingCaseDateEventId, setEditingCaseDateEventId] = useState<string | null>(null);
  const [caseDateEventForm, setCaseDateEventForm] = useState({
    eventType: "",
    eventDate: "",
    createdByName: "",
  });
  const [currentUserDisplayName, setCurrentUserDisplayName] = useState("");
  const [currentUserSubuserRole, setCurrentUserSubuserRole] = useState("");
  const [caseNotesSearchQuery, setCaseNotesSearchQuery] = useState("");
  const [isCaseNotesLoading, setIsCaseNotesLoading] = useState(false);
  const [isCaseNoteDialogOpen, setIsCaseNoteDialogOpen] = useState(false);
  const [isSavingCaseNote, setIsSavingCaseNote] = useState(false);
  const [editingCaseNoteId, setEditingCaseNoteId] = useState<string | null>(null);
  const [isCaseNotePreviewOpen, setIsCaseNotePreviewOpen] = useState(false);
  const [caseNotePreviewContent, setCaseNotePreviewContent] = useState("");
  const [caseNotePreviewEditTag, setCaseNotePreviewEditTag] = useState("");
  const [caseNotePreviewUpdatedAt, setCaseNotePreviewUpdatedAt] = useState("");
  const [caseNoteForm, setCaseNoteForm] = useState({
    noteDate: "",
    noteContent: "",
    noteUserName: "",
  });
  const [caseNoteMentionRange, setCaseNoteMentionRange] = useState<{ query: string; start: number; end: number } | null>(null);
  const [caseNoteMentionPopupPosition, setCaseNoteMentionPopupPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [isNewCaseDialogOpen, setIsNewCaseDialogOpen] = useState(false);
  const [isClientSelectOpen, setIsClientSelectOpen] = useState(false);
  const [newCaseStep, setNewCaseStep] = useState<NewCaseStep>(1);
  const [newCaseForm, setNewCaseForm] = useState<NewCaseForm>(createBlankCaseForm());
  const [isSavingCase, setIsSavingCase] = useState(false);
  const caseDateEventDialogInputRef = useRef<HTMLInputElement | null>(null);
  const newCaseDateEventInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const caseNoteTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const caseTypes = useMemo(() => Array.from(new Set(caseFiles.map((item) => item.caseType))), [caseFiles]);
  const consultants = useMemo(() => Array.from(new Set(caseFiles.map((item) => item.consultant).filter(Boolean))), [caseFiles]);

  const normalizeStatus = (value: string): CaseFile["status"] => {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "inactive" ? "Inactive" : "Active";
  };

  const normalizePriority = (value: string | null | undefined): CaseFile["priority"] => {
    if (!value) return "Medium";
    const normalized = value.trim().toLowerCase();
    if (normalized === "low") return "Low";
    if (normalized === "high") return "High";
    if (normalized === "urgent") return "Urgent";
    return "Medium";
  };

  const fetchCurrentUserDisplayName = useCallback(async () => {
    if (!user?.id) return;
    const { data: subuserData } = await (supabase as any)
      .from("subusers")
      .select("name,surname,role")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    const subuserName = String((subuserData as any)?.name || "").trim();
    const subuserSurname = String((subuserData as any)?.surname || "").trim();
    const subuserRole = String((subuserData as any)?.role || "").trim();
    const subuserFullName = `${subuserName} ${subuserSurname}`.trim();
    if (subuserFullName) {
      setCurrentUserSubuserRole(subuserRole);
      setCurrentUserDisplayName(subuserFullName);
      return;
    }
    setCurrentUserSubuserRole("");

    const { data: profileData } = await (supabase as any)
      .from("profiles")
      .select("user_name, user_surname")
      .eq("id", user.id)
      .maybeSingle();
    const profileName = String((profileData as any)?.user_name || "").trim();
    const profileSurname = String((profileData as any)?.user_surname || "").trim();
    const profileFullName = `${profileName} ${profileSurname}`.trim();
    if (profileFullName) setCurrentUserDisplayName(profileFullName);
  }, [user?.id]);
  const resolveCurrentUserName = useCallback(() => {
    if (currentUserDisplayName.trim()) return currentUserDisplayName.trim();
    const firstName = String((user as any)?.user_metadata?.user_name || (user as any)?.user_metadata?.name || (user as any)?.user_metadata?.given_name || "").trim();
    const surname = String((user as any)?.user_metadata?.user_surname || (user as any)?.user_metadata?.surname || (user as any)?.user_metadata?.family_name || "").trim();
    const combined = `${firstName} ${surname}`.trim();
    if (combined) return combined;
    const fromMetaName = String((user as any)?.user_metadata?.full_name || "").trim();
    if (fromMetaName) return fromMetaName;
    const fromMetaDisplay = String((user as any)?.user_metadata?.display_name || "").trim();
    if (fromMetaDisplay) return fromMetaDisplay;
    const fromEmail = String(user?.email || "").trim();
    return fromEmail || "Unknown User";
  }, [currentUserDisplayName, user]);
  const isNoteEditableByCurrentUser = useCallback(
    (note: CaseNote) => {
      const actor = resolveCurrentUserName().trim().toLowerCase();
      const createdBy = String(note?.note_user_name || "").trim().toLowerCase();
      if (!actor || !createdBy) return false;
      return actor === createdBy;
    },
    [resolveCurrentUserName],
  );
  const canCurrentUserDeleteNotes = useMemo(() => {
    const role = currentUserSubuserRole.trim().toLowerCase();
    if (!role) return true;
    return role !== "consultant" && role !== "administrator";
  }, [currentUserSubuserRole]);
  const isFallbackActorName = useCallback(
    (value: string) => {
      const current = String(value || "").trim();
      const email = String(user?.email || "").trim();
      return !current || current === "Unknown User" || (email.length > 0 && current === email);
    },
    [user?.email],
  );
  const resetCaseNoteForm = useCallback(() => {
    setCaseNoteForm({
      noteDate: dateToday(),
      noteContent: "",
      noteUserName: resolveCurrentUserName(),
    });
    setCaseNoteMentionRange(null);
    setCaseNoteMentionPopupPosition(null);
    setEditingCaseNoteId(null);
  }, [resolveCurrentUserName]);
  const fetchCaseDateEvents = useCallback(async (caseFileId: string) => {
    if (!caseFileId) return [];
    const { data, error } = await (supabase as any)
      .from("case_dates")
      .select("id,case_file_id,date_type,date_value,event_label,created_by_name,created_at,updated_at")
      .eq("case_file_id", caseFileId)
      .order("date_value", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false });
    if (error) throw error;
    const dateEvents = sortCaseDateEvents(
      (Array.isArray(data) ? data : []).map((row: any) =>
        createCaseDateEventDraft({
          id: String(row?.id || ""),
          case_file_id: String(row?.case_file_id || caseFileId),
          eventType: String(row?.date_type || ""),
          eventLabel: String(row?.event_label || ""),
          eventDate: String(row?.date_value || ""),
          createdByName: String(row?.created_by_name || ""),
          created_at: row?.created_at ? String(row.created_at) : null,
          updated_at: row?.updated_at ? String(row.updated_at) : null,
        }),
      ),
    );
    setSelectedCase((prev) => prev && prev.id === caseFileId ? {
      ...prev,
      dateEvents,
      nextDate: getCaseNextActionDate(dateEvents),
      currentStage: resolveCurrentStage(prev.currentStage, prev.status, dateEvents),
    } : prev);
    return dateEvents;
  }, []);
  const fetchCaseNotes = useCallback(async (caseFileId: string) => {
    if (!user?.id || !caseFileId) return [];
    setIsCaseNotesLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("case_notes")
        .select("*")
        .eq("case_file_id", caseFileId)
        .order("note_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      const notes = (data ?? []).map((row: any) => ({
        id: String(row.id || ""),
        case_file_id: String(row.case_file_id || caseFileId),
        note_date: String(row.note_date || row.created_at?.slice(0, 10) || ""),
        note_content: String(row.note_content || row.note_body || ""),
        note_user_name: String(row.note_user_name || ""),
        updated_at: row.updated_at ? String(row.updated_at) : null,
      }));
      setSelectedCase((prev) => (prev && prev.id === caseFileId ? { ...prev, notes } : prev));
      return notes;
    } catch (error: any) {
      toast({ title: "Unable to load case notes", description: error?.message || "Load failed.", variant: "destructive" });
      return [];
    } finally {
      setIsCaseNotesLoading(false);
    }
  }, [toast, user?.id]);

  const fetchCaseFiles = useCallback(async () => {
    if (caseFiles.length === 0) {
      setIsCaseFilesLoading(true);
    }
    const { data, error } = await (supabase as any)
      .from("case_files")
      .select("*")
      .order("created_at", { ascending: false, nullsFirst: false });

    if (error) {
      setIsCaseFilesLoading(false);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    const rows: any[] = Array.isArray(data) ? data : [];
    const caseIds = rows.map((r) => r.id).filter(Boolean);
    const deadlineByCase = new Map<string, string>();
    const dateEventsByCase = new Map<string, CaseDateEvent[]>();

    if (caseIds.length > 0) {
      const { data: dateRows } = await (supabase as any)
        .from("case_dates")
        .select("id,case_file_id,date_type,date_value,event_label,created_by_name,created_at,updated_at")
        .in("case_file_id", caseIds);
      (dateRows ?? []).forEach((d: any) => {
        const caseFileId = String(d?.case_file_id || "");
        if (caseFileId) {
          const nextEvents = dateEventsByCase.get(caseFileId) ?? [];
          nextEvents.push(
            createCaseDateEventDraft({
              id: String(d?.id || ""),
              case_file_id: caseFileId,
              eventType: String(d?.date_type || ""),
              eventLabel: String(d?.event_label || ""),
              eventDate: String(d?.date_value || ""),
              createdByName: String(d?.created_by_name || ""),
              created_at: d?.created_at ? String(d.created_at) : null,
              updated_at: d?.updated_at ? String(d.updated_at) : null,
            }),
          );
          dateEventsByCase.set(caseFileId, nextEvents);
        }
        if (d?.date_type === "Deadline Date" && d?.case_file_id && d?.date_value) {
          const nextValue = String(d.date_value);
          const previousValue = String(deadlineByCase.get(caseFileId) || "");
          if (!previousValue || nextValue > previousValue) {
            deadlineByCase.set(caseFileId, nextValue);
          }
        }
      });
    }

    const mapped: CaseFile[] = rows.map((row) => {
      const nextDate = row.next_date ?? "--";
      const deadlineDate = deadlineByCase.get(row.id) ?? "--";
      const dateEvents = sortCaseDateEvents([
        ...(dateEventsByCase.get(String(row.id)) ?? []),
        ...(nextDate && nextDate !== "--"
          ? [createCaseDateEventDraft({ id: `summary-next-${row.id}`, eventType: "Next Action Date", eventDate: nextDate })]
          : []),
        ...(deadlineDate && deadlineDate !== "--"
          ? [createCaseDateEventDraft({ id: `summary-deadline-${row.id}`, eventType: "Deadline Date", eventDate: deadlineDate })]
          : []),
      ]);
      return {
        id: row.id,
        clientId: row.client_id ?? "",
        fileNo: row.file_number ?? "--",
        client: row.client_name ?? "--",
        parties: row.parties ?? "--",
        caseType: row.case_type ?? "--",
        forumVenue: row.forum ?? "--",
        nextDate,
        consultant: row.consultant ?? "--",
        status: normalizeStatus(row.status ?? "Active"),
        priority: normalizePriority(row.priority),
        lastUpdated: toIsoDate(row.last_updated ?? row.updated_at ?? row.created_at ?? new Date().toISOString()),
        caseTitle: row.parties ?? "--",
        subtype: row.case_subtype ?? "--",
        caseNumber: row.case_number ?? "--",
        employerRepresentative: "--",
        currentStage: resolveCurrentStage(row.current_stage ?? "--", normalizeStatus(row.status ?? "Active"), dateEvents),
        shortDescription: row.short_description ?? "--",
        dateEvents,
        notes: [],
        tasks: [],
        outcome: { outcomeType: "Pending", outcomeDate: "--", result: "Awaiting outcome", amount: "R 0.00", closingNote: "--", closedBy: "--", closedDate: "--" },
      };
    });

    setCaseFiles(mapped);
    setIsCaseFilesLoading(false);
  }, [caseFiles.length, toast]);

  useEffect(() => {
    const loadClients = async () => {
      const baseQuery = (supabase as any)
        .from("clients")
        .select("*");
      const { data, error } = await baseQuery
        .or("status.is.null,status.eq.active")
        .order("created_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false, nullsFirst: false });
      if (error) {
        setClientOptions([]);
        setClientLoadMessage(`Unable to load clients: ${error.message}`);
        return;
      }
      const mapped = (data ?? []).map((c: any) => {
        const registered = String(c.registered_name ?? c.company_name ?? c.client_name ?? "").trim();
        const trading = String(c.trading_as ?? c.trading_name ?? c.client_surname ?? "").trim();
        const companyType = String(c.company_type ?? "").trim();
        return {
          id: c.id,
          label: buildMatterClientLabel(registered, companyType, trading),
        };
      });
      const valid = mapped.filter((c) => c.label.trim().length > 0);
      if (valid.length > 0) {
        setClientOptions(valid);
        setClientLoadMessage("No clients found.");
        return;
      }
      setClientOptions([]);
      setClientLoadMessage("No clients found.");
    };
    void loadClients();
  }, []);
  useEffect(() => {
    void fetchCurrentUserDisplayName();
  }, [fetchCurrentUserDisplayName]);

  useEffect(() => {
    const loadConsultants = async () => {
      if (!user?.id) {
        setConsultantOptions([]);
        return;
      }

      const metadataCompanyId = String((user as any)?.user_metadata?.company_id || "").trim();
      const companyId = metadataCompanyId || user.id;
      const options: ConsultantOption[] = [];
      const seen = new Set<string>();

      const addOption = (id: string, label: string) => {
        const safeId = String(id || "").trim();
        const safeLabel = String(label || "").trim();
        if (!safeId || !safeLabel) return;
        const dedupeKey = safeLabel.toLowerCase();
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);
        options.push({ id: safeId, label: safeLabel });
      };

      const { data: masterProfiles } = await (supabase as any)
        .from("profiles")
        .select("id,user_name,user_surname,user_email")
        .order("user_name", { ascending: true, nullsFirst: false })
        .order("user_surname", { ascending: true, nullsFirst: false });

      (Array.isArray(masterProfiles) ? masterProfiles : []).forEach((row: any) => {
        const fullName = `${String(row?.user_name || "").trim()} ${String(row?.user_surname || "").trim()}`.trim();
        addOption(String(row?.id || fullName), fullName || String(row?.user_email || "").trim());
      });

      const { data: subusers } = await (supabase as any)
        .from("subusers")
        .select("id,name,surname,email,role,status,company_id")
        .eq("company_id", companyId)
        .eq("role", "Consultant")
        .in("status", ["accepted", "active"])
        .order("name", { ascending: true });

      (Array.isArray(subusers) ? subusers : []).forEach((row: any) => {
        const fullName = `${String(row?.name || "").trim()} ${String(row?.surname || "").trim()}`.trim();
        addOption(String(row?.id || fullName), fullName || String(row?.email || "").trim());
      });

      setConsultantOptions(options);
    };

    void loadConsultants();
  }, [user]);
  useEffect(() => {
    const loadMentionOptions = async () => {
      if (!user?.id) {
        setMentionOptions([]);
        return;
      }
      const metadataCompanyId = String((user as any)?.user_metadata?.company_id || "").trim();
      const companyId = metadataCompanyId || user.id;
      const options: MentionOption[] = [];
      const seen = new Set<string>();
      const addMentionOption = (id: string, label: string) => {
        const safeLabel = String(label || "").trim();
        const token = toMentionToken(safeLabel);
        if (!safeLabel || !token) return;
        const dedupeKey = token.toLowerCase();
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);
        options.push({
          id: String(id || token),
          label: safeLabel,
          token,
          searchText: `${safeLabel} ${token}`.toLowerCase(),
        });
      };
      const { data: masterProfiles } = await (supabase as any)
        .from("profiles")
        .select("id,user_name,user_surname,user_email")
        .order("user_name", { ascending: true, nullsFirst: false })
        .order("user_surname", { ascending: true, nullsFirst: false });
      (Array.isArray(masterProfiles) ? masterProfiles : []).forEach((row: any) => {
        const fullName = `${String(row?.user_name || "").trim()} ${String(row?.user_surname || "").trim()}`.trim();
        addMentionOption(String(row?.id || fullName), fullName || String(row?.user_email || "").trim());
      });
      const { data: subusers } = await (supabase as any)
        .from("subusers")
        .select("id,name,surname,email,status,company_id")
        .eq("company_id", companyId)
        .in("status", ["accepted", "active"])
        .order("name", { ascending: true });
      (Array.isArray(subusers) ? subusers : []).forEach((row: any) => {
        const fullName = `${String(row?.name || "").trim()} ${String(row?.surname || "").trim()}`.trim();
        addMentionOption(String(row?.id || fullName), fullName || String(row?.email || "").trim());
      });
      setMentionOptions(options);
    };
    void loadMentionOptions();
  }, [user]);

  useEffect(() => {
    void fetchCaseFiles();
  }, [fetchCaseFiles]);

  useEffect(() => {
    saveCachedCaseFiles(caseFiles);
  }, [caseFiles]);

  useEffect(() => {
    if (!selectedCase) {
      setActiveCaseTab("overview");
      setIsCaseEditMode(false);
      setCaseEditForm(null);
      return;
    }
    setActiveCaseTab("overview");
    setIsCaseEditMode(false);
    setCaseEditForm(createCaseEditForm(selectedCase));
  }, [selectedCase?.id]);

  useEffect(() => {
    const loadSelectedCaseDetails = async () => {
      if (!selectedCase?.id) return;

      const [datesResponse, outcomeResponse] = await Promise.all([
        fetchCaseDateEvents(selectedCase.id),
        (supabase as any)
          .from("case_outcomes")
          .select("outcome_type,outcome_date,result,amount_awarded,amount_settled,closing_note,closed_by")
          .eq("case_file_id", selectedCase.id)
          .maybeSingle(),
      ]);
      const dateEvents = datesResponse;

      const outcomeRow = outcomeResponse.data;
      const resolvedAmountRaw = outcomeRow?.amount_awarded ?? outcomeRow?.amount_settled;
      const resolvedAmount =
        resolvedAmountRaw === null || resolvedAmountRaw === undefined || resolvedAmountRaw === ""
          ? "R 0.00"
          : `R ${Number(resolvedAmountRaw).toFixed(2)}`;

      const { data: noteRows, error: noteError } = await (supabase as any)
        .from("case_notes")
        .select("*")
        .eq("case_file_id", selectedCase.id)
        .order("note_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false });
      if (noteError) throw noteError;
      const notes: CaseNote[] = (noteRows ?? []).map((row: any) => ({
        id: String(row.id || ""),
        case_file_id: String(row.case_file_id || selectedCase.id),
        note_date: String(row.note_date || row.created_at?.slice(0, 10) || ""),
        note_content: String(row.note_content || row.note_body || ""),
        note_user_name: String(row.note_user_name || ""),
        updated_at: row.updated_at ? String(row.updated_at) : null,
      }));

      const mergedCase: CaseFile = {
        ...selectedCase,
        nextDate: getCaseNextActionDate(dateEvents),
        currentStage: resolveCurrentStage(selectedCase.currentStage, selectedCase.status, dateEvents),
        dateEvents,
        notes,
        outcome: outcomeRow
          ? {
              outcomeType: String(outcomeRow.outcome_type || "").trim() || "Pending",
              outcomeDate: String(outcomeRow.outcome_date || "").trim() || "--",
              result: String(outcomeRow.result || "").trim() || "Awaiting outcome",
              amount: resolvedAmount,
              closingNote: String(outcomeRow.closing_note || "").trim() || "--",
              closedBy: String(outcomeRow.closed_by || "").trim() || "--",
              closedDate: String(outcomeRow.outcome_date || "").trim() || "--",
            }
          : selectedCase.outcome,
      };

      setSelectedCase(mergedCase);
      if (!isCaseEditMode) {
        setCaseEditForm(createCaseEditForm(mergedCase));
      }
    };

    void loadSelectedCaseDetails();
  }, [fetchCaseDateEvents, selectedCase?.id]);

  useEffect(() => {
    if (!isCaseNoteDialogOpen) return;
    if (editingCaseNoteId) return;
    const resolved = resolveCurrentUserName();
    if (!resolved) return;
    setCaseNoteForm((prev) => {
      if (!isFallbackActorName(prev.noteUserName)) return prev;
      if (prev.noteUserName === resolved) return prev;
      return { ...prev, noteUserName: resolved };
    });
  }, [editingCaseNoteId, isCaseNoteDialogOpen, isFallbackActorName, resolveCurrentUserName]);

  const parseCurrencyValue = (value: string) => {
    const cleaned = String(value || "").replace(/[^0-9.-]/g, "");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const resetCaseDateEventForm = useCallback(() => {
    setCaseDateEventForm({
      eventType: "",
      eventDate: "",
      createdByName: resolveCurrentUserName(),
    });
    setEditingCaseDateEventId(null);
  }, [resolveCurrentUserName]);
  const openAddCaseDateEventDialog = useCallback(() => {
    setEditingCaseDateEventId(null);
    setCaseDateEventForm({
      eventType: "",
      eventDate: "",
      createdByName: resolveCurrentUserName(),
    });
    setIsCaseDateDialogOpen(true);
  }, [resolveCurrentUserName]);
  const openEditCaseDateEventDialog = useCallback((event: CaseDateEvent) => {
    setEditingCaseDateEventId(event.id);
    setCaseDateEventForm({
      eventType: event.eventType || resolveCaseDateEventLabel(event),
      eventDate: event.eventDate || "",
      createdByName: event.createdByName || resolveCurrentUserName(),
    });
    setIsCaseDateDialogOpen(true);
  }, [resolveCurrentUserName]);
  const handleDeleteCaseDateEvent = useCallback(async (eventId: string) => {
    if (!selectedCase?.id) return;
    try {
      const { error } = await (supabase as any).from("case_dates").delete().eq("id", eventId).eq("case_file_id", selectedCase.id);
      if (error) throw error;
      await fetchCaseDateEvents(selectedCase.id);
      await fetchCaseFiles();
      toast({ title: "Success", description: "Matter date deleted." });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message ?? "Unable to delete matter date.", variant: "destructive" });
    }
  }, [fetchCaseDateEvents, fetchCaseFiles, selectedCase?.id, toast]);
  const handleSubmitCaseDateEventDialog = useCallback(async () => {
    if (!selectedCase?.id) return;
    const eventType = caseDateEventForm.eventType.trim();
    const eventDate = caseDateEventForm.eventDate.trim();
    const createdByName = caseDateEventForm.createdByName.trim() || resolveCurrentUserName();
    if (!eventType || !eventDate) {
      toast({ title: "Error", description: "Date and description are required.", variant: "destructive" });
      return;
    }
    try {
      if (editingCaseDateEventId) {
        const { error } = await (supabase as any)
          .from("case_dates")
          .update({
            date_type: eventType,
            event_label: null,
            date_value: eventDate,
            created_by_name: createdByName,
          })
          .eq("id", editingCaseDateEventId)
          .eq("case_file_id", selectedCase.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("case_dates").insert({
          case_file_id: selectedCase.id,
          date_type: eventType,
          event_label: null,
          date_value: eventDate,
          created_by_name: createdByName,
          description: null,
        });
        if (error) throw error;
      }
      await fetchCaseDateEvents(selectedCase.id);
      await fetchCaseFiles();
      toast({ title: "Success", description: editingCaseDateEventId ? "Matter date updated." : "Matter date added." });
      setIsCaseDateDialogOpen(false);
      resetCaseDateEventForm();
    } catch (error: any) {
      toast({ title: "Error", description: error?.message ?? "Unable to save matter date.", variant: "destructive" });
    }
  }, [caseDateEventForm.createdByName, caseDateEventForm.eventDate, caseDateEventForm.eventType, editingCaseDateEventId, fetchCaseDateEvents, fetchCaseFiles, resetCaseDateEventForm, resolveCurrentUserName, selectedCase?.id, toast]);

  const handleCancelCaseEdit = () => {
    if (!selectedCase) return;
    setCaseEditForm(createCaseEditForm(selectedCase));
    setIsCaseEditMode(false);
  };
  const handleCloseCase = async () => {
    if (!selectedCase?.id) return;
    if (selectedCase.status === "Inactive") return;
    const confirmed = window.confirm("Are you sure you want to close this case?");
    if (!confirmed) return;
    try {
      const { error } = await (supabase as any)
        .from("case_files")
        .update({ status: "Inactive", current_stage: "Finalised" })
        .eq("id", selectedCase.id);
      if (error) throw error;
      const nextSelectedCase = { ...selectedCase, status: "Inactive" as const, currentStage: "Finalised" };
      setSelectedCase(nextSelectedCase);
      setCaseEditForm((prev) => prev ? { ...prev, status: "Inactive", currentStage: "Finalised" } : createCaseEditForm(nextSelectedCase));
      await fetchCaseFiles();
      toast({ title: "Success", description: "Case closed successfully." });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message ?? "Unable to close case.", variant: "destructive" });
    }
  };

  const handleSaveCaseEdit = async () => {
    if (!selectedCase || !caseEditForm) return;
    setIsSavingCaseEdit(true);
    try {
      if (activeCaseTab === "overview") {
        const resolvedStage = resolveCurrentStage(caseEditForm.currentStage, caseEditForm.status, selectedCase.dateEvents);
        const payload = {
          parties: caseEditForm.parties.trim() || null,
          case_type: caseEditForm.caseType.trim() || null,
          case_subtype: caseEditForm.subtype.trim() || null,
          forum: caseEditForm.forumVenue.trim() || null,
          case_number: caseEditForm.caseNumber.trim() || null,
          current_stage: resolvedStage,
          consultant: caseEditForm.assignedConsultant.trim() || null,
          status: caseEditForm.status,
          priority: caseEditForm.priority,
          short_description: caseEditForm.shortDescription.trim() || null,
        };
        const { error } = await (supabase as any).from("case_files").update(payload).eq("id", selectedCase.id);
        if (error) throw error;
      }

      if (activeCaseTab === "outcome") {
        const hasOutcomeValues = Boolean(
          caseEditForm.outcome.outcomeType.trim() ||
          caseEditForm.outcome.outcomeDate.trim() ||
          caseEditForm.outcome.result.trim() ||
          caseEditForm.outcome.amount.trim() ||
          caseEditForm.outcome.closingNote.trim() ||
          caseEditForm.outcome.closedBy.trim() ||
          caseEditForm.outcome.closedDate.trim(),
        );

        if (!hasOutcomeValues) {
          const { error } = await (supabase as any).from("case_outcomes").delete().eq("case_file_id", selectedCase.id);
          if (error) throw error;
        } else {
          if (!caseEditForm.outcome.outcomeType.trim()) {
            throw new Error("Outcome Type is required when saving the Outcome tab.");
          }
          const payload = {
            case_file_id: selectedCase.id,
            outcome_type: caseEditForm.outcome.outcomeType.trim(),
            outcome_date: caseEditForm.outcome.outcomeDate.trim() || caseEditForm.outcome.closedDate.trim() || null,
            result: caseEditForm.outcome.result.trim() || null,
            amount_awarded: parseCurrencyValue(caseEditForm.outcome.amount),
            amount_settled: null,
            closing_note: caseEditForm.outcome.closingNote.trim() || null,
            closed_by: caseEditForm.outcome.closedBy.trim() || null,
          };
          const { error } = await (supabase as any)
            .from("case_outcomes")
            .upsert(payload, { onConflict: "case_file_id" });
          if (error) throw error;
        }
      }

      const nextActionDate = selectedCase.nextDate;
      const resolvedOverviewStatus = activeCaseTab === "overview" ? caseEditForm.status : selectedCase.status;
      const resolvedOverviewStage = activeCaseTab === "overview"
        ? resolveCurrentStage(caseEditForm.currentStage, resolvedOverviewStatus, selectedCase.dateEvents)
        : resolveCurrentStage(selectedCase.currentStage, selectedCase.status, selectedCase.dateEvents);
      const refreshedCase = {
        ...selectedCase,
        parties: activeCaseTab === "overview" ? (caseEditForm.parties.trim() || "--") : selectedCase.parties,
        caseType: activeCaseTab === "overview" ? (caseEditForm.caseType.trim() || "--") : selectedCase.caseType,
        subtype: activeCaseTab === "overview" ? (caseEditForm.subtype.trim() || "--") : selectedCase.subtype,
        forumVenue: activeCaseTab === "overview" ? (caseEditForm.forumVenue.trim() || "--") : selectedCase.forumVenue,
        caseNumber: activeCaseTab === "overview" ? (caseEditForm.caseNumber.trim() || "--") : selectedCase.caseNumber,
        consultant: activeCaseTab === "overview" ? (caseEditForm.assignedConsultant.trim() || "--") : selectedCase.consultant,
        currentStage: resolvedOverviewStage,
        status: resolvedOverviewStatus,
        priority: activeCaseTab === "overview" ? caseEditForm.priority : selectedCase.priority,
        shortDescription: activeCaseTab === "overview" ? (caseEditForm.shortDescription.trim() || "--") : selectedCase.shortDescription,
        nextDate: nextActionDate,
        dateEvents: selectedCase.dateEvents,
        outcome: activeCaseTab === "outcome"
          ? {
              outcomeType: caseEditForm.outcome.outcomeType.trim() || "Pending",
              outcomeDate: caseEditForm.outcome.outcomeDate.trim() || "--",
              result: caseEditForm.outcome.result.trim() || "Awaiting outcome",
              amount: caseEditForm.outcome.amount.trim() || "R 0.00",
              closingNote: caseEditForm.outcome.closingNote.trim() || "--",
              closedBy: caseEditForm.outcome.closedBy.trim() || "--",
              closedDate: caseEditForm.outcome.closedDate.trim() || "--",
            }
          : selectedCase.outcome,
      };
      await fetchCaseFiles();
      setSelectedCase({ ...refreshedCase });
      setCaseEditForm(createCaseEditForm({ ...refreshedCase }));
      setIsCaseEditMode(false);
      toast({ title: "Success", description: "Case updated successfully." });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message ?? "Unable to update case.", variant: "destructive" });
    } finally {
      setIsSavingCaseEdit(false);
    }
  };

  const getNextFileNumber = (caseType: string) => {
    const _ = caseType;
    const currentYearSegment = getCurrentMatterYearSegment();
    const maxSeq = caseFiles.reduce((max, c) => {
      const raw = String(c.fileNo || "").trim();
      const m = raw.match(/^MAT\/(\d{2})\/(\d{5})$/i);
      if (!m) return max;
      if (m[1] !== currentYearSegment) return max;
      return Math.max(max, Number(m[2]));
    }, 0);
    return `MAT/${currentYearSegment}/${String(maxSeq + 1).padStart(5, "0")}`;
  };

  const openNewCaseDialog = (presetCaseType?: (typeof CASE_TYPE_OPTIONS)[number]) => {
    setIsNewCaseMenuOpen(false);
    setNewCaseStep(1);
    const nextForm = createBlankCaseForm();
    nextForm.dateEvents = [createNewCasePrimaryDateEvent(resolveCurrentUserName())];
    if (presetCaseType) {
      nextForm.caseType = presetCaseType;
      nextForm.fileNumber = getNextFileNumber(presetCaseType);
      nextForm.subtype = getSubtypeValueForCaseType(presetCaseType);
    }
    setNewCaseForm(nextForm);
    setIsNewCaseDialogOpen(true);
  };

  const isSubtypeHidden = shouldHideSubtype(newCaseForm.caseType.trim());
  const subtypeOptions = getSubtypeOptions(newCaseForm.caseType.trim());
  const isStepOneComplete = Boolean(
    newCaseForm.clientId.trim() &&
    newCaseForm.parties.trim() &&
    newCaseForm.caseType.trim() &&
    (isSubtypeHidden || newCaseForm.subtype.trim()) &&
    newCaseForm.shortDescription.trim(),
  );
  const primaryNewCaseDateEvent = newCaseForm.dateEvents[0] ?? createNewCasePrimaryDateEvent(resolveCurrentUserName());
  const isStepTwoComplete = Boolean(
    newCaseForm.forumVenue.trim() &&
    primaryNewCaseDateEvent.eventDate.trim() &&
    primaryNewCaseDateEvent.eventType.trim(),
  );
  const isStepThreeComplete = Boolean(
    newCaseForm.assignedConsultant.trim() &&
    newCaseForm.openingNote.trim(),
  );

  const handleNext = () => {
    if (newCaseStep === 1 && !isStepOneComplete) return;
    if (newCaseStep === 2 && !isStepTwoComplete) return;
    setNewCaseStep((prev) => (prev < 3 ? ((prev + 1) as NewCaseStep) : prev));
  };
  const handleStepTrackerSelect = (targetStep: NewCaseStep) => {
    if (targetStep <= newCaseStep) {
      setNewCaseStep(targetStep);
      return;
    }
    if (targetStep === 2 && isStepOneComplete) {
      setNewCaseStep(2);
      return;
    }
    if (targetStep === 3 && isStepOneComplete && isStepTwoComplete) {
      setNewCaseStep(3);
    }
  };
  const updateNewCaseDateEventRow = useCallback((eventId: string, updates: Partial<CaseDateEvent>) => {
    setNewCaseForm((prev) => ({
      ...prev,
      dateEvents: prev.dateEvents.map((event) => event.id === eventId ? { ...event, ...updates } : event),
    }));
  }, []);

  const filteredCaseFiles = useMemo(() => {
    const today = new Date();
    return caseFiles.filter((item) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        q.length === 0 ||
        item.fileNo.toLowerCase().includes(q) ||
        item.client.toLowerCase().includes(q) ||
        item.parties.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesType = caseTypeFilter === "all" || item.caseType === caseTypeFilter;
      const matchesConsultant = consultantFilter === "all" || item.consultant === consultantFilter;
      const next = item.nextDate ? new Date(item.nextDate) : null;
      const diffDays = next ? Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 9999;
      const matchesDate =
        nextDateFilter === "all" || (nextDateFilter === "next7" ? diffDays <= 7 : diffDays <= 30);
      return matchesSearch && matchesStatus && matchesType && matchesConsultant && matchesDate;
    });
  }, [caseFiles, caseTypeFilter, consultantFilter, nextDateFilter, searchQuery, statusFilter]);
  const totalCaseFilesTablePages = Math.max(1, Math.ceil(filteredCaseFiles.length / CASE_FILES_TABLE_PAGE_SIZE));
  const currentCaseFilesTablePage = Math.min(caseFilesTablePage, totalCaseFilesTablePages);
  const currentCaseFilesTableOffset = (currentCaseFilesTablePage - 1) * CASE_FILES_TABLE_PAGE_SIZE;
  const paginatedCaseFiles = useMemo(
    () => filteredCaseFiles.slice(currentCaseFilesTableOffset, currentCaseFilesTableOffset + CASE_FILES_TABLE_PAGE_SIZE),
    [currentCaseFilesTableOffset, filteredCaseFiles],
  );
  const caseFilesTableRangeStart = filteredCaseFiles.length === 0 ? 0 : currentCaseFilesTableOffset + 1;
  const caseFilesTableRangeEnd =
    filteredCaseFiles.length === 0 ? 0 : Math.min(currentCaseFilesTableOffset + CASE_FILES_TABLE_PAGE_SIZE, filteredCaseFiles.length);
  const allVisibleCaseFilesSelected =
    paginatedCaseFiles.length > 0 &&
    paginatedCaseFiles.every((caseFile) => selectedCaseIds.has(caseFile.id));
  const caseFilesTablePageNumbers = useMemo(() => {
    if (totalCaseFilesTablePages <= 6) {
      return Array.from({ length: totalCaseFilesTablePages }, (_, index) => index + 1);
    }
    if (currentCaseFilesTablePage <= 3) {
      return [1, 2, 3, 4, "ellipsis", totalCaseFilesTablePages];
    }
    if (currentCaseFilesTablePage >= totalCaseFilesTablePages - 2) {
      return [1, "ellipsis", totalCaseFilesTablePages - 3, totalCaseFilesTablePages - 2, totalCaseFilesTablePages - 1, totalCaseFilesTablePages];
    }
    return [1, "ellipsis", currentCaseFilesTablePage - 1, currentCaseFilesTablePage, currentCaseFilesTablePage + 1, "ellipsis-2", totalCaseFilesTablePages];
  }, [currentCaseFilesTablePage, totalCaseFilesTablePages]);

  const toggleSelectCase = (id: string) => {
    setSelectedCaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllCases = () => {
    setSelectedCaseIds((prev) => {
      const next = new Set(prev);
      if (allVisibleCaseFilesSelected) {
        paginatedCaseFiles.forEach((caseFile) => next.delete(caseFile.id));
        return next;
      }
      paginatedCaseFiles.forEach((caseFile) => next.add(caseFile.id));
      return next;
    });
  };

  const handleDeleteSelectedCases = async () => {
    if (selectedCaseIds.size === 0) return;
    const ids = Array.from(selectedCaseIds);
    const { error } = await (supabase as any).from("case_files").delete().in("id", ids);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setSelectedCaseIds(new Set());
    await fetchCaseFiles();
  };
  useEffect(() => {
    setCaseFilesTablePage((prev) => Math.min(prev, totalCaseFilesTablePages));
  }, [totalCaseFilesTablePages]);
  useEffect(() => {
    setCaseFilesTablePage(1);
  }, [searchQuery, statusFilter, caseTypeFilter, consultantFilter, nextDateFilter]);

  const openDatePicker = (input: HTMLInputElement | null) => {
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.focus();
      input.click();
    }
  };
  const setNewCaseDateEventInputRef = (eventId: string, node: HTMLInputElement | null) => {
    newCaseDateEventInputRefs.current[eventId] = node;
  };

  const handleCreateCase = async () => {
    if (!isStepOneComplete || !isStepTwoComplete || !isStepThreeComplete) return;
    if (!user?.id) {
      toast({ title: "Error", description: "You must be logged in to create a case file.", variant: "destructive" });
      return;
    }

    setIsSavingCase(true);
    try {
      const fileNumber = getNextFileNumber(newCaseForm.caseType.trim());
      const nextActionDateForNewCase = primaryNewCaseDateEvent.eventDate.trim() || getCaseNextActionDate(newCaseForm.dateEvents);
      const resolvedNewCaseStage = resolveCurrentStage("Scheduled", newCaseForm.status, newCaseForm.dateEvents);
      const { data: insertedCase, error: caseError } = await (supabase as any)
        .from("case_files")
        .insert({
          user_id: user.id,
          client_id: newCaseForm.clientId.trim(),
          file_number: fileNumber,
          client_name: newCaseForm.clientName.trim(),
          parties: newCaseForm.parties.trim(),
          case_type: newCaseForm.caseType.trim(),
          case_subtype: newCaseForm.subtype.trim() || null,
          forum: newCaseForm.forumVenue.trim() || null,
          case_number: null,
          consultant: newCaseForm.assignedConsultant.trim(),
          current_stage: resolvedNewCaseStage,
          status: newCaseForm.status,
          priority: newCaseForm.priority,
          next_date: nextActionDateForNewCase !== "--" ? nextActionDateForNewCase : (newCaseForm.nextDate || null),
          short_description: newCaseForm.shortDescription.trim() || null,
        })
        .select("id")
        .single();

      if (caseError) throw caseError;
      const caseFileId = insertedCase?.id;
      if (!caseFileId) throw new Error("Case file insert did not return an id.");

      const validNewCaseDateEvents = newCaseForm.dateEvents
        .map((event) => ({
          ...event,
          eventType: String(event.eventType || "").trim(),
          eventDate: String(event.eventDate || "").trim(),
          createdByName: String(event.createdByName || "").trim() || resolveCurrentUserName(),
        }))
        .filter((event) => event.eventType || event.eventDate);
      const hasIncompleteNewCaseDateEvent = validNewCaseDateEvents.some((event) => !event.eventType || !event.eventDate);
      if (hasIncompleteNewCaseDateEvent) {
        throw new Error("Each matter date must include a date and description.");
      }

      const dateInserts: Array<{
        case_file_id: string;
        date_type: string;
        date_value: string;
        description: string | null;
        event_label: string | null;
        created_by_name: string;
      }> = [];
      const actorName = resolveCurrentUserName();
      if (validNewCaseDateEvents.length > 0) {
        dateInserts.push(...validNewCaseDateEvents.map((event) => ({
          case_file_id: caseFileId,
          date_type: event.eventType,
          date_value: event.eventDate,
          description: null,
          event_label: null,
          created_by_name: event.createdByName,
        })));
      } else {
        if (newCaseForm.nextDate) {
          dateInserts.push({
            case_file_id: caseFileId,
            date_type: "Next Action Date",
            date_value: newCaseForm.nextDate,
            description: "Auto-created from New Case File form",
            event_label: null,
            created_by_name: actorName,
          });
        }
        if (newCaseForm.deadlineDate) {
        dateInserts.push({
          case_file_id: caseFileId,
          date_type: "Deadline Date",
          date_value: newCaseForm.deadlineDate,
          description: "Auto-created from New Case File form",
          event_label: null,
          created_by_name: actorName,
        });
        }
      }
      if (dateInserts.length > 0) {
        const { error: datesError } = await (supabase as any).from("case_dates").insert(dateInserts);
        if (datesError) throw datesError;
      }

      const openingNote = newCaseForm.openingNote.trim();
      const shortDescription = newCaseForm.shortDescription.trim();
      if (openingNote) {
        const creatorName = resolveCurrentUserName();
        const { data: existingCaseNotes, error: existingCaseNotesError } = await (supabase as any)
          .from("case_notes")
          .select("id, note_content, note_body, note_user_name, added_by")
          .eq("case_file_id", caseFileId)
          .order("created_at", { ascending: true, nullsFirst: false });
        if (existingCaseNotesError) throw existingCaseNotesError;

        const autoCreatedShortDescriptionNote = (existingCaseNotes ?? []).find((row: any) => {
          const noteContent = String(row?.note_content || row?.note_body || "").trim();
          const noteUserName = String(row?.note_user_name || row?.added_by || "").trim();
          return noteContent === shortDescription && !noteUserName;
        });

        if (autoCreatedShortDescriptionNote?.id) {
          const { error: noteUpdateError } = await (supabase as any)
            .from("case_notes")
            .update({
              note_type: "General Update",
              note_date: dateToday(),
              note_body: openingNote,
              note_content: openingNote,
              added_by: creatorName,
              note_user_name: creatorName,
              follow_up_required: false,
              follow_up_date: null,
            })
            .eq("id", autoCreatedShortDescriptionNote.id)
            .eq("case_file_id", caseFileId);
          if (noteUpdateError) throw noteUpdateError;
        } else {
          const { error: noteError } = await (supabase as any).from("case_notes").insert({
            case_file_id: caseFileId,
            note_type: "General Update",
            note_date: dateToday(),
            note_body: openingNote,
            note_content: openingNote,
            added_by: creatorName,
            note_user_name: creatorName,
            follow_up_required: false,
            follow_up_date: null,
          });
          if (noteError) throw noteError;
        }
      }

      setIsNewCaseDialogOpen(false);
      setNewCaseForm(createBlankCaseForm());
      setNewCaseStep(1);
      await fetchCaseFiles();
      toast({ title: "Success", description: "Case file created successfully." });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message ?? "Failed to create case file.", variant: "destructive" });
    } finally {
      setIsSavingCase(false);
    }
  };

  const newCaseDropdownItemStyle =
    "cursor-pointer text-[11px] font-medium text-slate-700 transition-transform duration-150 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[highlighted]:translate-x-[3px]";
  const newCaseDropdownContentStyle = "w-44 border-slate-200 p-1";
  const newCaseButtonStyle =
    "h-8 w-36 justify-between rounded-[4px] px-3 text-[11px] inline-flex items-center border border-[#3eca44] bg-[#3eca44] text-white hover:bg-[#34b73b]";
  const modalInputClass =
    "h-8 rounded border border-slate-200 bg-white !text-[11px] md:!text-[11px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] placeholder:!text-slate-400 hover:border-blue-400 !focus-visible:border-[1px] !focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:bg-white disabled:text-slate-900 disabled:border-slate-200 disabled:opacity-100 disabled:cursor-default !h-[34px] !border-[0.5px] !border-slate-300 hover:!border-slate-500 focus:!border-black focus-visible:!border-black";
  const modalSelectClass =
    "h-8 rounded border border-slate-200 bg-white !text-[11px] md:!text-[11px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] placeholder:!text-slate-400 hover:border-blue-400 !focus-visible:border-[1px] !focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:bg-white disabled:text-slate-900 disabled:border-slate-200 disabled:opacity-100 disabled:cursor-default justify-between data-[placeholder]:text-slate-400 data-[placeholder]:text-xs !h-[34px] !border-[0.5px] !border-slate-300 hover:!border-slate-500 focus:!border-black focus-visible:!border-black data-[state=open]:!border-black !ring-0 !ring-offset-0 !outline-none !shadow-none focus:!ring-0 focus:!ring-offset-0 focus:!shadow-none focus:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 focus-visible:!shadow-none focus-visible:!outline-none data-[state=open]:!ring-0 data-[state=open]:!ring-offset-0 data-[state=open]:!shadow-none data-[state=open]:!outline-none";
  const modalTextareaClass =
    "min-h-[76px] rounded border border-slate-200 bg-white !text-[11px] md:!text-[11px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] placeholder:!text-slate-400 hover:border-blue-400 !focus-visible:border-[1px] !focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:bg-white disabled:text-slate-900 disabled:border-slate-200 disabled:opacity-100 disabled:cursor-default !border-[0.5px] !border-slate-300 hover:!border-slate-500 focus:!border-black focus-visible:!border-black";
  const addModalDropdownToneClass =
    "bg-white border-slate-300 hover:border-slate-500 data-[state=open]:border-black data-[state=open]:bg-white";
  const addModalSelectItemClass =
    "text-[11px] text-slate-700 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[highlighted]:bg-[#3eca44]/10 data-[highlighted]:text-[#2f9f35] [&_svg]:!text-[#2f9f35]";
  const isEditableCaseTab = activeCaseTab === "overview" || activeCaseTab === "outcome";
  const caseEditSubtypeOptions = getSubtypeOptions(caseEditForm?.caseType ?? "");
  const caseEditCurrentStageOptions = (caseEditForm?.status === "Inactive"
    ? CURRENT_STAGE_OPTIONS
    : CURRENT_STAGE_OPTIONS.filter((option) => option !== "Finalised")) as readonly string[];
  const caseFileCardClass = "rounded border border-slate-200 bg-white p-3";
  const selectedCaseClientFullName =
    selectedCase?.clientId
      ? clientOptions.find((client) => client.id === selectedCase.clientId)?.label || selectedCase?.client || "--"
      : selectedCase?.client || "--";
  const selectedCaseClientTradingAsName = getMatterClientTradingAsName(selectedCaseClientFullName);
  const overviewReadOnlyItems = selectedCase
    ? [
        ["File Number", selectedCase.fileNo],
        ["Client", getMatterClientDisplayName(selectedCase.client)],
        ["Matter Type", selectedCase.caseType],
        ["Subtype", selectedCase.subtype],
        ["Parties", selectedCase.parties],
        ["Assigned Consultant", selectedCase.consultant],
        ["Forum", selectedCase.forumVenue],
        ["Case Number", selectedCase.caseNumber],
        ["Current Stage", selectedCase.currentStage],
        ["Status", selectedCase.status],
      ].filter(([, value]) => isVisibleReadOnlyValue(value))
    : [];
  const overviewReadOnlyRows = chunkItems(overviewReadOnlyItems, 2);
  const overviewShortDescription = selectedCase?.shortDescription;
  const sortedSelectedCaseDateEvents = selectedCase ? sortCaseDateEvents(selectedCase.dateEvents ?? []) : [];
  const filteredCaseNotes = useMemo(() => {
    const notes = selectedCase?.notes ?? [];
    const query = caseNotesSearchQuery.trim().toLowerCase();
    if (!query) return notes;
    return notes.filter((note) => {
      const content = String(note.note_content || "").toLowerCase();
      const userName = String(note.note_user_name || "").toLowerCase();
      return content.includes(query) || userName.includes(query);
    });
  }, [caseNotesSearchQuery, selectedCase?.notes]);
  const filteredMentionOptions = useMemo(() => {
    if (!caseNoteMentionRange) return [];
    const normalizedQuery = caseNoteMentionRange.query.replace(/^@/, "").trim().toLowerCase();
    const currentUserToken = toMentionToken(resolveCurrentUserName()).toLowerCase();
    return mentionOptions
      .filter((option) => option.token.toLowerCase() !== currentUserToken)
      .filter((option) => !normalizedQuery || option.searchText.includes(normalizedQuery))
      .slice(0, 8);
  }, [caseNoteMentionRange, mentionOptions, resolveCurrentUserName]);

  const syncCaseNoteMentionRange = useCallback((content: string, caretIndex: number) => {
    const nextRange = getActiveMentionMatch(content, caretIndex);
    setCaseNoteMentionRange(nextRange);
    if (!nextRange || !caseNoteTextareaRef.current) {
      setCaseNoteMentionPopupPosition(null);
      return;
    }
    const coords = getTextareaMentionPopupPosition(caseNoteTextareaRef.current, caretIndex);
    setCaseNoteMentionPopupPosition({
      top: Math.max(8, coords.top + 28),
      left: Math.max(8, Math.min(coords.left + 12, Math.max(8, caseNoteTextareaRef.current.clientWidth - 220))),
    });
  }, []);
  const handleCaseNoteContentChange = useCallback((value: string, caretIndex: number) => {
    setCaseNoteForm((prev) => ({ ...prev, noteContent: value }));
    syncCaseNoteMentionRange(value, caretIndex);
  }, [syncCaseNoteMentionRange]);
  const insertCaseNoteMention = useCallback((option: MentionOption) => {
    const textarea = caseNoteTextareaRef.current;
    const range = caseNoteMentionRange;
    if (!textarea || !range) return;
    const value = caseNoteForm.noteContent;
    const mentionText = `@${option.token}`;
    const nextContent = `${value.slice(0, range.start)}${mentionText} ${value.slice(range.end)}`;
    const nextCaret = range.start + mentionText.length + 1;
    setCaseNoteForm((prev) => ({ ...prev, noteContent: nextContent }));
    setCaseNoteMentionRange(null);
    setCaseNoteMentionPopupPosition(null);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCaret, nextCaret);
    });
  }, [caseNoteForm.noteContent, caseNoteMentionRange]);

  const openAddCaseNoteDialog = () => {
    resetCaseNoteForm();
    setIsCaseNoteDialogOpen(true);
  };
  const openCaseNotePreviewDialog = (rawContent: string, updatedAt?: string) => {
    const { content, editTag } = splitFileNoteContentAndEditTag(rawContent);
    setCaseNotePreviewContent(content);
    setCaseNotePreviewEditTag(editTag);
    setCaseNotePreviewUpdatedAt(String(updatedAt || "").trim());
    setIsCaseNotePreviewOpen(true);
  };
  const openEditCaseNoteDialog = (note: CaseNote) => {
    if (!isNoteEditableByCurrentUser(note)) {
      toast({
        title: "Edit not allowed",
        description: "You can only edit notes created by you.",
        variant: "destructive",
      });
      return;
    }
    const { content } = splitFileNoteContentAndEditTag(String(note.note_content || ""));
    setEditingCaseNoteId(note.id);
    setCaseNoteForm({
      noteDate: String(note.note_date || dateToday()),
      noteContent: content,
      noteUserName: String(note.note_user_name || resolveCurrentUserName()),
    });
    setCaseNoteMentionRange(null);
    setCaseNoteMentionPopupPosition(null);
    setIsCaseNoteDialogOpen(true);
  };
  const handleSaveCaseNote = async () => {
    if (!selectedCase?.id || !user?.id) return;
    const noteDate = caseNoteForm.noteDate.trim();
    const noteContent = caseNoteForm.noteContent.trim();
    const noteUserName = caseNoteForm.noteUserName.trim() || resolveCurrentUserName();
    if (!noteDate || !noteContent) {
      toast({ title: "Missing fields", description: "Date and note content are required.", variant: "destructive" });
      return;
    }
    setIsSavingCaseNote(true);
    try {
      if (editingCaseNoteId) {
        const baseContent = noteContent.replace(FILE_NOTE_EDIT_TAG_REGEX, "").trim();
        const now = new Date();
        const editedTag = `Edited by ${noteUserName} on ${formatDisplayDate(dateToday())} at ${formatDisplayTime(now)}`;
        const updatedContent = `${baseContent} ${editedTag}`.trim();
        const { error } = await (supabase as any)
          .from("case_notes")
          .update({
            note_type: "General Update",
            note_body: updatedContent,
            note_content: updatedContent,
            added_by: noteUserName,
            note_user_name: noteUserName,
            note_date: noteDate,
            follow_up_required: false,
            follow_up_date: null,
          })
          .eq("id", editingCaseNoteId)
          .eq("case_file_id", selectedCase.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("case_notes").insert({
          case_file_id: selectedCase.id,
          note_type: "General Update",
          note_date: noteDate,
          note_body: noteContent,
          note_content: noteContent,
          added_by: noteUserName,
          note_user_name: noteUserName,
          follow_up_required: false,
          follow_up_date: null,
        });
        if (error) throw error;
      }
      setIsCaseNoteDialogOpen(false);
      resetCaseNoteForm();
      await fetchCaseNotes(selectedCase.id);
      toast({ title: "Success", description: editingCaseNoteId ? "Case note updated." : "Case note created." });
    } catch (error: any) {
      toast({ title: "Unable to save case note", description: error?.message || "Save failed.", variant: "destructive" });
    } finally {
      setIsSavingCaseNote(false);
    }
  };
  const handleDeleteCaseNote = async (noteId: string) => {
    if (!selectedCase?.id || !user?.id) return;
    if (!canCurrentUserDeleteNotes) {
      toast({
        title: "Delete not allowed",
        description: "Consultant and Administrator subusers cannot delete notes.",
        variant: "destructive",
      });
      return;
    }
    if (!window.confirm("Delete this note?")) return;
    try {
      const { error } = await (supabase as any)
        .from("case_notes")
        .delete()
        .eq("id", noteId)
        .eq("case_file_id", selectedCase.id);
      if (error) throw error;
      await fetchCaseNotes(selectedCase.id);
      toast({ title: "Case note deleted" });
    } catch (error: any) {
      toast({ title: "Unable to delete case note", description: error?.message || "Delete failed.", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-0 -m-6">
        <div className="overflow-hidden rounded-tl-sm border border-slate-300 border-l-0 border-r-0 bg-white shadow-sm h-[calc(100dvh-var(--app-header-height,5rem))] pb-0">
          <div className="flex h-full flex-col">
            <div className="pl-4 pr-4 pt-1">
              <div className="pt-5 pb-2">
                <h1 className="text-4xl font-normal text-slate-900 -ml-1">Matters</h1>
                <p className="text-xs text-slate-600 mt-2">Manage active legal matters, hearings, consultations and representation files.</p>
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
                            placeholder="Please type in case, client or party name"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`h-8 rounded-sm border border-slate-200 bg-white !text-[11px] font-semibold shadow-sm transition-colors placeholder:!text-[11px] hover:border-[#3eca44] focus-visible:!border focus-visible:!border-black focus-visible:ring-0 group-hover:border-[#3eca44] ${searchQuery.trim().length > 0 ? "pr-20" : "pr-9"}`}
                          />
                          {searchQuery.trim().length > 0 ? (
                            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-500 hover:text-[#2f9f35] hover:underline" onClick={() => setSearchQuery("")}>Clear</button>
                          ) : (
                            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                          )}
                        </div>
                        <p className="text-[11px] font-medium text-slate-500 whitespace-nowrap sm:self-end">
                          <span className="text-slate-900">{`${caseFilesTableRangeStart}-${caseFilesTableRangeEnd}`}</span> of {filteredCaseFiles.length} active case files
                        </p>
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        {selectedCaseIds.size > 0 ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleDeleteSelectedCases}
                            className="h-8 w-24 rounded px-3 text-[11px] inline-flex items-center justify-center border border-rose-500 bg-white text-rose-600 hover:bg-rose-600 hover:text-white"
                          >
                            Delete ({selectedCaseIds.size})
                          </Button>
                        ) : null}
                        <Popover open={isFiltersPanelOpen} onOpenChange={(open) => { setIsFiltersPanelOpen(open); if (!open) setExpandedFilterSection(null); }}>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" className="h-8 w-24 justify-between rounded px-3 text-[11px] inline-flex items-center border border-slate-200 bg-white transition-colors hover:border-[#3eca44] hover:bg-white data-[state=open]:rounded-b-none data-[state=open]:border-[#3eca44]">
                              <span>Filter</span>
                              <ChevronDown className={`h-4 w-4 transition-transform ${isFiltersPanelOpen ? "rotate-180" : ""}`} />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent side="bottom" align="end" sideOffset={0} className="w-[260px] rounded-t-none border border-slate-200 border-t-0 bg-white p-0 shadow-lg">
                            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                              <span className="text-[12px] font-semibold text-slate-800">Filter</span>
                              <button type="button" className="text-[10px] font-semibold uppercase tracking-wide text-[#2f9f35] hover:underline" onClick={() => { setStatusFilter("all"); setCaseTypeFilter("all"); setConsultantFilter("all"); setNextDateFilter("all"); setIsFiltersPanelOpen(false); }}>
                                Clear
                              </button>
                            </div>
                            <div className="divide-y divide-slate-200">
                              {["status", "type", "consultant", "date"].map((section) => (
                                <div key={section}>
                                  <button type="button" className={`flex h-9 w-full items-center justify-between px-3 text-left text-[11px] font-semibold text-slate-800 hover:bg-slate-100 ${expandedFilterSection === section ? "bg-slate-100" : ""}`} onClick={() => setExpandedFilterSection((prev) => (prev === section ? null : section))}>
                                    <span>{section === "status" ? "Status" : section === "type" ? "Case Type" : section === "consultant" ? "Consultant" : "Next Date"}</span>
                                    <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform ${expandedFilterSection === section ? "rotate-180" : ""}`} />
                                  </button>
                                  {expandedFilterSection === section && (
                                    <div className="px-3 pb-2">
                                      {(section === "status"
                                        ? ["all", ...STATUS_OPTIONS]
                                        : section === "type"
                                          ? ["all", ...caseTypes]
                                          : section === "consultant"
                                            ? ["all", ...consultants]
                                            : ["all", "next7", "next30"]
                                      ).map((value) => {
                                        const selected = section === "status" ? statusFilter === value : section === "type" ? caseTypeFilter === value : section === "consultant" ? consultantFilter === value : nextDateFilter === value;
                                        const label = value === "all" ? "All" : value === "next7" ? "Next 7 days" : value === "next30" ? "Next 30 days" : value;
                                        return (
                                          <button
                                            key={value}
                                            type="button"
                                            className="flex h-8 w-full items-center justify-between text-[11px] text-slate-700 hover:bg-[#3eca44]/10 hover:text-[#2f9f35]"
                                            onClick={() => {
                                              if (section === "status") setStatusFilter(value as "all" | CaseFile["status"]);
                                              if (section === "type") setCaseTypeFilter(value);
                                              if (section === "consultant") setConsultantFilter(value);
                                              if (section === "date") setNextDateFilter(value as "all" | "next7" | "next30");
                                              setIsFiltersPanelOpen(false);
                                            }}
                                          >
                                            <span>{label}</span>
                                            {selected && <Check className="h-3.5 w-3.5 text-[#2f9f35]" />}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <DropdownMenu open={isNewCaseMenuOpen} onOpenChange={setIsNewCaseMenuOpen}>
                          <DropdownMenuTrigger asChild>
                            <Button className={newCaseButtonStyle}>
                              <span className="truncate">New Matter</span>
                              <ChevronDown className="h-4 w-4 text-current" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" sideOffset={0} className={newCaseDropdownContentStyle}>
                            {NEW_MATTER_OPTIONS.map((option) => (
                              <DropdownMenuItem
                                key={option.label}
                                onSelect={(event) => {
                                  event.preventDefault();
                                  openNewCaseDialog(option.caseType);
                                }}
                                className={newCaseDropdownItemStyle}
                              >
                                {option.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 min-h-0 flex-col gap-2 overflow-hidden pl-4 pr-4 pb-0">
                    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm border border-slate-200">
                      <div className="grid grid-cols-[0.45fr_1.2fr_1.5fr_1.9fr_1.3fr_1.2fr_1.2fr_1fr] items-center gap-2 border-b bg-[#2D4256] pl-1 pr-3 py-3 text-xs font-semibold text-white">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            indicator="x"
                            checked={
                              allVisibleCaseFilesSelected
                                ? true
                                : paginatedCaseFiles.some((caseFile) => selectedCaseIds.has(caseFile.id))
                                  ? "indeterminate"
                                  : false
                            }
                            onCheckedChange={toggleSelectAllCases}
                            aria-label="Select all case files"
                            className="h-3 w-3 rounded-[2px] border-white/80 bg-white text-white data-[state=checked]:border-[#3eca44] data-[state=checked]:bg-[#3eca44]"
                          />
                        </div>
                        <div>File No.</div><div>Client</div><div>Parties</div><div>Case Type</div><div>Stage</div><div>Next Date</div><div>Consultant</div>
                      </div>
                      <div className="employee-table-scroll min-h-0 flex-1 divide-y overflow-y-auto">
                        {isCaseFilesLoading ? (
                          <div className="px-4 py-6 text-xs text-slate-500">Loading case files...</div>
                        ) : filteredCaseFiles.length === 0 ? (
                          <div className="px-4 py-6 text-xs text-slate-500">No case files found.</div>
                        ) : (
                          paginatedCaseFiles.map((caseFile) => (
                            <div key={caseFile.id} className="grid w-full grid-cols-[0.45fr_1.2fr_1.5fr_1.9fr_1.3fr_1.2fr_1.2fr_1fr] items-center gap-2 pl-1 pr-3 py-2 text-left text-xs hover:bg-[#3eca44]/5">
                              <div className="flex items-center justify-center">
                                <Checkbox
                                  indicator="x"
                                  checked={selectedCaseIds.has(caseFile.id)}
                                  onCheckedChange={() => toggleSelectCase(caseFile.id)}
                                  aria-label={`Select ${caseFile.fileNo}`}
                                  className="h-3 w-3 rounded-[2px] border-slate-400 text-white data-[state=checked]:border-[#3eca44] data-[state=checked]:bg-[#3eca44]"
                                />
                              </div>
                              <button type="button" onClick={() => setSelectedCase(caseFile)} className="font-medium text-left hover:underline">{caseFile.fileNo}</button>
                              <div>{getMatterClientDisplayName(caseFile.client)}</div>
                              <div>{caseFile.parties}</div>
                              <div>{caseFile.caseType}</div>
                              <div>
                                <Badge className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium shadow-none ${getCurrentStagePillClassName(caseFile.currentStage)}`}>
                                  {caseFile.currentStage}
                                </Badge>
                              </div>
                              <div>{caseFile.nextDate === "--" ? "--" : formatDisplayDate(caseFile.nextDate)}</div>
                              <div>
                                <Badge className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-700 shadow-none hover:bg-slate-100 hover:text-slate-700">
                                  {caseFile.consultant}
                                </Badge>
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
                        onClick={() => setCaseFilesTablePage((prev) => Math.max(1, prev - 1))}
                        disabled={currentCaseFilesTablePage === 1}
                      >
                        Previous
                      </Button>
                      {caseFilesTablePageNumbers.map((page) =>
                        typeof page === "number" ? (
                          <button
                            key={page}
                            type="button"
                            onClick={() => setCaseFilesTablePage(page)}
                            className={`flex h-8 min-w-8 items-center justify-center rounded-[4px] border px-3 text-[11px] font-medium transition-colors ${
                              page === currentCaseFilesTablePage
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
                        onClick={() => setCaseFilesTablePage((prev) => Math.min(totalCaseFilesTablePages, prev + 1))}
                        disabled={currentCaseFilesTablePage === totalCaseFilesTablePages}
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

      <Dialog open={isNewCaseDialogOpen} onOpenChange={setIsNewCaseDialogOpen}>
      <DialogContent className="w-[94vw] max-w-[560px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden">
          <div className="relative">
            <div className="absolute inset-x-0 top-0 flex h-[46px] items-center justify-between px-4">
              <div className="flex items-center gap-2 pl-2">
                <FolderPlusIcon className="h-5 w-5 self-center text-white" />
                <DialogTitle className="self-center text-sm font-semibold leading-none text-white">New Matter</DialogTitle>
              </div>
              <DialogClose asChild>
                <button type="button" className="text-white hover:text-white/80">
                  <X className="h-4 w-4" />
                </button>
              </DialogClose>
            </div>
            <div className="mt-[46px] bg-white px-6 pb-6 pt-2">
              <form
                className="space-y-4 pt-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreateCase();
                }}
              >
                <div className="mx-auto w-full max-w-[320px] py-4">
                  <div className="relative grid grid-cols-3 items-start">
                    <div className="pointer-events-none absolute left-[calc(16.6667%+26px)] top-[10px] h-[2px] w-[calc(33.3333%-52px)] bg-slate-300" />
                    <div className="pointer-events-none absolute left-[calc(50%+26px)] top-[10px] h-[2px] w-[calc(33.3333%-52px)] bg-slate-300" />
                    {newCaseStep > 1 && <div className="pointer-events-none absolute left-[calc(16.6667%+26px)] top-[10px] h-[2px] w-[calc(33.3333%-52px)] bg-[#3eca44]" />}
                    {newCaseStep > 2 && <div className="pointer-events-none absolute left-[calc(50%+26px)] top-[10px] h-[2px] w-[calc(33.3333%-52px)] bg-[#3eca44]" />}
                    {[{ step: 1 as const, label: "Case Identity" }, { step: 2 as const, label: "Forum & Dates" }, { step: 3 as const, label: "Allocation" }].map((item) => {
                      const active = item.step === newCaseStep;
                      const complete = item.step < newCaseStep;
                      return (
                        <button key={item.step} type="button" onClick={() => handleStepTrackerSelect(item.step)} className="z-10 flex flex-col items-center text-center cursor-pointer">
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${complete ? "bg-[#3eca44] text-white" : active ? "bg-[#2D4256] text-white" : "bg-slate-300 text-slate-500"}`}>
                            {complete ? <Check className="h-3 w-3" /> : item.step}
                          </span>
                          <span className={`mt-3 text-[10px] font-semibold ${complete ? "text-[#2f9f35]" : active ? "text-black" : "text-slate-400"}`}>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="h-[420px] space-y-4 overflow-y-auto pr-1">
                  {newCaseStep === 1 && (
                    <>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400">Case Type <span className="text-red-600">*</span></p>
                        <Select
                          value={newCaseForm.caseType || undefined}
                          onValueChange={(value) =>
                            setNewCaseForm((p) => ({
                              ...p,
                              caseType: value,
                              subtype: getSubtypeValueForCaseType(value, p.subtype),
                              fileNumber: getNextFileNumber(value),
                            }))
                          }
                        >
                          <SelectTrigger className={`${modalSelectClass} ${addModalDropdownToneClass}`}><SelectValue placeholder="Please select case type" /></SelectTrigger>
                          <SelectContent className="text-[11px]">{CASE_TYPE_OPTIONS.map((opt) => <SelectItem key={opt} value={opt} className={addModalSelectItemClass}>{opt}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      {!isSubtypeHidden ? (
                        <div className="space-y-1">
                          <p className="text-[10px] font-semibold text-slate-400">Subtype <span className="text-red-600">*</span></p>
                          <Select
                            value={newCaseForm.subtype || undefined}
                            onValueChange={(value) => setNewCaseForm((p) => ({ ...p, subtype: value }))}
                          >
                            <SelectTrigger className={`${modalSelectClass} ${addModalDropdownToneClass}`}><SelectValue placeholder="Please select subtype" /></SelectTrigger>
                            <SelectContent className="text-[11px]">
                              {subtypeOptions.map((opt) => (
                                <SelectItem key={opt} value={opt} className={addModalSelectItemClass}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400">Client <span className="text-red-600">*</span></p>
                        <Popover open={isClientSelectOpen} onOpenChange={setIsClientSelectOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className={`${modalSelectClass} ${addModalDropdownToneClass} w-full justify-between px-3 hover:bg-white hover:text-slate-700`}
                            >
                              <span className={`truncate text-left ${newCaseForm.clientName ? "" : "text-slate-400"}`}>
                                {newCaseForm.clientName || "Please select client"}
                              </span>
                              <ChevronDown className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            className="w-[--radix-popover-trigger-width] p-0"
                            onWheelCapture={(event) => event.stopPropagation()}
                          >
                            <Command>
                              <CommandInput placeholder="Search client name..." className="h-8 text-[11px]" />
                              <CommandList className="max-h-[min(420px,var(--radix-popover-content-available-height))] overflow-y-auto overscroll-contain">
                                <CommandEmpty className="py-3 text-[11px] text-slate-500 px-2 text-center">{clientLoadMessage}</CommandEmpty>
                                <CommandGroup>
                                  {clientOptions.map((client) => (
                                    <CommandItem
                                      key={client.id}
                                      value={client.label}
                                      className="text-[11px] text-slate-700 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[selected=true]:bg-[#3eca44]/10 data-[selected=true]:text-[#2f9f35]"
                                      onSelect={() => {
                                        setNewCaseForm((prev) => ({ ...prev, clientId: client.id, clientName: client.label }));
                                        setIsClientSelectOpen(false);
                                      }}
                                    >
                                      {client.label}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400">Parties <span className="text-red-600">*</span></p>
                        <Input className={`${modalInputClass} !text-[11px]`} value={newCaseForm.parties} onChange={(e) => setNewCaseForm((p) => ({ ...p, parties: e.target.value }))} placeholder="ABC Manufacturing (Pty) Ltd // John Smith" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400">Short Description <span className="text-red-600">*</span></p>
                        <Textarea className={modalTextareaClass} value={newCaseForm.shortDescription} onChange={(e) => setNewCaseForm((p) => ({ ...p, shortDescription: e.target.value }))} placeholder="Please type a short description of the case" />
                      </div>
                    </>
                  )}

                  {newCaseStep === 2 && (
                    <>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400">Forum / Venue <span className="text-red-600">*</span></p>
                        <Input className={modalInputClass} value={newCaseForm.forumVenue} onChange={(e) => setNewCaseForm((p) => ({ ...p, forumVenue: e.target.value }))} placeholder="CCMA Johannesburg, MIBCO, Teams..." />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400">Date <span className="text-red-600">*</span></p>
                        <Input
                          className={modalInputClass}
                          type="text"
                          readOnly
                          placeholder="Please select a date"
                          value={primaryNewCaseDateEvent.eventDate ? formatDisplayDate(primaryNewCaseDateEvent.eventDate) : ""}
                          onClick={() => openDatePicker(newCaseDateEventInputRefs.current[primaryNewCaseDateEvent.id] ?? null)}
                          onFocus={() => openDatePicker(newCaseDateEventInputRefs.current[primaryNewCaseDateEvent.id] ?? null)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openDatePicker(newCaseDateEventInputRefs.current[primaryNewCaseDateEvent.id] ?? null);
                            }
                          }}
                        />
                        <input
                          ref={(node) => setNewCaseDateEventInputRef(primaryNewCaseDateEvent.id, node)}
                          type="date"
                          value={primaryNewCaseDateEvent.eventDate}
                          onChange={(e) => updateNewCaseDateEventRow(primaryNewCaseDateEvent.id, { eventDate: e.target.value })}
                          className="sr-only"
                          aria-hidden="true"
                          tabIndex={-1}
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400">Event Description <span className="text-red-600">*</span></p>
                        <Input
                          className={modalInputClass}
                          placeholder="Type event description"
                          value={primaryNewCaseDateEvent.eventType}
                          onChange={(e) => updateNewCaseDateEventRow(primaryNewCaseDateEvent.id, { eventType: e.target.value, createdByName: primaryNewCaseDateEvent.createdByName || resolveCurrentUserName() })}
                        />
                      </div>
                    </>
                  )}

                  {newCaseStep === 3 && (
                    <>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400">Assigned Consultant <span className="text-red-600">*</span></p>
                        <Select value={newCaseForm.assignedConsultant || undefined} onValueChange={(value) => setNewCaseForm((p) => ({ ...p, assignedConsultant: value }))}>
                          <SelectTrigger className={`${modalSelectClass} ${addModalDropdownToneClass}`}><SelectValue placeholder="Please select consultant" /></SelectTrigger>
                          <SelectContent className="text-[11px]">
                            {consultantOptions.map((opt) => <SelectItem key={opt.id} value={opt.label} className={addModalSelectItemClass}>{opt.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-slate-400">Opening Note <span className="text-red-600">*</span></p>
                        <Textarea className={modalTextareaClass} value={newCaseForm.openingNote} onChange={(e) => setNewCaseForm((p) => ({ ...p, openingNote: e.target.value }))} placeholder="Please type the first file note or instruction received" />
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-6 grid grid-cols-3 items-center border-t border-dashed border-muted/60 pt-4">
                  <div className="justify-self-start">
                    {newCaseStep > 1 && (
                      <Button type="button" variant="outline" className="h-[28px] w-[84px] rounded border-[#3eca44] px-3 text-xs text-[#3eca44] hover:bg-transparent hover:text-[#3eca44]" onClick={() => setNewCaseStep((prev) => (prev === 1 ? prev : ((prev - 1) as NewCaseStep)))}>
                        Back
                      </Button>
                    )}
                  </div>
                  <div className="justify-self-center">
                    <Button type="button" variant="ghost" className="h-[30px] rounded border-0 px-3 text-xs text-slate-500 shadow-none hover:bg-transparent hover:text-slate-600 hover:underline" onClick={() => setNewCaseForm(createBlankCaseForm())}>
                      Clear
                    </Button>
                  </div>
                  <div className="justify-self-end">
                    {newCaseStep < 3 ? (
                      <Button type="button" className="h-[28px] w-[84px] rounded bg-[#3eca44] px-3 text-xs text-white hover:bg-[#34b73b]" onClick={handleNext} disabled={(newCaseStep === 1 && !isStepOneComplete) || (newCaseStep === 2 && !isStepTwoComplete)}>
                        Next
                      </Button>
                    ) : (
                      <Button type="submit" className="h-[30px] w-[120px] rounded bg-[#3eca44] px-3 text-xs text-white hover:bg-[#34b73b]" disabled={isSavingCase || !isStepOneComplete || !isStepTwoComplete || !isStepThreeComplete}>
                        {isSavingCase ? "Saving..." : "Submit"}
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selectedCase && (
        <div className="fixed inset-0 z-50">
          <button type="button" className="absolute inset-0 bg-slate-900/65" aria-label="Close case details" onClick={() => setSelectedCase(null)} />
          <div className="absolute inset-0 flex items-center justify-center">
            <section className="relative z-10 w-[94vw] max-w-[980px] h-[92vh] rounded-sm bg-[#2D4256] shadow-2xl overflow-hidden border-0">
              <div className="absolute inset-x-0 top-0 flex h-[46px] items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-white" />
                  <h2 className="text-sm font-semibold text-white">Case File</h2>
                </div>
                <button type="button" className="text-white hover:text-white/80" onClick={() => setSelectedCase(null)}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-[46px] flex h-[calc(92vh-46px)] flex-col bg-white px-4 pb-4 pt-4">
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-semibold uppercase text-[#2f9f35]">
                        {getMatterHeaderTitle(selectedCase)}
                      </h2>
                      <p className="text-xs text-slate-500">{selectedCase.parties}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        className="h-8 text-[11px] border-slate-300 bg-white text-slate-700 hover:bg-white hover:border-rose-600 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-default disabled:opacity-60"
                        onClick={() => void handleCloseCase()}
                        disabled={selectedCase.status === "Inactive"}
                      >
                        {selectedCase.status === "Inactive" ? "Case Closed" : "Close Case"}
                      </Button>
                    </div>
                  </div>

                  <Tabs value={activeCaseTab} onValueChange={(value) => { if (!isCaseEditMode) setActiveCaseTab(value as CaseDetailsTab); }} className="w-full">
                    <TabsList className="grid w-full grid-cols-5 bg-slate-100">
                      <TabsTrigger value="overview" className="text-[11px] data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:text-[#2f9f35] data-[state=inactive]:hover:text-[12.33px] data-[state=active]:bg-[#2D4256] data-[state=active]:text-white data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Overview</TabsTrigger>
                      <TabsTrigger value="dates" className="text-[11px] data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:text-[#2f9f35] data-[state=inactive]:hover:text-[12.33px] data-[state=active]:bg-[#2D4256] data-[state=active]:text-white data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Events</TabsTrigger>
                      <TabsTrigger value="notes" className="text-[11px] data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:text-[#2f9f35] data-[state=inactive]:hover:text-[12.33px] data-[state=active]:bg-[#2D4256] data-[state=active]:text-white data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Notes</TabsTrigger>
                      <TabsTrigger value="documents" className="text-[11px] data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:text-[#2f9f35] data-[state=inactive]:hover:text-[12.33px] data-[state=active]:bg-[#2D4256] data-[state=active]:text-white data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Documents</TabsTrigger>
                      <TabsTrigger value="outcome" className="text-[11px] data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:text-[#2f9f35] data-[state=inactive]:hover:text-[12.33px] data-[state=active]:bg-[#2D4256] data-[state=active]:text-white data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Outcome</TabsTrigger>
                    </TabsList>
                    <TabsContent value="overview" className="mt-4">
                      {isCaseEditMode && caseEditForm ? (
                        <div className="space-y-3 text-xs">
                          <div className={caseFileCardClass}>
                            <p className="mb-3 text-[13px] font-semibold text-slate-700 underline">Case Overview</p>
                            <div className="mt-2 space-y-2">
                                {[
                                { fields: [["File Number", "fileNo"], ["Client", "client"]], readOnly: true },
                                { fields: [["Matter Type", "caseType"], ["Subtype", "subtype"]] },
                                { fields: [["Parties", "parties"], ["Assigned Consultant", "assignedConsultant"]] },
                                { fields: [["Forum", "forumVenue"], ["Case Number", "caseNumber"]] },
                                { fields: [["Current Stage", "currentStage"], ["Status", "status"]] },
                                { fields: [["Short Description", "shortDescription"]], fullWidth: true },
                              ].map((row, rowIndex) => (
                                <div key={rowIndex} className="grid grid-cols-1 gap-y-2 md:grid-cols-[minmax(130px,0.7fr)_minmax(220px,1.3fr)_minmax(130px,0.7fr)_minmax(220px,1.3fr)] md:items-center md:gap-x-6">
                                  {row.fields.map(([label, field]) => (
                                    <span key={String(field)} className={row.fullWidth ? "contents md:[&>*:nth-child(2)]:col-span-3" : "contents"}>
                                      <p className="text-[10px] font-medium text-slate-500">{label}</p>
                                      <div className={row.fullWidth ? "md:col-span-3" : ""}>
                                        {row.readOnly ? (
                                          <Input
                                            className={modalInputClass}
                                            value={
                                              field === "fileNo"
                                                ? selectedCase?.fileNo ?? ""
                                                : field === "client"
                                                  ? getMatterClientDisplayName(selectedCase?.client)
                                                  : ""
                                            }
                                            disabled
                                          />
                                        ) : field === "caseType" ? (
                                          <Select value={caseEditForm.caseType || undefined} onValueChange={(value) => setCaseEditForm((prev) => prev ? { ...prev, caseType: value, subtype: getSubtypeValueForCaseType(value, prev.subtype) } : prev)}><SelectTrigger className={`${modalSelectClass} ${addModalDropdownToneClass}`}><SelectValue placeholder="Select matter type" /></SelectTrigger><SelectContent className="text-[11px]">{CASE_TYPE_OPTIONS.map((opt) => <SelectItem key={opt} value={opt} className={addModalSelectItemClass}>{opt}</SelectItem>)}</SelectContent></Select>
                                        ) : field === "subtype" ? (
                                          shouldHideSubtype(caseEditForm.caseType) ? <Input className={modalInputClass} value="None" disabled /> : <Select value={caseEditForm.subtype || undefined} onValueChange={(value) => setCaseEditForm((prev) => prev ? { ...prev, subtype: value } : prev)}><SelectTrigger className={`${modalSelectClass} ${addModalDropdownToneClass}`}><SelectValue placeholder="Select subtype" /></SelectTrigger><SelectContent className="text-[11px]">{caseEditSubtypeOptions.map((opt) => <SelectItem key={opt} value={opt} className={addModalSelectItemClass}>{opt}</SelectItem>)}</SelectContent></Select>
                                        ) : field === "assignedConsultant" ? (
                                          <Select value={caseEditForm.assignedConsultant || undefined} onValueChange={(value) => setCaseEditForm((prev) => prev ? { ...prev, assignedConsultant: value } : prev)}><SelectTrigger className={`${modalSelectClass} ${addModalDropdownToneClass}`}><SelectValue placeholder="Select consultant" /></SelectTrigger><SelectContent className="text-[11px]">{consultantOptions.map((opt) => <SelectItem key={opt.id} value={opt.label} className={addModalSelectItemClass}>{opt.label}</SelectItem>)}</SelectContent></Select>
                                        ) : field === "status" ? (
                                          <Select value={caseEditForm.status} onValueChange={(value) => setCaseEditForm((prev) => prev ? {
                                            ...prev,
                                            status: value as CaseFile["status"],
                                            currentStage:
                                              value === "Inactive"
                                                ? "Finalised"
                                                : prev.currentStage === "Finalised"
                                                  ? "Awaiting Date"
                                                  : prev.currentStage,
                                          } : prev)}><SelectTrigger className={`${modalSelectClass} ${addModalDropdownToneClass}`}><SelectValue /></SelectTrigger><SelectContent className="text-[11px]">{STATUS_OPTIONS.map((opt) => <SelectItem key={opt} value={opt} className={addModalSelectItemClass}>{opt}</SelectItem>)}</SelectContent></Select>
                                        ) : field === "currentStage" ? (
                                          <Select value={caseEditForm.currentStage || undefined} onValueChange={(value) => setCaseEditForm((prev) => prev ? { ...prev, currentStage: value } : prev)}><SelectTrigger className={`${modalSelectClass} ${addModalDropdownToneClass}`}><SelectValue placeholder="Select current stage" /></SelectTrigger><SelectContent className="text-[11px]">{caseEditCurrentStageOptions.map((opt) => <SelectItem key={opt} value={opt} className={addModalSelectItemClass}>{opt}</SelectItem>)}</SelectContent></Select>
                                        ) : field === "shortDescription" ? (
                                          <Textarea className={modalTextareaClass} value={caseEditForm.shortDescription} onChange={(e) => setCaseEditForm((prev) => prev ? { ...prev, shortDescription: e.target.value } : prev)} />
                                        ) : (
                                          <Input className={modalInputClass} value={String((caseEditForm as any)[field] ?? "")} onChange={(e) => setCaseEditForm((prev) => prev ? { ...prev, [field]: e.target.value } : prev)} />
                                        )}
                                      </div>
                                    </span>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : <div className="space-y-3 text-xs"><div className={caseFileCardClass}><p className="mb-3 text-[13px] font-semibold text-slate-700 underline">Case Overview</p><div className="mt-2 space-y-2">{overviewReadOnlyRows.map((row, rowIndex) => <div key={rowIndex} className="grid grid-cols-1 gap-y-2 md:grid-cols-[minmax(130px,0.7fr)_minmax(220px,1.3fr)_minmax(130px,0.7fr)_minmax(220px,1.3fr)] md:items-center md:gap-x-6">{row.map(([label, value]) => <span key={String(label)} className="contents"><p className="text-[10px] font-medium text-slate-500">{label}</p>{label === "Client" ? <Tooltip><TooltipTrigger asChild><p className="text-[11px] font-medium text-slate-900 transition-colors hover:text-[#2f9f35]">{value}</p></TooltipTrigger><TooltipContent side="top" className="rounded border border-[#3eca44]/35 text-[9.84px] shadow-none">{selectedCaseClientFullName}</TooltipContent></Tooltip> : <p className="text-[11px] font-medium text-slate-900">{value}</p>}</span>)}</div>)}{isVisibleReadOnlyValue(overviewShortDescription) ? <div className="grid grid-cols-1 gap-y-2 md:grid-cols-[minmax(130px,0.7fr)_minmax(220px,1.3fr)_minmax(130px,0.7fr)_minmax(220px,1.3fr)] md:items-start md:gap-x-6"><p className="text-[10px] font-medium text-slate-500">Short Description</p><p className="text-[11px] font-medium text-slate-900 md:col-span-3">{overviewShortDescription}</p></div> : null}</div></div></div>}
                    </TabsContent>
                    <TabsContent value="dates" className="mt-4">
                      <div className="space-y-3 text-xs">
                        <div className="mb-3 flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            className="h-8 rounded bg-[#3eca44] px-3 text-[11px] text-white hover:bg-[#34b73b]"
                            onClick={openAddCaseDateEventDialog}
                          >
                            New Date
                          </Button>
                        </div>
                        <div className="grid grid-cols-[0.8fr_1.8fr_1fr_0.6fr] items-center gap-2 rounded-t border-b border-slate-200 bg-[#2D4256] px-2 py-2 text-[10px] font-semibold text-white">
                          <div>Date</div>
                          <div>Description</div>
                          <div>Created By</div>
                          <div>Actions</div>
                        </div>
                        <div className="max-h-[320px] divide-y divide-slate-100 overflow-y-auto text-[11px]">
                          {sortedSelectedCaseDateEvents.length === 0 ? (
                            <div className="px-2 py-3 text-[11px] text-slate-500">No case dates recorded yet.</div>
                          ) : (
                            sortedSelectedCaseDateEvents.map((event) => (
                              <div key={event.id} className="grid grid-cols-[0.8fr_1.8fr_1fr_0.6fr] items-center gap-2 px-2 py-2 hover:bg-[#3eca44]/5">
                                <div className="min-w-0 text-slate-700">{formatDisplayDate(event.eventDate)}</div>
                                <div className="min-w-0 font-medium text-slate-900">{resolveCaseDateEventLabel(event)}</div>
                                <div className="min-w-0 truncate text-slate-700">{event.createdByName || "--"}</div>
                                <div className="min-w-0 flex items-center gap-2">
                                  <button
                                    type="button"
                                    className="text-slate-500 hover:text-[#2f9f35]"
                                    onClick={() => openEditCaseDateEventDialog(event)}
                                    aria-label="Edit date"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    className="text-slate-500 hover:text-rose-600"
                                    onClick={() => void handleDeleteCaseDateEvent(event.id)}
                                    aria-label="Delete date"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="notes" className="mt-6 flex-1 min-h-0 overflow-y-auto pr-1">
                      <div className="space-y-0">
                        {isCaseNotesLoading ? (
                          <div className="px-2 py-3 text-[11px] text-slate-500">Loading notes...</div>
                        ) : (selectedCase.notes ?? []).length === 0 ? (
                          <div className="space-y-3">
                            <div className="px-2 py-3 text-[11px] text-slate-500">No case notes yet.</div>
                            <Button
                              type="button"
                              className="h-8 rounded bg-[#3eca44] px-3 text-[11px] text-white hover:bg-[#34b73b]"
                              onClick={openAddCaseNoteDialog}
                            >
                              New Note
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <div className="group relative w-full max-w-[360px]">
                                <Input
                                  placeholder="Search by user or note content..."
                                  value={caseNotesSearchQuery}
                                  onChange={(e) => setCaseNotesSearchQuery(e.target.value)}
                                  className={`h-8 rounded border border-slate-200 bg-white !text-[11px] font-medium shadow-sm transition-colors placeholder:!text-[11px] hover:border-[#3eca44] focus-visible:!border focus-visible:!border-black focus-visible:ring-0 group-hover:border-[#3eca44] ${
                                    caseNotesSearchQuery.trim().length > 0 ? "pr-20" : "pr-9"
                                  }`}
                                />
                                {caseNotesSearchQuery.trim().length > 0 ? (
                                  <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-500 hover:text-[#2f9f35] hover:underline"
                                    onClick={() => setCaseNotesSearchQuery("")}
                                  >
                                    Clear
                                  </button>
                                ) : (
                                  <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                                )}
                              </div>
                              <Button
                                type="button"
                                className="h-8 rounded bg-[#3eca44] px-3 text-[11px] text-white hover:bg-[#34b73b]"
                                onClick={openAddCaseNoteDialog}
                              >
                                New Note
                              </Button>
                            </div>
                            <div className="grid grid-cols-[0.6fr_3.2fr_1fr_0.5fr] items-center gap-2 rounded-t border-b border-slate-200 bg-[#2D4256] px-2 py-2 text-[10px] font-semibold text-white">
                              <div>Date</div>
                              <div>Note</div>
                              <div>Created By</div>
                              <div>Actions</div>
                            </div>
                            <div className="max-h-[300px] divide-y divide-slate-100 overflow-y-auto text-[11px]">
                              {filteredCaseNotes.length === 0 ? (
                                <div className="px-2 py-3 text-slate-500">No case notes found.</div>
                              ) : (
                                filteredCaseNotes.map((note) => {
                                  const { content } = splitFileNoteContentAndEditTag(String(note.note_content || ""));
                                  return (
                                    <div key={note.id} className="grid grid-cols-[0.6fr_3.2fr_1fr_0.5fr] items-start gap-2 px-2 py-2 hover:bg-[#3eca44]/5">
                                      <div className="min-w-0 text-slate-700">{formatDisplayDate(String(note.note_date || ""))}</div>
                                      <div className="min-w-0 pr-2">
                                        <button
                                          type="button"
                                          className="block w-full overflow-hidden text-ellipsis whitespace-nowrap text-left text-slate-900 hover:text-[#2f9f35] hover:underline"
                                          onClick={() => openCaseNotePreviewDialog(String(note.note_content || ""), String(note.updated_at || ""))}
                                          dangerouslySetInnerHTML={{ __html: content ? renderInlineMentionHighlights(content) : "--" }}
                                        />
                                      </div>
                                      <div className="min-w-0 truncate text-slate-700">{String(note.note_user_name || "--")}</div>
                                      <div className="min-w-0 flex items-center gap-2">
                                        <button
                                          type="button"
                                          className={`text-slate-500 ${isNoteEditableByCurrentUser(note) ? "hover:text-[#2f9f35]" : "cursor-not-allowed opacity-40"}`}
                                          onClick={() => openEditCaseNoteDialog(note)}
                                          aria-label="Edit note"
                                          disabled={!isNoteEditableByCurrentUser(note)}
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          className={`text-slate-500 ${canCurrentUserDeleteNotes ? "hover:text-rose-600" : "cursor-not-allowed opacity-40"}`}
                                          onClick={() => void handleDeleteCaseNote(note.id)}
                                          aria-label="Delete note"
                                          disabled={!canCurrentUserDeleteNotes}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </TabsContent>
                    <TabsContent value="documents" className="mt-4"><div className="grid gap-2 text-xs sm:grid-cols-2">{["Referral Forms", "Notices of Set Down", "Employer Documents", "Employee Documents", "Witness Statements", "Disciplinary Documents", "Bundle / Index", "Settlement Agreement", "Award / Ruling / Order", "Correspondence"].map((doc) => <div key={doc} className="rounded border border-slate-200 bg-slate-50 p-2"><p className="font-medium text-slate-900">{doc}</p><p className="text-[10px] text-slate-500">No documents uploaded</p></div>)}</div></TabsContent>
                    <TabsContent value="outcome" className="mt-4">
                      {isCaseEditMode && caseEditForm ? (
                        <div className="grid gap-3 text-xs sm:grid-cols-2">
                          <div className="space-y-1"><p className="text-[10px] text-slate-500">Outcome Type</p><Select value={caseEditForm.outcome.outcomeType || undefined} onValueChange={(value) => setCaseEditForm((prev) => prev ? { ...prev, outcome: { ...prev.outcome, outcomeType: value } } : prev)}><SelectTrigger className={`${modalSelectClass} ${addModalDropdownToneClass}`}><SelectValue placeholder="Select outcome type" /></SelectTrigger><SelectContent className="text-[11px]">{OUTCOME_TYPE_OPTIONS.map((opt) => <SelectItem key={opt} value={opt} className={addModalSelectItemClass}>{opt}</SelectItem>)}</SelectContent></Select></div>
                          <div className="space-y-1"><p className="text-[10px] text-slate-500">Outcome Date</p><Input type="date" className={modalInputClass} value={caseEditForm.outcome.outcomeDate} onChange={(e) => setCaseEditForm((prev) => prev ? { ...prev, outcome: { ...prev.outcome, outcomeDate: e.target.value } } : prev)} /></div>
                          <div className="space-y-1"><p className="text-[10px] text-slate-500">Result</p><Input className={modalInputClass} value={caseEditForm.outcome.result} onChange={(e) => setCaseEditForm((prev) => prev ? { ...prev, outcome: { ...prev.outcome, result: e.target.value } } : prev)} /></div>
                          <div className="space-y-1"><p className="text-[10px] text-slate-500">Amount Awarded/Settled</p><Input className={modalInputClass} value={caseEditForm.outcome.amount} onChange={(e) => setCaseEditForm((prev) => prev ? { ...prev, outcome: { ...prev.outcome, amount: e.target.value } } : prev)} placeholder="R 0.00" /></div>
                          <div className="space-y-1 sm:col-span-2"><p className="text-[10px] text-slate-500">Closing Note</p><Textarea className={modalTextareaClass} value={caseEditForm.outcome.closingNote} onChange={(e) => setCaseEditForm((prev) => prev ? { ...prev, outcome: { ...prev.outcome, closingNote: e.target.value } } : prev)} /></div>
                          <div className="space-y-1"><p className="text-[10px] text-slate-500">Closed By</p><Input className={modalInputClass} value={caseEditForm.outcome.closedBy} onChange={(e) => setCaseEditForm((prev) => prev ? { ...prev, outcome: { ...prev.outcome, closedBy: e.target.value } } : prev)} /></div>
                          <div className="space-y-1"><p className="text-[10px] text-slate-500">Closed Date</p><Input type="date" className={modalInputClass} value={caseEditForm.outcome.closedDate} onChange={(e) => setCaseEditForm((prev) => prev ? { ...prev, outcome: { ...prev.outcome, closedDate: e.target.value } } : prev)} /></div>
                        </div>
                      ) : <div className="grid gap-2 text-xs sm:grid-cols-2">{[["Outcome Type", selectedCase.outcome.outcomeType], ["Outcome Date", selectedCase.outcome.outcomeDate], ["Result", selectedCase.outcome.result], ["Amount Awarded/Settled", selectedCase.outcome.amount], ["Closing Note", selectedCase.outcome.closingNote], ["Closed By", selectedCase.outcome.closedBy], ["Closed Date", selectedCase.outcome.closedDate]].filter(([, value]) => isVisibleReadOnlyValue(value)).map(([label, value]) => <div key={label} className="rounded border border-slate-200 bg-slate-50 p-2"><p className="text-[10px] text-slate-500">{label}</p><p className="font-medium text-slate-900">{label.toLowerCase().includes("date") ? formatDisplayDate(String(value)) : value}</p></div>)}</div>}
                    </TabsContent>
                  </Tabs>
                </div>
                <div className="border-t border-dashed border-muted/60 pt-4">
                    <div className="flex items-center justify-center gap-2">
                      {isCaseEditMode ? (
                        <>
                          <Button type="button" variant="outline" className="h-8 min-w-[92px] rounded text-[11px] border-slate-300 bg-white text-slate-700 hover:bg-white hover:border-slate-400 hover:text-slate-800" onClick={handleCancelCaseEdit} disabled={isSavingCaseEdit}>Cancel</Button>
                          <Button type="button" className="h-8 min-w-[92px] rounded bg-[#3eca44] px-3 text-[11px] text-white hover:bg-[#34b73b]" onClick={() => void handleSaveCaseEdit()} disabled={isSavingCaseEdit}>{isSavingCaseEdit ? "Saving..." : "Save"}</Button>
                        </>
                      ) : isEditableCaseTab ? (
                        <Button type="button" variant="outline" className="h-8 min-w-[92px] rounded text-[11px] border-slate-300 bg-white text-slate-700 hover:bg-white hover:border-[#3eca44] hover:text-[#2f9f35]" onClick={() => setIsCaseEditMode(true)}>Edit Case</Button>
                      ) : null}
                    </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
      <Dialog
        open={isCaseDateDialogOpen}
        onOpenChange={(open) => {
          setIsCaseDateDialogOpen(open);
          if (!open) resetCaseDateEventForm();
        }}
      >
        <DialogContent className="w-[94vw] max-w-[420px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <DialogTitle className="text-sm font-semibold text-white">{editingCaseDateEventId ? "Edit Matter Date" : "Add Matter Date"}</DialogTitle>
            <DialogClose asChild>
              <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded text-white/80 transition hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
          <div className="space-y-4 bg-white p-4 pt-6">
            <div className="relative space-y-1">
              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Description</span>
              <Input
                className={modalInputClass}
                placeholder="Type date description"
                value={caseDateEventForm.eventType}
                onChange={(e) => setCaseDateEventForm((prev) => ({ ...prev, eventType: e.target.value }))}
              />
            </div>
            <div className="relative space-y-1">
              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Date</span>
              <Input
                className={modalInputClass}
                type="text"
                readOnly
                placeholder="Please select a date"
                value={caseDateEventForm.eventDate ? formatDisplayDate(caseDateEventForm.eventDate) : ""}
                onClick={() => openDatePicker(caseDateEventDialogInputRef.current)}
                onFocus={() => openDatePicker(caseDateEventDialogInputRef.current)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDatePicker(caseDateEventDialogInputRef.current);
                  }
                }}
              />
              <input
                ref={caseDateEventDialogInputRef}
                type="date"
                value={caseDateEventForm.eventDate}
                onChange={(e) => setCaseDateEventForm((prev) => ({ ...prev, eventDate: e.target.value }))}
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
              />
            </div>
            <div className="relative space-y-1">
              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Created By</span>
              <Input
                className={modalInputClass}
                value={caseDateEventForm.createdByName}
                readOnly
              />
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <Button type="button" variant="outline" className="h-8 w-[92px] rounded text-[11px] border-slate-300 bg-white text-slate-700 hover:bg-white hover:border-slate-400 hover:text-slate-800" onClick={() => setIsCaseDateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" className="h-8 w-[92px] rounded bg-[#3eca44] px-3 text-[11px] text-white hover:bg-[#34b73b]" onClick={handleSubmitCaseDateEventDialog}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={isCaseNoteDialogOpen}
        onOpenChange={(open) => {
          setIsCaseNoteDialogOpen(open);
          if (!open) resetCaseNoteForm();
        }}
      >
        <DialogContent className="w-[94vw] max-w-[420px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <DialogTitle className="text-sm font-semibold text-white">{editingCaseNoteId ? "Edit Case Note" : "Add Case Note"}</DialogTitle>
            <DialogClose asChild>
              <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded text-white/80 transition hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
          <div className="space-y-4 bg-white p-4 pt-6">
            <div className="relative space-y-1">
              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Note Content</span>
              <div className="relative">
                <div
                  className="pointer-events-none min-h-[96px] whitespace-pre-wrap break-words rounded border border-slate-300 bg-white px-3 py-2 text-[11px] font-medium leading-5 text-slate-900"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: caseNoteForm.noteContent ? renderTextWithMentions(caseNoteForm.noteContent) : '<span class="text-slate-400">Type your note. Use @ to tag a user.</span>' }}
                />
                <textarea
                  ref={caseNoteTextareaRef}
                  className="absolute inset-0 min-h-[96px] w-full resize-none rounded border border-slate-300 bg-transparent px-3 py-2 text-[11px] font-medium leading-5 text-transparent caret-black shadow-none outline-none transition-colors hover:border-slate-500 focus:border-black"
                  value={caseNoteForm.noteContent}
                  onChange={(e) => handleCaseNoteContentChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
                  onClick={(e) => syncCaseNoteMentionRange(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
                  onKeyUp={(e) => syncCaseNoteMentionRange(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
                  onSelect={(e) => syncCaseNoteMentionRange(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace") {
                      const textarea = e.currentTarget;
                      const selectionStart = textarea.selectionStart ?? 0;
                      const selectionEnd = textarea.selectionEnd ?? selectionStart;
                      if (selectionStart === selectionEnd) {
                        const mentionRange = getMentionTokenRangeAtCaret(textarea.value, selectionStart);
                        if (mentionRange) {
                          e.preventDefault();
                          const trailingSpaceLength = textarea.value.slice(mentionRange.end, mentionRange.end + 1) === " " ? 1 : 0;
                          const nextContent = `${textarea.value.slice(0, mentionRange.start)}${textarea.value.slice(mentionRange.end + trailingSpaceLength)}`;
                          setCaseNoteForm((prev) => ({ ...prev, noteContent: nextContent }));
                          setCaseNoteMentionRange(null);
                          setCaseNoteMentionPopupPosition(null);
                          requestAnimationFrame(() => {
                            textarea.focus();
                            textarea.setSelectionRange(mentionRange.start, mentionRange.start);
                          });
                          return;
                        }
                      }
                    }
                    if (caseNoteMentionRange && filteredMentionOptions.length > 0 && (e.key === "Enter" || e.key === "Tab")) {
                      e.preventDefault();
                      insertCaseNoteMention(filteredMentionOptions[0]);
                    }
                    if (e.key === "Escape") {
                      setCaseNoteMentionRange(null);
                      setCaseNoteMentionPopupPosition(null);
                    }
                  }}
                />
                {caseNoteMentionRange && caseNoteMentionPopupPosition ? (
                  <div
                    className="absolute z-20 w-[220px] rounded border border-[#2D4256] bg-[#2D4256] shadow-lg"
                    style={{ top: caseNoteMentionPopupPosition.top, left: caseNoteMentionPopupPosition.left }}
                  >
                    {filteredMentionOptions.length === 0 ? (
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-300">No matching users.</div>
                    ) : (
                      filteredMentionOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[10px] font-semibold text-slate-300 hover:bg-white/10 hover:text-slate-100"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            insertCaseNoteMention(option);
                          }}
                        >
                          <span>@{option.token}</span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <Button type="button" variant="outline" className="h-8 w-[92px] rounded text-[11px] border-slate-300 bg-white text-slate-700 hover:bg-white hover:border-slate-400 hover:text-slate-800" onClick={() => setIsCaseNoteDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" className="h-8 w-[92px] rounded bg-[#3eca44] px-3 text-[11px] text-white hover:bg-[#34b73b]" onClick={() => void handleSaveCaseNote()} disabled={isSavingCaseNote}>
                {isSavingCaseNote ? "Saving..." : "Submit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isCaseNotePreviewOpen} onOpenChange={setIsCaseNotePreviewOpen}>
        <DialogContent className="w-[94vw] max-w-[560px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <DialogTitle className="text-sm font-semibold text-white">Case Note Preview</DialogTitle>
            <DialogClose asChild>
              <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded text-white/80 transition hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
          <div className="space-y-3 bg-white p-4">
            <div
              className="max-h-[52vh] overflow-y-auto whitespace-pre-wrap break-words rounded border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-900"
              dangerouslySetInnerHTML={{ __html: caseNotePreviewContent ? renderTextWithMentions(caseNotePreviewContent) : "--" }}
            />
            {caseNotePreviewEditTag ? (
              <div className="inline-flex rounded-full bg-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600">
                {sanitizeEditedTag(caseNotePreviewEditTag, caseNotePreviewUpdatedAt)}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Matters;
