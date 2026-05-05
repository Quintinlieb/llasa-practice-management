import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Camera, Check, ChevronDown, Paperclip, Pencil, Plus, Search, Trash2, User, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const clientLogoTable = () => (supabase as any).from("client_logos");
const agreementRecordTable = () => (supabase as any).from("membership_contracts");
const SLA_RECORD_TYPE = "Service Level Agreement";
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

const ClientsTwo = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [newClientStep, setNewClientStep] = useState<1 | 2 | 3>(1);
  const startDateInputRef = useRef<HTMLInputElement | null>(null);
  const editStartDateInputRef = useRef<HTMLInputElement | null>(null);
  const clientLogoFileInputRef = useRef<HTMLInputElement | null>(null);
  const slaFileInputRef = useRef<HTMLInputElement | null>(null);

  const [clientDetailsForm, setClientDetailsForm] = useState({
    registeredName: "",
    tradingAs: "",
    registrationNumber: "",
    vatNumber: "",
    owner: "",
    telCell: "",
    email: "",
  });
  const [membershipForm, setMembershipForm] = useState({
    clientNumber: "LL00001",
    startDate: "",
    renewalDate: "",
    paymentCycle: "",
    memberTypes: [] as string[],
  });
  const [addressForm, setAddressForm] = useState({
    line1: "",
    line2: "",
    city: "",
    province: "",
    areaCode: "",
  });
  const [clientRows, setClientRows] = useState<any[]>([]);
  const [isSavingClient, setIsSavingClient] = useState(false);
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
    lrRetainer: "",
    eeRetainer: "",
    prRetainer: "",
    hsRetainer: "",
    status: "",
  });

  const isStepOneComplete = Boolean(
    clientDetailsForm.registeredName.trim() &&
      clientDetailsForm.registrationNumber.trim() &&
      clientDetailsForm.owner.trim() &&
      clientDetailsForm.telCell.trim() &&
      clientDetailsForm.email.trim(),
  );
  const isStepTwoComplete = Boolean(
      membershipForm.clientNumber.trim() &&
      membershipForm.startDate.trim() &&
      membershipForm.paymentCycle.trim() &&
      membershipForm.memberTypes.length > 0,
  );
  const isStepThreeComplete = Boolean(
    addressForm.line1.trim() &&
      addressForm.city.trim() &&
      addressForm.province.trim() &&
      addressForm.areaCode.trim(),
  );

  const resetNewClientForm = () => {
    setNewClientStep(1);
    setClientDetailsForm({
      registeredName: "",
      tradingAs: "",
      registrationNumber: "",
      vatNumber: "",
      owner: "",
      telCell: "",
      email: "",
    });
    setMembershipForm({
      clientNumber: "LL00001",
      startDate: "",
      renewalDate: "",
      paymentCycle: "",
      memberTypes: [],
    });
    setAddressForm({
      line1: "",
      line2: "",
      city: "",
      province: "",
      areaCode: "",
    });
  };

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
    const withoutPrefix = base.replace(/^.*-SLA[_-]*/i, "");
    const cleaned = withoutPrefix.replace(/_/g, " ").replace(/\s+/g, " ").trim();
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
    "Private Company (Pty) Ltd",
    "Close Corporation (CC)",
    "Sole Proprietor",
    "Partnership",
    "Trust",
    "Non-Profit Company (NPC)",
    "Public Company (Ltd)",
    "Personal Liability Company (Inc.)",
    "State-Owned Company (SOC Ltd)",
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

  const mapClientRow = (row: any) => ({
    id: row.id,
    companyName: row.registered_name || "--",
    tradingAs: row.trading_as || row.trading_name || "--",
    registrationNumber: row.registration_number || "--",
    vatNumber: row.vat_number || "--",
    companyType: row.company_type || "--",
    industry: row.industry || "--",
    bargainingCouncil: extractCouncilAbbreviation(row.bargaining_council),
    groupName: row.group_name || "None",
    groupId: row.group_id || "",
    contactPerson: row.owner_name || row.owner || "--",
    contactNumber: row.owner_number || row.tel_cell || "--",
    ownerEmail: row.owner_email || row.client_email || "--",
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
    email: row.owner_email || row.client_email || "--",
    status: row.status ? String(row.status).replace(/^./, (s) => s.toUpperCase()) : "Active",
    memberTypes: Array.isArray(row.member_types) ? row.member_types.filter(Boolean) : [],
    clientNumber: row.client_number || "--",
    startDate: row.start_date || "--",
    renewalDate: row.renewal_date || getNextRenewalDateFromStart(row.start_date) || "--",
    agreement: row.agreement || "--",
    billingCycle: row.membership_period || row.retainer_cycle || "--",
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
      .eq("company_id", user.id)
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
      .eq("company_id", user.id)
      .order("group_name", { ascending: true });
    if (error) return;
    setGroupOptions(data ?? []);
  }, [user?.id]);

  useEffect(() => {
    void fetchClients();
  }, [fetchClients]);
  useEffect(() => {
    void fetchClientGroups();
  }, [fetchClientGroups]);
  const fetchSlaContract = useCallback(async (clientId: string) => {
    if (!user?.id) return;
    const { data, error } = await agreementRecordTable()
      .select("id, file_url")
      .eq("company_id", user.id)
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

  const handleCreateClient = async () => {
    if (!user?.id) return;
    if (!isStepOneComplete || !isStepTwoComplete || !isStepThreeComplete) return;
    setIsSavingClient(true);
    try {
      const normalizedCycle =
        membershipForm.paymentCycle.trim().toLowerCase() === "annually"
          ? "Annual"
          : membershipForm.paymentCycle.trim();
      const basePayload: Record<string, unknown> = {
        company_id: user.id,
        client_number: membershipForm.clientNumber.trim() || null,
        status: "active",
      };
      const optionalPayload: Record<string, unknown> = {
        registered_name: clientDetailsForm.registeredName.trim() || null,
        trading_as: clientDetailsForm.tradingAs.trim() || null,
        trading_name: clientDetailsForm.tradingAs.trim() || null,
        registration_number: clientDetailsForm.registrationNumber.trim() || null,
        vat_number: clientDetailsForm.vatNumber.trim() || null,
        owner_name: clientDetailsForm.owner.trim() || null,
        owner_number: clientDetailsForm.telCell.trim() || null,
        owner_email: clientDetailsForm.email.trim() || null,
        start_date: membershipForm.startDate.trim() || null,
        membership_period: normalizedCycle || null,
        retainer_cycle: normalizedCycle || null,
        member_types: membershipForm.memberTypes,
        physical_address_line1: addressForm.line1.trim() || null,
        physical_address_line2: addressForm.line2.trim() || null,
        city: addressForm.city.trim() || null,
        province: addressForm.province.trim() || null,
        area_code: addressForm.areaCode.trim() || null,
        bargaining_council: "None",
      };
      const payload: Record<string, unknown> = { ...basePayload, ...optionalPayload };

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
            company_id: user.id,
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
      const { error: deleteError } = await agreementRecordTable().delete().eq("id", existing.id).eq("company_id", user.id);
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
      contactPerson: row.contactPerson === "--" ? "" : row.contactPerson || "",
      contactNumber: row.contactNumber === "--" ? "" : row.contactNumber || "",
      ownerEmail: row.ownerEmail === "--" ? "" : row.ownerEmail || "",
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
            await agreementRecordTable().delete().eq("id", existing.id).eq("company_id", user.id);
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
            company_id: user.id,
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
              company_id: user?.id,
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
          .eq("id", selectedClientRow.id)
          .eq("company_id", user?.id);
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
              tradingAs: clientEditForm.tradingAs || "--",
              registrationNumber: clientEditForm.registrationNumber || "--",
              vatNumber: clientEditForm.vatNumber || "--",
              companyType: clientEditForm.companyType || "--",
              industry: clientEditForm.industry || "--",
              bargainingCouncil: clientEditForm.bargainingCouncil || "--",
              groupName: clientEditForm.groupName || "--",
              groupId: resolvedGroupId || "",
              contactPerson: clientEditForm.contactPerson || "--",
              contactNumber: clientEditForm.contactNumber || "--",
              ownerEmail: clientEditForm.ownerEmail || "--",
              primaryName: clientEditForm.primaryName || "--",
              primaryJobTitle: clientEditForm.primaryJobTitle || "--",
              primaryNumber: clientEditForm.primaryNumber || "--",
              primaryEmail: clientEditForm.primaryEmail || "--",
              secondaryName: clientEditForm.secondaryName || "--",
              secondaryJobTitle: clientEditForm.secondaryJobTitle || "--",
              secondaryNumber: clientEditForm.secondaryNumber || "--",
              secondaryEmail: clientEditForm.secondaryEmail || "--",
              email: clientEditForm.ownerEmail || "--",
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

  return (
    <DashboardLayout>
      <div className="space-y-0 -m-6">
        <div className="border border-slate-300 border-r-0 bg-white shadow-sm h-[calc(100dvh-var(--app-header-height,5rem))] pb-0">
          <div className="flex h-full flex-col">
            <div className="pl-4 pr-4 pt-1">
              <div className="pt-5 pb-2">
                <h1 className="text-4xl font-normal text-[#3eca44] -ml-1">Cleints 2</h1>
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
                            className={`h-8 rounded-sm border border-slate-200 bg-white !text-[11px] font-semibold shadow-sm transition-colors placeholder:!text-[11px] hover:border-[#3eca44] focus-visible:!border focus-visible:!border-black focus-visible:ring-0 group-hover:border-[#3eca44] ${
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
                          <span className="text-slate-900">{tableRows.length > 0 ? `1-${tableRows.length}` : "0-0"}</span> of {clientRows.length} clients
                        </p>
                      </div>
                      <div className="flex items-center gap-2 justify-end">
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
                        <Button
                          type="button"
                          onClick={() => setIsNewClientOpen(true)}
                          className="h-8 w-36 justify-between rounded-[4px] px-3 text-[11px] inline-flex items-center border border-[#3eca44] bg-[#3eca44] text-white hover:bg-[#34b73b]"
                        >
                          <span>New Client</span>
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pl-4 pr-4 pb-2 flex-1 min-h-0 overflow-hidden">
                    <div className="relative overflow-hidden rounded-sm border border-slate-200">
                      <div className="grid grid-cols-[0.39fr_2.1fr_1.9fr_1.3fr_1fr_2fr_0.75fr] items-center gap-2 border-b bg-[#2D4256] pl-1 pr-3 py-3 text-xs font-semibold text-white">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            indicator="x"
                            aria-label="Select all clients"
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

                      <div className="divide-y overflow-auto min-h-0" style={{ height: "calc(100dvh - var(--app-header-height,5rem) - 350px)" }}>
                        {tableRows.map((row) => (
                          <div key={row.id} className="grid w-full grid-cols-[0.39fr_2.1fr_1.9fr_1.3fr_1fr_2fr_0.75fr] items-center gap-2 pl-1 pr-3 py-2 text-left text-xs hover:bg-[#3eca44]/5">
                            <div className="flex items-center justify-center">
                              <Checkbox
                                indicator="x"
                                aria-label={`Select ${row.companyName}`}
                                className="h-3 w-3 rounded-[2px] border-slate-400 text-white data-[state=checked]:border-[#3eca44] data-[state=checked]:bg-[#3eca44]"
                              />
                            </div>
                            <button type="button" onClick={() => openClientFile(row)} className="font-medium text-left hover:underline">
                              {row.companyName}
                            </button>
                            <div>{row.tradingAs}</div>
                            <div>{row.contactPerson}</div>
                            <div>{row.contactNumber}</div>
                            <div>{row.email}</div>
                            <div>{row.status}</div>
                          </div>
                        ))}
                      </div>
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
                  <div className="h-[330px] pr-1">
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
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Registration Number <span className="text-red-600">*</span></span>
                        <Input className={addModalFieldInputClass} placeholder="Insert company registration number" value={clientDetailsForm.registrationNumber} onChange={(e) => setClientDetailsForm((p) => ({ ...p, registrationNumber: e.target.value }))} />
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">VAT Number</span>
                        <Input className={addModalFieldInputClass} placeholder="Insert company vat number" value={clientDetailsForm.vatNumber} onChange={(e) => setClientDetailsForm((p) => ({ ...p, vatNumber: e.target.value }))} />
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Owner <span className="text-red-600">*</span></span>
                        <Input className={addModalFieldInputClass} placeholder="Insert owner's name and surname" value={clientDetailsForm.owner} onChange={(e) => setClientDetailsForm((p) => ({ ...p, owner: e.target.value }))} />
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Tell / Cell <span className="text-red-600">*</span></span>
                        <Input className={addModalFieldInputClass} placeholder="Insert company contact number" value={clientDetailsForm.telCell} onChange={(e) => setClientDetailsForm((p) => ({ ...p, telCell: e.target.value }))} />
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Email <span className="text-red-600">*</span></span>
                        <Input className={addModalFieldInputClass} placeholder="Insert company email" value={clientDetailsForm.email} onChange={(e) => setClientDetailsForm((p) => ({ ...p, email: e.target.value }))} />
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
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Payment Cycle <span className="text-red-600">*</span></span>
                        <Select value={membershipForm.paymentCycle || undefined} onValueChange={(value) => setMembershipForm((p) => ({ ...p, paymentCycle: value }))}>
                          <SelectTrigger className={`${addModalFieldSelectTriggerClass} ${addModalDropdownToneClass}`}>
                            <SelectValue placeholder="Please select payment cycle" />
                          </SelectTrigger>
                          <SelectContent className="text-[11px]">
                            <SelectItem value="Monthly" className={addModalSelectItemClass}>Monthly</SelectItem>
                            <SelectItem value="Annual" className={addModalSelectItemClass}>Annual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="relative space-y-1">
                        <span className="pointer-events-none absolute -top-1.5 left-3 z-10 bg-white px-1 text-[10px] font-semibold text-slate-400">Member Type <span className="text-red-600">*</span></span>
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
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-sm font-semibold text-white">Client File</h2>
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
                      <h2 className="mt-2 text-2xl font-semibold text-slate-900">{selectedClientRow.companyName}</h2>
                      {selectedClientRow.tradingAs && selectedClientRow.tradingAs !== "--" ? (
                        <p className="mb-2 text-xs text-slate-500">t/a {selectedClientRow.tradingAs}</p>
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
                          className="h-8 text-[11px] border-slate-300 bg-white text-slate-700 hover:bg-white hover:border-slate-400 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                          onClick={cancelClientEdits}
                          disabled={isSavingClientEdit}
                        >
                          Cancel
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 text-[11px] border-slate-300 bg-white text-slate-700 hover:bg-white hover:border-[#3eca44] hover:text-[#2f9f35] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
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
                      <TabsTrigger value="company" className="text-[11px] data-[state=inactive]:text-slate-300 data-[state=inactive]:hover:text-[#2f9f35] data-[state=active]:bg-white data-[state=active]:text-[#2f9f35] data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Company</TabsTrigger>
                      <TabsTrigger value="membership" className="text-[11px] data-[state=inactive]:text-slate-300 data-[state=inactive]:hover:text-[#2f9f35] data-[state=active]:bg-white data-[state=active]:text-[#2f9f35] data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Membership</TabsTrigger>
                      <TabsTrigger value="notes" className="text-[11px] data-[state=inactive]:text-slate-300 data-[state=inactive]:hover:text-[#2f9f35] data-[state=active]:bg-white data-[state=active]:text-[#2f9f35] data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Notes</TabsTrigger>
                      <TabsTrigger value="matters" className="text-[11px] data-[state=inactive]:text-slate-300 data-[state=inactive]:hover:text-[#2f9f35] data-[state=active]:bg-white data-[state=active]:text-[#2f9f35] data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Matters</TabsTrigger>
                      <TabsTrigger value="documents" className="text-[11px] data-[state=inactive]:text-slate-300 data-[state=inactive]:hover:text-[#2f9f35] data-[state=active]:bg-white data-[state=active]:text-[#2f9f35] data-[state=active]:shadow-none focus-visible:outline-none focus-visible:ring-0">Documents</TabsTrigger>
                    </TabsList>

                    <TabsContent value="company" className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
                      <div className="space-y-3 text-xs">
                        <div className="rounded border border-slate-200 bg-white p-3 transition-colors hover:border-slate-500">
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

                        <div className="rounded border border-slate-200 bg-white p-3 transition-colors hover:border-slate-500">
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

                        <div className="rounded border border-slate-200 bg-white p-3 transition-colors hover:border-slate-500">
                          <p className="mb-3 text-[13px] font-semibold text-slate-700 underline">Ownership</p>
                          <div className="mt-2 space-y-2">
                            {[
                              [
                                ["Owner", "contactPerson", selectedClientRow.contactPerson],
                                ["", "", ""],
                              ],
                              [
                                ["Owner Number", "contactNumber", selectedClientRow.contactNumber],
                                ["", "", ""],
                              ],
                              [
                                ["Owner Email", "ownerEmail", selectedClientRow.ownerEmail],
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

                        <div className="rounded border border-slate-200 bg-white p-3 transition-colors hover:border-slate-500">
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

                        <div className="rounded border border-slate-200 bg-white p-3 transition-colors hover:border-slate-500">
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
                        <div className="rounded border border-slate-200 bg-white p-3 transition-colors hover:border-slate-500">
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
                                          <Select value={clientEditForm.status} onValueChange={(nextValue) => setClientEditForm((p) => ({ ...p, status: nextValue }))}>
                                            <SelectTrigger className={`${addModalFieldSelectTriggerClass} ${addModalDropdownToneClass} h-8 text-[11px]`}><SelectValue /></SelectTrigger>
                                            <SelectContent className="text-[11px]">
                                              <SelectItem value="Active" className={addModalSelectItemClass}>Active</SelectItem>
                                              <SelectItem value="Suspended" className={addModalSelectItemClass}>Suspended</SelectItem>
                                              <SelectItem value="Cancelled" className={addModalSelectItemClass}>Cancelled</SelectItem>
                                              <SelectItem value="Pending" className={addModalSelectItemClass}>Pending</SelectItem>
                                            </SelectContent>
                                          </Select>
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

                        <div className="rounded border border-slate-200 bg-white p-3 transition-colors hover:border-slate-500">
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
                                        <p className="text-[11px] font-medium text-slate-900">{selected ? "Selected" : "--"}</p>
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded border border-slate-200 bg-white p-3 transition-colors hover:border-slate-500">
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
                                const rowRetainerValue = (isClientEditMode ? (clientEditForm as any)[retainerField] : (selectedClientRow as any)[retainerField]) as string;
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
                                  {index === 0 ? (
                                    <>
                                      <p className="text-[10px] font-medium text-slate-500">Billing Cycle</p>
                                      {isClientEditMode ? (
                                        <Select value={clientEditForm.billingCycle || undefined} onValueChange={(nextValue) => setClientEditForm((p) => ({ ...p, billingCycle: nextValue }))}>
                                          <SelectTrigger className={`${addModalFieldSelectTriggerClass} ${addModalDropdownToneClass} h-8 text-[11px]`}><SelectValue placeholder="Select cycle" /></SelectTrigger>
                                          <SelectContent className="text-[11px]">
                                            <SelectItem value="Monthly" className={addModalSelectItemClass}>Monthly</SelectItem>
                                            <SelectItem value="Annual" className={addModalSelectItemClass}>Annual</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <p className="text-[11px] font-medium text-slate-900">{String(selectedClientRow.billingCycle || "--")}</p>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <div />
                                      <div />
                                    </>
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

                    <TabsContent value="notes" className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
                      <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">No notes yet.</div>
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
    </DashboardLayout>
  );
};

export default ClientsTwo;


