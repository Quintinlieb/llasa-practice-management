import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FolderPlusIcon } from "@heroicons/react/24/outline";
import { PageDateStamp } from "@/components/DashboardLayout";
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
import { Check, ChevronDown, Clock3, Eye, FolderOpen, Pencil, Search, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { extractMentionTokens, resolveMentionRecipients } from "@/lib/mentionNotifications";
import { warnIfSouthAfricanPublicHoliday } from "@/lib/southAfricanPublicHolidays";
import { cn } from "@/lib/utils";
import { invalidateDashboardWeeklyMattersCache } from "@/lib/dashboardWeeklyMatters";
import { useLocation, useNavigate } from "react-router-dom";

type CaseNote = {
  id: string;
  case_file_id?: string;
  note_date: string;
  note_content: string;
  note_user_name: string;
  created_at?: string | null;
  updated_at?: string | null;
};
type CaseDateEvent = {
  id: string;
  case_file_id?: string;
  eventType: string;
  eventLabel: string;
  eventDate: string;
  eventTime?: string;
  duration?: string;
  createdByName: string;
  created_at?: string | null;
  updated_at?: string | null;
};
type MatterDateConflictInput = {
  id?: string;
  eventDate: string;
  eventTime: string;
  duration: string;
};
type CaseDocument = {
  id: string;
  case_file_id?: string;
  documentName: string;
  description: string;
  fileUrl: string;
  uploadedBy: string;
  created_at?: string | null;
  updated_at?: string | null;
};
type CaseTask = { title: string; assignedTo: string; dueDate: string; priority: "Low" | "Medium" | "High"; status: string };
type OffenceCategory = "Minor" | "Serious" | "Dismissible";
type ConductOffence = {
  name: string;
  category: OffenceCategory;
  firstOutcome: string;
};
type CaseOutcome = {
  outcomeType: string;
  outcomeDate: string;
  misconductTypes: string[];
  amountAwarded: string;
  amountSettled: string;
  closingNote: string;
};
type CaseFile = {
  id: string;
  createdById: string;
  createdByName: string;
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
  documents: CaseDocument[];
  tasks: CaseTask[];
  outcome: CaseOutcome;
};

type ClientOption = { id: string; label: string };
type ConsultantOption = { id: string; label: string };
type MentionOption = { id: string; label: string; token: string; searchText: string; recipientUserId: string };
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
type MatterDetailsTableProps = {
  headerColumns: React.ReactNode[];
  gridClassName: string;
  children: React.ReactNode;
  emptyState?: React.ReactNode;
  bodyMaxHeightClassName?: string;
};
const MATTER_DETAILS_TABLE_GRID = "grid-cols-[110px_90px_2.75fr_1fr_72px]";
const CASE_FILES_TABLE_GRID = "grid-cols-[24px_105px_1.7fr_2.75fr_1fr_0.8fr_90px_0.5fr_1.1fr]";
const caseFilesTableCacheKey = "case-files:table-cache";
const CASE_FILES_TABLE_PAGE_SIZE = 25;
const CASE_DOCUMENTS_BUCKET = "case-documents";
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
  if (registeredWithType && trading) {
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
const getMatterClientLabelFromRelation = (value: unknown) => {
  const client = Array.isArray(value) ? value[0] : value;
  if (!client || typeof client !== "object") return "";
  return buildMatterClientLabel(
    (client as { registered_name?: unknown }).registered_name,
    (client as { company_type?: unknown }).company_type,
    (client as { trading_as?: unknown }).trading_as,
  );
};

const CASE_TYPE_OPTIONS = [
  "Hearing",
  "Consultation",
  "CCMA",
  "Bargaining Council",
  "Labour Court",
] as const;
const NEW_MATTER_OPTIONS: Array<{ label: string; caseType: (typeof CASE_TYPE_OPTIONS)[number] }> = [
  { label: "Hearing", caseType: "Hearing" },
  { label: "Consultation", caseType: "Consultation" },
  { label: "CCMA", caseType: "CCMA" },
  { label: "Bargaining Council", caseType: "Bargaining Council" },
  { label: "Labour Court", caseType: "Labour Court" },
];
const SUBTYPE_NONE = "None";
const REFERRAL_SUBTYPE = "Referral";
const HEARING_SUBTYPE_OPTIONS = ["Disciplinary", "Incapacity", "Appeal"] as const;
type HearingSubtype = (typeof HEARING_SUBTYPE_OPTIONS)[number];
const CASE_TYPE_SUBTYPE_OPTIONS: Partial<Record<(typeof CASE_TYPE_OPTIONS)[number], readonly string[]>> = {
  Hearing: HEARING_SUBTYPE_OPTIONS,
  Consultation: ["General", "Grievance", "Performance", "Retrenchment", "Employment Equity", "Case Preparation", "Wage Negotiations", "Mutual Interest Matters"],
  CCMA: [REFERRAL_SUBTYPE, "Conciliation", "In Limine", "Con/Arb", "Arbitration"],
  "Bargaining Council": [REFERRAL_SUBTYPE, "Conciliation", "In Limine", "Con/Arb", "Arbitration"],
};
const STATUS_OPTIONS: CaseFile["status"][] = ["Active", "Inactive"];
const PRIORITY_OPTIONS: CaseFile["priority"][] = ["Low", "Medium", "High", "Urgent"];
const CURRENT_STAGE_OPTIONS = ["Referred", "Scheduled", "Awaiting Date", "Finalised", "In progress"] as const;
const HEARING_TIME_HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const HEARING_TIME_MINUTE_OPTIONS = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"] as const;
const MATTER_DATE_DURATION_OPTIONS = ["15 mins", "30 mins", "1 hour", "2 hours", "Half day", "Full day"] as const;
const OUTCOME_TYPE_OPTIONS = ["Dismissal Upheld", "Settlement", "Award Issued", "Case Withdrawn", "Matter Closed", "Consultation Completed", "Hearing Finalised"] as const;
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
  { name: "Dereliction of Duties", category: "Serious", firstOutcome: "" },
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
type OutcomeFlowConfig = {
  outcomeTypeOptions: readonly string[];
};
const DEFAULT_OUTCOME_FLOW: OutcomeFlowConfig = {
  outcomeTypeOptions: OUTCOME_TYPE_OPTIONS,
};
const CCMA_OUTCOME_FLOW: OutcomeFlowConfig = {
  outcomeTypeOptions: [
    "Settled",
    "Withdrawn",
    "Dismissed",
    "Unresolved (Strike)",
    "Unresolved (Refer Arbitration)",
    "Unresolved (Refer Labour Court)",
    "Award (reinstatement)",
    "Award (reinstatement with backpay)",
    "Award (Compensation)",
    "Dismissal Upheld",
  ],
};
const HEARING_DISCIPLINE_OUTCOME_FLOW: OutcomeFlowConfig = {
  outcomeTypeOptions: [
    "Not Guilty",
    "Withdrawn",
    "Guilty - Verbal Warning",
    "Guilty - Written Warning",
    "Guilty - Final Written Warning",
    "Guilty - Suspension Without Pay",
    "Guilty - Demotion",
    "Guilty - Dismissal",
    "Guilty - Alternative Sanction",
  ],
};
const HEARING_INCAPACITY_PERFORMANCE_OUTCOME_FLOW: OutcomeFlowConfig = {
  outcomeTypeOptions: ["Hearing Finalised", "Settlement", "Matter Closed"],
};
const HEARING_INCAPACITY_ILL_HEALTH_OUTCOME_FLOW: OutcomeFlowConfig = {
  outcomeTypeOptions: ["Hearing Finalised", "Settlement", "Matter Closed"],
};
const HEARING_GRIEVANCE_OUTCOME_FLOW: OutcomeFlowConfig = {
  outcomeTypeOptions: ["Hearing Finalised", "Settlement", "Matter Closed", "Case Withdrawn"],
};
const CONSULTATION_GENERAL_OUTCOME_FLOW: OutcomeFlowConfig = {
  outcomeTypeOptions: [
    "Advice Provided",
    "Further Information Required",
    "Action Plan Agreed",
    "Follow-Up Required",
    "Matter Closed",
  ],
};
const CONSULTATION_GRIEVANCE_OUTCOME_FLOW: OutcomeFlowConfig = {
  outcomeTypeOptions: [
    "Grievance Resolved",
    "Grievance Partially Resolved",
    "Grievance Dismissed",
    "Further Investigation Required",
    "Referred to Formal Process",
  ],
};
const CONSULTATION_PERFORMANCE_OUTCOME_FLOW: OutcomeFlowConfig = {
  outcomeTypeOptions: [
    "Performance Improvement Plan Issued",
    "Counselling Provided",
    "Training / Support Agreed",
    "Performance Improved",
    "Further Review Required",
    "Matter Escalated to Incapacity Hearing",
  ],
};
const CONSULTATION_RETRENCHMENT_OUTCOME_FLOW: OutcomeFlowConfig = {
  outcomeTypeOptions: [
    "Retrenchment Avoided",
    "Retrenchment Confirmed",
    "Alternative Position Accepted",
    "Voluntary Retrenchment Accepted",
    "Further Consultation Required",
    "Dispute Referred",
  ],
};
const CONSULTATION_TRADE_UNION_OUTCOME_FLOW: OutcomeFlowConfig = {
  outcomeTypeOptions: [
    "Agreement Reached",
    "Partial Agreement Reached",
    "No Agreement Reached",
    "Deadlock Declared",
    "Referred to CCMA / Bargaining Council",
    "Industrial Action Initiated",
  ],
};
const WAGE_NEGOTIATION_OUTCOME_FLOW: OutcomeFlowConfig = {
  outcomeTypeOptions: [
    "Agreement Reached",
    "Partial Agreement Reached",
    "No Agreement Reached",
    "Deadlock Declared",
    "Referred to CCMA / Bargaining Council",
    "Postponed",
  ],
};
const LABOUR_COURT_OUTCOME_FLOW: OutcomeFlowConfig = {
  outcomeTypeOptions: ["Judgment", "Settlement", "Case Withdrawn", "Matter Closed"],
};
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
const NON_STAGE_TRIGGER_EVENT_TYPES = new Set([
  "Deadline Date",
  "Next Action Date",
]);

const getSubtypeOptions = (caseType: string) => CASE_TYPE_SUBTYPE_OPTIONS[caseType as (typeof CASE_TYPE_OPTIONS)[number]] ?? [];
const shouldHideSubtype = (caseType: string) => caseType === "Labour Court";
const isReferralSubtype = (caseType: string, subtype: string) =>
  (caseType === "CCMA" || caseType === "Bargaining Council") && subtype === REFERRAL_SUBTYPE;
const normalizeHearingSubtype = (subtype: string): HearingSubtype | string => {
  const trimmedSubtype = String(subtype || "").trim();
  const normalizedSubtype = trimmedSubtype.toLowerCase();
  if (normalizedSubtype === "discipline" || normalizedSubtype === "disciplinary") return "Disciplinary";
  if (normalizedSubtype === "incapacity (performance)" || normalizedSubtype === "incapacity (ill health)" || normalizedSubtype === "incapacity") return "Incapacity";
  if (normalizedSubtype === "appeal") return "Appeal";
  return trimmedSubtype;
};
const getSubtypeValueForCaseType = (caseType: string, currentSubtype = "") => {
  if (shouldHideSubtype(caseType)) return SUBTYPE_NONE;
  const options = getSubtypeOptions(caseType);
  const normalizedCurrentSubtype = caseType === "Hearing" ? normalizeHearingSubtype(currentSubtype) : currentSubtype;
  return options.includes(normalizedCurrentSubtype) ? normalizedCurrentSubtype : "";
};
const getHearingMatterLabel = (subtype: string) => {
  const normalizedSubtype = String(subtype || "").trim().toLowerCase();
  if (normalizedSubtype === "discipline" || normalizedSubtype === "disciplinary") return "Disciplinary Hearing";
  if (
    normalizedSubtype === "incapacity (performance)" ||
    normalizedSubtype === "incapacity (ill health)" ||
    normalizedSubtype === "incapacity"
  ) {
    return "Incapacity Hearing";
  }
  if (normalizedSubtype === "appeal") return "Appeal Hearing";
  if (normalizedSubtype === "grievance") return "Grievance Hearing";
  if (normalizedSubtype === "abscondment") return "Abscondment Hearing";
  return "Hearing";
};
const getCaseTypePillClassName = (caseType: string) => {
  const normalized = String(caseType || "").trim().toLowerCase();
  if (normalized.includes("hearing")) {
    return "border-orange-200 bg-orange-100 text-orange-700 hover:bg-orange-100 hover:text-orange-700";
  }
  if (normalized.includes("ccma") || normalized.includes("bargaining council")) {
    return "border-blue-200 bg-blue-100 text-blue-700 hover:bg-blue-100 hover:text-blue-700";
  }
  if (normalized.includes("consultation")) {
    return "border-purple-200 bg-purple-100 text-purple-700 hover:bg-purple-100 hover:text-purple-700";
  }
  return "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100 hover:text-slate-700";
};
const getOutcomeFlowConfig = (caseType: string, subtype: string): OutcomeFlowConfig => {
  const normalizedSubtype = caseType === "Hearing" ? normalizeHearingSubtype(subtype) : subtype;
  if (caseType === "CCMA" || caseType === "Bargaining Council") return CCMA_OUTCOME_FLOW;
  if (caseType === "Hearing" && normalizedSubtype === "Disciplinary") return HEARING_DISCIPLINE_OUTCOME_FLOW;
  if (caseType === "Hearing" && normalizedSubtype === "Incapacity") return HEARING_INCAPACITY_PERFORMANCE_OUTCOME_FLOW;
  if (caseType === "Hearing" && normalizedSubtype === "Appeal") return HEARING_GRIEVANCE_OUTCOME_FLOW;
  if (caseType === "Hearing" && normalizedSubtype === "Grievance") return HEARING_GRIEVANCE_OUTCOME_FLOW;
  if (caseType === "Consultation" && subtype === "Grievance") return CONSULTATION_GRIEVANCE_OUTCOME_FLOW;
  if (caseType === "Consultation" && subtype === "Performance") return CONSULTATION_PERFORMANCE_OUTCOME_FLOW;
  if (caseType === "Consultation" && subtype === "Retrenchment") return CONSULTATION_RETRENCHMENT_OUTCOME_FLOW;
  if (caseType === "Consultation" && subtype === "Wage Negotiations") return WAGE_NEGOTIATION_OUTCOME_FLOW;
  if (caseType === "Consultation" && subtype === "Mutual Interest Matters") return CONSULTATION_TRADE_UNION_OUTCOME_FLOW;
  if (caseType === "Consultation") return CONSULTATION_GENERAL_OUTCOME_FLOW;
  if (caseType === "Labour Court") return LABOUR_COURT_OUTCOME_FLOW;
  return DEFAULT_OUTCOME_FLOW;
};
const shouldShowAmountSettled = (outcomeType: string) => {
  const normalizedType = outcomeType.trim();
  return normalizedType === "Settlement" || normalizedType === "Settled";
};
const shouldShowDismissalMisconductTypes = (caseType: string, subtype: string, outcomeType: string) =>
  caseType === "Hearing" && normalizeHearingSubtype(subtype) === "Disciplinary" && outcomeType.trim() === "Guilty - Dismissal";
const shouldShowAmountAwarded = (outcomeType: string) => {
  const normalizedType = outcomeType.trim();
  if (normalizedType === "Award (reinstatement with backpay)" || normalizedType === "Award (Compensation)") {
    return true;
  }
  return false;
};
const getAmountAwardedLabel = (outcomeType: string) => {
  if (
    outcomeType.trim() === "Award (reinstatement with backpay)" ||
    outcomeType.trim() === "Award (Compensation)"
  ) {
    return "Amount Awarded";
  }
  return "Amount Awarded";
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
  subtype: caseFile.subtype === "--" ? "" : (caseFile.caseType === "Hearing" ? String(normalizeHearingSubtype(caseFile.subtype)) : caseFile.subtype),
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
    misconductTypes: Array.isArray(caseFile.outcome.misconductTypes) ? caseFile.outcome.misconductTypes : [],
    amountAwarded: caseFile.outcome.amountAwarded === "R 0.00" ? "" : caseFile.outcome.amountAwarded,
    amountSettled: caseFile.outcome.amountSettled === "R 0.00" ? "" : caseFile.outcome.amountSettled,
    closingNote: caseFile.outcome.closingNote === "--" ? "" : caseFile.outcome.closingNote,
  },
});

const toIsoDate = (value: string) => (value ? new Date(value).toISOString().slice(0, 10) : "");
const createCaseDateEventDraft = (overrides?: Partial<CaseDateEvent>): CaseDateEvent => ({
  id: String(overrides?.id || `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
  case_file_id: overrides?.case_file_id,
  eventType: String(overrides?.eventType || ""),
  eventLabel: String(overrides?.eventLabel || ""),
  eventDate: String(overrides?.eventDate || ""),
  eventTime: String(overrides?.eventTime || ""),
  duration: overrides?.duration === undefined ? "1 hour" : String(overrides.duration),
  createdByName: String(overrides?.createdByName || ""),
  created_at: overrides?.created_at ?? null,
  updated_at: overrides?.updated_at ?? null,
});
const createCaseDocumentDraft = (overrides?: Partial<CaseDocument>): CaseDocument => ({
  id: String(overrides?.id || ""),
  case_file_id: overrides?.case_file_id,
  documentName: String(overrides?.documentName || ""),
  description: String(overrides?.description || ""),
  fileUrl: String(overrides?.fileUrl || ""),
  uploadedBy: String(overrides?.uploadedBy || ""),
  created_at: overrides?.created_at ?? null,
  updated_at: overrides?.updated_at ?? null,
});
const createBlankCaseDocumentForm = () => ({
  description: "",
  uploadedBy: "",
});
const getInitials = (value: unknown) => {
  const tokens = String(value ?? "").trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "--";
  return tokens.slice(0, 2).map((token) => token.charAt(0).toUpperCase()).join("");
};
const sanitizeStorageFileName = (value: string) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9._-]/g, "");
const createNewCasePrimaryDateEvent = (createdByName = "") =>
  createCaseDateEventDraft({
    createdByName,
    eventType: "",
    eventDate: "",
    duration: "",
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
const formatShortDisplayDate = (value?: string) => {
  if (!value) return "";
  const trimmed = String(value).trim();
  const isoDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/);
  const parsed = isoDateMatch
    ? new Date(Number(isoDateMatch[1]), Number(isoDateMatch[2]) - 1, Number(isoDateMatch[3]))
    : new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};
const formatDisplayTime = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(String(value || "").trim());
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
};
const formatDisplayTime24WithMeridiem = (value?: string | Date | null) => {
  if (!value) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    const hours = String(value.getHours()).padStart(2, "0");
    const minutes = String(value.getMinutes()).padStart(2, "0");
    const meridiem = value.getHours() >= 12 ? "PM" : "AM";
    return `${hours}:${minutes} ${meridiem}`;
  }
  const trimmed = String(value).trim();
  const timeMatch = trimmed.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (timeMatch) {
    const hours = Number(timeMatch[1]);
    const meridiem = hours >= 12 ? "PM" : "AM";
    return `${timeMatch[1]}:${timeMatch[2]} ${meridiem}`;
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const hours = String(parsed.getHours()).padStart(2, "0");
    const minutes = String(parsed.getMinutes()).padStart(2, "0");
    const meridiem = parsed.getHours() >= 12 ? "PM" : "AM";
    return `${hours}:${minutes} ${meridiem}`;
  }
  return trimmed;
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
const getUpcomingNextActionDate = (events: CaseDateEvent[]) => {
  const today = dateToday();
  return events
    .filter((event) => event.eventType === "Next Action Date" && event.eventDate && event.eventDate >= today)
    .map((event) => event.eventDate)
    .sort((left, right) => left.localeCompare(right))[0] || "--";
};
const getScheduledCaseDateEvents = (events: CaseDateEvent[]) =>
  events
    .filter((event) => {
      const eventDate = String(event.eventDate || "").trim();
      const eventType = String(event.eventType || "").trim();
      return eventDate && !NON_STAGE_TRIGGER_EVENT_TYPES.has(eventType);
    })
    .map((event) => {
      const eventDate = String(event.eventDate || "").trim();
      const eventTime = String(event.eventTime || "").trim();
      return {
        eventDate,
        eventTime,
        sortKey: `${eventDate}T${eventTime || "00:00"}`,
      };
    })
    .sort((left, right) => left.sortKey.localeCompare(right.sortKey));
const getFirstScheduledEventDateTime = (events: CaseDateEvent[]) => getScheduledCaseDateEvents(events)[0] || null;
const getUpcomingScheduledEventDateTime = (events: CaseDateEvent[]) => {
  const now = Date.now();
  return (
    getScheduledCaseDateEvents(events).find((event) => {
      const scheduledAt = new Date(`${event.eventDate}T${event.eventTime || "00:00"}:00`);
      return !Number.isNaN(scheduledAt.getTime()) && scheduledAt.getTime() >= now;
    }) || null
  );
};
const getCasePrimaryNextDate = (events: CaseDateEvent[]) => {
  const upcomingScheduledEvent = getUpcomingScheduledEventDateTime(events);
  if (upcomingScheduledEvent) return upcomingScheduledEvent.eventDate;
  return getUpcomingNextActionDate(events);
};
const getCaseTableDisplayDate = (events: CaseDateEvent[], fallbackDate: unknown) => {
  const scheduledEvents = getScheduledCaseDateEvents(events);
  const latestScheduledEvent = scheduledEvents[scheduledEvents.length - 1];
  if (latestScheduledEvent?.eventDate) return latestScheduledEvent.eventDate;
  const fallback = String(fallbackDate ?? "").trim();
  return fallback || "--";
};
const getCaseFileDateSortValue = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "--") return Number.NEGATIVE_INFINITY;
  const isoDateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/);
  const parsed = isoDateMatch
    ? new Date(Number(isoDateMatch[1]), Number(isoDateMatch[2]) - 1, Number(isoDateMatch[3]))
    : new Date(raw);
  return Number.isNaN(parsed.getTime()) ? Number.NEGATIVE_INFINITY : parsed.getTime();
};
const normalizeCurrentStageValue = (value: unknown) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "scheduled") return "Scheduled";
  if (normalized === "referred") return "Referred";
  if (normalized === "awaiting date") return "Awaiting Date";
  if (normalized === "finalised" || normalized === "finalized") return "Finalised";
  if (normalized === "in progress") return "In progress";
  return "";
};
const parseCaseDateEventTime = (timeValue: unknown, descriptionValue?: unknown) => {
  const eventTime = String(timeValue ?? "").trim();
  if (eventTime) return eventTime.slice(0, 5);
  const description = String(descriptionValue ?? "").trim();
  const match = description.match(/^Time:\s*(\d{2}:\d{2})$/i);
  return match ? match[1] : "";
};
const getMatterDateDurationMs = (duration: unknown) => {
  switch (String(duration ?? "").trim().toLowerCase()) {
    case "15 mins":
      return 15 * 60 * 1000;
    case "30 mins":
      return 30 * 60 * 1000;
    case "1 hour":
      return 60 * 60 * 1000;
    case "2 hours":
      return 2 * 60 * 60 * 1000;
    case "half day":
      return 4 * 60 * 60 * 1000;
    case "full day":
      return 8 * 60 * 60 * 1000;
    default:
      return 60 * 60 * 1000;
  }
};
const parseMatterDateInterval = (event: MatterDateConflictInput) => {
  const eventDate = String(event.eventDate || "").trim();
  const eventTime = String(event.eventTime || "").trim();
  if (!eventDate || !eventTime) return null;
  const start = new Date(`${eventDate}T${eventTime}:00`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + getMatterDateDurationMs(event.duration || "1 hour"));
  return { start, end };
};
const doMatterDateIntervalsOverlap = (left: MatterDateConflictInput, right: MatterDateConflictInput) => {
  const leftInterval = parseMatterDateInterval(left);
  const rightInterval = parseMatterDateInterval(right);
  if (!leftInterval || !rightInterval) return false;
  return leftInterval.start.getTime() < rightInterval.end.getTime() && leftInterval.end.getTime() > rightInterval.start.getTime();
};
const resolveCurrentStage = (
  value: unknown,
  status: CaseFile["status"],
  events: CaseDateEvent[],
  options?: { preserveExplicitStage?: boolean },
) => {
  if (status === "Inactive") return "Finalised";
  const normalizedStage = normalizeCurrentStageValue(value) || "Awaiting Date";
  if (options?.preserveExplicitStage && normalizedStage) return normalizedStage;
  const firstScheduledEvent = getFirstScheduledEventDateTime(events);
  if (firstScheduledEvent) {
    const scheduledAt = new Date(`${firstScheduledEvent.eventDate}T${firstScheduledEvent.eventTime || "00:00"}:00`);
    if (!Number.isNaN(scheduledAt.getTime())) {
      if (scheduledAt.getTime() <= Date.now()) {
        return "In progress";
      }
      return "Scheduled";
    }
  }
  return normalizedStage;
};
const getCurrentStagePillClassName = (value: unknown) => {
  const stage = normalizeCurrentStageValue(value);
  if (stage === "Scheduled") {
    return "border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50 hover:text-sky-700";
  }
  if (stage === "Referred") {
    return "border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50 hover:text-violet-700";
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
const loadMentionRecipientsForTokens = async (tokens: string[], companyId: string): Promise<MentionOption[]> => {
  const normalizedTokens = Array.from(new Set(tokens.map((token) => String(token || "").trim().toLowerCase()).filter(Boolean)));
  if (normalizedTokens.length === 0) return [];

  const recipients: MentionOption[] = [];
  const seen = new Set<string>();
  const addRecipient = (recipientUserId: string, label: string) => {
    const safeRecipientUserId = String(recipientUserId || "").trim();
    const safeLabel = String(label || "").trim();
    const token = toMentionToken(safeLabel);
    if (!safeRecipientUserId || !safeLabel || !token) return;
    const normalizedToken = token.toLowerCase();
    const dedupeKey = `${safeRecipientUserId}:${normalizedToken}`;
    if (!normalizedTokens.includes(normalizedToken) || seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    recipients.push({
      id: safeRecipientUserId,
      label: safeLabel,
      token,
      searchText: `${safeLabel} ${token}`.toLowerCase(),
      recipientUserId: safeRecipientUserId,
    });
  };

  const { data: masterProfiles } = await (supabase as any)
    .from("profiles")
    .select("id,auth_user_id,user_name,user_surname,user_email");
  (Array.isArray(masterProfiles) ? masterProfiles : []).forEach((row: any) => {
    const fullName = `${String(row?.user_name || "").trim()} ${String(row?.user_surname || "").trim()}`.trim();
    addRecipient(String(row?.auth_user_id || row?.id || ""), fullName || String(row?.user_email || "").trim());
  });

  const { data: subusers } = await (supabase as any)
    .from("subusers")
    .select("auth_user_id,name,surname,email,status");
  (Array.isArray(subusers) ? subusers : []).forEach((row: any) => {
    const status = String(row?.status || "").trim().toLowerCase();
    if (status && status !== "accepted" && status !== "active") return;
    const fullName = `${String(row?.name || "").trim()} ${String(row?.surname || "").trim()}`.trim();
    addRecipient(String(row?.auth_user_id || ""), fullName || String(row?.email || "").trim());
  });

  return recipients;
};
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
      if (subtype === "Employment Equity") return "Equity Meeting";
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

  return getHearingMatterLabel(caseFile.subtype);
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

const MatterDetailsTable = ({
  headerColumns,
  gridClassName,
  children,
  emptyState,
  bodyMaxHeightClassName = "max-h-[300px]",
}: MatterDetailsTableProps) => (
  <>
    <div className={cn("grid items-center gap-2 rounded-t border-b border-slate-200 bg-[#2D4256] px-2 py-2 text-[10px] font-semibold text-white", gridClassName)}>
      {headerColumns.map((column, index) => (
        <div key={index}>{column}</div>
      ))}
    </div>
    <div className={cn(bodyMaxHeightClassName, "divide-y divide-slate-100 overflow-y-auto text-[11px]")}>
      {children || emptyState}
    </div>
  </>
);

const Matters = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [caseFiles, setCaseFiles] = useState<CaseFile[]>(() => loadCachedCaseFiles());
  const [isCaseFilesLoading, setIsCaseFilesLoading] = useState(() => loadCachedCaseFiles().length === 0);
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [clientLoadMessage, setClientLoadMessage] = useState("No clients found.");
  const [consultantOptions, setConsultantOptions] = useState<ConsultantOption[]>([]);
  const [mentionOptions, setMentionOptions] = useState<MentionOption[]>([]);
  const [conductOffences, setConductOffences] = useState<ConductOffence[]>([]);
  const [misconductLoadMessage, setMisconductLoadMessage] = useState("No misconduct types found.");
  const [caseOutcomeMisconductOpen, setCaseOutcomeMisconductOpen] = useState(false);
  const [caseOutcomeMisconductSearchValue, setCaseOutcomeMisconductSearchValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [caseFilesTablePage, setCaseFilesTablePage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | CaseFile["status"]>("Active");
  const [caseTypeFilter, setCaseTypeFilter] = useState("all");
  const [consultantFilter, setConsultantFilter] = useState("all");
  const [nextDateFilter, setNextDateFilter] = useState<"all" | "next7" | "next30">("all");
  const [expandedFilterSection, setExpandedFilterSection] = useState<string | null>(null);
  const [isFiltersPanelOpen, setIsFiltersPanelOpen] = useState(false);
  const [isNewCaseMenuOpen, setIsNewCaseMenuOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseFile | null>(null);
  const [activeCaseTab, setActiveCaseTab] = useState<CaseDetailsTab>("overview");
  const [pendingOpenCaseNoteId, setPendingOpenCaseNoteId] = useState("");
  const [isCaseEditMode, setIsCaseEditMode] = useState(false);
  const [isSavingCaseEdit, setIsSavingCaseEdit] = useState(false);
  const [caseEditForm, setCaseEditForm] = useState<CaseEditForm | null>(null);
  const [isCaseDateDialogOpen, setIsCaseDateDialogOpen] = useState(false);
  const [editingCaseDateEventId, setEditingCaseDateEventId] = useState<string | null>(null);
  const [caseDateEventForm, setCaseDateEventForm] = useState({
    eventType: "",
    eventDate: "",
    eventTime: "",
    duration: "1 hour",
    createdByName: "",
  });
  const [caseEditScheduleForm, setCaseEditScheduleForm] = useState({
    eventType: "",
    eventDate: "",
    eventTime: "",
    duration: "1 hour",
  });
  const [currentUserDisplayName, setCurrentUserDisplayName] = useState("");
  const [currentUserSubuserRole, setCurrentUserSubuserRole] = useState("");
  const [caseNotesSearchQuery, setCaseNotesSearchQuery] = useState("");
  const [isCaseNotesLoading, setIsCaseNotesLoading] = useState(false);
  const [isCaseDocumentsLoading, setIsCaseDocumentsLoading] = useState(false);
  const [isCaseNoteDialogOpen, setIsCaseNoteDialogOpen] = useState(false);
  const [isSavingCaseNote, setIsSavingCaseNote] = useState(false);
  const [isCaseDocumentDialogOpen, setIsCaseDocumentDialogOpen] = useState(false);
  const [isSavingCaseDocument, setIsSavingCaseDocument] = useState(false);
  const [editingCaseDocument, setEditingCaseDocument] = useState<CaseDocument | null>(null);
  const [editingCaseNoteId, setEditingCaseNoteId] = useState<string | null>(null);
  const [isCaseNotePreviewOpen, setIsCaseNotePreviewOpen] = useState(false);
  const [caseNotePreviewContent, setCaseNotePreviewContent] = useState("");
  const [caseNotePreviewEditTag, setCaseNotePreviewEditTag] = useState("");
  const [caseNotePreviewUpdatedAt, setCaseNotePreviewUpdatedAt] = useState("");
  const [caseDocumentForm, setCaseDocumentForm] = useState(createBlankCaseDocumentForm());
  const [caseDocumentFile, setCaseDocumentFile] = useState<File | null>(null);
  const [caseDocumentFileName, setCaseDocumentFileName] = useState("");
  const [caseNoteForm, setCaseNoteForm] = useState({
    noteDate: "",
    noteContent: "",
    noteUserName: "",
  });
  const [caseNoteMentionRange, setCaseNoteMentionRange] = useState<{ query: string; start: number; end: number } | null>(null);
  const [caseNoteMentionPopupPosition, setCaseNoteMentionPopupPosition] = useState<{ top: number; left: number } | null>(null);
  const [openingNoteMentionRange, setOpeningNoteMentionRange] = useState<{ query: string; start: number; end: number } | null>(null);
  const [openingNoteMentionPopupPosition, setOpeningNoteMentionPopupPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [isNewCaseDialogOpen, setIsNewCaseDialogOpen] = useState(false);
  const [isClientSelectOpen, setIsClientSelectOpen] = useState(false);
  const [isNewCaseTypeOpen, setIsNewCaseTypeOpen] = useState(false);
  const [isNewCaseSubtypeOpen, setIsNewCaseSubtypeOpen] = useState(false);
  const [isNewCaseTimeHourOpen, setIsNewCaseTimeHourOpen] = useState(false);
  const [isNewCaseTimeMinuteOpen, setIsNewCaseTimeMinuteOpen] = useState(false);
  const [isNewCaseDurationOpen, setIsNewCaseDurationOpen] = useState(false);
  const [isNewCaseConsultantOpen, setIsNewCaseConsultantOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [newCaseStep, setNewCaseStep] = useState<NewCaseStep>(1);
  const [newCaseForm, setNewCaseForm] = useState<NewCaseForm>(createBlankCaseForm());
  const [isSavingCase, setIsSavingCase] = useState(false);
  const caseDateEventDialogInputRef = useRef<HTMLInputElement | null>(null);
  const caseDateEventTimeDialogInputRef = useRef<HTMLInputElement | null>(null);
  const caseEditScheduleDateInputRef = useRef<HTMLInputElement | null>(null);
  const caseOutcomeDateInputRef = useRef<HTMLInputElement | null>(null);
  const newCaseDateEventInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const newCaseShortDescriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const caseNoteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const openingNoteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hasLoadedClientOptionsRef = useRef(false);
  const hasLoadedConsultantOptionsRef = useRef(false);
  const hasLoadedMentionOptionsRef = useRef(false);

  const resizeNewCaseShortDescriptionTextarea = useCallback(() => {
    const textarea = newCaseShortDescriptionTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = "34px";
    textarea.style.height = `${Math.max(34, textarea.scrollHeight)}px`;
  }, []);

  const resizeOpeningNoteTextarea = useCallback(() => {
    const textarea = openingNoteTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = "44px";
    textarea.style.height = `${Math.max(44, textarea.scrollHeight)}px`;
  }, []);

  useEffect(() => {
    resizeNewCaseShortDescriptionTextarea();
  }, [newCaseForm.shortDescription, resizeNewCaseShortDescriptionTextarea]);

  useEffect(() => {
    resizeOpeningNoteTextarea();
  }, [newCaseForm.openingNote, resizeOpeningNoteTextarea]);

  const caseTypes = useMemo(() => Array.from(new Set(caseFiles.map((item) => item.caseType))), [caseFiles]);
  const consultants = useMemo(() => Array.from(new Set(caseFiles.map((item) => item.consultant).filter(Boolean))), [caseFiles]);
  const filteredClientOptions = useMemo(() => {
    const query = clientSearchQuery.trim().toLowerCase();
    if (!query) return clientOptions;
    return clientOptions.filter((client) => client.label.toLowerCase().includes(query));
  }, [clientOptions, clientSearchQuery]);
  const activeOutcomeCaseType = caseEditForm?.caseType || selectedCase?.caseType || "";
  const activeOutcomeSubtype = caseEditForm?.subtype || selectedCase?.subtype || "";
  const activeOutcomeFlow = useMemo(
    () => getOutcomeFlowConfig(activeOutcomeCaseType, activeOutcomeSubtype),
    [activeOutcomeCaseType, activeOutcomeSubtype],
  );
  const caseEditNeedsScheduleDate = Boolean(
    selectedCase &&
    caseEditForm &&
    activeCaseTab === "overview" &&
    caseEditForm.currentStage === "Scheduled" &&
    !getFirstScheduledEventDateTime(selectedCase.dateEvents ?? []),
  );
  const [caseEditScheduleHour = "", caseEditScheduleMinute = ""] = String(caseEditScheduleForm.eventTime || "").split(":");
  const caseEditScheduleMeridiem = caseEditScheduleHour ? (Number.parseInt(caseEditScheduleHour, 10) >= 12 ? "PM" : "AM") : "";
  const activeOutcomeType = caseEditForm?.outcome.outcomeType || selectedCase?.outcome.outcomeType || "";
  const showOutcomeAmountSettled = shouldShowAmountSettled(caseEditForm?.outcome.outcomeType || selectedCase?.outcome.outcomeType || "");
  const showOutcomeAmountAwarded = shouldShowAmountAwarded(activeOutcomeType);
  const outcomeAmountAwardedLabel = getAmountAwardedLabel(activeOutcomeType);
  const showOutcomeMisconductTypes = shouldShowDismissalMisconductTypes(
    activeOutcomeCaseType,
    activeOutcomeSubtype,
    activeOutcomeType,
  );
  const activeOutcomeMisconductTypes = caseEditForm?.outcome.misconductTypes || selectedCase?.outcome.misconductTypes || [];
  const normalizedOutcomeMisconductSearchValue = caseOutcomeMisconductSearchValue.trim().toLowerCase();
  const filteredOutcomeConductOffences = useMemo(() => {
    if (!normalizedOutcomeMisconductSearchValue) return conductOffences;
    return conductOffences.filter((offence) => offence.name.toLowerCase().includes(normalizedOutcomeMisconductSearchValue));
  }, [conductOffences, normalizedOutcomeMisconductSearchValue]);
  const outcomeMisconductSelectionLabel =
    activeOutcomeMisconductTypes.length === 0
      ? "Select misconduct type(s)"
      : activeOutcomeMisconductTypes.length === 1
        ? activeOutcomeMisconductTypes[0]
        : `${activeOutcomeMisconductTypes.length} misconduct type(s) selected`;

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
  const loadClientOptions = useCallback(async () => {
    if (hasLoadedClientOptionsRef.current) return;
    const { data, error } = await (supabase as any)
      .from("clients")
      .select("id,registered_name,company_type,trading_as,status")
      .or("status.is.null,status.eq.active")
      .eq("deleted", false)
      .order("created_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false, nullsFirst: false });
    if (error) {
      setClientOptions([]);
      setClientLoadMessage(`Unable to load clients: ${error.message}`);
      return;
    }
    const mapped = (data ?? []).map((c: any) => {
      const registered = String(c.registered_name ?? "").trim();
      const trading = String(c.trading_as ?? "").trim();
      const companyType = String(c.company_type ?? "").trim();
      return {
        id: c.id,
        label: buildMatterClientLabel(registered, companyType, trading),
      };
    });
    const valid = mapped.filter((c) => c.label.trim().length > 0);
    hasLoadedClientOptionsRef.current = true;
    if (valid.length > 0) {
      setClientOptions(valid);
      setClientLoadMessage("No clients found.");
      return;
    }
    setClientOptions([]);
    setClientLoadMessage("No clients found.");
  }, []);
  const loadConsultantOptions = useCallback(async () => {
    if (!user?.id || hasLoadedConsultantOptionsRef.current) return;
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
      .order("name", { ascending: true, nullsFirst: false })
      .order("surname", { ascending: true, nullsFirst: false });
    (Array.isArray(subusers) ? subusers : []).forEach((row: any) => {
      const role = String(row?.role || "").trim().toLowerCase();
      const status = String(row?.status || "").trim().toLowerCase();
      if (role !== "consultant") return;
      if (status && status !== "accepted" && status !== "active") return;
      const fullName = `${String(row?.name || "").trim()} ${String(row?.surname || "").trim()}`.trim();
      addOption(String(row?.id || fullName), fullName || String(row?.email || "").trim());
    });

    hasLoadedConsultantOptionsRef.current = true;
    setConsultantOptions(options);
  }, [user?.id]);
  const resolveCurrentCompanyId = useCallback(async () => {
    if (!user?.id) return "";
    let { data: subuserData } = await (supabase as any)
      .from("subusers")
      .select("company_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!subuserData) {
      const email = String(user.email || "").trim().toLowerCase();
      if (email) {
        const fallback = await (supabase as any)
          .from("subusers")
          .select("company_id")
          .eq("email", email)
          .maybeSingle();
        subuserData = fallback.data;
      }
    }
    const subuserCompanyId = String((subuserData as any)?.company_id || "").trim();
    if (subuserCompanyId) return subuserCompanyId;
    const metadataCompanyId = String((user as any)?.user_metadata?.company_id || "").trim();
    if (metadataCompanyId) return metadataCompanyId;
    return user.id;
  }, [user]);
  const loadMentionOptions = useCallback(async () => {
    if (!user?.id || hasLoadedMentionOptionsRef.current) return;
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) {
      setMentionOptions([]);
      return;
    }
    const options: MentionOption[] = [];
    const seen = new Set<string>();
    const addMentionOption = (id: string, label: string) => {
      const safeLabel = String(label || "").trim();
      const token = toMentionToken(safeLabel);
      if (!safeLabel || !token) return;
      const dedupeKey = token.toLowerCase();
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      const recipientUserId = String(id || token).trim();
      options.push({
        id: recipientUserId,
        label: safeLabel,
        token,
        searchText: `${safeLabel} ${token}`.toLowerCase(),
        recipientUserId,
      });
    };

    const { data: masterProfiles } = await (supabase as any)
      .from("profiles")
      .select("id,auth_user_id,user_name,user_surname,user_email")
      .order("user_name", { ascending: true, nullsFirst: false })
      .order("user_surname", { ascending: true, nullsFirst: false });
    (Array.isArray(masterProfiles) ? masterProfiles : []).forEach((row: any) => {
      const fullName = `${String(row?.user_name || "").trim()} ${String(row?.user_surname || "").trim()}`.trim();
      addMentionOption(String(row?.auth_user_id || row?.id || fullName), fullName || String(row?.user_email || "").trim());
    });

    const { data: subusers } = await (supabase as any)
      .from("subusers")
      .select("id,auth_user_id,name,surname,email,status,company_id")
      .order("name", { ascending: true, nullsFirst: false })
      .order("surname", { ascending: true, nullsFirst: false });
    (Array.isArray(subusers) ? subusers : []).forEach((row: any) => {
      const status = String(row?.status || "").trim().toLowerCase();
      if (status && status !== "accepted" && status !== "active") return;
      const fullName = `${String(row?.name || "").trim()} ${String(row?.surname || "").trim()}`.trim();
      addMentionOption(String(row?.auth_user_id || row?.id || ""), fullName || String(row?.email || "").trim());
    });

    hasLoadedMentionOptionsRef.current = true;
    setMentionOptions(options);
  }, [resolveCurrentCompanyId, user?.id]);
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
  const canCurrentUserDeleteCases = useMemo(() => !currentUserSubuserRole.trim(), [currentUserSubuserRole]);
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
  const syncCaseFileTimelineSummary = useCallback(
    async (
      caseFileId: string,
      status: CaseFile["status"],
      currentStage: string,
      dateEvents: CaseDateEvent[],
      options?: { preserveExplicitStage?: boolean },
    ) => {
      const resolvedStage = resolveCurrentStage(currentStage, status, dateEvents, options);
      const nextDate = getCasePrimaryNextDate(dateEvents);
      const { error } = await (supabase as any)
        .from("case_files")
        .update({
          current_stage: resolvedStage,
          next_date: nextDate !== "--" ? nextDate : null,
        })
        .eq("id", caseFileId);
      if (error) throw error;
      return { currentStage: resolvedStage, nextDate };
    },
    [],
  );
  const fetchCaseDateEvents = useCallback(async (caseFileId: string) => {
    if (!caseFileId) return [];
    const { data, error } = await (supabase as any)
      .from("case_dates")
      .select("id,case_file_id,date_type,date_value,event_time,duration,description,event_label,created_by_name,created_at,updated_at")
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
          eventTime: parseCaseDateEventTime(row?.event_time, row?.description),
          duration: String(row?.duration || "1 hour"),
          createdByName: String(row?.created_by_name || ""),
          created_at: row?.created_at ? String(row.created_at) : null,
          updated_at: row?.updated_at ? String(row.updated_at) : null,
        }),
      ),
    );
    setSelectedCase((prev) => prev && prev.id === caseFileId ? {
      ...prev,
      dateEvents,
      nextDate: getCasePrimaryNextDate(dateEvents),
      currentStage: resolveCurrentStage(prev.currentStage, prev.status, dateEvents, {
        preserveExplicitStage: isReferralSubtype(prev.caseType, prev.subtype),
      }),
    } : prev);
    return dateEvents;
  }, []);
  const findMatterDateOverlap = useCallback(
    async (consultantName: string, events: MatterDateConflictInput[], excludeEventId?: string | null) => {
      const safeConsultant = String(consultantName || "").trim();
      const validEvents = events
        .map((event) => ({
          ...event,
          id: String(event.id || "").trim(),
          eventDate: String(event.eventDate || "").trim(),
          eventTime: String(event.eventTime || "").trim(),
          duration: String(event.duration || "").trim() || "1 hour",
        }))
        .filter((event) => event.eventDate && event.eventTime);

      if (!safeConsultant || validEvents.length === 0) return null;

      for (let leftIndex = 0; leftIndex < validEvents.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < validEvents.length; rightIndex += 1) {
          if (
            validEvents[leftIndex].eventDate === validEvents[rightIndex].eventDate &&
            doMatterDateIntervalsOverlap(validEvents[leftIndex], validEvents[rightIndex])
          ) {
            return { source: "draft" as const, date: validEvents[leftIndex].eventDate, time: validEvents[leftIndex].eventTime };
          }
        }
      }

      const dates = Array.from(new Set(validEvents.map((event) => event.eventDate)));
      const { data, error } = await (supabase as any)
        .from("case_dates")
        .select("id,date_value,event_time,duration,date_type,event_label,case_file_id,case_files!inner(id,file_number,client_name,consultant,status)")
        .in("date_value", dates);

      if (error) throw error;

      const excludedId = String(excludeEventId || "").trim();
      const safeConsultantKey = safeConsultant.toLowerCase();
      const existingEvents = (Array.isArray(data) ? data : [])
        .filter((row: any) => {
          if (excludedId && String(row?.id || "").trim() === excludedId) return false;
          const caseFile = Array.isArray(row?.case_files) ? row.case_files[0] : row?.case_files;
          const status = String(caseFile?.status || "").trim().toLowerCase();
          const consultant = String(caseFile?.consultant || "").trim().toLowerCase();
          return status === "active" && consultant === safeConsultantKey && String(row?.event_time || "").trim();
        })
        .map((row: any) => {
          const caseFile = Array.isArray(row?.case_files) ? row.case_files[0] : row?.case_files;
          return {
            id: String(row?.id || ""),
            eventDate: String(row?.date_value || ""),
            eventTime: parseCaseDateEventTime(row?.event_time),
            duration: String(row?.duration || "1 hour"),
            label: String(row?.event_label || row?.date_type || "Matter date"),
            fileNumber: String(caseFile?.file_number || ""),
          };
        });

      for (const nextEvent of validEvents) {
        const conflict = existingEvents.find((existingEvent) =>
          existingEvent.eventDate === nextEvent.eventDate && doMatterDateIntervalsOverlap(nextEvent, existingEvent),
        );
        if (conflict) {
          return {
            source: "existing" as const,
            date: conflict.eventDate,
            time: conflict.eventTime,
            label: conflict.label,
            fileNumber: conflict.fileNumber,
          };
        }
      }

      return null;
    },
    [],
  );
  const fetchCaseNotes = useCallback(async (caseFileId: string) => {
    if (!user?.id || !caseFileId) return [];
    setIsCaseNotesLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("case_notes")
        .select("*")
        .eq("case_file_id", caseFileId)
        .order("created_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      const notes = (data ?? []).map((row: any) => ({
        id: String(row.id || ""),
        case_file_id: String(row.case_file_id || caseFileId),
        note_date: String(row.note_date || row.created_at?.slice(0, 10) || ""),
        note_content: String(row.note_content || ""),
        note_user_name: String(row.note_user_name || ""),
        created_at: row.created_at ? String(row.created_at) : null,
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
  const fetchCaseDocuments = useCallback(async (caseFileId: string) => {
    if (!caseFileId) return [];
    setIsCaseDocumentsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("case_documents")
        .select("id,case_file_id,document_name,description,file_url,uploaded_by,created_at,updated_at")
        .eq("case_file_id", caseFileId)
        .order("created_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      const documents = (data ?? []).map((row: any) =>
        createCaseDocumentDraft({
          id: String(row?.id || ""),
          case_file_id: String(row?.case_file_id || caseFileId),
          documentName: String(row?.document_name || ""),
          description: String(row?.description || row?.document_name || ""),
          fileUrl: String(row?.file_url || ""),
          uploadedBy: String(row?.uploaded_by || ""),
          created_at: row?.created_at ? String(row.created_at) : null,
          updated_at: row?.updated_at ? String(row.updated_at) : null,
        }),
      );
      setSelectedCase((prev) => (prev && prev.id === caseFileId ? { ...prev, documents } : prev));
      return documents;
    } catch (error: any) {
      toast({ title: "Unable to load case documents", description: error?.message || "Load failed.", variant: "destructive" });
      return [];
    } finally {
      setIsCaseDocumentsLoading(false);
    }
  }, [toast]);

  const fetchCaseFiles = useCallback(async () => {
    if (caseFiles.length === 0) {
      setIsCaseFilesLoading(true);
    }
    const { data, error } = await (supabase as any)
      .from("case_files")
      .select(
        "id,user_id,client_id,file_number,client_name,parties,case_type,forum,next_date,consultant,status,priority,last_updated,updated_at,created_at,case_subtype,case_number,current_stage,short_description,client:clients(registered_name,company_type,trading_as)",
      )
      .eq("deleted", false)
      .order("created_at", { ascending: false, nullsFirst: false });

    if (error) {
      setIsCaseFilesLoading(false);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    const rows: any[] = Array.isArray(data) ? data : [];
    const caseFileIds = rows.map((row) => String(row?.id || "").trim()).filter(Boolean);
    const creatorIds = Array.from(new Set(rows.map((row) => String(row?.user_id || "").trim()).filter(Boolean)));
    const creatorNameById = new Map<string, string>();
    const dateEventsByCaseId = new Map<string, CaseDateEvent[]>();

    if (caseFileIds.length > 0) {
      const { data: caseDatesData, error: caseDatesError } = await (supabase as any)
        .from("case_dates")
        .select("id,case_file_id,date_type,date_value,event_time,duration,description,event_label,created_by_name,created_at,updated_at")
        .in("case_file_id", caseFileIds);

      if (caseDatesError) {
        setIsCaseFilesLoading(false);
        toast({ title: "Error", description: caseDatesError.message, variant: "destructive" });
        return;
      }

      (Array.isArray(caseDatesData) ? caseDatesData : []).forEach((dateRow: any) => {
        const caseFileId = String(dateRow?.case_file_id || "").trim();
        if (!caseFileId) return;
        const existing = dateEventsByCaseId.get(caseFileId) ?? [];
        existing.push(createCaseDateEventDraft({
          id: String(dateRow?.id || ""),
          case_file_id: caseFileId,
          eventType: String(dateRow?.date_type || ""),
          eventLabel: String(dateRow?.event_label || ""),
          eventDate: String(dateRow?.date_value || ""),
          eventTime: parseCaseDateEventTime(dateRow?.event_time, dateRow?.description),
          duration: String(dateRow?.duration || "1 hour"),
          createdByName: String(dateRow?.created_by_name || ""),
          created_at: dateRow?.created_at ? String(dateRow.created_at) : null,
          updated_at: dateRow?.updated_at ? String(dateRow.updated_at) : null,
        }));
        dateEventsByCaseId.set(caseFileId, existing);
      });
    }

    if (creatorIds.length > 0) {
      const [profilesResult, subusersResult] = await Promise.all([
        (supabase as any)
          .from("profiles")
          .select("id,user_name,user_surname,user_email")
          .in("id", creatorIds),
        (supabase as any)
          .from("subusers")
          .select("auth_user_id,name,surname,email")
          .in("auth_user_id", creatorIds),
      ]);

      (Array.isArray(profilesResult.data) ? profilesResult.data : []).forEach((row: any) => {
        const id = String(row?.id || "").trim();
        const fullName = `${String(row?.user_name || "").trim()} ${String(row?.user_surname || "").trim()}`.trim() || String(row?.user_email || "").trim();
        if (id && fullName) creatorNameById.set(id, fullName);
      });

      (Array.isArray(subusersResult.data) ? subusersResult.data : []).forEach((row: any) => {
        const id = String(row?.auth_user_id || "").trim();
        const fullName = `${String(row?.name || "").trim()} ${String(row?.surname || "").trim()}`.trim() || String(row?.email || "").trim();
        if (id && fullName) creatorNameById.set(id, fullName);
      });
    }

    const mapped: CaseFile[] = rows.map((row) => {
      const persistedNextDate = row.next_date ?? "--";
      const normalizedStatus = normalizeStatus(row.status ?? "Active");
      const createdById = String(row.user_id || "").trim();
      const dateEvents = sortCaseDateEvents(dateEventsByCaseId.get(String(row.id || "").trim()) ?? []);
      const resolvedClientLabel = getMatterClientLabelFromRelation(row.client);
      return {
        id: row.id,
        createdById,
        createdByName: creatorNameById.get(createdById) || "Unknown User",
        clientId: row.client_id ?? "",
        fileNo: row.file_number ?? "--",
        client: resolvedClientLabel || row.client_name || "--",
        parties: row.parties ?? "--",
        caseType: row.case_type ?? "--",
        forumVenue: row.forum ?? "--",
        nextDate: getCaseTableDisplayDate(dateEvents, persistedNextDate),
        consultant: row.consultant ?? "--",
        status: normalizedStatus,
        priority: normalizePriority(row.priority),
        lastUpdated: toIsoDate(row.last_updated ?? row.updated_at ?? row.created_at ?? new Date().toISOString()),
        caseTitle: row.parties ?? "--",
        subtype: row.case_type === "Hearing"
          ? String(normalizeHearingSubtype(String(row.case_subtype ?? "--")))
          : row.case_subtype ?? "--",
        caseNumber: row.case_number ?? "--",
        employerRepresentative: "--",
        currentStage: String(row.current_stage || "").trim() || resolveCurrentStage("--", normalizedStatus, []),
        shortDescription: row.short_description ?? "--",
        dateEvents,
        notes: [],
        documents: [],
        tasks: [],
        outcome: {
          outcomeType: "Pending",
          outcomeDate: "--",
          misconductTypes: [],
          amountAwarded: "R 0.00",
          amountSettled: "R 0.00",
          closingNote: "--",
        },
      };
    });

    setCaseFiles(mapped);
    setIsCaseFilesLoading(false);
  }, [caseFiles.length, toast]);

  useEffect(() => {
    void fetchCurrentUserDisplayName();
  }, [fetchCurrentUserDisplayName]);
  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;

    const loadConductOffences = async () => {
      const { data, error } = await (supabase as any)
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
            const category = (offence.category as OffenceCategory | undefined) ?? sectionCategory ?? "Serious";
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

    void loadConductOffences();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);
  useEffect(() => {
    const state = (location.state as { openCaseId?: unknown; openCaseNoteId?: unknown } | null) ?? null;
    const openCaseId = String(state?.openCaseId ?? "").trim();
    if (!openCaseId || caseFiles.length === 0) return;
    const matchingCase = caseFiles.find((caseFile) => String(caseFile.id) === openCaseId);
    if (!matchingCase) return;
    setSelectedCase(matchingCase);
    const openCaseNoteId = String(state?.openCaseNoteId ?? "").trim();
    if (openCaseNoteId) {
      setPendingOpenCaseNoteId(openCaseNoteId);
      setActiveCaseTab("notes");
      return;
    }
    navigate("/case-files", { replace: true, state: {} });
  }, [caseFiles, location.state, navigate]);
  useEffect(() => {
    if (!pendingOpenCaseNoteId || !selectedCase?.id || isCaseNotesLoading) return;
    const matchingNote = (selectedCase.notes ?? []).find((note) => String(note?.id || "").trim() === pendingOpenCaseNoteId);
    if (!matchingNote) return;
    setActiveCaseTab("notes");
    openCaseNotePreviewDialog(String(matchingNote.note_content || ""), String(matchingNote.updated_at || ""));
    setPendingOpenCaseNoteId("");
    navigate("/case-files", { replace: true, state: {} });
  }, [isCaseNotesLoading, navigate, pendingOpenCaseNoteId, selectedCase?.id, selectedCase?.notes]);

  useEffect(() => {
    void fetchCaseFiles();
  }, [fetchCaseFiles]);
  useEffect(() => {
    const handleTrashBinChanged = () => {
      void fetchCaseFiles();
    };
    window.addEventListener("trash-bin-changed", handleTrashBinChanged);
    return () => window.removeEventListener("trash-bin-changed", handleTrashBinChanged);
  }, [fetchCaseFiles]);

  useEffect(() => {
    if (!isNewCaseDialogOpen) return;
    void loadClientOptions();
    void loadConsultantOptions();
    void loadMentionOptions();
  }, [isNewCaseDialogOpen, loadClientOptions, loadConsultantOptions, loadMentionOptions]);

  useEffect(() => {
    if (!isFiltersPanelOpen) {
      setExpandedFilterSection(null);
    }
  }, [isFiltersPanelOpen]);

  useEffect(() => {
    if (!isCaseEditMode && expandedFilterSection !== "consultant") return;
    void loadConsultantOptions();
  }, [expandedFilterSection, isCaseEditMode, loadConsultantOptions]);

  useEffect(() => {
    if (!isCaseNoteDialogOpen) return;
    void loadMentionOptions();
  }, [isCaseNoteDialogOpen, loadMentionOptions]);

  useEffect(() => {
    saveCachedCaseFiles(caseFiles);
  }, [caseFiles]);

  useEffect(() => {
    if (!selectedCase) {
      setActiveCaseTab("overview");
      setPendingOpenCaseNoteId("");
      setIsCaseEditMode(false);
      setCaseEditForm(null);
      return;
    }
    setActiveCaseTab(pendingOpenCaseNoteId ? "notes" : "overview");
    setIsCaseEditMode(false);
    setCaseEditForm(createCaseEditForm(selectedCase));
  }, [pendingOpenCaseNoteId, selectedCase?.id]);

  useEffect(() => {
    const loadSelectedCaseDetails = async () => {
      if (!selectedCase?.id) return;

      const [datesResponse, outcomeResponse, documentsResponse] = await Promise.all([
        fetchCaseDateEvents(selectedCase.id),
        (supabase as any)
          .from("case_outcomes")
          .select("outcome_type,outcome_date,misconduct_types,amount_awarded,amount_settled,closing_note,closed_by")
          .eq("case_file_id", selectedCase.id)
          .maybeSingle(),
        fetchCaseDocuments(selectedCase.id),
      ]);
      const dateEvents = datesResponse;
      const documents = documentsResponse;

      const outcomeRow = outcomeResponse.data;
      const formatOutcomeCurrency = (value: unknown) =>
        value === null || value === undefined || value === ""
          ? "R 0.00"
          : `R ${Number(value).toFixed(2)}`;

      const { data: noteRows, error: noteError } = await (supabase as any)
        .from("case_notes")
        .select("*")
        .eq("case_file_id", selectedCase.id)
        .order("created_at", { ascending: false, nullsFirst: false });
      if (noteError) throw noteError;
      const notes: CaseNote[] = (noteRows ?? []).map((row: any) => ({
        id: String(row.id || ""),
        case_file_id: String(row.case_file_id || selectedCase.id),
        note_date: String(row.note_date || row.created_at?.slice(0, 10) || ""),
        note_content: String(row.note_content || ""),
        note_user_name: String(row.note_user_name || ""),
        created_at: row.created_at ? String(row.created_at) : null,
        updated_at: row.updated_at ? String(row.updated_at) : null,
      }));

      const mergedCase: CaseFile = {
        ...selectedCase,
        nextDate: getCasePrimaryNextDate(dateEvents),
        currentStage: resolveCurrentStage(selectedCase.currentStage, selectedCase.status, dateEvents, {
          preserveExplicitStage: isReferralSubtype(selectedCase.caseType, selectedCase.subtype),
        }),
        dateEvents,
        notes,
        documents,
        outcome: outcomeRow
          ? {
              outcomeType: String(outcomeRow.outcome_type || "").trim() || "Pending",
              outcomeDate: String(outcomeRow.outcome_date || "").trim() || "--",
              misconductTypes: Array.isArray(outcomeRow.misconduct_types)
                ? outcomeRow.misconduct_types.map((value: unknown) => String(value || "").trim()).filter(Boolean)
                : [],
              amountAwarded: formatOutcomeCurrency(outcomeRow.amount_awarded),
              amountSettled: formatOutcomeCurrency(outcomeRow.amount_settled),
              closingNote: String(outcomeRow.closing_note || "").trim() || "--",
            }
          : selectedCase.outcome,
      };

      setSelectedCase(mergedCase);
      if (!isCaseEditMode) {
        setCaseEditForm(createCaseEditForm(mergedCase));
      }
    };

    void loadSelectedCaseDetails();
  }, [fetchCaseDateEvents, fetchCaseDocuments, selectedCase?.id]);

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
      eventTime: "",
      duration: "1 hour",
      createdByName: resolveCurrentUserName(),
    });
    setEditingCaseDateEventId(null);
  }, [resolveCurrentUserName]);
  const openAddCaseDateEventDialog = useCallback(() => {
    setEditingCaseDateEventId(null);
    setCaseDateEventForm({
      eventType: "",
      eventDate: "",
      eventTime: "",
      duration: "1 hour",
      createdByName: resolveCurrentUserName(),
    });
    setIsCaseDateDialogOpen(true);
  }, [resolveCurrentUserName]);
  const openEditCaseDateEventDialog = useCallback((event: CaseDateEvent) => {
    setEditingCaseDateEventId(event.id);
    setCaseDateEventForm({
      eventType: event.eventType || resolveCaseDateEventLabel(event),
      eventDate: event.eventDate || "",
      eventTime: event.eventTime || "",
      duration: event.duration || "1 hour",
      createdByName: event.createdByName || resolveCurrentUserName(),
    });
    setIsCaseDateDialogOpen(true);
  }, [resolveCurrentUserName]);
  const handleDeleteCaseDateEvent = useCallback(async (eventId: string) => {
    if (!selectedCase?.id) return;
    if (!window.confirm("Are you sure you want to delete this event?")) return;
    try {
      const { error } = await (supabase as any).from("case_dates").delete().eq("id", eventId).eq("case_file_id", selectedCase.id);
      if (error) throw error;
      const dateEvents = await fetchCaseDateEvents(selectedCase.id);
      await syncCaseFileTimelineSummary(selectedCase.id, selectedCase.status, selectedCase.currentStage, dateEvents, {
        preserveExplicitStage: isReferralSubtype(selectedCase.caseType, selectedCase.subtype),
      });
      invalidateDashboardWeeklyMattersCache();
      await fetchCaseFiles();
      toast({ title: "Success", description: "Matter date deleted." });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message ?? "Unable to delete matter date.", variant: "destructive" });
    }
  }, [fetchCaseDateEvents, fetchCaseFiles, selectedCase?.currentStage, selectedCase?.id, selectedCase?.status, syncCaseFileTimelineSummary, toast]);
  const handleSubmitCaseDateEventDialog = useCallback(async () => {
    if (!selectedCase?.id) return;
    const eventType = caseDateEventForm.eventType.trim();
    const eventDate = caseDateEventForm.eventDate.trim();
    const eventTime = caseDateEventForm.eventTime.trim();
    const duration = caseDateEventForm.duration.trim();
    const createdByName = caseDateEventForm.createdByName.trim() || resolveCurrentUserName();
    if (!eventType || !eventDate || !eventTime || !duration) {
      toast({ title: "Error", description: "Date, time, duration and description are required.", variant: "destructive" });
      return;
    }
    try {
      const conflict = await findMatterDateOverlap(
        selectedCase.consultant,
        [{ id: editingCaseDateEventId || "", eventDate, eventTime, duration }],
        editingCaseDateEventId,
      );
      if (conflict) {
        toast({
          title: "Schedule conflict",
          description: `${selectedCase.consultant} already has a matter event that overlaps this time${conflict.fileNumber ? ` (${conflict.fileNumber})` : ""}.`,
          variant: "destructive",
        });
        return;
      }

      if (editingCaseDateEventId) {
        const { error } = await (supabase as any)
          .from("case_dates")
          .update({
            date_type: eventType,
            event_label: null,
            date_value: eventDate,
            event_time: eventTime,
            duration,
            created_by_name: createdByName,
            description: null,
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
          event_time: eventTime,
          duration,
          created_by_name: createdByName,
          description: null,
        });
        if (error) throw error;
      }
      const dateEvents = await fetchCaseDateEvents(selectedCase.id);
      await syncCaseFileTimelineSummary(selectedCase.id, selectedCase.status, selectedCase.currentStage, dateEvents, {
        preserveExplicitStage: isReferralSubtype(selectedCase.caseType, selectedCase.subtype),
      });
      invalidateDashboardWeeklyMattersCache();
      await fetchCaseFiles();
      toast({ title: "Success", description: editingCaseDateEventId ? "Matter date updated." : "Matter date added." });
      setIsCaseDateDialogOpen(false);
      resetCaseDateEventForm();
    } catch (error: any) {
      toast({ title: "Error", description: error?.message ?? "Unable to save matter date.", variant: "destructive" });
    }
  }, [caseDateEventForm.createdByName, caseDateEventForm.duration, caseDateEventForm.eventDate, caseDateEventForm.eventTime, caseDateEventForm.eventType, editingCaseDateEventId, fetchCaseDateEvents, fetchCaseFiles, findMatterDateOverlap, resetCaseDateEventForm, resolveCurrentUserName, selectedCase?.consultant, selectedCase?.currentStage, selectedCase?.id, selectedCase?.status, syncCaseFileTimelineSummary, toast]);

  const handleCancelCaseEdit = () => {
    if (!selectedCase) return;
    setCaseEditForm(createCaseEditForm(selectedCase));
    setCaseEditScheduleForm({
      eventType: "",
      eventDate: "",
      eventTime: "",
      duration: "1 hour",
    });
    setIsCaseEditMode(false);
  };
  const handleCloseCase = async () => {
    if (!selectedCase?.id) return;
    if (selectedCase.status === "Inactive") return;
    const confirmed = window.confirm("Are you sure you want to close this case?");
    if (!confirmed) return;
    try {
      const closedByName = resolveCurrentUserName();
      const { error } = await (supabase as any)
        .from("case_files")
        .update({ status: "Inactive", current_stage: "Finalised" })
        .eq("id", selectedCase.id);
      if (error) throw error;
      const { error: outcomeCloseError } = await (supabase as any)
        .from("case_outcomes")
        .update({ closed_by: closedByName || null })
        .eq("case_file_id", selectedCase.id);
      if (outcomeCloseError) throw outcomeCloseError;
      const nextSelectedCase = { ...selectedCase, status: "Inactive" as const, currentStage: "Finalised" };
      setSelectedCase(nextSelectedCase);
      setCaseEditForm((prev) => prev ? { ...prev, status: "Inactive", currentStage: "Finalised" } : createCaseEditForm(nextSelectedCase));
      invalidateDashboardWeeklyMattersCache();
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
      let overviewDateEvents = selectedCase.dateEvents;
      let overviewNextDate = selectedCase.nextDate;
      if (activeCaseTab === "overview") {
        const scheduleEventType = caseEditScheduleForm.eventType.trim();
        const scheduleEventDate = caseEditScheduleForm.eventDate.trim();
        const scheduleEventTime = caseEditScheduleForm.eventTime.trim();
        const scheduleDuration = caseEditScheduleForm.duration.trim();
        if (caseEditNeedsScheduleDate && (!scheduleEventType || !scheduleEventDate || !scheduleEventTime || !scheduleDuration)) {
          throw new Error("Date, time, duration and event description are required when changing a matter to Scheduled.");
        }
        if (caseEditNeedsScheduleDate) {
          const conflict = await findMatterDateOverlap(
            caseEditForm.assignedConsultant.trim() || selectedCase.consultant,
            [{ id: "", eventDate: scheduleEventDate, eventTime: scheduleEventTime, duration: scheduleDuration }],
          );
          if (conflict) {
            throw new Error(`${caseEditForm.assignedConsultant.trim() || selectedCase.consultant} already has a matter event that overlaps this time${conflict.fileNumber ? ` (${conflict.fileNumber})` : ""}.`);
          }
        }
        const scheduleDraftEvent = caseEditNeedsScheduleDate
          ? createCaseDateEventDraft({
              eventType: scheduleEventType,
              eventDate: scheduleEventDate,
              eventTime: scheduleEventTime,
              duration: scheduleDuration,
              createdByName: resolveCurrentUserName(),
            })
          : null;
        const resolvedStage = resolveCurrentStage(
          caseEditForm.currentStage,
          caseEditForm.status,
          scheduleDraftEvent ? [...selectedCase.dateEvents, scheduleDraftEvent] : selectedCase.dateEvents,
          { preserveExplicitStage: isReferralSubtype(caseEditForm.caseType, caseEditForm.subtype) },
        );
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
        if (caseEditNeedsScheduleDate) {
          const { error: scheduleInsertError } = await (supabase as any).from("case_dates").insert({
            case_file_id: selectedCase.id,
            date_type: scheduleEventType,
            event_label: null,
            date_value: scheduleEventDate,
            event_time: scheduleEventTime,
            duration: scheduleDuration,
            created_by_name: resolveCurrentUserName(),
            description: null,
          });
          if (scheduleInsertError) throw scheduleInsertError;
          const dateEvents = await fetchCaseDateEvents(selectedCase.id);
          overviewDateEvents = dateEvents;
          overviewNextDate = getCasePrimaryNextDate(dateEvents);
          await syncCaseFileTimelineSummary(selectedCase.id, caseEditForm.status, resolvedStage, dateEvents, {
            preserveExplicitStage: isReferralSubtype(caseEditForm.caseType, caseEditForm.subtype),
          });
        }
      }

      if (activeCaseTab === "outcome") {
        const hasOutcomeValues = Boolean(
          caseEditForm.outcome.outcomeType.trim() ||
          caseEditForm.outcome.outcomeDate.trim() ||
          caseEditForm.outcome.misconductTypes.length > 0 ||
          caseEditForm.outcome.amountAwarded.trim() ||
          caseEditForm.outcome.amountSettled.trim() ||
          caseEditForm.outcome.closingNote.trim(),
        );

        if (!hasOutcomeValues) {
          const { error } = await (supabase as any).from("case_outcomes").delete().eq("case_file_id", selectedCase.id);
          if (error) throw error;
        } else {
          if (!caseEditForm.outcome.outcomeType.trim()) {
            throw new Error("Outcome Type is required when saving the Outcome tab.");
          }
          if (
            shouldShowDismissalMisconductTypes(caseEditForm.caseType.trim() || selectedCase.caseType, caseEditForm.subtype.trim() || selectedCase.subtype, caseEditForm.outcome.outcomeType) &&
            caseEditForm.outcome.misconductTypes.length === 0
          ) {
            throw new Error("At least one misconduct type is required when the disciplinary hearing outcome is Guilty - Dismissal.");
          }
          const payload = {
            case_file_id: selectedCase.id,
            outcome_type: caseEditForm.outcome.outcomeType.trim(),
            outcome_date: caseEditForm.outcome.outcomeDate.trim() || null,
            misconduct_types: shouldShowDismissalMisconductTypes(
              caseEditForm.caseType.trim() || selectedCase.caseType,
              caseEditForm.subtype.trim() || selectedCase.subtype,
              caseEditForm.outcome.outcomeType,
            )
              ? caseEditForm.outcome.misconductTypes
              : [],
            amount_awarded: shouldShowAmountAwarded(caseEditForm.outcome.outcomeType)
              ? parseCurrencyValue(caseEditForm.outcome.amountAwarded)
              : null,
            amount_settled: shouldShowAmountSettled(caseEditForm.outcome.outcomeType)
              ? parseCurrencyValue(caseEditForm.outcome.amountSettled)
              : null,
            closing_note: caseEditForm.outcome.closingNote.trim() || null,
          };
          const { error } = await (supabase as any)
            .from("case_outcomes")
            .upsert(payload, { onConflict: "case_file_id" });
          if (error) throw error;
        }
      }

      const resolvedOverviewStatus = activeCaseTab === "overview" ? caseEditForm.status : selectedCase.status;
      const resolvedOverviewStage = activeCaseTab === "overview"
        ? resolveCurrentStage(caseEditForm.currentStage, resolvedOverviewStatus, overviewDateEvents, {
            preserveExplicitStage: isReferralSubtype(caseEditForm.caseType, caseEditForm.subtype),
          })
        : resolveCurrentStage(selectedCase.currentStage, selectedCase.status, overviewDateEvents, {
            preserveExplicitStage: isReferralSubtype(selectedCase.caseType, selectedCase.subtype),
          });
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
        nextDate: overviewNextDate,
        dateEvents: overviewDateEvents,
        documents: selectedCase.documents,
        outcome: activeCaseTab === "outcome"
          ? {
              outcomeType: caseEditForm.outcome.outcomeType.trim() || "Pending",
              outcomeDate: caseEditForm.outcome.outcomeDate.trim() || "--",
              misconductTypes: shouldShowDismissalMisconductTypes(
                caseEditForm.caseType.trim() || selectedCase.caseType,
                caseEditForm.subtype.trim() || selectedCase.subtype,
                caseEditForm.outcome.outcomeType,
              )
                ? caseEditForm.outcome.misconductTypes
                : [],
              amountAwarded: caseEditForm.outcome.amountAwarded.trim() || "R 0.00",
              amountSettled: caseEditForm.outcome.amountSettled.trim() || "R 0.00",
              closingNote: caseEditForm.outcome.closingNote.trim() || "--",
            }
          : selectedCase.outcome,
      };
      invalidateDashboardWeeklyMattersCache();
      await fetchCaseFiles();
      setSelectedCase({ ...refreshedCase });
      setCaseEditForm(createCaseEditForm({ ...refreshedCase }));
      setCaseEditScheduleForm({
        eventType: "",
        eventDate: "",
        eventTime: "",
        duration: "1 hour",
      });
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
    setIsNewCaseTypeOpen(false);
    setIsNewCaseSubtypeOpen(false);
    setIsClientSelectOpen(false);
    setIsNewCaseTimeHourOpen(false);
    setIsNewCaseTimeMinuteOpen(false);
    setIsNewCaseDurationOpen(false);
    setIsNewCaseConsultantOpen(false);
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
    void loadClientOptions();
    void loadConsultantOptions();
    void loadMentionOptions();
  };

  const isSubtypeHidden = shouldHideSubtype(newCaseForm.caseType.trim());
  const subtypeOptions = getSubtypeOptions(newCaseForm.caseType.trim());
  const isNewCaseReferral = isReferralSubtype(newCaseForm.caseType.trim(), newCaseForm.subtype.trim());
  const isStepOneComplete = Boolean(
    newCaseForm.clientId.trim() &&
    newCaseForm.parties.trim() &&
    newCaseForm.caseType.trim() &&
    (isSubtypeHidden || newCaseForm.subtype.trim()) &&
    newCaseForm.shortDescription.trim(),
  );
  const primaryNewCaseDateEvent = newCaseForm.dateEvents[0] ?? createNewCasePrimaryDateEvent(resolveCurrentUserName());
  const [primaryNewCaseEventHour = "", primaryNewCaseEventMinute = ""] = String(primaryNewCaseDateEvent.eventTime || "").split(":");
  const primaryNewCaseEventMeridiem = primaryNewCaseEventHour ? (Number.parseInt(primaryNewCaseEventHour, 10) >= 12 ? "PM" : "AM") : "";
  const isStepTwoComplete = Boolean(
    newCaseForm.forumVenue.trim() &&
    (
      isNewCaseReferral ||
      (
        primaryNewCaseDateEvent.eventDate.trim() &&
        String(primaryNewCaseDateEvent.eventTime || "").trim() &&
        String(primaryNewCaseDateEvent.duration || "").trim() &&
        primaryNewCaseDateEvent.eventType.trim()
      )
    ),
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
    setNewCaseForm((prev) => {
      const hasMatchingEvent = prev.dateEvents.some((event) => event.id === eventId);
      if (!hasMatchingEvent) {
        return {
          ...prev,
          dateEvents: [
            createCaseDateEventDraft({
              id: eventId,
              createdByName: resolveCurrentUserName(),
              ...updates,
            }),
          ],
        };
      }
      return {
        ...prev,
        dateEvents: prev.dateEvents.map((event) => event.id === eventId ? { ...event, ...updates } : event),
      };
    });
  }, [resolveCurrentUserName]);

  const filteredCaseFiles = useMemo(() => {
    const today = new Date();
    return caseFiles
      .filter((item) => {
        const q = searchQuery.trim().toLowerCase();
        const matchesSearch =
          q.length === 0 ||
          item.client.toLowerCase().includes(q);
        const matchesStatus = statusFilter === "all" || item.status === statusFilter;
        const matchesType = caseTypeFilter === "all" || item.caseType === caseTypeFilter;
        const matchesConsultant = consultantFilter === "all" || item.consultant === consultantFilter;
        const next = item.nextDate ? new Date(item.nextDate) : null;
        const diffDays = next ? Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 9999;
        const matchesDate =
          nextDateFilter === "all" || (nextDateFilter === "next7" ? diffDays <= 7 : diffDays <= 30);
        return matchesSearch && matchesStatus && matchesType && matchesConsultant && matchesDate;
      })
      .sort((left, right) => getCaseFileDateSortValue(right.nextDate) - getCaseFileDateSortValue(left.nextDate));
  }, [caseFiles, caseTypeFilter, consultantFilter, nextDateFilter, searchQuery, statusFilter]);
  const caseFilesStatusSummaryLabel = statusFilter === "all" ? "matters" : `${statusFilter.toLowerCase()} matters`;
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
    if (!canCurrentUserDeleteCases) {
      toast({
        title: "Delete not allowed",
        description: "Only the master user can delete matters.",
        variant: "destructive",
      });
      return;
    }
    if (!window.confirm("Are you sure you want to move the selected matter(s) to the Trash Bin?")) return;
    const ids = Array.from(selectedCaseIds);
    const { error } = await (supabase as any)
      .from("case_files")
      .update({ deleted: true, deleted_at: new Date().toISOString() })
      .in("id", ids);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    if (selectedCase?.id && ids.includes(selectedCase.id)) {
      setSelectedCase(null);
    }
    setSelectedCaseIds(new Set());
    invalidateDashboardWeeklyMattersCache();
    await fetchCaseFiles();
    window.dispatchEvent(new CustomEvent("trash-bin-changed"));
    toast({
      title: "Matters moved to Trash Bin",
      description: `Moved ${ids.length} matter${ids.length === 1 ? "" : "s"} to the Trash Bin.`,
    });
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
      const newCaseIsReferral = isReferralSubtype(newCaseForm.caseType.trim(), newCaseForm.subtype.trim());
      const normalizedNewCaseDateEvents = newCaseIsReferral
        ? []
        : newCaseForm.dateEvents.map((event) => ({
            ...event,
            eventType: String(event.eventType || "").trim(),
            eventDate: String(event.eventDate || "").trim(),
            eventTime: String(event.eventTime || "").trim(),
            duration: String(event.duration || "").trim() || "1 hour",
            createdByName: String(event.createdByName || "").trim() || resolveCurrentUserName(),
          }));
      const validNewCaseDateEvents = normalizedNewCaseDateEvents
        .filter((event) => event.eventType || event.eventDate);
      const hasIncompleteNewCaseDateEvent = validNewCaseDateEvents.some((event) => !event.eventType || !event.eventDate || !event.eventTime || !event.duration);
      if (hasIncompleteNewCaseDateEvent) {
        throw new Error("Each matter date must include a date, time, duration and description.");
      }
      const conflict = await findMatterDateOverlap(newCaseForm.assignedConsultant.trim(), validNewCaseDateEvents);
      if (conflict) {
        throw new Error(`${newCaseForm.assignedConsultant.trim()} already has a matter event that overlaps this time${conflict.fileNumber ? ` (${conflict.fileNumber})` : ""}.`);
      }
      const nextActionDateForNewCase = getCasePrimaryNextDate(normalizedNewCaseDateEvents);
      const resolvedNewCaseStage = newCaseIsReferral
        ? "Referred"
        : resolveCurrentStage("Scheduled", newCaseForm.status, normalizedNewCaseDateEvents);
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

      const dateInserts: Array<{
        case_file_id: string;
        date_type: string;
        date_value: string;
        event_time?: string | null;
        duration?: string | null;
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
          event_time: event.eventTime || null,
          duration: event.duration || null,
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
          event_time: null,
          duration: null,
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
          event_time: null,
          duration: null,
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
          .select("id, note_content, note_user_name")
          .eq("case_file_id", caseFileId)
          .order("created_at", { ascending: true, nullsFirst: false });
        if (existingCaseNotesError) throw existingCaseNotesError;

        const autoCreatedShortDescriptionNote = (existingCaseNotes ?? []).find((row: any) => {
          const noteContent = String(row?.note_content || "").trim();
          const noteUserName = String(row?.note_user_name || "").trim();
          return noteContent === shortDescription && !noteUserName;
        });

        if (autoCreatedShortDescriptionNote?.id) {
          const { error: noteUpdateError } = await (supabase as any)
            .from("case_notes")
            .update({
              note_date: dateToday(),
              note_content: openingNote,
              note_user_name: creatorName,
            })
            .eq("id", autoCreatedShortDescriptionNote.id)
            .eq("case_file_id", caseFileId);
          if (noteUpdateError) throw noteUpdateError;
        } else {
          const { error: noteError } = await (supabase as any).from("case_notes").insert({
            case_file_id: caseFileId,
            note_date: dateToday(),
            note_content: openingNote,
            note_user_name: creatorName,
          });
          if (noteError) throw noteError;
        }
      }

      setIsNewCaseDialogOpen(false);
      setNewCaseForm(createBlankCaseForm());
      setNewCaseStep(1);
      invalidateDashboardWeeklyMattersCache();
      await fetchCaseFiles();
      toast({ title: "Success", description: "Case file created successfully." });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message ?? "Failed to create case file.", variant: "destructive" });
    } finally {
      setIsSavingCase(false);
    }
  };

  const newCaseDropdownItemStyle =
    "cursor-pointer text-[12.33px] font-medium text-slate-700 transition-transform duration-150 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[highlighted]:translate-x-[3px]";
  const newCaseDropdownContentStyle = "w-44 rounded-[4px] border-slate-200 p-1";
  const newCaseButtonStyle =
    "h-8 w-36 justify-between rounded-[4px] px-3 text-[12.33px] inline-flex items-center border border-[#3eca44] bg-[#3eca44] text-white hover:bg-[#34b73b] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0";
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
  const newMatterFloatingLabelClass = (isFloating: boolean) =>
    [
      "pointer-events-none absolute left-3 z-10 bg-white px-1 font-semibold text-slate-400 transition-all duration-150",
      isFloating
        ? "-top-1.5 translate-y-0 !text-[11.33px]"
        : "top-1/2 -translate-y-1/2 !text-[12.33px] group-focus-within:-top-1.5 group-focus-within:translate-y-0 group-focus-within:!text-[11.33px]",
    ].join(" ");
  const newMatterDropdownFloatingLabelClass = (isFloating: boolean) =>
    [
      "pointer-events-none absolute left-3 z-10 bg-white px-1 font-semibold text-slate-400 transition-all duration-150",
      isFloating ? "-top-1.5 translate-y-0 !text-[11.33px]" : "top-1/2 -translate-y-1/2 !text-[12.33px]",
    ].join(" ");
  const newMatterRaisedFloatingLabelClass = (isFloating: boolean) =>
    [
      "pointer-events-none absolute left-3 z-10 bg-white px-1 font-semibold leading-none text-slate-400 transition-all duration-150",
      isFloating
        ? "-top-[7px] translate-y-0 !text-[11.33px]"
        : "top-1/2 -translate-y-1/2 !text-[12.33px] group-focus-within:-top-[7px] group-focus-within:translate-y-0 group-focus-within:!text-[11.33px]",
    ].join(" ");
  const newMatterRaisedDropdownFloatingLabelClass = (isFloating: boolean) =>
    [
      "pointer-events-none absolute left-3 z-10 bg-white px-1 font-semibold leading-none text-slate-400 transition-all duration-150",
      isFloating ? "-top-[7px] translate-y-0 !text-[11.33px]" : "top-1/2 -translate-y-1/2 !text-[12.33px]",
    ].join(" ");
  const newMatterModalInputClass =
    "h-8 rounded border border-slate-200 bg-white !text-[12.33px] md:!text-[12.33px] font-medium text-slate-900 shadow-none placeholder:!text-[11.33px] placeholder:!text-slate-400 hover:border-blue-400 !focus-visible:border-[1px] !focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:bg-white disabled:text-slate-900 disabled:border-slate-200 disabled:opacity-100 disabled:cursor-default !h-[34px] !border-[0.5px] !border-slate-300 hover:!border-slate-500 focus:!border-black focus-visible:!border-black";
  const newMatterModalSelectClass =
    "h-8 rounded border border-slate-200 bg-white !text-[12.33px] md:!text-[12.33px] font-medium text-slate-900 shadow-none placeholder:!text-[11.33px] placeholder:!text-slate-400 hover:border-blue-400 !focus-visible:border-[1px] !focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:bg-white disabled:text-slate-900 disabled:border-slate-200 disabled:opacity-100 disabled:cursor-default justify-between data-[placeholder]:text-slate-400 data-[placeholder]:text-[11.33px] !h-[34px] !border-[0.5px] !border-slate-300 hover:!border-slate-500 focus:!border-black focus-visible:!border-black data-[state=open]:!border-black !ring-0 !ring-offset-0 !outline-none !shadow-none focus:!ring-0 focus:!ring-offset-0 focus:!shadow-none focus:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 focus-visible:!shadow-none focus-visible:!outline-none data-[state=open]:!ring-0 data-[state=open]:!ring-offset-0 data-[state=open]:!shadow-none data-[state=open]:!outline-none";
  const newMatterModalTextareaClass =
    "min-h-[76px] rounded border border-slate-200 bg-white !text-[12.33px] md:!text-[12.33px] font-medium text-slate-900 shadow-none placeholder:!text-[11.33px] placeholder:!text-slate-400 hover:border-blue-400 !focus-visible:border-[1px] !focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:bg-white disabled:text-slate-900 disabled:border-slate-200 disabled:opacity-100 disabled:cursor-default !border-[0.5px] !border-slate-300 hover:!border-slate-500 focus:!border-black focus-visible:!border-black";
  const newMatterShortDescriptionTextareaClass =
    "h-[34px] min-h-[34px] resize-none overflow-hidden rounded border border-slate-200 bg-white px-3 py-[7px] !text-[12.33px] md:!text-[12.33px] font-medium text-slate-900 shadow-none placeholder:!text-[11.33px] placeholder:!text-slate-400 hover:border-blue-400 !focus-visible:border-[1px] !focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:bg-white disabled:text-slate-900 disabled:border-slate-200 disabled:opacity-100 disabled:cursor-default !border-[0.5px] !border-slate-300 hover:!border-slate-500 focus:!border-black focus-visible:!border-black";
  const newMatterOpeningNoteTextareaClass =
    "h-[44px] min-h-[44px] resize-none overflow-hidden rounded border border-slate-200 bg-white px-3 py-3 !text-[12.33px] md:!text-[12.33px] font-medium leading-5 text-slate-900 shadow-none placeholder:!text-[11.33px] placeholder:!text-slate-400 hover:border-blue-400 !focus-visible:border-[1px] !focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:bg-white disabled:text-slate-900 disabled:border-slate-200 disabled:opacity-100 disabled:cursor-default !border-[0.5px] !border-slate-300 hover:!border-slate-500 focus:!border-black focus-visible:!border-black";
  const newMatterSelectItemClass =
    "text-[12.33px] text-slate-700 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[highlighted]:bg-[#3eca44]/10 data-[highlighted]:text-[#2f9f35] [&_svg]:!text-[#2f9f35]";
  const newMatterTimeSelectClass =
    "relative !h-[34px] !border-slate-300 !text-[11.33px] !justify-center !px-3 hover:!border-[#3eca44] focus:!border-[#3eca44] focus-visible:!border-[#3eca44] [&>span]:w-full [&>span]:text-center [&>span]:text-[11.33px] [&>span]:font-medium [&>svg]:absolute [&>svg]:right-3 data-[placeholder]:[&>span]:font-normal data-[placeholder]:[&>span]:text-slate-400";
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
      .filter((option) => !normalizedQuery || option.searchText.includes(normalizedQuery));
  }, [caseNoteMentionRange, mentionOptions, resolveCurrentUserName]);
  const filteredOpeningNoteMentionOptions = useMemo(() => {
    if (!openingNoteMentionRange) return [];
    const normalizedQuery = openingNoteMentionRange.query.replace(/^@/, "").trim().toLowerCase();
    const currentUserToken = toMentionToken(resolveCurrentUserName()).toLowerCase();
    return mentionOptions
      .filter((option) => option.token.toLowerCase() !== currentUserToken)
      .filter((option) => !normalizedQuery || option.searchText.includes(normalizedQuery));
  }, [mentionOptions, openingNoteMentionRange, resolveCurrentUserName]);

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
  const syncOpeningNoteMentionRange = useCallback((content: string, caretIndex: number) => {
    const nextRange = getActiveMentionMatch(content, caretIndex);
    setOpeningNoteMentionRange(nextRange);
    if (!nextRange || !openingNoteTextareaRef.current) {
      setOpeningNoteMentionPopupPosition(null);
      return;
    }
    const coords = getTextareaMentionPopupPosition(openingNoteTextareaRef.current, caretIndex);
    setOpeningNoteMentionPopupPosition({
      top: Math.max(8, coords.top + 28),
      left: Math.max(8, Math.min(coords.left + 12, Math.max(8, openingNoteTextareaRef.current.clientWidth - 220))),
    });
  }, []);
  const handleOpeningNoteContentChange = useCallback((value: string, caretIndex: number) => {
    setNewCaseForm((prev) => ({ ...prev, openingNote: value }));
    syncOpeningNoteMentionRange(value, caretIndex);
  }, [syncOpeningNoteMentionRange]);
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
  const insertOpeningNoteMention = useCallback((option: MentionOption) => {
    const textarea = openingNoteTextareaRef.current;
    const range = openingNoteMentionRange;
    if (!textarea || !range) return;
    const value = newCaseForm.openingNote;
    const mentionText = `@${option.token}`;
    const nextContent = `${value.slice(0, range.start)}${mentionText} ${value.slice(range.end)}`;
    const nextCaret = range.start + mentionText.length + 1;
    setNewCaseForm((prev) => ({ ...prev, openingNote: nextContent }));
    setOpeningNoteMentionRange(null);
    setOpeningNoteMentionPopupPosition(null);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCaret, nextCaret);
    });
  }, [newCaseForm.openingNote, openingNoteMentionRange]);
  const syncCaseNoteMentionNotifications = useCallback(async (noteId: string, noteContent: string, noteUserName: string) => {
    if (!selectedCase?.id || !user?.id || !noteId) return;
    const metadataCompanyId = String((user as any)?.user_metadata?.company_id || "").trim();
    const companyId = metadataCompanyId || user.id;
    const mentionRecipientOptions = await loadMentionRecipientsForTokens(extractMentionTokens(noteContent), companyId);
    const mentionRecipients = resolveMentionRecipients(noteContent, mentionRecipientOptions, user.id);
    const recipientIds = mentionRecipients.map((recipient) => String(recipient.recipientUserId || "").trim()).filter(Boolean);

    let cleanupQuery = (supabase as any)
      .from("notifications")
      .delete()
      .eq("source_table", "case_notes")
      .eq("source_record_id", noteId)
      .eq("actor_user_id", user.id);

    if (recipientIds.length > 0) {
      const recipientFilter = `(${recipientIds.map((id) => `"${id}"`).join(",")})`;
      cleanupQuery = cleanupQuery.not("recipient_user_id", "in", recipientFilter);
    }

    const { error: cleanupError } = await cleanupQuery;
    if (cleanupError) {
      console.error("Unable to clean up mention notifications for case note", cleanupError);
    }

    if (mentionRecipients.length === 0) return;

    const notificationRows = mentionRecipients.map((recipient) => ({
      recipient_user_id: recipient.recipientUserId,
      actor_user_id: user.id,
      actor_name: noteUserName,
      notification_type: "mention",
      title: "New mention",
      body: `${noteUserName} has tagged you in a matter.`,
      source_table: "case_notes",
      source_record_id: noteId,
      source_parent_id: selectedCase.id,
      metadata: {
        client_name: selectedCase.client,
        matter_type: selectedCase.caseType,
        note_preview: noteContent.slice(0, 200),
      },
    }));
    const { error: upsertError } = await (supabase as any)
      .from("notifications")
      .upsert(notificationRows, {
        onConflict: "recipient_user_id,notification_type,source_table,source_record_id",
      });
    if (upsertError) {
      console.error("Unable to sync mention notifications for case note", upsertError);
    }
  }, [selectedCase?.caseType, selectedCase?.client, selectedCase?.id, user]);

  const openAddCaseNoteDialog = () => {
    resetCaseNoteForm();
    setIsCaseNoteDialogOpen(true);
    void loadMentionOptions();
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
    void loadMentionOptions();
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
      let savedCaseNoteId = String(editingCaseNoteId || "").trim();
      if (editingCaseNoteId) {
        const baseContent = noteContent.replace(FILE_NOTE_EDIT_TAG_REGEX, "").trim();
        const now = new Date();
        const editedTag = `Edited by ${noteUserName} on ${formatDisplayDate(dateToday())} at ${formatDisplayTime(now)}`;
        const updatedContent = `${baseContent} ${editedTag}`.trim();
        const { error } = await (supabase as any)
          .from("case_notes")
          .update({
            note_content: updatedContent,
            note_user_name: noteUserName,
            note_date: noteDate,
          })
          .eq("id", editingCaseNoteId)
          .eq("case_file_id", selectedCase.id);
        if (error) throw error;
      } else {
        const { data: insertedCaseNote, error } = await (supabase as any)
          .from("case_notes")
          .insert({
            case_file_id: selectedCase.id,
            note_date: noteDate,
            note_content: noteContent,
            note_user_name: noteUserName,
          })
          .select("id")
          .single();
        if (error) throw error;
        savedCaseNoteId = String(insertedCaseNote?.id || "").trim();
      }

      if (savedCaseNoteId) {
        await syncCaseNoteMentionNotifications(savedCaseNoteId, noteContent, noteUserName);
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
    if (!window.confirm("Are you sure you want to delete this note?")) return;
    try {
      const { error } = await (supabase as any)
        .from("case_notes")
        .delete()
        .eq("id", noteId)
        .eq("case_file_id", selectedCase.id);
      if (error) throw error;
      const { error: notificationError } = await (supabase as any)
        .from("notifications")
        .delete()
        .eq("source_table", "case_notes")
        .eq("source_record_id", noteId)
        .eq("actor_user_id", user.id);
      if (notificationError) {
        console.error("Unable to delete mention notifications for case note", notificationError);
      }
      await fetchCaseNotes(selectedCase.id);
      toast({ title: "Case note deleted" });
    } catch (error: any) {
      toast({ title: "Unable to delete case note", description: error?.message || "Delete failed.", variant: "destructive" });
    }
  };
  const resetCaseDocumentForm = useCallback(() => {
    setCaseDocumentForm({
      ...createBlankCaseDocumentForm(),
      uploadedBy: resolveCurrentUserName(),
    });
    setCaseDocumentFile(null);
    setCaseDocumentFileName("");
    setEditingCaseDocument(null);
  }, [resolveCurrentUserName]);
  const openAddCaseDocumentDialog = useCallback(() => {
    resetCaseDocumentForm();
    setIsCaseDocumentDialogOpen(true);
  }, [resetCaseDocumentForm]);
  const openEditCaseDocumentDialog = useCallback((document: CaseDocument) => {
    setEditingCaseDocument(document);
    setCaseDocumentForm({
      description: document.description,
      uploadedBy: document.uploadedBy || resolveCurrentUserName(),
    });
    setCaseDocumentFile(null);
    setCaseDocumentFileName(document.documentName);
    setIsCaseDocumentDialogOpen(true);
  }, [resolveCurrentUserName]);
  const handleCaseDocumentFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setCaseDocumentFile(file);
    setCaseDocumentFileName(file?.name || "");
  }, []);
  const handleViewCaseDocument = useCallback(async (document: CaseDocument) => {
    const filePath = String(document.fileUrl || "").trim();
    if (!filePath) {
      toast({ title: "Unable to open document", description: "This document does not have a stored file path.", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase.storage.from(CASE_DOCUMENTS_BUCKET).createSignedUrl(filePath, 300);
    if (error || !data?.signedUrl) {
      toast({ title: "Unable to open document", description: error?.message || "Signed URL failed.", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }, [toast]);
  const handleSaveCaseDocument = useCallback(async () => {
    if (!selectedCase?.id || !user?.id) return;
    const description = caseDocumentForm.description.trim();
    const uploadedBy = caseDocumentForm.uploadedBy.trim() || resolveCurrentUserName();
    if (!description) {
      toast({ title: "Missing fields", description: "Description is required.", variant: "destructive" });
      return;
    }
    if (!editingCaseDocument && !caseDocumentFile) {
      toast({ title: "Missing fields", description: "Please upload a document.", variant: "destructive" });
      return;
    }
    setIsSavingCaseDocument(true);
    try {
      let nextFilePath = editingCaseDocument?.fileUrl || "";
      let nextDocumentName = editingCaseDocument?.documentName || "";
      if (caseDocumentFile) {
        const safeName = sanitizeStorageFileName(caseDocumentFile.name) || `document-${Date.now()}`;
        nextFilePath = `${selectedCase.id}/${Date.now()}-${safeName}`;
        nextDocumentName = caseDocumentFile.name;
        const { error: uploadError } = await supabase.storage.from(CASE_DOCUMENTS_BUCKET).upload(nextFilePath, caseDocumentFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: caseDocumentFile.type || "application/octet-stream",
        });
        if (uploadError) throw uploadError;
      }
      if (editingCaseDocument?.id) {
        const { error } = await (supabase as any)
          .from("case_documents")
          .update({
            description,
            document_name: nextDocumentName,
            file_url: nextFilePath,
            uploaded_by: uploadedBy,
            document_category: null,
          })
          .eq("id", editingCaseDocument.id)
          .eq("case_file_id", selectedCase.id);
        if (error) throw error;
        if (caseDocumentFile && editingCaseDocument.fileUrl && editingCaseDocument.fileUrl !== nextFilePath) {
          await supabase.storage.from(CASE_DOCUMENTS_BUCKET).remove([editingCaseDocument.fileUrl]);
        }
      } else {
        const { error } = await (supabase as any).from("case_documents").insert({
          case_file_id: selectedCase.id,
          description,
          document_name: nextDocumentName,
          file_url: nextFilePath,
          uploaded_by: uploadedBy,
          document_category: null,
        });
        if (error) throw error;
      }
      await fetchCaseDocuments(selectedCase.id);
      setIsCaseDocumentDialogOpen(false);
      resetCaseDocumentForm();
      toast({ title: "Success", description: editingCaseDocument ? "Document updated." : "Document uploaded." });
    } catch (error: any) {
      toast({ title: "Unable to save document", description: error?.message || "Save failed.", variant: "destructive" });
    } finally {
      setIsSavingCaseDocument(false);
    }
  }, [caseDocumentFile, caseDocumentForm.description, caseDocumentForm.uploadedBy, editingCaseDocument, fetchCaseDocuments, resetCaseDocumentForm, resolveCurrentUserName, selectedCase?.id, toast, user?.id]);
  const handleDeleteCaseDocument = useCallback(async (document: CaseDocument) => {
    if (!selectedCase?.id) return;
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    try {
      const { error } = await (supabase as any)
        .from("case_documents")
        .delete()
        .eq("id", document.id)
        .eq("case_file_id", selectedCase.id);
      if (error) throw error;
      if (document.fileUrl) {
        await supabase.storage.from(CASE_DOCUMENTS_BUCKET).remove([document.fileUrl]);
      }
      await fetchCaseDocuments(selectedCase.id);
      toast({ title: "Document deleted" });
    } catch (error: any) {
      toast({ title: "Unable to delete document", description: error?.message || "Delete failed.", variant: "destructive" });
    }
  }, [fetchCaseDocuments, selectedCase?.id, toast]);

  return (
    <>
      <div className="space-y-0 -m-6">
        <div className="overflow-hidden rounded-tl-sm border border-slate-300 border-l-0 border-r-0 bg-white shadow-sm h-[calc(100dvh-var(--app-header-height,5rem))] pb-0">
          <div className="flex h-full flex-col">
            <div className="pl-4 pr-4 pt-1">
              <div className="flex flex-col gap-4 pt-[10px] pb-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h1 className="text-4xl font-normal text-[#3eca44] -ml-1">Matters</h1>
                  <p className="text-xs text-slate-600 mt-2">Manage active legal matters, hearings, consultations and representation files.</p>
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
                            placeholder="Search matters..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`h-8 rounded-sm border border-slate-200 bg-white !text-[12.33px] font-medium shadow-sm transition-colors placeholder:!text-[12.33px] hover:border-[#3eca44] focus-visible:!border focus-visible:!border-black focus-visible:ring-0 group-hover:border-[#3eca44] ${searchQuery.trim().length > 0 ? "pr-20" : "pr-9"}`}
                          />
                          {searchQuery.trim().length > 0 ? (
                            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[12.33px] font-semibold text-slate-500 hover:text-[#2f9f35] hover:underline" onClick={() => setSearchQuery("")}>Clear</button>
                          ) : (
                            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                          )}
                        </div>
                        <p className="text-[11px] font-medium text-slate-500 whitespace-nowrap sm:self-end">
                          <span className="text-slate-900">{`${caseFilesTableRangeStart}-${caseFilesTableRangeEnd}`}</span> of {filteredCaseFiles.length} {caseFilesStatusSummaryLabel}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        {selectedCaseIds.size > 0 ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleDeleteSelectedCases}
                            className="h-8 w-24 rounded px-3 text-[12.33px] inline-flex items-center justify-center border border-rose-500 bg-white text-rose-600 hover:bg-rose-600 hover:text-white"
                          >
                            Delete ({selectedCaseIds.size})
                          </Button>
                        ) : null}
                        <DropdownMenu open={isFiltersPanelOpen} onOpenChange={(open) => { setIsFiltersPanelOpen(open); if (!open) setExpandedFilterSection(null); }}>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" className="h-8 w-24 justify-between rounded-[4px] px-3 text-[12.33px] inline-flex items-center border border-slate-200 bg-white transition-colors hover:border-[#3eca44] hover:bg-white hover:text-[#2f9f35] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:border-[#3eca44]">
                              <span>Filter</span>
                              <ChevronDown className={`h-4 w-4 transition-transform ${isFiltersPanelOpen ? "rotate-180" : ""}`} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" sideOffset={0} className="w-[260px] rounded-[4px] border border-slate-200 bg-white p-0 shadow-lg">
                            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                              <span className="text-[13.33px] font-semibold text-slate-800">Filter</span>
                              <button type="button" className="text-[11.33px] font-semibold uppercase tracking-wide text-[#2f9f35] hover:underline" onClick={() => { setStatusFilter("Active"); setCaseTypeFilter("all"); setConsultantFilter("all"); setNextDateFilter("all"); setIsFiltersPanelOpen(false); }}>
                                Clear
                              </button>
                            </div>
                            <div className="divide-y divide-slate-200">
                              {["status", "type", "consultant", "date"].map((section) => (
                                <div key={section}>
                                  <button type="button" className={`flex h-9 w-full items-center justify-between px-3 text-left text-[12.33px] font-semibold text-slate-800 hover:bg-slate-100 ${expandedFilterSection === section ? "bg-slate-100" : ""}`} onClick={() => setExpandedFilterSection((prev) => (prev === section ? null : section))}>
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
                                            className="flex h-8 w-full items-center justify-between text-[12.33px] text-slate-700 hover:bg-[#3eca44]/10 hover:text-[#2f9f35]"
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
                          </DropdownMenuContent>
                        </DropdownMenu>
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
                      <div className={cn("grid items-center gap-2 border-b bg-[#2D4256] pl-1 pr-3 py-3 text-xs font-semibold text-white", CASE_FILES_TABLE_GRID)}>
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
                        <div className="pl-2">File No.</div><div className="pl-2">Client</div><div className="pl-2">Parties</div><div className="text-center">Case Type</div><div className="text-center">Stage</div><div className="text-center">Date</div><div className="text-center">Created</div><div className="text-center">Assigned to</div>
                      </div>
                      <div className="employee-table-scroll min-h-0 flex-1 divide-y overflow-y-auto">
                        {isCaseFilesLoading ? (
                          <div className="px-4 py-6 text-xs text-slate-500">Loading case files...</div>
                        ) : filteredCaseFiles.length === 0 ? (
                          <div className="px-4 py-6 text-xs text-slate-500">No case files found.</div>
                        ) : (
                          paginatedCaseFiles.map((caseFile) => (
                            <div key={caseFile.id} className={cn("group grid h-[36px] w-full cursor-default items-center gap-2 pl-1 pr-3 text-left text-xs hover:bg-[#3eca44]/5 [&>*+*]:border-l [&>*+*]:border-slate-200 [&>*+*]:pl-2", CASE_FILES_TABLE_GRID)}>
                              <div className="flex items-center justify-center">
                                <Checkbox
                                  indicator="x"
                                  checked={selectedCaseIds.has(caseFile.id)}
                                  onCheckedChange={() => toggleSelectCase(caseFile.id)}
                                  aria-label={`Select ${caseFile.fileNo}`}
                                  className="h-3 w-3 rounded-[2px] border-slate-400 text-white data-[state=checked]:border-[#3eca44] data-[state=checked]:bg-[#3eca44]"
                                />
                              </div>
                              <button type="button" onClick={() => setSelectedCase(caseFile)} className="text-left group-hover:font-semibold hover:underline">{caseFile.fileNo}</button>
                              <div className="group-hover:font-semibold">{getMatterClientDisplayName(caseFile.client)}</div>
                              <div className="group-hover:font-semibold">{caseFile.parties}</div>
                              <div className="flex justify-center">
                                <Badge className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium shadow-none ${getCaseTypePillClassName(caseFile.caseType)}`}>
                                  {caseFile.caseType}
                                </Badge>
                              </div>
                              <div className="flex justify-center">
                                <Badge className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium shadow-none ${getCurrentStagePillClassName(caseFile.currentStage)}`}>
                                  {caseFile.currentStage}
                                </Badge>
                              </div>
                              <div className="text-center">{caseFile.nextDate === "--" ? "--" : formatShortDisplayDate(caseFile.nextDate)}</div>
                              <div className="flex min-w-0 items-center justify-center">
                                <span
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[9px] font-semibold text-slate-700"
                                  aria-label={caseFile.createdByName}
                                  title={caseFile.createdByName}
                                >
                                  {getInitials(caseFile.createdByName)}
                                </span>
                              </div>
                              <div className="flex justify-center">
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
      <DialogContent className="w-[94vw] max-w-[820px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden">
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
            <div className="mt-[46px] bg-white pb-6">
              <div className="flex h-14 items-center justify-center border-b border-slate-200 px-4">
                <div className="flex w-full justify-center overflow-x-auto">
                  <div className="mx-auto flex min-w-fit items-center gap-1">
                    {[{ step: 1 as const, label: "Case Identity" }, { step: 2 as const, label: "Forum & Dates" }, { step: 3 as const, label: "Allocation" }].map((item, index) => {
                      const isActive = newCaseStep === item.step;
                      const isComplete = item.step < newCaseStep;
                      const segmentClassName = [
                        "relative flex h-9 w-[182px] shrink-0 items-center px-3 text-[10px] font-semibold transition-colors",
                        isComplete ? "bg-[#31b236] text-white" : isActive ? "bg-[#2D4256] text-white" : "bg-slate-200 text-slate-500",
                        "cursor-pointer hover:brightness-95",
                      ].join(" ");
                      const segmentStyle = {
                        clipPath:
                          index === 0
                            ? "polygon(0 0, calc(100% - 24px) 0, 100% 50%, calc(100% - 24px) 100%, 0 100%, 18px 50%)"
                            : "polygon(0 0, calc(100% - 24px) 0, 100% 50%, calc(100% - 24px) 100%, 0 100%, 24px 50%)",
                      };

                      return (
                        <button
                          key={item.step}
                          type="button"
                          onClick={() => handleStepTrackerSelect(item.step)}
                          className={segmentClassName}
                          style={segmentStyle}
                        >
                          <span className="relative block h-full w-full">
                            <span
                              className={[
                                "absolute left-5 top-1/2 inline-flex h-6 w-6 shrink-0 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[9px] font-bold leading-none",
                                isComplete ? "text-[#31b236]" : isActive ? "text-[#2D4256]" : "text-slate-400",
                              ].join(" ")}
                            >
                              {isComplete ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : item.step}
                            </span>
                            <span
                              className={[
                                "absolute left-[56px] right-3 top-1/2 block -translate-y-1/2 truncate whitespace-nowrap text-left text-[10px] font-semibold",
                                isActive || isComplete ? "text-white" : "text-slate-500",
                              ].join(" ")}
                            >
                              {item.label}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="px-6 pt-5">
                <form
                className="space-y-4 [&_button>span.truncate]:text-[12.33px] [&_input]:!text-[12.33px] [&_input::placeholder]:!text-[11.33px] [&_span.pointer-events-none]:text-[11.33px] [&_[data-placeholder]]:!text-[11.33px] [&_[role=combobox]]:!text-[12.33px]"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreateCase();
                }}
              >
                <div className="h-[320px] space-y-4 overflow-y-auto pr-1 pt-2">
                  {newCaseStep === 1 && (
                    <div className="grid grid-cols-1 gap-x-4 gap-y-6 md:grid-cols-2">
                      <div className={`group relative space-y-1 ${isSubtypeHidden ? "md:col-span-2" : ""}`}>
                        <span className={newMatterDropdownFloatingLabelClass(Boolean(newCaseForm.caseType.trim()) || isNewCaseTypeOpen)}>
                          Case Type <span className="text-red-600">*</span>
                        </span>
                        <Select
                          value={newCaseForm.caseType || undefined}
                          onOpenChange={setIsNewCaseTypeOpen}
                          onValueChange={(value) =>
                            setNewCaseForm((p) => ({
                              ...p,
                              caseType: value,
                              subtype: getSubtypeValueForCaseType(value, p.subtype),
                              fileNumber: getNextFileNumber(value),
                            }))
                          }
                        >
                          <SelectTrigger className={`${newMatterModalSelectClass} ${addModalDropdownToneClass}`}><SelectValue /></SelectTrigger>
                          <SelectContent className="text-[12.33px]">{CASE_TYPE_OPTIONS.map((opt) => <SelectItem key={opt} value={opt} className={newMatterSelectItemClass}>{opt}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      {!isSubtypeHidden ? (
                        <div className="group relative space-y-1">
                          <span className={newMatterDropdownFloatingLabelClass(Boolean(newCaseForm.subtype.trim()) || isNewCaseSubtypeOpen)}>
                            Subtype <span className="text-red-600">*</span>
                          </span>
                          <Select
                            value={newCaseForm.subtype || undefined}
                            onOpenChange={setIsNewCaseSubtypeOpen}
                            onValueChange={(value) => setNewCaseForm((p) => ({
                              ...p,
                              subtype: value,
                              dateEvents: isReferralSubtype(p.caseType, value)
                                ? [createNewCasePrimaryDateEvent(resolveCurrentUserName())]
                                : p.dateEvents,
                            }))}
                          >
                            <SelectTrigger className={`${newMatterModalSelectClass} ${addModalDropdownToneClass}`}><SelectValue /></SelectTrigger>
                            <SelectContent className="text-[12.33px]">
                              {subtypeOptions.map((opt) => (
                                <SelectItem key={opt} value={opt} className={newMatterSelectItemClass}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}
                      <div className="group relative space-y-1 md:col-span-2">
                        <span className={newMatterDropdownFloatingLabelClass(Boolean(newCaseForm.clientName.trim()) || isClientSelectOpen)}>
                          Client <span className="text-red-600">*</span>
                        </span>
                        <Popover open={isClientSelectOpen} onOpenChange={setIsClientSelectOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className={`${newMatterModalSelectClass} ${addModalDropdownToneClass} w-full justify-between px-3 hover:bg-white hover:text-slate-700`}
                            >
                              <span className={`truncate text-left ${newCaseForm.clientName ? "" : "text-slate-400"}`}>
                                {newCaseForm.clientName}
                              </span>
                              <ChevronDown className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            className="w-[--radix-popover-trigger-width] p-0"
                            onWheelCapture={(event) => event.stopPropagation()}
                          >
                            <Command shouldFilter={false}>
                              <CommandInput
                                placeholder="Search client name..."
                                className="h-8 text-[12.33px] placeholder:text-[11.33px]"
                                value={clientSearchQuery}
                                onValueChange={setClientSearchQuery}
                              />
                              <CommandList className="max-h-[min(420px,var(--radix-popover-content-available-height))] overflow-y-auto overscroll-contain">
                                <CommandEmpty className="py-3 text-[12.33px] text-slate-500 px-2 text-center">{clientLoadMessage}</CommandEmpty>
                                <CommandGroup>
                                  {filteredClientOptions.map((client) => (
                                    <CommandItem
                                      key={client.id}
                                      value={client.label}
                                      className="text-[12.33px] text-slate-700 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[selected=true]:bg-[#3eca44]/10 data-[selected=true]:text-[#2f9f35]"
                                      onSelect={() => {
                                        setNewCaseForm((prev) => ({ ...prev, clientId: client.id, clientName: client.label }));
                                        setClientSearchQuery("");
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
                      <div className="group relative space-y-1 md:col-span-2">
                        <span className={newMatterFloatingLabelClass(Boolean(newCaseForm.parties.trim()))}>
                          Parties <span className="text-red-600">*</span>
                        </span>
                        <Input className={newMatterModalInputClass} value={newCaseForm.parties} onChange={(e) => setNewCaseForm((p) => ({ ...p, parties: e.target.value }))} />
                      </div>
                      <div className="group relative space-y-1 md:col-span-2">
                        <span className={newMatterFloatingLabelClass(Boolean(newCaseForm.shortDescription.trim()))}>
                          Short Description <span className="text-red-600">*</span>
                        </span>
                        <Textarea
                          ref={newCaseShortDescriptionTextareaRef}
                          rows={1}
                          className={newMatterShortDescriptionTextareaClass}
                          value={newCaseForm.shortDescription}
                          onChange={(e) => setNewCaseForm((p) => ({ ...p, shortDescription: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}

                  {newCaseStep === 2 && (
                    <div className="grid grid-cols-1 gap-x-4 gap-y-6 md:grid-cols-2">
                      <div className="group relative space-y-1">
                        <span className={newMatterFloatingLabelClass(Boolean(newCaseForm.forumVenue.trim()))}>
                          Forum / Venue <span className="text-red-600">*</span>
                        </span>
                        <Input className={newMatterModalInputClass} value={newCaseForm.forumVenue} onChange={(e) => setNewCaseForm((p) => ({ ...p, forumVenue: e.target.value }))} />
                      </div>
                      {!isNewCaseReferral ? (
                        <>
                          <div className="group relative space-y-1">
                            <span className={newMatterFloatingLabelClass(Boolean(primaryNewCaseDateEvent.eventDate.trim()))}>
                              Date <span className="text-red-600">*</span>
                            </span>
                            <Input
                              className={newMatterModalInputClass}
                              type="text"
                              readOnly
                              value={primaryNewCaseDateEvent.eventDate ? formatDisplayDate(primaryNewCaseDateEvent.eventDate) : ""}
                              onClick={() => openDatePicker(newCaseDateEventInputRefs.current[primaryNewCaseDateEvent.id] ?? null)}
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
                              onChange={(e) => {
                                const value = e.target.value;
                                updateNewCaseDateEventRow(primaryNewCaseDateEvent.id, { eventDate: value });
                                void warnIfSouthAfricanPublicHoliday(value);
                              }}
                              className="sr-only"
                              aria-hidden="true"
                              tabIndex={-1}
                            />
                          </div>
                          <div className="grid items-end grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 md:col-span-2">
                            <div className="grid items-end grid-cols-[minmax(0,1fr)_minmax(0,1fr)_60px] gap-2">
                              <div className="relative space-y-1">
                                <span className={newMatterDropdownFloatingLabelClass(Boolean(primaryNewCaseEventHour) || isNewCaseTimeHourOpen)}>
                                  Time (Hour) <span className="text-red-600">*</span>
                                </span>
                                <Select
                                  value={primaryNewCaseEventHour || undefined}
                                  onOpenChange={setIsNewCaseTimeHourOpen}
                                  onValueChange={(value) => updateNewCaseDateEventRow(primaryNewCaseDateEvent.id, { eventTime: `${value}:${primaryNewCaseEventMinute || "00"}` })}
                                >
                                  <SelectTrigger
                                    className={cn(
                                      newMatterModalSelectClass,
                                      addModalDropdownToneClass,
                                      newMatterTimeSelectClass,
                                    )}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="text-[11.33px]">
                                    {HEARING_TIME_HOUR_OPTIONS.map((hour) => (
                                      <SelectItem key={hour} value={hour} className="text-[11.33px]">
                                        {hour}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="relative space-y-1">
                                <span className={newMatterDropdownFloatingLabelClass(Boolean(primaryNewCaseEventMinute) || isNewCaseTimeMinuteOpen)}>
                                  Time (Minute) <span className="text-red-600">*</span>
                                </span>
                                <Select
                                  value={primaryNewCaseEventMinute || undefined}
                                  onOpenChange={setIsNewCaseTimeMinuteOpen}
                                  onValueChange={(value) => updateNewCaseDateEventRow(primaryNewCaseDateEvent.id, { eventTime: `${primaryNewCaseEventHour || "00"}:${value}` })}
                                >
                                  <SelectTrigger
                                    className={cn(
                                      newMatterModalSelectClass,
                                      addModalDropdownToneClass,
                                      newMatterTimeSelectClass,
                                    )}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="text-[11.33px]">
                                    {HEARING_TIME_MINUTE_OPTIONS.map((minute) => (
                                      <SelectItem key={minute} value={minute} className="text-[11.33px]">
                                        {minute}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <div className="flex h-[34px] items-center justify-center rounded-sm border border-slate-300 bg-slate-50 text-[11.33px] font-semibold text-slate-600">
                                  {primaryNewCaseEventMeridiem || "AM/PM"}
                                </div>
                              </div>
                            </div>
                            <div className="relative space-y-1">
                              <span className={newMatterDropdownFloatingLabelClass(Boolean(primaryNewCaseDateEvent.duration.trim()) || isNewCaseDurationOpen)}>
                                Duration <span className="text-red-600">*</span>
                              </span>
                              <Select
                                value={primaryNewCaseDateEvent.duration || undefined}
                                onOpenChange={setIsNewCaseDurationOpen}
                                onValueChange={(value) => updateNewCaseDateEventRow(primaryNewCaseDateEvent.id, { duration: value })}
                              >
                                <SelectTrigger className={`${newMatterModalSelectClass} ${addModalDropdownToneClass}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="text-[12.33px]">
                                  {MATTER_DATE_DURATION_OPTIONS.map((option) => (
                                    <SelectItem key={option} value={option} className={newMatterSelectItemClass}>{option}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="group relative space-y-1 md:col-span-2">
                            <span className={newMatterFloatingLabelClass(Boolean(primaryNewCaseDateEvent.eventType.trim()))}>
                              Event Description <span className="text-red-600">*</span>
                            </span>
                            <Input
                              className={newMatterModalInputClass}
                              value={primaryNewCaseDateEvent.eventType}
                              onChange={(e) => updateNewCaseDateEventRow(primaryNewCaseDateEvent.id, { eventType: e.target.value, createdByName: primaryNewCaseDateEvent.createdByName || resolveCurrentUserName() })}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="md:col-span-2" />
                      )}
                    </div>
                  )}

                  {newCaseStep === 3 && (
                    <div className="grid grid-cols-1 gap-x-4 gap-y-6 md:grid-cols-2">
                      <div className="relative space-y-1 md:col-span-2">
                        <span className={newMatterDropdownFloatingLabelClass(Boolean(newCaseForm.assignedConsultant.trim()) || isNewCaseConsultantOpen)}>
                          Assigned Consultant <span className="text-red-600">*</span>
                        </span>
                        <Select value={newCaseForm.assignedConsultant || undefined} onOpenChange={setIsNewCaseConsultantOpen} onValueChange={(value) => setNewCaseForm((p) => ({ ...p, assignedConsultant: value }))}>
                          <SelectTrigger className={`${newMatterModalSelectClass} ${addModalDropdownToneClass}`}><SelectValue /></SelectTrigger>
                          <SelectContent className="text-[12.33px]">
                            {consultantOptions.map((opt) => <SelectItem key={opt.id} value={opt.label} className={newMatterSelectItemClass}>{opt.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="group relative space-y-1 md:col-span-2">
                        <span className={newMatterFloatingLabelClass(Boolean(newCaseForm.openingNote.trim()))}>
                          Opening Note <span className="text-red-600">*</span>
                        </span>
                        <Textarea
                          ref={openingNoteTextareaRef}
                          rows={2}
                          className={newMatterOpeningNoteTextareaClass}
                          value={newCaseForm.openingNote}
                          onChange={(e) => handleOpeningNoteContentChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
                          onInput={resizeOpeningNoteTextarea}
                          onClick={(e) => syncOpeningNoteMentionRange(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
                          onKeyUp={(e) => syncOpeningNoteMentionRange(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
                          onSelect={(e) => syncOpeningNoteMentionRange(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 grid grid-cols-3 items-center border-t border-dashed border-muted/60 pt-4">
                  <div className="justify-self-start">
                    {newCaseStep > 1 && (
                      <Button type="button" variant="outline" className="h-[28px] w-[84px] rounded border-[#3eca44] px-3 text-[13.33px] text-[#3eca44] hover:bg-transparent hover:text-[#3eca44]" onClick={() => setNewCaseStep((prev) => (prev === 1 ? prev : ((prev - 1) as NewCaseStep)))}>
                        Back
                      </Button>
                    )}
                  </div>
                  <div className="justify-self-center">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-[30px] rounded border-0 px-3 text-[13.33px] text-slate-500 shadow-none hover:bg-transparent hover:text-slate-600 hover:underline"
                      onClick={() => {
                        const nextForm = createBlankCaseForm();
                        nextForm.dateEvents = [createNewCasePrimaryDateEvent(resolveCurrentUserName())];
                        setNewCaseForm(nextForm);
                        setIsNewCaseTimeHourOpen(false);
                        setIsNewCaseTimeMinuteOpen(false);
                        setIsNewCaseDurationOpen(false);
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="justify-self-end">
                    {newCaseStep < 3 ? (
                      <Button type="button" className="h-[28px] w-[84px] rounded bg-[#3eca44] px-3 text-[13.33px] text-white hover:bg-[#34b73b]" onClick={handleNext} disabled={(newCaseStep === 1 && !isStepOneComplete) || (newCaseStep === 2 && !isStepTwoComplete)}>
                        Next
                      </Button>
                    ) : (
                      <Button type="submit" className="h-[30px] w-[120px] rounded bg-[#3eca44] px-3 text-[13.33px] text-white hover:bg-[#34b73b]" disabled={isSavingCase || !isStepOneComplete || !isStepTwoComplete || !isStepThreeComplete}>
                        {isSavingCase ? "Saving..." : "Submit"}
                      </Button>
                    )}
                  </div>
                </div>
                </form>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selectedCase && (
        <div className="fixed inset-0 z-50">
          <button type="button" className="absolute inset-0 bg-slate-900/65" aria-label="Close case details" onClick={() => setSelectedCase(null)} />
          <div className="absolute inset-0 flex items-center justify-center">
            <section className="relative z-10 w-[94vw] max-w-[1040px] h-[92vh] rounded-sm bg-[#2D4256] shadow-2xl overflow-hidden border-0">
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
                              {caseEditNeedsScheduleDate ? (
                                <div className="space-y-2 border-t border-slate-200 pt-3">
                                  <p className="text-[10px] font-semibold text-slate-500">Schedule Matter Date</p>
                                  <div className="grid grid-cols-1 gap-y-2 md:grid-cols-[minmax(130px,0.7fr)_minmax(220px,1.3fr)_minmax(130px,0.7fr)_minmax(220px,1.3fr)] md:items-center md:gap-x-6">
                                    <span className="contents">
                                      <p className="text-[10px] font-medium text-slate-500">Event Description <span className="text-red-600">*</span></p>
                                      <Input
                                        className={modalInputClass}
                                        value={caseEditScheduleForm.eventType}
                                        onChange={(e) => setCaseEditScheduleForm((prev) => ({ ...prev, eventType: e.target.value }))}
                                        placeholder="Type event description"
                                      />
                                    </span>
                                    <span className="contents">
                                      <p className="text-[10px] font-medium text-slate-500">Date <span className="text-red-600">*</span></p>
                                      <div>
                                        <Input
                                          className={modalInputClass}
                                          type="text"
                                          readOnly
                                          placeholder="Please select a date"
                                          value={caseEditScheduleForm.eventDate ? formatDisplayDate(caseEditScheduleForm.eventDate) : ""}
                                          onClick={() => openDatePicker(caseEditScheduleDateInputRef.current)}
                                          onFocus={() => openDatePicker(caseEditScheduleDateInputRef.current)}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              openDatePicker(caseEditScheduleDateInputRef.current);
                                            }
                                          }}
                                        />
                                        <input
                                          ref={caseEditScheduleDateInputRef}
                                          type="date"
                                          value={caseEditScheduleForm.eventDate}
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            setCaseEditScheduleForm((prev) => ({ ...prev, eventDate: value }));
                                            void warnIfSouthAfricanPublicHoliday(value);
                                          }}
                                          className="sr-only"
                                          aria-hidden="true"
                                          tabIndex={-1}
                                        />
                                      </div>
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 gap-y-2 md:grid-cols-[minmax(130px,0.7fr)_minmax(220px,1.3fr)_minmax(130px,0.7fr)_minmax(220px,1.3fr)] md:items-center md:gap-x-6">
                                    <span className="contents">
                                      <p className="text-[10px] font-medium text-slate-500">Time <span className="text-red-600">*</span></p>
                                      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_60px] gap-2">
                                        <Select
                                          value={caseEditScheduleHour || undefined}
                                          onValueChange={(value) => setCaseEditScheduleForm((prev) => ({ ...prev, eventTime: `${value}:${caseEditScheduleMinute || "00"}` }))}
                                        >
                                          <SelectTrigger className={`${modalSelectClass} ${addModalDropdownToneClass} !h-8 !border-slate-300 !text-[10px]`}>
                                            <SelectValue placeholder="Hour" />
                                          </SelectTrigger>
                                          <SelectContent className="text-[10px]">
                                            {HEARING_TIME_HOUR_OPTIONS.map((hour) => (
                                              <SelectItem key={hour} value={hour} className="text-[10px]">{hour}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Select
                                          value={caseEditScheduleMinute || undefined}
                                          onValueChange={(value) => setCaseEditScheduleForm((prev) => ({ ...prev, eventTime: `${caseEditScheduleHour || "00"}:${value}` }))}
                                        >
                                          <SelectTrigger className={`${modalSelectClass} ${addModalDropdownToneClass} !h-8 !border-slate-300 !text-[10px]`}>
                                            <SelectValue placeholder="Min" />
                                          </SelectTrigger>
                                          <SelectContent className="text-[10px]">
                                            {HEARING_TIME_MINUTE_OPTIONS.map((minute) => (
                                              <SelectItem key={minute} value={minute} className="text-[10px]">{minute}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <div className="flex h-8 items-center justify-center rounded-sm border border-slate-300 bg-slate-50 text-[10px] font-semibold text-slate-600">
                                          {caseEditScheduleMeridiem || "AM/PM"}
                                        </div>
                                      </div>
                                    </span>
                                    <span className="contents">
                                      <p className="text-[10px] font-medium text-slate-500">Duration <span className="text-red-600">*</span></p>
                                      <Select
                                        value={caseEditScheduleForm.duration || undefined}
                                        onValueChange={(value) => setCaseEditScheduleForm((prev) => ({ ...prev, duration: value }))}
                                      >
                                        <SelectTrigger className={`${modalSelectClass} ${addModalDropdownToneClass}`}>
                                          <SelectValue placeholder="Please select duration" />
                                        </SelectTrigger>
                                        <SelectContent className="text-[11px]">
                                          {MATTER_DATE_DURATION_OPTIONS.map((option) => (
                                            <SelectItem key={option} value={option} className={addModalSelectItemClass}>{option}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </span>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : <div className="space-y-3 text-xs"><div className={caseFileCardClass}><p className="mb-3 text-[13px] font-semibold text-slate-700 underline">Case Overview</p><div className="mt-2 space-y-2">{overviewReadOnlyRows.map((row, rowIndex) => <div key={rowIndex} className="grid grid-cols-1 gap-y-2 md:grid-cols-[minmax(130px,0.7fr)_minmax(220px,1.3fr)_minmax(130px,0.7fr)_minmax(220px,1.3fr)] md:items-center md:gap-x-6">{row.map(([label, value]) => <span key={String(label)} className="contents"><p className="text-[10px] font-medium text-slate-500">{label}</p>{label === "Client" ? <Tooltip><TooltipTrigger asChild><p className="text-[11px] font-medium text-slate-900 transition-colors hover:text-[#2f9f35]">{value}</p></TooltipTrigger><TooltipContent side="top" className="rounded border border-[#3eca44]/35 text-[9.84px] shadow-none">{selectedCaseClientFullName}</TooltipContent></Tooltip> : <p className="text-[11px] font-medium text-slate-900">{value}</p>}</span>)}</div>)}{isVisibleReadOnlyValue(overviewShortDescription) ? <div className="grid grid-cols-1 gap-y-2 md:grid-cols-[minmax(130px,0.7fr)_minmax(220px,1.3fr)_minmax(130px,0.7fr)_minmax(220px,1.3fr)] md:items-start md:gap-x-6"><p className="text-[10px] font-medium text-slate-500">Short Description</p><p className="text-[11px] font-medium text-slate-900 md:col-span-3">{overviewShortDescription}</p></div> : null}</div></div></div>}
                    </TabsContent>
                    <TabsContent value="dates" className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
                      <div className="space-y-0 text-xs">
                        <div className="mb-3 flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            className="h-8 w-[110px] rounded bg-[#3eca44] px-3 text-[11px] text-white hover:bg-[#34b73b]"
                            onClick={openAddCaseDateEventDialog}
                          >
                            Add Date
                          </Button>
                        </div>
                        <MatterDetailsTable
                          headerColumns={["Date", "Time", "Description", "Created By", "Actions"]}
                          gridClassName={MATTER_DETAILS_TABLE_GRID}
                          emptyState={<div className="px-2 py-3 text-[11px] text-slate-500">No case dates recorded yet.</div>}
                        >
                          {sortedSelectedCaseDateEvents.map((event) => (
                            <div key={event.id} className={cn("grid h-10 items-center gap-2 px-2 hover:bg-[#3eca44]/5", MATTER_DETAILS_TABLE_GRID)}>
                              <div className="flex min-w-0 items-center text-slate-700">{formatShortDisplayDate(event.eventDate)}</div>
                              <div className="flex min-w-0 items-center text-slate-700">{formatDisplayTime24WithMeridiem(event.eventTime)}</div>
                              <div className="flex min-w-0 items-center font-medium text-slate-900">{resolveCaseDateEventLabel(event)}</div>
                              <div className="flex min-w-0 items-center truncate">
                                <Badge className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-700 shadow-none hover:bg-slate-100 hover:text-slate-700">
                                  {event.createdByName || "--"}
                                </Badge>
                              </div>
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
                          ))}
                        </MatterDetailsTable>
                      </div>
                    </TabsContent>
                    <TabsContent value="notes" className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
                      <div className="space-y-0 text-xs">
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
                                className="h-8 w-[110px] rounded bg-[#3eca44] px-3 text-[11px] text-white hover:bg-[#34b73b]"
                                onClick={openAddCaseNoteDialog}
                              >
                                Add Note
                              </Button>
                            </div>
                            <MatterDetailsTable
                              headerColumns={["Date", "Time", "Description", "Created By", "Actions"]}
                              gridClassName={MATTER_DETAILS_TABLE_GRID}
                              emptyState={<div className="px-2 py-3 text-slate-500">No case notes found.</div>}
                            >
                              {filteredCaseNotes.map((note) => {
                                const { content } = splitFileNoteContentAndEditTag(String(note.note_content || ""));
                                return (
                                  <div key={note.id} className={cn("grid h-10 items-center gap-2 px-2 hover:bg-[#3eca44]/5", MATTER_DETAILS_TABLE_GRID)}>
                                    <div className="flex min-w-0 items-center text-slate-700">{formatShortDisplayDate(String(note.note_date || ""))}</div>
                                    <div className="flex min-w-0 items-center text-slate-700">{formatDisplayTime24WithMeridiem(note.created_at)}</div>
                                    <div className="flex min-w-0 items-center pr-2">
                                      <button
                                        type="button"
                                        className="block w-full overflow-hidden text-ellipsis whitespace-nowrap text-left text-slate-900 hover:text-[#2f9f35] hover:underline"
                                        onClick={() => openCaseNotePreviewDialog(String(note.note_content || ""), String(note.updated_at || ""))}
                                        dangerouslySetInnerHTML={{ __html: content ? renderInlineMentionHighlights(content) : "--" }}
                                      />
                                    </div>
                                    <div className="flex min-w-0 items-center truncate">
                                      <Badge className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-700 shadow-none hover:bg-slate-100 hover:text-slate-700">
                                        {String(note.note_user_name || "--")}
                                      </Badge>
                                    </div>
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
                              })}
                            </MatterDetailsTable>
                          </>
                        )}
                      </div>
                    </TabsContent>
                    <TabsContent value="documents" className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
                      <div className="space-y-0 text-xs">
                        <div className="mb-3 flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            className="h-8 w-[110px] rounded bg-[#3eca44] px-3 text-[11px] text-white hover:bg-[#34b73b]"
                            onClick={openAddCaseDocumentDialog}
                          >
                            Add Document
                          </Button>
                        </div>
                        <MatterDetailsTable
                          headerColumns={["Date", "Time", "Description", "Uploaded By", "Actions"]}
                          gridClassName={MATTER_DETAILS_TABLE_GRID}
                          emptyState={<div className="px-2 py-3 text-[11px] text-slate-500">No case documents uploaded yet.</div>}
                        >
                          {(selectedCase.documents ?? []).map((document) => (
                            <div key={document.id} className={cn("grid h-10 items-center gap-2 px-2 hover:bg-[#3eca44]/5", MATTER_DETAILS_TABLE_GRID)}>
                              <div className="flex min-w-0 items-center text-slate-700">{formatShortDisplayDate(String(document.created_at || ""))}</div>
                              <div className="flex min-w-0 items-center text-slate-700">{formatDisplayTime24WithMeridiem(document.created_at)}</div>
                              <div className="flex min-w-0 items-center font-medium text-slate-900">{document.description || "--"}</div>
                              <div className="flex min-w-0 items-center truncate">
                                <Badge className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-700 shadow-none hover:bg-slate-100 hover:text-slate-700">
                                  {document.uploadedBy || "--"}
                                </Badge>
                              </div>
                              <div className="min-w-0 flex items-center gap-2">
                                <button
                                  type="button"
                                  className="text-slate-500 hover:text-[#2f9f35]"
                                  onClick={() => void handleViewCaseDocument(document)}
                                  aria-label="View document"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  className="text-slate-500 hover:text-[#2f9f35]"
                                  onClick={() => openEditCaseDocumentDialog(document)}
                                  aria-label="Edit document"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  className="text-slate-500 hover:text-rose-600"
                                  onClick={() => void handleDeleteCaseDocument(document)}
                                  aria-label="Delete document"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </MatterDetailsTable>
                      </div>
                    </TabsContent>
                    <TabsContent value="outcome" className="mt-4">
                      {isCaseEditMode && caseEditForm ? (
                        <div className="space-y-3 text-xs">
                          <div className={caseFileCardClass}>
                            <p className="mb-3 text-[13px] font-semibold text-slate-700 underline">Case Outcome</p>
                            <div className="mt-2 space-y-2">
                              {[
                                { fields: [["Outcome Type", "outcomeType"], ["Outcome Date", "outcomeDate"]] },
                                showOutcomeMisconductTypes
                                  ? { fields: [["Misconduct Type(s)", "misconductTypes"]], fullWidth: true }
                                  : null,
                                showOutcomeAmountAwarded || showOutcomeAmountSettled
                                  ? { fields: [[showOutcomeAmountAwarded ? outcomeAmountAwardedLabel : "Amount Awarded", "amountAwarded"], ...(showOutcomeAmountSettled ? [["Amount Settled", "amountSettled"]] : [])] }
                                  : null,
                                { fields: [["Closing Note", "closingNote"]], fullWidth: true },
                              ].filter(Boolean).map((row, rowIndex) => (
                                <div key={rowIndex} className="grid grid-cols-1 gap-y-2 md:grid-cols-[minmax(130px,0.7fr)_minmax(220px,1.3fr)_minmax(130px,0.7fr)_minmax(220px,1.3fr)] md:items-center md:gap-x-6">
                                  {(row as { fields: string[][]; fullWidth?: boolean }).fields.map(([label, field]) => (
                                    <span key={String(field)} className={(row as { fullWidth?: boolean }).fullWidth ? "contents md:[&>*:nth-child(2)]:col-span-3" : "contents"}>
                                      <p className="text-[10px] font-medium text-slate-500">{label}</p>
                                      <div className={(row as { fullWidth?: boolean }).fullWidth ? "md:col-span-3" : ""}>
                                        {field === "outcomeType" ? (
                                          <Select value={caseEditForm.outcome.outcomeType || undefined} onValueChange={(value) => setCaseEditForm((prev) => prev ? { ...prev, outcome: { ...prev.outcome, outcomeType: value, misconductTypes: shouldShowDismissalMisconductTypes(prev.caseType, prev.subtype, value) ? prev.outcome.misconductTypes : [] } } : prev)}><SelectTrigger className={`${modalSelectClass} ${addModalDropdownToneClass}`}><SelectValue placeholder="Select outcome type" /></SelectTrigger><SelectContent className="text-[11px]">{activeOutcomeFlow.outcomeTypeOptions.map((opt) => <SelectItem key={opt} value={opt} className={addModalSelectItemClass}>{opt}</SelectItem>)}</SelectContent></Select>
                                        ) : field === "outcomeDate" ? (
                                          <div>
                                            <Input
                                              className={modalInputClass}
                                              type="text"
                                              readOnly
                                              placeholder="Please select a date"
                                              value={caseEditForm.outcome.outcomeDate ? formatDisplayDate(caseEditForm.outcome.outcomeDate) : ""}
                                              onClick={() => openDatePicker(caseOutcomeDateInputRef.current)}
                                              onFocus={() => openDatePicker(caseOutcomeDateInputRef.current)}
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                  e.preventDefault();
                                                  openDatePicker(caseOutcomeDateInputRef.current);
                                                }
                                              }}
                                            />
                                            <input
                                              ref={caseOutcomeDateInputRef}
                                              type="date"
                                              value={caseEditForm.outcome.outcomeDate}
                                              onChange={(e) => {
                                                const value = e.target.value;
                                                setCaseEditForm((prev) => prev ? { ...prev, outcome: { ...prev.outcome, outcomeDate: value } } : prev);
                                                void warnIfSouthAfricanPublicHoliday(value);
                                              }}
                                              className="sr-only"
                                              aria-hidden="true"
                                              tabIndex={-1}
                                            />
                                          </div>
                                        ) : field === "misconductTypes" ? (
                                          <div className="space-y-2">
                                            <Popover
                                              open={caseOutcomeMisconductOpen}
                                              onOpenChange={(open) => {
                                                if (!open) setCaseOutcomeMisconductSearchValue("");
                                                setCaseOutcomeMisconductOpen(open);
                                              }}
                                            >
                                              <PopoverTrigger asChild>
                                                <Button
                                                  type="button"
                                                  variant="outline"
                                                  role="combobox"
                                                  aria-expanded={caseOutcomeMisconductOpen}
                                                  className={cn(
                                                    modalInputClass,
                                                    "h-8 w-full justify-between px-3 text-[11px] font-medium hover:bg-white hover:text-slate-900 data-[state=open]:bg-white data-[state=open]:text-slate-900",
                                                    caseEditForm.outcome.misconductTypes.length === 0 && "text-[10px] text-slate-400",
                                                  )}
                                                >
                                                  <span className="truncate text-left">{outcomeMisconductSelectionLabel}</span>
                                                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                                                </Button>
                                              </PopoverTrigger>
                                              <PopoverContent
                                                align="start"
                                                className="flex max-h-[380px] w-[var(--radix-popover-trigger-width)] min-w-[420px] flex-col overflow-hidden p-0"
                                                onWheel={(event) => event.stopPropagation()}
                                              >
                                                <Command shouldFilter={false}>
                                                  <CommandInput
                                                    value={caseOutcomeMisconductSearchValue}
                                                    onValueChange={setCaseOutcomeMisconductSearchValue}
                                                    placeholder="Search misconduct types..."
                                                    className="h-8 text-[11px] placeholder:text-[10px]"
                                                  />
                                                  <CommandList className="max-h-[248px] overscroll-contain">
                                                    <CommandEmpty className="px-3 py-4 text-sm text-slate-500">{misconductLoadMessage}</CommandEmpty>
                                                    {offenceCategoryOrder.map((category) => {
                                                      const offences = filteredOutcomeConductOffences.filter((offence) => offence.category === category);
                                                      if (offences.length === 0) return null;
                                                      return (
                                                        <CommandGroup
                                                          key={category}
                                                          heading={offenceGroupLabel[category]}
                                                          className="px-1 [&_[cmdk-group-heading]]:border-b [&_[cmdk-group-heading]]:border-slate-200 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-slate-900"
                                                        >
                                                          {offences.map((offence) => {
                                                            const isSelected = caseEditForm.outcome.misconductTypes.includes(offence.name);
                                                            return (
                                                              <CommandItem
                                                                key={`${category}-${offence.name}`}
                                                                value={`${offenceGroupLabel[category]} ${offence.name}`}
                                                                onSelect={() =>
                                                                  setCaseEditForm((prev) =>
                                                                    prev
                                                                      ? {
                                                                          ...prev,
                                                                          outcome: {
                                                                            ...prev.outcome,
                                                                            misconductTypes: prev.outcome.misconductTypes.includes(offence.name)
                                                                              ? prev.outcome.misconductTypes.filter((item) => item !== offence.name)
                                                                              : [...prev.outcome.misconductTypes, offence.name],
                                                                          },
                                                                        }
                                                                      : prev,
                                                                  )
                                                                }
                                                                className={cn(
                                                                  "flex items-center justify-between gap-3 px-3 py-2 text-[10px]",
                                                                  isSelected ? "text-[#2f9f35]" : "text-slate-600",
                                                                )}
                                                              >
                                                                <p className={cn("min-w-0 truncate text-[10px] font-medium", isSelected ? "text-[#2f9f35]" : "text-slate-600")}>
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
                                                  {caseEditForm.outcome.misconductTypes.length > 0 ? (
                                                    <div className="flex flex-wrap gap-2">
                                                      {caseEditForm.outcome.misconductTypes.map((type) => (
                                                        <div
                                                          key={type}
                                                          className="inline-flex items-center gap-1.5 rounded-full border border-[#3eca44] bg-[#3eca44]/10 px-2.5 py-1 text-[10px] font-medium text-[#2f9f35]"
                                                        >
                                                          <span className="truncate">{type}</span>
                                                          <button
                                                            type="button"
                                                            aria-label={`Remove ${type}`}
                                                            onClick={() =>
                                                              setCaseEditForm((prev) =>
                                                                prev
                                                                  ? {
                                                                      ...prev,
                                                                      outcome: {
                                                                        ...prev.outcome,
                                                                        misconductTypes: prev.outcome.misconductTypes.filter((item) => item !== type),
                                                                      },
                                                                    }
                                                                  : prev,
                                                              )
                                                            }
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
                                          </div>
                                        ) : field === "closingNote" ? (
                                          <Textarea className={modalTextareaClass} value={caseEditForm.outcome.closingNote} onChange={(e) => setCaseEditForm((prev) => prev ? { ...prev, outcome: { ...prev.outcome, closingNote: e.target.value } } : prev)} />
                                        ) : (
                                          <Input className={modalInputClass} value={String((caseEditForm.outcome as any)[field] ?? "")} onChange={(e) => setCaseEditForm((prev) => prev ? { ...prev, outcome: { ...prev.outcome, [field]: e.target.value } } : prev)} placeholder={field === "amountAwarded" || field === "amountSettled" ? "R 0.00" : undefined} />
                                        )}
                                      </div>
                                    </span>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 text-xs">
                          <div className={caseFileCardClass}>
                            <p className="mb-3 text-[13px] font-semibold text-slate-700 underline">Case Outcome</p>
                            <div className="mt-2 space-y-2">
                              {[
                                [["Outcome Type", selectedCase.outcome.outcomeType], ["Outcome Date", selectedCase.outcome.outcomeDate]],
                                showOutcomeMisconductTypes
                                  ? [["Misconduct Type(s)", selectedCase.outcome.misconductTypes.join(", ")]]
                                  : null,
                                showOutcomeAmountAwarded || showOutcomeAmountSettled
                                  ? [[showOutcomeAmountAwarded ? outcomeAmountAwardedLabel : "Amount Awarded", selectedCase.outcome.amountAwarded], ...(showOutcomeAmountSettled ? [["Amount Settled", selectedCase.outcome.amountSettled]] : [])]
                                  : null,
                              ].map((row, rowIndex) => {
                                if (!row) return null;
                                const visibleFields = row.filter(([, value]) => isVisibleReadOnlyValue(value));
                                if (visibleFields.length === 0) return null;
                                return (
                                  <div key={rowIndex} className="grid grid-cols-1 gap-y-2 md:grid-cols-[minmax(130px,0.7fr)_minmax(220px,1.3fr)_minmax(130px,0.7fr)_minmax(220px,1.3fr)] md:items-center md:gap-x-6">
                                    {visibleFields.map(([label, value]) => (
                                      <span key={String(label)} className="contents">
                                        <p className="text-[10px] font-medium text-slate-500">{label}</p>
                                        <p className="text-[11px] font-medium text-slate-900">{label.toLowerCase().includes("date") ? formatDisplayDate(String(value)) : value}</p>
                                      </span>
                                    ))}
                                  </div>
                                );
                              })}
                              {isVisibleReadOnlyValue(selectedCase.outcome.closingNote) ? (
                                <div className="grid grid-cols-1 gap-y-2 md:grid-cols-[minmax(130px,0.7fr)_minmax(220px,1.3fr)_minmax(130px,0.7fr)_minmax(220px,1.3fr)] md:items-start md:gap-x-6">
                                  <p className="text-[10px] font-medium text-slate-500">Closing Note</p>
                                  <p className="text-[11px] font-medium text-slate-900 md:col-span-3">{selectedCase.outcome.closingNote}</p>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )}
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
                        <Button type="button" variant="outline" className="h-8 min-w-[92px] rounded text-[11px] border-slate-300 bg-white text-slate-700 hover:bg-white hover:border-[#3eca44] hover:text-[#2f9f35]" onClick={() => setIsCaseEditMode(true)}>Edit</Button>
                      ) : null}
                    </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
      <Dialog
        open={isCaseDocumentDialogOpen}
        onOpenChange={(open) => {
          setIsCaseDocumentDialogOpen(open);
          if (!open) resetCaseDocumentForm();
        }}
      >
        <DialogContent className="w-[94vw] max-w-[420px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <DialogTitle className="text-sm font-semibold text-white">{editingCaseDocument ? "Edit Case Document" : "Add Case Document"}</DialogTitle>
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
                placeholder="Type document description"
                value={caseDocumentForm.description}
                onChange={(e) => setCaseDocumentForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="relative space-y-1">
              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Upload Document</span>
              <Input
                className={`${modalInputClass} pt-2 file:mr-3 file:rounded file:border-0 file:bg-[#3eca44] file:px-3 file:py-1 file:text-[11px] file:font-medium file:text-white hover:file:bg-[#34b73b]`}
                type="file"
                onChange={handleCaseDocumentFileChange}
              />
              {caseDocumentFileName ? <p className="px-1 text-[10px] text-slate-500">{caseDocumentFileName}</p> : null}
            </div>
            <div className="relative space-y-1">
              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Uploaded By</span>
              <Input
                className={modalInputClass}
                value={caseDocumentForm.uploadedBy}
                readOnly
              />
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <Button type="button" variant="outline" className="h-8 w-[92px] rounded text-[11px] border-slate-300 bg-white text-slate-700 hover:bg-white hover:border-slate-400 hover:text-slate-800" onClick={() => setIsCaseDocumentDialogOpen(false)} disabled={isSavingCaseDocument}>
                Cancel
              </Button>
              <Button type="button" className="h-8 w-[92px] rounded bg-[#3eca44] px-3 text-[11px] text-white hover:bg-[#34b73b]" onClick={() => void handleSaveCaseDocument()} disabled={isSavingCaseDocument}>
                {isSavingCaseDocument ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
                onChange={(e) => {
                  const value = e.target.value;
                  setCaseDateEventForm((prev) => ({ ...prev, eventDate: value }));
                  void warnIfSouthAfricanPublicHoliday(value);
                }}
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
              />
            </div>
            <div className="relative space-y-1">
              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Time</span>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_60px] gap-2">
                <Select
                  value={(caseDateEventForm.eventTime.split(":")[0] || "") || undefined}
                  onValueChange={(value) => setCaseDateEventForm((prev) => ({ ...prev, eventTime: `${value}:${prev.eventTime.split(":")[1] || "00"}` }))}
                >
                  <SelectTrigger
                    className={cn(
                      modalSelectClass,
                      addModalDropdownToneClass,
                      "!h-8 !border-slate-300 !text-[10px] hover:!border-[#3eca44] focus:!border-[#3eca44] focus-visible:!border-[#3eca44] [&>span]:text-[10px] [&>span]:font-medium data-[placeholder]:[&>span]:font-normal data-[placeholder]:[&>span]:text-slate-400",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Clock3 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <SelectValue placeholder="Hour" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="text-[10px]">
                    {HEARING_TIME_HOUR_OPTIONS.map((hour) => (
                      <SelectItem key={hour} value={hour} className="text-[10px]">
                        {hour}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={(caseDateEventForm.eventTime.split(":")[1] || "") || undefined}
                  onValueChange={(value) => setCaseDateEventForm((prev) => ({ ...prev, eventTime: `${prev.eventTime.split(":")[0] || "00"}:${value}` }))}
                >
                  <SelectTrigger
                    className={cn(
                      modalSelectClass,
                      addModalDropdownToneClass,
                      "!h-8 !border-slate-300 !text-[10px] hover:!border-[#3eca44] focus:!border-[#3eca44] focus-visible:!border-[#3eca44] [&>span]:text-[10px] [&>span]:font-medium data-[placeholder]:[&>span]:font-normal data-[placeholder]:[&>span]:text-slate-400",
                    )}
                  >
                    <SelectValue placeholder="Min" />
                  </SelectTrigger>
                  <SelectContent className="text-[10px]">
                    {HEARING_TIME_MINUTE_OPTIONS.map((minute) => (
                      <SelectItem key={minute} value={minute} className="text-[10px]">
                        {minute}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex h-8 items-center justify-center rounded-sm border border-slate-300 bg-slate-50 text-[10px] font-semibold text-slate-600">
                  {caseDateEventForm.eventTime ? (Number.parseInt(caseDateEventForm.eventTime.split(":")[0] || "0", 10) >= 12 ? "PM" : "AM") : "AM/PM"}
                </div>
              </div>
            </div>
            <div className="relative space-y-1">
              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Duration</span>
              <Select
                value={caseDateEventForm.duration || undefined}
                onValueChange={(value) => setCaseDateEventForm((prev) => ({ ...prev, duration: value }))}
              >
                <SelectTrigger className={`${modalSelectClass} ${addModalDropdownToneClass}`}>
                  <SelectValue placeholder="Please select duration" />
                </SelectTrigger>
                <SelectContent className="text-[11px]">
                  {MATTER_DATE_DURATION_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option} className={addModalSelectItemClass}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                    className="absolute z-20 max-h-[220px] w-[220px] overflow-y-auto rounded border border-[#2D4256] bg-[#2D4256] shadow-lg"
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
    </>
  );
};

export default Matters;
