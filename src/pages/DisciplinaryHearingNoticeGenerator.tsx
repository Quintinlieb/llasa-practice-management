import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ComponentType, type ReactNode, type SVGProps } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Building2, User2, Briefcase, Bot, Check, Undo2, X, Info, Plus, Calendar, TriangleAlert, Mail, Phone, Palette } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
import { cn } from "@/lib/utils";
import {
  salaryFrequencyOptions,
  extractDobFromId,
  calculateAgeFromDob,
  type PermanentContractFormData,
} from "@/lib/validation";
import type { Tables } from "@/integrations/supabase/types";

type ContractFormState = {
  employeeId: string;
  age: string;
  companyLogoDataUrl: string;
  logoPlacement: "center";
  letterheadThemeColors: string[];
  issuer: string;
  hearingDate: string;
  hearingTime: string;
  hearingFormat: HearingFormat | "";
  hearingLocation: string;
  misconductTypes: string[];
  misconductDescriptions: Record<string, string>;
} & Omit<PermanentContractFormData, "salaryAmount" | "gender" | "race" | "annualLeaveDays"> & {
  salaryAmount: string;
  annualLeaveDays: string;
  gender: PermanentContractFormData["gender"] | "";
  race: PermanentContractFormData["race"] | "";
  contractReference: string;
  addendumType: AddendumType | "";
  effectiveDate: string;
  contractEndDate: string;
  newEndDate: string;
  idType: "id" | "passport";
};

type AmendmentType = "add" | "amend";
type AddendumType = "general" | "renewal" | "extension";
type HearingFormat = "in_person" | "virtual";

type AddendumData = PermanentContractFormData & {
  contractReference: string;
  addendumType: AddendumType;
  effectiveDate: string;
  contractEndDate: string;
  newEndDate: string;
  idType: "id" | "passport";
  companyLogoDataUrl: string;
  logoPlacement: "center";
  letterheadThemeColors: string[];
  issuer: string;
  hearingDate: string;
  hearingTime: string;
  hearingFormat: HearingFormat;
  hearingLocation: string;
  misconductTypes: string[];
  misconductDescriptions: Record<string, string>;
};

type SlimProfile = Pick<
  Tables<"profiles">,
  "id" | "company_name" | "company_type" | "registration_number" | "physical_address" | "company_contact" | "company_email"
>;
type SlimEmployee = {
  id: string;
  id_number: string | null;
  employee_name: string;
  employee_surname: string;
  nationality: string | null;
  emergency_contact_number: string | null;
  gender: string | null;
  race: string | null;
  cell_number: string | null;
  email: string | null;
  job_title: string | null;
  start_date: string | null;
  employee_number: string | null;
};
type ClauseDefinition = {
  id: string;
  title: string;
  body: string | string[];
  amendmentType?: AmendmentType;
};

type CustomClause = ClauseDefinition & { insertAfterId: string | null; amendmentType: AmendmentType };

const salaryFrequencyLabels: Record<PermanentContractFormData["salaryFrequency"], string> = {
  month: "per month",
  week: "per week",
  day: "per day",
  hour: "per hour",
};

const probationOptions: PermanentContractFormData["probationPeriod"][] = ["1", "3", "6"];
const probationLabels: Record<PermanentContractFormData["probationPeriod"], string> = {
  "1": "1 Month",
  "3": "3 Months",
  "6": "6 Months",
};

const retirementAgeOptions: PermanentContractFormData["retirementAge"][] = ["55", "60", "65"];

const addendumTypeOptions: Array<{ value: AddendumType; label: string }> = [
  { value: "general", label: "General Addendum" },
  { value: "renewal", label: "Contract Renewal" },
  { value: "extension", label: "Contract Extension" },
];

const addendumTypeLabels: Record<AddendumType, string> = {
  general: "General Addendum",
  renewal: "Contract Renewal",
  extension: "Contract Extension",
};

const logoPlacementOptions = [
  { value: "center", label: "Header and footer" },
] as const;

const letterheadColorOptions = [
  { value: "#111827" }, // black
  { value: "#FF0000" }, // red
  { value: "#1e3a8a" }, // blue (dark)
  { value: "#166534" }, // green (dark)
  { value: "#facc15" }, // yellow
  { value: "#7f1d1d" }, // maroon
  { value: "#7c3aed" }, // purple
  { value: "#6b7280" }, // grey
  { value: "#ea580c" }, // orange
  { value: "#3b82f6" }, // blue (light)
  { value: "#0f766e" }, // teal
  { value: "#84cc16" }, // green (light)
  { value: "#ff6f61" }, // coral
  { value: "#ec4899" }, // pink
] as const;

const defaultDividerColor = "#6b7280";
const defaultIconColor = "#111827";
const defaultDividerLineRgb: [number, number, number] = [203, 213, 225];

const sanitizeThemeColors = (values?: string[]) => {
  const valid = new Set(letterheadColorOptions.map((option) => option.value.toLowerCase()));
  const input = Array.isArray(values) ? values : [];
  const normalizedValues: string[] = [];
  input.forEach((value) => {
    const normalized = (value || "").trim().toLowerCase();
    if (!valid.has(normalized)) return;
    const canonical = letterheadColorOptions.find((option) => option.value.toLowerCase() === normalized)?.value;
    if (!canonical) return;
    normalizedValues.push(canonical);
  });
  return normalizedValues.slice(0, 2);
};

const getThemeColors = (values?: string[]) => {
  const selected = sanitizeThemeColors(values);
  const dividerColor = selected[0] ?? defaultDividerColor;
  const iconColor =
    selected[1] ??
    (selected[0] && isGreyLetterheadColor(selected[0]) ? selected[0] : defaultIconColor);
  return { selected, dividerColor, iconColor };
};

const hexToRgb = (hex: string): [number, number, number] => {
  const normalized = hex.replace("#", "");
  const full = normalized.length === 3
    ? normalized.split("").map((char) => `${char}${char}`).join("")
    : normalized;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((channel) => Number.isNaN(channel))) return [29, 78, 216];
  return [r, g, b];
};

const isBlackLetterheadColor = (hex: string) => hex.toLowerCase() === "#111827";
const isGreyLetterheadColor = (hex: string) => hex.toLowerCase() === "#6b7280";
const shouldTintDividerLines = (hex: string) => !isBlackLetterheadColor(hex) && !isGreyLetterheadColor(hex);

const hexToRgba = (hex: string, alpha: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const mixHexWithWhite = (hex: string, alpha = 0.5): [number, number, number] => {
  const [r, g, b] = hexToRgb(hex);
  const blend = (channel: number) => Math.round(channel * alpha + 255 * (1 - alpha));
  return [blend(r), blend(g), blend(b)];
};

const getPreviewDividerColor = (hex: string) => {
  if (isBlackLetterheadColor(hex)) return hex;
  if (isGreyLetterheadColor(hex)) return undefined;
  return hexToRgba(hex, 0.5);
};

const getPdfDividerRgb = (hex: string): [number, number, number] => {
  if (isBlackLetterheadColor(hex)) return hexToRgb(hex);
  if (isGreyLetterheadColor(hex)) return defaultDividerLineRgb;
  return mixHexWithWhite(hex, 0.5);
};

const MISCONDUCT_TYPES = [
  "Unauthorised Absenteeism",
  "Poor Time Keeping",
  "Sleeping On Duty",
  "Using Phone on Duty",
  "Insubordination",
  "Insolent Behaviour",
  "Unauthorised Possession",
  "Unauthorised Excess",
  "Unauthorised Removal",
  "Testing Positive for Alcohol",
  "Intoxicated at Work",
  "Dereliction of Duties",
  "Negligence",
  "Dishonesty",
  "Breach of Policy",
  "Breach of Rule(s)",
  "Breach of Procedure",
] as const;

const HEARING_FORMAT_OPTIONS = [
  { value: "in_person", label: "In person" },
  { value: "virtual", label: "Virtual" },
] as const;

const HEARING_RIGHTS_INTRO = "Please note that your rights at the hearing are as follows:";

const HEARING_RIGHTS_ITEMS = [
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

const SIGNATURE_LABELS = [
  "Employer/Issuer",
  "Employee",
  "Representative (optional)",
  "Interpreter (optional)",
  "Witness 1 (optional)",
  "Witness 2 (optional)",
] as const;

const SIGNATURE_REFUSAL_NOTE =
  "If the employee refuses to sign this notice, the witness's signature will confirm that the employee did receive the notice and that the contents were explained to him/her.";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", minimumFractionDigits: 2 }).format(amount);

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
};

const getTimeMeridiem = (value: string) => {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return "";
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
  return hour >= 12 ? "PM" : "AM";
};

const formatTime = (value: string) => {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return value;
  const [, hourRaw, minute] = match;
  const meridiem = getTimeMeridiem(value);
  return meridiem ? `${hourRaw}:${minute} ${meridiem}` : `${hourRaw}:${minute}`;
};

const hearingTimeOptions = Array.from({ length: 96 }, (_, index) => {
  const hour = Math.floor(index / 4);
  const minute = ["00", "15", "30", "45"][index % 4];
  const value = `${String(hour).padStart(2, "0")}:${minute}`;
  return {
    value,
    label: formatTime(value),
  };
});

const normalizeHearingTimeInput = (value: string) => {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return trimmed;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return trimmed;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return trimmed;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const toDisplayDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
};

const toIsoDate = (value: string) => {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const day = d.padStart(2, "0");
  const month = m.padStart(2, "0");
  const iso = `${y}-${month}-${day}`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : iso;
};

const fillClausePlaceholders = (body: string | string[], contractRef: string, effectiveDate: string, newEndDate = "") => {
  const replaceText = (text: string) =>
    text
      .replace("[contract reference]", contractRef)
      .replace("[effective date]", effectiveDate)
      .replace("[new end date]", newEndDate || "________________________");
  return Array.isArray(body) ? body.map(replaceText) : replaceText(body);
};

const extractYear = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 4) : String(date.getFullYear());
};

const makeClauseId = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/(^-|-$)/g, "");

const withClauseIds = (clauses: Array<Omit<ClauseDefinition, "id">>): ClauseDefinition[] =>
  clauses.map((clause) => ({ ...clause, id: makeClauseId(clause.title) }));

const generateCustomClauseId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const SAME_DAY_HEARING_NOTICE_CAUTION = "__SAME_DAY_HEARING_NOTICE_CAUTION__";

const deriveAgeFromId = (id: string) => {
  const dob = extractDobFromId(id);
  if (!dob) return "";
  return String(calculateAgeFromDob(dob));
};

const formatMisconductDetails = (
  types: string[],
  descriptions: Record<string, string>,
) => {
  const details = types
    .map((type) => {
      const description = (descriptions[type] || "").trim();
      return description ? `${type}: ${description}` : type;
    })
    .filter(Boolean);

  if (details.length === 0) return "[misconduct details]";
  if (details.length === 1) return details[0];
  return details.join("; ");
};

const formatHearingPlaceDisplay = (hearingFormat: HearingFormat | "", hearingLocation: string) => {
  const value = hearingLocation.trim();
  if (!value) return "";
  if (hearingFormat === "virtual") return `Virtual - ${value}`;
  return value;
};

const emptyDraftingAssistantAnswers = {
  misconductOccurredWhen: "",
  whatHappened: "",
  involvementSelection: "",
  additionalDetails: "",
};

const draftingAssistantInvolvementOptions = [
  { value: "directly_committed", label: "Directly committed the act" },
  { value: "assisted_someone", label: "Assisted someone" },
  { value: "failed_to_act", label: "Failed to act" },
  { value: "not_sure", label: "Not sure" },
] as const;

const requiresInvolvementSelection = (chargeType: string | null) => {
  if (!chargeType) return false;
  const normalized = chargeType.toLowerCase();
  if (normalized.includes("theft")) return true;
  if (normalized.includes("fraud")) return true;
  if (normalized.includes("dishonesty")) return true;
  return normalized.includes("intentional") && normalized.includes("damage to property");
};

const formatCompanyDisplayName = (companyName?: string | null, companyType?: string | null) => {
  const name = (companyName || "").trim();
  const type = (companyType || "").trim();
  if (!name && !type) return "";
  if (!name) return type;
  if (!type) return name;
  if (name.toLowerCase().includes(type.toLowerCase())) return name;
  return `${name} ${type}`;
};

const trimLogoWhitespace = (dataUrl: string): Promise<string> =>
  new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (!width || !height) {
        resolve(dataUrl);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const pixels = imageData.data;

      const findBounds = (ignoreNearWhite: boolean) => {
        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;

        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const idx = (y * width + x) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            const a = pixels[idx + 3];

            if (a <= 20) continue;

            if (ignoreNearWhite && r >= 245 && g >= 245 && b >= 245) continue;

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
        // Fallback for very light logos where near-white is actual content.
        bounds = findBounds(false);
      }

      if (!bounds) {
        resolve(dataUrl);
        return;
      }

      const pad = 2;
      const cropX = Math.max(0, bounds.minX - pad);
      const cropY = Math.max(0, bounds.minY - pad);
      const cropW = Math.min(width - cropX, bounds.maxX - bounds.minX + 1 + pad * 2);
      const cropH = Math.min(height - cropY, bounds.maxY - bounds.minY + 1 + pad * 2);

      const cropped = document.createElement("canvas");
      cropped.width = cropW;
      cropped.height = cropH;
      const croppedCtx = cropped.getContext("2d");
      if (!croppedCtx) {
        resolve(dataUrl);
        return;
      }

      croppedCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      resolve(cropped.toDataURL("image/png"));
    };

    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });

const createLucidePdfIconDataUrl = (
  draw: (ctx: CanvasRenderingContext2D) => void,
  options?: { size?: number; strokeColor?: string },
): string | null => {
  if (typeof document === "undefined" || typeof Path2D === "undefined") return null;
  const size = options?.size ?? 24;
  const strokeColor = options?.strokeColor ?? "#000";
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  draw(ctx);

  return canvas.toDataURL("image/png");
};

const createPdfPhoneIconDataUrl = (strokeColor = "#000") =>
  createLucidePdfIconDataUrl((ctx) => {
    const path = new Path2D(
      "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z",
    );
    ctx.stroke(path);
  }, { strokeColor });

const createPdfMailIconDataUrl = (strokeColor = "#000") =>
  createLucidePdfIconDataUrl((ctx) => {
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

    const flap = new Path2D("m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7");
    ctx.stroke(flap);
  }, { strokeColor });

type FirstPagePreviewProps = {
  data: AddendumData;
  compact?: boolean;
  children?: ReactNode;
  profile: SlimProfile | null;
  logoPreviewUrl?: string;
};

const FirstPagePreview = ({ data, compact = false, children, profile, logoPreviewUrl }: FirstPagePreviewProps) => {
  const displayValue = (value?: string | number | null) => (value && value.toString().trim() ? value.toString() : "________________________");
  const companyNameDisplay = displayValue(formatCompanyDisplayName(profile?.company_name, profile?.company_type));
  const tradingNameDisplay = (data.tradingName || "").trim();
  const registrationNumberDisplay = (profile?.registration_number || "").trim();
  const hasUploadedLogo = Boolean(logoPreviewUrl);
  const useCenteredLogoLayout = hasUploadedLogo;
  const useFooterCompanyDetails = useCenteredLogoLayout || !hasUploadedLogo;
  const { dividerColor, iconColor } = getThemeColors(data.letterheadThemeColors);
  const previewDividerColor = getPreviewDividerColor(dividerColor);
  const previewDividerStyle = previewDividerColor ? { borderColor: previewDividerColor } : undefined;
  const companyIdentityDisplay = tradingNameDisplay
    ? `${companyNameDisplay} t/a ${tradingNameDisplay}`
    : companyNameDisplay;
  const companyAddressLines = (profile?.physical_address || "Address")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const companyAddressDisplay = companyAddressLines.length > 0 ? companyAddressLines.join(", ") : "Address";

  return (
    <div
      className={cn(
        "bg-white text-black mx-auto shadow-sm flex flex-col",
        hasUploadedLogo ? "px-8 py-4" : "p-8",
      )}
      style={{ width: "210mm", minHeight: compact ? undefined : "297mm" }}
    >
      <div className="flex-1 flex flex-col text-[12px] leading-relaxed text-black">
        {useCenteredLogoLayout ? (
          <div className="flex justify-center">
            <img
              src={logoPreviewUrl}
              alt="Company logo"
              className="max-h-[25mm] w-auto max-w-[220px] object-contain"
            />
          </div>
        ) : null}
        {hasUploadedLogo ? (
          <div className={cn("border-t border-slate-300", useCenteredLogoLayout ? "mt-6" : "mt-4")} style={previewDividerStyle} aria-hidden="true" />
        ) : null}
        <div className="mt-5 space-y-4">{children}</div>
        {useFooterCompanyDetails ? (
          <div className="mt-auto border-t border-slate-300 pt-2 text-center leading-[1.2] text-[9px]" style={previewDividerStyle}>
            <p className="font-semibold">{companyIdentityDisplay}</p>
            {registrationNumberDisplay ? <p className="mt-0.5">Reg No: {registrationNumberDisplay}</p> : null}
            <p className="mt-0.5">{companyAddressDisplay}</p>
            <div className="mt-1 flex items-center justify-center gap-4">
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" style={{ color: iconColor }} />
                {displayValue(data.employerContact)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3" style={{ color: iconColor }} />
                {displayValue(data.employerEmail)}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const MisconductTerminationGenerator = ({
  embedded = false,
  externalNavigation = false,
  onStepChange,
  onStepMetaChange,
}: {
  embedded?: boolean;
  externalNavigation?: boolean;
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
    addendumType?: AddendumType | "";
    isFinished?: boolean;
    isPreviewEditable?: boolean;
    supportsPreviewEditToggle?: boolean;
  }) => void;
}) => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const employeePrefillAppliedRef = useRef(false);
  const maxDailyDraftingPrompts = 7;

  const [profile, setProfile] = useState<SlimProfile | null>(null);
  const [employees, setEmployees] = useState<SlimEmployee[]>([]);
  const [conductOffences, setConductOffences] = useState<
    { category: "Minor" | "Serious" | "Dismissible"; name: string; firstOutcome: string }[]
  >([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [showFinalActions, setShowFinalActions] = useState(false);
  const [isPreviewEditable, setIsPreviewEditable] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [validatedPreview, setValidatedPreview] = useState<AddendumData | null>(null);
  const [clauseEdits, setClauseEdits] = useState<Record<string, string>>({});
  const [customClauseTitleEdits, setCustomClauseTitleEdits] = useState<Record<string, string>>({});
  const [editingClause, setEditingClause] = useState<string | null>(null);
  const [clauseDraft, setClauseDraft] = useState("");
  const [customClauseTitleDraft, setCustomClauseTitleDraft] = useState("");
  const [customClauses, setCustomClauses] = useState<CustomClause[]>([]);
  const [addingAfter, setAddingAfter] = useState<string | null | undefined>(undefined);
  const [newClauseBody, setNewClauseBody] = useState("");
  const steps = ["Employer Details", "Employee Details", "Notice Details"] as const;
  const stepIcons = [Building2, User2, Briefcase] as const;
  const [activeStep, setActiveStep] = useState(0);
  const [employeeSearchOpen, setEmployeeSearchOpen] = useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [formData, setFormData] = useState<ContractFormState>({
    employeeId: "",
    age: "",
    companyLogoDataUrl: "",
    logoPlacement: "center",
    letterheadThemeColors: [defaultDividerColor, defaultIconColor],
    issuer: "",
    hearingDate: "",
    hearingTime: "",
    hearingFormat: "",
    hearingLocation: "",
    misconductTypes: [],
    misconductDescriptions: {},
    contractReference: "",
    addendumType: "general",
    effectiveDate: "",
    contractEndDate: "",
    newEndDate: "",
    idType: "id",
    startDate: new Date().toISOString().split("T")[0],
    issueDate: new Date().toISOString().split("T")[0],
    employeeName: "",
    employeeSurname: "",
    employeeIdNumber: "",
    passportNumber: "",
    employeeAddress: "",
    employeePostalAddress: "",
    employeeNumber: "",
    nationality: "South African",
    gender: "",
    race: "",
    employeeCell: "",
    alternativeContact: "",
    employeeEmail: "",
    tradingName: "",
    employerContact: profile?.company_contact || "",
    employerEmail: profile?.company_email || "",
    jobTitle: "",
    salaryAmount: "",
    annualLeaveDays: "15",
    salaryFrequency: "month",
    probationPeriod: "3",
    department: "",
    retirementAge: "65",
    workplace: profile?.physical_address || "",
    interpreter: "no",
    reportsTo: "",
    additionalNotes: "",
  });
  const [sameDayCaution, setSameDayCaution] = useState<{ open: boolean; pendingAction: "" | "finish" | "download" }>({
    open: false,
    pendingAction: "",
  });
  const [sameDayOverrideAccepted, setSameDayOverrideAccepted] = useState(false);
  const [sameDayCautionDismissed, setSameDayCautionDismissed] = useState(false);
  const [misconductSearch, setMisconductSearch] = useState("");
  const [misconductPickerOpen, setMisconductPickerOpen] = useState(false);
  const [draftMisconductTypes, setDraftMisconductTypes] = useState<string[]>([]);
  const [draftingAssistantOpen, setDraftingAssistantOpen] = useState(false);
  const [draftingAssistantChargeType, setDraftingAssistantChargeType] = useState<string | null>(null);
  const [isDraftingAssistantGenerating, setIsDraftingAssistantGenerating] = useState(false);
  const [remainingDraftingPrompts, setRemainingDraftingPrompts] = useState(maxDailyDraftingPrompts);
  const [draftingAssistantFocusedField, setDraftingAssistantFocusedField] = useState<
    "misconductOccurredWhen" | "whatHappened" | "additionalDetails" | null
  >(null);
  const [draftingAssistantAnswers, setDraftingAssistantAnswers] = useState(emptyDraftingAssistantAnswers);
  const [draftingAssistantAccepted, setDraftingAssistantAccepted] = useState(false);
  const [aiGeneratedChargeTypes, setAiGeneratedChargeTypes] = useState<string[]>([]);
  const [hearingTimeFocused, setHearingTimeFocused] = useState(false);
  const [hearingTimeSelectOpen, setHearingTimeSelectOpen] = useState(false);
  const [hearingTimeFieldVersion, setHearingTimeFieldVersion] = useState(0);
  const [colorThemePickerOpen, setColorThemePickerOpen] = useState(false);
  const [draftLetterheadThemeColors, setDraftLetterheadThemeColors] = useState<string[]>([]);
  const noticeDatePickerRef = useRef<HTMLInputElement | null>(null);
  const hearingDatePickerRef = useRef<HTMLInputElement | null>(null);
  const contractReferencePickerRef = useRef<HTMLInputElement | null>(null);
  const contractEndDatePickerRef = useRef<HTMLInputElement | null>(null);
  const newEndDatePickerRef = useRef<HTMLInputElement | null>(null);
  const companyLogoInputRef = useRef<HTMLInputElement | null>(null);
  const employeeSearchInputRef = useRef<HTMLInputElement | null>(null);
  const misconductSearchInputRef = useRef<HTMLInputElement | null>(null);
  const hearingTimeInputRef = useRef<HTMLInputElement | null>(null);
  const skipHearingTimeBlurCommitRef = useRef(false);
  const clauseFieldFocusRef = useRef<HTMLElement | null>(null);
  const editClauseTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const addClauseTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const previewScrollTop = useRef(0);
  const [companyLogoPreview, setCompanyLogoPreview] = useState<string>("");
  const baseModalFieldClass =
    "h-8 rounded border border-slate-200 bg-white !text-[11px] md:!text-[11px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] placeholder:!text-slate-400 hover:border-blue-400 !focus-visible:border-[1.75px] !focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:bg-white disabled:text-slate-900 disabled:border-slate-200 disabled:opacity-100 disabled:cursor-default";
  const addendumModalDropdownToneClass =
    "bg-white border-slate-300 hover:border-blue-400 data-[state=open]:border-slate-300 data-[state=open]:bg-white";
  const addendumModalSelectContentClass = "!rounded";
  const addendumModalSelectItemClass =
    "!rounded text-[11px] text-slate-700 focus:bg-blue-50/70 focus:text-blue-600 data-[highlighted]:bg-blue-50/70 data-[highlighted]:text-blue-600 data-[state=checked]:text-slate-700 data-[state=checked]:data-[highlighted]:text-slate-700";
  const getAddendumModalInputClass = (isComplete: boolean) =>
    `${baseModalFieldClass} !h-[34px] !border-[1.75px] !border-slate-300 !focus-visible:border-slate-300 ${isComplete ? "!border-emerald-500" : ""}`;
  const getAddendumModalTextareaClass = (isComplete: boolean) =>
    `${baseModalFieldClass} !border-[1.75px] !border-slate-300 !focus-visible:border-slate-300 ${isComplete ? "!border-emerald-500" : ""}`;
  const getAddendumModalSelectTriggerClass = (isComplete: boolean) =>
    `${baseModalFieldClass} !rounded justify-between data-[placeholder]:text-slate-400 data-[placeholder]:text-xs !h-[34px] !border-[1.75px] !border-slate-300 !focus:border-blue-600 !focus-visible:border-blue-600 data-[state=open]:!border-blue-600 !ring-0 !ring-offset-0 !outline-none !shadow-none !focus:ring-0 !focus:ring-offset-0 !focus:shadow-none !focus:outline-none !focus-visible:ring-0 !focus-visible:ring-offset-0 !focus-visible:shadow-none !focus-visible:outline-none data-[state=open]:!ring-0 data-[state=open]:!ring-offset-0 data-[state=open]:!shadow-none data-[state=open]:!outline-none ${isComplete ? "!border-emerald-500" : ""}`;
  const modalFieldLabelClass = "text-[10px] font-semibold text-slate-400";
  const fixedTooltipContentClass = "!rounded w-[260px] max-w-[260px] whitespace-normal break-words text-xs";
  const snippetPaddingTopMm = 2;
  const snippetVisibleHeightMm = 297 / 2; // show top half of the page
  const snippetContainerWidthMm = 150;
  const snippetScale = useMemo(
    () =>
      Math.min(
        (snippetContainerWidthMm - 4) / 210, // small horizontal gutter so full width fits
        (160 - snippetPaddingTopMm) / snippetVisibleHeightMm,
      ),
    [snippetContainerWidthMm, snippetPaddingTopMm, snippetVisibleHeightMm],
  );
  const searchedEmployees = useMemo(() => {
    const query = employeeSearchQuery.trim().toLowerCase();
    return employees.filter((employee) => {
      if (!query) return true;
      const haystack = [
        employee.employee_name,
        employee.employee_surname,
        employee.employee_number,
        employee.id_number,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [employees, employeeSearchQuery]);
  const selectedLetterheadThemeColors = useMemo(
    () => sanitizeThemeColors(formData.letterheadThemeColors),
    [formData.letterheadThemeColors],
  );
  const misconductOptions = useMemo(() => {
    const fromConduct = conductOffences.map((offence) => offence.name);
    const merged = [...MISCONDUCT_TYPES, ...fromConduct, ...formData.misconductTypes];
    return Array.from(
      new Set(
        merged
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      ),
    );
  }, [conductOffences, formData.misconductTypes]);
  const filteredMisconductTypes = useMemo(() => {
    const query = misconductSearch.trim().toLowerCase();
    if (!query) return misconductOptions;
    return misconductOptions.filter((type) => type.toLowerCase().includes(query));
  }, [misconductOptions, misconductSearch]);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, company_name, company_type, registration_number, physical_address, company_contact, company_email")
      .eq("id", user.id)
      .maybeSingle();
    if (error) {
      console.warn("Unable to load profile", error);
      return;
    }
    if (data) setProfile(data as SlimProfile);
  }, [user]);

  const fetchEmployees = useCallback(async () => {
    if (!user) return;
    const { data, error } = await (supabase as any)
      .from("employees")
      .select(
        "id, id_number, employee_name, employee_surname, nationality, emergency_contact_number, gender, race, cell_number, email, job_title, start_date, employee_number",
      )
      .eq("company_id", user.id);
    if (error) {
      console.warn("Unable to load employees", error);
      return;
    }
    if (data) setEmployees(data as SlimEmployee[]);
  }, [user]);

  const fetchConductOffences = useCallback(async () => {
    if (!user) return;
    const { data, error } = await (supabase as any)
      .from("company_code_of_conduct")
      .select("data")
      .eq("company_id", user.id)
      .maybeSingle();

    if (error) {
      console.warn("Unable to load conduct offences", error);
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
            (offence.category as "Minor" | "Serious" | "Dismissible" | undefined) ?? sectionCategory ?? "Serious";
          return { name, category, firstOutcome: offence.first ?? "" };
        });
      })
      .filter(
        (item): item is { name: string; category: "Minor" | "Serious" | "Dismissible"; firstOutcome: string } =>
          Boolean(item?.name),
      );

    if (mapped.length > 0) {
      setConductOffences(mapped);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchEmployees();
      fetchConductOffences();
    }
  }, [user, fetchEmployees, fetchProfile, fetchConductOffences]);

  useEffect(() => {
    if (profile) {
      setFormData((prev) => ({
        ...prev,
        workplace: prev.workplace || profile.physical_address || "",
        employerContact: prev.employerContact || profile.company_contact || "",
        employerEmail: prev.employerEmail || profile.company_email || "",
      }));
    }
  }, [profile]);

  const handleEmployeeSelect = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    const employee = employees.find((emp) => emp.id === employeeId);
    if (!employee) return;
    const employeeNationality =
      (employee as Partial<Tables<"employees">> & { nationality?: PermanentContractFormData["nationality"] })
        .nationality || "South African";
    const hasIdNumber = Boolean(employee.id_number);
    const passportNumber = !hasIdNumber ? employee.id_number ?? "" : "";
    const emergencyContact =
      (employee as Partial<Tables<"employees">> & { emergency_contact_number?: string }).emergency_contact_number ?? "";
    const genderValue = (employee as Partial<Tables<"employees">> & { gender?: PermanentContractFormData["gender"] }).gender || "";
    const raceValue = (employee as Partial<Tables<"employees">> & { race?: PermanentContractFormData["race"] }).race || "";
    const cellNumber = (employee as Partial<Tables<"employees">> & { cell_number?: string }).cell_number ?? "";
    const emailAddress = (employee as Partial<Tables<"employees">> & { email?: string }).email ?? "";
    const jobTitle = (employee as Partial<Tables<"employees">> & { job_title?: string }).job_title ?? "";
    const startDate = (employee as Partial<Tables<"employees">> & { start_date?: string }).start_date ?? "";
    const employeeNumber = (employee as Partial<Tables<"employees">> & { employee_number?: string }).employee_number ?? "";
    const idNumber = hasIdNumber ? employee.id_number ?? "" : "";
    const ageFromId = hasIdNumber ? deriveAgeFromId(idNumber) : "";
    const nextIdType: "id" | "passport" = hasIdNumber ? "id" : "passport";

    setFormData((prev) => ({
      ...prev,
      employeeId,
      employeeName: employee.employee_name,
      employeeSurname: employee.employee_surname,
      employeeIdNumber: idNumber,
      passportNumber: passportNumber || prev.passportNumber,
      nationality: employeeNationality,
      alternativeContact: emergencyContact || prev.alternativeContact,
      gender: genderValue || prev.gender,
      race: raceValue || prev.race,
      employeeCell: cellNumber || prev.employeeCell,
      employeeEmail: emailAddress || prev.employeeEmail,
      jobTitle: jobTitle || prev.jobTitle,
      startDate: startDate || prev.startDate,
      employeeNumber: employeeNumber || prev.employeeNumber,
      age: ageFromId,
      idType: nextIdType,
    }));
  };

  useEffect(() => {
    if (employeePrefillAppliedRef.current) return;
    if (!location.state || typeof location.state !== "object") return;

    const state = location.state as {
      employeeName?: unknown;
      employeeSurname?: unknown;
      employeeIdNumber?: unknown;
    };

    const employeeName = typeof state.employeeName === "string" ? state.employeeName.trim() : "";
    const employeeSurname = typeof state.employeeSurname === "string" ? state.employeeSurname.trim() : "";
    const employeeIdNumber = typeof state.employeeIdNumber === "string" ? state.employeeIdNumber.trim() : "";

    if (!employeeName && !employeeSurname && !employeeIdNumber) {
      employeePrefillAppliedRef.current = true;
      return;
    }

    if (!employees.length) return;

    const fullName = `${employeeName} ${employeeSurname}`.trim().toLowerCase();
    const idDigits = employeeIdNumber.replace(/\D/g, "");

    const matchedEmployee = employees.find((employee) => {
      const employeeFullName = `${employee.employee_name ?? ""} ${employee.employee_surname ?? ""}`.trim().toLowerCase();
      const rawId = (employee.id_number ?? "").trim();
      const rawDigits = rawId.replace(/\D/g, "");
      const matchesId =
        employeeIdNumber.length > 0 &&
        (rawId.toLowerCase() === employeeIdNumber.toLowerCase() || (idDigits.length > 0 && rawDigits === idDigits));
      const matchesName = fullName.length > 0 && employeeFullName === fullName;
      return matchesId || matchesName;
    });

    if (matchedEmployee) {
      handleEmployeeSelect(matchedEmployee.id);
    }

    employeePrefillAppliedRef.current = true;
  }, [employees, handleEmployeeSelect, location.state]);

  const resetForm = () => {
    setFormData({
      employeeId: "",
      age: "",
      companyLogoDataUrl: "",
      logoPlacement: "center",
      letterheadThemeColors: [defaultDividerColor, defaultIconColor],
      issuer: "",
      hearingDate: "",
      hearingTime: "",
      hearingFormat: "",
      hearingLocation: "",
      misconductTypes: [],
      misconductDescriptions: {},
      contractReference: "",
      addendumType: "general",
      effectiveDate: "",
      contractEndDate: "",
      newEndDate: "",
      idType: "id",
      startDate: new Date().toISOString().split("T")[0],
      issueDate: new Date().toISOString().split("T")[0],
      employeeName: "",
      employeeSurname: "",
      employeeIdNumber: "",
      passportNumber: "",
      employeeAddress: "",
      employeePostalAddress: "",
    employeeNumber: "",
    nationality: "South African",
    gender: "",
    race: "",
      employeeCell: "",
      alternativeContact: "",
      employeeEmail: "",
      tradingName: "",
      employerContact: profile?.company_contact || "",
      employerEmail: profile?.company_email || "",
      jobTitle: "",
      salaryAmount: "",
      annualLeaveDays: "15",
      salaryFrequency: "month",
      probationPeriod: "3",
      department: "",
      retirementAge: "65",
      workplace: profile?.physical_address || "",
      interpreter: "no",
      reportsTo: "",
      additionalNotes: "",
    });
    setSelectedEmployeeId("");
    setValidatedPreview(null);
    setShowFinalActions(false);
    setActiveStep(0);
    setClauseEdits({});
    setCustomClauseTitleEdits({});
    setCustomClauses([]);
    setEditingClause(null);
    setClauseDraft("");
    setCustomClauseTitleDraft("");
    setAddingAfter(undefined);
    setNewClauseBody("");
    setCompanyLogoPreview("");
  };

  useEffect(() => {
    if (formData.idType === "id") {
      const derived = formData.employeeIdNumber.length === 13 ? deriveAgeFromId(formData.employeeIdNumber) : "";
      setFormData((prev) => (derived !== prev.age ? { ...prev, age: derived } : prev));
    }
  }, [formData.employeeIdNumber, formData.idType]);

  const isEmployerStepComplete = useMemo(
    () => Boolean(formData.employerContact && formData.employerEmail),
    [formData.employerContact, formData.employerEmail],
  );

  const isEmployeeStepComplete = useMemo(
    () =>
      Boolean(
        formData.employeeName &&
          formData.employeeSurname &&
          ((formData.idType === "id" && formData.employeeIdNumber) ||
            (formData.idType === "passport" && formData.passportNumber)),
      ),
    [
      formData.employeeName,
      formData.employeeSurname,
      formData.employeeIdNumber,
      formData.passportNumber,
      formData.idType,
    ],
  );

  const isEmploymentStepComplete = useMemo(
    () => {
      const hasIssueDate = Boolean(formData.issueDate);
      const hasHearingDate = Boolean(formData.hearingDate);
      const hasHearingTime = Boolean(formData.hearingTime.trim());
      const hasHearingFormat = Boolean(formData.hearingFormat);
      const hasHearingLocation = Boolean(formData.hearingLocation.trim());
      const hasMisconductTypes = formData.misconductTypes.length > 0;
      const hasMisconductDescriptions = formData.misconductTypes.every(
        (type) => Boolean((formData.misconductDescriptions[type] || "").trim()),
      );
      return Boolean(
        hasIssueDate &&
          hasHearingDate &&
          hasHearingTime &&
          hasHearingFormat &&
          hasHearingLocation &&
          hasMisconductTypes &&
          hasMisconductDescriptions,
      );
    },
    [
      formData.hearingDate,
      formData.hearingTime,
      formData.hearingFormat,
      formData.hearingLocation,
      formData.issueDate,
      formData.misconductTypes,
      formData.misconductDescriptions,
    ],
  );

  const isFormComplete = useMemo(
    () => isEmployerStepComplete && isEmployeeStepComplete && isEmploymentStepComplete,
    [isEmployerStepComplete, isEmployeeStepComplete, isEmploymentStepComplete],
  );

  const isIdDateInvalid = useMemo(
    () =>
      formData.idType === "id" &&
      formData.employeeIdNumber.length === 13 &&
      !extractDobFromId(formData.employeeIdNumber),
    [formData.employeeIdNumber, formData.idType],
  );

  const canGoNext = useMemo(() => {
    if (activeStep === 0) return isEmployerStepComplete;
    if (activeStep === 1) return isEmployeeStepComplete;
    return false;
  }, [activeStep, isEmployerStepComplete, isEmployeeStepComplete]);

  const canNavigateToStep = (index: number) => {
    if (index < 0 || index >= steps.length) return false;
    if (showFinalActions) return true;
    return index < activeStep;
  };

  const handleStepClick = (index: number) => {
    if (!canNavigateToStep(index)) return;
    if (showFinalActions) {
      setShowFinalActions(false);
    }
    setActiveStep(index);
  };

  const canSelectStep = useCallback(
    (index: number) => canNavigateToStep(index),
    [activeStep, showFinalActions, steps.length],
  );

  const handleStepSelect = useCallback(
    (index: number) => {
      if (!canNavigateToStep(index)) return;
      if (showFinalActions) {
        setShowFinalActions(false);
      }
      setActiveStep(index);
    },
    [activeStep, showFinalActions, steps.length],
  );

  const handleNext = () => {
    if (activeStep < steps.length - 1 && canGoNext) {
      setActiveStep((prev) => prev + 1);
    }
  };

  const canAdvance = activeStep === steps.length - 1 ? isFormComplete : canGoNext;

  const handleNextOrFinish = () => {
    if (activeStep === steps.length - 1) {
      if (isFormComplete) {
        handleFinish();
      }
      return;
    }
    handleNext();
  };

  const handleBack = () => {
    if (showFinalActions) {
      setIsPreviewEditable(false);
      setShowFinalActions(false);
      setActiveStep(steps.length - 1);
      return;
    }
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1);
    }
  };

  const togglePreviewEditMode = useCallback(() => {
    setIsPreviewEditable((prev) => {
      const next = !prev;
      if (!next) {
        setEditingClause(null);
        setClauseDraft("");
        setCustomClauseTitleDraft("");
        setAddingAfter(undefined);
        setNewClauseBody("");
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!embedded) return;
    onStepMetaChange?.({
      steps,
      activeStep,
      icons: stepIcons,
      canGoNext: showFinalActions ? !isGenerating && !isPreviewEditable : canAdvance,
      canGoBack: showFinalActions || activeStep > 0,
      canSelectStep,
      onNext: showFinalActions ? handleDownload : handleNextOrFinish,
      onBack: handleBack,
      onStepSelect: handleStepSelect,
      onClear: showFinalActions ? togglePreviewEditMode : clearCurrentStepFields,
      addendumType: formData.addendumType,
      isFinished: showFinalActions,
      isPreviewEditable,
      supportsPreviewEditToggle: false,
    });
  }, [
    activeStep,
    embedded,
    onStepMetaChange,
    steps,
    stepIcons,
    canAdvance,
    canSelectStep,
    handleNextOrFinish,
    handleBack,
    handleDownload,
    handleStepSelect,
    togglePreviewEditMode,
    isGenerating,
    isFormComplete,
    showFinalActions,
    isPreviewEditable,
    formData.addendumType,
  ]);

  const resetEmployeeStepFields = () => {
    setFormData((prev) => ({
      ...prev,
      employeeId: "",
      employeeName: "",
      employeeSurname: "",
      idType: "id",
      employeeIdNumber: "",
      passportNumber: "",
      age: "",
    }));
    setSelectedEmployeeId("");
  };

  const resetEmployerStepFields = () => {
    setFormData((prev) => ({
      ...prev,
      tradingName: "",
      employerContact: profile?.company_contact || "",
      employerEmail: profile?.company_email || "",
      companyLogoDataUrl: "",
      logoPlacement: "center",
      letterheadThemeColors: [defaultDividerColor, defaultIconColor],
    }));
    setCompanyLogoPreview("");
    if (companyLogoInputRef.current) {
      companyLogoInputRef.current.value = "";
    }
  };

  const resetAddendumStepFields = () => {
    if (hearingTimeFocused) {
      skipHearingTimeBlurCommitRef.current = true;
    }
    setHearingTimeFocused(false);
    setHearingTimeSelectOpen(false);
    setHearingTimeFieldVersion((prev) => prev + 1);
    setFormData((prev) => ({
      ...prev,
      issuer: "",
      hearingDate: "",
      hearingTime: "",
      hearingFormat: "",
      hearingLocation: "",
      misconductTypes: [],
      misconductDescriptions: {},
      addendumType: "general",
      effectiveDate: "",
      issueDate: new Date().toISOString().split("T")[0],
      contractEndDate: "",
      newEndDate: "",
      contractReference: "",
    }));
  };

  const clearCurrentStepFields = () => {
    if (activeStep === 0) {
      resetEmployerStepFields();
      return;
    }
    if (activeStep === 1) {
      resetEmployeeStepFields();
      return;
    }
    if (activeStep === 2) {
      resetAddendumStepFields();
      return;
    }
    resetForm();
  };

  const getSafeEditableHearingTime = (value: string) => {
    const normalized = normalizeHearingTimeInput(value);
    return /^\d{2}:\d{2}$/.test(normalized) ? normalized : "00:00";
  };

  const setHearingTimeValueWithCaret = (nextValue: string, caretPosition: number) => {
    setFormData((prev) => ({ ...prev, hearingTime: nextValue }));
    requestAnimationFrame(() => {
      const input = hearingTimeInputRef.current;
      if (!input) return;
      const nextCaret = Math.max(0, Math.min(5, caretPosition));
      input.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const handleHearingTimeEditorKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === "Escape") {
      event.currentTarget.blur();
      return;
    }

    const navigationKeys = new Set(["Tab", "ArrowLeft", "ArrowRight", "Home", "End"]);
    if (navigationKeys.has(event.key)) return;

    const value = getSafeEditableHearingTime(formData.hearingTime);
    const chars = value.split("");
    const rawStart = event.currentTarget.selectionStart ?? 0;
    const rawEnd = event.currentTarget.selectionEnd ?? rawStart;
    const start = Math.max(0, Math.min(5, rawStart));
    const end = Math.max(0, Math.min(5, rawEnd));
    const hasSelection = end > start;
    const clearRange = (from: number, to: number) => {
      for (let index = from; index < to; index += 1) {
        if (index === 2) continue;
        chars[index] = "0";
      }
    };

    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      if (hasSelection) clearRange(start, end);
      let target = hasSelection ? start : start;
      if (target === 2) target = 3;
      if (target > 4) return;
      chars[target] = event.key;
      let nextCaret = target + 1;
      if (nextCaret === 2) nextCaret = 3;
      setHearingTimeValueWithCaret(chars.join(""), nextCaret);
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      if (hasSelection) {
        clearRange(start, end);
        setHearingTimeValueWithCaret(chars.join(""), start === 2 ? 1 : start);
        return;
      }
      let target = start - 1;
      if (start >= 3 && target < 3) return;
      if (target === 2) target = 1;
      if (target < 0) return;
      chars[target] = "0";
      setHearingTimeValueWithCaret(chars.join(""), target);
      return;
    }

    if (event.key === "Delete") {
      event.preventDefault();
      if (hasSelection) {
        clearRange(start, end);
        setHearingTimeValueWithCaret(chars.join(""), start);
        return;
      }
      let target = start;
      if (target === 2) target = 3;
      if (start <= 1 && target > 1) return;
      if (target > 4) return;
      chars[target] = "0";
      setHearingTimeValueWithCaret(chars.join(""), start);
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
  };

  const handleHearingTimeEditorPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const digits = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!digits) return;
    const value = getSafeEditableHearingTime(formData.hearingTime);
    const chars = value.split("");
    const rawStart = event.currentTarget.selectionStart ?? 0;
    const rawEnd = event.currentTarget.selectionEnd ?? rawStart;
    const start = Math.max(0, Math.min(5, rawStart));
    const end = Math.max(0, Math.min(5, rawEnd));
    for (let index = start; index < end; index += 1) {
      if (index === 2) continue;
      chars[index] = "0";
    }

    let writeIndex = start === 2 ? 3 : start;
    let digitIndex = 0;
    while (writeIndex <= 4 && digitIndex < digits.length) {
      if (writeIndex === 2) {
        writeIndex += 1;
        continue;
      }
      chars[writeIndex] = digits[digitIndex];
      writeIndex += 1;
      digitIndex += 1;
    }

    let nextCaret = writeIndex;
    if (nextCaret === 2) nextCaret = 3;
    setHearingTimeValueWithCaret(chars.join(""), nextCaret);
  };

  const getPreviewScrollElement = useCallback(
    () =>
      (previewScrollRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null) ?? null,
    [],
  );

  const rememberClauseFieldFocus = (el: HTMLElement | null) => {
    if (el) clauseFieldFocusRef.current = el;
  };

  const rememberPreviewScroll = () => {
    const scrollEl = getPreviewScrollElement();
    if (scrollEl) {
      previewScrollTop.current = scrollEl.scrollTop;
    }
  };

  useEffect(() => {
    const target = clauseFieldFocusRef.current;
    if (target && document.activeElement !== target) {
      target.focus({ preventScroll: true } as FocusOptions);
    }
    const scrollEl = getPreviewScrollElement();
    if (scrollEl && scrollEl.scrollTop !== previewScrollTop.current) {
      scrollEl.scrollTop = previewScrollTop.current;
    }
  }, [addingAfter, editingClause, getPreviewScrollElement]);

  const openNoticeDatePicker = () => {
    const picker = noticeDatePickerRef.current;
    if (!picker) return;
    if (typeof (picker as any).showPicker === "function") {
      (picker as any).showPicker();
    } else {
      picker.click();
    }
  };

  const openHearingDatePicker = () => {
    const picker = hearingDatePickerRef.current;
    if (!picker) return;
    if (typeof (picker as any).showPicker === "function") {
      (picker as any).showPicker();
    } else {
      picker.click();
    }
  };

  const openMisconductPicker = () => {
    setDraftMisconductTypes(formData.misconductTypes);
    setMisconductSearch("");
    setMisconductPickerOpen(true);
  };

  const cancelMisconductPicker = () => {
    setMisconductPickerOpen(false);
    setMisconductSearch("");
    setDraftMisconductTypes([]);
  };

  const applyMisconductPicker = () => {
    setFormData((prev) => {
      const nextDescriptions: Record<string, string> = {};
      draftMisconductTypes.forEach((type) => {
        nextDescriptions[type] = prev.misconductDescriptions[type] || "";
      });
      return {
        ...prev,
        misconductTypes: draftMisconductTypes,
        misconductDescriptions: nextDescriptions,
      };
    });
    setAiGeneratedChargeTypes((prev) => prev.filter((type) => draftMisconductTypes.includes(type)));
    setMisconductPickerOpen(false);
    setMisconductSearch("");
  };

  const openDraftingAssistant = (chargeType: string) => {
    setDraftingAssistantChargeType(chargeType);
    setDraftingAssistantAnswers(emptyDraftingAssistantAnswers);
    setDraftingAssistantFocusedField(null);
    setDraftingAssistantAccepted(false);
    setDraftingAssistantOpen(true);
  };

  const clearChargeDescription = (chargeType: string) => {
    setFormData((prev) => ({
      ...prev,
      misconductDescriptions: {
        ...prev.misconductDescriptions,
        [chargeType]: "",
      },
    }));
    setAiGeneratedChargeTypes((prev) => prev.filter((type) => type !== chargeType));
  };

  const removeMisconductType = (chargeType: string) => {
    const chargeNumber = formData.misconductTypes.indexOf(chargeType) + 1;
    const label = chargeNumber > 0 ? `Charge ${chargeNumber}: ${chargeType}` : chargeType;
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`Are you sure you want to remove ${label}?`);
      if (!confirmed) return;
    }

    setFormData((prev) => {
      const nextTypes = prev.misconductTypes.filter((type) => type !== chargeType);
      const nextDescriptions = { ...prev.misconductDescriptions };
      delete nextDescriptions[chargeType];
      return {
        ...prev,
        misconductTypes: nextTypes,
        misconductDescriptions: nextDescriptions,
      };
    });
    setDraftMisconductTypes((prev) => prev.filter((type) => type !== chargeType));
    setAiGeneratedChargeTypes((prev) => prev.filter((type) => type !== chargeType));
    if (draftingAssistantChargeType === chargeType) {
      closeDraftingAssistant();
    }
  };

  const closeDraftingAssistant = () => {
    setDraftingAssistantOpen(false);
    setDraftingAssistantChargeType(null);
    setDraftingAssistantAnswers(emptyDraftingAssistantAnswers);
    setDraftingAssistantFocusedField(null);
    setDraftingAssistantAccepted(false);
  };
  const draftingAssistantNeedsInvolvement = requiresInvolvementSelection(draftingAssistantChargeType);
  const autoResizeTextarea = (target: HTMLTextAreaElement) => {
    target.style.height = "auto";
    target.style.height = `${target.scrollHeight}px`;
  };

  const generateChargeDraft = async () => {
    if (!draftingAssistantChargeType) return;
    const missingAnswers: string[] = [];
    if (!draftingAssistantAnswers.misconductOccurredWhen.trim()) {
      missingAnswers.push("When did the misconduct occur?");
    }
    if (!draftingAssistantAnswers.whatHappened.trim()) {
      missingAnswers.push("Describe what happened?");
    }
    if (draftingAssistantNeedsInvolvement && !draftingAssistantAnswers.involvementSelection) {
      missingAnswers.push("What was the employee's involvement?");
    }

    if (missingAnswers.length > 0) {
      toast({
        title: "Missing details",
        description: `Please answer: ${missingAnswers.join(" ")}`,
        variant: "destructive",
      });
      return;
    }
    if (!draftingAssistantAccepted) {
      toast({
        title: "Confirmation required",
        description: "Please confirm the disclaimer before generating a description.",
        variant: "destructive",
      });
      return;
    }

    const involvementLabel = draftingAssistantInvolvementOptions.find(
      (option) => option.value === draftingAssistantAnswers.involvementSelection,
    )?.label;

    const prompt = [
      "Draft a formal disciplinary charge description for South African labour law context.",
      "Output requirements:",
      "- Single paragraph only.",
      "- Target maximum 350 characters.",
      "- If needed to keep a complete sentence, you may go up to 400 characters.",
      "- Formal legal style.",
      "- No headings or bullet points.",
      "- Use second-person wording: use 'you'/'your' instead of 'the employee'.",
      "- Do not mention or refer to any Code of Conduct.",
      "- Do not include advisory text like 'refer to' or mention any document/policy source.",
      `Misconduct type: ${draftingAssistantChargeType}.`,
      `When did the misconduct occur? ${draftingAssistantAnswers.misconductOccurredWhen.trim()}`,
      `Describe what happened? ${draftingAssistantAnswers.whatHappened.trim()}`,
      draftingAssistantNeedsInvolvement &&
      draftingAssistantAnswers.involvementSelection !== "not_sure" &&
      involvementLabel
        ? `Employee involvement: ${involvementLabel}.`
        : "",
      draftingAssistantAnswers.additionalDetails.trim()
        ? `Additional relevant details: ${draftingAssistantAnswers.additionalDetails.trim()}`
        : "",
    ].join("\n");

    try {
      setIsDraftingAssistantGenerating(true);
      const { data, error } = await supabase.functions.invoke("assistant-chat", {
        body: { message: prompt, history: [] },
      });
      if (error) {
        const context = (error as { context?: Response })?.context;
        if (context instanceof Response && context.status === 429) {
          setRemainingDraftingPrompts(0);
        }
        let detail = "";
        if (context instanceof Response) {
          try {
            detail = await context.text();
          } catch {
            detail = "";
          }
        }
        const message = detail ? `${error.message}: ${detail}` : error.message;
        throw new Error(message);
      }
      const remaining = Number(data?.remaining);
      if (!Number.isNaN(remaining)) {
        setRemainingDraftingPrompts(Math.max(0, Math.min(maxDailyDraftingPrompts, remaining)));
      } else {
        setRemainingDraftingPrompts((prev) => Math.max(0, prev - 1));
      }
      const reply = typeof data?.reply === "string" ? data.reply.trim() : "";
      if (!reply) {
        throw new Error("Empty reply from drafting assistant.");
      }
      const cleanedReply = reply.replace(/\s+/g, " ").trim();
      const filteredSentences = cleanedReply
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean)
        .filter(
          (sentence) =>
            !/(code of conduct|refer to (your|the)|document|docume|policy source)/i.test(sentence),
        );

      let normalizedReply = filteredSentences.join(" ").trim();
      if (!normalizedReply) {
        normalizedReply = cleanedReply
          .replace(/\b(code of conduct|document|docume|policy source)\b/gi, "")
          .replace(/\brefer to (your|the)\b/gi, "")
          .replace(/\s+/g, " ")
          .trim();
      }
      normalizedReply = normalizedReply
        .replace(/\bthe employee's\b/gi, "your")
        .replace(/\bthe employee\b/gi, "you")
        .replace(/\ban employee\b/gi, "you");
      if (!normalizedReply) {
        throw new Error("Generated draft contained disallowed advisory wording. Please try again.");
      }

      const preferredMaxLength = 350;
      const hardMaxLength = 400;
      const getLastSentenceEndIndex = (value: string) => {
        const regex = /[.!?](?=\s|$)/g;
        let lastIndex: number | undefined;
        let match: RegExpExecArray | null;
        // Regex exec provides a typed index and avoids matchAll typing issues in some TS lib settings.
        // eslint-disable-next-line no-cond-assign
        while ((match = regex.exec(value)) !== null) {
          lastIndex = match.index;
        }
        return lastIndex;
      };
      const trimToWordBoundary = (value: string) => {
        const trimmed = value.trimEnd();
        const safe = trimmed.replace(/\s+\S*$/, "").trimEnd();
        return safe || trimmed;
      };

      const boundedReply = (() => {
        if (normalizedReply.length <= preferredMaxLength) return normalizedReply;

        const preferredSlice = normalizedReply.slice(0, preferredMaxLength).trimEnd();
        const preferredSentenceEnd = getLastSentenceEndIndex(preferredSlice);
        if (typeof preferredSentenceEnd === "number" && preferredSentenceEnd >= Math.floor(preferredMaxLength * 0.6)) {
          return preferredSlice.slice(0, preferredSentenceEnd + 1).trim();
        }

        const extendedSlice = normalizedReply.slice(0, Math.min(hardMaxLength, normalizedReply.length)).trimEnd();
        const extendedSentenceEnd = getLastSentenceEndIndex(extendedSlice);
        if (typeof extendedSentenceEnd === "number" && extendedSentenceEnd >= Math.floor(preferredMaxLength * 0.6)) {
          return extendedSlice.slice(0, extendedSentenceEnd + 1).trim();
        }

        return trimToWordBoundary(extendedSlice);
      })();

      setFormData((prev) => ({
        ...prev,
        misconductDescriptions: {
          ...prev.misconductDescriptions,
          [draftingAssistantChargeType]: boundedReply,
        },
      }));
      setAiGeneratedChargeTypes((prev) =>
        prev.includes(draftingAssistantChargeType) ? prev : [...prev, draftingAssistantChargeType],
      );
      toast({
        title: "Draft ready",
        description: "AI draft inserted. Review before use.",
      });
      closeDraftingAssistant();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: "Drafting assistant failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsDraftingAssistantGenerating(false);
    }
  };
  const isDraftingAssistantRequiredFieldsComplete = Boolean(
    draftingAssistantAnswers.misconductOccurredWhen.trim() &&
      draftingAssistantAnswers.whatHappened.trim() &&
      (!draftingAssistantNeedsInvolvement || Boolean(draftingAssistantAnswers.involvementSelection)),
  );
  const isDraftingAssistantComplete = Boolean(
    isDraftingAssistantRequiredFieldsComplete &&
      draftingAssistantAccepted,
  );
  const draftingAssistantChargeNumber =
    draftingAssistantChargeType ? formData.misconductTypes.indexOf(draftingAssistantChargeType) + 1 : 0;

  useEffect(() => {
    if (isDraftingAssistantRequiredFieldsComplete) return;
    if (draftingAssistantAccepted) {
      setDraftingAssistantAccepted(false);
    }
  }, [isDraftingAssistantRequiredFieldsComplete, draftingAssistantAccepted]);

  const openColorThemePicker = () => {
    setDraftLetterheadThemeColors(sanitizeThemeColors(formData.letterheadThemeColors));
    setColorThemePickerOpen(true);
  };

  const cancelColorThemePicker = () => {
    setColorThemePickerOpen(false);
    setDraftLetterheadThemeColors([]);
  };

  const toggleDraftThemeColor = (value: string) => {
    setDraftLetterheadThemeColors((prev) => {
      const normalized = sanitizeThemeColors(prev);
      if (normalized.length < 2) {
        return [...normalized, value];
      }

      const lastIndex = normalized.lastIndexOf(value);
      if (lastIndex >= 0) {
        return normalized.filter((_, index) => index !== lastIndex);
      }

      if (normalized.length >= 2) {
        toast({
          title: "Only two colors allowed",
          description: "Choose up to two colors. Deselect one to choose another.",
        });
        return normalized;
      }
      return normalized;
    });
  };

  const applyColorThemePicker = () => {
    const nextColors = sanitizeThemeColors(draftLetterheadThemeColors);
    setFormData((prev) => ({
      ...prev,
      letterheadThemeColors:
        nextColors.length === 0 ? [defaultDividerColor, defaultIconColor] : nextColors,
    }));
    setColorThemePickerOpen(false);
    setDraftLetterheadThemeColors([]);
  };

  const openContractReferencePicker = () => {
    const picker = contractReferencePickerRef.current;
    if (!picker) return;
    if (typeof (picker as any).showPicker === "function") {
      (picker as any).showPicker();
    } else {
      picker.click();
    }
  };

  const openContractEndDatePicker = () => {
    const picker = contractEndDatePickerRef.current;
    if (!picker) return;
    if (typeof (picker as any).showPicker === "function") {
      (picker as any).showPicker();
    } else {
      picker.click();
    }
  };

  const openNewEndDatePicker = () => {
    const picker = newEndDatePickerRef.current;
    if (!picker) return;
    if (typeof (picker as any).showPicker === "function") {
      (picker as any).showPicker();
    } else {
      picker.click();
    }
  };

  const handleCompanyLogoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Unsupported file",
        description: "Please upload an image file.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) return;
      const trimmedResult = await trimLogoWhitespace(result);
      setCompanyLogoPreview(trimmedResult);
      setFormData((prev) => ({ ...prev, companyLogoDataUrl: trimmedResult, logoPlacement: "center" }));
    };
    reader.onerror = () => {
      toast({
        title: "Unable to read image",
        description: "Please try another image file.",
        variant: "destructive",
      });
    };
    reader.readAsDataURL(file);
  };

  const clearCompanyLogo = () => {
    setCompanyLogoPreview("");
    setFormData((prev) => ({
      ...prev,
      companyLogoDataUrl: "",
      logoPlacement: "center",
      letterheadThemeColors: [defaultDividerColor, defaultIconColor],
    }));
    if (companyLogoInputRef.current) {
      companyLogoInputRef.current.value = "";
    }
  };

  const validateData = () => {
    const missingFields: string[] = [];
    const checkRequired = (value: string | undefined | null, label: string) => {
      if (!value || !value.toString().trim()) {
        missingFields.push(label);
      }
    };

    checkRequired(formData.employerContact, "Employer contact");
    checkRequired(formData.employerEmail, "Employer email");
    checkRequired(formData.employeeName, "Employee name");
    checkRequired(formData.employeeSurname, "Employee surname");
    checkRequired(formData.idType, "ID/Passport selection");
    if (formData.idType === "id") {
      checkRequired(formData.employeeIdNumber, "ID number");
    } else {
      checkRequired(formData.passportNumber, "Passport number");
    }
    checkRequired(formData.issueDate, "Date of notice");
    checkRequired(formData.hearingDate, "Date of hearing");
    checkRequired(formData.hearingTime, "Time of hearing");
    checkRequired(formData.hearingFormat, "Hearing format");
    checkRequired(
      formData.hearingLocation,
      formData.hearingFormat === "virtual" ? "Platform used" : "Hearing address",
    );
    if (formData.misconductTypes.length === 0) {
      missingFields.push("Type of misconduct");
    }
    const missingDescriptions = formData.misconductTypes.filter(
      (type) => !(formData.misconductDescriptions[type] || "").trim(),
    );
    if (missingDescriptions.length > 0) {
      missingFields.push("Misconduct description(s)");
    }

    if (missingFields.length) {
      throw new Error(`Please fill in the following required fields: ${missingFields.join(", ")}`);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(formData.hearingDate) && /^\d{4}-\d{2}-\d{2}$/.test(formData.issueDate)) {
      const hearingDate = new Date(`${formData.hearingDate}T00:00:00`);
      const noticeDate = new Date(`${formData.issueDate}T00:00:00`);
      if (!Number.isNaN(hearingDate.getTime()) && !Number.isNaN(noticeDate.getTime())) {
        if (hearingDate <= noticeDate) {
          throw new Error("Date of hearing must be after Date of notice.");
        }
      }
    }

    const issueDate = formData.issueDate;

    return {
      ...formData,
      issueDate,
      salaryAmount: Number(formData.salaryAmount) || 0,
      annualLeaveDays: Number(formData.annualLeaveDays) || 0,
      gender: formData.gender as PermanentContractFormData["gender"],
      race: formData.race as PermanentContractFormData["race"],
      idType: formData.idType,
      addendumType: "general",
      contractReference: "",
      contractEndDate: "",
      newEndDate: "",
      companyLogoDataUrl: formData.companyLogoDataUrl,
      logoPlacement: formData.logoPlacement,
      letterheadThemeColors: sanitizeThemeColors(formData.letterheadThemeColors),
      issuer: formData.issuer,
      hearingDate: formData.hearingDate,
      hearingTime: formData.hearingTime,
      hearingFormat: formData.hearingFormat as HearingFormat,
      hearingLocation: formData.hearingLocation,
      misconductTypes: formData.misconductTypes,
      misconductDescriptions: formData.misconductDescriptions,
    } as AddendumData;
  };

  const serializeClauseBody = (body: string | string[]) => (Array.isArray(body) ? body.join("\n\n") : body);

  const normalizeSingleParagraphText = (text: string) => text.replace(/\r?\n+/g, " ").replace(/\s{2,}/g, " ").trim();
  const stripParagraphBreaks = (text: string) => text.replace(/\r?\n+/g, " ");

  const resizeEditClauseTextarea = useCallback(() => {
    const textarea = editClauseTextareaRef.current;
    if (!textarea) return;
    const maxHeightPx = 320;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeightPx)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeightPx ? "auto" : "hidden";
  }, []);

  const resizeAddClauseTextarea = useCallback(() => {
    const textarea = addClauseTextareaRef.current;
    if (!textarea) return;
    const maxHeightPx = 320;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeightPx)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeightPx ? "auto" : "hidden";
  }, []);

  const normalizeBodyText = (text: string) => {
    const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    return paragraphs.length ? paragraphs : text.trim();
  };

  useEffect(() => {
    if (!editingClause) return;
    resizeEditClauseTextarea();
  }, [editingClause, clauseDraft, resizeEditClauseTextarea]);

  useEffect(() => {
    if (addingAfter === undefined) return;
    resizeAddClauseTextarea();
  }, [addingAfter, newClauseBody, resizeAddClauseTextarea]);

  const applyClauseEdits = (clauses: ClauseDefinition[]): ClauseDefinition[] =>
    clauses.map((clause) => {
      const edited = clauseEdits[clause.id];
      const editedTitle = customClauseTitleEdits[clause.id];
      const nextTitle = editedTitle ?? clause.title;
      if (!edited) {
        return nextTitle === clause.title ? clause : { ...clause, title: nextTitle };
      }
      return { ...clause, title: nextTitle, body: normalizeSingleParagraphText(edited) };
    });

  const mergeClauses = useCallback(
    (baseClauses: ClauseDefinition[]): ClauseDefinition[] => {
      const merged = [...baseClauses];
      customClauses.forEach((customClause) => {
        const insertIndex = customClause.insertAfterId
          ? merged.findIndex((clause) => clause.id === customClause.insertAfterId) + 1
          : 0;
        const safeIndex = Number.isInteger(insertIndex) && insertIndex > 0 ? insertIndex : 0;
        merged.splice(safeIndex, 0, customClause);
      });
      return merged;
    },
    [customClauses],
  );

  useEffect(() => {
    if (!showFinalActions) return;
    try {
      const validated = validateData();
      setValidatedPreview(validated);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please check the required fields.";
      toast({
        title: "Validation error",
        description: message,
        variant: "destructive",
      });
      setShowFinalActions(false);
    }
  }, [showFinalActions, formData]);

  const addWrappedText = (
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    fontSize = 9,
    fontStyle: "normal" | "bold" | "italic" | "bolditalic" = "normal",
  ) => {
    doc.setFont("helvetica", fontStyle);
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxWidth);
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 18;
    let cursorY = y;

    lines.forEach((line) => {
      if (cursorY > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
      }
      doc.text(line, x, cursorY);
      cursorY += lineHeight;
    });

    return cursorY;
  };

  const generatePDF = (data: AddendumData, download = false) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 18;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;
    let pageContentBottom = pageHeight - margin;

    const valueOrLine = (value?: string | number | null) => {
      if (typeof value === "number") return value.toString();
      if (typeof value === "string" && value.trim()) return value;
      return "________________________";
    };

    const ensureSpace = (space: number) => {
      if (y + space > pageContentBottom) {
        doc.addPage();
        y = margin;
      }
    };

    const drawWrapped = (text: string, x: number, maxWidth: number, lineHeight = 5.5, align: "left" | "right" = "left") => {
      const lines = doc.splitTextToSize(text, maxWidth);
      ensureSpace(lines.length * lineHeight + 1);
      lines.forEach((line, idx) => {
        if (align === "right") {
          doc.text(line, x + maxWidth, y + idx * lineHeight, { align: "right" });
          return;
        }
        const isLastLine = idx === lines.length - 1;
        const lineWidth = doc.getTextWidth(line);
        const extraSpace = maxWidth - lineWidth;
        const canJustify = !isLastLine && extraSpace > 0 && line.includes(" ");
        if (canJustify) {
          const charSpace = extraSpace / Math.max(line.length - 1, 1);
          doc.text(line, x, y + idx * lineHeight, { charSpace });
        } else {
          doc.text(line, x, y + idx * lineHeight);
        }
      });
      y += lines.length * lineHeight;
    };

    const { dividerColor, iconColor } = getThemeColors(data.letterheadThemeColors);
    const pdfPhoneIconDataUrl = createPdfPhoneIconDataUrl(iconColor);
    const pdfMailIconDataUrl = createPdfMailIconDataUrl(iconColor);
    const [dividerR, dividerG, dividerB] = getPdfDividerRgb(dividerColor);

    const companyAddressLines = (profile?.physical_address || "Address")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const hasUploadedLogo = Boolean(data.companyLogoDataUrl);
    const useCenteredLogoLayout = hasUploadedLogo;
    const useFooterCompanyDetails = useCenteredLogoLayout || !hasUploadedLogo;

    const headerTop = y;

    let logoTopForBalance = margin;
    if (useCenteredLogoLayout) {
      try {
        const imageType = data.companyLogoDataUrl.includes("image/jpeg") ? "JPEG" : "PNG";
        const imageProps = doc.getImageProperties(data.companyLogoDataUrl);
        const imageRatio = imageProps.width / imageProps.height;
        const stackedLogoMaxHeight = 24;
        const targetLogoHeight = imageRatio < 1 ? stackedLogoMaxHeight : 20;
        const maxLogoWidth = imageRatio < 1 ? 52 : 60;
        let logoHeight = targetLogoHeight;
        let logoWidth = logoHeight * imageRatio;
        if (logoWidth > maxLogoWidth) {
          const scale = maxLogoWidth / logoWidth;
          logoWidth = maxLogoWidth;
          logoHeight *= scale;
        }
        if (imageRatio < 1 && logoHeight > stackedLogoMaxHeight) {
          const scale = stackedLogoMaxHeight / logoHeight;
          logoHeight = stackedLogoMaxHeight;
          logoWidth *= scale;
        }
        const logoTop = Math.max(6, headerTop - 10);
        logoTopForBalance = logoTop;
        const logoX = (pageWidth - logoWidth) / 2;
        doc.addImage(data.companyLogoDataUrl, imageType, logoX, logoTop, logoWidth, logoHeight, undefined, "FAST");
        y = logoTop + logoHeight + 6;
      } catch {
        // Keep generating even if logo rendering fails.
      }
    }

    if (hasUploadedLogo) {
      doc.setDrawColor(dividerR, dividerG, dividerB);
      doc.line(margin, y, margin + contentWidth, y);
      doc.setDrawColor(0, 0, 0);
      y += 4.6;
    }

    const companyName = valueOrLine(formatCompanyDisplayName(profile?.company_name, profile?.company_type));
    const companyIdentity = data.tradingName?.trim()
      ? `${companyName} t/a ${data.tradingName.trim()}`
      : companyName;
    const registrationNumber = (profile?.registration_number || "").trim();
    const hasRegistrationNumber = registrationNumber.length > 0;
    const companyAddress = companyAddressLines.length > 0 ? companyAddressLines.join(", ") : "Address";
    const centeredFooterHeight = hasRegistrationNumber ? 15.5 : 12;
    const centeredFooterBottomGap = useCenteredLogoLayout ? logoTopForBalance : 7;
    if (useFooterCompanyDetails) {
      pageContentBottom = pageHeight - centeredFooterBottomGap - centeredFooterHeight - 2;
    }

    const drawCenteredFooter = (pageNumber: number) => {
      if (!useFooterCompanyDetails) return;
      doc.setPage(pageNumber);
      const footerStartY = pageHeight - centeredFooterBottomGap - centeredFooterHeight;
      doc.setDrawColor(dividerR, dividerG, dividerB);
      doc.line(margin, footerStartY, margin + contentWidth, footerStartY);
      doc.setDrawColor(0, 0, 0);
      const footerLineGap = 3.5;
      let footerY = footerStartY + 3.5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text(companyIdentity, margin + contentWidth / 2, footerY, { align: "center" });
      footerY += footerLineGap;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      if (hasRegistrationNumber) {
        doc.text(`Reg No: ${registrationNumber}`, margin + contentWidth / 2, footerY, { align: "center" });
        footerY += footerLineGap;
      }
      doc.text(companyAddress, margin + contentWidth / 2, footerY, { align: "center" });
      footerY += footerLineGap;
      const phoneText = valueOrLine(data.employerContact);
      const emailText = valueOrLine(data.employerEmail);
      const iconTextGap = 0.9;
      const itemGap = 4;
      const iconSize = 2.7;
      const hasPhoneIcon = Boolean(pdfPhoneIconDataUrl);
      const hasMailIcon = Boolean(pdfMailIconDataUrl);
      const phoneIconWidth = hasPhoneIcon ? iconSize : doc.getTextWidth("Tel:");
      const mailIconWidth = hasMailIcon ? iconSize : doc.getTextWidth("Email:");
      const phoneTextWidth = doc.getTextWidth(phoneText);
      const emailTextWidth = doc.getTextWidth(emailText);
      const contactRowWidth =
        phoneIconWidth +
        iconTextGap +
        phoneTextWidth +
        itemGap +
        mailIconWidth +
        iconTextGap +
        emailTextWidth;
      const contactStartX = margin + (contentWidth - contactRowWidth) / 2;
      if (hasPhoneIcon) {
        doc.addImage(pdfPhoneIconDataUrl as string, "PNG", contactStartX, footerY - iconSize + 0.55, iconSize, iconSize, undefined, "FAST");
      } else {
        doc.text("Tel:", contactStartX, footerY);
      }
      const phoneTextX = contactStartX + phoneIconWidth + iconTextGap;
      doc.text(phoneText, phoneTextX, footerY);
      const mailIconX = phoneTextX + phoneTextWidth + itemGap;
      if (hasMailIcon) {
        doc.addImage(pdfMailIconDataUrl as string, "PNG", mailIconX, footerY - iconSize + 0.55, iconSize, iconSize, undefined, "FAST");
      } else {
        doc.text("Email:", mailIconX, footerY);
      }
      const emailTextX = mailIconX + mailIconWidth + iconTextGap;
      doc.text(emailText, emailTextX, footerY);
      doc.setLineWidth(0.2);
    };

    const sectionHeaderFillRgb: [number, number, number] = [236, 240, 245];
    const sectionHeaderHeight = 7;
    const sectionPaddingX = 3;
    const sectionPaddingY = 2;
    const sectionLineGap = 4.6;
    const sectionCornerRadius = 1;
    const chargeSectionBorderRgb: [number, number, number] = [180, 188, 198];
    const chargeSectionBorderLineWidth = 0.12;
    const leftColumnLabelWidth = 22;
    const rightColumnLabelWidth = 33;
    const drawSectionHeaderFill = (startY: number) => {
      doc.setFillColor(...sectionHeaderFillRgb);
      doc.roundedRect(margin, startY, contentWidth, sectionHeaderHeight, sectionCornerRadius, sectionCornerRadius, "F");
      if (sectionCornerRadius > 0) {
        // Keep top corners rounded while forcing bottom corners square.
        // Slight overlap avoids renderer-specific anti-alias seams (browser vs desktop PDF viewers).
        const squareOverlap = 0.25;
        const squareSize = sectionCornerRadius + squareOverlap;
        const squareY = startY + sectionHeaderHeight - sectionCornerRadius - squareOverlap;
        doc.rect(margin, squareY, squareSize, squareSize, "F");
        doc.rect(
          margin + contentWidth - squareSize,
          squareY,
          squareSize,
          squareSize,
          "F",
        );
      }
    };

    const drawFieldSection = (title: string, rows: Array<{ label: string; value: string }>) => {
      const rowsWithLines = rows.map((row) => {
        const labelWidth = doc.getTextWidth(`${row.label} `);
        const valueLines = doc.splitTextToSize(row.value || "________________________", contentWidth - sectionPaddingX * 2 - labelWidth);
        return { ...row, labelWidth, valueLines };
      });
      const rowsHeight = rowsWithLines.reduce(
        (acc, row) => acc + Math.max(1, row.valueLines.length) * sectionLineGap + 1,
        0,
      );
      const sectionHeight = sectionHeaderHeight + sectionPaddingY + rowsHeight + sectionPaddingY;
      ensureSpace(sectionHeight + 4);

      const startY = y;
      drawSectionHeaderFill(startY);
      doc.setDrawColor(...chargeSectionBorderRgb);
      doc.setLineWidth(chargeSectionBorderLineWidth);
      doc.roundedRect(margin, startY, contentWidth, sectionHeight, sectionCornerRadius, sectionCornerRadius, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(title.toUpperCase(), margin + sectionPaddingX, startY + 4.7);

      let rowY = startY + sectionHeaderHeight + sectionPaddingY + 3;
      rowsWithLines.forEach((row) => {
        doc.setFont("helvetica", "bold");
        doc.text(`${row.label} `, margin + sectionPaddingX, rowY);
        doc.setFont("helvetica", "normal");
        row.valueLines.forEach((line: string, idx: number) => {
          const textX = margin + sectionPaddingX + row.labelWidth;
          doc.text(line, textX, rowY + idx * sectionLineGap);
        });
        rowY += Math.max(1, row.valueLines.length) * sectionLineGap + 1;
      });

      y = startY + sectionHeight + 4;
    };

    const drawEmployeeDetailsSection = () => {
      const leftLabel = "Employee:";
      const leftValue = valueOrLine([data.employeeName, data.employeeSurname].filter(Boolean).join(" "));
      const rightLabel = data.idType === "passport" ? "Passport Number:" : "ID Number:";
      const rightValue = valueOrLine(data.idType === "passport" ? data.passportNumber : data.employeeIdNumber);
      const columnGap = 4;
      const columnWidth = (contentWidth - sectionPaddingX * 2 - columnGap) / 2;
      const measureValue = (value: string, labelWidth: number) => {
        const valueLines = doc.splitTextToSize(value || "________________________", columnWidth - labelWidth);
        return { valueLines };
      };
      const left = measureValue(leftValue, leftColumnLabelWidth);
      const right = measureValue(rightValue, rightColumnLabelWidth);
      const leftHeight = Math.max(1, left.valueLines.length) * sectionLineGap + 1;
      const rightHeight = Math.max(1, right.valueLines.length) * sectionLineGap + 1;
      const rowsHeight = Math.max(leftHeight, rightHeight);
      const sectionHeight = sectionHeaderHeight + sectionPaddingY + rowsHeight + sectionPaddingY;

      ensureSpace(sectionHeight + 4);

      const startY = y;
      drawSectionHeaderFill(startY);
      doc.setDrawColor(...chargeSectionBorderRgb);
      doc.setLineWidth(chargeSectionBorderLineWidth);
      doc.roundedRect(margin, startY, contentWidth, sectionHeight, sectionCornerRadius, sectionCornerRadius, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("A. EMPLOYEE DETAILS", margin + sectionPaddingX, startY + 4.7);

      const rowY = startY + sectionHeaderHeight + sectionPaddingY + 3;
      const leftX = margin + sectionPaddingX;
      const rightX = leftX + columnWidth + columnGap;

      doc.setFont("helvetica", "bold");
      doc.text(`${leftLabel} `, leftX, rowY);
      doc.setFont("helvetica", "normal");
      left.valueLines.forEach((line: string, idx: number) => {
        doc.text(line, leftX + leftColumnLabelWidth, rowY + idx * sectionLineGap);
      });

      doc.setFont("helvetica", "bold");
      doc.text(`${rightLabel} `, rightX, rowY);
      doc.setFont("helvetica", "normal");
      right.valueLines.forEach((line: string, idx: number) => {
        doc.text(line, rightX + rightColumnLabelWidth, rowY + idx * sectionLineGap);
      });

      y = startY + sectionHeight + 4;
    };

    const drawHearingDetailsSection = () => {
      const leftLabel = "Date:";
      const leftValue = valueOrLine(formatDate(data.hearingDate));
      const rightLabel = "Time:";
      const rightValue = valueOrLine(formatTime(data.hearingTime));
      const locationLabel = "Place:";
      const locationValue = valueOrLine(formatHearingPlaceDisplay(data.hearingFormat, data.hearingLocation));
      const columnGap = 4;
      const columnWidth = (contentWidth - sectionPaddingX * 2 - columnGap) / 2;
      const measureValue = (value: string, labelWidth: number) => {
        const valueLines = doc.splitTextToSize(value || "________________________", columnWidth - labelWidth);
        return { valueLines };
      };
      const measureFullWidthValue = (value: string, labelWidth: number) => {
        const valueLines = doc.splitTextToSize(value || "________________________", contentWidth - sectionPaddingX * 2 - labelWidth);
        return { valueLines };
      };
      const left = measureValue(leftValue, leftColumnLabelWidth);
      const right = measureValue(rightValue, rightColumnLabelWidth);
      const location = measureFullWidthValue(locationValue, leftColumnLabelWidth);
      const leftHeight = Math.max(1, left.valueLines.length) * sectionLineGap + 1;
      const rightHeight = Math.max(1, right.valueLines.length) * sectionLineGap + 1;
      const locationHeight = Math.max(1, location.valueLines.length) * sectionLineGap + 1;
      const rowsHeight = Math.max(leftHeight, rightHeight) + locationHeight;
      const sectionHeight = sectionHeaderHeight + sectionPaddingY + rowsHeight + sectionPaddingY;

      ensureSpace(sectionHeight + 4);

      const startY = y;
      drawSectionHeaderFill(startY);
      doc.setDrawColor(...chargeSectionBorderRgb);
      doc.setLineWidth(chargeSectionBorderLineWidth);
      doc.roundedRect(margin, startY, contentWidth, sectionHeight, sectionCornerRadius, sectionCornerRadius, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("B. HEARING DETAILS", margin + sectionPaddingX, startY + 4.7);

      const rowY = startY + sectionHeaderHeight + sectionPaddingY + 3;
      const leftX = margin + sectionPaddingX;
      const rightX = leftX + columnWidth + columnGap;

      doc.setFont("helvetica", "bold");
      doc.text(`${leftLabel} `, leftX, rowY);
      doc.setFont("helvetica", "normal");
      left.valueLines.forEach((line: string, idx: number) => {
        doc.text(line, leftX + leftColumnLabelWidth, rowY + idx * sectionLineGap);
      });

      doc.setFont("helvetica", "bold");
      doc.text(`${rightLabel} `, rightX, rowY);
      doc.setFont("helvetica", "normal");
      right.valueLines.forEach((line: string, idx: number) => {
        doc.text(line, rightX + rightColumnLabelWidth, rowY + idx * sectionLineGap);
      });

      const locationY = rowY + Math.max(leftHeight, rightHeight);
      doc.setFont("helvetica", "bold");
      doc.text(`${locationLabel} `, leftX, locationY);
      doc.setFont("helvetica", "normal");
      location.valueLines.forEach((line: string, idx: number) => {
        doc.text(line, leftX + leftColumnLabelWidth, locationY + idx * sectionLineGap);
      });

      y = startY + sectionHeight + 4;
    };

    const drawChargeSection = (title: string, charges: Array<{ heading: string; body: string }>) => {
      const chargesWithLines = charges.map((charge) => ({
        ...(() => {
          const headingMatch = charge.heading.match(/^(\d+\.\s+)(.*)$/);
          const headingPrefix = headingMatch ? headingMatch[1] : "";
          const headingText = headingMatch ? headingMatch[2] : charge.heading;
          const headingPrefixWidth = headingPrefix ? doc.getTextWidth(headingPrefix) : 0;
          const usableWidth = contentWidth - sectionPaddingX * 2 - headingPrefixWidth;
          return {
            headingPrefix,
            headingPrefixWidth,
            headingLines: doc.splitTextToSize(headingText, usableWidth),
            bodyLines: doc.splitTextToSize(charge.body || "________________________", usableWidth),
          };
        })(),
      }));
      const chargesHeight = chargesWithLines.reduce(
        (acc, charge) => acc + charge.headingLines.length * sectionLineGap + charge.bodyLines.length * sectionLineGap + 2,
        0,
      );
      const sectionHeight = sectionHeaderHeight + sectionPaddingY + chargesHeight + sectionPaddingY;
      ensureSpace(sectionHeight + 4);

      const startY = y;
      drawSectionHeaderFill(startY);
      doc.setDrawColor(...chargeSectionBorderRgb);
      doc.setLineWidth(chargeSectionBorderLineWidth);
      doc.roundedRect(margin, startY, contentWidth, sectionHeight, sectionCornerRadius, sectionCornerRadius, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(title.toUpperCase(), margin + sectionPaddingX, startY + 4.7);

      let blockY = startY + sectionHeaderHeight + sectionPaddingY + 3;
      chargesWithLines.forEach((charge) => {
        const chargeTextLeftInset = 1.8;
        const textBaseX = margin + sectionPaddingX + charge.headingPrefixWidth + chargeTextLeftInset;
        doc.setFont("helvetica", "bold");
        if (charge.headingPrefix) {
          doc.text(charge.headingPrefix, margin + sectionPaddingX, blockY);
        }
        charge.headingLines.forEach((line: string, idx: number) => {
          doc.text(line, textBaseX, blockY + idx * sectionLineGap);
        });
        blockY += charge.headingLines.length * sectionLineGap;
        doc.setFont("helvetica", "normal");
        charge.bodyLines.forEach((line: string, idx: number) => {
          doc.text(line, textBaseX, blockY + idx * sectionLineGap);
        });
        blockY += charge.bodyLines.length * sectionLineGap + 2;
      });

      y = startY + sectionHeight + 4;
    };

    const drawRightsSection = (intro: string, items: readonly string[]) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const rightsLineGap = 4.1;

      const introLines = doc.splitTextToSize(intro, contentWidth - sectionPaddingX * 2);
      const introHeight = introLines.length * rightsLineGap + 1.2;
      ensureSpace(introHeight);
      introLines.forEach((line: string, idx: number) => {
        doc.text(line, margin + sectionPaddingX, y + idx * rightsLineGap);
      });
      y += introHeight;

      const bulletX = margin + sectionPaddingX;
      const textX = bulletX + 3;
      const bulletTextWidth = contentWidth - sectionPaddingX * 2 - 3;

      items.forEach((item) => {
        const itemLines = doc.splitTextToSize(item, bulletTextWidth);
        const itemHeight = itemLines.length * rightsLineGap + 1;
        ensureSpace(itemHeight);
        doc.text("\u2022", bulletX, y);
        itemLines.forEach((line: string, idx: number) => {
          doc.text(line, textX, y + idx * rightsLineGap);
        });
        y += itemHeight;
      });

      y += 2;
    };

    const drawSignatureSection = () => {
      const sectionTitleHeight = sectionHeaderHeight + 8;
      const signaturePairs: [string, string][] = [
        ["Employer/Issuer", "Employee"],
        ["Representative (optional)", "Interpreter (optional)"],
        ["Witness 1 (optional)", "Witness 2 (optional)"],
      ];
      const colGap = 12;
      const colWidth = (contentWidth - colGap) / 2;
      const rowHeight = 12;
      const gapBeforeRepresentativeRow = 2;
      const gapBeforeWitnessRow = 2;
      const gapBeforeRefusalNote = 2;
      const sigLineLength = Math.min(38, colWidth - 18);
      const dateLineLength = Math.min(24, colWidth - sigLineLength - 12);
      const refusalPaddingX = 3;
      const refusalPaddingY = 2;
      const refusalLines = doc.splitTextToSize(SIGNATURE_REFUSAL_NOTE, contentWidth - refusalPaddingX * 2);
      const refusalHeight = refusalLines.length * 4 + refusalPaddingY * 2;
      const rowWithBottomNoteHeight = gapBeforeWitnessRow + rowHeight + gapBeforeRefusalNote + refusalHeight + 4;
      const firstRowWithTitleHeight = sectionTitleHeight + rowHeight;

      ensureSpace(firstRowWithTitleHeight);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("SIGNATURES", margin + sectionPaddingX, y + 4.7);
      y += sectionTitleHeight;

      const drawSignatureRow = (pair: [string, string]) => {
        const rowY = y;
        const drawSignatureCell = (label: string, x: number) => {
          const dateX = x + sigLineLength + 8;
          doc.setDrawColor(170, 170, 170);
          doc.line(x, rowY, x + sigLineLength, rowY);
          doc.line(dateX, rowY, dateX + dateLineLength, rowY);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.text(label, x, rowY + 3.2);
          doc.text("Date", dateX, rowY + 3.2);
        };

        drawSignatureCell(pair[0], margin + sectionPaddingX);
        drawSignatureCell(pair[1], margin + sectionPaddingX + colWidth + colGap);
        y += rowHeight;
      };

      ensureSpace(rowHeight);
      drawSignatureRow(signaturePairs[0]);

      ensureSpace(gapBeforeRepresentativeRow + rowHeight);
      y += gapBeforeRepresentativeRow;
      drawSignatureRow(signaturePairs[1]);

      ensureSpace(rowWithBottomNoteHeight);
      y += gapBeforeWitnessRow;
      drawSignatureRow(signaturePairs[2]);
      y += gapBeforeRefusalNote;

      doc.setFillColor(247, 249, 251);
      doc.setDrawColor(200, 200, 200);
      doc.roundedRect(margin, y, contentWidth, refusalHeight, 2, 2, "FD");
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(70, 74, 78);
      doc.text(refusalLines, margin + refusalPaddingX, y + refusalPaddingY + 3);
      doc.setTextColor(0, 0, 0);
      y += refusalHeight + 4;
    };

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("NOTICE OF DISCIPLINARY HEARING", pageWidth / 2, y, { align: "center" });
    y += 7;

    drawEmployeeDetailsSection();

    drawHearingDetailsSection();

    drawChargeSection(
      "C. Transgression(s) / Charge(s)",
      data.misconductTypes.map((type, index) => ({
        heading: `${index + 1}. ${type}`,
        body: valueOrLine(data.misconductDescriptions[type]),
      })),
    );

    y += 2;
    drawRightsSection(HEARING_RIGHTS_INTRO, HEARING_RIGHTS_ITEMS);
    drawSignatureSection();

    const totalPages = doc.getNumberOfPages();
    if (useFooterCompanyDetails) {
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        drawCenteredFooter(pageNumber);
      }
    }

    if (totalPages > 1) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(70, 74, 78);
      const pageNumberY = 8;
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        doc.setPage(pageNumber);
        doc.text(`Page ${pageNumber} of ${totalPages}`, margin + contentWidth, pageNumberY, { align: "right" });
      }
      doc.setTextColor(0, 0, 0);
    }
    doc.setPage(totalPages);

    if (download) {
      doc.save(`Disciplinary_Hearing_Notice_${data.employeeSurname || "employee"}_${data.issueDate}.pdf`);
      toast({
        title: "Download ready",
        description: "Disciplinary hearing notice has been generated.",
      });
      return;
    }

    const blobUrl = doc.output("bloburl");
    window.open(blobUrl, "_blank");
  };

  function handleDownload() {
    try {
      setIsGenerating(true);
      const validated = validateData();
      generatePDF(validated, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please check the required fields.";
      toast({
        title: "Validation error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  function handleFinish() {
    try {
      const validated = validateData();
      setValidatedPreview(validated);
      setIsPreviewEditable(false);
      setShowFinalActions(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please check the required fields.";
      toast({
        title: "Validation error",
        description: message,
        variant: "destructive",
      });
    }
  }

  const closeSameDayCaution = () => {
    setSameDayCautionDismissed(true);
    setSameDayCaution({ open: false, pendingAction: "" });
    setFormData((prev) => ({ ...prev, hearingDate: "" }));
  };

  const confirmSameDayCaution = () => {
    const pending = sameDayCaution.pendingAction;
    setSameDayOverrideAccepted(true);
    setSameDayCautionDismissed(false);
    setSameDayCaution({ open: false, pendingAction: "" });
    if (pending === "download") {
      handleDownload();
      return;
    }
    if (pending === "finish") {
      handleFinish();
    }
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center", embedded ? "min-h-[60vh]" : "min-h-screen")}>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }
  const useExternalShell = embedded && externalNavigation;

  const content = (
    <>
      <div
        className={cn(
          "space-y-6",
          embedded
            ? useExternalShell
              ? "px-0 pt-0 pr-0 pb-0"
              : "px-0 pt-4 pr-4 pb-4"
            : "-ml-6 -mr-6 pl-3 pr-3",
          useExternalShell && "h-full min-h-0 space-y-0",
        )}
        style={{ scrollbarGutter: "stable" }}
      >
        {!showFinalActions ? (
          <Card
            className={cn(
              "rounded-sm mt-4 shadow-none border-0 bg-transparent",
              useExternalShell && "mt-0 h-full min-h-0 flex flex-col overflow-hidden",
            )}
          >
            {!embedded && (
              <CardHeader className="pb-2">
                <div className="flex items-center justify-center gap-8 w-full">
                  {steps.map((step, index) => {
                    const isFinalizedCurrent = showFinalActions && index === steps.length - 1;
                    const isDone = index < activeStep || isFinalizedCurrent;
                    const isActive = index === activeStep && !isFinalizedCurrent;
                    const Icon = stepIcons[index];
                    const circleClasses = isDone
                      ? "border-[#b6e6c1] text-[#038314] bg-[#e9f9ee]"
                      : isActive
                        ? "border-blue-300 text-blue-700 bg-blue-100"
                        : "border-slate-200 text-slate-500 bg-white";
                    const canClick = canNavigateToStep(index);
                    const handleClick = () => handleStepClick(index);

                    return (
                      <div key={step} className="flex items-center gap-4">
                        <TooltipProvider delayDuration={0} skipDelayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                disabled={!canClick}
                                aria-label={step}
                                onClick={canClick ? handleClick : undefined}
                                onKeyDown={
                                  canClick
                                    ? (e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          handleClick();
                                        }
                                      }
                                    : undefined
                                }
                                className={`flex flex-col items-start gap-1 transition ${
                                  canClick
                                    ? "cursor-pointer hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-md"
                                    : "cursor-default"
                                }`}
                              >
                                <div
                                  className={`flex h-11 w-11 items-center justify-center rounded-full border ${circleClasses}`}
                                >
                                  <Icon className="h-5 w-5" />
                                </div>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="center" className={fixedTooltipContentClass}>
                              {step}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {index < steps.length - 1 && (
                          <div
                            className={`h-px w-16 ${
                              index < activeStep || isFinalizedCurrent ? "bg-[#04b81f]" : "bg-slate-200"
                            }`}
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardHeader>
            )}
            <CardContent
              className={cn(
                "pt-1 [&_input]:h-9 [&_input]:py-2 [&_button[role=combobox]]:h-9 [&_textarea]:py-2 [&_textarea]:text-sm",
                embedded && "px-0",
                "flex-1 min-h-0 overflow-y-auto",
                useExternalShell && "h-full min-h-0 flex flex-col pb-1",
              )}
            >
              <div className={cn("space-y-4", useExternalShell && "min-h-0 flex-1 pr-1")}>
              {activeStep === 0 && (
                <div className="space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="companyName" className={modalFieldLabelClass}>Company name</Label>
                      <Input
                        id="companyName"
                        value={profile?.company_name || ""}
                        readOnly
                        className={getAddendumModalInputClass(Boolean(profile?.company_name))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="registrationNumber" className={modalFieldLabelClass}>Registration number</Label>
                      <Input
                        id="registrationNumber"
                        value={profile?.registration_number || ""}
                        readOnly
                        className={getAddendumModalInputClass(Boolean(profile?.registration_number))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="physicalAddress" className={modalFieldLabelClass}>Registered address</Label>
                      <Input
                        id="physicalAddress"
                        value={profile?.physical_address || ""}
                        readOnly
                        className={getAddendumModalInputClass(Boolean(profile?.physical_address))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tradingName" className={modalFieldLabelClass}>Trading name</Label>
                      <Input
                        id="tradingName"
                        value={formData.tradingName}
                        onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
                        placeholder="If different from registered name"
                        className={getAddendumModalInputClass(formData.tradingName.trim().length > 0)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="employerContact" className={modalFieldLabelClass}>
                        Employer contact <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="employerContact"
                        value={formData.employerContact}
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
                          setFormData({ ...formData, employerContact: digitsOnly });
                        }}
                        placeholder="10-digit contact number"
                        className={getAddendumModalInputClass(formData.employerContact.trim().length > 0)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="employerEmail" className={modalFieldLabelClass}>
                        Employer email <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="employerEmail"
                        type="email"
                        value={formData.employerEmail}
                        onChange={(e) => setFormData({ ...formData, employerEmail: e.target.value })}
                        className={getAddendumModalInputClass(formData.employerEmail.trim().length > 0)}
                      />
                    </div>
                    <div className="md:col-span-2 pt-1" aria-hidden="true">
                      <div className="border-t border-slate-200/80" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="companyLogoUpload" className={modalFieldLabelClass}>
                        Company logo (optional)
                      </Label>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          id="companyLogoUpload"
                          ref={companyLogoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleCompanyLogoUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="h-[34px] rounded border-slate-300 bg-white text-[11px] font-semibold text-slate-700 hover:border-blue-600 hover:bg-white hover:text-blue-600"
                          onClick={() => companyLogoInputRef.current?.click()}
                        >
                          {companyLogoPreview || formData.companyLogoDataUrl ? "Change logo" : "Upload logo"}
                        </Button>
                        {companyLogoPreview ? (
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-[34px] border-0 bg-white px-2 text-[11px] font-semibold text-slate-700 shadow-none hover:bg-white hover:text-red-600 hover:underline hover:underline-offset-2"
                            onClick={clearCompanyLogo}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>
                      {companyLogoPreview || formData.companyLogoDataUrl ? (
                        <div className="mt-2 inline-block w-fit rounded border border-slate-300 bg-white p-2">
                          <img
                            src={companyLogoPreview || formData.companyLogoDataUrl}
                            alt="Company logo preview"
                            className="h-12 w-auto object-contain"
                          />
                        </div>
                      ) : null}
                    </div>
                    {companyLogoPreview || formData.companyLogoDataUrl ? (
                      <div className="space-y-1.5">
                        <Label className={modalFieldLabelClass}>Layout preview</Label>
                        <div className="grid grid-cols-1 gap-2">
                          <button
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, logoPlacement: "center" }))}
                            className={`rounded border p-2 text-left transition ${
                              formData.logoPlacement === "center"
                                ? "border-blue-600 bg-blue-50"
                                : "border-slate-300 bg-white hover:border-blue-500"
                            }`}
                          >
                            <div className="h-[99px] rounded border border-slate-200 bg-white p-2">
                              {companyLogoPreview || formData.companyLogoDataUrl ? (
                                <img
                                  src={companyLogoPreview || formData.companyLogoDataUrl}
                                  alt="Centered letterhead logo preview"
                                  className="mx-auto h-4 w-12 object-contain"
                                />
                              ) : (
                                <div className="mx-auto h-4 w-12 rounded bg-slate-300" />
                              )}
                              <div className="mt-2 h-px w-full bg-slate-300" />
                              <div className="mt-2 w-16 space-y-1">
                                <div className="h-1 w-full rounded bg-slate-300" />
                                <div className="h-1 w-5/6 rounded bg-slate-300" />
                                <div className="h-1 w-3/4 rounded bg-slate-300" />
                              </div>
                              <div className="mt-4 border-t border-slate-300 pt-1">
                                <div className="mx-auto h-px w-20 rounded bg-slate-300" />
                                <div className="mx-auto mt-1 h-px w-16 rounded bg-slate-300" />
                              </div>
                            </div>
                            <p className="mt-2 text-[11px] font-semibold text-slate-700">{logoPlacementOptions[0].label}</p>
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <div className="space-y-1.5">
                      <Label htmlFor="letterheadColorTheme" className={modalFieldLabelClass}>Colour theme</Label>
                      <button
                        id="letterheadColorTheme"
                        type="button"
                        onClick={openColorThemePicker}
                        className={`${baseModalFieldClass} !h-[34px] !border-[1.75px] ${selectedLetterheadThemeColors.length > 0 ? "!border-emerald-500" : "!border-slate-300"} w-full px-3 text-left`}
                      >
                        {selectedLetterheadThemeColors.length > 0 ? (
                          <span className="flex items-center gap-2">
                            {selectedLetterheadThemeColors.map((color, index) => (
                              <span
                                key={`${color}-${index}`}
                                className="relative h-4 w-4 rounded-[2px] border border-slate-300"
                                style={{ backgroundColor: color }}
                                aria-label={`Selected color ${index + 1}`}
                              />
                            ))}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Select two colours</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeStep === 1 && (
                <div className="space-y-3">
                    <div className="space-y-2.5">
                      <div className="space-y-1.5">
                        <Label htmlFor="employee" className={modalFieldLabelClass}>Select employee (optional)</Label>
                      <Select
                        value={selectedEmployeeId}
                        onValueChange={handleEmployeeSelect}
                        open={employeeSearchOpen}
                        onOpenChange={(open) => {
                          setEmployeeSearchOpen(open);
                          if (open) setEmployeeSearchQuery("");
                        }}
                      >
                        <SelectTrigger className={`${getAddendumModalSelectTriggerClass(selectedEmployeeId.trim().length > 0)} ${addendumModalDropdownToneClass}`}>
                          <SelectValue placeholder="Select from saved employees or fill manually" />
                        </SelectTrigger>
                        <SelectContent
                          hideScrollButtons
                          className={`${addendumModalSelectContentClass} w-[var(--radix-select-trigger-width)] p-0`}
                        >
                          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-2">
                            <Input
                              ref={employeeSearchInputRef}
                              value={employeeSearchQuery}
                              onChange={(event) => setEmployeeSearchQuery(event.target.value)}
                              onKeyDown={(event) => event.stopPropagation()}
                              placeholder="Type full employee name..."
                              className="h-8 rounded border-slate-300 text-[11px] placeholder:text-[10px] placeholder:text-slate-400"
                            />
                          </div>
                          {searchedEmployees.length > 0 ? (
                            searchedEmployees.map((employee) => (
                              <SelectItem key={employee.id} value={employee.id} className={addendumModalSelectItemClass}>
                                {employee.employee_name} {employee.employee_surname}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-[11px] text-slate-500">No matching employees found.</div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="employeeName" className={modalFieldLabelClass}>
                          Employee name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="employeeName"
                          value={formData.employeeName}
                          onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
                          className={getAddendumModalInputClass(formData.employeeName.trim().length > 0)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="employeeSurname" className={modalFieldLabelClass}>
                          Employee surname <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="employeeSurname"
                          value={formData.employeeSurname}
                          onChange={(e) => setFormData({ ...formData, employeeSurname: e.target.value })}
                          className={getAddendumModalInputClass(formData.employeeSurname.trim().length > 0)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className={modalFieldLabelClass}>
                          ID/Passport <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={formData.idType}
                          onValueChange={(value) => {
                            setFormData((prev) => ({
                              ...prev,
                              idType: value as "id" | "passport",
                            }));
                          }}
                        >
                          <SelectTrigger className={`${getAddendumModalSelectTriggerClass(Boolean(formData.idType))} ${addendumModalDropdownToneClass}`}>
                            <SelectValue placeholder="Choose document type" />
                          </SelectTrigger>
                          <SelectContent className={addendumModalSelectContentClass}>
                            <SelectItem value="id" className={addendumModalSelectItemClass}>ID Number</SelectItem>
                            <SelectItem value="passport" className={addendumModalSelectItemClass}>Passport Number</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="idOrPassport" className={modalFieldLabelClass}>
                          {formData.idType === "id" ? "ID number" : "Passport number"}{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="idOrPassport"
                          value={formData.idType === "id" ? formData.employeeIdNumber : formData.passportNumber}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (formData.idType === "id") {
                              const digitsOnly = value.replace(/\D/g, "").slice(0, 13);
                              const derived = deriveAgeFromId(digitsOnly);
                              setFormData((prev) => ({
                                ...prev,
                                employeeIdNumber: digitsOnly,
                                age: derived,
                              }));
                            } else {
                              setFormData((prev) => ({
                                ...prev,
                                passportNumber: value,
                              }));
                            }
                          }}
                          className={`${getAddendumModalInputClass(
                            formData.idType === "id"
                              ? formData.employeeIdNumber.trim().length > 0
                              : formData.passportNumber.trim().length > 0,
                          )} ${
                            isIdDateInvalid ? "border-red-500 ring-red-500" : ""
                          }`}
                          placeholder={
                            formData.idType === "id" ? "Insert 13-digit ID number" : "Insert passport number"
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeStep === 2 && (
                <div className="space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="issueDate" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Date of Notice <span className="text-red-500">*</span>
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                tabIndex={-1}
                                className="inline-flex items-center text-slate-400 hover:text-slate-600"
                                aria-label="Date of notice info"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className={fixedTooltipContentClass}>
                              Select the date when you will be issuing this termination letter to{" "}
                              {formData.employeeName || formData.employeeSurname
                                ? `${formData.employeeName} ${formData.employeeSurname}`.trim()
                                : "the employee"}
                              .
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <div className="flex items-start gap-2">
                        <Input
                          id="issueDate"
                          type="text"
                          readOnly
                          placeholder="Please select a date"
                          value={formData.issueDate ? toDisplayDate(formData.issueDate) : ""}
                          onClick={openNoticeDatePicker}
                          onFocus={openNoticeDatePicker}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openNoticeDatePicker();
                            }
                          }}
                          className={`${getAddendumModalInputClass(formData.issueDate.trim().length > 0)} flex-1 cursor-pointer placeholder:!text-[11px] placeholder:!font-normal placeholder:!text-slate-400`}
                        />
                        <input
                          ref={noticeDatePickerRef}
                          type="date"
                          value={formData.issueDate && /^\d{4}-\d{2}-\d{2}$/.test(formData.issueDate) ? formData.issueDate : ""}
                          onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                          className="sr-only"
                          aria-hidden="true"
                          tabIndex={-1}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="hearingDate" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Date of hearing <span className="text-red-500">*</span>
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                tabIndex={-1}
                                className="inline-flex items-center text-slate-400 hover:text-slate-600"
                                aria-label="Date of hearing info"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className={fixedTooltipContentClass}>
                              Before you dismiss an employee you should first conduct a disciplinary hearing.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <div className="flex items-start gap-2">
                        <Input
                          id="hearingDate"
                          type="text"
                          readOnly
                          placeholder="Please select a date"
                          value={formData.hearingDate ? toDisplayDate(formData.hearingDate) : ""}
                          onClick={openHearingDatePicker}
                          onFocus={openHearingDatePicker}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openHearingDatePicker();
                            }
                          }}
                          className={`${getAddendumModalInputClass(formData.hearingDate.trim().length > 0)} flex-1 cursor-pointer placeholder:!text-[11px] placeholder:!font-normal placeholder:!text-slate-400`}
                        />
                        <input
                          ref={hearingDatePickerRef}
                          type="date"
                          value={formData.hearingDate && /^\d{4}-\d{2}-\d{2}$/.test(formData.hearingDate) ? formData.hearingDate : ""}
                          onChange={(e) => setFormData((prev) => ({ ...prev, hearingDate: e.target.value }))}
                          className="sr-only"
                          aria-hidden="true"
                          tabIndex={-1}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="hearingTime" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Time of hearing <span className="text-red-500">*</span>
                      </Label>
                      <div key={hearingTimeFieldVersion} className="relative">
                        <Select
                          open={hearingTimeFocused ? false : hearingTimeSelectOpen}
                          onOpenChange={setHearingTimeSelectOpen}
                          value={formData.hearingTime}
                          onValueChange={(value) => {
                            setHearingTimeFocused(false);
                            setHearingTimeSelectOpen(false);
                            setFormData((prev) => ({ ...prev, hearingTime: value }));
                          }}
                        >
                          <SelectTrigger
                            id="hearingTime"
                            className={`${getAddendumModalSelectTriggerClass(Boolean(formData.hearingTime.trim()) && !hearingTimeFocused)} ${addendumModalDropdownToneClass}`}
                          >
                            {formData.hearingTime.trim().length > 0 ? (
                              <span
                                className="block flex-1 truncate text-left text-[11px] font-medium text-slate-900 cursor-text"
                                onPointerDown={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setHearingTimeSelectOpen(false);
                                  setHearingTimeFocused(true);
                                }}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setHearingTimeSelectOpen(false);
                                  setHearingTimeFocused(true);
                                }}
                              >
                                {formatTime(formData.hearingTime)}
                              </span>
                            ) : (
                              <SelectValue placeholder="Select hearing time" />
                            )}
                          </SelectTrigger>
                          <SelectContent hideScrollButtons className={addendumModalSelectContentClass}>
                            {hearingTimeOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value} className={addendumModalSelectItemClass}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {hearingTimeFocused ? (
                          <div className="absolute inset-0 z-20">
                            <Input
                              ref={hearingTimeInputRef}
                              type="text"
                              inputMode="numeric"
                              autoFocus
                              value={formData.hearingTime}
                              onChange={() => undefined}
                              onBlur={(e) => {
                                setHearingTimeFocused(false);
                                if (skipHearingTimeBlurCommitRef.current) {
                                  skipHearingTimeBlurCommitRef.current = false;
                                  return;
                                }
                                setFormData((prev) => ({
                                  ...prev,
                                  hearingTime: normalizeHearingTimeInput(e.target.value),
                                }));
                              }}
                              onKeyDown={handleHearingTimeEditorKeyDown}
                              onPaste={handleHearingTimeEditorPaste}
                              className={`h-[34px] pr-11 ${getAddendumModalInputClass(Boolean(formData.hearingTime.trim()))}`}
                            />
                            {getTimeMeridiem(formData.hearingTime) ? (
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-500">
                                {getTimeMeridiem(formData.hearingTime)}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="hearingFormat" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Hearing format <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={formData.hearingFormat || undefined}
                        onValueChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            hearingFormat: value as HearingFormat,
                            hearingLocation: "",
                          }))
                        }
                      >
                        <SelectTrigger
                          id="hearingFormat"
                          className={`${getAddendumModalSelectTriggerClass(Boolean(formData.hearingFormat))} ${addendumModalDropdownToneClass}`}
                        >
                          <SelectValue placeholder="Select hearing format" />
                        </SelectTrigger>
                        <SelectContent className={addendumModalSelectContentClass}>
                          {HEARING_FORMAT_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value} className={addendumModalSelectItemClass}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.hearingFormat ? (
                      <div className="space-y-1.5 md:col-span-2">
                        <Label htmlFor="hearingLocation" className={modalFieldLabelClass}>
                          {formData.hearingFormat === "virtual" ? "Platform used" : "Hearing location"}{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="hearingLocation"
                          type="text"
                          value={formData.hearingLocation}
                          onChange={(e) => setFormData((prev) => ({ ...prev, hearingLocation: e.target.value }))}
                          placeholder={
                            formData.hearingFormat === "virtual"
                              ? "Type platform used (e.g. Zoom, Teams)"
                              : "Type the full address (e.g. office, building, street, etc.)"
                          }
                          className={`${getAddendumModalInputClass(Boolean(formData.hearingLocation.trim()))}`}
                        />
                      </div>
                    ) : null}
                    <div className="space-y-1.5">
                      <Label htmlFor="misconductType" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Type(s) of misconduct <span className="text-red-500">*</span>
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                tabIndex={-1}
                                className="inline-flex items-center text-slate-400 hover:text-slate-600"
                                aria-label="Types of misconduct info"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className={fixedTooltipContentClass}>
                              Select only the types of misconduct{" "}
                              {formData.employeeName || formData.employeeSurname
                                ? `${formData.employeeName} ${formData.employeeSurname}`.trim()
                                : "the employee"}{" "}
                              was found guilty of following the disciplinary hearing.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <button
                        id="misconductType"
                        type="button"
                        onClick={openMisconductPicker}
                        className={`${baseModalFieldClass} !h-[34px] !border-[1.75px] ${formData.misconductTypes.length > 0 ? "!border-emerald-500" : "!border-slate-300"} w-full px-3 text-left`}
                      >
                        <span
                          className={cn(
                            "block truncate text-[11px]",
                            formData.misconductTypes.length > 0 ? "text-slate-900" : "text-slate-400 font-normal",
                          )}
                        >
                          {formData.misconductTypes.length > 0
                            ? formData.misconductTypes.join(", ")
                            : "Select misconduct type(s)"}
                        </span>
                      </button>
                    </div>
                  </div>
                  {formData.misconductTypes.length > 0 ? (
                    <div className="grid gap-3">
                      {formData.misconductTypes.map((type, index) => (
                        <div key={type} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <Label htmlFor={`misconductDescription-${type}`} className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                                {`Charge ${index + 1}: ${type}`} <span className="text-red-500">*</span>
                                <TooltipProvider delayDuration={0}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        tabIndex={-1}
                                        className="inline-flex items-center text-slate-400 hover:text-slate-600"
                                        aria-label={`Charge ${index + 1} guidance`}
                                    >
                                      <Info className="h-3.5 w-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className={fixedTooltipContentClass}>
                                    A charge description is a brief statement of the alleged misconduct, describing what the employee did or failed to do in clear terms.
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              </Label>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => removeMisconductType(type)}
                                className="h-6 rounded px-1.5 text-[10px] font-medium text-slate-500 hover:bg-transparent hover:text-red-600 hover:underline"
                              >
                                Remove
                              </Button>
                            </div>
                            <div className="flex items-center gap-1">
                              {Boolean((formData.misconductDescriptions[type] || "").trim()) ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => clearChargeDescription(type)}
                                  className="h-7 rounded px-2 text-[10px] font-medium text-slate-500 hover:bg-transparent hover:text-blue-600 hover:underline"
                                >
                                  Clear
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => openDraftingAssistant(type)}
                                className="h-7 rounded border-blue-600 px-2 text-[10px] font-medium text-blue-600 hover:bg-transparent hover:text-blue-700"
                              >
                                Drafting Assistant
                              </Button>
                            </div>
                          </div>
                          <Textarea
                            id={`misconductDescription-${type}`}
                            ref={(el) => {
                              if (el) autoResizeTextarea(el);
                            }}
                            value={formData.misconductDescriptions[type] || ""}
                            onChange={(e) => {
                              setFormData((prev) => ({
                                ...prev,
                                misconductDescriptions: {
                                  ...prev.misconductDescriptions,
                                  [type]: e.target.value,
                                },
                              }));
                              autoResizeTextarea(e.currentTarget);
                            }}
                            onInput={(e) => autoResizeTextarea(e.currentTarget)}
                            placeholder="Type the charge description here or use the drafting assistant to generate a charge..."
                            className={`${getAddendumModalTextareaClass(Boolean((formData.misconductDescriptions[type] || "").trim()))} min-h-[68px] resize-none overflow-hidden !outline-none !ring-0 !ring-offset-0 !focus:ring-0 !focus:ring-offset-0 !focus-visible:ring-0 !focus-visible:ring-offset-0`}
                          />
                          {aiGeneratedChargeTypes.includes(type) ? (
                            <p className="text-[10px] text-slate-500">
                              {`${remainingDraftingPrompts}/${maxDailyDraftingPrompts} daily AI charges left. Review this draft charge before use.`}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}

              {!(embedded && externalNavigation) ? (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                {activeStep === steps.length - 1 ? (
                  <div className="flex w-full items-center gap-3 flex-wrap justify-between">
                    <div className="flex-none">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleBack}
                        className="h-[28px] w-[84px] rounded border-blue-600 px-3 text-xs text-blue-600 hover:bg-transparent hover:text-blue-600"
                      >
                        Back
                      </Button>
                    </div>
                    <div className="flex-1 flex justify-center">
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={clearCurrentStepFields}
                              disabled={isGenerating}
                              aria-label="Reset fields"
                              className="gap-2 text-slate-700 hover:text-blue-600 hover:bg-white transition-transform duration-200 hover:scale-105 disabled:text-slate-300"
                            >
                              <Undo2 className="h-4 w-4" />
                              Reset
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="!rounded">Reset fields for this step</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex-none relative">
                      <Button
                        type="button"
                        onClick={handleFinish}
                        disabled={!isFormComplete || isGenerating}
                        className="h-[30px] w-[92px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700 disabled:bg-slate-300"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex w-full items-center justify-between gap-2 flex-wrap">
                    <div className="flex-none">
                      {activeStep > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleBack}
                          className="h-[28px] w-[84px] rounded border-blue-600 px-3 text-xs text-blue-600 hover:bg-transparent hover:text-blue-600"
                        >
                          Back
                        </Button>
                      )}
                    </div>
                    <div className="flex-1 flex justify-center">
                      {activeStep > 0 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={clearCurrentStepFields}
                          disabled={isGenerating}
                          aria-label="Reset fields"
                          className="gap-2 text-slate-700 hover:text-blue-600 hover:bg-white transition-transform duration-200 hover:scale-105 disabled:text-slate-300"
                        >
                          <Undo2 className="h-4 w-4" />
                          Reset
                        </Button>
                      ) : null}
                    </div>
                    <div className="flex-none">
                      {activeStep < steps.length - 1 && (
                        <Button
                          type="button"
                          onClick={handleNext}
                          disabled={!canGoNext}
                          className="h-[28px] w-[84px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700 disabled:bg-slate-300"
                        >
                          Next
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                </div>
              ) : null}
            </div>
          </CardContent>
          </Card>
          ) : (
            <Card className={cn("rounded-sm mt-4 shadow-none border-0 bg-transparent", useExternalShell && "mt-0 contents")}>
              <CardHeader className="pt-4 pb-0" />
              <CardContent className={cn("space-y-6 pt-2", useExternalShell && "contents")}>
                  <ScrollArea className="h-[70vh] w-full rounded-sm bg-white px-6 pb-6" ref={previewScrollRef}>
            {validatedPreview ? (
              <div className="space-y-8">
                <FirstPagePreview data={validatedPreview} profile={profile} logoPreviewUrl={companyLogoPreview || validatedPreview.companyLogoDataUrl}>
                  <div className="w-full space-y-4 pt-2 text-[11px] leading-relaxed text-black">
                    <h2 className="text-center text-[14px] font-bold uppercase">Notice of Disciplinary Hearing</h2>

                    <section className="overflow-hidden rounded border border-slate-300">
                      <div className="w-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold uppercase">
                        A. Employee Details
                      </div>
                      <div className="grid grid-cols-1 gap-2 px-3 py-2 md:grid-cols-2">
                        <div className="grid grid-cols-[92px,1fr]">
                          <span className="font-semibold">Employee:</span>
                          <span>{[validatedPreview.employeeName, validatedPreview.employeeSurname].filter(Boolean).join(" ").trim() || "________________________"}</span>
                        </div>
                        <div className="grid grid-cols-[124px,1fr]">
                          <span className="font-semibold">
                            {validatedPreview.idType === "passport" ? "Passport Number:" : "ID Number:"}
                          </span>
                          <span>
                            {validatedPreview.idType === "passport"
                              ? (validatedPreview.passportNumber || "________________________")
                              : (validatedPreview.employeeIdNumber || "________________________")}
                          </span>
                        </div>
                      </div>
                    </section>

                    <section className="overflow-hidden rounded border border-slate-300">
                      <div className="w-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold uppercase">
                        B. Hearing Details
                      </div>
                      <div className="grid grid-cols-1 gap-2 px-3 py-2 md:grid-cols-2">
                        <div className="grid grid-cols-[92px,1fr]">
                          <span className="font-semibold">Date:</span>
                          <span>{formatDate(validatedPreview.hearingDate) || "________________________"}</span>
                        </div>
                        <div className="grid grid-cols-[124px,1fr]">
                          <span className="font-semibold">Time:</span>
                          <span>{formatTime(validatedPreview.hearingTime) || "________________________"}</span>
                        </div>
                        <div className="grid grid-cols-[92px,1fr] md:col-span-2">
                          <span className="font-semibold">Place:</span>
                          <span>{formatHearingPlaceDisplay(validatedPreview.hearingFormat, validatedPreview.hearingLocation) || "________________________"}</span>
                        </div>
                      </div>
                    </section>

                    <section className="overflow-hidden rounded border border-slate-300">
                      <div className="w-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold uppercase">
                        C. Transgression(s) / Charge(s)
                      </div>
                      <div className="px-3 py-2">
                        <div className="space-y-3">
                          {validatedPreview.misconductTypes.map((type, index) => (
                            <div key={`${type}-${index}`} className="space-y-1">
                              <p className="font-semibold">
                                <span className="inline-block w-5 align-top">{`${index + 1}.`}</span>
                                <span>{type}</span>
                              </p>
                              <p className="pl-5">{validatedPreview.misconductDescriptions[type] || "________________________"}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>

                    <section className="space-y-2 px-1 text-[10px]">
                      <p>{HEARING_RIGHTS_INTRO}</p>
                      <ul className="list-disc space-y-1 pl-5">
                        {HEARING_RIGHTS_ITEMS.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>

                    <section className="space-y-4">
                      <div className="w-full rounded border border-slate-300 bg-slate-100 px-3 py-1.5 text-[11px] font-semibold uppercase">
                        Signatures
                      </div>
                      <div className="grid grid-cols-1 gap-x-12 gap-y-6 text-[11px] md:grid-cols-2">
                        {SIGNATURE_LABELS.map((label) => (
                          <div key={label} className="space-y-2">
                            <div className="flex items-center gap-8">
                              <span className="flex-1 border-b border-black" />
                              <span className="w-24 border-b border-black" />
                            </div>
                            <div className="flex items-center gap-8 text-[11px]">
                              <span className="flex-1">{label}</span>
                              <span className="w-24">Date</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="rounded border border-slate-300 bg-slate-100 px-3 py-2 text-[10px] italic text-slate-700">
                        {SIGNATURE_REFUSAL_NOTE}
                      </div>
                    </section>
                  </div>
                </FirstPagePreview>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">Complete the form to preview the disciplinary hearing notice.</p>
              </div>
            )}
          </ScrollArea>
                {!useExternalShell ? (
                  <div className="flex w-full items-center justify-between gap-2 flex-wrap">
                    <div className="flex-none">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleBack}
                        className="h-[28px] w-[84px] rounded border-blue-600 px-3 text-xs text-blue-600 hover:bg-transparent hover:text-blue-600"
                      >
                        Back
                      </Button>
                    </div>
                    <div className="flex-1 flex justify-center">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={togglePreviewEditMode}
                        disabled={isGenerating}
                        className="gap-2 text-slate-700 hover:text-blue-600 hover:bg-white transition-transform duration-200 hover:scale-105 disabled:text-slate-300"
                      >
                        {isPreviewEditable ? "Save" : "Edit"}
                      </Button>
                    </div>
                    <div className="flex-none">
                      <Button
                        type="button"
                        onClick={handleDownload}
                        disabled={isGenerating || isPreviewEditable}
                        className="h-[28px] w-[84px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700 disabled:bg-slate-300"
                      >
                        Download
                      </Button>
                    </div>
                  </div>
                ) : null}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={sameDayCaution.open} onOpenChange={(open) => (!open ? closeSameDayCaution() : undefined)}>
        <DialogContent className="w-[94vw] max-w-[680px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-white [&>button]:hidden">
          <div className="flex items-center justify-between bg-[#2D4256] px-4 py-3 -mx-px -mt-px">
            <div className="flex items-center gap-2 pl-2">
              <TriangleAlert className="h-4 w-4 text-white" />
              <DialogTitle className="text-sm font-semibold text-white">Caution</DialogTitle>
            </div>
            <DialogClose asChild>
              <button type="button" className="text-white hover:text-white/80" onClick={closeSameDayCaution}>
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
          <DialogHeader className="px-6 pt-5 pb-1">
            <DialogDescription className="py-1 text-[11px] text-slate-600">
              Best labour practice requires either the employer or an independent decision maker to apply his/her mind
              before making a dismissal decision. Giving notice of dismissal on the same day as the hearing may be
              viewed as if the employer decided on dismissal before the hearing which could result in a procedurally unfair
              dismissal. Are you sure you want to continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="px-6 pb-6 pt-0">
            <div className="flex w-full justify-center border-t border-dashed border-muted/60 pt-4">
              <div className="flex items-center gap-[42px]">
                <Button
                  type="button"
                  onClick={closeSameDayCaution}
                  className="h-[30px] w-[92px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700"
                >
                  No
                </Button>
                <Button
                  type="button"
                  onClick={confirmSameDayCaution}
                  className="h-[28px] w-[84px] rounded border border-slate-300 bg-white px-3 text-xs text-slate-600 hover:bg-white hover:border-blue-600 hover:text-blue-600"
                >
                  Yes
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={draftingAssistantOpen} onOpenChange={(open) => (open ? undefined : closeDraftingAssistant())}>
        <DialogContent className="w-[94vw] max-w-[680px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-white [&>button]:hidden">
          <div className="flex items-center justify-between bg-[#2D4256] px-4 py-3 -mx-px -mt-px">
            <div className="flex items-center gap-2 pl-2">
              <Bot className="h-4 w-4 text-white" />
              <DialogTitle className="text-sm font-semibold text-white">Drafting Assistant</DialogTitle>
            </div>
            <DialogClose asChild>
              <button type="button" className="text-white hover:text-white/80" disabled={isDraftingAssistantGenerating}>
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
          <div className="space-y-3 px-6 pb-4 pt-4">
            {draftingAssistantChargeType && draftingAssistantChargeNumber > 0 ? (
              <p className="text-[11px] font-semibold underline text-slate-700">{`Charge ${draftingAssistantChargeNumber}: ${draftingAssistantChargeType}`}</p>
            ) : null}
            <div className="space-y-1.5">
              <Label className={`${modalFieldLabelClass} text-slate-500`}>When did the misconduct occur? <span className="text-red-500">*</span></Label>
              <Textarea
                value={draftingAssistantAnswers.misconductOccurredWhen}
                onChange={(e) =>
                  setDraftingAssistantAnswers((prev) => ({ ...prev, misconductOccurredWhen: e.target.value }))
                }
                onFocus={() => setDraftingAssistantFocusedField("misconductOccurredWhen")}
                onBlur={() => setDraftingAssistantFocusedField((prev) => (prev === "misconductOccurredWhen" ? null : prev))}
                placeholder="Please select the date of the incident, or specify a date range or multiple dates if applicable (e.g. from 1 June 2025 to 10 June 2025, or on various occasions during June 2025)"
                className={`${getAddendumModalInputClass(
                  Boolean(draftingAssistantAnswers.misconductOccurredWhen.trim()) &&
                    draftingAssistantFocusedField !== "misconductOccurredWhen",
                )} min-h-[64px] rounded !focus:border-blue-600 !focus-visible:border-blue-600 placeholder:text-[10px] placeholder:!text-slate-400 focus:placeholder:transparent`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={`${modalFieldLabelClass} text-slate-500`}>Describe what happened? <span className="text-red-500">*</span></Label>
              <Textarea
                value={draftingAssistantAnswers.whatHappened}
                onChange={(e) =>
                  setDraftingAssistantAnswers((prev) => ({ ...prev, whatHappened: e.target.value }))
                }
                onFocus={() => setDraftingAssistantFocusedField("whatHappened")}
                onBlur={() => setDraftingAssistantFocusedField((prev) => (prev === "whatHappened" ? null : prev))}
                placeholder="Please describe the incident clearly, including what the employee did or failed to do, where it occurred, and any relevant circumstances"
                className={`${getAddendumModalInputClass(
                  Boolean(draftingAssistantAnswers.whatHappened.trim()) &&
                    draftingAssistantFocusedField !== "whatHappened",
                )} min-h-[64px] rounded !focus:border-blue-600 !focus-visible:border-blue-600 placeholder:text-[10px] placeholder:!text-slate-400 focus:placeholder:transparent`}
              />
            </div>
            {draftingAssistantNeedsInvolvement ? (
              <div className="space-y-1.5">
                <Label className={`${modalFieldLabelClass} text-slate-500`}>What was the employee's involvement? <span className="text-red-500">*</span></Label>
                <Select
                  value={draftingAssistantAnswers.involvementSelection}
                  onValueChange={(value) =>
                    setDraftingAssistantAnswers((prev) => ({ ...prev, involvementSelection: value }))
                  }
                >
                  <SelectTrigger
                    className={`${getAddendumModalInputClass(Boolean(draftingAssistantAnswers.involvementSelection))} !rounded justify-between data-[placeholder]:text-slate-400 data-[placeholder]:text-xs !focus:border-slate-300 !focus-visible:border-slate-300 data-[state=open]:!border-slate-300 !outline-none !focus:outline-none !focus-visible:outline-none !ring-0 !focus:ring-0 !focus-visible:ring-0 !ring-offset-0 !focus:ring-offset-0 !focus-visible:ring-offset-0`}
                  >
                    <SelectValue placeholder="Select involvement" />
                  </SelectTrigger>
                  <SelectContent className={addendumModalSelectContentClass}>
                    {draftingAssistantInvolvementOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value} className={addendumModalSelectItemClass}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label className={`${modalFieldLabelClass} text-slate-500`}>Any additional relevant details? (Optional)</Label>
              <Textarea
                value={draftingAssistantAnswers.additionalDetails}
                onChange={(e) =>
                  setDraftingAssistantAnswers((prev) => ({ ...prev, additionalDetails: e.target.value }))
                }
                onFocus={() => setDraftingAssistantFocusedField("additionalDetails")}
                onBlur={() => setDraftingAssistantFocusedField((prev) => (prev === "additionalDetails" ? null : prev))}
                placeholder="Please include any additional information such as instructions given, witnesses, company policies breached, or any impact on the business (if applicable)"
                className={`${getAddendumModalInputClass(
                  Boolean(draftingAssistantAnswers.additionalDetails.trim()) &&
                    draftingAssistantFocusedField !== "additionalDetails",
                )} min-h-[64px] rounded !focus:border-blue-600 !focus-visible:border-blue-600 placeholder:text-[10px] placeholder:!text-slate-400 focus:placeholder:transparent`}
              />
            </div>
            <div className="space-y-2 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] text-slate-600">
              <DialogDescription className="m-0 text-[10px] text-slate-600">
                You are about to generate content using artificial intelligence based on your input. This is a guideline only and not legal advice. You remain responsible for reviewing and confirming that the final charge is accurate, lawful, and appropriate before use, and may verify it with an independent labour law specialist if necessary.
              </DialogDescription>
              <label className="inline-flex items-center gap-2 text-[10px] text-slate-700">
                <Checkbox
                  checked={draftingAssistantAccepted}
                  onCheckedChange={(checked) => setDraftingAssistantAccepted(Boolean(checked))}
                  disabled={!isDraftingAssistantRequiredFieldsComplete}
                  className="h-4 w-4 rounded-[2px] border-slate-400 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 [&>span]:flex [&>span]:h-full [&>span]:w-full [&>span]:items-center [&>span]:justify-center [&>span>svg]:h-3 [&>span>svg]:w-3"
                />
                <span>I confirm that I will review and accept responsibility for the generated charge.</span>
              </label>
            </div>
          </div>
          <DialogFooter className="px-6 pb-4 pt-0">
            <div className="flex w-full justify-center border-t border-dashed border-muted/60 pt-4">
              <Button
                type="button"
                onClick={generateChargeDraft}
                disabled={isDraftingAssistantGenerating || !isDraftingAssistantComplete}
                className="h-[30px] w-[170px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700 disabled:bg-blue-300 disabled:text-white"
              >
                {isDraftingAssistantGenerating ? "Generating..." : "Generate Description"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={misconductPickerOpen} onOpenChange={(open) => (open ? openMisconductPicker() : cancelMisconductPicker())}>
        <DialogContent className="w-[94vw] max-w-[680px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-white [&>button]:hidden">
          <div className="flex items-center justify-between bg-[#2D4256] px-4 py-3 -mx-px -mt-px">
            <div className="flex items-center gap-2 pl-2">
              <Briefcase className="h-4 w-4 text-white" />
              <DialogTitle className="text-sm font-semibold text-white">Select Misconduct Type(s)</DialogTitle>
            </div>
            <DialogClose asChild>
              <button type="button" className="text-white hover:text-white/80">
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
          <DialogHeader className="px-6 pt-4 pb-0">
            <DialogDescription className="text-[11px] text-slate-600">
              Choose one or more misconduct types. Use Done to apply or Cancel to discard changes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-6 pb-6 pt-4">
            <Input
              ref={misconductSearchInputRef}
              placeholder="Search misconduct types"
              value={misconductSearch}
              onChange={(e) => setMisconductSearch(e.target.value)}
              className="h-8 rounded border-slate-300 text-[11px] placeholder:text-[10px] placeholder:text-slate-400"
            />
            <ScrollArea className="h-72 rounded border border-slate-200 bg-white">
              <div className="space-y-1 p-3">
                {filteredMisconductTypes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No misconduct types match your search.</p>
                ) : (
                  filteredMisconductTypes.map((type) => (
                    <label
                      key={type}
                      className={`flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-blue-50/70 hover:text-blue-600 focus-within:bg-blue-50/70 ${addendumModalSelectItemClass}`}
                    >
                      <Checkbox
                        checked={draftMisconductTypes.includes(type)}
                        onCheckedChange={(checked) =>
                          setDraftMisconductTypes((prev) =>
                            checked ? (prev.includes(type) ? prev : [...prev, type]) : prev.filter((item) => item !== type),
                          )
                        }
                        className="h-4 w-4 rounded-[2px] border-slate-400 text-white data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
                      />
                      <span className="flex-1">{type}</span>
                    </label>
                  ))
                )}
              </div>
            </ScrollArea>
            <div>
              {draftMisconductTypes.length === 0 ? (
                <div className="text-xs text-slate-600">No type selected</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {draftMisconductTypes.map((type) => (
                    <Badge
                      key={type}
                      variant="outline"
                      className="gap-1 border-blue-300 bg-blue-50 text-[10px] text-blue-700 !font-normal hover:bg-blue-50"
                    >
                      <span>{type}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setDraftMisconductTypes((prev) => prev.filter((item) => item !== type))
                        }
                        className="inline-flex items-center text-blue-600 hover:text-blue-800"
                        aria-label={`Remove ${type}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="px-6 pb-4 pt-0">
            <div className="grid w-full grid-cols-3 items-center border-t border-dashed border-muted/60 pt-4">
              <div className="justify-self-start">
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelMisconductPicker}
                  className="h-[28px] w-[84px] rounded border-blue-600 px-3 text-xs text-blue-600 hover:bg-transparent hover:text-blue-600"
                >
                  Cancel
                </Button>
              </div>
              <div className="justify-self-center">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDraftMisconductTypes([])}
                  disabled={draftMisconductTypes.length === 0}
                  className="h-[30px] rounded border-0 px-3 text-xs text-slate-500 shadow-none hover:bg-transparent hover:text-slate-600 hover:underline disabled:text-slate-300"
                >
                  Clear
                </Button>
              </div>
              <div className="justify-self-end">
                <Button
                  type="button"
                  onClick={applyMisconductPicker}
                  className="h-[30px] w-[92px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700"
                >
                  Done
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={colorThemePickerOpen} onOpenChange={(open) => (open ? openColorThemePicker() : cancelColorThemePicker())}>
        <DialogContent className="w-[94vw] max-w-[680px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-white [&>button]:hidden">
          <div className="flex items-center justify-between bg-[#2D4256] px-4 py-3 -mx-px -mt-px">
            <div className="flex items-center gap-2 pl-2">
              <Palette className="h-4 w-4 text-white" />
              <DialogTitle className="text-sm font-semibold text-white">Select Colour Theme</DialogTitle>
            </div>
            <DialogClose asChild>
              <button type="button" className="text-white hover:text-white/80">
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
          <DialogHeader className="px-6 pt-4 pb-0">
            <DialogDescription className="text-[11px] text-slate-600">
              Choose up to two colours. Selection order applies: 1 for divider lines, 2 for icon colour.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-6 pb-6 pt-4">
            <div className="rounded border border-slate-200 bg-white p-3">
              <div className="grid grid-cols-7 gap-2">
                {letterheadColorOptions.map((option) => {
                  const selectedPositions = draftLetterheadThemeColors
                    .map((color, index) => (color === option.value ? index + 1 : null))
                    .filter((position): position is number => position !== null);
                  const isSelected = selectedPositions.length > 0;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleDraftThemeColor(option.value)}
                      className={`relative h-8 w-8 rounded-[2px] border transition ${isSelected ? "border-blue-600 ring-1 ring-blue-200" : "border-slate-300 hover:border-blue-500"}`}
                      style={{ backgroundColor: option.value }}
                      aria-label={`Theme colour ${option.value}`}
                    >
                      {isSelected ? (
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                          {selectedPositions.join("/")}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              {draftLetterheadThemeColors.length === 0 ? (
                <div className="text-xs text-slate-600">No colours selected</div>
              ) : (
                <div className="flex items-center gap-2">
                  {draftLetterheadThemeColors.map((color, index) => (
                    <span key={`${color}-${index}`} className="inline-flex items-center gap-2 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700">
                      <span className="inline-flex h-4 w-4 rounded-[2px] border border-slate-300" style={{ backgroundColor: color }} />
                      <span>{index === 0 ? "Divider(s)" : "Icons"}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="px-6 pb-4 pt-0">
            <div className="grid w-full grid-cols-3 items-center border-t border-dashed border-muted/60 pt-4">
              <div className="justify-self-start">
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelColorThemePicker}
                  className="h-[28px] w-[84px] rounded border-blue-600 px-3 text-xs text-blue-600 hover:bg-transparent hover:text-blue-600"
                >
                  Cancel
                </Button>
              </div>
              <div className="justify-self-center">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDraftLetterheadThemeColors([])}
                  disabled={draftLetterheadThemeColors.length === 0}
                  className="h-[30px] rounded border-0 px-3 text-xs text-slate-500 shadow-none hover:bg-transparent hover:text-slate-600 hover:underline disabled:text-slate-300"
                >
                  Clear
                </Button>
              </div>
              <div className="justify-self-end">
                <Button
                  type="button"
                  onClick={applyColorThemePicker}
                  className="h-[30px] w-[92px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700"
                >
                  Done
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  return embedded ? content : <DashboardLayout>{content}</DashboardLayout>;
};

export default MisconductTerminationGenerator;








