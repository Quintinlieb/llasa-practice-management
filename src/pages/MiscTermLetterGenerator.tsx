import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type SVGProps } from "react";
import { BriefcaseIcon, EnvelopeIcon, MapPinIcon, PhoneIcon as HeroPhoneIcon } from "@heroicons/react/24/outline";
import DashboardLayout from "@/components/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { southAfricanProvinces } from "@/lib/validation";
import { logGeneratedDocument } from "@/lib/documentsLog";
import { detectLogoLayout, getPdfLogoTargetHeight, type LogoLayout } from "@/lib/logoLayout";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
import { Building2, Check, ChevronDown, ChevronsUpDown, FileText, Pencil, Plus, Scale, Trash2, User2, X } from "lucide-react";

type MiscTermLetterGeneratorProps = {
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

type ClientRecord = {
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

type ClientLogoRecord = {
  storage_path?: string | null;
  logo_path?: string | null;
  logo_url?: string | null;
  company_logo_url?: string | null;
};

type LogoOrientation = "portrait" | "landscape";

type ClientStepState = {
  clientId: string;
  companyName: string;
  registeredName: string;
  tradingName: string;
  companyType: string;
  registrationNumber: string;
  phone: string;
  email: string;
  address: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  areaCode: string;
  logoUrl: string;
  logoOrientation: LogoOrientation | "";
};

type EmployeeStepState = {
  name: string;
  surname: string;
  addressLine1: string;
  city: string;
  province: string;
  areaCode: string;
};

type TerminationStepState = {
  hearingDate: string;
  misconductTypes: string[];
  progressiveDisciplinaryAction: "" | "Yes" | "No PDA applied";
  appealNotice: "3 days" | "5 days" | "7 days" | "10 days";
  issuingMethods: string[];
  disputeForum: "" | "ccma" | "bargaining_council";
  bargainingCouncil: string;
};

type OffenceCategory = "Minor" | "Serious" | "Dismissible";

type ConductOffence = {
  name: string;
  category: OffenceCategory;
  firstOutcome: string;
};

type MiscTermDraftState = {
  activeStep: number;
  client: ClientStepState;
  employee: EmployeeStepState;
  termination: TerminationStepState;
  preview?: {
    isPreviewEditable?: boolean;
    bodyParagraphEdits?: string[];
    customParagraphs?: Array<{
      id: string;
      text: string;
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

const steps = ["Client Details", "Employee Details", "Termination Details", "Preview / Download"] as const;
const stepIcons = [Building2, User2, Scale, FileText] as const;
const generatedDocumentsBucket = "documents";

const emptyClientState: ClientStepState = {
  clientId: "",
  companyName: "",
  registeredName: "",
  tradingName: "",
  companyType: "",
  registrationNumber: "",
  phone: "",
  email: "",
  address: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  province: "",
  areaCode: "",
  logoUrl: "",
  logoOrientation: "",
};

const emptyEmployeeState: EmployeeStepState = {
  name: "",
  surname: "",
  addressLine1: "",
  city: "",
  province: "",
  areaCode: "",
};

const emptyTerminationState: TerminationStepState = {
  hearingDate: "",
  misconductTypes: [],
  progressiveDisciplinaryAction: "",
  appealNotice: "5 days",
  issuingMethods: [],
  disputeForum: "",
  bargainingCouncil: "",
};

const fieldClassName =
  "h-8 rounded-sm border-slate-300 bg-white !text-[10px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] placeholder:font-normal placeholder:text-slate-400 hover:border-[#3eca44] focus-visible:border-[#3eca44] focus-visible:ring-0";
const hiddenScrollClassName =
  "overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";
const selectTriggerClassName = cn(
  fieldClassName,
  "!h-8 !border-slate-300 !text-[10px] hover:!border-[#3eca44] focus:!border-[#3eca44] focus-visible:!border-[#3eca44] [&>span]:text-[10px] [&>span]:font-medium data-[placeholder]:[&>span]:font-normal data-[placeholder]:[&>span]:text-slate-400",
);
const fallbackMisconductTypeOptions = [
  "Unauthorised Absenteeism",
  "Poor Time Keeping",
  "Sleeping On Duty",
  "Using Phone on Duty",
  "Gross Insolence",
  "Insubordination",
  "Negligence",
  "Gross Negligence",
  "Dishonesty",
  "Fraud",
  "Theft",
  "Assault",
  "Intimidation",
  "Abusive Language",
  "Damage to Property",
  "Breach of Safety Rule",
  "Alcohol or Drug Misuse",
  "Conflict of Interest",
] as const;

const progressiveDisciplinaryActionOptions = ["Yes", "No PDA applied"] as const;
const appealNoticeOptions = ["3 days", "5 days", "7 days", "10 days"] as const;
const issuingMethodOptions = ["By Hand", "By Email", "By Registered Post", "By Regular Post", "By WhatsApp", "By Facebook"] as const;
const disputeForumOptions = [
  { label: "CCMA", value: "ccma" },
  { label: "Bargaining Council", value: "bargaining_council" },
] as const;
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
const offenceCategoryOrder: OffenceCategory[] = ["Minor", "Serious", "Dismissible"];

const formatDateForDisplay = (value: string) => {
  const trimmed = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return "";
  const [year, month, day] = trimmed.split("-");
  return `${day}/${month}/${year}`;
};

const formatLongDate = (value: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const date = new Date(trimmed.includes("T") ? trimmed : `${trimmed}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};

const createPdfIconDataUrl = (
  draw: (ctx: CanvasRenderingContext2D) => void,
  options?: { size?: number; strokeColor?: string },
): string | null => {
  if (typeof document === "undefined" || typeof Path2D === "undefined") return null;
  const size = options?.size ?? 24;
  const strokeColor = options?.strokeColor ?? "#000000";
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  draw(ctx);

  return canvas.toDataURL("image/png");
};

const createPdfPhoneIconDataUrl = (strokeColor = "#000000") =>
  createPdfIconDataUrl((ctx) => {
    const path = new Path2D(
      "M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z",
    );
    ctx.stroke(path);
  }, { strokeColor });

const createPdfMailIconDataUrl = (strokeColor = "#000000") =>
  createPdfIconDataUrl((ctx) => {
    const x = 2;
    const y = 4;
    const width = 20;
    const height = 16;
    const radius = 2;

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width / 2, y + height / 2 + 1);
    ctx.lineTo(x + width, y);
    ctx.stroke();
  }, { strokeColor });

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

const trimLogoWhitespace = (dataUrl: string): Promise<string> =>
  new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";

    image.onload = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (!width || !height) {
        resolve(dataUrl);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(dataUrl);
        return;
      }

      let pixels: Uint8ClampedArray;
      try {
        context.drawImage(image, 0, 0, width, height);
        pixels = context.getImageData(0, 0, width, height).data;
      } catch {
        resolve(dataUrl);
        return;
      }

      const findBounds = (ignoreNearWhite: boolean) => {
        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;

        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const index = (y * width + x) * 4;
            const red = pixels[index];
            const green = pixels[index + 1];
            const blue = pixels[index + 2];
            const alpha = pixels[index + 3];

            if (alpha <= 20) continue;
            if (ignoreNearWhite && red >= 245 && green >= 245 && blue >= 245) continue;

            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }

        if (maxX < 0 || maxY < 0) return null;
        return { minX, minY, maxX, maxY };
      };

      let bounds = findBounds(true);
      if (!bounds) bounds = findBounds(false);
      if (!bounds) {
        resolve(dataUrl);
        return;
      }

      const padding = 0;
      const cropX = Math.max(0, bounds.minX - padding);
      const cropY = Math.max(0, bounds.minY - padding);
      const cropWidth = Math.min(width - cropX, bounds.maxX - bounds.minX + 1 + padding * 2);
      const cropHeight = Math.min(height - cropY, bounds.maxY - bounds.minY + 1 + padding * 2);

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

    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });

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

const buildClientAddress = (record: ClientRecord) =>
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

const buildClientName = (record: ClientRecord) => {
  const registeredName = String(record.registered_name || "").trim();
  const tradingName = String(record.trading_as || "").trim();
  const companyType = String(record.company_type || "").trim();
  const officialName = registeredName ? mergeCompanyType(registeredName, companyType) : "";

  if (
    officialName &&
    tradingName &&
    tradingName.toLowerCase() !== registeredName.toLowerCase() &&
    tradingName.toLowerCase() !== officialName.toLowerCase()
  ) {
    return `${officialName} t/a ${tradingName}`;
  }

  return officialName || tradingName || "Unnamed client";
};

const deriveLogoUrl = (record?: ClientLogoRecord | null) => {
  const storagePath = String(record?.storage_path || record?.logo_path || "").trim();
  if (storagePath) {
    const { data } = supabase.storage.from("client-logos").getPublicUrl(storagePath);
    return String(data?.publicUrl || "").trim();
  }

  return String(record?.logo_url || record?.company_logo_url || "").trim();
};

const inferLogoOrientation = (url: string) =>
  new Promise<LogoOrientation>((resolve) => {
    if (typeof Image === "undefined") {
      resolve("landscape");
      return;
    }

    const image = new Image();
    image.onload = () => resolve(image.naturalWidth >= image.naturalHeight ? "landscape" : "portrait");
    image.onerror = () => resolve("landscape");
    image.src = url;
  });

const mapClientRecordToState = (record: ClientRecord): ClientStepState => ({
  clientId: record.id,
  companyName: buildClientName(record),
  registeredName: String(record.registered_name || "").trim(),
  tradingName: String(record.trading_as || "").trim(),
  companyType: String(record.company_type || "").trim(),
  registrationNumber: String(record.registration_number || "").trim(),
  phone: String(record.primary_number || "").trim(),
  email: String(record.primary_email || "").trim(),
  address: buildClientAddress(record),
  addressLine1: String(record.physical_address_line1 || "").trim(),
  addressLine2: String(record.physical_address_line2 || "").trim(),
  city: String(record.city || "").trim(),
  province: String(record.province || "").trim(),
  areaCode: String(record.area_code || "").trim(),
  logoUrl: "",
  logoOrientation: "",
});

const isDraftState = (value: unknown): value is MiscTermDraftState => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.activeStep === "number";
};

const normalizeClientDraft = (value: unknown): ClientStepState => ({
  ...emptyClientState,
  ...((value && typeof value === "object" ? value : {}) as Partial<ClientStepState>),
});

const normalizeEmployeeDraft = (value: unknown): EmployeeStepState => ({
  ...emptyEmployeeState,
  ...((value && typeof value === "object" ? value : {}) as Partial<EmployeeStepState>),
});

const normalizeTerminationDraft = (value: unknown): TerminationStepState => {
  const candidate = (value && typeof value === "object" ? value : {}) as Partial<TerminationStepState>;
  return {
    ...emptyTerminationState,
    ...candidate,
    misconductTypes: Array.isArray(candidate.misconductTypes)
      ? candidate.misconductTypes.map((item) => String(item || "").trim()).filter(Boolean)
      : [],
    issuingMethods: Array.isArray(candidate.issuingMethods)
      ? candidate.issuingMethods.map((item) => String(item || "").trim()).filter(Boolean)
      : [],
  };
};

const normalizePreviewBodyEdits = (value: unknown) =>
  Array.isArray(value) ? value.map((item) => String(item || "")) : [];

const normalizeCustomPreviewParagraphs = (value: unknown) => {
  if (!Array.isArray(value)) return [] as Array<{ id: string; text: string; insertAfterId: string | null }>;
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    const id = String(candidate.id || "").trim();
    const text = String(candidate.text || "").trim();
    const insertAfterId = candidate.insertAfterId == null ? null : String(candidate.insertAfterId);
    if (!id || !text) return [];
    return [{ id, text, insertAfterId }];
  });
};

const formatMisconductList = (values: string[]) => {
  const items = values.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean);
  if (items.length === 0) return "[misconduct]";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
};

const getDisputeForumText = (termination: TerminationStepState) => {
  if (termination.disputeForum === "bargaining_council") {
    const councilName = termination.bargainingCouncil.trim();
    return councilName ? `the ${councilName}` : "the bargaining council";
  }
  return "the CCMA";
};

const buildMiscTermBodyParagraphs = (termination: TerminationStepState) => {
  const hearingDateDisplay = formatLongDate(termination.hearingDate) || "[hearing date]";
  const misconductSummary = formatMisconductList(termination.misconductTypes);
  const appealNoticeDisplay = termination.appealNotice || "5 days";
  const usesPda = termination.progressiveDisciplinaryAction === "Yes";
  const disputeForumText = getDisputeForumText(termination);

  return [
    `The abovementioned matter refers and the disciplinary hearing held on ${hearingDateDisplay}.`,
    `After considering the statements and/or evidence presented at the disciplinary hearing, you were found guilty of misconduct relating to ${misconductSummary}.`,
    usesPda
      ? `Take notice that we are implementing progressive disciplinary action and your employment is hereby terminated summarily for misconduct relating to ${misconductSummary}. You are required to return all company property in your possession to the employer immediately.`
      : `Take notice that your employment is hereby terminated summarily for misconduct relating to ${misconductSummary}. You are required to return all company property in your possession to the employer immediately.`,
    `You may appeal against this decision to terminate your employment within ${appealNoticeDisplay.replace(" days", "")} days from the date of this termination letter, in accordance with the company's disciplinary procedures. Alternatively, you may refer a dispute to ${disputeForumText} within thirty (30) days from the date of termination.`,
    "We trust you find the above in order and wish you well in your future endeavours.",
  ];
};

const AddParagraphDivider = ({ onClick }: { onClick: () => void }) => (
  <div className="flex justify-center py-1">
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded border border-dashed border-slate-300 px-3 py-1.5 text-[11px] font-medium text-slate-500 transition-colors hover:border-[#3eca44] hover:text-[#2f9f35]"
    >
      <Plus className="h-3.5 w-3.5" />
      Add paragraph here
    </button>
  </div>
);

const MiscTermPreview = ({
  client,
  employee,
  termination,
  bodyParagraphs,
  isEditable,
  editingParagraphId,
  paragraphDraft,
  addingAfterId,
  newParagraphDraft,
  onParagraphEditStart,
  onParagraphDraftChange,
  onParagraphEditSave,
  onParagraphEditCancel,
  onAddParagraphStart,
  onAddParagraphDraftChange,
  onAddParagraphSave,
  onAddParagraphCancel,
  onDeleteCustomParagraph,
}: {
  client: ClientStepState;
  employee: EmployeeStepState;
  termination: TerminationStepState;
  bodyParagraphs: Array<{ id: string; text: string; isCustom?: boolean }>;
  isEditable: boolean;
  editingParagraphId: string | null;
  paragraphDraft: string;
  addingAfterId: string | null | undefined;
  newParagraphDraft: string;
  onParagraphEditStart: (id: string, text: string) => void;
  onParagraphDraftChange: (value: string) => void;
  onParagraphEditSave: () => void;
  onParagraphEditCancel: () => void;
  onAddParagraphStart: (afterId: string | null) => void;
  onAddParagraphDraftChange: (value: string) => void;
  onAddParagraphSave: () => void;
  onAddParagraphCancel: () => void;
  onDeleteCustomParagraph: (id: string) => void;
}) => {
  const currentDateDisplay = formatLongDate(new Date().toISOString()) || formatLongDate(String(new Date()));
  const employeeFullName = [employee.name, employee.surname].map((value) => value.trim()).filter(Boolean).join(" ");
  const employeeLocationLine = [employee.city.trim(), employee.province.trim()].filter(Boolean).join(", ");
  const employeeAddressLines = [employee.addressLine1.trim(), employeeLocationLine, employee.areaCode.trim()].filter(Boolean);
  const clientLocationLine = [client.city.trim(), client.province.trim()].filter(Boolean).join(", ");
  const registeredNameDisplay = client.registeredName.trim()
    ? mergeCompanyType(client.registeredName.trim(), client.companyType.trim())
    : "";
  const companyInfoRows = [
    { key: "registered", icon: null, text: registeredNameDisplay, bold: true },
    { key: "trading", icon: null, text: client.tradingName.trim() ? `t/a ${client.tradingName.trim()}` : "" },
    { key: "address1", icon: null, text: client.addressLine1.trim() },
    { key: "address2", icon: null, text: client.addressLine2.trim() },
    { key: "location", icon: null, text: clientLocationLine },
    { key: "areaCode", icon: null, text: client.areaCode.trim() },
    { key: "phone", icon: HeroPhoneIcon, text: client.phone.trim() },
    { key: "email", icon: EnvelopeIcon, text: client.email.trim() },
  ].filter((item) => item.text);
  return (
    <div className="h-full overflow-y-auto py-1">
      <div className="mx-auto w-full max-w-[820px] rounded-sm bg-white px-8 py-8 text-[12px] leading-relaxed text-slate-900 shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div className="min-h-[72px] min-w-[180px]">
            {client.logoUrl ? (
              <img src={client.logoUrl} alt="Client logo" className="max-h-20 max-w-[220px] object-contain" />
            ) : null}
          </div>
          <div className="max-w-[320px] space-y-0.5 text-right text-[10px] leading-[1.1] text-slate-700">
            {companyInfoRows.map((row) => {
              const Icon = row.icon;
              return (
                <div
                  key={row.key}
                  className={cn(
                    "flex items-center justify-end gap-1.5",
                    row.key === "trading" && "pb-1",
                  )}
                >
                  {Icon ? <Icon className="h-3 w-3 shrink-0 text-slate-900" /> : null}
                  <span className="min-w-0 text-right">
                    <span className={row.bold ? "font-semibold text-slate-900" : ""}>{row.text}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 border-t border-slate-300" aria-hidden="true" />

        <div className="mt-3 text-right text-[12px]">{currentDateDisplay}</div>

        <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_200px]">
          <div className="flex items-start gap-6">
            <p className="uppercase">TO:</p>
            <div className="space-y-0.5">
              <p className="font-semibold uppercase">{employeeFullName || "[employee name]"}</p>
              {employeeAddressLines.length > 0 ? (
                employeeAddressLines.map((line) => (
                  <p key={line} className="font-semibold uppercase">
                    {line}
                  </p>
                ))
              ) : (
                <p className="font-semibold uppercase">[EMPLOYEE ADDRESS]</p>
              )}
            </div>
          </div>
          <div className="pt-20 text-right font-semibold">
            {termination.issuingMethods.length > 0 ? (
              termination.issuingMethods.map((method) => <p key={method}>{method}</p>)
            ) : (
              <p>[method of issuing]</p>
            )}
          </div>
        </div>

        <div className="mt-14">
          <p>{`Dear ${employeeFullName || "[employee name]"}`}</p>
        </div>

        <div className="mt-8">
          <p className="font-bold uppercase underline">RE: TERMINATION OF EMPLOYMENT</p>
        </div>

        <div className="mt-5 space-y-4 text-justify">
          {bodyParagraphs.map((paragraph) => (
            <div key={paragraph.id} className="space-y-2">
              {editingParagraphId === paragraph.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={paragraphDraft}
                    onChange={(event) => onParagraphDraftChange(event.target.value)}
                    className="min-h-[92px] rounded-sm border-slate-300 bg-white text-[12px] leading-relaxed text-slate-900 shadow-none hover:border-[#3eca44] focus-visible:border-[#3eca44] focus-visible:ring-0"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={onParagraphEditCancel} className="rounded border border-slate-300 px-3 py-1 text-[11px] font-medium text-slate-600">
                      Cancel
                    </button>
                    <button type="button" onClick={onParagraphEditSave} className="rounded bg-[#3eca44] px-3 py-1 text-[11px] font-medium text-white">
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p>{paragraph.text}</p>
                  {isEditable ? (
                    <div className="flex items-center justify-end gap-2">
                      {paragraph.isCustom ? (
                        <button
                          type="button"
                          onClick={() => onDeleteCustomParagraph(paragraph.id)}
                          className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-rose-500 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onParagraphEditStart(paragraph.id, paragraph.text)}
                        className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-[#3eca44] hover:text-[#2f9f35]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                    </div>
                  ) : null}
                </>
              )}

              {isEditable && addingAfterId === paragraph.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={newParagraphDraft}
                    onChange={(event) => onAddParagraphDraftChange(event.target.value)}
                    className="min-h-[92px] rounded-sm border-slate-300 bg-white text-[12px] leading-relaxed text-slate-900 shadow-none hover:border-[#3eca44] focus-visible:border-[#3eca44] focus-visible:ring-0"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={onAddParagraphCancel} className="rounded border border-slate-300 px-3 py-1 text-[11px] font-medium text-slate-600">
                      Cancel
                    </button>
                    <button type="button" onClick={onAddParagraphSave} className="rounded bg-[#3eca44] px-3 py-1 text-[11px] font-medium text-white">
                      Save
                    </button>
                  </div>
                </div>
              ) : isEditable ? (
                <AddParagraphDivider onClick={() => onAddParagraphStart(paragraph.id)} />
              ) : null}
            </div>
          ))}
        </div>

        <div className="pt-12">
          <div className="w-40 border-t border-slate-900" />
          <p className="mt-1">Management</p>
        </div>

        {termination.issuingMethods.includes("By Hand") ? (
          <div className="mt-8 border border-slate-900 px-4 py-3">
            <p>
              I, <span className="underline">{employeeFullName || "[employee name]"}</span>, hereby acknowledge that I received this letter and confirm that the content hereof was explained to me.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-10">
              <div>
                <div className="w-full border-t border-slate-900" />
                <p className="mt-1 font-semibold">Signature</p>
              </div>
              <div>
                <div className="w-full border-t border-slate-900" />
                <p className="mt-1 font-semibold">Date</p>
              </div>
              <div>
                <div className="w-full border-t border-slate-900" />
                <p className="mt-1 font-semibold">Witness</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

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

const MiscTermLetterGenerator = ({
  embedded = false,
  onRequestClose,
  draftState,
  onDraftStateChange,
  onStepChange,
  onStepMetaChange,
}: MiscTermLetterGeneratorProps) => {
  const { toast } = useToast();
  const restored = isDraftState(draftState) ? draftState : null;
  const [activeStep, setActiveStep] = useState(restored?.activeStep ?? 0);
  const [isPreviewEditable, setIsPreviewEditable] = useState(Boolean(restored?.preview?.isPreviewEditable));
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [clientMenuOpen, setClientMenuOpen] = useState(false);
  const [clientLoadMessage, setClientLoadMessage] = useState("No clients found.");
  const [client, setClient] = useState<ClientStepState>(() => normalizeClientDraft(restored?.client));
  const [employee, setEmployee] = useState<EmployeeStepState>(() => normalizeEmployeeDraft(restored?.employee));
  const [termination, setTermination] = useState<TerminationStepState>(() => normalizeTerminationDraft(restored?.termination));
  const [previewBodyEdits, setPreviewBodyEdits] = useState<string[]>(() =>
    normalizePreviewBodyEdits(restored?.preview?.bodyParagraphEdits),
  );
  const [customParagraphs, setCustomParagraphs] = useState<Array<{ id: string; text: string; insertAfterId: string | null }>>(
    () => normalizeCustomPreviewParagraphs(restored?.preview?.customParagraphs),
  );
  const [editingParagraphId, setEditingParagraphId] = useState<string | null>(null);
  const [paragraphDraft, setParagraphDraft] = useState("");
  const [addingAfterId, setAddingAfterId] = useState<string | null | undefined>(undefined);
  const [newParagraphDraft, setNewParagraphDraft] = useState("");
  const [misconductSearchOpen, setMisconductSearchOpen] = useState(false);
  const [issuingMethodSearchOpen, setIssuingMethodSearchOpen] = useState(false);
  const [bargainingCouncilSearchOpen, setBargainingCouncilSearchOpen] = useState(false);
  const [conductOffences, setConductOffences] = useState<ConductOffence[]>([]);
  const [misconductLoadMessage, setMisconductLoadMessage] = useState("No misconduct types found.");
  const hearingDatePickerRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    onStepChange?.(steps[activeStep] ?? steps[0]);
  }, [activeStep, onStepChange]);

  useEffect(() => {
    let cancelled = false;

    const fetchClients = async () => {
      const { data, error } = await db
        .from("clients")
        .select(
          "id,registered_name,trading_as,company_type,registration_number,primary_number,primary_email,physical_address_line1,physical_address_line2,city,province,area_code",
        )
        .order("registered_name", { ascending: true, nullsFirst: false });

      if (cancelled) return;

      if (error) {
        setClients([]);
        setClientLoadMessage(`Unable to load clients: ${error.message}`);
        return;
      }

      const rows = Array.isArray(data) ? (data as ClientRecord[]) : [];
      rows.sort((left, right) => buildClientName(left).localeCompare(buildClientName(right), undefined, { sensitivity: "base" }));
      setClients(rows);
      setClientLoadMessage(rows.length > 0 ? "No matching clients found." : "No clients found.");
    };

    void fetchClients();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadConductOffences = async () => {
      const { data, error } = await (supabase as any)
        .from("company_code_of_conduct")
        .select("data")
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setConductOffences(
          fallbackMisconductTypeOptions.map((name) => ({ name, category: "Serious" as OffenceCategory, firstOutcome: "" })),
        );
        setMisconductLoadMessage(`Unable to load misconduct types: ${error.message}`);
        return;
      }

      const sections =
        (
          data?.data as {
            sections?: Array<{
              title?: string;
              offences?: Array<{ name?: string; category?: string; first?: string }>;
            }>;
          }
        )?.sections ?? [];

      const mapped = sections
        .flatMap((section) => {
          const normalizedTitle = String(section.title || "").toLowerCase();
          const sectionCategory = normalizedTitle.includes("dismiss")
            ? "Dismissible"
            : normalizedTitle.includes("minor")
              ? "Minor"
              : normalizedTitle.includes("serious")
                ? "Serious"
                : undefined;

          return (section.offences ?? []).map((offence) => {
            const name = String(offence.name || "").trim();
            if (!name) return null;
            const category = ((offence.category as OffenceCategory | undefined) ?? sectionCategory ?? "Serious") as OffenceCategory;
            return { name, category, firstOutcome: String(offence.first || "") };
          });
        })
        .filter((item): item is ConductOffence => Boolean(item?.name));

      const deduped = offenceCategoryOrder.flatMap((category) => {
        const seen = new Set<string>();
        return mapped.filter((item) => {
          if (item.category !== category) return false;
          const key = item.name.trim().toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });

      if (deduped.length > 0) {
        setConductOffences(deduped);
        setMisconductLoadMessage("No matching misconduct types found.");
        return;
      }

      setConductOffences(
        fallbackMisconductTypeOptions.map((name) => ({ name, category: "Serious" as OffenceCategory, firstOutcome: "" })),
      );
      setMisconductLoadMessage("No misconduct types found.");
    };

    void loadConductOffences();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onDraftStateChange?.({
      activeStep,
      client,
      employee,
      termination,
      preview: {
        isPreviewEditable,
        bodyParagraphEdits: previewBodyEdits,
        customParagraphs,
      },
    });
  }, [activeStep, client, customParagraphs, employee, termination, isPreviewEditable, onDraftStateChange, previewBodyEdits]);

  const resetClientStep = useCallback(() => {
    setClientMenuOpen(false);
    setClient(emptyClientState);
    setEmployee(emptyEmployeeState);
    setTermination(emptyTerminationState);
    setActiveStep(0);
  }, []);

  const resetEmployeeStep = useCallback(() => {
    setEmployee(emptyEmployeeState);
  }, []);

  const resetTerminationStep = useCallback(() => {
    setTermination(emptyTerminationState);
  }, []);

  const togglePreviewEditMode = useCallback(() => {
    setEditingParagraphId(null);
    setAddingAfterId(undefined);
    setParagraphDraft("");
    setNewParagraphDraft("");
    setIsPreviewEditable((current) => !current);
  }, []);

  const loadLogoForClient = async (clientId: string) => {
    const { data, error } = await db.from("client_logos").select("*").eq("client_id", clientId).limit(1);

    if (error) {
      setClient((current) => ({ ...current, logoUrl: "", logoOrientation: "" }));
      return;
    }

    const record = Array.isArray(data) ? ((data[0] as ClientLogoRecord | undefined) ?? null) : null;
    const logoUrl = deriveLogoUrl(record);
    if (!logoUrl) {
      setClient((current) => ({ ...current, logoUrl: "", logoOrientation: "" }));
      return;
    }

    const logoOrientation = await inferLogoOrientation(logoUrl);
    setClient((current) => ({ ...current, logoUrl, logoOrientation }));
  };

  const handleClientSelect = (clientId: string) => {
    const nextRecord = clients.find((entry) => entry.id === clientId);
    if (!nextRecord) return;

    setClient(mapClientRecordToState(nextRecord));
    void loadLogoForClient(clientId);
  };

  const removeLogo = () => {
    setClient((current) => ({ ...current, logoUrl: "", logoOrientation: "" }));
  };

  const hasClient = Boolean(client.clientId);
  const isEmployeeStepComplete =
    employee.name.trim().length > 0 &&
    employee.surname.trim().length > 0 &&
    employee.city.trim().length > 0 &&
    employee.province.trim().length > 0 &&
    employee.areaCode.trim().length > 0;
  const isTerminationStepComplete =
    termination.hearingDate.trim().length > 0 &&
    termination.misconductTypes.length > 0 &&
    termination.progressiveDisciplinaryAction.trim().length > 0 &&
    termination.appealNotice.trim().length > 0 &&
    termination.issuingMethods.length > 0 &&
    termination.disputeForum.trim().length > 0 &&
    (termination.disputeForum !== "bargaining_council" || termination.bargainingCouncil.trim().length > 0);
  const selectedClientLabel = client.companyName || "Select client";
  const misconductSelectionLabel =
    termination.misconductTypes.length === 0
      ? "Select misconduct type(s)"
      : `${termination.misconductTypes.length} misconduct type(s) selected`;
  const issuingMethodSelectionLabel =
    termination.issuingMethods.length === 0
      ? "Select method(s) of issuing"
      : `${termination.issuingMethods.length} issuing method(s) selected`;
  const selectedBargainingCouncilLabel =
    bargainingCouncilOptions.find((option) => option.value === termination.bargainingCouncil)?.label ||
    termination.bargainingCouncil ||
    "Select bargaining council";

  const updateEmployee = <K extends keyof EmployeeStepState>(key: K, value: EmployeeStepState[K]) => {
    setEmployee((current) => ({ ...current, [key]: value }));
  };

  const updateTermination = <K extends keyof TerminationStepState>(key: K, value: TerminationStepState[K]) => {
    setTermination((current) => ({ ...current, [key]: value }));
  };

  const toggleMisconductType = (value: string) => {
    setTermination((current) => ({
      ...current,
      misconductTypes: current.misconductTypes.includes(value)
        ? current.misconductTypes.filter((item) => item !== value)
        : [...current.misconductTypes, value],
    }));
  };

  const toggleIssuingMethod = (value: string) => {
    setTermination((current) => ({
      ...current,
      issuingMethods: current.issuingMethods.includes(value)
        ? current.issuingMethods.filter((item) => item !== value)
        : [...current.issuingMethods, value],
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

  const defaultBodyParagraphs = useMemo(() => buildMiscTermBodyParagraphs(termination), [termination]);
  const previewBodyParagraphs = useMemo(() => {
    const baseParagraphs = defaultBodyParagraphs.map((paragraph, index) => ({
      id: `base-${index}`,
      text: previewBodyEdits[index] ?? paragraph,
      isCustom: false,
    }));

    const merged: Array<{ id: string; text: string; isCustom?: boolean }> = [];
    const leadingCustom = customParagraphs.filter((item) => item.insertAfterId === null);
    leadingCustom.forEach((item) => merged.push({ id: item.id, text: item.text, isCustom: true }));

    baseParagraphs.forEach((paragraph) => {
      merged.push(paragraph);
      customParagraphs
        .filter((item) => item.insertAfterId === paragraph.id)
        .forEach((item) => merged.push({ id: item.id, text: item.text, isCustom: true }));
    });

    return merged;
  }, [customParagraphs, defaultBodyParagraphs, previewBodyEdits]);

  const startParagraphEdit = (id: string, text: string) => {
    setAddingAfterId(undefined);
    setNewParagraphDraft("");
    setEditingParagraphId(id);
    setParagraphDraft(text);
  };

  const cancelParagraphEdit = () => {
    setEditingParagraphId(null);
    setParagraphDraft("");
  };

  const saveParagraphEdit = () => {
    if (!editingParagraphId) return;
    const nextText = paragraphDraft.trim();
    if (!nextText) return;

    if (editingParagraphId.startsWith("base-")) {
      const index = Number.parseInt(editingParagraphId.replace("base-", ""), 10);
      if (Number.isNaN(index)) return;
      setPreviewBodyEdits((current) => {
      const next = defaultBodyParagraphs.map((paragraph, paragraphIndex) => current[paragraphIndex] ?? paragraph);
      next[index] = nextText;
      return next;
    });
    } else {
      setCustomParagraphs((current) =>
        current.map((item) => (item.id === editingParagraphId ? { ...item, text: nextText } : item)),
      );
    }

    cancelParagraphEdit();
  };

  const openAddParagraphForm = (afterId: string | null) => {
    setEditingParagraphId(null);
    setParagraphDraft("");
    setAddingAfterId(afterId);
    setNewParagraphDraft("");
  };

  const closeAddParagraphForm = () => {
    setAddingAfterId(undefined);
    setNewParagraphDraft("");
  };

  const saveNewParagraph = () => {
    const nextText = newParagraphDraft.trim();
    if (!nextText) return;
    setCustomParagraphs((current) => [
      ...current,
      { id: crypto.randomUUID(), text: nextText, insertAfterId: addingAfterId ?? null },
    ]);
    closeAddParagraphForm();
  };

  const deleteCustomParagraph = (id: string) => {
    setCustomParagraphs((current) => current.filter((item) => item.id !== id));
    if (editingParagraphId === id) {
      cancelParagraphEdit();
    }
  };

  const handlePdfDownload = async () => {
    setIsGeneratingPdf(true);
    try {
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = 12;
      const pdfPhoneIconDataUrl = createPdfPhoneIconDataUrl();
      const pdfMailIconDataUrl = createPdfMailIconDataUrl();

      const rawLogoDataUrl = client.logoUrl ? await loadImageUrlAsDataUrl(client.logoUrl) : null;
      const logoDataUrl = rawLogoDataUrl ? await trimLogoWhitespace(rawLogoDataUrl) : null;
      const clientLocationLine = [client.city.trim(), client.province.trim()].filter(Boolean).join(", ");
      const registeredNameDisplay = client.registeredName.trim()
        ? mergeCompanyType(client.registeredName.trim(), client.companyType.trim())
        : "";
      const companyInfoRows: Array<{ text: string; icon: "phone" | "email" | null }> = [
        { text: registeredNameDisplay, icon: null },
        { text: client.tradingName.trim() ? `t/a ${client.tradingName.trim()}` : "", icon: null },
        { text: client.addressLine1.trim(), icon: null },
        { text: client.addressLine2.trim(), icon: null },
        { text: clientLocationLine, icon: null },
        { text: client.areaCode.trim(), icon: null },
        { text: client.phone.trim(), icon: "phone" as const },
        { text: client.email.trim(), icon: "email" as const },
      ].filter((row) => row.text);

      const drawRightAlignedText = (text: string, x: number, top: number, opts?: { bold?: boolean; size?: number }) => {
        pdf.setFont("helvetica", opts?.bold ? "bold" : "normal");
        pdf.setFontSize(opts?.size ?? 8.5);
        pdf.text(text, x, top, { align: "right" });
      };

      const drawHeaderIcon = (kind: "phone" | "email", xRight: number, baselineY: number) => {
        const dataUrl = kind === "phone" ? pdfPhoneIconDataUrl : pdfMailIconDataUrl;
        if (!dataUrl) return;
        try {
          pdf.addImage(dataUrl, "PNG", xRight - 3.6, baselineY - 2.35, 2.6, 2.6);
        } catch {
          // ignore icon draw failures
        }
      };

      const headerStartY = y;
      const headerRightX = pageWidth - margin;

      if (logoDataUrl) {
        try {
          const detectedLayout =
            (await detectLogoLayout(logoDataUrl)) ??
            (client.logoOrientation === "portrait" ? "vertical" : "horizontal");
          const imageType = logoDataUrl.includes("image/jpeg") ? "JPEG" : "PNG";
          const imageProps = pdf.getImageProperties(logoDataUrl);
          const ratio = imageProps.width / imageProps.height;
          const baseTargetHeight = getPdfLogoTargetHeight(detectedLayout as LogoLayout);
          const isCompactStackedLogo = ratio <= 1.2;
          const useStackedLogoSizing = detectedLayout === "vertical" || isCompactStackedLogo;
          const targetLogoHeight = useStackedLogoSizing
            ? Math.max(baseTargetHeight, 25.5)
            : Math.max(baseTargetHeight, 18);
          const maxLogoWidth = useStackedLogoSizing ? 38 : 72;
          let logoHeight = targetLogoHeight;
          let logoWidth = logoHeight * ratio;
          if (logoWidth > maxLogoWidth) {
            const scale = maxLogoWidth / logoWidth;
            logoWidth = maxLogoWidth;
            logoHeight *= scale;
          }
          pdf.addImage(logoDataUrl, imageType, margin, y, logoWidth, logoHeight, undefined, "FAST");
        } catch {
          // ignore logo errors and continue
        }
      }

      let headerY = headerStartY + 3;
      companyInfoRows.forEach((row) => {
        const isRegistered = row.text === registeredNameDisplay;
        drawRightAlignedText(row.text, headerRightX, headerY, { bold: isRegistered, size: isRegistered ? 8.5 : 8 });
        if (row.icon) {
          const textWidth = pdf.getTextWidth(row.text);
          drawHeaderIcon(row.icon, headerRightX - textWidth - 0.6, headerY);
        }
        headerY += row.text === (client.tradingName.trim() ? `t/a ${client.tradingName.trim()}` : "") ? 4.2 : 3.5;
      });

      y = Math.max(y + 20, headerY + 1);
      pdf.setDrawColor(203, 213, 225);
      pdf.setLineWidth(0.25);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 6;

      const currentDateDisplay = formatLongDate(new Date().toISOString()) || "";
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text(currentDateDisplay, pageWidth - margin, y, { align: "right" });
      y += 10;

      const employeeFullName = [employee.name, employee.surname].map((value) => value.trim()).filter(Boolean).join(" ");
      const employeeLocationLine = [employee.city.trim(), employee.province.trim()].filter(Boolean).join(", ");
      const employeeLines = [employeeFullName || "[employee name]", employee.addressLine1.trim(), employeeLocationLine, employee.areaCode.trim()].filter(Boolean);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text("TO:", margin, y);
      let recipientY = y;
      employeeLines.forEach((line, index) => {
        pdf.setFont("helvetica", "bold");
        pdf.text(line.toUpperCase(), margin + 11, recipientY);
        recipientY += 5;
      });

      let methodY = y + 20;
      pdf.setFont("helvetica", "bold");
      termination.issuingMethods.forEach((method) => {
        pdf.text(method, pageWidth - margin, methodY, { align: "right" });
        methodY += 5;
      });

      y = Math.max(recipientY, methodY) + 6;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text(`Dear ${employeeFullName || "[employee name]"}`, margin, y);
      y += 12;

      pdf.setFont("helvetica", "bold");
      pdf.text("RE: TERMINATION OF EMPLOYMENT", margin, y);
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.35);
      const subjectWidth = pdf.getTextWidth("RE: TERMINATION OF EMPLOYMENT");
      pdf.line(margin, y + 0.8, margin + subjectWidth + 0.4, y + 0.8);
      y += 10;

      const drawParagraph = (text: string) => {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        const lines = pdf.splitTextToSize(text, contentWidth) as string[];
        pdf.text(lines, margin, y, { maxWidth: contentWidth, align: "justify" });
        y += lines.length * 5 + 1.8;
      };

      previewBodyParagraphs.forEach((paragraph) => {
        drawParagraph(paragraph.text);
      });

      y += 8;
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.18);
      pdf.line(margin, y, margin + 40, y);
      y += 4;
      pdf.setFont("helvetica", "normal");
      pdf.text("Management", margin, y);

      if (termination.issuingMethods.includes("By Hand")) {
        y += 10;
        const boxTop = y;
        const boxHeight = 30;
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.2);
        pdf.rect(margin, boxTop, contentWidth, boxHeight);
        const acknowledgement = `I, ${employeeFullName || "[employee name]"}, hereby acknowledge that I received this letter and confirm that the content hereof was explained to me.`;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        const prefix = "I, ";
        const suffix = ", hereby acknowledge that I received this letter and confirm that the content hereof was explained to me.";
        const underlinedName = employeeFullName || "[employee name]";
        const lineY = boxTop + 6;
        const prefixWidth = pdf.getTextWidth(prefix);
        const nameWidth = pdf.getTextWidth(underlinedName);
        pdf.text(prefix, margin + 2, lineY);
        pdf.text(underlinedName, margin + 2 + prefixWidth, lineY);
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.18);
        pdf.line(margin + 2 + prefixWidth, lineY + 0.8, margin + 2 + prefixWidth + nameWidth, lineY + 0.8);
        const remainingText = suffix;
        const remainingLines = pdf.splitTextToSize(remainingText, contentWidth - 4 - prefixWidth - nameWidth) as string[];
        if (remainingLines.length > 0) {
          pdf.text(remainingLines[0], margin + 2 + prefixWidth + nameWidth, lineY);
          if (remainingLines.length > 1) {
            pdf.text(remainingLines.slice(1), margin + 2, lineY + 5);
          }
        }
        const signatureTop = boxTop + boxHeight - 9;
        const blockWidth = (contentWidth - 12) / 3;
        [
          { label: "Signature", x: margin + 2 },
          { label: "Date", x: margin + 2 + blockWidth + 4 },
          { label: "Witness", x: margin + 2 + (blockWidth + 4) * 2 },
        ].forEach((item) => {
          pdf.setDrawColor(0, 0, 0);
          pdf.setLineWidth(0.18);
          pdf.line(item.x, signatureTop, item.x + blockWidth - 6, signatureTop);
          pdf.setFont("helvetica", "normal");
          pdf.text(item.label, item.x, signatureTop + 5);
        });
      }

      const employeeInitial = employee.name.trim().charAt(0).toUpperCase();
      const employeeSurname = employee.surname.trim();
      const documentNameSuffix = employeeInitial && employeeSurname ? ` (${employeeInitial}. ${employeeSurname})` : "";
      const documentName = `Termination Letter - Misconduct${documentNameSuffix}`;
      const downloadFileName =
        documentName
          .toLowerCase()
          .replace(/[^a-z0-9._-]+/g, "_")
          .replace(/^_+|_+$/g, "") || "termination_letter_misconduct.pdf";
      const normalizedDownloadFileName = downloadFileName.endsWith(".pdf") ? downloadFileName : `${downloadFileName}.pdf`;
      const uploadBlob = pdf.output("blob");
      const uploadSafeClientName =
        (client.companyName || client.tradingName || client.registeredName || "client")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "client";
      const uploadSafeDocumentName =
        documentName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "termination-letter-misconduct";
      const uploadFilePath = [
        "misconduct-termination-letters",
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
        documentLabel: "Termination Letter - Misconduct",
        documentName,
        documentType: "Termination",
        clientName: client.companyName,
        fileUrl: uploadedFileUrl,
        employeeName: employee.name,
        employeeSurname: employee.surname,
        tradingName: client.tradingName,
        registeredName: client.registeredName,
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

      pdf.save(normalizedDownloadFileName);
      onRequestClose?.();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const stepMeta = useMemo(
    () => ({
      steps,
      icons: stepIcons,
      activeStep,
      canGoNext:
        activeStep === 0
          ? hasClient
          : activeStep === 1
            ? isEmployeeStepComplete
            : activeStep === 2
              ? isTerminationStepComplete
              : !isGeneratingPdf,
      canGoBack: activeStep > 0,
      canSelectStep: (index: number) =>
        index === 0 ||
        (index === 1 && (hasClient || activeStep > 0)) ||
        (index === 2 && (isEmployeeStepComplete || activeStep > 1)) ||
        (index === 3 && (isTerminationStepComplete || activeStep > 2)),
      onStepSelect: (index: number) => {
        if (index === 0) setActiveStep(0);
        if (index === 1 && (hasClient || activeStep > 0)) setActiveStep(1);
        if (index === 2 && (isEmployeeStepComplete || activeStep > 1)) setActiveStep(2);
        if (index === 3 && (isTerminationStepComplete || activeStep > 2)) setActiveStep(3);
      },
      onNext: () => {
        if (activeStep === 0 && hasClient) setActiveStep(1);
        if (activeStep === 1 && isEmployeeStepComplete) setActiveStep(2);
        if (activeStep === 2 && isTerminationStepComplete) setActiveStep(3);
        if (activeStep === 3 && !isGeneratingPdf) {
          void handlePdfDownload();
        }
      },
      onBack: () => {
        if (activeStep === 1) setActiveStep(0);
        if (activeStep === 2) setActiveStep(1);
        if (activeStep === 3) setActiveStep(2);
      },
      onClear:
        activeStep === 0
          ? resetClientStep
          : activeStep === 1
            ? resetEmployeeStep
            : activeStep === 2
              ? resetTerminationStep
              : togglePreviewEditMode,
      supportsResetAtFirstStep: true,
      isFinished: activeStep === 3,
      isPreviewEditable,
      supportsPreviewEditToggle: activeStep === 3,
    }),
    [
      activeStep,
      hasClient,
      handlePdfDownload,
      isGeneratingPdf,
      isEmployeeStepComplete,
      isTerminationStepComplete,
      isPreviewEditable,
      resetClientStep,
      resetEmployeeStep,
      resetTerminationStep,
      togglePreviewEditMode,
    ],
  );

  useEffect(() => {
    onStepMetaChange?.(stepMeta);
  }, [onStepMetaChange, stepMeta]);

  const stepOneBody = (
    <div className={cn("h-full py-1", hiddenScrollClassName)}>
      <div className="space-y-4">
        <div className="rounded-sm border border-[#d6e8d7] bg-[#f4fbf5] px-3 py-2 text-[10px] text-slate-600">
          Select the client record that should feed this letter. The later steps will build on this selected company profile.
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="miscTermClient" className="text-[10px] font-semibold text-slate-600">
              Client Name <span className="text-red-500">*</span>
            </Label>
            <Popover open={clientMenuOpen} onOpenChange={setClientMenuOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="miscTermClient"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={clientMenuOpen}
                  className={cn(
                    fieldClassName,
                    "w-full justify-between px-3 text-[11px] hover:bg-white hover:text-slate-900 data-[state=open]:bg-white data-[state=open]:text-slate-900 [&>svg]:ml-2 [&>svg]:shrink-0",
                    !client.companyName && "text-[10px] text-slate-400",
                  )}
                >
                  <span className="truncate">{selectedClientLabel}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
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
                    <CommandEmpty className="px-3 py-4 text-sm text-slate-500">{clientLoadMessage}</CommandEmpty>
                    <CommandGroup>
                      {clients.map((entry) => {
                        const label = buildClientName(entry);
                        return (
                          <CommandItem
                            key={entry.id}
                            value={`${label} ${String(entry.registered_name || "").trim()} ${String(entry.trading_as || "").trim()}`}
                            onSelect={() => {
                              handleClientSelect(entry.id);
                              setClientMenuOpen(false);
                            }}
                            className="flex items-center justify-between gap-3 px-3 py-2 text-[10px]"
                          >
                            <p className="min-w-0 truncate text-[10px] font-medium text-slate-900">{label}</p>
                            {client.clientId === entry.id ? <Check className="h-3.5 w-3.5 text-[#2f9f35]" /> : null}
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
            <Label htmlFor="miscTermRegistrationNumber" className="text-[10px] font-semibold text-slate-600">
              Registration Number
            </Label>
            <Input
              id="miscTermRegistrationNumber"
              value={client.registrationNumber}
              readOnly
              placeholder="Will populate from selected client"
              className={fieldClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="miscTermPhone" className="text-[10px] font-semibold text-slate-600">
              Contact Number
            </Label>
            <Input id="miscTermPhone" value={client.phone} readOnly placeholder="Will populate from selected client" className={fieldClassName} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="miscTermEmail" className="text-[10px] font-semibold text-slate-600">
              Client Email
            </Label>
            <Input id="miscTermEmail" value={client.email} readOnly placeholder="Will populate from selected client" className={fieldClassName} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="miscTermAddress" className="text-[10px] font-semibold text-slate-600">
            Client Address
          </Label>
          <Input id="miscTermAddress" value={client.address} readOnly placeholder="Will populate from selected client" className={fieldClassName} />
        </div>

        {client.logoUrl ? (
          <div className="max-w-[320px] space-y-2">
            <Label className="text-[10px] font-semibold text-slate-600">Client Logo</Label>
            <div className="flex min-h-[132px] items-center justify-center rounded-sm border border-slate-300 bg-white px-4 py-5">
              <img src={client.logoUrl} alt="Client logo preview" className="max-h-24 max-w-[220px] object-contain" />
            </div>
            <button
              type="button"
              onClick={removeLogo}
              className="inline-flex w-fit items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-700 transition hover:border-rose-500 hover:text-rose-600"
            >
              <X className="h-3.5 w-3.5" />
              Remove logo
            </button>
          </div>
        ) : null}

        {!hasClient ? (
          <div className="rounded-sm border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-[10px] text-slate-500">
            Select a client to populate the company contact fields and logo preview.
          </div>
        ) : null}
      </div>
    </div>
  );

  const stepTwoBody = (
    <div className={cn("h-full py-1", hiddenScrollClassName)}>
      <div className="space-y-4">
        <div className="rounded-sm border border-[#d6e8d7] bg-[#f4fbf5] px-3 py-2 text-[10px] text-slate-600">
          Complete the employee details for this next stage. Address Line 1 is optional. All other fields in this step are required.
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="miscTermEmployeeName" className="text-[10px] font-semibold text-slate-600">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="miscTermEmployeeName"
              value={employee.name}
              onChange={(event) => updateEmployee("name", event.target.value)}
              placeholder="Enter employee name"
              className={fieldClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="miscTermEmployeeSurname" className="text-[10px] font-semibold text-slate-600">
              Surname <span className="text-red-500">*</span>
            </Label>
            <Input
              id="miscTermEmployeeSurname"
              value={employee.surname}
              onChange={(event) => updateEmployee("surname", event.target.value)}
              placeholder="Enter employee surname"
              className={fieldClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="miscTermEmployeeAddressLine1" className="text-[10px] font-semibold text-slate-600">
              Address Line 1
            </Label>
            <Input
              id="miscTermEmployeeAddressLine1"
              value={employee.addressLine1}
              onChange={(event) => updateEmployee("addressLine1", event.target.value)}
              placeholder="Enter address line 1"
              className={fieldClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="miscTermEmployeeCity" className="text-[10px] font-semibold text-slate-600">
              City <span className="text-red-500">*</span>
            </Label>
            <Input
              id="miscTermEmployeeCity"
              value={employee.city}
              onChange={(event) => updateEmployee("city", event.target.value)}
              placeholder="Enter city"
              className={fieldClassName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="miscTermEmployeeProvince" className="text-[10px] font-semibold text-slate-600">
              Province <span className="text-red-500">*</span>
            </Label>
            <Select value={employee.province} onValueChange={(value) => updateEmployee("province", value)}>
              <SelectTrigger id="miscTermEmployeeProvince" className={selectTriggerClassName}>
                <SelectValue placeholder="Select province" />
              </SelectTrigger>
              <SelectContent className="text-[10px]">
                {southAfricanProvinces.map((province) => (
                  <SelectItem key={province} value={province} className="text-[10px]">
                    {province}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="miscTermEmployeeAreaCode" className="text-[10px] font-semibold text-slate-600">
              Area Code <span className="text-red-500">*</span>
            </Label>
            <Input
              id="miscTermEmployeeAreaCode"
              value={employee.areaCode}
              onChange={(event) => updateEmployee("areaCode", event.target.value)}
              placeholder="Enter area code"
              className={fieldClassName}
            />
          </div>
        </div>

        {!isEmployeeStepComplete ? (
          <div className="rounded-sm border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-[10px] text-slate-500">
            Name, surname, city, province, and area code must be completed before this step is ready.
          </div>
        ) : null}
      </div>
    </div>
  );

  const stepThreeBody = (
    <div className={cn("h-full py-1", hiddenScrollClassName)}>
      <div className="space-y-4">
        <div className="rounded-sm border border-[#d6e8d7] bg-[#f4fbf5] px-3 py-2 text-[10px] text-slate-600">
          Capture the hearing and issuing details for the misconduct termination letter. All fields in this step are required.
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="miscTermHearingDate" className="text-[10px] font-semibold text-slate-600">
              Hearing Date <span className="text-red-500">*</span>
            </Label>
            <div className="flex items-start gap-2">
              <Input
                id="miscTermHearingDate"
                type="text"
                readOnly
                value={termination.hearingDate ? formatDateForDisplay(termination.hearingDate) : ""}
                placeholder="Please select a date"
                onClick={() => openHiddenDatePicker(hearingDatePickerRef)}
                onFocus={() => openHiddenDatePicker(hearingDatePickerRef)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openHiddenDatePicker(hearingDatePickerRef);
                  }
                }}
                className={`${fieldClassName} cursor-pointer placeholder:!font-normal`}
              />
              <input
                ref={hearingDatePickerRef}
                type="date"
                value={termination.hearingDate}
                onChange={(event) => updateTermination("hearingDate", event.target.value)}
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="miscTermMisconductTypes" className="text-[10px] font-semibold text-slate-600">
              Misconduct Type(s) <span className="text-red-500">*</span>
            </Label>
            <Popover open={misconductSearchOpen} onOpenChange={setMisconductSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="miscTermMisconductTypes"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={misconductSearchOpen}
                  className={cn(
                    fieldClassName,
                    "w-full justify-between px-3 text-[11px] font-medium hover:bg-white hover:text-slate-900 data-[state=open]:bg-white data-[state=open]:text-slate-900 [&>svg]:ml-2 [&>svg]:shrink-0",
                    termination.misconductTypes.length === 0 && "text-[10px] text-slate-400",
                  )}
                >
                  <span className="truncate text-left">{misconductSelectionLabel}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
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
                          heading={category}
                          className="px-1 [&_[cmdk-group-heading]]:border-b [&_[cmdk-group-heading]]:border-slate-200 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-slate-900"
                        >
                          {offences.map((offence) => {
                            const isSelected = termination.misconductTypes.includes(offence.name);
                            return (
                              <CommandItem
                                key={`${category}-${offence.name}`}
                                value={`${category} ${offence.name}`}
                                onSelect={() => toggleMisconductType(offence.name)}
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
                  {termination.misconductTypes.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {termination.misconductTypes.map((type) => (
                        <div
                          key={type}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#3eca44] bg-[#3eca44]/10 px-2.5 py-1 text-[10px] font-medium text-[#2f9f35]"
                        >
                          <span className="truncate">{type}</span>
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

          <div className="space-y-2">
            <Label htmlFor="miscTermPda" className="text-[10px] font-semibold text-slate-600">
              Progressive Disciplinary Action (PDA) <span className="text-red-500">*</span>
            </Label>
            <Select
              value={termination.progressiveDisciplinaryAction}
              onValueChange={(value) => updateTermination("progressiveDisciplinaryAction", value as TerminationStepState["progressiveDisciplinaryAction"])}
            >
              <SelectTrigger id="miscTermPda" className={selectTriggerClassName}>
                <SelectValue placeholder="Select PDA option" />
              </SelectTrigger>
              <SelectContent className="text-[10px]">
                {progressiveDisciplinaryActionOptions.map((option) => (
                  <SelectItem key={option} value={option} className="text-[10px]">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="miscTermAppealNotice" className="text-[10px] font-semibold text-slate-600">
              Appeal Notice <span className="text-red-500">*</span>
            </Label>
            <Select value={termination.appealNotice} onValueChange={(value) => updateTermination("appealNotice", value as TerminationStepState["appealNotice"])}>
              <SelectTrigger id="miscTermAppealNotice" className={selectTriggerClassName}>
                <SelectValue placeholder="Select appeal period" />
              </SelectTrigger>
              <SelectContent className="text-[10px]">
                {appealNoticeOptions.map((option) => (
                  <SelectItem key={option} value={option} className="text-[10px]">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="miscTermIssuingMethods" className="text-[10px] font-semibold text-slate-600">
              Method of Issuing <span className="text-red-500">*</span>
            </Label>
            <Popover open={issuingMethodSearchOpen} onOpenChange={setIssuingMethodSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="miscTermIssuingMethods"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={issuingMethodSearchOpen}
                  className={cn(
                    fieldClassName,
                    "w-full justify-between px-3 text-[11px] font-medium hover:bg-white hover:text-slate-900 data-[state=open]:bg-white data-[state=open]:text-slate-900 [&>svg]:ml-2 [&>svg]:shrink-0",
                    termination.issuingMethods.length === 0 && "text-[10px] text-slate-400",
                  )}
                >
                  <span className="truncate text-left">{issuingMethodSelectionLabel}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="flex max-h-[380px] w-[var(--radix-popover-trigger-width)] min-w-[420px] flex-col overflow-hidden p-0"
                onWheel={(event) => event.stopPropagation()}
              >
                <Command shouldFilter>
                  <CommandInput
                    placeholder="Search issuing methods..."
                    className="h-8 text-[11px] placeholder:text-[10px]"
                  />
                  <CommandList className="max-h-[248px] overscroll-contain">
                    <CommandEmpty className="px-3 py-4 text-sm text-slate-500">No matching issuing methods found.</CommandEmpty>
                    <CommandGroup className="px-1">
                      {issuingMethodOptions.map((option) => {
                        const isSelected = termination.issuingMethods.includes(option);
                        return (
                          <CommandItem
                            key={option}
                            value={option}
                            onSelect={() => toggleIssuingMethod(option)}
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
                              {option}
                            </p>
                            {isSelected ? <Check className="h-3.5 w-3.5 text-[#2f9f35]" /> : null}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
                <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-3">
                  {termination.issuingMethods.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {termination.issuingMethods.map((method) => (
                        <div
                          key={method}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#3eca44] bg-[#3eca44]/10 px-2.5 py-1 text-[10px] font-medium text-[#2f9f35]"
                        >
                          <span className="truncate">{method}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500">No issuing methods selected.</p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="miscTermDisputeForum" className="text-[10px] font-semibold text-slate-600">
              Forum <span className="text-red-500">*</span>
            </Label>
            <Select
              value={termination.disputeForum}
              onValueChange={(value) =>
                setTermination((current) => ({
                  ...current,
                  disputeForum: value as TerminationStepState["disputeForum"],
                  bargainingCouncil: value === "bargaining_council" ? current.bargainingCouncil : "",
                }))
              }
            >
              <SelectTrigger id="miscTermDisputeForum" className={selectTriggerClassName}>
                <SelectValue placeholder="Select forum" />
              </SelectTrigger>
              <SelectContent className="text-[10px]">
                {disputeForumOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-[10px]">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {termination.disputeForum === "bargaining_council" ? (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="miscTermBargainingCouncil" className="text-[10px] font-semibold text-slate-600">
                Bargaining Council <span className="text-red-500">*</span>
              </Label>
              <Popover open={bargainingCouncilSearchOpen} onOpenChange={setBargainingCouncilSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="miscTermBargainingCouncil"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={bargainingCouncilSearchOpen}
                    className={cn(
                      fieldClassName,
                      "w-full justify-between px-3 text-[11px] font-medium hover:bg-white hover:text-slate-900 data-[state=open]:bg-white data-[state=open]:text-slate-900 [&>svg]:ml-2 [&>svg]:shrink-0",
                      !termination.bargainingCouncil && "text-[10px] text-slate-400",
                    )}
                  >
                    <span className="truncate text-left">{selectedBargainingCouncilLabel}</span>
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
                      value={termination.bargainingCouncil}
                      onValueChange={(value) => updateTermination("bargainingCouncil", value)}
                      placeholder="Search or type bargaining council..."
                      className="h-8 text-[11px] placeholder:text-[10px]"
                    />
                    <CommandList className="max-h-[248px] overscroll-contain">
                      <CommandEmpty className="px-3 py-4 text-sm text-slate-500">
                        Press Enter to use the typed bargaining council.
                      </CommandEmpty>
                      <CommandGroup className="px-1">
                        {bargainingCouncilOptions
                          .filter((option) => {
                            const query = termination.bargainingCouncil.trim().toLowerCase();
                            if (!query) return true;
                            return (
                              option.label.toLowerCase().includes(query) ||
                              option.value.toLowerCase().includes(query)
                            );
                          })
                          .map((option) => (
                            <CommandItem
                              key={option.value}
                              value={`${option.label} ${option.value}`}
                              onSelect={() => {
                                updateTermination("bargainingCouncil", option.label);
                                setBargainingCouncilSearchOpen(false);
                              }}
                              className="flex items-center justify-between gap-3 px-3 py-2 text-[10px]"
                            >
                              <p className="min-w-0 truncate text-[10px] font-medium text-slate-900">{option.label}</p>
                              {selectedBargainingCouncilLabel === option.label ? <Check className="h-3.5 w-3.5 text-[#2f9f35]" /> : null}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                  <div className="border-t border-slate-200 bg-white px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setBargainingCouncilSearchOpen(false)}
                      className="text-[10px] font-medium text-[#2f9f35]"
                    >
                      Use typed value
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          ) : null}
        </div>

        {!isTerminationStepComplete ? (
          <div className="rounded-sm border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-[10px] text-slate-500">
            Hearing date, misconduct type, PDA, appeal notice, dispute forum, and at least one issuing method must be completed.
          </div>
        ) : null}
      </div>

    </div>
  );

  const stepFourBody = (
    <MiscTermPreview
      client={client}
      employee={employee}
      termination={termination}
      bodyParagraphs={previewBodyParagraphs}
      isEditable={isPreviewEditable}
      editingParagraphId={editingParagraphId}
      paragraphDraft={paragraphDraft}
      addingAfterId={addingAfterId}
      newParagraphDraft={newParagraphDraft}
      onParagraphEditStart={startParagraphEdit}
      onParagraphDraftChange={setParagraphDraft}
      onParagraphEditSave={saveParagraphEdit}
      onParagraphEditCancel={cancelParagraphEdit}
      onAddParagraphStart={openAddParagraphForm}
      onAddParagraphDraftChange={setNewParagraphDraft}
      onAddParagraphSave={saveNewParagraph}
      onAddParagraphCancel={closeAddParagraphForm}
      onDeleteCustomParagraph={deleteCustomParagraph}
    />
  );

  const body = activeStep === 0 ? stepOneBody : activeStep === 1 ? stepTwoBody : activeStep === 2 ? stepThreeBody : stepFourBody;

  if (embedded) {
    return <div className="h-full min-h-0">{body}</div>;
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#2D4256] p-6">
        <div className="mx-auto max-w-[1020px] overflow-hidden rounded-sm bg-white shadow-sm">
          <TopStepper
            activeStep={activeStep}
            onStepSelect={(index) => stepMeta.onStepSelect?.(index)}
            canSelectStep={(index) => stepMeta.canSelectStep?.(index) ?? false}
          />
          <div className="p-4">
            <div className="mx-auto flex min-h-[70vh] max-w-[900px] flex-col">
              <section className="min-h-0 flex-1 overflow-hidden rounded-sm border border-slate-300 bg-white px-5 pt-3 pb-4">
                {body}
              </section>
              <div className="mt-3 grid grid-cols-3 items-center">
                <div className="justify-self-start">
                  <button
                    type="button"
                    onClick={() => stepMeta.onBack?.()}
                    disabled={!stepMeta.canGoBack}
                    className="h-[28px] w-[84px] rounded border border-[#3eca44] px-3 text-xs font-semibold text-[#2f9f35] hover:bg-transparent hover:text-[#2f9f35] disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-300"
                  >
                    Back
                  </button>
                </div>
                <div className="justify-self-center">
                  <button
                    type="button"
                    onClick={() => stepMeta.onClear?.()}
                    className="inline-flex h-[28px] w-[84px] items-center justify-center rounded border border-transparent bg-white text-xs font-semibold text-slate-700 hover:text-[#2f9f35]"
                  >
                    Reset
                  </button>
                </div>
                <div className="justify-self-end">
                  <button
                    type="button"
                    onClick={() => stepMeta.onNext?.()}
                    disabled={!stepMeta.canGoNext}
                    className="h-[28px] w-[84px] rounded bg-[#3eca44] px-3 text-xs font-semibold text-white hover:bg-[#34b73b] disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {stepMeta.isFinished ? (isGeneratingPdf ? "..." : "Download") : "Next"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MiscTermLetterGenerator;
