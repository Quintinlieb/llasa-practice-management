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
import { Download, Building2, User2, Briefcase, Check, Undo2, X, Info, Plus, Calendar, TriangleAlert, Mail, Phone, Palette } from "lucide-react";
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

type ServiceCertificateFormState = {
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
  illHealthConcernTypes: string[];
  illHealthConcernDescriptions: Record<string, string>;
  serviceStartDate: string;
  terminationDate: string;
  serviceContractType: string;
  industryRegulation: IndustryRegulation;
  industryRegulationDetail: string;
} & Omit<PermanentContractFormData, "salaryAmount" | "salaryFrequency" | "gender" | "race" | "annualLeaveDays"> & {
  salaryAmount: string;
  salaryFrequency: PermanentContractFormData["salaryFrequency"] | "";
  annualLeaveDays: string;
  gender: PermanentContractFormData["gender"] | "";
  race: PermanentContractFormData["race"] | "";
  certificateReference: string;
  hearingNoticeType: HearingNoticeType | "";
  effectiveDate: string;
  serviceEndDate: string;
  newEndDate: string;
  idType: "id" | "passport";
};

type AmendmentType = "add" | "amend";
type HearingNoticeType = "general" | "renewal" | "extension";
type HearingFormat = "in_person" | "virtual";
type IndustryRegulation = "none" | "bargaining_council" | "sectoral_determination";

type ServiceCertificateData = PermanentContractFormData & {
  certificateReference: string;
  hearingNoticeType: HearingNoticeType;
  effectiveDate: string;
  serviceEndDate: string;
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
  illHealthConcernTypes: string[];
  illHealthConcernDescriptions: Record<string, string>;
  serviceStartDate: string;
  terminationDate: string;
  serviceContractType: string;
  industryRegulation: IndustryRegulation;
  industryRegulationDetail: string;
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
  contract_type: string | null;
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

const hearingNoticeTypeOptions: Array<{ value: HearingNoticeType; label: string }> = [
  { value: "general", label: "General Notice" },
  { value: "renewal", label: "Contract Renewal" },
  { value: "extension", label: "Contract Extension" },
];

const hearingNoticeTypeLabels: Record<HearingNoticeType, string> = {
  general: "General Notice",
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

const ILL_HEALTH_CONCERN_TYPES = [
  "Prolonged or repeated absence from work due to ill health",
  "Medical condition affecting ability to perform core duties",
  "Medical report of permanent incapacity",
  "Medical report of temporary incapacity",
  "Reduced physical capacity affecting required tasks",
  "Reduced ability to perform duties effectively due to ill health",
  "Inability to perform duties safely due to health condition",
  "Ongoing medical restrictions limiting role requirements",
  "Limited capacity despite reasonable support provided",
] as const;

const HEARING_FORMAT_OPTIONS = [
  { value: "in_person", label: "In person" },
  { value: "virtual", label: "Virtual" },
] as const;

const DEFAULT_CONTRACT_TYPE_OPTIONS = ["Permanent", "Temporary", "Part-time"] as const;
const industryRegulationOptions: Array<{ value: IndustryRegulation; label: string }> = [
  { value: "none", label: "None" },
  { value: "bargaining_council", label: "Bargaining Council" },
  { value: "sectoral_determination", label: "Sectoral Determination" },
];

const HEARING_RIGHTS_INTRO = "Please note that your rights at the hearing are as follows:";

const HEARING_RIGHTS_ITEMS = [
  "The right to be given time to prepare your case.",
  "The right to be given advance warning of the ill-health concerns.",
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

const formatParagraphSalary = (amount: number) => {
  const us = amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `R ${us}`;
};

const formatSalaryAmountDisplay = (value: string) => {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return "";
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return "";
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatSalaryAmountTypingDisplay = (value: string) => {
  const normalized = value.replace(/,/g, "");
  if (!normalized) return "";
  const hasTrailingDot = normalized.endsWith(".");
  const [wholePart = "", decimalPart] = normalized.split(".");
  const safeWhole = wholePart.replace(/\D/g, "");
  const wholeWithCommas = safeWhole ? Number(safeWhole).toLocaleString("en-US") : "0";
  if (hasTrailingDot) return `${wholeWithCommas}.`;
  if (decimalPart !== undefined) return `${wholeWithCommas}.${decimalPart}`;
  return wholeWithCommas;
};

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

const fillClausePlaceholders = (body: string | string[], certificateRef: string, effectiveDate: string, newEndDate = "") => {
  const replaceText = (text: string) =>
    text
      .replace("[certificate reference]", certificateRef)
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

const formatIllHealthConcernDetails = (
  types: string[],
  descriptions: Record<string, string>,
) => {
  const details = types
    .map((type) => {
      const description = (descriptions[type] || "").trim();
      return description ? `${type}: ${description}` : type;
    })
    .filter(Boolean);

  if (details.length === 0) return "[ill-health concern details]";
  if (details.length === 1) return details[0];
  return details.join("; ");
};

const formatHearingPlaceDisplay = (hearingFormat: HearingFormat | "", hearingLocation: string) => {
  const value = hearingLocation.trim();
  if (!value) return "";
  if (hearingFormat === "virtual") return `Virtual - ${value}`;
  return value;
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
  data: ServiceCertificateData;
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

const ServiceCertificateGenerator = ({
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
    hearingNoticeType?: HearingNoticeType | "";
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

  const [profile, setProfile] = useState<SlimProfile | null>(null);
  const [employees, setEmployees] = useState<SlimEmployee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [showFinalActions, setShowFinalActions] = useState(false);
  const [isPreviewEditable, setIsPreviewEditable] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [validatedPreview, setValidatedPreview] = useState<ServiceCertificateData | null>(null);
  const [clauseEdits, setClauseEdits] = useState<Record<string, string>>({});
  const [customClauseTitleEdits, setCustomClauseTitleEdits] = useState<Record<string, string>>({});
  const [editingClause, setEditingClause] = useState<string | null>(null);
  const [clauseDraft, setClauseDraft] = useState("");
  const [customClauseTitleDraft, setCustomClauseTitleDraft] = useState("");
  const [customClauses, setCustomClauses] = useState<CustomClause[]>([]);
  const [addingAfter, setAddingAfter] = useState<string | null | undefined>(undefined);
  const [newClauseBody, setNewClauseBody] = useState("");
  const steps = ["Employer Details", "Employee Details", "Certificate Details"] as const;
  const stepIcons = [Building2, User2, Briefcase] as const;
  const [activeStep, setActiveStep] = useState(0);
  const [employeeSearchOpen, setEmployeeSearchOpen] = useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [formData, setFormData] = useState<ServiceCertificateFormState>({
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
    illHealthConcernTypes: [],
    illHealthConcernDescriptions: {},
    serviceStartDate: "",
    terminationDate: "",
    serviceContractType: "",
    industryRegulation: "none",
    industryRegulationDetail: "",
    certificateReference: "",
    hearingNoticeType: "general",
    effectiveDate: "",
    serviceEndDate: "",
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
    salaryFrequency: "",
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
  const [isSalaryAmountFocused, setIsSalaryAmountFocused] = useState(false);
  const [customConcernInput, setCustomConcernInput] = useState("");
  const [illHealthConcernPickerOpen, setIllHealthConcernPickerOpen] = useState(false);
  const [draftIllHealthConcernTypes, setDraftIllHealthConcernTypes] = useState<string[]>([]);
  const [hearingTimeFocused, setHearingTimeFocused] = useState(false);
  const [hearingTimeSelectOpen, setHearingTimeSelectOpen] = useState(false);
  const [hearingTimeFieldVersion, setHearingTimeFieldVersion] = useState(0);
  const [colorThemePickerOpen, setColorThemePickerOpen] = useState(false);
  const [draftLetterheadThemeColors, setDraftLetterheadThemeColors] = useState<string[]>([]);
  const noticeDatePickerRef = useRef<HTMLInputElement | null>(null);
  const hearingDatePickerRef = useRef<HTMLInputElement | null>(null);
  const certificateReferencePickerRef = useRef<HTMLInputElement | null>(null);
  const serviceEndDatePickerRef = useRef<HTMLInputElement | null>(null);
  const newEndDatePickerRef = useRef<HTMLInputElement | null>(null);
  const companyLogoInputRef = useRef<HTMLInputElement | null>(null);
  const employeeSearchInputRef = useRef<HTMLInputElement | null>(null);
  const customConcernInputRef = useRef<HTMLInputElement | null>(null);
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
  const noticeModalDropdownToneClass =
    "bg-white border-slate-300 hover:border-blue-400 data-[state=open]:border-slate-300 data-[state=open]:bg-white";
  const noticeModalSelectContentClass = "!rounded";
  const noticeModalSelectItemClass =
    "!rounded text-[11px] text-slate-700 focus:bg-blue-50/70 focus:text-blue-600 data-[highlighted]:bg-blue-50/70 data-[highlighted]:text-blue-600 data-[state=checked]:text-slate-700 data-[state=checked]:data-[highlighted]:text-slate-700";
  const getNoticeModalInputClass = (isComplete: boolean) =>
    `${baseModalFieldClass} !h-[34px] !border-[1.75px] !border-slate-300 !focus-visible:border-slate-300 ${isComplete ? "!border-emerald-500" : ""}`;
  const getNoticeModalSelectTriggerClass = (isComplete: boolean) =>
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
  const contractTypeOptions = useMemo(() => {
    const fromEmployees = employees
      .map((employee) => (employee.contract_type || "").trim())
      .filter((value): value is string => Boolean(value));
    const merged = [...DEFAULT_CONTRACT_TYPE_OPTIONS, ...fromEmployees];
    return Array.from(new Set(merged));
  }, [employees]);
  const selectedLetterheadThemeColors = useMemo(
    () => sanitizeThemeColors(formData.letterheadThemeColors),
    [formData.letterheadThemeColors],
  );
  const illHealthConcernOptions = useMemo(() => {
    const merged = [...ILL_HEALTH_CONCERN_TYPES, ...formData.illHealthConcernTypes];
    return Array.from(
      new Set(
        merged
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      ),
    );
  }, [formData.illHealthConcernTypes]);
  const filteredIllHealthConcernTypes = useMemo(() => {
    const query = customConcernInput.trim().toLowerCase();
    if (!query) return illHealthConcernOptions;
    return illHealthConcernOptions.filter((option) => option.toLowerCase().includes(query));
  }, [customConcernInput, illHealthConcernOptions]);

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
        "id, id_number, employee_name, employee_surname, nationality, emergency_contact_number, gender, race, cell_number, email, job_title, start_date, contract_type, employee_number",
      )
      .eq("company_id", user.id)
      .eq("status", "active");
    if (error) {
      console.warn("Unable to load employees", error);
      return;
    }
    if (data) setEmployees(data as SlimEmployee[]);
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchEmployees();
    }
  }, [user, fetchEmployees, fetchProfile]);

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
    const contractType = (employee as Partial<Tables<"employees">> & { contract_type?: string }).contract_type ?? "";
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
      serviceStartDate: startDate || prev.serviceStartDate,
      serviceContractType: contractType || prev.serviceContractType,
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

  const handleSalaryAmountChange = (value: string) => {
    const sanitized = value.replace(/,/g, "").replace(/[^\d.]/g, "");
    const firstDotIndex = sanitized.indexOf(".");
    const normalized =
      firstDotIndex >= 0
        ? `${sanitized.slice(0, firstDotIndex + 1)}${sanitized.slice(firstDotIndex + 1).replace(/\./g, "")}`
        : sanitized;
    const [wholePart, decimalPart] = normalized.split(".");
    const limitedWhole = wholePart.slice(0, 12);
    const limitedDecimal = decimalPart !== undefined ? decimalPart.slice(0, 2) : undefined;
    const nextValue = limitedDecimal !== undefined ? `${limitedWhole}.${limitedDecimal}` : limitedWhole;
    setFormData((prev) => ({ ...prev, salaryAmount: nextValue }));
  };

  const handleSalaryAmountBlur = () => {
    setIsSalaryAmountFocused(false);
    const raw = formData.salaryAmount.replace(/,/g, "").trim();
    if (!raw) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount)) return;
    setFormData((prev) => ({ ...prev, salaryAmount: amount.toFixed(2) }));
  };

  const handleSalaryAmountKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const allowedControlKeys = [
      "Backspace",
      "Delete",
      "Tab",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "Enter",
    ];
    if (allowedControlKeys.includes(event.key)) return;
    if (event.ctrlKey || event.metaKey) return;
    if (/^\d$/.test(event.key)) return;
    if (event.key === ".") {
      const input = event.currentTarget;
      const value = input.value;
      const hasDot = value.includes(".");
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;
      const selectedText = value.slice(start, end);
      const selectionHasDot = selectedText.includes(".");
      if (hasDot && !selectionHasDot) {
        event.preventDefault();
      }
      return;
    }
    event.preventDefault();
  };

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
      illHealthConcernTypes: [],
      illHealthConcernDescriptions: {},
      serviceStartDate: "",
      terminationDate: "",
      serviceContractType: "",
      industryRegulation: "none",
      industryRegulationDetail: "",
      certificateReference: "",
      hearingNoticeType: "general",
      effectiveDate: "",
      serviceEndDate: "",
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
      salaryFrequency: "",
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
    setIsSalaryAmountFocused(false);
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
      const hasServiceStartDate = Boolean(formData.serviceStartDate);
      const hasTerminationDate = Boolean(formData.terminationDate);
      const hasJobTitle = Boolean(formData.jobTitle.trim());
      const hasContractType = Boolean(formData.serviceContractType.trim());
      const hasIndustryRegulationDetail =
        formData.industryRegulation === "none"
          ? true
          : Boolean(formData.industryRegulationDetail.trim());
      const hasSalaryAmount = Boolean(formData.salaryAmount.trim());
      const hasSalaryFrequency = Boolean(formData.salaryFrequency);
      return Boolean(
        hasServiceStartDate &&
          hasTerminationDate &&
          hasJobTitle &&
          hasContractType &&
          hasIndustryRegulationDetail &&
          hasSalaryAmount &&
          hasSalaryFrequency,
      );
    },
    [
      formData.serviceStartDate,
      formData.terminationDate,
      formData.jobTitle,
      formData.serviceContractType,
      formData.industryRegulation,
      formData.industryRegulationDetail,
      formData.salaryAmount,
      formData.salaryFrequency,
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
      hearingNoticeType: formData.hearingNoticeType,
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
    formData.hearingNoticeType,
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

  const resetNoticeDetailsStepFields = () => {
    if (hearingTimeFocused) {
      skipHearingTimeBlurCommitRef.current = true;
    }
    setHearingTimeFocused(false);
    setHearingTimeSelectOpen(false);
    setHearingTimeFieldVersion((prev) => prev + 1);
    setFormData((prev) => ({
      ...prev,
      serviceStartDate: "",
      terminationDate: "",
      jobTitle: "",
      serviceContractType: "",
      industryRegulation: "none",
      industryRegulationDetail: "",
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
      resetNoticeDetailsStepFields();
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

  const openIllHealthConcernPicker = () => {
    setDraftIllHealthConcernTypes(formData.illHealthConcernTypes);
    setCustomConcernInput("");
    setIllHealthConcernPickerOpen(true);
  };

  const cancelIllHealthConcernPicker = () => {
    setIllHealthConcernPickerOpen(false);
    setCustomConcernInput("");
    setDraftIllHealthConcernTypes([]);
  };

  const applyIllHealthConcernPicker = () => {
    setFormData((prev) => {
      const nextDescriptions: Record<string, string> = {};
      draftIllHealthConcernTypes.forEach((type) => {
        nextDescriptions[type] = prev.illHealthConcernDescriptions[type] || "";
      });
      return {
        ...prev,
        illHealthConcernTypes: draftIllHealthConcernTypes,
        illHealthConcernDescriptions: nextDescriptions,
      };
    });
    setIllHealthConcernPickerOpen(false);
    setCustomConcernInput("");
  };

  const addCustomConcern = () => {
    const customConcern = customConcernInput.trim();
    if (!customConcern) return;
    const matchedListedConcern = illHealthConcernOptions.find(
      (option) => option.toLowerCase() === customConcern.toLowerCase(),
    );
    const concernToAdd = matchedListedConcern ?? customConcern;
    const exists = draftIllHealthConcernTypes.some(
      (type) => type.toLowerCase() === concernToAdd.toLowerCase(),
    );
    if (!exists) {
      setDraftIllHealthConcernTypes((prev) => [...prev, concernToAdd]);
    }
    setCustomConcernInput("");
  };

  const clearConcernDescription = (concernType: string) => {
    setFormData((prev) => ({
      ...prev,
      illHealthConcernDescriptions: {
        ...prev.illHealthConcernDescriptions,
        [concernType]: "",
      },
    }));
  };

  const removeIllHealthConcernType = (concernType: string) => {
    const concernNumber = formData.illHealthConcernTypes.indexOf(concernType) + 1;
    const label = concernNumber > 0 ? `Concern ${concernNumber}: ${concernType}` : concernType;
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`Are you sure you want to remove ${label}?`);
      if (!confirmed) return;
    }

    setFormData((prev) => {
      const nextTypes = prev.illHealthConcernTypes.filter((type) => type !== concernType);
      const nextDescriptions = { ...prev.illHealthConcernDescriptions };
      delete nextDescriptions[concernType];
      return {
        ...prev,
        illHealthConcernTypes: nextTypes,
        illHealthConcernDescriptions: nextDescriptions,
      };
    });
    setDraftIllHealthConcernTypes((prev) => prev.filter((type) => type !== concernType));
  };

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

  const openCertificateReferencePicker = () => {
    const picker = certificateReferencePickerRef.current;
    if (!picker) return;
    if (typeof (picker as any).showPicker === "function") {
      (picker as any).showPicker();
    } else {
      picker.click();
    }
  };

  const openServiceEndDatePicker = () => {
    const picker = serviceEndDatePickerRef.current;
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
    checkRequired(formData.serviceStartDate, "Service start");
    checkRequired(formData.terminationDate, "Termination date");
    checkRequired(formData.jobTitle, "Job title");
    checkRequired(formData.serviceContractType, "Contract type");
    if (formData.industryRegulation === "bargaining_council") {
      checkRequired(formData.industryRegulationDetail, "Bargaining council");
    }
    if (formData.industryRegulation === "sectoral_determination") {
      checkRequired(formData.industryRegulationDetail, "Sectoral determination");
    }
    checkRequired(formData.salaryAmount, "Salary");
    checkRequired(formData.salaryFrequency, "Salary cycle");

    if (missingFields.length) {
      throw new Error(`Please fill in the following required fields: ${missingFields.join(", ")}`);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(formData.serviceStartDate) && /^\d{4}-\d{2}-\d{2}$/.test(formData.terminationDate)) {
      const serviceStartDate = new Date(`${formData.serviceStartDate}T00:00:00`);
      const terminationDate = new Date(`${formData.terminationDate}T00:00:00`);
      if (!Number.isNaN(serviceStartDate.getTime()) && !Number.isNaN(terminationDate.getTime()) && terminationDate < serviceStartDate) {
        throw new Error("Termination date cannot be before service start date.");
      }
    }

    const issueDate = formData.issueDate;

    return {
      ...formData,
      issueDate,
      salaryAmount: Number(formData.salaryAmount.replace(/,/g, "")) || 0,
      annualLeaveDays: Number(formData.annualLeaveDays) || 0,
      gender: formData.gender as PermanentContractFormData["gender"],
      race: formData.race as PermanentContractFormData["race"],
      idType: formData.idType,
      hearingNoticeType: "general",
      certificateReference: "",
      serviceEndDate: "",
      newEndDate: "",
      companyLogoDataUrl: formData.companyLogoDataUrl,
      logoPlacement: formData.logoPlacement,
      letterheadThemeColors: sanitizeThemeColors(formData.letterheadThemeColors),
      issuer: formData.issuer,
      hearingDate: formData.hearingDate,
      hearingTime: formData.hearingTime,
      hearingFormat: formData.hearingFormat as HearingFormat,
      hearingLocation: formData.hearingLocation,
      illHealthConcernTypes: formData.illHealthConcernTypes,
      illHealthConcernDescriptions: formData.illHealthConcernDescriptions,
      serviceStartDate: formData.serviceStartDate,
      terminationDate: formData.terminationDate,
      serviceContractType: formData.serviceContractType,
      industryRegulation: formData.industryRegulation,
      industryRegulationDetail: formData.industryRegulationDetail,
    } as ServiceCertificateData;
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

  const generatePDF = (data: ServiceCertificateData, download = false) => {
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
    const concernSectionBorderRgb: [number, number, number] = [180, 188, 198];
    const concernSectionBorderLineWidth = 0.12;
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
      doc.setDrawColor(...concernSectionBorderRgb);
      doc.setLineWidth(concernSectionBorderLineWidth);
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
      doc.setDrawColor(...concernSectionBorderRgb);
      doc.setLineWidth(concernSectionBorderLineWidth);
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
      const leftLabel = "Service Start:";
      const leftValue = valueOrLine(formatDate(data.serviceStartDate));
      const rightLabel = "Termination Date:";
      const rightValue = valueOrLine(formatDate(data.terminationDate));
      const locationLabel = "Job Title:";
      const locationValue = valueOrLine(data.jobTitle || "________________________");
      const salaryLabel = "Salary:";
      const salaryValue = valueOrLine(
        data.salaryAmount > 0
          ? `${formatCurrency(data.salaryAmount)} ${salaryFrequencyLabels[data.salaryFrequency]}`
          : "________________________",
      );
      const columnGap = 4;
      const columnWidth = (contentWidth - sectionPaddingX * 2 - columnGap) / 2;
      const measureValue = (value: string, labelWidth: number) => {
        const valueLines = doc.splitTextToSize(value || "________________________", columnWidth - labelWidth);
        return { valueLines };
      };
      const left = measureValue(leftValue, leftColumnLabelWidth);
      const right = measureValue(rightValue, rightColumnLabelWidth);
      const location = measureValue(locationValue, leftColumnLabelWidth);
      const salary = measureValue(salaryValue, rightColumnLabelWidth);
      const leftHeight = Math.max(1, left.valueLines.length) * sectionLineGap + 1;
      const rightHeight = Math.max(1, right.valueLines.length) * sectionLineGap + 1;
      const locationHeight = Math.max(1, location.valueLines.length) * sectionLineGap + 1;
      const salaryHeight = Math.max(1, salary.valueLines.length) * sectionLineGap + 1;
      const rowsHeight = Math.max(leftHeight, rightHeight) + Math.max(locationHeight, salaryHeight);
      const sectionHeight = sectionHeaderHeight + sectionPaddingY + rowsHeight + sectionPaddingY;

      ensureSpace(sectionHeight + 4);

      const startY = y;
      drawSectionHeaderFill(startY);
      doc.setDrawColor(...concernSectionBorderRgb);
      doc.setLineWidth(concernSectionBorderLineWidth);
      doc.roundedRect(margin, startY, contentWidth, sectionHeight, sectionCornerRadius, sectionCornerRadius, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("B. SERVICE DETAILS", margin + sectionPaddingX, startY + 4.7);

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

      const salaryY = locationY;
      doc.setFont("helvetica", "bold");
      doc.text(`${salaryLabel} `, rightX, salaryY);
      doc.setFont("helvetica", "normal");
      salary.valueLines.forEach((line: string, idx: number) => {
        doc.text(line, rightX + rightColumnLabelWidth, salaryY + idx * sectionLineGap);
      });

      y = startY + sectionHeight + 4;
    };

    const drawIndustryDetailsSection = () => {
      if (data.industryRegulation === "none") return;

      const leftLabel = data.industryRegulation === "bargaining_council" ? "Council:" : "Sector:";
      const leftValue = valueOrLine(data.industryRegulationDetail);
      const valueLines = doc.splitTextToSize(
        leftValue || "________________________",
        contentWidth - sectionPaddingX * 2 - leftColumnLabelWidth,
      );
      const rowHeight = Math.max(1, valueLines.length) * sectionLineGap + 1;
      const sectionHeight = sectionHeaderHeight + sectionPaddingY + rowHeight + sectionPaddingY;

      ensureSpace(sectionHeight + 4);

      const startY = y;
      drawSectionHeaderFill(startY);
      doc.setDrawColor(...concernSectionBorderRgb);
      doc.setLineWidth(concernSectionBorderLineWidth);
      doc.roundedRect(margin, startY, contentWidth, sectionHeight, sectionCornerRadius, sectionCornerRadius, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("C. INDUSTRY DETAILS", margin + sectionPaddingX, startY + 4.7);

      const rowY = startY + sectionHeaderHeight + sectionPaddingY + 3;
      const leftX = margin + sectionPaddingX;
      doc.setFont("helvetica", "bold");
      doc.text(`${leftLabel} `, leftX, rowY);
      doc.setFont("helvetica", "normal");
      valueLines.forEach((line: string, idx: number) => {
        doc.text(line, leftX + leftColumnLabelWidth, rowY + idx * sectionLineGap);
      });

      y = startY + sectionHeight + 4;
    };

    const drawConcernSection = (title: string, concerns: Array<{ heading: string; body: string }>) => {
      const concernsWithLines = concerns.map((concern) => ({
        ...(() => {
          const headingMatch = concern.heading.match(/^(\d+\.\s+)(.*)$/);
          const headingPrefix = headingMatch ? headingMatch[1] : "";
          const headingText = headingMatch ? headingMatch[2] : concern.heading;
          const headingPrefixWidth = headingPrefix ? doc.getTextWidth(headingPrefix) : 0;
          const usableWidth = contentWidth - sectionPaddingX * 2 - headingPrefixWidth;
          return {
            headingPrefix,
            headingPrefixWidth,
            headingLines: doc.splitTextToSize(headingText, usableWidth),
            bodyLines: doc.splitTextToSize(concern.body || "________________________", usableWidth),
          };
        })(),
      }));
      const concernsHeight = concernsWithLines.reduce(
        (acc, concern) => concern.headingLines.length * sectionLineGap + concern.bodyLines.length * sectionLineGap + 2 + acc,
        0,
      );
      const sectionHeight = sectionHeaderHeight + sectionPaddingY + concernsHeight + sectionPaddingY;
      ensureSpace(sectionHeight + 4);

      const startY = y;
      drawSectionHeaderFill(startY);
      doc.setDrawColor(...concernSectionBorderRgb);
      doc.setLineWidth(concernSectionBorderLineWidth);
      doc.roundedRect(margin, startY, contentWidth, sectionHeight, sectionCornerRadius, sectionCornerRadius, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(title.toUpperCase(), margin + sectionPaddingX, startY + 4.7);

      let blockY = startY + sectionHeaderHeight + sectionPaddingY + 3;
      concernsWithLines.forEach((concern) => {
        const concernTextLeftInset = 1.8;
        const textBaseX = margin + sectionPaddingX + concern.headingPrefixWidth + concernTextLeftInset;
        doc.setFont("helvetica", "bold");
        if (concern.headingPrefix) {
          doc.text(concern.headingPrefix, margin + sectionPaddingX, blockY);
        }
        concern.headingLines.forEach((line: string, idx: number) => {
          doc.text(line, textBaseX, blockY + idx * sectionLineGap);
        });
        blockY += concern.headingLines.length * sectionLineGap;
        doc.setFont("helvetica", "normal");
        concern.bodyLines.forEach((line: string, idx: number) => {
          doc.text(line, textBaseX, blockY + idx * sectionLineGap);
        });
        blockY += concern.bodyLines.length * sectionLineGap + 2;
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
    y += 9;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("CERTIFICATE OF SERVICE", pageWidth / 2, y, { align: "center" });
    y += 10;

    drawEmployeeDetailsSection();
    y += 3;

    drawHearingDetailsSection();
    y += 3;
    drawIndustryDetailsSection();
    const confirmationName = [data.employeeName, data.employeeSurname].filter(Boolean).join(" ").trim();
    const confirmationIdNumber =
      data.idType === "passport"
        ? data.passportNumber
        : data.employeeIdNumber;
    const confirmationCompanyName = (profile?.company_name || "").trim();
    const confirmationSalary =
      data.salaryAmount > 0
        ? `${formatCurrency(data.salaryAmount)} ${salaryFrequencyLabels[data.salaryFrequency]}`
        : "";
    const salutationLine = "To whom it may concern";
    const companyNameWithType = `${(profile?.company_name || "").trim()}${
      (profile?.company_type || "").trim() ? ` ${(profile?.company_type || "").trim()}` : ""
    }`.trim();
    const paragraphContractType = (data.serviceContractType || "").trim().toLowerCase();
    const currentYear = new Date().getFullYear();
    const confirmationParagraph = `This serves to confirm that ${
      confirmationName || "________________________"
    }, identity number ${
      confirmationIdNumber || "________________________"
    }, was employed by ${
      companyNameWithType || "________________________"
    } on a ${
      paragraphContractType || "________________________"
    } contract from ${
      formatDate(data.serviceStartDate) || "________________________"
    } until ${
      formatDate(data.terminationDate) || "________________________"
    }, during which period he/she held the position of ${
      data.jobTitle || "________________________"
    }. At the date of termination, the employee's remuneration was ${
      data.salaryAmount > 0
        ? `${formatParagraphSalary(data.salaryAmount)} ${salaryFrequencyLabels[data.salaryFrequency]}`
        : "________________________"
    }.`;
    y += 8;
    doc.setFont("helvetica", "bold");
    drawWrapped(salutationLine, margin + sectionPaddingX, contentWidth - sectionPaddingX * 2, 4.8);
    doc.setFont("helvetica", "normal");
    y += 1.5;
    drawWrapped(confirmationParagraph, margin + sectionPaddingX, contentWidth - sectionPaddingX * 2, 4.8);
    y += 9;
    drawWrapped(
      `Signed and issued at __________________________ on this ______ day of ____________________________ ${currentYear}`,
      margin + sectionPaddingX,
      contentWidth - sectionPaddingX * 2,
      4.8,
    );
    ensureSpace(20);
    y += 14;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.line(margin + sectionPaddingX, y, margin + sectionPaddingX + 45, y);
    y += 5;
    doc.setFontSize(9);
    doc.text("Management", margin + sectionPaddingX, y);
    doc.setFontSize(9);
    doc.setDrawColor(60, 60, 60);
    doc.setLineWidth(0.2);
    y += 10;

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
      doc.save(`Certificate_of_Service_${data.employeeSurname || "employee"}_${data.terminationDate || data.issueDate}.pdf`);
      toast({
        title: "Download ready",
        description: "Certificate of service has been generated.",
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
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="companyName" className={modalFieldLabelClass}>Company name</Label>
                      <Input
                        id="companyName"
                        value={profile?.company_name || ""}
                        readOnly
                        className={getNoticeModalInputClass(Boolean(profile?.company_name))}
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="registrationNumber" className={modalFieldLabelClass}>Registration number</Label>
                      <Input
                        id="registrationNumber"
                        value={profile?.registration_number || ""}
                        readOnly
                        className={getNoticeModalInputClass(Boolean(profile?.registration_number))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="physicalAddress" className={modalFieldLabelClass}>Registered address</Label>
                      <Input
                        id="physicalAddress"
                        value={profile?.physical_address || ""}
                        readOnly
                        className={getNoticeModalInputClass(Boolean(profile?.physical_address))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tradingName" className={modalFieldLabelClass}>Trading name</Label>
                      <Input
                        id="tradingName"
                        value={formData.tradingName}
                        onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
                        placeholder="If different from registered name"
                        className={getNoticeModalInputClass(formData.tradingName.trim().length > 0)}
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
                        className={getNoticeModalInputClass(formData.employerContact.trim().length > 0)}
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
                        className={getNoticeModalInputClass(formData.employerEmail.trim().length > 0)}
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
                        <SelectTrigger className={`${getNoticeModalSelectTriggerClass(selectedEmployeeId.trim().length > 0)} ${noticeModalDropdownToneClass}`}>
                          <SelectValue placeholder="Select from saved employees or fill manually" />
                        </SelectTrigger>
                        <SelectContent
                          hideScrollButtons
                          className={`${noticeModalSelectContentClass} w-[var(--radix-select-trigger-width)] p-0`}
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
                              <SelectItem key={employee.id} value={employee.id} className={noticeModalSelectItemClass}>
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
                          className={getNoticeModalInputClass(formData.employeeName.trim().length > 0)}
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
                          className={getNoticeModalInputClass(formData.employeeSurname.trim().length > 0)}
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
                          <SelectTrigger className={`${getNoticeModalSelectTriggerClass(Boolean(formData.idType))} ${noticeModalDropdownToneClass}`}>
                            <SelectValue placeholder="Choose document type" />
                          </SelectTrigger>
                          <SelectContent className={noticeModalSelectContentClass}>
                            <SelectItem value="id" className={noticeModalSelectItemClass}>ID Number</SelectItem>
                            <SelectItem value="passport" className={noticeModalSelectItemClass}>Passport Number</SelectItem>
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
                          className={`${getNoticeModalInputClass(
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
                      <Label htmlFor="serviceStartDate" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Service Start <span className="text-red-500">*</span>
                      </Label>
                      <div className="flex items-start gap-2">
                        <Input
                          id="serviceStartDate"
                          type="text"
                          readOnly
                          placeholder="Please select a date"
                          value={formData.serviceStartDate ? toDisplayDate(formData.serviceStartDate) : ""}
                          onClick={openNoticeDatePicker}
                          onFocus={openNoticeDatePicker}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openNoticeDatePicker();
                            }
                          }}
                          className={`${getNoticeModalInputClass(formData.serviceStartDate.trim().length > 0)} flex-1 cursor-pointer placeholder:!text-[11px] placeholder:!font-normal placeholder:!text-slate-400`}
                        />
                        <input
                          ref={noticeDatePickerRef}
                          type="date"
                          value={formData.serviceStartDate && /^\d{4}-\d{2}-\d{2}$/.test(formData.serviceStartDate) ? formData.serviceStartDate : ""}
                          onChange={(e) => setFormData((prev) => ({ ...prev, serviceStartDate: e.target.value }))}
                          className="sr-only"
                          aria-hidden="true"
                          tabIndex={-1}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="terminationDate" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Termination Date <span className="text-red-500">*</span>
                      </Label>
                      <div className="flex items-start gap-2">
                        <Input
                          id="terminationDate"
                          type="text"
                          readOnly
                          placeholder="Please select a date"
                          value={formData.terminationDate ? toDisplayDate(formData.terminationDate) : ""}
                          onClick={openHearingDatePicker}
                          onFocus={openHearingDatePicker}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openHearingDatePicker();
                            }
                          }}
                          className={`${getNoticeModalInputClass(formData.terminationDate.trim().length > 0)} flex-1 cursor-pointer placeholder:!text-[11px] placeholder:!font-normal placeholder:!text-slate-400`}
                        />
                        <input
                          ref={hearingDatePickerRef}
                          type="date"
                          value={formData.terminationDate && /^\d{4}-\d{2}-\d{2}$/.test(formData.terminationDate) ? formData.terminationDate : ""}
                          onChange={(e) => setFormData((prev) => ({ ...prev, terminationDate: e.target.value }))}
                          className="sr-only"
                          aria-hidden="true"
                          tabIndex={-1}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="jobTitle" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Job title <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="jobTitle"
                        type="text"
                        value={formData.jobTitle}
                        onChange={(e) => setFormData((prev) => ({ ...prev, jobTitle: e.target.value }))}
                        placeholder="Insert job title"
                        className={getNoticeModalInputClass(Boolean(formData.jobTitle.trim()))}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="serviceContractType" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Contract type <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={formData.serviceContractType || undefined}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, serviceContractType: value }))}
                      >
                        <SelectTrigger
                          id="serviceContractType"
                          className={`${getNoticeModalSelectTriggerClass(Boolean(formData.serviceContractType))} ${noticeModalDropdownToneClass}`}
                        >
                          <SelectValue placeholder="Select contract type" />
                        </SelectTrigger>
                        <SelectContent className={noticeModalSelectContentClass}>
                          {contractTypeOptions.map((option) => (
                            <SelectItem key={option} value={option} className={noticeModalSelectItemClass}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="salaryAmount" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Salary (R) <span className="text-red-500">*</span>
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                tabIndex={-1}
                                className="inline-flex items-center text-slate-400 hover:text-slate-600"
                                aria-label="Salary info"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className={fixedTooltipContentClass}>
                              This is the employee&apos;s salary at the time of termination.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <Input
                        id="salaryAmount"
                        type="text"
                        inputMode="numeric"
                        value={
                          isSalaryAmountFocused
                            ? formatSalaryAmountTypingDisplay(formData.salaryAmount)
                            : formatSalaryAmountDisplay(formData.salaryAmount)
                        }
                        onFocus={() => setIsSalaryAmountFocused(true)}
                        onBlur={handleSalaryAmountBlur}
                        onKeyDown={handleSalaryAmountKeyDown}
                        onChange={(e) => handleSalaryAmountChange(e.target.value)}
                        placeholder="Insert salary amount"
                        className={getNoticeModalInputClass(Boolean(formData.salaryAmount.trim()))}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="salaryFrequency" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Salary cycle <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={formData.salaryFrequency || undefined}
                        onValueChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            salaryFrequency: value as PermanentContractFormData["salaryFrequency"],
                          }))
                        }
                      >
                        <SelectTrigger
                          id="salaryFrequency"
                          className={`${getNoticeModalSelectTriggerClass(Boolean(formData.salaryFrequency))} ${noticeModalDropdownToneClass}`}
                        >
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                        <SelectContent className={noticeModalSelectContentClass}>
                          {salaryFrequencyOptions.map((option) => (
                            <SelectItem key={option} value={option} className={noticeModalSelectItemClass}>
                              {salaryFrequencyLabels[option as PermanentContractFormData["salaryFrequency"]]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="industryRegulation" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Industry regulation <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={formData.industryRegulation}
                        onValueChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            industryRegulation: value as IndustryRegulation,
                            industryRegulationDetail:
                              value === prev.industryRegulation ? prev.industryRegulationDetail : "",
                          }))
                        }
                      >
                        <SelectTrigger
                          id="industryRegulation"
                          className={`${getNoticeModalSelectTriggerClass(Boolean(formData.industryRegulation))} ${noticeModalDropdownToneClass}`}
                        >
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                        <SelectContent className={noticeModalSelectContentClass}>
                          {industryRegulationOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value} className={noticeModalSelectItemClass}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.industryRegulation === "bargaining_council" || formData.industryRegulation === "sectoral_determination" ? (
                      <div className="space-y-1.5 md:col-span-2">
                        <Label htmlFor="industryRegulationDetail" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                          {formData.industryRegulation === "bargaining_council" ? "Bargaining council" : "Sectoral determination"} <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="industryRegulationDetail"
                          type="text"
                          value={formData.industryRegulationDetail}
                          onChange={(e) => setFormData((prev) => ({ ...prev, industryRegulationDetail: e.target.value }))}
                          placeholder={
                            formData.industryRegulation === "bargaining_council"
                              ? "Type the applicable bargaining council"
                              : "Type the applicable sectoral determination"
                          }
                          className={getNoticeModalInputClass(Boolean(formData.industryRegulationDetail.trim()))}
                        />
                      </div>
                    ) : null}

                  </div>
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
                    <h2 className="mb-2 text-center text-[18px] font-bold uppercase">Certificate of Service</h2>

                    <section className="mb-2 overflow-hidden rounded border border-slate-300">
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
                        B. Service Details
                      </div>
                      <div className="grid grid-cols-1 gap-2 px-3 py-2 md:grid-cols-2">
                        <div className="grid grid-cols-[92px,1fr]">
                          <span className="font-semibold">Service Start:</span>
                          <span>{formatDate(validatedPreview.serviceStartDate) || "________________________"}</span>
                        </div>
                        <div className="grid grid-cols-[124px,1fr]">
                          <span className="font-semibold">Termination Date:</span>
                          <span>{formatDate(validatedPreview.terminationDate) || "________________________"}</span>
                        </div>
                        <div className="grid grid-cols-[92px,1fr]">
                          <span className="font-semibold">Job Title:</span>
                          <span>{validatedPreview.jobTitle || "________________________"}</span>
                        </div>
                        <div className="grid grid-cols-[124px,1fr]">
                          <span className="font-semibold">Salary:</span>
                          <span>
                            {validatedPreview.salaryAmount > 0
                              ? `${formatCurrency(validatedPreview.salaryAmount)} ${salaryFrequencyLabels[validatedPreview.salaryFrequency]}`
                              : "________________________"}
                          </span>
                        </div>
                      </div>
                    </section>
                    {validatedPreview.industryRegulation !== "none" ? (
                      <section className="overflow-hidden rounded border border-slate-300">
                        <div className="w-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold uppercase">
                          C. Industry details
                        </div>
                        <div className="grid grid-cols-1 gap-2 px-3 py-2">
                          <div className="grid grid-cols-[92px,1fr]">
                            <span className="font-semibold">
                              {validatedPreview.industryRegulation === "bargaining_council" ? "Council:" : "Sector:"}
                            </span>
                            <span>{validatedPreview.industryRegulationDetail || "________________________"}</span>
                          </div>
                        </div>
                      </section>
                    ) : null}
                    <p className="mt-8 text-[11px] font-semibold leading-relaxed">To whom it may concern</p>
                    <p className="mt-1.5 text-[11px] leading-relaxed">
                      {`This serves to confirm that ${
                        [validatedPreview.employeeName, validatedPreview.employeeSurname].filter(Boolean).join(" ").trim() ||
                        "________________________"
                      }, identity number ${
                        (validatedPreview.idType === "passport"
                          ? validatedPreview.passportNumber
                          : validatedPreview.employeeIdNumber) || "________________________"
                      }, was employed by ${
                        `${(profile?.company_name || "").trim()}${(profile?.company_type || "").trim() ? ` ${(profile?.company_type || "").trim()}` : ""}`.trim() ||
                        "________________________"
                      } on a ${
                        (validatedPreview.serviceContractType || "").trim().toLowerCase() || "________________________"
                      } contract from ${
                        formatDate(validatedPreview.serviceStartDate) || "________________________"
                      } until ${
                        formatDate(validatedPreview.terminationDate) || "________________________"
                      }, during which period he/she held the position of ${
                        validatedPreview.jobTitle || "________________________"
                      }. At the date of termination, the employee's remuneration was ${
                        validatedPreview.salaryAmount > 0
                          ? `${formatParagraphSalary(validatedPreview.salaryAmount)} ${salaryFrequencyLabels[validatedPreview.salaryFrequency]}`
                          : "________________________"
                      }.`}
                    </p>
                    <p className="mt-10 text-[11px] leading-relaxed">
                      {`Signed and issued at __________________________ on this ______ day of ____________________________ ${new Date().getFullYear()}`}
                    </p>
                    <div className="pt-12 pl-0">
                      <div className="w-36 border-t border-black" />
                      <p>Management</p>
                    </div>

                  </div>
                </FirstPagePreview>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">Complete the form to preview the certificate of service.</p>
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

      <Dialog open={illHealthConcernPickerOpen} onOpenChange={(open) => (open ? openIllHealthConcernPicker() : cancelIllHealthConcernPicker())}>
        <DialogContent className="w-[94vw] max-w-[680px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-white [&>button]:hidden">
          <div className="flex items-center justify-between bg-[#2D4256] px-4 py-3 -mx-px -mt-px">
            <div className="flex items-center gap-2 pl-2">
              <Briefcase className="h-4 w-4 text-white" />
              <DialogTitle className="text-sm font-semibold text-white">Select ill-health concerns</DialogTitle>
            </div>
            <DialogClose asChild>
              <button type="button" className="text-white hover:text-white/80">
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
          <DialogHeader className="px-6 pt-4 pb-0">
            <DialogDescription className="text-[11px] text-slate-600">
              Select one or more concerns from the list, or add your own custom concern.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-6 pb-6 pt-4">
            <div className="flex items-center gap-2">
              <Input
                ref={customConcernInputRef}
                placeholder="Type a custom concern"
                value={customConcernInput}
                onChange={(e) => setCustomConcernInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  addCustomConcern();
                }}
                className="h-8 rounded border-slate-300 text-[11px] placeholder:text-[10px] placeholder:text-slate-400"
              />
              <Button
                type="button"
                variant="outline"
                onClick={addCustomConcern}
                disabled={!customConcernInput.trim()}
                className="h-8 rounded border-blue-600 px-3 text-[11px] text-blue-600 hover:bg-transparent hover:text-blue-700 disabled:border-slate-300 disabled:text-slate-300"
              >
                Add
              </Button>
            </div>
            <ScrollArea className="max-h-72 rounded border border-slate-200 bg-white">
              <div className="space-y-1 p-3">
                {filteredIllHealthConcernTypes.map((type) => (
                  <label
                    key={type}
                    className={`flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-blue-50/70 hover:text-blue-600 focus-within:bg-blue-50/70 ${noticeModalSelectItemClass}`}
                  >
                    <Checkbox
                      checked={draftIllHealthConcernTypes.includes(type)}
                      onCheckedChange={(checked) =>
                        setDraftIllHealthConcernTypes((prev) =>
                          checked ? (prev.includes(type) ? prev : [...prev, type]) : prev.filter((item) => item !== type),
                        )
                      }
                      className="h-4 w-4 rounded-[2px] border-slate-400 text-white data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
                    />
                    <span className="flex-1">{type}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
            <div>
              {draftIllHealthConcernTypes.length === 0 ? (
                <div className="text-xs text-slate-600">No concern selected</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {draftIllHealthConcernTypes.map((type) => (
                    <Badge
                      key={type}
                      variant="outline"
                      className="gap-1 border-blue-300 bg-blue-50 text-[10px] text-blue-700 !font-normal hover:bg-blue-50"
                    >
                      <span>{type}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setDraftIllHealthConcernTypes((prev) => prev.filter((item) => item !== type))
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
                  onClick={cancelIllHealthConcernPicker}
                  className="h-[28px] w-[84px] rounded border-blue-600 px-3 text-xs text-blue-600 hover:bg-transparent hover:text-blue-600"
                >
                  Cancel
                </Button>
              </div>
              <div className="justify-self-center">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDraftIllHealthConcernTypes([])}
                  disabled={draftIllHealthConcernTypes.length === 0}
                  className="h-[30px] rounded border-0 px-3 text-xs text-slate-500 shadow-none hover:bg-transparent hover:text-slate-600 hover:underline disabled:text-slate-300"
                >
                  Clear
                </Button>
              </div>
              <div className="justify-self-end">
                <Button
                  type="button"
                  onClick={applyIllHealthConcernPicker}
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

export default ServiceCertificateGenerator;
























