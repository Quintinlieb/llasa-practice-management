import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode, type RefObject, type SVGProps } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { detectLogoLayout, getPdfLogoTargetHeight, type LogoLayout } from "@/lib/logoLayout";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, Building2, Check, ChevronDown, Clock3, FileText, Mail, MapPin, Pencil, Phone, Plus, User2, X } from "lucide-react";
import { EnvelopeIcon, PhoneIcon as HeroPhoneIcon } from "@heroicons/react/24/outline";
import { jsPDF } from "jspdf";

type AbscondHearingNoticeGeneratorProps = {
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

type ClientOption = {
  id: string;
  registeredName: string;
  tradingAs: string;
  companyType: string;
  registrationNumber: string;
  clientNumber: string;
  contactNumber: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  areaCode: string;
};

type LogoRecord = {
  storage_path?: string | null;
  logo_path?: string | null;
  logo_url?: string | null;
  company_logo_url?: string | null;
};

type QueryError = { message: string };

type ClientSelectQuery = {
  order: (
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ) => Promise<{ data: unknown; error: QueryError | null }>;
};

type LogoSelectQuery = {
  eq: (column: string, value: string) => {
    maybeSingle: () => Promise<{ data: unknown; error: QueryError | null }>;
  };
};

type SupabaseReader = {
  from(table: "clients"): { select: (columns: string) => ClientSelectQuery };
  from(table: "client_logos"): { select: (columns: string) => LogoSelectQuery };
};

type ClientDetails = {
  clientId: string;
  clientName: string;
  registeredName: string;
  tradingAs: string;
  companyType: string;
  registrationNumber: string;
  contactNumber: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  areaCode: string;
  logoDataUrl: string;
  logoLayout: LogoLayout | null;
};

type EmployeeDetails = {
  employeeName: string;
  employeeSurname: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  areaCode: string;
  contactNumber: string;
};

type HearingDetails = {
  absentFrom: string;
  hearingDate: string;
  hearingTime: string;
  hearingPlace: string;
  issuingMethods: string[];
};

type NoticePreviewEdits = Record<string, string>;

type AbscondHearingDraftState = {
  activeStep: number;
  isFinished: boolean;
  isPreviewEditable?: boolean;
  clientDetails: ClientDetails;
  employeeDetails: EmployeeDetails;
  hearingDetails: HearingDetails;
  previewEdits?: NoticePreviewEdits;
};

const steps = ["Client Details", "Employee Details", "Hearing Details", "Preview / Edit"] as const;
const stepIcons = [Building2, User2, FileText, Check] as const;
const clientLogosBucket = "client-logos";

const emptyClientDetails: ClientDetails = {
  clientId: "",
  clientName: "",
  registeredName: "",
  tradingAs: "",
  companyType: "",
  registrationNumber: "",
  contactNumber: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  province: "",
  areaCode: "",
  logoDataUrl: "",
  logoLayout: null,
};

const emptyEmployeeDetails: EmployeeDetails = {
  employeeName: "",
  employeeSurname: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  province: "",
  areaCode: "",
  contactNumber: "",
};

const emptyHearingDetails: HearingDetails = {
  absentFrom: "",
  hearingDate: "",
  hearingTime: "",
  hearingPlace: "",
  issuingMethods: [],
};

const provinceOptions = [
  "Gauteng",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Free State",
  "KwaZulu-Natal",
  "Western Cape",
  "Eastern Cape",
  "Northern Cape",
] as const;

const issuingMethodOptions = ["By Hand", "By Email", "By Registered Post", "By Regular Post", "By WhatsApp", "By Facebook"] as const;

const hearingHourOptions = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const hearingMinuteOptions = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));

const inputClassName =
  "h-8 rounded-sm border-slate-300 bg-white !text-[10px] md:!text-[10px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] md:placeholder:!text-[10px] placeholder:font-normal placeholder:text-slate-400 hover:border-[#3eca44] focus-visible:border-[#3eca44] focus-visible:ring-0";

const selectTriggerClassName = cn(
  inputClassName,
  "!h-8 !border-slate-300 !text-[10px] hover:!border-[#3eca44] focus:!border-[#3eca44] focus-visible:!border-[#3eca44] [&>span]:text-[10px] [&>span]:font-medium data-[placeholder]:[&>span]:font-normal data-[placeholder]:[&>span]:text-slate-400",
);

const hiddenScrollClassName = "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

const normalizeText = (value: unknown) => String(value ?? "").trim();
const readRecordValue = (record: unknown, key: string) =>
  record && typeof record === "object" ? (record as Record<string, unknown>)[key] : "";
const supabaseReader = supabase as unknown as SupabaseReader;

const isDraftState = (value: unknown): value is AbscondHearingDraftState => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AbscondHearingDraftState>;
  return typeof candidate.activeStep === "number" && typeof candidate.isFinished === "boolean";
};

const mergeClientDetails = (value: unknown): ClientDetails => ({ ...emptyClientDetails, ...(value && typeof value === "object" ? value : {}) });
const mergeEmployeeDetails = (value: unknown): EmployeeDetails => ({ ...emptyEmployeeDetails, ...(value && typeof value === "object" ? value : {}) });
const mergeHearingDetails = (value: unknown): HearingDetails => {
  const candidate = value && typeof value === "object" ? (value as Partial<HearingDetails>) : {};
  return {
    ...emptyHearingDetails,
    ...candidate,
    issuingMethods: Array.isArray(candidate.issuingMethods)
      ? candidate.issuingMethods.map((method) => normalizeText(method)).filter(Boolean)
      : emptyHearingDetails.issuingMethods,
  };
};

const formatCompanyName = (client: Pick<ClientOption, "registeredName" | "tradingAs">) =>
  client.tradingAs || client.registeredName || "";

const abscondCompanyTypeAbbreviations: Record<string, string> = {
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

const formatAbscondNoticeCompanyName = (registeredName?: string | null, companyType?: string | null) => {
  const resolvedName = normalizeText(registeredName);
  const typeSuffix = abscondCompanyTypeAbbreviations[normalizeText(companyType)] || "";
  if (!resolvedName) return typeSuffix;
  if (!typeSuffix) return resolvedName;
  return resolvedName.toLowerCase().endsWith(typeSuffix.toLowerCase())
    ? resolvedName
    : `${resolvedName} ${typeSuffix}`;
};

const buildClientSearchLabel = (client: ClientOption) => {
  const display = formatCompanyName(client);
  if (client.tradingAs && client.registeredName && client.tradingAs !== client.registeredName) {
    return `${client.registeredName} t/a ${client.tradingAs}`;
  }
  return display;
};

const buildAddressLine = (parts: Array<string | undefined>) => parts.map((part) => normalizeText(part)).filter(Boolean).join(", ");

const fileToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Unable to read image."));
    reader.readAsDataURL(blob);
  });

const trimAbscondLogoWhitespace = (dataUrl: string): Promise<string> =>
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

      const sourceCanvas = document.createElement("canvas");
      sourceCanvas.width = width;
      sourceCanvas.height = height;
      const sourceContext = sourceCanvas.getContext("2d");
      if (!sourceContext) {
        resolve(dataUrl);
        return;
      }

      try {
        sourceContext.drawImage(image, 0, 0, width, height);
        const pixels = sourceContext.getImageData(0, 0, width, height).data;
        const findContentBox = (skipNearWhite: boolean) => {
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
              if (skipNearWhite && red >= 245 && green >= 245 && blue >= 245) continue;
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
            }
          }

          return maxX >= 0 && maxY >= 0 ? { minX, minY, maxX, maxY } : null;
        };

        const bounds = findContentBox(true) ?? findContentBox(false);
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

        croppedContext.drawImage(sourceCanvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
        resolve(croppedCanvas.toDataURL("image/png"));
      } catch {
        resolve(dataUrl);
      }
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });

const fetchLogoData = async (pathOrUrl: string) => {
  const raw = normalizeText(pathOrUrl);
  if (!raw) return { dataUrl: "", layout: null as LogoLayout | null };

  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) {
    const trimmed = raw.startsWith("data:") ? await trimAbscondLogoWhitespace(raw) : raw;
    return { dataUrl: trimmed, layout: (await detectLogoLayout(trimmed)) ?? "horizontal" };
  }

  const { data, error } = await supabase.storage.from(clientLogosBucket).download(raw);
  if (error || !data) return { dataUrl: "", layout: null as LogoLayout | null };
  const dataUrl = await fileToDataUrl(data);
  const trimmed = await trimAbscondLogoWhitespace(dataUrl);
  return { dataUrl: trimmed, layout: (await detectLogoLayout(trimmed)) ?? "horizontal" };
};

const openDatePicker = (ref: RefObject<HTMLInputElement | null>) => {
  const input = ref.current;
  if (!input) return;
  if (typeof input.showPicker === "function") {
    input.showPicker();
    return;
  }
  input.focus();
  input.click();
};

const formatDateLabel = (value: string) => {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
};

const formatLetterDate = (value: string) => {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};

const getTodayDateValue = () => new Date().toISOString().slice(0, 10);

const formatTimeLabel = (value: string) => {
  const [hour = "", minute = ""] = value.split(":");
  if (!hour) return "";
  return `${hour.padStart(2, "0")}:${(minute || "00").padStart(2, "0")}`;
};

const previewLine = "________________________";

const createAbscondPdfIconDataUrl = (
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

const createAbscondPdfPhoneIconDataUrl = (strokeColor = "#000000") =>
  createAbscondPdfIconDataUrl((ctx) => {
    const path = new Path2D(
      "M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z",
    );
    ctx.stroke(path);
  }, { strokeColor });

const createAbscondPdfMailIconDataUrl = (strokeColor = "#000000") =>
  createAbscondPdfIconDataUrl((ctx) => {
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

const sanitizeAbscondPdfSegment = (value: string, fallback: string) =>
  normalizeText(value)
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || fallback;

const getAbscondEmployeeFullName = (employeeDetails: EmployeeDetails) =>
  [employeeDetails.employeeName, employeeDetails.employeeSurname].map(normalizeText).filter(Boolean).join(" ");

const getAbscondClientDisplayName = (clientDetails: ClientDetails) =>
  formatAbscondNoticeCompanyName(clientDetails.registeredName || clientDetails.clientName, clientDetails.companyType) || "Company Name";

const getAbscondHeaderAddressLines = (clientDetails: ClientDetails) =>
  [
    [clientDetails.addressLine1, clientDetails.addressLine2].map(normalizeText).filter(Boolean).join(", "),
    [clientDetails.city, clientDetails.province, clientDetails.areaCode].map(normalizeText).filter(Boolean).join(", "),
  ].filter(Boolean);

const getAbscondDefaultHearingPlace = (clientDetails: Pick<ClientDetails, "city" | "province">) => {
  const clientLocation = [clientDetails.city, clientDetails.province].map(normalizeText).filter(Boolean).join(", ");
  return clientLocation ? `${clientLocation} (Company Premises)` : "";
};

const getAbscondNoticeParagraphs = (
  hearingDetails: HearingDetails,
  previewEdits: NoticePreviewEdits,
) => {
  const absentFromDisplay = formatLetterDate(hearingDetails.absentFrom) || "[absent from date]";
  const hearingDateDisplay = formatLetterDate(hearingDetails.hearingDate) || "[hearing date]";
  const hearingTimeDisplay = formatTimeLabel(hearingDetails.hearingTime) || "[hearing time]";
  const hearingPlaceDisplay = normalizeText(hearingDetails.hearingPlace) || "[hearing venue]";
  const base = [
    {
      id: "opening",
      text: `Please take notice that you have been absent from work since ${absentFromDisplay}. You did not apply for leave for this period and you did not provide the company with valid reasons for your absence. You also did not inform the company about your absence or expected return. Therefore, you show no intention of returning to work and you are absconding.`,
    },
    {
      id: "instruction",
      text: "You are specifically instructed to return to work immediately.",
    },
    {
      id: "continued-absence",
      text: "Take further notice that continued absence confirms that you no longer intend to tender your services to the company. Subsequently your employment contract with the company will be terminated.",
    },
    {
      id: "hearing",
      text: `Take further notice that a hearing has been scheduled for your abscondment or unauthorised absenteeism to be held on ${hearingDateDisplay} at ${hearingTimeDisplay} at ${hearingPlaceDisplay}.`,
      emphasis: [hearingDateDisplay, hearingTimeDisplay, hearingPlaceDisplay],
    },
  ];

  return base.map((paragraph) => ({
    ...paragraph,
    text: previewEdits[paragraph.id] ?? paragraph.text,
  }));
};

const getAbscondHearingRights = (previewEdits: NoticePreviewEdits) =>
  [
    "The right to be given time to prepare your case, being at least 48 hours.",
    "The right to be given advance warning of the allegations, being at least 48 hours.",
    "The right to be represented by a fellow employee or shop steward who must be an employee of the company. It is your responsibility to ensure the availability of your representative at the hearing. No outside representation or observers will be permitted.",
    "The right to ask questions of any evidence produced or statements by witnesses.",
    "The right to a fair and proper hearing.",
    "The right to call witnesses. It is your responsibility to ensure the physical availability of your witnesses at the hearing.",
    "The right to an interpreter. You may request another employee or your representative to perform this function.",
    "The right to appeal against any disciplinary action in terms of the company appeal procedures.",
    "Note the importance of attending the hearing. If you do not attend the hearing or remain in attendance until the finalisation thereof, it will be conducted in your absence. The chairperson will then only have one version to make a decision on. It is your responsibility to contact your superiors prior to commencement of the hearing. Failure to do so will result in the hearing proceeding in your absence.",
  ].map((right, index) => previewEdits[`right-${index}`] ?? right);

const abscondFirstPageRightsCount = 8;

const AbscondNoticePage = ({
  clientDetails,
  showHeader = false,
  showFooter = false,
  children,
}: {
  clientDetails: ClientDetails;
  showHeader?: boolean;
  showFooter?: boolean;
  children: ReactNode;
}) => {
  const displayValue = (value?: string | number | null) => (value && value.toString().trim() ? value.toString() : previewLine);
  const companyNameDisplay = displayValue(formatAbscondNoticeCompanyName(clientDetails.registeredName || clientDetails.clientName, clientDetails.companyType));
  const tradingNameDisplay = normalizeText(clientDetails.tradingAs);
  const registrationNumberDisplay = normalizeText(clientDetails.registrationNumber);
  const hasUploadedLogo = Boolean(clientDetails.logoDataUrl);
  const companyIdentityDisplay = tradingNameDisplay
    ? `${companyNameDisplay} t/a ${tradingNameDisplay}`
    : companyNameDisplay;
  const clientLocationLine = [clientDetails.city, clientDetails.province].map(normalizeText).filter(Boolean).join(", ");
  const companyInfoRows = [
    { key: "registered", icon: null, text: companyNameDisplay, bold: true },
    { key: "trading", icon: null, text: tradingNameDisplay ? `t/a ${tradingNameDisplay}` : "" },
    { key: "address1", icon: null, text: normalizeText(clientDetails.addressLine1) },
    { key: "address2", icon: null, text: normalizeText(clientDetails.addressLine2) },
    { key: "location", icon: null, text: clientLocationLine },
    { key: "areaCode", icon: null, text: normalizeText(clientDetails.areaCode) },
    { key: "phone", icon: HeroPhoneIcon, text: normalizeText(clientDetails.contactNumber) },
    { key: "email", icon: EnvelopeIcon, text: normalizeText(clientDetails.email) },
  ].filter((item) => item.text);
  const footerAddressLines = [
    [clientDetails.addressLine1, clientDetails.addressLine2].map(normalizeText).filter(Boolean).join(", "),
    [clientDetails.city, clientDetails.province, clientDetails.areaCode].map(normalizeText).filter(Boolean).join(", "),
  ].filter(Boolean);
  const companyAddressDisplay = footerAddressLines.length > 0 ? footerAddressLines.join(", ") : "Address";

  return (
    <div
      className={cn(
        "bg-white text-black mx-auto shadow-sm flex flex-col",
        hasUploadedLogo ? "px-8 py-4" : "p-8",
      )}
      style={{ width: "210mm", minHeight: "297mm" }}
    >
      <div className="flex flex-1 flex-col text-[12px] leading-relaxed text-black">
        {showHeader ? (
          <>
            <div className="flex items-start justify-between gap-6">
              <div className="min-h-[72px] min-w-[180px]">
                {hasUploadedLogo ? (
                  <img src={clientDetails.logoDataUrl} alt="Client logo" className="max-h-20 max-w-[220px] object-contain" />
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
          </>
        ) : null}
        <div className="flex-1">{children}</div>
        {showFooter && hasUploadedLogo ? (
          <footer className="mt-7 border-t border-slate-300 pt-4">
            <div className="space-y-1 text-left text-[9px] leading-4 text-slate-700">
              <p className="font-semibold text-slate-900">{companyIdentityDisplay}</p>
              {registrationNumberDisplay ? (
                <div className="flex items-start gap-2">
                  <Briefcase className="mt-0.5 h-3 w-3 shrink-0 text-black" />
                  <span>{registrationNumberDisplay}</span>
                </div>
              ) : null}
              {clientDetails.contactNumber ? (
                <div className="flex items-start gap-2">
                  <Phone className="mt-0.5 h-3 w-3 shrink-0 text-black" />
                  <span>{clientDetails.contactNumber}</span>
                </div>
              ) : null}
              {clientDetails.email ? (
                <div className="flex items-start gap-2">
                  <Mail className="mt-0.5 h-3 w-3 shrink-0 text-black" />
                  <span>{clientDetails.email}</span>
                </div>
              ) : null}
              {footerAddressLines.length > 0 ? (
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-black" />
                  <div>
                    {footerAddressLines.map((line) => (
                      <p key={`footer-${line}`}>{line}</p>
                    ))}
                  </div>
                </div>
              ) : null}
              {footerAddressLines.length === 0 ? (
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-black" />
                  <span>{companyAddressDisplay}</span>
                </div>
              ) : null}
            </div>
          </footer>
        ) : null}
      </div>
    </div>
  );
};

const AbscondHearingNoticeContent = ({
  activeStep,
  isFinished,
  isPreviewEditable,
  clients,
  clientLoadMessage,
  clientSearchOpen,
  setClientSearchOpen,
  clientDetails,
  employeeDetails,
  hearingDetails,
  previewEdits,
  onClientSelect,
  onRemoveLogo,
  onEmployeeChange,
  onHearingChange,
  onPreviewEditChange,
  hearingDateRef,
  absentFromDateRef,
}: {
  activeStep: number;
  isFinished: boolean;
  isPreviewEditable: boolean;
  clients: ClientOption[];
  clientLoadMessage: string;
  clientSearchOpen: boolean;
  setClientSearchOpen: (open: boolean) => void;
  clientDetails: ClientDetails;
  employeeDetails: EmployeeDetails;
  hearingDetails: HearingDetails;
  previewEdits: NoticePreviewEdits;
  onClientSelect: (clientId: string) => void;
  onRemoveLogo: () => void;
  onEmployeeChange: (field: keyof EmployeeDetails, value: string) => void;
  onHearingChange: (field: keyof HearingDetails, value: string | string[]) => void;
  onPreviewEditChange: (field: string, value: string) => void;
  hearingDateRef: RefObject<HTMLInputElement | null>;
  absentFromDateRef: RefObject<HTMLInputElement | null>;
}) => {
  const [clientQuery, setClientQuery] = useState("");
  const [issuingMethodOpen, setIssuingMethodOpen] = useState(false);
  const [editingPreviewItem, setEditingPreviewItem] = useState<string | null>(null);
  const [previewEditDraft, setPreviewEditDraft] = useState("");
  const [addingAfterPreviewItem, setAddingAfterPreviewItem] = useState<string | null | undefined>(undefined);
  const clientOptions = useMemo(() => {
    const query = clientQuery.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((client) => buildClientSearchLabel(client).toLowerCase().includes(query));
  }, [clientQuery, clients]);
  const selectedClientLabel = clientDetails.clientName || "Select client";
  const [selectedHour = "", selectedMinute = ""] = hearingDetails.hearingTime.split(":");
  const issuingMethodSelectionLabel =
    hearingDetails.issuingMethods.length === 0
      ? "Select method(s) of issuing"
      : `${hearingDetails.issuingMethods.length} issuing method(s) selected`;
  const toggleIssuingMethod = (value: string) => {
    const next = hearingDetails.issuingMethods.includes(value)
      ? hearingDetails.issuingMethods.filter((method) => method !== value)
      : [...hearingDetails.issuingMethods, value];
    onHearingChange("issuingMethods", next);
  };

  if (isFinished) {
    const employeeFullName = [employeeDetails.employeeName, employeeDetails.employeeSurname].map(normalizeText).filter(Boolean).join(" ");
    const employeeAddressLines = [
      employeeDetails.addressLine1,
      employeeDetails.addressLine2,
      [employeeDetails.city, employeeDetails.province].map(normalizeText).filter(Boolean).join(", "),
      employeeDetails.areaCode,
    ].map(normalizeText).filter(Boolean);
    const absentFromDisplay = formatLetterDate(hearingDetails.absentFrom) || "[absent from date]";
    const hearingDateDisplay = formatLetterDate(hearingDetails.hearingDate) || "[hearing date]";
    const hearingTimeDisplay = formatTimeLabel(hearingDetails.hearingTime) || "[hearing time]";
    const hearingPlaceDisplay = normalizeText(hearingDetails.hearingPlace) || "[hearing venue]";
    const issuingMethodsDisplay = hearingDetails.issuingMethods.length > 0
      ? hearingDetails.issuingMethods.map((method) => method.toUpperCase()).join(" / ")
      : previewLine;
    const getEditableValue = (id: string, fallback: string) => previewEdits[id] ?? fallback;
    const beginPreviewItemEdit = (id: string, fallback: string) => {
      setEditingPreviewItem(id);
      setPreviewEditDraft(getEditableValue(id, fallback));
    };
    const cancelPreviewItemEdit = () => {
      setEditingPreviewItem(null);
      setPreviewEditDraft("");
    };
    const savePreviewItemEdit = () => {
      if (!editingPreviewItem) return;
      onPreviewEditChange(editingPreviewItem, previewEditDraft.trim());
      cancelPreviewItemEdit();
    };
    const resetPreviewItemEdit = () => {
      if (!editingPreviewItem) return;
      onPreviewEditChange(editingPreviewItem, "");
      cancelPreviewItemEdit();
    };
    const openAddParagraphForm = (afterId: string | null) => {
      setAddingAfterPreviewItem(afterId);
      setPreviewEditDraft("");
    };
    const cancelAddParagraph = () => {
      setAddingAfterPreviewItem(undefined);
      setPreviewEditDraft("");
    };
    const saveAddedParagraph = () => {
      const trimmed = previewEditDraft.trim();
      if (!trimmed || addingAfterPreviewItem === undefined) {
        cancelAddParagraph();
        return;
      }
      onPreviewEditChange(`custom-${addingAfterPreviewItem ?? "start"}-${Date.now()}`, trimmed);
      cancelAddParagraph();
    };
    const paragraphs: Array<{ id: string; text: string; emphasis?: Array<string> }> = [
      {
        id: "opening",
        text: `Please take notice that you have been absent from work since ${absentFromDisplay}. You did not apply for leave for this period and you did not provide the company with valid reasons for your absence. You also did not inform the company about your absence or expected return. Therefore, you show no intention of returning to work and you are absconding.`,
      },
      {
        id: "instruction",
        text: "You are specifically instructed to return to work immediately.",
      },
      {
        id: "continued-absence",
        text: "Take further notice that continued absence confirms that you no longer intend to tender your services to the company. Subsequently your employment contract with the company will be terminated.",
      },
      {
        id: "hearing",
        text: `Take further notice that a hearing has been scheduled for your abscondment or unauthorised absenteeism to be held on ${hearingDateDisplay} at ${hearingTimeDisplay} at ${hearingPlaceDisplay}.`,
        emphasis: [hearingDateDisplay, hearingTimeDisplay, hearingPlaceDisplay],
      },
    ];
    const hearingRights = [
      "The right to be given time to prepare your case, being at least 48 hours.",
      "The right to be given advance warning of the allegations, being at least 48 hours.",
      "The right to be represented by a fellow employee or shop steward who must be an employee of the company. It is your responsibility to ensure the availability of your representative at the hearing. No outside representation or observers will be permitted.",
      "The right to ask questions of any evidence produced or statements by witnesses.",
      "The right to a fair and proper hearing.",
      "The right to call witnesses. It is your responsibility to ensure the physical availability of your witnesses at the hearing.",
      "The right to an interpreter. You may request another employee or your representative to perform this function.",
      "The right to appeal against any disciplinary action in terms of the company appeal procedures.",
      "Note the importance of attending the hearing. If you do not attend the hearing or remain in attendance until the finalisation thereof, it will be conducted in your absence. The chairperson will then only have one version to make a decision on. It is your responsibility to contact your superiors prior to commencement of the hearing. Failure to do so will result in the hearing proceeding in your absence.",
    ];
    const renderTextWithEmphasis = (value: string, emphasis: Array<string> = []) => {
      const targets = emphasis.map(normalizeText).filter(Boolean);
      if (targets.length === 0) return value;
      const escapedTargets = targets.map((target) => target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      const pattern = new RegExp(`(${escapedTargets.join("|")})`, "g");
      return value.split(pattern).map((part, index) =>
        targets.includes(part) ? (
          <strong key={`${part}-${index}`} className="font-bold">
            {part}
          </strong>
        ) : (
          part
        ),
      );
    };
    const renderAddParagraphControl = (afterId: string | null) => {
      if (!isPreviewEditable) return null;
      return (
        <div key={`add-${afterId ?? "start"}`} className="flex justify-center py-2 px-3">
          <button
            type="button"
            onClick={() => openAddParagraphForm(afterId)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded border border-dashed border-slate-300 bg-white px-4 text-[12px] font-medium text-slate-500 hover:border-[#3eca44] hover:text-[#2f9f35]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add paragraph here
          </button>
        </div>
      );
    };
    const renderCustomParagraphsAfter = (afterId: string) =>
      Object.entries(previewEdits)
        .filter(([key]) => key.startsWith(`custom-${afterId}-`))
        .map(([key, text]) => (
          <div key={key} className="space-y-4">
            <EditableText id={key} value={text} className="text-justify" />
            {renderAddParagraphControl(key)}
          </div>
        ));
    function EditableText({ id, value, className, emphasis }: { id: string; value: string; className?: string; emphasis?: Array<string> }) {
      return (
        <div className="py-1">
          <div className="grid grid-cols-[minmax(0,1fr)_74px] items-start gap-5">
            <p className={cn(className, "min-w-0")}>{renderTextWithEmphasis(getEditableValue(id, value), emphasis)}</p>
            {isPreviewEditable ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-[34px] justify-center gap-1.5 rounded border-slate-300 px-3 text-xs text-slate-600 hover:border-[#3eca44] hover:bg-transparent hover:text-[#2f9f35]"
                onClick={() => beginPreviewItemEdit(id, value)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            ) : null}
          </div>
        </div>
      );
    }

    return (
      <div className={cn("h-full overflow-y-auto bg-white px-6 pb-6 pt-2", hiddenScrollClassName)}>
        <div className="space-y-6">
          <AbscondNoticePage clientDetails={clientDetails} showHeader>
            <div className="mt-2 text-right">{formatLetterDate(getTodayDateValue())}</div>
            <div className="mt-5">
              <p className="flex items-baseline gap-4">
                <span>TO:</span>
                <span className="font-semibold uppercase">{employeeFullName || previewLine}</span>
              </p>
              <div className="pl-9">
                {employeeAddressLines.length > 0 ? (
                  employeeAddressLines.map((line) => (
                    <p key={line} className="font-semibold uppercase">
                      {line}
                    </p>
                  ))
                ) : (
                  <p className="font-semibold uppercase">{previewLine}</p>
                )}
              </div>
            </div>
            <div className="mt-3 text-right font-semibold">{issuingMethodsDisplay}</div>
            <div className="mt-7 space-y-5">
              <p>Dear Sir / Madam</p>
              <p className="font-bold underline">RE: ABSCONDMENT FROM WORK AND NOTICE OF HEARING</p>
              {paragraphs.map((paragraph) => (
                <div key={paragraph.id} className="space-y-4">
                  <EditableText id={paragraph.id} value={paragraph.text} emphasis={paragraph.emphasis} className="text-justify" />
                  {renderAddParagraphControl(paragraph.id)}
                  {renderCustomParagraphsAfter(paragraph.id)}
                </div>
              ))}
              <p>Your rights in respect of the hearing are as follows:</p>
              <ul className="ml-6 list-disc space-y-2">
                {hearingRights.slice(0, abscondFirstPageRightsCount).map((right, index) => (
                  <li key={`right-${index}`}>
                    <EditableText id={`right-${index}`} value={right} className="text-justify" />
                    {renderAddParagraphControl(`right-${index}`)}
                    {renderCustomParagraphsAfter(`right-${index}`)}
                  </li>
                ))}
              </ul>
            </div>
          </AbscondNoticePage>
          <AbscondNoticePage clientDetails={clientDetails} showFooter>
            <div className="mt-10">
              <ul className="ml-6 list-disc space-y-2">
                {hearingRights.slice(abscondFirstPageRightsCount).map((right, index) => {
                  const rightIndex = index + abscondFirstPageRightsCount;
                  return (
                    <li key={`right-${rightIndex}`}>
                      <EditableText id={`right-${rightIndex}`} value={right} className="text-justify" />
                      {renderAddParagraphControl(`right-${rightIndex}`)}
                      {renderCustomParagraphsAfter(`right-${rightIndex}`)}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-7 space-y-5">
                <EditableText id="closing" value="We trust you find the above in order." />
                {renderAddParagraphControl("closing")}
                {renderCustomParagraphsAfter("closing")}
                <p>Yours sincerely</p>
                <div className="pt-9">
                  <div className="w-36 border-t border-black" />
                  <p className="mt-1 font-semibold uppercase">Management</p>
                </div>
              </div>
            </div>
          </AbscondNoticePage>
        </div>
        {isPreviewEditable && (editingPreviewItem || addingAfterPreviewItem !== undefined) ? (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/35 px-4"
            onClick={editingPreviewItem ? cancelPreviewItemEdit : cancelAddParagraph}
          >
            <div
              className="w-full max-w-3xl rounded border border-slate-200 bg-white p-4 shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-label="Edit paragraph"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-black">{editingPreviewItem ? "Edit Paragraph" : "Add Paragraph"}</h3>
                  <span className="text-[11px] text-slate-500">Save or cancel to continue.</span>
                </div>
                <Textarea
                  value={previewEditDraft}
                  onChange={(event) => setPreviewEditDraft(event.target.value)}
                  rows={4}
                  className="min-h-[96px] resize-none rounded border-slate-300 text-xs text-slate-700 hover:border-[#3eca44] focus-visible:border-[#3eca44] focus-visible:ring-0"
                  spellCheck={true}
                  lang="en"
                  autoCorrect="on"
                />
                <div className="flex items-center justify-end gap-2">
                  {editingPreviewItem && previewEdits[editingPreviewItem] ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-[28px] rounded px-3 text-xs text-slate-500 shadow-none hover:bg-white hover:text-black hover:underline"
                      onClick={resetPreviewItemEdit}
                    >
                      Reset
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-[28px] rounded border-slate-300 bg-white px-3 text-xs text-slate-700 hover:border-[#3eca44] hover:bg-white hover:text-[#2f9f35]"
                    onClick={editingPreviewItem ? cancelPreviewItemEdit : cancelAddParagraph}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-[28px] rounded bg-[#3eca44] px-3 text-xs text-white hover:bg-[#34b73b]"
                    onClick={editingPreviewItem ? savePreviewItemEdit : saveAddedParagraph}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("h-full overflow-y-auto py-1", hiddenScrollClassName)}>
      <div className={cn("space-y-4", activeStep === 0 || activeStep === 1 ? "pt-0" : "pt-5")}>
        {activeStep === 0 ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="abscondClientName" className="text-[10px] font-semibold text-slate-600">
                  Client Name <span className="text-red-500">*</span>
                </Label>
                  <Popover
                    open={clientSearchOpen}
                    onOpenChange={(open) => {
                      if (!open) setClientQuery("");
                      setClientSearchOpen(open);
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        id="abscondClientName"
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={clientSearchOpen}
                        className={cn(
                          inputClassName,
                          "w-full justify-between px-3 text-[11px] font-medium hover:bg-white hover:text-slate-900 data-[state=open]:bg-white data-[state=open]:text-slate-900",
                          !clientDetails.clientName && "text-[10px] text-slate-400",
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
                          value={clientQuery}
                          onValueChange={setClientQuery}
                          placeholder="Search registered or trading name..."
                          className="h-8 text-[11px] placeholder:text-[10px]"
                        />
                        <CommandList className="max-h-[320px] overscroll-contain">
                          {clientOptions.length === 0 ? (
                            <CommandEmpty className="px-3 py-4 text-sm text-slate-500">{clientLoadMessage}</CommandEmpty>
                          ) : null}
                          <CommandGroup>
                            {clientOptions.map((client) => (
                              <CommandItem
                                key={client.id}
                                value={`${client.registeredName} ${client.tradingAs}`.trim()}
                                className="flex items-center justify-between gap-3 px-3 py-2 text-[10px]"
                                onSelect={() => {
                                  onClientSelect(client.id);
                                  setClientQuery("");
                                  setClientSearchOpen(false);
                                }}
                              >
                                <p className="min-w-0 truncate text-[10px] font-medium text-slate-900">{buildClientSearchLabel(client)}</p>
                                {clientDetails.clientId === client.id ? <Check className="h-3.5 w-3.5 text-[#2f9f35]" /> : null}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="abscondRegistrationNumber" className="text-[10px] font-semibold text-slate-600">
                  Registration Number
                </Label>
                <Input
                  id="abscondRegistrationNumber"
                  value={clientDetails.registrationNumber}
                  readOnly
                  placeholder="Will populate from selected client"
                  className={inputClassName}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="abscondClientContactNumber" className="text-[10px] font-semibold text-slate-600">
                  Contact Number
                </Label>
                <Input
                  id="abscondClientContactNumber"
                  value={clientDetails.contactNumber}
                  readOnly
                  placeholder="Will populate from selected client"
                  className={inputClassName}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="abscondClientEmail" className="text-[10px] font-semibold text-slate-600">
                  Client Email
                </Label>
                <Input
                  id="abscondClientEmail"
                  value={clientDetails.email}
                  readOnly
                  placeholder="Will populate from selected client"
                  className={inputClassName}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="abscondClientAddress" className="text-[10px] font-semibold text-slate-600">
                Client Address
              </Label>
              <Input
                id="abscondClientAddress"
                value={buildAddressLine([clientDetails.addressLine1, clientDetails.addressLine2, clientDetails.city, clientDetails.province, clientDetails.areaCode])}
                readOnly
                placeholder="Will populate from selected client"
                className={inputClassName}
              />
            </div>

            {clientDetails.logoDataUrl ? (
              <div className="max-w-[320px] space-y-2">
                <Label className="text-[10px] font-semibold text-slate-600">Client Logo</Label>
                <div className="flex min-h-[132px] items-center justify-center rounded-sm border border-slate-300 bg-white px-4 py-5">
                  <img
                    src={clientDetails.logoDataUrl}
                    alt="Client logo preview"
                    className={cn(
                      "h-auto w-auto object-contain",
                      clientDetails.logoLayout === "vertical" ? "max-h-24 max-w-[96px]" : "max-h-16 max-w-[220px]",
                    )}
                  />
                </div>
                <button
                    type="button"
                    onClick={onRemoveLogo}
                  className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-700 transition hover:border-rose-500 hover:text-rose-600"
                  >
                  <X className="h-3.5 w-3.5" />
                  Remove logo
                </button>
              </div>
            ) : null}
          </>
        ) : null}

      {activeStep === 1 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="abscondEmployeeName" className="text-[10px] font-semibold text-slate-600">
              Employee Name <span className="text-red-500">*</span>
            </Label>
            <Input id="abscondEmployeeName" value={employeeDetails.employeeName} onChange={(event) => onEmployeeChange("employeeName", event.target.value)} placeholder="Enter employee name" className={inputClassName} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="abscondEmployeeSurname" className="text-[10px] font-semibold text-slate-600">
              Employee Surname <span className="text-red-500">*</span>
            </Label>
            <Input id="abscondEmployeeSurname" value={employeeDetails.employeeSurname} onChange={(event) => onEmployeeChange("employeeSurname", event.target.value)} placeholder="Enter employee surname" className={inputClassName} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="abscondAddress1" className="text-[10px] font-semibold text-slate-600">
              Address Line 1 <span className="text-red-500">*</span>
            </Label>
            <Input id="abscondAddress1" value={employeeDetails.addressLine1} onChange={(event) => onEmployeeChange("addressLine1", event.target.value)} placeholder="Enter address line 1" className={inputClassName} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="abscondAddress2" className="text-[10px] font-semibold text-slate-600">
              Address Line 2
            </Label>
            <Input id="abscondAddress2" value={employeeDetails.addressLine2} onChange={(event) => onEmployeeChange("addressLine2", event.target.value)} placeholder="Enter address line 2" className={inputClassName} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="abscondCity" className="text-[10px] font-semibold text-slate-600">
              City <span className="text-red-500">*</span>
            </Label>
            <Input id="abscondCity" value={employeeDetails.city} onChange={(event) => onEmployeeChange("city", event.target.value)} placeholder="Enter city" className={inputClassName} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="abscondProvince" className="text-[10px] font-semibold text-slate-600">
              Province <span className="text-red-500">*</span>
            </Label>
            <Select value={employeeDetails.province || undefined} onValueChange={(value) => onEmployeeChange("province", value)}>
              <SelectTrigger id="abscondProvince" className={selectTriggerClassName}>
                <SelectValue placeholder="Select province" />
              </SelectTrigger>
              <SelectContent className="text-[10px]">
                {provinceOptions.map((province) => (
                  <SelectItem key={province} value={province} className="text-[10px]">
                    {province}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="abscondAreaCode" className="text-[10px] font-semibold text-slate-600">
              Area Code <span className="text-red-500">*</span>
            </Label>
            <Input id="abscondAreaCode" value={employeeDetails.areaCode} onChange={(event) => onEmployeeChange("areaCode", event.target.value)} placeholder="Enter area code" className={inputClassName} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="abscondContact" className="text-[10px] font-semibold text-slate-600">
              Contact Number
            </Label>
            <Input id="abscondContact" value={employeeDetails.contactNumber} onChange={(event) => onEmployeeChange("contactNumber", event.target.value)} placeholder="Enter contact number" className={inputClassName} />
          </div>
        </div>
      ) : null}

      {activeStep === 2 ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="abscondAbsentFrom" className="text-[10px] font-semibold text-slate-600">
                Absent From <span className="text-red-500">*</span>
              </Label>
              <div className="flex items-start gap-2">
                <Input
                  id="abscondAbsentFrom"
                  type="text"
                  readOnly
                  value={hearingDetails.absentFrom ? formatDateLabel(hearingDetails.absentFrom) : ""}
                  placeholder="Please select a date"
                  onClick={() => openDatePicker(absentFromDateRef)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openDatePicker(absentFromDateRef);
                    }
                  }}
                  className={`${inputClassName} cursor-pointer placeholder:!font-normal`}
                />
                <input
                  ref={absentFromDateRef}
                  type="date"
                  value={hearingDetails.absentFrom}
                  onChange={(event) => onHearingChange("absentFrom", event.target.value)}
                  className="sr-only"
                  aria-hidden="true"
                  tabIndex={-1}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="abscondHearingDate" className="text-[10px] font-semibold text-slate-600">
                Hearing Date <span className="text-red-500">*</span>
              </Label>
              <div className="flex items-start gap-2">
                <Input
                  id="abscondHearingDate"
                  type="text"
                  readOnly
                  value={hearingDetails.hearingDate ? formatDateLabel(hearingDetails.hearingDate) : ""}
                  placeholder="Please select a date"
                  onClick={() => openDatePicker(hearingDateRef)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openDatePicker(hearingDateRef);
                    }
                  }}
                  className={`${inputClassName} cursor-pointer placeholder:!font-normal`}
                />
                <input
                  ref={hearingDateRef}
                  type="date"
                  min={getTodayDateValue()}
                  value={hearingDetails.hearingDate}
                  onChange={(event) => onHearingChange("hearingDate", event.target.value)}
                  className="sr-only"
                  aria-hidden="true"
                  tabIndex={-1}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="abscondHearingTime" className="text-[10px] font-semibold text-slate-600">
                Hearing Time <span className="text-red-500">*</span>
              </Label>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_60px] gap-2">
                <Select
                  key={`abscond-hearing-hour-${selectedHour || "empty"}`}
                  value={selectedHour || undefined}
                  onValueChange={(value) => onHearingChange("hearingTime", `${value}:${selectedMinute || "00"}`)}
                >
                  <SelectTrigger id="abscondHearingTime" className={selectTriggerClassName}>
                    <div className="flex min-w-0 items-center gap-2">
                      <Clock3 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <SelectValue placeholder="Hour" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="text-[10px]">
                    {hearingHourOptions.map((hour) => (
                      <SelectItem key={hour} value={hour} className="text-[10px]">
                        {hour}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  key={`abscond-hearing-minute-${selectedMinute || "empty"}`}
                  value={selectedMinute || undefined}
                  onValueChange={(value) => onHearingChange("hearingTime", `${selectedHour || "08"}:${value}`)}
                >
                  <SelectTrigger className={selectTriggerClassName}>
                    <SelectValue placeholder="Min" />
                  </SelectTrigger>
                  <SelectContent className="text-[10px]">
                    {hearingMinuteOptions.map((minute) => (
                      <SelectItem key={minute} value={minute} className="text-[10px]">
                        {minute}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex h-8 items-center justify-center rounded-sm border border-slate-300 bg-slate-50 text-[10px] font-semibold text-slate-600">
                  {selectedHour ? (Number(selectedHour) >= 12 ? "PM" : "AM") : "AM/PM"}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="abscondHearingPlace" className="text-[10px] font-semibold text-slate-600">
                Hearing Place <span className="text-red-500">*</span>
              </Label>
                <Input
                  id="abscondHearingPlace"
                  value={hearingDetails.hearingPlace}
                  onChange={(event) => onHearingChange("hearingPlace", event.target.value)}
                  placeholder="Enter hearing place"
                  className={inputClassName}
                />
            </div>
            <div className="space-y-2">
              <Label htmlFor="abscondIssuingMethods" className="text-[10px] font-semibold text-slate-600">
                Method of Issuing <span className="text-red-500">*</span>
              </Label>
              <Popover open={issuingMethodOpen} onOpenChange={setIssuingMethodOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="abscondIssuingMethods"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={issuingMethodOpen}
                    className={cn(
                      inputClassName,
                      "w-full justify-between px-3 text-[11px] font-medium hover:bg-white hover:text-slate-900 data-[state=open]:bg-white data-[state=open]:text-slate-900 [&>svg]:ml-2 [&>svg]:shrink-0",
                      hearingDetails.issuingMethods.length === 0 && "text-[10px] text-slate-400",
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
                          const isSelected = hearingDetails.issuingMethods.includes(option);
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
                    {hearingDetails.issuingMethods.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {hearingDetails.issuingMethods.map((method) => (
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
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
};

const AbscondHearingNoticeGenerator = ({
  embedded = false,
  draftState,
  onDraftStateChange,
  onStepChange,
  onStepMetaChange,
}: AbscondHearingNoticeGeneratorProps) => {
  const storedDraft = isDraftState(draftState) ? draftState : null;
  const [activeStep, setActiveStep] = useState(storedDraft?.activeStep ?? 0);
  const [isFinished, setIsFinished] = useState(storedDraft?.isFinished ?? false);
  const [clientRows, setClientRows] = useState<ClientOption[]>([]);
  const [clientLoadMessage, setClientLoadMessage] = useState("No clients found.");
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientDetails, setClientDetails] = useState<ClientDetails>(() => mergeClientDetails(storedDraft?.clientDetails));
  const [employeeDetails, setEmployeeDetails] = useState<EmployeeDetails>(() => mergeEmployeeDetails(storedDraft?.employeeDetails));
  const [hearingDetails, setHearingDetails] = useState<HearingDetails>(() => mergeHearingDetails(storedDraft?.hearingDetails));
  const [isPreviewEditable, setIsPreviewEditable] = useState(Boolean(storedDraft?.isPreviewEditable));
  const [previewEdits, setPreviewEdits] = useState<NoticePreviewEdits>(() =>
    storedDraft?.previewEdits && typeof storedDraft.previewEdits === "object" ? storedDraft.previewEdits : {},
  );
  const hearingDateRef = useRef<HTMLInputElement | null>(null);
  const absentFromDateRef = useRef<HTMLInputElement | null>(null);

  const currentStepLabel = isFinished ? steps[3] : steps[activeStep];

  useEffect(() => {
    onStepChange?.(currentStepLabel);
  }, [currentStepLabel, onStepChange]);

  useEffect(() => {
    let isMounted = true;

    const loadClients = async () => {
      const { data, error } = await supabaseReader
        .from("clients")
        .select("id,registered_name,trading_as,company_type,registration_number,client_number,owner_number,primary_number,main_office_number,owner_email,primary_email,physical_address_line1,physical_address_line2,city,province,area_code")
        .order("registered_name", { ascending: true, nullsFirst: false });

      if (!isMounted) return;
      if (error) {
        setClientRows([]);
        setClientLoadMessage(`Unable to load clients: ${error.message}`);
        return;
      }

      const mapped = (Array.isArray(data) ? data : [])
        .map((row): ClientOption => ({
          id: normalizeText(readRecordValue(row, "id")),
          registeredName: normalizeText(readRecordValue(row, "registered_name")),
          tradingAs: normalizeText(readRecordValue(row, "trading_as")),
          companyType: normalizeText(readRecordValue(row, "company_type")),
          registrationNumber: normalizeText(readRecordValue(row, "registration_number")),
          clientNumber: normalizeText(readRecordValue(row, "client_number")),
          contactNumber: normalizeText(readRecordValue(row, "primary_number") || readRecordValue(row, "owner_number") || readRecordValue(row, "main_office_number")),
          email: normalizeText(readRecordValue(row, "primary_email") || readRecordValue(row, "owner_email")),
          addressLine1: normalizeText(readRecordValue(row, "physical_address_line1")),
          addressLine2: normalizeText(readRecordValue(row, "physical_address_line2")),
          city: normalizeText(readRecordValue(row, "city")),
          province: normalizeText(readRecordValue(row, "province")),
          areaCode: normalizeText(readRecordValue(row, "area_code")),
        }))
        .filter((row) => row.id)
        .sort((left, right) => buildClientSearchLabel(left).localeCompare(buildClientSearchLabel(right), undefined, { sensitivity: "base" }));

      setClientRows(mapped);
      setClientLoadMessage(mapped.length > 0 ? "No matching clients found." : "No clients found.");
    };

    void loadClients();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!clientDetails.clientId || clientDetails.companyType) return;
    const selected = clientRows.find((client) => client.id === clientDetails.clientId);
    if (!selected?.companyType) return;
    setClientDetails((current) =>
      current.clientId === selected.id && !current.companyType
        ? { ...current, companyType: selected.companyType }
        : current,
    );
  }, [clientDetails.clientId, clientDetails.companyType, clientRows]);

  useEffect(() => {
    const defaultHearingPlace = getAbscondDefaultHearingPlace(clientDetails);
    if (!defaultHearingPlace) return;
    setHearingDetails((current) =>
      current.hearingPlace.trim() ? current : { ...current, hearingPlace: defaultHearingPlace },
    );
  }, [clientDetails.city, clientDetails.province]);

  const loadClientLogo = useCallback(async (clientId: string) => {
    const { data } = await supabaseReader
      .from("client_logos")
      .select("storage_path,logo_path,logo_url,company_logo_url")
      .eq("client_id", clientId)
      .maybeSingle();

    const logo = (data || {}) as LogoRecord;
    const candidate = normalizeText(logo.storage_path || logo.logo_path || logo.logo_url || logo.company_logo_url);
    return fetchLogoData(candidate);
  }, []);

  const handleClientSelect = useCallback(async (clientId: string) => {
    const selected = clientRows.find((client) => client.id === clientId);
    if (!selected) return;
    const isClientChanged = selected.id !== clientDetails.clientId;
    const previousDefaultHearingPlace = getAbscondDefaultHearingPlace(clientDetails);
    const nextDefaultHearingPlace = getAbscondDefaultHearingPlace(selected);
    setClientDetails({
      clientId: selected.id,
      clientName: formatCompanyName(selected),
      registeredName: selected.registeredName,
      tradingAs: selected.tradingAs,
      companyType: selected.companyType,
      registrationNumber: selected.registrationNumber,
      contactNumber: selected.contactNumber,
      email: selected.email,
      addressLine1: selected.addressLine1,
      addressLine2: selected.addressLine2,
      city: selected.city,
      province: selected.province,
      areaCode: selected.areaCode,
      logoDataUrl: "",
      logoLayout: null,
    });
    if (isClientChanged) {
      setEmployeeDetails(emptyEmployeeDetails);
      setHearingDetails({ ...emptyHearingDetails, hearingPlace: nextDefaultHearingPlace });
      setPreviewEdits({});
      setIsFinished(false);
      setIsPreviewEditable(false);
    } else {
      setHearingDetails((current) => {
        const currentHearingPlace = normalizeText(current.hearingPlace);
        if (!nextDefaultHearingPlace || (currentHearingPlace && currentHearingPlace !== previousDefaultHearingPlace)) {
          return current;
        }
        return { ...current, hearingPlace: nextDefaultHearingPlace };
      });
    }

    const logo = await loadClientLogo(selected.id);
    setClientDetails((current) =>
      current.clientId === selected.id
        ? {
            ...current,
            logoDataUrl: logo.dataUrl,
            logoLayout: logo.layout,
          }
        : current,
    );
  }, [clientDetails, clientRows, loadClientLogo]);

  const updateEmployee = useCallback((field: keyof EmployeeDetails, value: string) => {
    setEmployeeDetails((current) => ({ ...current, [field]: value }));
  }, []);

  const updateHearing = useCallback((field: keyof HearingDetails, value: string | string[]) => {
    setHearingDetails((current) => ({ ...current, [field]: value }));
  }, []);

  const updatePreviewEdit = useCallback((field: string, value: string) => {
    setPreviewEdits((current) => {
      const next = { ...current };
      const trimmed = value.trim();
      if (trimmed) {
        next[field] = trimmed;
      } else {
        delete next[field];
      }
      return next;
    });
  }, []);

  const employeeStepComplete =
    Boolean(employeeDetails.employeeName.trim()) &&
    Boolean(employeeDetails.employeeSurname.trim()) &&
    Boolean(employeeDetails.addressLine1.trim()) &&
    Boolean(employeeDetails.city.trim()) &&
    Boolean(employeeDetails.province.trim()) &&
    Boolean(employeeDetails.areaCode.trim());

  const hearingStepComplete =
    Boolean(hearingDetails.absentFrom.trim()) &&
    Boolean(hearingDetails.hearingDate.trim()) &&
    Boolean(hearingDetails.hearingTime.trim()) &&
    Boolean(hearingDetails.hearingPlace.trim()) &&
    hearingDetails.issuingMethods.length > 0;

  const handleDownloadPdf = useCallback(() => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    const rightX = pageWidth - margin;
    const bodyFontSize = 10;
    const bodyLineHeight = 5.2;
    const companyNameDisplay = getAbscondClientDisplayName(clientDetails);
    const tradingNameDisplay = normalizeText(clientDetails.tradingAs);
    const clientLocationLine = [clientDetails.city, clientDetails.province].map(normalizeText).filter(Boolean).join(", ");
    const pdfPhoneIconDataUrl = createAbscondPdfPhoneIconDataUrl();
    const pdfMailIconDataUrl = createAbscondPdfMailIconDataUrl();
    const companyInfoRows = [
      { text: companyNameDisplay, icon: null },
      { text: tradingNameDisplay ? `t/a ${tradingNameDisplay}` : "", icon: null },
      { text: normalizeText(clientDetails.addressLine1), icon: null },
      { text: normalizeText(clientDetails.addressLine2), icon: null },
      { text: clientLocationLine, icon: null },
      { text: normalizeText(clientDetails.areaCode), icon: null },
      { text: normalizeText(clientDetails.contactNumber), icon: "phone" as const },
      { text: normalizeText(clientDetails.email), icon: "email" as const },
    ].filter(
      (row): row is { text: string; icon: "phone" | "email" | null } => Boolean(row.text),
    );
    const employeeFullName = getAbscondEmployeeFullName(employeeDetails) || previewLine;
    const employeeCityProvince = [employeeDetails.city, employeeDetails.province].map(normalizeText).filter(Boolean).join(", ");
    const employeeAddressLines = [
      employeeDetails.addressLine1,
      employeeDetails.addressLine2,
      employeeCityProvince,
      employeeDetails.areaCode,
    ].map(normalizeText).filter(Boolean);
    const issueDateDisplay = formatLetterDate(getTodayDateValue());
    const issuingMethodsDisplay = hearingDetails.issuingMethods.length > 0
      ? hearingDetails.issuingMethods.map((method) => method.toUpperCase()).join(" / ")
      : previewLine;
    const footerCompanyLine = tradingNameDisplay ? `${companyNameDisplay} t/a ${tradingNameDisplay}` : companyNameDisplay;
    const footerLocationLine = [clientDetails.city, clientDetails.province, clientDetails.areaCode].map(normalizeText).filter(Boolean).join(", ");
    const footerContactLine = [clientDetails.contactNumber, clientDetails.email].map(normalizeText).filter(Boolean).join(" | ");
    const secondPageFooterLines = [footerCompanyLine, footerLocationLine, footerContactLine].filter(Boolean);
    const employeeInitialSurname = [
      normalizeText(employeeDetails.employeeName).charAt(0),
      normalizeText(employeeDetails.employeeSurname),
    ].filter(Boolean).join(" ");
    const footerDocumentLabel = employeeInitialSurname
      ? `Abscondment - ${employeeInitialSurname}`
      : "Abscondment";
    const paragraphs = getAbscondNoticeParagraphs(hearingDetails, previewEdits);
    const hearingRights = getAbscondHearingRights(previewEdits);

    type PdfTextToken = { text: string; bold: boolean };

    const drawJustifiedTextLine = (line: string, x: number, y: number, maxWidth: number) => {
      const words = line.trim().split(/\s+/).filter(Boolean);
      if (words.length <= 1) {
        doc.text(line, x, y);
        return;
      }
      const wordsWidth = words.reduce((total, word) => total + doc.getTextWidth(word), 0);
      const gapWidth = (maxWidth - wordsWidth) / (words.length - 1);
      let cursorX = x;
      words.forEach((word, index) => {
        doc.text(word, cursorX, y);
        cursorX += doc.getTextWidth(word) + (index < words.length - 1 ? gapWidth : 0);
      });
    };

    const getTokenWidth = (token: PdfTextToken) => {
      doc.setFont("helvetica", token.bold ? "bold" : "normal");
      return doc.getTextWidth(token.text);
    };

    const drawTokenLine = (tokens: PdfTextToken[], x: number, y: number, maxWidth: number, justify: boolean) => {
      if (tokens.length === 0) return;
      const spaceWidth = doc.getTextWidth(" ");
      const wordsWidth = tokens.reduce((total, token) => total + getTokenWidth(token), 0);
      const gapWidth = justify && tokens.length > 1 ? (maxWidth - wordsWidth) / (tokens.length - 1) : spaceWidth;
      let cursorX = x;
      tokens.forEach((token, index) => {
        doc.setFont("helvetica", token.bold ? "bold" : "normal");
        doc.text(token.text, cursorX, y);
        cursorX += doc.getTextWidth(token.text) + (index < tokens.length - 1 ? gapWidth : 0);
      });
    };

    const drawWrappedText = (text: string, x: number, y: number, maxWidth: number, options?: { bold?: boolean; align?: "left" | "right" | "center" | "justify" }) => {
      doc.setFont("helvetica", options?.bold ? "bold" : "normal");
      const lines = doc.splitTextToSize(text, maxWidth) as string[];
      lines.forEach((line, index) => {
        const lineY = y + index * bodyLineHeight;
        if (options?.align === "justify" && index < lines.length - 1) {
          drawJustifiedTextLine(line, x, lineY, maxWidth);
          return;
        }
        doc.text(line, x, lineY, { align: options?.align === "justify" ? "left" : options?.align });
      });
      return y + lines.length * bodyLineHeight;
    };

    const drawBoldSegmentsParagraph = (text: string, emphasis: Array<string>, x: number, y: number, maxWidth: number) => {
      const targets = emphasis.map(normalizeText).filter(Boolean);
      if (targets.length === 0) return drawWrappedText(text, x, y, maxWidth, { align: "justify" });
      const escaped = targets.map((target) => target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      const pattern = new RegExp(`(${escaped.join("|")})`, "g");
      const tokens: PdfTextToken[] = [];
      text.split(pattern).filter((part) => part.length > 0).forEach((part) => {
        const isBold = targets.includes(part);
        part.split(/\s+/).filter(Boolean).forEach((word) => {
          tokens.push({ text: word, bold: isBold });
        });
      });
      const lines: PdfTextToken[][] = [];
      let currentLine: PdfTextToken[] = [];
      let currentWidth = 0;
      const spaceWidth = doc.getTextWidth(" ");
      tokens.forEach((token) => {
        const tokenWidth = getTokenWidth(token);
        const nextWidth = currentLine.length === 0 ? tokenWidth : currentWidth + spaceWidth + tokenWidth;
        if (currentLine.length > 0 && nextWidth > maxWidth) {
          lines.push(currentLine);
          currentLine = [token];
          currentWidth = tokenWidth;
          return;
        }
        currentLine.push(token);
        currentWidth = nextWidth;
      });
      if (currentLine.length > 0) lines.push(currentLine);
      lines.forEach((line, index) => {
        drawTokenLine(line, x, y + index * bodyLineHeight, maxWidth, index < lines.length - 1);
      });
      return y + lines.length * bodyLineHeight;
    };

    const drawFirstPageHeader = () => {
      const y = 12;
      const headerTop = y;
      const drawRightAlignedText = (text: string, x: number, top: number, opts?: { bold?: boolean; size?: number }) => {
        doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
        doc.setFontSize(opts?.size ?? 8.5);
        doc.text(text, x, top, { align: "right" });
      };
      const drawHeaderIcon = (kind: "phone" | "email", xRight: number, baselineY: number) => {
        const dataUrl = kind === "phone" ? pdfPhoneIconDataUrl : pdfMailIconDataUrl;
        if (!dataUrl) return;
        try {
          doc.addImage(dataUrl, "PNG", xRight - 3.6, baselineY - 2.35, 2.6, 2.6);
        } catch {
          // Keep generating if a header icon cannot be embedded.
        }
      };

      if (clientDetails.logoDataUrl) {
        try {
          const imageType = clientDetails.logoDataUrl.includes("image/jpeg") ? "JPEG" : "PNG";
          const imageProps = doc.getImageProperties(clientDetails.logoDataUrl);
          const ratio = imageProps.width / imageProps.height;
          const baseTargetHeight = getPdfLogoTargetHeight(clientDetails.logoLayout);
          const isCompactStackedLogo = ratio <= 1.2;
          const useStackedLogoSizing = clientDetails.logoLayout === "vertical" || isCompactStackedLogo;
          const targetLogoHeight = useStackedLogoSizing ? Math.max(baseTargetHeight, 25.5) : Math.max(baseTargetHeight, 18);
          const maxLogoWidth = useStackedLogoSizing ? 38 : 72;
          let logoHeight = targetLogoHeight;
          let logoWidth = logoHeight * ratio;
          if (logoWidth > maxLogoWidth) {
            const scale = maxLogoWidth / logoWidth;
            logoWidth = maxLogoWidth;
            logoHeight *= scale;
          }
          doc.addImage(clientDetails.logoDataUrl, imageType, margin, y, logoWidth, logoHeight, undefined, "FAST");
        } catch {
          // Keep generating even if logo rendering fails.
        }
      }

      let headerY = headerTop + 3;
      companyInfoRows.forEach((row) => {
        const isRegistered = row.text === companyNameDisplay;
        drawRightAlignedText(row.text, rightX, headerY, { bold: isRegistered, size: isRegistered ? 8.5 : 8 });
        if (row.icon) {
          const textWidth = doc.getTextWidth(row.text);
          drawHeaderIcon(row.icon, rightX - textWidth - 0.6, headerY);
        }
        headerY += row.text === (tradingNameDisplay ? `t/a ${tradingNameDisplay}` : "") ? 4.2 : 3.5;
      });

      const dividerY = Math.max(y + 20, headerY + 1);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.25);
      doc.line(margin, dividerY, rightX, dividerY);
      doc.setDrawColor(0, 0, 0);
      return dividerY + 6;
    };

    const drawFooter = () => {
      const totalPages = doc.getNumberOfPages();
      const dividerY = pageHeight - 23;
      const footerTextY = dividerY + 4.5;
      const footerLineGap = 3.7;
      const generatedByPrefix = "Document generated by ";
      const generatedByUrl = "www.llasa.co.za";
      const generatedByY = pageHeight - 5.5;

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        doc.setPage(pageNumber);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.line(margin, dividerY, rightX, dividerY);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text(footerDocumentLabel, margin, footerTextY);
        doc.text(`Page ${pageNumber} of ${totalPages}`, rightX, footerTextY, { align: "right" });
        if (pageNumber === 2) {
          secondPageFooterLines.forEach((line, index) => {
            doc.setFont("helvetica", index === 0 ? "bold" : "normal");
            doc.text(line, pageWidth / 2, footerTextY + index * footerLineGap, { align: "center" });
          });
          doc.setFont("helvetica", "normal");
        }

        doc.setFontSize(6.5);
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
        doc.setTextColor(0, 0, 0);
      }
    };

    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodyFontSize);
    let y = drawFirstPageHeader();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodyFontSize);
    doc.text(issueDateDisplay, rightX, y, { align: "right" });
    y += 12;
    doc.text("TO:", margin, y);
    doc.setFont("helvetica", "bold");
    doc.text(employeeFullName.toUpperCase(), margin + 12, y);
    y += bodyLineHeight;
    employeeAddressLines.forEach((line) => {
      doc.text(line.toUpperCase(), margin + 12, y);
      y += bodyLineHeight;
    });
    doc.setFont("helvetica", "bold");
    doc.text(issuingMethodsDisplay, rightX, y + 2, { align: "right" });
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.text("Dear Sir / Madam", margin, y);
    y += 12;
    doc.setFont("helvetica", "bold");
    doc.text("RE: ABSCONDMENT FROM WORK AND NOTICE OF HEARING", margin, y);
    doc.line(margin, y + 0.8, margin + doc.getTextWidth("RE: ABSCONDMENT FROM WORK AND NOTICE OF HEARING"), y + 0.8);
    y += 12;
    paragraphs.forEach((paragraph) => {
      y = paragraph.emphasis
        ? drawBoldSegmentsParagraph(paragraph.text, paragraph.emphasis, margin, y, contentWidth)
        : drawWrappedText(paragraph.text, margin, y, contentWidth, { align: "justify" });
      y += 4;
    });
    y += 2;
    y = drawWrappedText("Your rights in respect of the hearing are as follows:", margin, y, contentWidth);
    y += 4;
    hearingRights.slice(0, abscondFirstPageRightsCount).forEach((right) => {
      doc.text("-", margin + 4, y);
      y = drawWrappedText(right, margin + 10, y, contentWidth - 10, { align: "justify" });
      y += 1.5;
    });

    doc.addPage();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodyFontSize);
    y = 24;
    hearingRights.slice(abscondFirstPageRightsCount).forEach((right) => {
      doc.text("-", margin + 4, y);
      y = drawWrappedText(right, margin + 10, y, contentWidth - 10, { align: "justify" });
      y += 1.5;
    });
    y += 8;
    y = drawWrappedText(previewEdits.closing ?? "We trust you find the above in order.", margin, y, contentWidth);
    y += 10;
    doc.text("Yours sincerely", margin, y);
    y += 22;
    doc.line(margin, y, margin + 45, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.text("MANAGEMENT", margin, y);
    drawFooter();

    const safeEmployeeName = sanitizeAbscondPdfSegment(employeeFullName, "employee");
    const safeClientName = sanitizeAbscondPdfSegment(companyNameDisplay, "client");
    doc.save(`abscondment-hearing-notice-${safeClientName}-${safeEmployeeName}.pdf`);
  }, [clientDetails, employeeDetails, hearingDetails, previewEdits]);

  const stepMeta = useMemo(
    () => ({
      steps,
      activeStep: isFinished ? 3 : activeStep,
      icons: stepIcons,
      canGoNext:
        isFinished ||
        (!isFinished &&
          (activeStep === 0
          ? Boolean(clientDetails.clientId)
          : activeStep === 1
            ? employeeStepComplete
            : activeStep === 2
              ? hearingStepComplete
              : false)),
      canGoBack: isFinished || activeStep > 0,
      canSelectStep: (index: number) => {
        if (index < 0 || index > 3) return false;
        if (isFinished) return true;
        if (activeStep === 0) return index === 0;
        if (activeStep === 1) return index <= 1;
        if (activeStep === 2) return index <= 2;
        return false;
      },
      onNext: () => {
        if (isFinished) {
          handleDownloadPdf();
          return;
        }
        if (activeStep === 0 && !clientDetails.clientId) return;
        if (activeStep === 1 && !employeeStepComplete) return;
        if (activeStep === 2 && !hearingStepComplete) return;
        if (activeStep < 2) {
          setActiveStep((current) => current + 1);
          return;
        }
        setIsFinished(true);
      },
      onBack: () => {
        if (isFinished) {
          setIsFinished(false);
          return;
        }
        setActiveStep((current) => Math.max(0, current - 1));
      },
      onStepSelect: (index: number) => {
        if (index < 0 || index > 3) return;
        if (!isFinished && activeStep === 0 && index !== 0) return;
        if (!isFinished && activeStep === 1 && index > 1) return;
        if (!isFinished && activeStep === 2 && index > 2) return;
        setIsFinished(false);
        setActiveStep(Math.min(index, 2));
      },
      onClear: () => {
        if (isFinished) {
          setIsPreviewEditable((current) => !current);
          return;
        }
        setIsFinished(false);
        if (activeStep === 0) {
          setClientDetails(emptyClientDetails);
          setClientSearchOpen(false);
          return;
        }
        if (activeStep === 1) {
          setEmployeeDetails(emptyEmployeeDetails);
          return;
        }
        if (activeStep === 2) {
          setHearingDetails({ ...emptyHearingDetails, hearingPlace: getAbscondDefaultHearingPlace(clientDetails) });
        }
      },
      isFinished,
      isPreviewEditable,
      supportsPreviewEditToggle: true,
      supportsResetAtFirstStep: activeStep === 0 && Boolean(clientDetails.clientId),
    }),
    [activeStep, clientDetails.clientId, employeeStepComplete, handleDownloadPdf, hearingStepComplete, isFinished, isPreviewEditable],
  );

  useEffect(() => {
    onStepMetaChange?.(stepMeta);
  }, [onStepMetaChange, stepMeta]);

  useEffect(() => {
    onDraftStateChange?.({
      activeStep,
      isFinished,
      isPreviewEditable,
      clientDetails,
      employeeDetails,
      hearingDetails,
      previewEdits,
    } satisfies AbscondHearingDraftState);
  }, [activeStep, clientDetails, employeeDetails, hearingDetails, isFinished, isPreviewEditable, onDraftStateChange, previewEdits]);

  const content = (
    <AbscondHearingNoticeContent
      activeStep={activeStep}
      isFinished={isFinished}
      isPreviewEditable={isPreviewEditable}
      clients={clientRows}
      clientLoadMessage={clientLoadMessage}
      clientSearchOpen={clientSearchOpen}
      setClientSearchOpen={setClientSearchOpen}
      clientDetails={clientDetails}
      employeeDetails={employeeDetails}
      hearingDetails={hearingDetails}
      previewEdits={previewEdits}
      onClientSelect={handleClientSelect}
      onRemoveLogo={() => setClientDetails((current) => ({ ...current, logoDataUrl: "", logoLayout: null }))}
      onEmployeeChange={updateEmployee}
      onHearingChange={updateHearing}
      onPreviewEditChange={updatePreviewEdit}
      hearingDateRef={hearingDateRef}
      absentFromDateRef={absentFromDateRef}
    />
  );

  if (embedded) return content;
  return <DashboardLayout profileSubtitleMode="company">{content}</DashboardLayout>;
};

export default AbscondHearingNoticeGenerator;
