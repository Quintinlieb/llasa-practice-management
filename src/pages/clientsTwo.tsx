import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BuildingOffice2Icon, BuildingOfficeIcon } from "@heroicons/react/24/outline";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { read, utils } from "xlsx";
import { Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Download, FileSpreadsheet, Paperclip, Pencil, Plus, Search, Trash2, Upload, User, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const clientLogoTable = () => (supabase as any).from("client_logos");
const agreementRecordTable = () => (supabase as any).from("membership_contracts");
const SLA_RECORD_TYPE = "Service Level Agreement";
const CLIENTS_TABLE_PAGE_SIZE = 25;
const CLIENTS_TABLE_VISIBLE_ROWS = 18;
const FILE_NOTE_EDIT_TAG_REGEX =
  /\s*(?:\((Edited by .* on [^)]+)\)|(Edited by .* on .+?(?:\s+at\s+\d{1,2}:\d{2}\s*[AP]M)?))\s*$/i;
const formatDisplayDate = (value: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "--";
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return trimmed;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};
const formatDisplayTime = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(String(value || "").trim());
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
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
    const day = Number(slashDate[1]);
    const month = Number(slashDate[2]);
    const year = Number(slashDate[3]);
    parsedDate = new Date(year, month - 1, day);
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
const cropClientLogoPadding = (dataUrl: string): Promise<string> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const sourceWidth = img.naturalWidth || img.width;
      const sourceHeight = img.naturalHeight || img.height;
      if (!sourceWidth || !sourceHeight) {
        resolve(dataUrl);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(dataUrl);
        return;
      }

      context.drawImage(img, 0, 0, sourceWidth, sourceHeight);
      const pixels = context.getImageData(0, 0, sourceWidth, sourceHeight).data;

      let left = sourceWidth;
      let top = sourceHeight;
      let right = -1;
      let bottom = -1;

      for (let y = 0; y < sourceHeight; y++) {
        for (let x = 0; x < sourceWidth; x++) {
          const index = (y * sourceWidth + x) * 4;
          const r = pixels[index];
          const g = pixels[index + 1];
          const b = pixels[index + 2];
          const a = pixels[index + 3];

          const isTransparent = a < 18;
          const isNearWhite = r > 246 && g > 246 && b > 246;
          if (isTransparent || isNearWhite) continue;

          if (x < left) left = x;
          if (y < top) top = y;
          if (x > right) right = x;
          if (y > bottom) bottom = y;
        }
      }

      if (right < left || bottom < top) {
        resolve(dataUrl);
        return;
      }

      const padding = Math.max(1, Math.round(Math.min(sourceWidth, sourceHeight) * 0.025));
      const cropX = Math.max(0, left - padding);
      const cropY = Math.max(0, top - padding);
      const cropWidth = Math.min(sourceWidth - cropX, right - left + 1 + padding * 2);
      const cropHeight = Math.min(sourceHeight - cropY, bottom - top + 1 + padding * 2);

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
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });

const clientsTableCacheKey = "clients:table-cache";
const clientBulkTemplateSheetName = "Client Table";
const clientBulkTemplateListsSheetName = "Lists";
const clientBulkTemplateHeaderRowIndex = 2;
const clientBulkTemplateFirstDataRowIndex = clientBulkTemplateHeaderRowIndex + 1;
const clientBulkTemplateMaxRows = 200;
const clientBulkTemplateColumns = [
  "Registered Name",
  "Trading As",
  "Company Type",
  "Registration Number",
  "VAT Number",
  "Industry",
  "Group",
  "Bargaining Council",
  "Primary Contact",
  "Primary Number",
  "Primary Email",
  "Address Line 1",
  "Address Line 2",
  "City",
  "Province",
  "Area Code",
  "Labour Relations (LR)",
  "Employment Equity (EE)",
  "Payroll (PR)",
  "Occupational Health and Safety (OHS)",
] as const;

type BulkClientImportRow = {
  sourceRowNumber: number;
  registeredName: string;
  tradingAs: string;
  companyType: string;
  registrationNumber: string;
  vatNumber: string;
  industry: string;
  groupName: string;
  bargainingCouncil: string;
  primaryContact: string;
  primaryNumber: string;
  primaryEmail: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  areaCode: string;
  labourRelations: string;
  employmentEquity: string;
  payroll: string;
  occupationalHealthAndSafety: string;
};

const normalizeWorksheetHeader = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");

const normalizeTradingNameKey = (value: string) => normalizeWorksheetHeader(value);

const normalizeYesNoValue = (value: string) => {
  const normalized = normalizeWorksheetHeader(value);
  if (normalized === "yes") return "Yes";
  if (normalized === "no") return "No";
  return "";
};

const arrayBufferToDataUrl = (buffer: ArrayBuffer, mimeType: string) => {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
};

const loadCachedClientRows = () => {
  try {
    const raw = sessionStorage.getItem(clientsTableCacheKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveCachedClientRows = (rows: any[]) => {
  try {
    sessionStorage.setItem(clientsTableCacheKey, JSON.stringify(rows));
  } catch {
    // ignore storage errors
  }
};

const ClientsTwo = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [clientTablePage, setClientTablePage] = useState(1);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [isBulkClientOpen, setIsBulkClientOpen] = useState(false);
  const [newClientStep, setNewClientStep] = useState<1 | 2 | 3>(1);
  const startDateInputRef = useRef<HTMLInputElement | null>(null);
  const editStartDateInputRef = useRef<HTMLInputElement | null>(null);
  const clientLogoFileInputRef = useRef<HTMLInputElement | null>(null);
  const slaFileInputRef = useRef<HTMLInputElement | null>(null);
  const bulkClientUploadInputRef = useRef<HTMLInputElement | null>(null);

  const [clientDetailsForm, setClientDetailsForm] = useState({
    registeredName: "",
    tradingAs: "",
    companyType: "",
    registrationNumber: "",
    vatNumber: "",
    owner: "",
    telCell: "",
    email: "",
  });
  const [membershipForm, setMembershipForm] = useState({
    clientNumber: "",
    startDate: "",
    renewalDate: "",
    paymentCycle: "",
    memberTypes: [] as string[],
    lrBillingCycle: "",
    eeBillingCycle: "",
    prBillingCycle: "",
    hsBillingCycle: "",
  });
  const [addressForm, setAddressForm] = useState({
    line1: "",
    line2: "",
    city: "",
    province: "",
    areaCode: "",
  });
  const [clientRows, setClientRows] = useState<any[]>(() => loadCachedClientRows());
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [isParsingBulkClients, setIsParsingBulkClients] = useState(false);
  const [isImportingBulkClients, setIsImportingBulkClients] = useState(false);
  const [bulkClientDragActive, setBulkClientDragActive] = useState(false);
  const [bulkClientFileName, setBulkClientFileName] = useState("");
  const [bulkClientParsedRows, setBulkClientParsedRows] = useState<BulkClientImportRow[]>([]);
  const [selectedClientRow, setSelectedClientRow] = useState<any | null>(null);
  const [isClientEditMode, setIsClientEditMode] = useState(false);
  const [isSavingClientEdit, setIsSavingClientEdit] = useState(false);
  const [isSlaUploading, setIsSlaUploading] = useState(false);
  const [slaRecordByClient, setslaRecordByClient] = useState<Record<string, { id: string; fileName: string; fileUrl: string } | null>>({});
  const [pendingSlaFile, setPendingSlaFile] = useState<File | null>(null);
  const [pendingSlaFileName, setPendingSlaFileName] = useState("");
  const [isClientLogoUploading, setIsClientLogoUploading] = useState(false);
  const [clientLogoPreviewByClient, setClientLogoPreviewByClient] = useState<Record<string, string>>({});
  const [clientLogoPathByClient, setClientLogoPathByClient] = useState<Record<string, string>>({});
  const [groupOptions, setGroupOptions] = useState<Array<{ id: string; group_name: string }>>([]);
  const [isGroupPickerOpen, setIsGroupPickerOpen] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [isIndustryPickerOpen, setIsIndustryPickerOpen] = useState(false);
  const [industrySearchQuery, setIndustrySearchQuery] = useState("");
  const [isCouncilPickerOpen, setIsCouncilPickerOpen] = useState(false);
  const [councilSearchQuery, setCouncilSearchQuery] = useState("");
  const [isStatusChangeOpen, setIsStatusChangeOpen] = useState(false);
  const [pendingStatusSelection, setPendingStatusSelection] = useState("");
  const [currentUserDisplayName, setCurrentUserDisplayName] = useState("");
  const [currentUserSubuserRole, setCurrentUserSubuserRole] = useState("");
  const [currentUserIsSubuser, setCurrentUserIsSubuser] = useState(false);
  const [clientFileNotes, setClientFileNotes] = useState<any[]>([]);
  const [clientFileNotesSearchQuery, setClientFileNotesSearchQuery] = useState("");
  const [isNotesLoading, setIsNotesLoading] = useState(false);
  const [isFileNoteDialogOpen, setIsFileNoteDialogOpen] = useState(false);
  const [isSavingFileNote, setIsSavingFileNote] = useState(false);
  const [editingFileNoteId, setEditingFileNoteId] = useState<string | null>(null);
  const [isFileNotePreviewOpen, setIsFileNotePreviewOpen] = useState(false);
  const [fileNotePreviewContent, setFileNotePreviewContent] = useState("");
  const [fileNotePreviewEditTag, setFileNotePreviewEditTag] = useState("");
  const [fileNotePreviewUpdatedAt, setFileNotePreviewUpdatedAt] = useState("");
  const [fileNoteForm, setFileNoteForm] = useState({
    noteDate: "",
    noteContent: "",
    noteUserName: "",
  });
  const [clientEditForm, setClientEditForm] = useState({
    companyName: "",
    tradingAs: "",
    registrationNumber: "",
    vatNumber: "",
    companyType: "",
    industry: "",
    bargainingCouncil: "",
    groupName: "None",
    groupId: "",
    contactPerson: "",
    contactNumber: "",
    ownerEmail: "",
    primaryName: "",
    primaryJobTitle: "",
    primaryNumber: "",
    primaryEmail: "",
    secondaryName: "",
    secondaryJobTitle: "",
    secondaryNumber: "",
    secondaryEmail: "",
    email: "",
    physicalLine1: "",
    physicalLine2: "",
    physicalCity: "",
    physicalProvince: "",
    physicalAreaCode: "",
    postalLine1: "",
    postalLine2: "",
    postalCity: "",
    postalProvince: "",
    postalAreaCode: "",
    clientNumber: "",
    startDate: "",
    renewalDate: "",
    agreement: "",
    memberTypes: [] as string[],
    billingCycle: "",
    lrBillingCycle: "",
    eeBillingCycle: "",
    prBillingCycle: "",
    hsBillingCycle: "",
    lrRetainer: "",
    eeRetainer: "",
    prRetainer: "",
    hsRetainer: "",
    status: "",
  });

  const isStepOneComplete = Boolean(
    clientDetailsForm.registeredName.trim() &&
      clientDetailsForm.companyType.trim() &&
      clientDetailsForm.registrationNumber.trim() &&
      clientDetailsForm.owner.trim() &&
      clientDetailsForm.telCell.trim() &&
      clientDetailsForm.email.trim(),
  );
  const isStepTwoComplete = Boolean(
      membershipForm.clientNumber.trim() &&
      membershipForm.startDate.trim() &&
      membershipForm.memberTypes.length > 0 &&
      membershipForm.memberTypes.every((serviceCode) => {
        const cycleField = getServiceBillingCycleField(serviceCode);
        return String((membershipForm as any)[cycleField] || "").trim().length > 0;
      }),
  );
  const isStepThreeComplete = Boolean(
    addressForm.line1.trim() &&
      addressForm.city.trim() &&
      addressForm.province.trim() &&
      addressForm.areaCode.trim(),
  );
  const getHighestClientNumberSequence = useCallback(() => {
    return clientRows.reduce((max, row) => {
      const value = String(row?.clientNumber ?? "").trim();
      const match = value.match(/^LL(\d+)$/i);
      if (!match) return max;
      const parsed = Number.parseInt(match[1], 10);
      return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
    }, 0);
  }, [clientRows]);
  const getNextAvailableClientNumber = useCallback(() => {
    const maxSeq = getHighestClientNumberSequence();
    const nextSeq = Math.max(1, maxSeq + 1);
    return `LL${String(nextSeq).padStart(5, "0")}`;
  }, [getHighestClientNumberSequence]);

  const resetNewClientForm = () => {
    setNewClientStep(1);
    setClientDetailsForm({
      registeredName: "",
      tradingAs: "",
      companyType: "",
      registrationNumber: "",
      vatNumber: "",
      owner: "",
      telCell: "",
      email: "",
    });
    setMembershipForm({
      clientNumber: getNextAvailableClientNumber(),
      startDate: "",
      renewalDate: "",
      paymentCycle: "",
      memberTypes: [],
      lrBillingCycle: "",
      eeBillingCycle: "",
      prBillingCycle: "",
      hsBillingCycle: "",
    });
    setAddressForm({
      line1: "",
      line2: "",
      city: "",
      province: "",
      areaCode: "",
    });
  };
  const resetBulkClientImport = useCallback(() => {
    setBulkClientFileName("");
    setBulkClientParsedRows([]);
    setBulkClientDragActive(false);
    if (bulkClientUploadInputRef.current) {
      bulkClientUploadInputRef.current.value = "";
    }
  }, []);
  useEffect(() => {
    if (!isNewClientOpen) return;
    setMembershipForm((prev) => ({
      ...prev,
      clientNumber: getNextAvailableClientNumber(),
    }));
  }, [getNextAvailableClientNumber, isNewClientOpen]);

  const handleNextStep = () => {
    if (newClientStep === 1 && !isStepOneComplete) return;
    if (newClientStep === 2 && !isStepTwoComplete) return;
    setNewClientStep((prev) => (prev < 3 ? ((prev + 1) as 1 | 2 | 3) : prev));
  };

  const canAccessStep = (step: 1 | 2 | 3) => {
    if (step === 1) return true;
    if (step === 2) return isStepOneComplete;
    return isStepOneComplete && isStepTwoComplete;
  };

  const goToStep = (step: 1 | 2 | 3) => {
    if (!canAccessStep(step)) return;
    setNewClientStep(step);
  };

  const formatDisplayDate = (value?: string) => {
    if (!value) return "";
    const [y, m, d] = value.split("-");
    if (!y || !m || !d) return value;
    return `${d}/${m}/${y}`;
  };
  const normalizeRetainerInput = (value: string) => {
    const digitsAndDots = value.replace(/[^0-9.]/g, "");
    const firstDotIndex = digitsAndDots.indexOf(".");
    if (firstDotIndex === -1) return digitsAndDots;
    const integerPart = digitsAndDots.slice(0, firstDotIndex);
    const decimalPart = digitsAndDots.slice(firstDotIndex + 1).replace(/\./g, "");
    return `${integerPart}.${decimalPart.slice(0, 2)}`;
  };
  const formatRetainerDisplay = (value?: string | number | null) => {
    const raw = String(value ?? "").trim();
    if (!raw || raw === "--") return "--";
    const numeric = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(numeric)) return "--";
    return `R ${numeric.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const dateToday = () => new Date().toISOString().slice(0, 10);
  const formatSlaDisplayName = (rawValue?: string | null) => {
    const raw = String(rawValue || "").trim();
    if (!raw) return "SLA.pdf";
    const base = decodeURIComponent(raw.split("/").pop() || raw);
    const withoutGeneratedPrefix = base
      .replace(
        /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-)+/i,
        "",
      )
      .replace(/^\d{10,}-/, "");
    const cleaned = withoutGeneratedPrefix.replace(/_/g, " ").replace(/\s+/g, " ").trim();
    return cleaned || "SLA.pdf";
  };
  const getNextRenewalDateFromStart = (startDate?: string) => {
    const raw = String(startDate || "").trim();
    if (!raw) return "";
    const parts = raw.split("-");
    if (parts.length !== 3) return "";
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (!month || !day) return "";

    const now = new Date();
    const currentYear = now.getFullYear();
    const thisYearDate = new Date(currentYear, month - 1, day);
    thisYearDate.setHours(0, 0, 0, 0);

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const targetYear = thisYearDate < today ? currentYear + 1 : currentYear;
    const result = new Date(targetYear, month - 1, day);

    const yyyy = result.getFullYear();
    const mm = String(result.getMonth() + 1).padStart(2, "0");
    const dd = String(result.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const openDatePicker = (input: HTMLInputElement | null) => {
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.focus();
      input.click();
    }
  };

  const stepOneDone = isStepOneComplete || newClientStep > 1;
  const stepTwoDone = isStepTwoComplete || newClientStep > 2;

  const stepCircleClass = (step: 1 | 2 | 3) => {
    const active = newClientStep === step;
    const done = step === 1 ? stepOneDone : step === 2 ? stepTwoDone : false;
    if (active || done) return "bg-[#3ec74a] text-white";
    return "bg-slate-400 text-white";
  };

  const stepLabelClass = (step: 1 | 2 | 3) => {
    if (newClientStep === step) return "text-slate-700";
    return "text-slate-500";
  };
  const addModalDropdownToneClass =
    "bg-white border-slate-300 hover:border-slate-500 data-[state=open]:border-black data-[state=open]:bg-white";
  const addModalFieldInputClass =
    "h-8 rounded border border-slate-200 bg-white !text-[11px] md:!text-[11px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] placeholder:!text-slate-400 hover:border-blue-400 !focus-visible:border-[1px] !focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:bg-white disabled:text-slate-900 disabled:border-slate-200 disabled:opacity-100 disabled:cursor-default !h-[34px] !border-[0.5px] !border-slate-300 hover:!border-slate-500 focus:!border-black focus-visible:!border-black";
  const addModalFieldSelectTriggerClass =
    "h-8 rounded border border-slate-200 bg-white !text-[11px] md:!text-[11px] font-medium text-slate-900 shadow-none placeholder:!text-[10px] placeholder:!text-slate-400 hover:border-blue-400 !focus-visible:border-[1px] !focus-visible:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:bg-white disabled:text-slate-900 disabled:border-slate-200 disabled:opacity-100 disabled:cursor-default justify-between data-[placeholder]:text-slate-400 data-[placeholder]:text-xs !h-[34px] !border-[0.5px] !border-slate-300 hover:!border-slate-500 focus:!border-black focus-visible:!border-black data-[state=open]:!border-black !ring-0 !ring-offset-0 !outline-none !shadow-none focus:!ring-0 focus:!ring-offset-0 focus:!shadow-none focus:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0 focus-visible:!shadow-none focus-visible:!outline-none data-[state=open]:!ring-0 data-[state=open]:!ring-offset-0 data-[state=open]:!shadow-none data-[state=open]:!outline-none";
  const addModalSelectItemClass =
    "text-[11px] text-slate-700 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[highlighted]:bg-[#3eca44]/10 data-[highlighted]:text-[#2f9f35] [&_svg]:!text-[#2f9f35]";
  const membershipTypeOptions = [
    { label: "Labour Relations", value: "LR" },
    { label: "Employment Equity", value: "EE" },
    { label: "Payroll", value: "PR" },
    { label: "Occupational Health and Safety", value: "OHS" },
  ] as const;
  const membershipLabelByValue: Record<string, string> = {
    LR: "Labour Relations",
    EE: "Employment Equity",
    PR: "Payroll",
    OHS: "Health and Safety",
  };
  const statusReasonOptions = [
    "Active",
    "Suspended - Pending Payment",
    "Suspended - Pending Dispute",
    "Terminated - Close of Business",
    "Terminated - Sale of Business",
    "Terminated - Did not Renew",
    "Terminated - LLASA Contract Breach",
    "Terminated - Client Contract Breach",
    "Terminated - Requested Early Cancellation",
    "Terminated - Client Financial Problems",
  ] as const;
  function getServiceBillingCycleField(serviceCode: string) {
    return serviceCode === "LR"
      ? "lrBillingCycle"
      : serviceCode === "EE"
        ? "eeBillingCycle"
        : serviceCode === "PR"
          ? "prBillingCycle"
          : "hsBillingCycle";
  }
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
  const industryOptions = [
    "Agriculture, Forestry and Fishing",
    "Mining and Quarrying",
    "Manufacturing",
    "Electricity, Gas and Water Supply",
    "Construction",
    "Wholesale and Retail Trade",
    "Motor Trade and Repairs",
    "Accommodation and Food Services",
    "Transport and Logistics",
    "Storage and Warehousing",
    "Information and Communication Technology",
    "Financial and Insurance Services",
    "Real Estate Services",
    "Professional, Scientific and Technical Services",
    "Administrative and Support Services",
    "Public Administration and Government Services",
    "Education and Training",
    "Health and Social Work",
    "Arts, Entertainment and Recreation",
    "Personal and Household Services",
    "Security Services",
    "Cleaning and Facilities Management",
    "Fuel Retail and Service Stations",
    "Automotive Industry",
    "Engineering and Metal Industry",
    "Chemical Industry",
    "Clothing and Textile Industry",
    "Food and Beverage Manufacturing",
    "Restaurant, Catering and Fast Food Industry",
    "Road Freight and Logistics Industry",
    "Civil Engineering Industry",
    "Building and Construction Industry",
    "Private Security Industry",
    "Hairdressing, Beauty and Skincare Industry",
    "Furniture Manufacturing Industry",
    "Wood and Paper Industry",
    "Retail and FMCG Industry",
    "Agriculture and Farming",
    "Domestic Work and Household Employment",
  ] as const;
  const companyTypeOptions = [
    "Private Company ((Pty) Ltd)",
    "Public Company (Ltd)",
    "Personal Liability Company (Inc.)",
    "State-Owned Company (SOC Ltd)",
    "Non-Profit Company (NPC)",
    "Close Corporation (CC)",
    "Co-operative (Co-op)",
    "Sole Proprietor (SP)",
    "Partnership (Partnership)",
    "Business Trust (Trust)",
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
  const extractCouncilAbbreviation = (value: string | undefined) => {
    const raw = String(value || "").trim();
    if (!raw) return "--";
    const direct = bargainingCouncilOptions.find((option) => option.value === raw);
    if (direct) return direct.value;
    const match = raw.match(/\(([^)]+)\)\s*$/);
    if (match?.[1]) return match[1];
    return raw;
  };
  const tableRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return clientRows.filter((row) => {
      if (!q) return true;
      return [
        row.companyName,
        row.tradingAs,
        row.registrationNumber,
        row.contactPerson,
        row.contactNumber,
        row.email,
        row.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [clientRows, searchQuery]);
  const totalClientTablePages = Math.max(1, Math.ceil(tableRows.length / CLIENTS_TABLE_PAGE_SIZE));
  const currentClientTablePage = Math.min(clientTablePage, totalClientTablePages);
  const currentClientTableOffset = (currentClientTablePage - 1) * CLIENTS_TABLE_PAGE_SIZE;
  const paginatedTableRows = useMemo(
    () => tableRows.slice(currentClientTableOffset, currentClientTableOffset + CLIENTS_TABLE_PAGE_SIZE),
    [currentClientTableOffset, tableRows],
  );
  const clientTableRangeStart = tableRows.length === 0 ? 0 : currentClientTableOffset + 1;
  const clientTableRangeEnd = tableRows.length === 0 ? 0 : Math.min(currentClientTableOffset + CLIENTS_TABLE_PAGE_SIZE, tableRows.length);
  const allVisibleSelected = useMemo(
    () => paginatedTableRows.length > 0 && paginatedTableRows.every((row) => selectedClientIds.has(String(row.id))),
    [paginatedTableRows, selectedClientIds],
  );
  const selectedCount = selectedClientIds.size;
  const clientTablePageNumbers = useMemo(() => {
    if (totalClientTablePages <= 6) {
      return Array.from({ length: totalClientTablePages }, (_, index) => index + 1);
    }
    if (currentClientTablePage <= 3) {
      return [1, 2, 3, 4, "ellipsis", totalClientTablePages];
    }
    if (currentClientTablePage >= totalClientTablePages - 2) {
      return [1, "ellipsis", totalClientTablePages - 3, totalClientTablePages - 2, totalClientTablePages - 1, totalClientTablePages];
    }
    return [1, "ellipsis", currentClientTablePage - 1, currentClientTablePage, currentClientTablePage + 1, "ellipsis-2", totalClientTablePages];
  }, [currentClientTablePage, totalClientTablePages]);
  const filteredClientFileNotes = useMemo(() => {
    const q = clientFileNotesSearchQuery.trim().toLowerCase();
    if (!q) return clientFileNotes;
    return clientFileNotes.filter((note) =>
      [note.note_user_name, note.note_content]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [clientFileNotes, clientFileNotesSearchQuery]);
  const normalizedGroupSearch = groupSearchQuery.trim().toLowerCase();
  const filteredGroupOptions = useMemo(
    () =>
      groupOptions.filter((group) =>
        group.group_name.toLowerCase().includes(normalizedGroupSearch),
      ),
    [groupOptions, normalizedGroupSearch],
  );
  const filteredIndustryOptions = useMemo(() => {
    const q = industrySearchQuery.trim().toLowerCase();
    if (!q) return industryOptions;
    return industryOptions.filter((option) => option.toLowerCase().includes(q));
  }, [industrySearchQuery, industryOptions]);
  const filteredCouncilOptions = useMemo(() => {
    const q = councilSearchQuery.trim().toLowerCase();
    if (!q) return bargainingCouncilOptions;
    return bargainingCouncilOptions.filter(
      (option) =>
        option.value.toLowerCase().includes(q) ||
        option.label.toLowerCase().includes(q),
    );
  }, [councilSearchQuery, bargainingCouncilOptions]);
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
  const getCompanyNameDisplay = (registeredName: unknown, companyType: unknown) => {
    const rawName = String(registeredName || "").trim();
    if (!rawName) return "--";
    const typeValue = String(companyType || "").trim();
    const suffix = companyTypeSuffixByValue[typeValue] || "";
    if (!suffix) return rawName;
    const normalizedName = rawName.toLowerCase();
    const normalizedSuffix = suffix.toLowerCase();
    if (normalizedName.endsWith(normalizedSuffix)) return rawName;
    return `${rawName} ${suffix}`;
  };
  const normalizeImportedCompanyType = (value: string) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const normalized = normalizeWorksheetHeader(raw);
    const lookup: Record<string, string> = {
      "pty ltd": "Private Company ((Pty) Ltd)",
      "private company pty ltd": "Private Company ((Pty) Ltd)",
      "private company pty ltd ltd": "Private Company ((Pty) Ltd)",
      "cc": "Close Corporation (CC)",
      "close corporation cc": "Close Corporation (CC)",
      "close corporation": "Close Corporation (CC)",
      "public company ltd": "Public Company (Ltd)",
      ltd: "Public Company (Ltd)",
      "personal liability company inc": "Personal Liability Company (Inc.)",
      "inc": "Personal Liability Company (Inc.)",
      "state owned company soc ltd": "State-Owned Company (SOC Ltd)",
      "soc ltd": "State-Owned Company (SOC Ltd)",
      "non profit company npc": "Non-Profit Company (NPC)",
      npc: "Non-Profit Company (NPC)",
      "co operative co op": "Co-operative (Co-op)",
      "co op": "Co-operative (Co-op)",
      "sole proprietor sp": "Sole Proprietor (SP)",
      "sole proprietor": "Sole Proprietor (SP)",
      sp: "Sole Proprietor (SP)",
      partnership: "Partnership (Partnership)",
      trust: "Business Trust (Trust)",
      "business trust trust": "Business Trust (Trust)",
    };
    return lookup[normalized] || companyTypeOptions.find((option) => normalizeWorksheetHeader(option) === normalized) || raw;
  };
  const normalizeImportedBargainingCouncil = useCallback((value: string) => {
    const raw = String(value || "").trim();
    if (!raw) return "None";
    const normalized = normalizeWorksheetHeader(raw);
    if (normalized === "none") return "None";
    const directMatch = bargainingCouncilOptions.find(
      (option) =>
        normalizeWorksheetHeader(option.value) === normalized ||
        normalizeWorksheetHeader(option.label) === normalized,
    );
    return directMatch?.value || raw;
  }, [bargainingCouncilOptions]);
  const findExistingClientByTradingName = useCallback(async (tradingNameRaw: string) => {
    const tradingName = String(tradingNameRaw || "").trim();
    if (!tradingName) return null;
    const { data, error } = await (supabase as any)
      .from("clients")
      .select("id, trading_as, trading_name, member_types, lr_billing_cycle, ee_billing_cycle, pr_billing_cycle, hs_billing_cycle")
      .or(`trading_as.ilike.${tradingName},trading_name.ilike.${tradingName}`)
      .limit(50);
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    const normalizedTarget = normalizeTradingNameKey(tradingName);
    return (
      rows.find((row: any) => {
        const tradingAs = normalizeTradingNameKey(String(row?.trading_as || ""));
        const tradingAlias = normalizeTradingNameKey(String(row?.trading_name || ""));
        return tradingAs === normalizedTarget || tradingAlias === normalizedTarget;
      }) ?? null
    );
  }, []);
  const mapClientRow = (row: any) => ({
    id: row.id,
    companyName: row.registered_name || "--",
    companyNameDisplay: getCompanyNameDisplay(row.registered_name, row.company_type),
    tradingAs: row.trading_as || row.trading_name || "--",
    registrationNumber: row.registration_number || "--",
    vatNumber: row.vat_number || "--",
    companyType: row.company_type || "--",
    industry: row.industry || "--",
    bargainingCouncil: extractCouncilAbbreviation(row.bargaining_council),
    groupName: row.group_name || "None",
    groupId: row.group_id || "",
    contactPerson: row.primary_name || "--",
    contactNumber: row.primary_number || "--",
    ownerEmail: row.primary_email || "--",
    ownerContactPerson: row.owner_name || "--",
    ownerContactNumber: row.owner_number || "--",
    ownerContactEmail: row.owner_email || "--",
    primaryName: row.primary_name || "--",
    primaryJobTitle: row.primary_job_title || "--",
    primaryNumber: row.primary_number || "--",
    primaryEmail: row.primary_email || "--",
    secondaryName: row.secondary_name || "--",
    secondaryJobTitle: row.secondary_job_title || "--",
    secondaryNumber: row.secondary_number || "--",
    secondaryEmail: row.secondary_email || "--",
    physicalLine1: row.physical_address_line1 || "--",
    physicalLine2: row.physical_address_line2 || "--",
    physicalCity: row.city || "--",
    physicalProvince: row.province || "--",
    physicalAreaCode: row.area_code || "--",
    postalLine1: row.postal_address_line1 || "--",
    postalLine2: row.postal_address_line2 || "--",
    postalCity: row.postal_city || "--",
    postalProvince: row.postal_province || "--",
    postalAreaCode: row.postal_area_code || "--",
    email: row.primary_email || "--",
    status: row.status ? String(row.status).replace(/^./, (s) => s.toUpperCase()) : "Active",
    memberTypes: Array.isArray(row.member_types) ? row.member_types.filter(Boolean) : [],
    clientNumber: row.client_number || "--",
    startDate: row.start_date || "--",
    renewalDate: row.renewal_date || getNextRenewalDateFromStart(row.start_date) || "--",
    agreement: row.agreement || "--",
    billingCycle: row.membership_period || row.retainer_cycle || "--",
    lrBillingCycle: row.lr_billing_cycle || row.retainer_cycle || row.membership_period || "--",
    eeBillingCycle: row.ee_billing_cycle || row.retainer_cycle || row.membership_period || "--",
    prBillingCycle: row.pr_billing_cycle || row.retainer_cycle || row.membership_period || "--",
    hsBillingCycle: row.hs_billing_cycle || row.retainer_cycle || row.membership_period || "--",
    lrRetainer: row.lr_retainer || "--",
    eeRetainer: row.ee_retainer || "--",
    prRetainer: row.pr_retainer || "--",
    hsRetainer: row.hs_retainer || "--",
  });

  const fetchClients = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await (supabase as any)
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false, nullsFirst: false });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setClientRows((data ?? []).map(mapClientRow));
  }, [toast, user?.id]);
  const fetchClientGroups = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await (supabase as any)
      .from("client_groups")
      .select("id, group_name")
      .order("group_name", { ascending: true });
    if (error) return;
    setGroupOptions(data ?? []);
  }, [user?.id]);
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
      setCurrentUserIsSubuser(true);
      setCurrentUserSubuserRole(subuserRole);
      setCurrentUserDisplayName(subuserFullName);
      return;
    }
    setCurrentUserIsSubuser(false);
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
    (note: any) => {
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
  const canCurrentUserChangeStatus = useMemo(() => {
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
  const resetFileNoteForm = useCallback(() => {
    setFileNoteForm({
      noteDate: dateToday(),
      noteContent: "",
      noteUserName: resolveCurrentUserName(),
    });
    setEditingFileNoteId(null);
  }, [resolveCurrentUserName]);
  const fetchClientFileNotes = useCallback(async (clientId: string) => {
    if (!user?.id || !clientId) return;
    setIsNotesLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("client_file_notes")
        .select("*")
        .eq("client_id", clientId)
        .order("note_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      setClientFileNotes(data ?? []);
    } catch (error: any) {
      toast({ title: "Unable to load file notes", description: error?.message || "Load failed.", variant: "destructive" });
    } finally {
      setIsNotesLoading(false);
    }
  }, [toast, user?.id]);

  useEffect(() => {
    void fetchClients();
  }, [fetchClients]);
  useEffect(() => {
    setClientTablePage((prev) => Math.min(prev, totalClientTablePages));
  }, [totalClientTablePages]);
  useEffect(() => {
    setClientTablePage(1);
  }, [searchQuery]);
  useEffect(() => {
    saveCachedClientRows(clientRows);
  }, [clientRows]);
  useEffect(() => {
    void fetchClientGroups();
  }, [fetchClientGroups]);
  useEffect(() => {
    void fetchCurrentUserDisplayName();
  }, [fetchCurrentUserDisplayName]);
  useEffect(() => {
    if (!isFileNoteDialogOpen) return;
    if (editingFileNoteId) return;
    const resolved = resolveCurrentUserName();
    if (!resolved) return;
    setFileNoteForm((prev) => {
      if (!isFallbackActorName(prev.noteUserName)) return prev;
      if (prev.noteUserName === resolved) return prev;
      return { ...prev, noteUserName: resolved };
    });
  }, [editingFileNoteId, isFallbackActorName, isFileNoteDialogOpen, resolveCurrentUserName]);
  const fetchSlaContract = useCallback(async (clientId: string) => {
    if (!user?.id) return;
    const { data, error } = await agreementRecordTable()
      .select("id, file_url")
      .eq("client_id", clientId)
      .eq("contract_type", SLA_RECORD_TYPE)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return;
    if (!data) {
      setslaRecordByClient((prev) => ({ ...prev, [clientId]: null }));
      return;
    }
    const filePath = String((data as any).file_url || "").trim();
    const fileName = formatSlaDisplayName(filePath);
    setslaRecordByClient((prev) => ({ ...prev, [clientId]: { id: data.id, fileName, fileUrl: filePath } }));
  }, [user?.id]);
  useEffect(() => {
    if (!selectedClientRow?.id) return;
    void fetchSlaContract(selectedClientRow.id);
  }, [fetchSlaContract, selectedClientRow?.id]);
  useEffect(() => {
    if (!selectedClientRow?.id) {
      setClientFileNotes([]);
      return;
    }
    setClientFileNotesSearchQuery("");
    void fetchClientFileNotes(selectedClientRow.id);
  }, [fetchClientFileNotes, selectedClientRow?.id]);

  const parseBulkClientWorkbook = useCallback((fileData: ArrayBuffer) => {
    const workbook = read(fileData, { type: "array" });
    const sheet =
      workbook.Sheets[clientBulkTemplateSheetName] ??
      workbook.Sheets[workbook.SheetNames[0] ?? ""];
    if (!sheet) {
      throw new Error("No worksheet found in the uploaded file.");
    }

    const rows = utils.sheet_to_json<Array<string | number>>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    const headerRowIndex = rows.findIndex((row) =>
      row.some((cell) => normalizeWorksheetHeader(cell) === "registered name") &&
      row.some((cell) => normalizeWorksheetHeader(cell) === "company type"),
    );
    if (headerRowIndex === -1) {
      throw new Error("We could not find the client template header row.");
    }

    const headerRow = rows[headerRowIndex] ?? [];
    const findColumnIndex = (...aliases: string[]) => {
      const normalizedAliases = aliases.map((alias) => normalizeWorksheetHeader(alias));
      return headerRow.findIndex((cell) => normalizedAliases.includes(normalizeWorksheetHeader(cell)));
    };
    const valueAt = (row: Array<string | number>, ...aliases: string[]) => {
      const columnIndex = findColumnIndex(...aliases);
      if (columnIndex === -1) return "";
      return String(row[columnIndex] ?? "").trim();
    };

    return rows
      .slice(headerRowIndex + 1)
      .map((row, index) => ({
        sourceRowNumber: headerRowIndex + index + 2,
        registeredName: valueAt(row, "Registered Name"),
        tradingAs: valueAt(row, "Trading As"),
        companyType: normalizeImportedCompanyType(valueAt(row, "Company Type")),
        registrationNumber: valueAt(row, "Registration Number"),
        vatNumber: valueAt(row, "VAT Number"),
        industry: valueAt(row, "Industry"),
        groupName: valueAt(row, "Group"),
        bargainingCouncil: normalizeImportedBargainingCouncil(valueAt(row, "Bargaining Council")),
        primaryContact: valueAt(row, "Primary Contact", "Contact Person"),
        primaryNumber: valueAt(row, "Primary Number", "Contact Number").replace(/\D/g, "").slice(0, 10),
        primaryEmail: valueAt(row, "Primary Email", "Email").toLowerCase(),
        addressLine1: valueAt(row, "Address Line 1"),
        addressLine2: valueAt(row, "Address Line 2"),
        city: valueAt(row, "City"),
        province: valueAt(row, "Province"),
        areaCode: valueAt(row, "Area Code"),
        labourRelations: normalizeYesNoValue(valueAt(row, "Labour Relations (LR)", "Labour Relations", "LR")),
        employmentEquity: normalizeYesNoValue(valueAt(row, "Employment Equity (EE)", "Employment Equity", "EE")),
        payroll: normalizeYesNoValue(valueAt(row, "Payroll (PR)", "Payroll", "PR")),
        occupationalHealthAndSafety: normalizeYesNoValue(valueAt(row, "Occupational Health and Safety (OHS)", "Occupational Health and Safety", "OHS")),
      }))
      .filter((row) =>
        [
          row.registeredName,
          row.tradingAs,
          row.companyType,
          row.registrationNumber,
          row.vatNumber,
          row.industry,
          row.groupName,
          row.bargainingCouncil === "None" ? "" : row.bargainingCouncil,
          row.primaryContact,
          row.primaryNumber,
          row.primaryEmail,
          row.addressLine1,
          row.addressLine2,
          row.city,
          row.province,
          row.areaCode,
          row.labourRelations,
          row.employmentEquity,
          row.payroll,
          row.occupationalHealthAndSafety,
        ].some((value) => String(value || "").trim().length > 0),
      );
  }, [normalizeImportedBargainingCouncil, normalizeImportedCompanyType]);

  const handleBulkClientFileSelection = useCallback(async (file: File) => {
    setIsParsingBulkClients(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsedRows = parseBulkClientWorkbook(buffer);
      if (parsedRows.length === 0) {
        toast({
          title: "No rows found",
          description: "The file does not contain any populated client rows yet.",
          variant: "destructive",
        });
        resetBulkClientImport();
        return;
      }
      setBulkClientFileName(file.name);
      setBulkClientParsedRows(parsedRows);
      toast({
        title: "File ready",
        description: `${parsedRows.length} client row${parsedRows.length === 1 ? "" : "s"} loaded and ready to import.`,
      });
    } catch (error: any) {
      resetBulkClientImport();
      toast({
        title: "Could not read file",
        description: error?.message || "Please upload a valid Excel workbook based on the template.",
        variant: "destructive",
      });
    } finally {
      setIsParsingBulkClients(false);
      setBulkClientDragActive(false);
    }
  }, [parseBulkClientWorkbook, resetBulkClientImport, toast]);

  const handleBulkClientUploadInputChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleBulkClientFileSelection(file);
  }, [handleBulkClientFileSelection]);

  const handleDownloadBulkClientTemplate = useCallback(async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(clientBulkTemplateSheetName);
      const listSheet = workbook.addWorksheet(clientBulkTemplateListsSheetName);

      worksheet.properties.defaultRowHeight = 22;
      worksheet.views = [{ state: "frozen", ySplit: clientBulkTemplateHeaderRowIndex }];
      worksheet.columns = [
        { header: "Registered Name", key: "registeredName", width: 28 },
        { header: "Trading As", key: "tradingAs", width: 24 },
        { header: "Company Type", key: "companyType", width: 30 },
        { header: "Registration Number", key: "registrationNumber", width: 22 },
        { header: "VAT Number", key: "vatNumber", width: 20 },
        { header: "Industry", key: "industry", width: 28 },
        { header: "Group", key: "groupName", width: 24 },
        { header: "Bargaining Council", key: "bargainingCouncil", width: 28 },
        { header: "Primary Contact", key: "primaryContact", width: 22 },
        { header: "Primary Number", key: "primaryNumber", width: 18 },
        { header: "Primary Email", key: "primaryEmail", width: 28 },
        { header: "Address Line 1", key: "addressLine1", width: 24 },
        { header: "Address Line 2", key: "addressLine2", width: 24 },
        { header: "City", key: "city", width: 18 },
        { header: "Province", key: "province", width: 20 },
        { header: "Area Code", key: "areaCode", width: 14 },
        { header: "Labour Relations (LR)", key: "labourRelations", width: 22 },
        { header: "Employment Equity (EE)", key: "employmentEquity", width: 24 },
        { header: "Payroll (PR)", key: "payroll", width: 16 },
        { header: "Occupational Health and Safety (OHS)", key: "occupationalHealthAndSafety", width: 34 },
      ];

      worksheet.mergeCells("A1:T1");
      worksheet.getCell("A1").value = "LLASA - Multiple Client Upload";
      worksheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF17324D" } };
      worksheet.getCell("A1").alignment = { vertical: "middle", horizontal: "left" };
      worksheet.getRow(1).height = 24;

      const headerRow = worksheet.getRow(clientBulkTemplateHeaderRowIndex);
      clientBulkTemplateColumns.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = header;
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF3ECA44" },
        };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: "FFD1D5DB" } },
          left: { style: "thin", color: { argb: "FFD1D5DB" } },
          bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
          right: { style: "thin", color: { argb: "FFD1D5DB" } },
        };
      });
      headerRow.height = 24;

      const listTitleRow = listSheet.getRow(1);
      listTitleRow.getCell(1).value = "Company Type";
      listTitleRow.getCell(2).value = "Province";
      listTitleRow.getCell(3).value = "Industry";
      listTitleRow.getCell(4).value = "Group";
      listTitleRow.getCell(5).value = "Bargaining Council";
      listTitleRow.getCell(6).value = "YesNo";
      listTitleRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3ECA44" } };
      });
      companyTypeOptions.forEach((value, index) => {
        listSheet.getCell(index + 2, 1).value = value;
      });
      provinceOptions.forEach((value, index) => {
        listSheet.getCell(index + 2, 2).value = value;
      });
      industryOptions.forEach((value, index) => {
        listSheet.getCell(index + 2, 3).value = value;
      });
      ["None", ...groupOptions.map((group) => group.group_name).filter(Boolean)].forEach((value, index) => {
        listSheet.getCell(index + 2, 4).value = value;
      });
      bargainingCouncilOptions.forEach((option, index) => {
        listSheet.getCell(index + 2, 5).value = option.label;
      });
      ["Yes", "No"].forEach((value, index) => {
        listSheet.getCell(index + 2, 6).value = value;
      });
      listSheet.state = "hidden";

      for (let rowIndex = clientBulkTemplateFirstDataRowIndex; rowIndex < clientBulkTemplateFirstDataRowIndex + clientBulkTemplateMaxRows; rowIndex += 1) {
        const row = worksheet.getRow(rowIndex);
        row.getCell(4).numFmt = "@";
        row.getCell(5).numFmt = "@";
        row.getCell(10).numFmt = "@";
        row.getCell(16).numFmt = "@";
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };
        });
        row.getCell(3).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`'${clientBulkTemplateListsSheetName}'!$A$2:$A$${companyTypeOptions.length + 1}`],
          showErrorMessage: true,
        };
        row.getCell(6).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`'${clientBulkTemplateListsSheetName}'!$C$2:$C$${industryOptions.length + 1}`],
          showErrorMessage: true,
        };
        row.getCell(7).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`'${clientBulkTemplateListsSheetName}'!$D$2:$D$${groupOptions.length + 2}`],
          showErrorMessage: true,
        };
        row.getCell(8).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`'${clientBulkTemplateListsSheetName}'!$E$2:$E$${bargainingCouncilOptions.length + 1}`],
          showErrorMessage: true,
        };
        row.getCell(15).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`'${clientBulkTemplateListsSheetName}'!$B$2:$B$${provinceOptions.length + 1}`],
          showErrorMessage: true,
        };
        row.getCell(17).dataValidation = {
          type: "list",
          allowBlank: false,
          formulae: [`'${clientBulkTemplateListsSheetName}'!$F$2:$F$3`],
          showErrorMessage: true,
        };
        row.getCell(18).dataValidation = {
          type: "list",
          allowBlank: false,
          formulae: [`'${clientBulkTemplateListsSheetName}'!$F$2:$F$3`],
          showErrorMessage: true,
        };
        row.getCell(19).dataValidation = {
          type: "list",
          allowBlank: false,
          formulae: [`'${clientBulkTemplateListsSheetName}'!$F$2:$F$3`],
          showErrorMessage: true,
        };
        row.getCell(20).dataValidation = {
          type: "list",
          allowBlank: false,
          formulae: [`'${clientBulkTemplateListsSheetName}'!$F$2:$F$3`],
          showErrorMessage: true,
        };
      }

      const sampleRow = worksheet.getRow(clientBulkTemplateFirstDataRowIndex);
      sampleRow.getCell(1).value = "Example Trading Company";
      sampleRow.getCell(2).value = "Example Trade";
      sampleRow.getCell(3).value = companyTypeOptions[0];
      sampleRow.getCell(4).value = "2024/123456/07";
      sampleRow.getCell(5).value = "";
      sampleRow.getCell(6).value = industryOptions[0];
      sampleRow.getCell(7).value = "None";
      sampleRow.getCell(8).value = "None";
      sampleRow.getCell(9).value = "Jane Doe";
      sampleRow.getCell(10).value = "0821234567";
      sampleRow.getCell(11).value = "jane@example.co.za";
      sampleRow.getCell(12).value = "123 Main Street";
      sampleRow.getCell(13).value = "Unit 4";
      sampleRow.getCell(14).value = "Johannesburg";
      sampleRow.getCell(15).value = "Gauteng";
      sampleRow.getCell(16).value = "2001";
      sampleRow.getCell(17).value = "Yes";
      sampleRow.getCell(18).value = "No";
      sampleRow.getCell(19).value = "No";
      sampleRow.getCell(20).value = "No";

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "llasa_bulk_clients_template.xlsx";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Template failed",
        description: error?.message || "Unable to build the client import template right now.",
        variant: "destructive",
      });
    }
  }, [bargainingCouncilOptions, groupOptions, industryOptions, provinceOptions, toast]);

  const handleImportBulkClients = useCallback(async () => {
    if (!bulkClientParsedRows.length) return;
    setIsImportingBulkClients(true);
    try {
      let nextSequence = getHighestClientNumberSequence();
      const reservedNumbers = new Set(
        clientRows
          .map((row) => String(row?.clientNumber ?? "").trim().toUpperCase())
          .filter(Boolean),
      );
      const knownGroups = new Map(
        groupOptions.map((group) => [group.group_name.trim().toLowerCase(), { id: group.id, group_name: group.group_name }] as const),
      );
      const failures: string[] = [];
      let successCount = 0;

      for (let index = 0; index < bulkClientParsedRows.length; index += 1) {
        const row = bulkClientParsedRows[index];
        const rowLabel = String(row.sourceRowNumber);
        const requiredFields = [
          row.registeredName,
          row.companyType,
          row.registrationNumber,
          row.primaryContact,
          row.primaryNumber,
          row.primaryEmail,
          row.addressLine1,
          row.city,
          row.province,
          row.areaCode,
          row.labourRelations,
          row.employmentEquity,
          row.payroll,
          row.occupationalHealthAndSafety,
        ];
        if (requiredFields.some((value) => !String(value || "").trim())) {
          failures.push(`Row ${rowLabel}: missing one or more required fields.`);
          continue;
        }
        const serviceSelections = [
          { code: "LR", value: normalizeYesNoValue(row.labourRelations) },
          { code: "EE", value: normalizeYesNoValue(row.employmentEquity) },
          { code: "PR", value: normalizeYesNoValue(row.payroll) },
          { code: "OHS", value: normalizeYesNoValue(row.occupationalHealthAndSafety) },
        ];
        if (serviceSelections.some((service) => !service.value)) {
          failures.push(`Row ${rowLabel}: service columns must be either Yes or No.`);
          continue;
        }
        const selectedServices = serviceSelections.filter((service) => service.value === "Yes").map((service) => service.code);
        if (selectedServices.length === 0) {
          failures.push(`Row ${rowLabel}: at least one service must be set to Yes.`);
          continue;
        }

        const resolvedCompanyType = normalizeImportedCompanyType(row.companyType);
        if (!companyTypeOptions.includes(resolvedCompanyType as (typeof companyTypeOptions)[number])) {
          failures.push(`Row ${rowLabel}: company type is not one of the allowed values.`);
          continue;
        }
        if (row.industry && !industryOptions.includes(row.industry as (typeof industryOptions)[number])) {
          failures.push(`Row ${rowLabel}: industry must match one of the template dropdown values.`);
          continue;
        }
        if (row.province && !provinceOptions.includes(row.province as (typeof provinceOptions)[number])) {
          failures.push(`Row ${rowLabel}: province must match one of the template dropdown values.`);
          continue;
        }
        const normalizedCouncil = normalizeImportedBargainingCouncil(row.bargainingCouncil);
        if (
          normalizedCouncil &&
          !bargainingCouncilOptions.some((option) => option.value === normalizedCouncil)
        ) {
          failures.push(`Row ${rowLabel}: bargaining council must match one of the template dropdown values.`);
          continue;
        }

        let resolvedGroupId: string | null = null;
        let resolvedGroupName: string | null = null;
        const requestedGroupName = row.groupName.trim();
        if (requestedGroupName && requestedGroupName.toLowerCase() !== "none") {
          const existingGroup = knownGroups.get(requestedGroupName.toLowerCase());
          if (existingGroup) {
            resolvedGroupId = existingGroup.id;
            resolvedGroupName = existingGroup.group_name;
          } else {
            try {
              const { data: createdGroup, error: createGroupError } = await (supabase as any)
                .from("client_groups")
                .insert({ group_name: requestedGroupName })
                .select("id, group_name")
                .single();
              if (createGroupError) throw createGroupError;
              resolvedGroupId = createdGroup?.id ?? null;
              resolvedGroupName = createdGroup?.group_name ?? requestedGroupName;
              knownGroups.set(requestedGroupName.toLowerCase(), {
                id: resolvedGroupId || "",
                group_name: resolvedGroupName,
              });
              await fetchClientGroups();
            } catch (error: any) {
              failures.push(`Row ${rowLabel}: ${error?.message || "group could not be created"}`);
              continue;
            }
          }
        }

        let clientNumber = "";
        do {
          nextSequence += 1;
          clientNumber = `LL${String(nextSequence).padStart(5, "0")}`;
        } while (reservedNumbers.has(clientNumber));
        reservedNumbers.add(clientNumber);

        const payload: Record<string, unknown> = {
          client_number: clientNumber,
          status: "active",
          registered_name: row.registeredName.trim(),
          trading_as: row.tradingAs.trim() || null,
          trading_name: row.tradingAs.trim() || null,
          company_type: resolvedCompanyType,
          registration_number: row.registrationNumber.trim(),
          vat_number: row.vatNumber.trim() || null,
          industry: row.industry.trim() || null,
          group_name: resolvedGroupName,
          group_id: resolvedGroupId,
          primary_name: row.primaryContact.trim(),
          primary_number: row.primaryNumber.trim(),
          primary_email: row.primaryEmail.trim().toLowerCase(),
          physical_address_line1: row.addressLine1.trim(),
          physical_address_line2: row.addressLine2.trim() || null,
          city: row.city.trim(),
          province: row.province.trim(),
          area_code: row.areaCode.trim(),
          bargaining_council: normalizedCouncil || "None",
          member_types: selectedServices,
          membership_period: "Monthly",
          retainer_cycle: "Monthly",
          lr_billing_cycle: selectedServices.includes("LR") ? "Monthly" : null,
          ee_billing_cycle: selectedServices.includes("EE") ? "Monthly" : null,
          pr_billing_cycle: selectedServices.includes("PR") ? "Monthly" : null,
          hs_billing_cycle: selectedServices.includes("OHS") ? "Monthly" : null,
        };
        const existingByTradingName = await findExistingClientByTradingName(row.tradingAs);
        if (existingByTradingName?.id) {
          const existingTypes = Array.isArray((existingByTradingName as any).member_types)
            ? ((existingByTradingName as any).member_types as string[])
            : [];
          const mergedMemberTypes = Array.from(new Set([...existingTypes, ...selectedServices]));
          const updatePayload: Record<string, unknown> = {
            ...payload,
            member_types: mergedMemberTypes,
            lr_billing_cycle:
              selectedServices.includes("LR")
                ? "Monthly"
                : String((existingByTradingName as any)?.lr_billing_cycle || "").trim() || null,
            ee_billing_cycle:
              selectedServices.includes("EE")
                ? "Monthly"
                : String((existingByTradingName as any)?.ee_billing_cycle || "").trim() || null,
            pr_billing_cycle:
              selectedServices.includes("PR")
                ? "Monthly"
                : String((existingByTradingName as any)?.pr_billing_cycle || "").trim() || null,
            hs_billing_cycle:
              selectedServices.includes("OHS")
                ? "Monthly"
                : String((existingByTradingName as any)?.hs_billing_cycle || "").trim() || null,
          };
          delete (updatePayload as any).client_number;
          const { error: updateError } = await (supabase as any)
            .from("clients")
            .update(updatePayload)
            .eq("id", existingByTradingName.id);
          if (updateError) {
            failures.push(`Row ${rowLabel}: ${updateError?.message || "update failed for existing trading name"}`);
            continue;
          }
          successCount += 1;
          continue;
        }

        const getMissingColumn = (error: any) => {
          const message = String(error?.message ?? "");
          const match = message.match(/'([^']+)' column/);
          return match?.[1] ?? null;
        };
        const tried = new Set<string>();
        try {
          while (true) {
            const { error } = await (supabase as any).from("clients").insert(payload);
            if (!error) break;
            const missingColumn = getMissingColumn(error);
            if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn) && !tried.has(missingColumn)) {
              delete payload[missingColumn];
              tried.add(missingColumn);
              continue;
            }
            throw error;
          }
          successCount += 1;
        } catch (error: any) {
          failures.push(`Row ${rowLabel}: ${error?.message || "import failed"}`);
        }
      }

      if (successCount > 0) {
        await fetchClients();
      }

      if (successCount > 0 && failures.length === 0) {
        toast({
          title: "Import complete",
          description: `${successCount} client${successCount === 1 ? "" : "s"} imported successfully.`,
        });
        setIsBulkClientOpen(false);
        resetBulkClientImport();
        return;
      }

      toast({
        title: successCount > 0 ? "Import completed with issues" : "Import failed",
        description:
          successCount > 0
            ? `${successCount} imported. ${failures.length} row${failures.length === 1 ? "" : "s"} failed. ${failures.slice(0, 2).join(" ")}`
            : failures[0] || "No client rows were imported.",
        variant: failures.length > 0 ? "destructive" : undefined,
      });
    } finally {
      setIsImportingBulkClients(false);
    }
  }, [
    bargainingCouncilOptions,
    bulkClientParsedRows,
    clientRows,
    companyTypeOptions,
    fetchClientGroups,
    fetchClients,
    findExistingClientByTradingName,
    getHighestClientNumberSequence,
    groupOptions,
    industryOptions,
    normalizeImportedBargainingCouncil,
    normalizeImportedCompanyType,
    provinceOptions,
    resetBulkClientImport,
    toast,
  ]);

  const handleExportClientsPdf = useCallback(async () => {
    if (tableRows.length === 0) {
      toast({
        title: "Nothing to export",
        description: "There are no client rows to export.",
        variant: "destructive",
      });
      return;
    }

    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 12;
      const contentWidth = pageWidth - margin * 2;
      const footerHeight = 20;
      const contentBottom = pageHeight - footerHeight - 3;
      const introPrefix = "Overview:";
      const introText =
        "This Client Directory lists the currently visible client records grouped by subscribed service. Clients assigned to more than one service appear in each relevant section, giving you a practical service-by-service view of your active client portfolio.";
      const footerTopRowCenter = "This document is confidential and for internal use only.";
      const firstPageTopContentY = 22;
      const continuationTopContentY = 12;
      const columns = [
        { key: "clientNumber", label: "Client No", width: 20 },
        { key: "companyName", label: "Company Name", width: 52 },
        { key: "tradingAs", label: "Trading As", width: 47 },
        { key: "groupName", label: "Group", width: 32 },
        { key: "contactPerson", label: "Primary Contact", width: 34 },
        { key: "contactNumber", label: "Number", width: 22 },
        { key: "email", label: "Email", width: 50 },
        { key: "status", label: "Status", width: 16 },
      ] as const;
      let y = firstPageTopContentY;

      const serviceSections = [
        { title: membershipLabelByValue.LR, rows: [] as any[] },
        { title: membershipLabelByValue.EE, rows: [] as any[] },
        { title: membershipLabelByValue.PR, rows: [] as any[] },
        { title: membershipLabelByValue.OHS, rows: [] as any[] },
        { title: "Unspecified", rows: [] as any[] },
      ];
      const serviceSectionByCode: Record<string, any[]> = {
        LR: serviceSections[0].rows,
        EE: serviceSections[1].rows,
        PR: serviceSections[2].rows,
        OHS: serviceSections[3].rows,
      };

      tableRows.forEach((row) => {
        const memberTypes = Array.isArray(row.memberTypes) ? row.memberTypes.filter(Boolean) : [];
        if (memberTypes.length === 0) {
          serviceSections[4].rows.push(row);
          return;
        }
        memberTypes.forEach((serviceCode: string) => {
          const targetSection = serviceSectionByCode[serviceCode];
          if (targetSection) targetSection.push(row);
        });
      });

      const compareClientNumberAscending = (left: any, right: any) => {
        const leftRaw = String(left?.clientNumber || "").trim().toUpperCase();
        const rightRaw = String(right?.clientNumber || "").trim().toUpperCase();
        const leftMatch = leftRaw.match(/^LL(\d+)$/);
        const rightMatch = rightRaw.match(/^LL(\d+)$/);
        if (leftMatch && rightMatch) {
          return Number(leftMatch[1]) - Number(rightMatch[1]);
        }
        return leftRaw.localeCompare(rightRaw);
      };
      serviceSections.forEach((section) => {
        section.rows.sort(compareClientNumberAscending);
      });

      const populatedSections = serviceSections.filter((section) => section.rows.length > 0);

      const drawPageHeader = () => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text("Client Directory", pageWidth / 2, 11, { align: "center" });
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.line(margin, 14.5, margin + contentWidth, 14.5);
      };
      const drawContinuationPageHeader = (continuedSectionTitle?: string) => {
        if (continuedSectionTitle) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(15, 23, 42);
          doc.text(`${continuedSectionTitle} (Continued...)`, margin, 10.5, { align: "left" });
        }
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.line(margin, 13, margin + contentWidth, 13);
      };

      const drawSectionHeader = (title: string) => {
        const sectionHeaderHeight = 7;
        doc.setFillColor(51, 65, 85);
        doc.setDrawColor(51, 65, 85);
        doc.setLineWidth(0.16);
        doc.rect(margin, y, contentWidth, sectionHeaderHeight, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        const match = title.match(/^(.*?)(\s*\([^)]*\))$/);
        const baseTitle = match ? match[1] : title;
        const suffix = match ? match[2] : "";
        const titleX = margin + 3;
        const titleY = y + 4.8;
        doc.text(baseTitle, titleX, titleY);
        if (suffix) {
          doc.setFontSize(7);
          doc.text(suffix, margin + contentWidth - 3, titleY, { align: "right" });
          doc.setFontSize(9);
        }
        y += sectionHeaderHeight + 1.8;
      };

      const drawTableHeader = () => {
        const headerHeight = 7;
        let x = margin;
        columns.forEach((column) => {
          doc.setFillColor(226, 232, 240);
          doc.rect(x, y, column.width, headerHeight, "F");
          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.15);
          doc.rect(x, y, column.width, headerHeight, "S");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(0, 0, 0);
          doc.text(column.label, x + 2, y + 4.6);
          x += column.width;
        });
        y += headerHeight;
      };

      const startNewPage = (continuedSectionTitle?: string) => {
        doc.addPage();
        y = 15.5;
        drawContinuationPageHeader(continuedSectionTitle);
      };

      const ensureSpace = (height: number) => {
        if (y + height > contentBottom) {
          startNewPage();
        }
      };

      const loadFooterLogoDataUrl = async () => {
        const response = await fetch("/Horizontal Logo (3).png");
        if (!response.ok) return "";
        const buffer = await response.arrayBuffer();
        return arrayBufferToDataUrl(buffer, response.headers.get("content-type") || "image/png");
      };

      drawPageHeader();

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      const introLineHeight = 3.8;
      const prefixWithSpace = `${introPrefix} `;
      doc.setFont("helvetica", "bold");
      const prefixWidth = doc.getTextWidth(prefixWithSpace);
      doc.setFont("helvetica", "normal");

      const drawJustifiedLine = (text: string, x: number, yPos: number, width: number, isLastLine: boolean) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        if (isLastLine || !trimmed.includes(" ")) {
          doc.text(trimmed, x, yPos);
          return;
        }
        const words = trimmed.split(/\s+/);
        const wordsWidth = words.reduce((sum, word) => sum + doc.getTextWidth(word), 0);
        const gaps = Math.max(words.length - 1, 1);
        const gapWidth = (width - wordsWidth) / gaps;
        let cursorX = x;
        words.forEach((word, idx) => {
          doc.text(word, cursorX, yPos);
          cursorX += doc.getTextWidth(word);
          if (idx < words.length - 1) cursorX += gapWidth;
        });
      };

      const introWords = introText.split(/\s+/).filter(Boolean);
      const firstLineWidth = Math.max(contentWidth - prefixWidth, 20);
      const wrappedIntroLines: string[] = [];
      let currentLine = "";
      let currentMaxWidth = firstLineWidth;
      introWords.forEach((word) => {
        const candidate = currentLine ? `${currentLine} ${word}` : word;
        if (!currentLine || doc.getTextWidth(candidate) <= currentMaxWidth) {
          currentLine = candidate;
          return;
        }
        wrappedIntroLines.push(currentLine);
        currentLine = word;
        currentMaxWidth = contentWidth;
      });
      if (currentLine) wrappedIntroLines.push(currentLine);
      if (wrappedIntroLines.length === 0) wrappedIntroLines.push("");

      const introHeight = wrappedIntroLines.length * introLineHeight + 2;
      ensureSpace(introHeight);

      const firstLineY = y + 2.5;
      doc.setFont("helvetica", "bold");
      doc.text(prefixWithSpace, margin, firstLineY);
      doc.setFont("helvetica", "normal");
      drawJustifiedLine(
        wrappedIntroLines[0] ?? "",
        margin + prefixWidth,
        firstLineY,
        firstLineWidth,
        wrappedIntroLines.length === 1,
      );
      for (let lineIndex = 1; lineIndex < wrappedIntroLines.length; lineIndex += 1) {
        const lineY = firstLineY + lineIndex * introLineHeight;
        drawJustifiedLine(
          wrappedIntroLines[lineIndex] ?? "",
          margin,
          lineY,
          contentWidth,
          lineIndex === wrappedIntroLines.length - 1,
        );
      }

      y += introHeight + 1.5;

      populatedSections.forEach((section, sectionIndex) => {
        ensureSpace(16);
        drawSectionHeader(`${section.title} (${section.rows.length} client${section.rows.length === 1 ? "" : "s"})`);
        drawTableHeader();

        section.rows.forEach((row) => {
          const rowValues = [
            row.clientNumber || "--",
            row.companyNameDisplay || row.companyName || "--",
            row.tradingAs || "--",
            row.groupName || "None",
            row.contactPerson || "--",
            row.contactNumber || "--",
            row.email || "--",
            row.status || "Active",
          ];
          const lineHeight = 3.3;
          const cellPaddingX = 2.3;
          const cellPaddingY = 1.6;
          const cellLines = columns.map((column, idx) =>
            doc.splitTextToSize(String(rowValues[idx] || "--"), column.width - cellPaddingX * 2),
          );
          const maxLines = Math.max(...cellLines.map((lines) => Math.max(lines.length, 1)));
          const rowHeight = maxLines * lineHeight + cellPaddingY * 2;

          if (y + rowHeight > contentBottom) {
            startNewPage(section.title);
            drawTableHeader();
          }

          let x = margin;
          columns.forEach((column, columnIndex) => {
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.12);
            doc.rect(x, y, column.width, rowHeight);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(17, 24, 39);
            const lines = cellLines[columnIndex];
            lines.forEach((line: string, lineIdx: number) => {
              doc.text(line, x + cellPaddingX, y + cellPaddingY + 2.5 + lineIdx * lineHeight);
            });
            x += column.width;
          });

          y += rowHeight;
        });

        if (sectionIndex < populatedSections.length - 1) {
          y += 3.5;
        }
      });

      const footerLogoDataUrl = await loadFooterLogoDataUrl();

      const totalPages = doc.getNumberOfPages();
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        doc.setPage(pageNumber);
        const footerTop = pageHeight - footerHeight;
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.line(margin, footerTop, margin + contentWidth, footerTop);
        if (footerLogoDataUrl) {
          try {
            const imageType = footerLogoDataUrl.includes("image/jpeg") ? "JPEG" : "PNG";
            doc.addImage(footerLogoDataUrl, imageType, margin, footerTop + 2.6, 34, 10.3, undefined, "FAST");
          } catch {
            doc.text("LLASA", margin, footerTop + 6.2, { align: "left" });
          }
        } else {
          doc.text("LLASA", margin, footerTop + 6.2, { align: "left" });
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(70, 74, 78);
        doc.text(footerTopRowCenter, pageWidth / 2, footerTop + 6.2, { align: "center" });
        doc.text(`Page ${pageNumber} of ${totalPages}`, margin + contentWidth, footerTop + 6.2, { align: "right" });
      }

      doc.setTextColor(0, 0, 0);
      doc.save("Client_Directory.pdf");
      toast({
        title: "Export ready",
        description: "Client Directory exported successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error?.message || "Unable to export Client Directory right now.",
        variant: "destructive",
      });
    }
  }, [membershipLabelByValue, tableRows, toast]);

  const handleCreateClient = async () => {
    if (!user?.id) return;
    if (!isStepOneComplete || !isStepTwoComplete || !isStepThreeComplete) return;
    setIsSavingClient(true);
    try {
      const normalizedClientNumber = membershipForm.clientNumber.trim().toUpperCase();
      if (!normalizedClientNumber) {
        toast({ title: "Error", description: "Client number is required.", variant: "destructive" });
        return;
      }
      const duplicateInLoadedRows = clientRows.some(
        (row) => String(row?.clientNumber ?? "").trim().toUpperCase() === normalizedClientNumber,
      );
      if (duplicateInLoadedRows) {
        const nextSuggested = getNextAvailableClientNumber();
        setMembershipForm((prev) => ({ ...prev, clientNumber: nextSuggested }));
        toast({
          title: "Duplicate client number",
          description: `Client number ${normalizedClientNumber} already exists. Suggested ${nextSuggested}.`,
          variant: "destructive",
        });
        return;
      }
      const { data: existingClientNumberRows, error: existingClientNumberError } = await (supabase as any)
        .from("clients")
        .select("id")
        .eq("client_number", normalizedClientNumber)
        .limit(1);
      if (existingClientNumberError) throw existingClientNumberError;
      if (Array.isArray(existingClientNumberRows) && existingClientNumberRows.length > 0) {
        const nextSuggested = getNextAvailableClientNumber();
        setMembershipForm((prev) => ({ ...prev, clientNumber: nextSuggested }));
        toast({
          title: "Duplicate client number",
          description: `Client number ${normalizedClientNumber} already exists. Suggested ${nextSuggested}.`,
          variant: "destructive",
        });
        return;
      }
      const normalizeCycleValue = (value: string) => {
        const normalized = value.trim().toLowerCase();
        if (normalized === "annually" || normalized === "annual") return "Annual";
        if (normalized === "monthly") return "Monthly";
        return value.trim();
      };
      const normalizedLrCycle = normalizeCycleValue(membershipForm.lrBillingCycle);
      const normalizedEeCycle = normalizeCycleValue(membershipForm.eeBillingCycle);
      const normalizedPrCycle = normalizeCycleValue(membershipForm.prBillingCycle);
      const normalizedHsCycle = normalizeCycleValue(membershipForm.hsBillingCycle);
      const firstSelectedService = membershipForm.memberTypes[0];
      const firstSelectedCycle = firstSelectedService
        ? normalizeCycleValue(String((membershipForm as any)[getServiceBillingCycleField(firstSelectedService)] || ""))
        : "";
      const basePayload: Record<string, unknown> = {
        client_number: normalizedClientNumber,
        status: "active",
      };
      const optionalPayload: Record<string, unknown> = {
        registered_name: clientDetailsForm.registeredName.trim() || null,
        trading_as: clientDetailsForm.tradingAs.trim() || null,
        trading_name: clientDetailsForm.tradingAs.trim() || null,
        company_type: clientDetailsForm.companyType.trim() || null,
        registration_number: clientDetailsForm.registrationNumber.trim() || null,
        vat_number: clientDetailsForm.vatNumber.trim() || null,
        primary_name: clientDetailsForm.owner.trim() || null,
        primary_number: clientDetailsForm.telCell.trim() || null,
        primary_email: clientDetailsForm.email.trim() || null,
        start_date: membershipForm.startDate.trim() || null,
        membership_period: firstSelectedCycle || null,
        retainer_cycle: firstSelectedCycle || null,
        lr_billing_cycle: normalizedLrCycle || null,
        ee_billing_cycle: normalizedEeCycle || null,
        pr_billing_cycle: normalizedPrCycle || null,
        hs_billing_cycle: normalizedHsCycle || null,
        member_types: membershipForm.memberTypes,
        physical_address_line1: addressForm.line1.trim() || null,
        physical_address_line2: addressForm.line2.trim() || null,
        city: addressForm.city.trim() || null,
        province: addressForm.province.trim() || null,
        area_code: addressForm.areaCode.trim() || null,
        bargaining_council: "None",
      };
      const payload: Record<string, unknown> = { ...basePayload, ...optionalPayload };
      const existingByTradingName = await findExistingClientByTradingName(clientDetailsForm.tradingAs);
      if (existingByTradingName?.id) {
        const existingTypes = Array.isArray((existingByTradingName as any).member_types)
          ? ((existingByTradingName as any).member_types as string[])
          : [];
        const mergedMemberTypes = Array.from(new Set([...existingTypes, ...membershipForm.memberTypes]));
        const updatePayload: Record<string, unknown> = {
          ...optionalPayload,
          member_types: mergedMemberTypes,
          lr_billing_cycle:
            normalizedLrCycle || String((existingByTradingName as any)?.lr_billing_cycle || "").trim() || null,
          ee_billing_cycle:
            normalizedEeCycle || String((existingByTradingName as any)?.ee_billing_cycle || "").trim() || null,
          pr_billing_cycle:
            normalizedPrCycle || String((existingByTradingName as any)?.pr_billing_cycle || "").trim() || null,
          hs_billing_cycle:
            normalizedHsCycle || String((existingByTradingName as any)?.hs_billing_cycle || "").trim() || null,
        };
        const { error: updateError } = await (supabase as any)
          .from("clients")
          .update(updatePayload)
          .eq("id", existingByTradingName.id);
        if (updateError) throw updateError;
        toast({
          title: "Client updated",
          description: "An existing client with this trading name was updated instead of creating a duplicate row.",
        });
        setIsNewClientOpen(false);
        resetNewClientForm();
        await fetchClients();
        return;
      }

      const getMissingColumn = (error: any) => {
        const message = String(error?.message ?? "");
        const match = message.match(/'([^']+)' column/);
        return match?.[1] ?? null;
      };
      const tried = new Set<string>();
      while (true) {
        const { error } = await (supabase as any).from("clients").insert(payload);
        if (!error) break;
        const missingColumn = getMissingColumn(error);
        if (
          missingColumn &&
          Object.prototype.hasOwnProperty.call(payload, missingColumn) &&
          !Object.prototype.hasOwnProperty.call(basePayload, missingColumn) &&
          !tried.has(missingColumn)
        ) {
          delete payload[missingColumn];
          tried.add(missingColumn);
          continue;
        }
        throw error;
      }

      toast({ title: "Success", description: "Client created successfully." });
      setIsNewClientOpen(false);
      resetNewClientForm();
      await fetchClients();
    } catch (error: any) {
      toast({ title: "Error", description: error?.message ?? "Failed to create client.", variant: "destructive" });
    } finally {
      setIsSavingClient(false);
    }
  };

  const getClientStatusIndicator = (statusValue: string | undefined) => {
    const normalized = (statusValue || "").trim().toLowerCase();
    if (normalized.includes("suspend")) {
      return { label: "Suspended", dotClass: "bg-[#b88900]" };
    }
    if (normalized.includes("terminat") || normalized.includes("cancel")) {
      return { label: "Terminated", dotClass: "bg-rose-600" };
    }
    return { label: "Active", dotClass: "bg-[#3eca44]" };
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
  const getClientLogoPathFromRecord = (record?: Record<string, unknown> | null) => {
    if (!record) return "";
    const fromStoragePath = String(record.storage_path ?? "").trim();
    if (fromStoragePath) return fromStoragePath;
    const fromLogoPath = String(record.logo_path ?? "").trim();
    if (fromLogoPath) return fromLogoPath;
    const fromLogoUrl = String(record.logo_url ?? "").trim();
    if (fromLogoUrl) return getClientLogoStoragePathFromUrl(fromLogoUrl);
    const fromCompanyLogoUrl = String(record.company_logo_url ?? "").trim();
    if (fromCompanyLogoUrl) return getClientLogoStoragePathFromUrl(fromCompanyLogoUrl);
    return "";
  };

  const loadClientLogoPath = useCallback(async (clientId: string) => {
    const { data, error } = await clientLogoTable().select("*").eq("client_id", clientId).limit(1);
    if (error) return;
    const row = Array.isArray(data) ? data[0] : data;
    const path = getClientLogoPathFromRecord((row as Record<string, unknown>) ?? null);
    setClientLogoPathByClient((prev) => ({ ...prev, [clientId]: path }));
  }, []);

  const resolveClientLogoUrl = useCallback(
    (clientId: string) => {
      const cached = clientLogoPreviewByClient[clientId];
      if (cached) return cached;
      const path = (clientLogoPathByClient[clientId] || "").trim();
      if (!path) return "";
      const { data } = supabase.storage.from("client-logos").getPublicUrl(path);
      return data.publicUrl || "";
    },
    [clientLogoPathByClient, clientLogoPreviewByClient],
  );

  useEffect(() => {
    if (!selectedClientRow?.id) return;
    if (Object.prototype.hasOwnProperty.call(clientLogoPathByClient, selectedClientRow.id)) return;
    void loadClientLogoPath(selectedClientRow.id);
  }, [clientLogoPathByClient, loadClientLogoPath, selectedClientRow?.id]);

  const uploadClientLogoFile = useCallback(
    async (file: File) => {
      if (!selectedClientRow?.id || !user?.id) return;
      const safeName = file.name.replace(/\s+/g, "_");
      const storagePath = `${user.id}/${selectedClientRow.id}/${Date.now()}_${safeName}`;
      const mappedLogoPath = (clientLogoPathByClient[selectedClientRow.id] ?? "").trim();
      const existingLogoPath = getClientLogoStoragePathFromUrl(mappedLogoPath);
      setIsClientLogoUploading(true);
      try {
        const { error: uploadError } = await supabase.storage.from("client-logos").upload(storagePath, file, {
          upsert: true,
          contentType: file.type || "image/png",
        });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("client-logos").getPublicUrl(storagePath);
        const nextLogoUrl = data.publicUrl || "";
        setClientLogoPreviewByClient((prev) => ({ ...prev, [selectedClientRow.id]: nextLogoUrl }));
        setClientLogoPathByClient((prev) => ({ ...prev, [selectedClientRow.id]: storagePath }));
        const { error: logoUpsertError } = await clientLogoTable().upsert(
          {
            client_id: selectedClientRow.id,
            storage_path: storagePath,
            uploaded_by: user.id,
          },
          { onConflict: "client_id" },
        );
        if (logoUpsertError) throw logoUpsertError;
        if (existingLogoPath && existingLogoPath !== storagePath) {
          await supabase.storage.from("client-logos").remove([existingLogoPath]);
        }
        toast({ title: "Logo updated", description: "Company logo uploaded successfully." });
      } catch (error: any) {
        toast({ title: "Unable to upload logo", description: error?.message || "Upload failed.", variant: "destructive" });
      } finally {
        setIsClientLogoUploading(false);
      }
    },
    [clientLogoPathByClient, selectedClientRow?.id, toast, user?.id],
  );

  const handleClientLogoFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!isClientEditMode) {
        event.target.value = "";
        return;
      }
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
        return;
      }
      try {
        const source = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ""));
          reader.onerror = () => reject(new Error("Could not read selected image."));
          reader.readAsDataURL(file);
        });
        const cleanedLogo = await cropClientLogoPadding(source);
        const blob = await fetch(cleanedLogo).then((response) => response.blob());
        const cleanedFile = new File([blob], file.name.replace(/\.[^.]+$/, ".png"), { type: "image/png" });
        await uploadClientLogoFile(cleanedFile);
      } catch (error: any) {
        toast({
          title: "Unable to prepare logo",
          description: error?.message || "Logo preprocessing failed.",
          variant: "destructive",
        });
      }
    },
    [isClientEditMode, toast, uploadClientLogoFile],
  );

  const removeClientLogo = useCallback(async () => {
    if (!isClientEditMode) return;
    if (!selectedClientRow?.id) return;
    const mappedLogoPath = (clientLogoPathByClient[selectedClientRow.id] ?? "").trim();
    const existingLogoPath = getClientLogoStoragePathFromUrl(mappedLogoPath);
    setIsClientLogoUploading(true);
    try {
      await clientLogoTable().delete().eq("client_id", selectedClientRow.id);
      if (existingLogoPath) {
        await supabase.storage.from("client-logos").remove([existingLogoPath]);
      }
      setClientLogoPreviewByClient((prev) => {
        const next = { ...prev };
        delete next[selectedClientRow.id];
        return next;
      });
      setClientLogoPathByClient((prev) => {
        const next = { ...prev };
        delete next[selectedClientRow.id];
        return next;
      });
      toast({ title: "Logo removed", description: "Company logo removed." });
    } catch (error: any) {
      toast({ title: "Unable to remove logo", description: error?.message || "Remove failed.", variant: "destructive" });
    } finally {
      setIsClientLogoUploading(false);
    }
  }, [clientLogoPathByClient, isClientEditMode, selectedClientRow?.id, toast]);
  const handleSlaFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedClientRow?.id || !user?.id) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast({ title: "Invalid file type", description: "Please upload a PDF file.", variant: "destructive" });
      return;
    }
    setPendingSlaFile(file);
    setPendingSlaFileName(file.name);
  }, [selectedClientRow?.id, toast, user?.id]);
  const handleOpenSla = useCallback(async () => {
    if (!selectedClientRow?.id) return;
    const sla = slaRecordByClient[selectedClientRow.id];
    if (!sla?.fileUrl) return;
    const { data, error } = await supabase.storage.from("contracts").createSignedUrl(sla.fileUrl, 300);
    if (error || !data?.signedUrl) {
      toast({ title: "Unable to open SLA", description: error?.message || "Signed URL failed.", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }, [selectedClientRow?.id, slaRecordByClient, toast]);
  const handleRemoveSla = useCallback(async () => {
    if (!selectedClientRow?.id || !user?.id) return;
    if (pendingSlaFile || pendingSlaFileName) {
      setPendingSlaFile(null);
      setPendingSlaFileName("");
      return;
    }
    const existing = slaRecordByClient[selectedClientRow.id];
    if (!existing?.id) return;
    try {
      const { error: deleteError } = await agreementRecordTable().delete().eq("id", existing.id);
      if (deleteError) throw deleteError;
      if (existing.fileUrl) {
        await supabase.storage.from("contracts").remove([existing.fileUrl]);
      }
      setslaRecordByClient((prev) => ({ ...prev, [selectedClientRow.id]: null }));
      toast({ title: "SLA removed", description: "Agreement file removed." });
    } catch (error: any) {
      toast({ title: "Unable to remove file", description: error?.message || "Remove failed.", variant: "destructive" });
    }
  }, [pendingSlaFile, pendingSlaFileName, selectedClientRow?.id, slaRecordByClient, toast, user?.id]);

  const openClientFile = (row: any) => {
    setSelectedClientRow(row);
    setIsClientEditMode(false);
    setClientEditForm({
      companyName: row.companyName || "",
      tradingAs: row.tradingAs === "--" ? "" : row.tradingAs || "",
      registrationNumber: row.registrationNumber === "--" ? "" : row.registrationNumber || "",
      vatNumber: row.vatNumber === "--" ? "" : row.vatNumber || "",
      companyType: row.companyType === "--" ? "" : row.companyType || "",
      industry: row.industry === "--" ? "" : row.industry || "",
      bargainingCouncil: row.bargainingCouncil === "--" ? "" : row.bargainingCouncil || "",
      groupName: row.groupName === "--" || !row.groupName ? "None" : row.groupName,
      groupId: row.groupId || "",
      contactPerson: row.ownerContactPerson === "--" ? "" : row.ownerContactPerson || "",
      contactNumber: row.ownerContactNumber === "--" ? "" : row.ownerContactNumber || "",
      ownerEmail: row.ownerContactEmail === "--" ? "" : row.ownerContactEmail || "",
      primaryName: row.primaryName === "--" ? "" : row.primaryName || "",
      primaryJobTitle: row.primaryJobTitle === "--" ? "" : row.primaryJobTitle || "",
      primaryNumber: row.primaryNumber === "--" ? "" : row.primaryNumber || "",
      primaryEmail: row.primaryEmail === "--" ? "" : row.primaryEmail || "",
      secondaryName: row.secondaryName === "--" ? "" : row.secondaryName || "",
      secondaryJobTitle: row.secondaryJobTitle === "--" ? "" : row.secondaryJobTitle || "",
      secondaryNumber: row.secondaryNumber === "--" ? "" : row.secondaryNumber || "",
      secondaryEmail: row.secondaryEmail === "--" ? "" : row.secondaryEmail || "",
      email: row.email === "--" ? "" : row.email || "",
      physicalLine1: row.physicalLine1 === "--" ? "" : row.physicalLine1 || "",
      physicalLine2: row.physicalLine2 === "--" ? "" : row.physicalLine2 || "",
      physicalCity: row.physicalCity === "--" ? "" : row.physicalCity || "",
      physicalProvince: row.physicalProvince === "--" ? "" : row.physicalProvince || "",
      physicalAreaCode: row.physicalAreaCode === "--" ? "" : row.physicalAreaCode || "",
      postalLine1: row.postalLine1 === "--" ? "" : row.postalLine1 || "",
      postalLine2: row.postalLine2 === "--" ? "" : row.postalLine2 || "",
      postalCity: row.postalCity === "--" ? "" : row.postalCity || "",
      postalProvince: row.postalProvince === "--" ? "" : row.postalProvince || "",
      postalAreaCode: row.postalAreaCode === "--" ? "" : row.postalAreaCode || "",
      clientNumber: row.clientNumber === "--" ? "" : row.clientNumber || "",
      startDate: row.startDate === "--" ? "" : row.startDate || "",
      renewalDate: getNextRenewalDateFromStart(row.startDate === "--" ? "" : row.startDate || ""),
      agreement: row.agreement === "--" ? "" : row.agreement || "",
      memberTypes: Array.isArray(row.memberTypes) ? row.memberTypes : [],
      billingCycle: row.billingCycle === "--" ? "" : row.billingCycle || "",
      lrBillingCycle: row.lrBillingCycle === "--" ? "" : row.lrBillingCycle || row.billingCycle || "",
      eeBillingCycle: row.eeBillingCycle === "--" ? "" : row.eeBillingCycle || row.billingCycle || "",
      prBillingCycle: row.prBillingCycle === "--" ? "" : row.prBillingCycle || row.billingCycle || "",
      hsBillingCycle: row.hsBillingCycle === "--" ? "" : row.hsBillingCycle || row.billingCycle || "",
      lrRetainer: row.lrRetainer === "--" ? "" : row.lrRetainer || "",
      eeRetainer: row.eeRetainer === "--" ? "" : row.eeRetainer || "",
      prRetainer: row.prRetainer === "--" ? "" : row.prRetainer || "",
      hsRetainer: row.hsRetainer === "--" ? "" : row.hsRetainer || "",
      status: row.status || "Active",
    });
    setPendingSlaFile(null);
    setPendingSlaFileName("");
  };
  const cancelClientEdits = () => {
    if (!selectedClientRow) return;
    openClientFile(selectedClientRow);
    setIsClientEditMode(false);
  };
  const openAddFileNoteDialog = () => {
    resetFileNoteForm();
    setIsFileNoteDialogOpen(true);
  };
  const openFileNotePreviewDialog = (rawContent: string, updatedAt?: string) => {
    const { content, editTag } = splitFileNoteContentAndEditTag(rawContent);
    setFileNotePreviewContent(content);
    setFileNotePreviewEditTag(editTag);
    setFileNotePreviewUpdatedAt(String(updatedAt || "").trim());
    setIsFileNotePreviewOpen(true);
  };
  const openEditFileNoteDialog = (note: any) => {
    if (!isNoteEditableByCurrentUser(note)) {
      toast({
        title: "Edit not allowed",
        description: "You can only edit notes created by you.",
        variant: "destructive",
      });
      return;
    }
    const rawNoteContent = String(note.note_content || "");
    const { content: editableContent } = splitFileNoteContentAndEditTag(rawNoteContent);
    setEditingFileNoteId(note.id);
    setFileNoteForm({
      noteDate: String(note.note_date || dateToday()),
      noteContent: editableContent,
      noteUserName: String(note.note_user_name || resolveCurrentUserName()),
    });
    setIsFileNoteDialogOpen(true);
  };
  const handleSaveFileNote = async () => {
    if (!selectedClientRow?.id || !user?.id) return;
    const noteDate = fileNoteForm.noteDate.trim();
    const noteContent = fileNoteForm.noteContent.trim();
    const noteUserName = fileNoteForm.noteUserName.trim() || resolveCurrentUserName();
    if (!noteDate || !noteContent) {
      toast({ title: "Missing fields", description: "Date and note content are required.", variant: "destructive" });
      return;
    }
    setIsSavingFileNote(true);
    try {
      if (editingFileNoteId) {
        const baseContent = noteContent.replace(FILE_NOTE_EDIT_TAG_REGEX, "").trim();
        const now = new Date();
        const editedTag = `Edited by ${noteUserName} on ${formatDisplayDate(now.toISOString())} at ${formatDisplayTime(now)}`;
        const updatedContent = `${baseContent} ${editedTag}`.trim();
        const { error } = await (supabase as any)
          .from("client_file_notes")
          .update({
            note_content: updatedContent,
            note_user_name: noteUserName,
          })
          .eq("id", editingFileNoteId)
          .eq("client_id", selectedClientRow.id);
        if (error) throw error;
      } else {
        const payload = {
          client_id: selectedClientRow.id,
          note_date: noteDate,
          note_content: noteContent,
          note_user_name: noteUserName,
        };
        const { error } = await (supabase as any).from("client_file_notes").insert(payload);
        if (error) throw error;
      }
      setIsFileNoteDialogOpen(false);
      resetFileNoteForm();
      await fetchClientFileNotes(selectedClientRow.id);
      toast({ title: "Success", description: editingFileNoteId ? "File note updated." : "File note created." });
    } catch (error: any) {
      toast({ title: "Unable to save file note", description: error?.message || "Save failed.", variant: "destructive" });
    } finally {
      setIsSavingFileNote(false);
    }
  };
  const handleDeleteFileNote = async (noteId: string) => {
    if (!selectedClientRow?.id || !user?.id) return;
    if (!canCurrentUserDeleteNotes) {
      toast({
        title: "Delete not allowed",
        description: "Consultant and Administrator subusers cannot delete notes.",
        variant: "destructive",
      });
      return;
    }
    if (!window.confirm("Delete this file note?")) return;
    try {
      const { error } = await (supabase as any)
        .from("client_file_notes")
        .delete()
        .eq("id", noteId)
        .eq("client_id", selectedClientRow.id);
      if (error) throw error;
      await fetchClientFileNotes(selectedClientRow.id);
      toast({ title: "File note deleted" });
    } catch (error: any) {
      toast({ title: "Unable to delete file note", description: error?.message || "Delete failed.", variant: "destructive" });
    }
  };
  const clientFileCardClass = `rounded border border-slate-200 bg-white p-3 transition-colors ${
    isClientEditMode ? "hover:border-slate-500" : "hover:border-[#3eca44] hover:bg-[#3eca44]/5"
  }`;

  const handleSaveClientEdits = async () => {
    if (!selectedClientRow?.id) return;
    setIsSavingClientEdit(true);
    try {
      const toTrimmedString = (value: unknown) => String(value ?? "").trim();
      if (pendingSlaFile && selectedClientRow?.id && user?.id) {
        setIsSlaUploading(true);
        try {
          const existing = slaRecordByClient[selectedClientRow.id];
          if (existing?.id) {
            await agreementRecordTable().delete().eq("id", existing.id);
          }

          const safeName = pendingSlaFile.name.replace(/\s+/g, "_");
          const filePath = `${user.id}/sla/${selectedClientRow.id}-${Date.now()}-${safeName}`;
          const { error: uploadError } = await supabase.storage.from("contracts").upload(filePath, pendingSlaFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: pendingSlaFile.type || "application/pdf",
          });
          if (uploadError) throw uploadError;

          const { error: insertError } = await agreementRecordTable().insert({
            client_id: selectedClientRow.id,
            contract_type: SLA_RECORD_TYPE,
            issue_date: dateToday(),
            file_url: filePath,
            is_active: false,
          });
          if (insertError) throw insertError;

          await fetchSlaContract(selectedClientRow.id);
          setPendingSlaFile(null);
          setPendingSlaFileName("");
        } finally {
          setIsSlaUploading(false);
        }
      }

      let resolvedGroupId: string | null = null;
      let resolvedGroupName: string | null = null;
      const requestedGroup = clientEditForm.groupName.trim();
      if (requestedGroup && requestedGroup.toLowerCase() !== "none") {
        const existingGroup = groupOptions.find(
          (group) => group.group_name.trim().toLowerCase() === requestedGroup.toLowerCase(),
        );
        if (existingGroup) {
          resolvedGroupId = existingGroup.id;
          resolvedGroupName = existingGroup.group_name;
        } else {
          const { data: createdGroup, error: createGroupError } = await (supabase as any)
            .from("client_groups")
            .insert({
              group_name: requestedGroup,
            })
            .select("id, group_name")
            .single();
          if (createGroupError) throw createGroupError;
          resolvedGroupId = createdGroup?.id ?? null;
          resolvedGroupName = createdGroup?.group_name ?? requestedGroup;
          await fetchClientGroups();
        }
      }
      const updatePayload: Record<string, unknown> = {
        registered_name: clientEditForm.companyName.trim() || null,
        trading_as: clientEditForm.tradingAs.trim() || null,
        trading_name: clientEditForm.tradingAs.trim() || null,
        registration_number: clientEditForm.registrationNumber.trim() || null,
        vat_number: clientEditForm.vatNumber.trim() || null,
        company_type: clientEditForm.companyType.trim() || null,
        industry: clientEditForm.industry.trim() || null,
        bargaining_council: clientEditForm.bargainingCouncil.trim() || null,
        group_name: resolvedGroupName,
        group_id: resolvedGroupId,
        owner_name: clientEditForm.contactPerson.trim() || null,
        owner_number: clientEditForm.contactNumber.trim() || null,
        owner_email: clientEditForm.ownerEmail.trim() || null,
        primary_name: clientEditForm.primaryName.trim() || null,
        primary_job_title: clientEditForm.primaryJobTitle.trim() || null,
        primary_number: clientEditForm.primaryNumber.trim() || null,
        primary_email: clientEditForm.primaryEmail.trim() || null,
        secondary_name: clientEditForm.secondaryName.trim() || null,
        secondary_job_title: clientEditForm.secondaryJobTitle.trim() || null,
        secondary_number: clientEditForm.secondaryNumber.trim() || null,
        secondary_email: clientEditForm.secondaryEmail.trim() || null,
        physical_address_line1: clientEditForm.physicalLine1.trim() || null,
        physical_address_line2: clientEditForm.physicalLine2.trim() || null,
        city: clientEditForm.physicalCity.trim() || null,
        province: clientEditForm.physicalProvince.trim() || null,
        area_code: clientEditForm.physicalAreaCode.trim() || null,
        postal_address_line1: clientEditForm.postalLine1.trim() || null,
        postal_address_line2: clientEditForm.postalLine2.trim() || null,
        postal_city: clientEditForm.postalCity.trim() || null,
        postal_province: clientEditForm.postalProvince.trim() || null,
        postal_area_code: clientEditForm.postalAreaCode.trim() || null,
        client_number: clientEditForm.clientNumber.trim() || null,
        start_date: clientEditForm.startDate.trim() || null,
        renewal_date: getNextRenewalDateFromStart(clientEditForm.startDate) || null,
        agreement: clientEditForm.agreement.trim() || null,
        member_types: clientEditForm.memberTypes,
        membership_period: clientEditForm.billingCycle.trim() || null,
        retainer_cycle: clientEditForm.billingCycle.trim() || null,
        lr_billing_cycle: clientEditForm.lrBillingCycle.trim() || null,
        ee_billing_cycle: clientEditForm.eeBillingCycle.trim() || null,
        pr_billing_cycle: clientEditForm.prBillingCycle.trim() || null,
        hs_billing_cycle: clientEditForm.hsBillingCycle.trim() || null,
        lr_retainer: toTrimmedString(clientEditForm.lrRetainer) || null,
        ee_retainer: toTrimmedString(clientEditForm.eeRetainer) || null,
        pr_retainer: toTrimmedString(clientEditForm.prRetainer) || null,
        hs_retainer: toTrimmedString(clientEditForm.hsRetainer) || null,
        status: clientEditForm.status.trim().toLowerCase() || "active",
      };
      const getMissingColumn = (error: any) => {
        const message = String(error?.message ?? "");
        const match = message.match(/'([^']+)' column/);
        return match?.[1] ?? null;
      };
      const tried = new Set<string>();
      while (true) {
        const { error } = await (supabase as any)
          .from("clients")
          .update(updatePayload)
          .eq("id", selectedClientRow.id);
        if (!error) break;
        const missingColumn = getMissingColumn(error);
        if (missingColumn && Object.prototype.hasOwnProperty.call(updatePayload, missingColumn) && !tried.has(missingColumn)) {
          delete updatePayload[missingColumn];
          tried.add(missingColumn);
          continue;
        }
        throw error;
      }
      await fetchClients();
      setSelectedClientRow((prev: any) =>
        prev
          ? {
              ...prev,
              companyName: clientEditForm.companyName || "--",
              companyNameDisplay: getCompanyNameDisplay(clientEditForm.companyName, clientEditForm.companyType),
              tradingAs: clientEditForm.tradingAs || "--",
              registrationNumber: clientEditForm.registrationNumber || "--",
              vatNumber: clientEditForm.vatNumber || "--",
              companyType: clientEditForm.companyType || "--",
              industry: clientEditForm.industry || "--",
              bargainingCouncil: clientEditForm.bargainingCouncil || "--",
              groupName: clientEditForm.groupName || "--",
              groupId: resolvedGroupId || "",
              contactPerson: clientEditForm.primaryName || "--",
              contactNumber: clientEditForm.primaryNumber || "--",
              ownerEmail: clientEditForm.primaryEmail || "--",
              ownerContactPerson: clientEditForm.contactPerson || "--",
              ownerContactNumber: clientEditForm.contactNumber || "--",
              ownerContactEmail: clientEditForm.ownerEmail || "--",
              primaryName: clientEditForm.primaryName || "--",
              primaryJobTitle: clientEditForm.primaryJobTitle || "--",
              primaryNumber: clientEditForm.primaryNumber || "--",
              primaryEmail: clientEditForm.primaryEmail || "--",
              secondaryName: clientEditForm.secondaryName || "--",
              secondaryJobTitle: clientEditForm.secondaryJobTitle || "--",
              secondaryNumber: clientEditForm.secondaryNumber || "--",
              secondaryEmail: clientEditForm.secondaryEmail || "--",
              email: clientEditForm.primaryEmail || "--",
              physicalLine1: clientEditForm.physicalLine1 || "--",
              physicalLine2: clientEditForm.physicalLine2 || "--",
              physicalCity: clientEditForm.physicalCity || "--",
              physicalProvince: clientEditForm.physicalProvince || "--",
              physicalAreaCode: clientEditForm.physicalAreaCode || "--",
              postalLine1: clientEditForm.postalLine1 || "--",
              postalLine2: clientEditForm.postalLine2 || "--",
              postalCity: clientEditForm.postalCity || "--",
              postalProvince: clientEditForm.postalProvince || "--",
              postalAreaCode: clientEditForm.postalAreaCode || "--",
              clientNumber: clientEditForm.clientNumber || "--",
              startDate: clientEditForm.startDate || "--",
              renewalDate: getNextRenewalDateFromStart(clientEditForm.startDate) || "--",
              agreement: clientEditForm.agreement || "--",
              memberTypes: clientEditForm.memberTypes || [],
              billingCycle: clientEditForm.billingCycle || "--",
              lrBillingCycle: clientEditForm.lrBillingCycle || "--",
              eeBillingCycle: clientEditForm.eeBillingCycle || "--",
              prBillingCycle: clientEditForm.prBillingCycle || "--",
              hsBillingCycle: clientEditForm.hsBillingCycle || "--",
              lrRetainer: clientEditForm.lrRetainer || "--",
              eeRetainer: clientEditForm.eeRetainer || "--",
              prRetainer: clientEditForm.prRetainer || "--",
              hsRetainer: clientEditForm.hsRetainer || "--",
              status: clientEditForm.status || "Active",
            }
          : prev,
      );
      setIsClientEditMode(false);
      toast({ title: "Success", description: "Client updated successfully." });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message ?? "Failed to update client.", variant: "destructive" });
    } finally {
      setIsSavingClientEdit(false);
    }
  };
  const toggleClientSelection = useCallback((clientId: string, checked: boolean) => {
    setSelectedClientIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(clientId);
      else next.delete(clientId);
      return next;
    });
  }, []);
  const toggleSelectAllVisibleClients = useCallback((checked: boolean) => {
    setSelectedClientIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const row of paginatedTableRows) next.add(String(row.id));
      } else {
        for (const row of paginatedTableRows) next.delete(String(row.id));
      }
      return next;
    });
  }, [paginatedTableRows]);
  const handleDeleteSelectedClients = useCallback(async () => {
    if (currentUserIsSubuser) {
      toast({
        title: "Delete not allowed",
        description: "Only the master user can delete client rows.",
        variant: "destructive",
      });
      return;
    }
    const ids = Array.from(selectedClientIds);
    if (ids.length === 0) return;
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${ids.length} client${ids.length === 1 ? "" : "s"}? This cannot be undone.`,
    );
    if (!confirmed) return;
    try {
      const { data: contracts } = await agreementRecordTable().select("file_url").in("client_id", ids);
      const contractFiles = (contracts ?? []).map((row: any) => String(row?.file_url || "").trim()).filter(Boolean);
      if (contractFiles.length > 0) {
        await supabase.storage.from("contracts").remove(contractFiles);
      }
      const { data: logoRows } = await clientLogoTable().select("storage_path,logo_path,logo_url,company_logo_url").in("client_id", ids);
      const logoPaths = (logoRows ?? [])
        .map((row: any) => getClientLogoPathFromRecord((row as Record<string, unknown>) ?? null))
        .filter(Boolean);
      if (logoPaths.length > 0) {
        await supabase.storage.from("client-logos").remove(logoPaths);
      }
      await (supabase as any).from("client_file_notes").delete().in("client_id", ids);
      await agreementRecordTable().delete().in("client_id", ids);
      await clientLogoTable().delete().in("client_id", ids);
      const { error: clientDeleteError } = await (supabase as any).from("clients").delete().in("id", ids);
      if (clientDeleteError) throw clientDeleteError;
      if (selectedClientRow?.id && ids.includes(String(selectedClientRow.id))) {
        setSelectedClientRow(null);
      }
      setSelectedClientIds(new Set());
      await fetchClients();
      toast({
        title: "Clients deleted",
        description: `Deleted ${ids.length} client${ids.length === 1 ? "" : "s"} successfully.`,
      });
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error?.message || "Could not delete selected clients.",
        variant: "destructive",
      });
    }
  }, [currentUserIsSubuser, fetchClients, selectedClientIds, selectedClientRow?.id, toast]);
  const selectedClientIndexInTableRows = useMemo(() => {
    if (!selectedClientRow?.id) return -1;
    return tableRows.findIndex((row) => String(row.id) === String(selectedClientRow.id));
  }, [selectedClientRow?.id, tableRows]);
  const previousVisibleClient = selectedClientIndexInTableRows > 0 ? tableRows[selectedClientIndexInTableRows - 1] : null;
  const nextVisibleClient =
    selectedClientIndexInTableRows >= 0 && selectedClientIndexInTableRows < tableRows.length - 1
      ? tableRows[selectedClientIndexInTableRows + 1]
      : null;
  const openAdjacentVisibleClient = useCallback(
    (direction: "previous" | "next") => {
      const target = direction === "previous" ? previousVisibleClient : nextVisibleClient;
      if (!target) return;
      openClientFile(target);
    },
    [nextVisibleClient, previousVisibleClient],
  );

  return (
    <DashboardLayout>
      <div className="space-y-0 -m-6">
        <div className="overflow-hidden rounded-tl-sm border border-slate-300 border-l-0 border-r-0 bg-white shadow-sm h-[calc(100dvh-var(--app-header-height,5rem))] pb-0">
          <div className="flex h-full flex-col">
            <div className="pl-4 pr-4 pt-1">
              <div className="pt-5 pb-2">
                <h1 className="text-4xl font-normal text-[#3eca44] -ml-1">Clients</h1>
                <p className="text-xs text-slate-600 mt-2">Browse, search, and manage your clients and attach their documents.</p>
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
                            placeholder="Search clients..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`h-8 rounded-sm border border-slate-200 bg-white !text-[11px] font-medium shadow-sm transition-colors placeholder:!text-[11px] hover:border-[#3eca44] focus-visible:!border focus-visible:!border-black focus-visible:ring-0 group-hover:border-[#3eca44] ${
                              searchQuery.trim().length > 0 ? "pr-20" : "pr-9"
                            }`}
                          />
                          {searchQuery.trim().length > 0 ? (
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-500 hover:text-[#2f9f35] hover:underline"
                              onClick={() => setSearchQuery("")}
                            >
                              Clear
                            </button>
                          ) : (
                            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                          )}
                        </div>
                        <p className="text-[11px] font-medium text-slate-500 whitespace-nowrap sm:self-end">
                          <span className="text-slate-900">{`${clientTableRangeStart}-${clientTableRangeEnd}`}</span> of {tableRows.length} clients
                        </p>
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        {selectedCount > 0 && !currentUserIsSubuser ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 rounded px-3 text-[11px] inline-flex items-center gap-1 border-rose-300 bg-white !text-rose-700 hover:bg-rose-50 hover:border-rose-400 hover:!text-rose-700 [&>svg]:!text-rose-700 hover:[&>svg]:!text-rose-700"
                            onClick={() => void handleDeleteSelectedClients()}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 rounded px-3 text-[11px] inline-flex items-center gap-1 border border-slate-200 bg-white text-slate-700 transition-colors hover:border-[#3eca44] hover:bg-white hover:text-[#2f9f35]"
                          onClick={() => void handleExportClientsPdf()}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Export
                        </Button>
                        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 w-24 justify-between rounded px-3 text-[11px] inline-flex items-center border border-slate-200 bg-white text-slate-700 transition-colors hover:border-[#3eca44] hover:bg-white hover:text-[#2f9f35] data-[state=open]:rounded-b-none data-[state=open]:border-[#3eca44]"
                            >
                              <span>Filter</span>
                              <ChevronDown className={`h-4 w-4 transition-transform ${isFilterOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent side="bottom" align="end" sideOffset={0} className="w-[220px] rounded-t-none border border-slate-200 border-t-0 bg-white p-3 shadow-lg">
                            <p className="text-[11px] text-slate-600">Filter options can be added here.</p>
                          </PopoverContent>
                        </Popover>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              className="h-8 w-36 justify-between rounded-[4px] px-3 text-[11px] inline-flex items-center border border-[#3eca44] bg-[#3eca44] text-white hover:bg-[#34b73b]"
                            >
                              <span>New Client</span>
                              <ChevronDown className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 border-slate-200 p-1">
                            <DropdownMenuItem
                              className="cursor-pointer text-[11px] font-medium text-slate-700 transition-transform duration-150 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[highlighted]:translate-x-[3px]"
                              onSelect={() => {
                                resetNewClientForm();
                                setIsNewClientOpen(true);
                              }}
                            >
                              <BuildingOfficeIcon className="mr-2 h-3.5 w-3.5" />
                              Single Client
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer text-[11px] font-medium text-slate-700 transition-transform duration-150 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[highlighted]:translate-x-[3px]"
                              onSelect={() => {
                                resetBulkClientImport();
                                setIsBulkClientOpen(true);
                              }}
                            >
                              <BuildingOffice2Icon className="mr-2 h-3.5 w-3.5" />
                              Multiple Clients
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 min-h-0 flex-col gap-2 overflow-hidden pl-4 pr-4 pb-0">
                    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm border border-slate-200">
                      <div className="grid grid-cols-[0.39fr_2.1fr_1.9fr_1.3fr_1fr_2fr_0.75fr] items-center gap-2 border-b bg-[#2D4256] pl-1 pr-3 py-3 text-xs font-semibold text-white">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            indicator="x"
                            aria-label="Select all clients"
                            checked={allVisibleSelected}
                            onCheckedChange={(checked) => toggleSelectAllVisibleClients(Boolean(checked))}
                            className="h-3 w-3 rounded-[2px] border-white/80 bg-white text-white data-[state=checked]:border-[#3eca44] data-[state=checked]:bg-[#3eca44]"
                          />
                        </div>
                        <div>Company Name</div>
                        <div>Trading As</div>
                        <div>Contact Person</div>
                        <div>Contact Number</div>
                        <div>Email</div>
                        <div>Status</div>
                      </div>

                      <div className="employee-table-scroll min-h-0 flex-1 divide-y overflow-y-auto">
                        {paginatedTableRows.map((row) => (
                          <div
                            key={row.id}
                            className="grid w-full grid-cols-[0.39fr_2.1fr_1.9fr_1.3fr_1fr_2fr_0.75fr] items-center gap-2 pl-1 pr-3 py-2 text-left text-xs hover:bg-[#3eca44]/5"
                          >
                            <div className="flex items-center justify-center">
                              <Checkbox
                                indicator="x"
                                aria-label={`Select ${row.companyNameDisplay}`}
                                checked={selectedClientIds.has(String(row.id))}
                                onCheckedChange={(checked) => toggleClientSelection(String(row.id), Boolean(checked))}
                                className="h-3 w-3 rounded-[2px] border-slate-400 text-white data-[state=checked]:border-[#3eca44] data-[state=checked]:bg-[#3eca44]"
                              />
                            </div>
                            <button type="button" onClick={() => openClientFile(row)} className="font-medium text-left hover:underline">
                              {row.companyNameDisplay}
                            </button>
                            <div>{row.tradingAs}</div>
                            <div>{row.contactPerson}</div>
                            <div>{row.contactNumber}</div>
                            <div>{row.email}</div>
                            <div>{getClientStatusIndicator(row.status).label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-auto flex flex-wrap items-center justify-center gap-2 px-1 pt-[15px] pb-[22px]">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 min-w-[86px] rounded-[4px] border border-[#8fd693] bg-white px-4 text-[11px] font-medium text-[#2f9f35] transition-colors hover:border-[#3eca44] hover:bg-[#eaf8eb] hover:text-[#2f9f35] disabled:border-[#d6ead7] disabled:text-[#a7c9a9]"
                        onClick={() => setClientTablePage((prev) => Math.max(1, prev - 1))}
                        disabled={currentClientTablePage === 1}
                      >
                        Previous
                      </Button>
                      {clientTablePageNumbers.map((page) =>
                        typeof page === "number" ? (
                          <button
                            key={page}
                            type="button"
                            onClick={() => setClientTablePage(page)}
                            className={`flex h-8 min-w-8 items-center justify-center rounded-[4px] border px-3 text-[11px] font-medium transition-colors ${
                              page === currentClientTablePage
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
                        onClick={() => setClientTablePage((prev) => Math.min(totalClientTablePages, prev + 1))}
                        disabled={currentClientTablePage === totalClientTablePages}
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
        open={isNewClientOpen}
        onOpenChange={(open) => {
          setIsNewClientOpen(open);
          if (!open) resetNewClientForm();
        }}
      >
        <DialogContent className="w-[94vw] max-w-[380px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden">
          <div className="relative">
            <div className="absolute inset-x-0 top-0 flex h-[46px] items-center justify-between px-4">
              <div className="flex items-center gap-2 pl-2">
                <User className="h-4 w-4 text-white" />
                <DialogTitle className="text-sm font-semibold text-white">New Client</DialogTitle>
              </div>
              <DialogClose asChild>
                <button type="button" className="text-white hover:text-white/80" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </DialogClose>
            </div>

            <div className="mt-[46px] bg-white px-6 pb-6 pt-2">
              <div className="pt-0 pb-2"></div>
              <div className="mx-auto w-full max-w-[320px] py-4">
                <div className="relative grid grid-cols-3 items-start">
                  <div className="pointer-events-none absolute left-[calc(16.6667%+26px)] top-[10px] h-[2px] w-[calc(33.3333%-52px)] bg-slate-300" />
                  <div className="pointer-events-none absolute left-[calc(50%+26px)] top-[10px] h-[2px] w-[calc(33.3333%-52px)] bg-slate-300" />
                  {(stepOneDone || newClientStep > 1) && <div className="pointer-events-none absolute left-[calc(16.6667%+26px)] top-[10px] h-[2px] w-[calc(33.3333%-52px)] bg-[#3eca44]" />}
                  {(stepTwoDone || newClientStep > 2) && <div className="pointer-events-none absolute left-[calc(50%+26px)] top-[10px] h-[2px] w-[calc(33.3333%-52px)] bg-[#3eca44]" />}

                  {[{ step: 1 as const, label: "Client Details" }, { step: 2 as const, label: "Membership" }, { step: 3 as const, label: "Address" }].map((item) => {
                    const done = item.step === 1 ? stepOneDone : item.step === 2 ? stepTwoDone : false;
                    const active = newClientStep === item.step;
                    const canOpen = canAccessStep(item.step);
                    return (
                      <button
                        key={item.step}
                        type="button"
                        onClick={() => goToStep(item.step)}
                        disabled={!canOpen}
                        className={`z-10 flex flex-col items-center text-center ${canOpen ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                      >
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${stepCircleClass(item.step)}`}>
                          {done && !active ? <Check className="h-3.5 w-3.5" /> : item.step}
                        </span>
                        <span className={`mt-3 text-[10px] font-semibold ${stepLabelClass(item.step)}`}>{item.label}</span>
                      </button>
                    );
                  })}
                </div>

              </div>
              <form
                  className="space-y-4 pt-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newClientStep < 3) handleNextStep();
                  }}
                >
                  <div className="h-[390px] pr-1">
                  {newClientStep === 1 && (
                    <div className="w-full space-y-4">
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Registered Name <span className="text-red-600">*</span></span>
                        <Input className={addModalFieldInputClass} placeholder="Insert company registered name" value={clientDetailsForm.registeredName} onChange={(e) => setClientDetailsForm((p) => ({ ...p, registeredName: e.target.value }))} />
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Trading as</span>
                        <Input className={addModalFieldInputClass} placeholder="Insert trading name" value={clientDetailsForm.tradingAs} onChange={(e) => setClientDetailsForm((p) => ({ ...p, tradingAs: e.target.value }))} />
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Company Type <span className="text-red-600">*</span></span>
                        <Select value={clientDetailsForm.companyType || undefined} onValueChange={(value) => setClientDetailsForm((p) => ({ ...p, companyType: value }))}>
                          <SelectTrigger className={`${addModalFieldSelectTriggerClass} ${addModalDropdownToneClass}`}>
                            <SelectValue placeholder="Select company type" />
                          </SelectTrigger>
                          <SelectContent className="text-[11px]">
                            {companyTypeOptions.map((option) => (
                              <SelectItem key={option} value={option} className={addModalSelectItemClass}>{option}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Registration Number <span className="text-red-600">*</span></span>
                        <Input className={addModalFieldInputClass} placeholder="Insert company registration number" value={clientDetailsForm.registrationNumber} onChange={(e) => setClientDetailsForm((p) => ({ ...p, registrationNumber: e.target.value }))} />
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">VAT Number</span>
                        <Input className={addModalFieldInputClass} placeholder="Insert company vat number" value={clientDetailsForm.vatNumber} onChange={(e) => setClientDetailsForm((p) => ({ ...p, vatNumber: e.target.value }))} />
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Primary Contact <span className="text-red-600">*</span></span>
                        <Input className={addModalFieldInputClass} placeholder="Insert primary contact name and surname" value={clientDetailsForm.owner} onChange={(e) => setClientDetailsForm((p) => ({ ...p, owner: e.target.value }))} />
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Primary Number <span className="text-red-600">*</span></span>
                        <Input className={addModalFieldInputClass} placeholder="Insert primary contact number" value={clientDetailsForm.telCell} onChange={(e) => setClientDetailsForm((p) => ({ ...p, telCell: e.target.value }))} />
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Primary Email <span className="text-red-600">*</span></span>
                        <Input className={addModalFieldInputClass} placeholder="Insert primary contact email" value={clientDetailsForm.email} onChange={(e) => setClientDetailsForm((p) => ({ ...p, email: e.target.value }))} />
                      </div>
                    </div>
                  )}

                  {newClientStep === 2 && (
                    <div className="w-full space-y-4">
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Client Number <span className="text-red-600">*</span></span>
                        <Input className={addModalFieldInputClass} value={membershipForm.clientNumber} onChange={(e) => setMembershipForm((p) => ({ ...p, clientNumber: e.target.value }))} />
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Start Date <span className="text-red-600">*</span></span>
                        <Input
                          type="text"
                          readOnly
                          className={addModalFieldInputClass}
                          placeholder="Please select a date"
                          value={membershipForm.startDate ? formatDisplayDate(membershipForm.startDate) : ""}
                          onClick={() => openDatePicker(startDateInputRef.current)}
                          onFocus={() => openDatePicker(startDateInputRef.current)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openDatePicker(startDateInputRef.current);
                            }
                          }}
                        />
                        <input
                          ref={startDateInputRef}
                          type="date"
                          value={membershipForm.startDate}
                          onChange={(e) => setMembershipForm((p) => ({ ...p, startDate: e.target.value }))}
                          className="sr-only"
                          aria-hidden="true"
                          tabIndex={-1}
                        />
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Membership Type <span className="text-red-600">*</span></span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                                className={`${addModalFieldSelectTriggerClass} ${addModalDropdownToneClass} w-full justify-between px-3 hover:bg-white hover:text-slate-700`}
                            >
                              <span className={`truncate text-left ${membershipForm.memberTypes.length === 0 ? "text-[10px] text-slate-400" : ""}`}>
                                {membershipForm.memberTypes.length > 0 ? membershipForm.memberTypes.join(", ") : "Select member type(s)"}
                              </span>
                              <ChevronDown className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-[320px] text-[11px]">
                            {membershipTypeOptions.map((memberType) => {
                              const isChecked = membershipForm.memberTypes.includes(memberType.value);
                              return (
                                <DropdownMenuCheckboxItem
                                  key={memberType.value}
                                  checked={isChecked}
                                  onSelect={(event) => event.preventDefault()}
                                  onCheckedChange={() =>
                                    setMembershipForm((prev) => ({
                                      ...prev,
                                      memberTypes: prev.memberTypes.includes(memberType.value)
                                        ? prev.memberTypes.filter((value) => value !== memberType.value)
                                        : [...prev.memberTypes, memberType.value],
                                    }))
                                  }
                                  className="cursor-pointer text-[11px] text-slate-700 focus:bg-[#3eca44]/10 focus:text-[#2f9f35] data-[highlighted]:bg-[#3eca44]/10 data-[highlighted]:text-[#2f9f35]"
                                >
                                  <span className="flex w-full items-center justify-between gap-3">
                                    <span>{memberType.label}</span>
                                    <span className="text-[10px] font-semibold text-slate-500">{memberType.value}</span>
                                  </span>
                                </DropdownMenuCheckboxItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {membershipForm.memberTypes.length > 0 ? (
                        membershipForm.memberTypes.map((serviceCode) => {
                          const cycleField = getServiceBillingCycleField(serviceCode);
                          return (
                            <div key={`new-client-cycle-${serviceCode}`} className="relative space-y-1">
                              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">
                                {serviceCode} Billing Cycle <span className="text-red-600">*</span>
                              </span>
                              <Select
                                value={String((membershipForm as any)[cycleField] || "") || undefined}
                                onValueChange={(value) => setMembershipForm((p) => ({ ...p, [cycleField]: value }))}
                              >
                                <SelectTrigger className={`${addModalFieldSelectTriggerClass} ${addModalDropdownToneClass}`}>
                                  <SelectValue placeholder="Please select billing cycle" />
                                </SelectTrigger>
                                <SelectContent className="text-[11px]">
                                  <SelectItem value="Monthly" className={addModalSelectItemClass}>Monthly</SelectItem>
                                  <SelectItem value="Annual" className={addModalSelectItemClass}>Annual</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })
                      ) : null}
                    </div>
                  )}

                  {newClientStep === 3 && (
                    <div className="w-full space-y-4">
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Address Line 1 <span className="text-red-600">*</span></span>
                        <Input className={addModalFieldInputClass} placeholder="Please insert address line 1" value={addressForm.line1} onChange={(e) => setAddressForm((p) => ({ ...p, line1: e.target.value }))} />
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Address Line 2</span>
                        <Input className={addModalFieldInputClass} placeholder="Please insert address line 2" value={addressForm.line2} onChange={(e) => setAddressForm((p) => ({ ...p, line2: e.target.value }))} />
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">City <span className="text-red-600">*</span></span>
                        <Input className={addModalFieldInputClass} placeholder="Please insert city" value={addressForm.city} onChange={(e) => setAddressForm((p) => ({ ...p, city: e.target.value }))} />
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Province <span className="text-red-600">*</span></span>
                        <Select value={addressForm.province || undefined} onValueChange={(value) => setAddressForm((p) => ({ ...p, province: value }))}>
                          <SelectTrigger className={`${addModalFieldSelectTriggerClass} ${addModalDropdownToneClass}`}>
                            <SelectValue placeholder="Please select province" />
                          </SelectTrigger>
                          <SelectContent className="text-[11px]">
                            <SelectItem value="Gauteng" className={addModalSelectItemClass}>Gauteng</SelectItem>
                            <SelectItem value="Limpopo" className={addModalSelectItemClass}>Limpopo</SelectItem>
                            <SelectItem value="Mpumalanga" className={addModalSelectItemClass}>Mpumalanga</SelectItem>
                            <SelectItem value="North West" className={addModalSelectItemClass}>North West</SelectItem>
                            <SelectItem value="Free State" className={addModalSelectItemClass}>Free State</SelectItem>
                            <SelectItem value="KwaZulu-Natal" className={addModalSelectItemClass}>KwaZulu-Natal</SelectItem>
                            <SelectItem value="Western Cape" className={addModalSelectItemClass}>Western Cape</SelectItem>
                            <SelectItem value="Eastern Cape" className={addModalSelectItemClass}>Eastern Cape</SelectItem>
                            <SelectItem value="Northern Cape" className={addModalSelectItemClass}>Northern Cape</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Area Code <span className="text-red-600">*</span></span>
                        <Input className={addModalFieldInputClass} placeholder="Please insert area code" value={addressForm.areaCode} onChange={(e) => setAddressForm((p) => ({ ...p, areaCode: e.target.value }))} />
                      </div>
                    </div>
                  )}
                  </div>

                  <div className="mt-6 grid grid-cols-3 items-center border-t border-dashed border-muted/60 pt-4">
                    <div className="justify-self-start">
                      {newClientStep > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-[28px] w-[84px] rounded border-[#3eca44] px-3 text-xs text-[#3eca44] hover:bg-transparent hover:text-[#3eca44]"
                          onClick={() => setNewClientStep((prev) => (prev === 1 ? prev : ((prev - 1) as 1 | 2 | 3)))}
                        >
                          Back
                        </Button>
                      )}
                    </div>
                    <div className="justify-self-center">
                      <Button type="button" variant="ghost" className="h-[30px] rounded border-0 px-3 text-xs text-slate-500 shadow-none hover:bg-transparent hover:text-slate-600 hover:underline" onClick={resetNewClientForm}>
                        Clear
                      </Button>
                    </div>
                    <div className="justify-self-end">
                      {newClientStep < 3 ? (
                        <Button
                          type="submit"
                          className="h-[28px] w-[84px] rounded bg-[#3eca44] px-3 text-xs text-white hover:bg-[#34b73b]"
                          disabled={(newClientStep === 1 && !isStepOneComplete) || (newClientStep === 2 && !isStepTwoComplete)}
                        >
                          Next
                        </Button>
                      ) : (
                        <Button type="button" onClick={() => void handleCreateClient()} className="h-[30px] w-[92px] rounded bg-[#3eca44] px-3 text-xs text-white hover:bg-[#34b73b]" disabled={!isStepThreeComplete || isSavingClient}>
                          {isSavingClient ? "Saving..." : "Add"}
                        </Button>
                      )}
                    </div>
                  </div>
                </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isBulkClientOpen}
        onOpenChange={(open) => {
          setIsBulkClientOpen(open);
          if (!open) resetBulkClientImport();
        }}
      >
        <DialogContent className="w-[94vw] max-w-[720px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden">
          <div className="relative">
            <div className="absolute inset-x-0 top-0 flex h-[46px] items-center justify-between px-4">
              <div className="flex items-center gap-2 pl-2">
                <FileSpreadsheet className="h-4 w-4 text-white" />
                <DialogTitle className="text-sm font-semibold text-white">Add Multiple Clients</DialogTitle>
              </div>
              <DialogClose asChild>
                <button type="button" className="text-white hover:text-white/80" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </DialogClose>
            </div>

            <div className="mt-[46px] bg-white px-6 pb-6 pt-5">
              <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
                <div className="rounded-sm border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Step 1</p>
                  <h3 className="mt-2 text-sm font-semibold text-slate-900">Download the Excel template</h3>
                  <p className="mt-2 text-[11px] leading-5 text-slate-600">
                    Use the LLASA client workbook, complete one line per client, then import the finished file below.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4 h-9 w-full justify-center gap-2 border-[#3eca44] text-[11px] font-semibold text-[#2f9f35] hover:bg-[#3eca44]/5 hover:text-[#2f9f35]"
                    onClick={() => void handleDownloadBulkClientTemplate()}
                  >
                    <Download className="h-4 w-4" />
                    Download Spreadsheet
                  </Button>
                </div>

                <div className="rounded-sm border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Step 2</p>
                  <h3 className="mt-2 text-sm font-semibold text-slate-900">Upload completed file</h3>
                  <p className="mt-2 text-[11px] leading-5 text-slate-600">
                    Drag the spreadsheet into the box or click inside the upload area, then press Import.
                  </p>
                  <input
                    ref={bulkClientUploadInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => void handleBulkClientUploadInputChange(e)}
                  />
                  <button
                    type="button"
                    className={`mt-4 flex min-h-[180px] w-full flex-col items-center justify-center rounded-sm border border-dashed px-6 py-8 text-center transition-colors ${
                      bulkClientDragActive
                        ? "border-[#3eca44] bg-[#3eca44]/5"
                        : "border-slate-300 bg-slate-50 hover:border-[#3eca44] hover:bg-[#3eca44]/5"
                    }`}
                    onClick={() => bulkClientUploadInputRef.current?.click()}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setBulkClientDragActive(true);
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      setBulkClientDragActive(false);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const file = event.dataTransfer.files?.[0];
                      if (!file) {
                        setBulkClientDragActive(false);
                        return;
                      }
                      void handleBulkClientFileSelection(file);
                    }}
                  >
                    <Upload className="h-7 w-7 text-[#2f9f35]" />
                    <span className="mt-3 text-sm font-semibold text-slate-900">
                      {isParsingBulkClients ? "Reading spreadsheet..." : "Upload file"}
                    </span>
                    <span className="mt-2 text-[11px] text-slate-500">
                      Drag and drop your Excel file here or click to browse.
                    </span>
                    {bulkClientFileName ? (
                      <span className="mt-4 rounded-full bg-[#3eca44]/10 px-3 py-1 text-[11px] font-semibold text-[#2f9f35]">
                        {bulkClientFileName}
                      </span>
                    ) : null}
                  </button>
                  <div className="mt-4 flex items-center justify-between rounded-sm border border-slate-200 bg-slate-50 px-3 py-2">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-700">Ready to import</p>
                      <p className="text-[11px] text-slate-500">
                        {bulkClientParsedRows.length > 0
                          ? `${bulkClientParsedRows.length} client row${bulkClientParsedRows.length === 1 ? "" : "s"} loaded`
                          : "No spreadsheet loaded yet"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      className="h-8 rounded bg-[#3eca44] px-4 text-[11px] font-semibold text-white hover:bg-[#34b73b] disabled:bg-slate-300"
                      disabled={bulkClientParsedRows.length === 0 || isParsingBulkClients || isImportingBulkClients}
                      onClick={() => void handleImportBulkClients()}
                    >
                      {isImportingBulkClients ? "Importing..." : "Import"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selectedClientRow && (
        <div className="fixed inset-0 z-50">
          <input ref={slaFileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => void handleSlaFileChange(e)} />
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/65"
            aria-label="Close client file"
            onClick={() => setSelectedClientRow(null)}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <section className="relative z-10 w-[94vw] max-w-[980px] h-[92vh] rounded-sm bg-[#2D4256] shadow-2xl overflow-hidden border-0">
              <div className="absolute inset-x-0 top-0 flex h-[46px] items-center justify-between px-4">
                <div className="flex items-center gap-5">
                  <h2 className="text-sm font-semibold text-white">Client File</h2>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isClientEditMode || !previousVisibleClient}
                      onClick={() => openAdjacentVisibleClient("previous")}
                      className="h-6 w-[84px] justify-center gap-1 rounded border-white/20 bg-white/10 px-2 text-[10px] font-semibold text-white hover:bg-white/15 hover:text-white hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft className="h-3 w-3 shrink-0" />
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isClientEditMode || !nextVisibleClient}
                      onClick={() => openAdjacentVisibleClient("next")}
                      className="h-6 w-[84px] justify-center gap-1 rounded border-white/20 bg-white/10 px-2 text-[10px] font-semibold text-white hover:bg-white/15 hover:text-white hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                      <ChevronRight className="h-3 w-3 shrink-0" />
                    </Button>
                  </div>
                </div>
                <button type="button" className="text-white hover:text-white/80" onClick={() => setSelectedClientRow(null)}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-[46px] h-[calc(92vh-46px)] overflow-hidden bg-white px-4 pb-4 pt-2">
                <div className="flex h-full min-h-0 flex-col space-y-4">
                  <div className="flex items-start justify-between gap-7">
                    <div className="mt-2 w-[160px] shrink-0">
                      <input
                        ref={clientLogoFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => void handleClientLogoFileChange(event)}
                      />
                      <div className="relative flex h-[120px] w-full items-center justify-center rounded border border-slate-300 bg-slate-50 overflow-hidden">
                        {resolveClientLogoUrl(selectedClientRow.id) ? (
                          <img src={resolveClientLogoUrl(selectedClientRow.id)} alt="Company logo" className="h-full w-full object-contain" />
                        ) : (
                          <span className="text-[10px] text-slate-500">No logo</span>
                        )}
                        {isClientEditMode ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              className="absolute right-1.5 top-1.5 h-6 w-6 rounded-full border-slate-300 bg-white/95 p-0 text-slate-600 hover:bg-white/95 hover:border-rose-300 hover:text-rose-600"
                              onClick={() => void removeClientLogo()}
                              disabled={isClientLogoUploading || !resolveClientLogoUrl(selectedClientRow.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="absolute bottom-1.5 left-1.5 h-6 w-6 rounded-full border-slate-300 bg-white/95 p-0 text-slate-600 hover:bg-white/95 hover:border-[#3eca44] hover:text-[#2f9f35]"
                              onClick={() => clientLogoFileInputRef.current?.click()}
                              disabled={isClientLogoUploading}
                            >
                              {resolveClientLogoUrl(selectedClientRow.id) ? <Pencil className="h-3 w-3" /> : <Camera className="h-3 w-3" />}
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex-1 pt-1">
                      {(() => {
                        const statusIndicator = getClientStatusIndicator(selectedClientRow.status);
                        return (
                          <div className="mb-0 inline-flex items-center gap-1.5 text-[10px] leading-none font-semibold text-slate-600">
                            <span className={`h-2 w-2 rounded-full ${statusIndicator.dotClass}`} />
                            <span>{statusIndicator.label}</span>
                          </div>
                        );
                      })()}
                      <h2 className="mt-2 text-2xl font-semibold text-slate-900">{selectedClientRow.companyNameDisplay || selectedClientRow.companyName}</h2>
                      {selectedClientRow.tradingAs && selectedClientRow.tradingAs !== "--" ? (
                        <p className="mb-2 text-sm text-slate-500">t/a {selectedClientRow.tradingAs}</p>
                      ) : null}
                      {Array.isArray(selectedClientRow.memberTypes) && selectedClientRow.memberTypes.length > 0 ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {selectedClientRow.memberTypes.map((service: string) => (
                            <span
                              key={service}
                              className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[9px] font-medium text-slate-600 transition-colors hover:border-[#3eca44] hover:text-[#2f9f35]"
                            >
                              {membershipLabelByValue[service] ?? service}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      {isClientEditMode ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 rounded text-[11px] border-slate-300 bg-white text-slate-700 hover:bg-white hover:border-slate-400 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                          onClick={cancelClientEdits}
                          disabled={isSavingClientEdit}
                        >
                          Cancel
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 rounded text-[11px] border-slate-300 bg-white text-slate-700 hover:bg-white hover:border-[#3eca44] hover:text-[#2f9f35] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        onClick={() => {
                          if (isClientEditMode) {
                            void handleSaveClientEdits();
                          } else {
                            setIsClientEditMode(true);
                          }
                        }}
                        disabled={isSavingClientEdit}
                      >
                        {isSavingClientEdit ? "Saving..." : isClientEditMode ? "Save" : "Edit"}
                      </Button>
                    </div>
                  </div>

                  <Tabs defaultValue="company" className="flex min-h-0 flex-1 flex-col">
                    <TabsList className="grid w-full grid-cols-5 bg-slate-100">
                      <TabsTrigger value="company" className="text-[11px] data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:text-[#2f9f35] data-[state=inactive]:hover:text-[12.33px] data-[state=active]:bg-[#2D4256] data-[state=active]:text-white data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Company</TabsTrigger>
                      <TabsTrigger value="membership" className="text-[11px] data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:text-[#2f9f35] data-[state=inactive]:hover:text-[12.33px] data-[state=active]:bg-[#2D4256] data-[state=active]:text-white data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Membership</TabsTrigger>
                      <TabsTrigger value="notes" className="text-[11px] data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:text-[#2f9f35] data-[state=inactive]:hover:text-[12.33px] data-[state=active]:bg-[#2D4256] data-[state=active]:text-white data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Notes</TabsTrigger>
                      <TabsTrigger value="matters" className="text-[11px] data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:text-[#2f9f35] data-[state=inactive]:hover:text-[12.33px] data-[state=active]:bg-[#2D4256] data-[state=active]:text-white data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Matters</TabsTrigger>
                      <TabsTrigger value="documents" className="text-[11px] data-[state=inactive]:text-slate-500 data-[state=inactive]:hover:text-[#2f9f35] data-[state=inactive]:hover:text-[12.33px] data-[state=active]:bg-[#2D4256] data-[state=active]:text-white data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Documents</TabsTrigger>
                    </TabsList>

                    <TabsContent value="company" className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
                      <div className="space-y-3 text-xs">
                        <div className={clientFileCardClass}>
                          <p className="mb-3 text-[13px] font-semibold text-slate-700 underline">Company Identity</p>
                          <div className="mt-2 space-y-2">
                            {[
                              [
                                ["Registered Name", "companyName", selectedClientRow.companyName],
                                ["Trading As", "tradingAs", selectedClientRow.tradingAs],
                              ],
                              [
                                ["Registration Number", "registrationNumber", selectedClientRow.registrationNumber],
                                ["VAT Number", "vatNumber", selectedClientRow.vatNumber],
                              ],
                            ].map((row, rowIndex) => (
                              <div key={rowIndex} className="grid grid-cols-1 gap-y-2 md:grid-cols-[minmax(130px,0.7fr)_minmax(220px,1.3fr)_minmax(130px,0.7fr)_minmax(220px,1.3fr)] md:items-center md:gap-x-6">
                                {row.map(([label, field, value]) => (
                                  <span key={String(field)} className="contents">
                                    <p className="text-[10px] font-medium text-slate-500">{label}</p>
                                    <div>
                                      {isClientEditMode ? (
                                        <Input className="h-8 rounded !text-[11px] md:!text-[11px] font-medium" value={(clientEditForm as any)[field]} onChange={(e) => setClientEditForm((p) => ({ ...p, [field]: e.target.value }))} />
                                      ) : (
                                        <p className="text-[11px] font-medium text-slate-900">{String(value || "--")}</p>
                                      )}
                                    </div>
                                  </span>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className={clientFileCardClass}>
                          <p className="mb-3 text-[13px] font-semibold text-slate-700 underline">Company Structure</p>
                          <div className="mt-2 space-y-2">
                            {[
                              [
                                ["Company Type", "companyType", selectedClientRow.companyType],
                                ["Industry", "industry", selectedClientRow.industry],
                              ],
                              [
                                ["Bargaining Council", "bargainingCouncil", selectedClientRow.bargainingCouncil],
                                ["Group", "groupName", selectedClientRow.groupName],
                              ],
                            ].map((row, rowIndex) => (
                              <div key={rowIndex} className="grid grid-cols-1 gap-y-2 md:grid-cols-[minmax(130px,0.7fr)_minmax(220px,1.3fr)_minmax(130px,0.7fr)_minmax(220px,1.3fr)] md:items-center md:gap-x-6">
                                {row.map(([label, field, value]) => (
                                  <span key={String(field)} className="contents">
                                    <p className="text-[10px] font-medium text-slate-500">{label}</p>
                                    <div>
                                      {isClientEditMode ? (
                                        field === "companyType" ? (
                                          <Select value={clientEditForm.companyType || undefined} onValueChange={(nextValue) => setClientEditForm((p) => ({ ...p, companyType: nextValue }))}>
                                            <SelectTrigger className={`${addModalFieldSelectTriggerClass} ${addModalDropdownToneClass} h-8 text-[11px]`}>
                                              <SelectValue placeholder="Select company type" />
                                            </SelectTrigger>
                                            <SelectContent className="text-[11px]">
                                              {companyTypeOptions.map((option) => (
                                                <SelectItem key={option} value={option} className={addModalSelectItemClass}>{option}</SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        ) : field === "bargainingCouncil" ? (
                                          <Popover open={isCouncilPickerOpen} onOpenChange={setIsCouncilPickerOpen}>
                                            <PopoverTrigger asChild>
                                              <button
                                                type="button"
                                                className={`${addModalFieldSelectTriggerClass} ${addModalDropdownToneClass} h-8 w-full px-3 text-[11px] inline-flex items-center justify-between`}
                                              >
                                                <span className={`truncate text-left ${clientEditForm.bargainingCouncil ? "text-slate-900" : "text-slate-400"}`}>
                                                  {clientEditForm.bargainingCouncil || "Select bargaining council"}
                                                </span>
                                                <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                                              </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[420px] border border-slate-200 bg-white p-0 shadow-lg" align="start" sideOffset={6}>
                                              <Command shouldFilter={false} className="bg-white text-slate-700">
                                                <CommandInput
                                                  value={councilSearchQuery}
                                                  onValueChange={setCouncilSearchQuery}
                                                  placeholder="Search bargaining council..."
                                                  className="h-8 border-b border-slate-200 text-[11px] placeholder:text-slate-400"
                                                />
                                                <CommandList>
                                                  <CommandEmpty className="py-3 text-[11px] text-slate-500">No councils found.</CommandEmpty>
                                                  <CommandGroup>
                                                    {filteredCouncilOptions.map((option) => (
                                                      <CommandItem
                                                        key={option.value}
                                                        value={`${option.value} ${option.label}`}
                                                        onSelect={() => {
                                                          setClientEditForm((p) => ({ ...p, bargainingCouncil: option.value }));
                                                          setCouncilSearchQuery("");
                                                          setIsCouncilPickerOpen(false);
                                                        }}
                                                        className="text-[11px] text-slate-700 data-[selected=true]:bg-[#3eca44]/10 data-[selected=true]:text-[#2f9f35]"
                                                      >
                                                        <Check className={`mr-2 h-3.5 w-3.5 ${clientEditForm.bargainingCouncil === option.value ? "opacity-100" : "opacity-0"}`} />
                                                        <span className="truncate">{option.label}</span>
                                                      </CommandItem>
                                                    ))}
                                                  </CommandGroup>
                                                </CommandList>
                                              </Command>
                                            </PopoverContent>
                                          </Popover>
                                        ) : field === "industry" ? (
                                          <Popover open={isIndustryPickerOpen} onOpenChange={setIsIndustryPickerOpen}>
                                            <PopoverTrigger asChild>
                                              <button
                                                type="button"
                                                className={`${addModalFieldSelectTriggerClass} ${addModalDropdownToneClass} h-8 w-full px-3 text-[11px] inline-flex items-center justify-between`}
                                              >
                                                <span className={`truncate text-left ${clientEditForm.industry ? "text-slate-900" : "text-slate-400"}`}>
                                                  {clientEditForm.industry || "Select industry"}
                                                </span>
                                                <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                                              </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[420px] border border-slate-200 bg-white p-0 shadow-lg" align="start" sideOffset={6}>
                                              <Command shouldFilter={false} className="bg-white text-slate-700">
                                                <CommandInput
                                                  value={industrySearchQuery}
                                                  onValueChange={setIndustrySearchQuery}
                                                  placeholder="Search industry..."
                                                  className="h-8 border-b border-slate-200 text-[11px] placeholder:text-slate-400"
                                                />
                                                <CommandList>
                                                  <CommandEmpty className="py-3 text-[11px] text-slate-500">No industries found.</CommandEmpty>
                                                  <CommandGroup>
                                                    {filteredIndustryOptions.map((option) => (
                                                      <CommandItem
                                                        key={option}
                                                        value={option}
                                                        onSelect={() => {
                                                          setClientEditForm((p) => ({ ...p, industry: option }));
                                                          setIndustrySearchQuery("");
                                                          setIsIndustryPickerOpen(false);
                                                        }}
                                                        className="text-[11px] text-slate-700 data-[selected=true]:bg-[#3eca44]/10 data-[selected=true]:text-[#2f9f35]"
                                                      >
                                                        <Check className={`mr-2 h-3.5 w-3.5 ${clientEditForm.industry === option ? "opacity-100" : "opacity-0"}`} />
                                                        <span className="truncate">{option}</span>
                                                      </CommandItem>
                                                    ))}
                                                  </CommandGroup>
                                                </CommandList>
                                              </Command>
                                            </PopoverContent>
                                          </Popover>
                                        ) : field === "groupName" ? (
                                          <Popover open={isGroupPickerOpen} onOpenChange={setIsGroupPickerOpen}>
                                            <PopoverTrigger asChild>
                                              <button
                                                type="button"
                                                className={`${addModalFieldSelectTriggerClass} ${addModalDropdownToneClass} h-8 w-full px-3 text-[11px] inline-flex items-center justify-between`}
                                              >
                                                <span className={`truncate text-left ${clientEditForm.groupName ? "text-slate-900" : "text-slate-400"}`}>
                                                  {clientEditForm.groupName || "Select or create group"}
                                                </span>
                                                <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                                              </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[420px] border border-slate-200 bg-white p-0 shadow-lg" align="start" sideOffset={6}>
                                              <Command shouldFilter={false} className="bg-white text-slate-700">
                                                <CommandInput
                                                  value={groupSearchQuery}
                                                  onValueChange={setGroupSearchQuery}
                                                  placeholder="Search or create group..."
                                                  className="h-8 border-b border-slate-200 text-[11px] placeholder:text-slate-400"
                                                />
                                                <CommandList>
                                                  <CommandEmpty className="py-3 text-[11px] text-slate-500">
                                                    No groups found.
                                                  </CommandEmpty>
                                                  <CommandGroup>
                                                    <CommandItem
                                                      value="None"
                                                      onSelect={() => {
                                                        setClientEditForm((p) => ({ ...p, groupName: "None", groupId: "" }));
                                                        setGroupSearchQuery("");
                                                        setIsGroupPickerOpen(false);
                                                      }}
                                                      className="text-[11px] text-slate-700 data-[selected=true]:bg-[#3eca44]/10 data-[selected=true]:text-[#2f9f35]"
                                                    >
                                                      <Check className={`mr-2 h-3.5 w-3.5 ${clientEditForm.groupName === "None" ? "opacity-100" : "opacity-0"}`} />
                                                      None
                                                    </CommandItem>
                                                    {filteredGroupOptions.map((group) => (
                                                      <CommandItem
                                                        key={group.id}
                                                        value={group.group_name}
                                                        onSelect={() => {
                                                          setClientEditForm((p) => ({ ...p, groupName: group.group_name, groupId: group.id }));
                                                          setGroupSearchQuery("");
                                                          setIsGroupPickerOpen(false);
                                                        }}
                                                        className="text-[11px] text-slate-700 data-[selected=true]:bg-[#3eca44]/10 data-[selected=true]:text-[#2f9f35]"
                                                      >
                                                        <Check className={`mr-2 h-3.5 w-3.5 ${clientEditForm.groupId === group.id ? "opacity-100" : "opacity-0"}`} />
                                                        {group.group_name}
                                                      </CommandItem>
                                                    ))}
                                                    {groupSearchQuery.trim() &&
                                                    !groupOptions.some(
                                                      (group) =>
                                                        group.group_name.trim().toLowerCase() === groupSearchQuery.trim().toLowerCase(),
                                                    ) ? (
                                                      <CommandItem
                                                        value={`create-${groupSearchQuery}`}
                                                        onSelect={() => {
                                                          const nextGroup = groupSearchQuery.trim();
                                                          setClientEditForm((p) => ({ ...p, groupName: nextGroup, groupId: "" }));
                                                          setGroupSearchQuery("");
                                                          setIsGroupPickerOpen(false);
                                                        }}
                                                        className="text-[11px] text-[#2f9f35] data-[selected=true]:bg-[#3eca44]/10 data-[selected=true]:text-[#2f9f35]"
                                                      >
                                                        Create "{groupSearchQuery.trim()}"
                                                      </CommandItem>
                                                    ) : null}
                                                  </CommandGroup>
                                                </CommandList>
                                              </Command>
                                            </PopoverContent>
                                          </Popover>
                                        ) : (
                                          <Input className="h-8 rounded !text-[11px] md:!text-[11px] font-medium" value={(clientEditForm as any)[field]} onChange={(e) => setClientEditForm((p) => ({ ...p, [field]: e.target.value }))} />
                                        )
                                      ) : (
                                        <p className="text-[11px] font-medium text-slate-900">{String(value || "--")}</p>
                                      )}
                                    </div>
                                  </span>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className={clientFileCardClass}>
                          <div className="mb-3 grid grid-cols-1 gap-y-2 md:grid-cols-[minmax(130px,0.7fr)_minmax(220px,1.3fr)_minmax(130px,0.7fr)_minmax(220px,1.3fr)] md:items-center md:gap-x-6">
                            <p className="text-[13px] font-semibold text-slate-700 underline">Ownership</p>
                            <div>
                              <button
                                type="button"
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 transition-colors hover:border-[#3eca44] hover:text-[#2f9f35] disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={!isClientEditMode}
                                onClick={() =>
                                  setClientEditForm((p) => ({
                                    ...p,
                                    contactPerson: p.primaryName,
                                    contactNumber: p.primaryNumber,
                                    ownerEmail: p.primaryEmail,
                                  }))
                                }
                              >
                                Same as Primary
                              </button>
                            </div>
                            <div />
                            <div />
                          </div>
                          <div className="mt-2 space-y-2">
                            {[
                              [
                                ["Owner", "contactPerson", selectedClientRow.ownerContactPerson],
                                ["", "", ""],
                              ],
                              [
                                ["Owner Number", "contactNumber", selectedClientRow.ownerContactNumber],
                                ["", "", ""],
                              ],
                              [
                                ["Owner Email", "ownerEmail", selectedClientRow.ownerContactEmail],
                                ["", "", ""],
                              ],
                            ].map((row, rowIndex) => (
                              <div key={rowIndex} className="grid grid-cols-1 gap-y-2 md:grid-cols-[minmax(130px,0.7fr)_minmax(220px,1.3fr)_minmax(130px,0.7fr)_minmax(220px,1.3fr)] md:items-center md:gap-x-6">
                                {row.map(([label, field, value]) => (
                                  field ? (
                                    <span key={String(field)} className="contents">
                                      <p className="text-[10px] font-medium text-slate-500">{label}</p>
                                      <div>
                                        {isClientEditMode ? (
                                          <Input className="h-8 rounded !text-[11px] md:!text-[11px] font-medium" value={(clientEditForm as any)[field]} onChange={(e) => setClientEditForm((p) => ({ ...p, [field]: e.target.value }))} />
                                        ) : (
                                          <p className="text-[11px] font-medium text-slate-900">{String(value || "--")}</p>
                                        )}
                                      </div>
                                    </span>
                                  ) : (
                                    <span key={`${rowIndex}-empty`} className="contents">
                                      <div />
                                      <div />
                                    </span>
                                  )
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className={clientFileCardClass}>
                          <p className="mb-3 text-[13px] font-semibold text-slate-700 underline">Contacts</p>
                          <div className="mt-2 space-y-2">
                            {[
                              [
                                ["Primary Name", "primaryName", selectedClientRow.primaryName],
                                ["Secondary Name", "secondaryName", selectedClientRow.secondaryName],
                              ],
                              [
                                ["Primary Job Title", "primaryJobTitle", selectedClientRow.primaryJobTitle],
                                ["Secondary Job Title", "secondaryJobTitle", selectedClientRow.secondaryJobTitle],
                              ],
                              [
                                ["Primary Number", "primaryNumber", selectedClientRow.primaryNumber],
                                ["Secondary Number", "secondaryNumber", selectedClientRow.secondaryNumber],
                              ],
                              [
                                ["Primary Email", "primaryEmail", selectedClientRow.primaryEmail],
                                ["Secondary Email", "secondaryEmail", selectedClientRow.secondaryEmail],
                              ],
                            ].map((row, rowIndex) => (
                              <div key={rowIndex} className="grid grid-cols-1 gap-y-2 md:grid-cols-[minmax(130px,0.7fr)_minmax(220px,1.3fr)_minmax(130px,0.7fr)_minmax(220px,1.3fr)] md:items-center md:gap-x-6">
                                {row.map(([label, field, value]) =>
                                  field ? (
                                    <span key={String(field)} className="contents">
                                      <p className="text-[10px] font-medium text-slate-500">{label}</p>
                                      <div>
                                        {isClientEditMode ? (
                                          <Input className="h-8 rounded !text-[11px] md:!text-[11px] font-medium" value={(clientEditForm as any)[field]} onChange={(e) => setClientEditForm((p) => ({ ...p, [field]: e.target.value }))} />
                                        ) : (
                                          <p className="text-[11px] font-medium text-slate-900">{String(value || "--")}</p>
                                        )}
                                      </div>
                                    </span>
                                  ) : (
                                    <span key={`${rowIndex}-empty`} className="contents">
                                      <div />
                                      <div />
                                    </span>
                                  ),
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className={clientFileCardClass}>
                          <p className="mb-3 text-[13px] font-semibold text-slate-700 underline">Address</p>
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 gap-y-2 md:grid-cols-[minmax(130px,0.7fr)_minmax(220px,1.3fr)_minmax(130px,0.7fr)_minmax(220px,1.3fr)] md:items-center md:gap-x-6">
                              <p className="text-[10px] font-semibold text-slate-600">Physical Address</p>
                              <div />
                              <p className="text-[10px] font-semibold text-slate-600">Postal Address</p>
                              <div className="justify-self-start">
                                {isClientEditMode ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-6 rounded px-2 text-[10px] border-slate-300 bg-white text-slate-600 hover:bg-white hover:border-[#3eca44] hover:text-[#2f9f35]"
                                    onClick={() =>
                                      setClientEditForm((p) => ({
                                        ...p,
                                        postalLine1: p.physicalLine1,
                                        postalLine2: p.physicalLine2,
                                        postalCity: p.physicalCity,
                                        postalProvince: p.physicalProvince,
                                        postalAreaCode: p.physicalAreaCode,
                                      }))
                                    }
                                  >
                                    Same as physical
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                            {[
                              ["Line 1", "physicalLine1", selectedClientRow.physicalLine1, "Line 1", "postalLine1", selectedClientRow.postalLine1],
                              ["Line 2", "physicalLine2", selectedClientRow.physicalLine2, "Line 2", "postalLine2", selectedClientRow.postalLine2],
                              ["City", "physicalCity", selectedClientRow.physicalCity, "City", "postalCity", selectedClientRow.postalCity],
                              ["Province", "physicalProvince", selectedClientRow.physicalProvince, "Province", "postalProvince", selectedClientRow.postalProvince],
                              ["Area Code", "physicalAreaCode", selectedClientRow.physicalAreaCode, "Area Code", "postalAreaCode", selectedClientRow.postalAreaCode],
                            ].map(([leftLabel, leftField, leftValue, rightLabel, rightField, rightValue]) => (
                              <div key={String(leftField)} className="grid grid-cols-1 gap-y-2 md:grid-cols-[minmax(130px,0.7fr)_minmax(220px,1.3fr)_minmax(130px,0.7fr)_minmax(220px,1.3fr)] md:items-center md:gap-x-6">
                                <p className="text-[10px] font-medium text-slate-500">{leftLabel}</p>
                                <div>
                                    {isClientEditMode ? (
                                      leftField === "physicalProvince" ? (
                                        <Select value={clientEditForm.physicalProvince || undefined} onValueChange={(nextValue) => setClientEditForm((p) => ({ ...p, physicalProvince: nextValue }))}>
                                          <SelectTrigger className={`${addModalFieldSelectTriggerClass} ${addModalDropdownToneClass} h-8 text-[11px]`}>
                                            <SelectValue placeholder="Select province" />
                                          </SelectTrigger>
                                          <SelectContent className="text-[11px]">
                                            {provinceOptions.map((province) => (
                                              <SelectItem key={province} value={province} className={addModalSelectItemClass}>{province}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <Input className="h-8 rounded !text-[11px] md:!text-[11px] font-medium" value={(clientEditForm as any)[leftField]} onChange={(e) => setClientEditForm((p) => ({ ...p, [leftField]: e.target.value }))} />
                                      )
                                    ) : (
                                      <p className="text-[11px] font-medium text-slate-900">{String(leftValue || "--")}</p>
                                    )}
                                </div>
                                <p className="text-[10px] font-medium text-slate-500">{rightLabel}</p>
                                <div>
                                  {isClientEditMode ? (
                                    rightField === "postalProvince" ? (
                                      <Select value={clientEditForm.postalProvince || undefined} onValueChange={(nextValue) => setClientEditForm((p) => ({ ...p, postalProvince: nextValue }))}>
                                        <SelectTrigger className={`${addModalFieldSelectTriggerClass} ${addModalDropdownToneClass} h-8 text-[11px]`}>
                                          <SelectValue placeholder="Select province" />
                                        </SelectTrigger>
                                        <SelectContent className="text-[11px]">
                                          {provinceOptions.map((province) => (
                                            <SelectItem key={province} value={province} className={addModalSelectItemClass}>{province}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <Input className="h-8 rounded !text-[11px] md:!text-[11px] font-medium" value={(clientEditForm as any)[rightField]} onChange={(e) => setClientEditForm((p) => ({ ...p, [rightField]: e.target.value }))} />
                                    )
                                  ) : (
                                    <p className="text-[11px] font-medium text-slate-900">{String(rightValue || "--")}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="membership" className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
                      <div className="space-y-3 text-xs">
                        <div className={clientFileCardClass}>
                          <p className="mb-3 text-[13px] font-semibold text-slate-700 underline">General Details</p>
                          <div className="space-y-2">
                            {[
                              [
                                ["Member Number", "clientNumber", selectedClientRow.clientNumber],
                                ["Start Date", "startDate", selectedClientRow.startDate],
                              ],
                              [
                                ["Renewal Date", "renewalDate", selectedClientRow.renewalDate],
                                ["Status", "status", selectedClientRow.status],
                              ],
                              [
                                ["Agreement (SLA)", "agreement", selectedClientRow.agreement],
                                ["", "", ""],
                              ],
                            ].map((row, rowIndex) => (
                              <div key={rowIndex} className="grid grid-cols-1 gap-y-2 md:grid-cols-[minmax(130px,0.7fr)_minmax(220px,1.3fr)_minmax(130px,0.7fr)_minmax(220px,1.3fr)] md:items-center md:gap-x-6">
                                {row.map(([label, field, value], idx) =>
                                  label ? (
                                    <span key={String(label)} className="contents">
                                      <p className="text-[10px] font-medium text-slate-500">{label}</p>
                                      {isClientEditMode ? (
                                        field === "status" ? (
                                          <div className="h-8 flex items-center justify-between gap-2">
                                            <Input
                                              readOnly
                                              className="h-8 rounded !text-[11px] md:!text-[11px] font-medium bg-slate-50 text-slate-700 cursor-not-allowed"
                                              value={clientEditForm.status || "--"}
                                            />
                                            <button
                                              type="button"
                                              className={`shrink-0 text-[10px] font-medium ${canCurrentUserChangeStatus ? "text-slate-700 hover:text-[#2f9f35] hover:underline" : "cursor-not-allowed text-slate-400"}`}
                                              onClick={() => {
                                                if (!canCurrentUserChangeStatus) {
                                                  toast({
                                                    title: "Change not allowed",
                                                    description: "Consultant and Administrator subusers cannot change status.",
                                                    variant: "destructive",
                                                  });
                                                  return;
                                                }
                                                setIsStatusChangeOpen(true);
                                              }}
                                              disabled={!canCurrentUserChangeStatus}
                                            >
                                              Change
                                            </button>
                                          </div>
                                        ) : field === "startDate" ? (
                                          <div className="relative">
                                            <Input
                                              type="text"
                                              readOnly
                                              className="h-8 rounded !text-[11px] md:!text-[11px] font-medium"
                                              placeholder="Please select a date"
                                              value={clientEditForm.startDate ? formatDisplayDate(clientEditForm.startDate) : ""}
                                              onClick={() => openDatePicker(editStartDateInputRef.current)}
                                              onFocus={() => openDatePicker(editStartDateInputRef.current)}
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                  e.preventDefault();
                                                  openDatePicker(editStartDateInputRef.current);
                                                }
                                              }}
                                            />
                                            <input
                                              ref={editStartDateInputRef}
                                              type="date"
                                              value={clientEditForm.startDate}
                                              onChange={(e) =>
                                                setClientEditForm((p) => {
                                                  const nextStartDate = e.target.value;
                                                  return {
                                                    ...p,
                                                    startDate: nextStartDate,
                                                    renewalDate: getNextRenewalDateFromStart(nextStartDate),
                                                  };
                                                })
                                              }
                                              className="absolute inset-0 opacity-0 pointer-events-none"
                                              aria-hidden="true"
                                              tabIndex={-1}
                                            />
                                          </div>
                                        ) : field === "renewalDate" ? (
                                          <Input
                                            type="text"
                                            readOnly
                                            className="h-8 rounded !text-[11px] md:!text-[11px] font-medium"
                                            value={clientEditForm.renewalDate ? formatDisplayDate(clientEditForm.renewalDate) : ""}
                                          />
                                        ) : field === "agreement" ? (
                                          pendingSlaFileName || (selectedClientRow?.id && slaRecordByClient[selectedClientRow.id]) ? (
                                            <div className="h-8 flex items-center justify-between gap-2">
                                              <p className="text-[11px] font-medium text-slate-900 truncate">
                                                {pendingSlaFileName || slaRecordByClient[selectedClientRow.id!]?.fileName || "SLA.pdf"}
                                              </p>
                                              <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                  type="button"
                                                  className="text-[10px] font-medium text-slate-700 hover:text-[#2f9f35] hover:underline"
                                                  onClick={() => slaFileInputRef.current?.click()}
                                                  disabled={isSlaUploading}
                                                >
                                                  Change
                                                </button>
                                                <button
                                                  type="button"
                                                  className="inline-flex items-center justify-center text-slate-500 hover:text-rose-600"
                                                  onClick={() => void handleRemoveSla()}
                                                  disabled={isSlaUploading}
                                                  aria-label="Remove SLA file"
                                                >
                                                  <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                              </div>
                                            </div>
                                          ) : (
                                            <Button
                                              type="button"
                                              variant="outline"
                                              className="h-7 rounded border-slate-300 bg-white px-2 text-[10px] text-slate-700 hover:bg-white hover:border-[#3eca44] hover:text-[#2f9f35]"
                                              onClick={() => slaFileInputRef.current?.click()}
                                              disabled={isSlaUploading}
                                            >
                                              Upload
                                            </Button>
                                          )
                                        ) : (
                                          <Input type={field === "startDate" || field === "renewalDate" ? "date" : "text"} className="h-8 rounded !text-[11px] md:!text-[11px] font-medium" value={(clientEditForm as any)[field]} onChange={(e) => setClientEditForm((p) => ({ ...p, [field]: e.target.value }))} />
                                        )
                                      ) : (
                                        field === "agreement" ? (
                                          pendingSlaFileName ? (
                                            <p className="text-[11px] font-medium text-slate-900">{pendingSlaFileName}</p>
                                          ) : selectedClientRow?.id && slaRecordByClient[selectedClientRow.id] ? (
                                            <button type="button" onClick={handleOpenSla} className="group inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-900 hover:text-[#2f9f35] hover:underline text-left">
                                              <Paperclip className="h-3 w-3 shrink-0" />
                                              <span>{slaRecordByClient[selectedClientRow.id]?.fileName || "View SLA"}</span>
                                            </button>
                                          ) : (
                                            <p className="text-[11px] font-medium text-slate-900">None</p>
                                          )
                                        ) : field === "status" ? (
                                          <div className="h-8 flex items-center justify-between gap-2">
                                            <p className="text-[11px] font-medium text-slate-900 truncate">{String(value || "--")}</p>
                                            {isClientEditMode ? (
                                              <button
                                                type="button"
                                                className={`text-[10px] font-medium ${canCurrentUserChangeStatus ? "text-slate-700 hover:text-[#2f9f35] hover:underline" : "cursor-not-allowed text-slate-400"}`}
                                                onClick={() => {
                                                  if (!canCurrentUserChangeStatus) {
                                                    toast({
                                                      title: "Change not allowed",
                                                      description: "Consultant and Administrator subusers cannot change status.",
                                                      variant: "destructive",
                                                    });
                                                    return;
                                                  }
                                                  setIsStatusChangeOpen(true);
                                                }}
                                                disabled={!canCurrentUserChangeStatus}
                                              >
                                                Change
                                              </button>
                                            ) : null}
                                          </div>
                                        ) : (
                                          <p className="text-[11px] font-medium text-slate-900">
                                            {field === "startDate" || field === "renewalDate"
                                              ? (value ? formatDisplayDate(String(value)) : "--")
                                              : String(value || "--")}
                                          </p>
                                        )
                                      )}
                                    </span>
                                  ) : (
                                    <span key={`general-empty-${rowIndex}-${idx}`} className="contents">
                                      <div />
                                      <div />
                                    </span>
                                  ),
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className={clientFileCardClass}>
                          <p className="mb-3 text-[13px] font-semibold text-slate-700 underline">Service Selection</p>
                          <div className="space-y-2">
                            {[
                              [
                                ["Labour Relations", "LR"],
                                ["Employment Equity", "EE"],
                              ],
                              [
                                ["Payroll", "PR"],
                                ["Health and Safety", "OHS"],
                              ],
                            ].map((row, rowIndex) => (
                              <div key={rowIndex} className="grid grid-cols-1 gap-y-2 md:grid-cols-[minmax(130px,0.7fr)_minmax(220px,1.3fr)_minmax(130px,0.7fr)_minmax(220px,1.3fr)] md:items-center md:gap-x-6">
                                {row.map(([label, code]) => {
                                  const selected = Array.isArray(selectedClientRow.memberTypes) && selectedClientRow.memberTypes.includes(code);
                                  return (
                                    <span key={String(code)} className="contents">
                                      <p className="text-[10px] font-medium text-slate-500">{label}</p>
                                      {isClientEditMode ? (
                                        <div>
                                          <Checkbox
                                            indicator="check"
                                            checked={clientEditForm.memberTypes.includes(code)}
                                            onCheckedChange={() =>
                                              setClientEditForm((p) => ({
                                                ...p,
                                                memberTypes: p.memberTypes.includes(code)
                                                  ? p.memberTypes.filter((v) => v !== code)
                                                  : [...p.memberTypes, code],
                                              }))
                                            }
                                            className="h-3.5 w-3.5 rounded-[2px] border-slate-400 data-[state=checked]:border-[#3eca44] data-[state=checked]:bg-[#3eca44]"
                                          />
                                        </div>
                                      ) : (
                                        <p className="text-[11px] font-medium">
                                          {selected ? (
                                            <Check className="h-3.5 w-3.5 text-[#2f9f35]" />
                                          ) : (
                                            <X className="h-3.5 w-3.5 text-rose-600" />
                                          )}
                                        </p>
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className={clientFileCardClass}>
                          <p className="mb-3 text-[13px] font-semibold text-slate-700 underline">Billing Terms</p>
                          <div className="space-y-2">
                            {(
                              (isClientEditMode ? clientEditForm.memberTypes : selectedClientRow.memberTypes) as string[]
                            ).length > 0 ? (
                              ((isClientEditMode ? clientEditForm.memberTypes : selectedClientRow.memberTypes) as string[]).map((serviceCode, index) => {
                                const retainerField =
                                  serviceCode === "LR"
                                    ? "lrRetainer"
                                    : serviceCode === "EE"
                                      ? "eeRetainer"
                                      : serviceCode === "PR"
                                        ? "prRetainer"
                                        : "hsRetainer";
                                const billingCycleField = getServiceBillingCycleField(serviceCode);
                                const rowRetainerValue = (isClientEditMode ? (clientEditForm as any)[retainerField] : (selectedClientRow as any)[retainerField]) as string;
                                const rowBillingCycleValue = (isClientEditMode ? (clientEditForm as any)[billingCycleField] : (selectedClientRow as any)[billingCycleField]) as string;
                                return (
                                <div
                                  key={`${serviceCode}-${index}`}
                                  className="grid grid-cols-1 gap-y-2 md:grid-cols-[minmax(130px,0.7fr)_minmax(220px,1.3fr)_minmax(130px,0.7fr)_minmax(220px,1.3fr)] md:items-center md:gap-x-6"
                                >
                                  <p className="text-[10px] font-medium text-slate-500">{membershipLabelByValue[serviceCode] ?? serviceCode}</p>
                                  {isClientEditMode ? (
                                    <Input
                                      className="h-8 rounded !text-[11px] md:!text-[11px] font-medium"
                                      value={rowRetainerValue || ""}
                                      onChange={(e) => setClientEditForm((p) => ({ ...p, [retainerField]: normalizeRetainerInput(e.target.value) }))}
                                    />
                                  ) : (
                                    <p className="text-[11px] font-medium text-slate-900">{formatRetainerDisplay(rowRetainerValue)}</p>
                                  )}
                                  <p className="text-[10px] font-medium text-slate-500">{serviceCode} Billing Cycle</p>
                                  {isClientEditMode ? (
                                    <Select value={rowBillingCycleValue || undefined} onValueChange={(nextValue) => setClientEditForm((p) => ({ ...p, [billingCycleField]: nextValue }))}>
                                      <SelectTrigger className={`${addModalFieldSelectTriggerClass} ${addModalDropdownToneClass} h-8 text-[11px]`}><SelectValue placeholder="Select cycle" /></SelectTrigger>
                                      <SelectContent className="text-[11px]">
                                        <SelectItem value="Monthly" className={addModalSelectItemClass}>Monthly</SelectItem>
                                        <SelectItem value="Annual" className={addModalSelectItemClass}>Annual</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <p className="text-[11px] font-medium text-slate-900">{String(rowBillingCycleValue || "--")}</p>
                                  )}
                                </div>
                              )})
                            ) : (
                              <div className="grid grid-cols-1 gap-y-2 md:grid-cols-[minmax(130px,0.7fr)_minmax(220px,1.3fr)_minmax(130px,0.7fr)_minmax(220px,1.3fr)] md:items-center md:gap-x-6">
                                <p className="text-[10px] font-medium text-slate-500">Retainer</p>
                                <p className="text-[11px] font-medium text-slate-900">--</p>
                                <p className="text-[10px] font-medium text-slate-500">Billing Cycle</p>
                                <p className="text-[11px] font-medium text-slate-900">{String(selectedClientRow.billingCycle || "--")}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="notes" className="mt-6 flex-1 min-h-0 overflow-y-auto pr-1">
                      <div className="space-y-0">
                        {isNotesLoading ? (
                          <div className="px-2 py-3 text-[11px] text-slate-500">Loading notes...</div>
                        ) : clientFileNotes.length === 0 ? (
                          <div className="space-y-3">
                            <div className="px-2 py-3 text-[11px] text-slate-500">No file notes yet.</div>
                            <Button
                              type="button"
                              className="h-8 rounded bg-[#3eca44] px-3 text-[11px] text-white hover:bg-[#34b73b]"
                              onClick={openAddFileNoteDialog}
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
                                  value={clientFileNotesSearchQuery}
                                  onChange={(e) => setClientFileNotesSearchQuery(e.target.value)}
                                  className={`h-8 rounded border border-slate-200 bg-white !text-[11px] font-medium shadow-sm transition-colors placeholder:!text-[11px] hover:border-[#3eca44] focus-visible:!border focus-visible:!border-black focus-visible:ring-0 group-hover:border-[#3eca44] ${
                                    clientFileNotesSearchQuery.trim().length > 0 ? "pr-20" : "pr-9"
                                  }`}
                                />
                                {clientFileNotesSearchQuery.trim().length > 0 ? (
                                  <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-500 hover:text-[#2f9f35] hover:underline"
                                    onClick={() => setClientFileNotesSearchQuery("")}
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
                                onClick={openAddFileNoteDialog}
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
                              {filteredClientFileNotes.length === 0 ? (
                                <div className="px-2 py-3 text-slate-500">No file notes found.</div>
                              ) : (
                                filteredClientFileNotes.map((note) => (
                                  <div key={note.id} className="grid grid-cols-[0.6fr_3.2fr_1fr_0.5fr] items-start gap-2 px-2 py-2 hover:bg-[#3eca44]/5">
                                    {(() => {
                                      const { content } = splitFileNoteContentAndEditTag(String(note.note_content || ""));
                                      return (
                                        <>
                                    <div className="min-w-0 text-slate-700">{formatDisplayDate(String(note.note_date || ""))}</div>
                                    <div className="min-w-0 pr-2">
                                      <button
                                        type="button"
                                        className="block w-full overflow-hidden text-ellipsis whitespace-nowrap text-left text-slate-900 hover:text-[#2f9f35] hover:underline"
                                        onClick={() => openFileNotePreviewDialog(String(note.note_content || ""), String(note.updated_at || ""))}
                                      >
                                        {content || "--"}
                                      </button>
                                    </div>
                                    <div className="min-w-0 truncate text-slate-700">{String(note.note_user_name || "--")}</div>
                                    <div className="min-w-0 flex items-center gap-2">
                                      <button
                                        type="button"
                                        className={`text-slate-500 ${isNoteEditableByCurrentUser(note) ? "hover:text-[#2f9f35]" : "cursor-not-allowed opacity-40"}`}
                                        onClick={() => openEditFileNoteDialog(note)}
                                        aria-label="Edit note"
                                        disabled={!isNoteEditableByCurrentUser(note)}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        className={`text-slate-500 ${canCurrentUserDeleteNotes ? "hover:text-rose-600" : "cursor-not-allowed opacity-40"}`}
                                        onClick={() => void handleDeleteFileNote(note.id)}
                                        aria-label="Delete note"
                                        disabled={!canCurrentUserDeleteNotes}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                        </>
                                      );
                                    })()}
                                  </div>
                                ))
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="matters" className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
                      <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">No matters linked yet.</div>
                    </TabsContent>

                    <TabsContent value="documents" className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
                      <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">No documents uploaded yet.</div>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
      <Dialog
        open={isFileNoteDialogOpen}
        onOpenChange={(open) => {
          setIsFileNoteDialogOpen(open);
          if (!open) resetFileNoteForm();
        }}
      >
        <DialogContent className="w-[94vw] max-w-[420px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <DialogTitle className="text-sm font-semibold text-white">{editingFileNoteId ? "Edit File Note" : "Add File Note"}</DialogTitle>
            <DialogClose asChild>
              <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded text-white/80 transition hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
          <div className="space-y-4 bg-white p-4 pt-6">
            <div className="relative space-y-1">
              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Note Content</span>
              <textarea
                className="min-h-[96px] w-full rounded border border-slate-300 bg-white px-3 py-2 text-[11px] font-medium text-slate-900 shadow-none outline-none transition-colors hover:border-slate-500 focus:border-black"
                value={fileNoteForm.noteContent}
                onChange={(e) => setFileNoteForm((p) => ({ ...p, noteContent: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <Button type="button" variant="outline" className="h-8 w-[92px] rounded text-[11px] border-slate-300 bg-white text-slate-700 hover:bg-white hover:border-slate-400 hover:text-slate-800" onClick={() => setIsFileNoteDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" className="h-8 w-[92px] rounded bg-[#3eca44] px-3 text-[11px] text-white hover:bg-[#34b73b]" onClick={() => void handleSaveFileNote()} disabled={isSavingFileNote}>
                {isSavingFileNote ? "Saving..." : "Submit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isFileNotePreviewOpen} onOpenChange={setIsFileNotePreviewOpen}>
        <DialogContent className="w-[94vw] max-w-[560px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <DialogTitle className="text-sm font-semibold text-white">File Note Preview</DialogTitle>
            <DialogClose asChild>
              <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded text-white/80 transition hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
          <div className="space-y-3 bg-white p-4">
            <div className="max-h-[52vh] overflow-y-auto whitespace-pre-wrap break-words rounded border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-900">
              {fileNotePreviewContent || "--"}
            </div>
            {fileNotePreviewEditTag ? (
              <div className="inline-flex rounded-full bg-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600">
                {sanitizeEditedTag(fileNotePreviewEditTag, fileNotePreviewUpdatedAt)}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={isStatusChangeOpen}
        onOpenChange={(open) => {
          setIsStatusChangeOpen(open);
          if (open) {
            setPendingStatusSelection(clientEditForm.status || "");
          }
        }}
      >
        <DialogContent className="w-[94vw] max-w-[380px] p-0 gap-0 overflow-hidden border-0 rounded-sm sm:rounded-sm bg-[#2D4256] [&>button]:hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <DialogTitle className="text-sm font-semibold text-white">Change Status</DialogTitle>
            <DialogClose asChild>
              <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded text-white/80 transition hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </DialogClose>
          </div>
          <div className="space-y-3 bg-white px-3 pb-3 pt-6">
            <div className="relative space-y-1.5 mb-7">
              <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">New Status</span>
              <Select value={pendingStatusSelection || undefined} onValueChange={setPendingStatusSelection}>
                <SelectTrigger className={`${addModalFieldSelectTriggerClass} ${addModalDropdownToneClass} h-8 text-[11px]`}>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="text-[11px]">
                  {statusReasonOptions.map((option) => (
                    <SelectItem key={option} value={option} className={addModalSelectItemClass}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="pt-1">
              <Button
                type="button"
                className="mx-auto h-8 w-[92px] rounded bg-[#3eca44] px-3 text-xs text-white hover:bg-[#34b73b]"
                disabled={!pendingStatusSelection.trim() || !canCurrentUserChangeStatus}
                onClick={() => {
                  if (!canCurrentUserChangeStatus) {
                    toast({
                      title: "Change not allowed",
                      description: "Consultant and Administrator subusers cannot change status.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setClientEditForm((prev) => ({ ...prev, status: pendingStatusSelection }));
                  setIsStatusChangeOpen(false);
                }}
              >
                Submit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default ClientsTwo;



