import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ComponentType, type ReactNode, type SVGProps } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
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
import { Download, ArrowRight, Building2, User2, Briefcase, Check, Undo2, X, Info, Plus, Calendar, TriangleAlert, Mail, Phone, Palette } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
import { cn } from "@/lib/utils";
import {
  salaryFrequencyOptions,
  extractDobFromId,
  calculateAgeFromDob,
  southAfricanProvinces,
  type PermanentContractFormData,
} from "@/lib/validation";
import type { Tables } from "@/integrations/supabase/types";

type ContractFormState = {
  employeeId: string;
  age: string;
  companyLogoDataUrl: string;
  logoPlacement: "center" | "left";
  letterheadThemeColors: string[];
  issuer: string;
  chairperson: string;
  noticeMethod: string;
  transmissionMethods: string[];
  noticePeriod: string;
  noticeOfAppeal: string;
  appliedProgressiveDisciplinaryAction: string;
  hearingDate: string;
  performanceConsultationDate: string;
  improvementPeriod: string;
  misconductTypes: string[];
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
  homeAddressLine: string;
  homeAddressLine2: string;
  homeCity: string;
  homeProvince: string;
  homeAreaCode: string;
};

type AmendmentType = "add" | "amend";
type AddendumType = "general" | "renewal" | "extension";

type AddendumData = PermanentContractFormData & {
  contractReference: string;
  addendumType: AddendumType;
  effectiveDate: string;
  contractEndDate: string;
  newEndDate: string;
  idType: "id" | "passport";
  companyLogoDataUrl: string;
  logoPlacement: "center" | "left";
  letterheadThemeColors: string[];
  issuer: string;
  chairperson: string;
  noticeMethod: string;
  transmissionMethods: string[];
  noticePeriod: string;
  noticeOfAppeal: string;
  appliedProgressiveDisciplinaryAction: string;
  hearingDate: string;
  performanceConsultationDate: string;
  improvementPeriod: string;
  misconductTypes: string[];
  homeAddressLine: string;
  homeAddressLine2: string;
  homeCity: string;
  homeProvince: string;
  homeAreaCode: string;
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
  physical_address_line1: string | null;
  physical_address_line2: string | null;
  city: string | null;
  province: string | null;
  area_code: string | null;
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
  { value: "left", label: "Header only" },
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

const noticePeriodOptions = [
  "1 week",
  "2 weeks",
  "4 weeks",
  "5 weeks",
  "6 weeks",
  "7 weeks",
  "8 weeks",
  "9 weeks",
  "10 weeks",
  "11 weeks",
  "12 weeks",
] as const;

const getAutoNoticePeriodFromStartDate = (startDateRaw: string): (typeof noticePeriodOptions)[number] | "" => {
  const value = (startDateRaw || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const startDate = new Date(`${value}T00:00:00`);
  const today = new Date();
  const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (Number.isNaN(startDate.getTime()) || startDate > normalizedToday) return "";

  let months = (normalizedToday.getFullYear() - startDate.getFullYear()) * 12;
  months += normalizedToday.getMonth() - startDate.getMonth();
  if (normalizedToday.getDate() < startDate.getDate()) {
    months -= 1;
  }

  if (months < 6) return "1 week";
  if (months < 12) return "2 weeks";
  return "4 weeks";
};
const improvementPeriodOptions = [
  "1 week",
  "2 weeks",
  "3 weeks",
  "1 month",
  "5 weeks",
  "6 weeks",
  "7 weeks",
  "2 months",
  "9 weeks",
  "10 weeks",
  "11 weeks",
  "3 months",
] as const;

const noticeOfAppealOptions = ["3 days", "5 days", "7 days", "10 days"] as const;
const progressiveDisciplinaryActionOptions = ["Yes", "No PDA applied"] as const;
const transmissionMethodOptions = ["By Hand", "By Email", "By Registered Post", "By Regular Post", "By WhatsApp", "By Facebook"] as const;
const chairpersonOptions = [
  { value: "external", label: "External" },
  { value: "internal", label: "Internal" },
] as const;

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

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", minimumFractionDigits: 2 }).format(amount);

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
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

const formatMisconductList = (types: string[]) => {
  const normalized = types
    .map((type) => type.trim().toLowerCase())
    .filter(Boolean);

  if (normalized.length === 0) return "[forms of misconduct]";
  if (normalized.length === 1) return normalized[0];
  if (normalized.length === 2) return `${normalized[0]} and ${normalized[1]}`;
  return `${normalized.slice(0, -1).join(", ")} and ${normalized[normalized.length - 1]}`;
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

const formatNoticePeriodPossessive = (noticePeriodRaw: string) => {
  const noticePeriod = noticePeriodRaw.trim();
  if (!noticePeriod) return "[notice period]";
  if (/^1\s+\w+$/i.test(noticePeriod) && !/s$/i.test(noticePeriod)) {
    return `${noticePeriod}'s`;
  }
  return `${noticePeriod}'`;
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
  const employeeNameDisplay = displayValue([data.employeeName, data.employeeSurname].filter(Boolean).join(" "));
  const employeeFullName = [data.employeeName, data.employeeSurname].filter(Boolean).join(" ").trim();
  const salutation = employeeFullName ? `Dear ${employeeFullName}` : "Dear Sir / Madam";
  const employeeIdLabel = data.idType === "id" ? "ID" : "Passport";
  const employeeIdValue = data.idType === "id" ? displayValue(data.employeeIdNumber) : displayValue(data.passportNumber);
  const companyNameDisplay = displayValue(formatCompanyDisplayName(profile?.company_name, profile?.company_type));
  const tradingNameDisplay = (data.tradingName || "").trim();
  const registrationNumberDisplay = (profile?.registration_number || "").trim();
  const hasUploadedLogo = Boolean(logoPreviewUrl);
  const useLeftLogoLayout = hasUploadedLogo && data.logoPlacement === "left";
  const useCenteredLogoLayout = hasUploadedLogo && !useLeftLogoLayout;
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
  const employeeAddressLines = [data.homeAddressLine, data.homeAddressLine2, data.homeCity, data.homeProvince, data.homeAreaCode]
    .map((value) => (value || "").trim())
    .filter(Boolean);
  const employeeCityProvince =
    [data.homeCity?.trim(), data.homeProvince?.trim()].filter(Boolean).join(", ");
  const employeeAddressDisplayLines = [
    data.homeAddressLine?.trim(),
    data.homeAddressLine2?.trim(),
    employeeCityProvince || undefined,
    data.homeAreaCode?.trim(),
  ].filter((value): value is string => Boolean(value));
  const issueDateDisplay = (() => {
    const date = new Date(`${data.issueDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return displayValue(data.issueDate);
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  })();

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
        ) : (
          <div className={cn("flex", useLeftLogoLayout ? "items-start justify-between gap-4" : "justify-end")}>
            {useLeftLogoLayout ? (
              <img
                src={logoPreviewUrl}
                alt="Company logo"
                className="max-h-[25mm] w-auto max-w-[220px] object-contain"
              />
            ) : null}
            <div className="text-right leading-[1.1] text-[10px]">
              <p className="font-semibold">{companyNameDisplay}</p>
              {tradingNameDisplay ? <p>t/a {tradingNameDisplay}</p> : null}
              {companyAddressLines.length > 0 ? companyAddressLines.map((line) => <p key={`co-${line}`}>{line}</p>) : <p>Address</p>}
              {useLeftLogoLayout ? (
                <>
                  <p className="inline-flex w-full items-center justify-end gap-1">
                    <Mail className="h-2.5 w-2.5" style={{ color: iconColor }} />
                    {displayValue(data.employerEmail)}
                  </p>
                  <p className="inline-flex w-full items-center justify-end gap-1">
                    <Phone className="h-2.5 w-2.5" style={{ color: iconColor }} />
                    {displayValue(data.employerContact)}
                  </p>
                </>
              ) : (
                <>
                  <p className="inline-flex w-full items-center justify-end gap-1">
                    <Mail className="h-2.5 w-2.5" style={{ color: iconColor }} />
                    {displayValue(data.employerEmail)}
                  </p>
                  <p className="inline-flex w-full items-center justify-end gap-1">
                    <Phone className="h-2.5 w-2.5" style={{ color: iconColor }} />
                    {displayValue(data.employerContact)}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
        <div className={cn("border-t border-slate-300", useCenteredLogoLayout ? "mt-6" : "mt-4")} style={previewDividerStyle} aria-hidden="true" />
        <div className="mt-2 text-right">{issueDateDisplay}</div>
        <div className="mt-4">
          <p className="flex items-baseline gap-4">
            <span>TO:</span>
            <span className="font-semibold uppercase">{employeeNameDisplay}</span>
          </p>
          <div className="pl-9">
            {employeeAddressDisplayLines.length > 0
              ? employeeAddressDisplayLines.map((line) => (
                  <p key={`emp-${line}`} className="font-semibold uppercase">
                    {line}
                  </p>
                ))
              : <p className="font-semibold uppercase">________________________</p>}
          </div>
        </div>
        <div className="mt-3 text-right font-semibold">
          {data.transmissionMethods.map((method) => (
            <p key={method}>{method.replace(/^By\s+/i, "Per ")}</p>
          ))}
        </div>
        <div className="mt-4 space-y-4">
          <p>{salutation}</p>
          <p className="pt-2 pb-2 font-bold underline">RE: TERMINATION OF EMPLOYMENT</p>
          <div className="space-y-4">{children}</div>
          <p>Yours faithfully</p>
          <div className="pt-8">
            <div className="w-36 border-t border-black" />
            {data.issuer?.trim() ? <p className="font-semibold">{data.issuer.trim()}</p> : null}
            <p>Management</p>
          </div>
          {data.transmissionMethods.includes("By Hand") ? (
            <div className="mt-6 border border-black p-2 space-y-4">
              <p>
                I, <span className="underline">{`${employeeNameDisplay} (${employeeIdLabel}: ${employeeIdValue})`}</span>, hereby acknowledge that I received this
                letter and confirm that the content hereof was explained to me.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="w-36 border-t border-black" />
                  <p className="font-semibold">Signature</p>
                </div>
                <div>
                  <div className="w-36 border-t border-black" />
                  <p className="font-semibold">Date</p>
                </div>
                <div>
                  <div className="w-36 border-t border-black" />
                  <p className="font-semibold">Witness</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        {useCenteredLogoLayout ? (
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

const IllHealthTerminationGenerator = ({
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
  const steps = ["Employer Details", "Employee Details", "Termination Details"] as const;
  const stepIcons = [Building2, User2, Briefcase] as const;
  const [activeStep, setActiveStep] = useState(0);
  const [showEmployeeHint, setShowEmployeeHint] = useState(false);
  const [hasDismissedEmployeeHint, setHasDismissedEmployeeHint] = useState(false);
  const [hasShownEmployeeHint, setHasShownEmployeeHint] = useState(false);
  const [employeeSearchOpen, setEmployeeSearchOpen] = useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [sameDayCaution, setSameDayCaution] = useState<{ open: boolean; pendingAction: "" | "finish" | "download" }>({
    open: false,
    pendingAction: "",
  });
  const [sameDayOverrideAccepted, setSameDayOverrideAccepted] = useState(false);
  const [sameDayCautionDismissed, setSameDayCautionDismissed] = useState(false);
  const [misconductSearch, setMisconductSearch] = useState("");
  const [misconductPickerOpen, setMisconductPickerOpen] = useState(false);
  const [draftMisconductTypes, setDraftMisconductTypes] = useState<string[]>([]);
  const [transmissionPickerOpen, setTransmissionPickerOpen] = useState(false);
  const [draftTransmissionMethods, setDraftTransmissionMethods] = useState<string[]>([]);
  const [colorThemePickerOpen, setColorThemePickerOpen] = useState(false);
  const [draftLetterheadThemeColors, setDraftLetterheadThemeColors] = useState<string[]>([]);
  const noticeDatePickerRef = useRef<HTMLInputElement | null>(null);
  const hearingDatePickerRef = useRef<HTMLInputElement | null>(null);
  const consultationDatePickerRef = useRef<HTMLInputElement | null>(null);
  const contractReferencePickerRef = useRef<HTMLInputElement | null>(null);
  const contractEndDatePickerRef = useRef<HTMLInputElement | null>(null);
  const newEndDatePickerRef = useRef<HTMLInputElement | null>(null);
  const companyLogoInputRef = useRef<HTMLInputElement | null>(null);
  const employeeSearchInputRef = useRef<HTMLInputElement | null>(null);
  const misconductSearchInputRef = useRef<HTMLInputElement | null>(null);
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

  useEffect(() => {
    if (!embedded) return;
    onStepChange?.(showFinalActions ? "Preview / Edit" : (steps[activeStep] ?? null));
  }, [activeStep, embedded, onStepChange, showFinalActions, steps]);


  const [formData, setFormData] = useState<ContractFormState>({
    employeeId: "",
    age: "",
    companyLogoDataUrl: "",
    logoPlacement: "center",
    letterheadThemeColors: [defaultDividerColor, defaultIconColor],
    issuer: "",
    chairperson: "",
    noticeMethod: "not_required_to_work_notice_period",
    transmissionMethods: [],
    noticePeriod: "",
    noticeOfAppeal: "",
    appliedProgressiveDisciplinaryAction: "",
    hearingDate: "",
    performanceConsultationDate: "",
    improvementPeriod: "",
    misconductTypes: [],
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
    homeAddressLine: "",
    homeAddressLine2: "",
    homeCity: "",
    homeProvince: "",
    homeAreaCode: "",
    employeeNumber: "",
    nationality: "South African",
    gender: "",
    race: "",
    employeeCell: "",
    alternativeContact: "",
    employeeEmail: "",
    tradingName: "",
    employerContact: "",
    employerEmail: "",
    jobTitle: "",
    salaryAmount: "",
    annualLeaveDays: "15",
    salaryFrequency: "month",
    probationPeriod: "3",
    department: "",
    retirementAge: "65",
    workplace: "",
    interpreter: "no",
    reportsTo: "",
    additionalNotes: "",
  });
  const selectedLetterheadThemeColors = sanitizeThemeColors(formData.letterheadThemeColors);

  const sortedEmployees = useMemo(
    () =>
      [...employees].sort((a, b) => {
        const nameOrder = a.employee_name.localeCompare(b.employee_name, undefined, { sensitivity: "base" });
        if (nameOrder !== 0) return nameOrder;
        return a.employee_surname.localeCompare(b.employee_surname, undefined, { sensitivity: "base" });
      }),
    [employees],
  );

  const searchedEmployees = useMemo(() => {
    const query = employeeSearchQuery.trim().toLowerCase().replace(/\s+/g, " ");
    if (!query) return sortedEmployees;
    const tokens = query.split(" ").filter(Boolean);
    return sortedEmployees
      .map((employee) => {
        const fullName = `${employee.employee_name} ${employee.employee_surname}`.trim().replace(/\s+/g, " ");
        const fullNameLower = fullName.toLowerCase();
        const firstNameLower = employee.employee_name.toLowerCase();
        const surnameLower = employee.employee_surname.toLowerCase();
        const employeeNumberLower = (employee.employee_number ?? "").toLowerCase();
        let score = 0;

        if (fullNameLower === query) score += 1000;
        if (fullNameLower.startsWith(query)) score += 800;
        if (fullNameLower.includes(query)) score += 500;
        if (firstNameLower.startsWith(query) || surnameLower.startsWith(query)) score += 350;
        if (tokens.length > 0 && tokens.every((token) => fullNameLower.includes(token))) score += 300;
        if (query.length >= 2 && employeeNumberLower.includes(query)) score += 120;

        return { employee, score, fullName };
      })
      .filter((item) => item.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.fullName.localeCompare(b.fullName, undefined, {
            sensitivity: "base",
          }),
      )
      .map((item) => item.employee);
  }, [employeeSearchQuery, sortedEmployees]);

  const misconductOptions = useMemo(() => {
    if (conductOffences.length > 0) {
      return Array.from(new Set(conductOffences.map((item) => item.name)));
    }
    return MISCONDUCT_TYPES;
  }, [conductOffences]);
  const dismissibleMisconductNames = useMemo(
    () => new Set(conductOffences.filter((item) => item.category === "Dismissible").map((item) => item.name.trim().toLowerCase())),
    [conductOffences],
  );

  const filteredMisconductTypes = useMemo(() => {
    const query = misconductSearch.trim().toLowerCase();
    if (!query) return misconductOptions;
    return misconductOptions.filter((type) => type.toLowerCase().includes(query));
  }, [misconductSearch, misconductOptions]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    if (!employeeSearchOpen) return;
    const timer = setTimeout(() => employeeSearchInputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [employeeSearchOpen]);

  useEffect(() => {
    if (!misconductPickerOpen) return;
    const timer = setTimeout(() => misconductSearchInputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [misconductPickerOpen]);

  useEffect(() => {
    setSameDayOverrideAccepted(false);
    setSameDayCautionDismissed(false);
  }, [formData.issueDate, formData.hearingDate]);

  useEffect(() => {
    if (sameDayOverrideAccepted) return;
    if (sameDayCautionDismissed) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formData.issueDate) || !/^\d{4}-\d{2}-\d{2}$/.test(formData.hearingDate)) return;
    if (formData.issueDate !== formData.hearingDate) return;
    if (sameDayCaution.open) return;
    setSameDayCaution({ open: true, pendingAction: "" });
  }, [formData.issueDate, formData.hearingDate, sameDayOverrideAccepted, sameDayCautionDismissed, sameDayCaution.open]);

  useEffect(() => {
    if (hasDismissedEmployeeHint || activeStep !== 1) {
      setShowEmployeeHint(false);
      return;
    }
    if (hasShownEmployeeHint) return;
    const timer = setTimeout(() => {
      setShowEmployeeHint(true);
      setHasShownEmployeeHint(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, [activeStep, hasDismissedEmployeeHint, hasShownEmployeeHint]);

  useEffect(() => {
    if (!showEmployeeHint) return;
    const autoDismissTimer = setTimeout(() => {
      setShowEmployeeHint(false);
    }, 10000);
    return () => clearTimeout(autoDismissTimer);
  }, [showEmployeeHint]);

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
        "id, id_number, employee_name, employee_surname, nationality, emergency_contact_number, gender, race, cell_number, email, job_title, start_date, employee_number, physical_address_line1, physical_address_line2, city, province, area_code",
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
    const physicalAddressLine1 =
      (employee as Partial<Tables<"employees">> & { physical_address_line1?: string }).physical_address_line1 ?? "";
    const physicalAddressLine2 =
      (employee as Partial<Tables<"employees">> & { physical_address_line2?: string }).physical_address_line2 ?? "";
    const city = (employee as Partial<Tables<"employees">> & { city?: string }).city ?? "";
    const province = (employee as Partial<Tables<"employees">> & { province?: string }).province ?? "";
    const areaCode = (employee as Partial<Tables<"employees">> & { area_code?: string }).area_code ?? "";
    const idNumber = hasIdNumber ? employee.id_number ?? "" : "";
    const ageFromId = hasIdNumber ? deriveAgeFromId(idNumber) : "";
    const nextIdType: "id" | "passport" = hasIdNumber ? "id" : "passport";
    const autoNoticePeriod = getAutoNoticePeriodFromStartDate(startDate);

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
      homeAddressLine: physicalAddressLine1 || prev.homeAddressLine,
      homeAddressLine2: physicalAddressLine2 || prev.homeAddressLine2,
      homeCity: city || prev.homeCity,
      homeProvince: province || prev.homeProvince,
      homeAreaCode: areaCode || prev.homeAreaCode,
      age: ageFromId,
      idType: nextIdType,
      noticePeriod: autoNoticePeriod,
    }));
  };

  const resetForm = () => {
    setFormData({
      employeeId: "",
      age: "",
      companyLogoDataUrl: "",
      logoPlacement: "center",
      letterheadThemeColors: [defaultDividerColor, defaultIconColor],
      issuer: "",
      chairperson: "",
      noticeMethod: "not_required_to_work_notice_period",
      transmissionMethods: [],
      noticePeriod: "",
      noticeOfAppeal: "",
      appliedProgressiveDisciplinaryAction: "",
      hearingDate: "",
      performanceConsultationDate: "",
      improvementPeriod: "",
      misconductTypes: [],
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
      homeAddressLine: "",
      homeAddressLine2: "",
      homeCity: "",
      homeProvince: "",
      homeAreaCode: "",
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

  useEffect(() => {
    const noticeDate = formData.issueDate.trim();
    const noticePeriod = formData.noticePeriod.trim();
    if (!noticeDate || !noticePeriod) {
      setFormData((prev) => (prev.effectiveDate ? { ...prev, effectiveDate: "" } : prev));
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(noticeDate)) {
      setFormData((prev) => (prev.effectiveDate ? { ...prev, effectiveDate: "" } : prev));
      return;
    }

    const baseDate = new Date(`${noticeDate}T00:00:00`);
    if (Number.isNaN(baseDate.getTime())) {
      setFormData((prev) => (prev.effectiveDate ? { ...prev, effectiveDate: "" } : prev));
      return;
    }

    const nextDate = new Date(baseDate);
    const weeksMatch = noticePeriod.match(/^(\d+)\s+week/);
    const weeks = weeksMatch ? Number(weeksMatch[1]) : 0;
    if (weeks > 0) {
      nextDate.setDate(nextDate.getDate() + weeks * 7);
    }

    const year = nextDate.getFullYear();
    const month = String(nextDate.getMonth() + 1).padStart(2, "0");
    const day = String(nextDate.getDate()).padStart(2, "0");
    const computed = `${year}-${month}-${day}`;
    setFormData((prev) => (prev.effectiveDate !== computed ? { ...prev, effectiveDate: computed } : prev));
  }, [formData.issueDate, formData.noticePeriod]);

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
            (formData.idType === "passport" && formData.passportNumber)) &&
          formData.homeCity &&
          formData.homeProvince &&
          formData.homeAreaCode,
      ),
    [
      formData.employeeName,
      formData.employeeSurname,
      formData.employeeIdNumber,
      formData.passportNumber,
      formData.idType,
      formData.homeCity,
      formData.homeProvince,
      formData.homeAreaCode,
    ],
  );

  const isEmploymentStepComplete = useMemo(
    () => {
      const hasNoticePeriod = Boolean(formData.noticePeriod);
      const hasNoticeOfAppeal = Boolean(formData.noticeOfAppeal);
      const hasChairperson = Boolean(formData.chairperson);
      const hasHearingDate = Boolean(formData.hearingDate);
      const hasTransmissionMethods = formData.transmissionMethods.length > 0;
      return Boolean(
        formData.effectiveDate &&
          formData.issueDate &&
          hasNoticePeriod &&
          hasNoticeOfAppeal &&
          hasChairperson &&
          hasHearingDate &&
          hasTransmissionMethods,
      );
    },
    [
      formData.noticePeriod,
      formData.noticeOfAppeal,
      formData.chairperson,
      formData.hearingDate,
      formData.performanceConsultationDate,
      formData.improvementPeriod,
      formData.transmissionMethods,
      formData.effectiveDate,
      formData.issueDate,
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
    if (index > 0 && showEmployeeHint) {
      setShowEmployeeHint(false);
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
      if (activeStep === 0) {
        if (showEmployeeHint) {
          setShowEmployeeHint(false);
        }
      }
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
      supportsPreviewEditToggle: true,
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
      homeAddressLine: "",
      homeAddressLine2: "",
      homeCity: "",
      homeProvince: "",
      homeAreaCode: "",
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
    setFormData((prev) => ({
      ...prev,
      issuer: "",
      chairperson: "",
      noticeMethod: "not_required_to_work_notice_period",
      transmissionMethods: [],
      noticePeriod: "",
      noticeOfAppeal: "",
      appliedProgressiveDisciplinaryAction: "",
      hearingDate: "",
      performanceConsultationDate: "",
      improvementPeriod: "",
      misconductTypes: [],
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

  const openConsultationDatePicker = () => {
    const picker = consultationDatePickerRef.current;
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
    setFormData((prev) => ({ ...prev, misconductTypes: draftMisconductTypes }));
    setMisconductPickerOpen(false);
    setMisconductSearch("");
  };

  const openTransmissionPicker = () => {
    setDraftTransmissionMethods(formData.transmissionMethods);
    setTransmissionPickerOpen(true);
  };

  const cancelTransmissionPicker = () => {
    setTransmissionPickerOpen(false);
    setDraftTransmissionMethods([]);
  };

  const applyTransmissionPicker = () => {
    setFormData((prev) => ({ ...prev, transmissionMethods: draftTransmissionMethods }));
    setTransmissionPickerOpen(false);
    setDraftTransmissionMethods([]);
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
      setFormData((prev) => ({ ...prev, companyLogoDataUrl: trimmedResult }));
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

  const validateData = (allowSameDayHearingNotice = false) => {
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
    checkRequired(formData.homeCity, "City");
    checkRequired(formData.homeProvince, "Province");
    checkRequired(formData.homeAreaCode, "Area code");
    checkRequired(formData.effectiveDate, "Effective date");
    checkRequired(formData.issueDate, "Date of notice");
    checkRequired(formData.noticePeriod, "Notice period");
    checkRequired(formData.chairperson, "Chairperson");
    checkRequired(formData.hearingDate, "Illness enquiry date");
    checkRequired(formData.noticeOfAppeal, "Notice of Appeal");
    if (formData.transmissionMethods.length === 0) {
      missingFields.push("Method of Issuing");
    }

    if (missingFields.length) {
      throw new Error(`Please fill in the following required fields: ${missingFields.join(", ")}`);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(formData.hearingDate) && /^\d{4}-\d{2}-\d{2}$/.test(formData.issueDate)) {
      const hearingDate = new Date(`${formData.hearingDate}T00:00:00`);
      const noticeDate = new Date(`${formData.issueDate}T00:00:00`);
      if (!Number.isNaN(hearingDate.getTime()) && !Number.isNaN(noticeDate.getTime())) {
        if (hearingDate > noticeDate) {
          throw new Error("Illness enquiry date cannot be after Date of notice.");
        }
        if (!allowSameDayHearingNotice && formData.hearingDate === formData.issueDate) {
          throw new Error(SAME_DAY_HEARING_NOTICE_CAUTION);
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
      chairperson: formData.chairperson,
      noticeMethod: "not_required_to_work_notice_period",
      transmissionMethods: formData.transmissionMethods,
      noticePeriod: formData.noticePeriod,
      noticeOfAppeal: formData.noticeOfAppeal,
      appliedProgressiveDisciplinaryAction: formData.appliedProgressiveDisciplinaryAction,
      hearingDate: formData.hearingDate,
      performanceConsultationDate: formData.performanceConsultationDate,
      improvementPeriod: formData.improvementPeriod,
      misconductTypes: formData.misconductTypes,
      homeAddressLine: formData.homeAddressLine,
      homeAddressLine2: formData.homeAddressLine2,
      homeCity: formData.homeCity,
      homeProvince: formData.homeProvince,
      homeAreaCode: formData.homeAreaCode,
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

    const issueDateDisplay = formatDate(data.issueDate);
    const hearingDateDisplay = formatDate(data.hearingDate);
    const terminationDateDisplay = formatDate(data.effectiveDate || data.issueDate);
    const paragraphOneText = `We refer to the abovementioned matter and the enquiry relating to your ill health held on ${hearingDateDisplay || "[inquiry date]"}.`;
    const paragraphTwoText =
      data.chairperson === "external"
        ? "After the chairperson considered the statement(s) and/or evidence presented during the enquiry, it has been determined that you remain incapable of performing your duties due to ill health, and that no reasonable alternative to dismissal is available."
        : "After considering the statement(s) and/or evidence presented during the enquiry, it has been determined that you remain incapable of performing your duties due to ill health, and that no reasonable alternative to dismissal is available.";
    const lastWorkingDaySentence = `You will be paid in lieu of notice up to ${terminationDateDisplay || "[date of termination]"}.`;
    const employeeFullName = [data.employeeName, data.employeeSurname].filter(Boolean).join(" ").trim();
    const salutation = employeeFullName ? `Dear ${employeeFullName}` : "Dear Sir / Madam";

    const baseClauses: Array<Omit<ClauseDefinition, "id">> = [
      {
        title: "Paragraph 1",
        body: paragraphOneText,
      },
      {
        title: "Paragraph 2",
        body: paragraphTwoText,
      },
      {
        title: "Paragraph 3",
        body: `Take notice that your employment is herewith terminated with ${formatNoticePeriodPossessive(data.noticePeriod)} notice for incapacity: ill health, effective ${issueDateDisplay || "[date of notice]"}. ${lastWorkingDaySentence}`,
      },
      {
        title: "Paragraph 4",
        body: "You may appeal against this decision to terminate your employment within five (5) days from the date in this termination letter, in accordance with the company's disciplinary procedures. Alternatively, you may refer a dispute to the CCMA or the applicable bargaining council within thirty (30) days from the date of termination.",
      },
      {
        title: "Paragraph 5",
        body: "We trust you find the above in order and we wish you good luck with your future endeavours.",
      },
    ];

    const clauses = mergeClauses(withClauseIds(baseClauses));
    const clausesWithEdits = applyClauseEdits(clauses);

    const companyAddressLines = (profile?.physical_address || "Address")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const employeeCityProvince = [data.homeCity?.trim(), data.homeProvince?.trim()].filter(Boolean).join(", ");
    const employeeAddressLines = [
      data.homeAddressLine?.trim(),
      data.homeAddressLine2?.trim(),
      employeeCityProvince || undefined,
      data.homeAreaCode?.trim(),
    ].filter((value): value is string => Boolean(value));
    const transmissionLines = data.transmissionMethods.map((method) => method.replace(/^By\s+/i, "Per "));
    const hasUploadedLogo = Boolean(data.companyLogoDataUrl);
    const useLeftLogoLayout = hasUploadedLogo && data.logoPlacement === "left";
    const useCenteredLogoLayout = hasUploadedLogo && !useLeftLogoLayout;

    const headerTop = y;
    const rightX = margin + contentWidth;
    const headerLineHeight = 3.5;
    const employerEmailText = valueOrLine(data.employerEmail);
    const employerPhoneText = valueOrLine(data.employerContact);
    const headerInfoLines = [
      valueOrLine(formatCompanyDisplayName(profile?.company_name, profile?.company_type)),
      ...(data.tradingName?.trim() ? [`t/a ${data.tradingName.trim()}`] : []),
      ...(companyAddressLines.length > 0 ? companyAddressLines : ["Address"]),
    ];

    let logoTopForBalance = margin;
    if (useCenteredLogoLayout) {
      try {
        const imageType = data.companyLogoDataUrl.includes("image/jpeg") ? "JPEG" : "PNG";
        const imageProps = doc.getImageProperties(data.companyLogoDataUrl);
        const imageRatio = imageProps.width / imageProps.height;
        const targetLogoHeight = 25;
        const maxLogoWidth = 60;
        let logoHeight = targetLogoHeight;
        let logoWidth = logoHeight * imageRatio;
        if (logoWidth > maxLogoWidth) {
          const scale = maxLogoWidth / logoWidth;
          logoWidth = maxLogoWidth;
          logoHeight *= scale;
        }
        const logoTop = Math.max(6, headerTop - 10);
        logoTopForBalance = logoTop;
        const logoX = (pageWidth - logoWidth) / 2;
        doc.addImage(data.companyLogoDataUrl, imageType, logoX, logoTop, logoWidth, logoHeight, undefined, "FAST");
        y = logoTop + logoHeight + 6;
      } catch {
        // Keep generating even if logo rendering fails.
      }
    } else if (useLeftLogoLayout) {
      let logoBottomY = headerTop;
      try {
        const imageType = data.companyLogoDataUrl.includes("image/jpeg") ? "JPEG" : "PNG";
        const imageProps = doc.getImageProperties(data.companyLogoDataUrl);
        const imageRatio = imageProps.width / imageProps.height;
        const targetLogoHeight = 25;
        const maxLogoWidth = 60;
        let logoHeight = targetLogoHeight;
        let logoWidth = logoHeight * imageRatio;
        if (logoWidth > maxLogoWidth) {
          const scale = maxLogoWidth / logoWidth;
          logoWidth = maxLogoWidth;
          logoHeight *= scale;
        }
        const logoTop = Math.max(6, headerTop);
        const logoX = margin;
        doc.addImage(data.companyLogoDataUrl, imageType, logoX, logoTop, logoWidth, logoHeight, undefined, "FAST");
        logoBottomY = logoTop + logoHeight;
      } catch {
        // Keep generating even if logo rendering fails.
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text(headerInfoLines[0], rightX, headerTop, { align: "right" });
      let detailsY = headerTop + headerLineHeight;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      headerInfoLines.slice(1).forEach((line) => {
        doc.text(line, rightX, detailsY, { align: "right" });
        detailsY += headerLineHeight;
      });
      const iconTextGap = 0.9;
      const iconSize = 2.7;
      const hasPhoneIcon = Boolean(pdfPhoneIconDataUrl);
      const hasMailIcon = Boolean(pdfMailIconDataUrl);
      const phoneIconWidth = hasPhoneIcon ? iconSize : doc.getTextWidth("Tel:");
      const mailIconWidth = hasMailIcon ? iconSize : doc.getTextWidth("Email:");
      const phoneTextWidth = doc.getTextWidth(employerPhoneText);
      const emailTextWidth = doc.getTextWidth(employerEmailText);
      const emailRowWidth = mailIconWidth + iconTextGap + emailTextWidth;
      const emailStartX = rightX - emailRowWidth;
      if (hasMailIcon) {
        doc.addImage(pdfMailIconDataUrl as string, "PNG", emailStartX, detailsY - iconSize + 0.55, iconSize, iconSize, undefined, "FAST");
      } else {
        doc.text("Email:", emailStartX, detailsY);
      }
      const emailTextX = emailStartX + mailIconWidth + iconTextGap;
      doc.text(employerEmailText, emailTextX, detailsY);
      detailsY += headerLineHeight;
      const phoneRowWidth = phoneIconWidth + iconTextGap + phoneTextWidth;
      const phoneStartX = rightX - phoneRowWidth;
      if (hasPhoneIcon) {
        doc.addImage(pdfPhoneIconDataUrl as string, "PNG", phoneStartX, detailsY - iconSize + 0.55, iconSize, iconSize, undefined, "FAST");
      } else {
        doc.text("Tel:", phoneStartX, detailsY);
      }
      const phoneTextX = phoneStartX + phoneIconWidth + iconTextGap;
      doc.text(employerPhoneText, phoneTextX, detailsY);
      detailsY += headerLineHeight;
      y = Math.max(logoBottomY + 6, detailsY + 2);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text(headerInfoLines[0], rightX, headerTop, { align: "right" });
      y = headerTop + headerLineHeight;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      headerInfoLines.slice(1).forEach((line) => {
        doc.text(line, rightX, y, { align: "right" });
        y += headerLineHeight;
      });
      const iconTextGap = 0.9;
      const iconSize = 2.7;
      const hasPhoneIcon = Boolean(pdfPhoneIconDataUrl);
      const hasMailIcon = Boolean(pdfMailIconDataUrl);
      const phoneIconWidth = hasPhoneIcon ? iconSize : doc.getTextWidth("Tel:");
      const mailIconWidth = hasMailIcon ? iconSize : doc.getTextWidth("Email:");
      const phoneTextWidth = doc.getTextWidth(employerPhoneText);
      const emailTextWidth = doc.getTextWidth(employerEmailText);
      const emailRowWidth = mailIconWidth + iconTextGap + emailTextWidth;
      const emailStartX = rightX - emailRowWidth;
      if (hasMailIcon) {
        doc.addImage(pdfMailIconDataUrl as string, "PNG", emailStartX, y - iconSize + 0.55, iconSize, iconSize, undefined, "FAST");
      } else {
        doc.text("Email:", emailStartX, y);
      }
      const emailTextX = emailStartX + mailIconWidth + iconTextGap;
      doc.text(employerEmailText, emailTextX, y);
      y += headerLineHeight;
      const phoneRowWidth = phoneIconWidth + iconTextGap + phoneTextWidth;
      const phoneStartX = rightX - phoneRowWidth;
      if (hasPhoneIcon) {
        doc.addImage(pdfPhoneIconDataUrl as string, "PNG", phoneStartX, y - iconSize + 0.55, iconSize, iconSize, undefined, "FAST");
      } else {
        doc.text("Tel:", phoneStartX, y);
      }
      const phoneTextX = phoneStartX + phoneIconWidth + iconTextGap;
      doc.text(employerPhoneText, phoneTextX, y);
      y += headerLineHeight;
    }

    doc.setDrawColor(dividerR, dividerG, dividerB);
    doc.line(margin, y, margin + contentWidth, y);
    doc.setDrawColor(0, 0, 0);
    y += 4.6;

    const companyName = valueOrLine(formatCompanyDisplayName(profile?.company_name, profile?.company_type));
    const companyIdentity = data.tradingName?.trim()
      ? `${companyName} t/a ${data.tradingName.trim()}`
      : companyName;
    const registrationNumber = (profile?.registration_number || "").trim();
    const hasRegistrationNumber = registrationNumber.length > 0;
    const companyAddress = companyAddressLines.length > 0 ? companyAddressLines.join(", ") : "Address";
    const centeredFooterHeight = hasRegistrationNumber ? 15.5 : 12;
    const centeredFooterBottomGap = logoTopForBalance;
    if (useCenteredLogoLayout) {
      pageContentBottom = pageHeight - centeredFooterBottomGap - centeredFooterHeight - 2;
    }

    const drawCenteredFooter = (pageNumber: number) => {
      if (!useCenteredLogoLayout) return;
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

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(issueDateDisplay, rightX, y, { align: "right" });
    y += 9;

    doc.text("TO:", margin, y);
    doc.setFont("helvetica", "bold");
    doc.text(valueOrLine([data.employeeName, data.employeeSurname].filter(Boolean).join(" ")).toUpperCase(), margin + 14, y);
    y += 5;
    employeeAddressLines.forEach((line) => {
      doc.text(line.toUpperCase(), margin + 14, y);
      y += 5;
    });
    if (transmissionLines.length > 0) {
      transmissionLines.forEach((line) => {
        doc.text(line, rightX, y, { align: "right" });
        y += 5;
      });
    }
    y += 4;

    doc.setFont("helvetica", "normal");
    doc.text(salutation, margin, y);
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const subjectText = "RE: TERMINATION OF EMPLOYMENT";
    doc.text(subjectText, margin, y);
    const subjectWidth = doc.getTextWidth(subjectText);
    doc.line(margin, y + 1, margin + subjectWidth + 1, y + 1);
    y += 10;

    doc.setFont("helvetica", "normal");
    clausesWithEdits.forEach((clause) => {
      const paragraphs = Array.isArray(clause.body) ? clause.body : [clause.body];
      paragraphs.forEach((paragraph) => {
        drawWrapped(paragraph, margin, contentWidth);
        y += 4.5;
      });
    });

    doc.setFontSize(9);
    doc.text("Yours faithfully", margin, y);
    y += 12;
    doc.line(margin, y, margin + 45, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const issuerName = (data.issuer || "").trim();
    if (issuerName) {
      doc.setFont("helvetica", "bold");
      doc.text(issuerName, margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
    }
    doc.text("Management", margin, y);
    y += 10;

    if (data.transmissionMethods.includes("By Hand")) {
      const employeeIdLabel = data.idType === "id" ? "ID" : "Passport";
      const employeeIdValue = data.idType === "id" ? valueOrLine(data.employeeIdNumber) : valueOrLine(data.passportNumber);
      const employeeNameValue = valueOrLine([data.employeeName, data.employeeSurname].filter(Boolean).join(" "));
      const boxHeight = 34;
      ensureSpace(boxHeight + 6);
      const boxTop = y;
      doc.rect(margin, boxTop, contentWidth, boxHeight);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const underlinedSegment = `${employeeNameValue} (${employeeIdLabel}: ${employeeIdValue})`;
      const ackLead = `I, ${underlinedSegment}, hereby acknowledge that I received this letter and confirm that the content hereof was explained to me.`;
      const ackLines = doc.splitTextToSize(ackLead, contentWidth - 4);
      let ackCursorY = y;
      ackLines.forEach((line, idx) => {
        doc.text(line, margin + 2, ackCursorY + idx * 4.8);
      });
      const firstLine = ackLines[0] || "";
      const segmentStart = firstLine.indexOf(underlinedSegment);
      if (segmentStart >= 0) {
        const before = firstLine.slice(0, segmentStart);
        const lineX = margin + 2 + doc.getTextWidth(before);
        const lineY = ackCursorY + 0.8;
        doc.line(lineX, lineY, lineX + doc.getTextWidth(underlinedSegment), lineY);
      }
      y += ackLines.length * 4.8;
      y = boxTop + boxHeight - 10;
      const colWidth = 45;
      const labels = ["Signature", "Date", "Witness"];
      labels.forEach((label, idx) => {
        const x = margin + 2 + idx * (colWidth + 10);
        doc.line(x, y, x + colWidth, y);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(label, x, y + 4.5);
      });
      y = boxTop + boxHeight + 6;
    }

    if (useCenteredLogoLayout) {
      const totalPages = doc.getNumberOfPages();
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        drawCenteredFooter(pageNumber);
      }
      doc.setPage(totalPages);
    }

    if (download) {
      doc.save(`Poor_Performance_Termination_${data.employeeSurname || "employee"}_${data.startDate}.pdf`);
      toast({
        title: "Download ready",
        description: "Ill health termination letter has been generated.",
      });
      return;
    }

    const blobUrl = doc.output("bloburl");
    window.open(blobUrl, "_blank");
  };

  function handleDownload() {
    try {
      setIsGenerating(true);
      const validated = validateData(sameDayOverrideAccepted);
      generatePDF(validated, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please check the required fields.";
      if (message === SAME_DAY_HEARING_NOTICE_CAUTION) {
        setSameDayCaution({ open: true, pendingAction: "download" });
        return;
      }
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
      const validated = validateData(sameDayOverrideAccepted);
      setValidatedPreview(validated);
      setIsPreviewEditable(false);
      setShowFinalActions(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please check the required fields.";
      if (message === SAME_DAY_HEARING_NOTICE_CAUTION) {
        setSameDayCaution({ open: true, pendingAction: "finish" });
        return;
      }
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
      {showEmployeeHint && typeof document !== "undefined"
        ? createPortal(
              <div className="pointer-events-none fixed inset-x-0 top-[54px] z-50 flex justify-center px-4">
                <div className="relative flex translate-x-[60px] items-center gap-3 rounded-sm border border-blue-200 bg-[#2D4256] px-4 py-3 text-[13px] font-medium text-white shadow-[0_6px_18px_rgba(37,99,235,0.28)]">
                <span
                  className="pointer-events-none absolute inset-0 rounded-sm shadow-[0_0_25px_rgba(37,99,235,0.32)] animate-pulse"
                  aria-hidden="true"
                ></span>
                <div className="pointer-events-auto flex items-center gap-2">
                  <span className="text-blue-400">
                    TIP!{" "}
                    <span className="text-white inline-flex items-center gap-1 ml-2">
                      Add the employee to your Employee List before generating a contract
                      <ArrowRight className="h-4 w-4 text-white" aria-hidden="true" />
                    </span>
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    onClick={() => {
                      setHasDismissedEmployeeHint(true);
                      setShowEmployeeHint(false);
                      navigate("/employees");
                    }}
                  >
                    Employees page
                  </button>
                  <button
                    type="button"
                    className="text-white hover:text-white focus-visible:text-white"
                    onClick={() => {
                      setHasDismissedEmployeeHint(true);
                      setShowEmployeeHint(false);
                    }}
                    aria-label="Dismiss employee guidance message"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      <div
        className={cn(
          "space-y-6",
          embedded
            ? useExternalShell
              ? "px-0 pt-0 pr-0 pb-0"
              : "px-0 pt-4 pr-4 pb-4"
            : "-ml-6 -mr-6 pl-3 pr-3",
          useExternalShell && showFinalActions && "h-full min-h-0 space-y-0",
        )}
        style={{ scrollbarGutter: "stable" }}
      >
        {!showFinalActions ? (
          <Card className={cn("rounded-sm mt-4 shadow-none border-0 bg-transparent", useExternalShell && "mt-0")}>
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
                !embedded && "flex-1 min-h-0 overflow-y-auto",
                useExternalShell && showFinalActions && "p-0 h-full min-h-0 flex flex-col overflow-hidden",
              )}
            >
              <div className={cn("space-y-4", useExternalShell && showFinalActions && "min-h-0 flex-1 overflow-y-auto pr-1")}>
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
                        <Label className={modalFieldLabelClass}>Letterhead options</Label>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                          <button
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, logoPlacement: "left" }))}
                            className={`rounded border p-2 text-left transition ${
                              formData.logoPlacement === "left"
                                ? "border-blue-600 bg-blue-50"
                                : "border-slate-300 bg-white hover:border-blue-500"
                            }`}
                          >
                            <div className="h-[99px] rounded border border-slate-200 bg-white p-2">
                              <div className="flex items-start justify-between gap-2">
                                {companyLogoPreview || formData.companyLogoDataUrl ? (
                                  <img
                                    src={companyLogoPreview || formData.companyLogoDataUrl}
                                    alt="Left-aligned letterhead logo preview"
                                    className="h-4 w-10 object-contain"
                                  />
                                ) : (
                                  <div className="h-4 w-10 rounded bg-slate-300" />
                                )}
                                <div className="w-[74px] text-right text-[5px] leading-[1.05] text-slate-600">
                                  <div className="ml-auto h-px w-10 rounded bg-slate-300" />
                                  <div className="mt-1 ml-auto h-px w-8 rounded bg-slate-300" />
                                  <div className="mt-1 ml-auto h-px w-6 rounded bg-slate-300" />
                                </div>
                              </div>
                              <div className="mt-2 h-px w-full bg-slate-300" />
                              <div className="mt-2 w-16 space-y-1">
                                <div className="h-1 w-full rounded bg-slate-300" />
                                <div className="h-1 w-4/5 rounded bg-slate-300" />
                                <div className="h-1 w-3/4 rounded bg-slate-300" />
                              </div>
                            </div>
                            <p className="mt-2 text-[11px] font-semibold text-slate-700">{logoPlacementOptions[1].label}</p>
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
                      <div className="space-y-1.5">
                        <Label htmlFor="homeAddressLine" className={modalFieldLabelClass}>
                          Address line 1 (optional)
                        </Label>
                        <Input
                          id="homeAddressLine"
                          value={formData.homeAddressLine}
                          onChange={(e) => setFormData({ ...formData, homeAddressLine: e.target.value })}
                          className={getAddendumModalInputClass(formData.homeAddressLine.trim().length > 0)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="homeAddressLine2" className={modalFieldLabelClass}>Address line 2 (optional)</Label>
                        <Input
                          id="homeAddressLine2"
                          value={formData.homeAddressLine2}
                          onChange={(e) => setFormData({ ...formData, homeAddressLine2: e.target.value })}
                          className={getAddendumModalInputClass(formData.homeAddressLine2.trim().length > 0)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="homeCity" className={modalFieldLabelClass}>
                          City <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="homeCity"
                          value={formData.homeCity}
                          onChange={(e) => setFormData({ ...formData, homeCity: e.target.value })}
                          className={getAddendumModalInputClass(formData.homeCity.trim().length > 0)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="homeProvince" className={modalFieldLabelClass}>
                          Province <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={formData.homeProvince}
                          onValueChange={(value) => setFormData({ ...formData, homeProvince: value })}
                        >
                          <SelectTrigger
                            id="homeProvince"
                            className={`${getAddendumModalSelectTriggerClass(
                              formData.homeProvince.trim().length > 0,
                            )} ${addendumModalDropdownToneClass}`}
                          >
                            <SelectValue placeholder="Select province" />
                          </SelectTrigger>
                          <SelectContent className={addendumModalSelectContentClass}>
                            {southAfricanProvinces.map((province) => (
                              <SelectItem
                                key={province}
                                value={province}
                                className={addendumModalSelectItemClass}
                              >
                                {province}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="homeAreaCode" className={modalFieldLabelClass}>
                          Area code <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="homeAreaCode"
                          value={formData.homeAreaCode}
                          onChange={(e) => {
                            const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 4);
                            setFormData({ ...formData, homeAreaCode: digitsOnly });
                          }}
                          className={getAddendumModalInputClass(formData.homeAreaCode.trim().length > 0)}
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
                        Date of letter <span className="text-red-500">*</span>
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
                      <Label htmlFor="noticePeriod" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Notice period <span className="text-red-500">*</span>
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                tabIndex={-1}
                                className="inline-flex items-center text-slate-400 hover:text-slate-600"
                                aria-label="Notice period info"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className={fixedTooltipContentClass}>
                              In terms of the BCEA the minimum notice periods are based on employee&apos;s length of service: 1 week for less than 6 months, 2 weeks for less than a year but more than 6 months, 4 weeks for more than a year.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <Select
                        value={formData.noticePeriod}
                        onValueChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            noticePeriod: value,
                          }))
                        }
                      >
                        <SelectTrigger
                          className={`${getAddendumModalSelectTriggerClass(Boolean(formData.noticePeriod))} ${addendumModalDropdownToneClass}`}
                        >
                          <SelectValue
                            placeholder="Select notice period"
                            className="data-[placeholder]:text-slate-400 data-[placeholder]:text-[11px] data-[placeholder]:font-normal"
                            style={!formData.noticePeriod ? { color: "#94a3b8" } : undefined}
                          />
                        </SelectTrigger>
                        <SelectContent className={addendumModalSelectContentClass}>
                          {noticePeriodOptions.map((option) => (
                            <SelectItem key={option} value={option} className={addendumModalSelectItemClass}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="effectiveDate" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Date of termination <span className="text-red-500">*</span>
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                tabIndex={-1}
                                className="inline-flex items-center text-slate-400 hover:text-slate-600"
                                aria-label="Date of termination info"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className={fixedTooltipContentClass}>
                              This date is the last day that{" "}
                              {formData.employeeName || formData.employeeSurname
                                ? `${formData.employeeName} ${formData.employeeSurname}`.trim()
                                : "the employee"}{" "}
                              will be working for you.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <div className="flex items-start gap-2">
                        <Input
                          id="effectiveDate"
                          type="text"
                          readOnly
                          placeholder="Auto-calculated from notice date and period"
                          value={formData.effectiveDate ? toDisplayDate(formData.effectiveDate) : ""}
                          className={`${getAddendumModalInputClass(formData.effectiveDate.trim().length > 0)} flex-1 placeholder:!text-[11px] placeholder:!font-normal placeholder:!text-slate-400`}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="hearingDate" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Illness enquiry date <span className="text-red-500">*</span>
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                tabIndex={-1}
                                className="inline-flex items-center text-slate-400 hover:text-slate-600"
                                aria-label="Illness enquiry date info"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className={fixedTooltipContentClass}>
                              Before you can dismiss, a proper ill health investigation should be concluded with a hearing.
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
                      <Label htmlFor="noticeOfAppeal" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Notice of appeal <span className="text-red-500">*</span>
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                tabIndex={-1}
                                className="inline-flex items-center text-slate-400 hover:text-slate-600"
                                aria-label="Notice of appeal info"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className={fixedTooltipContentClass}>
                              This is the time allowed for an employee to lodge an appeal against the decision to dismiss.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <Select
                        value={formData.noticeOfAppeal}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, noticeOfAppeal: value }))}
                      >
                        <SelectTrigger
                          className={`${getAddendumModalSelectTriggerClass(Boolean(formData.noticeOfAppeal))} ${addendumModalDropdownToneClass}`}
                        >
                          <SelectValue
                            placeholder="Select notice of appeal"
                            className="data-[placeholder]:text-slate-400 data-[placeholder]:text-[11px] data-[placeholder]:font-normal"
                            style={!formData.noticeOfAppeal ? { color: "#94a3b8" } : undefined}
                          />
                        </SelectTrigger>
                        <SelectContent className={addendumModalSelectContentClass}>
                          {noticeOfAppealOptions.map((option) => (
                            <SelectItem key={option} value={option} className={addendumModalSelectItemClass}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="chairperson" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Chairperson <span className="text-red-500">*</span>
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                tabIndex={-1}
                                className="inline-flex items-center text-slate-400 hover:text-slate-600"
                                aria-label="Chairperson info"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className={fixedTooltipContentClass}>
                              It is advised that an external person chair the performance hearing to ensure
                              impartiality in the decision-making process. You are not prohibited from chairing your
                              own hearing.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <Select
                        value={formData.chairperson}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, chairperson: value }))}
                      >
                        <SelectTrigger
                          className={`${getAddendumModalSelectTriggerClass(Boolean(formData.chairperson))} ${addendumModalDropdownToneClass}`}
                        >
                          <SelectValue
                            placeholder="Select chairperson type"
                            className="data-[placeholder]:text-slate-400 data-[placeholder]:text-[11px] data-[placeholder]:font-normal"
                            style={!formData.chairperson ? { color: "#94a3b8" } : undefined}
                          />
                        </SelectTrigger>
                        <SelectContent className={addendumModalSelectContentClass}>
                          {chairpersonOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value} className={addendumModalSelectItemClass}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="issuer" className={modalFieldLabelClass}>
                        Issuer
                      </Label>
                      <Input
                        id="issuer"
                        value={formData.issuer}
                        onChange={(e) => setFormData((prev) => ({ ...prev, issuer: e.target.value }))}
                        placeholder="Name and surname of person issuing this document."
                        className={`${getAddendumModalInputClass(formData.issuer.trim().length > 0)} placeholder:!text-[11px] placeholder:!font-normal placeholder:!text-slate-400`}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="transmissionMethods" className={modalFieldLabelClass}>
                        Method of issuing <span className="text-red-500">*</span>
                      </Label>
                      <button
                        id="transmissionMethods"
                        type="button"
                        onClick={openTransmissionPicker}
                        className={`${baseModalFieldClass} !h-[34px] !border-[1.75px] ${formData.transmissionMethods.length > 0 ? "!border-emerald-500" : "!border-slate-300"} w-full px-3 text-left`}
                      >
                        <span
                          className={cn(
                            "block truncate text-[11px]",
                            formData.transmissionMethods.length > 0 ? "text-slate-900" : "text-slate-400 font-normal",
                          )}
                        >
                          {formData.transmissionMethods.length > 0
                            ? `${formData.transmissionMethods.length} method(s) selected`
                            : "Select issuing method(s)"}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                {!(embedded && externalNavigation) ? (
                  <>
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
                  </>
                ) : null}
              </div>
            </div>
          </CardContent>
          </Card>
          ) : (
            <Card className={cn("rounded-sm mt-4 shadow-none border-0 bg-transparent", useExternalShell && "mt-0 contents")}>
              <CardHeader className="pt-4 pb-0" />
              <CardContent className={cn("space-y-6 pt-2", useExternalShell && "contents")}>
                  <ScrollArea className="h-[70vh] w-full rounded-sm bg-white px-6 pb-6" ref={previewScrollRef}>
            {validatedPreview ? (() => {
              const issueDateDisplay = formatDate(validatedPreview.issueDate);
              const hearingDateDisplay = formatDate(validatedPreview.hearingDate);
              const terminationDateDisplay = formatDate(validatedPreview.effectiveDate || validatedPreview.issueDate);
              const paragraphOneText = `We refer to the abovementioned matter and the enquiry relating to your ill health held on ${hearingDateDisplay || "[inquiry date]"}.`;
              const paragraphTwoText =
                validatedPreview.chairperson === "external"
                  ? "After the chairperson considered the statement(s) and/or evidence presented during the enquiry, it has been determined that you remain incapable of performing your duties due to ill health, and that no reasonable alternative to dismissal is available."
                  : "After considering the statement(s) and/or evidence presented during the enquiry, it has been determined that you remain incapable of performing your duties due to ill health, and that no reasonable alternative to dismissal is available.";
              const lastWorkingDaySentence = `You will be paid in lieu of notice up to ${terminationDateDisplay || "[date of termination]"}.`;
              const baseClauses: Array<Omit<ClauseDefinition, "id">> = [
                {
                  title: "Paragraph 1",
                  body: paragraphOneText,
                },
                {
                  title: "Paragraph 2",
                  body: paragraphTwoText,
                },
                {
                  title: "Paragraph 3",
                  body: `Take notice that your employment is herewith terminated with ${formatNoticePeriodPossessive(validatedPreview.noticePeriod)} notice for incapacity: ill health, effective ${issueDateDisplay || "[date of notice]"}. ${lastWorkingDaySentence}`,
                },
                {
                  title: "Paragraph 4",
                  body: "You may appeal against this decision to terminate your employment within five (5) days from the date in this termination letter, in accordance with the company's disciplinary procedures. Alternatively, you may refer a dispute to the CCMA or the applicable bargaining council within thirty (30) days from the date of termination.",
                },
                {
                  title: "Paragraph 5",
                  body: "We trust you find the above in order and we wish you good luck with your future endeavours.",
                },
              ];

    const clauses: ClauseDefinition[] = mergeClauses(withClauseIds(baseClauses));

              const clausesWithEdits = applyClauseEdits(clauses);

              const startEditingClause = (clause: ClauseDefinition) => {
                rememberPreviewScroll();
                const isCustomClause = customClauses.some((custom) => custom.id === clause.id);
                setEditingClause(clause.id);
                setClauseDraft(stripParagraphBreaks(clauseEdits[clause.id] ?? serializeClauseBody(clause.body)));
                setCustomClauseTitleDraft(isCustomClause ? (customClauseTitleEdits[clause.id] ?? clause.title) : "");
              };

              const cancelClauseEdit = () => {
                setEditingClause(null);
                setClauseDraft("");
                setCustomClauseTitleDraft("");
              };

              const saveClauseEdit = (id: string) => {
                const trimmed = normalizeSingleParagraphText(clauseDraft);
                const baseCustomClause = customClauses.find((clause) => clause.id === id);
                if (baseCustomClause) {
                  const titleTrimmed = customClauseTitleDraft.trim();
                  setCustomClauseTitleEdits((prev) => {
                    const next = { ...prev };
                    if (!titleTrimmed || titleTrimmed === baseCustomClause.title) {
                      delete next[id];
                    } else {
                      next[id] = titleTrimmed;
                    }
                    return next;
                  });
                }
                setClauseEdits((prev) => {
                  const next = { ...prev };
                  if (trimmed) {
                    next[id] = trimmed;
                  } else {
                    delete next[id];
                  }
                  return next;
                });
                setEditingClause(null);
                setClauseDraft("");
                setCustomClauseTitleDraft("");
              };

              const resetClauseEdit = (id: string) => {
                setClauseEdits((prev) => {
                  const next = { ...prev };
                  delete next[id];
                  return next;
                });
                setCustomClauseTitleEdits((prev) => {
                  const next = { ...prev };
                  delete next[id];
                  return next;
                });
                setEditingClause(null);
                setClauseDraft("");
                setCustomClauseTitleDraft("");
              };

              const openAddClauseForm = (afterId: string | null) => {
                rememberPreviewScroll();
                setAddingAfter(afterId);
                setNewClauseBody("");
              };

              const cancelAddClause = () => {
                setAddingAfter(undefined);
                setNewClauseBody("");
              };

              const saveNewClause = () => {
                const body = normalizeSingleParagraphText(newClauseBody);
                if (!body) {
                  toast({
                    title: "Add paragraph",
                    description: "Please provide paragraph content.",
                    variant: "destructive",
                  });
                  return;
                }
                setCustomClauses((prev) => [
                  ...prev,
                  {
                    id: generateCustomClauseId(),
                    title: "Paragraph",
                    body,
                    insertAfterId: addingAfter,
                    amendmentType: "add",
                  },
                ]);
                cancelAddClause();
              };

              const deleteCustomClause = (id: string) => {
                if (typeof window !== "undefined") {
                  const shouldDelete = window.confirm("Are you sure you want to delete this paragraph?");
                  if (!shouldDelete) return;
                }
                setCustomClauses((prev) => prev.filter((clause) => clause.id !== id));
                setClauseEdits((prev) => {
                  const next = { ...prev };
                  delete next[id];
                  return next;
                });
                setCustomClauseTitleEdits((prev) => {
                  const next = { ...prev };
                  delete next[id];
                  return next;
                });
                if (editingClause === id) {
                  setEditingClause(null);
                  setClauseDraft("");
                  setCustomClauseTitleDraft("");
                }
              };
              const activeEditingClause = editingClause
                ? clausesWithEdits.find((clause) => clause.id === editingClause) ?? null
                : null;
              const isActiveEditingClauseCustom = activeEditingClause
                ? customClauses.some((custom) => custom.id === activeEditingClause.id)
                : false;

              return (
                <div className="space-y-8">
                  <FirstPagePreview data={validatedPreview} profile={profile} logoPreviewUrl={companyLogoPreview || validatedPreview.companyLogoDataUrl}>
                    <div className="text-xs leading-relaxed space-y-5">
                          {(() => {
                            const renderAddClauseControl = (afterId: string | null) => {
                              if (!isPreviewEditable) return null;
                              return (
                                <div key={`add-${afterId ?? "start"}`} className="flex justify-center py-2 px-3">
                                  <button
                                    type="button"
                                    onClick={() => openAddClauseForm(afterId)}
                                    className="group relative w-full max-w-[calc(100%-1.5rem)] mx-auto py-3 flex justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                  >
                                    <span className="relative z-10 inline-flex h-8 w-16 items-center justify-center bg-white text-xs font-medium text-blue-700 transition-all border border-transparent group-hover:font-semibold group-hover:border-blue-600 group-hover:rounded-full">
                                      <span className="absolute inset-0 flex items-center justify-center transition-opacity group-hover:opacity-0">
                                        <Plus className="h-3.5 w-3.5 transition-transform group-hover:scale-110" aria-hidden="true" />
                                      </span>
                                      <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                                        Add
                                      </span>
                                    </span>
                                    <span className="pointer-events-none absolute inset-0 flex items-center" aria-hidden="true">
                                      <span className="flex-1 border-t border-slate-200 transition-all group-hover:border-blue-600" />
                                      <span className="w-16" />
                                      <span className="flex-1 border-t border-slate-200 transition-all group-hover:border-blue-600" />
                                    </span>
                                  </button>
                                </div>
                              );
                            };

                            return [
                              ...clausesWithEdits.flatMap((clause) => {
                              const paragraphs = Array.isArray(clause.body) ? clause.body : [clause.body];
                              const isEditing = editingClause === clause.id;
                              const isCustomClause = customClauses.some((custom) => custom.id === clause.id);
                              return [
                                <div key={clause.id} className="space-y-2 py-1">
                                  <div className="flex items-center justify-end gap-2">
                                    {isPreviewEditable ? (
                                      <div className="flex items-center gap-2">
                                        {isEditing ? (
                                          <span className="text-[11px] font-semibold text-blue-600">Editing...</span>
                                        ) : (
                                          <>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-[28px] rounded border-slate-300 px-3 text-xs text-slate-500 hover:border-blue-600 hover:bg-transparent hover:text-blue-600"
                                              onClick={() => startEditingClause(clause)}
                                            >
                                              Edit
                                            </Button>
                                            {isCustomClause ? (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-[28px] rounded px-3 text-xs !border-red-600 !bg-white !text-red-600 hover:!border-red-600 hover:!bg-red-600 hover:!text-white"
                                                onClick={() => deleteCustomClause(clause.id)}
                                              >
                                                Delete
                                              </Button>
                                            ) : null}
                                          </>
                                        )}
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="space-y-4">
                                    {paragraphs.map((text, paragraphIndex) => {
                                      return (
                                        <p key={`${clause.id}-${paragraphIndex}`} className="text-justify whitespace-pre-line text-black">
                                          {text}
                                        </p>
                                      );
                                    })}
                                  </div>
                                </div>,
                                renderAddClauseControl(clause.id),
                              ];
                            }),
                            ];
                          })()}
                          {isPreviewEditable && activeEditingClause ? (
                                <div className="fixed inset-x-0 -top-16 bottom-0 z-[999] flex items-center justify-center bg-slate-900/35 px-4">
                                  <div
                                    className="w-full max-w-3xl rounded border border-slate-200 bg-white p-4 shadow-xl"
                                    role="dialog"
                                    aria-modal="true"
                                    aria-label="Edit paragraph"
                                  >
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between gap-3">
                                        <h3 className="text-sm font-semibold text-black">Edit Paragraph</h3>
                                        <span className="text-[11px] text-slate-500">Save or cancel to continue.</span>
                                      </div>
                                      {isActiveEditingClauseCustom ? (
                                        <Input
                                          value={customClauseTitleDraft}
                                          onChange={(e) => setCustomClauseTitleDraft(e.target.value)}
                                          placeholder="Clause title"
                                          className={getAddendumModalInputClass(customClauseTitleDraft.trim().length > 0)}
                                        />
                                      ) : null}
                                      <Textarea
                                        ref={editClauseTextareaRef}
                                        value={clauseDraft}
                                        onChange={(e) => setClauseDraft(stripParagraphBreaks(e.target.value))}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                          }
                                        }}
                                        rows={3}
                                        className="min-h-[84px] resize-none rounded text-xs text-slate-600 border-slate-300 hover:border-blue-400 focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0"
                                        spellCheck={true}
                                        lang="en"
                                        autoCorrect="on"
                                      />
                                      <div className="flex items-center justify-end gap-2">
                                        {Boolean(
                                          clauseEdits[activeEditingClause.id] || customClauseTitleEdits[activeEditingClause.id],
                                        ) ? (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-[28px] px-3 text-xs rounded !border-0 !bg-white text-slate-500 shadow-none hover:!bg-white hover:text-black hover:underline underline-offset-2"
                                            onClick={() => resetClauseEdit(activeEditingClause.id)}
                                          >
                                            Reset
                                          </Button>
                                        ) : null}
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-[28px] px-3 text-xs rounded !bg-white hover:!bg-white !border-slate-300 hover:!border-blue-600 !text-slate-700 hover:!text-blue-600"
                                          onClick={cancelClauseEdit}
                                        >
                                          Cancel
                                        </Button>
                                        <Button
                                          size="sm"
                                          className="h-[28px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700 disabled:bg-slate-300"
                                          onClick={() => saveClauseEdit(activeEditingClause.id)}
                                        >
                                          Save
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                            ) : null}
                          {isPreviewEditable && addingAfter !== undefined ? (
                                <div className="fixed inset-x-0 -top-16 bottom-0 z-[999] flex items-center justify-center bg-slate-900/35 px-4">
                                  <div
                                    className="w-full max-w-3xl rounded border border-slate-200 bg-white p-4 shadow-xl"
                                    role="dialog"
                                    aria-modal="true"
                                    aria-label="Add paragraph"
                                  >
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between gap-3">
                                        <h3 className="text-sm font-semibold text-black">Add Paragraph</h3>
                                        <span className="text-[11px] text-slate-500">Complete and add, or cancel to continue.</span>
                                      </div>
                                      <Textarea
                                        ref={addClauseTextareaRef}
                                        value={newClauseBody}
                                        onChange={(e) => setNewClauseBody(stripParagraphBreaks(e.target.value))}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                          }
                                        }}
                                    rows={3}
                                    className="min-h-[84px] resize-none rounded text-xs text-slate-600 border-slate-300 hover:border-blue-400 focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0"
                                    placeholder="Type your new paragraph here..."
                                    spellCheck={true}
                                    lang="en"
                                    autoCorrect="on"
                                  />
                                      <div className="flex items-center justify-end gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-[28px] px-3 text-xs rounded !bg-white hover:!bg-white !border-slate-300 hover:!border-blue-600 !text-slate-700 hover:!text-blue-600"
                                          onClick={cancelAddClause}
                                        >
                                          Cancel
                                        </Button>
                                        <Button
                                          size="sm"
                                          className="h-[28px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700 disabled:bg-slate-300"
                                          onClick={saveNewClause}
                                          disabled={!newClauseBody.trim()}
                                        >
                                          Add paragraph
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                            ) : null}

                    </div>
                </FirstPagePreview>
              </div>
            );
          })() : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">Complete the form to preview the contract.</p>
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
                      {type}
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

      <Dialog open={transmissionPickerOpen} onOpenChange={(open) => (open ? openTransmissionPicker() : cancelTransmissionPicker())}>
        <DialogContent className="w-[94vw] max-w-[680px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-white [&>button]:hidden">
          <div className="flex items-center justify-between bg-[#2D4256] px-4 py-3 -mx-px -mt-px">
            <div className="flex items-center gap-2 pl-2">
              <Mail className="h-4 w-4 text-white" />
              <DialogTitle className="text-sm font-semibold text-white">Select Method of Issuing</DialogTitle>
            </div>
            <DialogClose asChild>
              <button type="button" className="text-white hover:text-white/80">
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
          <DialogHeader className="px-6 pt-4 pb-0">
            <DialogDescription className="text-[11px] text-slate-600">
              Choose one or more methods. Use Done to apply or Cancel to discard changes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-6 pb-6 pt-4">
            <ScrollArea className="max-h-44 rounded border border-slate-200 bg-white">
              <div className="space-y-1 p-3">
                {transmissionMethodOptions.map((method) => (
                  <label
                    key={method}
                    className={`flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-blue-50/70 hover:text-blue-600 focus-within:bg-blue-50/70 ${addendumModalSelectItemClass}`}
                  >
                    <Checkbox
                      checked={draftTransmissionMethods.includes(method)}
                      onCheckedChange={(checked) =>
                        setDraftTransmissionMethods((prev) =>
                          checked ? (prev.includes(method) ? prev : [...prev, method]) : prev.filter((item) => item !== method),
                        )
                      }
                      className="h-4 w-4 rounded-[2px] border-slate-400 text-white data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
                    />
                    <span className="flex-1">{method}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
            <div>
              {draftTransmissionMethods.length === 0 ? (
                <div className="text-xs text-slate-600">No method selected</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {draftTransmissionMethods.map((method) => (
                    <Badge
                      key={method}
                      variant="outline"
                      className="gap-1 border-blue-300 bg-blue-50 text-[10px] text-blue-700 !font-normal hover:bg-blue-50"
                    >
                      {method}
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
                  onClick={cancelTransmissionPicker}
                  className="h-[28px] w-[84px] rounded border-blue-600 px-3 text-xs text-blue-600 hover:bg-transparent hover:text-blue-600"
                >
                  Cancel
                </Button>
              </div>
              <div className="justify-self-center">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDraftTransmissionMethods([])}
                  disabled={draftTransmissionMethods.length === 0}
                  className="h-[30px] rounded border-0 px-3 text-xs text-slate-500 shadow-none hover:bg-transparent hover:text-slate-600 hover:underline disabled:text-slate-300"
                >
                  Clear
                </Button>
              </div>
              <div className="justify-self-end">
                <Button
                  type="button"
                  onClick={applyTransmissionPicker}
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

export default IllHealthTerminationGenerator;





