import { useCallback, useEffect, useMemo, useState, type ComponentType, type SVGProps } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { BriefcaseIcon, EnvelopeIcon, MapPinIcon, PhoneIcon as HeroPhoneIcon } from "@heroicons/react/24/outline";
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
import { Building2, Check, ChevronDown, FileText, User2, X } from "lucide-react";

type DiscWarningGeneratorProps = {
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
  "Warning Details",
  "Preview / Edit",
] as const;

const stepIcons = [Building2, User2, FileText, Check] as const;

type OffenceCategory = "Minor" | "Serious" | "Dismissible";

type ConductOffence = {
  name: string;
  category: OffenceCategory;
  firstOutcome: string;
};

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

type DiscWarningLogoOrientation = "portrait" | "landscape";

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
  companyLogoOrientation: DiscWarningLogoOrientation | "";
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

type EmployeeFormState = {
  employeeName: string;
  employeeSurname: string;
  employeeIdOrPassportNumber: string;
  jobTitle: string;
  department: string;
  employeeNumber: string;
};

const emptyEmployeeFormState: EmployeeFormState = {
  employeeName: "",
  employeeSurname: "",
  employeeIdOrPassportNumber: "",
  jobTitle: "",
  department: "",
  employeeNumber: "",
};

type WarningFormState = {
  misconductTypes: string[];
  misconductDescription: string;
  warningType: "first" | "second" | "serious" | "final" | "";
  validityPeriod: string;
  issuedBy: string;
};

const emptyWarningFormState: WarningFormState = {
  misconductTypes: [],
  misconductDescription: "",
  warningType: "",
  validityPeriod: "",
  issuedBy: "Management",
};

type DiscWarningGeneratorDraftState = {
  activeStep: number;
  isFinished: boolean;
  clientForm: ClientFormState;
  employeeForm: EmployeeFormState;
  warningForm: WarningFormState;
};

const isDiscWarningGeneratorDraftState = (value: unknown): value is DiscWarningGeneratorDraftState => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.activeStep !== "number" || typeof candidate.isFinished !== "boolean") return false;
  if (!candidate.clientForm || typeof candidate.clientForm !== "object") return false;
  return true;
};

const normalizeClientFormState = (value: unknown): ClientFormState => ({
  ...emptyClientFormState,
  ...((value && typeof value === "object" ? value : {}) as Partial<ClientFormState>),
});

const normalizeEmployeeFormState = (value: unknown): EmployeeFormState => ({
  ...emptyEmployeeFormState,
  ...((value && typeof value === "object" ? value : {}) as Partial<EmployeeFormState>),
});

const normalizeWarningFormState = (value: unknown): WarningFormState => {
  const candidate = (value && typeof value === "object" ? value : {}) as Partial<WarningFormState>;
  return {
    ...emptyWarningFormState,
    ...candidate,
    misconductTypes: Array.isArray(candidate.misconductTypes)
      ? candidate.misconductTypes.filter((item): item is string => typeof item === "string")
      : [],
  };
};

const stepShellCopy = [
  {
    eyebrow: "Step 1",
    title: "Client details",
    body: "Select the client and review the company information that will be used in this warning.",
  },
  {
    eyebrow: "Step 2",
    title: "Employee details",
    body: "Capture the employee details that will appear in the warning.",
  },
  {
    eyebrow: "Step 3",
    title: "Warning details",
    body: "Select the misconduct type or types and complete the warning information for this document.",
  },
  {
    eyebrow: "Preview",
    title: "Preview and download",
    body: "Review the warning before finalising and downloading it.",
  },
] as const;

const inputClassName =
  "h-8 rounded-sm border-slate-300 bg-white !text-[10px] md:!text-[10px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] md:placeholder:!text-[10px] placeholder:font-normal placeholder:text-slate-400 hover:border-[#3eca44] focus-visible:border-[#3eca44] focus-visible:ring-0";

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

const formatClientAddress = (client: ClientRow) =>
  [
    client.physical_address_line1,
    client.physical_address_line2,
    client.city,
    client.province,
    client.area_code,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");

const formatWarningOffences = (offences: string[], fallback: string) => {
  const normalizedOffences = offences.map((offence) => String(offence || "").trim()).filter(Boolean);
  if (normalizedOffences.length === 0) return fallback;
  if (normalizedOffences.length === 1) return normalizedOffences[0];
  return normalizedOffences.map((offence, index) => `${index + 1}) ${offence}`).join(", ");
};

const mapClientToFormState = (client: ClientRow): ClientFormState => ({
  clientId: client.id,
  clientName: formatClientDisplayName(client),
  clientRegisteredName: String(client.registered_name || "").trim(),
  clientTradingAsName: String(client.trading_as || "").trim(),
  registrationNumber: String(client.registration_number || "").trim(),
  clientContactNumber: String(client.primary_number || "").trim(),
  clientEmail: String(client.primary_email || "").trim(),
  clientAddress: formatClientAddress(client),
  clientAddressLine1: String(client.physical_address_line1 || "").trim(),
  clientAddressLine2: String(client.physical_address_line2 || "").trim(),
  clientCity: String(client.city || "").trim(),
  clientProvince: String(client.province || "").trim(),
  clientAreaCode: String(client.area_code || "").trim(),
  companyLogoDataUrl: "",
  companyLogoOrientation: "",
});

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

const warningValidityByType: Record<Exclude<WarningFormState["warningType"], "">, string> = {
  first: "6",
  second: "6",
  serious: "9",
  final: "12",
};

const warningTypeLabelByValue: Record<Exclude<WarningFormState["warningType"], "">, string> = {
  first: "First Written Warning",
  second: "Second Written Warning",
  serious: "Serious Written Warning",
  final: "Final Written Warning",
};

const generatedDocumentsBucket = "documents";
const employeeIdOrPassportMaxLength = 13;
const clientLogosBucket = "client-logos";
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

const trimDiscWarningLogoWhitespace = (dataUrl: string): Promise<string> =>
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
        const imageData = context.getImageData(0, 0, width, height);
        pixels = imageData.data;
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
      if (!bounds) {
        bounds = findBounds(false);
      }

      if (!bounds) {
        resolve(dataUrl);
        return;
      }

      const padding = 2;
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

const inferDiscWarningLogoOrientation = (dataUrl: string): Promise<DiscWarningLogoOrientation> =>
  new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (!width || !height) {
        resolve("landscape");
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        resolve(width >= height ? "landscape" : "portrait");
        return;
      }

      try {
        context.drawImage(image, 0, 0, width, height);
        const { data } = context.getImageData(0, 0, width, height);
        let minX = width;
        let maxX = -1;
        let minY = height;
        let maxY = -1;

        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const index = (y * width + x) * 4;
            const alpha = data[index + 3];
            const red = data[index];
            const green = data[index + 1];
            const blue = data[index + 2];
            const transparentPixel = alpha < 18;
            const whitePixel = red > 246 && green > 246 && blue > 246;
            if (transparentPixel || whitePixel) continue;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }

        if (maxX < minX || maxY < minY) {
          resolve(width >= height ? "landscape" : "portrait");
          return;
        }

        const croppedWidth = maxX - minX + 1;
        const croppedHeight = maxY - minY + 1;
        resolve(croppedWidth >= croppedHeight ? "landscape" : "portrait");
      } catch {
        resolve(width >= height ? "landscape" : "portrait");
      }
    };
    image.onerror = () => resolve("landscape");
    image.src = dataUrl;
  });

const getDiscWarningPdfLogoBox = (orientation: DiscWarningLogoOrientation | "") =>
  orientation === "portrait"
    ? { maxWidth: 30, maxHeight: 24, spacingAfter: 8 }
    : { maxWidth: 72, maxHeight: 16, spacingAfter: 7 };

const getDiscWarningFooterLogoDimensions = (orientation: DiscWarningLogoOrientation | "") =>
  orientation === "portrait"
    ? {
        previewMaxHeight: 76,
        previewMaxWidth: 92,
        pdfMaxHeight: 22,
        pdfMaxWidth: 22,
      }
    : {
        previewMaxHeight: 74,
        previewMaxWidth: 184,
        pdfMaxHeight: 17,
        pdfMaxWidth: 64,
      };

const createDiscWarningPdfIconDataUrl = (
  draw: (ctx: CanvasRenderingContext2D) => void,
  options?: { size?: number; strokeColor?: string },
): string | null => {
  if (typeof document === "undefined" || typeof Path2D === "undefined") return null;
  const size = options?.size ?? 24;
  const strokeColor = options?.strokeColor ?? "#334155";
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

const createDiscWarningPdfPhoneIconDataUrl = (strokeColor = "#000000") =>
  createDiscWarningPdfIconDataUrl((ctx) => {
    const path = new Path2D(
      "M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z",
    );
    ctx.stroke(path);
  }, { strokeColor });

const createDiscWarningPdfMailIconDataUrl = (strokeColor = "#000000") =>
  createDiscWarningPdfIconDataUrl((ctx) => {
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

const createDiscWarningPdfLocationIconDataUrl = (strokeColor = "#000000") =>
  createDiscWarningPdfIconDataUrl((ctx) => {
    const center = new Path2D("M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z");
    const shell = new Path2D("M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z");
    ctx.stroke(center);
    ctx.stroke(shell);
  }, { strokeColor });

const createDiscWarningPdfBriefcaseIconDataUrl = (strokeColor = "#000000") =>
  createDiscWarningPdfIconDataUrl((ctx) => {
    const path = new Path2D(
      "M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z",
    );
    ctx.stroke(path);
  }, { strokeColor });


const buildDiscWarningFooterAddressLines = (clientForm: ClientFormState) => {
  const lineOne = [clientForm.clientAddressLine1, clientForm.clientAddressLine2].filter(Boolean).join(", ");
  const lineTwo = [clientForm.clientCity, clientForm.clientProvince, clientForm.clientAreaCode].filter(Boolean).join(", ");
  const fallback = String(clientForm.clientAddress || "").trim();
  return [lineOne, lineTwo].filter(Boolean).length > 0 ? [lineOne, lineTwo].filter(Boolean) : (fallback ? [fallback] : []);
};

const DiscWarningGeneratorContent = ({
  activeStep,
  isFinished,
  clientRows,
  clientForm,
  employeeForm,
  warningForm,
  onEmployeeFormChange,
  onWarningFormChange,
  onWarningTypeChange,
  misconductSearchOpen,
  setMisconductSearchOpen,
  conductOffences,
  misconductLoadMessage,
  onMisconductToggle,
  clientSearchOpen,
  setClientSearchOpen,
  onClientSelect,
  clientLoadMessage,
  onClientLogoRemove,
}: {
  activeStep: number;
  isFinished: boolean;
  clientRows: ClientRow[];
  clientForm: ClientFormState;
  employeeForm: EmployeeFormState;
  warningForm: WarningFormState;
  onEmployeeFormChange: (field: keyof EmployeeFormState, value: string) => void;
  onWarningFormChange: (field: Exclude<keyof WarningFormState, "misconductTypes" | "warningType">, value: string) => void;
  onWarningTypeChange: (value: Exclude<WarningFormState["warningType"], "">) => void;
  misconductSearchOpen: boolean;
  setMisconductSearchOpen: (open: boolean) => void;
  conductOffences: ConductOffence[];
  misconductLoadMessage: string;
  onMisconductToggle: (name: string) => void;
  clientSearchOpen: boolean;
  setClientSearchOpen: (open: boolean) => void;
  onClientSelect: (clientId: string) => void;
  clientLoadMessage: string;
  onClientLogoRemove: () => void;
}) => {
  const currentIndex = isFinished ? 3 : activeStep;
  const currentStep = stepShellCopy[currentIndex];
  const selectedClientLabel = clientForm.clientName || "Select client";
  const [clientSearchValue, setClientSearchValue] = useState("");
  const filteredClientRows = useMemo(() => {
    const searchValue = clientSearchValue.trim().toLowerCase();
    if (!searchValue) return clientRows;
    return clientRows.filter((client) => {
      const registeredName = String(client.registered_name || "").trim().toLowerCase();
      const tradingAsName = String(client.trading_as || "").trim().toLowerCase();
      return registeredName.startsWith(searchValue) || tradingAsName.startsWith(searchValue);
    });
  }, [clientRows, clientSearchValue]);
  const handleClientSearchOpenChange = (open: boolean) => {
    if (!open) setClientSearchValue("");
    setClientSearchOpen(open);
  };
  const isClientStep = activeStep === 0 && !isFinished;
  const isEmployeeStep = activeStep === 1 && !isFinished;
  const isWarningStep = activeStep === 2 && !isFinished;
  const isPreviewStep = isFinished;
  const misconductSelectionLabel =
    warningForm.misconductTypes.length === 0
      ? "Select misconduct type(s)"
      : warningForm.misconductTypes.length === 1
        ? warningForm.misconductTypes[0]
        : `${warningForm.misconductTypes.length} misconduct type(s) selected`;
  const warningTypeLabel = warningForm.warningType ? warningTypeLabelByValue[warningForm.warningType] : "";
  const hasClientLogo = Boolean(clientForm.companyLogoDataUrl);
  const showClientLogoField = Boolean(clientForm.clientId && clientForm.companyLogoDataUrl);
  const previewTitle = "Disciplinary Warning";
  const previewLine = "______________________________";
  const footerLogoDimensions = getDiscWarningFooterLogoDimensions(clientForm.companyLogoOrientation);
  const employeeFullName = [employeeForm.employeeName, employeeForm.employeeSurname].filter(Boolean).join(" ").trim();
  const employerRows = [
    { label: "Company Name:", value: clientForm.clientName || previewLine },
    { label: "Registration No:", value: clientForm.registrationNumber || previewLine },
    { label: "Employer Number:", value: clientForm.clientContactNumber || previewLine },
    { label: "Employer Email:", value: clientForm.clientEmail || previewLine },
    { label: "Employer Address:", value: clientForm.clientAddress || previewLine },
  ];
  const employeeRows = [
    { label: "Employee Name:", value: employeeFullName || previewLine },
    { label: "ID Number:", value: employeeForm.employeeIdOrPassportNumber || previewLine },
    ...(employeeForm.jobTitle.trim() ? [{ label: "Job Title:", value: employeeForm.jobTitle.trim() }] : []),
    ...(employeeForm.department.trim() ? [{ label: "Department:", value: employeeForm.department.trim() }] : []),
    ...(employeeForm.employeeNumber.trim()
      ? [{ label: "Employee Number:", value: employeeForm.employeeNumber.trim() }]
      : []),
  ];
  const warningRows = [
    {
      label: "Offence(s):",
      value: formatWarningOffences(warningForm.misconductTypes, previewLine),
    },
    { label: "Description:", value: warningForm.misconductDescription || previewLine },
    {
      label: "Validity Period:",
      value: warningForm.validityPeriod ? `${warningForm.validityPeriod} months` : previewLine,
    },
    { label: "Issued By:", value: warningForm.issuedBy || previewLine },
  ];
  const logoWarningRows = [
    warningRows[0],
    warningRows[1],
    { label: "Warning Type:", value: warningTypeLabel || previewLine },
    warningRows[2],
    warningRows[3],
  ];
  const consequenceText =
    warningForm.warningType === "final"
      ? "You are required to completely refrain from committing any further act(s) of misconduct. Should you commit the same or similar offence(s) within the validity period of this warning, you will be subjected to a disciplinary hearing and if found guilty, dismissal will result."
      : "You are required to completely refrain from committing any further act(s) of misconduct. Should you commit the same or similar offence(s) within the validity period of this warning, progressive disciplinary action will be taken which could lead to your dismissal.";
  const signatureRows = [
    ["Employer/Issuer", "Date", "Employee", "Date"],
    ["Representative", "Date", "Interpreter", "Date"],
    ["Witness 1 (optional)", "Date", "Witness 2 (optional)", "Date"],
  ] as const;
  const footerAddressLines = buildDiscWarningFooterAddressLines(clientForm);

  return (
    <div className="h-full overflow-y-auto py-1">
      <div className="h-full">
        {!isClientStep && !isEmployeeStep && !isWarningStep && !isPreviewStep ? (
          <div className="space-y-3 border-b border-slate-100 pb-5">
            <Badge variant="outline" className="w-fit border-[#2D4256]/20 text-[#2D4256]">
              {currentStep.eyebrow}
            </Badge>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-slate-900">{currentStep.title}</h2>
              <p className="max-w-2xl text-sm leading-6 text-slate-600">{currentStep.body}</p>
            </div>
          </div>
        ) : null}
        <div className={cn("space-y-4", isClientStep || isEmployeeStep ? "pt-0" : "pt-5")}>
          {isClientStep ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="discWarningClientName" className="text-[10px] font-semibold text-slate-600">
                    Client Name <span className="text-red-500">*</span>
                  </Label>
                  <Popover open={clientSearchOpen} onOpenChange={handleClientSearchOpenChange}>
                    <PopoverTrigger asChild>
                      <Button
                        id="discWarningClientName"
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={clientSearchOpen}
                        className={cn(
                          inputClassName,
                          "w-full justify-between px-3 text-[11px] font-medium hover:bg-white hover:text-slate-900 data-[state=open]:bg-white data-[state=open]:text-slate-900",
                          !clientForm.clientName && "text-[10px]",
                          !clientForm.clientName && "text-slate-400",
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
                              const searchable = `${String(client.registered_name || "").trim()} ${String(client.trading_as || "").trim()}`;
                              return (
                                <CommandItem
                                  key={client.id}
                                  value={searchable.trim()}
                                  onSelect={() => {
                                    onClientSelect(client.id);
                                    setClientSearchValue("");
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
                  <Label htmlFor="discWarningRegistrationNumber" className="text-[10px] font-semibold text-slate-600">
                    Registration Number
                  </Label>
                  <Input
                    id="discWarningRegistrationNumber"
                    value={clientForm.registrationNumber}
                    readOnly
                    placeholder="Will populate from selected client"
                    className={inputClassName}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discWarningClientContactNumber" className="text-[10px] font-semibold text-slate-600">
                    Contact Number
                  </Label>
                  <Input
                    id="discWarningClientContactNumber"
                    value={clientForm.clientContactNumber}
                    readOnly
                    placeholder="Will populate from selected client"
                    className={inputClassName}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discWarningClientEmail" className="text-[10px] font-semibold text-slate-600">
                    Client Email
                  </Label>
                  <Input
                    id="discWarningClientEmail"
                    value={clientForm.clientEmail}
                    readOnly
                    placeholder="Will populate from selected client"
                    className={inputClassName}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discWarningClientAddress" className="text-[10px] font-semibold text-slate-600">
                  Client Address
                </Label>
                <Input
                  id="discWarningClientAddress"
                  value={clientForm.clientAddress}
                  readOnly
                  placeholder="Will populate from selected client"
                  className={inputClassName}
                />
              </div>

              {showClientLogoField ? (
                <div className="max-w-[320px] space-y-2">
                  <Label className="text-[10px] font-semibold text-slate-600">
                    Client Logo
                  </Label>
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
                <Label htmlFor="discWarningEmployeeName" className="text-[10px] font-semibold text-slate-600">
                  Employee Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="discWarningEmployeeName"
                  value={employeeForm.employeeName}
                  onChange={(event) => onEmployeeFormChange("employeeName", event.target.value)}
                  placeholder="Enter employee name"
                  className={inputClassName}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discWarningEmployeeSurname" className="text-[10px] font-semibold text-slate-600">
                  Employee Surname <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="discWarningEmployeeSurname"
                  value={employeeForm.employeeSurname}
                  onChange={(event) => onEmployeeFormChange("employeeSurname", event.target.value)}
                  placeholder="Enter employee surname"
                  className={inputClassName}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discWarningEmployeeIdOrPassportNumber" className="text-[10px] font-semibold text-slate-600">
                  Employee ID/Passport Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="discWarningEmployeeIdOrPassportNumber"
                  value={employeeForm.employeeIdOrPassportNumber}
                  onChange={(event) => onEmployeeFormChange("employeeIdOrPassportNumber", event.target.value)}
                  placeholder="Enter employee ID or passport number"
                  maxLength={employeeIdOrPassportMaxLength}
                  className={inputClassName}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discWarningEmployeeJobTitle" className="text-[10px] font-semibold text-slate-600">
                  Job Title
                </Label>
                <Input
                  id="discWarningEmployeeJobTitle"
                  value={employeeForm.jobTitle}
                  onChange={(event) => onEmployeeFormChange("jobTitle", event.target.value)}
                  placeholder="Enter job title"
                  className={inputClassName}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discWarningEmployeeDepartment" className="text-[10px] font-semibold text-slate-600">
                  Department
                </Label>
                <Input
                  id="discWarningEmployeeDepartment"
                  value={employeeForm.department}
                  onChange={(event) => onEmployeeFormChange("department", event.target.value)}
                  placeholder="Enter department"
                  className={inputClassName}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discWarningEmployeeNumber" className="text-[10px] font-semibold text-slate-600">
                  Employee Number
                </Label>
                <Input
                  id="discWarningEmployeeNumber"
                  value={employeeForm.employeeNumber}
                  onChange={(event) => onEmployeeFormChange("employeeNumber", event.target.value)}
                  placeholder="Enter employee number"
                  className={inputClassName}
                />
              </div>
            </div>
          ) : isWarningStep ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="discWarningMisconductTypes" className="text-[10px] font-semibold text-slate-600">
                  Misconduct Type(s) <span className="text-red-500">*</span>
                </Label>
                <Popover open={misconductSearchOpen} onOpenChange={setMisconductSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="discWarningMisconductTypes"
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={misconductSearchOpen}
                      className={cn(
                        inputClassName,
                        "w-full justify-between px-3 text-[11px] font-medium hover:bg-white hover:text-slate-900 data-[state=open]:bg-white data-[state=open]:text-slate-900",
                        warningForm.misconductTypes.length === 0 && "text-[10px] text-slate-400",
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
                              heading={offenceGroupLabel[category]}
                              className="px-1 [&_[cmdk-group-heading]]:border-b [&_[cmdk-group-heading]]:border-slate-200 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-slate-900"
                            >
                              {offences.map((offence) => {
                                const isSelected = warningForm.misconductTypes.includes(offence.name);
                                return (
                                  <CommandItem
                                    key={`${category}-${offence.name}`}
                                    value={`${offenceGroupLabel[category]} ${offence.name}`}
                                    onSelect={() => onMisconductToggle(offence.name)}
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
                      {warningForm.misconductTypes.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {warningForm.misconductTypes.map((type) => (
                            <div
                              key={type}
                              className="inline-flex items-center gap-1.5 rounded-full border border-[#3eca44] bg-[#3eca44]/10 px-2.5 py-1 text-[10px] font-medium text-[#2f9f35]"
                            >
                              <span className="truncate">{type}</span>
                              <button
                                type="button"
                                aria-label={`Remove ${type}`}
                                onClick={() => onMisconductToggle(type)}
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
                {warningForm.misconductTypes.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {warningForm.misconductTypes.map((type) => (
                      <div
                        key={type}
                        className="group inline-flex items-center rounded-sm border border-[#3eca44] bg-[#3eca44]/10 px-2 py-1 text-[10px] font-medium text-[#2f9f35] transition-all"
                      >
                        <span>{type}</span>
                        <span className="inline-flex w-0 overflow-hidden opacity-0 transition-all duration-200 group-hover:ml-1 group-hover:w-3.5 group-hover:opacity-100 group-focus-within:ml-1 group-focus-within:w-3.5 group-focus-within:opacity-100">
                          <button
                            type="button"
                            aria-label={`Remove ${type}`}
                            onClick={() => onMisconductToggle(type)}
                            className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[#2f9f35] hover:text-[#237a28]"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="discWarningMisconductDescription" className="text-[10px] font-semibold text-slate-600">
                  Misconduct Description <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="discWarningMisconductDescription"
                  value={warningForm.misconductDescription}
                  onChange={(event) => onWarningFormChange("misconductDescription", event.target.value)}
                  onInput={(event) => {
                    const textarea = event.currentTarget;
                    textarea.style.height = "auto";
                    textarea.style.height = `${textarea.scrollHeight}px`;
                  }}
                  placeholder="Provide specific details about the misconduct incident(s)"
                  rows={2}
                  className={`${inputClassName} min-h-[56px] overflow-hidden resize-none py-2`}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="discWarningWarningType" className="text-[10px] font-semibold text-slate-600">
                    Warning Type <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={warningForm.warningType || undefined}
                    onValueChange={(value) => onWarningTypeChange(value as Exclude<WarningFormState["warningType"], "">)}
                  >
                    <SelectTrigger
                      id="discWarningWarningType"
                      className={cn(
                        inputClassName,
                        "!h-8 !border-slate-300 !text-[10px] hover:!border-[#3eca44] focus:!border-[#3eca44] focus-visible:!border-[#3eca44] [&>span]:text-[10px] [&>span]:font-medium data-[placeholder]:[&>span]:font-normal data-[placeholder]:[&>span]:text-slate-400",
                      )}
                    >
                      <SelectValue placeholder="Select warning type" />
                    </SelectTrigger>
                    <SelectContent className="text-[10px]">
                      <SelectItem value="first" className="text-[10px]">First Written Warning</SelectItem>
                      <SelectItem value="second" className="text-[10px]">Second Written Warning</SelectItem>
                      <SelectItem value="serious" className="text-[10px]">Serious Written Warning</SelectItem>
                      <SelectItem value="final" className="text-[10px]">Final Written Warning</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discWarningValidityPeriod" className="text-[10px] font-semibold text-slate-600">
                    Validity Period <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="discWarningValidityPeriod"
                    value={warningForm.validityPeriod ? `${warningForm.validityPeriod} months` : ""}
                    readOnly
                    placeholder="Will populate from warning type"
                    className={inputClassName}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discWarningIssuedBy" className="text-[10px] font-semibold text-slate-600">
                    Issued By
                  </Label>
                  <Input
                    id="discWarningIssuedBy"
                    value={warningForm.issuedBy}
                    onChange={(event) => onWarningFormChange("issuedBy", event.target.value)}
                    placeholder="Enter issuer name"
                    className={inputClassName}
                  />
                </div>
              </div>
            </div>
          ) : isPreviewStep ? (
            <div className="mx-auto max-w-[820px]">
              <div className="bg-white px-8 pt-3 pb-8 text-black">
                <h2 className="text-center text-[20px] font-bold uppercase tracking-tight text-black">
                  {previewTitle}
                </h2>

                <section className="mt-5">
                  <div className="rounded-sm border border-slate-300 bg-slate-50 px-4 py-2.5">
                    <p className="text-[11px] font-bold uppercase text-black">
                      {hasClientLogo ? "A. Employee Details" : "A. Employer Details"}
                    </p>
                  </div>
                  <div className="mt-3 space-y-1">
                    {hasClientLogo ? (
                      <>
                        {employeeRows.map((row) => (
                          <div key={row.label} className="grid grid-cols-[176px_minmax(0,1fr)] gap-2 text-[11px] leading-5">
                            <p className="font-bold text-black">{row.label}</p>
                            <p className="text-black">{row.value}</p>
                          </div>
                        ))}
                      </>
                    ) : (
                      employerRows.map((row) => (
                        <div key={row.label} className="grid grid-cols-[176px_minmax(0,1fr)] gap-2 text-[11px] leading-5">
                          <p className="font-bold text-black">{row.label}</p>
                          <p className="text-black">{row.value}</p>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                {!hasClientLogo ? (
                  <section className="mt-6">
                    <div className="rounded-sm border border-slate-300 bg-slate-50 px-4 py-2.5">
                      <p className="text-[11px] font-bold uppercase text-black">B. Employee Details</p>
                    </div>
                    <div className="mt-3 space-y-1">
                      {employeeRows.map((row) => (
                        <div key={row.label} className="grid grid-cols-[176px_minmax(0,1fr)] gap-2 text-[11px] leading-5">
                          <p className="font-bold text-black">{row.label}</p>
                          <p className="text-black">{row.value}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="mt-6">
                  <div className="rounded-sm border border-slate-300 bg-slate-50 px-4 py-2.5">
                    <p className="text-[11px] font-bold uppercase text-black">
                      {hasClientLogo ? "B. Warning Details" : "C. Warning Details"}
                    </p>
                  </div>
                  <div className="mt-3 space-y-1">
                    {(hasClientLogo ? logoWarningRows : warningRows).map((row) => (
                      <div key={row.label} className="grid grid-cols-[176px_minmax(0,1fr)] gap-2 text-[11px] leading-5">
                        <p className="font-bold text-black">{row.label}</p>
                        <p className="whitespace-pre-wrap text-black">{row.value}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="mt-6">
                  <div className="rounded-sm border border-slate-300 bg-slate-50 px-4 py-2.5">
                    <p className="text-[11px] font-bold uppercase text-black">
                      {hasClientLogo ? "C. Consequences" : "D. Consequences"}
                    </p>
                  </div>
                  <p className="mt-3 text-[11px] leading-5 text-black">{consequenceText}</p>
                </section>

                <section className="mt-6">
                  <div className="rounded-sm border border-slate-300 bg-slate-50 px-4 py-2.5">
                    <p className="text-[11px] font-bold uppercase text-black">
                      {hasClientLogo ? "D. Signatures" : "E. Signatures"}
                    </p>
                  </div>
                  <div className="mt-3 space-y-6">
                    {signatureRows.map((row, index) => (
                      <div
                        key={index}
                        className="grid max-w-full grid-cols-[minmax(0,1fr)_92px_minmax(0,1fr)_92px] gap-x-6 gap-y-1.5"
                      >
                        {row.map((label) => (
                          <div key={label} className="min-w-0">
                            <div className="border-b border-black" />
                            <p className="mt-1.5 text-[11px] text-black">{label}</p>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-sm border border-slate-300 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] italic font-normal leading-5 text-slate-600">
                      If the employee refuses to sign this warning, the witness&apos;s signature will confirm that the
                      employee did receive the warning and that the contents were explained to him/her.
                    </p>
                  </div>
                </section>

                {hasClientLogo ? (
                  <footer className="mt-7 border-t border-slate-300 pt-4">
                    <div className="grid grid-cols-[minmax(0,1fr)_136px] items-start gap-5">
                      <div className="space-y-1 text-left text-[9px] leading-4 text-slate-700">
                        <p className="font-semibold text-slate-900">{clientForm.clientName}</p>
                        {clientForm.registrationNumber ? (
                          <div className="flex items-start gap-2">
                            <BriefcaseIcon className="mt-0.5 h-3 w-3 shrink-0 text-black" />
                            <span>{clientForm.registrationNumber}</span>
                          </div>
                        ) : null}
                        {clientForm.clientContactNumber ? (
                          <div className="flex items-start gap-2">
                            <HeroPhoneIcon className="mt-0.5 h-3 w-3 shrink-0 text-black" />
                            <span>{clientForm.clientContactNumber}</span>
                          </div>
                        ) : null}
                        {clientForm.clientEmail ? (
                          <div className="flex items-start gap-2">
                            <EnvelopeIcon className="mt-0.5 h-3 w-3 shrink-0 text-black" />
                            <span>{clientForm.clientEmail}</span>
                          </div>
                        ) : null}
                        {footerAddressLines.length > 0 ? (
                          <div className="flex items-start gap-2">
                            <MapPinIcon className="mt-0.5 h-3 w-3 shrink-0 text-black" />
                            <div>
                              {footerAddressLines.map((line) => (
                                <p key={line}>{line}</p>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex min-h-[72px] items-end justify-end">
                        <img
                          src={clientForm.companyLogoDataUrl}
                          alt="Client logo"
                          className="h-auto w-auto object-contain"
                          style={{
                            maxHeight: `${footerLogoDimensions.previewMaxHeight}px`,
                            maxWidth: `${footerLogoDimensions.previewMaxWidth}px`,
                          }}
                        />
                      </div>
                    </div>
                  </footer>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                {steps.slice(0, 3).map((stepLabel, index) => {
                  const isCurrent = !isFinished && activeStep === index;
                  const isComplete = isFinished || activeStep > index;
                  const Icon = stepIcons[index];
                  return (
                    <div
                      key={stepLabel}
                      className={cn(
                        "rounded-sm border px-4 py-4 transition-colors",
                        isCurrent
                          ? "border-[#2D4256] bg-slate-50"
                          : isComplete
                            ? "border-[#3eca44]/40 bg-[#3eca44]/10"
                            : "border-slate-200 bg-white",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex h-8 w-8 items-center justify-center rounded-full border",
                            isCurrent
                              ? "border-[#2D4256] bg-[#2D4256] text-white"
                              : isComplete
                                ? "border-[#3eca44] bg-[#3eca44] text-white"
                                : "border-slate-200 bg-slate-50 text-slate-400",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stage {index + 1}</p>
                          <p className="text-sm font-semibold text-slate-900">{stepLabel}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-sm border border-dashed border-slate-300 bg-slate-50 px-4 py-5">
                <p className="text-sm font-medium text-slate-900">Preview step</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  This preview area will show the completed warning content before download.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const DiscWarningGenerator = ({
  embedded = false,
  onRequestClose,
  draftState,
  onDraftStateChange,
  onStepChange,
  onStepMetaChange,
}: DiscWarningGeneratorProps) => {
  const { user } = useAuth();
  const resolvedDraftState = isDiscWarningGeneratorDraftState(draftState) ? draftState : null;
  const [activeStep, setActiveStep] = useState(resolvedDraftState?.activeStep ?? 0);
  const [isFinished, setIsFinished] = useState(resolvedDraftState?.isFinished ?? false);
  const [clientRows, setClientRows] = useState<ClientRow[]>([]);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientLoadMessage, setClientLoadMessage] = useState("No clients found.");
  const [clientForm, setClientForm] = useState<ClientFormState>(() =>
    normalizeClientFormState(resolvedDraftState?.clientForm),
  );
  const [employeeForm, setEmployeeForm] = useState<EmployeeFormState>(() =>
    normalizeEmployeeFormState(resolvedDraftState?.employeeForm),
  );
  const [warningForm, setWarningForm] = useState<WarningFormState>(() =>
    normalizeWarningFormState(resolvedDraftState?.warningForm),
  );
  const [misconductSearchOpen, setMisconductSearchOpen] = useState(false);
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

      const nextRows = (((data as unknown) as ClientRow[] | null) ?? []).sort((a, b) =>
        formatClientDisplayName(a).localeCompare(formatClientDisplayName(b), undefined, {
          sensitivity: "base",
        }),
      );

      setClientRows(nextRows);
      setClientLoadMessage(nextRows.length > 0 ? "No matching clients found." : "No clients found.");
    };

    void loadClients();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const loadConductOffences = async () => {
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

    void loadConductOffences();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const applyClientLogoToForm = useCallback(async (logoUrl: string) => {
    const trimmedLogoUrl = String(logoUrl || "").trim();
    if (!trimmedLogoUrl) {
      setClientForm((current) => ({
        ...current,
        companyLogoDataUrl: "",
        companyLogoOrientation: "",
      }));
      return;
    }

    const croppedLogoUrl = await trimDiscWarningLogoWhitespace(trimmedLogoUrl);

    setClientForm((current) => ({
      ...current,
      companyLogoDataUrl: croppedLogoUrl,
    }));

    const orientation = await inferDiscWarningLogoOrientation(croppedLogoUrl);
    setClientForm((current) => ({
      ...current,
      companyLogoDataUrl: croppedLogoUrl,
      companyLogoOrientation: orientation,
    }));
  }, []);

  const loadClientProfileLogo = useCallback(async (clientId: string) => {
    try {
      const { data, error } = await supabaseUntyped
        .from("client_logos")
        .select("*")
        .eq("client_id", clientId)
        .limit(1);

      if (error) {
        setClientForm((current) => ({
          ...current,
          companyLogoDataUrl: "",
          companyLogoOrientation: "",
        }));
        return;
      }

      const logoRecord = (Array.isArray(data) ? data[0] : data) as ClientLogoRecord | null;
      const logoUrl = getClientLogoUrlFromRecord(logoRecord);
      await applyClientLogoToForm(logoUrl);
    } catch {
      setClientForm((current) => ({
        ...current,
        companyLogoDataUrl: "",
        companyLogoOrientation: "",
      }));
    }
  }, [applyClientLogoToForm]);

  const handleClientSelect = (clientId: string) => {
    const client = clientRows.find((row) => row.id === clientId);
    if (!client) return;
    setIsFinished(false);
    setActiveStep(0);
    setClientForm(mapClientToFormState(client));
    setEmployeeForm(emptyEmployeeFormState);
    setWarningForm(emptyWarningFormState);
    setMisconductSearchOpen(false);
    void loadClientProfileLogo(clientId);
  };

  const handleClientLogoRemove = () => {
    setClientForm((current) => ({
      ...current,
      companyLogoDataUrl: "",
      companyLogoOrientation: "",
    }));
  };

  const handleEmployeeFormChange = (field: keyof EmployeeFormState, value: string) => {
    setEmployeeForm((current) => ({
      ...current,
      [field]: field === "employeeIdOrPassportNumber" ? value.slice(0, employeeIdOrPassportMaxLength) : value,
    }));
  };

  const handleWarningFormChange = (
    field: Exclude<keyof WarningFormState, "misconductTypes" | "warningType">,
    value: string,
  ) => {
    setWarningForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleWarningTypeChange = (value: Exclude<WarningFormState["warningType"], "">) => {
    setWarningForm((current) => ({
      ...current,
      warningType: value,
      validityPeriod: warningValidityByType[value],
    }));
  };

  const handleMisconductToggle = (name: string) => {
    setWarningForm((current) => ({
      ...current,
      misconductTypes: current.misconductTypes.includes(name)
        ? current.misconductTypes.filter((item) => item !== name)
        : [...current.misconductTypes, name],
    }));
  };

  const handleDownloadPdf = useCallback(async () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    const hasLogoLayout = Boolean(clientForm.companyLogoDataUrl);
    const footerReserve = hasLogoLayout ? 34 : 18;
    const bottomLimit = pageHeight - footerReserve;
    const sectionFill = [237, 237, 239] as const;
    const sectionBorder = [161, 161, 170] as const;
    const lineFallback = "______________________________";
    const resolvedTitle = "Disciplinary Warning";
    const resolvedEmployeeName =
      [employeeForm.employeeName, employeeForm.employeeSurname].filter(Boolean).join(" ").trim() || lineFallback;
    const resolvedEmployerRows = [
      ["Company Name:", clientForm.clientName || lineFallback],
      ["Registration No:", clientForm.registrationNumber || lineFallback],
      ["Employer Number:", clientForm.clientContactNumber || lineFallback],
      ["Employer Email:", clientForm.clientEmail || lineFallback],
      ["Employer Address:", clientForm.clientAddress || lineFallback],
    ] as const;
    const resolvedEmployeeRows = [
      ["Employee Name:", resolvedEmployeeName],
      ["ID Number:", employeeForm.employeeIdOrPassportNumber || lineFallback],
      ...(employeeForm.jobTitle.trim() ? ([["Job Title:", employeeForm.jobTitle.trim()]] as const) : []),
      ...(employeeForm.department.trim() ? ([["Department:", employeeForm.department.trim()]] as const) : []),
      ...(employeeForm.employeeNumber.trim()
        ? ([["Employee Number:", employeeForm.employeeNumber.trim()]] as const)
        : []),
    ] as const;
    const resolvedWarningRows = [
      ["Offence(s):", formatWarningOffences(warningForm.misconductTypes, lineFallback)],
      ["Description:", warningForm.misconductDescription || lineFallback],
      ["Validity Period:", warningForm.validityPeriod ? `${warningForm.validityPeriod} months` : lineFallback],
      ["Issued By:", warningForm.issuedBy || lineFallback],
    ] as const;
    const resolvedLogoWarningRows = [
      ["Offence(s):", formatWarningOffences(warningForm.misconductTypes, lineFallback)],
      ["Description:", warningForm.misconductDescription || lineFallback],
      ["Warning Type:", warningForm.warningType ? warningTypeLabelByValue[warningForm.warningType] : lineFallback],
      ["Validity Period:", warningForm.validityPeriod ? `${warningForm.validityPeriod} months` : lineFallback],
      ["Issued By:", warningForm.issuedBy || lineFallback],
    ] as const;
    const signatureRows = [
      ["Employer/Issuer", "Date", "Employee", "Date"],
      ["Representative", "Date", "Interpreter", "Date"],
      ["Witness 1 (optional)", "Date", "Witness 2 (optional)", "Date"],
    ] as const;
    const consequenceText =
      warningForm.warningType === "final"
        ? "You are required to completely refrain from committing any further act(s) of misconduct. Should you commit the same or similar offence(s) within the validity period of this warning, you will be subjected to a disciplinary hearing and if found guilty, dismissal will result."
        : "You are required to completely refrain from committing any further act(s) of misconduct. Should you commit the same or similar offence(s) within the validity period of this warning, progressive disciplinary action will be taken which could lead to your dismissal.";
    const witnessNote =
      "If the employee refuses to sign this warning, the witness's signature will confirm that the employee did receive the warning and that the contents were explained to him/her.";
    const footerAddressLines = buildDiscWarningFooterAddressLines(clientForm);

    let y = 14;

    const ensureSpace = (needed: number) => {
      if (y + needed <= bottomLimit) return;
      doc.addPage();
      y = 18;
    };

    const drawSectionHeader = (title: string) => {
      ensureSpace(10);
      doc.setDrawColor(...sectionBorder);
      doc.setFillColor(...sectionFill);
      doc.roundedRect(margin, y, contentWidth, 8.5, 0.8, 0.8, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text(title, margin + 4.5, y + 5.4);
      y += 15;
    };

    const drawKeyValueRows = (
      rows: readonly (readonly [string, string])[],
      options?: {
        extraTopByLabel?: Partial<Record<string, number>>;
        fullWidthValueByLabel?: Partial<Record<string, boolean>>;
      },
    ) => {
      const labelWidth = 42;
      const valueWidth = contentWidth - labelWidth - 4;
      const lineHeight = 3.7;
      rows.forEach(([label, value]) => {
        const extraTop = options?.extraTopByLabel?.[label] ?? 0;
        if (extraTop > 0) {
          ensureSpace(extraTop);
          y += extraTop;
        }
        const useFullWidthValue = Boolean(options?.fullWidthValueByLabel?.[label]);
        const fullWidthValueX = margin + labelWidth;
        const fullWidthValueWidth = contentWidth - labelWidth;
        const valueLines = doc.splitTextToSize(value, useFullWidthValue ? fullWidthValueWidth : valueWidth);
        const rowHeight = useFullWidthValue
          ? Math.max(4.2, valueLines.length * lineHeight)
          : Math.max(4.2, valueLines.length * lineHeight);
        ensureSpace(rowHeight);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(label, margin, y);
        doc.setFont("helvetica", "normal");
        if (useFullWidthValue) {
          valueLines.forEach((line, index) => {
            const lineY = y + index * lineHeight;
            const isLastLine = index === valueLines.length - 1;
            const words = String(line).trim().split(/\s+/).filter(Boolean);
            if (isLastLine || words.length <= 1) {
              doc.text(String(line), fullWidthValueX, lineY);
              return;
            }
            const lineWidth = doc.getTextWidth(String(line));
            const extraSpace = fullWidthValueWidth - lineWidth;
            const gapCount = words.length - 1;
            let x = fullWidthValueX;
            words.forEach((word, wordIndex) => {
              doc.text(word, x, lineY);
              x += doc.getTextWidth(word);
              if (wordIndex < gapCount) {
                x += doc.getTextWidth(" ") + extraSpace / gapCount;
              }
            });
          });
          y += rowHeight + 0.5;
          return;
        }
        valueLines.forEach((line, index) => {
          const lineY = y + index * lineHeight;
          const isLastLine = index === valueLines.length - 1;
          const words = String(line).trim().split(/\s+/).filter(Boolean);
          if (isLastLine || words.length <= 1) {
            doc.text(String(line), margin + labelWidth, lineY);
            return;
          }
          const lineWidth = doc.getTextWidth(String(line));
          const extraSpace = valueWidth - lineWidth;
          const gapCount = words.length - 1;
          let x = margin + labelWidth;
          words.forEach((word, wordIndex) => {
            doc.text(word, x, lineY);
            x += doc.getTextWidth(word);
            if (wordIndex < gapCount) {
              x += doc.getTextWidth(" ") + extraSpace / gapCount;
            }
          });
        });
        y += rowHeight + 0.5;
      });
    };

    const drawJustifiedParagraph = (text: string, lineHeight = 4.9) => {
      const lines = doc.splitTextToSize(text, contentWidth) as string[];
      lines.forEach((line, index) => {
        ensureSpace(lineHeight);
        const isLastLine = index === lines.length - 1;
        const words = line.trim().split(/\s+/).filter(Boolean);
        if (isLastLine || words.length <= 1) {
          doc.text(line, margin, y);
          y += lineHeight;
          return;
        }
        const lineWidth = doc.getTextWidth(line);
        const extraSpace = contentWidth - lineWidth;
        const gapCount = words.length - 1;
        let x = margin;
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

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text(resolvedTitle.toUpperCase(), pageWidth / 2, y, { align: "center" });
    y += hasLogoLayout ? 14 : 10;

    if (!hasLogoLayout) {
      drawSectionHeader("A. EMPLOYER DETAILS");
      drawKeyValueRows(resolvedEmployerRows);
      y += 4;
    }

    drawSectionHeader(hasLogoLayout ? "A. EMPLOYEE DETAILS" : "B. EMPLOYEE DETAILS");
    drawKeyValueRows(resolvedEmployeeRows);

    y += 4;
    drawSectionHeader(hasLogoLayout ? "B. WARNING DETAILS" : "C. WARNING DETAILS");
    drawKeyValueRows(hasLogoLayout ? resolvedLogoWarningRows : resolvedWarningRows, {
      extraTopByLabel: { "Validity Period:": 0.6 },
      fullWidthValueByLabel: { "Description:": true },
    });

    y += 4;
    drawSectionHeader(hasLogoLayout ? "C. CONSEQUENCES" : "D. CONSEQUENCES");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    drawJustifiedParagraph(consequenceText, 3.7);

    y += 4;
    drawSectionHeader(hasLogoLayout ? "D. SIGNATURES" : "E. SIGNATURES");
    y += 10;

    const signatureGap = 10;
    const totalSignatureGap = signatureGap * 3;
    const availableSignatureWidth = contentWidth - totalSignatureGap;
    const signatureColumnWidths = [
      availableSignatureWidth * 0.35,
      availableSignatureWidth * 0.15,
      availableSignatureWidth * 0.35,
      availableSignatureWidth * 0.15,
    ];
    signatureRows.forEach((row) => {
      ensureSpace(19);
      let x = margin;
      row.forEach((label, index) => {
        const width = signatureColumnWidths[index];
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.2);
        doc.line(x, y, x + width, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(label, x, y + 4.2);
        x += width + signatureGap;
      });
      y += 17;
    });

    ensureSpace(12);
    doc.setDrawColor(...sectionBorder);
    doc.setFillColor(...sectionFill);
    doc.roundedRect(margin, y, contentWidth, 11, 0.8, 0.8, "FD");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.6);
    doc.setTextColor(63, 63, 70);
    const noteLines = doc.splitTextToSize(witnessNote, contentWidth - 6);
    const noteLineHeight = 3.7;
    const noteTextHeight = noteLines.length * noteLineHeight;
    const noteStartY = y + (11 - noteTextHeight) / 2 + 3;
    doc.text(noteLines, margin + 3, noteStartY);

    if (hasLogoLayout) {
      const footerTop = pageHeight - 30;
      const footerLogoDimensions = getDiscWarningFooterLogoDimensions(clientForm.companyLogoOrientation);
      const footerLogoWidthLimit = footerLogoDimensions.pdfMaxWidth;
      const footerLogoHeightLimit = footerLogoDimensions.pdfMaxHeight;
      const footerTextX = margin;
      const footerTextWidth = contentWidth - 40;
      const footerLineHeight = 3.4;
      const footerIconX = footerTextX;
      const footerValueX = footerTextX + 5.2;
      const footerIconSize = 2.6;
      const pdfBriefcaseIconDataUrl = createDiscWarningPdfBriefcaseIconDataUrl();
      const pdfPhoneIconDataUrl = createDiscWarningPdfPhoneIconDataUrl();
      const pdfMailIconDataUrl = createDiscWarningPdfMailIconDataUrl();
      const pdfLocationIconDataUrl = createDiscWarningPdfLocationIconDataUrl();
      const drawFooterIcon = (dataUrl: string | null, lineY: number) => {
        if (!dataUrl) return;
        try {
          doc.addImage(dataUrl, "PNG", footerIconX, lineY - 2.15, footerIconSize, footerIconSize);
        } catch {
          // Keep generating even if a footer icon fails to render.
        }
      };

      doc.setDrawColor(203, 213, 225);
      doc.line(margin, footerTop - 3, pageWidth - margin, footerTop - 3);

      if (clientForm.companyLogoDataUrl) {
        try {
          const imageProperties = doc.getImageProperties(clientForm.companyLogoDataUrl);
          const imageRatio = imageProperties.width / imageProperties.height;
          let logoWidth = footerLogoWidthLimit;
          let logoHeight = logoWidth / imageRatio;
          if (logoHeight > footerLogoHeightLimit) {
            const scale = footerLogoHeightLimit / logoHeight;
            logoHeight = footerLogoHeightLimit;
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
      doc.setFontSize(7.8);
      const companyNameLines = doc.splitTextToSize(clientForm.clientName || "", footerTextWidth);
      doc.text(companyNameLines, footerTextX, footerY);
      footerY += companyNameLines.length * footerLineHeight;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.2);
      if (clientForm.registrationNumber) {
        drawFooterIcon(pdfBriefcaseIconDataUrl, footerY);
        const registrationLines = doc.splitTextToSize(clientForm.registrationNumber, footerTextWidth - 5.2);
        doc.text(registrationLines, footerValueX, footerY);
        footerY += registrationLines.length * footerLineHeight;
      }
      if (clientForm.clientContactNumber) {
        drawFooterIcon(pdfPhoneIconDataUrl, footerY);
        doc.text(clientForm.clientContactNumber, footerValueX, footerY);
        footerY += footerLineHeight;
      }
      if (clientForm.clientEmail) {
        drawFooterIcon(pdfMailIconDataUrl, footerY);
        const emailLines = doc.splitTextToSize(clientForm.clientEmail, footerTextWidth - 5.2);
        doc.text(emailLines, footerValueX, footerY);
        footerY += emailLines.length * footerLineHeight;
      }
      if (footerAddressLines.length > 0) {
        drawFooterIcon(pdfLocationIconDataUrl, footerY);
        const [firstAddressLine, ...remainingAddressLines] = footerAddressLines;
        const firstAddressLines = doc.splitTextToSize(firstAddressLine, footerTextWidth - 5.2);
        doc.text(firstAddressLines, footerValueX, footerY);
        footerY += firstAddressLines.length * footerLineHeight;
        remainingAddressLines.forEach((line) => {
          const addressLines = doc.splitTextToSize(line, footerTextWidth - 5.2);
          doc.text(addressLines, footerValueX, footerY);
          footerY += addressLines.length * footerLineHeight;
        });
      }
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

    const fileTitle =
      (warningForm.warningType ? warningTypeLabelByValue[warningForm.warningType] : "Disciplinary Warning Form")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "disciplinary-warning-form";
    const employeeInitials = employeeForm.employeeName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((namePart) => `${namePart.charAt(0).toUpperCase()}.`)
      .join("");
    const employeeSurname = employeeForm.employeeSurname.trim();
    const documentNameSuffix =
      employeeInitials && employeeSurname ? ` (${employeeInitials} ${employeeSurname})` : "";
    const warningLabel = warningForm.warningType ? warningTypeLabelByValue[warningForm.warningType] : "Warning";
    const documentName = `${warningLabel}${documentNameSuffix}`;
    const downloadFileTitle =
      warningLabel
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "") || "warning";
    const downloadFileName = `${downloadFileTitle}${documentNameSuffix}.pdf`;
    const uploadBlob = doc.output("blob");
    const uploadSafeClientName =
      (clientForm.clientName || "client")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "client";
    const uploadSafeDocumentName =
      documentName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "warning";
    const uploadFilePath = [
      "warnings-2",
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

    const userMetadata =
      user?.user_metadata && typeof user.user_metadata === "object"
        ? (user.user_metadata as Record<string, unknown>)
        : {};

    const logResult = await logGeneratedDocument({
      documentLabel: warningLabel,
      documentName,
      documentType: "Warning",
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
      const errorMessage = logResult.error;
      toast({
        title: "Save Error",
        description: `Could not save document row: ${errorMessage}`,
        variant: "destructive",
      });
    } else {
      window.dispatchEvent(new CustomEvent("documents-row-created"));
    }

    doc.save(downloadFileName);
    onRequestClose?.();
  }, [clientForm, employeeForm, onRequestClose, user, warningForm]);

  const isEmployeeStepComplete =
    employeeForm.employeeName.trim().length > 0 &&
    employeeForm.employeeSurname.trim().length > 0 &&
    employeeForm.employeeIdOrPassportNumber.trim().length > 0;
  const isWarningStepComplete =
    warningForm.misconductTypes.length > 0 &&
    warningForm.misconductDescription.trim().length > 0 &&
    Boolean(warningForm.warningType) &&
    warningForm.validityPeriod.trim().length > 0;

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
            ? isEmployeeStepComplete
            : activeStep === 2
              ? isWarningStepComplete
              : activeStep <= 2),
      canGoBack: isFinished || activeStep > 0,
      canSelectStep: (index: number) => {
        if (index < 0 || index > 3) return false;
        if (isFinished) return index >= 0 && index <= 3;
        if (activeStep === 0) return index === 0;
        if (activeStep === 1) return index >= 0 && index <= 1;
        if (activeStep === 2) return index >= 0 && index <= 2;
        return false;
      },
      onNext: () => {
        if (isFinished) {
          handleDownloadPdf();
          return;
        }
        if (activeStep === 0 && !clientForm.clientId) return;
        if (activeStep === 1 && !isEmployeeStepComplete) return;
        if (activeStep === 2 && !isWarningStepComplete) return;
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
          setWarningForm(emptyWarningFormState);
          setMisconductSearchOpen(false);
        }
      },
      isFinished,
      supportsResetAtFirstStep: activeStep === 0 && Boolean(clientForm.clientId),
    }),
    [
      activeStep,
      clientForm.clientId,
      handleDownloadPdf,
      isEmployeeStepComplete,
      isFinished,
      isWarningStepComplete,
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
      warningForm,
    } satisfies DiscWarningGeneratorDraftState);
  }, [activeStep, clientForm, employeeForm, isFinished, onDraftStateChange, warningForm]);

  const content = (
    <DiscWarningGeneratorContent
      activeStep={activeStep}
      isFinished={isFinished}
      clientRows={clientRows}
      clientForm={clientForm}
      employeeForm={employeeForm}
      warningForm={warningForm}
      onEmployeeFormChange={handleEmployeeFormChange}
      onWarningFormChange={handleWarningFormChange}
      onWarningTypeChange={handleWarningTypeChange}
      misconductSearchOpen={misconductSearchOpen}
      setMisconductSearchOpen={setMisconductSearchOpen}
      conductOffences={conductOffences}
      misconductLoadMessage={misconductLoadMessage}
      onMisconductToggle={handleMisconductToggle}
      clientSearchOpen={clientSearchOpen}
      setClientSearchOpen={setClientSearchOpen}
      onClientSelect={handleClientSelect}
      clientLoadMessage={clientLoadMessage}
      onClientLogoRemove={handleClientLogoRemove}
    />
  );

  if (embedded) {
    return content;
  }

  return <DashboardLayout profileSubtitleMode="company">{content}</DashboardLayout>;
};

export default DiscWarningGenerator;
