import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ComponentType, type ReactNode, type SVGProps } from "react";
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
import { Download, Building2, User2, Briefcase, Check, Undo2, X, Info, Plus, Calendar, TriangleAlert, Mail, Phone, Palette } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import { cn } from "@/lib/utils";
import {
  salaryFrequencyOptions,
  type PermanentContractFormData,
} from "@/lib/validation";
import { addServiceDelayToDate } from "@/lib/terminationNotice";
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
  severancePackage: string;
  voluntaryRetrenchment: "yes" | "no" | "";
  transmissionMethods: string[];
  abscondmentNoticeDate: string;
  absentFromDate: string;
  noticePeriod: string;
  noticeOfAppeal: string;
  appliedProgressiveDisciplinaryAction: string;
  hearingDate: string;
  performanceConsultationDate: string;
  improvementPeriod: string;
  retrenchmentReasons: string[];
  affectedEmployees: string;
  jobCategories: string;
  selectionCriteria: string[];
  alternativesConsidered: string[];
  rejectionReasons: string[];
  proposedTerminationDate: string;
  consultationFormat: ConsultationFormat | "";
  consultationLocation: string;
  consultationDate: string;
  consultationTime: string;
  severanceMethod: string;
  assistanceOffered: string[];
  totalEmployees: string;
  priorRetrenchments: string;
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
type ConsultationFormat = "in_person" | "virtual";

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
  severancePackage: string;
  voluntaryRetrenchment: "yes" | "no" | "";
  transmissionMethods: string[];
  abscondmentNoticeDate: string;
  absentFromDate: string;
  noticePeriod: string;
  noticeOfAppeal: string;
  appliedProgressiveDisciplinaryAction: string;
  hearingDate: string;
  performanceConsultationDate: string;
  improvementPeriod: string;
  retrenchmentReasons: string[];
  affectedEmployees: string;
  jobCategories: string;
  selectionCriteria: string[];
  alternativesConsidered: string[];
  rejectionReasons: string[];
  proposedTerminationDate: string;
  consultationFormat: ConsultationFormat;
  consultationLocation: string;
  consultationDate: string;
  consultationTime: string;
  severanceMethod: string;
  assistanceOffered: string[];
  totalEmployees: string;
  priorRetrenchments: string;
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
  status: string | null;
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

type ManualEmployeeRow = {
  id: string;
  employeeName: string;
  employeeSurname: string;
  idType: "id" | "passport";
  employeeIdNumber: string;
  passportNumber: string;
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
const getAutoSeverancePackageFromStartDate = (startDateRaw: string): string => {
  const value = (startDateRaw || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "None";
  const startDate = new Date(`${value}T00:00:00`);
  const today = new Date();
  const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (Number.isNaN(startDate.getTime()) || startDate > normalizedToday) return "None";

  let completedYears = normalizedToday.getFullYear() - startDate.getFullYear();
  if (
    normalizedToday.getMonth() < startDate.getMonth() ||
    (normalizedToday.getMonth() === startDate.getMonth() && normalizedToday.getDate() < startDate.getDate())
  ) {
    completedYears -= 1;
  }

  if (completedYears <= 0) return "None";
  if (completedYears === 1) return "1 week";
  if (completedYears === 2) return "2 weeks";
  if (completedYears === 3) return "3 weeks";
  if (completedYears === 4) return "4 weeks";
  if (completedYears >= 32) return "32 weeks";
  return `${completedYears} weeks`;
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
const noticeMethodOptions = [
  { value: "required_to_work_notice_period", label: "Required to work during Notice Period" },
  { value: "not_required_to_work_notice_period", label: "Not required to work during Notice Period" },
] as const;
const progressiveDisciplinaryActionOptions = ["Yes", "No PDA applied"] as const;
const transmissionMethodOptions = ["By Hand", "By Email", "By Registered Post", "By Regular Post", "By WhatsApp", "By Facebook"] as const;
const severancePackageOptions = [
  "None",
  "1 week",
  "2 weeks",
  "3 weeks",
  "4 weeks",
  ...Array.from({ length: 28 }, (_, index) => `${index + 5} weeks`),
] as const;
const selectionCriteriaOptions = [
  "Last In, First Out (LIFO)",
  "LIFO subject to skills retention",
  "Bumping",
  "Skills and qualifications",
  "Affirmative action / Employment Equity considerations",
] as const;
const LIFO_OPTION = "Last In, First Out (LIFO)";
const LIFO_WITH_SKILLS_OPTION = "LIFO subject to skills retention";
const SKILLS_AND_QUALIFICATIONS_OPTION = "Skills and qualifications";
const ALTERNATIVES_CONSIDERED_OPTIONS = [
  "No alternatives at this stage",
  "Reduction of overtime",
  "Short time / reduced hours",
  "Temporary layoff",
  "Salary reduction",
  "Freeze on recruitment",
  "Natural attrition",
  "Voluntary retrenchment",
  "Redeployment",
  "Alternative positions",
  "Training / reskilling",
  "Early retirement",
  "Reduced benefits",
  "Business cost reduction",
] as const;
const NO_ALTERNATIVES_OPTION = "No alternatives at this stage";
const REJECTION_REASON_OPTIONS = [
  "Not financially viable",
  "Insufficient cost saving",
  "Operational impracticality",
  "Temporary solution only",
  "No suitable vacancies",
  "Skills mismatch",
  "Business sustainability risk",
  "Negative operational impact",
  "Does not address redundancy",
  "Disproportionate cost impact",
] as const;
const ASSISTANCE_OFFERED_OPTIONS = [
  "Redeployment support",
  "Assistance in applying for alternative positions",
  "Skills training / reskilling support",
  "CV preparation support",
  "Interview preparation support",
  "Counselling / employee wellness support",
  "Financial planning guidance",
  "Time off to attend interviews",
  "Reference letters",
  "No additional assistance offered",
] as const;
const NO_ADDITIONAL_ASSISTANCE_OPTION = "No additional assistance offered";
const CONSULTATION_FORMAT_OPTIONS = [
  { value: "in_person", label: "In person" },
  { value: "virtual", label: "Virtual" },
] as const;
const severanceMethodOptions = [
  "BCEA",
  "Bargaining Council provisions",
  "No severance payment",
] as const;
const priorRetrenchmentsOptions = ["Yes", "No"] as const;
const chairpersonOptions = [
  { value: "external", label: "External" },
  { value: "internal", label: "Internal" },
] as const;

const RETRENCHMENT_REASON_OPTIONS = [
  "Economic downturn / financial constraints",
  "Operational restructuring of the business",
  "Redundancy of the position",
  "Reduction in workload or demand for services",
  "Introduction of new technology or automation",
  "Closure of a department, division, or business unit",
] as const;

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

const consultationTimeOptions = Array.from({ length: 96 }, (_, index) => {
  const hour = Math.floor(index / 4);
  const minute = ["00", "15", "30", "45"][index % 4];
  const value = `${String(hour).padStart(2, "0")}:${minute}`;
  return {
    value,
    label: formatTime(value),
  };
});

const normalizeConsultationTimeInput = (value: string) => {
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

const makeSafeFileToken = (value: string) =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_");

const SAME_DAY_HEARING_NOTICE_CAUTION = "__SAME_DAY_HEARING_NOTICE_CAUTION__";

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

const formatListWithAnd = (items: string[], fallback: string) => {
  const normalized = items.map((item) => item.trim()).filter(Boolean);
  if (normalized.length === 0) return fallback;
  if (normalized.length === 1) return normalized[0];
  if (normalized.length === 2) return `${normalized[0]} and ${normalized[1]}`;
  return `${normalized.slice(0, -1).join(", ")} and ${normalized[normalized.length - 1]}`;
};

const formatSelectionCriteriaItem = (item: string) =>
  item
    .toLowerCase()
    .replace(/\blifo\b/g, "LIFO");

const formatRetrenchmentReasonItem = (item: string) => item.toLowerCase();
const formatAlternativesConsideredItem = (item: string) => item.toLowerCase();
const normalizeAlternativesConsideredSelection = (items: string[]) => {
  const uniqueItems = Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
  if (uniqueItems.includes(NO_ALTERNATIVES_OPTION)) {
    return [NO_ALTERNATIVES_OPTION];
  }
  return uniqueItems.filter((item) => item !== NO_ALTERNATIVES_OPTION);
};
const normalizeSelectionCriteriaSelection = (items: string[]) => {
  const uniqueItems = Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
  if (uniqueItems.includes(LIFO_OPTION) && uniqueItems.includes(LIFO_WITH_SKILLS_OPTION)) {
    return uniqueItems.filter((item) => item !== LIFO_OPTION);
  }
  if (uniqueItems.includes(LIFO_WITH_SKILLS_OPTION) && uniqueItems.includes(SKILLS_AND_QUALIFICATIONS_OPTION)) {
    return uniqueItems.filter((item) => item !== SKILLS_AND_QUALIFICATIONS_OPTION);
  }
  return uniqueItems;
};
const normalizeAssistanceOfferedSelection = (items: string[]) => {
  const uniqueItems = Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
  if (uniqueItems.includes(NO_ADDITIONAL_ASSISTANCE_OPTION)) {
    return [NO_ADDITIONAL_ASSISTANCE_OPTION];
  }
  return uniqueItems.filter((item) => item !== NO_ADDITIONAL_ASSISTANCE_OPTION);
};
const shouldResetRejectionReasons = (alternatives: string[]) =>
  alternatives.length === 0 ||
  (alternatives.length === 1 && alternatives[0] === NO_ALTERNATIVES_OPTION);
const LOCKED_HEADER_CLAUSE_TITLES = new Set([
  "Paragraph 4",
  "Paragraph 5",
  "Paragraph 6",
  "Paragraph 7",
  "Paragraph 8",
  "Paragraph 9",
  "Paragraph 10",
  "Paragraph 11",
  "Paragraph 12",
  "Paragraph 13",
]);
const formatConsultationPlaceDisplay = (consultationFormat: ConsultationFormat | "", consultationLocation: string) => {
  const value = consultationLocation.trim();
  if (!value) return "";
  if (consultationFormat === "virtual") return `Virtual - ${value}`;
  return value;
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
  const salutation = "Dear Sir / Madam";
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
          <div className="grid grid-cols-[32px_1fr] items-start gap-x-3">
            <span>TO:</span>
            <div className="space-y-0.5 font-semibold uppercase">
              <p>{employeeNameDisplay}</p>
              <p>Affected Employee</p>
              <p>{companyNameDisplay}</p>
            </div>
          </div>
        </div>
        <div className="mt-3 text-right font-semibold">
          {data.transmissionMethods.map((method) => (
            <p key={method}>{method.replace(/^By\s+/i, "Per ")}</p>
          ))}
        </div>
        <div className="mt-4 space-y-4">
          <p>{salutation}</p>
          <p className="pt-2 pb-2 font-bold underline">RE: NOTICE OF CONTEMPLATED RETRENCHMENT</p>
          <div className="space-y-4">{children}</div>
          <p>Yours faithfully</p>
          <div className="pt-8">
            <div className="w-36 border-t border-black" />
            {data.issuer?.trim() ? <p className="font-semibold">{data.issuer.trim()}</p> : null}
            <p>Management</p>
          </div>
          <div className="mt-6 border border-black p-2 space-y-4">
            <p>
              I, <span className="underline">{`${employeeNameDisplay} (${employeeIdLabel}: ${employeeIdValue})`}</span>, hereby acknowledge that I received this
              notice and confirm that the content hereof was explained to me.
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

const ContemplatedRetrenchmentNoticeGenerator = ({
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
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
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
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [draftSelectedEmployeeIds, setDraftSelectedEmployeeIds] = useState<string[]>([]);
  const [manualEmployees, setManualEmployees] = useState<ManualEmployeeRow[]>([]);
  const [addEmployeeDialogOpen, setAddEmployeeDialogOpen] = useState(false);
  const [manualEmployeeForm, setManualEmployeeForm] = useState<{
    employeeName: string;
    employeeSurname: string;
    idType: "id" | "passport";
    employeeIdNumber: string;
    passportNumber: string;
  }>({
    employeeName: "",
    employeeSurname: "",
    idType: "id",
    employeeIdNumber: "",
    passportNumber: "",
  });
  const [formData, setFormData] = useState<ContractFormState>({
    employeeId: "",
    age: "",
    companyLogoDataUrl: "",
    logoPlacement: "center",
    letterheadThemeColors: [defaultDividerColor, defaultIconColor],
    issuer: "",
    chairperson: "",
    noticeMethod: "",
    severancePackage: "",
    voluntaryRetrenchment: "no",
    transmissionMethods: [],
    abscondmentNoticeDate: "",
    absentFromDate: "",
    noticePeriod: "",
    noticeOfAppeal: "",
    appliedProgressiveDisciplinaryAction: "",
    hearingDate: "",
    performanceConsultationDate: "",
    improvementPeriod: "",
    retrenchmentReasons: [],
    affectedEmployees: "",
    jobCategories: "",
    selectionCriteria: [],
    alternativesConsidered: [],
    rejectionReasons: [],
    proposedTerminationDate: "",
    consultationFormat: "",
    consultationLocation: "",
    consultationDate: "",
    consultationTime: "",
    severanceMethod: "",
    assistanceOffered: [],
    totalEmployees: "",
    priorRetrenchments: "",
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
  const [sameDayCaution, setSameDayCaution] = useState<{ open: boolean; pendingAction: "" | "finish" | "download" }>({
    open: false,
    pendingAction: "",
  });
  const [sameDayOverrideAccepted, setSameDayOverrideAccepted] = useState(false);
  const [sameDayCautionDismissed, setSameDayCautionDismissed] = useState(false);
  const [consultationTimeFocused, setConsultationTimeFocused] = useState(false);
  const [consultationTimeSelectOpen, setConsultationTimeSelectOpen] = useState(false);
  const [consultationTimeFieldVersion, setConsultationTimeFieldVersion] = useState(0);
  const skipConsultationTimeBlurCommitRef = useRef(false);
  const [misconductPickerOpen, setMisconductPickerOpen] = useState(false);
  const [draftMisconductTypes, setDraftMisconductTypes] = useState<string[]>([]);
  const [selectionCriteriaPickerOpen, setSelectionCriteriaPickerOpen] = useState(false);
  const [draftSelectionCriteria, setDraftSelectionCriteria] = useState<string[]>([]);
  const [alternativesPickerOpen, setAlternativesPickerOpen] = useState(false);
  const [draftAlternativesConsidered, setDraftAlternativesConsidered] = useState<string[]>([]);
  const [rejectionReasonsPickerOpen, setRejectionReasonsPickerOpen] = useState(false);
  const [draftRejectionReasons, setDraftRejectionReasons] = useState<string[]>([]);
  const [assistanceOfferedPickerOpen, setAssistanceOfferedPickerOpen] = useState(false);
  const [draftAssistanceOffered, setDraftAssistanceOffered] = useState<string[]>([]);
  const [transmissionPickerOpen, setTransmissionPickerOpen] = useState(false);
  const [draftTransmissionMethods, setDraftTransmissionMethods] = useState<string[]>([]);
  const [colorThemePickerOpen, setColorThemePickerOpen] = useState(false);
  const [draftLetterheadThemeColors, setDraftLetterheadThemeColors] = useState<string[]>([]);
  const noticeDatePickerRef = useRef<HTMLInputElement | null>(null);
  const proposedTerminationDatePickerRef = useRef<HTMLInputElement | null>(null);
  const hearingDatePickerRef = useRef<HTMLInputElement | null>(null);
  const consultationDatePickerRef = useRef<HTMLInputElement | null>(null);
  const consultationTimeInputRef = useRef<HTMLInputElement | null>(null);
  const contractReferencePickerRef = useRef<HTMLInputElement | null>(null);
  const contractEndDatePickerRef = useRef<HTMLInputElement | null>(null);
  const newEndDatePickerRef = useRef<HTMLInputElement | null>(null);
  const companyLogoInputRef = useRef<HTMLInputElement | null>(null);
  const employeeSearchInputRef = useRef<HTMLInputElement | null>(null);
  const clauseFieldFocusRef = useRef<HTMLElement | null>(null);
  const editClauseTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const addClauseTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const previewScrollTop = useRef(0);
  const [companyLogoPreview, setCompanyLogoPreview] = useState<string>("");
  const baseModalFieldClass =
    "h-8 rounded border border-slate-200 bg-white !text-[11px] md:!text-[11px] font-medium text-slate-900 shadow-none placeholder:!text-[11px] placeholder:!text-slate-400 hover:border-blue-400 !focus-visible:border-[1.75px] !focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:bg-white disabled:text-slate-900 disabled:border-slate-200 disabled:opacity-100 disabled:cursor-default";
  const addendumModalDropdownToneClass =
    "bg-white border-slate-300 hover:border-blue-400 data-[state=open]:border-slate-300 data-[state=open]:bg-white";
  const addendumModalSelectContentClass = "!rounded";
  const addendumModalSelectItemClass =
    "!rounded text-[11px] text-slate-700 focus:bg-blue-50/70 focus:text-blue-600 data-[highlighted]:bg-blue-50/70 data-[highlighted]:text-blue-600 data-[state=checked]:text-slate-700 data-[state=checked]:data-[highlighted]:text-slate-700";
  const getAddendumModalInputClass = (isComplete: boolean) =>
    `${baseModalFieldClass} !h-[34px] !border-[1.75px] !border-slate-300 !focus-visible:border-slate-300 ${isComplete ? "!border-emerald-500" : ""}`;
  const getAddendumModalSelectTriggerClass = (isComplete: boolean) =>
    `${baseModalFieldClass} !rounded justify-between data-[placeholder]:text-slate-400 data-[placeholder]:text-[11px] !h-[34px] !border-[1.75px] !border-slate-300 !focus:border-blue-600 !focus-visible:border-blue-600 data-[state=open]:!border-blue-600 !ring-0 !ring-offset-0 !outline-none !shadow-none !focus:ring-0 !focus:ring-offset-0 !focus:shadow-none !focus:outline-none !focus-visible:ring-0 !focus-visible:ring-offset-0 !focus-visible:shadow-none !focus-visible:outline-none data-[state=open]:!ring-0 data-[state=open]:!ring-offset-0 data-[state=open]:!shadow-none data-[state=open]:!outline-none ${isComplete ? "!border-emerald-500" : ""}`;
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
        "id, status, id_number, employee_name, employee_surname, nationality, emergency_contact_number, gender, race, cell_number, email, job_title, start_date, employee_number, physical_address_line1, physical_address_line2, city, province, area_code",
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

  useEffect(() => {
    if (!shouldResetRejectionReasons(formData.alternativesConsidered)) return;
    if (formData.rejectionReasons.length === 0) return;
    setFormData((prev) => ({ ...prev, rejectionReasons: [] }));
  }, [formData.alternativesConsidered, formData.rejectionReasons.length]);

  const activeEmployeeTotal = useMemo(
    () =>
      employees.filter((employee) => {
        const status = (employee.status ?? "").trim().toLowerCase();
        return status === "" || status === "active";
      }).length,
    [employees],
  );

  useEffect(() => {
    const nextTotal = String(activeEmployeeTotal);
    setFormData((prev) => (prev.totalEmployees === nextTotal ? prev : { ...prev, totalEmployees: nextTotal }));
  }, [activeEmployeeTotal]);

  const manualEmployeeCount = manualEmployees.length;

  const selectedEmployeeMap = useMemo(() => {
    const map = new Map<string, SlimEmployee>();
    employees.forEach((employee) => {
      map.set(employee.id, employee);
    });
    return map;
  }, [employees]);

  const selectedEmployees = useMemo(
    () =>
      selectedEmployeeIds
        .map((id) => selectedEmployeeMap.get(id))
        .filter((employee): employee is SlimEmployee => Boolean(employee)),
    [selectedEmployeeIds, selectedEmployeeMap],
  );
  const searchedEmployees = useMemo(() => {
    const query = employeeSearchQuery.trim().toLowerCase();
    return employees.filter((employee) => {
      const status = (employee.status ?? "").trim().toLowerCase();
      if (!(status === "" || status === "active")) return false;
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

  const openAddEmployeeDialog = () => {
    setManualEmployeeForm({
      employeeName: "",
      employeeSurname: "",
      idType: "id",
      employeeIdNumber: "",
      passportNumber: "",
    });
    setAddEmployeeDialogOpen(true);
  };

  const addManualEmployee = () => {
    const employeeName = manualEmployeeForm.employeeName.trim();
    const employeeSurname = manualEmployeeForm.employeeSurname.trim();
    const employeeIdNumber =
      manualEmployeeForm.idType === "id"
        ? manualEmployeeForm.employeeIdNumber.replace(/\D/g, "").slice(0, 13)
        : "";
    const passportNumber =
      manualEmployeeForm.idType === "passport"
        ? manualEmployeeForm.passportNumber.trim()
        : "";
    if (!employeeName || !employeeSurname) {
      toast({
        title: "Validation error",
        description: "Employee name and surname are required.",
        variant: "destructive",
      });
      return;
    }
    if (manualEmployeeForm.idType === "id" && !employeeIdNumber) {
      toast({
        title: "Validation error",
        description: "ID number is required.",
        variant: "destructive",
      });
      return;
    }
    if (manualEmployeeForm.idType === "passport" && !passportNumber) {
      toast({
        title: "Validation error",
        description: "Passport number is required.",
        variant: "destructive",
      });
      return;
    }
    setManualEmployees((prev) => [
      ...prev,
      {
        id: generateCustomClauseId(),
        employeeName,
        employeeSurname,
        idType: manualEmployeeForm.idType,
        employeeIdNumber,
        passportNumber,
      },
    ]);
    setAddEmployeeDialogOpen(false);
  };

  const openEmployeePicker = () => {
    setDraftSelectedEmployeeIds(selectedEmployeeIds);
    setEmployeeSearchQuery("");
    setEmployeePickerOpen(true);
  };

  const cancelEmployeePicker = () => {
    setEmployeePickerOpen(false);
    setDraftSelectedEmployeeIds([]);
    setEmployeeSearchQuery("");
  };

  const applyEmployeePicker = () => {
    setSelectedEmployeeIds(draftSelectedEmployeeIds);
    setEmployeePickerOpen(false);
    setDraftSelectedEmployeeIds([]);
    setEmployeeSearchQuery("");
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
      noticeMethod: "",
      severancePackage: "",
      voluntaryRetrenchment: "no",
      transmissionMethods: [],
      abscondmentNoticeDate: "",
      absentFromDate: "",
      noticePeriod: "",
      noticeOfAppeal: "",
      appliedProgressiveDisciplinaryAction: "",
      hearingDate: "",
      performanceConsultationDate: "",
      improvementPeriod: "",
      retrenchmentReasons: [],
      affectedEmployees: "",
      jobCategories: "",
      selectionCriteria: [],
      alternativesConsidered: [],
      rejectionReasons: [],
      proposedTerminationDate: "",
      consultationFormat: "",
      consultationLocation: "",
      consultationDate: "",
      consultationTime: "",
      severanceMethod: "",
      assistanceOffered: [],
      totalEmployees: "",
      priorRetrenchments: "",
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
    setSelectedEmployeeIds([]);
    setManualEmployees([]);
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
    setEmployeePickerOpen(false);
    setDraftSelectedEmployeeIds([]);
    setEmployeeSearchQuery("");
  };

  const isEmployerStepComplete = useMemo(
    () => Boolean(formData.employerContact && formData.employerEmail),
    [formData.employerContact, formData.employerEmail],
  );

  const isEmployeeStepComplete = useMemo(
    () => selectedEmployeeIds.length > 0 || manualEmployeeCount > 0,
    [
      manualEmployeeCount,
      selectedEmployeeIds.length,
    ],
  );

  const isEmploymentStepComplete = useMemo(
    () => {
      const hasRetrenchmentReasons = formData.retrenchmentReasons.length > 0;
      const hasAffectedEmployees = Boolean(formData.affectedEmployees);
      const hasJobCategories = Boolean(formData.jobCategories);
      const hasSelectionCriteria = formData.selectionCriteria.length > 0;
      const hasAlternativesConsidered = formData.alternativesConsidered.length > 0;
      const hasProposedTerminationDate = Boolean(formData.proposedTerminationDate);
      const hasConsultationFormat = Boolean(formData.consultationFormat);
      const hasConsultationLocation = Boolean(formData.consultationLocation.trim());
      const hasConsultationDate = Boolean(formData.consultationDate);
      const hasConsultationTime = Boolean(formData.consultationTime);
      const hasAssistanceOffered = formData.assistanceOffered.length > 0;
      const hasTotalEmployees = Boolean(formData.totalEmployees);
      const hasPriorRetrenchments = Boolean(formData.priorRetrenchments);
      return Boolean(
        formData.issueDate &&
          hasRetrenchmentReasons &&
          hasAffectedEmployees &&
          hasJobCategories &&
          hasSelectionCriteria &&
          hasAlternativesConsidered &&
          hasProposedTerminationDate &&
          hasConsultationFormat &&
          hasConsultationLocation &&
          hasConsultationDate &&
          hasConsultationTime &&
          hasAssistanceOffered &&
          hasTotalEmployees &&
          hasPriorRetrenchments,
      );
    },
    [
      formData.retrenchmentReasons,
      formData.affectedEmployees,
      formData.jobCategories,
      formData.selectionCriteria,
      formData.alternativesConsidered,
      formData.proposedTerminationDate,
      formData.consultationFormat,
      formData.consultationLocation,
      formData.consultationDate,
      formData.consultationTime,
      formData.assistanceOffered,
      formData.totalEmployees,
      formData.priorRetrenchments,
      formData.issueDate,
    ],
  );

  const isFormComplete = useMemo(
    () => isEmployerStepComplete && isEmployeeStepComplete && isEmploymentStepComplete,
    [isEmployerStepComplete, isEmployeeStepComplete, isEmploymentStepComplete],
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
    }));
    setSelectedEmployeeIds([]);
    setManualEmployees([]);
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
    if (consultationTimeFocused) {
      skipConsultationTimeBlurCommitRef.current = true;
    }
    setConsultationTimeFocused(false);
    setConsultationTimeSelectOpen(false);
    setConsultationTimeFieldVersion((prev) => prev + 1);
    setFormData((prev) => ({
      ...prev,
      issuer: "",
      chairperson: "",
      noticeMethod: "",
      severancePackage: "",
      voluntaryRetrenchment: "no",
      transmissionMethods: [],
      abscondmentNoticeDate: "",
      absentFromDate: "",
      noticePeriod: "",
      noticeOfAppeal: "",
      appliedProgressiveDisciplinaryAction: "",
      hearingDate: "",
      performanceConsultationDate: "",
      improvementPeriod: "",
      retrenchmentReasons: [],
      selectionCriteria: [],
      affectedEmployees: "",
      jobCategories: "",
      alternativesConsidered: [],
      rejectionReasons: [],
      proposedTerminationDate: "",
      consultationFormat: "",
      consultationLocation: "",
      consultationDate: "",
      consultationTime: "",
      severanceMethod: "",
      assistanceOffered: [],
      totalEmployees: "",
      priorRetrenchments: "",
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

  const getSafeEditableConsultationTime = (value: string) => {
    const normalized = normalizeConsultationTimeInput(value);
    return /^\d{2}:\d{2}$/.test(normalized) ? normalized : "00:00";
  };

  const setConsultationTimeValueWithCaret = (nextValue: string, caretPosition: number) => {
    setFormData((prev) => ({ ...prev, consultationTime: nextValue }));
    requestAnimationFrame(() => {
      const input = consultationTimeInputRef.current;
      if (!input) return;
      const nextCaret = Math.max(0, Math.min(5, caretPosition));
      input.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const handleConsultationTimeEditorKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === "Escape") {
      event.currentTarget.blur();
      return;
    }

    const navigationKeys = new Set(["Tab", "ArrowLeft", "ArrowRight", "Home", "End"]);
    if (navigationKeys.has(event.key)) return;

    const value = getSafeEditableConsultationTime(formData.consultationTime);
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
      let target = start;
      if (target === 2) target = 3;
      if (target > 4) return;
      chars[target] = event.key;
      let nextCaret = target + 1;
      if (nextCaret === 2) nextCaret = 3;
      setConsultationTimeValueWithCaret(chars.join(""), nextCaret);
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      if (hasSelection) {
        clearRange(start, end);
        setConsultationTimeValueWithCaret(chars.join(""), start === 2 ? 1 : start);
        return;
      }
      let target = start - 1;
      if (start >= 3 && target < 3) return;
      if (target === 2) target = 1;
      if (target < 0) return;
      chars[target] = "0";
      setConsultationTimeValueWithCaret(chars.join(""), target);
      return;
    }

    if (event.key === "Delete") {
      event.preventDefault();
      if (hasSelection) {
        clearRange(start, end);
        setConsultationTimeValueWithCaret(chars.join(""), start);
        return;
      }
      let target = start;
      if (target === 2) target = 3;
      if (start <= 1 && target > 1) return;
      if (target > 4) return;
      chars[target] = "0";
      setConsultationTimeValueWithCaret(chars.join(""), start);
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
  };

  const handleConsultationTimeEditorPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const digits = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!digits) return;
    const value = getSafeEditableConsultationTime(formData.consultationTime);
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
    setConsultationTimeValueWithCaret(chars.join(""), nextCaret);
  };

  const openNoticeDatePicker = () => {
    const picker = noticeDatePickerRef.current;
    if (!picker) return;
    if (typeof (picker as any).showPicker === "function") {
      (picker as any).showPicker();
    } else {
      picker.click();
    }
  };

  const openProposedTerminationDatePicker = () => {
    const picker = proposedTerminationDatePickerRef.current;
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
    setDraftMisconductTypes(formData.retrenchmentReasons);
    setMisconductPickerOpen(true);
  };

  const cancelMisconductPicker = () => {
    setMisconductPickerOpen(false);
    setDraftMisconductTypes([]);
  };

  const applyMisconductPicker = () => {
    setFormData((prev) => ({
      ...prev,
      retrenchmentReasons: draftMisconductTypes,
      misconductTypes: draftMisconductTypes,
    }));
    setMisconductPickerOpen(false);
  };

  const openSelectionCriteriaPicker = () => {
    setDraftSelectionCriteria(normalizeSelectionCriteriaSelection(formData.selectionCriteria));
    setSelectionCriteriaPickerOpen(true);
  };

  const cancelSelectionCriteriaPicker = () => {
    setSelectionCriteriaPickerOpen(false);
    setDraftSelectionCriteria([]);
  };

  const applySelectionCriteriaPicker = () => {
    setFormData((prev) => ({
      ...prev,
      selectionCriteria: normalizeSelectionCriteriaSelection(draftSelectionCriteria),
    }));
    setSelectionCriteriaPickerOpen(false);
    setDraftSelectionCriteria([]);
  };

  const openAlternativesPicker = () => {
    setDraftAlternativesConsidered(normalizeAlternativesConsideredSelection(formData.alternativesConsidered));
    setAlternativesPickerOpen(true);
  };

  const cancelAlternativesPicker = () => {
    setAlternativesPickerOpen(false);
    setDraftAlternativesConsidered([]);
  };

  const applyAlternativesPicker = () => {
    const normalizedAlternatives = normalizeAlternativesConsideredSelection(draftAlternativesConsidered);
    setFormData((prev) => ({
      ...prev,
      alternativesConsidered: normalizedAlternatives,
      rejectionReasons: shouldResetRejectionReasons(normalizedAlternatives) ? [] : prev.rejectionReasons,
    }));
    setAlternativesPickerOpen(false);
    setDraftAlternativesConsidered([]);
  };

  const openRejectionReasonsPicker = () => {
    if (shouldResetRejectionReasons(formData.alternativesConsidered)) {
      toast({
        title: "Cannot open rejection reasons",
        description: "Cannot open reasons for rejection if no alternatives are considered.",
        variant: "destructive",
      });
      return;
    }
    setDraftRejectionReasons(formData.rejectionReasons);
    setRejectionReasonsPickerOpen(true);
  };

  const cancelRejectionReasonsPicker = () => {
    setRejectionReasonsPickerOpen(false);
    setDraftRejectionReasons([]);
  };

  const applyRejectionReasonsPicker = () => {
    setFormData((prev) => ({ ...prev, rejectionReasons: draftRejectionReasons }));
    setRejectionReasonsPickerOpen(false);
    setDraftRejectionReasons([]);
  };

  const openAssistanceOfferedPicker = () => {
    setDraftAssistanceOffered(normalizeAssistanceOfferedSelection(formData.assistanceOffered));
    setAssistanceOfferedPickerOpen(true);
  };

  const cancelAssistanceOfferedPicker = () => {
    setAssistanceOfferedPickerOpen(false);
    setDraftAssistanceOffered([]);
  };

  const applyAssistanceOfferedPicker = () => {
    setFormData((prev) => ({
      ...prev,
      assistanceOffered: normalizeAssistanceOfferedSelection(draftAssistanceOffered),
    }));
    setAssistanceOfferedPickerOpen(false);
    setDraftAssistanceOffered([]);
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

  const validateData = () => {
    const missingFields: string[] = [];
    const checkRequired = (value: string | undefined | null, label: string) => {
      if (!value || !value.toString().trim()) {
        missingFields.push(label);
      }
    };

    checkRequired(formData.employerContact, "Employer contact");
    checkRequired(formData.employerEmail, "Employer email");
    if (selectedEmployeeIds.length === 0 && manualEmployees.length === 0) {
      missingFields.push("At least one employee (selected or manual)");
    }
    checkRequired(formData.issueDate, "Date of notice");
    if (formData.retrenchmentReasons.length === 0) {
      missingFields.push("Retrenchment reasons");
    }
    checkRequired(formData.affectedEmployees, "Total affected");
    checkRequired(formData.jobCategories, "Category affected");
    if (formData.selectionCriteria.length === 0) {
      missingFields.push("Selection criteria");
    }
    if (formData.alternativesConsidered.length === 0) {
      missingFields.push("Alternatives considered");
    }
    checkRequired(formData.proposedTerminationDate, "Proposed retrenchment date");
    checkRequired(formData.consultationFormat, "Consultation format");
    checkRequired(
      formData.consultationLocation,
      formData.consultationFormat === "virtual" ? "Platform used" : "Consultation location",
    );
    checkRequired(formData.consultationDate, "Consultation date");
    checkRequired(formData.consultationTime, "Consultation time");
    if (formData.assistanceOffered.length === 0) {
      missingFields.push("Assistance offered");
    }
    checkRequired(formData.totalEmployees, "Total employees");
    checkRequired(formData.priorRetrenchments, "Prior retrenchments");

    if (missingFields.length) {
      throw new Error(`Please fill in the following required fields: ${missingFields.join(", ")}`);
    }

    const baseData = {
      ...formData,
      issueDate: formData.issueDate,
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
      retrenchmentReasons: formData.retrenchmentReasons,
      affectedEmployees: formData.affectedEmployees,
      jobCategories: formData.jobCategories,
      selectionCriteria: formData.selectionCriteria,
      alternativesConsidered: formData.alternativesConsidered,
      rejectionReasons: formData.rejectionReasons,
      proposedTerminationDate: formData.proposedTerminationDate,
      consultationFormat: formData.consultationFormat as ConsultationFormat,
      consultationLocation: formData.consultationLocation,
      consultationDate: formData.consultationDate,
      consultationTime: formData.consultationTime,
      severanceMethod: formData.severanceMethod,
      assistanceOffered: formData.assistanceOffered,
      totalEmployees: formData.totalEmployees,
      priorRetrenchments: formData.priorRetrenchments,
      misconductTypes: formData.retrenchmentReasons,
      chairperson: "",
      noticeMethod: "",
      severancePackage: "",
      voluntaryRetrenchment: "no",
      transmissionMethods: [],
      abscondmentNoticeDate: formData.consultationDate,
      absentFromDate: "",
      noticePeriod: "",
      noticeOfAppeal: "",
      appliedProgressiveDisciplinaryAction: "",
      hearingDate: "",
      performanceConsultationDate: "",
      improvementPeriod: "",
      homeAddressLine: "",
      homeAddressLine2: "",
      homeCity: "",
      homeProvince: "",
      homeAreaCode: "",
    } as AddendumData;

    const selectedTargets = selectedEmployeeIds
      .map((employeeId) => selectedEmployeeMap.get(employeeId))
      .filter((employee): employee is SlimEmployee => Boolean(employee))
      .map((employee) => {
        const idNumber = (employee.id_number || "").trim();
        const isIdNumber = /^\d{13}$/.test(idNumber);
        return {
          ...baseData,
          employeeId: employee.id,
          employeeName: employee.employee_name || "",
          employeeSurname: employee.employee_surname || "",
          idType: isIdNumber ? "id" : "passport",
          employeeIdNumber: isIdNumber ? idNumber : "",
          passportNumber: isIdNumber ? "" : idNumber,
          startDate: employee.start_date || baseData.startDate,
        } as AddendumData;
      });

    const manualTargets = manualEmployees.map((employee) => ({
      ...baseData,
      employeeId: "",
      employeeName: employee.employeeName,
      employeeSurname: employee.employeeSurname,
      idType: employee.idType,
      employeeIdNumber: employee.idType === "id" ? employee.employeeIdNumber : "",
      passportNumber: employee.idType === "passport" ? employee.passportNumber : "",
    })) as AddendumData[];

    const targets = [...selectedTargets, ...manualTargets];
    if (targets.length === 0) {
      throw new Error("Please add at least one employee before continuing.");
    }

    return {
      previewData: targets[0],
      targets,
    };
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
      if (LOCKED_HEADER_CLAUSE_TITLES.has(clause.title)) {
        const existingBody = Array.isArray(clause.body) ? clause.body : [clause.body];
        const lockedHeader = existingBody[0] ?? "";
        return { ...clause, title: nextTitle, body: [lockedHeader, normalizeSingleParagraphText(edited)] };
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
      setValidatedPreview(validated.previewData);
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
    const consultationDateDisplay = formatDate(data.consultationDate || "");
    const consultationTimeDisplay = formatTime(data.consultationTime || "");
    const proposedTerminationDateDisplay = formatDate(data.proposedTerminationDate || "");
    const retrenchmentReasonItems = data.retrenchmentReasons.map(formatRetrenchmentReasonItem);
    const retrenchmentReasonsDisplay = formatListWithAnd(
      retrenchmentReasonItems,
      "[reason(s) for retrenchment]",
    );
    const retrenchmentReasonsSentence =
      retrenchmentReasonItems.length <= 1
        ? `The reason for the contemplated retrenchment is ${retrenchmentReasonsDisplay}.`
        : `The reasons for the contemplated retrenchment are ${retrenchmentReasonsDisplay}.`;
    const selectionCriteriaDisplay = formatListWithAnd(
      data.selectionCriteria.map(formatSelectionCriteriaItem),
      "[selection criteria]",
    );
    const selectionCriteriaVerb = data.selectionCriteria.length > 1 ? "are" : "is";
    const alternativesConsideredDisplay = formatListWithAnd(
      data.alternativesConsidered.map(formatAlternativesConsideredItem),
      "[alternatives considered]",
    );
    const hasNoAlternativesOnlySelection =
      data.alternativesConsidered.length === 1 &&
      data.alternativesConsidered[0] === "No alternatives at this stage";
    const selectedAlternativeCount = data.alternativesConsidered.filter(
      (item) => item !== "No alternatives at this stage",
    ).length;
    const rejectionReasonCount = data.rejectionReasons.length;
    const alternativesSentence = hasNoAlternativesOnlySelection
      ? "At this stage the company has not considered any alternatives to retrenchments."
      : data.alternativesConsidered.length <= 1
        ? `The alternative we considered is ${alternativesConsideredDisplay}.`
        : `The alternatives we considered are ${alternativesConsideredDisplay}.`;
    const assistanceOfferedDisplay = formatListWithAnd(
      data.assistanceOffered,
      "[assistance offered]",
    );
    const hasNoAdditionalAssistanceOnlySelection =
      data.assistanceOffered.length === 1 &&
      data.assistanceOffered[0] === NO_ADDITIONAL_ASSISTANCE_OPTION;
    const assistanceSentence = hasNoAdditionalAssistanceOnlySelection
      ? "At this stage the company has no additional assistance to offer. However, we are open to additional suggestions presented by you or any other affected employee."
      : `The company will endeavor to further assist with ${assistanceOfferedDisplay}. However, we are open to additional suggestions presented by you or any other affected employee.`;
    const priorRetrenchmentsSentence =
      data.priorRetrenchments === "Yes"
        ? "The company has embarked on retrenhcment procedures during the preceeding twelve (12) months."
        : data.priorRetrenchments === "No"
          ? "The company has not embarked on any retrenhcment procedures during the preceeding twelve (12) months."
          : "[prior retrenchments]";
    const rejectionReasonsDisplay = data.rejectionReasons.length > 0
      ? `However, ${selectedAlternativeCount <= 1 ? "this alternative is" : "these alternatives are"} currently rejected for the following ${rejectionReasonCount <= 1 ? "reason" : "reasons"}: ${formatListWithAnd(data.rejectionReasons.map((item) => item.toLowerCase()), "[rejection reasons]")}. The company will consider additional suggestions presented by you or any of the other affected employees.`
      : "The company will consider additional suggestions presented by you or any of the other affected employees.";
    const affectedEmployeeCount = Number.parseInt((data.affectedEmployees || "").trim(), 10);
    const affectedEmployeeNoun = Number.isFinite(affectedEmployeeCount) && affectedEmployeeCount > 1
      ? "employees"
      : "employee";
    const companyNameForBody = formatCompanyDisplayName(profile?.company_name, profile?.company_type) || "[company name]";
    const salutation = "Dear Sir / Madam";

    const baseClauses: Array<Omit<ClauseDefinition, "id">> = [
      {
        title: "Paragraph 1",
        body: `We refer to the above matter and herewith regrettably inform you that ${companyNameForBody} contemplates dismissing one or more employees, based on the employer's operational requirements in terms of the LRA.`,
      },
      {
        title: "Paragraph 2",
        body: `You are hereby invited, along with other affected employees, to a consultation on ${consultationDateDisplay || "[date]"} at ${consultationTimeDisplay || "[time]"} ${
          data.consultationFormat === "virtual"
            ? `to be held virtually via ${data.consultationLocation.trim() || "[platform]"}`
            : `to be held at ${data.consultationLocation.trim() || "[location]"}`
        }, in an attempt to reach consensus regarding appropriate measures to avoid dismissals, minimize the number of dismissals, change the timing of dismissals, and mitigate the adverse effects of dismissal.`,
      },
      {
        title: "Paragraph 3",
        body: "During this consultation process further items/issues, as listed in seciton 189(3) of the LRA, will be discussed in more detail and are listed hereunder for your reference:",
      },
      {
        title: "Paragraph 4",
        body: [
          "1. Reason for retrenchment",
          retrenchmentReasonsSentence,
        ],
      },
      {
        title: "Paragraph 5",
        body: [
          "2. Alternatives considered",
          `${alternativesSentence}${rejectionReasonsDisplay ? ` ${rejectionReasonsDisplay}` : ""}`,
        ],
      },
      {
        title: "Paragraph 6",
        body: [
          "3. Number of employees considered for retrenchment",
          `The company contemplates to retrench a total of ${data.affectedEmployees || "[total affected]"} ${affectedEmployeeNoun} from ${data.jobCategories || "[category affected]"}.`,
        ],
      },
      {
        title: "Paragraph 7",
        body: [
          "4. Method of selection",
          `The selection criteria considered ${selectionCriteriaVerb} ${selectionCriteriaDisplay}.`,
        ],
      },
      {
        title: "Paragraph 8",
        body: [
          "5. Timing of retrenchment",
          `The employer aims to complete the process by ${proposedTerminationDateDisplay || "[proposed retrenchment date]"}.`,
        ],
      },
      {
        title: "Paragraph 9",
        body: [
          "6. Severance pay",
          `You will be entitled to 1 week's remuneration for every completed year of service with ${companyNameForBody} in terms of the Basic Conditions of Employment Act. Alternatively, your severance package calculation will be subject to any applicable bargaining council's collective agreement provisions.`,
        ],
      },
      {
        title: "Paragraph 10",
        body: [
          "7. Further assistance by employer",
          assistanceSentence,
        ],
      },
      {
        title: "Paragraph 11",
        body: [
          "8. Future re-employment",
          "Should you be selected for retrenhcment and your position becomes available wihtin the following nine (9) months, you may be contacted to apply for this position. It is your responsibility to ensure that the company is in possession of your current contanct details during this period. All applicants applying for that position will be assessed equaly.",
        ],
      },
      {
        title: "Paragraph 12",
        body: [
          "9. Total employees at employer",
          `There are currently ${data.totalEmployees || "[total employees]"} employees employed at ${companyNameForBody}.`,
        ],
      },
      {
        title: "Paragraph 13",
        body: [
          "10. Total retrenchments in the preceding 12 months",
          priorRetrenchmentsSentence,
        ],
      },
      {
        title: "Paragraph 14",
        body: "You are hereby informed that you may make verbal or written representations during this consultation, or alternatively you may make submissions within 48 hours from conclusion of the consultation.",
      },
      {
        title: "Paragraph 15",
        body: "We trust that an amicable solution/outcome can be reached during the above consultation.",
      },
    ];

    const clauses = mergeClauses(withClauseIds(baseClauses));
    const clausesWithEdits = applyClauseEdits(clauses);

    const companyAddressLines = (profile?.physical_address || "Address")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
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

    const drawPageNumbers = () => {
      const totalPages = doc.getNumberOfPages();
      const pageLabelY = useCenteredLogoLayout
        ? (pageHeight - centeredFooterBottomGap - centeredFooterHeight + 3.5)
        : pageHeight - 8;
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        doc.setPage(pageNumber);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - margin, pageLabelY, { align: "right" });
      }
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
    doc.text("AFFECTED EMPLOYEE", margin + 14, y);
    y += 5;
    doc.text(valueOrLine(formatCompanyDisplayName(profile?.company_name, profile?.company_type)).toUpperCase(), margin + 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
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
    const subjectText = "RE: NOTICE OF CONTEMPLATED RETRENCHMENT";
    doc.text(subjectText, margin, y);
    const subjectWidth = doc.getTextWidth(subjectText);
    doc.line(margin, y + 1, margin + subjectWidth + 1, y + 1);
    y += 10;

    doc.setFont("helvetica", "normal");
    clausesWithEdits.forEach((clause) => {
      const paragraphs = Array.isArray(clause.body) ? clause.body : [clause.body];
      const hasItemHeader = LOCKED_HEADER_CLAUSE_TITLES.has(clause.title);
      const headerLineMatch = hasItemHeader ? paragraphs[0]?.match(/^(\d+\.)\s*(.*)$/) : null;
      const headerNumberPrefix = headerLineMatch?.[1] ?? "";
      const headerLabelText = headerLineMatch?.[2] ?? (paragraphs[0] ?? "");
      const itemHeaderNumberSlotWidth = doc.getTextWidth("10.");
      const itemHeaderGapWidth = doc.getTextWidth("   ");
      const itemHeaderTextOffset = itemHeaderNumberSlotWidth + itemHeaderGapWidth;
      const itemBodyIndent = hasItemHeader ? itemHeaderTextOffset : 0;
      paragraphs.forEach((paragraph, paragraphIndex) => {
        const isHeaderLine = hasItemHeader && paragraphIndex === 0;
        const paragraphX = hasItemHeader && paragraphIndex > 0 ? margin + itemBodyIndent : margin;
        const paragraphWidth = hasItemHeader && paragraphIndex > 0 ? contentWidth - itemBodyIndent : contentWidth;
        doc.setFont("helvetica", isHeaderLine ? "bold" : "normal");
        if (isHeaderLine && headerNumberPrefix) {
          const lineHeight = 5.5;
          const headerLines = doc.splitTextToSize(headerLabelText, contentWidth - itemHeaderTextOffset);
          ensureSpace(headerLines.length * lineHeight + 1);
          doc.text(headerNumberPrefix, margin, y);
          headerLines.forEach((line, idx) => {
            doc.text(line, margin + itemHeaderTextOffset, y + idx * lineHeight);
          });
          y += headerLines.length * lineHeight;
          y += 2.5;
          return;
        }
        drawWrapped(paragraph, paragraphX, paragraphWidth);
        y += isHeaderLine ? 2.5 : 4.5;
      });
    });
    doc.setFont("helvetica", "normal");

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
    const ackLead = `I, ${underlinedSegment}, hereby acknowledge that I received this notice and confirm that the content hereof was explained to me.`;
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

    if (useCenteredLogoLayout) {
      const totalPages = doc.getNumberOfPages();
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        drawCenteredFooter(pageNumber);
      }
      doc.setPage(totalPages);
    }

    drawPageNumbers();

    if (download) {
      doc.save(`Contemplated_Retrenchment_Notice_${data.employeeSurname || "employee"}_${data.startDate}.pdf`);
      toast({
        title: "Download ready",
        description: "Contemplated retrenchment notice has been generated.",
      });
      return doc;
    }

    return doc;
  };

  async function handleDownload() {
    try {
      setIsGenerating(true);
      const validated = validateData();
      const { targets } = validated;
      if (targets.length === 1) {
        generatePDF(targets[0], true);
        return;
      }
      const zip = new JSZip();
      targets.forEach((target) => {
        const doc = generatePDF(target, false);
        const arrayBuffer = doc.output("arraybuffer");
        const safeName = makeSafeFileToken(`${target.employeeSurname || "employee"}_${target.startDate || target.issueDate}`);
        zip.file(`Contemplated_Retrenchment_Notice_${safeName}.pdf`, arrayBuffer);
      });
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Contemplated_Retrenchment_Notices.zip";
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Download ready",
        description: `${targets.length} notice${targets.length === 1 ? "" : "s"} downloaded as zip.`,
      });
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
      const validated = validateData();
      setValidatedPreview(validated.previewData);
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
                !embedded && "flex-1 min-h-0 overflow-hidden",
                useExternalShell && showFinalActions && "p-0 h-full min-h-0 flex flex-col overflow-hidden",
              )}
            >
              <div
                className={cn(
                  activeStep === 2 ? "space-y-0" : "space-y-4",
                  useExternalShell && showFinalActions && "min-h-0 flex-1 overflow-y-auto pr-1",
                )}
              >
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
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="employee" className={modalFieldLabelClass}>Select employee(s) (optional)</Label>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={openAddEmployeeDialog}
                          className="h-[28px] rounded border-blue-600 px-3 text-xs text-blue-600 hover:bg-blue-600 hover:text-white"
                        >
                          <Plus className="mr-0.5 h-3.5 w-3.5" />
                          Add custom
                        </Button>
                      </div>
                      <button
                        id="employee"
                        type="button"
                        onClick={openEmployeePicker}
                        className={`${baseModalFieldClass} !h-[34px] !border-[1.75px] ${selectedEmployeeIds.length > 0 ? "!border-emerald-500" : "!border-slate-300"} w-full px-3 text-left`}
                      >
                        <span
                          className={cn(
                            "block truncate text-[11px]",
                            selectedEmployeeIds.length > 0 ? "text-slate-900" : "text-slate-400 font-normal",
                          )}
                        >
                          {selectedEmployeeIds.length > 0
                            ? `${selectedEmployeeIds.length} employee(s) selected`
                            : "Select from saved employees"}
                        </span>
                      </button>
                    </div>
                    {selectedEmployees.length > 0 || manualEmployees.length > 0 ? (
                      <div className="max-h-[45dvh] overflow-y-auto pr-1">
                        <div className="flex flex-wrap gap-2 pt-1">
                          {selectedEmployees.map((employee) => {
                            const idNumber = (employee.id_number || "").trim();
                            return (
                              <Badge
                                key={employee.id}
                                variant="outline"
                                className="flex items-center gap-1 border-blue-300 bg-blue-50 text-[10px] text-blue-700 !font-normal hover:bg-blue-50"
                              >
                                <span>
                                  {employee.employee_name} {employee.employee_surname}
                                  {idNumber ? ` (${idNumber})` : ""}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedEmployeeIds((prev) => prev.filter((id) => id !== employee.id))}
                                  className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm text-blue-700 hover:bg-blue-100"
                                  aria-label={`Remove ${employee.employee_name} ${employee.employee_surname}`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            );
                          })}
                          {manualEmployees.map((employee) => {
                            const idNumber = employee.idType === "id" ? employee.employeeIdNumber : employee.passportNumber;
                            return (
                              <Badge
                                key={employee.id}
                                variant="outline"
                                className="flex items-center gap-1 border-blue-300 bg-blue-50 text-[10px] text-blue-700 !font-normal hover:bg-blue-50"
                              >
                                {employee.employeeName} {employee.employeeSurname} ({idNumber})
                                <button
                                  type="button"
                                  onClick={() => setManualEmployees((prev) => prev.filter((row) => row.id !== employee.id))}
                                  className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm text-blue-700 hover:bg-blue-100"
                                  aria-label={`Remove ${employee.employeeName} ${employee.employeeSurname}`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {activeStep === 2 && (
                <div className="space-y-3 h-[72vh] overflow-y-auto overscroll-none pr-1">
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="issueDate" className={modalFieldLabelClass}>
                        Notice date <span className="text-red-500">*</span>
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
                          className={`${getAddendumModalInputClass(formData.issueDate.trim().length > 0)} flex-1 cursor-pointer placeholder:!text-[11px] placeholder:!font-normal placeholder:!text-slate-400`}
                        />
                        <input
                          ref={noticeDatePickerRef}
                          type="date"
                          value={formData.issueDate}
                          onChange={(e) => setFormData((prev) => ({ ...prev, issueDate: e.target.value }))}
                          className="sr-only"
                          aria-hidden="true"
                          tabIndex={-1}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="consultationDate" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Consultation date <span className="text-red-500">*</span>
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" aria-label="Consultation date info" className="text-slate-400 hover:text-blue-600">
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className={fixedTooltipContentClass}>
                              This is the date on which the first consultation with the affected employees will be held.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <div className="flex items-start gap-2">
                        <Input
                          id="consultationDate"
                          type="text"
                          readOnly
                          placeholder="Please select a date"
                          value={formData.consultationDate ? toDisplayDate(formData.consultationDate) : ""}
                          onClick={openConsultationDatePicker}
                          onFocus={openConsultationDatePicker}
                          className={`${getAddendumModalInputClass(formData.consultationDate.trim().length > 0)} flex-1 cursor-pointer placeholder:!text-[11px] placeholder:!font-normal placeholder:!text-slate-400`}
                        />
                        <input
                          ref={consultationDatePickerRef}
                          type="date"
                          value={formData.consultationDate}
                          onChange={(e) => setFormData((prev) => ({ ...prev, consultationDate: e.target.value }))}
                          className="sr-only"
                          aria-hidden="true"
                          tabIndex={-1}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="consultationTime" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Consultation time <span className="text-red-500">*</span>
                      </Label>
                      <div key={consultationTimeFieldVersion} className="relative">
                        <Select
                          open={consultationTimeFocused ? false : consultationTimeSelectOpen}
                          onOpenChange={setConsultationTimeSelectOpen}
                          value={formData.consultationTime}
                          onValueChange={(value) => {
                            setConsultationTimeFocused(false);
                            setConsultationTimeSelectOpen(false);
                            setFormData((prev) => ({ ...prev, consultationTime: value }));
                          }}
                        >
                          <SelectTrigger
                            id="consultationTime"
                            className={`${getAddendumModalSelectTriggerClass(Boolean(formData.consultationTime.trim()) && !consultationTimeFocused)} ${addendumModalDropdownToneClass}`}
                          >
                            {formData.consultationTime.trim().length > 0 ? (
                              <span
                                className="block flex-1 truncate text-left text-[11px] font-medium text-slate-900 cursor-text"
                                onPointerDown={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setConsultationTimeSelectOpen(false);
                                  setConsultationTimeFocused(true);
                                }}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setConsultationTimeSelectOpen(false);
                                  setConsultationTimeFocused(true);
                                }}
                              >
                                {formatTime(formData.consultationTime)}
                              </span>
                            ) : (
                              <SelectValue placeholder="Select consultation time" />
                            )}
                          </SelectTrigger>
                          <SelectContent hideScrollButtons className={addendumModalSelectContentClass}>
                            {consultationTimeOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value} className={addendumModalSelectItemClass}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {consultationTimeFocused ? (
                          <div className="absolute inset-0 z-20">
                            <Input
                              ref={consultationTimeInputRef}
                              type="text"
                              inputMode="numeric"
                              autoFocus
                              value={formData.consultationTime}
                              onChange={() => undefined}
                              onBlur={(e) => {
                                setConsultationTimeFocused(false);
                                if (skipConsultationTimeBlurCommitRef.current) {
                                  skipConsultationTimeBlurCommitRef.current = false;
                                  return;
                                }
                                setFormData((prev) => ({
                                  ...prev,
                                  consultationTime: normalizeConsultationTimeInput(e.target.value),
                                }));
                              }}
                              onKeyDown={handleConsultationTimeEditorKeyDown}
                              onPaste={handleConsultationTimeEditorPaste}
                              className={`h-[34px] pr-11 ${getAddendumModalInputClass(Boolean(formData.consultationTime.trim()))}`}
                            />
                            {getTimeMeridiem(formData.consultationTime) ? (
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-500">
                                {getTimeMeridiem(formData.consultationTime)}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="consultationFormat" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Consultation format <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={formData.consultationFormat || undefined}
                        onValueChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            consultationFormat: value as ConsultationFormat,
                            consultationLocation: "",
                          }))
                        }
                      >
                        <SelectTrigger
                          id="consultationFormat"
                          className={`${getAddendumModalSelectTriggerClass(Boolean(formData.consultationFormat))} ${addendumModalDropdownToneClass}`}
                        >
                          <SelectValue placeholder="Select consultation format" />
                        </SelectTrigger>
                        <SelectContent className={addendumModalSelectContentClass}>
                          {CONSULTATION_FORMAT_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value} className={addendumModalSelectItemClass}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.consultationFormat ? (
                      <div className="space-y-1.5 md:col-span-2">
                        <Label htmlFor="consultationLocation" className={modalFieldLabelClass}>
                          {formData.consultationFormat === "virtual" ? "Platform used" : "Consultation location"}{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="consultationLocation"
                          type="text"
                          value={formData.consultationLocation}
                          onChange={(e) => setFormData((prev) => ({ ...prev, consultationLocation: e.target.value }))}
                          placeholder={
                            formData.consultationFormat === "virtual"
                              ? "Insert link or platform details (e.g. Microsoft Teams, Zoom)"
                              : "Insert physical address or venue"
                          }
                          className={getAddendumModalInputClass(Boolean(formData.consultationLocation.trim()))}
                        />
                      </div>
                    ) : null}
                    <div className="space-y-1.5">
                      <Label htmlFor="retrenchmentReasons" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Retrenchment reasons <span className="text-red-500">*</span>
                      </Label>
                      <button
                        id="retrenchmentReasons"
                        type="button"
                        onClick={openMisconductPicker}
                        className={`${baseModalFieldClass} !h-[34px] !border-[1.75px] ${formData.retrenchmentReasons.length > 0 ? "!border-emerald-500" : "!border-slate-300"} w-full px-3 text-left`}
                      >
                        <span
                          className={cn(
                            "block truncate text-[11px]",
                            formData.retrenchmentReasons.length > 0 ? "text-slate-900" : "text-slate-400 font-normal",
                          )}
                        >
                          {formData.retrenchmentReasons.length > 0
                            ? `${formData.retrenchmentReasons.length} reason(s) selected`
                            : "Select retrenchment reason(s)"}
                        </span>
                      </button>
                      {formData.retrenchmentReasons.length > 0 ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {formData.retrenchmentReasons.map((reason) => (
                            <Badge
                              key={reason}
                              variant="outline"
                              className="gap-1 border-blue-300 bg-blue-50 text-[10px] text-blue-700 !font-normal hover:bg-blue-50"
                            >
                              {reason}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="alternativesConsidered" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Alternatives considered <span className="text-red-500">*</span>
                      </Label>
                      <button
                        id="alternativesConsidered"
                        type="button"
                        onClick={openAlternativesPicker}
                        className={`${baseModalFieldClass} !h-[34px] !border-[1.75px] ${formData.alternativesConsidered.length > 0 ? "!border-emerald-500" : "!border-slate-300"} w-full px-3 text-left`}
                      >
                        <span
                          className={cn(
                            "block truncate text-[11px]",
                            formData.alternativesConsidered.length > 0 ? "text-slate-900" : "text-slate-400 font-normal",
                          )}
                        >
                          {formData.alternativesConsidered.length > 0
                            ? `${formData.alternativesConsidered.length} alternative(s) selected`
                            : "Select alternatives considered"}
                        </span>
                      </button>
                      {formData.alternativesConsidered.length > 0 ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {formData.alternativesConsidered.map((alternative) => (
                            <Badge
                              key={alternative}
                              variant="outline"
                              className="gap-1 border-blue-300 bg-blue-50 text-[10px] text-blue-700 !font-normal hover:bg-blue-50"
                            >
                              {alternative}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="rejectionReasons" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Rejection reasons (optional)
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" aria-label="Rejection reasons info" className="text-slate-400 hover:text-blue-600">
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className={fixedTooltipContentClass}>
                              It is not mandatory to select any rejection reasons at this stage.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <button
                        id="rejectionReasons"
                        type="button"
                        onClick={openRejectionReasonsPicker}
                        className={`${baseModalFieldClass} !h-[34px] !border-[1.75px] ${formData.rejectionReasons.length > 0 ? "!border-emerald-500" : "!border-slate-300"} w-full px-3 text-left`}
                      >
                        <span
                          className={cn(
                            "block truncate text-[11px]",
                            formData.rejectionReasons.length > 0 ? "text-slate-900" : "text-slate-400 font-normal",
                          )}
                        >
                          {formData.rejectionReasons.length > 0
                            ? `${formData.rejectionReasons.length} reason(s) selected`
                            : "Select rejection reason(s)"}
                        </span>
                      </button>
                      {formData.rejectionReasons.length > 0 ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {formData.rejectionReasons.map((reason) => (
                            <Badge
                              key={reason}
                              variant="outline"
                              className="gap-1 border-blue-300 bg-blue-50 text-[10px] text-blue-700 !font-normal hover:bg-blue-50"
                            >
                              {reason}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="affectedEmployees" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Total affected <span className="text-red-500">*</span>
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" aria-label="Total affected info" className="text-slate-400 hover:text-blue-600">
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className={fixedTooltipContentClass}>
                              This is the total number of employees you intend to retrench.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <Input
                        id="affectedEmployees"
                        inputMode="numeric"
                        placeholder="Insert total number of affected employees"
                        value={formData.affectedEmployees}
                        onChange={(e) => setFormData((prev) => ({ ...prev, affectedEmployees: e.target.value.replace(/\D/g, "") }))}
                        className={getAddendumModalInputClass(formData.affectedEmployees.trim().length > 0)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="jobCategories" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Category affected <span className="text-red-500">*</span>
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" aria-label="Category affected info" className="text-slate-400 hover:text-blue-600">
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className={fixedTooltipContentClass}>
                              This is the position category (cashiers, mechanics, etc.) or specific department(s) from which employees are selected for retrenchment.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <Input
                        id="jobCategories"
                        placeholder="List the position(s) or department(s) affected"
                        value={formData.jobCategories}
                        onChange={(e) => setFormData((prev) => ({ ...prev, jobCategories: e.target.value }))}
                        className={getAddendumModalInputClass(formData.jobCategories.trim().length > 0)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="selectionCriteria" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Selection criteria <span className="text-red-500">*</span>
                      </Label>
                      <button
                        id="selectionCriteria"
                        type="button"
                        onClick={openSelectionCriteriaPicker}
                        className={`${baseModalFieldClass} !h-[34px] !border-[1.75px] ${formData.selectionCriteria.length > 0 ? "!border-emerald-500" : "!border-slate-300"} w-full px-3 text-left`}
                      >
                        <span
                          className={cn(
                            "block truncate text-[11px]",
                            formData.selectionCriteria.length > 0 ? "text-slate-900" : "text-slate-400 font-normal",
                          )}
                        >
                          {formData.selectionCriteria.length > 0
                            ? `${formData.selectionCriteria.length} criteria selected`
                            : "Select selection criteria"}
                        </span>
                      </button>
                      {formData.selectionCriteria.length > 0 ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {formData.selectionCriteria.map((criteria) => (
                            <Badge
                              key={criteria}
                              variant="outline"
                              className="gap-1 border-blue-300 bg-blue-50 text-[10px] text-blue-700 !font-normal hover:bg-blue-50"
                            >
                              {criteria}
                            </Badge>
                          ))}
                        </div>
                        ) : null}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="proposedTerminationDate" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Proposed retrenchment date <span className="text-red-500">*</span>
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" aria-label="Proposed retrenchment date info" className="text-slate-400 hover:text-blue-600">
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className={fixedTooltipContentClass}>
                              This is the date that you intend to have completed the contemplated retrenchment consultation procedure.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <div className="flex items-start gap-2">
                        <Input
                          id="proposedTerminationDate"
                          type="text"
                          readOnly
                          placeholder="Please select a date"
                          value={formData.proposedTerminationDate ? toDisplayDate(formData.proposedTerminationDate) : ""}
                          onClick={openProposedTerminationDatePicker}
                          onFocus={openProposedTerminationDatePicker}
                          className={`${getAddendumModalInputClass(formData.proposedTerminationDate.trim().length > 0)} flex-1 cursor-pointer placeholder:!text-[11px] placeholder:!font-normal placeholder:!text-slate-400`}
                        />
                        <input
                          ref={proposedTerminationDatePickerRef}
                          type="date"
                          value={formData.proposedTerminationDate}
                          onChange={(e) => setFormData((prev) => ({ ...prev, proposedTerminationDate: e.target.value }))}
                          className="sr-only"
                          aria-hidden="true"
                          tabIndex={-1}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="assistanceOffered" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Assistance offered <span className="text-red-500">*</span>
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" aria-label="Assistance offered info" className="text-slate-400 hover:text-blue-600">
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className={fixedTooltipContentClass}>
                              It is not compulsory that an employer provide assistance. However, you may provide any of the listed options.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <button
                        id="assistanceOffered"
                        type="button"
                        onClick={openAssistanceOfferedPicker}
                        className={`${baseModalFieldClass} !h-[34px] !border-[1.75px] ${formData.assistanceOffered.length > 0 ? "!border-emerald-500" : "!border-slate-300"} w-full px-3 text-left`}
                      >
                        <span
                          className={cn(
                            "block truncate text-[11px]",
                            formData.assistanceOffered.length > 0 ? "text-slate-900" : "text-slate-400 font-normal",
                          )}
                        >
                          {formData.assistanceOffered.length > 0
                            ? `${formData.assistanceOffered.length} option(s) selected`
                            : "Select assistance offered"}
                        </span>
                      </button>
                      {formData.assistanceOffered.length > 0 ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {formData.assistanceOffered.map((option) => (
                            <Badge
                              key={option}
                              variant="outline"
                              className="gap-1 border-blue-300 bg-blue-50 text-[10px] text-blue-700 !font-normal hover:bg-blue-50"
                            >
                              {option}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="totalEmployees" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Total employees <span className="text-red-500">*</span>
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" aria-label="Total employees info" className="text-slate-400 hover:text-blue-600">
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className={fixedTooltipContentClass}>
                              This is the total number of employees currently in your employment.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <Input
                        id="totalEmployees"
                        placeholder="Insert total number of employees"
                        value={formData.totalEmployees}
                        onChange={(e) => setFormData((prev) => ({ ...prev, totalEmployees: e.target.value.replace(/\D/g, "") }))}
                        className={`${getAddendumModalInputClass(formData.totalEmployees.trim().length > 0)} placeholder:!text-[11px] placeholder:!font-normal placeholder:!text-slate-400`}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="priorRetrenchments" className={`${modalFieldLabelClass} inline-flex items-center gap-1`}>
                        Prior retrenchments <span className="text-red-500">*</span>
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" aria-label="Prior retrenchments info" className="text-slate-400 hover:text-blue-600">
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className={fixedTooltipContentClass}>
                              Has anyone been retrenched within the preceding 12 months from the date of this notice?
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <Select
                        value={formData.priorRetrenchments}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, priorRetrenchments: value }))}
                      >
                        <SelectTrigger
                          className={`${getAddendumModalSelectTriggerClass(Boolean(formData.priorRetrenchments))} ${addendumModalDropdownToneClass}`}
                        >
                          <SelectValue placeholder="Select prior retrenchments" />
                        </SelectTrigger>
                        <SelectContent className={addendumModalSelectContentClass}>
                          {priorRetrenchmentsOptions.map((option) => (
                            <SelectItem key={option} value={option} className={addendumModalSelectItemClass}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
              const consultationDateDisplay = formatDate(validatedPreview.consultationDate || "");
              const consultationTimeDisplay = formatTime(validatedPreview.consultationTime || "");
              const proposedTerminationDateDisplay = formatDate(validatedPreview.proposedTerminationDate || "");
              const retrenchmentReasonItems = validatedPreview.retrenchmentReasons.map(formatRetrenchmentReasonItem);
              const retrenchmentReasonsDisplay = formatListWithAnd(
                retrenchmentReasonItems,
                "[reason(s) for retrenchment]",
              );
              const retrenchmentReasonsSentence =
                retrenchmentReasonItems.length <= 1
                  ? `The reason for the contemplated retrenchment is ${retrenchmentReasonsDisplay}.`
                  : `The reasons for the contemplated retrenchment are ${retrenchmentReasonsDisplay}.`;
              const selectionCriteriaDisplay = formatListWithAnd(
                validatedPreview.selectionCriteria.map(formatSelectionCriteriaItem),
                "[selection criteria]",
              );
              const selectionCriteriaVerb = validatedPreview.selectionCriteria.length > 1 ? "are" : "is";
              const alternativesConsideredDisplay = formatListWithAnd(
                validatedPreview.alternativesConsidered.map(formatAlternativesConsideredItem),
                "[alternatives considered]",
              );
              const hasNoAlternativesOnlySelection =
                validatedPreview.alternativesConsidered.length === 1 &&
                validatedPreview.alternativesConsidered[0] === "No alternatives at this stage";
              const selectedAlternativeCount = validatedPreview.alternativesConsidered.filter(
                (item) => item !== "No alternatives at this stage",
              ).length;
              const rejectionReasonCount = validatedPreview.rejectionReasons.length;
              const alternativesSentence = hasNoAlternativesOnlySelection
                ? "At this stage the company has not considered any alternatives to retrenchments."
                : validatedPreview.alternativesConsidered.length <= 1
                  ? `The alternative we considered is ${alternativesConsideredDisplay}.`
                  : `The alternatives we considered are ${alternativesConsideredDisplay}.`;
              const assistanceOfferedDisplay = formatListWithAnd(
                validatedPreview.assistanceOffered,
                "[assistance offered]",
              );
              const hasNoAdditionalAssistanceOnlySelection =
                validatedPreview.assistanceOffered.length === 1 &&
                validatedPreview.assistanceOffered[0] === NO_ADDITIONAL_ASSISTANCE_OPTION;
              const assistanceSentence = hasNoAdditionalAssistanceOnlySelection
                ? "At this stage the company has no additional assistance to offer. However, we are open to additional suggestions presented by you or any other affected employee."
                : `The company will endeavor to further assist with ${assistanceOfferedDisplay}. However, we are open to additional suggestions presented by you or any other affected employee.`;
              const priorRetrenchmentsSentence =
                validatedPreview.priorRetrenchments === "Yes"
                  ? "The company has embarked on retrenhcment procedures during the preceeding twelve (12) months."
                  : validatedPreview.priorRetrenchments === "No"
                    ? "The company has not embarked on any retrenhcment procedures during the preceeding twelve (12) months."
                    : "[prior retrenchments]";
              const rejectionReasonsDisplay = validatedPreview.rejectionReasons.length > 0
                ? `However, ${selectedAlternativeCount <= 1 ? "this alternative is" : "these alternatives are"} currently rejected for the following ${rejectionReasonCount <= 1 ? "reason" : "reasons"}: ${formatListWithAnd(validatedPreview.rejectionReasons.map((item) => item.toLowerCase()), "[rejection reasons]")}. The company will consider additional suggestions presented by you or any of the other affected employees.`
                : "The company will consider additional suggestions presented by you or any of the other affected employees.";
              const affectedEmployeeCount = Number.parseInt((validatedPreview.affectedEmployees || "").trim(), 10);
              const affectedEmployeeNoun = Number.isFinite(affectedEmployeeCount) && affectedEmployeeCount > 1
                ? "employees"
                : "employee";
              const companyNameForBody = formatCompanyDisplayName(profile?.company_name, profile?.company_type) || "[company name]";
              const baseClauses: Array<Omit<ClauseDefinition, "id">> = [
                {
                  title: "Paragraph 1",
                  body: `We refer to the above matter and herewith regrettably inform you that ${companyNameForBody} contemplates dismissing one or more employees, based on the employer's operational requirements in terms of the LRA.`,
                },
                {
                  title: "Paragraph 2",
                  body: `You are hereby invited, along with other affected employees, to a consultation on ${consultationDateDisplay || "[date]"} at ${consultationTimeDisplay || "[time]"} ${
                    validatedPreview.consultationFormat === "virtual"
                      ? `to be held virtually via ${validatedPreview.consultationLocation.trim() || "[platform]"}`
                      : `to be held at ${validatedPreview.consultationLocation.trim() || "[location]"}`
                  }, in an attempt to reach consensus regarding appropriate measures to avoid dismissals, minimize the number of dismissals, change the timing of dismissals, and mitigate the adverse effects of dismissal.`,
                },
                {
                  title: "Paragraph 3",
                  body: "During this consultation process further items/issues, as listed in seciton 189(3) of the LRA, will be discussed in more detail and are listed hereunder for your reference:",
                },
                {
                  title: "Paragraph 4",
                  body: [
                    "1. Reason for retrenchment",
                    retrenchmentReasonsSentence,
                  ],
                },
                {
                  title: "Paragraph 5",
                  body: [
                    "2. Alternatives considered",
                    `${alternativesSentence}${rejectionReasonsDisplay ? ` ${rejectionReasonsDisplay}` : ""}`,
                  ],
                },
                {
                  title: "Paragraph 6",
                  body: [
                    "3. Number of employees considered for retrenchment",
                    `The company contemplates to retrench a total of ${validatedPreview.affectedEmployees || "[total affected]"} ${affectedEmployeeNoun} from ${validatedPreview.jobCategories || "[category affected]"}.`,
                  ],
                },
                {
                  title: "Paragraph 7",
                  body: [
                    "4. Method of selection",
                    `The selection criteria considered ${selectionCriteriaVerb} ${selectionCriteriaDisplay}.`,
                  ],
                },
                {
                  title: "Paragraph 8",
                  body: [
                    "5. Timing of retrenchment",
                    `The employer aims to complete the process by ${proposedTerminationDateDisplay || "[proposed retrenchment date]"}.`,
                  ],
                },
                {
                  title: "Paragraph 9",
                  body: [
                    "6. Severance pay",
                    `You will be entitled to 1 week's remuneration for every completed year of service with ${companyNameForBody} in terms of the Basic Conditions of Employment Act. Alternatively, your severance package calculation will be subject to any applicable bargaining council's collective agreement provisions.`,
                  ],
                },
                {
                  title: "Paragraph 10",
                  body: [
                    "7. Further assistance by employer",
                    assistanceSentence,
                  ],
                },
                {
                  title: "Paragraph 11",
                  body: [
                    "8. Future re-employment",
                    "Should you be selected for retrenhcment and your position becomes available wihtin the following nine (9) months, you may be contacted to apply for this position. It is your responsibility to ensure that the company is in possession of your current contanct details during this period. All applicants applying for that position will be assessed equaly.",
                  ],
                },
                {
                  title: "Paragraph 12",
                  body: [
                    "9. Total employees at employer",
                    `There are currently ${validatedPreview.totalEmployees || "[total employees]"} employees employed at ${companyNameForBody}.`,
                  ],
                },
                {
                  title: "Paragraph 13",
                  body: [
                    "10. Total retrenchments in the preceding 12 months",
                    priorRetrenchmentsSentence,
                  ],
                },
                {
                  title: "Paragraph 14",
                  body: "You are hereby informed that you may make verbal or written representations during this consultation, or alternatively you may make submissions within 48 hours from conclusion of the consultation.",
                },
                {
                  title: "Paragraph 15",
                  body: "We trust that an amicable solution/outcome can be reached during the above consultation.",
                },
              ];

    const clauses: ClauseDefinition[] = mergeClauses(withClauseIds(baseClauses));

              const clausesWithEdits = applyClauseEdits(clauses);

              const startEditingClause = (clause: ClauseDefinition) => {
                rememberPreviewScroll();
                const isCustomClause = customClauses.some((custom) => custom.id === clause.id);
                const hasLockedHeader = LOCKED_HEADER_CLAUSE_TITLES.has(clause.title);
                const existingBody = Array.isArray(clause.body) ? clause.body : [clause.body];
                const defaultEditableText = hasLockedHeader
                  ? existingBody.slice(1).join("\n\n")
                  : serializeClauseBody(clause.body);
                setEditingClause(clause.id);
                setClauseDraft(stripParagraphBreaks(clauseEdits[clause.id] ?? defaultEditableText));
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
                              const hasItemHeader = LOCKED_HEADER_CLAUSE_TITLES.has(clause.title);
                              const headerLineMatch = hasItemHeader ? paragraphs[0]?.match(/^(\d+\.)\s*(.*)$/) : null;
                              const headerNumberPrefix = headerLineMatch?.[1] ?? "";
                              const itemHeaderTextOffsetPx = 32;
                              const headerTextIndentStyle = hasItemHeader
                                ? { paddingLeft: `${itemHeaderTextOffsetPx}px` }
                                : undefined;
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

                                  <div className={cn(hasItemHeader ? "space-y-1.5" : "space-y-4")}>
                                    {paragraphs.map((text, paragraphIndex) => {
                                      const isHeaderLine = hasItemHeader && paragraphIndex === 0;
                                      const headerLabelText = isHeaderLine && headerLineMatch ? headerLineMatch[2] : text;
                                      return (
                                        <p
                                          key={`${clause.id}-${paragraphIndex}`}
                                          className={cn(
                                            "whitespace-pre-line text-black",
                                            isHeaderLine
                                              ? "font-bold text-left mb-0.5"
                                              : "text-justify",
                                          )}
                                          style={!isHeaderLine && hasItemHeader ? headerTextIndentStyle : undefined}
                                        >
                                          {isHeaderLine && headerNumberPrefix ? (
                                            <>
                                              <span className="inline-block" style={{ width: `${itemHeaderTextOffsetPx}px` }}>
                                                {headerNumberPrefix}
                                              </span>
                                              <span>{headerLabelText}</span>
                                            </>
                                          ) : (
                                            text
                                          )}
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
                <p className="text-sm text-muted-foreground">Complete the form to preview the notice.</p>
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

      <Dialog open={employeePickerOpen} onOpenChange={(open) => (open ? openEmployeePicker() : cancelEmployeePicker())}>
        <DialogContent className="w-[94vw] max-w-[720px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-white [&>button]:hidden">
          <div className="flex items-center justify-between bg-[#2D4256] px-4 py-3 -mx-px -mt-px">
            <div className="flex items-center gap-2 pl-2">
              <User2 className="h-4 w-4 text-white" />
              <DialogTitle className="text-sm font-semibold text-white">Select Employee(s)</DialogTitle>
            </div>
            <DialogClose asChild>
              <button type="button" className="text-white hover:text-white/80">
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
          <DialogHeader className="px-6 pt-4 pb-0">
            <div className="flex items-center justify-between gap-3">
              <DialogDescription className="text-[11px] text-slate-600">
                Choose one or more employees.
              </DialogDescription>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setDraftSelectedEmployeeIds((prev) => {
                    const next = new Set(prev);
                    searchedEmployees.forEach((employee) => next.add(employee.id));
                    return Array.from(next);
                  })
                }
                disabled={searchedEmployees.length === 0}
                className="h-[24px] rounded border-slate-300 px-2 text-[10px] text-slate-600 hover:bg-transparent hover:border-blue-600 hover:text-blue-600 disabled:border-slate-300 disabled:text-slate-300"
              >
                Select all
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-3 px-6 pb-6 pt-4">
            <Input
              ref={employeeSearchInputRef}
              value={employeeSearchQuery}
              onChange={(event) => setEmployeeSearchQuery(event.target.value)}
              placeholder="Search employees by name, surname or id number here..."
              className="h-8 rounded border-slate-300 text-[11px] placeholder:text-[10px] placeholder:text-slate-400"
            />
            <div className="h-80 overflow-y-auto rounded border border-slate-200 bg-white">
              <div className="space-y-1 p-3">
                {searchedEmployees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No matching employees found.</p>
                ) : (
                  searchedEmployees.map((employee) => (
                    <label
                      key={employee.id}
                      className={`flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-blue-50/70 hover:text-blue-600 focus-within:bg-blue-50/70 ${addendumModalSelectItemClass}`}
                    >
                      <Checkbox
                        checked={draftSelectedEmployeeIds.includes(employee.id)}
                        onCheckedChange={(checked) =>
                          setDraftSelectedEmployeeIds((prev) =>
                            checked
                              ? (prev.includes(employee.id) ? prev : [...prev, employee.id])
                              : prev.filter((item) => item !== employee.id),
                          )
                        }
                        className="h-4 w-4 rounded-[2px] border-slate-400 text-white data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
                      />
                      <span className="flex-1">
                        {employee.employee_name} {employee.employee_surname}
                        {(employee.id_number || "").trim()
                          ? ` (${(employee.id_number || "").trim()})`
                          : ""}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="max-h-36 overflow-y-auto pr-1">
              {draftSelectedEmployeeIds.length === 0 ? (
                <div className="text-xs text-slate-600">No employees selected</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {draftSelectedEmployeeIds.map((employeeId) => {
                    const employee = selectedEmployeeMap.get(employeeId);
                    if (!employee) return null;
                    const idNumber = (employee.id_number || "").trim();
                    return (
                      <Badge
                        key={employeeId}
                        variant="outline"
                        className="flex items-center gap-1 border-blue-300 bg-blue-50 text-[10px] text-blue-700 !font-normal hover:bg-blue-50"
                      >
                        <span>
                          {employee.employee_name} {employee.employee_surname}
                          {idNumber ? ` (${idNumber})` : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setDraftSelectedEmployeeIds((prev) => prev.filter((id) => id !== employeeId))
                          }
                          className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm text-blue-700 hover:bg-blue-100"
                          aria-label={`Remove ${employee.employee_name} ${employee.employee_surname}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
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
                  onClick={cancelEmployeePicker}
                  className="h-[28px] w-[84px] rounded border-blue-600 px-3 text-xs text-blue-600 hover:bg-transparent hover:text-blue-600"
                >
                  Cancel
                </Button>
              </div>
              <div className="justify-self-center">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDraftSelectedEmployeeIds([])}
                  disabled={draftSelectedEmployeeIds.length === 0}
                  className="h-[30px] rounded border-0 px-3 text-xs text-slate-500 shadow-none hover:bg-transparent hover:text-slate-600 hover:underline disabled:text-slate-300"
                >
                  Clear
                </Button>
              </div>
              <div className="justify-self-end">
                <Button
                  type="button"
                  onClick={applyEmployeePicker}
                  className="h-[30px] w-[92px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700"
                >
                  Done
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addEmployeeDialogOpen} onOpenChange={setAddEmployeeDialogOpen}>
        <DialogContent className="w-[94vw] max-w-[560px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-white [&>button]:hidden">
          <div className="flex items-center justify-between bg-[#2D4256] px-4 py-3 -mx-px -mt-px">
            <div className="flex items-center gap-2 pl-2">
              <User2 className="h-4 w-4 text-white" />
              <DialogTitle className="text-sm font-semibold text-white">Add Employee</DialogTitle>
            </div>
            <DialogClose asChild>
              <button type="button" className="text-white hover:text-white/80">
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
          <div className="space-y-3 px-6 pb-6 pt-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className={modalFieldLabelClass}>Employee name <span className="text-red-500">*</span></Label>
                <Input
                  value={manualEmployeeForm.employeeName}
                  onChange={(e) => setManualEmployeeForm((prev) => ({ ...prev, employeeName: e.target.value }))}
                  className={getAddendumModalInputClass(manualEmployeeForm.employeeName.trim().length > 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className={modalFieldLabelClass}>Employee surname <span className="text-red-500">*</span></Label>
                <Input
                  value={manualEmployeeForm.employeeSurname}
                  onChange={(e) => setManualEmployeeForm((prev) => ({ ...prev, employeeSurname: e.target.value }))}
                  className={getAddendumModalInputClass(manualEmployeeForm.employeeSurname.trim().length > 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className={modalFieldLabelClass}>ID/Passport <span className="text-red-500">*</span></Label>
                <Select
                  value={manualEmployeeForm.idType}
                  onValueChange={(value) =>
                    setManualEmployeeForm((prev) => ({
                      ...prev,
                      idType: value as "id" | "passport",
                    }))
                  }
                >
                  <SelectTrigger className={`${getAddendumModalSelectTriggerClass(Boolean(manualEmployeeForm.idType))} ${addendumModalDropdownToneClass}`}>
                    <SelectValue placeholder="Choose document type" />
                  </SelectTrigger>
                  <SelectContent className={addendumModalSelectContentClass}>
                    <SelectItem value="id" className={addendumModalSelectItemClass}>ID Number</SelectItem>
                    <SelectItem value="passport" className={addendumModalSelectItemClass}>Passport Number</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className={modalFieldLabelClass}>
                  {manualEmployeeForm.idType === "id" ? "ID number" : "Passport number"} <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={manualEmployeeForm.idType === "id" ? manualEmployeeForm.employeeIdNumber : manualEmployeeForm.passportNumber}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (manualEmployeeForm.idType === "id") {
                      const digitsOnly = value.replace(/\D/g, "").slice(0, 13);
                      setManualEmployeeForm((prev) => ({ ...prev, employeeIdNumber: digitsOnly }));
                    } else {
                      setManualEmployeeForm((prev) => ({ ...prev, passportNumber: value }));
                    }
                  }}
                  className={`${getAddendumModalInputClass(
                    manualEmployeeForm.idType === "id"
                      ? manualEmployeeForm.employeeIdNumber.trim().length > 0
                      : manualEmployeeForm.passportNumber.trim().length > 0,
                  )}`}
                  placeholder={manualEmployeeForm.idType === "id" ? "Insert 13-digit ID number" : "Insert passport number"}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 pb-4 pt-0">
            <div className="grid w-full grid-cols-2 items-center border-t border-dashed border-muted/60 pt-4">
              <div className="justify-self-start">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddEmployeeDialogOpen(false)}
                  className="h-[28px] w-[84px] rounded border-blue-600 px-3 text-xs text-blue-600 hover:bg-transparent hover:text-blue-600"
                >
                  Cancel
                </Button>
              </div>
              <div className="justify-self-end">
                <Button
                  type="button"
                  onClick={addManualEmployee}
                  className="h-[30px] w-[92px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700"
                >
                  Add
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <DialogTitle className="text-sm font-semibold text-white">Select Retrenchment Reason(s)</DialogTitle>
            </div>
            <DialogClose asChild>
              <button type="button" className="text-white hover:text-white/80">
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
          <DialogHeader className="px-6 pt-4 pb-0">
            <DialogDescription className="text-[11px] text-slate-600">
              Choose one or more retrenchment reason(s).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-6 pb-6 pt-4">
            <ScrollArea className="max-h-[40vh] md:max-h-72 rounded border border-slate-300 bg-white">
              <div className="space-y-1 p-3">
                {RETRENCHMENT_REASON_OPTIONS.map((type) => (
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
                ))}
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
            <ScrollArea className="max-h-64 rounded border border-slate-200 bg-white">
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

      <Dialog open={selectionCriteriaPickerOpen} onOpenChange={(open) => (open ? openSelectionCriteriaPicker() : cancelSelectionCriteriaPicker())}>
        <DialogContent className="w-[94vw] max-w-[680px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-white [&>button]:hidden">
          <div className="flex items-center justify-between bg-[#2D4256] px-4 py-3 -mx-px -mt-px">
            <div className="flex items-center gap-2 pl-2">
              <Briefcase className="h-4 w-4 text-white" />
              <DialogTitle className="text-sm font-semibold text-white">Select Selection Criteria</DialogTitle>
            </div>
            <DialogClose asChild>
              <button type="button" className="text-white hover:text-white/80">
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
          <DialogHeader className="px-6 pt-4 pb-0">
            <DialogDescription className="text-[11px] text-slate-600">
              Choose one or more selection criteria. Use Done to apply or Cancel to discard changes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-6 pb-6 pt-4">
            <ScrollArea className="max-h-72 rounded border border-slate-200 bg-white">
              <div className="space-y-1 p-3">
                {selectionCriteriaOptions.map((criteria) => (
                  <label
                    key={criteria}
                    className={`flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-blue-50/70 hover:text-blue-600 focus-within:bg-blue-50/70 ${addendumModalSelectItemClass}`}
                  >
                    <Checkbox
                      checked={draftSelectionCriteria.includes(criteria)}
                      onCheckedChange={(checked) =>
                        setDraftSelectionCriteria((prev) => {
                          if (!checked) {
                            return prev.filter((item) => item !== criteria);
                          }

                          if (criteria === LIFO_OPTION) {
                            const next = prev.filter((item) => item !== LIFO_WITH_SKILLS_OPTION);
                            return next.includes(LIFO_OPTION) ? next : [...next, LIFO_OPTION];
                          }

                          if (criteria === LIFO_WITH_SKILLS_OPTION) {
                            const next = prev.filter(
                              (item) => item !== LIFO_OPTION && item !== SKILLS_AND_QUALIFICATIONS_OPTION,
                            );
                            return next.includes(LIFO_WITH_SKILLS_OPTION) ? next : [...next, LIFO_WITH_SKILLS_OPTION];
                          }

                          if (criteria === SKILLS_AND_QUALIFICATIONS_OPTION) {
                            const next = prev.filter((item) => item !== LIFO_WITH_SKILLS_OPTION);
                            return next.includes(SKILLS_AND_QUALIFICATIONS_OPTION)
                              ? next
                              : [...next, SKILLS_AND_QUALIFICATIONS_OPTION];
                          }

                          return prev.includes(criteria) ? prev : [...prev, criteria];
                        })
                      }
                      className="h-4 w-4 rounded-[2px] border-slate-400 text-white data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
                    />
                    <span className="flex-1">{criteria}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
            <div>
              {draftSelectionCriteria.length === 0 ? (
                <div className="text-xs text-slate-600">No criteria selected</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {draftSelectionCriteria.map((criteria) => (
                    <Badge
                      key={criteria}
                      variant="outline"
                      className="gap-1 border-blue-300 bg-blue-50 text-[10px] text-blue-700 !font-normal hover:bg-blue-50"
                    >
                      {criteria}
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
                  onClick={cancelSelectionCriteriaPicker}
                  className="h-[28px] w-[84px] rounded border-blue-600 px-3 text-xs text-blue-600 hover:bg-transparent hover:text-blue-600"
                >
                  Cancel
                </Button>
              </div>
              <div className="justify-self-center">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDraftSelectionCriteria([])}
                  disabled={draftSelectionCriteria.length === 0}
                  className="h-[30px] rounded border-0 px-3 text-xs text-slate-500 shadow-none hover:bg-transparent hover:text-slate-600 hover:underline disabled:text-slate-300"
                >
                  Clear
                </Button>
              </div>
              <div className="justify-self-end">
                <Button
                  type="button"
                  onClick={applySelectionCriteriaPicker}
                  className="h-[30px] w-[92px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700"
                >
                  Done
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={alternativesPickerOpen} onOpenChange={(open) => (open ? openAlternativesPicker() : cancelAlternativesPicker())}>
        <DialogContent className="w-[94vw] max-w-[680px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-white [&>button]:hidden">
          <div className="flex items-center justify-between bg-[#2D4256] px-4 py-3 -mx-px -mt-px">
            <div className="flex items-center gap-2 pl-2">
              <Briefcase className="h-4 w-4 text-white" />
              <DialogTitle className="text-sm font-semibold text-white">Select Alternatives Considered</DialogTitle>
            </div>
            <DialogClose asChild>
              <button type="button" className="text-white hover:text-white/80">
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
          <DialogHeader className="px-6 pt-4 pb-0">
            <DialogDescription className="text-[11px] text-slate-600">
              Choose one or more alternatives considered. Use Done to apply or Cancel to discard changes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-6 pb-6 pt-4">
            <div className="max-h-72 overflow-y-auto rounded border border-slate-200 bg-white">
              <div className="space-y-1 p-3">
                {ALTERNATIVES_CONSIDERED_OPTIONS.map((alternative) => (
                  <label
                    key={alternative}
                    className={`flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-blue-50/70 hover:text-blue-600 focus-within:bg-blue-50/70 ${addendumModalSelectItemClass}`}
                  >
                    <Checkbox
                      checked={draftAlternativesConsidered.includes(alternative)}
                      onCheckedChange={(checked) =>
                        setDraftAlternativesConsidered((prev) => {
                          if (!checked) {
                            return prev.filter((item) => item !== alternative);
                          }
                          if (alternative === NO_ALTERNATIVES_OPTION) {
                            return [NO_ALTERNATIVES_OPTION];
                          }
                          const next = prev.filter((item) => item !== NO_ALTERNATIVES_OPTION);
                          return next.includes(alternative) ? next : [...next, alternative];
                        })
                      }
                      className="h-4 w-4 rounded-[2px] border-slate-400 text-white data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
                    />
                    <span className="flex-1">{alternative}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              {draftAlternativesConsidered.length === 0 ? (
                <div className="text-xs text-slate-600">No alternatives selected</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {draftAlternativesConsidered.map((alternative) => (
                    <Badge
                      key={alternative}
                      variant="outline"
                      className="gap-1 border-blue-300 bg-blue-50 text-[10px] text-blue-700 !font-normal hover:bg-blue-50"
                    >
                      {alternative}
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
                  onClick={cancelAlternativesPicker}
                  className="h-[28px] w-[84px] rounded border-blue-600 px-3 text-xs text-blue-600 hover:bg-transparent hover:text-blue-600"
                >
                  Cancel
                </Button>
              </div>
              <div className="justify-self-center">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDraftAlternativesConsidered([])}
                  disabled={draftAlternativesConsidered.length === 0}
                  className="h-[30px] rounded border-0 px-3 text-xs text-slate-500 shadow-none hover:bg-transparent hover:text-slate-600 hover:underline disabled:text-slate-300"
                >
                  Clear
                </Button>
              </div>
              <div className="justify-self-end">
                <Button
                  type="button"
                  onClick={applyAlternativesPicker}
                  className="h-[30px] w-[92px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700"
                >
                  Done
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectionReasonsPickerOpen} onOpenChange={(open) => (open ? openRejectionReasonsPicker() : cancelRejectionReasonsPicker())}>
        <DialogContent className="w-[94vw] max-w-[680px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-white [&>button]:hidden">
          <div className="flex items-center justify-between bg-[#2D4256] px-4 py-3 -mx-px -mt-px">
            <div className="flex items-center gap-2 pl-2">
              <Briefcase className="h-4 w-4 text-white" />
              <DialogTitle className="text-sm font-semibold text-white">Select Rejection Reasons</DialogTitle>
            </div>
            <DialogClose asChild>
              <button type="button" className="text-white hover:text-white/80">
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
          <DialogHeader className="px-6 pt-4 pb-0">
            <DialogDescription className="text-[11px] text-slate-600">
              Choose one or more rejection reasons. This field is optional.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-6 pb-6 pt-4">
            <div className="max-h-72 overflow-y-auto rounded border border-slate-200 bg-white">
              <div className="space-y-1 p-3">
                {REJECTION_REASON_OPTIONS.map((reason) => (
                  <label
                    key={reason}
                    className={`flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-blue-50/70 hover:text-blue-600 focus-within:bg-blue-50/70 ${addendumModalSelectItemClass}`}
                  >
                    <Checkbox
                      checked={draftRejectionReasons.includes(reason)}
                      onCheckedChange={(checked) =>
                        setDraftRejectionReasons((prev) =>
                          checked
                            ? (prev.includes(reason) ? prev : [...prev, reason])
                            : prev.filter((item) => item !== reason),
                        )
                      }
                      className="h-4 w-4 rounded-[2px] border-slate-400 text-white data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
                    />
                    <span className="flex-1">{reason}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              {draftRejectionReasons.length === 0 ? (
                <div className="text-xs text-slate-600">No rejection reasons selected</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {draftRejectionReasons.map((reason) => (
                    <Badge
                      key={reason}
                      variant="outline"
                      className="gap-1 border-blue-300 bg-blue-50 text-[10px] text-blue-700 !font-normal hover:bg-blue-50"
                    >
                      {reason}
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
                  onClick={cancelRejectionReasonsPicker}
                  className="h-[28px] w-[84px] rounded border-blue-600 px-3 text-xs text-blue-600 hover:bg-transparent hover:text-blue-600"
                >
                  Cancel
                </Button>
              </div>
              <div className="justify-self-center">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDraftRejectionReasons([])}
                  disabled={draftRejectionReasons.length === 0}
                  className="h-[30px] rounded border-0 px-3 text-xs text-slate-500 shadow-none hover:bg-transparent hover:text-slate-600 hover:underline disabled:text-slate-300"
                >
                  Clear
                </Button>
              </div>
              <div className="justify-self-end">
                <Button
                  type="button"
                  onClick={applyRejectionReasonsPicker}
                  className="h-[30px] w-[92px] rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700"
                >
                  Done
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assistanceOfferedPickerOpen} onOpenChange={(open) => (open ? openAssistanceOfferedPicker() : cancelAssistanceOfferedPicker())}>
        <DialogContent className="w-[94vw] max-w-[680px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-white sm:max-h-[92vh] [&>button]:hidden">
          <div className="flex items-center justify-between bg-[#2D4256] px-4 py-3 -mx-px -mt-px">
            <div className="flex items-center gap-2 pl-2">
              <Briefcase className="h-4 w-4 text-white" />
              <DialogTitle className="text-sm font-semibold text-white">Select Assistance Offered</DialogTitle>
            </div>
            <DialogClose asChild>
              <button type="button" className="text-white hover:text-white/80">
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
          <DialogHeader className="px-6 pt-4 pb-0">
            <DialogDescription className="text-[11px] text-slate-600">
              Choose one or more assistance options.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-6 pb-6 pt-4">
            <div className="rounded border border-slate-200 bg-white">
              <div className="space-y-1 p-3">
                {ASSISTANCE_OFFERED_OPTIONS.map((option) => (
                  <label
                    key={option}
                    className={`flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-blue-50/70 hover:text-blue-600 focus-within:bg-blue-50/70 ${addendumModalSelectItemClass}`}
                  >
                    <Checkbox
                      checked={draftAssistanceOffered.includes(option)}
                      onCheckedChange={(checked) =>
                        setDraftAssistanceOffered((prev) => {
                          if (!checked) {
                            return prev.filter((item) => item !== option);
                          }
                          if (option === NO_ADDITIONAL_ASSISTANCE_OPTION) {
                            return [NO_ADDITIONAL_ASSISTANCE_OPTION];
                          }
                          const next = prev.filter((item) => item !== NO_ADDITIONAL_ASSISTANCE_OPTION);
                          return next.includes(option) ? next : [...next, option];
                        })
                      }
                      className="h-4 w-4 rounded-[2px] border-slate-400 text-white data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
                    />
                    <span className="flex-1">{option}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              {draftAssistanceOffered.length === 0 ? (
                <div className="text-xs text-slate-600">No assistance selected</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {draftAssistanceOffered.map((option) => (
                    <Badge
                      key={option}
                      variant="outline"
                      className="gap-1 border-blue-300 bg-blue-50 text-[10px] text-blue-700 !font-normal hover:bg-blue-50"
                    >
                      {option}
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
                  onClick={cancelAssistanceOfferedPicker}
                  className="h-[28px] w-[84px] rounded border-blue-600 px-3 text-xs text-blue-600 hover:bg-transparent hover:text-blue-600"
                >
                  Cancel
                </Button>
              </div>
              <div className="justify-self-center">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDraftAssistanceOffered([])}
                  disabled={draftAssistanceOffered.length === 0}
                  className="h-[30px] rounded border-0 px-3 text-xs text-slate-500 shadow-none hover:bg-transparent hover:text-slate-600 hover:underline disabled:text-slate-300"
                >
                  Clear
                </Button>
              </div>
              <div className="justify-self-end">
                <Button
                  type="button"
                  onClick={applyAssistanceOfferedPicker}
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

export default ContemplatedRetrenchmentNoticeGenerator;








